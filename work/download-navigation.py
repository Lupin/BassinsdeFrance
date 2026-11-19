"""Download the IGN navigable segments and the Sandre lock inventory."""

import argparse
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen


def get(url, layer, **params):
    query = dict(SERVICE='WFS', VERSION='2.0.0', REQUEST='GetFeature',
                 TYPENAMES=layer, SRSNAME='EPSG:4326', **params)
    with urlopen(url + '?' + urlencode(query), timeout=90) as response:
        return json.load(response)


def download_navigation(directory):
    size = 5000
    offset = 0
    while True:
        data = get('https://data.geopf.fr/wfs/ows', 'BDCARTO_V5:troncon_hydrographique',
                   CQL_FILTER='navigabilite=true', COUNT=size, STARTINDEX=offset,
                   SORTBY='cleabs', OUTPUTFORMAT='application/json')
        if not data['features']:
            raise ValueError(f'Page IGN vide à partir de {offset}')
        (directory / f'navigation-{offset}.geojson').write_text(json.dumps(data))
        offset += len(data['features'])
        if offset >= data['numberMatched']:
            return


def equals(field, value):
    return (f'<fes:PropertyIsEqualTo><fes:ValueReference>{field}</fes:ValueReference>'
            f'<fes:Literal>{value}</fes:Literal></fes:PropertyIsEqualTo>')


def download_locks(directory):
    criteria = ''.join(equals(f'CdTypeDispFranchNavig{i}', 1) for i in (1, 2, 3))
    expression = ('<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:And>'
                  + equals('LbEtOuvrage', 'Existant') + '<fes:Or>' + criteria
                  + '</fes:Or></fes:And></fes:Filter>')
    data = get('https://services.sandre.eaufrance.fr/geo/obs', 'sa:ObstEcoul_FXX',
               FILTER=expression, COUNT=5000, OUTPUTFORMAT='application/json; subtype=geojson')
    (directory / 'locks.geojson').write_text(json.dumps(data))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path, help='Répertoire vide pour le nouvel export')
    directory = parser.parse_args().output
    directory.mkdir(parents=True, exist_ok=True)
    if any(directory.iterdir()):
        parser.error('Le répertoire de sortie doit être vide')
    download_navigation(directory)
    download_locks(directory)
