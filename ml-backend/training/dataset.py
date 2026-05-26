import os
from pathlib import Path
from PIL import Image
import numpy as np
import torch
from torch.utils.data import Dataset
import torchvision.transforms as transforms
from training.corruption import SketchCorruptor

class SketchPairDataset(Dataset):
    """
    PyTorch Dataset loading (corrupted_sketch, clean_sketch) image pairs.
    """
    
    # Class-level cache to prevent OOM when instantiating multiple splits
    _cache = {}

    def __init__(self, data_root=None, split="train", val_ratio=0.2, dynamic_corruption=False):
        super(SketchPairDataset, self).__init__()
        
        if data_root is None:
            data_root = Path(__file__).parent.parent / "data"
        self.data_root = Path(data_root)
        self.dynamic_corruption = dynamic_corruption
        self.corruptor = SketchCorruptor() if dynamic_corruption else None
        
        # Check if the fast NPZ archives exist
        self.clean_npz_path = self.data_root / "clean_sketches.npz"
        self.corr_npz_path = self.data_root / "corrupted_sketches.npz"
        
        self.use_npz = self.clean_npz_path.exists() and (self.dynamic_corruption or self.corr_npz_path.exists())
        
        # Transform for input image tensors (fallback traditional path)
        self.transform = transforms.Compose([
            transforms.Resize((256, 256)),
            transforms.ToTensor(),
            transforms.Normalize((0.5,), (0.5,))
        ])
        
        if self.use_npz:
            if "clean_sketches" not in SketchPairDataset._cache:
                print(f"[Dataset] Loading dataset in-memory from NPZ archive: {self.clean_npz_path.name}")
                clean_data = np.load(self.clean_npz_path)
                # Store as torch ByteTensor to keep memory footprint tiny and prevent OOM
                SketchPairDataset._cache["clean_sketches"] = torch.from_numpy(clean_data["sketches"]).unsqueeze(1) # shape: (num_samples, 1, 256, 256)
                
                if not self.dynamic_corruption:
                    corr_data = np.load(self.corr_npz_path)
                    SketchPairDataset._cache["corr_sketches"] = torch.from_numpy(corr_data["sketches"]).unsqueeze(1) # shape: (num_samples, 1, 256, 256)
                    assert len(SketchPairDataset._cache["clean_sketches"]) == len(SketchPairDataset._cache["corr_sketches"]), "Sketches array sizes mismatch!"
            
            self.clean_sketches = SketchPairDataset._cache["clean_sketches"]
            if not self.dynamic_corruption:
                self.corr_sketches = SketchPairDataset._cache["corr_sketches"]
                
            total_samples = len(self.clean_sketches)
            
            # Shuffling indices reproducibly
            indices = list(range(total_samples))
            import random
            random.seed(42)
            random.shuffle(indices)
            
            val_size = int(total_samples * val_ratio)
            if split == "train":
                self.indices = indices[val_size:]
            elif split == "val":
                self.indices = indices[:val_size]
            else:
                raise ValueError(f"Unknown split: {split}")
        else:
            print("[Dataset] Falling back to traditional PNG directory loading...")
            if self.dynamic_corruption:
                self.clean_dir = self.data_root / "clean"
                self.corr_dir = None
            else:
                self.clean_dir = self.data_root / "pairs" / "clean"
                self.corr_dir = self.data_root / "pairs" / "corrupted"
                
            if not self.clean_dir.exists():
                raise RuntimeError(f"Clean image directory not found: {self.clean_dir}. Please run download_datasets.py first!")
                
            # Get list of clean files and sort to maintain reproducibility
            self.file_names = sorted([f.name for f in self.clean_dir.glob("*.png")])
            
            total_samples = len(self.file_names)
            val_size = int(total_samples * val_ratio)
            
            import random
            random.seed(42)
            random.shuffle(self.file_names)
            
            if split == "train":
                self.file_names = self.file_names[val_size:]
            elif split == "val":
                self.file_names = self.file_names[:val_size]
            else:
                raise ValueError(f"Unknown split: {split}")

    def __len__(self):
        if self.use_npz:
            return len(self.indices)
        else:
            return len(self.file_names)

    def __getitem__(self, idx):
        if self.use_npz:
            real_idx = self.indices[idx]
            clean_tensor_uint8 = self.clean_sketches[real_idx]
            
            if self.dynamic_corruption:
                # Dynamic path requires PIL for the SketchCorruptor
                clean_img = Image.fromarray(clean_tensor_uint8.squeeze(0).numpy())
                corr_img = self.corruptor.corrupt(clean_img)
                corr_tensor = self.transform(corr_img)
                clean_tensor = self.transform(clean_img)
            else:
                # BLAZING FAST pre-corrupted vectorized path (ZERO overhead!)
                corr_tensor_uint8 = self.corr_sketches[real_idx]
                
                # Convert uint8 [0, 255] directly to float32 [-1.0, 1.0] in microseconds
                clean_tensor = clean_tensor_uint8.to(torch.float32) / 127.5 - 1.0
                corr_tensor = corr_tensor_uint8.to(torch.float32) / 127.5 - 1.0
        else:
            file_name = self.file_names[idx]
            clean_path = self.clean_dir / file_name
            clean_img = Image.open(clean_path).convert("L")
            
            if self.dynamic_corruption:
                corr_img = self.corruptor.corrupt(clean_img)
            else:
                corr_path = self.corr_dir / file_name
                if not corr_path.exists():
                    if self.corruptor is None:
                        self.corruptor = SketchCorruptor()
                    corr_img = self.corruptor.corrupt(clean_img)
                else:
                    corr_img = Image.open(corr_path).convert("L")
                    
            clean_tensor = self.transform(clean_img)
            corr_tensor = self.transform(corr_img)
        
        return corr_tensor, clean_tensor


