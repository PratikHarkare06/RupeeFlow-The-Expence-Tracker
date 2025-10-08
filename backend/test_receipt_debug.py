#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from receipt_processor import ReceiptProcessor
import asyncio

async def test_receipt_processor():
    try:
        print("Testing Receipt Processor initialization...")
        processor = ReceiptProcessor()
        print("✅ Receipt Processor initialized successfully")
        
        # Test with empty bytes to see error handling
        print("\nTesting with empty file...")
        result = await processor.process_receipt(b"")
        print(f"Empty file result: {result}")
        
        # Test with invalid image data
        print("\nTesting with invalid image data...")
        result = await processor.process_receipt(b"invalid image data")
        print(f"Invalid data result: {result}")
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_receipt_processor())