"""Build a compact, search-only commune index from the French admin API."""

import json
from datetime import date
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'outputs/au-fil-de-leau/dist'
API = 'https://geo.api.gouv.fr/communes'


def build():
    admin_text = (DIST / 'admin.js').read_text(encoding='utf-8')
    admin = json.loads(admin_text.removeprefix('window.ADMIN=').rstrip(';'))
    departments = {item['code'] for item in admin['departments']}
    query = urlencode({
        'fields': 'code,nom,mairie,codeDepartement',
        'format': 'json',
    })
    request = Request(API + '?' + query, headers={'User-Agent': 'BassinsDeFrance/1.0'})
    with urlopen(request, timeout=60) as response:
        source = json.load(response)

    records = []
    codes = set()
    for commune in source:
        department = commune.get('codeDepartement')
        if department not in departments:
            continue
        code = commune.get('code')
        name = commune.get('nom')
        coordinates = (commune.get('mairie') or {}).get('coordinates')
        if not code or not name or not coordinates or code in codes:
            continue
        lon, lat = coordinates
        if not (-5.7 <= lon <= 9.9 and 41.1 <= lat <= 51.4):
            continue
        codes.add(code)
        # [INSEE code, name, longitude, latitude, department code]
        records.append([code, name, lon, lat, department])

    if len(records) < 34_000:
        raise SystemExit(f'Export incomplet : seulement {len(records):,} communes utilisables')

    records.sort(key=lambda item: item[0])
    payload = json.dumps(records, ensure_ascii=False, separators=(',', ':'))
    header = f'// API Découpage administratif · extrait {date.today().isoformat()} · communes des départements couverts par l’atlas\n'
    (DIST / 'communes-data.js').write_text(header + f'window.COMMUNES={payload};\n', encoding='utf-8')
    return records, len(payload.encode('utf-8'))


if __name__ == '__main__':
    records, size = build()
    print(f'{len(records):,} communes · {size / 1_000_000:.2f} Mo non compressés')
