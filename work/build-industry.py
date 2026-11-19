"""Convert the public Géorisques ICPE CSV into the metropolitan atlas layer."""

import argparse
import csv
import json
from pathlib import Path

from pyproj import Transformer

DIST = Path(__file__).resolve().parents[1] / 'outputs/au-fil-de-leau/dist'


def installations(rows):
    from_lambert = Transformer.from_crs(2154, 4326, always_xy=True)
    records = {}
    for row in rows:
        seuil = {'1': 2, '2': 1}.get(row['seveso'], 0)
        if row['code_epsg'] != '2154' or not (seuil or row['industrie'] == '1'):
            continue
        code = row['code_aiot']
        if not code.isdigit() or not row['x'] or not row['y']:
            continue
        lon, lat = from_lambert.transform(float(row['x']), float(row['y']))
        if not (-5.6 <= lon <= 9.8 and 41.2 <= lat <= 51.3):
            continue
        entry = [row['nom_ets'] or 'Installation répertoriée',
                 [round(lon, 5), round(lat, 5)], code,
                 seuil, row['commune'], row['lib_regime']]
        if code in records and records[code] != entry:
            raise ValueError(f'Données contradictoires pour {code}')
        records[code] = entry
    return sorted(records.values(), key=lambda item: (-item[3], item[2]))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('export', type=Path)
    with parser.parse_args().export.open(encoding='utf-8-sig', newline='') as source:
        records = installations(csv.DictReader(source, delimiter=';'))
    if not records or not all(any(row[3] == group for row in records) for group in (0, 1, 2)):
        parser.error('Export incomplet : vérifier la présence des trois catégories')
    payload = json.dumps(records, ensure_ascii=True, separators=(',', ':'))
    (DIST / 'industry-data.js').write_text(f'window.WATER_INDUSTRY={payload};\n')
    for group in (0, 1, 2):
        print(group, sum(row[3] == group for row in records))
