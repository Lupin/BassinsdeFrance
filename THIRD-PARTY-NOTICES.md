# Licences des données et ressources tierces

La licence MIT du dépôt couvre uniquement le code et la documentation originaux de ce projet. Elle ne remplace pas les licences des données, polices, cartes ou autres ressources de tiers intégrées ou référencées par la carte.

## Données hydrographiques et administratives

- **BD TOPAGE® (IGN / OFB, diffusée par Sandre)** : données réutilisées sous Licence Ouverte 2.0, selon la fiche du jeu de données. La carte indique la source et la date de l’extraction.
- **Contours administratifs Etalab, chefs-lieux et données des surcouches** (ROE, Hub’Eau, EDF, INPN, BD LISA) : consulter la licence et les conditions de réutilisation indiquées sur la fiche de chaque source liée dans le pied de page de la carte. Les données restent sous leurs licences respectives.
- **Contours france-geojson** : consulter la licence et les crédits du jeu source avant toute réutilisation indépendante de ces géométries.

La Licence Ouverte 2.0 autorise la réutilisation, l’adaptation et la redistribution des informations couvertes, sous réserve notamment d’en indiquer la paternité, la source et la date de mise à jour : [texte officiel](https://www.data.gouv.fr/pages/legal/licences/etalab-2.0).

## Police

La police **Inter**, fournie dans `outputs/au-fil-de-leau/dist/assets/`, est distribuée sous **SIL Open Font License 1.1**. Son fichier de licence et ses conditions restent applicables à la police : [texte officiel OFL 1.1](https://openfontlicense.org/).

## Fonds de carte en ligne

Les fonds IGN et OpenStreetMap sont chargés depuis leurs services respectifs lorsque l’utilisateur les active. Ils ne sont pas couverts par la licence MIT du projet ; leurs crédits et conditions d’utilisation sont accessibles depuis le pied de page de la carte.

Le fond **Positron** est chargé depuis l’instance publique [OpenFreeMap](https://openfreemap.org/quick_start/). Il utilise les données d’[OpenStreetMap](https://www.openstreetmap.org/copyright) et le schéma d’[OpenMapTiles](https://openmaptiles.org/). Les crédits sont affichés sur la carte. Les noms français ou locaux sont privilégiés, et le style laisse à l’atlas l’affichage du nom des cours d’eau. Le moteur [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) est chargé uniquement lorsque ce fond est sélectionné.

- **Navigation et plans d’eau** : tronçons navigables issus de la [BD CARTO® de l’IGN](https://geoservices.ign.fr/bdcarto), écluses issues du [ROE](https://services.sandre.eaufrance.fr/geo/obs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities), plans d’eau issus de la [BD TOPAGE® 2026](https://www.data.gouv.fr/datasets/plans-deau-metropole-2026-bd-topage-r). Consulter les modalités de réutilisation des sources.

- **Assainissement et inondations** : base de données sur les eaux résiduaires urbaines (ERU), [Portail de l’assainissement collectif](https://assainissement.developpement-durable.gouv.fr/pages/data/basededonneesteu.php), millésime 2024. Enveloppes approchées des inondations potentielles (EAIP) affichées via le [flux Géorisques du BRGM](https://mapsref.brgm.fr/wxs/georisques/risques?SERVICE=WMS&REQUEST=GetCapabilities).
