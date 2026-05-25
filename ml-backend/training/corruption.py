import cv2
import numpy as np
from PIL import Image, ImageFilter, ImageOps
import random
from pathlib import Path
from scipy.ndimage import map_coordinates, gaussian_filter

class SketchCorruptor:
    """
    Applies synthetic corruptions to clean sketch drawings to generate
    messy, hand-drawn counterparts (training pairs for GAN).
    
    Corruptions:
      1. Elastic Deformations (wobbly strokes)
      2. Line Breaks (incomplete strokes, eraser markings)
      3. Motion Blur (shaky mouse drawing)
      4. Ink Bleeding (rough, thick ink spreading)
      5. Gaussian Noise & Salt/Pepper Noise (scanning/crude drawing pads)
    """
    def __init__(self):
        pass

    def apply_elastic_transform(self, image_np, alpha=35, sigma=4):
        """
        Elastic deformation of 2D images as described in Simard, Steinkraus and Platt (ICDAR 2003).
        Makes perfectly straight vector lines look wavy/shaky, representing a human hand.
        """
        random_state = np.random.RandomState(None)
        shape = image_np.shape
        
        dx = gaussian_filter((random_state.rand(*shape) * 2 - 1), sigma, mode="constant", cval=0) * alpha
        dy = gaussian_filter((random_state.rand(*shape) * 2 - 1), sigma, mode="constant", cval=0) * alpha
        
        x, y = np.meshgrid(np.arange(shape[1]), np.arange(shape[0]))
        indices = np.reshape(y + dy, (-1, 1)), np.reshape(x + dx, (-1, 1))
        
        # map_coordinates interpolates values based on deformed grid coordinates
        # 255 is the white background color for out-of-bounds pixels
        distorted_img = map_coordinates(image_np, indices, order=1, mode='constant', cval=255)
        return distorted_img.reshape(shape)

    def apply_line_breaks(self, img_np, num_breaks=4):
        """
        Draws random white strokes or shapes on top of the black lines,
        creating line breaks, missing segments, or simulated eraser marks.
        """
        h, w = img_np.shape
        corrupted = img_np.copy()
        
        for _ in range(random.randint(2, num_breaks)):
            # Pick a starting point on the canvas
            x1, y1 = random.randint(0, w), random.randint(0, h)
            # Pick an ending point nearby
            x2 = x1 + random.randint(-40, 40)
            y2 = y1 + random.randint(-40, 40)
            
            # Thick white lines represent eraser marks
            thickness = random.randint(4, 12)
            cv2.line(corrupted, (x1, y1), (x2, y2), 255, thickness)
            
        return corrupted

    def apply_motion_blur(self, img_np, size=5):
        """
        Applies a directional motion blur kernel to simulate a shaky hand or quick trackpad gesture.
        """
        # Create kernel
        kernel = np.zeros((size, size))
        # Fill diagonal or center row
        direction = random.choice(['diag', 'horiz', 'vert'])
        if direction == 'horiz':
            kernel[int((size-1)/2), :] = np.ones(size)
        elif direction == 'vert':
            kernel[:, int((size-1)/2)] = np.ones(size)
        else:
            np.fill_diagonal(kernel, 1)
            
        kernel = kernel / size
        return cv2.filter2D(img_np, -1, kernel)

    def apply_ink_bleeding(self, img_np):
        """
        Makes lines thicker and introduces micro-distortions to line edges (ink bleed / bleeding strokes).
        """
        # Invert (lines must be white for dilation/erosion)
        inv = 255 - img_np
        
        # Slightly blur the inverted strokes
        blurred = cv2.GaussianBlur(inv, (5, 5), 0)
        
        # Threshold back with some high-frequency noise
        thresh = random.randint(40, 90)
        _, binary = cv2.threshold(blurred, thresh, 255, cv2.THRESH_BINARY)
        
        # Add random bleeding spots
        noise = np.random.normal(0, 15, img_np.shape).astype(np.float32)
        bleed = np.clip(binary.astype(np.float32) + noise, 0, 255).astype(np.uint8)
        
        # Invert back to black lines on white background
        return 255 - bleed

    def apply_noise(self, img_np, noise_type="gauss"):
        """
        Adds Gaussian noise or salt and pepper noise to simulate canvas imperfections or hand jitter.
        """
        if noise_type == "gauss":
            row, col = img_np.shape
            mean = 0
            var = random.uniform(50, 250)
            sigma = var ** 0.5
            gauss = np.random.normal(mean, sigma, (row, col))
            noisy = img_np + gauss
            return np.clip(noisy, 0, 255).astype(np.uint8)
            
        elif noise_type == "sp":
            # Salt and pepper
            row, col = img_np.shape
            s_vs_p = 0.5
            amount = random.uniform(0.005, 0.02)
            out = np.copy(img_np)
            
            # Salt (white dots)
            num_salt = np.ceil(amount * img_np.size * s_vs_p)
            coords = [np.random.randint(0, i - 1, int(num_salt)) for i in img_np.shape]
            out[tuple(coords)] = 255
            
            # Pepper (black dots)
            num_pepper = np.ceil(amount * img_np.size * (1.0 - s_vs_p))
            coords = [np.random.randint(0, i - 1, int(num_pepper)) for i in img_np.shape]
            out[tuple(coords)] = 0
            return out
            
        return img_np

    def corrupt(self, img_pil):
        """
        Applies a series of corruptions to a PIL image and returns the corrupted PIL image.
        """
        # Convert to numpy array
        img_np = np.array(img_pil.convert("L"))
        
        # 1. Apply elastic deformations (90% chance)
        if random.random() < 0.90:
            img_np = self.apply_elastic_transform(img_np, alpha=random.randint(15, 30), sigma=random.randint(3, 5))
            
        # 2. Apply ink bleeding (70% chance)
        if random.random() < 0.70:
            img_np = self.apply_ink_bleeding(img_np)
            
        # 3. Apply line breaks / eraser marks (60% chance)
        if random.random() < 0.60:
            img_np = self.apply_line_breaks(img_np, num_breaks=random.randint(2, 5))
            
        # 4. Apply motion blur (50% chance)
        if random.random() < 0.50:
            img_np = self.apply_motion_blur(img_np, size=random.choice([3, 5, 7]))
            
        # 5. Apply noise (70% chance)
        if random.random() < 0.70:
            img_np = self.apply_noise(img_np, noise_type=random.choice(["gauss", "sp"]))
            
        # Double check borders are white (clean borders)
        h, w = img_np.shape
        cv2.rectangle(img_np, (0, 0), (w-1, h-1), 255, 3)
        
        return Image.fromarray(img_np).convert("L")

def batch_corrupt_dataset():
    """
    Loads data/clean_sketches.npz, corrupts all clean drawings using SketchCorruptor,
    and packages them into data/corrupted_sketches.npz.
    """
    data_dir = Path(__file__).parent.parent / "data"
    clean_npz_path = data_dir / "clean_sketches.npz"
    corr_npz_path = data_dir / "corrupted_sketches.npz"
    
    if not clean_npz_path.exists():
        print(f"[ERROR] Clean sketches archive not found at: {clean_npz_path}. Please run download_datasets.py first!")
        return
        
    print(f"Loading clean sketches from {clean_npz_path}...")
    clean_data = np.load(clean_npz_path)
    clean_sketches = clean_data["sketches"]
    
    num_sketches = len(clean_sketches)
    print(f"Generating corrupted counterpart drawings for {num_sketches} sketches...")
    corruptor = SketchCorruptor()
    
    corr_sketches = []
    for idx in range(num_sketches):
        if (idx + 1) % 2000 == 0 or (idx + 1) == num_sketches:
            print(f"Processed {idx + 1}/{num_sketches} sketches...")
            
        try:
            # clean_sketches[idx] is a uint8 numpy array of size 256x256
            clean_img = Image.fromarray(clean_sketches[idx])
            # Apply sketch corruptor
            corr_img = corruptor.corrupt(clean_img)
            corr_np = np.array(corr_img, dtype=np.uint8)
            corr_sketches.append(corr_np)
        except Exception as e:
            print(f"[WARN] Failed to process sketch index {idx}: {e}")
            # Fallback to copy the clean one as baseline
            corr_sketches.append(clean_sketches[idx])
            
    if corr_sketches:
        corr_arr = np.stack(corr_sketches, axis=0)
        print(f"Saving {len(corr_arr)} corrupted sketches to compressed NPZ archive: {corr_npz_path}...")
        np.savez_compressed(corr_npz_path, sketches=corr_arr)
        print(f"[SUCCESS] Saved corrupted_sketches.npz. Size: {corr_npz_path.stat().st_size / (1024*1024):.2f} MB")
    else:
        print("[ERROR] No corrupted sketches were generated!")

if __name__ == "__main__":
    batch_corrupt_dataset()

