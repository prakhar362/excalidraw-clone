import os
from pathlib import Path
from PIL import Image
import torch
from torch.utils.data import Dataset
import torchvision.transforms as transforms
from training.corruption import SketchCorruptor

class SketchPairDataset(Dataset):
    """
    PyTorch Dataset loading (corrupted_sketch, clean_sketch) image pairs.
    
    Supports two modes:
      1. Pre-generated pairs (loads from data/pairs/corrupted/ and data/pairs/clean/)
      2. On-the-fly corruption (loads clean from data/clean/ and corrupts dynamically)
    """
    def __init__(self, data_root=None, split="train", val_ratio=0.2, dynamic_corruption=True):
        super(SketchPairDataset, self).__init__()
        
        if data_root is None:
            data_root = Path(__file__).parent.parent / "data"
        self.data_root = Path(data_root)
        
        self.dynamic_corruption = dynamic_corruption
        self.corruptor = SketchCorruptor() if dynamic_corruption else None
        
        # Determine source folder
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
        
        # Train / Validation split
        total_samples = len(self.file_names)
        val_size = int(total_samples * val_ratio)
        
        # Fix random seed for splits
        import random
        random.seed(42)
        random.shuffle(self.file_names)
        
        if split == "train":
            self.file_names = self.file_names[val_size:]
        elif split == "val":
            self.file_names = self.file_names[:val_size]
        else:
            raise ValueError(f"Unknown split: {split}")
            
        # Transform for input image tensors
        # Resize to 256x256, convert to PyTorch single-channel Float tensor,
        # and normalize from [0, 1] to [-1, 1] for Generator Tanh compatibility
        self.transform = transforms.Compose([
            transforms.Resize((256, 256)),
            transforms.ToTensor(),
            transforms.Normalize((0.5,), (0.5,))
        ])

    def __len__(self):
        return len(self.file_names)

    def __getitem__(self, idx):
        file_name = self.file_names[idx]
        
        # Load clean image
        clean_path = self.clean_dir / file_name
        clean_img = Image.open(clean_path).convert("L")
        
        # Get corrupted image
        if self.dynamic_corruption:
            # Corrupt on the fly for infinite diversity
            corr_img = self.corruptor.corrupt(clean_img)
        else:
            # Load pre-generated corrupted file
            corr_path = self.corr_dir / file_name
            if not corr_path.exists():
                # Fallback to corrupting on the fly if pre-generated pair is missing
                if self.corruptor is None:
                    self.corruptor = SketchCorruptor()
                corr_img = self.corruptor.corrupt(clean_img)
            else:
                corr_img = Image.open(corr_path).convert("L")
                
        # Apply transformation
        clean_tensor = self.transform(clean_img)
        corr_tensor = self.transform(corr_img)
        
        return corr_tensor, clean_tensor
