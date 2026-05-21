from PIL import Image
from typing import List
import requests
import io
import traceback

class HandwritingRecognizer:
    """
    Lightweight client for the Hugging Face PaddleOCR-VL Microservice.
    Requires ZERO local machine learning libraries.
    """
    
    # --- YOUR HUGGING FACE URL ---
    HF_API_URL = "https://sanprakhar362-paddleocr.hf.space/predict"
    
    def __init__(self):
        print("Initializing Cloud-Native Handwriting Recognizer...")
        print(f"Target API: {self.HF_API_URL}")
    
    def recognize(self, image: Image.Image) -> str:
        """
        Sends the PIL Image to the Hugging Face API for recognition.
        """
        print("Sending image to Hugging Face API...")
        try:
            # 1. Convert PIL image to bytes
            img_byte_arr = io.BytesIO()
            # Convert to RGB just to be safe before saving
            if image.mode != 'RGB': 
                image = image.convert('RGB')
                
            image.save(img_byte_arr, format='PNG')
            img_byte_arr = img_byte_arr.getvalue()
            
            # 2. Package it for the API
            files = {'file': ('image.png', img_byte_arr, 'image/png')}
            
            # 3. Send the request (180s timeout for cold starts)
            print("Waiting for AI processing...")
            response = requests.post(self.HF_API_URL, files=files, timeout=180)
            
            # 4. Handle the response
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    text = data.get("text", "")
                    print(f"✅ Recognized: '{text}'")
                    return text
                else:
                    print(f"❌ API Internal Error: {data.get('error')}")
            else:
                print(f"❌ API Status {response.status_code}: {response.text}")
                
        except requests.exceptions.Timeout:
            print("❌ API timed out! The server might be asleep or overloaded.")
        except Exception as e:
            print(f"❌ Connection failed: {traceback.format_exc()}")
            
        return ""
    
    def recognize_batch(self, images: List[Image.Image]) -> List[str]:
        """Process multiple images sequentially"""
        return [self.recognize(img) for img in images]