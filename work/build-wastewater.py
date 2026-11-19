"""Convert the national public ERU GeoJSON export into the atlas layer."""

import argparse
import json
import re
from pathlib import Path

DIST = Path(__file__).resolve().parents[1] / 'outputs/au-fil-de-leau/dist'


def stations(collection):
    records = {}
    for feature in collection['features']:
        props = feature['properties']
        code = props.get('Code_SANDRE', '')
        geometry = feature['geometry']
        if (not re.match(r'^[0-9]{2}(?:0[1-9]|[1-8][0-9]|9[0-5]|2[AB])', code)
                or props.get('Etat') != 'En service'
                or not geometry or geometry['type'] != 'Point'):
            continue
        longitude, latitude = geometry['coordinates'][:2]
        if not (-5.6 <= longitude <= 9.8 and 41.2 <= latitude <= 51.3):
            continue
        entry = [props.get('Nom') or 'Station d’épuration',
                 [round(longitude, 5), round(latitude, 5)], code,
                 props.get('Capacité_nominale')]
        if code in records and entry != records[code]:
            raise ValueError(f'Données contradictoires pour la station {code}')
        records[code] = entry
    return sorted(records.values(), key=lambda item: (-(item[3] or 0), item[2]))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('export', type=Path)
    export = parser.parse_args().export
    records = stations(json.loads(export.read_text(encoding='utf-8-sig')))
    if not records:
        parser.error('Aucune station d’épuration exploitable')
    payload = json.dumps(records, ensure_ascii=True, separators=(',', ':'))
    (DIST / 'wastewater-data.js').write_text(f'window.WATER_WASTEWATER={payload};\n')
    print(f'{len(records)} stations')
