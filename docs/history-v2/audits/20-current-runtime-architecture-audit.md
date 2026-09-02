# History V2 — audit exhaustif de l’architecture runtime actuelle

> **Nature du document** : audit descriptif, sans correction applicative.
> **Baseline auditée** : branche `main`, commit `efa4cd2a4c27b4831263816d96f76e859a4356fb` (`feat(history-v2): refine history header and navigation`, 2026-09-02).
> **Périmètre d’observation** : repository GitHub courant, contrats, routes, builders, RuntimeSchemas, matérialisation et migrations versionnées. Aucun accès live Supabase n’a été exécuté pendant cet audit.
> **Limite importante** : un `git status` local/uncommitted n’est pas observable depuis le connecteur GitHub. L’audit est donc strictement attaché au commit distant ci-dessus. Aucun fichier applicatif, migration ou donnée n’a été modifié par cet audit ; seul le présent rapport est ajouté.

---

## A. Executive summary

L’Historique mensuel courant est une pile **History V2 native, snapshot-first et publication-first**. La route produit canonique ne reconstruit pas les calculs métier à l’ouverture : elle demande des ressources Query V2 ; le runtime tente d’abord de lire `analytics_query_snapshots`, valide le snapshot avec le RuntimeSchema courant ou une variante explicitement compatible, et **refuse un miss History V2** au lieu de reconstruire dynamiquement la ressource. Cette propriété est aujourd’hui l’invariant technique le plus structurant du runtime.

Le flux réel est :

```text
Supabase Canonical
  ↓
CanonicalRepository
  ↓
FactSourceResolver
  ↓
Analytics / moteurs mensuels History V2
  ↓
2 artifacts partagés
  ├─ calendar_semantic_month
  └─ daily_economic_ledger_month
  ↓
History V2 ReadModel builders
  ↓
RuntimeSchemas
  ↓
analytics_query_snapshots + analytics_artifacts
  ↓
analytics_publications (FROZEN_MONTH / publication active)
  ↓
Query API / executeQuery
  ↓
RSC /historique/[month]
  ↓
HistoryV2Page + composants React de présentation
```

Les surfaces réellement actives sont :

- `/historique` : redirection vers le dernier mois History V2 publié ;
- `/historique/[month]` : unique route mensuelle canonique ;
- vue Calendar mensuelle par défaut ;
- vue Week via `week=` ;
- Journal du jour en overlay ;
- Quick Overview dans le shell ;
- Bilan M1–M4 via `?view=balance` ;
- drill-downs Bridge, Category, Spending Segment, Activity, Moment, Place ;
- Minimal Preview en popover lazy ;
- résumé importé affiché dans M1 s’il existe dans le snapshot.

Le registre History V2 actif expose **15 ressources Query**, toutes sous contrat `v2`. Les anciennes ressources History V1 ont été retirées du registre actif et des routes produit. Il reste néanmoins des **moteurs/schemas Analysis Month V1 internes**, explicitement conservés pour Analysis Global, oracles et matérialisation ; ils ne servent plus une UI mensuelle History concurrente.

L’UI actuelle est majoritairement présentationnelle. Elle gère navigation, overlays, focus, filtres d’affichage, tabs locaux et formatage. Deux catégories de transformations client existent néanmoins et doivent être connues pour les audits suivants :

1. **projection de présentation autorisée** : filtre des marker groups selon les tags/presets, limites d’affichage, choix `ALL` vs `economicAmountExcludingFixed`, formatage et toggles ;
2. **quelques dérivations de présentation locales** : filtrage `.filter(...).slice(...)` dans le Hover, slicing/rotation des rails Moments/Places, calcul d’un numéro de jour dans un événement continu, `Math.round` pour les parts, test de signe d’un delta sérialisé. Elles ne recalculent pas Actual/Typical/Minimal/Materiality, mais doivent être revues dans l’audit UI/UX dédié pour vérifier qu’elles restent strictement présentationnelles.

La base technique est donc solide pour continuer les audits de détail. Les zones réellement ouvertes sont surtout : la qualité de l’UX/UI finale, la frontière exacte entre projection client et ReadModel, quelques compatibilités de snapshots anciennes encore acceptées par le runtime, et les besoins de futurs champs médias/Benefit Wallet/Global qui ne doivent pas être inventés dans History tant que leur contrat n’est pas figé.

---

## B. Commit audité, documents et migrations

### B.1 Baseline Git

- Branche distante : `main`.
- Commit : `efa4cd2a4c27b4831263816d96f76e859a4356fb`.
- Message : `feat(history-v2): refine history header and navigation`.
- Parent : `b593a4078ad38521489e7ef504fd6903c1bfa9c3`.
- `git status` local : **INCONNU / NON OBSERVABLE depuis l’API GitHub**.

### B.2 Documentation History V2 présente

Le dossier `docs/history-v2/` contient actuellement les rapports 01 à 20, notamment :

- `01-plan-architecture-validation.md`
- `02-canonical-missing-data-report.md`
- `02b-canonical-live-migration-report.md`
- `03-quality-visibility-publication-report.md`
- `04-calendar-daily-finance-report.md`
- `05-history-readmodels-report.md`
- `06-month-balance-report.md`
- `07-snapshot-materialization-report.md`
- `08-certification-12-months-report.md`
- `09-live-publication-report.md`
- `10-frontend-implementation-report.md`
- `11-frontend-contract-fixes-report.md`
- `12-frontend-cutover-readiness-report.md`
- `13-legacy-retirement-report.md`
- `14-production-smoke-fixes-report.md`
- `15-publication-coherence-fix-report.md`
- `16-visible-brief-gaps-fix-report.md`
- `17-ux-polish-code-only-report.md`
- `18-calendar-centric-implementation-report.md`
- `19-single-active-generation-report.md`
- `20-final-ux-polish-report.md`

Le rapport 20 confirme que le dernier lot avant cet audit était frontend/code-only et n’a pas modifié moteurs Analytics, ReadModels, RuntimeSchemas, factsHash, policies, migrations ou snapshots.

### B.3 Migrations directement structurantes pour History V2

Migrations versionnées actuellement utilisées par la pile :

- `20260822000000_purchase_event_identity.sql`
  - identité Purchase Event et garde de scope History V2 ;
- `20260825105100_analytics_materialization.sql`
  - `analytics_artifacts` ;
  - `analytics_query_snapshots` ;
  - `analytics_publications` ;
- `20260830090000_economic_component_classifications.sql`
  - assertions de classification composante × axe ;
- `20260830091000_life_event_continuity_assertions.sql`
  - assertions de continuité Life Event ;
- `20260831150000_history_v2_publication_rollback.sql`
  - restauration atomique de publication History V2 ;
- `20260902105811_enforce_single_active_analytics_generation.sql`
  - invariant de génération active unique.

L’état **déployé live** de ces migrations n’a pas été relu directement pendant cet audit ; les rapports `02b`, `09`, `13` et `19` restent les preuves repository antérieures. Cet audit ne les remplace pas par une affirmation live non vérifiée.

---

## C. Routes et surfaces actives

### C.1 `/historique`

Fichier : `src/app/historique/page.tsx`.

Comportement :

1. appelle `resolveLatestPublishedHistoryV2Month()` ;
2. le store cherche le dernier `history_month_calendar` actif et publié ;
3. si aucun mois n’est disponible, redirection `/diagnostic` ;
4. sinon redirection `/historique/YYYY-MM`.

Classification : **HISTORY-V2 NATIF**.

### C.2 `/historique/[month]`

Fichier : `src/app/historique/[month]/page.tsx`.

Route RSC `force-dynamic`.

Deux vues canoniques :

- Calendar : absence de `view` ;
- Bilan : `view=balance`.

Tout autre `view` est canonisé vers Calendar sans le paramètre `view`.

Paramètre `week=` uniquement en Calendar. La semaine est rattachée au `referenceMonth` déterminé par le jeudi (`weekStart + 3 jours`).

Chargements serveur :

**Calendar mensuel**

```text
history_month_calendar
history_month_overview
```

**Week**

```text
history_week
history_month_overview
```

**Bilan**

```text
history_month_overview
history_month_balance_summary
history_month_categories
history_month_spending_nature
history_month_life_money
```

Les détails ne sont pas chargés au SSR initial : ils sont récupérés lazy depuis le client lorsqu’un overlay/popover est ouvert.

Classification : **HISTORY-V2 NATIF**.

### C.3 Anciennes routes

Le retrait physique documenté a supprimé :

- `/historique-v2/**` ;
- `/historique/calendrier/**` ;
- `/historique/analyse/[month]` ;
- anciennes features Calendar V1 et Analysis Month UI.

`/historique/analyse/global` existe encore comme produit Global distinct et n’est pas une surface de l’Historique mensuel V2.

Classification : **LEGACY RETIRÉ DU PRODUIT**.

---

## D. Arbre des composants réellement actifs

```text
HistoryMonthRoute [RSC]
└─ HistoryV2Page [Client]
   ├─ HistoryShell [Client]
   │  ├─ navigation de vue Calendar/Bilan
   │  ├─ titre/mois + navigation mensuelle
   │  ├─ filtres Calendar
   │  └─ Month Quick Overview
   │     ├─ flux banque / dépenses
   │     ├─ repères de vie
   │     └─ carousel narratif
   │
   ├─ CalendarMonthView [Client]
   │  ├─ weekdayHeader
   │  ├─ CalendarWeek × 4–6
   │  │  ├─ Week link
   │  │  ├─ RibbonRail
   │  │  │  └─ RibbonOverflow menu
   │  │  └─ CalendarDayCell × 7
   │  │     ├─ montant jour
   │  │     ├─ ContextRow
   │  │     ├─ FilteredMarkerList
   │  │     └─ DayHoverPopover
   │  └─ ouverture Journal / Week / entity overlay
   │
   ├─ WeekView [Client]
   │  ├─ toolbar prev/next/back month
   │  ├─ RibbonRail
   │  └─ WeekDay × 7
   │     ├─ montant
   │     ├─ contexts
   │     ├─ markers
   │     └─ DayHoverPopover
   │
   ├─ BalanceMonthView [Client]
   │  ├─ M1 BalanceSummary
   │  │  ├─ Actual
   │  │  ├─ Typical
   │  │  ├─ Minimal
   │  │  ├─ comparaisons
   │  │  ├─ usual zone / historical rank
   │  │  ├─ Bank→Economy trigger
   │  │  └─ ImportedSummary
   │  ├─ M2 CategoryAnalysis
   │  │  ├─ tabs montant / delta
   │  │  └─ CategoryRow → Category overlay
   │  ├─ M3 SpendingNature
   │  │  ├─ necessity
   │  │  ├─ behavior
   │  │  ├─ lifeScope
   │  │  ├─ projections contributors
   │  │  └─ matrix → Segment overlay
   │  └─ M4 LifeMoney
   │     ├─ Activity cards
   │     ├─ Moment rail
   │     └─ Place rail
   │
   ├─ HistoryOverlayHost [Client]
   │  └─ OverlayFrame
   │     ├─ JournalPanel
   │     ├─ BridgePanel
   │     ├─ CategoryPanel
   │     ├─ SegmentPanel
   │     ├─ ActivityPanel
   │     ├─ MomentPanel
   │     └─ PlacePanel
   │
   └─ MinimalPreviewPopover [Client portal]
```

### D.1 Nature Server/Client

- `src/app/historique/[month]/page.tsx` : Server Component / orchestration de requêtes initiales.
- Toute la feature `src/features/history-v2/**` observée ici : Client Components ou helpers purs de présentation/route.
- Les builders ReadModels et moteurs Analytics restent hors React sous `src/query-api/history-v2/**`, `src/analytics/history-v2/**` et `src/server/analytics/**`.

---

## E. Carte backend réelle

### E.1 Canonical

Autorité : `src/server/canonical/repository.ts` / `CanonicalRepository`.

Responsabilité : lectures Household-scoped des données financières, temporalité, événements, personnes, lieux, achats et assertions V2.

Tables/relations directement visibles dans les contrats History V2 et rapports :

- opérations et allocations économiques existantes ;
- Purchase Events et memberships/timing ;
- `economic_component_classifications` ;
- `life_event_continuity_assertions` ;
- données personnes, lieux, visites, Moments/Life Events nécessaires aux Facts.

Le frontend History ne lit jamais ces tables directement.

Classification : **REUSE — autorité Canonical partagée**.

### E.2 Facts

Autorité : `src/server/analytics/fact-source-resolver.ts` / `FactSourceResolver`.

Facts conservés comme fondations partagées :

- `EconomicComponentFact` ;
- `PurchaseEventFact` ;
- `ActivityOccurrenceFact` ;
- `PersonDayFact` ;
- `PlaceVisitFact` ;
- faits/classifications/relations nécessaires aux Moments, places, causalité et temporalité économique.

`FactSourceResolver` reste l’unique résolveur source-aware. Il peut utiliser la matérialisation pour des métriques certifiées lorsqu’elle est disponible, mais la validation historique possède aussi un mode read-only sans store.

Classification : **REUSE / ADAPT partagé**.

### E.3 Analytics et moteurs History V2

Fichiers structurants :

- `src/analytics/history-v2/calendar/**` ;
- `src/analytics/history-v2/daily-finance/**` ;
- `src/analytics/history-v2/month-balance/**` ;
- `src/server/analytics/history-v2-monthly-engines.ts` ;
- `src/analytics/history-v2/facts-hash.ts` ;
- policies Quality/Visibility et PublicationMeta sous `src/core/history-v2/**` / `src/analytics/history-v2/**`.

Deux artifacts partagés font autorité pour Calendar/Daily :

1. `CalendarSemanticMonthArtifact`
2. `DailyEconomicLedgerMonthArtifact`

Ils contiennent les décisions métier que les builders ne doivent pas reconstruire : ordre sémantique Calendar, continuité/ribbons, timing économique, ledger journalier, dépenses économiques humaines et données non assignées.

Le Bilan utilise les moteurs mensuels partagés/Analysis pour Actual, Typical, Minimal, catégories, classifications, fréquence × ticket, bridge, activités, coûts, places et supports. Les anciens **moteurs Analysis Month** restent présents comme infrastructure interne/oracle pour Global et certains calculs partagés ; leur UI mensuelle a été retirée.

Classification :

- Calendar/Daily : **HISTORY-V2 NATIF** ;
- moteurs financiers/statistiques partagés : **REUSE / ADAPT** ;
- Analysis Month UI V1 : **LEGACY RETIRÉ** ;
- Analysis Month engines/schemas encore nécessaires : **LEGACY TECHNIQUE PROTÉGÉ / KEEP_FOR_GLOBAL**, pas une source UI concurrente.

---

## F. Facts / Analytics — responsabilité par surface

### Calendar / Week

Entrées principales : Calendar Semantic + Daily Economic Ledger.

Décisions serveur :

- montant économique du jour ;
- `economicAmountExcludingFixed` ;
- contexts ;
- ordre complet `orderedMarkerGroups` ;
- markers/ribbons et overflow ;
- references vers Journal/Details ;
- hover imbriqué et top dépenses ;
- statut/qualité/visibility.

React ne décide pas de la matérialité ni de l’ordre analytique initial.

### Journal

Builder : `buildJournalDayReadModel()`.

Décisions serveur :

- Contexts ;
- événements continus ;
- timeline timed ;
- événements sans heure ;
- séparation dépenses / refunds / inflows / technical movements ;
- ownership narratif ;
- causalCost distinct de spentDuring ;
- navigation J−1/J+1.

### Overview

Builder : `buildMonthQuickOverviewReadModel()`.

Expose :

- bankOutflows ;
- economicActual ;
- bankInflows ;
- life markers ;
- highlights ;
- narrative carousel ;
- total eligible highlights.

Ne porte volontairement pas Typical/Minimal/rang.

### Bilan M1

Builder : `buildMonthBalanceSummaryReadModel()`.

Expose : Actual, Typical, Minimal, Actual-vs-Typical, Actual-vs-Minimal, usual zone, historical rank, imported summary freshness et bridge ref.

### Bilan M2

Builders : `buildMonthCategoriesReadModel()`, `buildCategoryDetailReadModel()`.

Expose : catégorie, Actual, share, Typical, delta, matérialité, typical composition, drivers, compensator, residual, fréquence × ticket, merchant/purchase drivers, lifecycle badges, projections classifications.

### Bilan M3

Builders : `buildMonthSpendingNatureReadModel()`, `buildSpendingSegmentDetailReadModel()`, `buildMinimalPreviewReadModel()`.

Expose : necessity / behavior / lifeScope indépendants, matrice, segments, contributors, other amount, margins et composition Minimal.

### Bilan M4

Builders : `buildMonthLifeMoneyReadModel()`, `buildActivityDetailReadModel()`, `buildMomentDetailReadModel()`, `buildPlaceDetailReadModel()`.

Expose : occurrences, coûts causaux/associés, Moments, causalCost vs spentDuring, places, finance localisée et coverage.

---

## G. ReadModels et contrats réellement utilisés

### G.1 Les 15 ressources actives

| Resource Query | ReadModel | Usage UI |
|---|---|---|
| `history_month_calendar` | `MonthCalendarReadModel` | Calendar mensuel |
| `history_week` | `WeekReadModel` | vue semaine |
| `history_day_journal` | `JournalDayReadModel` | drawer Journal |
| `history_month_overview` | `MonthQuickOverviewReadModel` | shell/overview |
| `history_month_balance_summary` | `MonthBalanceSummaryReadModel` | Bilan M1 |
| `history_bank_economy_bridge` | `BankEconomyBridgeReadModel` | drawer bridge |
| `history_month_categories` | `MonthCategoriesReadModel` | Bilan M2 |
| `history_category_detail` | `CategoryDetailReadModel` | drawer catégorie |
| `history_month_spending_nature` | `MonthSpendingNatureReadModel` | Bilan M3 |
| `history_spending_segment_detail` | `SpendingSegmentDetailReadModel` | drawer segment |
| `history_minimal_preview` | `MinimalPreviewReadModel` | popover Minimal |
| `history_month_life_money` | `MonthLifeMoneyReadModel` | Bilan M4 |
| `history_activity_detail` | `ActivityDetailReadModel` | drawer activité |
| `history_moment_detail` | `MomentDetailReadModel` | drawer Moment |
| `history_place_detail` | `PlaceDetailReadModel` | drawer lieu |

### G.2 Métadonnées communes

Les ReadModels History V2 portent :

- `resourceInputHash` ;
- `policyVersions` ;
- `publicationMeta` après matérialisation/publish ;
- `sourceRefs` ;
- `capabilities` ;
- `quality` lorsque nécessaire.

`PublicationMeta` apporte l’identité de publication, la révision, le factsHash et les versions de policy cohérentes.

### G.3 États de donnée

La pile transporte explicitement :

- `KNOWN` ;
- `PARTIAL` + partial meaning ;
- `UNKNOWN` ;
- `NOT_APPLICABLE` ;
- `CONFLICT` ;
- `DisplayNode.visibility` (`VISIBLE`, `HIDDEN`, `PLACEHOLDER`, etc.) avec reason codes.

Les renderers React (`DisplayState`, `MetricState`, `CollectionState`, `MoneyMetric`, `PartialDataNote`) consomment ces états ; React ne transforme pas UNKNOWN en zéro.

### G.4 RuntimeSchemas

Registry : `src/query-api/read-model-registry.ts`.

Schemas History V2 :

- `src/query-api/history-v2/schemas.ts` ;
- `src/query-api/history-v2/month-balance-schemas.ts`.

Le runtime appelle `queryDataSchemaForContractVariant()` puis `validateQueryData()` à chaque lecture. Pour History V2, un snapshot matérialisé qui ne valide pas son contrat fait échouer la query ; il n’est pas remplacé silencieusement par un calcul dynamique.

### G.5 Compatibilités de contrat encore supportées

Le runtime connaît :

- `current` ;
- `history_v2_calendar_centric_old` ;
- `history_v2_visible_gaps_legacy`.

Les schemas contiennent donc encore certaines branches `old*ReadModelSchema` pour lire des générations explicitement compatibles. C’est une compatibilité de snapshot versionnée, pas un retour au frontend History V1.

Classification : **ADAPT / dette de transition contrôlée**.

---

## H. Snapshots, artifacts et publications

### H.1 Profil de matérialisation

`history-v2-month@v1`.

Stores :

- `analytics_artifacts` ;
- `analytics_query_snapshots` ;
- `analytics_publications`.

Artifacts partagés :

- `calendar_semantic_month` ;
- `daily_economic_ledger_month`.

### H.2 Manifest et fermeture de dépendances

`src/server/analytics/materialization/history-v2.ts` :

- `historyV2QueryResources` est dérivé du registre des ressources de famille `history_v2` ;
- les top-level resources comprennent Calendar, Overview et M1–M4 + bridge/minimal ;
- le seed materialise également chaque Journal du mois et chaque Week possédée ;
- les `QueryTargetRef` embarqués dans les ReadModels sont découverts pour fermer les drill-downs ;
- les cibles M3 de segments/matrice sont aussi découvertes ;
- une cible non-History-V2 est rejetée pendant la fermeture ;
- le manifest fixe required artifacts, required query keys, external refs et fact dependencies ;
- `publicationFactsHash` est commun à la publication mensuelle.

### H.3 Lecture runtime : snapshot obligatoire

`executeQuery()` :

1. normalise la requête ;
2. résout contexte/auth/capabilities ;
3. appelle `materialization.readQuery(request)` ;
4. valide les données avec le RuntimeSchema correspondant à la variante de contrat ;
5. **si la famille est `history_v2` et que le store existe mais retourne un miss : `TEMPORARY_UNAVAILABLE`** ;
6. aucun adapter dynamique History V2 n’est exécuté dans ce cas.

C’est l’interdiction effective de lazy business calculation à la navigation.

### H.4 FROZEN_MONTH / cache

Pour un mois fermé, la cache policy matérialisée est `revalidate: never`.

Le store ne sert que des snapshots :

- actifs ;
- non invalidés ;
- non expirés ;
- liés à une publication `published` ;
- contract version compatible ;
- method signature explicitement acceptée ;
- Household/scope corrects.

Les corrections doivent produire une nouvelle génération/publication ; les migrations de rollback et de génération active unique renforcent cette doctrine.

### H.5 Preuves live historiques déjà présentes dans le repository

Le rapport de retrait legacy cite la dernière preuve live certifiée :

- 12/12 publications History V2 actives ;
- 24 artifacts V2 ;
- 907 Query snapshots V2 ;
- zéro read-through ;
- rollback testé.

Ces chiffres sont **des preuves historiques documentées**, pas une relecture live effectuée pendant le présent audit.

---

## I. Query API / loaders

### I.1 Query server

Entrée : `src/server/query/runtime.ts`.

`createQueryServicesForContext()` construit :

```text
CanonicalRepository
+ SupabaseAnalyticsMaterializationStore
+ FactSourceResolver
+ MetricQueryService
+ createRealQuerySources(...)
```

Le runtime expose :

- `executeAuthenticatedQuery()` ;
- `executeAuthenticatedQueries()` ;
- `resolveLatestPublishedHistoryV2Month()` ;
- fonctions de health/read-only pour sources Canonical/Minimal.

### I.2 Sources History V2 dynamiques

`src/server/query/sources/history-v2.ts` expose encore les 15 reader names, mais chacun appelle `requiresFrozenPublication()` et lève `TEMPORARY_UNAVAILABLE`.

Ce fichier est volontaire : les builders existent pour préflight/certification/materialisation, mais le chemin produit n’a pas le droit de mint une publication dynamique.

Classification : **HISTORY-V2 NATIF / gate anti-lazy**.

### I.3 Batching SSR

La route mensuelle utilise `executeAuthenticatedQueries()` qui partage les mêmes services entre les requêtes du batch et lance les queries via `Promise.all`.

Le Calendar SSR = 2 queries ; Week SSR = 2 ; Bilan SSR = 5. Les drill-downs partent ensuite par `useQueryRuntime` au besoin.

---

## J. Logique React observée

### J.1 Ce qui reste purement présentation/navigation

- `router.push/replace` avec état URL canonique ;
- maintien du mois/vue/filtres ;
- stack d’overlays jusqu’à 6 entrées ;
- restauration focus ;
- restauration scroll overlay ;
- hover 300 ms / leave 125 ms ;
- fermeture Escape/click outside ;
- tabs catégories et modes M2/M3 ;
- toggles d’affichage ;
- formatage argent/dates ;
- responsive/styles CSS ;
- affichage des états `DisplayNode`.

### J.2 Transformations React à surveiller

Aucun recalcul direct d’Actual, Typical, Minimal, rank, materiality ou causalCost n’a été identifié dans les composants inspectés. En revanche, les projections suivantes existent :

1. `projectFilteredMarkers(...)`
   - filtre les `orderedMarkerGroups` selon les presets/tags Calendar ;
   - recalcule le nombre masqué correspondant au filtre d’affichage ;
   - à classer **projection de présentation**, mais à auditer spécifiquement dans le lot Calendar UX.

2. `DayHoverPopover`
   - filtre `calendarEvents` selon `filterTags` puis `.slice(0, 3)` ;
   - `.slice(0, 3)` aussi sur `economicExpenses` ;
   - ce sont des limites de présentation à comparer au contrat serveur/top N durant l’audit suivant.

3. `amountNode()` / `hoverAmountNode()`
   - choisit `economicAmount` ou `economicAmountExcludingFixed` selon le filtre ;
   - ne recalcule pas le montant ;
   - si le champ manque : `PUBLICATION_CONTRACT_MISMATCH` placeholder.

4. rails M4
   - slicing/offset du tableau déjà préparé pour le carousel ;
   - ordre analytique reste celui du ReadModel.

5. `dayOffset()`
   - calcule le numéro de jour relatif d’un événement continu à partir de dates publiées ;
   - pure présentation temporelle.

6. parts / labels
   - `Math.round(share * 100)` ;
   - formatage de delta et labels de comparaison ;
   - aucune nouvelle métrique stockée.

### J.3 Publication coherence dans React

`BalanceMonthView` vérifie que les quatre modules actifs partagent une publication cohérente via `publicationMetasAreCoherent()`. Si incohérent, il affiche une erreur et propose reload.

Ce contrôle frontend est une **garde de cohérence de transport**, pas une reconstruction de publication.

---

## K. Écarts, ambiguïtés et points à investiguer

### K.1 Git status / live Supabase

- statut du working tree local : inconnu depuis GitHub ;
- état Supabase live actuel : non interrogé pendant cet audit ;
- les chiffres live 12 mois restent donc des preuves antérieures, pas une preuve fraîche.

### K.2 Frontend projections vs contrat serveur

À auditer dans les lots suivants :

- top N Hover exécuté en React alors que le serveur fournit déjà des collections ordonnées ;
- filtres Calendar projetés côté client sur `orderedMarkerGroups` ;
- rail M4 paginé/slicé côté client ;
- `shouldShowMoneyNode()` détermine la disparition de lignes à zéro ;
- certains labels de comparaison dépendent du signe de `delta` sérialisé.

Aucune de ces lignes n’est démontrée comme bug métier dans le présent audit ; elles sont seulement les frontières où un détail UI peut révéler un besoin de ReadModel plus explicite.

### K.3 Compatibilités snapshots anciennes

Les variantes `history_v2_calendar_centric_old` et `history_v2_visible_gaps_legacy` restent supportées. Il faudra décider plus tard quand leur compatibilité peut être retirée sans casser les publications encore actives/rollback.

### K.4 `unassignedTiming`

Le champ est toujours dans `MonthCalendarReadModel` et snapshoté, mais le rapport UX final indique que son bandeau visible a été retiré du Calendar. C’est un exemple clair de **donnée serveur conservée mais non rendue**.

### K.5 Médias

Les ReadModels possèdent déjà `imageRef?` sur Highlights/Moment/NarrativeCard, mais le repository actuel ne montre pas encore une console média ni une doctrine complète `MediaAsset / MediaAssignment`. Il ne faut pas déduire de ces champs une architecture média déjà implémentée.

### K.6 Benefit Wallet

Aucun contrat History V2 courant ne doit être interprété comme support complet Swile/Edenred. Les futurs `FundingSummary` / wallet movements ne sont pas encore une partie du runtime History actuel.

---

## L. Zones legacy restantes

### L.1 Retiré physiquement

- frontend Calendar V1 ;
- frontend Analysis Month V1 ;
- routes mensuelles V1 ;
- anciens Query resources History V1 ;
- anciens builders History V1 actifs.

### L.2 Conservé volontairement

- moteurs `analysis_month_*` ;
- schemas Analysis Month ;
- ressources Analysis Month internes ;
- snapshots V1 anciens conservés pour rollback/oracle selon les rapports précédents ;
- primitives Materialization / Query partagées.

Ces éléments sont **LEGACY TECHNIQUE PROTÉGÉ**, pas « History V1 encore servi ».

### L.3 Compatibilité History V2 ancienne

Les variantes de snapshot `history_v2_*_old/legacy` constituent une dette de migration **History V2**, distincte de la stack History V1 retirée.

---

## M. Diagrammes end-to-end

### M.1 Chemin produit normal

```text
Utilisateur
  ↓
/historique
  ↓
resolveLatestPublishedHistoryV2Month()
  ↓
analytics_query_snapshots (history_month_calendar actif)
  ↓
redirect /historique/YYYY-MM
  ↓
HistoryMonthRoute [RSC]
  ↓
executeAuthenticatedQueries(...)
  ↓
executeQuery()
  ↓
SupabaseAnalyticsMaterializationStore.readQuery()
  ↓
SNAPSHOT HIT OBLIGATOIRE POUR history_v2
  ↓
RuntimeSchema + request coherence
  ↓
PublicationMeta / ApiMeta
  ↓
HistoryV2InitialState
  ↓
HistoryV2Page [React]
  ↓
HistoryShell + Calendar/Week/Bilan
```

### M.2 Chemin de construction d’une publication

```text
Supabase Canonical
  ↓
CanonicalRepository
  ↓
FactSourceResolver
  ↓
Analytics / monthly engines
  ↓
CalendarSemanticMonthArtifact
DailyEconomicLedgerMonthArtifact
  ↓
History V2 builders
  ↓
15 familles Query + instances dates/weeks/drill-downs
  ↓
RuntimeSchemas
  ↓
HistoryV2 manifest + factsHash + policyVersions
  ↓
STAGE
  ├─ analytics_artifacts
  └─ analytics_query_snapshots
  ↓
analytics_publications
  ↓
CERTIFY / ACTIVATE
  ↓
une génération active cohérente
```

### M.3 Drill-down lazy

```text
React affiche snapshot top-level
  ↓ clic
HistoryOverlayHost
  ↓
useQueryRuntime(resource + params)
  ↓
Query runtime
  ↓
snapshot drill-down pré-matérialisé
  ↓
RuntimeSchema
  ↓
overlay
```

Même lorsqu’un drawer est « lazy » côté UX, son **calcul métier ne l’est pas** : seule sa lecture réseau est différée ; le snapshot doit déjà exister.

---

## N. Questions réellement ouvertes après cet audit

1. Les derniers détails UI/UX nécessitent-ils seulement des projections de présentation ou certains exigent-ils de nouveaux champs server-prepared ?
2. Le top N du Hover doit-il rester projeté côté client ou être rendu explicitement par le ReadModel courant ?
3. Le filtrage Calendar actuel, qui part de `orderedMarkerGroups`, respecte-t-il exactement l’expérience souhaitée pour tous les presets ?
4. Certains rails/carrousels M4 nécessitent-ils un contrat de sélection serveur plus explicite (notamment lieux narratifs vs retail) ?
5. Quels champs snapshotés mais non rendus (`unassignedTiming`, autres) doivent être conservés pour futur usage vs retirés lors d’une prochaine version de contrat ?
6. À quel moment les variantes de snapshot History V2 anciennes peuvent-elles être retirées ?
7. La prochaine vérification live doit-elle recertifier les 12 mois après les derniers ajustements ou seulement les scopes dont le contrat/hash change ?
8. L’introduction future des médias doit-elle rester `CONTENT_SCOPED` sans invalider Analytics, tout en forçant une republication History ?
9. L’intégration Benefit Wallet devra-t-elle étendre les 15 ReadModels existants ou créer de nouvelles ressources uniquement pour les surfaces de détail ?
10. Les dépendances Global doivent être auditées contre les artifacts/snapshots History actuels avant toute réutilisation comme `CERTIFIED_HISTORY`.

---

## Annexe — corrections candidates (volontairement courte)

Aucune correction n’est appliquée dans cet audit.

Candidats à examiner seulement après les audits Calendar/UI-UX et Bilan :

- vérifier la frontière top-N/filtering React vs ReadModel ;
- documenter les champs snapshotés actuellement non affichés ;
- planifier la sortie des contract variants History V2 legacy lorsque les publications actives le permettent ;
- effectuer une recertification live ciblée après les éventuels changements de contrat/snapshot.

---

## Classification finale

| Étage | Classification |
|---|---|
| CanonicalRepository | REUSE |
| FactSourceResolver | REUSE |
| Facts partagés | REUSE |
| Calendar Semantic | HISTORY-V2 NATIF |
| Daily Economic Ledger | HISTORY-V2 NATIF |
| Month Balance engines | REUSE / ADAPT |
| History V2 builders | HISTORY-V2 NATIF |
| History V2 RuntimeSchemas | HISTORY-V2 NATIF |
| 15 Query resources | HISTORY-V2 NATIF |
| Snapshot-first executeQuery | HISTORY-V2 NATIF |
| `analytics_*` stores | REUSE / ADAPT |
| HistoryV2Page/UI | HISTORY-V2 NATIF |
| anciennes routes/UI History V1 | LEGACY RETIRÉ |
| Analysis Month engines internes | LEGACY TECHNIQUE PROTÉGÉ / KEEP_FOR_GLOBAL |
| anciennes variantes snapshots History V2 | ADAPT / transition contrôlée |
| médias complets | INCONNU / À CONCEVOIR |
| Benefit Wallet dans History | INCONNU / À IMPLÉMENTER |

**Conclusion** : l’Historique mensuel actuel est réellement construit autour d’une publication FROZEN_MONTH pré-matérialisée et d’un frontend History V2 unique. Les prochains travaux peuvent raisonnablement se concentrer sur l’audit UI/UX et sur les éventuels ajustements de ReadModels/snapshots révélés par cet audit, sans rouvrir la doctrine de base Canonical → Facts → Analytics → ReadModels → snapshots → Query → React.
