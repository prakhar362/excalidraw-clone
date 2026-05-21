from PIL import Image, ImageEnhance, ImageOps, ImageFilter
from typing import List
import numpy as np
import cv2
import requests
import io

class HandwritingRecognizer:
    """
    Enhanced handwriting recognizer utilizing a Microservices Architecture:
    1. Hugging Face API (PaddleOCR-VL-1.5) - Primary for maximum accuracy
    2. Local PaddleOCR (CRNN) - Fallback if HF is disconnected
    3. Tesseract - Final fallback
    """
    
    # --- YOUR HUGGING FACE URL ---
    HF_API_URL = "https://sanprakhar362-paddleocr.hf.space/predict"
    
    def __init__(self):
        print("Initializing Distributed Handwriting Recognizer...")
        
        # Local Strategy 1: PaddleOCR (CRNN)
        self._paddle_loaded = False
        self.paddle_ocr = None
        
        # Local Strategy 2: Tesseract
        self._tesseract_available = False
        
        self._load_models()
    
    def _load_models(self):
        """Load local fallback models"""
        try:
            from paddleocr import PaddleOCR
            print("Loading Local PaddleOCR (CRNN)...")
            self.paddle_ocr = PaddleOCR(
                use_angle_cls=True, lang='en', use_gpu=False, show_log=False,
                det_db_thresh=0.1, det_db_box_thresh=0.3, rec_algorithm='CRNN',
            )
            self._paddle_loaded = True
            print("✅ Local PaddleOCR loaded")
        except Exception as e:
            print(f"⚠️ Local PaddleOCR failed to load: {e}")
        
        try:
            import pytesseract
            pytesseract.get_tesseract_version()
            self._tesseract_available = True
            print("✅ Tesseract available")
        except:
            print("⚠️ Tesseract not available")
    
    def recognize(self, image: Image.Image) -> str:
        """
        Recognize handwritten text using the distributed architecture
        """
        preprocessed = self._preprocess_for_handwriting(image)
        results = []
        
        # Strategy 1: The Hugging Face Super-Model
        hf_text = self._recognize_with_hf(image) 
        if hf_text:
            results.append(("Hugging Face VL Model", hf_text, 0.99)) # Highest priority
            
        # Strategy 2: Local PaddleOCR
        if self._paddle_loaded and not hf_text:
            paddle_text, paddle_conf = self._recognize_with_local_paddle(preprocessed)
            if paddle_text and len(paddle_text) > 3:
                results.append(("Local PaddleOCR", paddle_text, paddle_conf))
                
        # Strategy 3: Local Tesseract
        if self._tesseract_available and not hf_text:
            tesseract_result = self._recognize_with_tesseract(preprocessed)
            if tesseract_result and len(tesseract_result) > 3:
                results.append(("Tesseract", tesseract_result, 0.6))
        
        if results:
            results.sort(key=lambda x: x[2], reverse=True)
            best_method, best_text, confidence = results[0]
            print(f"🎯 Best result from {best_method}: '{best_text}' (conf: {confidence})")
            return best_text
            
        return ""
    
    def recognize_batch(self, images: List[Image.Image]) -> List[str]:
        return [self.recognize(img) for img in images]

    def _recognize_with_hf(self, image: Image.Image) -> str:
        """Sends the image to the Hugging Face API"""
        print(f"Sending image to Hugging Face API ({self.HF_API_URL})...")
        try:
            # Convert PIL image to bytes
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='PNG')
            img_byte_arr = img_byte_arr.getvalue()
            
            files = {'file': ('image.png', img_byte_arr, 'image/png')}
            
            # --- CRITICAL FIX: Increased timeout to 180s ---
            print("Waiting for Hugging Face (This takes ~15s, or up to 2 mins if asleep)...")
            response = requests.post(self.HF_API_URL, files=files, timeout=180)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    text = data.get("text", "")
                    print(f"✅ Hugging Face successfully read: '{text}'")
                    return text
                else:
                    print(f"❌ Hugging Face API returned an internal error: {data.get('error')}")
            else:
                print(f"❌ API returned status {response.status_code}: {response.text}")
                
        except requests.exceptions.Timeout:
            print("❌ Hugging Face API timed out! The CPU server is overloaded.")
        except Exception as e:
            print(f"❌ Hugging Face API connection failed: {e}")
            
        return ""

    def _recognize_with_local_paddle(self, image: Image.Image) -> tuple[str, float]:
        """Local fallback using CPU"""
        try:
            img_array = np.array(image)
            result = self.paddle_ocr.ocr(img_array, cls=True)
            
            if result and result[0]:
                texts, confidences = [], []
                for line in result[0]:
                    if line[1][1] > 0.5:
                        texts.append(line[1][0])
                        confidences.append(line[1][1])
                
                if texts:
                    avg_conf = sum(confidences) / len(confidences)
                    return ' '.join(texts), avg_conf
        except Exception as e:
            print(f"Local PaddleOCR error: {e}")
        return "", 0.0

    def _recognize_with_tesseract(self, image: Image.Image) -> str:
        try:
            import pytesseract
            custom_config = r'--oem 3 --psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '
            return pytesseract.image_to_string(image, config=custom_config).strip()
        except Exception as e:
            print(f"Tesseract error: {e}")
            return ""

    def _preprocess_for_handwriting(self, image: Image.Image) -> Image.Image:
        """Preprocessing for local models only"""
        if image.mode != 'RGB': image = image.convert('RGB')
        image = self._tight_crop(image)
        if image.width < 64 or image.height < 32:
            scale = max(64 / image.width, 32 / image.height)
            image = image.resize((int(image.width * scale), int(image.height * scale)), Image.LANCZOS)
        image = ImageEnhance.Contrast(image).enhance(2.0)
        image = image.filter(ImageFilter.SHARPEN)
        img_array = np.array(image)
        denoised = cv2.fastNlMeansDenoisingColored(img_array, None, 10, 10, 7, 21)
        gray_array = np.array(Image.fromarray(denoised).convert('L'))
        binary = cv2.adaptiveThreshold(gray_array, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
        return Image.fromarray(binary).convert('RGB')
    
    def _tight_crop(self, image: Image.Image, padding: int = 10) -> Image.Image:
        inverted = ImageOps.invert(image.convert('L'))
        bbox = inverted.getbbox()
        if bbox:
            x1, y1, x2, y2 = bbox
            return image.crop((max(0, x1 - padding), max(0, y1 - padding), 
                               min(image.width, x2 + padding), min(image.height, y2 + padding)))
        return image