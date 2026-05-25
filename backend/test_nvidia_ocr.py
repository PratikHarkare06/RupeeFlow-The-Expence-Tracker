import os
import asyncio
import logging
from dotenv import load_dotenv
from receipt_processor import ReceiptProcessor

# Load environment variables
load_dotenv(".env")

logging.basicConfig(level=logging.INFO)

async def main():
    api_key = os.environ.get("NVIDIA_API_KEY")
    if not api_key or "REPLACE" in api_key:
        print("❌ NVIDIA_API_KEY is not set. Please set it in backend/.env")
        return
        
    print(f"🔑 Found NVIDIA_API_KEY starting with: {api_key[:10]}...")
    
    # Create a tiny 100x100 white PNG image in bytes to test API
    from PIL import Image
    import io
    img = Image.new('RGB', (100, 100), color = 'white')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()
    
    processor = ReceiptProcessor()
    print("🤖 Initializing ReceiptProcessor...")
    
    print("🛰️  Sending request to NVIDIA NeMo Retriever OCR...")
    # Since it's a blank image, it might return empty_ocr or success with no text.
    # What we care about is that it doesn't return an auth error (401/403).
    res = await processor.process_with_nvidia_ocr(img_bytes)
    
    print("\n📝 API Response:")
    print(res)
    
    if res.get("success"):
        print("\n✅ Success! The NVIDIA NeMo Retriever OCR v1 API is working perfectly.")
    elif res.get("error_type") == "empty_ocr":
        print("\n✅ Success! The API connected successfully (it returned 'empty_ocr' because the test image was completely blank).")
    else:
        print(f"\n❌ Error encountered: {res.get('error')}")

if __name__ == "__main__":
    asyncio.run(main())
