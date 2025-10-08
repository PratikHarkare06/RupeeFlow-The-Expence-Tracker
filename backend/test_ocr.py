from receipt_processor import ReceiptProcessor
from PIL import Image
import io


def main():
    # Create a simple blank white image to test OCR pipeline
    img = Image.new('RGB', (800, 600), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    image_bytes = buf.getvalue()

    try:
        proc = ReceiptProcessor()
    except Exception as e:
        print('ReceiptProcessor initialization failed:', e)
        return

    result = proc.process_receipt(image_bytes)
    print('OCR test result:')
    print(result)


if __name__ == '__main__':
    main()
