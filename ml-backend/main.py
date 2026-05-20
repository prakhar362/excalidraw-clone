from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import io
from PIL import Image
import traceback
from typing import Optional

from app.models.intent_classifier import IntentClassifier
from app.models.sketch_enhancer import SketchEnhancer
from app.models.math_solver import MathSolver
from app.models.handwriting_recognizer import HandwritingRecognizer
from app.models.vectorizer import Vectorizer
from app.models.text_styler import TextStyler
from app.config import config

# Initialize FastAPI
app = FastAPI(title="SketchCalibur ML API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load models on startup
intent_classifier = None
sketch_enhancer = None
math_solver = None
handwriting_recognizer = None
vectorizer = None
text_styler = None

@app.on_event("startup")
async def load_models():
    global intent_classifier, sketch_enhancer, math_solver, handwriting_recognizer, vectorizer, text_styler
    
    print("Loading ML models...")
    intent_classifier = IntentClassifier()
    sketch_enhancer = SketchEnhancer()
    handwriting_recognizer = HandwritingRecognizer()
    math_solver = MathSolver()
    math_solver._recognizer = handwriting_recognizer  # share the same TrOCR instance
    vectorizer = Vectorizer()
    text_styler = TextStyler()
    print("All models loaded successfully!")

@app.get("/")
async def root():
    return {"message": "SketchCalibur ML API", "status": "running"}

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "models_loaded": all([
            intent_classifier, sketch_enhancer, 
            math_solver, handwriting_recognizer, vectorizer
        ])
    }

@app.post("/api/ml/process")
async def process_sketch(
    file: UploadFile = File(...),
    user_prompt: Optional[str] = Form(None),
    force_intent: Optional[str] = Form(None)
):
    """
    Main endpoint: Process user sketch and return enhanced result
    """
    try:
        # Read image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('RGB')
        
        # Resize if too large
        if max(image.size) > config.MAX_IMAGE_SIZE:
            image.thumbnail((config.MAX_IMAGE_SIZE, config.MAX_IMAGE_SIZE))
        
        # Step 1: Classify intent (unless forced)
        if force_intent:
            intent_result = {"intent": force_intent, "confidence": 1.0}
        else:
            intent_result = intent_classifier.classify(image)
        
        intent = intent_result["intent"]
        
        # Step 2: Route to appropriate model
        if intent == "artistic_sketch":
            enhanced = sketch_enhancer.enhance(image, style="professional")
            elements = vectorizer.image_to_excalidraw(enhanced)
            
            return JSONResponse({
                "success": True,
                "intent": intent,
                "confidence": intent_result["confidence"],
                "result_type": "enhanced_sketch",
                "elements": elements,
                "message": "Sketch enhanced successfully!"
            })
        
        elif intent == "mathematical":
            result = math_solver.solve(image)
            
            if not result["success"]:
                return JSONResponse({
                    "success": False,
                    "intent": intent,
                    "confidence": intent_result["confidence"],
                    "result_type": "math_error",
                    "elements": [],
                    "message": result.get("error", "Could not solve equation"),
                    "recognized": result.get("recognized", "")
                })
            
            # Get image dimensions for font size calculation
            img_width, img_height = image.size
            
            # Create a SINGLE text element with all solution steps
            # Join steps with newlines for multi-line display
            solution_text = "\n".join(result["steps"])
            
            # Create one text element (no duplicates, no icons)
            text_element = vectorizer.text_to_excalidraw(
                solution_text, 
                x=0, 
                y=0,
                input_width=img_width,
                input_height=img_height
            )
            
            return JSONResponse({
                "success": True,
                "intent": intent,
                "confidence": intent_result["confidence"],
                "result_type": "math_solution",
                "equation": result["original_equation"],
                "latex": result["latex"],
                "solution": result["solution"],
                "steps": result["steps"],
                "elements": [text_element],  # Single element only
                "message": f"Solved: {result['original_equation']} → {', '.join(result['solution'])}"
            })
        
        elif intent == "handwriting":
            text = handwriting_recognizer.recognize(image)
            
            # Get image dimensions and context
            img_width, img_height = image.size
            context = {
                "canvas_width": img_width,
                "canvas_height": img_height,
                "y": 0  # Position in canvas
            }
            
            # Get AI-suggested styling
            style = text_styler.suggest_style(text, context)
            
            # Create text element with AI styling
            text_element = vectorizer.text_to_excalidraw_with_style(
                text, 
                x=0, 
                y=0,
                style=style
            )
            
            return JSONResponse({
                "success": True,
                "intent": intent,
                "confidence": intent_result["confidence"],
                "result_type": "recognized_text",
                "text": text,
                "elements": [text_element],
                "styling": style,  # Include styling info
                "message": f"Handwriting recognized as {style['textType']}!"
            })
        
        else:
            # Default: enhance sketch
            enhanced = sketch_enhancer.enhance(image)
            elements = vectorizer.image_to_excalidraw(enhanced)
            
            return JSONResponse({
                "success": True,
                "intent": intent,
                "confidence": intent_result["confidence"],
                "result_type": "enhanced",
                "elements": elements,
                "message": "Content processed!"
            })
    
    except Exception as e:
        print(f"Error processing sketch: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/classify")
async def classify_only(file: UploadFile = File(...)):
    """
    Just classify the intent without processing
    """
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('RGB')
        
        result = intent_classifier.classify(image)
        
        return JSONResponse({
            "success": True,
            **result
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT)
