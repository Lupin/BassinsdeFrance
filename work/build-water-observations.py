"""Prepare compact national Hub'Eau snapshots; raw responses are cached outside Git."""
import calendar
import concurrent.futures
from datetime import date
import json
from pathlib import Path
import subprocess
from urllib.parse import urlencode

DIST = Path(__file__).resolve().parents[1] / 'outputs/au-fil-de-leau/dist'
CACHE = Path('/tmp/bassins-hubeau-cache')
CACHE.mkdir(exist_ok=True)
TODAY = date.today().isoformat()


def fetch(api, endpoint, **params):
    params = dict(params, size=5000, format='json')
    rows = []
    page = 1
    while True:
        query = urlencode(dict(params, page=page))
        url = f'https://hubeau.eaufrance.fr/api/{api}/{endpoint}?{query}'
        import hashlib
        cache = CACHE / (hashlib.sha256(url.encode()).hexdigest()+'.json')
        if not cache.exists():
            download_url = url
            if api=='v1/prelevements':
                download_url += '&fields=code_ouvrage,nom_ouvrage,nom_commune,longitude,latitude,annee,code_usage,libelle_usage,volume,libelle_qualification_volume,libelle_statut_instruction'
            raw = subprocess.check_output(['curl', '-fsSL', '--retry', '2', '--max-time', '40', download_url])
            parsed = json.loads(raw)
            if 'data' not in parsed:
                raise ValueError(parsed)
            temporary=cache.with_suffix('.part')
            temporary.write_bytes(raw)
            temporary.replace(cache)
        data = json.loads(cache.read_bytes())
        rows.extend(data['data'])
        if not data.get('next'):
            if len(rows) != data['count']:
                raise ValueError(f"Incomplete extract {url}: {len(rows)} / {data['count']}")
            return rows
        page += 1


def location(row):
    try:
        lon, lat = float(row['longitude']), float(row['latitude'])
        if -5.6 <= lon <= 9.8 and 41.2 <= lat <= 51.3:
            return [round(lon, 5), round(lat, 5)]
    except (KeyError, TypeError, ValueError):
        pass


def compact(name, data):
    if data.get('encoding') == 1:
        return data
    for record in data['records']:
        index = {'withdrawals':4, 'quality':3, 'drought':5}[name]
        record[index] = [list(row) for row in record[index]]
    def dictionary(field, rows, index):
        labels = []
        codes = {}
        for row in rows:
            value = row[index]
            if value not in codes:
                codes[value] = len(labels)
                labels.append(value)
            row[index] = codes[value]
        data[field] = labels
    if name=='withdrawals':
        rows = [row for record in data['records'] for row in record[4]]
        dictionary('qualifications', rows, 3)
        dictionary('instructions', rows, 4)
    if name=='quality':
        rows = [row for record in data['records'] for row in record[3]]
        dictionary('units', rows, 4)
        dictionary('qualifications', rows, 5)
    if name=='drought':
        states = {}
        for record in data['records']:
            for row in record[5]:
                states[row[1]] = row[2]
                del row[2:]
        data['states'] = states
    data['encoding'] = 1
    return data


def write(name, data):
    payload = json.dumps(compact(name, dict(extracted=TODAY, **data)), ensure_ascii=False, separators=(',', ':'))
    (DIST / f'{name}-data.js').write_text('window.WATER_'+name.upper()+'='+payload+';\n')
    print(name, len(payload), 'bytes', flush=True)


def withdrawals():
    records = {}
    for year in [2022, 2023, 2024]:
        rows = fetch('v1/prelevements', 'chroniques', annee=year)
        print('withdrawals', year, len(rows), flush=True)
        for r in rows:
            point = location(r)
            if not point or r.get('volume') is None or float(r['volume']) < 0:
                continue
            key = r['code_ouvrage']
            item = records.setdefault(key, [key, r.get('nom_ouvrage') or key, point,
                                            r.get('nom_commune') or '', []])
            item[4].append([year, r['code_usage'], round(float(r['volume']), 1),
                            r.get('libelle_qualification_volume') or '', r.get('libelle_statut_instruction') or ''])
    write('withdrawals', dict(years=[2022, 2023, 2024], records=list(records.values())))


def drought():
    records = {}
    # Preserve all actual observations so the viewer can change month and year.
    for year in [2025, 2026]:
        rows = fetch('v1/ecoulement', 'observations', date_observation_min=f'{year}-01-01',
                     date_observation_max=min(f'{year}-12-31', TODAY),
                     fields='code_station,libelle_station,libelle_commune,libelle_cours_eau,date_observation,code_ecoulement,libelle_ecoulement,longitude,latitude')
        print('drought', year, len(rows), flush=True)
        for r in rows:
            point = location(r)
            if not point:
                continue
            key = r['code_station']
            item = records.setdefault(key, [key, r.get('libelle_station') or key, point,
                                            r.get('libelle_commune') or '', r.get('libelle_cours_eau') or '', []])
            item[5].append([r['date_observation'], str(r['code_ecoulement']), r['libelle_ecoulement']])
    for record in records.values():
        record[5] = sorted({tuple(row) for row in record[5]})
    write('drought', dict(years=[2025, 2026], records=list(records.values())))


def quality_month(task):
    year, month = task
    end = calendar.monthrange(year, month)[1]
    return fetch('v2/qualite_rivieres', 'analyse_pc', code_parametre='1340,1433,1311',
        date_debut_prelevement=f'{year}-{month:02d}-01', date_fin_prelevement=f'{year}-{month:02d}-{end}',
        code_support='3', fields='code_analyse,code_station,libelle_station,libelle_parametre,code_parametre,date_prelevement,resultat,symbole_unite,code_remarque,libelle_qualification,longitude,latitude')


def quality():
    records = {}
    params = {}
    for year in [2025]:
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            for month, rows in enumerate(pool.map(quality_month, [(year, m) for m in range(1, 13)]), 1):
                print('quality', year, month, len(rows), flush=True)
                for r in rows:
                    point = location(r)
                    if not point or r.get('resultat') is None:
                        continue
                    code = str(r['code_parametre'])
                    params[code] = [r['libelle_parametre'], r.get('symbole_unite') or '']
                    key = r['code_station']
                    item = records.setdefault(key, [key, r.get('libelle_station') or key, point, []])
                    item[3].append([r['date_prelevement'], code, float(r['resultat']),
                                    str(r.get('code_remarque') or ''), r.get('symbole_unite') or '',
                                    r.get('libelle_qualification') or '', str(r.get('code_analyse') or '')])
    for record in records.values():
        record[3] = sorted({tuple(row) for row in record[3]})
    write('quality', dict(years=[2025], parameters=params, records=list(records.values())))


if __name__ == '__main__':
    import sys
    actions = {'withdrawals': withdrawals, 'drought': drought, 'quality': quality}
    selected = sys.argv[1:] or actions.keys()
    for name in selected:
        actions[name]()
