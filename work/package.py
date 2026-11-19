"""Generate the GitHub Pages entry point and the portable offline HTML."""
import base64
import re
from pathlib import Path

dist = Path("outputs/au-fil-de-leau/dist")
template = (dist / "index.html").read_text()
local_assets = re.compile(r'(src|href|data-src)="(style\.css|[a-z-]+\.js)"')
published = local_assets.sub(lambda match: f'{match[1]}="{dist.as_posix()}/{match[2]}"', template)
Path("index.html").write_text(published)

font = base64.b64encode((dist / "assets/Inter.ttf").read_bytes()).decode()
css = (dist / "style.css").read_text().replace("url('assets/Inter.ttf')", "url('data:font/ttf;base64," + font + "')")
standalone = template.replace('<link rel="stylesheet" href="style.css">', "<style>" + css + "</style>")


def script_text(name):
    return (dist / name).read_text().replace("</script", "<\\/script")


for name in ("points", "protected", "aquifers", "crossings", "topology"):
    pattern = f'<script id="{name}-data-lazy" data-src="{name}-data.js"></script>'
    inline = f'<script id="{name}-data-lazy" type="text/plain">{script_text(name+"-data.js")}</script>'
    standalone = standalone.replace(pattern, inline)
for name in ("data", "admin", "explore", "app"):
    pattern = rf'<script src="{name}\.js"(?: defer)?></script>'
    standalone = re.sub(pattern, lambda match: "<script>" + script_text(name+".js") + "</script>", standalone)
Path("outputs/carte-cours-eau-france.html").write_text(standalone)
print(f"GitHub Pages : {len(published.encode()) / 1000:.1f} Ko. Export autonome : {len(standalone.encode()) / 1e6:.1f} Mo.")
