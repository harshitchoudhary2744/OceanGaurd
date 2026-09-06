import json
import numpy as np
from PIL import Image
from tensorflow import keras

NAME = "ow-0001"

IMAGE = f"dartis/images/{NAME}.jpg"
META = f"dartis/{NAME}_metadata.json"
MODEL = "apps/api/models/unet_oilspill_dartis.h5"

# ------------------------------------------------------------
# Load metadata
# ------------------------------------------------------------

with open(META) as f:
    meta = json.load(f)

# ------------------------------------------------------------
# Load image
# ------------------------------------------------------------

img = Image.open(IMAGE).convert("L").resize(
    (256, 256),
    Image.Resampling.BILINEAR
)

img = np.asarray(img, dtype=np.float32) / 255.0

# ------------------------------------------------------------
# Model prediction
# ------------------------------------------------------------

model = keras.models.load_model(
    MODEL,
    compile=False
)

prob = model.predict(
    img[np.newaxis, ..., np.newaxis],
    verbose=0
)[0, :, :, 0]

pred = prob > 0.25

# ------------------------------------------------------------
# Coordinate conversion
# ------------------------------------------------------------

corners = meta["patch_corners_wgs84"]

# Each point is [longitude, latitude]
UL = np.array(corners["UL"], dtype=float)
UR = np.array(corners["UR"], dtype=float)
BR = np.array(corners["BR"], dtype=float)
BL = np.array(corners["BL"], dtype=float)


def pixel_to_wgs84(x, y):
    """
    Bilinear interpolation from 256x256 image
    coordinates to the four WGS84 patch corners.
    """

    u = x / 255.0
    v = y / 255.0

    top = UL * (1 - u) + UR * u
    bottom = BL * (1 - u) + BR * u

    point = top * (1 - v) + bottom * v

    return point


# ------------------------------------------------------------
# Predicted pixels
# ------------------------------------------------------------

ys, xs = np.where(pred)

if len(xs) == 0:
    print("No predicted oil pixels.")
    exit()

# Geographic coordinates of all predicted pixels
geo_points = np.array([
    pixel_to_wgs84(x, y)
    for x, y in zip(xs, ys)
])

# ------------------------------------------------------------
# Strongest response
# ------------------------------------------------------------

peak_y, peak_x = np.unravel_index(
    np.argmax(prob),
    prob.shape
)

peak_lon, peak_lat = pixel_to_wgs84(
    peak_x,
    peak_y
)

# ------------------------------------------------------------
# Geographic extent of prediction
# ------------------------------------------------------------

pred_lon_min = geo_points[:, 0].min()
pred_lon_max = geo_points[:, 0].max()

pred_lat_min = geo_points[:, 1].min()
pred_lat_max = geo_points[:, 1].max()

# ------------------------------------------------------------
# Known DARTIS oil object
# ------------------------------------------------------------

obj = meta["oil_object_corners_wgs84"]

obj_points = np.array([
    obj["UL"],
    obj["UR"],
    obj["BR"],
    obj["BL"]
])

obj_lon_min = obj_points[:, 0].min()
obj_lon_max = obj_points[:, 0].max()

obj_lat_min = obj_points[:, 1].min()
obj_lat_max = obj_points[:, 1].max()

# ------------------------------------------------------------
# Print results
# ------------------------------------------------------------

print()
print("==============================================")
print("DARTIS GEOLOCATION")
print("==============================================")

print(f"Image             : {NAME}")
print(f"Sentinel product  : {meta['sentinel_product']}")
print(f"Acquisition start : {meta['acquisition_start']}")
print(f"Acquisition end   : {meta['acquisition_end']}")

print()
print("MODEL")
print(f"Predicted pixels  : {len(xs)}")
print(f"Peak pixel        : ({peak_x}, {peak_y})")
print(f"Peak probability  : {prob[peak_y, peak_x]:.6f}")

print()
print("PREDICTED WGS84")
print(f"Peak longitude    : {peak_lon:.8f}")
print(f"Peak latitude     : {peak_lat:.8f}")

print()
print("Predicted extent:")
print(f"Longitude         : {pred_lon_min:.8f} → {pred_lon_max:.8f}")
print(f"Latitude          : {pred_lat_min:.8f} → {pred_lat_max:.8f}")

print()
print("KNOWN DARTIS OBJECT")
print(f"Longitude         : {obj_lon_min:.8f} → {obj_lon_max:.8f}")
print(f"Latitude          : {obj_lat_min:.8f} → {obj_lat_max:.8f}")

# ------------------------------------------------------------
# Check whether model peak falls inside known object
# ------------------------------------------------------------

inside = (
    obj_lon_min <= peak_lon <= obj_lon_max
    and
    obj_lat_min <= peak_lat <= obj_lat_max
)

print()
print("==============================================")

if inside:
    print("✅ MODEL PEAK IS INSIDE THE KNOWN OIL OBJECT")
else:
    print("❌ MODEL PEAK IS OUTSIDE THE KNOWN OIL OBJECT")

print("==============================================")

# ------------------------------------------------------------
# Save result
# ------------------------------------------------------------

result = {
    "image": NAME,
    "sentinel_product": meta["sentinel_product"],
    "acquisition_start": meta["acquisition_start"],
    "acquisition_end": meta["acquisition_end"],

    "prediction": {
        "pixel_peak": [
            int(peak_x),
            int(peak_y)
        ],

        "probability": float(
            prob[peak_y, peak_x]
        ),

        "wgs84_peak": [
            float(peak_lon),
            float(peak_lat)
        ],

        "predicted_extent": {
            "min_lon": float(pred_lon_min),
            "max_lon": float(pred_lon_max),
            "min_lat": float(pred_lat_min),
            "max_lat": float(pred_lat_max)
        }
    },

    "known_object": {
        "corners_wgs84": meta["oil_object_corners_wgs84"],
        "extent": {
            "min_lon": float(obj_lon_min),
            "max_lon": float(obj_lon_max),
            "min_lat": float(obj_lat_min),
            "max_lat": float(obj_lat_max)
        }
    },

    "peak_inside_known_object": bool(inside)
}

output = f"dartis/{NAME}_geolocation.json"

with open(output, "w") as f:
    json.dump(result, f, indent=2)

print()
print(f"Saved: {output}")
