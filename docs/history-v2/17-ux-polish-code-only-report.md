# History V2 — UX polish code-only

## Périmètre

- Branche : `main`.
- Base vérifiée avant modification : `fed90b855f685607f6ffa5db16e6d5b08aaf0215`.
- Nature du lot : `CODE_ONLY / FRONTEND_ONLY`.
- Les ReadModels, Query contracts, RuntimeSchemas, moteurs Analytics, snapshots et publications History V2 restent inchangés.
- Aucune lecture ou écriture Supabase, aucune matérialisation, aucune republication et aucun smoke navigateur n'ont été exécutés.

## Architecture de présentation

`src/features/history-v2/presentation.ts` centralise uniquement des transformations d'affichage déterministes : dates françaises, plages de dates, pluriels par famille connue, libellés des enums M3, rang historique humain et priorité `merchantLabel → placeLabel → label`. Il ne trie, ne sélectionne, ne somme et ne recalcule aucune donnée métier.

Les statuts `KNOWN/PARTIAL/UNKNOWN/NOT_APPLICABLE/CONFLICT` restent intacts. La vue mensuelle peut rendre la valeur seule, tandis que Hover et Journal conservent une note secondaire « Données partielles · certaines informations peuvent manquer ».

## Matrice UX

| UX_CHANGE | DATA_ALREADY_AVAILABLE | FRONTEND_CHANGE | BACKEND_CHANGE | STATUS |
|---|---|---|---|---|
| Calendar : jour seul dans le mois, jour + mois hors mois | `date`, `inSelectedMonth` | `formatCalendarDay()` | NONE | PASS |
| Calendar : suppression visuelle de `Observé :` et `Partiel` | montant et QualityEnvelope inchangés | valeur seule dans la cellule | NONE | PASS |
| Hover/Journal : qualité secondaire humaine | QualityEnvelope | `PartialDataNote` compact | NONE | PASS |
| Temporalité non affectée | `reasonCode` existant | `Date précise inconnue` | NONE | PASS |
| Calendar desktop compact | lanes et items publiés | cellules réduites, lanes CSS dynamiques, rail vide supprimé | NONE | PASS |
| Ribbons/Markers sans débordement | titre serveur complet | clamp/ellipsis et titre complet accessible | NONE | PASS |
| Aperçu : vocabulaire bancaire/économique humain | métriques existantes | Débits, Dépenses du mois, Entrées, Dépenses liées | NONE | PASS |
| Aperçu : unités naturelles | famille et compte | dictionnaire de noms et pluriels | NONE | PASS |
| Dates et plages françaises | LocalDate existantes | helpers communs, aucune mutation des dates | NONE | PASS |
| Journal : profondeur technique masquée | profondeur logique existante | sous-titre `Niveau …` retiré | NONE | PASS |
| Journal : titre de dépense humain | `merchantLabel`, `placeLabel`, `label` | priorité stricte sans parsing du libellé bancaire | NONE | PASS |
| Journal : raw label secondaire | `label` | disclosure `Voir le libellé bancaire` | NONE | PASS |
| Journal : collections lisibles | `otherExpenses` et autres collections séparées | titre `Dépenses du jour`, aucune fusion | NONE | PASS |
| M1 : nomenclature | valeurs Typical/Minimal existantes | Habituel, Minimum estimé, Zone habituelle, CTA humain | NONE | PASS |
| M1 : rang historique | `rank`, `universeCount` | phrase humaine sans reclassement | NONE | PASS |
| M1 : résumé absent | `freshness` | aucun placeholder pour `MISSING` | NONE | PASS |
| M2 : hiérarchie allégée | sélection et matérialité existantes | labels M2/Significatif masqués | NONE | PASS |
| M2 : zéros inutiles | métrique `KNOWN(0)` | ligne de réconciliation masquée | NONE | PASS |
| M3 : enums humains | clés stables existantes | dictionnaire de présentation centralisé | NONE | PASS |
| M3 : contributeurs | top 3 + Autres et ordre serveur | lignes verticales, aucun tri React | NONE | PASS |
| M3 : montant et part | montant et `shareOfActual` | `… % du mois`, aucun calcul React | NONE | PASS |
| M3 : marges | `immediateMargin`, `mediumMargin` | cartes proéminentes « Au moins … » et note PARTIAL discrète | NONE | PASS |
| M3 : matrice | six combinaisons existantes | repli local par défaut, données conservées | NONE | PASS |
| M3 : périmètre de vie | bucket `CURRENT_LIFE` | `Vie actuelle`, axe conservé | NONE | PASS |
| M4 : Activities | score, ordre et occurrence count existants | score masqué, `n fois ce mois`, ordre intact | NONE | PASS |
| M4 : coûts | `costKind` et métriques existants | Dépenses liées/associées, bloc absent pour `NONE` | NONE | PASS |
| M4 : Moments | rang, dates, `fallbackIconKey`, `imageRef` | rang masqué, dates françaises, fallback sémantique compact | NONE | PASS |
| M4 : Places | jours, montant localisé et métadonnées existants | score et `0 moment(s)` masqués, ligne naturelle | NONE | PASS |

Aucun point n'exige de champ serveur supplémentaire : `DEFERRED_SERVER_ENRICHMENT = NONE`.

## Fichiers

- `src/features/history-v2/presentation.ts`
- `src/features/history-v2/renderers.tsx`
- `src/features/history-v2/calendar-view.tsx`
- `src/features/history-v2/history-shell.tsx`
- `src/features/history-v2/history-v2-page.tsx`
- `src/features/history-v2/overlay-host.tsx`
- `src/features/history-v2/balance-view.tsx`
- `src/features/history-v2/history-v2.module.css`
- `scripts/check-history-v2-frontend.mjs`
- `docs/history-v2/17-ux-polish-code-only-report.md`

## Preuves et tests ciblés

| Contrôle | Résultat |
|---|---:|
| Frontend resources History V2 | `15/15 PASS` |
| Contrats UX existants | `132/132 PASS` |
| Helpers de présentation (dates, plages, pluriels, rang, enums, dépense) | PASS |
| Discriminants Calendar / Journal / M1–M4 | PASS |
| `tsc --noEmit` | PASS |
| `next build` | PASS |
| `git diff --check` | PASS avant commit |

Le build de production a été exécuté avec le mode officiel Next `workerThreads` afin d'éviter l'interdiction de création de processus enfant du sandbox Windows. Cette configuration était temporaire et ne figure pas dans le diff final.

## Garde-fou code-only

Le diff depuis la base ne contient aucun fichier sous :

- `src/analytics/**`
- `src/query-api/history-v2/**`
- `src/server/analytics/**`
- `src/core/history-v2/**`

`SUPABASE_WRITES = 0`

`SNAPSHOT_REPUBLICATION = NO`

`ACTIVE_HISTORY_V2_PUBLICATIONS_UNCHANGED = YES`

## Gates

`HISTORY_V2_UX_CALENDAR_GATE = PASS`

`HISTORY_V2_UX_JOURNAL_GATE = PASS`

`HISTORY_V2_UX_M1_M2_GATE = PASS`

`HISTORY_V2_UX_M3_GATE = PASS`

`HISTORY_V2_UX_M4_GATE = PASS`

`HISTORY_V2_UX_CODE_ONLY_BOUNDARY_GATE = PASS`

Le contrôle visuel Production reste volontairement manuel : `VISUAL_SMOKE = PENDING_USER_PRODUCTION_RETEST`.
