# History V2 — Frontend cutover readiness report

## État d'entrée

- `HISTORY_V2_LIVE_GATE = PASS` ; 12/12 mois, 24/24 artifacts, 907/907
  snapshots, zéro read-through, rollback disponible et V1 non régressé.
- Les contrats Ribbon overflow et Category Detail sont PASS.
- Le gate frontend code est PASS avec UX01→UX132 à 132/132.
- Le smoke visuel reste une preuve différée ; il n'a pas été relancé dans ce lot.

## Routes avant et après

| Entrée | Avant | Après |
|---|---|---|
| Navigation « Historique » | `/historique` → ancien Calendar V1 | `/historique` → dernier mois V2 |
| Mois produit | `/historique-v2/[month]` | `/historique/[month]` |
| Deep links V2 | préfixe `/historique-v2/[month]` | préfixe `/historique/[month]` |
| Ancienne URL V2 | rendait V2 directement | redirige vers `/historique/[month]` en conservant la query |
| Ancien Calendar mois/jour/semaine | rendait le frontend V1 | redirige vers Calendar/Journal/Week V2 |

Le point d'entrée produit final est `/historique`. La page canonique
`/historique/[month]` rend l'unique `HistoryV2Page` et consomme exclusivement
les 15 ressources History V2. Les paramètres `view`, `week`, `journal`,
`entity`, `entityId`, `axis`, `bucket`, `necessity` et `behavior` restent portés
par la query canonique.

## Absence de fallback V1 et rollback

La route canonique n'importe ni `@/features/calendar`, ni
`historyCalendarMonth`, ni `historyDayDetail`. Les anciennes routes Calendar
ne construisent plus aucun ReadModel V1 : elles sont seulement des alias de
redirection vers V2. La navigation principale pointe directement vers
`/historique`.

Le code des anciens composants/moteurs V1, les snapshots V1 et les primitives
de rollback restent physiquement présents. Analysis conserve son runtime
historique propre. Aucun retrait legacy n'est réalisé ici et un retour au
commit/deployment Production précédent reste possible.

## Checks courts

| Contrôle | Résultat |
|---|---|
| `tsc --noEmit` | PASS après régénération des types `.next` obsolètes du harness supprimé |
| `scripts/check-history-v2-frontend.mjs` | PASS — 15/15 ressources, 132/132 UX et assertions de cutover |
| `next build` | PASS — build Production et routes App Router générés ; la première tentative sandbox a rencontré `spawn EPERM`, la relance isolée hors sandbox a réussi |
| `git diff --check` | PASS |

## Fichiers du cutover

- route canonique : `src/app/historique/[month]/page.tsx` et `loading.tsx` ;
- index : `src/app/historique/page.tsx` et `src/app/page.tsx` ;
- alias : `src/app/historique-v2/**` et `src/app/historique/calendrier/**` ;
- navigation/deep links : `src/features/history-v2/route-state.ts`,
  `src/components/layout/app-shell.tsx` ;
- isolation runtime : `src/components/runtime/product-runtime-provider.tsx` ;
- contrôle ciblé : `scripts/check-history-v2-frontend.mjs`.

Le nettoyage retire également la route/bundle/configuration temporaires de
publication et de smoke. Les rapports 10 et 11 consignent la fermeture des deux
contrats précédents.

## Actions externes

Aucune action Supabase, Vercel, Preview ou Production n'a été effectuée. Aucun
snapshot n'a été republié, aucune certification 12 mois n'a été relancée, aucun
push et aucun merge n'ont été réalisés.

`VISUAL_SMOKE = DEFERRED_TO_PRODUCTION_POST_DEPLOY`

HISTORY_V2_CODE_CUTOVER_GATE = PASS

LEGACY_RETIREMENT_READY_GATE = PASS

VISUAL_SMOKE = DEFERRED_TO_PRODUCTION_POST_DEPLOY
