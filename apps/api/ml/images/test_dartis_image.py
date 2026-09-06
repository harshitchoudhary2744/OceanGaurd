import sys
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
from tensorflow import keras

name = sys.argv[1] if len(sys.argv) > 1 else "ow-0050"

IMAGE = f"dartis/images/{name}.jpg"
MASK = f"dartis/masks/{name}.png"
MODEL = "apps/api/models/unet_oilspill_dartis.h5"

# Load image + GT
img = Image.open(IMAGE).convert("L").resize(
    (256, 256), Image.Resampling.BILINEAR
)

gt = Image.open(MASK).convert("L").resize(
    (256, 256), Image.Resampling.NEAREST
)

img = np.asarray(img, dtype=np.float32) / 255.0
gt = np.asarray(gt, dtype=np.float32) / 255.0

# Predict
model = keras.models.load_model(MODEL, compile=False)

pred = model.predict(
    img[np.newaxis, ..., np.newaxis],
    verbose=0
)[0, :, :, 0]

pred_mask = pred > 0.25
gt_mask = gt > 0.5

# Metrics
intersection = np.logical_and(pred_mask, gt_mask).sum()
union = np.logical_or(pred_mask, gt_mask).sum()

iou = intersection / (union + 1e-6)

dice = (
    2 * intersection /
    (pred_mask.sum() + gt_mask.sum() + 1e-6)
)

# Strongest response
y, x = np.unravel_index(np.argmax(pred), pred.shape)

# Probability inside GT box
gt_probs = pred[gt_mask]

print()
print("==============================================")
print(f"DARTIS TEST: {name}")
print("==============================================")
print(f"Image size      : {img.shape}")
print(f"GT pixels       : {gt_mask.sum()}")
print(f"Predicted pixels: {pred_mask.sum()}")
print(f"Max probability : {pred.max():.6f}")
print(f"Mean probability: {pred.mean():.6f}")
print(f"IoU             : {iou:.4f}")
print(f"Dice            : {dice:.4f}")
print(f"Strongest response: x={x}, y={y}")

if len(gt_probs):
    print(f"GT-box max prob : {gt_probs.max():.6f}")
    print(f"GT-box mean prob: {gt_probs.mean():.6f}")

# Visual
fig, axes = plt.subplots(2, 2, figsize=(12, 10))

axes[0, 0].imshow(img, cmap="gray")
axes[0, 0].set_title(f"DARTIS Image — {name}")
axes[0, 0].axis("off")

axes[0, 1].imshow(img, cmap="gray")
axes[0, 1].imshow(gt_mask, alpha=0.45)
axes[0, 1].set_title("Ground Truth Bounding Box")
axes[0, 1].axis("off")

axes[1, 0].imshow(img, cmap="gray")
axes[1, 0].imshow(pred, alpha=0.65, vmin=0, vmax=1)
axes[1, 0].plot(
    x, y, marker="x",
    markersize=12,
    markeredgewidth=3
)
axes[1, 0].set_title(
    f"Probability — max {pred.max():.3f}"
)
axes[1, 0].axis("off")

axes[1, 1].imshow(img, cmap="gray")
axes[1, 1].imshow(pred_mask, alpha=0.5)
axes[1, 1].set_title(
    f"Prediction — IoU {iou:.3f}, Dice {dice:.3f}"
)
axes[1, 1].axis("off")

plt.tight_layout()

output = f"dartis_result_{name}.png"
plt.savefig(output, dpi=150, bbox_inches="tight")

print(f"\nSaved visual: {output}")
