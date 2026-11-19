"""Build national previews from the detailed EAIP WMS at a supported scale."""

from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
import base64
import json

from PIL import Image

DIST = Path(__file__).resolve().parents[1] / 'outputs/au-fil-de-leau/dist'
ENDPOINT = 'https://mapsref.brgm.fr/wxs/georisques/risques'
BOX = (-620000, 5000000, 1140000, 6700000)
LAYERS = ('EAIP_CE_GE', 'EAIP_SM_GE')
GRID = 4
REQUEST_SIZE = 3600
PREVIEW_TILE = 384


def tile(job):
    layer, column, row = job
    west, south, east, north = BOX
    dx, dy = (east-west)//GRID, (north-south)//GRID
    left, top = west+column*dx, north-row*dy
    bbox = f'{left},{top-dy},{left+dx},{top}'
    params = dict(SERVICE='WMS', VERSION='1.3.0', REQUEST='GetMap', LAYERS=layer,
                  STYLES='', CRS='EPSG:3857', BBOX=bbox, WIDTH=REQUEST_SIZE,
                  HEIGHT=REQUEST_SIZE, FORMAT='image/png', TRANSPARENT='TRUE')
    with urlopen(ENDPOINT+'?'+urlencode(params), timeout=100) as response:
        image = Image.open(BytesIO(response.read())).convert('RGBA')
    alpha = image.getchannel('A').resize((PREVIEW_TILE, PREVIEW_TILE), Image.Resampling.BOX)
    # Slightly strengthen coverage after downsampling so narrow river valleys survive.
    return layer, column, row, alpha.point(lambda value: min(255, int(value*3.5)))


if __name__ == '__main__':
    size = GRID * PREVIEW_TILE
    previews = {layer: Image.new('L', (size, size)) for layer in LAYERS}
    jobs = [(layer, x, y) for layer in LAYERS for y in range(GRID) for x in range(GRID)]
    with ThreadPoolExecutor(max_workers=5) as pool:
        for layer, column, row, mask in pool.map(tile, jobs):
            previews[layer].paste(mask, (column*PREVIEW_TILE, row*PREVIEW_TILE))
            print(layer, column, row, mask.getbbox(), flush=True)
    payload = {'box':BOX, 'layers':{}}
    for layer, mask in previews.items():
        if not mask.getbbox():
            raise ValueError(f'Couche entièrement transparente : {layer}')
        image = Image.new('RGBA', mask.size, '#0968a8')
        image.putalpha(mask)
        stream = BytesIO()
        image.save(stream, format='PNG', optimize=True)
        payload['layers'][layer] = 'data:image/png;base64,' + base64.b64encode(stream.getvalue()).decode()
    (DIST / 'flood-overview-data.js').write_text('window.FLOOD_OVERVIEW='+json.dumps(payload, separators=(',', ':'))+';\n')
