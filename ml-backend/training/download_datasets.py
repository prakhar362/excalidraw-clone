import os
import json
import urllib.request
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import zipfile
import shutil

# Official Google QuickDraw categories list URL
CATEGORIES_URL = "https://raw.githubusercontent.com/googlecreativelab/quickdraw-dataset/master/categories.txt"

def get_all_quickdraw_categories():
    print("Fetching official list of all 345 QuickDraw categories from Google...")
    try:
        req = urllib.request.Request(CATEGORIES_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as response:
            categories = response.read().decode("utf-8").strip().split("\n")
        # QuickDraw URL categories must match Google Cloud bucket naming (spaces are replaced by %20 or URL-encoded)
        # We will keep raw names and URL encode them on download
        categories = [cat.strip() for cat in categories if cat.strip()]
        print(f"[OK] Successfully retrieved all {len(categories)} categories!")
        return categories
    except Exception as e:
        print(f"[WARN] Failed to fetch category list: {e}. Falling back to standard list...")
        return [
            "apple", "airplane", "banana", "cat", "dog", "fish", "house", "car", "tree", "clock",
            "umbrella", "guitar", "scissors", "hammer", "eye", "face", "cloud", "star", "cup", "key"
        ]

QUICKDRAW_CATEGORIES = get_all_quickdraw_categories()

DATA_DIR = Path(__file__).parent.parent / "data"
CLEAN_DIR = DATA_DIR / "clean"

# URL for TU-Berlin dataset (using a stable public mirror/archive on OSF or GitHub if available,
# or falling back to a clean mock generation if the network is inaccessible).
TU_BERLIN_URL = "https://github.com/mathimansha/tu-berlin-sketch-dataset/archive/refs/heads/master.zip"

def ensure_dirs():
    CLEAN_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "temp").mkdir(parents=True, exist_ok=True)

def render_quickdraw_drawing(drawing, size=256, stroke_width=3):
    """
    Renders a QuickDraw list-of-strokes drawing to a 256x256 PIL grayscale image.
    Drawing strokes are in the format: [[[x1, x2, ...], [y1, y2, ...]], ...]
    """
    # Create white canvas
    img = Image.new("L", (size, size), 255)
    draw = ImageDraw.Draw(img)
    
    # QuickDraw drawings are usually coordinate aligned inside a 256x256 bounding box,
    # but we will scale to ensure full canvas coverage with slight padding
    all_x = []
    all_y = []
    for stroke in drawing:
        all_x.extend(stroke[0])
        all_y.extend(stroke[1])
        
    if not all_x or not all_y:
        return img
        
    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = min(all_y), max(all_y)
    
    w = max_x - min_x
    h = max_y - min_y
    
    # Avoid zero division
    if w == 0: w = 1
    if h == 0: h = 1
    
    # Fit into target size with a 15-pixel margin
    margin = 20
    target_inner = size - 2 * margin
    scale = min(target_inner / w, target_inner / h)
    
    for stroke in drawing:
        coords = []
        for x, y in zip(stroke[0], stroke[1]):
            # Normalize and scale
            nx = int(margin + (x - min_x) * scale + (target_inner - w * scale) / 2)
            ny = int(margin + (y - min_y) * scale + (target_inner - h * scale) / 2)
            coords.append((nx, ny))
            
        # Draw lines
        if len(coords) > 1:
            draw.line(coords, fill=0, width=stroke_width, joint="round")
        elif len(coords) == 1:
            draw.ellipse([coords[0][0]-stroke_width, coords[0][1]-stroke_width, 
                          coords[0][0]+stroke_width, coords[0][1]+stroke_width], fill=0)
            
    return img

def download_and_render_quickdraw(samples_per_category=200):
    print("--- 1. Setting up QuickDraw Dataset directly to NPZ ---")
    import urllib.parse
    sketches = []
    
    for category in QUICKDRAW_CATEGORIES:
        category_safe = category.replace(" ", "_")
        url_encoded_category = urllib.parse.quote(category)
        url = f"https://storage.googleapis.com/quickdraw_dataset/full/simplified/{url_encoded_category}.ndjson"
        
        print(f"Streaming and rendering category: {category}...")
        count = 0
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req) as response:
                for line_bytes in response:
                    if count >= samples_per_category:
                        break
                    
                    line_str = line_bytes.decode("utf-8")
                    data = json.loads(line_str)
                    
                    if "drawing" in data:
                        pil_img = render_quickdraw_drawing(data["drawing"])
                        img_np = np.array(pil_img, dtype=np.uint8)
                        sketches.append(img_np)
                        count += 1
                        
            print(f"[OK] Rendered {count} clean drawings for: {category_safe}")
        except Exception as e:
            print(f"[ERROR] Failed to process category {category_safe}: {e}")
            
    if sketches:
        sketches_arr = np.stack(sketches, axis=0)
        npz_path = DATA_DIR / "clean_sketches.npz"
        print(f"Saving {len(sketches_arr)} clean sketches to compressed NPZ archive: {npz_path}...")
        np.savez_compressed(npz_path, sketches=sketches_arr)
        print(f"[SUCCESS] Saved clean_sketches.npz. Size: {npz_path.stat().st_size / (1024*1024):.2f} MB")
    else:
        print("[ERROR] No sketches were generated!")

def download_tu_berlin():
    # TU-Berlin is deprecated in this fast NPZ pipeline, we rely on the 345 QuickDraw categories
    print("--- 2. TU-Berlin sketch dataset (Skipped in fast NPZ pipeline) ---")
    pass

if __name__ == "__main__":
    ensure_dirs()
    # Download and process QuickDraw categories to NPZ directly
    download_and_render_quickdraw(samples_per_category=200)
    
    npz_path = DATA_DIR / "clean_sketches.npz"
    if npz_path.exists():
        print(f"\n=======================================================")
        print(f"[SUCCESS] Datasets fully set up!")
        print(f"Single pristine sketch database saved at: {npz_path}")
        print(f"=======================================================")
    else:
        print("\n[ERROR] Setup failed! clean_sketches.npz was not created.")

