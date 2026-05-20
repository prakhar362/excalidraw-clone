from PIL import Image, ImageEnhance, ImageFilter
import numpy as np
import cv2
from typing import Optional, Tuple

class SketchEnhancer:
    """
    Enhances rough sketches to look more professional
    Uses advanced CV techniques + future GAN integration
    """
    
    def __init__(self):
        print("Initializing Sketch Enhancer (Advanced CV + Future GAN)...")
        self.gan_model = None  # Placeholder for future Pix2Pix GAN
    
    def enhance(self, image: Image.Image, style: str = "professional") -> Image.Image:
        """
        Enhance a rough sketch with advanced algorithms
        
        Args:
            image: PIL Image of the sketch
            style: Enhancement style - "professional", "artistic", "clean", "minimal"
            
        Returns:
            Enhanced PIL Image
        """
        # Convert to numpy for processing
        img_array = np.array(image.convert('RGB'))
        
        # Multi-stage enhancement pipeline
        enhanced = self._preprocess(img_array)
        enhanced = self._denoise_advanced(enhanced)
        enhanced = self._enhance_lines_advanced(enhanced)
        enhanced = self._smooth_strokes_advanced(enhanced)
        enhanced = self._adjust_contrast_advanced(enhanced)
        
        # Apply style-specific enhancements
        if style == "artistic":
            enhanced = self._apply_artistic_filter(enhanced)
        elif style == "clean":
            enhanced = self._apply_clean_filter(enhanced)
        elif style == "minimal":
            enhanced = self._apply_minimal_filter(enhanced)
        elif style == "professional":
            enhanced = self._apply_professional_filter(enhanced)
        
        return Image.fromarray(enhanced)
    
    def _preprocess(self, image: np.ndarray) -> np.ndarray:
        """Advanced preprocessing"""
        # Resize if too small (upscale for better processing)
        h, w = image.shape[:2]
        if max(h, w) < 800:
            scale = 800 / max(h, w)
            image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        
        return image
    
    def _denoise_advanced(self, image: np.ndarray) -> np.ndarray:
        """Advanced denoising while preserving edges"""
        # Non-local means denoising (better than simple Gaussian)
        denoised = cv2.fastNlMeansDenoisingColored(image, None, h=10, hColor=10, 
                                                     templateWindowSize=7, searchWindowSize=21)
        
        # Additional bilateral filter for edge preservation
        denoised = cv2.bilateralFilter(denoised, d=9, sigmaColor=75, sigmaSpace=75)
        
        return denoised
    
    def _enhance_lines_advanced(self, image: np.ndarray) -> np.ndarray:
        """Advanced line enhancement using multiple edge detection"""
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # Multi-scale edge detection
        edges1 = cv2.Canny(gray, 30, 100)
        edges2 = cv2.Canny(gray, 50, 150)
        edges3 = cv2.Canny(gray, 70, 200)
        
        # Combine edges
        edges_combined = cv2.bitwise_or(edges1, cv2.bitwise_or(edges2, edges3))
        
        # Morphological operations to connect broken lines
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        edges_closed = cv2.morphologyEx(edges_combined, cv2.MORPH_CLOSE, kernel)
        
        # Thicken lines slightly for better visibility
        kernel_dilate = np.ones((2, 2), np.uint8)
        edges_thick = cv2.dilate(edges_closed, kernel_dilate, iterations=1)
        
        # Create enhanced version
        enhanced = image.copy()
        enhanced[edges_thick > 0] = [0, 0, 0]  # Make detected edges black
        
        return enhanced
    
    def _smooth_strokes_advanced(self, image: np.ndarray) -> np.ndarray:
        """Advanced stroke smoothing using guided filter"""
        # Convert to float for processing
        img_float = image.astype(np.float32) / 255.0
        
        # Guided filter (better than bilateral for stroke smoothing)
        radius = 5
        eps = 0.01
        smoothed = self._guided_filter(img_float, img_float, radius, eps)
        
        # Convert back to uint8
        smoothed = (smoothed * 255).astype(np.uint8)
        
        return smoothed
    
    def _guided_filter(self, I: np.ndarray, p: np.ndarray, r: int, eps: float) -> np.ndarray:
        """
        Guided filter implementation
        Better edge-preserving smoothing than bilateral filter
        """
        mean_I = cv2.boxFilter(I, cv2.CV_32F, (r, r))
        mean_p = cv2.boxFilter(p, cv2.CV_32F, (r, r))
        mean_Ip = cv2.boxFilter(I * p, cv2.CV_32F, (r, r))
        cov_Ip = mean_Ip - mean_I * mean_p
        
        mean_II = cv2.boxFilter(I * I, cv2.CV_32F, (r, r))
        var_I = mean_II - mean_I * mean_I
        
        a = cov_Ip / (var_I + eps)
        b = mean_p - a * mean_I
        
        mean_a = cv2.boxFilter(a, cv2.CV_32F, (r, r))
        mean_b = cv2.boxFilter(b, cv2.CV_32F, (r, r))
        
        q = mean_a * I + mean_b
        return q
    
    def _adjust_contrast_advanced(self, image: np.ndarray) -> np.ndarray:
        """Advanced contrast adjustment using CLAHE"""
        lab = cv2.cvtColor(image, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        
        # Adaptive histogram equalization
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        
        # Merge and convert back
        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2RGB)
        
        # Additional gamma correction for better visibility
        gamma = 1.2
        inv_gamma = 1.0 / gamma
        table = np.array([((i / 255.0) ** inv_gamma) * 255 
                         for i in np.arange(0, 256)]).astype("uint8")
        enhanced = cv2.LUT(enhanced, table)
        
        return enhanced
    
    def _apply_professional_filter(self, image: np.ndarray) -> np.ndarray:
        """
        Professional style: Clean, sharp, business-appropriate
        """
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # Adaptive thresholding for clean lines
        binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                       cv2.THRESH_BINARY, 11, 2)
        
        # Remove small noise
        kernel = np.ones((2, 2), np.uint8)
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
        
        # Slight blur for anti-aliasing
        smoothed = cv2.GaussianBlur(cleaned, (3, 3), 0)
        
        return cv2.cvtColor(smoothed, cv2.COLOR_GRAY2RGB)
    
    def _apply_artistic_filter(self, image: np.ndarray) -> np.ndarray:
        """
        Artistic style: Pencil sketch effect with texture
        """
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # Pencil sketch effect
        inv_gray = 255 - gray
        blur = cv2.GaussianBlur(inv_gray, (21, 21), 0)
        sketch = cv2.divide(gray, 255 - blur, scale=256)
        
        # Add slight texture
        noise = np.random.normal(0, 3, sketch.shape).astype(np.uint8)
        textured = cv2.add(sketch, noise)
        
        return cv2.cvtColor(textured, cv2.COLOR_GRAY2RGB)
    
    def _apply_clean_filter(self, image: np.ndarray) -> np.ndarray:
        """
        Clean style: Minimal, high contrast, no noise
        """
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # Otsu's thresholding for automatic threshold selection
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Remove small noise
        kernel = np.ones((3, 3), np.uint8)
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)
        
        return cv2.cvtColor(cleaned, cv2.COLOR_GRAY2RGB)
    
    def _apply_minimal_filter(self, image: np.ndarray) -> np.ndarray:
        """
        Minimal style: Thin lines, lots of white space
        """
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # High threshold for minimal lines
        _, binary = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY)
        
        # Thin the lines
        kernel = np.ones((2, 2), np.uint8)
        thinned = cv2.erode(binary, kernel, iterations=1)
        
        return cv2.cvtColor(thinned, cv2.COLOR_GRAY2RGB)
    
    def enhance_with_gan(self, image: Image.Image) -> Image.Image:
        """
        Future: Enhance using Pix2Pix GAN
        This will be implemented after training the GAN model
        """
        if self.gan_model is None:
            print("GAN model not loaded, using classical CV enhancement")
            return self.enhance(image, style="professional")
        
        # TODO: Implement GAN inference
        # 1. Preprocess image for GAN input
        # 2. Run inference
        # 3. Postprocess output
        # 4. Return enhanced image
        
        return image
