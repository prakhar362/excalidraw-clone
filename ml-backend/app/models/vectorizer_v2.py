"""
Advanced vectorization system
Converts enhanced sketches to Excalidraw vector elements with smooth curves
"""

import cv2
import numpy as np
from PIL import Image
from typing import List, Dict, Optional
from scipy.interpolate import splprep, splev
from app.config import config

class VectorizerV2:
    """
    Converts raster images to smooth Excalidraw vector paths
    """
    
    def __init__(self):
        self.simplify_tolerance = config.SKETCH_SIMPLIFY_TOLERANCE
    
    def image_to_excalidraw(
        self,
        image: Image.Image,
        smooth: bool = True,
        min_area: float = 50.0
    ) -> List[Dict]:
        """
        Convert enhanced image to Excalidraw vector elements
        
        Args:
            image: Enhanced sketch image
            smooth: Apply spline smoothing to curves (disabled by default to avoid distortion)
            min_area: Minimum contour area to keep (filters noise)
        
        Returns:
            List of Excalidraw element dictionaries
        """
        # Convert to grayscale
        img_array = np.array(image.convert('L'))
        
        # Threshold to binary
        _, binary = cv2.threshold(
            img_array, 200, 255, cv2.THRESH_BINARY_INV
        )
        
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
            
            # Simplify contour adaptively based on arc length (preserves detail of small & large curves perfectly)
            epsilon = 0.008 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            
            # Extract points
            points = [[float(p[0][0]), float(p[0][1])] for p in approx]
            
            # Must have at least 2 points
            if len(points) < 2:
                continue
            
            # Create Excalidraw element (always draw as organic curves to avoid sterile geometric shapes)
            element = self._create_element(points, i, False, None, i)
            
            if element:
                elements.append(element)
        
        print(f"Vectorization: {len(contours)} contours → {len(elements)} elements")
        
        return elements
    
    def _smooth_curve(
        self,
        points: List[List[float]],
        smoothness: float = 2.0,
        num_points: Optional[int] = None
    ) -> List[List[float]]:
        """
        Apply B-spline smoothing to curve
        
        Args:
            points: Original points
            smoothness: Smoothing factor (lower = smoother, 0-5)
            num_points: Number of output points (None = auto)
        
        Returns:
            Smoothed points
        """
        if len(points) < 4:
            return points
        
        try:
            # Extract coordinates
            x = np.array([p[0] for p in points])
            y = np.array([p[1] for p in points])
            
            # Fit B-spline
            tck, u = splprep(
                [x, y],
                s=smoothness,
                k=min(3, len(points) - 1)
            )
            
            # Generate smooth curve
            if num_points is None:
                # Use 2x original points for smooth curve
                num_points = len(points) * 2
            
            u_new = np.linspace(0, 1, num_points)
            x_smooth, y_smooth = splev(u_new, tck)
            
            # Convert back to list of points
            smooth_points = [
                [float(x_smooth[i]), float(y_smooth[i])]
                for i in range(len(x_smooth))
            ]
            
            return smooth_points
            
        except Exception as e:
            print(f"Smoothing failed: {e}, using original points")
            return points
    
    def _is_closed_shape(
        self,
        contour: np.ndarray,
        points: List[List[float]]
    ) -> bool:
        """
        Determine if shape should be closed
        """
        # Check if first and last points are close
        if len(points) < 3:
            return False
        
        first = np.array(points[0])
        last = np.array(points[-1])
        distance = np.linalg.norm(first - last)
        
        # If endpoints are within 10 pixels, consider closed
        if distance < 10:
            return True
        
        # Check if contour is convex (likely a shape)
        is_convex = cv2.isContourConvex(contour)
        
        return is_convex and len(points) < 8
    
    def _create_element(
        self,
        points: List[List[float]],
        idx: int,
        closed: bool,
        hierarchy: Optional[np.ndarray],
        contour_idx: int
    ) -> Optional[Dict]:
        """
        Create Excalidraw element from points
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
        
        # Determine element type and properties
        if closed and len(points) <= 8:
            # Likely a shape (rectangle, ellipse, etc.)
            element_type = self._detect_shape_type(normalized_points)
        else:
            element_type = "line"
        
        # Create element
        element = {
            "id": f"enhanced_{idx}",
            "type": element_type,
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
            "roughness": 0,  # 0 = clean lines, 1 = hand-drawn
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
        }
        
        # Add type-specific properties
        if element_type == "line":
            element.update({
                "points": normalized_points,
                "lastCommittedPoint": None,
                "startBinding": None,
                "endBinding": None,
                "startArrowhead": None,
                "endArrowhead": None,
            })
        
        return element
    
    def _detect_shape_type(self, points: List[List[float]]) -> str:
        """
        Detect if points form a specific shape (rectangle, ellipse, etc.)
        """
        num_points = len(points)
        
        # Rectangle detection (4 points)
        if num_points == 4:
            return "rectangle"
        
        # Triangle (3 points)
        if num_points == 3:
            return "line"  # Excalidraw doesn't have triangle primitive
        
        # Circle/ellipse (many points, roughly circular)
        if num_points >= 8:
            # Calculate if points form a circle
            center_x = np.mean([p[0] for p in points])
            center_y = np.mean([p[1] for p in points])
            
            distances = [
                np.sqrt((p[0] - center_x)**2 + (p[1] - center_y)**2)
                for p in points
            ]
            
            # Check if all distances are similar (circle)
            if np.std(distances) / np.mean(distances) < 0.2:
                return "ellipse"
        
        return "line"
    
    def text_to_excalidraw(
        self,
        text: str,
        x: float = 0,
        y: float = 0,
        font_size: int = 20,
        font_family: int = 1
    ) -> Dict:
        """
        Create Excalidraw text element
        """
        return {
            "id": f"text_{hash(text) & 0xFFFFFF}",
            "type": "text",
            "x": x,
            "y": y,
            "width": len(text) * font_size * 0.6,
            "height": font_size * 1.2,
            "angle": 0,
            "strokeColor": "#1e1e1e",
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 1,
            "strokeStyle": "solid",
            "roughness": 0,
            "opacity": 100,
            "text": text,
            "fontSize": font_size,
            "fontFamily": font_family,
            "textAlign": "left",
            "verticalAlign": "top",
            "baseline": font_size,
            "containerId": None,
            "originalText": text,
            "lineHeight": 1.25,
        }
