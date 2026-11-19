# Nouvelles couches pour l’atlas

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
