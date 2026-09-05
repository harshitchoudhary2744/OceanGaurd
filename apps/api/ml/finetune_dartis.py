import os
import random
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from PIL import Image

# ============================================================
# CONFIG
# ============================================================

IMAGE_DIR = "dartis/images"
MASK_DIR = "dartis/masks"

BASE_MODEL = "apps/api/models/unet_oilspill.h5"
OUTPUT_MODEL = "apps/api/models/unet_oilspill_dartis.h5"

IMG_SIZE = 256
BATCH_SIZE = 4
EPOCHS = 8
LEARNING_RATE = 1e-5

SEED = 42

random.seed(SEED)
np.random.seed(SEED)
tf.random.set_seed(SEED)

# ============================================================
# LOSS
# ============================================================

def dice_loss(y_true, y_pred, smooth=1e-6):
    y_true = tf.cast(y_true, tf.float32)
    y_pred = tf.cast(y_pred, tf.float32)

    intersection = tf.reduce_sum(y_true * y_pred, axis=[1, 2, 3])
    denominator = (
        tf.reduce_sum(y_true, axis=[1, 2, 3]) +
        tf.reduce_sum(y_pred, axis=[1, 2, 3])
    )

    dice = (2.0 * intersection + smooth) / (denominator + smooth)

    return 1.0 - tf.reduce_mean(dice)


def combined_loss(y_true, y_pred):
    bce = tf.reduce_mean(
        tf.keras.losses.binary_crossentropy(y_true, y_pred)
    )

    dice = dice_loss(y_true, y_pred)

    return bce + dice


def dice_metric(y_true, y_pred, smooth=1e-6):
    y_true = tf.cast(y_true, tf.float32)
    y_pred = tf.cast(y_pred > 0.25, tf.float32)

    intersection = tf.reduce_sum(y_true * y_pred, axis=[1, 2, 3])

    denominator = (
        tf.reduce_sum(y_true, axis=[1, 2, 3]) +
        tf.reduce_sum(y_pred, axis=[1, 2, 3])
    )

    dice = (2.0 * intersection + smooth) / (denominator + smooth)

    return tf.reduce_mean(dice)


def iou_metric(y_true, y_pred, smooth=1e-6):
    y_true = tf.cast(y_true, tf.float32)
    y_pred = tf.cast(y_pred > 0.25, tf.float32)

    intersection = tf.reduce_sum(y_true * y_pred, axis=[1, 2, 3])

    union = (
        tf.reduce_sum(y_true, axis=[1, 2, 3])
        + tf.reduce_sum(y_pred, axis=[1, 2, 3])
        - intersection
    )

    iou = (intersection + smooth) / (union + smooth)

    return tf.reduce_mean(iou)


# ============================================================
# DATA LOADING
# ============================================================

def load_pair(name):
    image_path = os.path.join(IMAGE_DIR, name + ".jpg")
    mask_path = os.path.join(MASK_DIR, name + ".png")

    image = Image.open(image_path).convert("L")
    mask = Image.open(mask_path).convert("L")

    image = image.resize(
        (IMG_SIZE, IMG_SIZE),
        Image.Resampling.BILINEAR
    )

    mask = mask.resize(
        (IMG_SIZE, IMG_SIZE),
        Image.Resampling.NEAREST
    )

    image = np.asarray(image, dtype=np.float32) / 255.0
    mask = np.asarray(mask, dtype=np.float32) / 255.0

    image = image[..., np.newaxis]
    mask = mask[..., np.newaxis]

    return image, mask


# ============================================================
# DATASET
# ============================================================

all_names = sorted([
    os.path.splitext(f)[0]
    for f in os.listdir(IMAGE_DIR)
    if f.endswith(".jpg")
    and os.path.exists(
        os.path.join(MASK_DIR, os.path.splitext(f)[0] + ".png")
    )
])

print(f"Total usable samples: {len(all_names)}")

random.shuffle(all_names)

# 80/20 split
split = int(len(all_names) * 0.8)

train_names = all_names[:split]
val_names = all_names[split:]

print(f"Training samples:   {len(train_names)}")
print(f"Validation samples: {len(val_names)}")

# IMPORTANT:
# ow-0001 is kept out of training so we can use it
# as a separate sanity-check image.
if "ow-0001" in train_names:
    train_names.remove("ow-0001")
    val_names.append("ow-0001")

print(f"Final training samples:   {len(train_names)}")
print(f"Final validation samples: {len(val_names)}")


def make_dataset(names, training=False):

    images = []
    masks = []

    for name in names:
        image, mask = load_pair(name)

        images.append(image)
        masks.append(mask)

    images = np.asarray(images, dtype=np.float32)
    masks = np.asarray(masks, dtype=np.float32)

    if training:

        # Simple SAR-safe augmentation.
        # No brightness/contrast manipulation.
        augmented_images = []
        augmented_masks = []

        for image, mask in zip(images, masks):

            # Original
            augmented_images.append(image)
            augmented_masks.append(mask)

            # Horizontal flip
            augmented_images.append(np.flip(image, axis=1))
            augmented_masks.append(np.flip(mask, axis=1))

            # Vertical flip
            augmented_images.append(np.flip(image, axis=0))
            augmented_masks.append(np.flip(mask, axis=0))

            # 90-degree rotation
            augmented_images.append(np.rot90(image, 1))
            augmented_masks.append(np.rot90(mask, 1))

        images = np.asarray(augmented_images, dtype=np.float32)
        masks = np.asarray(augmented_masks, dtype=np.float32)

    dataset = tf.data.Dataset.from_tensor_slices(
        (images, masks)
    )

    if training:
        dataset = dataset.shuffle(
            len(images),
            seed=SEED,
            reshuffle_each_iteration=True
        )

    dataset = dataset.batch(BATCH_SIZE)
    dataset = dataset.prefetch(tf.data.AUTOTUNE)

    return dataset


train_ds = make_dataset(train_names, training=True)
val_ds = make_dataset(val_names, training=False)

print(f"Training batches:   {len(list(train_ds))}")
print(f"Validation batches: {len(list(val_ds))}")


# ============================================================
# LOAD EXISTING MODEL
# ============================================================

print()
print("Loading existing U-Net...")

model = keras.models.load_model(
    BASE_MODEL,
    compile=False
)

print("Base model loaded.")
print("Input :", model.input_shape)
print("Output:", model.output_shape)


# ============================================================
# FREEZE EARLY ENCODER
# ============================================================

print()
print("Freezing early layers...")

# Freeze roughly the first 40% of layers.
# This preserves generic SAR features while allowing
# deeper layers / decoder to adapt to DARTIS.
freeze_until = int(len(model.layers) * 0.40)

for i, layer in enumerate(model.layers):

    if i < freeze_until:
        layer.trainable = False
    else:
        layer.trainable = True

trainable = sum(
    layer.trainable
    for layer in model.layers
)

print(f"Total layers:      {len(model.layers)}")
print(f"Frozen layers:     {freeze_until}")
print(f"Trainable layers:  {trainable}")


# ============================================================
# COMPILE
# ============================================================

model.compile(
    optimizer=keras.optimizers.Adam(
        learning_rate=LEARNING_RATE
    ),
    loss=combined_loss,
    metrics=[
        dice_metric,
        iou_metric
    ]
)


# ============================================================
# CALLBACKS
# ============================================================

callbacks = [

    keras.callbacks.ModelCheckpoint(
        OUTPUT_MODEL,
        monitor="val_iou_metric",
        mode="max",
        save_best_only=True,
        verbose=1
    ),

    keras.callbacks.EarlyStopping(
        monitor="val_iou_metric",
        mode="max",
        patience=3,
        restore_best_weights=True,
        verbose=1
    ),

    keras.callbacks.ReduceLROnPlateau(
        monitor="val_iou_metric",
        mode="max",
        factor=0.5,
        patience=1,
        min_lr=1e-7,
        verbose=1
    )
]


# ============================================================
# TRAIN
# ============================================================

print()
print("==============================================")
print("STARTING DARTIS FINE-TUNING")
print("==============================================")
print()

history = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=EPOCHS,
    callbacks=callbacks,
    verbose=1
)


# ============================================================
# SAVE FINAL MODEL
# ============================================================

model.save(OUTPUT_MODEL)

print()
print("==============================================")
print("FINE-TUNING COMPLETE")
print("==============================================")
print(f"Saved model: {OUTPUT_MODEL}")


# ============================================================
# VALIDATION
# ============================================================

print()
print("Evaluating validation set...")

results = model.evaluate(
    val_ds,
    verbose=1
)

for name, value in zip(model.metrics_names, results):
    print(f"{name}: {value:.4f}")


# ============================================================
# INDIVIDUAL OW-0001 TEST
# ============================================================

print()
print("==============================================")
print("OW-0001 SANITY CHECK")
print("==============================================")

image, mask = load_pair("ow-0001")

prediction = model.predict(
    image[np.newaxis, ...],
    verbose=0
)[0, :, :, 0]

pred_mask = prediction > 0.25
gt_mask = mask[:, :, 0] > 0.5

intersection = np.logical_and(
    pred_mask,
    gt_mask
).sum()

union = np.logical_or(
    pred_mask,
    gt_mask
).sum()

iou = intersection / (union + 1e-6)

dice = (
    2 * intersection /
    (pred_mask.sum() + gt_mask.sum() + 1e-6)
)

print(f"Max probability : {prediction.max():.6f}")
print(f"Mean probability: {prediction.mean():.6f}")
print(f"Predicted pixels: {pred_mask.sum()}")
print(f"GT pixels       : {gt_mask.sum()}")
print(f"IoU             : {iou:.4f}")
print(f"Dice            : {dice:.4f}")

# Strongest response
y, x = np.unravel_index(
    np.argmax(prediction),
    prediction.shape
)

print(f"Strongest response: x={x}, y={y}")

print()
print("DONE.")
