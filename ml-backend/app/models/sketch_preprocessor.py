"""
Image preprocessing utilities for sketch enhancement
Handles upscaling, denoising, cropping, and normalization
"""

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from typing import Tuple, Optional
from scipy.ndimage import gaussian_filter

class SketchPreprocessor:
    """
    Handles all image preprocessing for sketch enhancement
    """
    
    def __init__(self, config):
        self.config = config
        self.max_size = config.SKETCH_MAX_SIZE
        self.min_size = config.SKETCH_MIN_SIZE
        self.upscale_target = config.SKETCH_UPSCALE_TARGET
    
    def preprocess(self, image: Image.Image) -> np.ndarray:
        """
        Complete preprocessing pipeline
        
        Steps:
        1. Convert to RGB
        2. Remove excess whitespace
        3. Validate size
        4. Normalize size
        5. Denoise
        6. Enhance contrast
        
        Returns:
            Preprocessed image as numpy array
        """
        # Step 1: Ensure RGB
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Step 2: Remove whitespace
        image = self.tight_crop(image, padding=20)
        
        # Step 3: Validate size
        image = self.normalize_size(image)
        
        # Convert to numpy for CV operations
        img_array = np.array(image)
        
        # Step 4: Denoise
        img_array = self.denoise(img_array)
        
        # Step 5: Enhance contrast
        img_array = self.enhance_contrast(img_array)
        
        return img_array
    
    def tight_crop(self, image: Image.Image, padding: int = 20) -> Image.Image:
        """
        Remove excess whitespace around the sketch
        Critical for preventing AI hallucinations
        """
        # Convert to grayscale for analysis
        gray = image.convert('L')
        
        # Invert (so sketch is white on black)
        inverted = ImageOps.invert(gray)
        
        # Get bounding box of content
        bbox = inverted.getbbox()
        
        if bbox:
            x1, y1, x2, y2 = bbox
            
            # Add padding
            x1 = max(0, x1 - padding)
            y1 = max(0, y1 - padding)
            x2 = min(image.width, x2 + padding)
            y2 = min(image.height, y2 + padding)
            
            return image.crop((x1, y1, x2, y2))
        
        return image
    
    def normalize_size(self, image: Image.Image) -> Image.Image:
        """
        Ensure image is within acceptable size range
        Upscale small images, downscale large ones
        """
        w, h = image.size
        max_dim = max(w, h)
        
        # Upscale if too small
        if max_dim < self.upscale_target:
            scale = self.upscale_target / max_dim
            new_w = int(w * scale)
            new_h = int(h * scale)
            image = image.resize((new_w, new_h), Image.Resampling.BICUBIC)
            print(f"Upscaled: {w}x{h} → {new_w}x{new_h}")
        
        # Downscale if too large
        elif max_dim > self.max_size:
            scale = self.max_size / max_dim
            new_w = int(w * scale)
            new_h = int(h * scale)
            image = image.resize((new_w, new_h), Image.Resampling.LANCZOS)
            print(f"Downscaled: {w}x{h} → {new_w}x{new_h}")
        
        return image
    
    def denoise(self, img: np.ndarray) -> np.ndarray:
        """
        Multi-stage denoising while preserving edges
        
        Uses:
        1. Non-local means denoising (removes Gaussian noise)
        2. Bilateral filter (edge-preserving smoothing)
        """
        strength = self.config.SKETCH_DENOISE_STRENGTH
        
        # Stage 1: Non-local means
        denoised = cv2.fastNlMeansDenoisingColored(
            img, 
            None,
            h=strength,
            hColor=strength,
            templateWindowSize=7,
            searchWindowSize=21
        )
        
        # Stage 2: Bilateral filter (preserves edges)
        denoised = cv2.bilateralFilter(
            denoised,
            d=9,
            sigmaColor=75,
            sigmaSpace=75
        )
        
        return denoised
    
    def enhance_contrast(self, img: np.ndarray) -> np.ndarray:
        """
        Improve contrast for better edge detection
        Uses CLAHE (Contrast Limited Adaptive Histogram Equalization)
        """
        # Convert to LAB color space
        lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        
        # Apply CLAHE to L channel
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        
        # Merge back
        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2RGB)
        
        return enhanced
    
    def extract_edges(self, img: np.ndarray) -> np.ndarray:
        """
        Extract edge map for ControlNet
        """
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        
        edges = cv2.Canny(
            gray,
            self.config.SKETCH_EDGE_THRESHOLD_LOW,
            self.config.SKETCH_EDGE_THRESHOLD_HIGH
        )
        
        return edges
