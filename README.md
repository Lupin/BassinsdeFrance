# Bassins de France — Au fil de l’eau

[Ouvrir la carte interactive](https://lupin.github.io/BassinsdeFrance/)

Atlas animé des cours d’eau et des sept grands bassins de gestion de France métropolitaine, Corse incluse. Recherchez un cours d’eau, un chef-lieu, un département ou une région. Les fiches permettent de localiser les étapes du parcours et d’explorer les stations, ouvrages et milieux associés.

- Comparez un bassin avec les départements et régions actuels. Les limites départementales sont noires et les limites régionales en pointillé gris foncé. Les intersections d’au moins 1 km² sont calculées à l’avance.
- Filtrez les débits observés dans la France métropolitaine, le bassin sélectionné ou la vue actuelle. Les mesures constituent un instantané du 26 octobre 2026.
- Activez un bassin versant topographique à partir d’un point de la carte ou choisissez un fond facultatif, dont Positron d’OpenFreeMap.

Les données de la BD TOPAGE® et les limites administratives sont stockées avec le projet. Les surcouches thématiques et les intersections sont chargées à la demande. Les parcours fondés sur des nœuds officiels couvrent un secteur pilote de la haute Loire. Ailleurs, l’animation indique un sens reconstitué.

## Licence du code

Le code et la documentation originaux de ce dépôt sont publiés sous licence **MIT**. Consulte le fichier [`LICENSE`](LICENSE) pour le texte complet et [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) pour les ressources tierces.

La licence MIT ne couvre pas les données hydrographiques ou administratives, les polices, ni les fonds cartographiques tiers intégrés ou référencés. Leurs licences et attributions propres continuent de s’appliquer. En particulier, la BD TOPAGE® est réutilisée sous Licence Ouverte 2.0 selon la fiche de la source, et la police Inter est fournie sous SIL Open Font License 1.1. Voir les rubriques « Sources et ressources » et « Données et méthode » dans la carte, ainsi que le fichier des [notices tierces](THIRD-PARTY-NOTICES.md).

## Ouvrir localement

Ouvrez `index.html` dans un navigateur récent, ou servez la racine avec `python3 -m http.server`. Les fonds en ligne et le service de bassins versants topographiques du Sandre nécessitent une connexion.

`python3 work/package.py` reconstruit l’entrée GitHub Pages et l’export autonome `outputs/carte-cours-eau-france.html`. Les sources de l’interface et les données préparées résident dans `outputs/au-fil-de-leau/dist/`. Pour régénérer les couches à partir des données brutes locales dans `work/data/`, exécutez `work/build-layers.py`, puis `work/build-crossings.py` avec Shapely 2 et pyproj. `work/build-topology.py` extrait les tronçons du secteur pilote depuis le Sandre.

## Publication

Le site est publié avec GitHub Pages depuis la racine de la branche `main`.
