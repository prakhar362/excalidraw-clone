"""
Advanced Sketch Enhancement System
Supports multiple enhancement strategies:
1. OpenCV Pipeline (always available, production quality)
2. ControlNet AI Enhancement (optional, requires GPU or slow on CPU)
"""

import cv2
import numpy as np
from PIL import Image, ImageEnhance
from typing import Dict, Literal, Optional
import io
import base64
from app.config import config
from app.models.sketch_preprocessor import SketchPreprocessor

EnhancementStyle = Literal["professional", "artistic", "clean", "minimal"]

class SketchEnhancerV2:
    """
    Production-ready sketch enhancement with multiple strategies
    """
    
    def __init__(self):
        print("Initializing Sketch Enhancer V2...")
        
        self.preprocessor = SketchPreprocessor(config)
        
        # Strategy 1: OpenCV (always available)
        self.opencv_ready = True
        print("[OK] OpenCV pipeline ready")
        
        # Strategy 2: ControlNet (optional)
        self.controlnet_ready = False
        if config.ENABLE_AI_ENHANCEMENT:
            self._load_controlnet()
    
    def _load_controlnet(self):
        """
        Load ControlNet for AI-powered enhancement
        Only loads if explicitly enabled in config
        """
        try:
            from diffusers import StableDiffusionControlNetPipeline, ControlNetModel
            import torch
            
            print("Loading ControlNet (this may take a minute)...")
            
            # Load ControlNet model optimized for sketches
            self.controlnet = ControlNetModel.from_pretrained(
                config.CONTROLNET_MODEL,
                torch_dtype=torch.float32  # Use float32 for CPU
            )
            
            # Load Stable Diffusion pipeline
            self.sd_pipeline = StableDiffusionControlNetPipeline.from_pretrained(
                "runwayml/stable-diffusion-v1-5",
                controlnet=self.controlnet,
                torch_dtype=torch.float32,
                safety_checker=None,  # Disable for speed
                requires_safety_checker=False
            )
            
            # Optimize for CPU/low memory
            self.sd_pipeline.enable_attention_slicing()
            
            # Try to enable xformers for speed (if available)
            try:
                self.sd_pipeline.enable_xformers_memory_efficient_attention()
            except:
                pass
            
            self.controlnet_ready = True
            print("[OK] ControlNet loaded successfully!")
            
        except Exception as e:
            print(f"[WARN] ControlNet failed to load: {e}")
            print("   Falling back to OpenCV-only mode")
            self.controlnet_ready = False
    
    def enhance(
        self,
        image: Image.Image,
        style: EnhancementStyle = "professional",
        use_ai: bool = False
    ) -> Dict:
        """
        Enhance a sketch using the best available method
        
        Args:
            image: Input sketch image
            style: Enhancement style
            use_ai: Try AI enhancement (requires ControlNet)
        
        Returns:
            Dict with:
                - enhanced_image: PIL Image
                - style: Applied style
                - method: Enhancement method used
                - confidence: Quality confidence (0-1)
        """
        
        print(f"Enhancing sketch: style={style}, use_ai={use_ai}")
        
        # Preprocess image
        preprocessed = self.preprocessor.preprocess(image)
        
        # Try AI enhancement if requested and available
        if use_ai and self.controlnet_ready:
            try:
                enhanced = self._enhance_with_controlnet(preprocessed, style)
                return {
                    "enhanced_image": enhanced,
                    "style": style,
                    "method": "controlnet",
                    "confidence": 0.95
                }
            except Exception as e:
                print(f"ControlNet enhancement failed: {e}")
                print("Falling back to OpenCV")
        
        # Use OpenCV pipeline
        enhanced = self._enhance_with_opencv(preprocessed, style)
        enhanced_image = Image.fromarray(enhanced)
        
        return {
            "enhanced_image": enhanced_image,
            "style": style,
            "method": "opencv",
            "confidence": 0.85
        }
    
    def _enhance_with_controlnet(
        self, 
        img: np.ndarray, 
        style: EnhancementStyle
    ) -> Image.Image:
        """
        AI-powered enhancement using ControlNet
        """
        import torch
        
        # Extract edge map for control
        edges = self.preprocessor.extract_edges(img)
        edges_rgb = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)
        control_image = Image.fromarray(edges_rgb)
        
        # Define prompts for each style
        style_prompts = {
            "professional": (
                "professional technical drawing, clean precise lines, "
                "architectural sketch, high quality illustration, sharp details"
            ),
            "artistic": (
                "artistic hand-drawn sketch, beautiful linework, "
                "expressive illustration, creative drawing, aesthetic"
            ),
            "clean": (
                "clean minimal sketch, simple clear lines, "
                "neat drawing, organized illustration"
            ),
            "minimal": (
                "minimalist line drawing, ultra-simple sketch, "
                "elegant minimal illustration, pure linework"
            )
        }
        
        prompt = style_prompts.get(style, style_prompts["professional"])
        
        negative_prompt = (
            "blurry, messy, chaotic, noisy, dirty, smudged, "
            "low quality, distorted, cluttered"
        )
        
        # Generate enhanced version
        print(f"Running ControlNet inference (steps={config.CONTROLNET_INFERENCE_STEPS})...")
        
        with torch.no_grad():
            result = self.sd_pipeline(
                prompt=prompt,
                negative_prompt=negative_prompt,
                image=control_image,
                num_inference_steps=config.CONTROLNET_INFERENCE_STEPS,
                controlnet_conditioning_scale=config.CONTROLNET_SCALE,
                guidance_scale=7.5
            ).images[0]
        
        print("[OK] ControlNet inference complete")
        
        return result
    
    def _enhance_with_opencv(
        self, 
        img: np.ndarray, 
        style: EnhancementStyle
    ) -> np.ndarray:
        """
        Advanced OpenCV enhancement pipeline
        
        Pipeline stages:
        1. Adaptive solid stroke extraction (avoids Canny double-edges)
        2. Style-specific processing
        3. Post-processing (gamma, sharpening)
        """
        
        print("Running OpenCV enhancement pipeline...")
        
        # Stage 1: Extract clean solid strokes
        strokes = self._extract_solid_strokes(img)
        
        # Stage 2: Apply style-specific processing
        if style == "professional":
            result = self._apply_professional_style(img, strokes)
        elif style == "artistic":
            result = self._apply_artistic_style(img, strokes)
        elif style == "clean":
            result = self._apply_clean_style(img, strokes)
        elif style == "minimal":
            result = self._apply_minimal_style(img, strokes)
        else:
            result = self._apply_professional_style(img, strokes)
        
        # Stage 3: Post-processing
        result = self._post_process(result, style)
        
        print("[OK] OpenCV enhancement complete")
        
        return result
    
    def _extract_solid_strokes(self, img: np.ndarray) -> np.ndarray:
        """
        Extract solid strokes from drawing using adaptive thresholding
        This completely avoids the double-edge outlines caused by Canny.
        """
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        
        # Bilateral filter removes paper texture noise while preserving sharp stroke boundaries
        smoothed = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # Adaptive threshold extracts local dark drawing strokes on light background
        thresh = cv2.adaptiveThreshold(
            smoothed,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            15,  # local window size
            8    # constant offset
        )
        
        # Clean small isolated noise specks
        kernel_clean = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel_clean)
        
        # Connect nearby stroke gaps
        kernel_smooth = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        smoothed_strokes = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel_smooth)
        
        return smoothed_strokes
    
    def _apply_professional_style(
        self, 
        img: np.ndarray, 
        strokes: np.ndarray
    ) -> np.ndarray:
        """
        Professional technical drawing style
        - Clean white background
        - Solid, clean, anti-aliased black strokes
        """
        result = np.ones_like(img) * 255
        
        # Create premium anti-aliased borders
        mask = cv2.GaussianBlur(strokes, (3, 3), 0.5)
        
        # Apply anti-aliased black strokes
        for c in range(3):
            result[:, :, c] = 255 - mask
            
        return result
    
    def _apply_artistic_style(
        self, 
        img: np.ndarray, 
        strokes: np.ndarray
    ) -> np.ndarray:
        """
        Artistic pencil sketch style
        - Retains beautiful textured pencil graphite details
        - Completely purifies the paper background to clean white
        """
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        
        # Bleach background to white using a dodge blend
        inv_gray = 255 - gray
        blur = cv2.GaussianBlur(inv_gray, (21, 21), 0)
        sketch = cv2.divide(gray, 255 - blur, scale=256)
        
        # Enhance strokes specifically with the solid mask for clean outline contrast
        enhanced_sketch = cv2.multiply(sketch, 255 - (strokes // 3), scale=1.0/255)
        
        result = cv2.cvtColor(enhanced_sketch.astype(np.uint8), cv2.COLOR_GRAY2RGB)
        return result
    
    def _apply_clean_style(
        self, 
        img: np.ndarray, 
        strokes: np.ndarray
    ) -> np.ndarray:
        """
        Clean minimal style
        - Sharp, high-contrast, pure solid black lines
        """
        result = np.ones_like(img) * 255
        result[strokes > 0] = [0, 0, 0]
        return result
    
    def _apply_minimal_style(
        self, 
        img: np.ndarray, 
        strokes: np.ndarray
    ) -> np.ndarray:
        """
        Ultra-minimal thin line drawing
        - Elegantly thinned strokes
        - Fine, high-quality contours
        """
        # Erode the stroke mask to uniform thin centerlines
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        thinned = cv2.erode(strokes, kernel, iterations=1)
        
        # Anti-alias the fine strokes
        mask = cv2.GaussianBlur(thinned, (3, 3), 0.5)
        
        result = np.ones_like(img) * 255
        for c in range(3):
            result[:, :, c] = 255 - mask
            
        return result

    
    def _post_process(
        self, 
        img: np.ndarray, 
        style: EnhancementStyle
    ) -> np.ndarray:
        """
        Final post-processing
        - Gamma correction
        - Sharpening
        - Final contrast adjustment
        """
        # Gamma correction based on style
        gamma_map = {
            "professional": 1.0,
            "artistic": 1.2,
            "clean": 0.9,
            "minimal": 0.85
        }
        
        gamma = gamma_map.get(style, 1.0)
        
        if gamma != 1.0:
            inv_gamma = 1.0 / gamma
            table = np.array([
                ((i / 255.0) ** inv_gamma) * 255
                for i in range(256)
            ]).astype("uint8")
            img = cv2.LUT(img, table)
        
        # Slight sharpening for crispness
        if style in ["professional", "clean"]:
            kernel = np.array([
                [-1, -1, -1],
                [-1,  9, -1],
                [-1, -1, -1]
            ]) / 9
            img = cv2.filter2D(img, -1, kernel)
        
        return img
    
    def image_to_base64(self, image: Image.Image) -> str:
        """
        Convert PIL image to base64 data URL for preview
        """
        if isinstance(image, np.ndarray):
            image = Image.fromarray(image)
            
        buffered = io.BytesIO()
        image.save(
            buffered, 
            format="JPEG",
            quality=config.SKETCH_PREVIEW_QUALITY,
            optimize=True
        )
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return f"data:image/jpeg;base64,{img_str}"
