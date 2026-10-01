# Visuels du parcours de préparation

`scene-atlas-v1.png` est un atlas photographique de 49 scènes (7 colonnes × 7 lignes), généré pour le hub et le wizard Restaurant. Dimensions : 1536 × 1024 px. Aucun logo, texte incorporé ou visage identifiable.

Les emplacements sont nommés dans `WIZARD_SCENES` de `planned-wizard-visuals.tsx`. Chaque emplacement est cadré en 3:2 par SVG, puis couvre sa carte. Le flou léger, le noir et blanc et le voile de contraste sont appliqués par CSS. La même scène sert aux grandes cartes, aux choix et aux éléments compacts de la note.

## Génération

- Mode : génération originale avec l’outil imagegen intégré, sans image de référence.
- Direction : atlas 7 × 7 de photographies éditoriales en noir et blanc, légèrement douces, lumière naturelle, sans séparation, texte, logos ou visages identifiables ; scènes distinctes et reconnaissables destinées à des fonds de cartes.
- Ordre des rangées : catégories ; achat/voyage/composition/date/anniversaire ; occasions/Montpellier ; ailleurs/transports ; bus/autre/entrée/plat/dessert/vins ; cocktail/soft/eau/café/menu/digestif/autre ; paiement/note/façade/route/carnet/partage/intérieur.
- Fichier livré : `public/planned-visuals/scene-atlas-v1.png`.

Pour remplacer une scène, conserver sa position dans l’atlas ou adapter explicitement le mapping. Une nouvelle intention de navigation ne crée pas un nouvel asset métier.
