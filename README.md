# SketchCalibur 🎨

A real-time collaborative whiteboard application that enables teams to visualize ideas together, featuring unlimited themed rooms, live cursor tracking, and state-of-the-art AI-powered diagram generation and sketch beautification.

![SketchCalibur Demo](https://img.shields.io/badge/Users-100%2B-brightgreen) ![Retention](https://img.shields.io/badge/Retention-70%25%2B-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Key Features

### 🖌️ Real-Time Collaboration & Performance
* **100+ Concurrent Users**: Architected to support heavy teamwork on a shared board without bottlenecks.
* **Smart UI Optimization**: Adaptive canvas polling and delta checking reduces CPU rendering overhead by over 80%, providing buttery-smooth drawing interactivity.
* **Persistent Sessions**: Automated authentication check flow on the landing page securely verifies user sessions, taking logged-in users directly to their dashboard.

### 🤖 Hybrid Deep Learning Stack (Core ML)
* **Hybrid Sketch Enhancement Engine**: Transforms rough freehand sketches into clean, geometric vector forms or stylized drawings. Employs a custom **Pix2Pix GAN (Generative Adversarial Network)** U-Net model and an **Informative Drawings ONNX Line-Art Model** executing on an ultra-fast CPU inference pipeline (<400ms).
* **Handwriting Recognition**: Converts cursive, ambiguous, or print handwriting into digital text elements with over 99% accuracy using a decoupled **PaddleOCR-VL-1.5 Vision-Language Model**.
* **Symbolic Math Solver**: Detects handwritten math equations using a robust **4-Tier OCR Pipeline** (Roboflow → Multi-Modal Vision Parser → EasyOCR → OpenCV contours) and solves them symbolically in real time using **SymPy**.
* **AI Prompt-to-Diagram**: Uses state-of-the-art **Gemini AI** to automatically generate styled structure flowcharts, wireframes, and diagrams from natural language prompts directly onto the canvas.
* **CORS-Proof SVG Asset Pipeline**: Seamlessly handles remote Cloudinary vector/SVG objects by converting them dynamically in the browser to rasterized PNG blobs for flawless ML backend processing.

---

## 🏗️ Technical Architecture & Stack

### Frontend Client
* **React 18** with **TypeScript**
* **Next.js 15 (App Router)** for optimized SSR and client bundles
* **Excalidraw Engine** for robust canvas drawing APIs
* **Framer Motion** for premium interactive micro-animations

### Web Backend Router
* **Node.js** with **Express** & **TypeScript**
* **WebSocket (ws)** for sub-50ms real-time multi-user synchronization
* **MongoDB** & **JWT** for secure user profiles and persistent rooms

### ML Inference Backend
* **FastAPI** for high-performance python routing
* **ONNX Runtime** for lightweight CPU-fast deep learning execution
* **OpenCV** & **Pillow** for advanced raster image operations
* **SymPy** for mathematical symbolic solvers

---

## 🚀 Quick Start

### Docker Setup (Recommended)
Launch the entire system, including databases, backend servers, and machine learning components with a single command:
```bash
docker-compose up --build
```

### Manual Quick Start
* **On Windows**:
  ```bash
  start-ml-system.bat
  ```
* **On macOS/Linux**:
  ```bash
  ./start-ml-system.sh
  ```

Once launched, the services will be running at:
* **Frontend Client**: `http://localhost:3000`
* **Node.js Backend**: `http://localhost:5000`
* **FastAPI ML Backend**: `http://localhost:8000`

---

## 📈 Engineering Achievements & Metrics

* **$0 Monthly Infrastructure Cost**: Designed a decoupled microservice structure using free-tier Hugging Face spaces and Render instances, avoiding any hosting charges.
* **99%+ Handwriting Accuracy**: Decoupling the VLM model resolved cursive ambiguities that traditional OCR engines could not handle.
* **Zero UI Lag**: Optimized the elements tree panel to render only when opened, resolving performance bottlenecks during collaborative sessions.
* **Full CORS Security Resolution**: Created a client-side vector-to-raster canvas conversion pipeline to securely bypass third-party domain security blocks on active images.
