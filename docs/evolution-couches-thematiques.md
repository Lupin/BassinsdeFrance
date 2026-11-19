# Nouvelles couches pour l’atlas

## Premier lot disponible sur cette branche

Dans **Réglages → Navigation et plans d’eau**, les trois couches s’activent séparément. Sur la carte, chaque objet peut ouvrir une fiche. Le téléchargement commence à la première activation. Le tracé des cours d’eau et son animation restent indépendants de ces couches.

| Couche | Source | Périmètre affiché |
| --- | --- | --- |
| Voies navigables | [BD CARTO® · IGN](https://geoservices.ign.fr/bdcarto) | Tronçons classés navigables. Ce classement ne renseigne ni le trafic de fret ni les restrictions du jour. |
| Écluses | [ROE · Sandre](https://services.sandre.eaufrance.fr/geo/obs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities) | Ouvrages existants avec un dispositif de type écluse ([code Sandre 1](https://id.eaufrance.fr/nsa/559)). |
| Lacs et plans d’eau | [BD TOPAGE® 2026 · IGN, OFB et Sandre](https://www.data.gouv.fr/datasets/plans-deau-metropole-2026-bd-topage-r) | Plans d’eau métropolitains de 5 ha ou plus. Le seuil d’affichage augmente au zoom national. |

Les données IGN et Sandre pour la navigation ont été extraites le 19 novembre 2026. [VNF Navi](https://www.vnf.fr/vnf/services/navi/) fournit les conditions de navigation.

Pour régénérer les fichiers, installer `shapely>=2.1` et `pyproj` dans un environnement Python et télécharger l’archive GeoJSON des plans d’eau depuis la fiche BD TOPAGE®. Depuis la racine du projet :

```sh
python work/download-navigation.py work/data/navigation
python work/build-water-transport.py --lakes /chemin/PlanEau_FXX-geojson.zip \
  --navigation work/data/navigation/navigation-*.geojson \
  --locks work/data/navigation/locks.geojson
python work/package.py
```

## Navigation et fret

- Voies navigables : fleuves, rivières et canaux.
- Axes de fret fluvial, avec une distinction entre itinéraires accessibles au fret et trafic observé.
- Écluses, à associer à leur cours d’eau ou canal lorsque la donnée le permet.

## Agriculture et aquaculture

- Zones de production maraîchère et vignobles.
- Zones d’élevage filtrables par type : bovin, ovin, caprin, porcin, volailles, etc.
- Pisciculture dans une couche distincte.
- Indiquer l’échelle des données agricoles. Une statistique communale ne permet pas de localiser une exploitation.

## Eau et inondations

- Lacs, avec distinction entre plans d’eau naturels et artificiels si la source le permet.
- Captages d’eau potable, d’après les données autorisées à la diffusion. Aucun libellé correspondant n’a été trouvé dans l’interface actuelle. Vérifier le contenu des données avant intégration.
- Stations d’épuration.
- Zones inondables. Préciser le scénario, la période de retour et la couverture quand ils sont disponibles.
- Bassins de rétention des eaux, en distinguant les ouvrages de gestion des eaux pluviales des retenues d’eau.

## Industrie

- Sites industriels et filtre dédié aux sites Seveso, avec distinction entre seuil haut et seuil bas si la source le permet. Éviter les doublons quand les deux couches sont actives.

## Intégration à la carte

- Commencer par les voies navigables, les écluses et les lacs, puis avancer selon la disponibilité des données.
- Documenter chaque source en pied de page avec sa date, sa couverture et sa licence. Signaler les zones sans données quand la couverture est partielle.
- Prévoir des couches indépendantes et des légendes adaptées. Charger les données à la demande et adapter leur détail au zoom pour préserver la fluidité.
- Permettre de superposer les voies navigables et les écluses, ou les zones inondables et les installations. Présenter ces superpositions comme des repères cartographiques.
