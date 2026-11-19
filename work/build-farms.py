"""Extract geolocated livestock ICPE sites from the Géorisques WFS."""

import json
import re
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

DIST = Path(__file__).resolve().parents[1] / 'outputs/au-fil-de-leau/dist'
ENDPOINT = 'https://mapsref.brgm.fr/wxs/georisques/georisques_dl'
NS = {'gml':'http://www.opengis.net/gml/3.2','ms':'http://mapserver.gis.umn.edu/mapserver',
      'wfs':'http://www.opengis.net/wfs/2.0'}


def fetch():
    clauses = [f'<fes:PropertyIsEqualTo><fes:ValueReference>{field}</fes:ValueReference><fes:Literal>1</fes:Literal></fes:PropertyIsEqualTo>'
               for field in ('bovins','porcs','volailles')]
    clauses += [f'<fes:PropertyIsLike wildCard="%" singleChar="_" escapeChar="\\"><fes:ValueReference>{field}</fes:ValueReference><fes:Literal>%2130%</fes:Literal></fes:PropertyIsLike>'
                for field in ('rubriques_autorisation','rubriques_enregistrement','rubriques_declaration')]
    filt = '<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:Or>'+''.join(clauses)+'</fes:Or></fes:Filter>'
    params = {'SERVICE':'WFS','VERSION':'2.0.0','REQUEST':'GetFeature',
              'TYPENAMES':'ms:InstallationsClassees_France','FILTER':filt,'COUNT':20000}
    request = Request(ENDPOINT+'?'+urlencode(params), headers={'User-Agent':'BassinsdeFrance/1.0'})
    with urlopen(request, timeout=90) as response:
        root = ET.fromstring(response.read())
    matched = root.attrib.get('numberMatched')
    if not matched or matched == 'unknown':
        raise ValueError('La source Géorisques n’a pas fourni le nombre de sites correspondant au filtre')
    return root, int(matched)


def build(root):
    records = {}
    for site in root.findall('.//wfs:member/ms:InstallationsClassees_France', NS):
        def value(key):
            return site.findtext('ms:'+key, default='', namespaces=NS).strip()
        raw = site.findtext('.//gml:Point/gml:pos', default='', namespaces=NS).split()
        if len(raw) != 2:
            continue
        try:
            lat, lon = map(float, raw)  # WFS GML is declared in EPSG:4326 axis order.
        except (ValueError, TypeError):
            continue
        if not (-5.6 <= lon <= 9.8 and 41.2 <= lat <= 51.3):
            continue
        types = []
        for field, label in [('bovins','Bovins'),('porcs','Porcs'),('volailles','Volailles')]:
            if value(field) == '1': types.append(label)
        rubriques = '|'.join(value(field) for field in ('rubriques_autorisation','rubriques_enregistrement','rubriques_declaration'))
        if re.search(r'(^|\D)2130(\D|$)',rubriques): types.append('Pisciculture')
        ident = value('code_aiot')
        if ident and types:
            records[ident] = [value('nom_ets') or 'Élevage recensé', [round(lon,5),round(lat,5)],
                              ident, types, value('commune'), value('url_fiche')]
    return list(records.values())


if __name__ == '__main__':
    root, matched = fetch()
    records = build(root)
    if matched != len(root.findall('.//wfs:member/ms:InstallationsClassees_France',NS)):
        raise SystemExit('Résultat incomplet : le WFS a renvoyé une page partielle')
    if len(records) < 1000:
        raise SystemExit(f'Résultat incomplet : seulement {len(records)} sites utilisables')
    payload = json.dumps(records,ensure_ascii=True,separators=(',',':'))
    (DIST/'farms-data.js').write_text(f'window.WATER_FARMS={payload};\n')
    print(f'{len(records):,} sites d’élevage ICPE · source {matched:,} · {len(payload)/1e6:.1f} Mo')
    for category in ('Bovins','Porcs','Volailles','Pisciculture'):
        print(category,sum(category in item[3] for item in records))
