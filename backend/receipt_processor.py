import cv2
import numpy as np
import pytesseract
from PIL import Image
import re
from datetime import datetime
import io
from typing import List, Dict, Optional, Any
import shutil
import logging
import asyncio
import json

class ReceiptProcessor:
    def __init__(self):
        # Test if OpenCV is available
        try:
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.jpg') as tmp:
                cv2.imread(tmp.name)
        except Exception as e:
            raise ImportError(f"OpenCV (cv2) is not properly installed: {str(e)}")
        
        # Try to locate tesseract executable (fallback OCR)
        tesseract_paths = [
            shutil.which('tesseract'),
            '/opt/homebrew/bin/tesseract',
            '/usr/local/bin/tesseract',
            '/usr/bin/tesseract'
        ]
        
        self._tesseract_available = False
        for path in tesseract_paths:
            if path and shutil.which(path):
                try:
                    pytesseract.pytesseract.tesseract_cmd = path
                    pytesseract.get_tesseract_version()
                    self._tesseract_available = True
                    break
                except Exception:
                    continue
        
        if not self._tesseract_available:
            logging.warning("Tesseract OCR not found. Will rely on Gemini Vision for receipt processing.")

    # ─────────────────────── GEMINI VISION METHOD ───────────────────────

    async def process_with_gemini_vision(self, image_bytes: bytes, gemini_model) -> dict:
        """Use Gemini 1.5 Vision to parse the receipt with high accuracy."""
        try:
            pil_image = Image.open(io.BytesIO(image_bytes))
            
            prompt = """You are an expert receipt parser. Analyse this receipt image and return a JSON object with these fields:
{
  "amount": <total amount as float, e.g. 1250.50>,
  "original_currency": "<one of: INR, USD, EUR, GBP>",
  "date": "<date in YYYY-MM-DD format, e.g. 2024-03-15>",
  "merchant": "<store/restaurant/vendor name>",
  "category": "<one of: Food & Dining, Groceries & Household, Transportation, Shopping & Clothes, Bills & Utilities, Mobile & Internet, Healthcare, Entertainment, Travel & Vacation, Education & Courses, Home & Family, Personal Care, Gifts & Festivals, EMI & Loans, Investments & SIP, Other>",
  "description": "<brief 1-line description, e.g. 'Dinner at Pizza Hut'>",
  "items": [{"name": "<item>", "amount": <float>, "quantity": <int>}],
  "raw_text": "<full text extracted from receipt>"
}

Rules:
- Return ONLY the JSON, no markdown, no extra text.
- If a field cannot be determined, use null.
- For amount, extract the TOTAL/GRAND TOTAL.
- For category, choose the single best matching category.
- For date, convert any format to YYYY-MM-DD."""

            response = await asyncio.to_thread(gemini_model.generate_content, [prompt, pil_image])
            text = getattr(response, "text", "") or ""
            
            # Strip any markdown code fence if present
            text = text.strip()
            if text.startswith("```"):
                text = re.sub(r"```[a-z]*\n?", "", text).strip().rstrip("```").strip()
            
            parsed = json.loads(text)
            
            amount = parsed.get("amount")
            if amount is not None:
                amount = float(amount)
            
            return {
                "success": True,
                "amount": amount,
                "date": parsed.get("date") or datetime.now().strftime("%Y-%m-%d"),
                "merchant": parsed.get("merchant"),
                "category": parsed.get("category", "Other"),
                "category_confidence": "high",
                "category_reason": "Parsed by Gemini 1.5 Vision",
                "description": parsed.get("description") or f"Purchase at {parsed.get('merchant', 'Unknown')}",
                "items": parsed.get("items") or [],
                "raw_text": parsed.get("raw_text") or "",
                "needs_confirmation": False
            }
        except json.JSONDecodeError as e:
            logging.error(f"Gemini Vision returned non-JSON: {e}")
            return {"success": False, "error": "Gemini could not parse receipt as JSON", "error_type": "parsing"}
        except Exception as e:
            logging.error(f"Gemini Vision error: {e}")
            return {"success": False, "error": str(e), "error_type": "gemini_vision"}

    # ─────────────────────── TESSERACT PIPELINE ───────────────────────

    def validate_image(self, image_bytes):
        """Validate image before processing"""
        if not image_bytes:
            raise ValueError("Empty image data")
        if len(image_bytes) > 10 * 1024 * 1024:
            raise ValueError("Image file too large (max 10MB)")
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                format = img.format.lower() if img.format else None
                if format not in ['jpeg', 'jpg', 'png', 'bmp', 'tiff']:
                    raise ValueError(f"Unsupported image format: {format}")
        except Exception as e:
            raise ValueError(f"Invalid image file: {str(e)}")

    def preprocess_image(self, image_bytes):
        self.validate_image(image_bytes)
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError("Unable to decode image bytes")
            
            h, w = img.shape[:2]
            if h < 100 or w < 100:
                raise ValueError("Image too small (minimum 100x100 pixels)")
            
            max_dimension = max(h, w)
            if max_dimension < 1000:
                scale = 1200 / max_dimension
                img = cv2.resize(img, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_LINEAR)
            elif max_dimension > 4000:
                scale = 4000 / max_dimension
                img = cv2.resize(img, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_AREA)

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            mean = cv2.mean(gray)[0]
            std = cv2.meanStdDev(gray)[1][0][0]
            if std < 30:
                gray = cv2.equalizeHist(gray)
            gray = cv2.bilateralFilter(gray, 9, 75, 75)
            block_size = max(3, int(min(h,w) * 0.02) | 1)
            gray = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY, block_size, 15
            )
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2,2))
            gray = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel, iterations=1)
            return gray
        except Exception as e:
            raise ValueError(f"Image preprocessing failed: {str(e)}")

    def extract_text(self, preprocessed_image) -> str:
        try:
            psm_modes = [6, 3, 4]
            best_text = ""
            max_confidence = 0
            for psm in psm_modes:
                config = f'--psm {psm} --oem 3'
                data = pytesseract.image_to_data(preprocessed_image, config=config, output_type=pytesseract.Output.DICT)
                confidences = [float(x) for x in data['conf'] if x != '-1']
                if confidences:
                    avg_confidence = sum(confidences) / len(confidences)
                    if avg_confidence > max_confidence:
                        text = pytesseract.image_to_string(preprocessed_image, config=config)
                        text = '\n'.join([line.strip() for line in text.splitlines() if line.strip()])
                        if text:
                            best_text = text
                            max_confidence = avg_confidence
            if not best_text:
                raise Exception("No readable text found in image")
            return best_text
        except Exception as e:
            raise Exception(f"Text extraction failed: {str(e)}")

    def extract_amount(self, text: str) -> Optional[float]:
        # 1. Try to find the max of all amounts explicitly marked with a currency symbol
        amounts_with_currency = re.findall(r'(?:[₹$€£]|Rs\.?|INR)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)', text, re.IGNORECASE)
        numeric_curr = []
        for a in amounts_with_currency:
            try:
                numeric_curr.append(float(a.replace(',', '')))
            except:
                continue
        if numeric_curr:
            return max(numeric_curr)

        # 2. Try to find "total" on the SAME line as a number
        total_patterns_same_line = [
            r'\b(?:grand total|grandtotal|net amount|amount payable|amount to pay|total amount|total charges|total amount due|bill total)\b[^\n\d]*?(\d+(?:,\d{3})*(?:\.\d{2})?)',
            r'\b(?:total)\b[^\n\d]*?(\d+(?:,\d{3})*(?:\.\d{2})?)'
        ]
        for pat in total_patterns_same_line:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                try:
                    return float(m.group(1).replace(',', ''))
                except:
                    continue

        # 3. Try finding "total" across newlines (fallback)
        total_patterns_any = [
            r'\b(?:grand total|total amount due)\b[^\d]*?(\d+(?:,\d{3})*(?:\.\d{2})?)'
        ]
        for pat in total_patterns_any:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                try:
                    return float(m.group(1).replace(',', ''))
                except:
                    continue

        # 4. Fallback to max of any decimal numbers
        amounts = re.findall(r'\b(\d+(?:,\d{3})*\.\d{2})\b', text)
        numeric = []
        for a in amounts:
            try:
                numeric.append(float(a.replace(',', '')))
            except:
                continue
        if numeric:
            return max(numeric)
            
        return None

    def extract_currency(self, text: str) -> str:
        if re.search(r'\$', text) or re.search(r'\b(?:USD|dollars?)\b', text, re.IGNORECASE):
            return "USD"
        elif re.search(r'€', text) or re.search(r'\b(?:EUR|euros?)\b', text, re.IGNORECASE):
            return "EUR"
        elif re.search(r'£', text) or re.search(r'\b(?:GBP|pounds?)\b', text, re.IGNORECASE):
            return "GBP"
        return "INR"

    def extract_date(self, text: str) -> Optional[str]:
        date_patterns = [
            r'(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})',
            r'(\d{1,2})\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]*(\d{2,4})',
            r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})'
        ]
        for pattern in date_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    if len(match.groups()) == 3:
                        if len(match.group(3)) == 4:
                            date = datetime.strptime(f"{match.group(1)}/{match.group(2)}/{match.group(3)}", "%d/%m/%Y")
                        else:
                            try:
                                date = datetime.strptime(f"{match.group(1)}-{match.group(2)}-{match.group(3)}", "%Y-%m-%d")
                            except:
                                date = datetime.strptime(f"{match.group(1)}/{match.group(2)}/{match.group(3)}", "%d/%m/%y")
                        return date.strftime("%Y-%m-%d")
                except ValueError:
                    continue
        return None

    def extract_merchant(self, text: str) -> Optional[str]:
        lines = text.split('\n')
        for line in lines[:5]:
            if line.strip() and not any(word in line.lower() for word in ['bill', 'invoice', 'receipt', 'date', 'time', 'gst', 'tax']):
                if re.search(r'[A-Za-z]', line):
                    return line.strip()
        return None

    def categorize_expense(self, text: str, merchant: str) -> dict:
        text_lower = text.lower()
        merchant_lower = (merchant or "").lower()
        
        categories_keywords = [
            ("Accommodation", ['hotel', 'resort', 'lodge', 'guest house', 'homestay', 'stay', 'room rent', 'check-in', 'night', 'accommodation', 'inn', 'motel', 'suite', 'airbnb']),
            ("Bills & Utilities", ['electricity', 'power', 'bses', 'tata power', 'adani power', 'kwh', 'meter reading', 'water bill', 'gas bill']),
            ("Food & Dining", ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'biryani', 'meal', 'dining', 'kitchen', 'food', 'swiggy', 'zomato', 'lunch', 'dinner', 'breakfast', 'bakery', 'dhaba']),
            ("Transportation", ['cab', 'taxi', 'auto', 'bus', 'train', 'metro', 'flight', 'uber', 'ola', 'petrol', 'diesel', 'fuel', 'parking', 'toll']),
            ("Shopping & Clothes", ['fashion', 'clothing', 'shirt', 'dress', 'shoes', 'bag', 'myntra', 'flipkart', 'amazon', 'mall', 'shop', 'retail', 'apparel']),
            ("Healthcare", ['medical', 'hospital', 'pharmacy', 'medicine', 'doctor', 'clinic', 'health', 'apollo', 'fortis', 'chemist', 'prescription', 'dental']),
            ("Groceries & Household", ['grocery', 'supermarket', 'mart', 'vegetables', 'fruits', 'milk', 'bread', 'big bazaar', 'dmart', 'reliance fresh', 'household', 'cleaning', 'detergent']),
            ("Mobile & Internet", ['mobile', 'internet', 'wifi', 'broadband', 'airtel', 'jio', 'vodafone', 'bsnl', 'recharge', 'telecom']),
            ("Entertainment", ['movie', 'cinema', 'theatre', 'pvr', 'inox', 'netflix', 'spotify', 'gaming', 'concert']),
            ("Travel & Vacation", ['vacation', 'holiday', 'tour', 'package', 'sightseeing', 'visa', 'makemytrip', 'cleartrip']),
            ("Education & Courses", ['education', 'course', 'school', 'college', 'university', 'tuition', 'coaching', 'byju', 'coursera', 'udemy']),
            ("Personal Care", ['salon', 'spa', 'beauty', 'haircut', 'massage', 'gym', 'yoga', 'grooming', 'barber', 'parlour']),
            ("Gifts & Festivals", ['gift', 'festival', 'birthday', 'anniversary', 'wedding', 'diwali', 'christmas', 'celebration']),
            ("EMI & Loans", ['emi', 'loan', 'interest', 'installment', 'credit', 'mortgage', 'hdfc', 'icici', 'sbi']),
            ("Investments & SIP", ['investment', 'sip', 'mutual fund', 'stock', 'share', 'trading', 'zerodha', 'groww', 'upstox']),
        ]
        
        for category, keywords in categories_keywords:
            for kw in keywords:
                if kw in text_lower or kw in merchant_lower:
                    return {"category": category, "confidence": "high", "reason": f"Matched keyword '{kw}'"}
        
        return {"category": "Other", "confidence": "low", "reason": "No matching keywords found"}

    def extract_line_items(self, text: str) -> List[Dict]:
        items = []
        lines = text.split('\n')
        for i, line in enumerate(lines):
            if re.search(r'(total|subtotal|gst|tax|discount|amount payable|grand total|net amount|amount due)', line, re.IGNORECASE):
                continue
            if i > 0 and re.search(r'(total|subtotal|gst|tax|discount|amount payable|grand total|net amount|amount due)', lines[i-1], re.IGNORECASE):
                continue
            m = re.search(r'([\d,]+(?:\.\d{2}))\s*$', line)
            if not m:
                m = re.search(r'[₹$€£]\s*([\d,]+(?:\.\d{2}))', line)
            if m:
                try:
                    amount = float(m.group(1).replace(',', ''))
                except:
                    continue
                name_part = line[:m.start()].strip()
                if not name_part and i > 0:
                    prev_line = lines[i-1].strip()
                    if not re.search(r'(total|subtotal|gst|tax|discount|amount payable|grand total|net amount|amount due)', prev_line, re.IGNORECASE):
                        name_part = prev_line
                qty = 1
                qmatch = re.search(r'(?:(\d+)\s*[xX]|[xX]\s*(\d+))', name_part)
                if qmatch:
                    q = qmatch.group(1) or qmatch.group(2)
                    try:
                        qty = int(q)
                    except:
                        qty = 1
                    name_part = re.sub(r'(?:(\d+)\s*[xX]|[xX]\s*(\d+))', '', name_part).strip()
                if name_part:
                    items.append({'name': name_part, 'amount': amount, 'quantity': qty})
        return items

    def generate_description(self, merchant: str, items: List[Dict], category: str) -> str:
        if merchant and items:
            if len(items) == 1:
                return f"{items[0]['name']} from {merchant}"
            elif len(items) <= 3:
                return f"{', '.join(i['name'] for i in items)} from {merchant}"
            else:
                return f"Multiple items from {merchant}"
        elif merchant:
            return f"Purchase from {merchant}"
        elif items:
            return items[0]['name'] if len(items) == 1 else f"Multiple items - {category.lower()}"
        else:
            return f"Expense - {category.lower()}"

    async def process_with_nvidia_ocr(self, image_bytes: bytes, gemini_model=None) -> dict:
        """Use NVIDIA NeMo Retriever OCR v1 to extract text, and optionally parse it with Gemini."""
        import base64
        import httpx
        import os
        
        nvidia_api_key = (os.environ.get("NVIDIA_OCR_API_KEY") or os.environ.get("NVIDIA_API_KEY") or "").strip()
        if not nvidia_api_key:
            return {"success": False, "error": "NVIDIA API Key not configured. Set NVIDIA_OCR_API_KEY or NVIDIA_API_KEY.", "error_type": "configuration"}
            
        nim_url = os.environ.get("NVIDIA_NIM_URL", "https://integrate.api.nvidia.com/v1/cv/nvidia/nemoretriever-ocr-v1").strip()
        
        img_b64 = base64.b64encode(image_bytes).decode("utf-8")
        
        mime_type = "image/jpeg"
        if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            mime_type = "image/png"
            
        payload = {
            "input": [
                {
                    "type": "image_url",
                    "url": f"data:{mime_type};base64,{img_b64}"
                }
            ]
        }
        
        headers = {
            "Authorization": f"Bearer {nvidia_api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            logging.info(f"Sending request to NVIDIA NeMo Retriever OCR at: {nim_url}")
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(nim_url, json=payload, headers=headers)
                
            if response.status_code != 200:
                logging.error(f"NVIDIA NeMo Retriever OCR API failed with status {response.status_code}: {response.text}")
                return {
                    "success": False,
                    "error": f"NVIDIA API error: {response.status_code}",
                    "error_type": "nvidia_ocr_api"
                }
                
            res_data = response.json()
            text_list = []
            
            # Explicitly parse the standard NeMo Retriever OCR cloud API response schema
            if isinstance(res_data, dict) and "data" in res_data:
                data_list = res_data["data"]
                if isinstance(data_list, list):
                    for doc in data_list:
                        if isinstance(doc, dict) and "text_detections" in doc:
                            detections = doc["text_detections"]
                            if isinstance(detections, list):
                                for det in detections:
                                    if isinstance(det, dict) and "text" in det:
                                        text_list.append(det["text"])
            
            # Fallbacks for alternative formats / local container NIMs
            if not text_list:
                if isinstance(res_data, dict):
                    text_list = res_data.get("text") or []
                    if not text_list and "output" in res_data:
                        output_data = res_data["output"]
                        if isinstance(output_data, list) and len(output_data) > 0:
                            if isinstance(output_data[0], dict):
                                text_list = output_data[0].get("text") or []
                            elif isinstance(output_data[0], str):
                                text_list = output_data
                        elif isinstance(output_data, dict):
                            text_list = output_data.get("text") or []
                elif isinstance(res_data, list):
                    if len(res_data) > 0 and isinstance(res_data[0], dict):
                        text_list = res_data[0].get("text") or []
                        
            if not text_list:
                logging.warning(f"NVIDIA OCR returned no text. Full response: {res_data}")
                def extract_strings_from_json(data):
                    strings = []
                    if isinstance(data, str):
                        strings.append(data)
                    elif isinstance(data, list):
                        for item in data:
                            strings.extend(extract_strings_from_json(item))
                    elif isinstance(data, dict):
                        for k, v in data.items():
                            if k == "text" and isinstance(v, str):
                                strings.append(v)
                            else:
                                strings.extend(extract_strings_from_json(v))
                    return strings
                text_list = extract_strings_from_json(res_data)

                
            if not text_list:
                return {
                    "success": False,
                    "error": "No text detected in the receipt by NVIDIA OCR.",
                    "error_type": "empty_ocr"
                }
                
            raw_text = "\n".join(text_list)
            logging.info(f"NVIDIA NeMo Retriever OCR extracted {len(raw_text)} chars of text.")
            
            if gemini_model is not None:
                logging.info("Parsing NVIDIA OCR text using Gemini...")
                try:
                    prompt = f"""You are an expert receipt parser. Analyze this raw text extracted from a receipt and return a JSON object with these fields:
{{
  "amount": <total amount as float, e.g. 1250.50>,
  "date": "<date in YYYY-MM-DD format, e.g. 2024-03-15>",
  "merchant": "<store/restaurant/vendor name>",
  "category": "<one of: Food & Dining, Groceries & Household, Transportation, Shopping & Clothes, Bills & Utilities, Mobile & Internet, Healthcare, Entertainment, Travel & Vacation, Education & Courses, Home & Family, Personal Care, Gifts & Festivals, EMI & Loans, Investments & SIP, Other>",
  "description": "<brief 1-line description, e.g. 'Dinner at Pizza Hut'>",
  "items": [{{"name": "<item>", "amount": <float>, "quantity": <int>}}],
  "raw_text": "<full text extracted from receipt>"
}}

Rules:
- Return ONLY the JSON, no markdown, no extra text.
- If a field cannot be determined, use null.
- For amount, extract the TOTAL/GRAND TOTAL.
- For category, choose the single best matching category.
- For date, convert any format to YYYY-MM-DD.

Raw receipt text:
{raw_text}
"""
                    response = await asyncio.to_thread(gemini_model.generate_content, prompt)
                    text_resp = getattr(response, "text", "") or ""
                    text_resp = text_resp.strip()
                    if text_resp.startswith("```"):
                        text_resp = re.sub(r"```[a-z]*\n?", "", text_resp).strip().rstrip("```").strip()
                        
                    parsed = json.loads(text_resp)
                    
                    amount = parsed.get("amount")
                    if amount is not None:
                        amount = float(amount)
                        
                    return {
                        "success": True,
                        "amount": amount,
                        "original_currency": parsed.get("original_currency", "INR"),
                        "date": parsed.get("date") or datetime.now().strftime("%Y-%m-%d"),
                        "merchant": parsed.get("merchant"),
                        "category": parsed.get("category", "Other"),
                        "category_confidence": "high",
                        "category_reason": "Parsed by Gemini via NVIDIA OCR text",
                        "description": parsed.get("description") or f"Purchase at {parsed.get('merchant', 'Unknown')}",
                        "items": parsed.get("items") or [],
                        "raw_text": raw_text,
                        "needs_confirmation": False
                    }
                except Exception as e:
                    logging.error(f"Gemini parsing of NVIDIA OCR text failed: {e}")
            
            logging.info("Using local regex parsers to process NVIDIA OCR text...")
            amount = self.extract_amount(raw_text)
            currency = self.extract_currency(raw_text)
            date = self.extract_date(raw_text)
            merchant = self.extract_merchant(raw_text)
            items = self.extract_line_items(raw_text)
            category_result = self.categorize_expense(raw_text, merchant or "")
            category = category_result["category"]
            description = self.generate_description(merchant or "", items, category)
            
            if not amount:
                return {
                    "success": False,
                    "error": "Could not find a valid amount in NeMo OCR text. Ensure the receipt is clear.",
                    "error_type": "validation",
                    "raw_text": raw_text[:500]
                }
                
            return {
                "success": True,
                "amount": amount,
                "original_currency": currency,
                "date": date or datetime.now().strftime("%Y-%m-%d"),
                "merchant": merchant,
                "category": category,
                "category_confidence": category_result["confidence"],
                "category_reason": category_result["reason"] + " (via NVIDIA NeMo OCR)",
                "description": description,
                "items": items,
                "raw_text": raw_text,
                "needs_confirmation": category_result["confidence"] == "low"
            }
            
        except Exception as e:
            logging.error(f"NVIDIA NeMo OCR processing error: {e}")
            return {
                "success": False,
                "error": f"NVIDIA OCR failed: {str(e)}",
                "error_type": "nvidia_ocr_failed"
            }

    async def process_receipt(self, image_bytes, gemini_model=None) -> dict:
        """
        Process a receipt image. Uses NVIDIA NeMo Retriever OCR if available,
        otherwise falls back to Gemini Vision (primary) and Tesseract OCR (secondary).
        """
        import os
        
        errors = []
        
        # ── Primary: NVIDIA NeMo Retriever OCR ──
        if os.environ.get("NVIDIA_OCR_API_KEY") or os.environ.get("NVIDIA_API_KEY"):
            logging.info("NVIDIA OCR API key found. Utilizing NVIDIA NeMo Retriever OCR v1 for receipt processing.")
            result = await self.process_with_nvidia_ocr(image_bytes, gemini_model=gemini_model)
            if result.get("success"):
                logging.info(f"NVIDIA OCR success: amount={result.get('amount')}, merchant={result.get('merchant')}")
                return result
            else:
                logging.warning(f"NVIDIA OCR failed: {result.get('error')} — falling back to Gemini/Tesseract")
                errors.append(f"NVIDIA: {result.get('error')}")

        # ── Secondary: Gemini Vision ──
        if gemini_model is not None:
            logging.info("Using Gemini Vision for receipt processing")
            result = await self.process_with_gemini_vision(image_bytes, gemini_model)
            if result.get("success"):
                logging.info(f"Gemini Vision success: amount={result.get('amount')}, merchant={result.get('merchant')}")
                return result
            else:
                logging.warning(f"Gemini Vision failed: {result.get('error')} — falling back to Tesseract")
                errors.append(f"Gemini: {result.get('error')}")

        # ── Fallback: Tesseract ──
        if not self._tesseract_available:
            if errors:
                return {
                    "success": False,
                    "error": "OCR failed: " + " | ".join(errors),
                    "error_type": "processing_failed"
                }
            return {
                "success": False,
                "error": "No OCR engine available. Configure NVIDIA_API_KEY, GEMINI_API_KEY or install Tesseract.",
                "error_type": "configuration"
            }

        try:
            logging.info("Using Tesseract OCR for receipt processing")
            processed_image = self.preprocess_image(image_bytes)
            text = self.extract_text(processed_image)
            if not text:
                raise ValueError("No text extracted from image")

            amount = self.extract_amount(text)
            date = self.extract_date(text)
            merchant = self.extract_merchant(text)
            items = self.extract_line_items(text)
            category_result = self.categorize_expense(text, merchant or "")
            category = category_result["category"]
            description = self.generate_description(merchant or "", items, category)

            if not amount:
                return {
                    "success": False,
                    "error": "Could not find a valid amount. Ensure the receipt image is clear.",
                    "error_type": "validation",
                    "raw_text": text[:500]
                }

            return {
                "amount": amount,
                "date": date or datetime.now().strftime("%Y-%m-%d"),
                "merchant": merchant,
                "category": category,
                "category_confidence": category_result["confidence"],
                "category_reason": category_result["reason"],
                "description": description,
                "items": items,
                "raw_text": text,
                "needs_confirmation": category_result["confidence"] == "low",
                "success": True
            }
        except ValueError as e:
            logging.error(f"Receipt validation error: {str(e)}")
            return {"success": False, "error": str(e), "error_type": "validation"}
        except Exception as e:
            logging.error(f"Receipt processing error: {str(e)}")
            return {"success": False, "error": "Failed to process receipt.", "error_type": "processing"}


