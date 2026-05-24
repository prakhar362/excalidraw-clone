"""
Advanced Sketch Enhancement System
Enhancement priority:
  1. ONNX ML model (Informative Drawings - pretrained, ~17 MB, CPU, ~200-600ms)
  2. Gemini 2.5 Flash AI   (cloud, for exotic/complex sketches outside model distribution)
  3. OpenCV pipeline        (always available, no external deps)
"""

import cv2
import numpy as np
from PIL import Image, ImageEnhance
from typing import Dict, Literal, Optional
import io
import base64
import logging
from app.config import config
from app.models.sketch_enhancement.preprocessor import SketchPreprocessor

logger = logging.getLogger(__name__)

EnhancementStyle = Literal["professional", "artistic", "clean", "minimal"]


class SketchEnhancerV2:
    """
    Production-ready sketch enhancement with three tiered strategies.
    """

    def __init__(self):
        print("Initializing Sketch Enhancer V2...")

        self.preprocessor = SketchPreprocessor(config)

        # Strategy 1: ONNX ML model (Informative Drawings)
        self.onnx_ready = False
        self._onnx_enhancer = None
        if config.GAN_ENABLED:
            self._load_onnx_model()

        # Strategy 2: OpenCV (always available)
        self.opencv_ready = True
        print("[OK] OpenCV pipeline ready")

        # Strategy 3: ControlNet (legacy, disabled by default)
        self.controlnet_ready = False
        if config.ENABLE_AI_ENHANCEMENT:
            self._load_controlnet()

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def _load_onnx_model(self):
        """Load the pretrained Informative Drawings ONNX model."""
        try:
            from app.models.sketch_enhancement.gan.onnx_inference import ONNXSketchEnhancer
            enhancer = ONNXSketchEnhancer(
                model_dir=config.GAN_MODEL_DIR,
                model_variant=config.GAN_MODEL_VARIANT,
            )
            if enhancer.load():
                self._onnx_enhancer = enhancer
                self.onnx_ready = True
                print("[OK] ONNX ML sketch enhancer ready (Informative Drawings model)")
            else:
                print("[WARN] ONNX model failed to load — will use Gemini/OpenCV")
        except Exception as e:
            import traceback
            print(f"[WARN] ONNX model init failed: {e}")
            print(traceback.format_exc())
            self.onnx_ready = False

    def _load_controlnet(self):
        """Load ControlNet for AI-powered enhancement (legacy)."""
        try:
            from diffusers import StableDiffusionControlNetPipeline, ControlNetModel
            import torch

            print("Loading ControlNet (this may take a minute)...")
            self.controlnet = ControlNetModel.from_pretrained(
                config.CONTROLNET_MODEL, torch_dtype=torch.float32
            )
            self.sd_pipeline = StableDiffusionControlNetPipeline.from_pretrained(
                "runwayml/stable-diffusion-v1-5",
                controlnet=self.controlnet,
                torch_dtype=torch.float32,
                safety_checker=None,
                requires_safety_checker=False,
            )
            self.sd_pipeline.enable_attention_slicing()
            try:
                self.sd_pipeline.enable_xformers_memory_efficient_attention()
            except Exception:
                pass
            self.controlnet_ready = True
            print("[OK] ControlNet loaded successfully!")
        except Exception as e:
            print(f"[WARN] ControlNet failed to load: {e}")
            self.controlnet_ready = False

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    def enhance(
        self,
        image: Image.Image,
        style: EnhancementStyle = "professional",
        use_ai: bool = False,
    ) -> Dict:
        """
        Enhance a sketch using the best available method.

        Priority:
          use_ai=True  -> ONNX ML -> Gemini (if OOD) -> OpenCV
          use_ai=False -> ONNX ML -> OpenCV

        Returns dict with keys:
            enhanced_image (PIL Image), style, method, confidence,
            elements (optional, from Gemini path)
        """
        print(f"Enhancing sketch: style={style}, use_ai={use_ai}, "
              f"onnx_ready={self.onnx_ready}")

        # -- Strategy 1: Gemini AI (only if use_ai and key present) ----
        if use_ai and config.GEMINI_API_KEY:
            try:
                print("Attempting Gemini AI sketch enhancement...")
                return self._enhance_with_gemini(image, style)
            except Exception as e:
                import traceback
                print(f"[WARN] Gemini AI failed: {e}")
                print(traceback.format_exc())
                print("Falling back to ONNX...")

        # -- Strategy 2: ONNX ML model ---------------------------------
        if self.onnx_ready and self._onnx_enhancer is not None:
            try:
                print("Running ONNX ML enhancement (Informative Drawings)...")
                enhanced_pil = self._onnx_enhancer.enhance(image)
                # Apply style-specific post-processing on top of the ML output
                enhanced_pil = self._apply_style_to_onnx_output(enhanced_pil, style)
                print("[OK] ONNX ML enhancement complete")
                return {
                    "enhanced_image": enhanced_pil,
                    "style": style,
                    "method": "onnx-ml",
                    "confidence": 0.93,
                }
            except Exception as e:
                import traceback
                print(f"[WARN] ONNX enhancement failed: {e}")
                print(traceback.format_exc())
                print("Falling back to next strategy...")

        # -- Strategy 3: OpenCV (always available) ---------------------
        preprocessed = self.preprocessor.preprocess(image)

        if use_ai and self.controlnet_ready:
            try:
                enhanced = self._enhance_with_controlnet(preprocessed, style)
                return {
                    "enhanced_image": enhanced,
                    "style": style,
                    "method": "controlnet",
                    "confidence": 0.95,
                }
            except Exception as e:
                print(f"[WARN] ControlNet failed: {e}")

        enhanced = self._enhance_with_opencv(preprocessed, style)
        return {
            "enhanced_image": Image.fromarray(enhanced),
            "style": style,
            "method": "opencv",
            "confidence": 0.80,
        }

    # ------------------------------------------------------------------
    # Style post-processing for ONNX output
    # ------------------------------------------------------------------

    def _apply_style_to_onnx_output(
        self, image: Image.Image, style: EnhancementStyle
    ) -> Image.Image:
        """
        Apply lightweight style tweaks on top of the ONNX clean line-art output.
        The ONNX model already gives us a clean white-bg, dark-lines image.
        We just adjust contrast/brightness per style.
        """
        img_arr = np.array(image.convert("RGB"))

        if style == "professional":
            # High contrast, very clean
            img_pil = Image.fromarray(img_arr)
            img_pil = ImageEnhance.Contrast(img_pil).enhance(1.4)
            img_pil = ImageEnhance.Sharpness(img_pil).enhance(1.5)
            return img_pil

        elif style == "clean":
            # Binarize cleanly: pure black lines on white
            gray = cv2.cvtColor(img_arr, cv2.COLOR_RGB2GRAY)
            _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
            rgb = cv2.cvtColor(binary, cv2.COLOR_GRAY2RGB)
            return Image.fromarray(rgb)

        elif style == "minimal":
            # Even thinner strokes — erode slightly
            gray = cv2.cvtColor(img_arr, cv2.COLOR_RGB2GRAY)
            _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
            # Invert, erode (thin lines), re-invert
            inv = 255 - binary
            kernel = np.ones((2, 2), np.uint8)
            eroded = cv2.erode(inv, kernel, iterations=1)
            result = 255 - eroded
            rgb = cv2.cvtColor(result, cv2.COLOR_GRAY2RGB)
            return Image.fromarray(rgb)

        elif style == "artistic":
            # Soften slightly for a hand-drawn feel
            img_pil = Image.fromarray(img_arr)
            img_pil = ImageEnhance.Contrast(img_pil).enhance(1.2)
            return img_pil

        return image

    # ------------------------------------------------------------------
    # Gemini AI path
    # ------------------------------------------------------------------
    def _enhance_with_gemini(
        self,
        image: Image.Image,
        style: EnhancementStyle,
    ) -> Dict:
        """
        Enhance sketch using a pure, dynamic Gemini AI Custom SVG generation strategy.
        Generates a professionally drawn, mathematically perfect SVG vector illustration
        based strictly on the user's sketch category, layout, and composition.
        NO CDN templates, NO stock icons, and NO external emojis. Pure Gemini AI only.
        """
        import io
        import base64
        import json
        from google import genai
        # pyrefly: ignore [missing-import]
        from google.genai import types
        import traceback

        api_key = config.GEMINI_API_KEY
        if not api_key:
            raise ValueError("GEMINI_API_KEY config not set")

        client = genai.Client(api_key=api_key)

        # Save image to PNG bytes
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        img_bytes = buffered.getvalue()

        width, height = image.size

        # High-fidelity custom SVG generation prompt with strict mathematical and visual rules
        prompt = """
You are a world-class vector artist and master SVG designer.
Analyze the user's rough hand-drawn sketch image.
Your task is to generate a custom, highly professional, pristine, and beautiful outline vector drawing in SVG format that represents this subject.

Rules:
1. **Pristine Geometric Perfection**: Do NOT literally trace messy, bumpy, or overlapping hand-drawn lines. Instead, construct a perfectly clean, professional, and beautifully designed illustration from scratch.
2. **Alignment & Symmetry**: Align all parts perfectly. Use precise coordinates, standard geometric elements (<circle>, <ellipse>, <rect>, <line>), and clean, smooth Bézier curves (<path d="...">) to build the object. Everything must look mathematically aligned, aerodynamic, and professionally balanced.
3. **Subject & Orientation Parity**: Custom-redraw the subject identified in the user's sketch (e.g., if they drew an airplane pointing left, your SVG must be a beautiful, sleek passenger plane pointing left in the exact same location).
4. **Professional Outline Style**: Use a premium, clean designer outline style: stroke="black", stroke-width="2.5", fill="none", stroke-linecap="round", stroke-linejoin="round".
5. **opaque Solid White Fill**: Start the SVG with a solid white background: <rect width="100%" height="100%" fill="white"/> so it renders as a clean solid sticker on the canvas.
6. **Output Format**:
   - The output must be valid, well-structured SVG code wrapped inside a <svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg"> tag.
   - Return ONLY the raw SVG code. Do not wrap the response in markdown blocks (such as ```xml or ```svg or ```json), add commentary, or include any other text. Output only the SVG starting with <svg> and ending with </svg>.

Generate the pristine custom SVG illustration now:
"""

        try:
            print("Generating custom sketch vector using Gemini 2.5 Flash Lite...")
            response = client.models.generate_content(
                model="gemini-3.5-flash",
                contents=[
                    prompt.format(width=width, height=height),
                    types.Part.from_bytes(
                        data=img_bytes,
                        mime_type="image/png"
                    )
                ]
            )
            
            svg_code = response.text.strip()
            # Strip markdown fences if present
            if svg_code.startswith("```xml"):
                svg_code = svg_code[6:]
            elif svg_code.startswith("```svg"):
                svg_code = svg_code[6:]
            elif svg_code.startswith("```html"):
                svg_code = svg_code[6:]
            elif svg_code.startswith("```"):
                svg_code = svg_code[3:]
            if svg_code.endswith("```"):
                svg_code = svg_code[:-3]
            svg_code = svg_code.strip()
            
            if not ("<svg" in svg_code and "</svg>" in svg_code):
                raise ValueError("Response does not contain a valid SVG code.")
                
            clean_url = "http://localhost:8000/api/ml/preview-image"
            
            # Log the CLEAN url in terminal clearly for the user to visit
            print("\n" + "="*80)
            print(f"[AI SKETCH BEAUTIFICATION] Strategy: gemini-custom-svg-redraw")
            print(f"CLEAN IMAGE DESIGN URL: {clean_url}")
            print("="*80 + "\n")
            
            # Custom style outlines for premium canvas visual appearance
            # Normalize stroke colors to black
            svg_code = svg_code.replace('stroke="currentColor"', 'stroke="black"')
            svg_code = svg_code.replace('stroke="#000000"', 'stroke="black"')
            svg_code = svg_code.replace('stroke="#000"', 'stroke="black"')
            
            # Thicken strokes slightly for a bold premium visual feel
            svg_code = svg_code.replace('stroke-width="2"', 'stroke-width="2.2"')
            svg_code = svg_code.replace('stroke-width="2.5"', 'stroke-width="2.5"')
            
            # Inject a solid white background rect so the drawing is opaque on canvas (not transparent)
            if "<rect" not in svg_code and "<svg" in svg_code:
                parts = svg_code.split(">", 1)
                svg_code = parts[0] + '><rect width="100%" height="100%" fill="white"/>' + parts[1]
                
            # Convert to base64 XML data URL for native high-fidelity rendering on Excalidraw
            svg_base64 = base64.b64encode(svg_code.encode('utf-8')).decode()
            preview_data_url = f"data:image/svg+xml;base64,{svg_base64}"
            
            placeholder_image = Image.new("RGB", (width, height), "white")
            
            return {
                "enhanced_image": placeholder_image,
                "preview": preview_data_url,
                "style": style,
                "method": "gemini-ai",
                "confidence": 0.95,
                "elements": []
            }
            
        except Exception as e:
            print(f"[WARN] Gemini custom SVG generation failed: {e}. Falling back...")
            traceback.print_exc()
            raise e


    # ------------------------------------------------------------------
    # ControlNet path (legacy)
    # ------------------------------------------------------------------

    def _enhance_with_controlnet(
        self, img: np.ndarray, style: EnhancementStyle
    ) -> Image.Image:
        """AI-powered enhancement using ControlNet (legacy, rarely triggered)."""
        import torch

        edges = self.preprocessor.extract_edges(img)
        edges_rgb = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)
        control_image = Image.fromarray(edges_rgb)

        style_prompts = {
            "professional": "professional technical drawing, clean precise lines, architectural sketch, high quality illustration",
            "artistic": "artistic hand-drawn sketch, beautiful linework, expressive illustration, creative drawing",
            "clean": "clean minimal sketch, simple clear lines, neat drawing",
            "minimal": "minimalist line drawing, ultra-simple sketch, elegant minimal illustration",
        }
        prompt = style_prompts.get(style, style_prompts["professional"])
        negative_prompt = "blurry, messy, chaotic, noisy, dirty, smudged, low quality, distorted"

        print(f"Running ControlNet inference (steps={config.CONTROLNET_INFERENCE_STEPS})...")
        with torch.no_grad():
            result = self.sd_pipeline(
                prompt=prompt,
                negative_prompt=negative_prompt,
                image=control_image,
                num_inference_steps=config.CONTROLNET_INFERENCE_STEPS,
                controlnet_conditioning_scale=config.CONTROLNET_SCALE,
                guidance_scale=7.5,
            ).images[0]
        print("[OK] ControlNet inference complete")
        return result

    # ------------------------------------------------------------------
    # OpenCV pipeline (always available)
    # ------------------------------------------------------------------

    def _enhance_with_opencv(
        self, img: np.ndarray, style: EnhancementStyle
    ) -> np.ndarray:
        """Advanced OpenCV enhancement pipeline."""
        print("Running OpenCV enhancement pipeline...")
        strokes = self._extract_solid_strokes(img)

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

        result = self._post_process(result, style)
        print("[OK] OpenCV enhancement complete")
        return result

    def _extract_solid_strokes(self, img: np.ndarray) -> np.ndarray:
        """Extract solid strokes using adaptive thresholding."""
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        smoothed = cv2.bilateralFilter(gray, 9, 75, 75)
        thresh = cv2.adaptiveThreshold(
            smoothed, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            15, 8,
        )
        kernel_clean = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel_clean)
        kernel_smooth = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        return cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel_smooth)

    def _apply_professional_style(self, img: np.ndarray, strokes: np.ndarray) -> np.ndarray:
        result = np.ones_like(img) * 255
        mask = cv2.GaussianBlur(strokes, (3, 3), 0.5)
        for c in range(3):
            result[:, :, c] = 255 - mask
        return result

    def _apply_artistic_style(self, img: np.ndarray, strokes: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        inv_gray = 255 - gray
        blur = cv2.GaussianBlur(inv_gray, (21, 21), 0)
        sketch = cv2.divide(gray, 255 - blur, scale=256)
        enhanced_sketch = cv2.multiply(sketch, 255 - (strokes // 3), scale=1.0 / 255)
        return cv2.cvtColor(enhanced_sketch.astype(np.uint8), cv2.COLOR_GRAY2RGB)

    def _apply_clean_style(self, img: np.ndarray, strokes: np.ndarray) -> np.ndarray:
        result = np.ones_like(img) * 255
        result[strokes > 0] = [0, 0, 0]
        return result

    def _apply_minimal_style(self, img: np.ndarray, strokes: np.ndarray) -> np.ndarray:
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        thinned = cv2.erode(strokes, kernel, iterations=1)
        mask = cv2.GaussianBlur(thinned, (3, 3), 0.5)
        result = np.ones_like(img) * 255
        for c in range(3):
            result[:, :, c] = 255 - mask
        return result

    def _post_process(self, img: np.ndarray, style: EnhancementStyle) -> np.ndarray:
        """Final gamma correction and sharpening."""
        gamma_map = {"professional": 1.0, "artistic": 1.2, "clean": 0.9, "minimal": 0.85}
        gamma = gamma_map.get(style, 1.0)

        if gamma != 1.0:
            inv_gamma = 1.0 / gamma
            table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in range(256)]).astype("uint8")
            img = cv2.LUT(img, table)

        if style in ["professional", "clean"]:
            kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]]) / 9
            img = cv2.filter2D(img, -1, kernel)

        return img

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    def image_to_base64(self, image: Image.Image) -> str:
        """Convert PIL image to base64 data URL for preview."""
        if isinstance(image, np.ndarray):
            image = Image.fromarray(image)

        buffered = io.BytesIO()
        image.save(
            buffered,
            format="JPEG",
            quality=config.SKETCH_PREVIEW_QUALITY,
            optimize=True,
        )
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return f"data:image/jpeg;base64,{img_str}"
