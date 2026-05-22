import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    # Server
    HOST = "0.0.0.0"
    PORT = int(os.getenv("PORT", 8000))
    
    # Model settings
    DEVICE = "cpu"
    MAX_IMAGE_SIZE = 1024
    CACHE_TTL = 3600
    
    # Redis (optional)
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # HuggingFace models
    INTENT_MODEL = "google/vit-base-patch16-224"
    HANDWRITING_MODEL = "microsoft/trocr-base-handwritten"
    
    # API Keys
    ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY", "LLL8OBFzk7W505VY9Fem")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    
    # Paths
    BASE_DIR = Path(__file__).parent.parent
    TEMP_DIR = BASE_DIR / "temp"
    TEMP_DIR.mkdir(exist_ok=True)
    
    # ===== SKETCH ENHANCEMENT SETTINGS =====
    
    # Processing limits
    SKETCH_MAX_SIZE = 2048          # Max image dimension (pixels)
    SKETCH_MIN_SIZE = 64            # Min image dimension
    SKETCH_UPSCALE_TARGET = 800     # Target size for processing
    
    # Enhancement quality
    SKETCH_DENOISE_STRENGTH = 10    # Higher = more denoising (5-15)
    SKETCH_EDGE_THRESHOLD_LOW = 50  # Canny edge detection
    SKETCH_EDGE_THRESHOLD_HIGH = 150
    SKETCH_SIMPLIFY_TOLERANCE = 2.0 # Vector simplification (lower = more detail)
    
    # AI Enhancement (ControlNet)
    ENABLE_AI_ENHANCEMENT = os.getenv("ENABLE_AI_ENHANCEMENT", "false").lower() == "true"
    CONTROLNET_MODEL = "lllyasviel/control_v11p_sd15_scribble"
    CONTROLNET_INFERENCE_STEPS = 20  # Lower = faster, higher = better quality
    CONTROLNET_SCALE = 0.8          # Control strength (0.0-1.0)
    
    # Caching
    SKETCH_CACHE_ENABLED = True
    SKETCH_CACHE_TTL = 3600         # 1 hour
    
    # Output formats
    SKETCH_RETURN_PREVIEW = True    # Return base64 preview
    SKETCH_RETURN_VECTORS = True    # Return Excalidraw elements
    SKETCH_PREVIEW_QUALITY = 90     # JPEG quality (1-100)

config = Config()
