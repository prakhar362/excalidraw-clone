from PIL import Image
from typing import Optional

class HandwritingRecognizer:
    """
    Recognizes handwritten text using Microsoft's TrOCR
    Uses TrOCR-Small by default (good balance of accuracy and memory)
    """
    
    # Configuration: Set to True to use TrOCR-Large (95%+ accuracy, 300MB)
    # Set to False to use TrOCR-Small (70-80% accuracy, 100MB)
    USE_LARGE_MODEL = False  # Change this to True for production
    
    def __init__(self):
        """Initialize recognizer"""
        self.processor = None
        self.model = None
        self._loaded = False
        
        self.model_name = 'microsoft/trocr-large-handwritten' if self.USE_LARGE_MODEL else 'microsoft/trocr-small-handwritten'
        
        print(f"HandwritingRecognizer initialized (model: {self.model_name}, lazy loaded)")

    def _load_model(self):
        if self._loaded: 
            return
        
        try:
            print(f"Loading {self.model_name}...")
            from transformers import TrOCRProcessor, VisionEncoderDecoderModel
            
            self.processor = TrOCRProcessor.from_pretrained(self.model_name)
            self.model = VisionEncoderDecoderModel.from_pretrained(self.model_name)
            self.model.eval()
            self._loaded = True
            
            print(f"✅ {self.model_name} loaded successfully!")
            if self.USE_LARGE_MODEL:
                print("   Using LARGE model - expect 95%+ accuracy!")
            else:
                print("   Using SMALL model - good for memory-constrained environments")
                
        except Exception as e:
            print(f"❌ Failed to load {self.model_name}: {e}")
            print("   Handwriting recognition will be disabled")

    def recognize(self, image: Image.Image, max_length: int = 64) -> str:
        """
        Recognize handwritten text from image
        
        Args:
            image: PIL Image containing handwritten text
            max_length: Maximum length of generated text
            
        Returns:
            Recognized text string
        """
        self._load_model()
        
        if not self.processor or not self.model:
            return "Handwriting recognition disabled due to memory limits"

        try:
            import torch
            
            # Preprocess image
            pixel_values = self.processor(images=image, return_tensors="pt").pixel_values
            
            # Generate text
            with torch.no_grad():
                generated_ids = self.model.generate(
                    pixel_values,
                    max_length=max_length,
                    num_beams=4,  # Beam search for better quality
                    early_stopping=True
                )
            
            # Decode
            text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            
            return text.strip()
            
        except Exception as e:
            print(f"TrOCR inference failed: {e}")
            return "Handwriting recognition failed"
    
    def recognize_batch(self, images: list) -> list:
        """
        Recognize text from multiple images in batch
        More efficient than calling recognize() multiple times
        
        Args:
            images: List of PIL Images
            
        Returns:
            List of recognized text strings
        """
        self._load_model()
        
        if not self.processor or not self.model:
            return ["Handwriting recognition disabled"] * len(images)
        
        try:
            import torch
            
            # Batch preprocessing
            pixel_values = self.processor(images=images, return_tensors="pt").pixel_values
            
            # Batch generation
            with torch.no_grad():
                generated_ids = self.model.generate(
                    pixel_values,
                    max_length=64,
                    num_beams=4,
                    early_stopping=True
                )
            
            # Batch decoding
            texts = self.processor.batch_decode(generated_ids, skip_special_tokens=True)
            
            return [text.strip() for text in texts]
            
        except Exception as e:
            print(f"Batch TrOCR inference failed: {e}")
            return ["Handwriting recognition failed"] * len(images)
    
    def get_model_info(self) -> dict:
        """
        Get information about the loaded model
        
        Returns:
            Dict with model information
        """
        return {
            "model_name": self.model_name,
            "is_large": self.USE_LARGE_MODEL,
            "loaded": self._loaded,
            "expected_accuracy": "95%+" if self.USE_LARGE_MODEL else "70-80%",
            "memory_usage": "~300MB" if self.USE_LARGE_MODEL else "~100MB"
        }

