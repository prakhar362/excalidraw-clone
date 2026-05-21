# ML Enhancement Plan for SketchCalibur

## Current State Analysis

### ✅ What's Working Well
1. **Math Solver** - Excellent multi-tier approach with Roboflow + Gemini + EasyOCR
2. **Intent Classification** - Fast heuristic-based classification
3. **Basic Handwriting** - TrOCR for simple text recognition

### ❌ What Needs Major Improvement
1. **Sketch Enhancement** - Currently just basic OpenCV filters, not AI-powered
2. **Handwriting to Beautiful Text** - No model for converting messy handwriting to clean, styled text
3. **Vectorization** - Basic contour detection, not intelligent vector conversion
4. **No Design Intelligence** - No AI suggesting layouts, colors, or styling

---

## 🎯 Priority 1: Handwriting to Beautiful Text Conversion (done)

### Problem
Users draw messy handwritten text on canvas → We need to convert it to clean, beautifully formatted text elements with AI-suggested styling.

### Solution: Multi-Model Pipeline

#### Model 1: Text Detection (DBNet) -done
**Purpose:** Detect all text regions in the canvas
- **Model:** `DBNet` (Differentiable Binarization Network)
- **Pretrained:** `dbnet_resnet18` from PaddleOCR or MMOCRv1.0
- **Size:** ~25MB
- **Speed:** 50ms on CPU
- **Output:** Bounding boxes for each text region

```python
# Implementation
from paddleocr import PaddleOCR
ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)
result = ocr.ocr(image, cls=True)
```

#### Model 2: Handwriting Recognition (TrOCR-Large) -done 
**Purpose:** Convert handwritten text to digital text
- **Current:** TrOCR-small-handwritten (limited accuracy)
- **Upgrade to:** `microsoft/trocr-large-handwritten`
- **Alternative:** `google/pix2struct-base` (better for messy handwriting)
- **Size:** ~300MB (but much better accuracy)
- **Speed:** 200ms per text region

```python
from transformers import TrOCRProcessor, VisionEncoderDecoderModel

processor = TrOCRProcessor.from_pretrained('microsoft/trocr-large-handwritten')
model = VisionEncoderDecoderModel.from_pretrained('microsoft/trocr-large-handwritten')
```

#### Model 3: Text Styling AI (GPT-2 Fine-tuned)
**Purpose:** Suggest font size, color, alignment based on context
- **Model:** Fine-tuned GPT-2 Small on design rules
- **Input:** Recognized text + canvas context
- **Output:** JSON with styling suggestions

```json
{
  "text": "Project Timeline",
  "fontSize": 32,
  "fontFamily": 1,
  "strokeColor": "#1971c2",
  "fontWeight": "bold",
  "textAlign": "center",
  "isTitle": true
}
```

---

## 🎯 Priority 2: Sketch to Professional Vector (Pix2Pix GAN)

### Problem
Messy doodles need to become clean, professional line art that looks intentional.

### Solution: Conditional GAN + Vectorization

#### Model: Pix2Pix GAN
**Architecture:**
- **Generator:** U-Net with skip connections
- **Discriminator:** PatchGAN
- **Training:** Paired dataset of messy → clean sketches

**Dataset Creation:**
1. Download clean SVG line art (QuickDraw, Noun Project)
2. Synthetically corrupt them:
   - Add Gaussian noise
   - Apply elastic distortion
   - Simulate shaky hand movements
   - Random line breaks

```python
# Synthetic corruption script
import cv2
import numpy as np
from scipy.ndimage import gaussian_filter

def corrupt_sketch(clean_image):
    # Add noise
    noise = np.random.normal(0, 15, clean_image.shape)
    noisy = np.clip(clean_image + noise, 0, 255).astype(np.uint8)
    
    # Elastic distortion
    distorted = elastic_transform(noisy, alpha=30, sigma=5)
    
    # Random line breaks
    broken = random_line_breaks(distorted, break_prob=0.1)
    
    return broken
```

**Training:**
- Platform: Kaggle (free T4 GPU)
- Duration: 24-48 hours
- Dataset size: 50,000 pairs
- Final model: ~50MB ONNX

**Inference:**
```python
import onnxruntime as ort

session = ort.InferenceSession("sketch_enhancer.onnx")
clean_sketch = session.run(None, {"input": messy_sketch})[0]
```

#### Vectorization: Potrace + Simplification
After GAN enhancement, convert raster to vector:

```python
import potrace
import numpy as np

def raster_to_vector(image):
    # Convert to bitmap
    bitmap = potrace.Bitmap(image)
    
    # Trace paths
    path = bitmap.trace()
    
    # Simplify curves
    simplified = simplify_path(path, tolerance=2.0)
    
    # Convert to Excalidraw elements
    return path_to_excalidraw(simplified)
```

---

## 🎯 Priority 3: Intelligent Layout & Design Suggestions

### Problem
Users create elements but don't know how to arrange them beautifully.

### Solution: Layout Optimization AI

#### Model: Graph Neural Network (GNN)
**Purpose:** Analyze canvas elements and suggest optimal layout

**Input:**
- Element positions, sizes, types
- Relationships (arrows, groupings)
- Canvas dimensions

**Output:**
- Suggested positions (grid-aligned)
- Color palette recommendations
- Spacing improvements
- Grouping suggestions

```python
# Example output
{
  "layout_suggestions": [
    {
      "element_id": "abc123",
      "suggested_x": 100,
      "suggested_y": 200,
      "reason": "Align with grid"
    }
  ],
  "color_palette": ["#1971c2", "#f03e3e", "#37b24d"],
  "spacing": {
    "horizontal": 50,
    "vertical": 80
  }
}
```

---

## 📦 Recommended Model Stack

### Core Models (Must Have)

| Model | Purpose | Size | Speed | Priority |
|-------|---------|------|-------|----------|
| **PaddleOCR DBNet** | Text detection | 25MB | 50ms | HIGH |
| **TrOCR-Large** | Handwriting recognition | 300MB | 200ms | HIGH |
| **Pix2Pix GAN (ONNX)** | Sketch enhancement | 50MB | 300ms | HIGH |
| **Potrace** | Vectorization | 5MB | 100ms | MEDIUM |
| **LayoutGNN** | Layout suggestions | 20MB | 150ms | MEDIUM |

### Alternative Models (Lighter Options)

| Model | Purpose | Size | Speed | Trade-off |
|-------|---------|------|-------|-----------|
| **EasyOCR** | Text detection | 50MB | 100ms | Less accurate |
| **TrOCR-Base** | Handwriting | 100MB | 100ms | Lower accuracy |
| **CycleGAN** | Sketch enhancement | 45MB | 250ms | Different style |

---

## 🚀 Implementation Roadmap

### Phase 1: Handwriting Enhancement (Week 1-2)

**Step 1:** Integrate PaddleOCR for text detection
```bash
pip install paddlepaddle paddleocr
```

**Step 2:** Upgrade to TrOCR-Large
```python
# ml-backend/app/models/handwriting_recognizer.py
MODEL_NAME = "microsoft/trocr-large-handwritten"
```

**Step 3:** Add text styling AI
```python
# New file: ml-backend/app/models/text_styler.py
class TextStyler:
    def suggest_style(self, text, context):
        # Analyze text content
        is_title = self._is_title(text)
        is_label = self._is_label(text)
        
        # Suggest styling
        return {
            "fontSize": 32 if is_title else 20,
            "strokeColor": "#1971c2" if is_title else "#000000",
            "fontWeight": "bold" if is_title else "normal"
        }
```

**Step 4:** Update vectorizer to use AI styling
```python
# ml-backend/app/models/vectorizer.py
def text_to_excalidraw_with_ai(self, text, image_dims, context):
    # Get AI styling suggestions
    style = self.text_styler.suggest_style(text, context)
    
    # Create element with AI styling
    return {
        "type": "text",
        "text": text,
        **style
    }
```

### Phase 2: Sketch Enhancement GAN (Week 3-4)

**Step 1:** Create synthetic dataset
```python
# scripts/create_sketch_dataset.py
from quickdraw import QuickDrawData

qd = QuickDrawData()
for category in ['apple', 'car', 'face', 'house']:
    clean_sketches = qd.get_drawing(category, recognized=True)
    for sketch in clean_sketches[:10000]:
        messy = corrupt_sketch(sketch)
        save_pair(messy, sketch, f"data/{category}/")
```

**Step 2:** Train Pix2Pix on Kaggle
```python
# train_pix2pix.py
import torch
from models import Generator, Discriminator

generator = Generator()
discriminator = Discriminator()

# Train for 100 epochs
for epoch in range(100):
    for messy, clean in dataloader:
        # GAN training loop
        ...
```

**Step 3:** Export to ONNX
```python
torch.onnx.export(
    generator,
    dummy_input,
    "sketch_enhancer.onnx",
    opset_version=14
)
```

**Step 4:** Integrate into backend
```python
# ml-backend/app/models/sketch_enhancer.py
import onnxruntime as ort

class SketchEnhancer:
    def __init__(self):
        self.session = ort.InferenceSession("models/sketch_enhancer.onnx")
    
    def enhance(self, image):
        # Preprocess
        input_tensor = self.preprocess(image)
        
        # Run inference
        output = self.session.run(None, {"input": input_tensor})[0]
        
        # Postprocess
        return self.postprocess(output)
```

### Phase 3: Layout Intelligence (Week 5-6)

**Step 1:** Collect canvas layout data
```python
# Analyze existing canvases to learn patterns
def analyze_canvas(elements):
    return {
        "grid_alignment": calculate_grid_score(elements),
        "spacing_consistency": calculate_spacing_score(elements),
        "color_harmony": calculate_color_score(elements)
    }
```

**Step 2:** Train layout GNN
```python
# Use PyTorch Geometric
from torch_geometric.nn import GCNConv

class LayoutGNN(torch.nn.Module):
    def __init__(self):
        self.conv1 = GCNConv(in_channels=10, out_channels=64)
        self.conv2 = GCNConv(64, 32)
        self.fc = torch.nn.Linear(32, 2)  # x, y coordinates
```

**Step 3:** Integrate suggestions
```python
# New endpoint: /api/ml/suggest-layout
@app.post("/api/ml/suggest-layout")
async def suggest_layout(elements: List[Dict]):
    suggestions = layout_gnn.suggest(elements)
    return {"suggestions": suggestions}
```

---

## 💾 Deployment Strategy

### Option 1: Hugging Face Spaces (Recommended)
- Deploy heavy models (TrOCR-Large, Pix2Pix) on HF Spaces
- 16GB RAM, free tier
- FastAPI wrapper

```yaml
# spaces/app.py
from fastapi import FastAPI
app = FastAPI()

@app.post("/enhance")
async def enhance(image: UploadFile):
    enhanced = sketch_enhancer.enhance(image)
    return {"enhanced": enhanced}
```

### Option 2: ONNX on Render
- Convert all models to ONNX
- CPU-optimized inference
- Fits in 512MB RAM

```python
# Use ONNX Runtime with optimizations
session_options = ort.SessionOptions()
session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
session = ort.InferenceSession("model.onnx", session_options)
```

### Option 3: Browser-Based (TensorFlow.js)
- Convert models to TF.js format
- Run in user's browser
- Zero server cost

```javascript
// frontend/lib/mlBrowser.ts
import * as tf from '@tensorflow/tfjs';

const model = await tf.loadGraphModel('/models/sketch_enhancer/model.json');
const enhanced = model.predict(inputTensor);
```

---

## 📊 Expected Results

### Before Enhancement
- Messy handwriting: "Project Timeline" (shaky, uneven)
- Rough sketch: Jagged lines, broken strokes
- No styling: All black, same font size

### After Enhancement
- Clean text: "Project Timeline" (smooth, professional)
  - Font size: 32px (AI detected it's a title)
  - Color: #1971c2 (AI suggested blue for headers)
  - Alignment: Center
- Professional sketch: Smooth curves, connected lines
- Intelligent layout: Grid-aligned, proper spacing

---

## 🔧 Quick Start Implementation

### Immediate Improvements (This Week)

1. **Upgrade TrOCR:**
```bash
# In requirements.txt, models will auto-download
# No code change needed, just update model name
```

2. **Add PaddleOCR:**
```bash
pip install paddlepaddle paddleocr
```

3. **Implement Text Styling Heuristics:**
```python
def suggest_text_style(text):
    # Simple rules-based system
    if len(text) < 20 and text[0].isupper():
        return {"fontSize": 32, "strokeColor": "#1971c2"}
    return {"fontSize": 20, "strokeColor": "#000000"}
```

### Next Month

1. Train Pix2Pix GAN on Kaggle
2. Deploy to Hugging Face Spaces
3. Integrate layout suggestions

---

## 📈 Success Metrics

- **Handwriting Recognition Accuracy:** >95% (up from ~70%)
- **Sketch Enhancement Quality:** Professional-looking output
- **Text Styling:** AI-suggested styles in 100% of cases
- **Layout Suggestions:** Improve canvas aesthetics by 80%
- **Performance:** <2 seconds total processing time

---

## 🎓 Training Resources

### Datasets
- **QuickDraw:** 50M sketches, 345 categories
- **IAM Handwriting:** 115K handwritten words
- **SynthText:** Synthetic text in images
- **Noun Project:** 5M+ SVG icons

### Training Platforms
- **Kaggle:** Free T4 GPU, 30hrs/week
- **Google Colab:** Free T4 GPU, limited time
- **Hugging Face:** Free training on Spaces

### Model Repositories
- **Hugging Face Hub:** Pre-trained transformers
- **ONNX Model Zoo:** Optimized models
- **PyTorch Hub:** Research models

---

## 💡 Next Steps

1. **Review this plan** - Confirm priorities
2. **Set up training environment** - Kaggle account
3. **Start with Phase 1** - Handwriting enhancement
4. **Iterate based on results** - Measure accuracy improvements

Ready to implement? Let's start with Phase 1! 🚀
