# Nouvelles couches pour l’atlas

## Premier lot disponible sur cette branche

Dans **Réglages → Couches de données**, les trois couches s’activent séparément. Sur la carte, chaque objet peut ouvrir une fiche. Le téléchargement commence à la première activation. Le tracé des cours d’eau et son animation restent indépendants de ces couches.

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

## Deuxième lot : assainissement et inondations

Ces couches se trouvent sous **Couches de données → Assainissement et inondations**.

- **Stations d’épuration.** L’export géographique 2024 du [portail de l’assainissement collectif](https://assainissement.developpement-durable.gouv.fr/pages/data/basededonneesteu.php) alimente une couche de 22 353 stations métropolitaines en service. La fiche affiche le code Sandre et la capacité nominale, avec un filtre à 2 000, 10 000 ou 100 000 équivalents-habitants. Lorsqu’un même emplacement à l’écran recouvre plusieurs stations, la plus capacitaire est affichée. Le point localise la station.
- **Enveloppes d’inondation potentielles.** Les couches EAIP détaillées de [Géorisques](https://www.georisques.gouv.fr/risques/inondations) s’affichent dès l’activation grâce à un aperçu national généré à partir du flux BRGM. L’application demande une image adaptée à l’échelle de la vallée. Le bouton « Voir le détail ici » zoome directement autour du centre de la carte. Le menu permet de choisir le débordement de cours d’eau et le ruissellement, ou la submersion marine. Les EAIP sont des enveloppes indicatives d’événements exceptionnels. La couverture dépend de la source et le détail exige une connexion. L’aperçu national reste disponible hors ligne.

Pour actualiser les stations, sélectionner l’année et télécharger l’export national GeoJSON sur le portail, puis lancer `python work/build-wastewater.py /chemin/export.geojson` et `python work/package.py`. Mettre à jour l’année affichée dans l’interface si elle change. Pour régénérer l’aperçu EAIP, installer Pillow, lancer `python work/build-flood-overview.py`, puis relancer `python work/package.py`.

## Troisième lot : industrie et sites Seveso

La couche se trouve sous **Couches de données → Énergie et industrie**.

L’export national [Installations industrielles de Géorisques](https://www.georisques.gouv.fr/donnees/bases-de-donnees/installations-industrielles), récupéré le 19 novembre 2026, est filtré sur les établissements métropolitains géolocalisés marqués comme industriels, ainsi que sur ceux classés Seveso. Il couvre 41 365 installations industrielles hors Seveso ou sans statut renseigné, 606 établissements Seveso seuil bas et 703 seuil haut. L’export peut inclure des installations en cessation d’activité.

La couche utilise un filtre par catégorie et un identifiant unique AIOT par établissement. Lors d’un recouvrement des symboles à l’écran, le seuil Seveso le plus haut est prioritaire. Les fiches renvoient vers la source officielle. L’affichage représente des installations répertoriées, pas les périmètres des risques.

Pour actualiser la couche, télécharger l’export CSV national depuis la page Géorisques, puis lancer `python work/build-industry.py /chemin/export.csv` avec `pyproj`, suivi de `python work/package.py`.

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
