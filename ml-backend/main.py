from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import io
from PIL import Image
import traceback
from typing import Optional, List

from app.models.core import IntentClassifier
from app.models.sketch_enhancement import SketchEnhancer, Vectorizer
from app.models.math_solving import MathSolver
from app.models.text_conversion import HandwritingRecognizer, TextDetector, TextStyler
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
math_solver:            Optional[MathSolver]            = None
handwriting_recognizer: Optional[HandwritingRecognizer] = None
vectorizer:             Optional[Vectorizer]            = None
text_styler:            Optional[TextStyler]            = None
text_detector:          Optional[TextDetector]          = None


@app.on_event("startup")
async def load_models():
    global intent_classifier, sketch_enhancer, math_solver
    global handwriting_recognizer, vectorizer, text_styler, text_detector

    print("Loading ML models...")
    intent_classifier      = IntentClassifier()
    sketch_enhancer        = SketchEnhancer()
    vectorizer             = Vectorizer()
    handwriting_recognizer = HandwritingRecognizer()
    math_solver            = MathSolver()
    text_styler            = TextStyler()
    text_detector          = TextDetector()
    print("All models loaded successfully!")


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


# ── 3. Text / Handwriting  (dedicated) ───────────────────────────────────────

@app.post("/api/ml/text")
async def recognize_text(file: UploadFile = File(...)):
    """
    Clicked when user presses 'Text' button.
    Runs PaddleOCR (multi-region) → TrOCR fallback → AI styling.
    """
    try:
        image = _read_image(await file.read())
        return await _recognize_text_image(image, {"intent": "handwriting", "confidence": 1.0})
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


async def _recognize_text_image(image: Image.Image, intent_result: dict) -> JSONResponse:
    img_w, img_h = image.size
    elements = []

    # ── Detect regions with OpenCV ─────────────────────────────────────
    regions = text_detector.detect_regions(image)

    if regions:
        # Crop each region and run TrOCR on it
        pad = 8
        crops: List[Image.Image] = []
        valid_regions = []

        for region in regions:
            bbox = region["bbox"]
            x, y, w, h = bbox["x"], bbox["y"], bbox["width"], bbox["height"]
            x1 = max(0, x - pad)
            y1 = max(0, y - pad)
            x2 = min(img_w, x + w + pad)
            y2 = min(img_h, y + h + pad)
            crop = image.crop((x1, y1, x2, y2))
            # Skip crops that are too small for TrOCR
            if crop.width < 10 or crop.height < 10:
                continue
            crops.append(crop)
            valid_regions.append(region)

        if crops:
            # Batch-recognise all crops in one TrOCR call
            texts = handwriting_recognizer.recognize_batch(crops)

            for region, text in zip(valid_regions, texts):
                if not text or text.startswith("Handwriting recognition"):
                    continue
                bbox = region["bbox"]
                x, y = bbox["x"], bbox["y"]
                w, h = bbox["width"], bbox["height"]

                style = text_styler.suggest_style(text, {
                    "canvas_width": img_w, "canvas_height": img_h,
                    "y": y, "region_height": h, "region_width": w,
                })
                element = vectorizer.text_to_excalidraw_with_style(
                    text=text, x=float(x), y=float(y), style=style,
                )
                element["detectionConfidence"] = region["confidence"]
                elements.append(element)

        if elements:
            return JSONResponse({
                "success":       True,
                "intent":        "handwriting",
                "confidence":    intent_result["confidence"],
                "result_type":   "multi_text",
                "regions_count": len(elements),
                "elements":      elements,
                "message":       f"Recognized {len(elements)} text region(s) with AI styling",
            })

    # ── Fallback: TrOCR on full image ──────────────────────────────────
    text  = handwriting_recognizer.recognize(image)
    style = text_styler.suggest_style(text, {
        "canvas_width": img_w, "canvas_height": img_h, "y": 0,
    })
    element = vectorizer.text_to_excalidraw_with_style(text=text, x=0, y=0, style=style)

    return JSONResponse({
        "success":     True,
        "intent":      "handwriting",
        "confidence":  intent_result["confidence"],
        "result_type": "single_text",
        "text":        text,
        "elements":    [element],
        "styling":     style,
        "message":     f"Handwriting recognized as {style['textType']}!",
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT)
