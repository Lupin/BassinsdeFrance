"""Extract directed BD TOPAGE reaches for the upper Loire demonstration area."""
import json
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from shapely import LineString

DIST = Path("outputs/au-fil-de-leau/dist")
PARAMS = {
    "SERVICE": "WFS", "VERSION": "2.0.0", "REQUEST": "GetFeature",
    "TYPENAMES": "sa:TronconHydrographique_FXX", "SRSNAME": "EPSG:4326",
    "OUTPUTFORMAT": "geojson", "COUNT": 18000,
    "BBOX": "44.77,3.78,45.20,4.20,urn:ogc:def:crs:EPSG::4326",
}
URL = "https://services.sandre.eaufrance.fr/geo/topage?" + urlencode(PARAMS)
if len(sys.argv) > 1:
    raw = json.loads(Path(sys.argv[1]).read_text())
else:
    with urlopen(Request(URL, headers={"User-Agent": "Bassins de France"}), timeout=90) as response:
        raw = json.load(response)

data = json.loads((DIST / "data.js").read_text().split("=", 1)[1].rstrip(";\n"))
known = {river["id"] for river in data["rivers"]}
loire = "04C0000002000808543"
reaches, outgoing, incoming, courses = [], defaultdict(list), defaultdict(list), defaultdict(list)
for feature in raw["features"]:
    p, g = feature["properties"], feature.get("geometry")
    if not g or p["StatutOH"] != "Validé" or not p["CdNoeudDebut"] or not p["CdNoeudFin"]:
        continue
    coords = g["coordinates"]
    if g["type"] == "MultiLineString" and len(coords) == 1:
        coords = coords[0]
    elif g["type"] != "LineString":
        continue
    start, end = p["CdNoeudDebut"], p["CdNoeudFin"]
    direction = p["SensEcoulementTH"].casefold()
    if direction == "sens inverse du tronçon" or "inverse" in direction:
        start, end, coords = end, start, coords[::-1]
    elif direction != "dans direction tronçon":
        continue
    line = LineString([((lon + 5.4) * 72, (51.2 - lat) * 104) for lon, lat, *_ in coords])
    if line.length == 0:
        continue
    path = [[round(x, 2), round(y, 2)] for x, y in line.simplify(.07).coords]
    river = p["CdCoursEau_1"]
    index = len(reaches)
    reaches.append((start, end, river, path, line.length))
    outgoing[start].append(index)
    incoming[end].append(index)
    courses[river].append(index)

# Traverse only cases with a unique continuation, and stop at the official
# confluence with the main stem. The existing Loire itinerary covers the rest.
result = {}
for river, indices in courses.items():
    if river not in known or river == loire:
        continue
    starts = [i for i in indices if not any(reaches[j][2] == river for j in incoming[reaches[i][0]])]
    candidates = []
    for index in starts:
        used, parts, steps = set(), [], []
        length = 0
        while index not in used:
            used.add(index)
            _, end, current, path, segment_length = reaches[index]
            if current == loire:
                if parts:
                    candidates.append((length, parts, steps, path[0]))
                break
            if parts and parts[-1][-1] != path[0]:
                break
            if not steps or current != steps[-1][0]:
                steps.append([current, path[0]])
            parts.append(path)
            length += segment_length
            choices = outgoing[end]
            if len(choices) != 1:
                break
            index = choices[0]
    if candidates:
        _, parts, steps, join = max(candidates, key=lambda c: c[0])
        line = [point for part in parts for point in part[:-1]] + [parts[-1][-1]]
        result[river] = [line, steps, join]

(DIST / "topology-data.js").write_text(
    "window.TOPOLOGY=" + json.dumps(result, ensure_ascii=False, separators=(",", ":")) + ";\n"
)
print(f"{len(reaches)} directed reaches, {len(result)} connected courses")
