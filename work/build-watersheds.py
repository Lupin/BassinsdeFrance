"""Generate two resolutions of the metropolitan BD TOPAGE watershed polygons."""

import argparse
import json
from pathlib import Path
from zipfile import ZipFile

from pyproj import Transformer
from shapely import transform
from shapely.geometry import shape

DIST = Path(__file__).resolve().parents[1] / 'outputs/au-fil-de-leau/dist'
TO_WGS84 = Transformer.from_crs(2154, 4326, always_xy=True)
LEVELS = {'overview': 380, 'detail': 55}


def polygons(geometry, tolerance):
    simplified = geometry.simplify(tolerance, preserve_topology=True)
    projected = transform(simplified, TO_WGS84.transform, interleaved=False)
    parts = projected.geoms if projected.geom_type == 'MultiPolygon' else [projected]
    return [[[[round(lon, 5), round(lat, 5)] for lon, lat in ring.coords]
             for ring in (part.exterior, *part.interiors)]
            for part in parts if not part.is_empty]


def records(archive):
    data = {level: [] for level in LEVELS}
    with ZipFile(archive) as zipped, zipped.open('BassinVersantTopographique_FXX.geojson') as source:
        for line in source:
            line = line.strip().rstrip(b',')
            if not line.startswith(b'{ "type": "Feature"'):
                continue
            feature = json.loads(line)
            props = feature['properties']
            geometry = shape(feature['geometry'])
            for level, tolerance in LEVELS.items():
                data[level].append([props['CdOH'], props.get('TopoOH'),
                                    props.get('CdExutoire_1'), polygons(geometry, tolerance)])
    return data


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    for level, rows in records(parser.parse_args().archive).items():
        if not rows or len({row[0] for row in rows}) != len(rows):
            raise ValueError('Vérifier les identifiants et le contenu de l’archive')
        payload = json.dumps(rows, ensure_ascii=True, separators=(',', ':'))
        (DIST / f'watersheds-{level}-data.js').write_text(f'window.WATERSHEDS_{level.upper()}={payload};\n')
        print(level, len(rows), len(payload))
