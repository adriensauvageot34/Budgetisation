# Mois à venir — verre coloré V2

## Périmètre

```ini
HEAD_BEFORE = bc1e6c688995bdacfb233f31ba022fe9ded4b0f1
STRUCTURE = mêmes sections, ordre, données et interactions
BUSINESS_CHANGES = NONE
BUILDER_INTERNAL_CHANGES = NONE
SUPABASE_WRITES = NONE
DEPENDENCIES_ADDED = NONE
```

SHA livré : `git log -1 --format=%H -- docs/status/phase2-month-glass-v2-2026-10-01.md`.

Fichiers de production :

- `src/app/mois-a-venir/month-material.module.css`
- `src/app/mois-a-venir/month-story.tsx` : classes de surfaces et espacement des deux sections de données.
- `src/app/mois-a-venir/month-narrative-cards.tsx` : teinte bleue de la synthèse après l'essentiel.

## Direction visuelle

- Fond clair froid avec sept halos CSS bleus, cyan, roses et violets répartis sur la page.
- Verre principal à alpha 0,22–0,48, blur 24 px, saturation 140 %, contour lumineux et reflet diagonal en pseudo-élément.
- Navigation flottante : blur 30 px, saturation 155 %, capsule active lavande/bleue et CTA vert profond conservé.
- Quatre ressources : reflets bleus/roses/violets, transparence accrue et blur secondaire limité à 10 px. Logos originaux conservés.
- Charges : plaques plus translucides, ombre modérée, sans blur par ligne ; épargne désaturée chaude.
- Après charges : bannière bleu/vert en verre, chiffre plat.
- Calendrier : seule l'enveloppe utilise un blur de 18 px ; grille et cellules restent sobres.
- Quotidien et extras : enveloppes bleue/rose à blur 18 px ; cartes internes presque plates et sans blur.
- Projections : verre bleu/violet, scénario central lisible ; choix et précision réutilisent la même matière.
- Popovers : teinte claire davantage soutenue pour préserver la lecture des explications. Une explication ouverte passe au-dessus de la couche de verre suivante.

Tokens ajoutés/consolidés : `glass-highlight`, `glass-blue`, `glass-pink`, `glass-violet`, `glass-blur`, `glass-saturation`, `depth-floating`, `accent-focus`. Classes réutilisables `tintedBlue`, `tintedPink`, `tintedViolet`, `dataSection`. Les interactions hover/press et le mouvement des montants réutilisent les primitives existantes. Aucun blur n'est animé.

Les règles CSS de petit écran permettent le retour à la ligne de la navigation et le passage des cartes de données sur une colonne ; aucune refonte de parcours mobile. Le desktop a été inspecté dans le navigateur.

## Preuves ciblées

```ini
MONEY_PARITY = PASS (38 valeurs formatées strictement identiques avant/après)
STICKY_NAV = PASS (top 8 px au scroll)
CALENDAR_POPOVER = PASS
EXPLANATION_LAYER = PASS (z-index 10 à l'ouverture)
BUILDER_CTA_OPEN_CLOSE = PASS
BROWSER_CONSOLE_ERRORS = 0
CALENDAR_TESTS = PASS
NARRATIVE_TESTS = PASS
TYPECHECK = PASS (étape TypeScript du build)
PRODUCTION_BUILD = PASS
DIFF_CHECK = PASS
```

Commandes exécutées avec le runtime Node du poste :

```text
node scripts/check-phase2-planned-calendar.mjs
node scripts/check-phase2-month-narrative.mjs
node node_modules/next/dist/bin/next build
git diff --check
git diff --name-only -- src/domain src/server supabase src/app/mois-a-venir/actions.ts src/app/mois-a-venir/planned-expenses-control.tsx src/app/mois-a-venir/restaurant-wizard.tsx src/app/mois-a-venir/planned-intent-builder.tsx
```

La dernière vérification de périmètre retourne zéro fichier. Aucun enregistrement financier effectué pendant les smokes navigateur.

## Lisibilité et coût visuel

Contraste de palette sur un fond conservateur `#c3cbed` : montants 9,53:1 ; texte secondaire 4,64:1 ; focus 4,09:1. Texte blanc du CTA sur l'extrémité la plus claire du gradient : 5,48:1. Ces mesures ne constituent pas un audit WCAG exhaustif.

14 surfaces visibles avec backdrop-filter au repos : 10 enveloppes/navigation et 4 ressources. Zéro cellule de calendrier, ligne de charge ou carte de quotidien/extras avec blur. Un popover ouvert ajoute une surface. Ce contrôle statique du nombre de couches n'est pas un benchmark FPS.

Les préférences de mouvement réduit restent respectées, y compris le nouveau lift de 1 px des ressources. Le fallback de surfaces soutenues sans backdrop-filter est conservé. Aucun changement de calcul, d'action serveur, de funding, de transport ou de lifecycle.

## Captures locales

```text
C:/Users/Manon/Documents/Codex/2026-09-28/ve/outputs/month-glass-v2-2026-10-01
```

`before-top.png`, `before-full.png`, `after-top.png`, `after-full.png` ; captures après des ressources, charges, après charges, calendrier, quotidien, extras, projection, choix et précision ; `after-daily-info.png` et `after-calendar-popover.png`.

Les captures restent hors Git. Le rendu comparé montre davantage de couleurs derrière le verre, des panneaux transparents et des reflets directionnels, avec les mêmes valeurs financières.

Limites de vérification : pas de suite de comparaison pixel, pas d'audit mobile exhaustif, reduced-motion inspecté dans le code ; avertissements Next/Image préexistants sur certains logos du calendrier ; aucun lint configuré dans le dépôt.
