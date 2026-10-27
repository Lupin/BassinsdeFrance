# Au fil de l’eau

Ouvrir dist/index.html dans un navigateur. Les scripts, les données et la police Inter sont fournis localement. Aucun serveur ni connexion réseau ne sont nécessaires à la consultation. Une copie autonome est fournie dans carte-cours-eau-france.html, dans le dossier outputs parent.

65 288 objets de cours d’eau de plus de 1,8 km, extraits du service WFS Sandre BD TOPAGE® le 26 octobre 2026. Tracés simplifiés pour l’affichage ; ce sont des objets du référentiel, certains correspondant à des bras et canaux, pas nécessairement autant de noms uniques.

Le sens animé des ramifications est reconstitué par les connexions géométriques et les parcours de référence. Sur les composantes isolées, l’exutoire est estimé d’après la limite du territoire. Ce ne sont pas des directions certifiées. Les boucles, les canaux et les secteurs frontaliers peuvent contenir des erreurs.

Les bassins sont les sept grands bassins de gestion métropolitains, à distinguer des bassins versants naturels.


Données : IGN / OFB, BD TOPAGE®, diffusées par Sandre, Licence Ouverte 2.0.
Contour : france-geojson / Grégoire David.
Police : Inter, licence SIL OFL dans dist/assets/Inter-LICENSE.txt.

Les 96 chefs-lieux et les limites départementales (overlay noir) sont activables séparément. Contours Etalab millésime 2026 à 100 m ; chefs-lieux et localisation des mairies via API Découpage administratif. Taille et vitesse visuelle des particules maintenues à toutes les échelles. Vérification de mouvement aux zooms ×1, ×3, ×6, ×12.

## Nouvelles surcouches

- Ouvrages à usage hydroélectrique du ROE : 5 516 ouvrages existants et validés recensés sous l’usage Sandre « énergie et hydroélectricité ». La catégorie inclut des barrages et d’autres ouvrages.
- Centrales nucléaires EDF : 18 sites, agrégés à partir des données des réacteurs. Les capacités sont installées, pas la production actuelle.
- Débits Hub’Eau : 525 stations avec une mesure Q publiée entre 15 h 50 et 16 h UTC le 26 octobre 2026 (16 h 50–17 h, heure de Paris). Les résultats bruts sont convertis de l/s en m³/s ; la date, l’heure et la qualification sont visibles au clic. C’est un instantané, pas un état actualisé en direct.
- Zones INPN : parcs, réserves, arrêtés de biotope et sites Natura 2000, filtrables par catégorie. Les périmètres peuvent se chevaucher et les régimes de protection varient.
- Nappes captives BD LISA : entités classées captives au niveau national. Elles donnent un repère hydrogéologique et ne cartographient pas les zones où l’eau jaillit effectivement sous pression.

Le fond blanc est sélectionné par défaut. Les fonds IGN et OpenStreetMap sont optionnels et chargent seulement les tuiles visibles ; ils nécessitent une connexion internet. OSM est proposé en version atténuée (niveaux de gris) ou détaillée. L’attribution est affichée sur la carte lorsque ces fonds sont sélectionnés. Les règles OSM sont dans le pied de page.


## Affichage et performances

Le rendu animé est limité à 24 images/s, les particules sont dessinées sur un calque transparent séparé et seules les ramifications visibles à l’échelle actuelle sont préparées, avec un plafond de 3 200 particules. Les animations s’arrêtent quand l’onglet est masqué. Les chemins graphiques des cours d’eau et des surcouches polygonales sont préparés seulement quand ils sont utiles. Les données secondaires ne se chargent qu’à l’activation d’une surcouche, au lieu d’être décodées dès le démarrage. La résolution des canevas est plafonnée à 1,5× pour limiter la mémoire graphique sur les écrans Retina. Le bouton Pause laisse la carte statique.

## Licence et crédits de réutilisation

Le code et la documentation originaux du projet sont publiés sous licence MIT ; voir le fichier `../../LICENSE` à la racine du dépôt. Cette licence ne s’étend pas aux données, polices et fonds de carte de tiers. Les données BD TOPAGE® sont réutilisées selon la Licence Ouverte 2.0 de leur source, avec attribution IGN / OFB et Sandre. La police Inter reste sous SIL Open Font License 1.1 (fichier `dist/assets/Inter-LICENSE.txt`). Pour les conditions des autres couches et fonds, voir le pied de page de la carte et `../../THIRD-PARTY-NOTICES.md`.
