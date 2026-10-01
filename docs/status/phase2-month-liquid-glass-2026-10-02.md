# Mois à venir — verre sculpté, 2 octobre 2026

HEAD avant intervention : `9e6761e5c37b3c8c7186872df0cb84b3ec5d06c7`.
Le commit de livraison est celui qui ajoute ce rapport.

## Implantation

Rendu produit en CSS : fond perle/ivoire et plis minéraux diffus, sans bain rose/violet. Les gradients directionnels, reflets supérieurs, double arête et ombres internes simulent un verre poli plus épais. Il s'agit d'une simulation optique CSS, sans déformation réelle des pixels ni image de verre.

| Niveau | Surfaces |
| --- | --- |
| Premium / hero | Navigation sticky, ressources, après charges, après essentiel, projection finale, explorer nos choix |
| Soft | Charges, quotidien, extras, précision ; calendrier avec flou réduit |
| Données | Cartes intérieures neutres sans flou |

Classes partagées : `glassPremium`, `glassHero`, `glassSoft`, `dataCard`, `nav`, `calendar`. `glassPrimary` reste un alias CSS compatible du même matériau. Tokens de fond, matière, arête, profondeur, flou, accent et mouvement centralisés dans `month-material.module.css`.

CTA principal violet volumique : reflet supérieur, ombre teintée, hover et pression distincts. Violet réservé aux accents, sélections et focus ; bleu/rose localisés aux ressources. Contraste des chiffres conservé par l'encre sombre et des supports plus opaques pour les explications.

## Vérification ciblée

- Navigateur local desktop : rendu ressources et quotidien/synthèse inspecté, navigation sticky, explication Courses, ouverture/fermeture du Builder et détails du calendrier fonctionnels. Aucune écriture effectuée.
- Aucun débordement horizontal à la largeur observée de 1270 px. Onze surfaces DOM ont un backdrop-filter dans l'état initial ; aucune cellule du calendrier, carte quotidienne/extras ou section précision n'en possède. Pas de mesure FPS prétendue.
- Console : aucune erreur capturée. Les avertissements Next Image sur les dimensions de logos de charges préexistants restent hors de ce lot.
- `node scripts/check-phase2-planned-calendar.mjs` : PASS.
- `node scripts/check-phase2-month-narrative.mjs` : PASS.
- `next build` : résultat confirmé avant commit.
- `git diff --check` : PASS.
- Aucun changement domain/server/Supabase/actions/Builder. Structure, formulaires et moteur financier conservés.

Captures locales hors dépôt : `outputs/month-liquid-glass-2026-10-02/top.png` et `secondary.png` dans le workspace parent. La capture longue n'a pas pu être produite par le navigateur ; les vues desktop ciblées ont été inspectées. Pas de certification browser responsive ou performance matérielle ajoutée pour ce lot visuel.
