import torch
import torch.nn as nn

class UNetBlock(nn.Module):
    def __init__(self, in_channels, out_channels, submodule=None, innermost=False, outermost=False, use_dropout=False):
        super(UNetBlock, self).__init__()
        self.outermost = outermost
        
        # Downsampling block (LeakyReLU -> Conv -> BatchNorm)
        # Upsampling block (ReLU -> ConvTranspose -> BatchNorm)
        
        downconv = nn.Conv2d(in_channels, out_channels, kernel_size=4, stride=2, padding=1, bias=False)
        downrelu = nn.LeakyReLU(0.2, True)
        
        if outermost:
            upconv = nn.ConvTranspose2d(out_channels * 2, in_channels, kernel_size=4, stride=2, padding=1)
            down = [downconv]
            up = [nn.ReLU(True), upconv, nn.Tanh()]
            model = down + [submodule] + up
        elif innermost:
            upconv = nn.ConvTranspose2d(out_channels, in_channels, kernel_size=4, stride=2, padding=1, bias=False)
            down = [downrelu, downconv]
            up = [nn.ReLU(True), upconv, nn.BatchNorm2d(in_channels)]
            model = down + up
        else:
            upconv = nn.ConvTranspose2d(out_channels * 2, in_channels, kernel_size=4, stride=2, padding=1, bias=False)
            down = [downrelu, downconv, nn.BatchNorm2d(out_channels)]
            up = [nn.ReLU(True), upconv, nn.BatchNorm2d(in_channels)]
            
            if use_dropout:
                model = down + [submodule] + up + [nn.Dropout(0.5)]
            else:
                model = down + [submodule] + up
                
        self.model = nn.Sequential(*model)

    def forward(self, x):
        if self.outermost:
            return self.model(x)
        else:
            # Skip connection by concatenating along channels
            return torch.cat([x, self.model(x)], 1)

class UNetGenerator(nn.Module):
    """
    Standard U-Net-256 Generator from Pix2Pix paper (Isola et al.).
    Input: (B, 1, 256, 256) grayscale corrupted sketch
    Output: (B, 1, 256, 256) grayscale clean sketch
    """
    def __init__(self, in_channels=1, out_channels=1, num_filters=64):
        super(UNetGenerator, self).__init__()
        
        # Build U-Net from the inside out
        # Innermost block
        unet_block = UNetBlock(num_filters * 8, num_filters * 8, submodule=None, innermost=True)
        
        # Add intermediate blocks with 512 channels
        unet_block = UNetBlock(num_filters * 8, num_filters * 8, submodule=unet_block, use_dropout=True)
        unet_block = UNetBlock(num_filters * 8, num_filters * 8, submodule=unet_block, use_dropout=True)
        unet_block = UNetBlock(num_filters * 8, num_filters * 8, submodule=unet_block, use_dropout=True)
        
        # Gradually decrease channel size to 256, 128, 64
        unet_block = UNetBlock(num_filters * 4, num_filters * 8, submodule=unet_block)
        unet_block = UNetBlock(num_filters * 2, num_filters * 4, submodule=unet_block)
        unet_block = UNetBlock(num_filters, num_filters * 2, submodule=unet_block)
        
        # Outermost block (which has in_channels input, out_channels output)
        self.model = UNetBlock(out_channels, num_filters, submodule=unet_block, outermost=True)

    def forward(self, x):
        return self.model(x)
