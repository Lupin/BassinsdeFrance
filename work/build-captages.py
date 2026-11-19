"""Build the potable-water abstraction points from the 2026 Sandre PRL export."""

import csv
import json
import sys
from pathlib import Path

DIST = Path(__file__).resolve().parents[1] / 'outputs/au-fil-de-leau/dist'


def build(source):
    records = {}
    for row in csv.DictReader(source):
        if row.get('StOuvragePrel') != 'Validé' or not row.get('UsagePrinEauOuvragePrel', '').startswith('5'):
            continue
        if row.get('ProjCoordOuvragePrel') != '31':
            continue
        try:
            lon, lat = float(row['CoordXOuvragePrel']), float(row['CoordYOuvragePrel'])
        except (KeyError, TypeError, ValueError):
            continue
        if not (-5.6 <= lon <= 9.8 and 41.2 <= lat <= 51.3):
            continue
        code = row.get('CdOuvragePrel', '')
        if not code:
            continue
        records[code] = [row.get('NomOuvragePrel') or 'Captage d’eau potable',
                         [round(lon, 5), round(lat, 5)], code,
                         row.get('LbCommune') or row.get('ComOuvragePrel') or '']
    return list(records.values())


if __name__ == '__main__':
    with Path(sys.argv[1]).open(encoding='utf-8-sig', newline='') as source:
        records = build(source)
    if len(records) < 1000:
        raise SystemExit(f'Export incomplet : seulement {len(records)} captages utilisables')
    payload = json.dumps(records, ensure_ascii=True, separators=(',', ':'))
    (DIST / 'captages-data.js').write_text(f'window.WATER_CAPTAGES={payload};\n')
    print(f'{len(records):,} captages AEP/d’usage domestique · {len(payload)/1e6:.1f} Mo')
