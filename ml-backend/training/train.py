import sys
from pathlib import Path
# Add project base directory to system path to avoid ModuleNotFoundError inside notebooks
sys.path.append(str(Path(__file__).resolve().parent.parent))

import os
import argparse
import time
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision.utils import save_image

from models_arch.generator import UNetGenerator
from models_arch.discriminator import PatchGANDiscriminator
from training.dataset import SketchPairDataset

# Default Hyperparameters
BATCH_SIZE = 128
LEARNING_RATE = 0.0002
BETA1 = 0.5
BETA2 = 0.999
LAMBDA_L1 = 100.0
EPOCHS = 20
SAVE_FREQ = 5
VAL_FREQ = 5

def train(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"=======================================================")
    print(f"Starting Pix2Pix GAN Training on device: {device}")
    print(f"Hyperparameters: Batch Size={args.batch_size}, Epochs={args.epochs}, LR={args.lr}")
    print(f"Mixed Precision Training (AMP): Enabled (FP16)")
    print(f"=======================================================")
    
    # 1. Setup Directories
    checkpoint_dir = Path(__file__).parent.parent / "checkpoints"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    
    sample_dir = Path(__file__).parent.parent / "data" / "samples"
    sample_dir.mkdir(parents=True, exist_ok=True)
    
    # 2. Setup Datasets & Dataloaders
    print("Loading datasets...")
    train_dataset = SketchPairDataset(split="train", dynamic_corruption=args.dynamic)
    val_dataset = SketchPairDataset(split="val", dynamic_corruption=args.dynamic)
    
    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True, num_workers=0, pin_memory=True, drop_last=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False, num_workers=0, pin_memory=True)
    
    print(f"[OK] Train samples: {len(train_dataset)}, Validation samples: {len(val_dataset)}")
    
    # 3. Instantiate Models
    net_g = UNetGenerator(in_channels=1, out_channels=1).to(device)
    net_d = PatchGANDiscriminator(in_channels=2).to(device)
    
    # Weight initialization helper
    def weights_init(m):
        classname = m.__class__.__name__
        if classname.find('Conv') != -1:
            nn.init.normal_(m.weight.data, 0.0, 0.02)
        elif classname.find('BatchNorm2d') != -1:
            nn.init.normal_(m.weight.data, 1.0, 0.02)
            nn.init.constant_(m.bias.data, 0.0)
            
    net_g.apply(weights_init)
    net_d.apply(weights_init)
    
    # 4. Loss Functions & Optimizers
    criterion_gan = nn.MSELoss()
    criterion_l1 = nn.L1Loss()
    
    optimizer_g = optim.Adam(net_g.parameters(), lr=args.lr, betas=(args.beta1, args.beta2))
    optimizer_d = optim.Adam(net_d.parameters(), lr=args.lr, betas=(args.beta1, args.beta2))
    
    # FP16 Automatic Mixed Precision (AMP) Scalers (Future-Proof)
    if hasattr(torch, "amp") and hasattr(torch.amp, "GradScaler"):
        scaler_g = torch.amp.GradScaler(device.type, enabled=(device.type == "cuda"))
        scaler_d = torch.amp.GradScaler(device.type, enabled=(device.type == "cuda"))
    else:
        scaler_g = torch.cuda.amp.GradScaler(enabled=(device.type == "cuda"))
        scaler_d = torch.cuda.amp.GradScaler(enabled=(device.type == "cuda"))
    
    # Learning rate decay schedulers (linear decay to 0 over the second half of training)
    def lambda_rule(epoch):
        lr_l = 1.0 - max(0, epoch + 1 - args.epochs // 2) / float(args.epochs // 2 + 1)
        return lr_l
        
    scheduler_g = optim.lr_scheduler.LambdaLR(optimizer_g, lr_lambda=lambda_rule)
    scheduler_d = optim.lr_scheduler.LambdaLR(optimizer_d, lr_lambda=lambda_rule)
    
    # Helper to construct autocast context
    def get_autocast_context():
        if hasattr(torch, "amp") and hasattr(torch.amp, "autocast"):
            return torch.amp.autocast(device.type, enabled=(device.type == "cuda"))
        return torch.cuda.amp.autocast(enabled=(device.type == "cuda"))
    
    # 5. Training Loop
    best_val_loss = float('inf')
    
    for epoch in range(1, args.epochs + 1):
        epoch_start_time = time.time()
        net_g.train()
        net_d.train()
        
        epoch_g_loss = 0.0
        epoch_d_loss = 0.0
        epoch_l1_loss = 0.0
        
        for i, (corr, clean) in enumerate(train_loader):
            corr = corr.to(device)
            clean = clean.to(device)
            
            # -----------------------------------------------------------
            # (A) Train Discriminator
            # -----------------------------------------------------------
            optimizer_d.zero_grad()
            
            with get_autocast_context():
                # Real Pair: (Corrupted, Clean)
                real_pair = torch.cat((corr, clean), 1)
                pred_real = net_d(real_pair)
                loss_d_real = criterion_gan(pred_real, torch.ones_like(pred_real))
                
                # Fake Pair: (Corrupted, Generated Clean)
                fake_clean = net_g(corr)
                fake_pair = torch.cat((corr, fake_clean.detach()), 1)
                pred_fake = net_d(fake_pair)
                loss_d_fake = criterion_gan(pred_fake, torch.zeros_like(pred_fake))
                
                # Total Discriminator Loss
                loss_d = (loss_d_real + loss_d_fake) * 0.5
            
            scaler_d.scale(loss_d).backward()
            scaler_d.step(optimizer_d)
            scaler_d.update()
            
            # -----------------------------------------------------------
            # (B) Train Generator
            # -----------------------------------------------------------
            optimizer_g.zero_grad()
            
            with get_autocast_context():
                # G wants D to classify fake pair as Real (ones)
                fake_pair_for_g = torch.cat((corr, fake_clean), 1)
                pred_fake_for_g = net_d(fake_pair_for_g)
                loss_g_gan = criterion_gan(pred_fake_for_g, torch.ones_like(pred_fake_for_g))
                
                # L1 Reconstruction Loss
                loss_g_l1 = criterion_l1(fake_clean, clean)
                
                # Total Generator Loss
                loss_g = loss_g_gan + args.lambda_l1 * loss_g_l1
                
            scaler_g.scale(loss_g).backward()
            scaler_g.step(optimizer_g)
            scaler_g.update()
            
            # Stats tracking
            epoch_g_loss += loss_g.item()
            epoch_d_loss += loss_d.item()
            epoch_l1_loss += loss_g_l1.item()
            
            if (i + 1) % 50 == 0 or (i + 1) == len(train_loader):
                print(f"  Epoch [{epoch}/{args.epochs}] Batch [{i+1}/{len(train_loader)}] "
                      f"D_Loss: {loss_d.item():.4f} G_Loss: {loss_g.item():.4f} L1_Loss: {loss_g_l1.item():.4f}")
                
        # Step Schedulers
        scheduler_g.step()
        scheduler_d.step()
        
        avg_g_loss = epoch_g_loss / len(train_loader)
        avg_d_loss = epoch_d_loss / len(train_loader)
        avg_l1_loss = epoch_l1_loss / len(train_loader)
        
        epoch_time = time.time() - epoch_start_time
        print(f"--> Epoch {epoch} Complete in {epoch_time:.2f}s ({len(train_loader) / epoch_time:.2f} batches/s). "
              f"Average D_Loss: {avg_d_loss:.4f}, G_Loss: {avg_g_loss:.4f}, L1: {avg_l1_loss:.4f}")
        
        # Save sample outputs periodically
        if epoch % 5 == 0:
            net_g.eval()
            with torch.no_grad():
                # Get a small batch of validation samples
                corr_val, clean_val = next(iter(val_loader))
                corr_val = corr_val.to(device)
                with get_autocast_context():
                    fake_val = net_g(corr_val)
                
                # Rescale from [-1, 1] to [0, 1] for saving
                comparison = torch.cat([corr_val[:4], fake_val[:4], clean_val[:4]], dim=0)
                comparison = (comparison + 1.0) / 2.0
                save_path = sample_dir / f"epoch_{epoch}.png"
                save_image(comparison, save_path, nrow=4)
                print(f"[SAMPLE] Saved comparison image grid to {save_path}")
                
        # Validation and saving best models
        if epoch % args.val_freq == 0:
            net_g.eval()
            val_l1 = 0.0
            with torch.no_grad():
                for corr_v, clean_v in val_loader:
                    corr_v = corr_v.to(device)
                    clean_v = clean_v.to(device)
                    with get_autocast_context():
                        fake_v = net_g(corr_v)
                        val_l1 += criterion_l1(fake_v, clean_v).item()

            avg_val_l1 = val_l1 / len(val_loader)
            print(f"[VAL] Epoch {epoch} Validation L1 Loss: {avg_val_l1:.4f}")
            
            if avg_val_l1 < best_val_loss:
                best_val_loss = avg_val_l1
                best_path = checkpoint_dir / "sketch_enhancer_best.pth"
                torch.save(net_g.state_dict(), best_path)
                print(f"[SAVE] New best validation L1 loss achieved. Saved to {best_path.name}")
                
        # Periodic model checkpoint
        if epoch % args.save_freq == 0:
            checkpoint_path = checkpoint_dir / f"generator_epoch_{epoch}.pth"
            torch.save(net_g.state_dict(), checkpoint_path)
            print(f"[SAVE] Saved periodic checkpoint to {checkpoint_path.name}")
            
    print(f"\n=======================================================")
    print(f"Pix2Pix GAN Training Completed!")
    print(f"Best Validation L1 Loss: {best_val_loss:.4f}")
    print(f"Model weight checkpoints stored in: {checkpoint_dir}")
    print(f"=======================================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pix2Pix GAN Sketch Enhancer Training")
    parser.add_argument("--epochs", type=int, default=EPOCHS, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=BATCH_SIZE, help="Batch size for training")
    parser.add_argument("--lr", type=float, default=LEARNING_RATE, help="Adam learning rate")
    parser.add_argument("--beta1", type=float, default=BETA1, help="Adam beta1 momentum")
    parser.add_argument("--beta2", type=float, default=BETA2, help="Adam beta2")
    parser.add_argument("--lambda_l1", type=float, default=LAMBDA_L1, help="Weight of L1 reconstruction loss")
    parser.add_argument("--save_freq", type=int, default=SAVE_FREQ, help="Frequency of saving pth checkpoints")
    parser.add_argument("--val_freq", type=int, default=VAL_FREQ, help="Frequency of running validation check")
    parser.add_argument("--dynamic", type=bool, default=False, help="Use dynamic on-the-fly corruptions")
    
    args = parser.parse_args(args=[])  # Empty list to safely execute inside Jupyter/Colab notebooks
    train(args)

