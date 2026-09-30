# Patch calendrier V2 — corrections après implémentation

Brief : `PATCH_CALENDRIER_V2_CORRECTIONS_POST_IMPLEMENTATION.md`.

## Modifications

- `month-calendar.tsx` : en-tête mois + filtres uniquement ; suppression du
  sous-titre, des compteurs, de l'aide et des marqueurs de date dans la grille.
- Panneau latéral et overlay supprimés. Remplacement par un popover natif non
  modal, de 420 px maximum, positionné près de la cellule. Fermeture extérieure,
  Échap et bouton × ; retour de focus. Repositionnement au scroll, redimensionnement
  ou ouverture de détails. Aucun piège de focus modal.
- Événement cliqué mis en avant et ses détails développés ; « +N autres » ouvre
  tous les éléments du jour. Le formulaire conserve la création avec date préremplie.
- Date estimée expliquée dans le panneau. Observations, libellé complet, provenance
  et sources placés dans « Détails ». Décomposition du total repliée.
- `calendar-metadata.ts` : libellés courts issus du texte canonique ; références
  opaques abrégées, jamais converties en faux usages ou propriétaires de contrat.
- `calendar-presentation.ts` : priorité confirmation → prévu → réalisé → charge
  précise → habituelle → estimée ; description ARIA du jour raccourcie.
- `month-story.tsx` : suppression du titre éditorial avant le calendrier.
- `public/brands/*.svg` : cadrage resserré des repères locaux existants, suppression
  du rectangle blanc et taille d'affichage adaptée aux marques longues.
- Épargne sans date : zone compacte, neutre, avec « Objectif du mois ».

## Vérifications

| Commande | Résultat |
| --- | --- |
| `node scripts/check-phase2-planned-calendar.mjs` | PASS |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `node node_modules/next/dist/bin/next build` | PASS |
| `git diff --check` | PASS |

Tests adaptés : absence de documentation/overlay/marqueurs dans la grille,
libellés et références, priorités, placement du popover aux bords du viewport,
épargne neutre, deux événements maximum, centimes et synchronisation des mutations.
Contrôle visuel et événements natifs du navigateur à vérifier manuellement ; aucun
PASS navigateur revendiqué. Pas de contrôle Vercel.

Aucun changement du moteur financier, des données, du schéma ou des RLS.
Aucun chantier mobile ajouté.
