"""
ONNX-based Sketch Enhancement using Informative Drawings model.

Source: https://huggingface.co/rocca/informative-drawings-line-art-onnx
Paper:  "Learning to generate line drawings that convey geometry and semantics"
        (Chan et al., CVPR 2022)

This model converts rough/noisy input sketches into clean, geometric line art.
It runs entirely on CPU via ONNX Runtime — no PyTorch required in production.

Model size: ~17 MB (auto-downloaded from HuggingFace on first use)
Inference:  ~200-600ms on CPU depending on image resolution
"""

import os
import io
import logging
import urllib.request
from pathlib import Path
from typing import Optional, Tuple

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model URLs - two variants from the Informative Drawings project
# ---------------------------------------------------------------------------
MODEL_URLS = {
    # Contour style: clean geometric line art
    "contour": "https://huggingface.co/rocca/informative-drawings-line-art-onnx/resolve/main/model.onnx",
    # Opensketch style: more sketch-like output (fallback)
    "opensketch": "https://huggingface.co/Luoaho/image-to-line-drawing-onnx/resolve/main/line-drawings.onnx",
}

DEFAULT_MODEL = "contour"

# Input resolution that the model was trained on
MODEL_INPUT_SIZE = 512  # pixels on the longer side


class ONNXSketchEnhancer:
    """
    Lightweight CPU sketch enhancer using the pretrained Informative Drawings
    ONNX model. No PyTorch / no GPU required.

    Usage:
        enhancer = ONNXSketchEnhancer(model_dir="/path/to/cache")
        enhancer.load()
        pil_output = enhancer.enhance(pil_input)
    """

    def __init__(self, model_dir: Optional[str] = None, model_variant: str = DEFAULT_MODEL):
        self.model_variant = model_variant if model_variant in MODEL_URLS else DEFAULT_MODEL
        self.model_url = MODEL_URLS[self.model_variant]

        # Where to cache the .onnx file
        if model_dir is None:
            base = Path(__file__).resolve().parent.parent.parent.parent  # ml-backend root
            model_dir = str(base / "checkpoints")
        self.model_dir = Path(model_dir)
        self.model_path = self.model_dir / f"informative_drawings_{self.model_variant}.onnx"

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
            self._ensure_model_downloaded()
            logger.info(f"Loading ONNX model from {self.model_path} ...")
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
            logger.info("[OK] ONNX sketch enhancer ready")
            return True
        except Exception as exc:
            logger.error(f"ONNX model load failed: {exc}")
            self._ready = False
            return False

    def enhance(self, image: Image.Image) -> Image.Image:
        """
        Run the ONNX inference on a PIL Image and return a clean line-art PIL Image.

        The output is always white-background, black-line monochrome image.
        The output is the SAME pixel size as the input (we upscale to the model
        resolution internally and then resize the result back).
        """
        if not self._ready or self.session is None:
            raise RuntimeError("ONNX model not loaded. Call load() first.")

        original_size = image.size  # (W, H)

        # 1. Prepare input tensor
        inp_tensor, pad_info = self._preprocess(image)

        # 2. Run inference
        outputs = self.session.run([self._output_name], {self._input_name: inp_tensor})
        raw_output = outputs[0]  # shape: (1, C, H, W) or (1, H, W, C)

        # 3. Post-process back to PIL Image at original size
        result = self._postprocess(raw_output, original_size, pad_info)
        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _ensure_model_downloaded(self):
        """Download the ONNX model if it doesn't exist in the cache dir."""
        if self.model_path.exists():
            logger.info(f"Using cached ONNX model: {self.model_path}")
            return

        self.model_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Downloading ONNX model from {self.model_url} ...")
        logger.info(f"  Saving to: {self.model_path}")

        try:
            urllib.request.urlretrieve(self.model_url, str(self.model_path))
            size_mb = self.model_path.stat().st_size / (1024 * 1024)
            logger.info(f"  Downloaded: {size_mb:.1f} MB")
        except Exception as exc:
            # Clean up partial file
            if self.model_path.exists():
                self.model_path.unlink()
            raise RuntimeError(f"Failed to download model: {exc}") from exc

    def _preprocess(self, image: Image.Image) -> Tuple[np.ndarray, dict]:
        """
        Resize + pad to MODEL_INPUT_SIZE, normalize to [0, 1], return NCHW tensor.

        Returns:
            tensor: float32 NCHW numpy array of shape (1, 3, H_padded, W_padded)
            pad_info: dict with keys orig_w, orig_h, resize_w, resize_h, pad_right, pad_bottom
        """
        # Convert to RGB if needed
        if image.mode != "RGB":
            image = image.convert("RGB")

        orig_w, orig_h = image.size

        # Resize so the longer side = MODEL_INPUT_SIZE, keeping aspect ratio
        scale = MODEL_INPUT_SIZE / max(orig_w, orig_h)
        new_w = int(orig_w * scale)
        new_h = int(orig_h * scale)
        resized = image.resize((new_w, new_h), Image.Resampling.LANCZOS)

        # Pad to square (MODEL_INPUT_SIZE × MODEL_INPUT_SIZE) with white
        canvas = Image.new("RGB", (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE), (255, 255, 255))
        canvas.paste(resized, (0, 0))

        pad_info = {
            "orig_w": orig_w, "orig_h": orig_h,
            "resize_w": new_w, "resize_h": new_h,
            "pad_right": MODEL_INPUT_SIZE - new_w,
            "pad_bottom": MODEL_INPUT_SIZE - new_h,
        }

        # Normalize to [0, 1] float32 and convert to NCHW
        arr = np.array(canvas, dtype=np.float32) / 255.0           # (H, W, C)
        arr = np.transpose(arr, (2, 0, 1))                         # (C, H, W)
        arr = np.expand_dims(arr, axis=0)                          # (1, C, H, W)
        return arr, pad_info

    def _postprocess(
        self,
        raw: np.ndarray,
        original_size: Tuple[int, int],
        pad_info: dict,
    ) -> Image.Image:
        """
        Convert model output tensor → PIL Image at original_size.

        The model output is either:
          - (1, 1, H, W)  grayscale
          - (1, 3, H, W)  RGB
          - (1, H, W, C)  channels-last (some exports)
        Output values are in [0, 1] (line art) or may need inversion.
        """
        out = raw[0]  # Remove batch dim

        # Handle channels-last vs channels-first
        if out.ndim == 3:
            if out.shape[0] in (1, 3):
                # Channels-first: (C, H, W) → (H, W, C)
                out = np.transpose(out, (1, 2, 0))
            # else: already (H, W, C)
        elif out.ndim == 2:
            out = out[:, :, np.newaxis]

        # Collapse to single grayscale channel
        if out.shape[2] == 3:
            # Luminance from RGB
            gray = 0.2126 * out[:, :, 0] + 0.7152 * out[:, :, 1] + 0.0722 * out[:, :, 2]
        else:
            gray = out[:, :, 0]

        # Clip and scale to [0, 255]
        gray = np.clip(gray, 0.0, 1.0)

        # The informative-drawings model outputs DARK = lines, LIGHT = background
        # Invert if needed so we get: white background, black lines
        if gray.mean() < 0.5:
            # Image is mostly dark → invert
            gray = 1.0 - gray

        pixels = (gray * 255).astype(np.uint8)

        # Crop away the padding before resizing
        rw, rh = pad_info["resize_w"], pad_info["resize_h"]
        pixels = pixels[:rh, :rw]

        # Convert to PIL
        pil_gray = Image.fromarray(pixels, mode="L")

        # Resize back to original input size
        orig_w, orig_h = original_size
        pil_out = pil_gray.resize((orig_w, orig_h), Image.Resampling.LANCZOS)

        # Return as RGB (white bg, black lines)
        return pil_out.convert("RGB")
