"""
Text Detector - Multi-region text detection using pure OpenCV.
No external OCR packages needed — works on Render free tier.

Strategy:
  1. Binarise the image (Otsu threshold on inverted grayscale)
  2. Dilate horizontally to merge characters into word blobs
  3. Find external contours → bounding boxes
  4. Filter by aspect ratio / area to keep only text-like regions
  5. Sort left→right, top→bottom
"""

import cv2
import numpy as np
from PIL import Image
from typing import List, Dict


class TextDetector:
    """
    Detects text regions using OpenCV morphological operations.
    Each detected region is later passed to TrOCR for recognition.
    """

    def __init__(self):
        print("Initializing Text Detector (OpenCV)...")
        # No model to load — pure CV

    def detect_regions(self, image: Image.Image) -> List[Dict]:
        """
        Detect candidate text regions in the image.

        Returns a list of dicts:
          { id, bbox: {x,y,width,height}, center: {x,y}, text: "" }
        The 'text' field is intentionally empty here — the caller
        (main.py) fills it in by running TrOCR on each cropped region.
        """
        img = np.array(image.convert("RGB"))
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

        # ── 1. Upscale small images so morphology works better ──────────
        h, w = gray.shape
        if max(h, w) < 600:
            scale = 600 / max(h, w)
            gray = cv2.resize(gray, (int(w * scale), int(h * scale)),
                              interpolation=cv2.INTER_CUBIC)
            scale_x, scale_y = scale, scale
        else:
            scale_x, scale_y = 1.0, 1.0

        # ── 2. Binarise ─────────────────────────────────────────────────
        # Invert so strokes are white on black, then Otsu threshold
        inv = cv2.bitwise_not(gray)
        _, binary = cv2.threshold(inv, 0, 255,
                                  cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # ── 3. Dilate horizontally to merge characters into word blobs ──
        # Kernel width ~20px merges chars; height ~3px keeps lines separate
        kw = max(15, int(w * scale_x * 0.04))
        kh = 3
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, kh))
        dilated = cv2.dilate(binary, kernel, iterations=1)

        # ── 4. Find contours ────────────────────────────────────────────
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL,
                                       cv2.CHAIN_APPROX_SIMPLE)

        img_area = gray.shape[0] * gray.shape[1]
        regions: List[Dict] = []

        for idx, cnt in enumerate(contours):
            x, y, bw, bh = cv2.boundingRect(cnt)
            area = bw * bh

            # Filter: skip tiny noise and full-image blobs
            if area < 200:
                continue
            if area > img_area * 0.9:
                continue
            # Skip very tall/narrow blobs (likely a single vertical stroke)
            aspect = bw / max(bh, 1)
            if aspect < 0.5:
                continue

            # Map back to original image coordinates
            ox = int(x / scale_x)
            oy = int(y / scale_y)
            ow = int(bw / scale_x)
            oh = int(bh / scale_y)

            regions.append({
                "id":     f"region_{idx}",
                "text":   "",          # filled by TrOCR in main.py
                "confidence": 1.0,     # detection confidence (CV has no score)
                "bbox":   {"x": ox, "y": oy, "width": ow, "height": oh},
                "center": {"x": ox + ow / 2, "y": oy + oh / 2},
            })

        # ── 5. Sort top→bottom, left→right ─────────────────────────────
        regions.sort(key=lambda r: (r["center"]["y"], r["center"]["x"]))

        print(f"OpenCV TextDetector: found {len(regions)} region(s)")
        return regions

    def group_regions_by_proximity(self, regions: List[Dict],
                                   distance_threshold: float = 50) -> List[List[Dict]]:
        """Group vertically close regions into paragraphs."""
        if not regions:
            return []

        groups, current = [], [regions[0]]
        for region in regions[1:]:
            if abs(region["center"]["y"] - current[-1]["center"]["y"]) <= distance_threshold:
                current.append(region)
            else:
                groups.append(current)
                current = [region]
        groups.append(current)
        return groups
