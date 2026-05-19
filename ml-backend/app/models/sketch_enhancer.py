from PIL import Image, ImageEnhance, ImageFilter
import numpy as np
import cv2
from typing import Optional

class SketchEnhancer:
    """
    Enhances rough sketches to look more professional
    Uses traditional CV + lightweight AI approach for CPU efficiency
    """
    
    def __init__(self):
        print("Initializing Sketch Enhancer...")
        # No heavy models loaded - using classical CV techniques
    
    def enhance(self, image: Image.Image, style: str = "professional") -> Image.Image:
        """
        Enhance a rough sketch
        
        Args:
            image: PIL Image of the sketch
            style: Enhancement style - "professional", "artistic", "clean"
            
        Returns:
            Enhanced PIL Image
        """
        # Convert to numpy for processing
        img_array = np.array(image.convert('RGB'))
        
        # Apply enhancement pipeline
        enhanced = self._denoise(img_array)
        enhanced = self._enhance_lines(enhanced)
        enhanced = self._adjust_contrast(enhanced)
        enhanced = self._smooth_strokes(enhanced)
        
        if style == "artistic":
            enhanced = self._apply_artistic_filter(enhanced)
        elif style == "clean":
            enhanced = self._apply_clean_filter(enhanced)
        
        return Image.fromarray(enhanced)
    
    def _denoise(self, image: np.ndarray) -> np.ndarray:
        """Remove noise while preserving edges"""
        return cv2.fastNlMeansDenoisingColored(image, None, 10, 10, 7, 21)
    
    def _enhance_lines(self, image: np.ndarray) -> np.ndarray:
        """Make sketch lines more defined"""
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # Detect edges
        edges = cv2.Canny(gray, 50, 150)
        
        # Thicken lines slightly
        kernel = np.ones((2, 2), np.uint8)
        edges = cv2.dilate(edges, kernel, iterations=1)
        
        # Create enhanced version
        enhanced = image.copy()
        enhanced[edges > 0] = [0, 0, 0]  # Make detected edges black
        
        return enhanced
    
    def _adjust_contrast(self, image: np.ndarray) -> np.ndarray:
        """Improve contrast for better visibility"""
        lab = cv2.cvtColor(image, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        
        # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        
        enhanced = cv2.merge([l, a, b])
        return cv2.cvtColor(enhanced, cv2.COLOR_LAB2RGB)
    
    def _smooth_strokes(self, image: np.ndarray) -> np.ndarray:
        """Smooth out jagged strokes"""
        return cv2.bilateralFilter(image, 9, 75, 75)
    
    def _apply_artistic_filter(self, image: np.ndarray) -> np.ndarray:
        """Apply artistic styling"""
        # Pencil sketch effect
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        inv_gray = 255 - gray
        blur = cv2.GaussianBlur(inv_gray, (21, 21), 0)
        sketch = cv2.divide(gray, 255 - blur, scale=256)
        
        # Convert back to RGB
        return cv2.cvtColor(sketch, cv2.COLOR_GRAY2RGB)
    
    def _apply_clean_filter(self, image: np.ndarray) -> np.ndarray:
        """Apply clean, minimal styling"""
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # Apply threshold for clean lines
        _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
        
        # Remove small noise
        kernel = np.ones((3, 3), np.uint8)
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        
        return cv2.cvtColor(cleaned, cv2.COLOR_GRAY2RGB)
