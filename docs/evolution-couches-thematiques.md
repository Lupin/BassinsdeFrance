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

## Limites des sous-bassins

**Couches de données → Eau et milieux → Limites des sous-bassins** affiche les 6 190 périmètres de l’[export BD TOPAGE® 2026](https://www.data.gouv.fr/datasets/bassins-versant-topographiques-metropole-2026-bd-topage-r). Deux résolutions sont générées à partir de la même géométrie de référence. La vue d’ensemble se charge à l’activation. Le niveau plus détaillé se charge au zoom ou lors d’une sélection. La fiche indique l’exutoire lorsqu’il est renseigné par la source.

Pour régénérer la couche, utiliser `python work/build-watersheds.py /chemin/BassinVersantTopographique_FXX-geojson.zip` avec Shapely 2.1 ou supérieur et pyproj, puis `python work/package.py`.

## Navigation et fret

- **Voies navigables et écluses** : voir le premier lot. La couche cartographie le classement des tronçons, pas la navigabilité opérationnelle ni le fret observé.
- **Fret fluvial** : non ajouté dans ce lot. Les voies recensées ne permettent pas à elles seules de dire quels axes sont effectivement utilisés pour le fret ni d’indiquer des tonnages. Ajouter ces données séparément lorsqu’une source publique, géolocalisée et suffisamment documentée sera identifiée.

## Agriculture et aquaculture

- **Élevages soumis à ICPE.** La couche Géorisques 2026 comprend 8 794 établissements géolocalisés : 69 bovins, 7 176 porcins, 1 544 volailles et 265 piscicultures (un même site peut appartenir à plusieurs catégories). Filtre par type. Il s’agit d’établissements classés soumis à la réglementation ICPE, pas d’un recensement de tous les élevages ni d’un statut garanti d’activité. Les couleurs distinguent bovins, porcs, volailles et pisciculture.
- **Maraîchage et vignobles** : non ajoutés dans ce lot. Le RPG fournit des parcelles agricoles, mais son extraction nationale détaillée est volumineuse et le flux consulté ne permet pas de combiner la sélection des cultures avec un découpage géographique. Il faut une extraction par département ou une couche de service adaptée avant de proposer un affichage fiable et assez léger.
- Pour actualiser les élevages, lancer `python work/build-farms.py` avec un accès au WFS Géorisques, puis `python work/package.py`.

## Eau et inondations

- **Captages d’eau potable.** La couche utilise les ouvrages validés du [référentiel Sandre PRL](https://www.data.gouv.fr/datasets/ouvrages-de-prelevement-france-entiere-1), millésime 2026, dont l’usage principal est AEP ou domestique (codes 5 et sous-niveaux). L’export intégré contient 43 357 points en métropole. Il localise les ouvrages recensés, sans indiquer leur activité instantanée ni leur débit.

- **Lacs, captages d’eau potable, stations d’épuration et enveloppes d’inondation** : voir les sections précédentes. Les lacs ne sont pas séparés selon leur origine dans la couche actuelle.
- **Bassins de rétention** : non ajoutés dans ce lot. Il faut distinguer les ouvrages de gestion des eaux pluviales des plans d’eau et retenues, et vérifier l’existence d’une source nationale homogène avant de dessiner une couche séparée.

## Industrie

- **Sites industriels et Seveso** : voir la troisième section. Le filtre distingue les deux seuils Seveso.

## Intégration à la carte

- Les couches non intégrées faute d’une source appropriée sont explicitement signalées ci-dessus ; ne pas assimiler les tronçons navigables au fret réel ni les plans d’eau aux bassins de rétention.
- Documenter chaque source en pied de page avec sa date, sa couverture et sa licence. Signaler les zones sans données quand la couverture est partielle.
- Prévoir des couches indépendantes et des légendes adaptées. Charger les données à la demande et adapter leur détail au zoom pour préserver la fluidité.
- Permettre de superposer les voies navigables et les écluses, ou les zones inondables et les installations. Présenter ces superpositions comme des repères cartographiques.
