"""Check baseline HTML semantics and accessible-name references without dependencies."""

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import sys


class PageAudit(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.references = []
        self.controls = []
        self.labels_for = set()
        self.headings = []
        self.main_count = 0
        self.h1_count = 0
        self.lang = False
        self.canvas_map = None
        self.map_dialog = None
        self.stack = []

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        element_id = attrs.get("id")
        if element_id:
            self.ids.append(element_id)
        if tag == "html":
            self.lang = bool(attrs.get("lang"))
        if tag == "main":
            self.main_count += 1
        if tag == "label" and attrs.get("for"):
            self.labels_for.add(attrs["for"])
        if tag in {"input", "select", "textarea"}:
            self.controls.append((tag, attrs, any(parent == "label" for parent, _ in self.stack)))
        for attr in ("aria-controls", "aria-describedby", "aria-labelledby"):
            if attrs.get(attr):
                self.references.extend(attrs[attr].split())
        if tag == "a" and attrs.get("href", "").startswith("#"):
            self.references.append(attrs["href"][1:])
        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            level = int(tag[1])
            self.headings.append(level)
            if level == 1:
                self.h1_count += 1
        if tag == "canvas" and element_id == "map":
            self.canvas_map = attrs
        if tag == "dialog" and element_id == "mapExport":
            self.map_dialog = attrs
        if tag not in self.VOID:
            self.stack.append((tag, element_id))

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                return

def audit(path):
    parser = PageAudit()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    problems = []
    counts = Counter(parser.ids)
    problems.extend(f"identifiant dupliqué : {item}" for item, count in counts.items() if count > 1)
    missing = sorted(set(parser.references) - set(parser.ids))
    problems.extend(f"référence ARIA ou fragment sans cible : {item}" for item in missing)
    if not parser.lang:
        problems.append("attribut lang manquant sur <html>")
    if parser.main_count != 1:
        problems.append(f"un seul <main> attendu, trouvé : {parser.main_count}")
    if parser.h1_count != 1:
        problems.append(f"un seul <h1> attendu, trouvé : {parser.h1_count}")
    for tag, attrs, nested_label in parser.controls:
        if attrs.get("type") == "hidden":
            continue
        has_name = bool(attrs.get("aria-label") or attrs.get("aria-labelledby"))
        has_label = bool(attrs.get("id") in parser.labels_for or nested_label)
        if not (has_name or has_label):
            problems.append(f"contrôle sans étiquette : <{tag} id={attrs.get('id')!r}>")
    if parser.canvas_map and not (parser.canvas_map.get("aria-label") or parser.canvas_map.get("aria-labelledby")):
        problems.append("la carte canvas n’a pas de nom accessible")
    if parser.canvas_map and parser.canvas_map.get("tabindex") != "0":
        problems.append("la carte canvas n’est pas accessible au clavier")
    if parser.map_dialog:
        label = parser.map_dialog.get("aria-labelledby")
        if not label or label not in parser.ids:
            problems.append("la boîte d’export n’a pas de titre accessible valide")
    if parser.headings and any(current > previous + 1 for previous, current in zip(parser.headings, parser.headings[1:])):
        problems.append("saut de niveau dans la hiérarchie des titres")
    return problems, len(parser.ids), len(parser.references)


def main():
    root = Path(__file__).resolve().parent.parent
    files = [root / "index.html", root / "informations-legales.html"]
    failures = 0
    for path in files:
        problems, ids, references = audit(path)
        if problems:
            failures += len(problems)
            for problem in problems:
                print(f"{path.name}: {problem}", file=sys.stderr)
        else:
            print(f"HTML accessible de base : {path.name} · {ids} identifiants · {references} références vérifiées")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
