import easyocr
import numpy as np
from PIL import Image
from typing import List, Dict

class TextDetector:
    """
    Enhanced text detector with better filtering
    """
    
    def __init__(self):
        print("Initializing EasyOCR Text Detector...")
        try:
            # Add more languages if needed: ['en', 'ch_sim', 'hi', etc.]
            self.reader = easyocr.Reader(['en'], gpu=False, verbose=False)
            print("✅ EasyOCR loaded successfully!")
        except Exception as e:
            print(f"❌ Failed to load EasyOCR: {e}")
            self.reader = None
    
    def detect_regions(self, image: Image.Image) -> List[Dict]:
        """
        Detect text regions with improved filtering
        """
        if not self.reader:
            return []
        
        img_np = np.array(image.convert("RGB"))
        
        # Adjust EasyOCR parameters for better detection
        results = self.reader.readtext(
            img_np,
            paragraph=False,  # Don't merge lines
            min_size=10,      # Minimum box size
            text_threshold=0.5,  # Text detection threshold
            low_text=0.3,     # Lower bound for text probability
            link_threshold=0.3,  # Link between text regions
            canvas_size=2560,  # Max image size
            mag_ratio=1.5,    # Image magnification
        )
        
        regions: List[Dict] = []
        
        for idx, (bbox, text, prob) in enumerate(results):
            (tl, tr, br, bl) = bbox
            
            x = int(tl[0])
            y = int(tl[1])
            w = int(br[0] - tl[0])
            h = int(br[1] - tl[1])
            
            # More lenient filtering
            if w < 15 or h < 15:  # Minimum size
                continue
            
            # Skip very low confidence (but be more lenient)
            if prob < 0.1:
                continue
            
            regions.append({
                "id": f"region_{idx}",
                "text": "",  # Leave empty for TrOCR
                "confidence": float(prob),
                "bbox": {"x": x, "y": y, "width": w, "height": h},
                "center": {"x": x + w / 2.0, "y": y + h / 2.0},
            })
        
        # Sort top→bottom, left→right
        regions.sort(key=lambda r: (r["center"]["y"], r["center"]["x"]))
        
        print(f"EasyOCR: found {len(regions)} valid text region(s)")
        return regions