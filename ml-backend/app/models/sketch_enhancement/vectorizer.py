import numpy as np
from PIL import Image
import cv2
from typing import List, Dict, Optional
import uuid
from app.config import config

class Vectorizer:
    """
    Production-ready Unified Vectorizer for raster-to-vector sketch conversions
    and styled text elements (OCR/Math/Handwriting) on Excalidraw canvas.
    """
    
    def __init__(self):
        self.simplify_tolerance = getattr(config, "SKETCH_SIMPLIFY_TOLERANCE", 2.0)
    
    def image_to_excalidraw(
        self,
        image: Image.Image,
        smooth: bool = True,
        min_area: float = 50.0
    ) -> List[Dict]:
        """
        Convert raster image to a list of Excalidraw line elements.
        Uses RETR_EXTERNAL contour extraction to avoid double outline artifacts
        and adaptive simplification to maintain clean organic sketches.
        """
        # Convert to grayscale
        img_array = np.array(image.convert('L'))
        
        # Threshold to binary
        _, binary = cv2.threshold(img_array, 200, 255, cv2.THRESH_BINARY_INV)
        
        # Find contours using RETR_EXTERNAL to get clean outer boundaries (avoids double outline bug)
        contours, _ = cv2.findContours(
            binary,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )
        
        elements = []
        
        for i, contour in enumerate(contours):
            # Filter small noise
            area = cv2.contourArea(contour)
            if area < min_area:
                continue
            
            # Simplify contour adaptively based on arc length (preserves detail perfectly)
            epsilon = 0.008 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            
            # Extract points
            points = [[float(p[0][0]), float(p[0][1])] for p in approx]
            
            # Must have at least 2 points
            if len(points) < 2:
                continue
            
            # Create Excalidraw element
            element = self._create_element(points, i)
            if element:
                elements.append(element)
        
        print(f"Vectorization: {len(contours)} contours -> {len(elements)} elements")
        return elements
        
    def _create_element(self, points: List[List[float]], idx: int) -> Optional[Dict]:
        """
        Create Excalidraw line element from points with correct absolute/relative positions
        """
        if len(points) < 2:
            return None
            
        # Calculate bounding box
        x_coords = [p[0] for p in points]
        y_coords = [p[1] for p in points]
        
        min_x = min(x_coords)
        min_y = min(y_coords)
        max_x = max(x_coords)
        max_y = max(y_coords)
        
        width = max_x - min_x
        height = max_y - min_y
        
        # Normalize points relative to bounding box
        normalized_points = [
            [p[0] - min_x, p[1] - min_y]
            for p in points
        ]
        
        element = {
            "id": f"enhanced_{uuid.uuid4().hex[:8]}_{idx}",
            "type": "line",
            "x": float(min_x),
            "y": float(min_y),
            "width": float(width),
            "height": float(height),
            "angle": 0,
            "strokeColor": "#1e1e1e",
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 2,
            "strokeStyle": "solid",
            "roughness": 0,  # clean lines
            "opacity": 100,
            "roundness": None,
            "seed": 42,
            "version": 1,
            "versionNonce": 42,
            "isDeleted": False,
            "boundElements": None,
            "updated": 1,
            "link": None,
            "locked": False,
            "points": normalized_points,
            "lastCommittedPoint": None,
            "startBinding": None,
            "endBinding": None,
            "startArrowhead": None,
            "endArrowhead": None,
        }
        return element

    def text_to_excalidraw_with_style(self, text: str, x: float = 0, y: float = 0, style: dict = None) -> Dict:
        """
        Create Excalidraw text element with AI-suggested styling
        """
        if style is None:
            return self.text_to_excalidraw(text, x, y)
        
        # Calculate text dimensions
        font_size = style.get('fontSize', 20)
        char_width = font_size * 0.6
        text_width = len(text) * char_width
        text_height = font_size * 1.5
        
        return {
            "id": f"ml_text_{uuid.uuid4().hex[:8]}",
            "type": "text",
            "x": x,
            "y": y,
            "width": text_width,
            "height": text_height,
            "angle": 0,
            "strokeColor": style.get('strokeColor', '#000000'),
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 1,
            "strokeStyle": "solid",
            "roughness": 0,
            "opacity": 100,
            "text": text,
            "fontSize": font_size,
            "fontFamily": style.get('fontFamily', 1),
            "textAlign": style.get('textAlign', 'left'),
            "verticalAlign": style.get('verticalAlign', 'top'),
            "baseline": font_size * 0.9,
            "containerId": None,
            "originalText": text,
            "textType": style.get('textType', 'body'),
            "aiConfidence": style.get('confidence', 0.0),
        }
    
    def text_to_excalidraw(self, text: str, x: float = 0, y: float = 0, input_width: int = 0, input_height: int = 0) -> Dict:
        """
        Create Excalidraw text element with proper formatting and adaptive scaling
        """
        base_font_size = 28
        if input_width > 0 and input_height > 0:
            max_dim = max(input_width, input_height)
            if max_dim > 800:
                base_font_size = 36
            elif max_dim > 400:
                base_font_size = 28
            else:
                base_font_size = 20
        
        char_width = base_font_size * 0.6
        text_width = len(text) * char_width
        text_height = base_font_size * 1.5
        
        return {
            "id": f"ml_text_{uuid.uuid4().hex[:8]}",
            "type": "text",
            "x": x,
            "y": y,
            "width": text_width,
            "height": text_height,
            "angle": 0,
            "strokeColor": "#000000",
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 1,
            "strokeStyle": "solid",
            "roughness": 0,
            "opacity": 100,
            "text": text,
            "fontSize": base_font_size,
            "fontFamily": 1,  # Virgil
            "textAlign": "left",
            "verticalAlign": "top",
            "baseline": base_font_size * 0.9,
            "containerId": None,
            "originalText": text,
        }
