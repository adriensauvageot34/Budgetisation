# History V2 — audit exhaustif du Bilan du mois : architecture, data, Analytics, UI et UX

> **Nature du document** : audit descriptif du comportement actuellement versionné. Aucune modification de comportement, de ReadModel, d’Analytics, de migration ou de donnée n’est effectuée.
> **Baseline auditée** : branche `main`, commit `d0af8c0ec028c5f10e9acb96a42fb6b33b338407` (`docs(history-v2): audit calendar week day ui ux`).
> **Périmètre relu directement** : route `/historique/[month]?view=balance`, Query Runtime, contrats/RuntimeSchemas History V2, builders du Bilan, moteur `month-balance`, Facts/Canonical utilisés, matérialisation/publication History V2, script de certification/publication 12 mois, React, overlays et CSS.
> **Limites de l’audit** : aucun accès live Supabase, aucun navigateur automatisé et aucun profiling runtime n’ont été exécutés. Les conclusions UI/UX sont issues du code/CSS courant. Les scripts de tests/certification ont été relus mais pas réexécutés dans cet audit.

---

# A. Executive summary

Le Bilan du mois réellement actif est une surface **History V2 snapshot-first** organisée en quatre modules :

1. **M1 — Le mois en un coup d’œil** : Actual, Typical, Minimal, comparaisons, zone habituelle, rang historique, bridge banque → économie et résumé importé ;
2. **M2 — Ce qui explique le mois** : catégories, part, Typical catégorie, delta, détail explicatif et classifications ;
3. **M3 — Nature des dépenses et marges** : Necessity, Behavior, LifeScope, matrice Necessity × Behavior, marges et contributeurs ;
4. **M4 — Vie et argent** : activités, Moments et lieux avec drill-downs.

L’architecture de consultation est solide : le runtime produit ne reconstruit pas le Bilan à l’ouverture. Les ressources sont lues dans `analytics_query_snapshots`, liées à une `analytics_publications` publiée ; un miss History V2 finit sur `TEMPORARY_UNAVAILABLE` plutôt que sur un recalcul silencieux. Les quatre payloads M1–M4 sont en outre bloqués côté React s’ils ne partagent pas la même identité de publication.

En revanche, la **construction des snapshots du Bilan actuellement versionnée présente un écart important entre le contrat analytique général et le builder de certification/publication des 12 mois**. Les contrats déclarent des métriques Analytics officielles (`typical_month_cost`, `minimal_month_cost`, `category_amount`, `localized_spend`, `activity_causal_cost`, etc.), mais `scripts/check-history-v2-certification-12-months.mjs`, qui sait produire le `HISTORY_V2_PREFLIGHT_BUNDLE_FILE` consommable par la préparation de publication, reconstruit encore plusieurs projections à partir de l’oracle `expected-vs-engine-final.json` et de fonctions locales au script. Ce n’est pas une reconstruction React ; c’est une dette dans la frontière **Analytics certifié → ReadModel publié**.

Le point le plus structurel trouvé est la fermeture de dépendances de ces Query snapshots : le `resourceInputHash` Bilan construit dans ce script dépend essentiellement du hash Calendar, du hash Daily et de l’Actual de l’oracle. Il ne ferme pas explicitement tous les intrants Bilan spécifiques — Typical, Minimal, Typical catégories, historique des catégories, coûts d’activités, visites, etc. — alors que le `publicationFactsHash` se nourrit ensuite des closures déclarées. Il existe donc un risque théorique qu’un payload Bilan change sans que sa fermeture de facts/hash représente complètement la cause de ce changement. **Avant de considérer le Bilan figé, cette frontière doit être revue.**

Autres écarts significatifs constatés :

- le résumé contextuel est prévu dans M1, mais la construction actuelle des snapshots le force à `MISSING` ;
- M2 possède des contrats pour fréquence/ticket, merchants/purchases et lifecycle, mais le builder courant produit fréquence/ticket inconnue, aucun driver merchant/purchase et aucun lifecycle badge ;
- M4 Activity possède un contrat plus riche que ses données publiées actuelles : les occurrences n’exposent actuellement ni place ni catégorie, l’analyse fréquence/ticket est inconnue et le chemin `ASSOCIATED` n’est pas alimenté ;
- M4 Place contourne actuellement une partie de la doctrine analytique prévue : `momentCount=0`, `activityTypeCount=0`, `semanticKind=OTHER`, routine inférée depuis le libellé du lieu et couverture localisée forcée à 1 lorsqu’un montant existe ;
- le moteur possède `resolveLocalizedAmountVisibility()` et `selectMomentMedia()`, mais la construction courante des snapshots ne les utilise pas ;
- l’UI du bridge affiche le champ `bridge.result` sous le libellé **« Résiduel »** au lieu de `bridge.residual` ; le ReadModel contient déjà le bon champ : correction candidate UI uniquement ;
- le bouton **« Voir tous les lieux »** ne peut pas devenir utile avec le ReadModel généré aujourd’hui, car le builder tronque déjà `places` à 6 ;
- la composition Typical d’une catégorie expose des `stableId` sans libellé humain, alors que React les affiche directement : ce point demande plutôt une amélioration de contrat/ReadModel qu’un lookup ad hoc frontend.

Le moteur `month-balance` lui-même est nettement plus mature que ces raccordements : matérialité, zone habituelle, rang, bridge, composition Typical, explication de catégorie, axes de nature, matrice, marges, sélection des contributeurs, ranking Activities/Moments/Places et doctrine des montants localisés sont explicitement codés et couverts par des tests dédiés.

**Verdict global du Bilan actuellement publié : `ANALYTICS_OR_CONTRACT_REVIEW`.** Le socle snapshot/runtime/UI ne nécessite pas de reconstruction ; le travail principal est de réaligner la préparation des ReadModels publiés avec les métriques/Facts/closures officiellement déclarés.

---

# B. Structure réellement implémentée

## B.1 Route et chargement initial

Route canonique :

```text
/historique/YYYY-MM?view=balance
```

`src/app/historique/[month]/page.tsx` charge cinq ressources serveur en parallèle via un seul `executeAuthenticatedQueries()` :

```text
history_month_overview
history_month_balance_summary
history_month_categories
history_month_spending_nature
history_month_life_money
```

`executeAuthenticatedQueries()` construit une seule chaîne autorisée `CanonicalRepository → FactSourceResolver → MetricQueryService → MaterializationStore`, puis exécute les cinq Query en `Promise.all`.

Le `MonthQuickOverviewReadModel` reste commun au Calendar et au Bilan et alimente le header. Les quatre autres ressources alimentent M1 à M4.

## B.2 Arbre React actif

```text
HistoryMonthRoute [RSC]
└─ HistoryV2Page [Client]
   ├─ HistoryShell
   │  ├─ Calendrier / Bilan
   │  ├─ Débits
   │  ├─ Dépenses
   │  ├─ navigation mois
   │  └─ carousel narratif
   ├─ BalanceMonthView
   │  ├─ M1 BalanceSummary
   │  ├─ M2 CategoryAnalysis
   │  ├─ M3 SpendingNature
   │  └─ M4 LifeMoney
   ├─ HistoryOverlayHost
   │  ├─ BridgePanel
   │  ├─ CategoryPanel
   │  ├─ SegmentPanel
   │  ├─ ActivityPanel
   │  ├─ MomentPanel
   │  └─ PlacePanel
   └─ MinimalPreviewPopover
```

`BalanceMonthView` contrôle que les `publicationMeta` des quatre ressources M1–M4 possèdent exactement le même `publicationId`, la même `revision` et le même `factsHash`. Sinon l’UI affiche une erreur de publication incompatible au lieu de mélanger deux générations.

## B.3 Ressources Query du Bilan

Onze ressources History V2 sont directement dédiées au Bilan et à ses drill-downs :

| Ressource | Usage |
|---|---|
| `history_month_balance_summary` | M1 |
| `history_bank_economy_bridge` | drill-down bridge |
| `history_month_categories` | M2 |
| `history_category_detail` | drill-down catégorie |
| `history_month_spending_nature` | M3 |
| `history_spending_segment_detail` | drill-down segment M3 |
| `history_minimal_preview` | drill-down Minimal |
| `history_month_life_money` | M4 |
| `history_activity_detail` | drill-down activité |
| `history_moment_detail` | drill-down Moment |
| `history_place_detail` | drill-down lieu |

Elles portent toutes `contractVersion=v2`. Les politiques actives pertinentes sont notamment :

```text
month_balance_summary@v1
category_explanation@v1
spending_nature@v2
life_money_selection@v2
canonical_component_classification@v1
facts_hash@v1
quality_visibility@v1
```

Le registre de métriques déclare entre autres :

```text
economic_consumption_net_attributable@v1
typical_month_cost@v1
minimal_month_cost@v1
category_amount@v1
merchant_net_amount@v1
fixed_variable_amount@v1
life_scope_amount@v1
localized_spend@v1
activity_frequency@v1
activity_causal_cost@v1
activity_causal_median_cost_per_occurrence@v1
place_visit_count@v1
distinct_visit_days@v1
```

## B.4 Correspondance fonctionnelle réelle

| Concept attendu | Implémentation actuelle |
|---|---|
| Résumé financier | M1 `BalanceSummary` |
| Catégories / Needs | M2 Catégories + classification dans Category Detail |
| Nature / marge | M3 Necessity / Behavior / LifeScope + matrix + margins |
| Vie & Argent | M4 Activities / Moments / Places |
| Bank → Economy | drawer Bridge depuis M1 |
| Minimal détaillé | popover dédié |
| Résumé contextuel | emplacement M1 existant, source actuelle non alimentée |
| Sous-catégories | présentes principalement dans composition/explication/contributeurs, pas comme module autonome |
| Merchants / purchases | contrat Category Detail existant, population courante absente |

Il n’existe pas d’autre module Bilan visible concurrent.

---

# C. Snapshot, publication et Query : architecture réelle

## C.1 Lecture runtime

`src/server/query/sources/history-v2.ts` mappe les quinze sources History V2 vers `requiresFrozenPublication()`. Si la matérialisation ne renvoie pas un snapshot compatible, la source ne reconstruit pas le ReadModel depuis Canonical : elle renvoie une erreur temporaire.

La lecture `analytics_query_snapshots` exige notamment :

- snapshot actif ;
- non invalidé ;
- `publication_id` non nul ;
- publication jointe au statut `published` ;
- contrat/method signature compatible ;
- fraîcheur valide.

Pour un mois fermé, la cache policy renvoyée est `revalidate: never`.

**Maturité : `STABLE`.**

## C.2 Profil de fermeture History V2

`history-v2-month@v1` possède deux artifacts partagés :

```text
calendar_semantic_month
daily_economic_ledger_month
```

et quinze familles Query History V2. Les top-level incluent explicitement les ressources du Bilan. Le preflight ajoute tous les Journals du mois et les Weeks appartenant au mois, puis parcourt récursivement les `QueryTargetRef` contenus dans les ReadModels. M3 reçoit en plus une découverte explicite de toutes les cellules/buckets de segment.

Conséquence importante : un Category, Segment, Activity, Moment ou Place drill-down n’est pas conçu comme une reconstruction Analytics à la demande. Il fait partie de la fermeture de Query snapshots avant publication lorsqu’il est référencé.

Chaque payload passe son RuntimeSchema et `assertQueryDataMatchesRequest()` avant d’entrer dans le manifest.

## C.3 Point de vigilance majeur : fermeture facts/hash du Bilan

Le script de certification 12 mois sait écrire un `HISTORY_V2_PREFLIGHT_BUNDLE_FILE`, ensuite consommable par la préparation de publication live. Dans ce script, `balanceContext()` construit le `resourceInputHash` à partir de :

```text
resource
params
calendarArtifact.artifactInputHash
dailyArtifact.artifactInputHash
oracle.actual.net
```

Puis `buildQuery()` déclare comme fait de closure :

```text
history_v2_query_input
  resource
  params
  resourceInputHash
```

Or les payloads Bilan dépendent également, selon les ressources, de Typical, Minimal, observations Typical catégorie, historique des catégories, activityCosts, visits, moments, libellés, etc. Ces valeurs ne sont pas explicitement présentes dans cette closure Query.

Le `publicationFactsHash` est correct **par rapport aux closures qu’on lui donne**, mais l’exhaustivité de la closure Bilan est donc à revoir. C’est différent d’un bug de hash cryptographique : le problème potentiel est la **liste des dépendances déclarées**.

**Classification : `ANALYTICS_OR_CONTRACT_REVIEW`.**

## C.4 Écart avec l’architecture documentée antérieurement

L’ancien rapport `06-month-balance-report.md` décrivait le Bilan comme une projection des moteurs/metrics Analytics certifiés existants. Le code actuel conserve ces métriques dans le registre et les contrats, mais le chemin de construction du bundle certifié 12 mois utilise encore plusieurs valeurs de l’oracle et plusieurs helpers locaux.

L’autorité pour cet audit est le code courant, pas l’intention historique du rapport 06.

---

# D. Fiche module M1 — Résumé financier

## Objectif

Donner une lecture immédiate du niveau de dépense du mois et de sa position par rapport à deux références : le mois habituel et le minimum réaliste.

## Composants

- `BalanceMonthView`
- `BalanceSummary`
- `ComparisonMetric`
- `ImportedSummary`
- `MinimalPreviewPopover`
- `BridgePanel`
- `HistoryShell` pour Débits / Dépenses

Fichiers principaux :

```text
src/features/history-v2/balance-view.tsx
src/features/history-v2/history-v2-page.tsx
src/features/history-v2/history-shell.tsx
src/features/history-v2/overlay-host.tsx
src/query-api/history-v2/month-balance-types.ts
src/query-api/history-v2/month-balance-builders.ts
src/analytics/history-v2/month-balance/engine.ts
```

## Data flow

### Actual

```text
UI « Dépenses du mois »
→ MonthBalanceSummaryReadModel.actualValue
→ buildMonthBalanceSummaryReadModel(actual)
→ construction courante : dailyArtifact.actualMonthAmount
→ DailyEconomicLedgerMonthArtifact.actualMonthAmount
→ EconomicComponentFact.net sur scope mois
→ financial_economic_cost_canonical / CanonicalRepository
```

L’Actual du Bilan est donc le même noyau économique que Calendar/Daily.

### Typical

Contrat cible :

```text
UI « Habituel »
→ MonthBalanceSummaryReadModel.typicalValue
→ metric typical_month_cost@v1
→ méthode Typical : médiane des mois de référence admissibles
→ fct_economic_component
```

Implémentation du bundle certifié actuel :

```text
data.oracle.typicalHousehold.value
→ buildMonthBalanceSummaryReadModel()
```

La méthode officielle `typical_month_cost@v1` existe et est testée, mais le builder de publication 12 mois relit l’oracle au lieu de projeter directement un `ProducedMetric` courant.

### Minimal

Contrat cible :

```text
UI « Minimum estimé »
→ minimal_month_cost@v1
→ minimal_baseline_v1
→ obligations/provisions + variables neutres éligibles
```

Le moteur officiel porte support/coverage/provenance et les règles Minimal. Le bundle actuel prend `data.oracle.minimal.value` et ses contributions pour construire le preview.

### Delta

```text
Actual + Typical/Minimal
→ compareMonthReference()
→ delta = Actual - Reference
→ relativeDelta si dénominateur non nul
→ evaluateMateriality()
→ ReadModel actualVsTypical / actualVsMinimal
→ React texte « sous / au-dessus »
```

Seuil par défaut du moteur M1 : matérialité seulement si :

```text
|delta| >= 50 €
ET
|delta/reference| >= 10 %
```

### Zone habituelle

`computeUsualZone()` :

- support < 6 mois → `NOT_APPLICABLE` ;
- tolérance = `max(50 €, 10 % de Typical)` ;
- 6–8 mois → support `limited` ;
- 9+ → `sufficient`.

### Position historique

`computeHistoricalRank()` utilise un rang de compétition sur les Actuals, comparés au centime. Avec moins de quatre valeurs, le résultat reste connu mais porte `presentation=NEUTRAL`.

Dans le builder certifié courant, la série des Actuals historiques vient de `oracleMonths[month].actual.net`, pas des Daily artifacts rematérialisés à cet instant.

## Bank outflows / inflows / overview

`history_month_overview` expose trois flows :

```text
bankOutflows
economicActual
bankInflows
```

Mais `HistoryShell` n’en affiche actuellement que deux :

```text
Débits   → bankOutflows
Dépenses → economicActual
```

`bankInflows` est donc présent dans le snapshot Overview mais absent de la surface visible du Bilan.

## Bridge banque → économie

Le moteur `buildBankEconomyBridge()` calcule :

```text
gap = bankOutflows - actual
bridgeCalculatedActual = bankOutflows + somme(lines.signedAmount)
residual = actual - bridgeCalculatedActual
```

Visibilité si l’écart est au moins `max(25 €, 1 % du plus grand montant)` ou si residual non nul. `result=KNOWN` si lignes complètes et residual <= 0,01 € ; sinon PARTIAL/CONFLICT selon état.

Le builder de certification actuel agrège par `sourceOperation` et crée des lignes :

- `ECONOMIC_EXPENSE_WITHOUT_BANK_OUTFLOW` ;
- `BANK_OUTFLOW_EXCLUDED` ;
- `TIMING_REALLOCATION`.

### Incohérence UI trouvée

Dans `BridgePanel`, la dernière ligne est libellée **« Résiduel »**, mais le composant rend `bridge.result` et non `bridge.residual`.

Le bon champ existe déjà dans le ReadModel. C’est une correction candidate **UI uniquement**.

## Imported summary

Le contrat permet :

```text
MISSING / CURRENT / STALE
+ text
```

L’UI sait afficher le texte et le badge `À actualiser` pour STALE. Pourtant le builder de certification/publication courant fournit toujours :

```text
{ freshness: "MISSING" }
```

Le Résumé contextuel n’est donc pas raccordé aux snapshots M1 actuels.

## UI / UX

Hiérarchie claire : Actual domine visuellement, Typical/Minimal en références secondaires, puis comparaisons/rang. Le flux est compréhensible rapidement.

Points à polir : le rang est purement textuel, les variations n’ont pas de langage couleur explicite, les inflows sont invisibles, et le texte `delta.startsWith("-")` est une micro-interprétation React qui pourrait rester présentationnelle.

## Drill-downs

```text
Minimum estimé
→ clic
→ MinimalPreviewPopover
→ GET logique lazy via POST /api/query history_minimal_preview
→ familles + exemples
```

```text
Comprendre l’écart avec mon compte
→ Bridge overlay
→ history_bank_economy_bridge lazy
→ lignes de réconciliation
```

Aucune pagination.

## Maturité

**`ANALYTICS_OR_CONTRACT_REVIEW`** — UI/algorithmes de comparaison solides, mais projection Typical/Minimal/historique + closure/hash + summary importé doivent être réalignés avec le contrat officiel.

---

# E. Fiche module Minimal Preview

## Objectif

Expliquer la composition du Minimum estimé sans transformer M1 en tableau détaillé.

## Analytics

`buildMinimalPreview()` impose quatre familles :

```text
OBLIGATIONS
VARIABLES_INDISPENSABLES
PROVISIONS
BESOINS_CONDITIONNELS
```

Le total des familles doit se réconcilier avec Minimal à 0,01 €. Les exemples sont sélectionnés par montant et limités.

## ReadModel / snapshot

`MinimalPreviewReadModel` :

```text
minimalValue
preview
```

La Query est top-level dans le profil de publication, donc déjà snapshotée, mais chargée seulement à l’ouverture côté client.

## UI

Le popover affiche les enums de familles tels quels et les exemples avec leur `label`.

Dans la construction courante, le label d’un composant Minimal est le `canonicalComponentKey`. Des identifiants techniques peuvent donc remonter à l’utilisateur.

Le popover possède Escape, fermeture au backdrop et restauration manuelle du focus, mais n’utilise pas `OverlayFrame`; il ne bénéficie donc pas explicitement du même focus trap que les drawers principaux.

## Maturité

**`ANALYTICS_OR_CONTRACT_REVIEW`** pour la source Minimal actuelle ; **`READMODEL_ADJUSTMENT`** pour garantir des familles/libellés humains dans le contrat de présentation.

---

# F. Fiche module M2 — Catégories / sous-catégories / Needs

## Objectif

Montrer quelles catégories composent le mois, leur poids, leur écart au Typical, puis expliquer cet écart.

## Top catégories

Flux courant :

```text
EconomicComponentFact.category
→ groupFactsAmount()
→ CategoryPreviewCandidate
→ selectCategoryPreview(limit=8)
→ CategoryMonthSummary[]
→ MonthCategoriesReadModel.categories
→ CategoryAnalysis React
```

`__UNCLASSIFIED__` est séparé du preview classé. Les catégories classées non sélectionnées sont consolidées dans `otherAmount`.

### Ordre / sélection serveur

`selectCategoryPreview()` réserve d’abord les catégories matérielles ou lifecycle NEW/REAPPEARED, puis complète par montant absolu décroissant, limite 8.

Dans le builder certifié actuel, cependant, le lifecycle des candidats est forcé à `NONE`. La priorité lifecycle du moteur existe donc mais n’est pas utilisée par les snapshots actuels.

### Matérialité M2 courante

Le script de certification appelle explicitement `evaluateMateriality()` avec :

```text
absoluteThreshold = 25 €
relativeThreshold = 20 %
```

C’est volontairement différent du seuil M1 par défaut (50 €/10 %).

## Typical catégorie et sous-catégories

Typical catégorie est lu depuis les rows d’oracle `typicalCategories`.

La composition Typical est reconstruite à partir du/des mois pivots exacts de la médiane :

- médiane impaire → un mois pivot ;
- médiane paire → deux mois pivots et moyenne composante par composante ;
- absence d’une composante dans un mois complet = zéro ;
- mois incomplet sans composante = UNKNOWN ;
- une composition complète doit sommer vers Typical catégorie à 0,01 €.

### Problème de contrat UI

`TypicalCompositionBaseline.amountsByStableId` expose un mapping `stableId → MetricValue<Money>`, mais pas de `label`. Le Category drawer affiche donc directement la clé technique.

La bonne correction n’est pas de refaire un lookup Canonical dans React : le snapshot devrait porter l’identité **et** le libellé de présentation certifié.

**Classification ciblée : `READMODEL_ADJUSTMENT`.**

## Explication de catégorie

`explainCategory()` reste serveur/Analytics :

- driver même signe >= `max(15 €, 15 % du delta catégorie)` ;
- top 3 ;
- compensateur signe opposé >= `max(15 €, 20 %)` ;
- top 1 ;
- residual calculé pour fermer l’explication ;
- visibilité seulement si catégorie matérielle et au moins un driver.

React ne re-sélectionne pas les drivers.

## Fréquence / ticket

Le moteur `explainFrequencyTicket()` exige :

```text
referenceMonths >= 6
ticketSupport >= 5
currentCoverage >= 0.8
```

La construction actuelle de Category Detail appelle `frequencyTicketUnknown()` avec support nul et couverture nulle. Le résultat publié est donc systématiquement `UNKNOWN` dans ce chemin.

## Merchants / purchases

Le moteur possède `selectMerchantPurchaseDrivers()` avec couverture, matérialité, déduplication avec causal/lifecycle et limite top 3.

Le builder courant passe :

```text
merchantAndPurchaseDrivers: []
```

Le contrat existe, l’UI sait les recevoir, mais la fonctionnalité n’est pas alimentée.

## Lifecycle

Le moteur sait classifier NEW/REAPPEARED selon montant, part et trois mois précédents complets. Le builder courant passe :

```text
lifecycleBadges: []
```

et le preview mensuel utilise `lifecycle: NONE`.

## UI / UX

M2 propose deux tabs :

```text
Montant & part
Écart à l’habitude
```

Le serveur fournit `shareOfActual`; React fait seulement `Math.round(share*100)`. Le frontend ne recalcule pas la part.

Chaque ligne Category est un bouton explicite. `Autres catégories` et `Non classé` sont rendus séparément lorsque non nuls.

Dans le drawer Category, les sous-vues sont :

```text
Explication
Composition
Nécessité
Fixe / variable
Contexte
```

Les classifications catégorie sont préparées côté serveur et contrôlées pour se réconcilier avec l’Actual catégorie.

## Drill-down

```text
Category row
→ overlay Category
→ lazy history_category_detail
→ tabs locaux
→ drivers/composition/classification
```

Pas de pagination. Les sous-listes sont terminales aujourd’hui.

## Maturité

**`ANALYTICS_OR_CONTRACT_REVIEW`** — le cœur Category est cohérent et réconcilié, mais plusieurs fonctions prévues par le contrat sont actuellement neutralisées dans la construction des snapshots.

---

# G. Fiche module M3 — Nature des dépenses et marges

## Objectif

Répartir l’Actual selon trois axes orthogonaux et montrer la marge ajustable sans confondre absence de classification et zéro.

## Structure

Axes :

```text
Necessity
  INDISPENSABLE
  CONSTRAINED
  OPTIONAL

Behavior
  FIXED
  VARIABLE

LifeScope
  CURRENT_LIFE
  OUT_OF_DAILY
```

Matrice : Necessity × Behavior.

## Facts / Canonical

`EconomicComponentFact` porte :

```text
necessity: AnalyticTextDimensionValue
behavior: AnalyticTextDimensionValue
lifeScope: AnalyticTextDimensionValue
category
subcategory
net
```

Ces valeurs proviennent du canon économique (`financial_economic_cost_canonical` et attributs d’opération associés) via `CanonicalRepository` / projection Facts.

## Point d’architecture à revoir

Dans `check-history-v2-certification-12-months.mjs`, les valeurs textuelles sont remappées par trois fonctions locales `necessity()`, `behavior()`, `lifeScope()` qui recherchent des tokens (`indispens`, `contraint`, `fix`, `vari`, `courante`, `hors`, etc.).

Cette normalisation n’est pas située dans le moteur de Facts/Analytics partagé ; elle appartient actuellement au script de certification qui construit le bundle. La doctrine métier de classification devrait avoir une autorité unique et versionnée hors d’un script d’orchestration.

## Analytics

`buildSpendingAxes()` :

- calcule classified/unclassified ;
- conserve un coverage ratio ;
- un gap devient matériel seulement au-delà de `max(25 €, 2 % d’Actual)` ;
- chaque axe doit se réconcilier `classified + unclassified = Actual` ;
- la matrice suit la même logique.

### Marges

```text
immediateMargin = OPTIONAL__VARIABLE
mediumMargin    = OPTIONAL__FIXED
```

Si la classification est partielle :

- `LOWER_BOUND` seulement si la monotonie/non-négativité permet d’affirmer une borne ;
- sinon `OBSERVED_ONLY`.

Le ReadModel conserve cette sémantique.

### Contributeurs

`selectSpendingContributors()` :

- grain sous-catégorie si disponible, sinon catégorie ;
- regroupement serveur ;
- tri par montant absolu ;
- top 3 ;
- `otherAmount` pour le reste.

`history_month_spending_nature@v2` inclut déjà les projections de segment avec `shareOfActual`, contributors et detailRef.

## Frontend

React ne refait ni axes, ni matrice, ni marge. Il construit uniquement une Map pour rapprocher les projections `segments` déjà publiées des buckets affichés.

La part est publiée par le serveur ; React ne fait qu’un arrondi entier pour l’affichage.

### Ambiguïté UI trouvée

`MarginMetric` préfixe visuellement les marges par **« Au moins »** même lorsque le `MetricValue` est KNOWN. Pour PARTIAL, il utilise en plus un rendu value-only et une note générique.

Conséquence :

- KNOWN peut paraître être une borne basse alors qu’il est exact ;
- `LOWER_BOUND` et `OBSERVED_ONLY` ne sont pas distingués avec précision.

Le ReadModel contient déjà `status` et `partialMeaning`. Ce point est donc **POLISH/UI**, pas un besoin Analytics.

## Drill-down

```text
Axis bucket
→ Segment overlay
→ history_spending_segment_detail
→ montant + top contributeurs + Other
```

```text
Matrix cell
→ même Segment overlay
```

Tous les segments visibles sont ajoutés à la fermeture de snapshots par le preflight History V2.

## UI / UX

Bonne progression : axes simples puis matrice avancée repliable. La densité reste élevée, mais les concepts sont séparés.

Il n’existe pas de graphique au sens chart ; l’UI repose sur cards, lignes, montants et pourcentages. Ce choix est cohérent mais rend la lecture comparative moins immédiate qu’une visualisation de proportions.

## Maturité

**`ANALYTICS_OR_CONTRACT_REVIEW`** pour l’autorité de normalisation/closure du snapshot ; une fois celle-ci corrigée, la surface elle-même serait proche de `POLISH_ONLY`.

---

# H. Fiche module M4 — Vie & Argent / Activités

## Objectif

Mettre en relation le vécu mensuel et la finance sans réduire le Bilan à des catégories comptables.

## Source sémantique

Les Activities du Bilan sont construites à partir des mêmes `CalendarSemanticMonthArtifact.items` que le Calendar, en conservant les items portant des refs `life_event:*`, groupés par `semanticTypeKey`.

Le nombre d’occurrences vient des `ActivityOccurrenceFact` canoniques.

Le coût causal Activity vient d’une voie dédiée et plus forte :

```text
ActivityOccurrenceFact
+ ActivityCausalFinancialLink
→ ActivityOccurrenceCostFact
  causalCost
  coverage
  support
  evidence[]
→ rankActivities / summary
```

C’est une bonne séparation entre simple contexte et causalité financière.

## Ranking

`rankActivities()` calcule un score déterministe à partir de fréquence, intérêt narratif, priorité sémantique, coût qualifié et intensité, puis tie-breakers stables.

Le ReadModel mensuel limite les Activities à 6.

## État réellement publié aujourd’hui

Le builder actuel :

- utilise les coûts causaux disponibles ;
- produit `costKind=CAUSAL` s’il existe un coût, sinon `NONE` ;
- n’alimente pas actuellement le chemin `ASSOCIATED` malgré son existence dans le moteur/contrat ;
- construit les occurrences avec `momentIds`, mais `placeIds=[]` et `categoryIds=[]` ;
- ne fournit pas d’heure courante ;
- fournit `frequencyTicketUnknown()`.

Le type `ActivityOccurrenceDetail` ne contient par ailleurs pas les participants, alors que `ActivityOccurrenceFact` les possède. Si les participants doivent être visibles dans ce drill-down, c’est un besoin ReadModel explicite.

## UI

La carte distingue :

```text
CAUSAL      → « Dépenses liées »
ASSOCIATED  → « Dépenses associées »
NONE        → pas de coût
```

La distinction de langage est bonne.

## Drill-down

```text
Activity card
→ Activity overlay
→ history_activity_detail
→ occurrences
→ clic occurrence
→ Journal du jour
```

Le détail peut aussi exposer des cibles liées Moment/Place/Category, mais les tableaux Place/Category sont vides dans la construction actuelle ; ces chemins sont donc contractuellement prévus mais peu ou pas alimentés.

L’overlay peut pousser un Journal dans la stack ; le scroll du drawer Activity est mémorisé puis restauré au retour.

## Maturité

**`ANALYTICS_OR_CONTRACT_REVIEW`** — les Facts causaux et le ranking sont solides, mais le snapshot Activity Detail ne remplit encore qu’une partie de son contrat.

---

# I. Fiche module M4 — Vie & Argent / Moments

## Objectif

Mettre en avant les Moments importants du mois et présenter leur coût causal sans confondre celui-ci avec ce qui a simplement été dépensé pendant leur fenêtre temporelle.

## Continuité Calendar ↔ Bilan

Les Moments M4 proviennent des items du **même `CalendarSemanticMonthArtifact`** dont `sourceKind` est `moment` ou `fused`. Leur titre, dates, priorité et continuité sémantique sont donc cohérents avec le Calendar.

`rankMoments()` prend en compte highlight rank, priority band/weight, continuité, jours vécus, coût qualifié et date.

## CausalCost actuel : point de doctrine à revoir

La construction courante forme `amountByMoment` en groupant `EconomicComponentFact` par la dimension générique `fact.moment`, puis expose ce montant comme `causalCost`.

Or dans le type `EconomicComponentFact`, `moment` est un `AnalyticDimensionValue<MomentId>` sans champ d’évidence causale. À l’inverse, Activity possède une structure causale dédiée (`ActivityCausalFinancialLink` / `ActivityOccurrenceCostFact`).

Ce constat ne prouve pas que l’attribution Moment est incorrecte en base : il montre que **le type de Fact actuellement consommé ne porte pas à lui seul la preuve de causalité que le libellé `causalCost` implique**. L’autorité exacte de `moment_id` dans `financial_economic_cost_canonical` doit être confirmée avant gel du contrat.

**Classification ciblée : `ANALYTICS_OR_CONTRACT_REVIEW`.**

## causalCost vs spentDuring

Le contrat `MomentDetailReadModel` sépare explicitement :

```text
causalCost
spentDuring
causalExpenses
spentDuringExpenses
```

`computeSpentDuring()` utilise uniquement la fenêtre temporelle et les dépenses économiques datées. Il n’utilise pas la propriété narrative/causale. Pour un Moment ponctuel sans bornes horaires suffisantes, il peut rendre NOT_APPLICABLE/UNKNOWN plutôt que d’inventer une inclusion.

L’UI du drawer affiche des sections distinctes **« Dépenses liées »** et **« Dépensé pendant »**. C’est une bonne traduction de la doctrine association/contexte vs causalité.

## Médias

Le moteur `month-balance` possède `selectMomentMedia()` : cover, favorite/principal, puis première image directe de la période ; sinon fallback graphique.

La construction actuelle des snapshots ne l’appelle pas et ne renseigne pas `imageRef`. Les cartes utilisent donc actuellement le fallback sémantique dans ce chemin.

## UI / UX

Le rail Moments affiche trois cartes à la fois et fait une rotation/slice locale. Ce slicing est purement présentationnel ; l’ordre vient du serveur.

## Drill-down

```text
Moment card
→ Moment overlay
→ history_moment_detail
→ causalCost / spentDuring
→ listes séparées
```

Pas de sous-navigation supplémentaire aujourd’hui.

## Maturité

**`ANALYTICS_OR_CONTRACT_REVIEW`** pour l’autorité causale ; UI de distinction causal/temporal **solide**.

---

# J. Fiche module M4 — Vie & Argent / Lieux

## Objectif

Montrer les lieux significatifs du mois à partir de présence canonique et, lorsque l’autorité le permet, de finance localisée.

## Sources

```text
PlaceVisitFact
→ présence réelle / jours de visite

EconomicComponentFact.canonicalPlace
→ uniquement resolution=operation_place_canonical
→ finance localisée
```

Point positif : la finance d’un lieu ne vient pas automatiquement des traces GPS. Presence et transaction place restent séparés dans les Facts.

## Moteur cible

`rankPlaces()` possède un modèle de score riche :

- narrative ;
- présence ;
- activité ;
- finance ;
- bonus sémantique ;
- pénalité routine ;
- seuil candidat ;
- top 6.

La finance ne doit scorer que si `localizedCoverage >= 0.8`.

`resolveLocalizedAmountVisibility()` prévoit :

- couverture >= 80 % → valeur carte/detail connue ;
- 60–79,99 % → carte masquée, détail borne partielle ;
- < 60 % → pas de total ;
- dénominateur nul → NOT_APPLICABLE.

## Construction réellement utilisée pour le bundle actuel

Pour chaque lieu :

```text
momentCount = 0
activityTypeCount = 0
semanticKind = OTHER
```

`routineKind` est inféré par recherche textuelle dans le label (`domicile`, `maison`, `travail`).

Si un `localizedAmount` existe :

```text
localizedCoverage = 1
```

Le Place Detail répète ensuite couverture KNOWN=1 et montant complet. La fonction `resolveLocalizedAmountVisibility()` n’est pas appelée dans ce chemin.

La sélection des Places est donc beaucoup plus simplifiée que le moteur officiel disponible.

## ReadModel / UI

`MonthLifeMoneyReadModel.places` est limité à `.slice(0,6)` dans le builder.

Le composant React `PlaceSection` contient pourtant un état `expanded` et un bouton **« Voir tous les lieux »** lorsque `items.length > 6`. Avec le ReadModel courant, cette condition ne peut jamais être vraie.

Deux choix contractuels sont possibles ultérieurement :

- top 6 est l’intégralité voulue → supprimer l’affordance « voir tous » ;
- l’utilisateur doit pouvoir voir tous les lieux → le ReadModel doit distinguer preview et collection exhaustive / fournir un drill-down de liste.

Ce n’est pas une simple question CSS.

## Drill-down

```text
Place card
→ Place overlay
→ history_place_detail
→ localizedCoverage / localizedAmount / presenceDays
```

Aucune pagination.

## Maturité

**`ANALYTICS_OR_CONTRACT_REVIEW`** — bonne séparation des sources spatiales, mais scoring/coverage live trop simplifiés par rapport au moteur et affordance « voir tous » incohérente avec le contrat.

---

# K. Carte complète des drill-downs

## K.1 M1

```text
Minimum estimé
→ MinimalPreviewPopover
→ history_minimal_preview
→ terminal
```

```text
Bridge CTA
→ BridgePanel
→ history_bank_economy_bridge
→ terminal
```

## K.2 M2

```text
Category row
→ CategoryPanel
→ history_category_detail
→ tabs : Explication / Composition / Nécessité / Fixe-variable / Contexte
→ terminal
```

Aucun driver merchant/purchase n’ouvre actuellement un autre niveau.

## K.3 M3

```text
Axis bucket
→ SegmentPanel
→ history_spending_segment_detail
→ contributors + Other
→ terminal
```

```text
Matrix cell
→ même SegmentPanel
```

## K.4 M4 Activity

```text
Activity card
→ ActivityPanel
→ history_activity_detail
→ occurrence
→ Journal du jour
→ back
→ ActivityPanel avec scroll restauré
```

Les cibles Moment/Place/Category sont prévues par le contrat de l’occurrence, mais Place/Category sont actuellement non alimentées dans le builder certifié.

## K.5 M4 Moment

```text
Moment card
→ MomentPanel
→ history_moment_detail
→ terminal
```

## K.6 M4 Place

```text
Place card
→ PlacePanel
→ history_place_detail
→ terminal
```

## K.7 Transport et navigation

Les drill-downs utilisent `useQueryRuntime()` :

- premier accès → POST `/api/query` ;
- cache client Map par identité Query ;
- requêtes concurrentes identiques dédupliquées ;
- mois fermé snapshoté → `revalidate=never`, donc pas de revalidation automatique après cache local.

Les overlays principaux utilisent `OverlayFrame` :

- role dialog ;
- focus trap ;
- Escape ;
- backdrop close ;
- scroll lock ;
- restauration du focus ;
- suspension des couches sous-jacentes.

`HistoryV2Page` maintient une stack logique jusqu’à six cibles, encode la cible courante dans l’URL et mémorise scroll/focus pour les retours imbriqués.

Il n’existe aucune pagination, infinite scrolling ou requête « page suivante » dans ces drill-downs.

---

# L. États de données dans le Bilan

Les composants partagés conservent les distinctions :

```text
KNOWN
PARTIAL + LOWER_BOUND
PARTIAL + OBSERVED_ONLY
UNKNOWN
NOT_APPLICABLE
CONFLICT
collection KNOWN vide
collection inconnue
```

`MoneyMetric` affiche normalement :

```text
KNOWN          → valeur
PARTIAL LB     → « Au moins … » + badge
PARTIAL OBS    → « Observé : … » + badge
UNKNOWN        → « Indisponible »
NOT_APPLICABLE → « Non applicable »
CONFLICT       → « À vérifier »
```

`CollectionState` distingue un KNOWN vide d’une collection inconnue.

Zones où cette distinction s’affaiblit :

1. `partialDisplay="value-only"` supprime volontairement la qualification PARTIAL sur certaines zones denses ;
2. M3 Margins écrit « Au moins » indépendamment du status ;
3. certains états qualitatifs deviennent une note générique `Données partielles` plutôt que l’explication précise de `partialMeaning`.

Le contrat de données est donc plus précis que certaines présentations.

---

# M. UI

## M.1 Grille et densité

Le Bilan utilise :

```text
balanceSurface max 1560px
gap 28px
balanceModule cards blanches
padding 24px
radius 14px
```

M2 est une liste structurée. M3 utilise des grids 3 colonnes et une matrice. M4 Activities/Moments utilisent aussi trois colonnes, Places un rail horizontal.

La hiérarchie typographique est stable : h2 module ~23px, Hero Actual nettement supérieur, labels secondaires muted.

## M.2 Montants et unités

Le formateur commun :

- groupement français avec espace fine ;
- virgule décimale ;
- EUR avec espace avant `€` ;
- précision humaine jusqu’à 2 décimales par défaut.

Les ratios du formateur commun peuvent garder une décimale, mais plusieurs parts du Bilan utilisent directement `Math.round(...*100)` et perdent donc cette précision.

## M.3 Variations positives/négatives

Les deltas monétaires gardent leur signe. M1 utilise le signe pour choisir le texte « sous » / « au-dessus ». Il n’existe pas de doctrine couleur forte vert/rouge attachée aux deltas dans le Bilan courant, ce qui évite une morale dépense=mal mais réduit le scan visuel.

## M.4 Contrastes / focus

Les boutons et overlays disposent de focus visible dans les composants génériques. Les cartes cliquables sont de vrais `<button>` dans les zones observées.

Les tabs possèdent `role=tab`/`aria-selected`, mais il n’a pas été trouvé de navigation clavier spécifique flèches gauche/droite suivant le pattern ARIA complet ; Tab + activation restent utilisables.

## M.5 Responsive

Le principal problème UI transversal est inchangé par rapport à l’audit Calendar :

```css
.page { min-width: 1040px; }
```

Aucune media query de viewport ne recompose les grids du Bilan. La seule media query notable est `prefers-reduced-motion`.

Sur petits écrans, la surface est donc **desktop-first et non responsive** au sens mobile. Les drawers limitent leur largeur à `calc(100vw - 48px)`, mais le fond Bilan lui-même conserve son minimum.

## Maturité UI globale

**`POLISH_ONLY` sur desktop**, mais **responsive mobile manquant**. Les problèmes majeurs de cet audit ne viennent pas principalement du CSS.

---

# N. UX du Bilan

## N.1 Compréhension en cinq secondes

M1 fonctionne bien : « ce mois », « habituel », « minimum » donnent immédiatement trois repères. Le passage M1 → M2 → M3 → M4 suit une progression logique :

```text
Combien ?
→ Pourquoi ?
→ De quelle nature ?
→ Dans quelle vie réelle ?
```

Cette architecture de lecture est solide.

## N.2 Général → particulier

Le Bilan évite de charger tous les détails dans la page initiale. Les détails sont derrière des interactions clairement ciblées. La navigation reste dans le contexte du mois via overlays plutôt que par changement de page complet.

## N.3 Continuité et retour

Points forts :

- URL profonde pour les overlays ;
- bouton Back logique pour les niveaux imbriqués ;
- restauration de scroll du drawer parent ;
- restauration du focus ;
- `scroll:false` pour les navigations du produit.

## N.4 Surcharge

M3 est la zone la plus dense. Les concepts Necessity / Behavior / LifeScope / Matrix / Margins demandent une compréhension métier plus élevée que M1/M2. La matrice repliable limite néanmoins la surcharge.

M4 offre trois natures d’objet différentes dans le même module ; les labels causaux aident à ne pas surinterpréter les montants.

## N.5 Ambiguïtés UX concrètes

- `Résiduel` du Bridge affiche le mauvais champ ;
- Minimal peut exposer des enums/IDs techniques ;
- Composition catégorie peut exposer des stableIds techniques ;
- « Voir tous les lieux » est structurellement inaccessible avec le payload top 6 ;
- Frequency/Ticket, lifecycle et merchant drivers existent dans le contrat mais sont absents du vécu actuel : l’interface donne donc moins de profondeur que l’architecture laisse supposer ;
- `bankInflows` existe dans l’Overview mais n’est jamais présenté dans le shell Bilan.

---

# O. Cohérence Calendar ↔ Bilan

## O.1 Actual

La chaîne est cohérente :

```text
Bilan M1 Actual
= DailyEconomicLedgerMonthArtifact.actualMonthAmount
```

Le Daily Ledger impose :

```text
SUM(jours connus/partiels) + unassignedEconomicAmount = Actual
```

Le Calendar affiche ses montants quotidiens depuis ce même Daily Ledger.

La certification contient explicitement :

```text
F01_ACTUAL_COMMON
F02_DAILY_RECONCILIATION
F03_DAYS_PLUS_UNASSIGNED
```

## O.2 Catégories

Le builder certifié remappe les `EconomicComponentFact.net` vers les montants du Daily allocation ledger avant les agrégations Bilan. L’invariant `K01_CATEGORY_RECONCILIATION` vérifie que la somme catégorie rejoint Actual.

## O.3 Nature

Les trois axes sont construits depuis les mêmes Economic Facts du mois et la certification vérifie pour chacun :

```text
classifiedAmount + unclassifiedAmount = Actual
```

Les trois vues de classification d’une Category sont aussi vérifiées séparément contre l’Actual Category (`K02_CATEGORY_CLASSIFICATION_TABS`).

## O.4 Minimal

`N_MINIMAL_ADDITIVE` vérifie la somme des familles du preview contre Minimal lorsqu’il est disponible.

## O.5 Bridge

`K_BRIDGE_RESIDUAL` exige residual=0 dans la certification courante.

## O.6 Moments

Calendar et Bilan partagent le même `CalendarSemanticMonthArtifact` pour l’identité/titre/dates des Moments. C’est solide.

Le point ouvert n’est pas l’identité du Moment mais l’autorité du montant appelé `causalCost`.

## O.7 Activities

Calendar et M4 repartent des mêmes Life Events / ActivityOccurrenceFacts. La fréquence d’occurrence est donc cohérente conceptuellement.

Les enrichissements financiers et de relations du drawer Activity restent incomplets.

## O.8 Lieux

La présence vient de PlaceVisitFact et la finance de `canonicalPlace=operation_place_canonical`. C’est conforme à la séparation présence ≠ lieu de transaction.

Le scoring et la couverture publiés n’exploitent cependant pas encore toute la doctrine du moteur Place.

---

# P. Performance

## Initial Bilan

Cinq Query sont demandées en parallèle. Le runtime construit une seule instance de services/repository/materialization pour le batch.

Sur snapshots valides :

- pas de lecture Canonical de reconstruction du Bilan ;
- chaque ressource effectue sa lecture materialized ;
- mois fermé → cache `never revalidate`.

Le coût initial est donc principalement I/O snapshot + parsing RuntimeSchema + hydratation React.

## Drill-downs

Chaque premier drill-down ajoute une Query client `/api/query`. Les réponses sont cacheées par identité Query et les in-flight identiques dédupliquées.

Il n’y a pas de prefetch d’un drill-down avant le clic.

## Payloads

M3 embarque déjà les projections des segments/contributeurs dans le top-level, puis possède quand même un detail snapshot par segment. Cette duplication améliore l’instantanéité de la surface M3 mais augmente le payload initial.

M4 embarque Activities max 6, Places max 6, Moments non tronqués puis le frontend n’en affiche que trois simultanément.

Aucun profiling réel n’a été exécuté ; aucune conclusion chiffrée de temps ou poids réseau ne peut être donnée.

---

# Q. Tests et garde-fous présents

Les fichiers directement pertinents incluent :

```text
scripts/check-history-v2-month-balance.mjs
scripts/check-history-v2-readmodels.mjs
scripts/check-history-v2-snapshot-materialization.mjs
scripts/check-history-v2-certification-12-months.mjs
scripts/check-history-v2-frontend.mjs
```

`check-history-v2-month-balance.mjs` couvre directement :

- comparaison/matérialité ;
- zone habituelle ;
- rang historique ;
- bridge + double comptage ;
- freshness du résumé importé ;
- composition Typical ;
- drivers catégorie ;
- lifecycle ;
- frequency/ticket ;
- merchant/purchase selection ;
- axes/marges ;
- ReadModels et RuntimeSchemas.

La certification 12 mois construit les artifacts Calendar/Daily, toutes les Query History V2 de fermeture, parse les RuntimeSchemas, compare le déterminisme et applique les invariants financiers/catégories/nature/publication.

Cet audit n’a pas réexécuté ces scripts ; il atteste uniquement de leur présence et de leur contenu actuel.

---

# R. Incohérences observées et corrections candidates — sans implémentation

| ID | Constat | Couche | Classification |
|---|---|---|---|
| BIL-01 | `resourceInputHash`/closure Query Bilan ne déclare pas explicitement tous les intrants réellement utilisés | Publication / facts hash | `ANALYTICS_OR_CONTRACT_REVIEW` |
| BIL-02 | Typical/Minimal/Typical Categories/historical série proviennent encore de l’oracle dans le builder certifié actuel | Analytics → publication | `ANALYTICS_OR_CONTRACT_REVIEW` |
| BIL-03 | `importedSummary` forcé à MISSING | intégration ReadModel | `READMODEL_ADJUSTMENT` / intégration |
| BIL-04 | Bridge « Résiduel » affiche `bridge.result` au lieu de `bridge.residual` | React | `POLISH_ONLY` |
| BIL-05 | `bankInflows` snapshoté mais non présenté | UI produit | `POLISH_ONLY` ou choix produit |
| BIL-06 | Composition Category affiche des stableIds sans labels dédiés | ReadModel | `READMODEL_ADJUSTMENT` |
| BIL-07 | frequency/ticket Category systématiquement UNKNOWN dans builder courant | Analytics wiring | `ANALYTICS_OR_CONTRACT_REVIEW` |
| BIL-08 | merchant/purchase drivers vides | Analytics wiring | `ANALYTICS_OR_CONTRACT_REVIEW` |
| BIL-09 | lifecycle badges vides + preview lifecycle NONE | Analytics wiring | `ANALYTICS_OR_CONTRACT_REVIEW` |
| BIL-10 | Normalisation Necessity/Behavior/LifeScope située dans script certification | architecture Analytics | `ANALYTICS_OR_CONTRACT_REVIEW` |
| BIL-11 | Margins libellées « Au moins » même KNOWN | React | `POLISH_ONLY` |
| BIL-12 | Minimal expose enums et potentiellement canonicalComponentKey | ReadModel/presentation | `READMODEL_ADJUSTMENT` |
| BIL-13 | Activity Detail : place/category links non alimentés, frequencyTicket UNKNOWN, ASSOCIATED absent | Analytics wiring | `ANALYTICS_OR_CONTRACT_REVIEW` |
| BIL-14 | Participants Activity disponibles dans Facts mais absents du contrat occurrence | ReadModel si besoin produit confirmé | `READMODEL_ADJUSTMENT` |
| BIL-15 | Moment `causalCost` agrégé depuis dimension `fact.moment` sans preuve causale explicitée dans le type | doctrine data | `ANALYTICS_OR_CONTRACT_REVIEW` |
| BIL-16 | `selectMomentMedia()` non raccordé au snapshot actuel | intégration média | `READMODEL_ADJUSTMENT` / futur lot média |
| BIL-17 | Place scoring hardcode moment/activity/semantic inputs et infère routine depuis label | Analytics | `ANALYTICS_OR_CONTRACT_REVIEW` |
| BIL-18 | Place localizedCoverage forcée à 1 si montant présent ; doctrine 80/60 non utilisée | Analytics | `ANALYTICS_OR_CONTRACT_REVIEW` |
| BIL-19 | builder limite Places à 6, donc « Voir tous les lieux » ne peut jamais s’activer | ReadModel / UX | `READMODEL_ADJUSTMENT` |
| BIL-20 | Bilan desktop min-width 1040 sans breakpoint mobile | CSS / UX | `POLISH_ONLY` si desktop cible, sinon besoin responsive |
| BIL-21 | Certaines PARTIAL deviennent visuellement proches de KNOWN avec value-only | UI qualité | `POLISH_ONLY` |

---

# S. Niveau de maturité par fiche

| Surface | Maturité | Motif principal |
|---|---|---|
| Runtime snapshot/read-only | `STABLE` | publication obligatoire, pas de fallback dynamique |
| Cohérence PublicationMeta M1–M4 | `STABLE` | mélange de générations refusé |
| M1 Actual | `STABLE` | même Daily Ledger que Calendar |
| M1 Typical / Minimal / historique | `ANALYTICS_OR_CONTRACT_REVIEW` | builder certifié encore oracle-driven + closure |
| Bridge | `POLISH_ONLY` | moteur solide ; mauvais champ rendu sous Résiduel |
| Imported Summary | `READMODEL_ADJUSTMENT` | contrat présent mais non raccordé |
| M2 catégories de base | `STABLE` sur réconciliation | somme vers Actual certifiée |
| M2 explications enrichies | `ANALYTICS_OR_CONTRACT_REVIEW` | frequency/ticket, lifecycle, merchant/purchase non alimentés |
| Composition Typical labels | `READMODEL_ADJUSTMENT` | stableId technique sans label |
| M3 moteur axes/matrix/marges | `STABLE` algorithmiquement | invariants clairs et testés |
| M3 pipeline publié | `ANALYTICS_OR_CONTRACT_REVIEW` | normalisation script-owned + closure |
| Minimal Preview UI contract | `READMODEL_ADJUSTMENT` | enums/labels techniques |
| M4 Activities | `ANALYTICS_OR_CONTRACT_REVIEW` | détail partiellement peuplé |
| M4 Moments UI causal vs temporal | `STABLE` | deux métriques/listes distinctes |
| M4 Moment causal authority | `ANALYTICS_OR_CONTRACT_REVIEW` | dimension moment ≠ preuve causale explicite dans Fact |
| M4 Places | `ANALYTICS_OR_CONTRACT_REVIEW` | scoring/coverage simplifiés |
| Drill-down/navigation overlays | `STABLE` | lazy snapshots, stack, focus, scroll, deep links |
| UI desktop | `POLISH_ONLY` | cohérente, quelques labels/affordances |
| Responsive mobile | `UNKNOWN` comme cible produit ; implémentation actuelle non responsive | aucune adaptation viewport |

---

# T. Conclusion

Le Bilan n’est pas un prototype UI : il possède déjà une vraie architecture History V2, des contrats stricts, un moteur Analytics substantiel, des snapshots fermés, une publication atomique, une Query API propre et des drill-downs cohérents. **Il ne faut pas repartir de zéro.**

Le prochain travail de conception doit toutefois distinguer deux catégories qui sont aujourd’hui mélangées :

1. les problèmes de présentation simples — Bridge Residual, labels Minimal, wording des marges, responsive, précision des parts ;
2. la frontière structurante de publication — quels Facts/metrics font réellement autorité pour Typical, Minimal, Categories, Activity, Moment et Place, et comment ces dépendances entrent dans `resourceInputHash` / `publicationFactsHash`.

Tant que ce second point n’est pas fermé, une retouche esthétique ne suffit pas à considérer le Bilan comme définitivement certifié.

## MONTH REVIEW READINESS

**`ANALYTICS_OR_CONTRACT_REVIEW`**

Le moteur et le runtime sont suffisamment matures pour être conservés. La priorité n’est pas de refaire les écrans, mais de **réaligner le builder de publication courant avec les Analytics/Facts/closures officiellement déclarés**, puis de traiter les quelques ajustements ReadModel et polish identifiés ci-dessus.
