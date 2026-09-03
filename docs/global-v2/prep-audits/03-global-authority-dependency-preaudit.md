# Analyse Globale V2 — pré-audit des autorités Data / Facts / Analytics et dependency matrix

> **Nature du document** : audit préparatoire en lecture seule.
>
> **Aucune métrique Global n’est implémentée. Aucune migration n’est créée. Aucun comportement applicatif n’est modifié. Aucune écriture Supabase n’est réalisée.**
>
> **Baseline repository distante observée** : branche `main`, commit `d4c197cf53774857c9a9a3e3fc93e178d999b42a` (`docs(global-v2): audit history global reuse boundary`).
>
> **État History pris en compte** : HC1 communiqué `PASS` par l’utilisateur ; HC2 → HC6 non fermés. Le HC1 local/Codex n’est pas encore prouvé par la baseline GitHub distante utilisée ici.
>
> **Conséquence** : les classifications de ce document sont exclusivement `PROVISIONAL_REUSE`, `PROVISIONAL_ADAPT`, `PROVISIONAL_NEW`, `AUTHORITY_GATED` ou `UNKNOWN`. Aucune décision finale `REUSE / ADAPT / NEW_*` n’est autorisée avant `POST_HISTORY_ENTRY_GATE = PASS` puis `GA0`.
>
> **Autorité normative** : `Brief_Technique_Analyse_Globale_V2_FINAL_EXHAUSTIF_MASTER.docx` et ses registres verrouillés. Le code et Supabase décrivent l’EXISTANT, jamais une doctrine concurrente.

---

# 0. Verdict court

Le modèle de dépendances Global peut déjà être préparé de manière suffisamment précise pour servir de **carte de rebase** après History, mais il n’est pas encore une dependency matrix physique finale.

L’observation actuelle montre trois couches très différentes :

```text
1. FONDATIONS PARTAGÉES DÉJÀ RÉELLES
   CanonicalRepository / Facts / MetricEnvelope / Support / Coverage
   Metric Registry / ProducedMetric / Materialization / Publication / Query

2. ANALYTICS GLOBAL PARTIELLEMENT EXISTANTS MAIS INSUFFISANTS
   agrégations, comparaisons, séries mensuelles, quelques contextes,
   métriques économiques / activité / lieu / achat déjà productibles

3. ANALYTICS GLOBAL CIBLE MAJORITAIREMENT À CONSTRUIRE
   Trend/Stability formalisés, ChangePoint/Transformation,
   RelationshipEngine, routine/cycles, Moment comparison,
   Place importance/lifecycle, Purchase analytics riche,
   PersonaDifferenceEngine, SharedParticipationResolver,
   social/product/mobility conditionnels
```

Le registre Analytics actif contient aujourd’hui **16 métriques**. Il couvre déjà la consommation économique, Typical, Minimal, plusieurs dimensions financières, achats, PersonDays, visites et activités. Il ne contient pas encore les moteurs/statistiques Global sophistiqués du Master tels que Trend/Stability versionnés, ChangePoint, RelationshipEngine, routines/saisonnalité, comparabilité Moment, Persona differences, shared participation ou analytics produit avancées.

Le point architectural majeur est le suivant : le code actuel possède encore un `AnalysisScope.time.global` avec une `observationWindow` unique, alors que le Master verrouille l’absence de période Global universelle. Le scope actuel est donc un **candidat d’adaptation**, pas un contrat final Global.

Le pré-audit live Supabase apporte aussi une information utile mais **non décisionnelle** : plusieurs objets nécessaires aux gates futurs existent comme schéma ou données partielles, tandis que d’autres sont vides ou absents aujourd’hui. Cela ne permet en aucun cas de rendre `PREREQUISITE_AVAILABLE / UNAVAILABLE` avant HC6/GA0.

```text
GLOBAL DEPENDENCY MODEL
READY_FOR_REBASE
```

Ce verdict signifie : **la carte conceptuelle est suffisamment complète pour préparer les prompts et le futur GA0 ; elle n’autorise pas l’implémentation Global avant le gate History final.**

---

# 1. Sources et règles de lecture

## 1.1 Sources Global normatives

- `Brief_Technique_Analyse_Globale_V2_FINAL_EXHAUSTIF_MASTER.docx` ;
- `GLOBAL_CAPABILITY_SCOPE_REGISTRY_Analyse_Globale_V2_FINAL.docx` ;
- `GLOBAL_AUTHORITY_GATED_REGISTRY_Analyse_Globale_V2_FINAL.docx` ;
- `GLOBAL_TEST_CATALOG_Analyse_Globale_V2_FINAL.docx` ;
- `GLOBAL_CONCEPTUAL_DEPENDENCY_AND_IMPLEMENTATION_PLAN.docx` ;
- `docs/global-v2/prep-audits/01-global-master-capability-map.md` ;
- `docs/global-v2/prep-audits/02-history-global-boundary-audit.md`.

## 1.2 Sources History

- audits History 20 → 24 ;
- rapports History V2 antérieurs utiles ;
- contrats Facts / Analytics / Query / Materialization actuels ;
- HC1 communiqué `PASS` : oracle retiré comme source de construction History, à revalider dans le repo final ;
- HC2 → HC6 encore attendus.

## 1.3 Code inspecté en priorité

- `src/analytics/facts/**` ;
- `src/analytics/production/**` ;
- `src/analytics/aggregation/**` ;
- `src/analytics/comparisons/**` ;
- `src/analytics/context/**` ;
- `src/analytics/insights/**` ;
- `src/analytics/publication/**` ;
- `src/core/metrics/**` ;
- `src/core/scope/**` ;
- `src/server/analytics/**` ;
- `src/server/query/sources/analysis.ts` ;
- `src/query-api/server/invalidation.ts` ;
- `docs/specs/ANALYTICS_MATERIALIZATION.md`.

## 1.4 Supabase

Des lectures `SELECT` uniquement ont été effectuées sur le projet `ipuuhxrblxormwgoaqnz` afin d’inventorier des tables, colonnes et volumes utiles. Aucune mutation n’a été réalisée.

## 1.5 Classification provisoire

| État | Sens dans ce document |
|---|---|
| `PROVISIONAL_REUSE` | primitive existante dont la sémantique semble alignée et qui a de fortes chances d’être réutilisable telle quelle ou presque ; GA0 garde le dernier mot |
| `PROVISIONAL_ADAPT` | base réelle utile, mais grain, scope, méthode, contrat ou dépendances ne correspondent pas encore entièrement à Global cible |
| `PROVISIONAL_NEW` | aucune implémentation cible suffisante n’a été observée ; un moteur/contrat nouveau est probablement requis |
| `AUTHORITY_GATED` | l’implémentation dépend d’une autorité Canonical que le Master interdit de déclarer disponible avant l’audit post-History |
| `UNKNOWN` | preuve insuffisante pour même formuler une classification provisoire fiable |

---

# 2. Snapshot de l’EXISTANT utile à la dependency matrix

## 2.1 Facts partagés réellement contractés dans le code

Le type `AnalyticFact` courant contient :

```text
EconomicComponentFact
ActivityOccurrenceFact
ActivityOccurrenceCostFact
PersonDayFact
PurchaseEventFact
PlaceVisitFact
```

### `EconomicComponentFact`

Il porte déjà notamment :

- montant gross/refund/net ;
- timing économique ;
- personne ;
- catégorie / sous-catégorie ;
- activité ;
- marchand ;
- Moment ;
- lieu canonique de l’opération ;
- `necessity` ;
- `behavior` ;
- `lifeScope`.

**Pré-classement Global** : `PROVISIONAL_REUSE`, avec revalidation HC2/HC6 pour les axes de classification, Moment et Place.

### `ActivityOccurrenceFact`

Il porte : occurrence, Activity, Life Event/series/parent, période, validation et participants Household.

**Pré-classement** : `PROVISIONAL_REUSE` pour l’occurrence humaine ; `PROVISIONAL_ADAPT` pour certains besoins Global de participation/social/routines.

### `ActivityOccurrenceCostFact`

Il porte un `causalCost` qualifié, coverage, support et evidence vers les liens financiers causaux.

**Pré-classement** : `PROVISIONAL_REUSE` pour la causalité Activity déjà explicitement contractée, sous revalidation HC2.

### `PersonDayFact`

Il porte personne, date et observabilité de localisation. Le Master attend en plus des contextes quotidiens riches lorsque réellement contractés.

**Pré-classement** : `PROVISIONAL_ADAPT`.

### `PurchaseEventFact`

Il formalise un achat humain distinct de la ligne bancaire, avec sources, montant économique, timing et provenance.

**Pré-classement** : `PROVISIONAL_REUSE` du contrat conceptuel, mais **revalidation physique obligatoire** : les tables `purchase_events`, memberships et timing existent live mais sont actuellement vides dans la lecture de ce pré-audit.

### `PlaceVisitFact`

Il formalise la visite personne × lieu × date/intervalle et ne prend pas les points GPS bruts comme visites.

**Pré-classement** : `PROVISIONAL_REUSE` du grain visite ; doctrine Place/coverage à revalider HC2.

---

## 2.2 Metric Registry actif

Le registre produit actuellement 16 métriques :

```text
economic_consumption_net_attributable
typical_month_cost
minimal_month_cost
localized_spend
category_amount
merchant_net_amount
life_scope_amount
fixed_variable_amount
purchase_count
person_day_count
place_visit_count
distinct_visit_days
activity_frequency
activity_causal_cost
activity_causal_median_cost_per_occurrence
fuel_trip_estimate
```

### Forts candidats de réutilisation conceptuelle

- `economic_consumption_net_attributable` ;
- `category_amount` ;
- `merchant_net_amount` ;
- `life_scope_amount` ;
- `fixed_variable_amount` ;
- `purchase_count` ;
- `person_day_count` ;
- `place_visit_count` ;
- `activity_causal_cost`.

Ils acceptent déjà, selon le cas, un scope `global` et disposent de contrats de grain, provenance, support, disponibilité, additivité et version de méthode.

### Candidats à adapter/recalculer au grain Global

- `typical_month_cost` : référence mensuelle non additive ;
- `minimal_month_cost` : référence mensuelle non additive ;
- `distinct_visit_days` : non additive ;
- `activity_frequency` : registre actuel limité au scope month ;
- `activity_causal_median_cost_per_occurrence` : mensuelle/non additive ;
- `fuel_trip_estimate` : estimation mensuelle, et son autorité Fuel/Route/Vehicle reste gateée.

Le planner Global actuel possède déjà un garde-fou utile : il n’agrège les métriques mensuelles que si le Metric Registry les déclare strictement additives et si availability/coverage/support/provenance/version restent combinables. Sinon il refuse l’agrégation et renvoie vers le moteur brut.

**Pré-classement de cette primitive** : `PROVISIONAL_REUSE`.

---

## 2.3 Support et Coverage existants

### Support actuel

Le contrat partagé possède :

```text
level = sufficient | limited | insufficient
n
unit
eligibleN?
observableN?
excludedN?
```

avec des unités comme month/day/person_day/occurrence/purchase_event/place_visit/paired_observation/year.

### Coverage actuel

Le contrat partagé possède :

```text
complete
partial + coveredShare?
```

Ces primitives sont utiles mais le Master Global exige davantage :

- `STRONG` et politiques par famille ;
- gaps et longest gap ;
- support temporel explicite ;
- intersections cross-family ;
- coverages distinctes par dimension ;
- `effectiveCoverage = min(requiredCoverages)` ;
- raisons de partial plus riches.

**Pré-classement** : `PROVISIONAL_ADAPT`.

---

## 2.4 Scope actuel

Le scope actuel possède :

```text
subject = household | person

time = month
     | global(observationWindow, asOf)
```

Le Master final interdit une période Global universelle : chaque résultat doit avoir son propre support/fenêtre/grain.

**Pré-classement** : `PROVISIONAL_ADAPT` obligatoire pour Global cible.

Le futur contrat ne doit pas nécessairement supprimer toute notion de fenêtre dans les moteurs ; il doit empêcher qu’une `observationWindow` unique devienne l’autorité temporelle de toute la page.

---

# 3. Pré-audit live Supabase — preuve de contexte, pas décision d’autorité

## 3.1 Tables/objets observés

Le schéma live contient notamment :

```text
purchase_events
purchase_event_memberships
purchase_event_timing_assertions
economic_component_classifications
life_events
life_event_participations
life_event_financial_links
moment_life_events
person_days
operation_place_canonical
operation_place_links
merchant_place_aliases
merchants
referentiel_lieu
person_place_roles
product_observations
product_price_observations
route_distances
vehicles
fuel_price_observations
analytics_publications
analytics_artifacts
analytics_query_snapshots
analytics_change_log
```

Aucune table nommée comme `MobilityLeg`, `RouteDefinition`, `PurchaseLine`, `ProductFamily`, `ProductVariant`, `ProductFormat`, `Contact`, `ContactAlias`, `ContactRelation` ou `ContactGroup` n’a été observée par recherche de nom dans ce pré-audit.

Cela n’est **pas** une preuve définitive d’absence d’autorité : GA0 devra inspecter le schéma final, les colonnes sémantiques, les vues/relations, les Facts et les données après History.

## 3.2 Volumes live observés

| Objet | Lignes observées |
|---|---:|
| `life_event_financial_links` | 273 |
| `life_event_participations` | 1142 |
| `moment_life_events` | 57 |
| `merchant_place_aliases` | 14 |
| `product_observations` | 18 |
| `product_price_observations` | 7 |
| `economic_component_classifications` | 0 |
| `purchase_events` | 0 |
| `purchase_event_memberships` | 0 |
| `purchase_event_timing_assertions` | 0 |
| `person_place_roles` | 0 |
| `route_distances` | 0 |
| `vehicles` | 0 |
| `fuel_price_observations` | 0 |

## 3.3 Interprétation correcte

Ces nombres servent uniquement à préparer GA0.

Interdictions :

```text
0 lignes purchase_events
≠ PurchaseEventFact impossible

0 lignes economic_component_classifications
≠ aucune classification disponible dans tout le système

18 product_observations
≠ PurchaseLineFact disponible

7 product_price_observations
≠ preuve d’achat produit

0 route_distances
≠ décision PREREQUISITE_UNAVAILABLE définitive
```

HC2 peut modifier l’autorité des classifications/Moment/Place ; HC3-HC6 peuvent modifier publication/dépendances/révisions ; les imports/cutovers peuvent aussi modifier les données avant GA0.

---

# 4. Carte des autorités par grande famille

| Famille | Canonical actuel observé | Fact actuel | Analytics actuel | Besoin Global cible | Pré-classement | GA0 |
|---|---|---|---|---|---|---|
| Économie | opérations/allocations/timing/cost canonique | EconomicComponentFact | economic net + dimensions | M1/M2 + sources M3/M5/M9 | `PROVISIONAL_REUSE` | YES |
| Typical | historique financier certifié | EconomicComponentFact + observations mensuelles | typical_month_cost | référence structurelle par scope admissible | `PROVISIONAL_ADAPT` | YES |
| Minimal | baseline/Needs/règles | source minimal dédiée | minimal_month_cost | Minimal versionné Global/M1 | `PROVISIONAL_ADAPT` | YES |
| Classifications | economic_component_classifications + autres sources | dimensions dans EconomicComponentFact | life_scope/fixed-variable/category amounts | Necessity/Behavior/LifeScope + Needs | `PROVISIONAL_ADAPT` | YES HC2 |
| Activités | life_events/types/series/participations/links | ActivityOccurrenceFact + CostFact | frequency/cost | cadence/routine/lifecycle/persona/shared | `PROVISIONAL_ADAPT` | YES |
| PersonDay | person_days + context sources | PersonDayFact | person_day_count | contexts/rates/comparisons/relationships | `PROVISIONAL_ADAPT` | YES |
| Places | referentiel_lieu + visits/locations/roles/op place | PlaceVisitFact | visit/localized spend | importance/evolution/geo/persona/shared | `PROVISIONAL_ADAPT` | YES HC2 |
| Moments | moments + moment_life_events + life_event links | dimension moment + life event facts | History projection partielle | comparabilité/coût causal/répétition | `PROVISIONAL_NEW` + reuse inputs | YES HC2 |
| Purchase | purchase_event schema + fallback sources possibles | PurchaseEventFact | purchase_count | M8 core purchase/frequency/ticket | `PROVISIONAL_ADAPT` | YES |
| Product | product observations/prices faibles | aucun PurchaseLineFact cible observé | aucun moteur produit cible | product/cycle/substitution/price | `AUTHORITY_GATED` | YES |
| Merchant | merchants + aliases | dimension merchant dans EconomicComponentFact | merchant_net_amount | merchant identity/evolution/substitution | `PROVISIONAL_ADAPT` | YES |
| Mobility | route_distances/vehicles/fuel schemas | aucun MobilityLegFact observé | fuel_trip_estimate seulement | M7 mobility/route/fuel | `AUTHORITY_GATED` | YES |
| Participants Household | life_event_participations | participantIds ActivityOccurrence | pas de shared resolver final | M10 shared participation | `PROVISIONAL_ADAPT` | YES |
| Contacts externes | pas d’autorité Contact nommée observée | aucun Contact/SocialParticipationFact | aucun moteur social cible | social/contacts/groups | `AUTHORITY_GATED` | YES |
| Publication | analytics_* | n/a | materialization/publication | cohérence Global + manifest + revisions | `PROVISIONAL_ADAPT` | YES HC3-HC6 |

---

# 5. GLOBAL_ANALYTICS_DEPENDENCY_MATRIX — PROVISIONAL

## 5.0 Lecture de la matrice

Cette matrice représente les **sorties analytiques significatives** correspondant aux capabilities du Master. Elle ne remplace pas le registre normatif de 364 capabilities : les sous-capabilities de contrat, de sécurité, de certification et de publication restent couvertes par leur registre source. Le but ici est de relier chaque famille de résultats à ses autorités et dépendances de calcul.

Légende `INVALIDATION_SCOPE` conceptuelle :

- `LOCAL_MONTH` : correction bornée à une période sans impact historique structurel ;
- `HISTORICAL_LOOKBACK` : modification qui peut changer une référence/fenêtre historique ;
- `GLOBAL_HISTORY` : sortie nécessitant une reconstruction des analyses Global historiques ;
- `ENTITY_SCOPED` : impact principalement lié à une entité et ses analyses dérivées ;
- `CONTENT_SCOPED` : contenu/presentation sans modification de vérité analytique ;
- `UNKNOWN` : à décider physiquement dans GA0 / Refresh Planner final.

## 5.1 Foundations / Phase A

| GLOBAL_OUTPUT | CANONICAL_INPUTS | FACT_INPUTS | ANALYTICS_INPUTS | OTHER_MODULE_DEPENDENCIES | TIME_RANGE | PERSON_SCOPE | ENTITY_SCOPE | SUPPORT_REQUIREMENT | COVERAGE_REQUIREMENT | MATERIALITY? | PUBLICATION_DEPENDENCY? | INVALIDATION_SCOPE | CLASSIFICATION | REVALIDATE_AT_GA0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CertifiedHistory/LiveTail split | analysis periods + publications + revisions | all certified Facts | certification/publication state | History | per-family | household/person | all | certified gate | family-specific | no | YES | GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES |
| GlobalSupportEnvelope | observability + periods | all relevant Facts | support policies | all | natural | any | any | family versioned | required coverages | no | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` over shared primitives | YES |
| Knowledge state | canonical authority states | Facts states | MetricEnvelope | all | natural | any | any | distinct from knowledge | distinct | no | YES | depends source | `PROVISIONAL_ADAPT` | YES |
| Partial reasons | gaps/linkage/source states | facts/evidence | envelope policy | all | natural | any | any | n/a | n/a | no | YES | depends source | `PROVISIONAL_ADAPT` | YES |
| Cross-family support intersection | observability sets | Facts by grain | support intersection engine | M3/M5/M9/M10 | intersection | any | relation | matched/eligible units | min coverages | no | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Gap model / longest gap | source observability | facts with dates | temporal support engine | M1/M3/M4/M5 | natural history | any | family | gap-aware | source-specific | no | YES | HISTORICAL_LOOKBACK | `PROVISIONAL_NEW` | YES |
| Materiality framework | versioned policies | metrics | current History materiality + marked facts | M1/M2/M3/M9/IA | result-specific | any | any | policy-specific | sufficient | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES |
| Revision/dependency identity | Canonical revisions | Fact deps | materialization manifest | all | all | household | all | n/a | n/a | no | YES | UNKNOWN | `PROVISIONAL_ADAPT` | YES HC3-HC6 |

## 5.2 Module 1 — Fonctionnement économique

| GLOBAL_OUTPUT | CANONICAL_INPUTS | FACT_INPUTS | ANALYTICS_INPUTS | OTHER_MODULE_DEPENDENCIES | TIME_RANGE | PERSON_SCOPE | ENTITY_SCOPE | SUPPORT_REQUIREMENT | COVERAGE_REQUIREMENT | MATERIALITY? | PUBLICATION_DEPENDENCY? | INVALIDATION_SCOPE | CLASSIFICATION | REVALIDATE_AT_GA0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Actual économique certifié | financial canonical/timing | EconomicComponentFact | economic_consumption_net_attributable | A | certified months | household/person if attribution | economic | known source | financial 100% for certified | optional for selection | YES | LOCAL_MONTH + GLOBAL_HISTORY | `PROVISIONAL_REUSE` | YES |
| Typical | certified economic history | EconomicComponentFact | typical_month_cost | A | admissible reference history | household/person when supported | reference | >= method support | financial/classification as needed | no | YES | HISTORICAL_LOOKBACK | `PROVISIONAL_ADAPT` | YES HC6 |
| Minimal | baseline/Needs/obligations | baseline components | minimal_month_cost | A | versioned reference | household | reference | method-defined | required components | no | YES | HISTORICAL_LOOKBACK | `PROVISIONAL_ADAPT` | YES |
| Typical↔Minimal gap | same | produced metrics | comparison engine | M1 refs | same reference | household | reference | both publishable | both sufficient | YES possible | YES | HISTORICAL_LOOKBACK | `PROVISIONAL_REUSE/ADAPT` | YES |
| Structure Necessity | classifications | EconomicComponentFact | economic aggregation | A | certified history | household/person if attributed | class | sufficient components | necessityCoverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES HC2 |
| Structure fixed/variable | classifications | EconomicComponentFact | fixed_variable_amount | A | certified history | household/person | class | sufficient | behaviorCoverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES HC2 |
| Structure LifeScope | classifications | EconomicComponentFact | life_scope_amount | A | certified history | household/person | class | sufficient | lifeScopeCoverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES HC2 |
| Economic evolution series | certified months | EconomicComponentFact | monthly produced metrics | A | max reliable history | household/person | metric | gaps preserved | financial coverage | no | YES | GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES |
| Stability/volatility | evolution series | derived series | no final engine observed | M1 series | >=6 months normal | household/person | metric | 4–5 partial, >=6 sufficient | series coverage | YES | YES | HISTORICAL_LOOKBACK | `PROVISIONAL_NEW` | YES |
| Recent Change | series/current regime | derived series | no final engine observed | M1/M3 | versioned recent window | household/person | metric | method-specific | sufficient series | YES | YES | HISTORICAL_LOOKBACK | `PROVISIONAL_NEW` | YES |
| Medium-Term Trend | series | derived series | no final engine observed | M1/M3 | >=6, long >=12 | household/person | metric | thresholds Master | gap-aware | YES | YES | HISTORICAL_LOOKBACK | `PROVISIONAL_NEW` | YES |
| Structural Monthly Equivalent | recurrence/economic series | EconomicComponentFact | no final Global engine observed | M1 | historical | household | recurrence | recurrence support | required coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Structural recurrences | recurrence canonical/series | economic components | legacy/internal recurrence candidates | M1 | all reliable occurrences | household | recurrence | cadence-specific | recurrence source coverage | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES |
| Evolution contributors | dimensions | EconomicComponentFact | aggregation/comparison/materiality | M1/M2 | target/reference windows | household/person | category/need/etc | comparable support | dimension coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES |

## 5.3 Module 2 — Catégories & Needs

| GLOBAL_OUTPUT | CANONICAL_INPUTS | FACT_INPUTS | ANALYTICS_INPUTS | OTHER_MODULE_DEPENDENCIES | TIME_RANGE | PERSON_SCOPE | ENTITY_SCOPE | SUPPORT_REQUIREMENT | COVERAGE_REQUIREMENT | MATERIALITY? | PUBLICATION_DEPENDENCY? | INVALIDATION_SCOPE | CLASSIFICATION | REVALIDATE_AT_GA0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Category amount/share/history | category authority | EconomicComponentFact | category_amount + total | M1 | certified history | household/person if valid | category | source support | categoryCoverage | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `PROVISIONAL_REUSE/ADAPT` | YES |
| Subcategory aggregation | subcategory authority | EconomicComponentFact | generic aggregation | M1 | certified history | household/person | subcategory | source support | subcategoryCoverage | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES |
| Need aggregation/share | Need authority | EconomicComponentFact/classification | no dedicated active metric observed | M1 | certified history | household/person | Need | source support | needCoverage | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES HC2 |
| Recent comparison | category/Need series | metrics | comparison engine | M1 | recent/reference | household/person | dimension | comparable support | dimension coverage | YES | YES | HISTORICAL_LOOKBACK | `PROVISIONAL_ADAPT` | YES |
| Historical comparison | series | metrics | comparison/reference | M1 | max certified | household/person | dimension | sufficient months | coverage | YES | YES | HISTORICAL_LOOKBACK | `PROVISIONAL_ADAPT` | YES |
| Contributor decomposition | category/Need/other dimensions | EconomicComponentFact | aggregation + materiality | M1/M8 optional enrichment | comparison windows | household/person | multiple | source-specific | min required | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES |
| Cross-dimensional drilldown | multiple authorities | Facts | aggregation/context | M1/M4/M6/M7/M8 | support intersection | household/person | cross-entity | intersection | min coverages | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW/ADAPT` | YES |
| Frequency × ticket category | PurchaseEvent/category linkage | PurchaseEventFact + EconomicComponent | purchase count + amount | M8 purchase core | eligible purchases | household/person | category | purchase cadence support | purchase/category linkage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW`, DATA_GATED | YES |

## 5.4 Module 3 — Chapitres & transformations

| GLOBAL_OUTPUT | CANONICAL_INPUTS | FACT_INPUTS | ANALYTICS_INPUTS | OTHER_MODULE_DEPENDENCIES | TIME_RANGE | PERSON_SCOPE | ENTITY_SCOPE | SUPPORT_REQUIREMENT | COVERAGE_REQUIREMENT | MATERIALITY? | PUBLICATION_DEPENDENCY? | INVALIDATION_SCOPE | CLASSIFICATION | REVALIDATE_AT_GA0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TransformationSignalCatalog | outputs Finance/Life | multi-Facts | normalized signal contract | M1/M2/M4; later E/F enrich | max reliable by signal | household/person | signal | per signal | per dimension | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| ChangePoint candidates | time series | derived signals | none final observed | M1/M2/M4 | gap-aware history | scope of signal | signal | 4+4 partial, 6+6 sufficient completed | series coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Before/after robust stats | same | same | robust comparison new | M3 signals | around candidate | same | signal | Master thresholds | effective coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Persistence gate | post-change observations | same | persistence engine | M3 | post window | same | transformation | 6+6 or ongoing 6+4 | sufficient | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| DURABLE_CHANGE / NEW_PHASE / TEMPORARY_CHAPTER | candidates + persistence | derived | classifier | M3 | historical | household/person | transformation | sufficient | sufficient | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Ongoing phase state | certified + live tail | derived | status updater | M3 | certified + descriptive live | same | transformation | certified proof first | certified coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Multi-domain fusion | Finance/Life/Moment/Place/etc | cross-Facts | fusion engine | B/C, later E/F | aligned anchors | household/person | transformation | intersection | min required | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Current regime handoff | confirmed transformations | derived | regime resolver | M1/M9 | since last confirmed break | household/person | regime | confirmed only | sufficient | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |

## 5.5 Module 4 — Rythme & habitudes

| GLOBAL_OUTPUT | CANONICAL_INPUTS | FACT_INPUTS | ANALYTICS_INPUTS | OTHER_MODULE_DEPENDENCIES | TIME_RANGE | PERSON_SCOPE | ENTITY_SCOPE | SUPPORT_REQUIREMENT | COVERAGE_REQUIREMENT | MATERIALITY? | PUBLICATION_DEPENDENCY? | INVALIDATION_SCOPE | CLASSIFICATION | REVALIDATE_AT_GA0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Activity occurrence rate | life events/participations | ActivityOccurrenceFact | activity_frequency + observability normalization needed | A | max life corpus | household/person | activity | normalized observable periods | life/activity coverage | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES |
| Activity cadence | occurrences | ActivityOccurrenceFact | cadence engine not final observed | A | all reliable occurrences | household/person | activity | 5–7 partial, >=8 sufficient | occurrence coverage | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Day-context analytics | person_days/context sources | PersonDayFact | context engine partial | A | max observable days | person/household | context | day support | dayCoverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES |
| Habit appearance/disappearance/reactivation | activities + support | ActivityOccurrenceFact | lifecycle engine | M4 | historical | household/person | habit | repeated support | observability | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Routine extraction / CORE-OPTIONAL | activity/context sequences | Activity/PersonDay | no final engine observed | M4 | natural cycles | household/person | routine | 3 partial, >=5 repetitions | relevant coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Weekly cycles | occurrences/persondays | facts | cycle engine | M4 | sufficient cycles | household/person | activity/context | data-gated | coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW`, DATA_GATED | YES |
| Annual seasonality | multi-year signals | facts | seasonality engine | M4 | >=3 complete homologous cycles | household/person | phenomenon | 2 hypothesis, >=3 publishable | strong comparable coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW`, DATA_GATED | YES |
| Routine causal cost | activity links | ActivityOccurrenceCostFact | activity causal metrics | M4/M5 | occurrences | household/person | routine/activity | >=7 reliable cost occurrences for typical cost | causal link coverage | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `PROVISIONAL_ADAPT`, DATA_GATED | YES HC2 |

## 5.6 Module 5 — Vie ↔ Argent

| GLOBAL_OUTPUT | CANONICAL_INPUTS | FACT_INPUTS | ANALYTICS_INPUTS | OTHER_MODULE_DEPENDENCIES | TIME_RANGE | PERSON_SCOPE | ENTITY_SCOPE | SUPPORT_REQUIREMENT | COVERAGE_REQUIREMENT | MATERIALITY? | PUBLICATION_DEPENDENCY? | INVALIDATION_SCOPE | CLASSIFICATION | REVALIDATE_AT_GA0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RelationshipCatalog | normative whitelist | n/a | relationship definitions | B/C + optional E/F definitions | n/a | all declared | relation | n/a | n/a | no | YES | CONTENT/CONTRACT scoped | `PROVISIONAL_NEW` | YES |
| Comparable units | source authorities | cross-Facts | support intersection | B/C/E/F | natural relation grain | person/household/shared | relation | eligible comparable units | min coverages | no | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Matching/stratification 1:1 | comparable dataset | derived | matching engine | B/C | matched support | according relation | relation | after matching | coverage retained | no | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Binary effect stats | matched dataset | derived | effect engine | M5 | matched | same | relation | sufficient paired/group observations | sufficient | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Monetary paired stats | matched finance/life | derived | monetary relation engine | M1/M5 | matched | same | relation | paired support | financial+context min | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Bootstrap uncertainty | effect sample | derived | bootstrap | M5 | sample | same | relation | method-specific | n/a | no | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| BH/FDR multiplicity | candidate relation results | derived | correction engine | M5 | publication set | all | relation family | enough hypotheses/data | n/a | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Temporal robustness / LOMO | relation across periods | derived | robustness engine | M5 | multi-period | same | relation | repeated support | temporal coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Relationship state | robust results | derived | state resolver | M5 | historical | same | relation | publishable relation | sufficient | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |

## 5.7 Module 6 — Moments & expériences

| GLOBAL_OUTPUT | CANONICAL_INPUTS | FACT_INPUTS | ANALYTICS_INPUTS | OTHER_MODULE_DEPENDENCIES | TIME_RANGE | PERSON_SCOPE | ENTITY_SCOPE | SUPPORT_REQUIREMENT | COVERAGE_REQUIREMENT | MATERIALITY? | PUBLICATION_DEPENDENCY? | INVALIDATION_SCOPE | CLASSIFICATION | REVALIDATE_AT_GA0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Moment Family/Type/Series | moments/life events/series | event relations | taxonomy/comparability engine | A | all reliable Moments | household/person | moment/series | identity support | semantic coverage | no | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `PROVISIONAL_NEW/ADAPT` | YES |
| Moment comparability tiers | semantic authority | event facts | comparator | M6 | comparable corpus | household/person | moment family | 3–4 partial, >=5 sufficient | comparison coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Moment causal cost | life_event_financial_links + moment links | explicit causal evidence needed | History projection currently under review | M6 | Moment windows + linked facts | household/person | moment | causal support | causal linkage coverage | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES HC2 |
| spentDuring | economic timing within Moment | EconomicComponentFact | aggregation | M6 | Moment window | household/person | moment | source known | financial coverage | no | YES | ENTITY_SCOPED | `PROVISIONAL_REUSE/ADAPT` | YES |
| Preparation/core/after-effect/adjustment roles | financial/event relations | link evidence | phase-role engine | M6 | Moment neighborhood | household/person | moment | role evidence | link coverage | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Net/gross/refund composition | economic facts + adjustments | EconomicComponentFact | economic aggregation | M6 | Moment-linked | household | moment | known components | financial/causal coverage | YES | YES | ENTITY_SCOPED | `PROVISIONAL_ADAPT` | YES |
| Robust peer stats | comparable Moments | derived | robust statistics | M6 | comparable series | household/person | moment family | >=5 normal | adequate coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Repetition/series evolution | moment series | events | recurrence comparison | M6 | all series | household/person | series | repeated support | semantic coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Important low-cost Moments | importance signals + causal cost | multi-Facts | deterministic ranking | M6 | historical | household/person | moment | enough evidence | source coverages | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |

## 5.8 Module 7 — Lieux & mobilité

| GLOBAL_OUTPUT | CANONICAL_INPUTS | FACT_INPUTS | ANALYTICS_INPUTS | OTHER_MODULE_DEPENDENCIES | TIME_RANGE | PERSON_SCOPE | ENTITY_SCOPE | SUPPORT_REQUIREMENT | COVERAGE_REQUIREMENT | MATERIALITY? | PUBLICATION_DEPENDENCY? | INVALIDATION_SCOPE | CLASSIFICATION | REVALIDATE_AT_GA0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Visit count | visit/location authority | PlaceVisitFact | place_visit_count | A | max geo corpus | household/person | place | visits | placeCoverage | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `PROVISIONAL_REUSE` | YES HC2 |
| Distinct visit days | visits | PlaceVisitFact | distinct_visit_days | A | max geo corpus | household/person | place | visit days | placeCoverage | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES |
| Visit duration / STOP-STAY | visit intervals | PlaceVisitFact | no complete final engine observed | A | visits | person | place | interval precision | visit interval coverage | YES | YES | ENTITY_SCOPED | `PROVISIONAL_NEW/ADAPT` | YES |
| Place hierarchy/resolution | referentiel_lieu/roles | PlaceVisitFact | no final Global engine | A | timeless/versioned | all | place | authority | semantic coverage | no | YES | ENTITY_SCOPED | `PROVISIONAL_ADAPT` | YES |
| Place importance | visits + semantic/context | PlaceVisitFact + other facts | History scoring currently simplified | M4/M6 | historical | household/person | place | repeated support | min place/life coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW/ADAPT` | YES HC2 |
| Place lifecycle/state | visit series | PlaceVisitFact | no final engine observed | M7 | historical | household/person | place | repeated/time support | placeCoverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Localized spend | operation_place_canonical | EconomicComponentFact | localized_spend | M1 | certified economic | household/person if attribution | place | source support | localized finance coverage | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES HC2 |
| Structured MobilityLeg | mobility source | MobilityLegFact absent currently | none | M7 | legs | person/shared | route | own support | mobility coverage | YES | YES | GLOBAL_HISTORY | `AUTHORITY_GATED` AG-006 | YES |
| RouteDefinition | persisted route authority | RouteDefinition absent | none | M7 | validity period | household/person | route | n/a | route coverage | no | YES | ENTITY_SCOPED | `AUTHORITY_GATED` AG-007 | YES |
| Route frequency | legs/routes | MobilityLegFact | none | M7 | all resolved legs | person/shared | route | cadence policy | mobility+route coverage | YES | YES | GLOBAL_HISTORY | `AUTHORITY_GATED` AG-008 | YES |
| Distance analysis | route distance authority | route/leg fact | none final | M7 | route validity | person/shared | route | source support | distance coverage | YES | YES | ENTITY_SCOPED | `AUTHORITY_GATED` AG-009 | YES |
| Fuel price resolution | fuel authority | FuelPrice/Vehicle facts absent | fuel_trip_estimate only consumer | M7 | date of trip | household/person | vehicle/route | resolver coverage | fuel+vehicle coverage | no | YES | ENTITY_SCOPED/GLOBAL_HISTORY | `AUTHORITY_GATED` AG-001/010 | YES |
| Estimated fuel cost | route+vehicle+fuel | mobility facts | fuel_trip_estimate candidate | M7 | trip/route | household/person | route/vehicle | all prereqs | min required | YES | YES | ENTITY_SCOPED/GLOBAL_HISTORY | `AUTHORITY_GATED` AG-011 | YES |

## 5.9 Module 8 — Habitudes de consommation

| GLOBAL_OUTPUT | CANONICAL_INPUTS | FACT_INPUTS | ANALYTICS_INPUTS | OTHER_MODULE_DEPENDENCIES | TIME_RANGE | PERSON_SCOPE | ENTITY_SCOPE | SUPPORT_REQUIREMENT | COVERAGE_REQUIREMENT | MATERIALITY? | PUBLICATION_DEPENDENCY? | INVALIDATION_SCOPE | CLASSIFICATION | REVALIDATE_AT_GA0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Purchase identity/retention | purchase events + memberships + adjustments authority | PurchaseEventFact | purchase resolver/count | A | all reliable purchases | household/person when beneficiary known | purchase | purchase events | purchaseCoverage | no | YES | GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES |
| Purchase count | same | PurchaseEventFact | purchase_count | M8 | all purchases | household/person | merchant/category | count support | purchaseCoverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_REUSE` contract | YES |
| Purchase frequency | purchase events | PurchaseEventFact | cadence/frequency engine missing | M8 | all retained purchases | household/person | merchant/category | 5–7 partial, >=8 sufficient | purchaseCoverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Mean ticket | purchases + economic amount | PurchaseEventFact | summary statistics missing final | M8 | eligible purchase set | household/person | merchant/category | enough purchases | purchaseCoverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW/ADAPT` | YES |
| Median ticket | same | PurchaseEventFact | median engine needed | M8 | eligible purchase set | household/person | merchant/category | enough purchases | purchaseCoverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Frequency × ticket decomposition | same | PurchaseEventFact | decomposition engine | M8/M2 | comparison windows | household/person | merchant/category | cadence support | purchase+linkage coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Merchant identity/evolution | merchants + purchase/economic links | EconomicComponent/PurchaseEvent | merchant_net_amount + future purchase stats | M2 | historical | household/person | merchant | sufficient purchases | merchantCoverage | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES |
| Merchant substitution | purchase events/merchant | PurchaseEventFact | no final engine | M8 | historical | household/person | merchant | DATA_GATED | merchant/purchase coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW`, DATA_GATED | YES |
| PurchaseLineFact | line-level real purchase authority | absent target fact | none | M8 | purchase | household/person | product | n/a | product linkage | no | YES | ENTITY_SCOPED/GLOBAL_HISTORY | `AUTHORITY_GATED` AG-012 | YES |
| ProductFamily | canonical product identity | product fact absent | none | M8 | versioned | all | product | n/a | identity coverage | no | YES | ENTITY_SCOPED | `AUTHORITY_GATED` AG-013 | YES |
| ProductVariant | canonical variant identity | absent | none | M8 | versioned | all | product | n/a | identity coverage | no | YES | ENTITY_SCOPED | `AUTHORITY_GATED` AG-014 | YES |
| ProductFormat | canonical format | absent | none | M8 | versioned | all | product | n/a | format coverage | no | YES | ENTITY_SCOPED | `AUTHORITY_GATED` AG-015 | YES |
| Normalized unit | canonical normalization | absent | none | M8 | versioned | all | product | n/a | unit coverage | no | YES | ENTITY_SCOPED | `AUTHORITY_GATED` AG-016 | YES |
| ProductAcquisitionOccurrence | real purchase lines + variant/date | absent | none | M8 | acquisition events | household/person | product | 5–7 partial, >=8 cadence | productCoverage | YES | YES | GLOBAL_HISTORY | `AUTHORITY_GATED` AG-017 | YES |
| Product cadence/lifecycle | acquisition occurrences | absent | none | M8 | historical | household/person | product | >=8 cadence normally | product coverage | YES | YES | GLOBAL_HISTORY | `AUTHORITY_GATED` AG-018/019 | YES |
| Product substitution | product comparable identity | absent | none | M8 | historical | household/person | product | enough transitions | product coverage | YES | YES | GLOBAL_HISTORY | `AUTHORITY_GATED` AG-020 | YES |
| Product price / personal index | real lines/prices/units | absent target facts | none | M8 | matched windows | household/person | product | >=5 matched items + >=10 obs for index | matched coverage | YES | YES | GLOBAL_HISTORY | `AUTHORITY_GATED` AG-003/004/021 | YES |

**Invariant futur Benefit Wallet** : toutes les lignes ci-dessus doivent préserver `purchase ≠ funding ≠ bank transaction`. L’arrivée de Swile/Edenred ne doit pas nécessiter de redéfinir l’identité PurchaseEvent.

## 5.10 Module 9 — Persona Adrien / Manon

| GLOBAL_OUTPUT | CANONICAL_INPUTS | FACT_INPUTS | ANALYTICS_INPUTS | OTHER_MODULE_DEPENDENCIES | TIME_RANGE | PERSON_SCOPE | ENTITY_SCOPE | SUPPORT_REQUIREMENT | COVERAGE_REQUIREMENT | MATERIALITY? | PUBLICATION_DEPENDENCY? | INVALIDATION_SCOPE | CLASSIFICATION | REVALIDATE_AT_GA0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Person-scoped metrics | person attribution | B–F Facts | engines B–F | B–F | own max reliable support | PERSON | phenomenon | family-specific | personal attribution + family coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_ADAPT` | YES |
| Common comparable support | person observability | multi-Facts | support intersection | B–F | intersection Adrien/Manon | PERSON pair | phenomenon | common support | min coverages | no | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Persona normalization | same | outputs B–F | rate/normalization | B–F | natural grain | PERSON | phenomenon | sufficient common support | sufficient | no | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| PersonaMateriality | deterministic metrics | outputs B–F | materiality framework | B–F | current regime/historical | PERSON pair | insight | family policy | sufficient | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_ADAPT/NEW` | YES |
| Current-regime filtering | transformations | outputs M3 | regime resolver | M3 | current regime | PERSON | insight | confirmed regime | adequate | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Exceptional exclusion | moments/transformations | multi-Facts | exclusion policy | M3/M6 | historical | PERSON | insight | policy-specific | provenance | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| PersonaDifferenceEngine | source metrics | outputs B–F | pairwise deterministic engine | B–F | common supports | PERSON pair | insight | source supports | source coverages | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Ranking/anti-redundancy/diversity/hysteresis | candidate differences | derived | selection engine | M9 | publication | pair | insight | source supports | source coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| ObservedPersonalTypicalCost | attributable economic history | EconomicComponentFact | Typical person-scoped adaptation | M1 | certified personal history | PERSON | reference | DATA_GATED | personalAttributionCoverage >= policy | YES | YES | HISTORICAL_LOOKBACK | `PROVISIONAL_ADAPT`, DATA_GATED | YES |
| Enriched PersonalReferenceCost | declarations/estimates/supplements | future enriched facts | no engine observed | M9 | current reference | PERSON | reference | authority dependent | authority coverage | YES | YES | GLOBAL_HISTORY | `AUTHORITY_GATED` AG-022 | YES |

## 5.11 Module 10 — Nous deux

| GLOBAL_OUTPUT | CANONICAL_INPUTS | FACT_INPUTS | ANALYTICS_INPUTS | OTHER_MODULE_DEPENDENCIES | TIME_RANGE | PERSON_SCOPE | ENTITY_SCOPE | SUPPORT_REQUIREMENT | COVERAGE_REQUIREMENT | MATERIALITY? | PUBLICATION_DEPENDENCY? | INVALIDATION_SCOPE | CLASSIFICATION | REVALIDATE_AT_GA0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Participation status PRESENT/ABSENT/UNKNOWN/CONFLICT | life_event_participations + evidence | Activity/Moment/Place participant facts | resolver missing final | B–F | occurrence natural | SHARED | occurrence | observable shared units | participantCoverage | no | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `PROVISIONAL_NEW/ADAPT` | YES |
| Evidence tiers EXPLICIT/CANONICAL/STRONG_COPRESENCE | participation/location evidence | multi-Facts | SharedInferenceCatalog | M4/M6/M7 | occurrence | SHARED | occurrence | method-specific | evidence coverage | no | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Shared observable support | observability both persons | Activity/PersonDay/Place | support intersection | M4/M7 | shared natural support | SHARED | phenomenon | shared support | min participant/day/place | no | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Shared activity occurrence/rate | participation + activities | ActivityOccurrenceFact | shared projection/rate | M4 | occurrences | SHARED | activity | sufficient occurrences | participant coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Shared place visit | visits/person | PlaceVisitFact | shared visit resolver | M7 | visits | SHARED | place | support | place+participant coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Basic shared Moment relation | moments + participations | Moment/Event facts | shared resolver | M6 | Moments | SHARED | moment | evidence | participant coverage | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `PROVISIONAL_NEW` | YES |
| Shared routines/evolution | shared occurrences | derived | routine/trend engines | M4/M10 | historical | SHARED | activity | DATA_GATED | shared coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW`, DATA_GATED | YES |
| Shared causal experience cost | causal Moment/Activity evidence | causal facts | M6 cost + shared evidence | M6 | occurrence/Moment | HOUSEHOLD/SHARED | moment/activity | DATA_GATED | causal+participant coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_ADAPT/NEW`, DATA_GATED | YES |
| PAIR_ONLY / WITH_EXTERNALS | roster completeness | future participant/contact facts | resolver | M10 | occurrence | SHARED | occurrence | DATA_GATED | participant roster coverage | YES | YES | GLOBAL_HISTORY | `PROVISIONAL_NEW`, DATA_GATED | YES |
| Shared MobilityLeg | mobility + participants | MobilityLegFact absent | none | M7/M10 | trip | SHARED | route | authority dependent | mobility+participant coverage | YES | YES | GLOBAL_HISTORY | `AUTHORITY_GATED` AG-023 | YES |
| Named external contacts | contact + participation | Contact/SocialParticipation absent | none | Social/M10 | occurrences | SHARED | contact | authority dependent | participant+contact identity | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `AUTHORITY_GATED` AG-024 | YES |
| Social groups | group declarations | ContactGroup absent | none | Social | historical | SHARED | group | authority dependent | identity coverage | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `AUTHORITY_GATED` AG-025 | YES |
| Advanced shared with contacts | contacts/groups/rosters | future facts | none | Social/M10 | occurrences | SHARED | contact/group | authority dependent | effective min coverage | YES | YES | GLOBAL_HISTORY | `AUTHORITY_GATED` AG-026 | YES |

## 5.12 Social transversal

| GLOBAL_OUTPUT | CANONICAL_INPUTS | FACT_INPUTS | ANALYTICS_INPUTS | OTHER_MODULE_DEPENDENCIES | TIME_RANGE | PERSON_SCOPE | ENTITY_SCOPE | SUPPORT_REQUIREMENT | COVERAGE_REQUIREMENT | MATERIALITY? | PUBLICATION_DEPENDENCY? | INVALIDATION_SCOPE | CLASSIFICATION | REVALIDATE_AT_GA0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| external participant unresolved-safe | life event participants | occurrence participant evidence | safe projection | M4/M6/M10 | occurrence | household/shared | external participant | n/a | participant coverage | no | YES | ENTITY_SCOPED | `PROVISIONAL_ADAPT` | YES |
| Canonical Contact consumption | Contact authority | Contact fact | social identity engine | M10 | historical | household/shared | contact | authority | contactIdentityCoverage | YES | YES | ENTITY_SCOPED + GLOBAL_HISTORY | `AUTHORITY_GATED` AG-027 | YES |
| ContactAlias | alias authority | ContactAlias | identity resolver | Social | validity | n/a | contact | authority | identity coverage | no | YES | ENTITY_SCOPED | `AUTHORITY_GATED` AG-028 | YES |
| ContactRelation | declared relation authority | ContactRelation | social projection | Social | validity | n/a | contact | authority | identity/relation coverage | YES | YES | ENTITY_SCOPED | `AUTHORITY_GATED` AG-029 | YES |
| ContactGroup | declared group authority | ContactGroup | group projection | Social | validity | n/a | group | authority | group coverage | YES | YES | ENTITY_SCOPED | `AUTHORITY_GATED` AG-030 | YES |
| Contact participation links | contact occurrence links | SocialParticipation | participation analytics | M10 | occurrence | shared | contact | authority | participant+identity coverage | YES | YES | GLOBAL_HISTORY | `AUTHORITY_GATED` AG-031 | YES |

---

# 6. Couverture des 364 capabilities par familles de dependency rows

Le registre normatif compte :

```text
364 total
276 MUST_V1
49 CONDITIONAL_V1
  ├─ 18 DATA_GATED
  └─ 31 AUTHORITY_GATED
15 LATER
24 FORBIDDEN
```

La matrix ci-dessus ne duplique pas mécaniquement 364 lignes lorsque plusieurs capabilities expriment un invariant/test/policy d’une même sortie. La couverture est assurée par familles :

| Registre | Dependency rows qui portent les autorités |
|---|---|
| Foundations (35) | section 5.1 + support/coverage/publication/revision |
| M1 | section 5.2 |
| M2 | section 5.3 |
| M3 | section 5.4 |
| M4 | section 5.5 |
| M5 | section 5.6 |
| M6 | section 5.7 |
| M7 | section 5.8 + AG-001/006→011 |
| M8 | section 5.9 + AG-002→004/012→021 |
| M9 | section 5.10 + AG-022 |
| M10 | section 5.11 + AG-023→026 |
| Social | section 5.12 + AG-005/027→031 |
| UX/Query | dépend des outputs, traité en audit préparatoire 05 |
| Publication/Invalidation | sections 10–11 + futur audit préparatoire 04 |
| Résumé contextuel | dépend des outputs certifiés A–H ; pas une source Analytics |
| LATER | aucune dépendance V1 à implémenter |
| FORBIDDEN | anti-dépendances explicites section 9 |

Toutes les `AUTHORITY_GATED` sont atomisées individuellement ci-dessous.

---

# 7. Registre AUTHORITY_GATED — état préparatoire, aucune décision finale

> **Règle absolue** : la colonne « preuve actuelle » ne vaut ni `AVAILABLE` ni `UNAVAILABLE`. Toutes les lignes restent `AUTHORITY_GATED` et `REVALIDATE_AT_GA0 = YES`.

| AG | Capability | Candidate sources / autorités à vérifier | Preuve actuelle observée | Conflit / risque | Décision attendue à GA0 | Phases bloquées |
|---|---|---|---|---|---|---|
| AG-001 | FuelPriceResolver engine | fuel prices + vehicle/fuel type + date/territory | table fuel_price existe mais 0 ligne ; vehicles 0 | prix arbitraire interdit | AVAILABLE/UNAVAILABLE | E/M7 |
| AG-002 | PurchaseCycleEngine product | real PurchaseEvent→Line→Variant→Acquisition | product observations faibles ; pas de PurchaseLine/Variant cible observé | ligne/price obs ≠ achat | GA0 | F/M8 |
| AG-003 | Product price analytics | real lines + variant/format + paid net price + normalized unit | 7 product price observations, mais pas preuve d’achat | catalogue/observation ≠ paid purchase | GA0 | F/M8 |
| AG-004 | PersonalConsumptionPriceIndex | matched real purchases + comparable identities | pas de corpus cible prouvé | total dépensé ≠ inflation | GA0 | F/M8 |
| AG-005 | Contact/social identity engine | Contact/Alias/Relation/Group + participation | aucune table Contact nommée observée | nom/fréquence/co-présence ≠ identité/relation | GA0 | G/Social/M10 |
| AG-006 | Structured MobilityLeg | explicit mobility evidence + endpoints | aucun MobilityLeg objet nommé observé | place succession ≠ trip | GA0 | E/M7 |
| AG-007 | RouteDefinition | persisted directional route/mode/distance/source | route_distances existe mais 0 ligne ; pas contrat RouteDefinition complet prouvé | distance seule ≠ route | GA0 | E/M7 |
| AG-008 | Route frequency | resolved legs→routes + observable support | aucune base de legs prouvée | PlaceVisit transitions interdites | GA0 | E/M7 |
| AG-009 | Distance analysis | authoritative route distance | route_distances 0 | straight-line fallback interdit | GA0 | E/M7 |
| AG-010 | FuelPriceResolver M7 | fuel authority + trip context | fuel_price 0 / vehicles 0 | mauvais fuel/time/territory | GA0 | E/M7 |
| AG-011 | Estimated fuel cost | route distance + vehicle consumption + fuel price | prereqs non prouvés | multiplication de valeurs inventées | GA0 | E/M7 |
| AG-012 | PurchaseLineFact | line-level purchase linked to PurchaseEvent | product_observations existent mais pas contrat cible | observation produit ≠ ligne d’achat | GA0 | F/M8 |
| AG-013 | ProductFamily | canonical product taxonomy | product_key/nom existants, pas authority Family prouvée | texte ≠ identité | GA0 | F/M8 |
| AG-014 | ProductVariant | canonical variant identity | non prouvé | SKU/libellé ≠ variant universel | GA0 | F/M8 |
| AG-015 | ProductFormat | canonical format identity | quantité/unité partielles dans observations | format ambigu | GA0 | F/M8 |
| AG-016 | Normalized unit | unit conversion authority | quelques unités en price observations | conversion ad hoc interdite | GA0 | F/M8 |
| AG-017 | ProductAcquisitionOccurrence | retained purchase line + variant/date/scope | non prouvé | multi-quantity ≠ multiple occurrences | GA0 | F/M8 |
| AG-018 | Product cadence | ProductAcquisitionOccurrence series | non prouvé | lignes bancaires interdites | GA0 | F/M8 |
| AG-019 | Product lifecycle | product acquisitions/outcomes | non prouvé | absence de donnée ≠ arrêt produit | GA0 | F/M8 |
| AG-020 | Product substitution | comparable product identity + acquisition | non prouvé | variation assortiment ≠ substitution automatique | GA0 | F/M8 |
| AG-021 | PersonalConsumptionPriceIndex M8 | product price comparable corpus | non prouvé | spend change ≠ inflation | GA0 | F/M8 |
| AG-022 | PersonalReferenceCost enriched | declared/estimated supplements with authority | aucun engine/metric cible observé | inventer coût perso interdit | GA0 | G/M9 |
| AG-023 | Shared MobilityLeg | MobilityLeg + participant evidence | aucun leg prouvé | même trajet apparent ≠ shared trip | GA0 | G/M10 |
| AG-024 | Named external contacts | Contact + explicit/canonical participation | life_event_participations riches, mais pas Contact IDs externes prouvés | nom libre ≠ contact identity | GA0 | G/M10 |
| AG-025 | Social groups | declared ContactGroup membership | aucune authority group nommée observée | co-occurrence ≠ friend group | GA0 | G/M10/Social |
| AG-026 | Advanced shared with contacts | shared resolver + Contacts/Groups + roster | participant rows existent, identity externe non prouvée | PAIR_ONLY sans roster exhaustif | GA0 | G/M10 |
| AG-027 | Canonical Contact consumption | Contact object | non observé par nom | identity fabrication | GA0 | G/Social |
| AG-028 | ContactAlias | alias authority | non observé | fusion par prénom interdite | GA0 | G/Social |
| AG-029 | ContactRelation | declared relation | non observé | fréquence ≠ relation | GA0 | G/Social |
| AG-030 | ContactGroup | declared group | non observé | clustering ≠ groupe | GA0 | G/Social |
| AG-031 | Contact participation links | contact-linked occurrence participation | household participation existe, external identity non prouvée | co-presence/GPS fallback interdit | GA0 | G/Social/M10 |

### 7.1 Trois points d’autorité transversaux à ne pas oublier

Le registre final distingue également des points d’autorité importants sans les reclasser comme nouvelles capabilities :

- Merchant vs MerchantEstablishment ;
- finance ↔ lieu ;
- attribution personnelle / payer vs beneficiary.

Ils doivent eux aussi être audités dans GA0 et dans la dependency matrix finale.

---

# 8. Support et Coverage — dependency policies par famille

## 8.1 Seuils de support normatifs à préserver

| Famille | PARTIAL / indicatif | SUFFICIENT / normal |
|---|---:|---:|
| Tendance mensuelle | 4–5 mois complets | >= 6 mois |
| Tendance longue | — | >= 12 mois |
| Stabilité/volatilité mensuelle | 4–5 | >= 6 |
| Cadence Activity/Purchase | 5–7 occurrences | >= 8 |
| Coût typique Activity | 4–6 occurrences fiables | >= 7 |
| Famille Moments | 3–4 Moments | >= 5 |
| Comparaison jours | 8–14 jours/groupe | >= 15/groupe |
| Routine | 3 répétitions | >= 5 |
| Transformation terminée | 4 avant + 4 après | >= 6 + 6 |
| Phase en cours | 4 avant + 3 après | >= 6 avant + 4 après |
| Saisonnalité | 2 cycles = hypothèse | >= 3 cycles complets |

Aucun futur moteur ne doit réduire ces règles à un `n >= X` universel.

## 8.2 Coverages à garder séparées

Au minimum :

```text
financialSourceCoverage
categoryCoverage
needCoverage
merchantCoverage
dayCoverage
placeCoverage
participantCoverage
purchaseCoverage
productCoverage
priceComparableCoverage
personalAttributionCoverage
contactIdentityCoverage
mobility/route/fuel coverage selon activation
```

Le moteur cross-domain doit appliquer :

```text
effectiveCoverage = min(requiredCoverages)
```

et non une moyenne.

Règle générale Global :

```text
>= 85 %       sufficient / publication normale
60–84.99 %    partial / formulation qualifiée
< 60 %        insufficient pour une conclusion Global générale
```

sauf policy spécialisée plus stricte.

---

# 9. DAG conceptuel inter-modules et prévention des cycles

## 9.1 DAG de base

```text
A FOUNDATIONS
   ↓
B FINANCE
   ├─ M1 Economy
   └─ M2 Categories / Needs
   ↓
C TEMPORAL / LIFE
   ├─ M3 Transformations
   └─ M4 Rhythm / Habits
   ↓
D RELATIONS
   └─ M5 Life ↔ Money core
   ↓
E MOMENTS / GEO
   ├─ M6 Moments
   └─ M7 Places / Mobility
   ↓
F CONSUMPTION
   └─ M8 Purchases / Merchants / Products
   ↓
G PEOPLE / SOCIAL
   ├─ M9 Persona
   ├─ M10 Together
   └─ Social dimension
   ↓
H QUERY / READMODELS / UX
   ↓
I CONTEXTUAL SUMMARY
```

## 9.2 Dépendances transversales réelles

```text
Finance → Relations
Finance → Persona
Temporal → Relations
Temporal → Persona
Activity → Transformations
Activity → Relations
Activity → Shared
Moments → Relations (definitions activées ensuite)
Places → Relations / Persona / Shared
Consumption → Persona
Purchase → Category drivers
Participation → Moments / Persona / Shared
```

## 9.3 Cycles potentiels à empêcher

### Cycle 1 — Finance core ↔ Consumption

M2 peut être enrichi plus tard par PurchaseEvent/merchant/frequency×ticket, mais **le cœur Finance ne doit pas dépendre de M8** pour exister.

Contrat :

```text
M2 core categories/Needs
→ stable indépendamment de M8

M8
→ peut enrichir les drivers M2 après stabilisation
→ recertification ciblée
```

Interdit :

```text
M2 a besoin de M8
M8 a besoin de M2
→ cycle de construction
```

### Cycle 2 — Transformations ↔ Relations

M3 détecte les transformations depuis des signaux sources déterministes. M5 peut ensuite décrire des associations autour de ces transformations.

Interdit : utiliser une relation M5 comme preuve primaire qui crée le ChangePoint M3 qui a lui-même défini le corpus M5.

### Cycle 3 — Relations ↔ Moments/Places/Consumption

Le **core** de `RelationshipEngine` peut être construit après B/C. Les definitions nécessitant M6/M7/M8 restent inactives jusqu’à disponibilité de ces engines, puis M5 est recertifié.

Ce n’est pas un cycle :

```text
M5 engine framework
→ stable
M6/M7/M8 output arrive
→ nouvelles relationship definitions éligibles
→ recertification M5
```

### Cycle 4 — Persona recréant les engines sources

M9 ne doit jamais recalculer Finance/Activity/Place/Purchase. Il consomme des résultats person-scoped déjà produits.

### Cycle 5 — Shared recréant Person/Activity/Place

M10 consomme des occurrences et preuves de participation. Il ne crée pas de nouvelle occurrence uniquement parce que les deux personnes ont une ligne bancaire ou un GPS similaire.

---

# 10. Modules réellement parallélisables

| Ensemble | Parallèle ? | Condition |
|---|---|---|
| Foundations internes | partiellement | contrats partagés figés avant sortie A |
| M1 / M2 | oui partiellement | mêmes autorités EconomicComponent/refs, aucune duplication de moteur |
| M3 / M4 | partiellement | M3 peut consommer des signaux M4 stabilisés ; définir handoff |
| M5 framework / préparation M6-M7 | préparation oui | M5 publishable definitions seulement après leurs sources |
| M6 / M7 | oui partiellement | Facts séparés, foundations communes |
| M8 product-gated vs purchase core | oui | product gates peuvent rester disabled sans bloquer purchase core |
| M9 / M10 | oui partiellement | moteurs B–F et participation foundations doivent être stables |
| H ReadModels | par module après freeze | page finale seulement quand publication cohérente possible |
| I Summary | contrats/tests préparables | produit seulement après déterministic Global |

---

# 11. Future Refresh compatibility — matrice conceptuelle

> Cette section ne construit pas le Refresh Planner. Elle indique seulement les **classes d’impact probables** afin que Global n’empêche pas son implémentation future.

| Mutation / famille | Impacts conceptuels probables | Pourquoi |
|---|---|---|
| correction montant/timing économique d’un mois | `LOCAL_MONTH` + `HISTORICAL_LOOKBACK` + éventuellement `GLOBAL_HISTORY` | Actual local + références/trends/relations/persona |
| correction Category/Need/classification | `LOCAL_MONTH` + `ENTITY_SCOPED` + `HISTORICAL_LOOKBACK` + `GLOBAL_HISTORY` | M2 + structures + contributors + relationships/persona |
| changement méthode Typical/Minimal | `HISTORICAL_LOOKBACK` + `GLOBAL_HISTORY` | références structurelles |
| Activity occurrence ajout/correction | `ENTITY_SCOPED` + `GLOBAL_HISTORY` | cadence/routine/transformation/relation/persona/shared |
| Activity causal link | `ENTITY_SCOPED` + `GLOBAL_HISTORY` | costs/relations/Moments éventuels |
| PersonDay/context | `GLOBAL_HISTORY` + person-scoped | rates/routines/relations/persona |
| PlaceVisit | `ENTITY_SCOPED` + `GLOBAL_HISTORY` | M7 + M3/M5/M9/M10 |
| operation_place canonical | `LOCAL_MONTH` + `ENTITY_SCOPED` + `GLOBAL_HISTORY` | localized finance + place analytics |
| Moment/life-event relation | `ENTITY_SCOPED` + `GLOBAL_HISTORY` | M6/M3/M5/M9/M10 |
| participant evidence | `ENTITY_SCOPED` + `GLOBAL_HISTORY` | M6/M9/M10/Social |
| PurchaseEvent | `LOCAL_MONTH` si finance liée + `ENTITY_SCOPED` + `GLOBAL_HISTORY` | M8/M2/M5/M9 |
| product identity/line/price | `ENTITY_SCOPED` + `GLOBAL_HISTORY` | M8 product/cycles/index/persona |
| mobility/route/fuel authority | `ENTITY_SCOPED` + `GLOBAL_HISTORY` | M7/M10 |
| Contact identity/relation/group | `ENTITY_SCOPED` + `GLOBAL_HISTORY` | Social/M10 |
| Media assignment | `CONTENT_SCOPED` | aucun Analytics financier/statistique à recalculer |
| résumé contextuel importé | `CONTENT_SCOPED` / future `AI_SUMMARY_SCOPED` | narration seulement |
| changement MethodVersion Global | `GLOBAL_HISTORY` | outputs dépendant de la méthode |

## 11.1 Correspondance avec l’invalidation actuelle

Le code actuel connaît :

```text
month
entity
global_reference
narrative
```

et une liste de Query resources invalidées par impact.

Ce mécanisme est une **primitive de départ**, pas le planner final. Le futur système devra évoluer d’une logique principalement « liste de ressources par type d’impact » vers une dependency matrix réellement dérivée des Facts/engines/artifacts/ReadModels Global.

Pré-classement : `PROVISIONAL_ADAPT`.

---

# 12. Dépendances interdites

Le futur plan Codex doit porter ces interdictions explicitement :

```text
Global Analytics
MUST NOT DEPEND ON History ReadModels
MUST NOT DEPEND ON React/UI state
MUST NOT DEPEND ON Calendar top-N/marker presentation
MUST NOT DEPEND ON Media availability
MUST NOT DEPEND ON imported AI summary
MUST NOT DEPEND ON Diagnostic result
MUST NOT DEPEND ON Import UI
MUST NOT DEPEND ON bank-line count as purchase/activity occurrence
MUST NOT DEPEND ON raw GPS points as PlaceVisits
MUST NOT DEPEND ON spentDuring as Moment causalCost
MUST NOT DEPEND ON payer as beneficiary
MUST NOT DEPEND ON price observation as purchase proof
MUST NOT DEPEND ON merchant chain as establishment proof
MUST NOT DEPEND ON co-presence as shared participation without contracted evidence
```

Et réciproquement :

```text
Contextual Summary
MUST depend on certified Global outputs
MUST NOT feed Global Analytics

Media
MAY decorate entities/readmodels
MUST NOT change metrics

Diagnostic
MAY inspect evidence/contracts/revisions
MUST NOT repair/recompute truth
```

---

# 13. Analytics cible probablement NEW vs primitives existantes

## 13.1 `PROVISIONAL_REUSE` fort

- EconomicComponentFact ;
- ActivityOccurrenceFact core ;
- ActivityOccurrenceCostFact ;
- PlaceVisitFact grain ;
- PurchaseEventFact contract ;
- ProducedMetric / MetricEnvelope ;
- Metric Registry / MethodVersion discipline ;
- additive Global planner guard ;
- Query validation / RuntimeSchema foundations ;
- generation/materialization/publication primitives, sous adaptation Global.

## 13.2 `PROVISIONAL_ADAPT`

- AnalysisScope global ;
- Support/Coverage ;
- Typical/Minimal usage Global ;
- person attribution ;
- PersonDay contexts ;
- Place scoring/coverage ;
- Materiality ;
- recurrence/internal Analysis engines ;
- current Global Evolution/Contexts as examples, pas comme cible ;
- invalidation mapping ;
- publication manifest/dependencies après HC3-HC6.

## 13.3 `PROVISIONAL_NEW` probable

- GlobalSupportEnvelope complet ;
- gap/observability intersection engine ;
- Trend/Stability policy engines finaux ;
- ChangePoint/Transformation engine ;
- habit lifecycle/routine/cycle/seasonality engines ;
- RelationshipEngine + matching/bootstrap/FDR/LOMO ;
- Moment comparability/peer analytics ;
- Place importance/lifecycle target ;
- Purchase frequency/ticket decomposition target ;
- PersonaDifferenceEngine ;
- SharedParticipationResolver / SharedInferenceCatalog ;
- Global module ReadModels et publication manifest V2 ;
- deterministic insight selection pour Summary.

## 13.4 `AUTHORITY_GATED`

Toutes les 31 capabilities du registre AG-001 → AG-031 restent ouvertes jusqu’à GA0.

---

# 14. Risques spécifiques révélés par l’EXISTANT

## 14.1 Le vieux Global a déjà des noms séduisants

`analysis_global_evolution`, `analysis_global_habits`, `analysis_global_profiles`, etc. existent déjà.

Cela ne signifie pas que les moteurs cibles existent.

Exemples observés :

- Evolution = série sur une `observationWindow` unique ;
- Habits heatmap = counts d’occurrences par mois, top 12 ;
- Profiles = dominant activity / frequent place / dominant context par ranking simple ;
- Universe = galleries.

Ces éléments peuvent fournir des primitives/tests/helpers, mais **ne constituent pas** Trend/Stability, RoutineEngine, PersonaDifferenceEngine ou la page M1–M10 du Master.

## 14.2 ActiveMetricId n’est pas le catalogue Global final

Les 16 métriques actuelles ne couvrent pas les 276 `MUST_V1` sous forme de moteurs/output contracts. Une implémentation Global devra donc créer des engines/artifacts/results spécialisés sans gonfler artificiellement `ActiveMetricId` pour chaque insight si un autre type de résultat est plus correct.

## 14.3 Scope global unique actuel

La présence de `observationWindow` dans le core ne doit pas forcer Global V2 à un seul intervalle. Le futur design doit pouvoir exprimer support/fenêtre par résultat.

## 14.4 Tables présentes mais vides

Schéma ≠ autorité disponible. Une capability Authority-Gated exige sémantique + provenance + données + coverage/support pertinents, pas uniquement une table.

## 14.5 Données faibles mais tentantes

`product_observations` et `product_price_observations` existent et contiennent quelques lignes. Elles ne doivent jamais être promues silencieusement en `PurchaseLineFact`, ProductVariant ou preuve d’achat tant que l’autorité cible n’est pas démontrée.

---

# 15. Handoff précis vers GA0 post-History

Après HC6, GA0 devra refaire seulement les validations physiques susceptibles d’avoir changé.

## 15.1 Baseline

- final History commit ;
- migrations ;
- schema live ;
- dataRevision / analyticsRevision ;
- publications History ;
- manifests/hashes ;
- tests/certification.

## 15.2 Autorités HC2

Revalider :

```text
Necessity
Behavior
LifeScope
Moment causal authority
Activity causal/associated semantics
Place/localized coverage
```

## 15.3 Dependency closure HC3

Revalider :

```text
factDependencies
analyticsDependencies
manifestHash
publicationFactsHash
external refs
persisted dependency evidence
```

## 15.4 Publication/correction HC4-HC5

Revalider :

```text
immutability
new generation semantics
correction → invalidation → rebuild → republish
client generation/cache behavior
```

## 15.5 Metric Registry et Facts

Comparer le registre final avec cette pré-matrix et classer définitivement chaque ligne :

```text
REUSE
ADAPT
NEW_METRIC
NEW_ENGINE
NEW_FACT
NEW_READMODEL
NEW_DATA
REMOVE_LEGACY
AUTHORITY_GATED resolved
```

## 15.6 Les 31 Authority Gates

Pour chaque AG-001 → AG-031 :

```text
PREREQUISITE_AVAILABLE
ou
PREREQUISITE_UNAVAILABLE
```

avec preuves : schéma, sémantique, provenance, données, conflicts, coverage, support, forbidden fallbacks.

## 15.7 Dependency matrix physique

Remplacer les noms conceptuels de ce document par :

```text
exact canonical tables/columns
exact Fact types/projections
exact engine/function/method versions
exact artifacts
exact Query resources
exact publication dependencies
exact invalidation scopes
exact tests
```

Aucun prompt d’implémentation ne doit inventer cette couche avant GA0.

---

# 16. Questions encore ouvertes avant implémentation

1. Quelle forme finale remplace/adapte `AnalysisScope.global.observationWindow` pour respecter les supports indépendants ?
2. Le `GlobalSupportEnvelope` étend-il `Support/Coverage` ou devient-il un contrat supérieur composé ?
3. Comment History HC3 persistera-t-il le dependency manifest et quelle partie Global peut-elle partager ?
4. Quelle autorité finale HC2 porte Necessity/Behavior/LifeScope ?
5. Quelle relation rend le coût Moment réellement causal ?
6. Quels champs Place deviennent autoritaires après HC2 ?
7. PurchaseEventFact est-il alimenté depuis les tables V2, un backfill contrôlé ou une autre source finale ?
8. Quel engine devient l’autorité Trend/Stability ?
9. Quel contrat protège l’anti-lookahead de M3 ?
10. Comment versionner Relationship definitions + multiplicity family ?
11. Les outputs M6/M7/M8 enrichissent-ils M3/M5 via recertification de phase sans cycle ?
12. Quel contrat explicite la distinction core M2 vs enrichment M8 ?
13. Quel niveau d’identité MerchantEstablishment existe réellement ?
14. Quel niveau d’attribution personnelle suffit à M9 headline ?
15. Comment SharedParticipation traite-t-il les external participants unresolved sans bloquer M10 core ?
16. Quels AG deviennent réellement disponibles après History ?
17. Quelle stratégie de publication Global réutilise ou adapte `analytics_publications` ?
18. Quelles dépendances devront être enregistrées dès A–G pour rendre le Refresh Planner final possible ?
19. Comment Media refs seront-elles ajoutées en H sans devenir dependency Analytics ?
20. Quels FactIds/ContextIds doivent être exposés pour le Résumé contextuel sans exporter de données brutes inutiles ?

---

# 17. Conclusion

Le pré-audit confirme qu’il existe déjà une **base Analytics générale plus riche qu’un simple History UI** : Facts partagés, Metric Registry, ProducedMetric, support/coverage, agrégations, comparaisons, materialization et invalidation. Cette base doit être protégée et réutilisée lorsqu’elle respecte réellement le Master.

En parallèle, le vrai Analyse Globale reste un chantier conséquent : les moteurs qui transforment une collection de métriques fiables en **tendances, transformations, habitudes, relations robustes, comparaisons de Moments, géographie évolutive, consommation structurée, Persona et “Nous deux”** ne sont pas encore démontrés comme moteurs V2 finaux.

Le plan d’implémentation doit donc éviter deux erreurs symétriques :

```text
Erreur A
Tout reconstruire alors que des autorités partagées existent déjà.

Erreur B
Réutiliser le legacy Global simplement parce que des fichiers portent déjà le mot “global”.
```

La bonne stratégie reste :

```text
History Core final
→ GA0 reality check
→ dependency matrix physique
→ REUSE/ADAPT/NEW prouvé
→ A Foundations
→ B–G engines
→ H ReadModels/Query/UX
→ certification déterministe
→ extensions futures selon roadmap
```

Les 31 `AUTHORITY_GATED` restent volontairement non résolus. Les observations live de ce document serviront de point de comparaison à GA0, mais aucune table vide, aucun nom absent et aucune donnée faible ne vaut aujourd’hui une décision finale.

```text
GLOBAL DEPENDENCY MODEL
READY_FOR_REBASE
```
