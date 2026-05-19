import os
from pathlib import Path

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
    
    # Paths
    BASE_DIR = Path(__file__).parent.parent
    TEMP_DIR = BASE_DIR / "temp"
    TEMP_DIR.mkdir(exist_ok=True)

config = Config()
