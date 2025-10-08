import cv2
import numpy as np
import pytesseract
from PIL import Image
import re
from datetime import datetime
import io
from typing import List, Dict, Optional
import shutil
import logging

class ReceiptProcessor:
    def __init__(self):
        # Test if OpenCV is available
        try:
            # Test with a dummy path to verify OpenCV is working
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.jpg') as tmp:
                cv2.imread(tmp.name)
        except Exception as e:
            raise ImportError(f"OpenCV (cv2) is not properly installed: {str(e)}")
        
        # Try to locate tesseract executable
        tesseract_paths = [
            shutil.which('tesseract'),
            '/opt/homebrew/bin/tesseract',
            '/usr/local/bin/tesseract',
            '/usr/bin/tesseract'
        ]
        
        tesseract_path = None
        for path in tesseract_paths:
            if path and shutil.which(path):
                tesseract_path = path
                break
        
        if not tesseract_path:
            raise ImportError(
                "Tesseract OCR is not installed. Please install it using:\n"
                "macOS: brew install tesseract\n"
                "Linux: sudo apt-get install tesseract-ocr\n"
                "Windows: Download installer from https://github.com/UB-Mannheim/tesseract/wiki"
            )
        
        try:
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
            version = pytesseract.get_tesseract_version()
            if not version:
                raise Exception("Could not verify Tesseract version")
        except Exception as e:
            raise ImportError(f"Failed to initialize Tesseract OCR: {str(e)}")

    def validate_image(self, image_bytes):
        """Validate image before processing"""
        if not image_bytes:
            raise ValueError("Empty image data")
            
        # Check file size (max 10MB)
        if len(image_bytes) > 10 * 1024 * 1024:
            raise ValueError("Image file too large (max 10MB)")
            
        # Try to open with PIL first to verify it's a valid image
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                format = img.format.lower() if img.format else None
                if format not in ['jpeg', 'jpg', 'png', 'bmp', 'tiff']:
                    raise ValueError(f"Unsupported image format: {format}")
        except Exception as e:
            raise ValueError(f"Invalid image file: {str(e)}")

    def preprocess_image(self, image_bytes):
        # Validate image first
        self.validate_image(image_bytes)
        
        try:
            # Convert bytes to numpy array
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError("Unable to decode image bytes")
            
            # Check minimum dimensions
            h, w = img.shape[:2]
            if h < 100 or w < 100:
                raise ValueError("Image too small (minimum 100x100 pixels)")
            
            # Resize for better OCR if needed
            max_dimension = max(h, w)
            if max_dimension < 1000:
                scale = 1200 / max_dimension
                img = cv2.resize(img, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_LINEAR)
            elif max_dimension > 4000:
                scale = 4000 / max_dimension
                img = cv2.resize(img, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_AREA)

            # Convert to grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            # Check contrast and enhance if needed
            mean = cv2.mean(gray)[0]
            std = cv2.meanStdDev(gray)[1][0][0]
            if std < 30:  # Low contrast
                gray = cv2.equalizeHist(gray)

            # Denoise while preserving edges
            gray = cv2.bilateralFilter(gray, 9, 75, 75)

            # Adaptive threshold with optimal parameters
            block_size = max(3, int(min(h,w) * 0.02) | 1)  # Must be odd
            gray = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY, block_size, 15
            )

            # Morphological operations to clean up
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2,2))
            gray = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel, iterations=1)
            
            return gray
            
        except Exception as e:
            raise ValueError(f"Image preprocessing failed: {str(e)}")

    def extract_text(self, preprocessed_image) -> str:
        try:
            # Try different PSM modes for better results
            psm_modes = [6, 3, 4]  # 6: Block of text, 3: Fully automatic, 4: Single column
            
            best_text = ""
            max_confidence = 0
            
            for psm in psm_modes:
                config = f'--psm {psm} --oem 3'
                
                # Get text and confidence data
                data = pytesseract.image_to_data(preprocessed_image, config=config, output_type=pytesseract.Output.DICT)
                
                # Calculate average confidence for this mode
                confidences = [float(x) for x in data['conf'] if x != '-1']
                if confidences:
                    avg_confidence = sum(confidences) / len(confidences)
                    if avg_confidence > max_confidence:
                        text = pytesseract.image_to_string(preprocessed_image, config=config)
                        text = '\n'.join([line.strip() for line in text.splitlines() if line.strip()])
                        if text:  # Only update if we got some text
                            best_text = text
                            max_confidence = avg_confidence
            
            if not best_text:
                raise Exception("No readable text found in image")
                
            return best_text
            
        except Exception as e:
            raise Exception(f"Text extraction failed: {str(e)}")

    def extract_amount(self, text: str) -> Optional[float]:
        # Prefer explicit total lines first
        total_patterns = [
            r'(?:grand total|grandtotal|net amount|amount payable|amount to pay|total amount|bill total|grand total)[:\s]*₹?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
            r'(?:total)[:\s]*₹?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)'
        ]
        for pat in total_patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                try:
                    return float(m.group(1).replace(',', ''))
                except:
                    continue

        # Fallback: find all currency-like numbers and return the largest (common heuristic)
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
        # Common Indian date formats
        date_patterns = [
            r'(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})',  # DD-MM-YYYY or DD/MM/YYYY
            r'(\d{1,2})\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]*(\d{2,4})',  # DD Mon YYYY
            r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})'  # YYYY-MM-DD
        ]
        for pattern in date_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    if len(match.groups()) == 3:
                        if len(match.group(3)) == 4:  # DD-MM-YYYY
                            date = datetime.strptime(f"{match.group(1)}/{match.group(2)}/{match.group(3)}", "%d/%m/%Y")
                        else:  # YYYY-MM-DD or other
                            # Try both orders
                            try:
                                date = datetime.strptime(f"{match.group(1)}-{match.group(2)}-{match.group(3)}", "%Y-%m-%d")
                            except:
                                date = datetime.strptime(f"{match.group(1)}/{match.group(2)}/{match.group(3)}", "%d/%m/%y")
                        return date.strftime("%Y-%m-%d")
                except ValueError:
                    continue
        return None

    def extract_merchant(self, text: str) -> Optional[str]:
        # Look for merchant name at the start of receipt
        lines = text.split('\n')
        for line in lines[:5]:  # Usually in first few lines
            if line.strip() and not any(word in line.lower() for word in ['bill', 'invoice', 'receipt', 'date', 'time', 'gst', 'tax']):
                # Prefer lines with letters and words (avoid numeric-only lines)
                if re.search(r'[A-Za-z]', line):
                    return line.strip()
        return None

    def categorize_expense(self, text: str, merchant: str) -> dict:
        """Categorize expense based on text content and merchant name
        Returns dict with category and confidence level"""
        text_lower = text.lower()
        merchant_lower = (merchant or "").lower()
        
        # Debug logging
        logging.info(f"=== CATEGORIZATION DEBUG ===")
        logging.info(f"Text sample: {text_lower[:200]}...")
        logging.info(f"Merchant: {merchant_lower}")
        
        # PRIORITY 1: Accommodation (must be checked before Bills & Utilities)
        accommodation_keywords = [
            'hotel', 'resort', 'lodge', 'guest house', 'homestay', 'stay', 'room rent', 'booking hotel', 
            'check-in', 'night', 'accommodation', 'inn', 'motel', 'suite', 'reservation',
            'hospitality', 'rooms', 'nights', 'check in', 'check out', 'hotel bill',
            'room service', 'room charge', 'room rate', 'lodging', 'airbnb'
        ]
        
        for keyword in accommodation_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                logging.info(f"Found accommodation keyword: '{keyword}'")
                return {
                    "category": "Accommodation",
                    "confidence": "high",
                    "reason": f"Found accommodation keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 2: Electricity Bills (following memory specification)
        electricity_keywords = [
            'electricity bill', 'power bill', 'electric bill', 'energy bill',
            'electricity', 'power', 'electric', 'energy charge', 'power supply',
            'bses', 'tata power', 'adani power', 'reliance energy', 'torrent power', 
            'electricity board', 'power board', 'discom', 'electric company', 
            'power distribution', 'electrical services', 'power utilities', 
            'energy services', 'kwh', 'unit consumption', 'meter reading',
            'transmission charge', 'distribution charge', 'grid', 'transformer'
        ]
        
        for keyword in electricity_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                logging.info(f"Found electricity keyword: '{keyword}' - categorizing as Bills & Utilities")
                return {
                    "category": "Bills & Utilities",
                    "confidence": "high",
                    "reason": f"Found electricity keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 3: Food & Dining (must come before accommodation to avoid 'restaurant' confusion)
        food_keywords = [
            'restaurant', 'cafe', 'coffee', 'tea', 'pizza', 'burger', 'biryani', 'meal', 
            'dining', 'eat', 'kitchen', 'food', 'swiggy', 'zomato', 'dominos', 'mcdonalds', 
            'kfc', 'subway', 'starbucks', 'lunch', 'dinner', 'breakfast', 'snack',
            'bakery', 'diner', 'bistro', 'eatery', 'canteen', 'dhaba', 'tiffin', 'sweet',
            'juice', 'lassi', 'chai', 'beverage', 'ice cream', 'dessert'
        ]
        
        for keyword in food_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                return {
                    "category": "Food & Dining",
                    "confidence": "high",
                    "reason": f"Found food keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 4: Transportation
        transport_keywords = [
            'cab', 'taxi', 'auto', 'bus', 'train', 'metro', 'flight', 'airline', 'air ticket', 
            'uber', 'ola', 'journey', 'railway', 'airport', 'petrol', 'diesel', 
            'fuel', 'parking', 'toll', 'transport', 'ride', 'trip', 'indigo', 'spicejet',
            'air india', 'railways', 'irctc', 'station', 'platform'
        ]
        
        for keyword in transport_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                return {
                    "category": "Transportation",
                    "confidence": "high",
                    "reason": f"Found transport keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 5: Shopping & Clothes
        shopping_keywords = [
            'fashion', 'clothing', 'shirt', 'dress', 'shoes', 'bag', 'accessories', 
            'myntra', 'flipkart', 'amazon', 'reliance trends', 'lifestyle', 'westside',
            'mall', 'shop', 'store', 'retail', 'apparel', 'garment', 'jewelry', 'watch',
            'sunglasses', 'belt', 'wallet', 'footwear', 'handbag'
        ]
        
        for keyword in shopping_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                return {
                    "category": "Shopping & Clothes",
                    "confidence": "high",
                    "reason": f"Found shopping keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 6: Healthcare
        healthcare_keywords = [
            'medical', 'hospital', 'pharmacy', 'medicine', 'doctor', 'clinic', 'health', 
            'apollo', 'fortis', 'max', 'medanta', 'cipla', 'chemist', 'prescription',
            'dental', 'dentist', 'lab', 'pathology', 'diagnostic', 'scan', 'x-ray',
            'vaccination', 'injection', 'surgery', 'treatment', 'consultation', 'therapy'
        ]
        
        for keyword in healthcare_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                return {
                    "category": "Healthcare",
                    "confidence": "high",
                    "reason": f"Found healthcare keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 7: Groceries & Household
        grocery_keywords = [
            'grocery', 'supermarket', 'mart', 'vegetables', 'fruits', 'milk', 'bread', 
            'big bazaar', 'dmart', 'reliance fresh', 'spencer', 'more', 'star bazaar',
            'household', 'cleaning', 'detergent', 'soap', 'shampoo', 'toothpaste',
            'tissue', 'toilet paper', 'kitchen', 'utensils', 'provisions'
        ]
        
        for keyword in grocery_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                return {
                    "category": "Groceries & Household",
                    "confidence": "high",
                    "reason": f"Found grocery keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 8: Mobile & Internet
        mobile_keywords = [
            'mobile', 'internet', 'wifi', 'broadband', 'data', 'airtel', 'jio', 
            'vodafone', 'bsnl', 'recharge', 'telecom', 'sim', 'phone', 'prepaid',
            'postpaid', 'network', 'cellular', 'smartphone'
        ]
        
        for keyword in mobile_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                return {
                    "category": "Mobile & Internet",
                    "confidence": "high",
                    "reason": f"Found mobile/internet keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 9: Entertainment
        entertainment_keywords = [
            'movie', 'cinema', 'theatre', 'entertainment', 'games', 'sports', 
            'pvr', 'inox', 'book my show', 'netflix', 'amazon prime', 'hotstar',
            'spotify', 'youtube', 'gaming', 'concert', 'show', 'event', 'movie ticket'
        ]
        
        for keyword in entertainment_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                return {
                    "category": "Entertainment",
                    "confidence": "high",
                    "reason": f"Found entertainment keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 10: Office Expense
        office_keywords = [
            'stationery', 'office supplies', 'pen', 'paper', 'printer', 'toner', 
            'office', 'workspace', 'co-working'
        ]
        
        for keyword in office_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                return {
                    "category": "Office Expense",
                    "confidence": "high",
                    "reason": f"Found office keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 11: Other Utilities (water, gas - very specific keywords only)
        utility_keywords = [
            'water bill', 'gas bill', 'water supply bill', 'municipal water',
            'water corporation', 'gas corporation', 'municipal corporation bill',
            'water board', 'gas company', 'lpg bill', 'pipeline gas',
            'sewage bill', 'drainage bill', 'sanitation bill', 'waste management',
            'municipal tax', 'property tax bill', 'water tank cleaning'
        ]
        
        for keyword in utility_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                return {
                    "category": "Bills & Utilities",
                    "confidence": "high",
                    "reason": f"Found utility keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 12: Travel & Vacation
        travel_keywords = [
            'vacation', 'holiday', 'tour', 'package', 'itinerary', 'sightseeing',
            'visa', 'passport', 'travel agent', 'travel insurance', 'makemytrip',
            'cleartrip', 'goibibo', 'yatra', 'booking.com', 'agoda', 'expedia',
            'travel booking'
        ]
        
        for keyword in travel_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                return {
                    "category": "Travel & Vacation",
                    "confidence": "high",
                    "reason": f"Found travel keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 13: Education & Courses (must be before transportation)
        education_keywords = [
            'education', 'course', 'school', 'college', 'university', 'tuition',
            'coaching', 'training', 'workshop', 'seminar', 'certification', 'exam',
            'admission', 'byju', 'unacademy', 'vedantu', 'coursera', 'udemy',
            'educational', 'learning', 'study'
        ]
        
        for keyword in education_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                return {
                    "category": "Education & Courses",
                    "confidence": "high",
                    "reason": f"Found education keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 14: Home & Family
        home_keywords = [
            'home', 'furniture', 'appliance', 'repair', 'maintenance', 'renovation',
            'interior', 'decoration', 'painting', 'plumbing', 'electrical work',
            'carpenter', 'maid', 'cook', 'babysitter', 'family', 'child care',
            'ikea', 'pepperfry', 'urban ladder', 'godrej'
        ]
        
        for keyword in home_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                return {
                    "category": "Home & Family",
                    "confidence": "high",
                    "reason": f"Found home/family keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 15: Personal Care (must be before shopping)
        personal_care_keywords = [
            'salon', 'spa', 'beauty', 'haircut', 'massage', 'facial', 'manicure',
            'pedicure', 'cosmetics', 'makeup', 'skincare', 'grooming', 'barber',
            'parlour', 'wellness', 'fitness', 'gym', 'yoga', 'beauty salon',
            'hair salon', 'nail salon'
        ]
        
        for keyword in personal_care_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                return {
                    "category": "Personal Care",
                    "confidence": "high",
                    "reason": f"Found personal care keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 16: Gifts & Festivals (must be before shopping)
        gifts_keywords = [
            'gift', 'festival', 'celebration', 'birthday', 'anniversary', 'wedding',
            'diwali', 'christmas', 'eid', 'holi', 'rakhi', 'valentine', 'party',
            'decoration', 'flowers', 'greeting card', 'present', 'occasion',
            'gift shop', 'flower shop', 'birthday gift', 'anniversary gift'
        ]
        
        for keyword in gifts_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                return {
                    "category": "Gifts & Festivals",
                    "confidence": "high",
                    "reason": f"Found gifts/festival keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 17: EMI & Loans
        emi_keywords = [
            'emi', 'loan', 'interest', 'installment', 'credit', 'debt', 'repayment',
            'mortgage', 'finance', 'bank', 'hdfc', 'icici', 'sbi', 'axis', 'kotak',
            'bajaj finserv', 'lending', 'borrowing'
        ]
        
        for keyword in emi_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                return {
                    "category": "EMI & Loans",
                    "confidence": "high",
                    "reason": f"Found EMI/loan keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # PRIORITY 18: Investments & SIP
        investment_keywords = [
            'investment', 'sip', 'mutual fund', 'stock', 'share', 'trading',
            'portfolio', 'dividend', 'returns', 'zerodha', 'groww', 'upstox',
            'paytm money', 'kuvera', 'etmoney', 'systematic investment',
            'equity', 'bond', 'fd', 'rd', 'ppf', 'nps'
        ]
        
        for keyword in investment_keywords:
            if keyword in text_lower or keyword in merchant_lower:
                return {
                    "category": "Investments & SIP",
                    "confidence": "high",
                    "reason": f"Found investment keyword '{keyword}' in {'merchant name' if keyword in merchant_lower else 'receipt text'}"
                }
        
        # FALLBACK: If no specific keywords found, return as Other (NOT Bills & Utilities)
        logging.info(f"No specific keywords found, categorizing as Other")
        return {
            "category": "Other",
            "confidence": "low",
            "reason": "Could not determine category from available information - no matching keywords found"
        }
        
    def extract_line_items(self, text: str) -> List[Dict]:
        """Try to extract line items of the form: name ... amount
        Returns list of {name, amount, quantity}
        Uses simple heuristics and regexes common in receipts."""
        items = []
        lines = text.split('\n')
        for line in lines:
            # Skip lines that look like headers/totals
            if re.search(r'(total|subtotal|gst|tax|discount|amount payable|grand total|net amount)', line, re.IGNORECASE):
                continue

            # Look for amount at end of line
            m = re.search(r'([\d,]+(?:\.\d{2}))\s*$', line)
            if not m:
                m = re.search(r'₹\s*([\d,]+(?:\.\d{2}))', line)
            if m:
                amount_str = m.group(1).replace(',', '')
                try:
                    amount = float(amount_str)
                except:
                    continue

                name_part = line[:m.start()].strip()
                # Try to extract quantity if present like '2 x Idli' or 'Idli x2'
                qty = 1
                qmatch = re.search(r'(?:(\d+)\s*[xX]|[xX]\s*(\d+))', name_part)
                if qmatch:
                    q = qmatch.group(1) or qmatch.group(2)
                    try:
                        qty = int(q)
                    except:
                        qty = 1
                    # remove qty marker from name
                    name_part = re.sub(r'(?:(\d+)\s*[xX]|[xX]\s*(\d+))', '', name_part).strip()

                if name_part:
                    items.append({'name': name_part, 'amount': amount, 'quantity': qty})
        return items
        
    def generate_description(self, merchant: str, items: List[Dict], category: str) -> str:
        """Generate a meaningful description for the expense"""
        if merchant and items:
            if len(items) == 1:
                return f"{items[0]['name']} from {merchant}"
            elif len(items) <= 3:
                item_names = [item['name'] for item in items]
                return f"{', '.join(item_names)} from {merchant}"
            else:
                return f"Multiple items from {merchant}"
        elif merchant:
            return f"Purchase from {merchant}"
        elif items:
            if len(items) == 1:
                return items[0]['name']
            else:
                return f"Multiple items - {category.lower()}"
        else:
            return f"Expense - {category.lower()}"

    async def process_receipt(self, image_bytes) -> dict:
        """
        Process a receipt image and extract relevant information
        Returns a dictionary with extracted data and confidence scores
        """
        try:
            logging.info(f"Starting receipt processing for {len(image_bytes)} bytes")
            
            # Preprocess the image
            processed_image = self.preprocess_image(image_bytes)
            logging.info("Image preprocessing completed successfully")
            
            # Extract text
            text = self.extract_text(processed_image)
            logging.info(f"Text extraction completed, extracted {len(text)} characters")
            
            if not text:
                raise ValueError("No text could be extracted from the image")
            
            # Extract information
            amount = self.extract_amount(text)
            date = self.extract_date(text)
            merchant = self.extract_merchant(text)
            items = self.extract_line_items(text)
            
            # Categorize the expense
            category_result = self.categorize_expense(text, merchant or "")
            category = category_result["category"]
            
            # Generate description
            description = self.generate_description(merchant or "", items, category)
            
            logging.info(f"Extracted data - Amount: {amount}, Date: {date}, Merchant: {merchant}, Category: {category}, Items: {len(items)}")
            
            # Validate results
            if not amount:
                logging.warning("Could not find a valid amount in the receipt")
                return {
                    "success": False,
                    "error": "Could not find a valid amount in the receipt. Please ensure the receipt image is clear and contains readable text.",
                    "error_type": "validation",
                    "raw_text": text[:500] + "..." if len(text) > 500 else text  # Include first 500 chars for debugging
                }
            
            result = {
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
            
            logging.info(f"Receipt processing completed successfully: {result}")
            return result
            
        except ValueError as e:
            # Known validation errors
            logging.error(f"Receipt processing validation error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "error_type": "validation"
            }
        except Exception as e:
            # Unexpected errors
            logging.error(f"Receipt processing error: {str(e)}")
            return {
                "success": False,
                "error": "Failed to process receipt. Please ensure the image is clear and contains readable text.",
                "error_type": "processing"
            }
