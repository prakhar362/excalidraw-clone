from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from PIL import Image
import torch

class HandwritingRecognizer:
    """
    Recognizes handwritten text using Microsoft's TrOCR
    """
    
    def __init__(self):
        print("Loading TrOCR model...")
        self.processor = TrOCRProcessor.from_pretrained('microsoft/trocr-base-handwritten')
        self.model = VisionEncoderDecoderModel.from_pretrained('microsoft/trocr-base-handwritten')
        self.model.eval()
    
    def recognize(self, image: Image.Image) -> str:
        """
        Recognize handwritten text from image
        
        Args:
            image: PIL Image containing handwritten text
            
        Returns:
            Recognized text string
        """
        # Preprocess
        pixel_values = self.processor(images=image, return_tensors="pt").pixel_values
        
        # Generate text
        with torch.no_grad():
            generated_ids = self.model.generate(pixel_values)
        
        # Decode
        text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        
        return text.strip()
