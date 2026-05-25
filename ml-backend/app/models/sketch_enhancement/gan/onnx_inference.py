"""
ONNX-based Sketch Enhancement supporting:
  1. Custom Pix2Pix GAN model (sketch_enhancer.onnx) - trained by user, 1-channel 256x256
  2. Pretrained Informative Drawings model (informative_drawings_contour.onnx) - 3-channel 512x512 fallback

Runs entirely on CPU via ONNX Runtime — no PyTorch required in production.
"""

import os
import io
import logging
import urllib.request
from pathlib import Path
from typing import Optional, Tuple, Dict

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# Pretrained models URLs from the Informative Drawings project (fallback strategy)
MODEL_URLS = {
    "contour": "https://huggingface.co/rocca/informative-drawings-line-art-onnx/resolve/main/model.onnx",
    "opensketch": "https://huggingface.co/Luoaho/image-to-line-drawing-onnx/resolve/main/line-drawings.onnx",
}

DEFAULT_MODEL = "contour"
HF_INPUT_SIZE = 512
CUSTOM_GAN_INPUT_SIZE = 256

class ONNXSketchEnhancer:
    """
    Lightweight CPU sketch enhancer wrapper that supports both our Custom Pix2Pix GAN 
    and the pre-trained Informative Drawings ONNX model as an elegant fallback.
    """

    def __init__(self, model_dir: Optional[str] = None, model_variant: str = DEFAULT_MODEL):
        self.model_variant = model_variant if model_variant in MODEL_URLS else DEFAULT_MODEL
        self.model_url = MODEL_URLS[self.model_variant]

        # Setup paths
        if model_dir is None:
            base = Path(__file__).resolve().parent.parent.parent.parent.parent  # ml-backend root
            model_dir = str(base / "checkpoints")
        self.model_dir = Path(model_dir)
        
        # Primary Custom GAN Path
        self.custom_gan_path = self.model_dir / "sketch_enhancer.onnx"
        
        # Fallback Pretrained Path
        self.hf_model_path = self.model_dir / f"informative_drawings_{self.model_variant}.onnx"
        
        # Selected mode
        self.is_custom_gan = False
        self.model_path = None
        self.session = None
        self._ready = False

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    @property
    def ready(self) -> bool:
        return self._ready

    def load(self) -> bool:
        """Download (if needed) and load the ONNX session. Returns True on success."""
        try:
            import onnxruntime as ort
        except ImportError:
            logger.error("onnxruntime not installed. Run: pip install onnxruntime")
            return False

        try:
            # 1. Check if our Custom trained Pix2Pix GAN model exists
            if self.custom_gan_path.exists():
                logger.info(f"Custom Pix2Pix GAN model found! Loading: {self.custom_gan_path}")
                self.model_path = self.custom_gan_path
                self.is_custom_gan = True
            else:
                logger.info(f"Custom Pix2Pix GAN not found at {self.custom_gan_path}. Using Informative Drawings fallback...")
                self._ensure_hf_model_downloaded()
                self.model_path = self.hf_model_path
                self.is_custom_gan = False

            sess_options = ort.SessionOptions()
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            sess_options.intra_op_num_threads = 2  # Keep Render free-tier happy
            
            self.session = ort.InferenceSession(
                str(self.model_path),
                sess_options=sess_options,
                providers=["CPUExecutionProvider"],
            )
            self._input_name = self.session.get_inputs()[0].name
            self._output_name = self.session.get_outputs()[0].name
            self._ready = True
            
            model_type = "Custom Pix2Pix GAN" if self.is_custom_gan else f"Informative Drawings ({self.model_variant})"
            logger.info(f"[OK] ONNX sketch enhancer ready using: {model_type}")
            return True
            
        except Exception as exc:
            logger.error(f"ONNX model load failed: {exc}")
            self._ready = False
            return False

    def enhance(self, image: Image.Image) -> Image.Image:
        """
        Run the loaded ONNX model inference on a PIL Image and return a clean line-art PIL Image.
        """
        if not self._ready or self.session is None:
            raise RuntimeError("ONNX model not loaded. Call load() first.")

        original_size = image.size  # (W, H)

        # 1. Prepare input tensor depending on model type
        if self.is_custom_gan:
            inp_tensor, pad_info = self._preprocess_custom_gan(image)
        else:
            inp_tensor, pad_info = self._preprocess_hf(image)

        # 2. Run inference
        outputs = self.session.run([self._output_name], {self._input_name: inp_tensor})
        raw_output = outputs[0]  # shape: (1, C, H, W) or (1, H, W, C)

        # 3. Post-process back to PIL Image at original size
        if self.is_custom_gan:
            result = self._postprocess_custom_gan(raw_output, original_size, pad_info)
        else:
            result = self._postprocess_hf(raw_output, original_size, pad_info)
            
        return result

    # ------------------------------------------------------------------
    # Pretrained Informative Drawings Pre/Post Processing
    # ------------------------------------------------------------------

    def _ensure_hf_model_downloaded(self):
        """Download the Informative Drawings model if it doesn't exist in the checkpoints dir."""
        if self.hf_model_path.exists():
            logger.info(f"Using cached Informative Drawings model: {self.hf_model_path}")
            return

        self.model_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Downloading Informative Drawings model from {self.model_url} ...")
        logger.info(f"  Saving to: {self.hf_model_path}")

        try:
            urllib.request.urlretrieve(self.model_url, str(self.hf_model_path))
            size_mb = self.hf_model_path.stat().st_size / (1024 * 1024)
            logger.info(f"  Downloaded: {size_mb:.1f} MB")
        except Exception as exc:
            if self.hf_model_path.exists():
                self.hf_model_path.unlink()
            raise RuntimeError(f"Failed to download Informative Drawings model: {exc}") from exc

    def _preprocess_hf(self, image: Image.Image) -> Tuple[np.ndarray, dict]:
        """
        Resize + pad to HF_INPUT_SIZE (512), normalize to [0, 1], return NCHW tensor.
        """
        if image.mode != "RGB":
            image = image.convert("RGB")

        orig_w, orig_h = image.size

        # Resize so the longer side = HF_INPUT_SIZE
        scale = HF_INPUT_SIZE / max(orig_w, orig_h)
        new_w = int(orig_w * scale)
        new_h = int(orig_h * scale)
        resized = image.resize((new_w, new_h), Image.Resampling.LANCZOS)

        # Pad to square (512x512) with white background
        canvas = Image.new("RGB", (HF_INPUT_SIZE, HF_INPUT_SIZE), (255, 255, 255))
        canvas.paste(resized, (0, 0))

        pad_info = {
            "orig_w": orig_w, "orig_h": orig_h,
            "resize_w": new_w, "resize_h": new_h,
            "pad_right": HF_INPUT_SIZE - new_w,
            "pad_bottom": HF_INPUT_SIZE - new_h,
        }

        # Normalize to [0, 1] float32 NCHW
        arr = np.array(canvas, dtype=np.float32) / 255.0           # (H, W, C)
        arr = np.transpose(arr, (2, 0, 1))                         # (C, H, W)
        arr = np.expand_dims(arr, axis=0)                          # (1, C, H, W)
        return arr, pad_info

    def _postprocess_hf(self, raw: np.ndarray, original_size: Tuple[int, int], pad_info: dict) -> Image.Image:
        """
        Convert Informative Drawings tensor → PIL Image.
        """
        out = raw[0]  # Remove batch dim
        if out.ndim == 3:
            if out.shape[0] in (1, 3):
                out = np.transpose(out, (1, 2, 0))
        elif out.ndim == 2:
            out = out[:, :, np.newaxis]

        if out.shape[2] == 3:
            gray = 0.2126 * out[:, :, 0] + 0.7152 * out[:, :, 1] + 0.0722 * out[:, :, 2]
        else:
            gray = out[:, :, 0]

        gray = np.clip(gray, 0.0, 1.0)
        if gray.mean() < 0.5:
            gray = 1.0 - gray

        pixels = (gray * 255).astype(np.uint8)

        # Crop padding
        rw, rh = pad_info["resize_w"], pad_info["resize_h"]
        pixels = pixels[:rh, :rw]

        # Convert back to original size PIL Image
        pil_gray = Image.fromarray(pixels, mode="L")
        orig_w, orig_h = original_size
        pil_out = pil_gray.resize((orig_w, orig_h), Image.Resampling.LANCZOS)
        return pil_out.convert("RGB")

    # ------------------------------------------------------------------
    # Custom Pix2Pix GAN Pre/Post Processing
    # ------------------------------------------------------------------

    def _preprocess_custom_gan(self, image: Image.Image) -> Tuple[np.ndarray, dict]:
        """
        Resize + pad to CUSTOM_GAN_INPUT_SIZE (256), convert to single channel grayscale,
        normalize to [-1, 1], return NCHW tensor.
        """
        orig_w, orig_h = image.size
        
        # Convert to Grayscale
        gray_img = image.convert("L")
        
        # Scale to maximum 256 dimension, keeping aspect ratio
        scale = CUSTOM_GAN_INPUT_SIZE / max(orig_w, orig_h)
        new_w = int(orig_w * scale)
        new_h = int(orig_h * scale)
        resized = gray_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # Pad to 256x256 with solid white
        canvas = Image.new("L", (CUSTOM_GAN_INPUT_SIZE, CUSTOM_GAN_INPUT_SIZE), 255)
        canvas.paste(resized, (0, 0))
        
        pad_info = {
            "orig_w": orig_w, "orig_h": orig_h,
            "resize_w": new_w, "resize_h": new_h,
            "pad_right": CUSTOM_GAN_INPUT_SIZE - new_w,
            "pad_bottom": CUSTOM_GAN_INPUT_SIZE - new_h,
        }
        
        # Convert to float32 and Normalize from [0, 255] to [-1, 1]
        arr = np.array(canvas, dtype=np.float32)
        arr = (arr / 127.5) - 1.0
        
        # Shape: (1, 1, 256, 256)
        arr = np.expand_dims(arr, axis=0) # Channel dim
        arr = np.expand_dims(arr, axis=0) # Batch dim
        return arr, pad_info

    def _postprocess_custom_gan(self, raw: np.ndarray, original_size: Tuple[int, int], pad_info: dict) -> Image.Image:
        """
        Convert Custom Pix2Pix GAN output tensor [-1, 1] → grayscale clean PIL Image.
        """
        out = raw[0, 0]  # Shape: (256, 256)
        
        # Denormalize: [-1, 1] -> [0, 255]
        out = (out + 1.0) * 127.5
        out = np.clip(out, 0.0, 255.0)
        
        # Clean background if average is dark (invert check)
        if out.mean() < 127.5:
            out = 255.0 - out
            
        pixels = out.astype(np.uint8)
        
        # Crop padding
        rw, rh = pad_info["resize_w"], pad_info["resize_h"]
        pixels = pixels[:rh, :rw]
        
        # Resize to original resolution
        pil_gray = Image.fromarray(pixels, mode="L")
        orig_w, orig_h = original_size
        pil_out = pil_gray.resize((orig_w, orig_h), Image.Resampling.LANCZOS)
        return pil_out.convert("RGB")
