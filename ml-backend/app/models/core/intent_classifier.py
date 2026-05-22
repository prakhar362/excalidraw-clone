import numpy as np
import cv2
from PIL import Image

class IntentClassifier:
    """
    Classifies sketch intent using OpenCV heuristics (fast, zero memory overhead)
    """
    
    def __init__(self):
        print("Loading Intent Classifier (Heuristics mode)...")
        
        # Intent mapping
        self.intents = {
            0: "artistic_sketch",    # Drawings, doodles, illustrations
            1: "mathematical",        # Equations, formulas, calculations
            2: "handwriting",         # Text, notes, labels
            3: "diagram",             # Flowcharts, architecture diagrams
            4: "geometric_shape"      # Circles, squares, precise shapes
        }
    
    def classify(self, image: Image.Image) -> dict:
        """
        Classify the intent of the drawing using heuristics
        """
        # Default to artistic sketch
        intent_idx = 0 
        
        # Refine based on image characteristics
        intent_idx = self._refine_with_heuristics(image, intent_idx)
        
        intent_name = self.intents.get(intent_idx, "artistic_sketch")
        
        return {
            "intent": intent_name,
            "confidence": 0.85, # Heuristic confidence
            "all_scores": {
                name: 0.85 if name == intent_name else 0.1
                for idx, name in self.intents.items()
            }
        }
    
    def _refine_with_heuristics(self, image: Image.Image, predicted_idx: int) -> int:
        """
        Use image analysis heuristics to improve classification
        """
        # Convert to numpy
        img_array = np.array(image.convert('L'))  # Grayscale
        
        # Detect mathematical symbols (=, +, -, numbers)
        has_math_symbols = self._detect_math_symbols(img_array)
        if has_math_symbols:
            return 1  # mathematical
        
        # Detect text-like patterns
        text_density = self._calculate_text_density(img_array)
        if text_density > 0.6:
            return 2  # handwriting
        
        # Detect geometric shapes
        has_geometric = self._detect_geometric_shapes(img_array)
        if has_geometric:
            return 4  # geometric_shape
        
        return predicted_idx
    
    def _detect_math_symbols(self, image: np.ndarray) -> bool:
        """Detect presence of mathematical symbols"""
        # Math equations always consist of multiple symbols (digits, operators, variables)
        # Check that we have at least 3 distinct contours in the image.
        # If there are 1 or 2 contours, it's highly likely to be a simple sketch (e.g. apple, shape), not math.
        _, binary = cv2.threshold(image, 127, 255, cv2.THRESH_BINARY_INV)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if len(contours) < 3:
            return False
            
        # Detect horizontal lines (= sign, fraction bars)
        edges = cv2.Canny(image, 50, 150)
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 1))
        detect_horizontal = cv2.morphologyEx(edges, cv2.MORPH_OPEN, horizontal_kernel)
        
        # Increase threshold to require robust horizontal components (at least ~60px total length of horizontal strokes)
        return np.sum(detect_horizontal) > 15000
    
    def _calculate_text_density(self, image: np.ndarray) -> float:
        """Calculate how text-like the image is"""
        # Text has consistent height and spacing
        _, binary = cv2.threshold(image, 127, 255, cv2.THRESH_BINARY_INV)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if len(contours) < 3:
            return 0.0
        
        heights = [cv2.boundingRect(c)[3] for c in contours]
        if len(heights) == 0:
            return 0.0
            
        height_variance = np.var(heights) / (np.mean(heights) + 1)
        return 1.0 / (1.0 + height_variance)
    
    def _detect_geometric_shapes(self, image: np.ndarray) -> bool:
        """Detect presence of geometric shapes"""
        edges = cv2.Canny(image, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        geometric_count = 0
        for contour in contours:
            approx = cv2.approxPolyDP(contour, 0.04 * cv2.arcLength(contour, True), True)
            # Triangles, rectangles, pentagons, circles
            if 3 <= len(approx) <= 8:
                geometric_count += 1
        
        return geometric_count >= 2
