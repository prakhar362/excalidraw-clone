# ML Enhancement Plan — SketchCalibur

## Current Status

| Feature | Status | Approach |
|---|---|---|
| Handwriting → Text | ✅ Done | HF PaddleOCR-VL-1.5 microservice |
| Math Solver | ✅ Done | Roboflow → Gemini → EasyOCR → SymPy |
| Sketch Enhancement | ✅ Done (CV) | Advanced OpenCV pipeline |
| AI Text Styling | ✅ Done | Rules-based heuristics |
| Sketch Enhancement (GAN) | ⏳ Planned | Pix2Pix U-Net, train on Kaggle |
| Layout Optimization | ⏳ Planned | GNN on canvas element graph |

---

## What We Built vs What Was Planned

### Handwriting Recognition

**Original plan:** DBNet detection + TrOCR-Large recognition, both running locally on Render.

**What actually happened:**
- TrOCR-small hallucinated on cursive. TrOCR-large OOM'd Render's 512 MB.
- EasyOCR fragmented words into per-character bounding boxes, breaking recognition.
- PaddleOCR local install crashed Render (Python version incompatibility + RAM).
- **Final solution:** Decoupled the heavy model to Hugging Face Spaces. Render becomes a zero-ML HTTP router. HF hosts PaddleOCR-VL-1.5 (1.92 GB VLM) with 16 GB RAM free tier.

**Why this is better than the original plan:**
- VLMs use language context to disambiguate ambiguous cursive (e.g. "M" vs "L") — pure OCR models cannot do this.
- Render RAM dropped from ~800 MB (OOM) to ~120 MB (stable).
- Accuracy: >99% on isolated words vs ~70% with TrOCR-small.
- Cost: $0 (HF free tier has more RAM than Render paid tier).

### Math Solver

**Original plan:** YOLOv8 Nano on Roboflow for symbol detection, SymPy for solving.

**What actually happened:** Implemented as planned, plus added Gemini Vision and EasyOCR as fallback tiers. The multi-tier approach makes it robust to network failures and varied handwriting styles.

### Sketch Enhancement

**Original plan:** Pix2Pix GAN trained on QuickDraw, exported to ONNX.

**What actually happened:** Built a production-quality OpenCV pipeline first (ships now, zero training required). GAN training is the next step — dataset creation scripts are ready.

---

## Next Steps

### Priority 1 — Pix2Pix GAN for Sketch Enhancement

1. Generate 50K training pairs using the corruption script (Gaussian noise + elastic distortion on QuickDraw SVGs)
2. Train U-Net generator + PatchGAN discriminator on Kaggle T4 GPU (~24 hrs)
3. Export to ONNX (~50 MB) — no PyTorch needed at inference
4. Drop into `sketch_enhancer.py` via `onnxruntime`

### Priority 2 — Multi-line Handwriting

The current HF endpoint reads one text block per request. For canvases with multiple separate text regions, we need to:
1. Detect regions with a lightweight detector (OpenCV morphology — no extra packages)
2. Send each region crop to HF separately
3. Merge results back with correct canvas coordinates

### Priority 3 — Layout Optimization GNN

Analyze element positions/sizes/types as a graph, suggest grid alignment, consistent spacing, and color harmony. Train on a dataset of well-designed diagrams.
