#!/usr/bin/env python3
"""
Backend API Testing for AI Expense Tracker
Tests all backend endpoints including CRUD operations, AI categorization, receipt OCR, and analytics
"""

import requests
import json
import time
import base64
from datetime import datetime, timedelta
from pathlib import Path
import io
from PIL import Image

# Configuration
BASE_URL = "https://expenseai-11.preview.emergentagent.com/api"
TIMEOUT = 30

class ExpenseTrackerTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.session.timeout = TIMEOUT
        self.created_expense_ids = []
        
    def log(self, message, level="INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
    
    def test_api_health(self):
        """Test if API is accessible"""
        self.log("Testing API health check...")
        try:
            response = self.session.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ API Health Check: {data}")
                return True
            else:
                self.log(f"❌ API Health Check failed: {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ API Health Check failed: {str(e)}", "ERROR")
            return False
    
    def test_get_categories(self):
        """Test getting expense categories"""
        self.log("Testing GET /categories...")
        try:
            response = self.session.get(f"{self.base_url}/categories")
            if response.status_code == 200:
                data = response.json()
                categories = data.get('categories', [])
                self.log(f"✅ Categories retrieved: {len(categories)} categories")
                self.log(f"Categories: {categories}")
                return True
            else:
                self.log(f"❌ Get categories failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Get categories failed: {str(e)}", "ERROR")
            return False
    
    def test_create_expense_with_category(self):
        """Test creating expense with manual category"""
        self.log("Testing POST /expenses with manual category...")
        try:
            expense_data = {
                "amount": 45.67,
                "description": "Lunch at Italian restaurant",
                "category": "Food & Dining",
                "merchant": "Mario's Pizzeria",
                "notes": "Business lunch meeting"
            }
            
            response = self.session.post(
                f"{self.base_url}/expenses",
                json=expense_data
            )
            
            if response.status_code == 200:
                data = response.json()
                expense_id = data.get('id')
                self.created_expense_ids.append(expense_id)
                
                # Validate response structure
                required_fields = ['id', 'amount', 'description', 'category', 'date']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log(f"❌ Missing fields in response: {missing_fields}", "ERROR")
                    return False
                
                self.log(f"✅ Expense created with manual category: ID {expense_id}")
                self.log(f"   Amount: ${data['amount']}, Category: {data['category']}")
                self.log(f"   AI Categorized: {data.get('ai_categorized', False)}")
                return True
            else:
                self.log(f"❌ Create expense failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Create expense failed: {str(e)}", "ERROR")
            return False
    
    def test_create_expense_ai_categorization(self):
        """Test creating expense without category to trigger AI categorization"""
        self.log("Testing POST /expenses with AI categorization...")
        try:
            expense_data = {
                "amount": 89.99,
                "description": "Uber ride to airport",
                "merchant": "Uber Technologies"
            }
            
            response = self.session.post(
                f"{self.base_url}/expenses",
                json=expense_data
            )
            
            if response.status_code == 200:
                data = response.json()
                expense_id = data.get('id')
                self.created_expense_ids.append(expense_id)
                
                # Check AI categorization
                ai_categorized = data.get('ai_categorized', False)
                ai_confidence = data.get('ai_confidence')
                category = data.get('category')
                
                if ai_categorized and ai_confidence is not None:
                    self.log(f"✅ AI categorization successful: ID {expense_id}")
                    self.log(f"   Category: {category}, Confidence: {ai_confidence}")
                    return True
                else:
                    self.log(f"❌ AI categorization failed - ai_categorized: {ai_categorized}, confidence: {ai_confidence}", "ERROR")
                    return False
            else:
                self.log(f"❌ Create expense with AI categorization failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Create expense with AI categorization failed: {str(e)}", "ERROR")
            return False
    
    def test_get_expenses(self):
        """Test retrieving expenses"""
        self.log("Testing GET /expenses...")
        try:
            response = self.session.get(f"{self.base_url}/expenses")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log(f"✅ Expenses retrieved: {len(data)} expenses")
                    
                    # Validate structure of first expense if exists
                    if data:
                        first_expense = data[0]
                        required_fields = ['id', 'amount', 'description', 'category', 'date']
                        missing_fields = [field for field in required_fields if field not in first_expense]
                        
                        if missing_fields:
                            self.log(f"❌ Missing fields in expense: {missing_fields}", "ERROR")
                            return False
                        
                        self.log(f"   Sample expense: ${first_expense['amount']} - {first_expense['description']}")
                    
                    return True
                else:
                    self.log(f"❌ Expected list, got: {type(data)}", "ERROR")
                    return False
            else:
                self.log(f"❌ Get expenses failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Get expenses failed: {str(e)}", "ERROR")
            return False
    
    def test_update_expense(self):
        """Test updating an expense"""
        if not self.created_expense_ids:
            self.log("❌ No expenses to update", "ERROR")
            return False
        
        expense_id = self.created_expense_ids[0]
        self.log(f"Testing PUT /expenses/{expense_id}...")
        
        try:
            update_data = {
                "amount": 52.30,
                "description": "Updated lunch at Italian restaurant",
                "category": "Food & Dining",
                "merchant": "Mario's Pizzeria",
                "notes": "Updated: Business lunch with client"
            }
            
            response = self.session.put(
                f"{self.base_url}/expenses/{expense_id}",
                json=update_data
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify update
                if data['amount'] == update_data['amount'] and data['description'] == update_data['description']:
                    self.log(f"✅ Expense updated successfully: ID {expense_id}")
                    self.log(f"   New amount: ${data['amount']}, Description: {data['description']}")
                    return True
                else:
                    self.log(f"❌ Update verification failed", "ERROR")
                    return False
            else:
                self.log(f"❌ Update expense failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Update expense failed: {str(e)}", "ERROR")
            return False
    
    def test_get_single_expense(self):
        """Test getting a single expense by ID"""
        if not self.created_expense_ids:
            self.log("❌ No expenses to retrieve", "ERROR")
            return False
        
        expense_id = self.created_expense_ids[0]
        self.log(f"Testing GET /expenses/{expense_id}...")
        
        try:
            response = self.session.get(f"{self.base_url}/expenses/{expense_id}")
            
            if response.status_code == 200:
                data = response.json()
                if data['id'] == expense_id:
                    self.log(f"✅ Single expense retrieved: ID {expense_id}")
                    self.log(f"   Amount: ${data['amount']}, Category: {data['category']}")
                    return True
                else:
                    self.log(f"❌ ID mismatch: expected {expense_id}, got {data['id']}", "ERROR")
                    return False
            else:
                self.log(f"❌ Get single expense failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Get single expense failed: {str(e)}", "ERROR")
            return False
    
    def create_test_receipt_image(self):
        """Create a simple test receipt image"""
        try:
            # Create a simple receipt-like image
            img = Image.new('RGB', (400, 600), color='white')
            
            # Convert to bytes
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='PNG')
            img_byte_arr = img_byte_arr.getvalue()
            
            return img_byte_arr
        except Exception as e:
            self.log(f"Failed to create test image: {str(e)}", "ERROR")
            return None
    
    def test_receipt_processing(self):
        """Test receipt OCR processing"""
        self.log("Testing POST /expenses/receipt...")
        
        try:
            # Create test image
            test_image = self.create_test_receipt_image()
            if not test_image:
                self.log("❌ Failed to create test image", "ERROR")
                return False
            
            # Prepare file upload
            files = {
                'file': ('test_receipt.png', test_image, 'image/png')
            }
            
            response = self.session.post(
                f"{self.base_url}/expenses/receipt",
                files=files
            )
            
            if response.status_code == 200:
                data = response.json()
                success = data.get('success', False)
                extracted_data = data.get('extracted_data', {})
                
                if success and extracted_data:
                    self.log(f"✅ Receipt processing successful")
                    self.log(f"   Extracted data: {extracted_data}")
                    
                    # Check if confidence is present
                    confidence = extracted_data.get('confidence', 0)
                    self.log(f"   Confidence: {confidence}")
                    return True
                else:
                    error = data.get('error', 'Unknown error')
                    self.log(f"❌ Receipt processing failed: {error}", "ERROR")
                    return False
            else:
                self.log(f"❌ Receipt processing failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Receipt processing failed: {str(e)}", "ERROR")
            return False
    
    def test_monthly_analytics(self):
        """Test monthly analytics API"""
        self.log("Testing GET /analytics/monthly...")
        
        try:
            response = self.session.get(f"{self.base_url}/analytics/monthly")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log(f"✅ Monthly analytics retrieved: {len(data)} months")
                    
                    # Validate structure if data exists
                    if data:
                        first_month = data[0]
                        required_fields = ['month', 'total', 'categories', 'expense_count']
                        missing_fields = [field for field in required_fields if field not in first_month]
                        
                        if missing_fields:
                            self.log(f"❌ Missing fields in analytics: {missing_fields}", "ERROR")
                            return False
                        
                        self.log(f"   Sample month: {first_month['month']}, Total: ${first_month['total']}")
                        self.log(f"   Categories: {len(first_month['categories'])}")
                    
                    return True
                else:
                    self.log(f"❌ Expected list, got: {type(data)}", "ERROR")
                    return False
            else:
                self.log(f"❌ Monthly analytics failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Monthly analytics failed: {str(e)}", "ERROR")
            return False
    
    def test_ai_insights(self):
        """Test AI insights generation"""
        self.log("Testing GET /insights...")
        
        try:
            response = self.session.get(f"{self.base_url}/insights")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log(f"✅ AI insights retrieved: {len(data)} insights")
                    
                    # Validate structure if insights exist
                    if data:
                        first_insight = data[0]
                        required_fields = ['type', 'title', 'description']
                        missing_fields = [field for field in required_fields if field not in first_insight]
                        
                        if missing_fields:
                            self.log(f"❌ Missing fields in insight: {missing_fields}", "ERROR")
                            return False
                        
                        self.log(f"   Sample insight: {first_insight['type']} - {first_insight['title']}")
                    
                    return True
                else:
                    self.log(f"❌ Expected list, got: {type(data)}", "ERROR")
                    return False
            else:
                self.log(f"❌ AI insights failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ AI insights failed: {str(e)}", "ERROR")
            return False
    
    def test_delete_expense(self):
        """Test deleting an expense"""
        if not self.created_expense_ids:
            self.log("❌ No expenses to delete", "ERROR")
            return False
        
        expense_id = self.created_expense_ids[-1]  # Delete the last created expense
        self.log(f"Testing DELETE /expenses/{expense_id}...")
        
        try:
            response = self.session.delete(f"{self.base_url}/expenses/{expense_id}")
            
            if response.status_code == 200:
                data = response.json()
                message = data.get('message', '')
                
                if 'deleted' in message.lower():
                    self.log(f"✅ Expense deleted successfully: ID {expense_id}")
                    self.created_expense_ids.remove(expense_id)
                    return True
                else:
                    self.log(f"❌ Unexpected delete response: {message}", "ERROR")
                    return False
            else:
                self.log(f"❌ Delete expense failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Delete expense failed: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        self.log("=" * 60)
        self.log("STARTING AI EXPENSE TRACKER BACKEND TESTS")
        self.log("=" * 60)
        
        test_results = {}
        
        # Test sequence
        tests = [
            ("API Health Check", self.test_api_health),
            ("Get Categories", self.test_get_categories),
            ("Create Expense (Manual Category)", self.test_create_expense_with_category),
            ("Create Expense (AI Categorization)", self.test_create_expense_ai_categorization),
            ("Get All Expenses", self.test_get_expenses),
            ("Get Single Expense", self.test_get_single_expense),
            ("Update Expense", self.test_update_expense),
            ("Receipt OCR Processing", self.test_receipt_processing),
            ("Monthly Analytics", self.test_monthly_analytics),
            ("AI Insights", self.test_ai_insights),
            ("Delete Expense", self.test_delete_expense),
        ]
        
        for test_name, test_func in tests:
            self.log(f"\n--- {test_name} ---")
            try:
                result = test_func()
                test_results[test_name] = result
                if result:
                    self.log(f"✅ {test_name}: PASSED")
                else:
                    self.log(f"❌ {test_name}: FAILED")
            except Exception as e:
                self.log(f"❌ {test_name}: FAILED with exception: {str(e)}", "ERROR")
                test_results[test_name] = False
            
            # Small delay between tests
            time.sleep(1)
        
        # Summary
        self.log("\n" + "=" * 60)
        self.log("TEST SUMMARY")
        self.log("=" * 60)
        
        passed = sum(1 for result in test_results.values() if result)
        total = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            self.log(f"{test_name}: {status}")
        
        self.log(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED!")
        else:
            self.log(f"⚠️  {total - passed} tests failed")
        
        return test_results

def main():
    """Main test execution"""
    tester = ExpenseTrackerTester()
    results = tester.run_all_tests()
    
    # Return exit code based on results
    failed_tests = [name for name, result in results.items() if not result]
    if failed_tests:
        print(f"\nFailed tests: {failed_tests}")
        return 1
    return 0

if __name__ == "__main__":
    exit(main())