# History V2 — Frontend implementation report

## Gate d’entrée et périmètre

- Autorité normative : `Brief_Technique_Historique_Mensuel_V2_FINAL_CIBLE` et `Plan_Implementation_Frontend_Historique_V2`.
- Preuve d’entrée : `docs/history-v2/09-live-publication-report.md` termine par `HISTORY_V2_LIVE_GATE = PASS`.
- Périmètre implémenté : nouveau chemin desktop `/historique-v2/[month]`, sans cutover de `/historique`, sans suppression du rollback V1 et sans déploiement Production.
- Source de données : `/api/query` et les 15 familles History V2 exclusivement. Aucun accès Canonical direct et aucun read-through V1 n’a été ajouté.
- Le frontend n'effectue aucune écriture Supabase. La republication contractuelle
  des douze mois, désormais achevée à `analytics_revision=43`, est documentée
  séparément dans `11-frontend-contract-fixes-report.md`.

## Architecture livrée

Le chemin V2 est isolé du `ProductRuntimeProvider` historique afin qu’un état de navigation V1 ne puisse pas casser sa phase d’hydratation. Le rendu initial reste RSC, puis les Overview et drill-downs utilisent `useQueryRuntime` sur `/api/query`. Les routes publiques ne portent que le mois, la vue, la semaine, le Journal ou une cible métier stable.

Fichiers principaux :

- `src/app/historique-v2/page.tsx` : redirection vers le dernier mois fermé exploitable.
- `src/app/historique-v2/[month]/page.tsx` : RSC Calendar/Week ou M1–M4.
- `src/app/historique-v2/[month]/loading.tsx` : shell et grille neutres sans donnée fictive.
- `src/features/history-v2/history-v2-page.tsx` : route state, stack logique, focus et scroll.
- `src/features/history-v2/history-shell.tsx` : segmented, navigation mois et Overview.
- `src/features/history-v2/calendar-view.tsx` : Month, Week, Hover, Markers et Ribbons.
- `src/features/history-v2/balance-view.tsx` : Bilan M1–M4 et cohérence `PublicationMeta`.
- `src/features/history-v2/overlay-host.tsx` : Journal et six familles de drill-down.
- `src/features/history-v2/renderers.tsx` : Quality, Visibility, collections et erreurs techniques.
- `src/features/history-v2/route-state.ts` : deep links sémantiques.
- `src/features/history-v2/history-v2.module.css` : géométrie desktop, timings et reduced motion.
- `scripts/check-history-v2-frontend.mjs` : gate structurel frontend.

## Resource → composant

| Ressource V2 | Consommateur | Mode |
|---|---|---|
| `history_month_calendar` | `CalendarMonthView` | RSC |
| `history_week` | `WeekView` | RSC |
| `history_day_journal` | `JournalPanel` | lazy `/api/query` |
| `history_month_overview` | `MonthOverviewPopover` | lazy `/api/query` |
| `history_month_balance_summary` | M1 | RSC parallèle |
| `history_bank_economy_bridge` | Bridge drawer | lazy `/api/query` |
| `history_month_categories` | M2 | RSC parallèle |
| `history_category_detail` | Category drawer | lazy `/api/query` |
| `history_month_spending_nature` | M3 | RSC parallèle |
| `history_spending_segment_detail` | Segment/Margin drawer | lazy `/api/query` |
| `history_minimal_preview` | Minimal popover | lazy `/api/query` |
| `history_month_life_money` | M4 | RSC parallèle |
| `history_activity_detail` | Activity drawer | lazy `/api/query` |
| `history_moment_detail` | Moment drawer | lazy `/api/query` |
| `history_place_detail` | Place drawer | lazy `/api/query` |

## Routing et overlays

- Route canonique : `/historique-v2/YYYY-MM?view=calendar|balance`.
- Week : `week=YYYY-MM-DD` lundi ISO.
- Journal : `journal=YYYY-MM-DD`.
- Drill-down : `entity=bridge|category|segment|activity|moment|place` avec identifiant/paramètres métier.
- Aucun `snapshotId`, `publicationId` ou `revision` dans l’URL.
- Un seul drawer physique `HistoryOverlayHost`; profondeur logique maximum 6; cycle replié.
- Popovers temporaires mutuellement exclusifs avec le drawer via `history-v2:dismiss-transient`.
- Back sémantique : historique navigateur; remplacement intra-drawer : `replace`; fermeture : retour à la route source.

## Quality, Visibility et cohérence de publication

`MetricState`, `CollectionState` et `DisplayState` rendent directement les états publiés : `KNOWN`, `PARTIAL`, `UNKNOWN`, `NOT_APPLICABLE`, `CONFLICT`, `VISIBLE`, `PLACEHOLDER`, `HIDDEN`. Aucun seuil métier n’est recalculé. `KNOWN(0)` reste visible, `UNKNOWN` ne devient jamais zéro et `LOWER_BOUND` est qualifié « Au moins ».

Avant de rendre M1–M4, `BalanceMonthView` exige le même `publicationId`, `revision`, `factsHash` et les mêmes `policyVersions` sur les quatre payloads. Un mélange est bloqué par un état technique local avec retry.

## Vérification live des 12 mois

Le contrôle post-publication déjà acquis sur le projet `ipuuhxrblxormwgoaqnz`
a confirmé une publication active complète pour chaque mois `2025-08` à
`2026-07`, 15 familles par mois, 2 artifacts par mois, aucun read-through,
aucun `PublicationMeta` manquant et aucun mismatch de contrat/policy. La
révision analytique courante est `43`.

| Mois | Snapshots actifs | Familles | Artifacts | Read-through | Statut data live |
|---|---:|---:|---:|---:|---|
| 2025-08 | 75 | 15 | 2 | 0 | PASS |
| 2025-09 | 72 | 15 | 2 | 0 | PASS |
| 2025-10 | 77 | 15 | 2 | 0 | PASS |
| 2025-11 | 77 | 15 | 2 | 0 | PASS |
| 2025-12 | 75 | 15 | 2 | 0 | PASS |
| 2026-01 | 79 | 15 | 2 | 0 | PASS |
| 2026-02 | 72 | 15 | 2 | 0 | PASS |
| 2026-03 | 76 | 15 | 2 | 0 | PASS |
| 2026-04 | 77 | 15 | 2 | 0 | PASS |
| 2026-05 | 76 | 15 | 2 | 0 | PASS |
| 2026-06 | 76 | 15 | 2 | 0 | PASS |
| 2026-07 | 75 | 15 | 2 | 0 | PASS |
| Total | 907 | 15/mois | 24 | 0 | PASS |

Le smoke navigateur de la nouvelle route n’a pas pu être terminé : le processus
local ne reçoit pas les variables publiques Supabase, puis le harness local
Next/middleware/browser n'a pas fourni un environnement stable. Aucune valeur
n’a été extraite ou recréée et aucun contournement n'est conservé.

`VISUAL_SMOKE = NOT_COMPLETED_ENVIRONMENT_LIMITATION`

## Matrice UX01 → UX132

| ID | Composant et comportement implémenté | ReadModel | Preuve | Statut |
|---|---|---|---|---|
| UX01 | `HistoryV2Page`, cible desktop et largeur minimale | Route | CSS `.page` | PASS |
| UX02 | Shell commun aux deux vues | Route | `HistoryShell` | PASS |
| UX03 | Segmented Calendar/Bilan à gauche, ARIA tabs | Route | `history-shell.tsx` | PASS |
| UX04 | Navigation mois centrée en `1fr auto 1fr` | Route | CSS `.shell` | PASS |
| UX05 | Réserve droite symétrique | — | `.shellBalance` | PASS |
| UX06 | Shell `calc(100vw - 48px)`, max 1800 px | — | CSS `.shell` | PASS |
| UX07 | Aucun grand titre Historique | — | route V2 | PASS |
| UX08 | Redirection vers le dernier mois fermé éligible; plage live identique | Publications + bootstrap | index route + contrôle 12 mois | PASS |
| UX09 | Pilule active glissante en 200 ms | Route | `.segmented::before` | PASS |
| UX10 | Changement de vue conserve mois et ferme les overlays | Route | `HistoryV2Page.onView` | PASS |
| UX11 | Changement de mois conserve la vue et ferme les overlays | Route | `HistoryV2Page.onMonth` | PASS |
| UX12 | Titre mois 22 px + chevron interactif | — | `.monthTitle` | PASS |
| UX13 | Cards 12–16 px, bordure/ombre tokens | — | module CSS | PASS |
| UX14 | Hiérarchie typographique des modules/cards | — | module CSS | PASS |
| UX15 | 28 px entre modules, 12–24 px internes | — | `.balanceSurface/.balanceModule` | PASS |
| UX16 | Overview 780 px, portal sans reflow | `history_month_overview` | `MonthOverviewPopover` | PASS |
| UX17 | Close extérieur/Escape/chevron + focus trigger | Overview | shell popover | PASS |
| UX18 | Sorties bancaires/coût économique/entrées bancaires | Overview | `OverviewFlow` | PASS |
| UX19 | Repères vie publiés sans enrichissement client | Overview | `lifeMarkers` | PASS |
| UX20 | Un temps fort à la fois | Overview | `OverviewHighlights` | PASS |
| UX21 | Autoplay exactement 7000 ms | Overview | interval 7000 | PASS |
| UX22 | Pause immédiate au hover | Overview | état `paused` | PASS |
| UX23 | Flèches + indicateurs ARIA | Overview | carousel controls | PASS |
| UX24 | Crossfade/translation 8 px | Overview | `highlight-in` | PASS |
| UX25 | Aucun Typical/Minimal/rank/IA/category/margin dans Overview | Overview | composant fermé | PASS |
| UX26 | Calendar largeur max 1780 px | Month | `.calendarSurface` | PASS |
| UX27 | Marges desktop 24 px minimum | Month | `calc(100vw - 48px)` | PASS |
| UX28 | Sept colonnes lundi→dimanche | Month | `weekdayLabels` + CSS | PASS |
| UX29 | Aucun scroll horizontal Calendar | Month | `overflow: visible` | PASS |
| UX30 | Date+montant, contexts, Markers, +N | Month | `CalendarDayCell` | PASS |
| UX31 | Top 3 publié, sans retri | Month | `day.visibleMarkers` | PASS |
| UX32 | `hiddenMarkerCount` publié | Month | `MarkerList` | PASS |
| UX33 | Labels deux lignes, ellipsis dernier recours | Month | line-clamp 2 | PASS |
| UX34 | Jours hors mois atténués et interactifs | Month | `data-outside` | PASS |
| UX35 | Quatre lanes visibles | Month/Week | `RibbonRail` | PASS |
| UX36 | Lane 19–20 px | Month/Week | CSS ribbon | PASS |
| UX37 | Gap 4 px | Month/Week | CSS ribbon rail | PASS |
| UX38 | Gap rail→cellules 6 px | Month/Week | padding rail | PASS |
| UX39 | Chip overflow distinct du +N Marker | Month/Week | `.ribbonOverflow` | PASS |
| UX40 | Clic sur +N : collection ordonnée, identités et cibles serveur | `RibbonOverflowReadModel.items` | menu `RibbonRail`, `QueryTargetRef` publié, tests discriminants | PASS |
| UX41 | Intention souris 300 ms | Hover imbriqué | timers Calendar/Week | PASS |
| UX42 | Tolérance sortie 125 ms | Hover imbriqué | timers Calendar/Week | PASS |
| UX43 | Focus ouvre immédiatement | Hover imbriqué | `onFocus` | PASS |
| UX44 | Opacity + Y6 + scale .98, 150 ms | Hover imbriqué | `hover-in` | PASS |
| UX45 | Portal, placement vertical/horizontal, scrim, cellule élevée | Hover imbriqué | `DayHoverPopover` | PASS |
| UX46 | Trois dépenses humaines max +N | Hover imbriqué | `economicExpenses.slice(0,3)` | PASS |
| UX47 | Hover absent de l’historique navigateur | Hover imbriqué | état local | PASS |
| UX48 | Clic/Enter/Space natifs du bouton ouvrent Journal | Journal ref | `dayButton` | PASS |
| UX49 | Week deep link lundi ISO | `history_week` | `week` route param + schema serveur | PASS |
| UX50 | Sept colonnes riches | Week | `.weekGrid` | PASS |
| UX51 | Top 6 ordre serveur | Week | `day.visibleMarkers` | PASS |
| UX52 | Montant journalier, aucun histogramme | Week | `WeekDay` | PASS |
| UX53 | Aucun scroll interne par colonne | Week | CSS | PASS |
| UX54 | Jours hors référence interactifs | Week | `data-outside` | PASS |
| UX55 | Bilan ouvre le `referenceMonth` | Week | `referenceMonth` transmis au Shell | PASS |
| UX56 | Journal 700 px | Journal | `.overlayJournal` | PASS |
| UX57 | Right drawer, page non poussée | Journal | `OverlayFrame` | PASS |
| UX58 | Scroll vertical interne, overflow-x hidden | Journal | CSS `.journal` | PASS |
| UX59 | ×/Escape/scrim | Journal | `OverlayFrame closeOnBackdrop` | PASS |
| UX60 | Slide 210 ms | Journal | drawer CSS | PASS |
| UX61 | Date, montant central, participants | Journal | `JournalPanel` | PASS |
| UX62 | J−1/J+1 remplacent le contenu du même drawer | Journal | `onReplace` | PASS |
| UX63 | Heures uniquement si `timedTimeline` les publie | Journal | `JournalTimeline` | PASS |
| UX64 | Zone « Sans horaire précisé » | Journal | `untimedEvents` | PASS |
| UX65 | Mouvements techniques repliés | Journal | `<details>` | PASS |
| UX66 | Bilan max 1560 px | M1–M4 | `.balanceSurface` | PASS |
| UX67 | Quatre modules verticaux | M1–M4 | `BalanceMonthView` | PASS |
| UX68 | Actual visuellement dominant | M1 | `.actualValue` | PASS |
| UX69 | Bridge ciblé par `bridgeRef` de la ressource publiée | M1/Bridge | CTA + drawer | PASS |
| UX70 | Bridge dans le host unique | Bridge | `BridgePanel` | PASS |
| UX71 | Résumé importé manquant : microcopy exacte | M1 | `ImportedSummary` | PASS |
| UX72 | Résumé stale + badge « À actualiser » | M1 | `ImportedSummary` | PASS |
| UX73 | Minimal en popover 4 familles | Minimal | `MinimalPreviewPopover` | PASS |
| UX74 | Deux modes M2 au même niveau | Categories | `CategoryAnalysis` | PASS |
| UX75 | Aucun `.sort()` client | Categories | gate frontend | PASS |
| UX76 | Category drawer 640 px | Category detail | `.overlayStandard` | PASS |
| UX77 | Composition max 8 puis expansion | Category detail | `CategoryPanel` | PASS |
| UX78 | Badges lifecycle/marchands uniquement publiés | Category detail | nodes serveur | PASS |
| UX79 | Fréquence×ticket uniquement si diagnostic KNOWN | Category detail | `frequencyTicket` | PASS |
| UX80 | Tabs Explication/Composition/Nécessité/Fixe-Variable/Contexte | `CategoryDetailReadModel.classificationViews` | axes M3 préparés serveur, sélection seule côté React | PASS |
| UX81 | Trois cartes Necessity/Behavior/LifeScope | Spending nature | `SpendingNature` | PASS |
| UX82 | Segment/Margin drawer 640 px | Segment detail | `.overlayStandard` | PASS |
| UX83 | Matrice en euros publiés | Spending nature | `matrix.cells` | PASS |
| UX84 | LOWER_BOUND qualifié « Au moins » | MetricValue | `MetricState` | PASS |
| UX85 | Unknown jamais réparti/renormalisé | Spending nature | aucune logique de redistribution | PASS |
| UX86 | Aucune microcopy gaspillage/économie possible | M1/M3 | gate frontend | PASS |
| UX87 | Activités en grille 3 colonnes | Life money | `.activityGrid` | PASS |
| UX88 | Nombre exact publié, aucun remplissage artificiel | Life money | mapping direct | PASS |
| UX89 | Coût seulement CAUSAL/ASSOCIATED | Life money | `costKind` | PASS |
| UX90 | Activity drawer 640 px | Activity detail | host + occurrence→Journal/relations | PASS |
| UX91 | Moments 0 masqués | Life money | `MomentSection` | PASS |
| UX92 | Moment 1, grande carte sans contrôle | Life money | `.singleMoment` | PASS |
| UX93 | Moments 2–3 en rangée | Life money | `.momentRow` | PASS |
| UX94 | Moments 4+, trois visibles et navigation manuelle | Life money | `MomentSection` | PASS |
| UX95 | Aucun autoplay Moments | Life money | aucun interval dans M4 | PASS |
| UX96 | Média canonique ou fallback graphique | Life money | `imageRef/fallbackIcon` | PASS |
| UX97 | Moment drawer 680 px, causal/spentDuring séparés | Moment detail | `.overlayMoment` | PASS |
| UX98 | Deux métriques distinctes, jamais additionnées | Moment detail | `.dualMetrics` | PASS |
| UX99 | Lieux 0 masqués | Life money | `PlaceSection` | PASS |
| UX100 | Lieu 1, carte unique | Life money | `.placeRow` | PASS |
| UX101 | Lieux 2–3 en rangée | Life money | `.placeRow` | PASS |
| UX102 | Lieux 4–6 en rail horizontal | Life money | `.placeRail` | PASS |
| UX103 | Top 6 puis « Voir tous les lieux » | Life money | `items.slice(0,6)` | PASS |
| UX104 | Aucune carte géographique | Life money | absence de map | PASS |
| UX105 | Montant localisé rendu selon le MetricValue publié | Life money | `localizedAmount` | PASS |
| UX106 | Place drawer 600 px | Place detail | `.overlayPlace` | PASS |
| UX107 | Un drawer physique; popovers exclusifs | Navigation | `HistoryOverlayHost` + dismiss event | PASS |
| UX108 | Stack max 6 et cycles repliés | Query targets | `.slice(-6)` + `findIndex` | PASS |
| UX109 | Back remonte un niveau via browser history | Query targets | `router.back()` | PASS |
| UX110 | × ferme l’exploration et restaure l’ancre racine | Route provenance | `closeOverlay` | PASS |
| UX111 | Mois et vue restaurables | Route | `historyV2Href` | PASS |
| UX112 | Journal deep-linké par date | Journal | `journal` param | PASS |
| UX113 | Entity deep-linkée par type/id/params | Details | route-state | PASS |
| UX114 | Aucun identifiant technique dans l’URL | — | gate frontend | PASS |
| UX115 | Focus restauré trigger/niveau | Navigation | maps focus + OverlayFrame | PASS |
| UX116 | Scroll page et drawer restauré par niveau | Navigation | `scroll:false` + map scroll | PASS |
| UX117 | Day focusable, hover focus, Enter/Space Journal | Calendar | bouton natif | PASS |
| UX118 | Escape ferme l’actif | Overlays | listeners + OverlayFrame | PASS |
| UX119 | Segmented/tabs clavier + `aria-selected` | — | shell/category/M2 | PASS |
| UX120 | Écart exprimé par mots/signe, pas couleur seule | M1 | comparison copy | PASS |
| UX121 | Boutons icônes nommés | — | `aria-label`, icônes `aria-hidden` | PASS |
| UX122 | `KNOWN(0)` affiché | MetricValue | `MetricState` | PASS |
| UX123 | UNKNOWN indisponible ou masqué par DisplayNode | Metric/DisplayNode | renderers | PASS |
| UX124 | N/A distinct de missing | Metric/DisplayNode | renderers | PASS |
| UX125 | CONFLICT non arbitré | Metric/DisplayNode | renderers | PASS |
| UX126 | PARTIAL qualifié lower-bound/observed | MetricValue | renderers | PASS |
| UX127 | KNOWN_EMPTY distinct d’UNKNOWN | CollectionValue | `CollectionState` | PASS |
| UX128 | Un badge compact principal | QualityEnvelope | `QualityMark` | PASS |
| UX129 | Visibility directement serveur | DisplayNode | `DisplayState` | PASS |
| UX130 | Aucun seuil/score/coverage décisionnel React | Tous | gate sans `.sort()` ni seuil | PASS |
| UX131 | Animations sans changement de géométrie | — | opacity/transform/overlay | PASS |
| UX132 | Reduced motion retire translations/scales | — | media query | PASS |

Résultat matrice après correction et re-gate structurel : **132 PASS / 0 FAIL**.

## Écarts initiaux fermés

1. L'overflow Ribbon publie désormais chaque identité, son ordre serveur et sa
   cible `history_day_journal`; React ne rapproche ni titre ni date.
2. Le détail Category publie désormais les trois axes M3 indépendants et leurs
   montants non classés ; React sélectionne seulement l'onglet demandé.

Aucune 16e ressource, aucun God RPC et aucune reconstruction métier React n'ont
été introduits. Aucune divergence contractuelle restante n'est identifiée dans
le périmètre de ces deux corrections.

## Tests exécutés

| Contrôle | Résultat |
|---|---|
| Frontend resources/gate | PASS — 15/15, 132 IDs contrôlés |
| Architecture imports | PASS — 477 fichiers |
| Product completeness | PASS — 7 surfaces, 2 routes futures |
| Transversal Quality/Visibility | PASS — 48 checks |
| Calendar + Daily engines | PASS — 31/31 |
| History V2 ReadModels | PASS — 23/23 |
| Month Balance | PASS — 64/64 |
| Snapshot materialization dry-run | PASS — 50 checks, finalize false |
| Analysis Month V1 | PASS |
| Analysis Global V1 | PASS |
| Calendar/Day V1 | PASS |
| Exploration/Entities V1 | PASS |
| Live runtime regressions V1 | PASS |
| Typecheck | PASS |
| Next production build | PASS |
| `git diff --check` | PASS (avertissements EOL seulement) |
| 12 publications live read-only | PASS data — 907 snapshots, 24 artifacts, 0 read-through |
| Certification 12 mois déjà acquise | PASS — 907/907 RuntimeSchemas, 348 invariants, 0 FAIL |
| Republication live déjà acquise | PASS — revision 43, 24/24 artifacts, 907/907 snapshots courants, 0 read-through |
| Smoke visuel/interactif | `NOT_COMPLETED_ENVIRONMENT_LIMITATION` |

## Conclusion

Le code frontend V2 utilise uniquement les 15 ressources certifiées, préserve
V1 et ferme les deux écarts contractuels. Le gate code est PASS sur la base des
tests discriminants, de la certification 12 mois, de la republication live et
de la matrice UX structurelle 132/132. Le smoke visuel reste séparément non
terminé et n'est pas présenté comme une preuve acquise.

HISTORY_V2_FRONTEND_CODE_GATE = PASS
