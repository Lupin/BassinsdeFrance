# Bassins de France — Au fil de l’eau

[Ouvrir la carte interactive](https://lupin.github.io/BassinsdeFrance/)

Atlas animé des cours d’eau et des sept grands bassins de gestion de France métropolitaine, Corse incluse. Recherchez un cours d’eau, un chef-lieu, un département ou une région. Les fiches permettent de localiser les étapes du parcours et d’explorer les stations, ouvrages et milieux associés.

- Comparez un bassin avec les départements et régions actuels. Les limites départementales sont noires et les limites régionales en pointillé gris foncé. Les intersections d’au moins 1 km² sont calculées à l’avance.
- Filtrez les débits observés dans la France métropolitaine, le bassin sélectionné ou la vue actuelle. Les mesures constituent un instantané du 26 octobre 2026.
- Activez un bassin versant topographique à partir d’un point de la carte ou choisissez un fond facultatif, dont Positron d’OpenFreeMap.

Les données de la BD TOPAGE® et les limites administratives sont stockées avec le projet. Les surcouches thématiques et les intersections sont chargées à la demande. Les parcours fondés sur des nœuds officiels couvrent un secteur pilote de la haute Loire. Ailleurs, l’animation indique un sens reconstitué.

## Enregistrer ou exporter une vue

Dans la barre de la carte, **Mes vues** donne accès aux cadrages enregistrés et à l’action **Enregistrer la vue actuelle**. **Afficher** rétablit une vue et ses réglages dans le navigateur actuel. Le bouton **Exporter** propose le PNG en deux définitions, le PDF en A4 et le SVG vectoriel. L’animation est figée dans les fichiers. La description modifiable accompagne le PDF et le SVG. Elle peut être copiée pour le partage d’un PNG.

Le PNG et le PDF peuvent inclure le fond actuel si ses tuiles peuvent être lues par le navigateur. Le SVG utilise le fond blanc et les couches vectorielles. Les enveloppes d’inondation, affichées à partir d’images, restent disponibles en PNG et PDF. Les crédits des sources figurent dans chaque fichier.

## Licence du code

Le code et la documentation originaux de ce dépôt sont publiés sous licence **MIT**. Consulte le fichier [`LICENSE`](LICENSE) pour le texte complet et [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) pour les ressources tierces.

La licence MIT ne couvre pas les données hydrographiques ou administratives, les polices, ni les fonds cartographiques tiers intégrés ou référencés. Leurs licences et attributions propres continuent de s’appliquer. En particulier, la BD TOPAGE® est réutilisée sous Licence Ouverte 2.0 selon la fiche de la source, et la police Inter est fournie sous SIL Open Font License 1.1. Voir les rubriques « Sources et ressources » et « Données et méthode » dans la carte, ainsi que le fichier des [notices tierces](THIRD-PARTY-NOTICES.md).

## Ouvrir localement

Ouvrez `index.html` dans un navigateur récent, ou servez la racine avec `python3 -m http.server`. Les fonds en ligne et le service de bassins versants topographiques du Sandre nécessitent une connexion.

`python3 work/package.py` reconstruit l’entrée GitHub Pages et l’export autonome `outputs/carte-cours-eau-france.html`. Les sources de l’interface et les données préparées résident dans `outputs/au-fil-de-leau/dist/`. Pour régénérer les couches à partir des données brutes locales dans `work/data/`, exécutez `work/build-layers.py`, puis `work/build-crossings.py` avec Shapely 2 et pyproj. `work/build-topology.py` extrait les tronçons du secteur pilote depuis le Sandre.

## Publication

Le site est publié avec GitHub Pages depuis la racine de la branche `main`.


En cas de difficulté d’affichage, [le mode léger](https://bassinsdefrance.fr/?mode=light) utilise un fond blanc, un réseau moins dense et l’animation en pause au démarrage. Un encart de chargement permet de relancer la page et affiche le détail d’une erreur de démarrage lorsqu’elle est détectée. Dans ce mode explicite, les surfaces de dessin sont limitées à 4 096 pixels par côté et 3 millions de pixels par surface. Le mode standard conserve sa résolution de rendu, sa densité et son animation par défaut.


## État de l’eau et usages

Trois couches supplémentaires se trouvent dans **Couches de données → Eau et milieux**.

- **Prélèvements par usage** présente les volumes annuels BNPE de 2022 à 2024, par ouvrage. Le filtre propose les usages et un volume minimal. L’eau turbinée dispose d’un filtre spécifique et est exclue du choix « Tous usages hors eau turbinée ».
- **Qualité des rivières** présente les analyses Naïades de 2025 pour les nitrates, les orthophosphates et l’oxygène dissous. Pour chaque station, la carte utilise le dernier jour analysé de la période choisie. Si plusieurs valeurs quantifiées existent ce jour, leur médiane est représentée. Les classes de concentration sont descriptives. Les notations génériques mg/L sont explicitées par analyte (NO3, PO4, O2). Les valeurs exprimées par masse de N ou de P conservent leur unité et sont représentées en gris. Les résultats avec limite analytique ou non comparables sont gris. Les fiches indiquent dates, unités et qualification, avec une courbe des valeurs quantifiées et un tableau.
- **Écoulements et assecs** utilise les observations ONDE de 2025 et 2026 disponibles lors de l’extraction. Chaque mois affiche la dernière observation de chaque station. Le mois proposé au départ est le plus récent couvrant au moins la moitié de la couverture mensuelle maximale du jeu extrait. Une station sans observation dans le mois reste absente.

Des cercles, carrés et triangles distinguent les couches. Pour éviter de recouvrir la carte, un symbole par cellule de 22 pixels est conservé pour chaque couche. Les volumes les plus importants et les états d’écoulement les plus dégradés sont prioritaires dans ces cellules. Les symboles de couches différentes sont légèrement décalés de cinq pixels lorsqu’elles sont combinées. Les compteurs permettent de connaître le nombre de sites et le nombre de symboles. Le zoom permet de séparer davantage les sites. La recherche retrouve aussi les stations et ouvrages des nouvelles couches actives.

La visibilité des tracés, de leurs noms et de leur animation se règle de 0 à 100 %. Les boutons **Visible**, **Atténué** et **Masqué** donnent un accès rapide au même réglage lorsque ces couches sont activées. Les limites administratives et les couches thématiques gardent leur visibilité. Les tracés propres au fond cartographique peuvent subsister.

Les vues enregistrées et les exports reprennent les filtres, les périodes et la visibilité du réseau. Les données sont des extractions datées et se chargent à la première activation. Les enregistrements manquants restent distingués des volumes nuls et des observations d’assec.

Régénérer les données avec `python3 work/build-water-observations.py`, puis `python3 work/package.py`. Le script vérifie la pagination complète et réduit les répétitions textuelles dans les fichiers. Les réponses brutes sont mises en cache dans `/tmp/bassins-hubeau-cache`. `node work/check-observations.cjs` vérifie le calcul des volumes filtrés, les périodes, les médianes et les absences d’observation.
