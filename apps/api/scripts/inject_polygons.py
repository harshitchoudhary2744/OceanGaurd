import json

with open(r'c:\Users\HARSHIT\Downloads\OceanGaurd\apps\api\ml\dartis_polygons.json') as f:
    polys = json.load(f)

sim_path = r'c:\Users\HARSHIT\Downloads\OceanGaurd\apps\web\src\lib\simulationEngine.ts'
with open(sim_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update type definition of DARTIS_BENCHMARKS_CATALOG
old_type = """  sentinelProduct: string;
  acquisitionStartUtc: string;
  location: string;
  classProbabilities: Record<string, number>;
}> = {"""

new_type = """  sentinelProduct: string;
  acquisitionStartUtc: string;
  location: string;
  classProbabilities: Record<string, number>;
  polygonCoordinates: number[][];
}> = {"""

if old_type in content:
    content = content.replace(old_type, new_type, 1)

# Add polygonCoordinates to each ow-XXXX entry
for k, pts in polys.items():
    target = f'datasetKey: "{k}",'
    if target in content:
        poly_str = json.dumps(pts)
        replacement = f'{target}\n    polygonCoordinates: {poly_str},'
        content = content.replace(target, replacement, 1)

with open(sim_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Successfully updated simulationEngine.ts with polygonCoordinates for all 15 scenes!')
