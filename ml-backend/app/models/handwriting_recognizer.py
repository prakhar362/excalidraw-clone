from PIL import Image
from typing import Optional

class HandwritingRecognizer:
    """
    Recognizes handwritten text using Microsoft's TrOCR
    """
    
    def __init__(self):
        self.processor = None
        self.model = None
        self._loaded = False
        print("HandwritingRecognizer initialized (models lazy loaded)")

    def _load_model(self):
        if self._loaded: return
        try:
            print("Loading TrOCR model...")
            from transformers import TrOCRProcessor, VisionEncoderDecoderModel
            self.processor = TrOCRProcessor.from_pretrained('microsoft/trocr-small-handwritten')
            self.model = VisionEncoderDecoderModel.from_pretrained('microsoft/trocr-small-handwritten')
            self.model.eval()
            self._loaded = True
            print("TrOCR loaded.")
        except Exception as e:
            print(f"Failed to load TrOCR (OOM or no memory): {e}")

    def recognize(self, image: Image.Image) -> str:
        """
        Recognize handwritten text from image
        """
        self._load_model()
        if not self.processor or not self.model:
            return "Handwriting recognition disabled due to memory limits"

        try:
            import torch
            pixel_values = self.processor(images=image, return_tensors="pt").pixel_values
            with torch.no_grad():
                generated_ids = self.model.generate(pixel_values)
            text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            return text.strip()
        except Exception as e:
            print(f"TrOCR inference failed: {e}")
            return "Handwriting recognition failed"
