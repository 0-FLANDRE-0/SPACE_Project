"""Aggregate GHS-POP counts by existing spherical cells, never by planar distance.

Requires numpy, scipy, rasterio, pyproj. Pixel centres are the declared boundary
approximation at the original 1 km resolution. No additional area multiplier.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pyproj
import rasterio
from scipy.spatial import cKDTree

parser = argparse.ArgumentParser()
parser.add_argument('--raster', required=True)
parser.add_argument('--grid', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
grid = json.loads(Path(args.grid).read_text())
tiles = sorted(grid['tiles'], key=lambda t: t['id'])
vector = lambda p: [p['x'], p['y'], p['z']]
centres = np.array([vector(t['center']) for t in tiles])
normals = [np.array([vector(n) for n in t['edgeNormals']]) for t in tiles]
cos_radii = np.array([t['cosRadius'] for t in tiles])
tree = cKDTree(centres)
weights = [[] for _ in tiles]
pixel_counts = np.zeros(len(tiles), dtype=np.int64)
positive_count = valid_count = nodata_count = fallback_count = boundary_count = clipped_count = 0
global_parts = []
digest = hashlib.sha256()
with open(args.raster, 'rb') as source:
    for block in iter(lambda: source.read(4 * 1024 * 1024), b''):
        digest.update(block)

with rasterio.open(args.raster) as raster:
    if tuple(raster.res) != (1000, 1000) or 'Mollweide' not in raster.crs.to_wkt():
        raise ValueError('Expected original 1000 m World Mollweide product')
    transformer = pyproj.Transformer.from_crs(raster.crs, 'EPSG:4326', always_xy=True)
    for row in range(0, raster.height, 64):
        data = raster.read(1, window=((row, min(row + 64, raster.height)), (0, raster.width)))
        missing = data == raster.nodata
        if np.any(~np.isfinite(data)) or np.any((data < 0) & ~missing):
            raise ValueError('Unexpected missing/negative population value')
        nodata_count += int(missing.sum())
        valid_count += int((~missing).sum())
        rr, cc = np.nonzero(data > 0)
        if not len(rr):
            continue
        counts = data[rr, cc]
        x = raster.transform.c + (cc + .5) * raster.transform.a
        y = raster.transform.f + (rr + row + .5) * raster.transform.e
        lon, lat = transformer.transform(x, y)
        bad = ~np.isfinite(lon) | ~np.isfinite(lat)
        if np.any(bad):
            # A populated antimeridian edge cell can intersect the valid world
            # while its centre falls <= half a pixel outside the Mollweide oval.
            # Move only those centres to the same pixel's valid edge; retain ALL
            # their population. Larger excursions are errors, never dropped.
            radius = raster.crs.to_dict().get('a', 6378137.0)
            theta = np.arcsin(y[bad] / (np.sqrt(2) * radius))
            extent = 2 * np.sqrt(2) * radius * np.cos(theta)
            excess = np.abs(x[bad]) - extent
            if np.any(excess < 0) or np.any(excess > 500.001):
                raise ValueError('Populated pixel does not intersect valid world')
            fixed_x = np.sign(x[bad]) * (extent - 1e-5)
            fixed_lon, fixed_lat = transformer.transform(fixed_x, y[bad])
            lon[bad], lat[bad] = fixed_lon, fixed_lat
            clipped_count += int(bad.sum())
        if not np.all(np.isfinite(lon)) or not np.all(np.isfinite(lat)):
            raise ValueError('Population coordinate repair failed')
        lon, lat = np.radians(lon), np.radians(lat)
        points = np.column_stack((np.cos(lat) * np.cos(lon), np.sin(lat), -np.cos(lat) * np.sin(lon)))
        candidates = tree.query(points, k=4, workers=1)[1]
        assigned = np.full(len(points), len(tiles), dtype=np.int16)
        matches = np.zeros(len(points), dtype=np.int8)
        # A nearest-centre search only shortlists candidates. Acceptance ALWAYS
        # uses every spherical halfspace and the original angular bound.
        for index, tile in enumerate(tiles):
            subset = np.flatnonzero(np.any(candidates == index, axis=1))
            if not len(subset):
                continue
            selected = points[subset]
            inside = ((selected * centres[index]).sum(axis=1) >= cos_radii[index] - 1e-10)
            inside &= np.all(selected @ normals[index].T >= -1e-10, axis=1)
            accepted = subset[inside]
            assigned[accepted] = np.minimum(assigned[accepted], index)
            matches[accepted] += 1
        unresolved = np.flatnonzero(assigned == len(tiles))
        fallback_count += len(unresolved)
        for j in unresolved:
            found = [i for i in range(len(tiles)) if points[j] @ centres[i] >= cos_radii[i] - 1e-10
                     and np.all(normals[i] @ points[j] >= -1e-10)]
            if not found:
                raise ValueError('No spherical cell for population pixel')
            assigned[j] = min(found)
        boundary_count += int((matches > 1).sum())
        positive_count += len(points)
        global_parts.append(math.fsum(map(float, counts)))
        for i in np.unique(assigned):
            selected = assigned == i
            weights[i].append(math.fsum(map(float, counts[selected])))
            pixel_counts[i] += int(selected.sum())
        if row % 1024 == 0:
            print(f'row {row}/{raster.height}, mapped {positive_count} populated pixels', flush=True)
    metadata = dict(width=raster.width, height=raster.height, crsWkt=raster.crs.to_wkt(),
                    transform=list(raster.transform), noData=raster.nodata, dtype=raster.dtypes[0])

result = {
    'schemaVersion': 1, 'product': 'GHS-POP R2023A E2025', 'year': 2025,
    'resolutionMetres': 1000, 'quantity': 'persons per raster cell',
    'sourceSha256': digest.hexdigest(), 'gridFingerprint': grid['fingerprint'],
    'mapping': 'pixel-centre; inverse Mollweide; exact spherical halfspaces; antimeridian crossing cell centre clipped <=500m; boundary tie=tile ID ascending',
    'positivePixels': positive_count, 'validPixels': valid_count, 'noDataPixels': nodata_count,
    'fallbackPixels': fallback_count, 'antimeridianEdgeCentresClipped': clipped_count, 'boundaryTiePixels': boundary_count,
    'sourcePopulationPersons': math.fsum(global_parts), 'raster': metadata,
    'tiles': [{**{k: tiles[i][k] for k in ['id', 'latitudeDegrees', 'longitudeDegrees']},
               'weightPersons': math.fsum(weights[i]), 'positivePixels': int(pixel_counts[i])}
              for i in range(len(tiles))]
}
assert sum(map(int, pixel_counts)) == positive_count
assert math.isclose(math.fsum(t['weightPersons'] for t in result['tiles']), result['sourcePopulationPersons'], rel_tol=1e-14)
Path(args.output).write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({k: result[k] for k in ['positivePixels', 'fallbackPixels', 'boundaryTiePixels', 'sourcePopulationPersons']}))
