from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import io
from PIL import Image
import traceback
from typing import Optional, List

from app.models.core import IntentClassifier
from app.models.sketch_enhancement import SketchEnhancer, Vectorizer
from app.models.sketch_enhancer_v2 import SketchEnhancerV2, EnhancementStyle
from app.models.vectorizer_v2 import VectorizerV2
from app.models.math_solving import MathSolver
from app.models.text_conversion import HandwritingRecognizer, TextStyler
from app.config import config

app = FastAPI(title="SketchCalibur ML API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Singletons ────────────────────────────────────────────────────────────────
intent_classifier:      Optional[IntentClassifier]      = None
sketch_enhancer:        Optional[SketchEnhancer]        = None
sketch_enhancer_v2:     Optional[SketchEnhancerV2]      = None
math_solver:            Optional[MathSolver]            = None
handwriting_recognizer: Optional[HandwritingRecognizer] = None
vectorizer:             Optional[Vectorizer]            = None
vectorizer_v2:          Optional[VectorizerV2]          = None
text_styler:            Optional[TextStyler]            = None


@app.on_event("startup")
async def load_models():
    global intent_classifier, sketch_enhancer, sketch_enhancer_v2, math_solver
    global handwriting_recognizer, vectorizer, vectorizer_v2, text_styler

    print("Loading ML models...")
    intent_classifier      = IntentClassifier()
    sketch_enhancer        = SketchEnhancer()
    sketch_enhancer_v2     = SketchEnhancerV2()
    vectorizer             = Vectorizer()
    vectorizer_v2          = VectorizerV2()
    handwriting_recognizer = HandwritingRecognizer()
    math_solver            = MathSolver()
    text_styler            = TextStyler()
    print("All models loaded successfully!")

    # ── Warm up the HuggingFace Space so the first user request is fast ──
    # Runs in the background — does not block startup or delay port binding.
    import asyncio
    asyncio.create_task(_warmup_hf())


async def _warmup_hf():
    """
    Ping the HuggingFace Space root endpoint in the background at startup.
    This wakes the container and loads the 1.92 GB model into RAM so the
    first real user request doesn't have to wait 2 minutes.
    """
    import asyncio
    import requests as _req

    hf_root = handwriting_recognizer.HF_API_URL.replace("/predict", "/")
    print(f"[WARMUP] Warming up HuggingFace Space: {hf_root}")

    for attempt in range(1, 4):          # up to 3 pings, 30s apart
        try:
            resp = _req.get(hf_root, timeout=60)
            if resp.status_code < 500:
                print(f"[OK] HuggingFace Space is warm (status {resp.status_code})")
                return
            print(f"   Ping {attempt}: status {resp.status_code}, retrying…")
        except Exception as e:
            print(f"   Ping {attempt} failed: {e}, retrying…")

        await asyncio.sleep(30)

    print("[WARN] HuggingFace Space did not respond to warm-up pings — "
          "first text request may be slow.")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _read_image(contents: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(contents)).convert('RGB')
    if max(image.size) > config.MAX_IMAGE_SIZE:
        image.thumbnail((config.MAX_IMAGE_SIZE, config.MAX_IMAGE_SIZE))
    return image


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "SketchCalibur ML API v2", "status": "running"}


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "models_loaded": all([
            intent_classifier, sketch_enhancer,
            math_solver, handwriting_recognizer, vectorizer,
        ]),
    }


# ── 1. Auto-Enhance  (intent classifier → route) ─────────────────────────────

@app.post("/api/ml/enhance")
async def auto_enhance(file: UploadFile = File(...)):
    """
    Clicked when user presses 'Auto Enhance'.
    Runs intent classifier then routes to the right model automatically.
    """
    try:
        image = _read_image(await file.read())
        intent_result = intent_classifier.classify(image)
        intent = intent_result["intent"]

        if intent == "mathematical":
            return await _solve_math_image(image, intent_result)

        if intent == "handwriting":
            return await _recognize_text_image(image, intent_result)

        # artistic_sketch / diagram / geometric_shape → enhance
        enhanced = sketch_enhancer.enhance(image, style="professional")
        elements = vectorizer.image_to_excalidraw(enhanced)
        return JSONResponse({
            "success":     True,
            "intent":      intent,
            "confidence":  intent_result["confidence"],
            "result_type": "enhanced_sketch",
            "elements":    elements,
            "message":     "Sketch enhanced!",
        })

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# ── 2. Math  (dedicated) ──────────────────────────────────────────────────────

@app.post("/api/ml/math")
async def solve_math(file: UploadFile = File(...)):
    """
    Clicked when user presses 'Math' button.
    Directly runs the math solver — no intent classification.
    """
    try:
        image = _read_image(await file.read())
        return await _solve_math_image(image, {"intent": "mathematical", "confidence": 1.0})
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


async def _solve_math_image(image: Image.Image, intent_result: dict) -> JSONResponse:
    result = math_solver.solve(image)

    if not result["success"]:
        return JSONResponse({
            "success":     False,
            "intent":      "mathematical",
            "result_type": "math_error",
            "elements":    [],
            "message":     result.get("error", "Could not solve equation"),
        })

    img_w, img_h = image.size
    solution_text = "\n".join(result["steps"])
    text_element  = vectorizer.text_to_excalidraw(
        solution_text, x=0, y=0,
        input_width=img_w, input_height=img_h,
    )

    return JSONResponse({
        "success":     True,
        "intent":      "mathematical",
        "confidence":  intent_result["confidence"],
        "result_type": "math_solution",
        "equation":    result["original_equation"],
        "latex":       result["latex"],
        "solution":    result["solution"],
        "steps":       result["steps"],
        "elements":    [text_element],
        "message":     f"Solved: {result['original_equation']} → {', '.join(result['solution'])}",
    })


@app.post("/api/ml/text")
async def recognize_text(file: UploadFile = File(...)):
    """
    Clicked when user presses 'Text' button.
    Sends the full image directly to HuggingFace PaddleOCR-VL — no region splitting.
    """
    try:
        image = _read_image(await file.read())
        return await _recognize_text_image(image, {"intent": "handwriting", "confidence": 1.0})
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


async def _recognize_text_image(image: Image.Image, intent_result: dict) -> JSONResponse:
    img_w, img_h = image.size

    # ── Send full image to HuggingFace PaddleOCR-VL ───────────────────
    # Region-splitting (EasyOCR) was removed: it caused words to be
    # fragmented (e.g. "MIA" → "M" + "IA"). The HF microservice reads
    # the whole canvas and returns the complete text accurately.
    text = handwriting_recognizer.recognize(image)

    if not text:
        return JSONResponse({
            "success":     False,
            "intent":      "handwriting",
            "result_type": "text_error",
            "elements":    [],
            "message":     "Could not recognize any text. Try writing more clearly.",
        })

    # ── AI styling ────────────────────────────────────────────────────
    style   = text_styler.suggest_style(text, {
        "canvas_width": img_w, "canvas_height": img_h, "y": 0,
    })
    element = vectorizer.text_to_excalidraw_with_style(text=text, x=0, y=0, style=style)

    return JSONResponse({
        "success":     True,
        "intent":      "handwriting",
        "confidence":  intent_result["confidence"],
        "result_type": "recognized_text",
        "text":        text,
        "elements":    [element],
        "styling":     style,
        "message":     f"Recognized: \"{text}\"",
    })

# ── 4. Sketch Enhancement  (dedicated) ───────────────────────────────────────

@app.post("/api/ml/sketch")
async def enhance_sketch(
    file: UploadFile = File(...),
    style: Optional[str] = Form("professional"),
):
    """
    Clicked when user presses 'Sketch' button.
    Directly runs sketch enhancer with chosen style.
    Styles: professional | artistic | clean | minimal
    """
    try:
        image    = _read_image(await file.read())
        enhanced = sketch_enhancer.enhance(image, style=style or "professional")
        elements = vectorizer.image_to_excalidraw(enhanced)

        return JSONResponse({
            "success":     True,
            "intent":      "artistic_sketch",
            "result_type": "enhanced_sketch",
            "style":       style,
            "elements":    elements,
            "message":     f"Sketch enhanced ({style} style)!",
        })

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# ── 5. Detect / Classify only  (dedicated) ───────────────────────────────────

@app.post("/api/ml/detect")
async def detect_intent(file: UploadFile = File(...)):
    """
    Clicked when user presses 'Detect' button.
    Returns intent classification without processing.
    """
    try:
        image  = _read_image(await file.read())
        result = intent_classifier.classify(image)
        return JSONResponse({"success": True, **result})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Legacy generic endpoint (kept for backward compat) ───────────────────────

@app.post("/api/ml/process")
async def process_sketch(
    file: UploadFile = File(...),
    force_intent: Optional[str] = Form(None),
):
    """
    Legacy endpoint — routes to the dedicated endpoint based on force_intent.
    If no force_intent, runs intent classifier (same as /api/ml/enhance).
    """
    try:
        image = _read_image(await file.read())

        if force_intent == "mathematical":
            return await _solve_math_image(image, {"intent": "mathematical", "confidence": 1.0})

        if force_intent == "handwriting":
            return await _recognize_text_image(image, {"intent": "handwriting", "confidence": 1.0})

        if force_intent in ("artistic_sketch", "sketch"):
            enhanced = sketch_enhancer.enhance(image, style="professional")
            elements = vectorizer.image_to_excalidraw(enhanced)
            return JSONResponse({
                "success": True, "intent": "artistic_sketch",
                "result_type": "enhanced_sketch", "elements": elements,
                "message": "Sketch enhanced!",
            })

        # No force_intent → classify and route
        intent_result = intent_classifier.classify(image)
        intent = intent_result["intent"]

        if intent == "mathematical":
            return await _solve_math_image(image, intent_result)
        if intent == "handwriting":
            return await _recognize_text_image(image, intent_result)

        enhanced = sketch_enhancer.enhance(image, style="professional")
        elements = vectorizer.image_to_excalidraw(enhanced)
        return JSONResponse({
            "success": True, "intent": intent,
            "confidence": intent_result["confidence"],
            "result_type": "enhanced", "elements": elements,
            "message": "Content processed!",
        })

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# ===== SKETCH ENHANCEMENT ENDPOINTS =====

@app.post("/api/ml/enhance-sketch")
async def enhance_sketch_v2_endpoint(
    file: UploadFile = File(...),
    style: EnhancementStyle = Form("professional"),
    use_ai: bool = Form(False),
    return_vectors: bool = Form(True),
    return_preview: bool = Form(True)
):
    """
    Enhance a rough sketch to professional quality
    
    Request:
        - file: Image file (PNG, JPEG)
        - style: Enhancement style (professional/artistic/clean/minimal)
        - use_ai: Use AI enhancement if available (slower, better quality)
        - return_vectors: Return Excalidraw vector elements
        - return_preview: Return base64 preview image
    
    Response:
        {
            "success": true,
            "style": "professional",
            "method": "opencv" | "controlnet",
            "confidence": 0.85,
            "preview": "data:image/jpeg;base64,...",  # if return_preview
            "elements": [...],                          # if return_vectors
            "message": "Sketch enhanced successfully"
        }
    """
    try:
        # Read and validate image
        contents = await file.read()
        
        try:
            image = Image.open(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid image file: {str(e)}"
            )
        
        # Convert to RGB
        if image.mode not in ['RGB', 'RGBA']:
            image = image.convert('RGB')
        elif image.mode == 'RGBA':
            # Handle transparency
            background = Image.new('RGB', image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[3])
            image = background
        
        print(f"Enhancing sketch: {image.size}, style={style}, use_ai={use_ai}")
        
        # Enhance the sketch
        result = sketch_enhancer_v2.enhance(
            image,
            style=style,
            use_ai=use_ai
        )
        
        enhanced_image = result["enhanced_image"]
        
        # Build response
        response_data = {
            "success": True,
            "style": result["style"],
            "method": result["method"],
            "confidence": result["confidence"],
        }
        
        # Add preview if requested
        if return_preview:
            preview_base64 = sketch_enhancer_v2.image_to_base64(enhanced_image)
            response_data["preview"] = preview_base64
        
        # Convert to vectors if requested
        if return_vectors:
            if "elements" in result and result["elements"] is not None:
                elements = result["elements"]
            else:
                elements = vectorizer_v2.image_to_excalidraw(
                    enhanced_image,
                    smooth=True,
                    min_area=50.0
                )
            response_data["elements"] = elements
            response_data["element_count"] = len(elements)
            response_data["message"] = (
                f"Sketch enhanced using {result['method']} "
                f"with {len(elements)} vector elements"
            )
        else:
            response_data["message"] = f"Sketch enhanced using {result['method']}"
        
        return JSONResponse(response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Enhancement error: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Enhancement failed: {str(e)}"
        )

@app.post("/api/ml/enhance-sketch-batch")
async def enhance_sketch_batch(
    files: List[UploadFile] = File(...),
    style: EnhancementStyle = Form("professional"),
    use_ai: bool = Form(False)
):
    """
    Enhance multiple sketches in batch
    
    Useful for processing entire diagrams with multiple elements
    """
    if len(files) > 10:
        raise HTTPException(
            status_code=400,
            detail="Maximum 10 files per batch request"
        )
    
    results = []
    
    for i, file in enumerate(files):
        try:
            print(f"Processing file {i+1}/{len(files)}: {file.filename}")
            
            contents = await file.read()
            image = Image.open(io.BytesIO(contents)).convert('RGB')
            
            # Enhance
            result = sketch_enhancer_v2.enhance(image, style=style, use_ai=use_ai)
            enhanced_image = result["enhanced_image"]
            
            # Vectorize
            elements = vectorizer_v2.image_to_excalidraw(enhanced_image)
            
            results.append({
                "filename": file.filename,
                "success": True,
                "method": result["method"],
                "element_count": len(elements),
                "elements": elements
            })
            
        except Exception as e:
            print(f"Failed to process {file.filename}: {e}")
            results.append({
                "filename": file.filename,
                "success": False,
                "error": str(e)
            })
    
    successful = sum(1 for r in results if r["success"])
    
    return JSONResponse({
        "success": True,
        "total": len(files),
        "successful": successful,
        "failed": len(files) - successful,
        "results": results
    })

@app.get("/api/ml/enhancement-info")
async def get_enhancement_info():
    """
    Get information about available enhancement methods
    """
    return JSONResponse({
        "opencv_available": sketch_enhancer_v2.opencv_ready,
        "controlnet_available": sketch_enhancer_v2.controlnet_ready,
        "ai_enhancement_enabled": bool(config.GEMINI_API_KEY) or config.ENABLE_AI_ENHANCEMENT,
        "styles": ["professional", "artistic", "clean", "minimal"],
        "default_style": "professional",
        "max_image_size": config.SKETCH_MAX_SIZE,
        "recommended_use": {
            "professional": "Technical drawings, diagrams, architecture",
            "artistic": "Hand-drawn illustrations, creative sketches",
            "clean": "Minimal clean lines, simple diagrams",
            "minimal": "Ultra-simple line drawings"
        }
    })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT)
