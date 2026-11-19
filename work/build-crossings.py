"""Prepare basin and department intersections and cautious point-to-river joins.

Run from the repository root with Shapely 2 and pyproj installed. Raw inputs
come from the same Sandre, Etalab, ROE and Hub'Eau snapshots as the atlas.
"""
import gzip
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from urllib.request import urlopen

from pyproj import Transformer
from shapely import LineString, Point, STRtree, make_valid
from shapely.geometry import shape
from shapely.ops import transform, unary_union

DIST = Path("outputs/au-fil-de-leau/dist")
RAW = Path("work/data")


def read_script(name):
    return json.loads((DIST / name).read_text().split("=", 1)[1].strip().rstrip(";"))


def write_script(name, variable, data):
    (DIST / name).write_text(
        f"window.{variable}=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    )


def polygons(geometry):
    if geometry.is_empty:
        return
    if geometry.geom_type == "Polygon":
        yield geometry
    elif hasattr(geometry, "geoms"):
        for part in geometry.geoms:
            yield from polygons(part)


def clean(geometry):
    return unary_union(list(polygons(make_valid(geometry))))


def atlas_xy(lon, lat, z=None):
    return (lon + 5.4) * 72, (51.2 - lat) * 104


def geographic_xy(x, y, z=None):
    return x / 72 - 5.4, 51.2 - y / 104


# Equal area CRS for comparable surfaces. Simplify only the display geometry.
to_area = Transformer.from_crs("EPSG:4326", "EPSG:3035", always_xy=True).transform
to_geo = Transformer.from_crs("EPSG:3035", "EPSG:4326", always_xy=True).transform
basin_features = json.loads((RAW / "basins.json").read_text())["features"]
basins = {
    f["properties"]["CdBH"]: clean(transform(to_area, shape(f["geometry"])))
    for f in basin_features if f.get("geometry")
}
with gzip.open(RAW / "departements-2026.geojson.gz", "rt") as handle:
    departments_geojson = json.load(handle)["features"]
department_codes = {x["code"] for x in read_script("admin.js")["departments"]}
with urlopen("https://geo.api.gouv.fr/regions?fields=nom,code", timeout=20) as response:
    region_names = {x["code"]: x["nom"] for x in json.load(response)}
region_parts = defaultdict(list)
territories = []
for feature in departments_geojson:
    code = str(feature["properties"]["code"])
    if code not in department_codes:
        continue
    department = clean(transform(to_area, shape(feature["geometry"])))
    territories.append((code, department))
    region_parts[str(feature["properties"]["region"])].append(department)


def display_coords(geometry):
    display = transform(atlas_xy, transform(to_geo, geometry.simplify(280, preserve_topology=True)))
    return [
        [[[round(x, 2), round(y, 2)] for x, y in ring.coords]
         for ring in [polygon.exterior, *polygon.interiors]]
        for polygon in polygons(display) if polygon.area >= .01
    ]


regions = []
for code, parts in region_parts.items():
    geometry = unary_union(parts)
    identifier = "r-" + code
    territories.append((identifier, geometry))
    regions.append({"code": identifier, "name": region_names[code], "polys": display_coords(geometry)})

rows = []
for code, territory in territories:
    for key, basin in basins.items():
        if not territory.intersects(basin):
            continue
        overlap = territory.intersection(basin)
        area_km2 = overlap.area / 1_000_000
        if area_km2 < 1:
            continue
        percent = round(overlap.area / territory.area * 100, 1)
        rows.append([key, code, round(area_km2, 1), percent, display_coords(overlap)])
rows.sort(key=lambda row: -row[2])
write_script("crossings-data.js", "CROSSINGS", {"rows": rows, "regions": regions})
print(f"{len(rows)} intersections ≥ 1 km², {len(regions)} regions")


def name_key(name):
    text = unicodedata.normalize("NFKD", name.casefold())
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-z0-9]+", " ", text).strip()
    text = re.sub(r"^(fleuve|riviere|ruisseau|torrent|canal)(?: de| du| des)? ", "", text)
    return re.sub(r"^(le|la|les|l) ", "", text)


hydro = read_script("data.js")
extra = json.loads(Path("work/layers-intermediate.js").read_text().split("=", 1)[1].strip().rstrip(";"))
raw_observations = json.loads((RAW / "flows-recent.json").read_text())["data"]
observation_codes = {(x["code_site"], x["date_obs"]): x.get("code_station") for x in raw_observations}
stations = {x["code_station"]: x for x in json.loads((RAW / "hydrometry-stations.json").read_text())["data"]}
obstacles = {f["properties"]["CdObstEcoul"]: f["properties"]
             for f in json.loads((RAW / "roe-hydro.json").read_text())["features"]}
lines, river_ids, keyed, by_id = [], [], defaultdict(list), defaultdict(list)
for river in hydro["rivers"]:
    key = name_key(river["n"])
    for path in river["p"]:
        if len(path) < 2:
            continue
        idx = len(lines)
        keyed[key].append(idx)
        by_id[river["id"]].append(idx)
        river_ids.append(river["id"])
        lines.append(transform(to_area, transform(geographic_xy, LineString(path))))
tree = STRtree(lines)

for key in ("flows", "dams", "nuclear"):
    for item in extra[key]:
        point = Point(*to_area(*geographic_xy(*item["p"])))
        containing = [code for code, basin in basins.items() if basin.covers(point)]
        item["basins"] = containing
        if key == "nuclear":
            continue
        if key == "flows":
            station_code = observation_codes.get((item["site"], item["date"]))
            station = stations.get(station_code, {})
            item["station"] = station_code
            item["sourceCode"] = station.get("code_cours_eau")
            if station.get("libelle_cours_eau"):
                item["river"] = station["libelle_cours_eau"]
            if station.get("libelle_station"):
                item["n"] = station["libelle_station"]
        else:
            item["sourceCode"] = obstacles.get(item["id"], {}).get("CdEntiteHydrographique")
        direct = by_id.get(item["sourceCode"])
        named = keyed.get(name_key(item["river"])) if item.get("river") else []
        if direct:
            item["link"] = [item["sourceCode"], "id"]
        elif named:
            candidates = sorted((lines[i].distance(point), river_ids[i]) for i in named)
            distance, identifier = candidates[0]
            competitor = next((d for d, rid in candidates if rid != identifier), float("inf"))
            if distance <= 650 and competitor - distance > 40:
                item["link"] = [identifier, "nom", round(distance)]
        elif not item.get("river"):
            candidates = sorted((lines[i].distance(point), river_ids[i])
                                for i in tree.query(point, predicate="dwithin", distance=100))
            if candidates:
                distance, identifier = candidates[0]
                competitor = next((d for d, rid in candidates if rid != identifier), float("inf"))
                if competitor - distance > 30:
                    item["link"] = [identifier, "proximité", round(distance)]

for dataset in ("flows", "dams"):
    print(dataset, len(extra[dataset]), "associations:", sum("link" in x for x in extra[dataset]))
write_script("points-data.js", "POINTS", {key: extra[key] for key in ("asof", "flows", "dams", "nuclear")})
write_script("protected-data.js", "PROTECTED", extra["protected"])
write_script("aquifers-data.js", "AQUIFERS", extra["aquifers"])
