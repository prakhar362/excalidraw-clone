import numpy as np
from PIL import Image
import cv2
from typing import List, Dict
import uuid

class Vectorizer:
    """
    Converts raster images to Excalidraw vector format
    """
    
    def __init__(self):
        pass
    
    def image_to_excalidraw(self, image: Image.Image, element_type: str = "freedraw") -> List[Dict]:
        """
        Convert image to Excalidraw elements
        
        Args:
            image: PIL Image to convert
            element_type: Type of Excalidraw element to create
            
        Returns:
            List of Excalidraw element dictionaries
        """
        img_array = np.array(image.convert('L'))
        
        # Detect contours
        _, binary = cv2.threshold(img_array, 200, 255, cv2.THRESH_BINARY_INV)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        elements = []
        
        for i, contour in enumerate(contours):
            # Skip very small contours
            if cv2.contourArea(contour) < 100:
                continue
            
            # Simplify contour
            epsilon = 0.01 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            
            # Convert to Excalidraw points format
            abs_points = [[float(p[0][0]), float(p[0][1])] for p in approx]
            x_min = float(min(p[0] for p in abs_points))
            y_min = float(min(p[1] for p in abs_points))
            x_max = float(max(p[0] for p in abs_points))
            y_max = float(max(p[1] for p in abs_points))
            
            # Points must be relative to (x, y) for Excalidraw
            rel_points = [[p[0] - x_min, p[1] - y_min] for p in abs_points]
            
            # Create Excalidraw element
            element = {
                "id": f"ml_generated_{uuid.uuid4().hex[:8]}",
                "type": "line",
                "x": x_min,
                "y": y_min,
                "width": x_max - x_min,
                "height": y_max - y_min,
                "angle": 0,
                "strokeColor": "#000000",
                "backgroundColor": "transparent",
                "fillStyle": "solid",
                "strokeWidth": 2,
                "strokeStyle": "solid",
                "roughness": 0,
                "opacity": 100,
                "points": rel_points,
                "lastCommittedPoint": None,
                "startBinding": None,
                "endBinding": None,
                "startArrowhead": None,
                "endArrowhead": None,
            }
            
            elements.append(element)
        
        return elements
    
    def text_to_excalidraw(self, text: str, x: float = 0, y: float = 0) -> Dict:
        """
        Create Excalidraw text element
        """
        return {
            "id": f"ml_text_{uuid.uuid4().hex[:8]}",
            "type": "text",
            "x": x,
            "y": y,
            "width": len(text) * 10,
            "height": 25,
            "angle": 0,
            "strokeColor": "#000000",
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 1,
            "strokeStyle": "solid",
            "roughness": 0,
            "opacity": 100,
            "text": text,
            "fontSize": 20,
            "fontFamily": 1,
            "textAlign": "left",
            "verticalAlign": "top",
            "baseline": 18,
        }
