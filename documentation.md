# SketchCalibur: Custom ML Architecture Roadmap

This document outlines the step-by-step strategy for migrating SketchCalibur from an API-calling wrapper (using Gemini/OpenAI) to a **True AI/ML platform**. We will build, train, and deploy three distinct machine learning models from scratch, optimized for free-tier deployments (Render, Hugging Face, or On-Device).

---

## 1. Feature: Artistic Sketch-to-Vector (Image-to-Image)
**Objective:** Take a messy, human hand-drawn doodle of *anything* (an apple, a car, a face) and transform it into a clean, professional, artistic line drawing that maps perfectly onto the Excalidraw canvas.

### A. Architecture (Pix2Pix Conditional GAN)
Instead of using massive generic models like Stable Diffusion, we will build a **Pix2Pix GAN** (Generative Adversarial Network) in PyTorch.
*   **Generator (U-Net):** Learns to clean up noise, connect broken strokes, and smooth out curves.
*   **Discriminator:** Evaluates the generator's output against real, professional SVG line-art to ensure it looks "professional."
*   **Post-Processing:** The clean raster output from the GAN is fed into a vectorizer (like Potrace) to extract pure mathematical SVG curves for Excalidraw JSON.

### B. Dataset Strategy (Synthetic Generation)
We do not need to manually draw thousands of pairs.
1.  **Target Data (Clean):** Download open-source SVG line art datasets (e.g., Noun Project, Google QuickDraw cleaned, or TU-Berlin).
2.  **Input Data (Dirty):** Write a Python script to mathematically corrupt the clean SVGs. Apply OpenCV Gaussian noise, break lines using elastic distortions, and simulate shaky hand movements.
3.  **Result:** 100,000 perfect `[Messy Doodle -> Professional Diagram]` pairs.

### C. Training & Execution
*   Train on a free Kaggle T4 GPU for ~24-48 hours.
*   Export the PyTorch model (`.pth`) to **ONNX** format. The final model size will be ~50MB, making it extremely lightweight.

---

## 2. Feature: Mathematical Equation Solver
**Objective:** Identify, read, and solve handwritten mathematical equations directly from the canvas without relying on paid APIs or hallucination-prone generic OCRs.

### A. Architecture (CRNN + CTC)
*   **Feature Extractor:** A lightweight Convolutional Neural Network (e.g., MobileNetV3) to extract visual features from the handwritten math.
*   **Sequence Modeler:** An LSTM (Long Short-Term Memory) network to understand the sequence of characters.
*   **Loss Function:** CTC (Connectionist Temporal Classification) loss, which is the industry standard for handwriting recognition where characters are not perfectly aligned.

### B. Dataset Strategy
1.  **CROHME Dataset:** Utilize the open-source CROHME dataset, which contains tens of thousands of handwritten equations paired with their exact LaTeX strings.
2.  **Synthetic Data:** Use the `sympy` library to generate random complex algebraic equations, render them using 50+ cursive and mathematical fonts, and apply OpenCV distortions (blur, skew, noise) to mimic real canvas handwriting.

### C. Training & Execution
*   Train using PyTorch. The vocabulary will be strictly limited to mathematical symbols (`0-9`, `a-z`, `+`, `-`, `/`, `*`, `=`, `(`, `)`). This constraint makes the model incredibly fast and accurate compared to general OCR.
*   Output string is passed to `sympy` for mathematical solving.

---

## 3. Feature: General Text & Handwriting Detector
**Objective:** Detect and transcribe general handwritten text blocks on the canvas (labels, sticky notes, diagram text) with high accuracy.

### A. Architecture (DBNet + Lightweight Transformer)
*   **Detection:** Use **DBNet (Differentiable Binarization)**. It is highly robust for detecting text bounding boxes in any orientation or curve (common in canvas sketches).
*   **Recognition:** A lightweight Vision Transformer (ViT) or a secondary CRNN to convert the cropped bounding box into text.

### B. Dataset Strategy
*   **IAM Handwriting Database:** The standard dataset for full English sentence handwriting recognition.
*   **SynthText:** Generates synthetic text placed over random backgrounds to teach the model how to read text in noisy environments.

---

## 4. Deployment & Hosting Strategy (Zero/Low Cost)
To host these custom models without paying hundreds of dollars for GPU servers, and to avoid Out-Of-Memory (OOM) crashes on Render's 512MB free tier, we will use the following strategies:

### Option A: In-Browser ML (Recommended - $0 Cost)
The ultimate architectural flex. We export all our trained PyTorch models to **ONNX Web** or **TensorFlow.js**.
*   When a user clicks "Sketch", the model runs directly inside their web browser using WebAssembly and WebGL.
*   **Pros:** Zero server costs, zero API latency, absolute privacy (images never leave the client).

### Option B: Hugging Face Spaces (Backend API)
If the models are too heavy for browser inference, we deploy them on Hugging Face.
*   Hugging Face provides free Docker Spaces with **16GB of RAM and 2 vCPUs**.
*   We wrap our models in a FastAPI container and deploy them there. The Render backend simply forwards the image to the Hugging Face API.

### Option C: ONNX CPU Inference on Render
If we must keep everything in a single backend monolith on Render:
*   We convert all PyTorch models to `.onnx`.
*   ONNX Runtime is heavily optimized for CPU inference and uses a fraction of the RAM that raw PyTorch uses. This prevents Render from crashing while still providing fast inference.
