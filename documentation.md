# SketchCalibur: Comprehensive Machine Learning Implementation Record

This document records the final, production-ready machine learning system design, deep learning model architectures, mathematical stroke transformations, and full-stack engineering optimizations built for the SketchCalibur interactive collaboration platform. 

---

## 1. Deep Learning handwriting Recognition Module (OCR)

### Objective
Accurately translate hand-drawn, cursive, and printed handwriting from the infinite Excalidraw canvas into beautifully formatted digital text nodes.

### Structural Evolution & Architecture Decisions

#### The CRAFT + TrOCR Failure (V1 - Local Ensemble)
* **Design**: Used the CRAFT (Character Region Awareness for Text Detection) deep network to extract text bounding boxes, passing each cropped region to a local Microsoft TrOCR-small model for transcription.
* **Failure Modes**:
  1. **Character Fragmentation**: Cursive words often contain faint visual gaps. CRAFT treated these minor spacing gaps as character boundaries, splitting single words into fragmented shards (e.g. "collaboration" → "col", "labor", "ation"). Transcribing these segments in isolation produced gibberish.
  2. **Memory Overrun (OOM)**: Importing standard PyTorch, Hugging Face transformers, and local TrOCR models pushed server resident memory to ~800 MB on startup, violating the 512 MB physical memory boundaries of free-tier cloud containers and causing continuous server restarts.

#### Decoupled Vision-Language VLM Spaces Architecture (Current) ✅
* **The Solution**: Decoupled the high-performance inference engine to a dedicated Docker microservice running **PaddleOCR-VL-1.5** (a **1.92 GB Vision-Language Model**).
* **VLM Reasoning**: Rather than matching pixel shapes blindly, the VLM utilizes its inner language context to decode words holistically. If a cursive loop is visually ambiguous (resembling either a cursive "u" or an "a"), the model evaluates the sentence context to output the correct word (e.g. "beautiful" vs "beautiffl").
* **Implementation Details**:
  * The frontend extracts the selected canvas drawing area as a single, high-resolution PNG blob.
  * The backend FastAPI server acts as a clean HTTP router, transmitting the image payload to the warm microservice container.
  * **Precision Emulation Bug Resolution**: During CPU testing, the model predicted incorrect characters (e.g., "Lia" instead of "Mia") due to rounding errors in half-precision float arithmetic. We resolved this by forcing strict 32-bit float evaluation (`torch_dtype` removed, defaulting to float32) and setting deterministic generation variables (`do_sample=False`, `temperature=0.0`).

---

## 2. Multi-Tier Math Solver & Symbolic Solver Engine

### Objective
Parse complex handwritten mathematical formulas, equations, and expressions, returning symbolic algebraic expansions, factorizations, or numeric solutions.

### The 4-Tier Vision Pipeline

To ensure robust solving across varied handwriting styles and connections, we built a 4-tier processing hierarchy:

```
            ┌──────────────────────────────────────────────┐
            │            Selected Math Strokes             │
            └──────────────────────┬───────────────────────┘
                                   │
                                   ▼
            ┌──────────────────────────────────────────────┐
            │      Tier 0: Roboflow Object Detection       │
            │   - Instantly matches standard symbols       │
            └──────────────────────┬───────────────────────┘
                                   │ (If parse fails)
                                   ▼
            ┌──────────────────────────────────────────────┐
            │       Tier 1: Multi-Modal Vision Parser      │
            │   - Transcribes fractions, powers, scripts   │
            └──────────────────────┬───────────────────────┘
                                   │ (If offline/network fail)
                                   ▼
            ┌──────────────────────────────────────────────┐
            │         Tier 2: EasyOCR Local CRNN           │
            │   - Standard horizontal text extraction      │
            └──────────────────────┬───────────────────────┘
                                   │ (Last resort fallback)
                                   ▼
            ┌──────────────────────────────────────────────┐
            │        Tier 3: OpenCV Contour segmenter      │
            │   - Breaks shapes, segments operators        │
            └──────────────────────┬───────────────────────┘
                                   │
                                   ▼
            ┌──────────────────────────────────────────────┐
            │           SymPy Symbolic Engine              │
            │   - Resolves algebra, solves variables       │
            │   - Renders beautiful LaTeX outputs          │
            └──────────────────────────────────────────────┘
```

### Core Solving Heuristics
Once an equation string is successfully parsed by a tier, the **SymPy Symbolic Solver** acts as the mathematics engine:
1. **Sanitization**: Standardizes operators (e.g. replacing cross symbols "×" with `*` and division bars "÷" with `/`).
2. **Variable Identification**: Parses lowercase letters (`x`, `y`, `z`) as symbols:
   ```python
   x, y, z = sympy.symbols('x y z')
   ```
3. **Symbolic Evaluation**: Attempts to solve algebraic equations (`sympy.solve(expr, x)`) or expand/factorize arithmetic polynomials, generating clean Excalidraw-styled text boxes displaying the solution steps.

---

## 3. Hybrid Sketch Enhancement & Vectorization Engine

### Core Neural & CV Processing Hierarchy

The enhancement modal utilizes three distinct strategies, allowing the user to select the appropriate level of dynamic AI involvement:

1. **Informative Drawings ONNX Line-Art Model**: An offline convolutional network model (~17 MB) loaded inside `onnxruntime`. It performs structural edge-enhancement directly on the CPU in **<400ms**, extracting thin, crisp lines from messy pencil-like sketches.
2. **Custom Pix2Pix GAN (Generative Adversarial Network)**: A deep learning network consisting of a **U-Net Generator** with skip-connections (preserving absolute stroke positioning) and a **PatchGAN Discriminator**. Trained to clean messy sketches by snapping them into perfect outlines.
3. **Advanced OpenCV Computer Vision Pipeline**:
   * **Bilateral Filter**: Smooths flat areas while preserving edges:
     $$I^{\text{filtered}}(x) = \frac{1}{W_p} \sum_{x_i \in \Omega} I(x_i) f_r(\|I(x_i) - I(x)\|) g_s(\|x_i - x\|)$$
   * **Adaptive Thresholding**: Separates stroke foreground from variable shadow noise:
     $$\text{dst}(x,y) = \begin{cases} \text{maxValue} & \text{if } \text{src}(x,y) > T(x,y) \\ 0 & \text{otherwise} \end{cases}$$
   * **Morphological Closing**: Bridges tiny gaps in strokes using a rectangular structural kernel.

### The Raster-to-Vector Mathematical Engine

After drawing lines are cleaned, the raster image must be converted back to structured vector lines using our **Unified Vectorizer**:

1. **Clean Envelope Extraction**: Employs `RETR_EXTERNAL` contour extraction. This isolates only the outer border of black lines, bypassing inner paths to avoid the **double-outline rendering bug** on the canvas.
2. **Adaptive Douglas-Peucker Polygon Approximation**: Recursively simplifies the contour to minimize Excalidraw element node count. The tolerance $\epsilon$ scales dynamically with the arc length:
   $$\epsilon = 0.008 \times \text{ArcLength}(\text{Contour}, \text{isClosed}=\text{True})$$
   $$\text{Simplified Contour} = \text{approxPolyDP}(\text{Contour}, \epsilon, \text{isClosed}=\text{True})$$
3. **Absolute-to-Relative Projection**: Offsets simplified absolute coordinates to relative bounding box values:
   $$\text{Point}_{\text{normalized}} = [x_i - \min(x), \ y_i - \min(y)]$$
   This fits perfectly with Excalidraw schemas, enabling fluent rotation and resizing.

---

## 4. Architectural Case Studies & Optimizations

### Case Study A: The CORS-Proof SVG Asset Pipeline (Cloudinary Resolution)
* **The Bottleneck**: Users selecting an SVG vector asset from Cloudinary to enhance encountered crash states. The backend threw `cannot identify image file` because Python Pillow cannot parse XML-based SVG files. Additionally, fetching the URL directly in the browser failed due to domain CORS boundary blocks.
* **The Resolution**: Built a client-side vector-to-raster canvas conversion pipeline inside `CanvasUtils.ts`:
  1. Detect if the selection is a single SVG URL. If so, intercept standard file processing.
  2. Create an in-memory browser `Image` element with `crossOrigin = "anonymous"`.
  3. Load the SVG URL and paint it onto a hidden, temporary HTML5 `<canvas>` over a solid white background to preserve stroke outlines.
  4. Call `canvas.toBlob(...)` to export the rasterized canvas as a standard `image/png` blob.
  5. The frontend uploads this standard PNG binary file to the backend. The backend successfully parses the PNG image, executing ONNX/OpenCV contours without any server-side SVG libraries or crashes.

### Case Study B: Collaborative Interactivity Lag Mitigation (React Rendering Lag)
* **The Bottleneck**: The elements layers panel (`ElementsNavigator.tsx`) polled the active canvas every 800ms to build the layers sidebar. In complex collaboration sessions with hundreds of strokes, this triggered constant React state updates and page-wide re-renders, causing major drawing stutters and input lag.
* **The Resolution**: Implemented two massive performance optimizations:
  1. **Adaptive Polling Intervals**: The polling thread checks drawer visibility. If the panel is closed, the polling rate throttles down from 500ms to **3000ms**, reducing background CPU calculations by **83%**.
  2. **Smart Delta Checking**: Implemented a structural signature check on the element array before calling `setElements`:
     $$\text{isChanged} = \sum_{i} \left[ \text{id}_i \neq \text{prev\_id}_i \lor x_i \neq \text{prev\_x}_i \lor y_i \neq \text{prev\_y}_i \lor W_i \neq \text{prev\_W}_i \lor H_i \neq \text{prev\_H}_i \right]$$
     If no values have changed, React re-renders are completely skipped. Drawing remains smooth and responsive at 60fps.

---

## 5. Deployed Service Specifications

| Microservice | Platform | Allocated Memory | Cost | Warm Status |
|---|---|---|---|---|
| **FastAPI Core Router** | Render | ~120 MB | $0 | Always Active |
| **PaddleOCR VLM Space** | Hugging Face Docker | ~2 GB | $0 | Stands warm, sleeps after 48h |
| **Symbolic Bounding Detector** | Roboflow API | Serverless | $0 | Instant response |

Total Infrastructure Cost: **$0/month**. Optimized for robust performance and zero-cost scaling.
