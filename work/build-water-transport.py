"""Build lazy browser layers from the BD TOPAGE zip and IGN and Sandre GeoJSON exports."""

import argparse
import json
from pathlib import Path
from zipfile import ZipFile

from pyproj import Transformer
from shapely import transform
from shapely.geometry import shape

DIST = Path(__file__).resolve().parents[1] / 'outputs/au-fil-de-leau/dist'
def write_layer(key, items):
    if not items:
        raise ValueError(f'Aucune donnée pour {key}')
    payload = json.dumps(items, ensure_ascii=True, separators=(',', ':'))
    (DIST / f'{key}-data.js').write_text(f'window.WATER_{key.upper()}={payload};\n')
    print(key, len(items))


def rounded(coordinates):
    return [[round(x, 5), round(y, 5)] for x, y, *_ in coordinates]


def lakes(archive):
    to_wgs84 = Transformer.from_crs(2154, 4326, always_xy=True)
    result = []
    with ZipFile(archive) as zipped:
        with zipped.open('PlanEau_FXX.geojson') as stream:
            for line in stream:
                line = line.strip().rstrip(b',')
                if not line.startswith(b'{ "type": "Feature"'):
                    continue
                feature = json.loads(line)
                properties = feature['properties']
                geometry = shape(feature['geometry'])
                hectares = geometry.area / 10000
                if hectares < 5:
                    continue
                geometry = transform(geometry.simplify(16, preserve_topology=True), to_wgs84.transform, interleaved=False)
                parts = geometry.geoms if geometry.geom_type == 'MultiPolygon' else [geometry]
                polygons = [[rounded(ring.coords) for ring in (polygon.exterior, *polygon.interiors)]
                            for polygon in parts if not polygon.is_empty]
                if polygons:
                    result.append([properties.get('TopoOH') or properties.get('NaturePE') or 'Plan d’eau',
                                   round(hectares, 1), polygons])
    return sorted(result, key=lambda item: item[1], reverse=True)


def navigation(paths):
    result = {}
    expected = None
    for path in paths:
        data = json.loads(path.read_text())
        if expected is not None and data['numberMatched'] != expected:
            raise ValueError('Le référentiel IGN a changé entre deux pages')
        expected = data['numberMatched']
        for feature in data['features']:
            properties = feature['properties']
            key = properties['cleabs']
            if key in result or not properties['navigabilite']:
                raise ValueError(f'Tronçon en double ou non navigable : {key}')
            geom = shape(feature['geometry']).simplify(0.00008, preserve_topology=True)
            parts = geom.geoms if geom.geom_type == 'MultiLineString' else [geom]
            name = properties.get('cpx_toponyme_de_cours_d_eau') or 'Voie navigable'
            result[key] = [[name, rounded(line.coords)] for line in parts if not line.is_empty]
    if len(result) != expected:
        raise ValueError('Export IGN incomplet')
    return [line for parts in result.values() for line in parts]


def locks(path):
    data = json.loads(path.read_text())
    if len(data['features']) != data['numberMatched']:
        raise ValueError('Export Sandre incomplet')
    result = []
    for feature in data['features']:
        props = feature['properties']
        codes = [props.get(f'CdTypeDispFranchNavig{i}') for i in (1, 2, 3)]
        if '1' not in codes or props['LbEtOuvrage'] != 'Existant':
            raise ValueError(f'Ouvrage inattendu : {props["CdObstEcoul"]}')
        coordinates = feature['geometry']['coordinates']
        result.append([props.get('NomPrincipalObstEcoul') or 'Écluse',
                       rounded([coordinates])[0], props['CdObstEcoul']])
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lakes', type=Path)
    parser.add_argument('--navigation', type=Path, nargs='+')
    parser.add_argument('--locks', type=Path)
    args = parser.parse_args()
    if args.lakes:
        write_layer('lakes', lakes(args.lakes))
    if args.navigation:
        write_layer('navigation', navigation(args.navigation))
    if args.locks:
        write_layer('locks', locks(args.locks))
