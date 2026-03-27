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
        total_patterns = [
            r'(?:grand total|grandtotal|net amount|amount payable|amount to pay|total amount|bill total)[:\s]*₹?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
            r'(?:total)[:\s]*₹?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)'
        ]
        for pat in total_patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                try:
                    return float(m.group(1).replace(',', ''))
                except:
                    continue
        amounts = re.findall(r'₹?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', text)
        numeric = []
        for a in amounts:
            try:
                numeric.append(float(a.replace(',', '')))
            except:
                continue
        if numeric:
            return max(numeric)
        return None

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
        for line in lines:
            if re.search(r'(total|subtotal|gst|tax|discount|amount payable|grand total|net amount)', line, re.IGNORECASE):
                continue
            m = re.search(r'([\d,]+(?:\.\d{2}))\s*$', line)
            if not m:
                m = re.search(r'₹\s*([\d,]+(?:\.\d{2}))', line)
            if m:
                try:
                    amount = float(m.group(1).replace(',', ''))
                except:
                    continue
                name_part = line[:m.start()].strip()
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

    async def process_receipt(self, image_bytes, gemini_model=None) -> dict:
        """
        Process a receipt image. Uses Gemini Vision if available (primary),
        falls back to Tesseract OCR pipeline.
        """
        # ── Primary: Gemini Vision ──
        if gemini_model is not None:
            logging.info("Using Gemini Vision for receipt processing")
            result = await self.process_with_gemini_vision(image_bytes, gemini_model)
            if result.get("success"):
                logging.info(f"Gemini Vision success: amount={result.get('amount')}, merchant={result.get('merchant')}")
                return result
            else:
                logging.warning(f"Gemini Vision failed: {result.get('error')} — falling back to Tesseract")

        # ── Fallback: Tesseract ──
        if not self._tesseract_available:
            return {
                "success": False,
                "error": "No OCR engine available. Configure GEMINI_API_KEY or install Tesseract.",
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


