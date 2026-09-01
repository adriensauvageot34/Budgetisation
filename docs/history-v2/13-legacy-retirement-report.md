# History V2 — retrait physique du legacy et protection Global

## 1. Gates d'entrée et périmètre

Le retrait part de l'état de cutover `30a4ca47ca353f17d011cf199cd8b64b1e07aafe`.
Les preuves d'entrée sont acquises dans
`docs/history-v2/12-frontend-cutover-readiness-report.md` :

- `HISTORY_V2_CODE_CUTOVER_GATE = PASS` ;
- `LEGACY_RETIREMENT_READY_GATE = PASS` ;
- 15/15 ressources History V2 et UX01→UX132 à 132/132 ;
- lecture V2 uniquement par snapshots actifs, sans read-through V1 ;
- rollback V2 et coexistence des données V1 déjà certifiés.

Ce lot modifie exclusivement le code du repository. Il n'effectue aucune
lecture ou écriture Supabase, aucun backfill, aucune publication de snapshot,
aucun Finalize et aucun purge de données.

## 2. Audit physique court des consommateurs

Les recherches ciblées ont suivi les symboles, clés de ressource, imports et
routes avant toute suppression :

- `CalendarClientPage`, `src/features/calendar` et les routes
  `/historique/calendrier/**` n'étaient plus consommés par la route canonique ;
- `AnalysisMonthPage` et `src/features/analysis/month` n'étaient plus consommés
  après le cutover du Bilan V2 ;
- `history_calendar_month`, `history_calendar_month_summary` et
  `history_day_detail` ne restaient appelés que par la pile V1, son backfill,
  son diagnostic et ses tests dédiés ;
- les 15 ressources History V2 n'importent aucun ReadModel V1 ;
- les ressources `analysis_month_*` restent réellement consommées par les
  moteurs Analysis, la matérialisation certifiée et les oracles de comparaison :
  elles ne sont donc pas supprimables dans ce lot ;
- `src/server/query/sources/analysis.ts` sert encore Analysis Month comme
  moteur interne et Analysis Global comme produit : il reste une dépendance
  Global protégée.

Après retrait, les seules occurrences textuelles des trois anciennes clés
History dans les checks sont des assertions négatives qui garantissent leur
absence du registre actif.

## 3. Retraits physiques autorisés

### Routes et UI

- suppression de l'alias pré-cutover `/historique-v2/**` ;
- suppression des routes Calendar V1 `/historique/calendrier/**` ;
- suppression de la route et de l'UI Analysis Month V1
  `/historique/analyse/[month]` ;
- suppression de `src/features/calendar/**` ;
- suppression de `src/features/analysis/month/**` et de sa feuille partagée
  devenue sans consommateur ;
- `/analyse` mène désormais à Analysis Global ;
- Analysis Global ouvre le mois sélectionné sur la route canonique
  `/historique/[month]?view=calendar|bilan` ;
- le Product Runtime n'est plus amorcé pour l'ancienne route Analysis Month.

### Query API et builders History V1

- suppression de `src/query-api/calendar/**` ;
- suppression de `src/server/query/sources/calendar.ts` ;
- retrait des trois clés History V1 des registries de ressources, capacités,
  contrats, schemas, adapters, sources, invalidations et validations ;
- retrait de ces trois requêtes du backfill Analytics ;
- retrait de leur diagnostic runtime.

### Tests et scripts devenus exclusivement legacy

- suppression de `scripts/check-calendar-day.mjs` ;
- suppression de `scripts/check-live-historical-regeneration.mjs`, dépendant du
  triplet History V1 et de son manifest 389 ;
- nettoyage des checks d'architecture et de complétude pour ne plus exiger la
  feature Calendar V1 ;
- remplacement des assertions de coexistence code V1 par des assertions de
  retrait du registre actif ;
- maintien des checks Analysis Month, Analysis Global, materialization et de
  tous les checks History V2.

Bilan physique avant ajout du présent rapport : 31 fichiers supprimés,
25 fichiers ajustés et plus de 6 100 lignes legacy retirées.

## 4. Éléments conservés

- `src/features/history-v2/**` et la route canonique `/historique/[month]` ;
- les 15 ressources Query History V2 ;
- `calendar_semantic_month` et `daily_economic_ledger_month` ;
- Quality/Visibility, PublicationMeta, contractVersion, factsHash et
  policyVersions ;
- CanonicalRepository, FactSourceResolver et tous les Facts ;
- moteurs Actual, Typical, Minimal, catégories, fixed/variable, life scope,
  activités, coûts causaux, places, merchants et matérialité/support ;
- ressources, builders et UI Analysis Global ;
- moteurs internes `analysis_month_*` encore utilisés par Analysis/Global et
  les oracles ;
- pipeline de matérialisation, profils V1/V2 et primitives de rollback ;
- migrations et structures Canonical, sans aucune nouvelle migration.

## 5. GLOBAL_ANALYTICS_DEPENDENCY_MATRIX

| Dépendance Global | Preuve physique | Rôle futur | Décision | Risque contrôlé |
|---|---|---|---|---|
| CanonicalRepository | `src/server/canonical/repository.ts` | accès canonique Household et données financières/vie | KEEP | aucune lecture UI directe |
| FactSourceResolver | `src/server/analytics/fact-source-resolver.ts` | sélection source-aware et résolution des facts | KEEP | autorité unique en amont |
| EconomicComponentFact | `src/analytics/facts/types.ts`, `economic-timing.ts` | montants, timing économique, classifications | KEEP | pas de copie Global |
| PurchaseEventFact | `src/analytics/facts/types.ts`, `purchase-event.ts` | grain achat et ownership | KEEP | pas d'heuristique de regroupement |
| ActivityOccurrenceFact | `src/analytics/facts/types.ts`, `canonical.ts` | fréquences et activités | KEEP | LifeEventId reste l'identité |
| PersonDayFact | `src/analytics/facts/types.ts`, `canonical.ts` | jours-personnes/support | KEEP | métrique partagée |
| PlaceVisitFact | `src/analytics/facts/types.ts`, `canonical.ts` | visites et localisation | KEEP | métrique partagée |
| Calendar Semantic / Daily Ledger V2 | `src/analytics/history-v2/**` | autorité mensuelle CERTIFIED_HISTORY pour le futur Global | KEEP | aucun rebuild React |
| Quality/Visibility/Publication | `src/core/history-v2/**`, `src/analytics/publication/**` | qualification, versions, provenance, publication | KEEP | contrats V1/V2 explicites |
| Moteurs Analysis partagés | `src/server/query/sources/analysis.ts` | Actual/Typical/Minimal, dimensions, trends et supports | KEEP_AS_INTERNAL_ENGINE | aucune UI Analysis Month V1 |
| Schemas Analysis Month | `src/query-api/analysis/month/**` | moteur/oracle et matérialisation mensuelle | KEEP_FOR_GLOBAL | non consommés par History V2 React |
| 8 ressources Analysis Month | `src/query-api/request/resource-registry.ts` | inputs mensuels et drill-downs internes | KEEP_FOR_GLOBAL | famille V1 explicite, pas de fallback History V2 |
| 9 ressources Analysis Global | registry + `src/query-api/analysis/global/**` | produit Global existant | KEEP | contrats Global contrôlés |
| UI Analysis Global | `src/features/analysis/global/**` | produit conservé | KEEP | navigation mois redirigée vers History V2 |
| Global planner/materialization | `src/server/analytics/materialization/global-planner.ts`, `identity.ts`, `store.ts` | agrégation et compatibilité snapshot | KEEP | versionnement déterministe |
| Navigation/Exploration/Operations | `src/navigation/**`, `src/components/runtime/**` | exploration et retour inter-contextes | KEEP_SHARED | runtime limité aux routes encore actives |
| Snapshots Analysis V1 | état live certifié dans le rapport 09 | oracle/rollback temporaire | KEEP_FOR_ROLLBACK_TEMPORARILY | aucune purge dans ce lot |
| Snapshots History V1 | état live certifié dans le rapport 09 | rollback temporaire | KEEP_FOR_ROLLBACK_TEMPORARILY | code de service retiré, données intactes |

La matrice ferme le risque de double source de vérité : History V2 consomme
uniquement ses 15 ressources snapshotées ; Analysis Global conserve ses
ressources propres ; les ressources Analysis Month restantes sont des moteurs
internes/oracles explicites et ne rendent plus une page mensuelle concurrente.

## 6. Registre Query final

Le registre actif contient 45 ressources :

- 3 ressources méthodologie/catalogue ;
- 15 ressources History V2 exactement :
  `history_month_calendar`, `history_week`, `history_day_journal`,
  `history_month_overview`, `history_month_balance_summary`,
  `history_bank_economy_bridge`, `history_month_categories`,
  `history_category_detail`, `history_month_spending_nature`,
  `history_spending_segment_detail`, `history_minimal_preview`,
  `history_month_life_money`, `history_activity_detail`,
  `history_moment_detail`, `history_place_detail` ;
- 8 ressources Analysis Month/target conservées comme moteurs internes ;
- 9 ressources Analysis Global ;
- 9 ressources Entities/Galleries/Operations.

Les trois anciennes ressources History V1 sont absentes du registre, de ses
types, schemas, contrats, adapters et sources.

## 7. Snapshots, publications et rollback temporaire

Le rapport live 09 constitue la dernière preuve live, non rejouée ici :

- 12/12 publications History V2 actives ;
- 24 artifacts V2 et 907 Query snapshots V2 ;
- 1 538 Query snapshots V1 coexistants, dont 1 149 Analysis V1 et donc
  389 History V1 ;
- zéro read-through V2 ;
- rollback atomique testé et publication restaurée.

Ces lignes live n'ont pas été modifiées ou purgées. Leur retrait est différé
jusqu'à la validation Production humaine demandée par le plan.

## 8. Tests exécutés

| Contrôle | Résultat |
|---|---|
| Architecture imports | PASS — 452 fichiers |
| Product completeness | PASS — 6 surfaces, 2 routes futures |
| Analysis Month contracts | PASS |
| Analysis Global contracts | PASS |
| Analytics materialization | PASS |
| Runtime regressions ciblées | PASS |
| History V2 Canonical | PASS |
| History V2 transversal | PASS — 48 checks |
| History V2 Calendar + Daily | PASS — 31/31 |
| History V2 ReadModels | PASS — 23/23 |
| History V2 Month Balance | PASS — 64/64 |
| History V2 snapshot materialization | PASS — 15 familles, 50 checks, Finalize=false |
| History V2 frontend | PASS — 15/15 ressources, UX01→UX132 132/132 |
| TypeScript `tsc --noEmit` | PASS |
| Next.js 16.2.6 production build | PASS |

Le build final ne contient plus que les routes History canonique
`/historique` et `/historique/[month]`, plus `/historique/analyse/global` pour
le produit Global protégé.

## 9. Matrice de conformité au Brief History V2

| Exigence normative | Preuve après retrait | Statut |
|---|---|---|
| Brief History V2 autoritaire | gates 09→12 et checks dédiés inchangés | PASS |
| Architecture Canonical → Facts → Analytics → Query → React | imports + sources V2 conservés | PASS |
| Aucune logique métier reconstruite dans React | check architecture et frontend | PASS |
| 15 ressources ciblées, aucun God RPC | registre final et check 15/15 | PASS |
| Calendar Semantic partagé | artifact `calendar_semantic_month` conservé | PASS |
| Daily Economic Ledger partagé | artifact `daily_economic_ledger_month` conservé | PASS |
| Catalogue 25 Life Events/Activities | check Calendar/Daily 31/31 | PASS |
| Catalogue 20 Moments | check Calendar/Daily 31/31 | PASS |
| fusion/absorption/promotion/agrégation | moteur Calendar V2 conservé | PASS |
| ordre serveur, top 3/top 6 et overflows séparés | ReadModels + frontend checks | PASS |
| ribbons, lanes, continuityQualifier | Calendar/Daily + ReadModels | PASS |
| effectiveEconomicDate sans bank fallback V2 | Daily Finance conservé | PASS |
| Purchase Event, allocations, cash uses, remboursements | Canonical + Daily Finance | PASS |
| KNOWN/PARTIAL/UNKNOWN/NOT_APPLICABLE/CONFLICT | transversal + renderers | PASS |
| réconciliation jours + unassigned = Actual | Calendar/Daily check | PASS |
| Month Calendar | `history_month_calendar` | PASS |
| Week serveur | `history_week` | PASS |
| Journal sans heure inventée | `history_day_journal` | PASS |
| Hover économique humain | projection Month/Journal V2 | PASS |
| Month Quick Overview sans Typical/Minimal/rang | `history_month_overview` | PASS |
| M1 bridge/residual/usual zone/rank/stale | Month Balance 64/64 | PASS |
| M2 baseline/pivots/drivers/compensator | Month Balance 64/64 | PASS |
| M2 nouveau/réapparu sans heuristique | contrats M2 conservés | PASS |
| M3 classifications/gaps/margins/MinimalPreview | ressources Bilan V2 conservées | PASS |
| M4 activités/coûts/détails | life-money + activity detail | PASS |
| M4 causalCost distinct de spentDuring | ReadModels 23/23 | PASS |
| M4 Moments/rang/média/fallback | moment detail | PASS |
| M4 Places/significance/localizedCoverage | place detail | PASS |
| QualityEnvelope/PartialMeaning/reasonCode | transversal 48 checks | PASS |
| DisplayNode/visibility | schemas + frontend renderers | PASS |
| PublicationMeta/factsHash/policyVersions | snapshot materialization 50 checks | PASS |
| contractVersion déterministe par ressource | registry contracts | PASS |
| Snapshot V1 incompatible jamais servi comme V2 | contrat V2 + zéro read-through | PASS |
| UX01–UX15 shell/navigation/mois | frontend check 132/132 | PASS |
| UX16–UX25 overview/carrousel | frontend check 132/132 | PASS |
| UX26–UX48 Calendar/Hover | frontend check 132/132 | PASS |
| UX49–UX55 Week | frontend check 132/132 | PASS |
| UX56–UX65 Journal | frontend check 132/132 | PASS |
| UX66–UX73 Bilan M1 | frontend check 132/132 | PASS |
| UX74–UX80 catégories/drawer | frontend check 132/132 | PASS |
| UX81–UX86 nature/marges/drawer | frontend check 132/132 | PASS |
| UX87–UX106 vie/activités/moments/places | frontend check 132/132 | PASS |
| UX107–UX121 overlay/deep links/focus/clavier | frontend check 132/132 | PASS |
| UX122–UX132 états/loading/error/motion | frontend check 132/132 | PASS |
| Route canonique `/historique/[month]` | build route manifest | PASS |
| Absence de fallback UI/ReadModel History V1 | source + assertions négatives | PASS |
| Coexistence et rollback des données V1/V2 | données live non touchées | PASS |
| Aucun retrait prématuré des snapshots V1 | 389 History + 1 149 Analysis conservés | PASS |
| Protection des primitives Global | matrice dédiée ci-dessus | PASS |

## 10. Risques et dette différée

- Les données snapshot V1 restent temporairement présentes jusqu'au smoke
  Production utilisateur ; aucune purge n'est autorisée dans ce lot.
- Les contrats de navigation internes Calendar/Analysis Month restent des
  primitives partagées pour Operations/Exploration et le futur Global, mais
  leurs sérialisations actives mènent désormais à History V2. Leur éventuelle
  simplification appartient à un lot Navigation/Global distinct.
- Les ressources Analysis Month restent dans le registre tant que les moteurs
  Global, la matérialisation et les oracles les consomment réellement.
- Le smoke visuel Production est volontairement séparé du gate code.

LEGACY_PHYSICAL_REMOVAL_GATE = PASS

ANALYSIS_GLOBAL_PROTECTION_GATE = PASS

HISTORY_V2_FINAL_CODE_GATE = PASS

HISTORIQUE_MENSUEL_V2_IMPLEMENTATION_COMPLETE = YES

VISUAL_SMOKE = PENDING_USER_PRODUCTION_VALIDATION
