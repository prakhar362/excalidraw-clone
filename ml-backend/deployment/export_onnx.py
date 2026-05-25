import sys
from pathlib import Path
# Add the project base directory to system path to avoid ModuleNotFoundError in notebooks
sys.path.append(str(Path(__file__).resolve().parent.parent))

import torch
from models_arch.generator import UNetGenerator
import argparse

def export(weight_name="sketch_enhancer_best.pth", onnx_name="sketch_enhancer.onnx"):
    base_dir = Path(__file__).parent.parent
    weight_path = base_dir / "checkpoints" / weight_name
    onnx_path = base_dir / "checkpoints" / onnx_name
    
    if not weight_path.exists():
        print(f"[ERROR] Weight file not found at: {weight_path}")
        print("Please train the model first or place the trained .pth file in checkpoints/")
        return False
        
    print(f"Loading PyTorch generator weights from {weight_path}...")
    model = UNetGenerator(in_channels=1, out_channels=1)
    
    # Load state dict
    try:
        model.load_state_dict(torch.load(weight_path, map_location="cpu"))
    except Exception as e:
        print(f"[ERROR] Failed to load state dict: {e}")
        return False
        
    model.eval()
    
    # Standard dummy input: (BatchSize=1, Channels=1, Height=256, Width=256)
    dummy_input = torch.randn(1, 1, 256, 256)
    
    print(f"Exporting to ONNX format at {onnx_path}...")
    try:
        torch.onnx.export(
            model,
            dummy_input,
            str(onnx_path),
            export_params=True,
            opset_version=14,
            do_constant_folding=True,
            input_names=["input"],
            output_names=["output"],
            dynamic_axes={
                "input": {0: "batch_size"},
                "output": {0: "batch_size"}
            }
        )
        print("-------------------------------------------------------")
        print(f"[SUCCESS] ONNX Model exported successfully!")
        print(f"File Path: {onnx_path}")
        print(f"File Size: {onnx_path.stat().st_size / (1024*1024):.2f} MB")
        print("-------------------------------------------------------")
        return True
    except Exception as e:
        print(f"[ERROR] Export failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export PyTorch Sketch Enhancer to ONNX")
    parser.add_argument("--weights", type=str, default="sketch_enhancer_best.pth", help="Checkpoint pth filename")
    parser.add_argument("--output", type=str, default="sketch_enhancer.onnx", help="Exported onnx filename")
    args = parser.parse_args()
    
    export(args.weights, args.output)
