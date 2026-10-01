# Visuels du parcours de préparation

`scene-atlas-v1.png` est un atlas photographique de 49 scènes (7 colonnes × 7 lignes), généré pour le hub et le wizard Restaurant. Dimensions : 1536 × 1024 px. Aucun logo, texte incorporé ou visage identifiable.

Les emplacements sont nommés dans `WIZARD_SCENES` de `planned-wizard-visuals.tsx`. Chaque emplacement est cadré en 3:2 par SVG, puis couvre sa carte. Le flou léger, le noir et blanc et le voile de contraste sont appliqués par CSS aux scènes secondaires du wizard.

## Cartes d’intention — cristal coloré

Les neuf grandes intentions utilisent désormais `card-*-glass.webp` via `INTENT_GLASS_BACKGROUNDS` : Restaurant, Fast-food, Repas au travail, Courses, Soirée, Voir quelqu’un, Activité, Achat et Voyage. Chaque WebP fait 960 × 640 px ; le cadrage `cover` conserve les proportions actuelles des cartes. La scène amicale est alignée en haut pour conserver les deux visages.

Direction commune : verre facetté lumineux, fissures artistiques, palette nacre/lavande/champagne, composition détaillée à droite et zone laiteuse calme en bas à gauche. Un voile CSS diagonal protège les titres et icônes sans désaturer les illustrations. Aucun changement des actions, étapes ou règles métier.

Génération originale avec l’outil imagegen intégré ; correction ciblée de la scène amicale pour obtenir deux femmes en cristal, sans cartoon ni romance. Prompts finaux : [GLASS_PROMPTS.md](GLASS_PROMPTS.md). Export WebP qualité 88, environ 90–136 Ko par fichier ; aucune dépendance de génération en production.

Vérification du 2 octobre 2026 : neuf cartes inspectées dans le navigateur desktop, titres/icônes lisibles, sélection Restaurant ouvrant le parcours existant, aucune erreur console capturée et build de production réussi. Capture locale hors dépôt : `outputs/intent-glass-2026-10-02/cards-ui.png` dans le workspace parent.

## Génération

- Mode : génération originale avec l’outil imagegen intégré, sans image de référence.
- Direction : atlas 7 × 7 de photographies éditoriales en noir et blanc, légèrement douces, lumière naturelle, sans séparation, texte, logos ou visages identifiables ; scènes distinctes et reconnaissables destinées à des fonds de cartes.
- Ordre des rangées : catégories ; achat/voyage/composition/date/anniversaire ; occasions/Montpellier ; ailleurs/transports ; bus/autre/entrée/plat/dessert/vins ; cocktail/soft/eau/café/menu/digestif/autre ; paiement/note/façade/route/carnet/partage/intérieur.
- Fichier livré : `public/planned-visuals/scene-atlas-v1.png`.

Pour remplacer une scène, conserver sa position dans l’atlas ou adapter explicitement le mapping. Une nouvelle intention de navigation ne crée pas un nouvel asset métier.
