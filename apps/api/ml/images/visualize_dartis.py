import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
from tensorflow import keras

IMAGE = "dartis/images/ow-0001.jpg"
MASK = "dartis/masks/ow-0001.png"
MODEL = "apps/api/models/unet_oilspill_dartis.h5"

# Load
img = Image.open(IMAGE).convert("L").resize(
    (256, 256),
    Image.Resampling.BILINEAR
)

gt = Image.open(MASK).convert("L").resize(
    (256, 256),
    Image.Resampling.NEAREST
)

img = np.asarray(img, dtype=np.float32) / 255.0
gt = np.asarray(gt, dtype=np.float32) / 255.0

# Model
model = keras.models.load_model(MODEL, compile=False)

pred = model.predict(
    img[np.newaxis, ..., np.newaxis],
    verbose=0
)[0, :, :, 0]

pred_mask = pred > 0.25

# Metrics
gt_mask = gt > 0.5

intersection = np.logical_and(pred_mask, gt_mask).sum()
union = np.logical_or(pred_mask, gt_mask).sum()

iou = intersection / (union + 1e-6)

dice = (
    2 * intersection /
    (pred_mask.sum() + gt_mask.sum() + 1e-6)
)

y, x = np.unravel_index(np.argmax(pred), pred.shape)

# ------------------------------------------------------------
# Plot
# ------------------------------------------------------------

fig, axes = plt.subplots(2, 2, figsize=(12, 10))

# Original
axes[0, 0].imshow(img, cmap="gray")
axes[0, 0].set_title("DARTIS Sentinel-1 Image")
axes[0, 0].axis("off")

# Ground truth
axes[0, 1].imshow(img, cmap="gray")
axes[0, 1].imshow(
    gt_mask,
    alpha=0.45
)
axes[0, 1].set_title("DARTIS Bounding-Box Mask")
axes[0, 1].axis("off")

# Probability
axes[1, 0].imshow(img, cmap="gray")
axes[1, 0].imshow(
    pred,
    alpha=0.65,
    vmin=0,
    vmax=1
)
axes[1, 0].plot(
    x, y,
    marker="x",
    markersize=12,
    markeredgewidth=3
)
axes[1, 0].set_title(
    f"Model Probability | max={pred.max():.3f}"
)
axes[1, 0].axis("off")

# Prediction overlay
axes[1, 1].imshow(img, cmap="gray")
axes[1, 1].imshow(
    pred_mask,
    alpha=0.5
)
axes[1, 1].set_title(
    f"Prediction | IoU={iou:.3f} | Dice={dice:.3f}"
)
axes[1, 1].axis("off")

plt.tight_layout()

output = "dartis_result_ow0001.png"
plt.savefig(output, dpi=150, bbox_inches="tight")

print(f"Saved: {output}")
print(f"IoU:   {iou:.4f}")
print(f"Dice:  {dice:.4f}")
print(f"Peak:  x={x}, y={y}")
