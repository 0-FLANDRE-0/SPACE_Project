#!/usr/bin/env python3
"""Offline only: rasterize pinned Natural Earth polygons at 0.5° pixel centers.
Fetch ne_50m_land.geojson from the documented v5.1.2 URL first. Pillow required.
"""
from pathlib import Path
import hashlib, json
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[1]
source=root/'artifacts/natural-earth/ne_50m_land.geojson'
data=json.loads(source.read_text())
scale=16
image=Image.new('1',(720*scale,360*scale)); draw=ImageDraw.Draw(image)
for feature in data['features']:
    geometry=feature['geometry']
    polygons=[geometry['coordinates']] if geometry['type']=='Polygon' else geometry['coordinates']
    for polygon in polygons:
        for i,ring in enumerate(polygon):
            # Pixel centers are longitude=-179.75+x*.5, latitude=89.75-y*.5.
            draw.polygon([((lon+180)*2*scale,(90-lat)*2*scale) for lon,lat in ring],fill=1 if i==0 else 0)
pixels=[int(bool(image.getpixel((x*scale+scale//2,y*scale+scale//2)))) for y in range(360) for x in range(720)]
image=Image.new('1',(720,360));image.putdata(pixels)
out=root/'artifacts/natural-earth'
(out/'mask.json').write_text(json.dumps({'width':720,'height':360,'pixels':pixels,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()}))
image.convert('L').save(out/'land-mask.png')
