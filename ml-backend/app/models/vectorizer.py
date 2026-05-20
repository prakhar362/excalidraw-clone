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
    
    def text_to_excalidraw_with_style(self, text: str, x: float = 0, y: float = 0, style: dict = None) -> Dict:
        """
        Create Excalidraw text element with AI-suggested styling
        
        Args:
            text: Text content to display
            x: X position
            y: Y position
            style: AI-suggested styling from TextStyler
        """
        if style is None:
            # Fallback to basic styling
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
            # Metadata from AI
            "textType": style.get('textType', 'body'),
            "aiConfidence": style.get('confidence', 0.0),
        }
    
    def text_to_excalidraw(self, text: str, x: float = 0, y: float = 0, input_width: int = 0, input_height: int = 0) -> Dict:
        """
        Create Excalidraw text element with proper formatting
        
        Args:
            text: Text content to display
            x: X position
            y: Y position
            input_width: Width of input image (for font size calculation)
            input_height: Height of input image (for font size calculation)
        """
        # Calculate font size based on input dimensions
        # Default to medium (28px), scale up for larger inputs
        base_font_size = 28
        
        if input_width > 0 and input_height > 0:
            # If input is large, use larger font
            max_dim = max(input_width, input_height)
            if max_dim > 800:
                base_font_size = 36  # Large
            elif max_dim > 400:
                base_font_size = 28  # Medium
            else:
                base_font_size = 20  # Small
        
        # Calculate text width (approximate)
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
            "strokeColor": "#000000",  # Black text
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 1,
            "strokeStyle": "solid",
            "roughness": 0,
            "opacity": 100,
            "text": text,
            "fontSize": base_font_size,
            "fontFamily": 1,  # Virgil (Excalidraw default)
            "textAlign": "left",
            "verticalAlign": "top",
            "baseline": base_font_size * 0.9,
            "containerId": None,
            "originalText": text,
        }
