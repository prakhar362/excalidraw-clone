# SketchCalibur ML Backend

AI-powered sketch enhancement system using computer vision and machine learning.

## Features

- **Intent Classification**: Automatically detects what users draw (sketch, math, handwriting, diagram)
- **Sketch Enhancement**: Makes rough sketches look professional using CV techniques
- **Math Solver**: Recognizes and solves handwritten math equations step-by-step
- **Handwriting Recognition**: Converts handwriting to clean text using TrOCR
- **Vector Conversion**: Returns results as Excalidraw vector elements

## Tech Stack

- **FastAPI**: High-performance API framework
- **PyTorch**: Deep learning framework
- **Transformers**: Pre-trained models (ViT, TrOCR)
- **OpenCV**: Computer vision processing
- **SymPy**: Symbolic mathematics

## Installation

### Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn app.main:app --reload --port 8000
```

### Docker

```bash
# Build image
docker build -t sketchcalibur-ml .

# Run container
docker run -p 8000:8000 sketchcalibur-ml
```

## API Endpoints

### POST /api/ml/process

Process a sketch and return enhanced result.

**Request:**
- `file`: Image file (multipart/form-data)
- `user_prompt`: Optional text prompt
- `force_intent`: Optional intent override

**Response:**
```json
{
  "success": true,
  "intent": "artistic_sketch",
  "confidence": 0.95,
  "result_type": "enhanced_sketch",
  "elements": [...],
  "message": "Sketch enhanced successfully!"
}
```

### POST /api/ml/classify

Classify sketch intent without processing.

**Request:**
- `file`: Image file (multipart/form-data)

**Response:**
```json
{
  "success": true,
  "intent": "mathematical",
  "confidence": 0.87,
  "all_scores": {
    "artistic_sketch": 0.05,
    "mathematical": 0.87,
    "handwriting": 0.03,
    "diagram": 0.03,
    "geometric_shape": 0.02
  }
}
```

### GET /health

Health check endpoint.

## Deployment

### Render

1. Create account on render.com
2. Connect GitHub repo
3. Create new Web Service
4. Use `render.yaml` configuration
5. Deploy

### Environment Variables

- `PORT`: Server port (default: 8000)
- `REDIS_URL`: Redis connection URL (optional)

## Model Details

### Intent Classifier
- **Model**: Google ViT (Vision Transformer)
- **Categories**: artistic_sketch, mathematical, handwriting, diagram, geometric_shape
- **Enhancements**: Custom heuristics for improved accuracy

### Sketch Enhancer
- **Technique**: Classical CV (OpenCV)
- **Features**: Denoising, line enhancement, contrast adjustment
- **Styles**: professional, artistic, clean

### Math Solver
- **Recognition**: Custom symbol detection + template matching
- **Solver**: SymPy symbolic mathematics
- **Output**: Step-by-step solutions with LaTeX

### Handwriting Recognizer
- **Model**: Microsoft TrOCR
- **Input**: Handwritten text images
- **Output**: Clean text strings

## Performance

- **Cold Start**: ~30s (first request loads models)
- **Warm Requests**: <2s average
- **Max Image Size**: 1024x1024px
- **Memory**: ~512MB (optimized for free tier)

## Testing

```bash
# Test with curl
curl -X POST http://localhost:8000/api/ml/process \
  -F "file=@test_sketch.png"

# Test classification
curl -X POST http://localhost:8000/api/ml/classify \
  -F "file=@test_sketch.png"
```

## License

MIT
