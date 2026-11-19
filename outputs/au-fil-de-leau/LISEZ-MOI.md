# Bassins de France — Au fil de l’eau

Ouvrir dist/index.html dans un navigateur. Les scripts, les données et la police Inter sont fournis localement. La consultation du réseau sur fond blanc est possible hors ligne. Les fonds en ligne et la recherche de bassins versants topographiques nécessitent une connexion. Le script `python3 work/package.py`, à lancer depuis la racine du dépôt, génère aussi l’export autonome `outputs/carte-cours-eau-france.html`.

65 288 objets de cours d’eau de plus de 1,8 km, extraits du service WFS Sandre BD TOPAGE® le 26 octobre 2026. Tracés simplifiés pour l’affichage ; ce sont des objets du référentiel, certains correspondant à des bras et canaux, pas nécessairement autant de noms uniques.

Le sens animé des ramifications est reconstitué par les connexions géométriques et les parcours de référence. Sur les composantes isolées, l’exutoire est estimé d’après la limite du territoire. Ce ne sont pas des directions certifiées. Les boucles, les canaux et les secteurs frontaliers peuvent contenir des erreurs.

Les bassins sont les sept grands bassins de gestion métropolitains, à distinguer des bassins versants naturels.


Données : IGN / OFB, BD TOPAGE®, diffusées par Sandre, Licence Ouverte 2.0.
Contour : france-geojson / Grégoire David.
Police : Inter, licence SIL OFL dans dist/assets/Inter-LICENSE.txt.

Les chefs-lieux, les limites départementales noires, les contours régionaux gris foncé en pointillé et les contours colorés des sept grands bassins sont activables séparément. Les contours Etalab 2026 et les noms de l’API Découpage administratif alimentent les comparaisons. La fiche d’un bassin présente ses recoupements avec les départements et régions.

Dans un secteur pilote de la haute Loire, 61 cours d’eau disposent d’un parcours vers la Loire calculé à partir des nœuds et sens d’écoulement de la BD TOPAGE®.

## Couches et filtres

- Ouvrages à usage hydroélectrique du ROE : 5 516 ouvrages existants et validés recensés sous l’usage Sandre « énergie et hydroélectricité ». La catégorie inclut des barrages et d’autres ouvrages.
- Centrales nucléaires EDF : 18 sites, agrégés à partir des données des réacteurs. Les capacités sont installées, pas la production actuelle.
- Débits Hub’Eau : 525 stations avec une mesure Q publiée entre 15 h 50 et 16 h UTC le 26 octobre 2026 (16 h 50–17 h, heure de Paris). Les résultats bruts sont convertis de l/s en m³/s ; la date, l’heure et la qualification sont visibles au clic. C’est un instantané, pas un état actualisé en direct.
- Zones INPN : parcs, réserves, arrêtés de biotope et sites Natura 2000, filtrables par catégorie. Les périmètres peuvent se chevaucher et les régimes de protection varient.
- Nappes captives BD LISA : entités classées captives au niveau national. Elles donnent un repère hydrogéologique et ne cartographient pas les zones où l’eau jaillit effectivement sous pression.

Le fond blanc est sélectionné par défaut. Les fonds IGN, OpenStreetMap et Positron d’OpenFreeMap sont facultatifs et nécessitent une connexion. OSM est proposé en version atténuée (niveaux de gris) ou détaillée. L’attribution est affichée sur la carte lorsque ces fonds sont sélectionnés. Le filtre de débit fonctionne à l’échelle métropolitaine, dans le bassin sélectionné ou dans la vue actuelle.


## Affichage et performances

Le rendu animé s’affiche sur un calque séparé et s’interrompt lorsque la carte quitte la vue ou que l’onglet est masqué. Le tracé est limité à la zone visible. Les données des stations et ouvrages, des zones protégées et des nappes sont chargées séparément à la demande. Le bouton Pause conserve une carte statique.

## Licence et crédits de réutilisation

Le code et la documentation originaux du projet sont publiés sous licence MIT ; voir le fichier `../../LICENSE` à la racine du dépôt. Cette licence ne s’étend pas aux données, polices et fonds de carte de tiers. Les données BD TOPAGE® sont réutilisées selon la Licence Ouverte 2.0 de leur source, avec attribution IGN / OFB et Sandre. La police Inter reste sous SIL Open Font License 1.1 (fichier `dist/assets/Inter-LICENSE.txt`). Pour les conditions des autres couches et fonds, voir le pied de page de la carte et `../../THIRD-PARTY-NOTICES.md`.
