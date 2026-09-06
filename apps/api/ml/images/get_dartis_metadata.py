import json
import sys

TSV = "dartis/dartis_metadata.tsv"
target = sys.argv[1] if len(sys.argv) > 1 else "ow-0001"

with open(TSV, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find actual table header
header_idx = None

for i, line in enumerate(lines):
    if line.startswith("Image set") and "Sentinel_ID" in line:
        header_idx = i
        break

if header_idx is None:
    raise RuntimeError("Could not find metadata table.")

# ------------------------------------------------------------
# PANGAEA columns we need are fixed in this dataset.
#
# 0  image set
# 1  image
# 2  xml
# 3  ID tag
# 4  patch name
# 5  acquisition start
# 6  acquisition end
# 7  Sentinel product
# 8  width
# 9  height
# 10-17 patch corners
# 18-25 object WGS84 corners
# 26-29 object pixel bbox
# 30 object size
# ------------------------------------------------------------

found = None

for line in lines[header_idx + 1:]:
    if not line.strip():
        continue

    values = line.rstrip("\n").split("\t")

    if len(values) < 30:
        continue

    if values[1].strip() == f"{target}.jpg":
        found = values
        break

if found is None:
    raise RuntimeError(f"Could not find {target}")

v = [x.strip() for x in found]

result = {
    "image": v[1],
    "image_set": v[0],
    "patch_id": v[4],

    "sentinel_product": v[7],

    "acquisition_start": v[5],
    "acquisition_end": v[6],

    "patch_size": {
        "width": int(v[8]),
        "height": int(v[9])
    },

    "patch_corners_wgs84": {
        "UL": [float(v[10]), float(v[11])],
        "UR": [float(v[12]), float(v[13])],
        "BR": [float(v[14]), float(v[15])],
        "BL": [float(v[16]), float(v[17])]
    },

    "oil_object_corners_wgs84": {
        "UL": [float(v[18]), float(v[19])],
        "UR": [float(v[20]), float(v[21])],
        "BR": [float(v[22]), float(v[23])],
        "BL": [float(v[24]), float(v[25])]
    },

    "pixel_bbox": {
        "xmin": int(v[26]),
        "ymin": int(v[27]),
        "xmax": int(v[28]),
        "ymax": int(v[29])
    },

    "object_size_pixels": int(v[30])
}

print(json.dumps(result, indent=2))

output = f"dartis/{target}_metadata.json"

with open(output, "w", encoding="utf-8") as f:
    json.dump(result, f, indent=2)

print()
print(f"Saved: {output}")
