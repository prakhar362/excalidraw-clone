import torch
import torch.nn as nn

class PatchGANDiscriminator(nn.Module):
    """
    70x70 PatchGAN Discriminator from Pix2Pix paper.
    Input: Concatenation of (corrupted_sketch, target_or_generated_sketch)
           Shape: (B, 2, 256, 256) since input & output are both 1-channel grayscale.
    Output: (B, 1, 30, 30) representing logits for patch classification.
    """
    def __init__(self, in_channels=2, num_filters=64):
        super(PatchGANDiscriminator, self).__init__()
        
        self.model = nn.Sequential(
            # Stage 1: (B, in_channels, 256, 256) -> (B, 64, 128, 128)
            nn.Conv2d(in_channels, num_filters, kernel_size=4, stride=2, padding=1),
            nn.LeakyReLU(0.2, inplace=True),
            
            # Stage 2: (B, 64, 128, 128) -> (B, 128, 64, 64)
            nn.Conv2d(num_filters, num_filters * 2, kernel_size=4, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(num_filters * 2),
            nn.LeakyReLU(0.2, inplace=True),
            
            # Stage 3: (B, 128, 64, 64) -> (B, 256, 32, 32)
            nn.Conv2d(num_filters * 2, num_filters * 4, kernel_size=4, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(num_filters * 4),
            nn.LeakyReLU(0.2, inplace=True),
            
            # Stage 4: (B, 256, 32, 32) -> (B, 512, 31, 31)
            # Note stride=1 here as per original Pix2Pix paper
            nn.Conv2d(num_filters * 4, num_filters * 8, kernel_size=4, stride=1, padding=1, bias=False),
            nn.BatchNorm2d(num_filters * 8),
            nn.LeakyReLU(0.2, inplace=True),
            
            # Stage 5: (B, 512, 31, 31) -> (B, 1, 30, 30)
            nn.Conv2d(num_filters * 8, 1, kernel_size=4, stride=1, padding=1)
        )

    def forward(self, x):
        return self.model(x)
