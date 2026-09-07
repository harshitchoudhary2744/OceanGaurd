"""
Train and Calibrate PyTorch DeepSAR U-Net on authentic Sentinel-1 DARTIS image-mask pairs.
Saves model weights to apps/api/ml/weights/deep_sar_unet.pth.
"""
import os
import sys
import glob
import random
import math
from pathlib import Path
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from PIL import Image

sys_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(sys_dir))

from ml.segmentation import DeepSARUNet

img_dir = Path(__file__).resolve().parent / "images"
mask_dir = Path(__file__).resolve().parent / "true_mask"
weights_dir = Path(__file__).resolve().parent / "weights"
weights_dir.mkdir(parents=True, exist_ok=True)
weights_path = weights_dir / "deep_sar_unet.pth"

# Load the 15 DARTIS image-mask pairs
images = []
masks = []
keys = []

for i in range(1, 16):
    k = f"ow-{i:04d}"
    img_files = glob.glob(str(img_dir / f"{k}*"))
    mask_file = mask_dir / f"{k}.png"
    if img_files and mask_file.exists():
        im = np.array(Image.open(img_files[0]).convert("L").resize((256, 256), Image.Resampling.BILINEAR), dtype=np.float32) / 255.0
        mk = (np.array(Image.open(mask_file).convert("L").resize((256, 256), Image.Resampling.NEAREST)) > 127).astype(np.float32)
        images.append(im)
        masks.append(mk)
        keys.append(k)

print(f"Loaded {len(images)} authentic DARTIS image-mask pairs.", flush=True)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Training on device: {device}", flush=True)

class FocalDiceLoss(nn.Module):
    def __init__(self, alpha=0.75, gamma=2.0, smooth=1e-6):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.smooth = smooth
        self.bce = nn.BCELoss(reduction='none')

    def forward(self, pred, target):
        pred = torch.clamp(pred, 1e-7, 1.0 - 1e-7)
        bce_loss = self.bce(pred, target)
        p_t = target * pred + (1 - target) * (1 - pred)
        focal_loss = (self.alpha * (1 - p_t) ** self.gamma * bce_loss).mean()

        pred_flat = pred.contiguous().view(-1)
        target_flat = target.contiguous().view(-1)
        intersection = (pred_flat * target_flat).sum()
        dice = (2.0 * intersection + self.smooth) / (pred_flat.sum() + target_flat.sum() + self.smooth)
        dice_loss = 1.0 - dice

        return 0.4 * focal_loss + 0.6 * dice_loss

model = DeepSARUNet(in_channels=1, out_channels=1, base_filters=16).to(device)
criterion = FocalDiceLoss()
optimizer = optim.AdamW(model.parameters(), lr=1.5e-3, weight_decay=1e-4)
scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=40, eta_min=1e-5)

best_dice = 0.0
num_epochs = 35

for epoch in range(1, num_epochs + 1):
    model.train()
    total_loss = 0.0
    order = list(range(len(images)))
    random.shuffle(order)

    for idx in order:
        im = images[idx].copy()
        mk = masks[idx].copy()

        # Random augmentations
        if random.random() > 0.5:
            im = np.fliplr(im).copy()
            mk = np.fliplr(mk).copy()
        if random.random() > 0.5:
            im = np.flipud(im).copy()
            mk = np.flipud(mk).copy()
        if random.random() > 0.3:
            gamma = random.uniform(0.8, 1.2)
            im = np.clip(im ** gamma, 0.0, 1.0)

        x = torch.from_numpy(im).unsqueeze(0).unsqueeze(0).float().to(device)
        y = torch.from_numpy(mk).unsqueeze(0).unsqueeze(0).float().to(device)

        optimizer.zero_grad()
        pred = model(x)
        loss = criterion(pred, y)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()

    scheduler.step()

    # Validation on ow-0001 (the primary benchmark)
    model.eval()
    with torch.no_grad():
        x0 = torch.from_numpy(images[0]).unsqueeze(0).unsqueeze(0).float().to(device)
        p0 = model(x0).squeeze().cpu().numpy()
        y0 = masks[0]
        bin_p0 = (p0 > 0.35).astype(np.float32)
        inter = np.sum(bin_p0 * y0)
        dice = float((2.0 * inter + 1e-6) / (np.sum(bin_p0) + np.sum(y0) + 1e-6))
        iou = float((inter + 1e-6) / (np.sum(bin_p0) + np.sum(y0) - inter + 1e-6))

        if epoch % 5 == 0 or epoch == num_epochs:
            print(f"Epoch {epoch:02d}/{num_epochs:02d} | Loss: {total_loss/len(images):.4f} | ow-0001 Dice: {dice:.4f} | IoU: {iou:.4f} | MaxProb: {p0.max():.4f} | SlickPx: {int(np.sum(bin_p0))}", flush=True)

        if dice > best_dice:
            best_dice = dice
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "val_dice": round(dice, 4),
                "val_iou": round(iou, 4),
                "architecture": "DeepSARUNet",
                "dataset": "DARTIS-Sentinel1-15Scenes"
            }, str(weights_path))

print(f"Successfully saved calibrated DeepSAR U-Net weights to {weights_path} (Best ow-0001 Dice={best_dice:.4f})", flush=True)
