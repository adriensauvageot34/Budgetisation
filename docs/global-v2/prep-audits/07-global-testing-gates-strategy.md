# Analyse Globale V2 — stratégie préparatoire de tests, certifications, gates et développement

> **Nature du document** : audit préparatoire / stratégie de validation.
>
> **AUCUN CODE PRODUIT. Aucune migration. Aucune implémentation Analytics. Aucun changement Query/React. Aucune écriture Supabase.**
>
> **Seul ce document d’audit est ajouté au repository.**
>
> **Baseline repository distante observée** : branche `main`, commit `3a73cdb5bbb036bc5edeaf0e7882734af77ecd78` (`docs(global-v2): audit future integration compatibility`).
>
> **État History pris en compte** : HC1 communiqué `PASS`; HC2 → HC6 non fermés. La chaîne Global ne peut démarrer qu’après `POST_HISTORY_ENTRY_GATE = PASS`, puis un `GA0` de rebase CIBLE ↔ EXISTANT.
>
> **Autorité normative** : Master Analyse Globale V2 FINAL VERROUILLÉ + registres `GLOBAL_REQUIREMENTS_MATRIX`, `GLOBAL_CAPABILITY_SCOPE_REGISTRY`, `GLOBAL_AUTHORITY_GATED_REGISTRY`, `GLOBAL_TEST_CATALOG`, plan conceptuel A→I, audits préparatoires Global 01→06. Les noms de tests physiques proposés ici sont des noms de travail et ne remplacent jamais les IDs/noms normatifs du Test Catalog lorsqu’ils existent.

---

# 0. Verdict exécutif

La future Analyse Globale V2 ne doit **jamais** être implémentée comme un seul chantier Codex monolithique.

La stratégie recommandée est :

```text
POST_HISTORY_ENTRY_GATE = PASS
↓
GA0 — rebase physique / authority decisions / dependency matrix finale
↓
A — Foundations
  audit physique
  → contracts/foundations
  → tests + certification
  → handoff/gate
↓
B — Finance M1/M2
  audit physique
  → engines/metrics
  → reconciliation/certification
  → handoff/gate
↓
C — Temporal/Life M3/M4
↓
D — Relations M5
↓
E — Moments/Geo M6/M7
↓
F — Consumption M8
↓
G — People/Social M9/M10
↓
H — Query/ReadModels/UX/publication runtime
↓
GLOBAL_DETERMINISTIC_CORE = PASS
```

Chaque phase doit avoir un **ENTRY_GATE explicite**, des tests ciblés, un **REGRESSION_SET** réexécuté, un **EXIT_GATE** et des **HARD_STOPS**. Un rapport de phase `PASS / PARTIAL / BLOCKED` doit être produit avant d’autoriser le prompt suivant.

Le principe de validation de tête est :

```text
un test unitaire qui passe
≠ une métrique certifiée

une métrique certifiée
≠ un module certifié

un module certifié
≠ une publication cohérente

une publication cohérente
≠ GLOBAL_DETERMINISTIC_CORE = PASS
```

La validation doit donc couvrir cinq niveaux :

```text
L1 — primitive / unit
L2 — analytics / invariant
L3 — module / reconciliation / contract
L4 — materialization / publication / Query runtime
L5 — cross-module / end-to-end / deterministic core gate
```

L’état courant du repo possède déjà plusieurs scripts de contrôle utiles (`check:architecture`, `check:analytics-materialization`, History V2, Query/runtime, typecheck, build) et un `check:analysis-global-contracts`. Mais ce dernier certifie l’ancienne pile `analysis_global_*` à 7 ressources et la route legacy ; il **ne doit pas être confondu avec la future certification Global V2 M1→M10**. La future suite devra donc coexister temporairement puis remplacer/retirer explicitement les tests legacy selon le plan de cutover.

Verdict de préparation :

```text
GLOBAL TESTING / GATES STRATEGY
READY_FOR_IMPLEMENTATION_MAP
```

---

# 1. Principes de validation non négociables

## 1.1 Le test ne devient jamais l’autorité métier

Un test peut prouver qu’une implémentation respecte :

- le Master ;
- une autorité Canonical ;
- une doctrine Facts/Analytics ;
- un invariant financier/statistique ;
- un contrat de publication ;
- un comportement Query/React.

Il ne peut pas créer la valeur attendue en copiant un oracle non autoritaire ou en codant une constante uniquement pour obtenir `PASS`.

Invariant :

```text
source métier
→ implementation
↔ test indépendant
```

Jamais :

```text
expected fixture
→ implementation métier
```

## 1.2 Les fixtures doivent être synthétiques et minimales

Par défaut :

- fixtures synthétiques ;
- aucun export bancaire personnel réel ;
- aucun GPS brut personnel dans les tests ;
- cas minimaux qui isolent une doctrine ;
- seeds fixes lorsqu’un algorithme utilise un tirage contrôlé ;
- snapshots de test utilisés seulement pour contrat/projection, jamais comme oracle métier.

## 1.3 Déterminisme obligatoire

À inputs, versions, policies et seed identiques :

```text
Facts identiques
→ Analytics identiques
→ selected insights identiques
→ hashes identiques
→ ReadModels identiques
```

Les tests doivent détecter :

- dépendance à l’ordre de lecture DB ;
- timestamp courant injecté dans un digest métier ;
- random non seedé ;
- tri non stable ;
- locale/timezone implicite ;
- floating math non maîtrisée lorsque Money/Big est requis ;
- données React utilisées dans une décision métier.

## 1.4 Pas de look-ahead

Toute analyse as-of doit être certifiable en reconstruisant le résultat avec **uniquement les données observables à cette date**.

Ce principe est critique pour :

- Trend ;
- Stability ;
- ChangePoint ;
- current regime ;
- Relationship ;
- Persona ;
- routines ;
- lifecycle ;
- selected insights.

## 1.5 Knowledge state ≠ test result

Données :

```text
KNOWN
PARTIAL
UNKNOWN
NOT_APPLICABLE
CONFLICT
```

Validation :

```text
PASS
FAIL
BLOCKED
SKIPPED_BY_CONTRACT
```

Un output `UNKNOWN` peut parfaitement être **PASS** si le système était censé refuser de conclure.

## 1.6 Capability gate ≠ support gate

Les tests doivent distinguer :

```text
capability disponible ?
```

et :

```text
capability disponible mais support insuffisant sur ce corpus ?
```

Une capability `AUTHORITY_GATED` déclarée `PREREQUISITE_UNAVAILABLE` par GA0 ne doit pas faire échouer Global si le contrat exige de la masquer/rendre `NOT_APPLICABLE/UNKNOWN` correctement.

## 1.7 Evidence refs obligatoires pour les gates

Un gate ne doit pas produire seulement :

```text
PASS
```

mais au minimum enregistrer :

- test/gate name ;
- input fixture/corpus identity ;
- method/policy versions ;
- relevant hashes ;
- expected invariant ;
- observed result ;
- evidence refs ;
- commit ;
- status.

## 1.8 No silent fallback

Si une autorité manque :

```text
UNKNOWN / PARTIAL / AUTHORITY_GATED
```

et jamais :

```text
heuristic fallback
→ valeur certaine
```

---

# 2. Pyramide de tests Global

## L1 — Unit / pure primitives

But : vérifier fonctions pures et invariants locaux.

Exemples :

- support policy ;
- coverage composition ;
- knowledge-state propagation ;
- materiality classifier ;
- robust statistic helper ;
- window selection ;
- normalization ;
- relationship candidate key ;
- deterministic sort ;
- participation evidence reducer.

## L2 — Analytics engines

But : vérifier le moteur au grain naturel.

Exemples :

- Typical ;
- Trend ;
- ChangePoint ;
- Routine ;
- Relationship ;
- Moment comparison ;
- Place importance ;
- Purchase frequency/ticket ;
- PersonaDifference ;
- SharedParticipation.

## L3 — Module contracts / reconciliations

But : vérifier qu’un module M1→M10 :

- consomme les bonnes autorités ;
- réconcilie les montants/parts ;
- expose support/coverage/provenance ;
- ne transforme pas UNKNOWN ;
- respecte capability scope ;
- sélectionne uniquement des insights éligibles.

## L4 — Materialization / publication / Query

But : vérifier :

- artifacts ;
- resource hashes ;
- RuntimeSchemas ;
- manifest ;
- publication cohérente ;
- single-active ;
- rollback ;
- stale invalidation ;
- Query snapshot-only ;
- no read-through ;
- cache generation awareness.

## L5 — End-to-end Global

But : prouver :

```text
correction / nouvelle donnée
→ invalidation correcte
→ rebuild des dépendances prouvées
→ nouvelle publication Global
→ ancienne publication conservée
→ Query sert la nouvelle génération
→ React ne recalcule rien
```

---

# 3. Suite de contrôle existante — ce qui est réutilisable et ce qui ne l’est pas

Le `package.json` courant expose notamment :

```text
check:architecture
check:product-completeness
check:analysis-month-contracts
check:analysis-global-contracts
check:canonical-in-batching
check:analytics-materialization
check:exploration-entities
check:live-runtime-regressions
check:history-v2-*
typecheck
build
verify
```

## 3.1 `check:analysis-global-contracts` actuel

Ce script valide aujourd’hui les ressources :

```text
analysis_global_initial
analysis_global_baseline
analysis_global_typical
analysis_global_evolution
analysis_global_habits
analysis_global_profiles
analysis_global_universe
```

et l’ancienne route :

```text
/historique/analyse/global
```

Il vérifie déjà quelques principes sains, par exemple :

- pas d’import `@/server`/`@/analytics` dans React Global ;
- pas de `.reduce()`/`groupBy()` dans le composant principal ;
- chargement initial limité ;
- destinations typées ;
- certains contrats de navigation.

Mais il reste **legacy product-specific**.

Classification :

```text
USEFUL_REGRESSION_PRIMITIVE
NOT_GLOBAL_V2_CERTIFICATION
```

Pendant la migration, les futurs prompts doivent décider explicitement :

```text
KEEP_TEMPORARILY
ADAPT
REPLACE
RETIRE
```

et ne jamais simplement faire passer le nouveau Global V2 en modifiant ce script legacy pour matcher un produit différent.

## 3.2 `verify`

`verify` est utile comme régression générale, mais ne suffit pas comme certification Global exhaustive.

La future stratégie devra prévoir :

```text
npm run verify
+
Global V2 phase-specific checks
+
Global deterministic certification
```

Le gate final ne doit pas supposer qu’un script omnibus contient automatiquement tous les contrôles exhaustifs.

---

# 4. Convention de statuts pour chaque phase

Chaque phase A→H doit terminer par exactement :

```text
GLOBAL PHASE <X>
PASS
```

ou :

```text
GLOBAL PHASE <X>
PARTIAL
```

ou :

```text
GLOBAL PHASE <X>
BLOCKED
```

## PASS

- toutes les exigences du scope de phase sont satisfaites ;
- aucun hard stop ouvert ;
- tests requis PASS ;
- regression set PASS ;
- findings restants sont explicitement `LATER/CAN_WAIT` sans impact sur phase suivante ;
- handoff écrit.

## PARTIAL

- implémentation substantielle correcte ;
- mais un gate requis avant phase suivante manque encore ;
- **interdit de poursuivre automatiquement**.

## BLOCKED

- autorité, doctrine, réconciliation ou sûreté manquante ;
- phase suivante interdite.

---

# 5. Hard stops globaux

## `AUTHORITY_GATED`

Déclenchement : une capability nécessite une autorité que GA0 n’a pas déclarée disponible.

Action :

- ne pas inventer ;
- marquer capability selon registre ;
- poursuivre uniquement si la capability est conditionnelle et son absence n’empêche pas le core ;
- bloquer si elle est nécessaire à un `MUST_V1` non conditionnel.

## `CONTRACT_CONFLICT`

Déclenchement : Master, Facts, Supabase ou contrat History final sont incompatibles.

Action : stop, documenter les deux autorités et demander décision humaine si aucune hiérarchie déjà explicite ne résout le conflit.

## `MISSING_CANONICAL`

Une donnée requise par un MUST n’a aucune autorité Canonical.

Action : stop cette capability ; ne pas créer un proxy Analytics silencieux.

## `MISSING_FACT`

Canonical existe mais aucun Fact contractuel fiable ne porte la sémantique requise.

Action : phase peut proposer `NEW_FACT` uniquement si GA0/authority map l’autorise ; sinon stop.

## `HISTORY_SEMANTIC_CONFLICT`

Une sémantique partagée (Actual, Typical, Minimal, Moment causal, Place, classification, Activity) diverge entre History final et Global.

Action : stop. Global n’a pas le droit de créer une deuxième vérité.

## `NON_DETERMINISM`

Même input/version → outputs différents.

Action : stop publication et phase suivante.

## `RECONCILIATION_FAILURE`

Sommes/parts/modules ne réconcilient pas une autorité de référence lorsque le contrat exige l’égalité.

Action : stop ; pas de « tolérance UI ».

## `PUBLICATION_UNSAFE`

Staging, manifest, RuntimeSchema, single-active, rollback ou immutabilité non prouvés.

Action : aucune activation Global.

## `UNKNOWN_REQUIREMENT`

Une exigence Master reste suffisamment ambiguë pour changer la doctrine ou l’UX structurante.

Action : documenter et résoudre avant implémentation concernée.

## Hard stops additionnels recommandés

### `LIVE_TAIL_AUTHORITY_LEAK`

LIVE_TAIL modifie une conclusion structurelle interdite.

### `CLIENT_ANALYTICS_LEAK`

React calcule/choisit une conclusion métier.

### `DEPENDENCY_CLOSURE_GAP`

Un output peut changer sans changement de sa dependency/hash closure.

### `CAPABILITY_SCOPE_VIOLATION`

Capability conditionnelle publiée alors que prerequisite est absent.

### `CAUSALITY_OVERCLAIM`

Association/contextualité présentée comme causalité.

### `PERSON_ATTRIBUTION_OVERCLAIM`

payer/account owner/wallet owner transformé en beneficiary/person subject sans preuve.

---

# 6. Phase A — Foundations

## 6.1 Objectif

Stabiliser les primitives communes dont toutes les autres phases dépendent :

- support ;
- coverage ;
- provenance ;
- knowledge states ;
- partial reasons ;
- natural grains ;
- scope/popu­lation/time-used ;
- Materiality foundations ;
- method/policy/version identity ;
- revision lineage ;
- capability states ;
- publication/dependency contracts ;
- deterministic identity/hash rules.

## 6.2 ENTRY_GATE

Exiger :

```text
POST_HISTORY_ENTRY_GATE = PASS
GA0 = PASS
GLOBAL_ANALYTICS_DEPENDENCY_MATRIX final/provisionally physicalized
AUTHORITY_GATED registry re-evaluated
History shared doctrines revalidated
no unresolved HISTORY_SEMANTIC_CONFLICT
```

## 6.3 Prompt groups recommandés

```text
A0 — physical phase audit / gap matrix
A1 — support / coverage / provenance / states / scope contracts
A2 — dependency / revision / method / capability foundations
A3 — foundation unit + contract certification
A4 — handoff / Phase A gate
```

Granularité : **4–5 prompts**.

Ne pas mélanger la création de toutes les foundations et le début de M1 dans le même prompt.

## 6.4 UNIT_TESTS

Minimum conceptuel :

- KNOWN 0 reste KNOWN 0 ;
- UNKNOWN reste UNKNOWN ;
- PARTIAL conserve reason ;
- coverage composition déterministe ;
- effective coverage n’exagère jamais une dimension manquante ;
- support counts/reasons stables ;
- natural grain identity stable ;
- population intersection déterministe ;
- scope hash stable ;
- method/policy version participe aux identités prévues ;
- stable sorting ;
- no current-time digest leakage.

## 6.5 ANALYTICS_INVARIANTS

- aucun output ne peut être `KNOWN` sans source/provenance suffisante ;
- support insuffisant n’est pas converti en zéro ;
- coverage partielle n’est pas convertie en complète ;
- subject household ne supprime pas provenance person ;
- current regime et certified history restent distincts ;
- LIVE_TAIL ne devient pas Certified History.

## 6.6 RECONCILIATIONS

Phase A ne réconcilie pas encore M1, mais doit prouver :

- mêmes Facts → même scope/coverage/support ;
- mêmes dependencies → même digest ;
- dependency significative modifiée → digest concerné modifié ;
- changement présentation-only → aucun facts/analytics digest métier.

## 6.7 CONTRACT_TESTS

- Runtime/domain schemas stricts ;
- capability state ≠ knowledge state ;
- support/coverage présents aux endroits contractuellement requis ;
- methodVersion obligatoire ;
- evidenceRefs typés ;
- absence de scope Global universel imposé par la foundation.

## 6.8 SNAPSHOT_TESTS

Préparer seulement les primitives nécessaires aux futurs outputs :

- serialization déterministe ;
- schema validation ;
- no binary/media payload ;
- publication lineage transportable.

Aucun vrai Module RM n’est requis en A.

## 6.9 PUBLICATION_TESTS

Au niveau contractuel :

- Global scope/generation identity possible ;
- dependency manifest peut représenter les futures familles ;
- no silent mutation design ;
- old generation traceable ;
- no History publication collision.

## 6.10 PERFORMANCE_CHECKS

Pas d’optimisation chiffrée prématurée.

Mesurer seulement :

- coût de hashing/dependency closure sur fixtures ;
- taille metadata support/coverage/provenance ;
- absence d’explosion combinatoire de scopes.

## 6.11 REGRESSION_SET

Toujours :

```text
architecture
canonical contracts
analytics materialization foundations
History shared contract tests touchés
History HC1→HC6 relevant checks
query/runtime shared tests
typecheck
```

## 6.12 EXIT_GATE

```text
GLOBAL PHASE A = PASS
```

si :

- toutes foundations partagées ont une seule autorité ;
- dependencies déclarables ;
- support/coverage/provenance/states certifiés ;
- aucun hard stop ;
- B peut consommer ces primitives sans créer sa propre variante.

---

# 7. Phase B — Finance M1 / M2

## 7.1 Objectif

Construire/certifier :

- Actual économique ;
- Typical ;
- Minimal ;
- structures M1 ;
- évolution/stabilité/récurrences du scope B prévu ;
- Category/Subcategory/Need M2 ;
- materiality/contributors ;
- drilldown analytics-ready.

## 7.2 ENTRY_GATE

```text
Phase A PASS
EconomicComponentFact authority confirmed
HC1 authority chain retained
M3 classifications shared authority known when consumed
no oracle product source
```

## 7.3 Prompt groups

```text
B0 — finance physical audit / REUSE-ADAPT-NEW matrix
B1 — M1 core engines/metrics
B2 — M2 category/Need engines
B3 — Trend/Stability/recurrence/contributors required by B
B4 — finance reconciliation + certification
B5 — finance handoff/gate
```

Granularité : **5–6 prompts**.

M1 et M2 peuvent avoir certaines implémentations parallèles après B0, mais leur certification doit se rejoindre avant sortie de B.

## 7.4 UNIT_TESTS

- Money exactness ;
- refund/net handling selon Facts ;
- Typical non additive ;
- Minimal non additive ;
- median/robust reference helpers ;
- category aggregation ;
- Need classification propagation ;
- materiality deterministic ;
- recurrence detection ;
- contributor decomposition ;
- signed deltas.

## 7.5 ANALYTICS_INVARIANTS

### Actual

```text
Actual = authoritative economic consumption
```

et jamais bank outflow.

### Typical

- uniquement mois/corpus éligibles ;
- pas de mois incomplet comme référence certifiée ;
- pas d’agrégation de Typical mensuels si moteur brut requis.

### Minimal

- référence, jamais target ;
- support explicite ;
- obligations/provisions selon authority.

### Categories / Needs

- total known classified + unknown/partial buckets réconcilie l’Actual selon contrat ;
- UNKNOWN classification n’est jamais inventée ;
- coverage Need ne peut excéder les composants réellement classifiés.

### Trend/Stability

- no look-ahead ;
- LIVE_TAIL ne crée pas une nouvelle tendance structurelle ;
- support minimum respecté ;
- résultats versionnés.

## 7.6 RECONCILIATIONS

Minimum :

```text
M1 Actual ↔ official economic Facts
Category sums ↔ Actual selon coverage contract
Need sums ↔ classified subset
fixed/variable ↔ classified subset\LifeScope ↔ classified subset
contributors ↔ observed delta
recurrent + non-recurrent components ↔ relevant base when contract says exhaustive
```

## 7.7 CONTRACT_TESTS

- module outputs portent support/coverage/provenance ;
- no bank-centric naming ;
- no oracle dependency ;
- stable IDs ;
- Capability-gated slots explicit ;
- funding provider absent du core Finance contract.

## 7.8 SNAPSHOT_TESTS

À ce stade, si B ne materialise pas encore le final H :

- artifact serialization ;
- deterministic module handoff payload ;
- no UI-only labels as source authority.

Si des provisional RMs existent : schemas stricts.

## 7.9 PUBLICATION_TESTS

Pas de publication produit finale requise avant H, mais artifacts B doivent :

- avoir dependency closure ;
- être attachables à une Global generation ;
- ne pas muter silencieusement si staged/published dans des tests d’intégration.

## 7.10 PERFORMANCE_CHECKS

Mesurer :

- séries financières multi-mois ;
- contributor decomposition ;
- no N+1 per category ;
- no repeated loading du même Facts corpus.

Pas encore de budget absolu sans baseline.

## 7.11 REGRESSION_SET

```text
A_FULL
History Actual/Typical/Minimal/category reconciliations
shared Facts tests
analytics materialization
legacy Global untouched unless intentionally cut over
typecheck
```

## 7.12 EXIT_GATE

```text
GLOBAL PHASE B = PASS
```

si M1/M2 core + Musts de phase passent, avec réconciliations et sans double autorité.

---

# 8. Phase C — Temporal / Life M3 / M4

## 8.1 Objectif

Certifier :

- ChangePoint ;
- transformations ;
- before/after robust windows ;
- persistence ;
- current regime ;
- routines ;
- cadence ;
- fréquence normalisée ;
- temporal/life patterns.

## 8.2 ENTRY_GATE

```text
A PASS
B PASS
History HC2 shared doctrines confirmed
PersonDay / Activity / Place observability contracts known
no unresolved natural-grain conflict
```

## 8.3 Prompt groups

```text
C0 — temporal/life physical audit
C1 — ChangePoint + transformation engine
C2 — routine/cadence/rate engines
C3 — multi-domain fusion/current regime
C4 — anti-lookahead + persistence certification
C5 — handoff/gate
```

Granularité : **5–6 prompts**.

## 8.4 UNIT_TESTS

- before/after windows ;
- gap handling ;
- persistence counters ;
- rate normalization ;
- observation denominator ;
- routine score ;
- current regime resolver ;
- transformation class mapping ;
- temporal anchor ordering ;
- no future observation inclusion.

## 8.5 ANALYTICS_INVARIANTS

### ChangePoint

- une variation isolée ne suffit pas ;
- support avant/après requis ;
- persistence gate ;
- absence de future leak ;
- change point ne devient pas causalité.

### Routines

- occurrence count ≠ frequency rate ;
- personne/jour non observable n’entre pas au dénominateur ;
- zero observed dans corpus observable ≠ UNKNOWN ;
- saisonnalité uniquement si support contractuel.

### Current regime

- ne lit pas après `asOf` ;
- reclassification d’un ancien changement selon données disponibles est versionnée ;
- LIVE_TAIL peut décrire, pas réécrire silencieusement certified regime.

## 8.6 RECONCILIATIONS

- transformation source metrics ↔ B official outputs ;
- before/after values reproductibles depuis corpus déclaré ;
- normalized rates ↔ eligible/observable denominators ;
- multi-domain transformation ↔ uniquement signals éligibles.

## 8.7 CONTRACT_TESTS

- chaque transformation porte fenêtres/support/evidence ;
- routine porte denominator et support ;
- current regime identity/version ;
- no universal window ;
- no label-token inference.

## 8.8 SNAPSHOT_TESTS

- transformation/routine artifacts deterministic ;
- no expanded UI computation hidden in payload builder ;
- unknown reasons preserved.

## 8.9 PUBLICATION_TESTS

- correction d’un mois dans lookback marque affected C outputs ;
- changement hors lookback ne modifie pas l’output ;
- dependency sensitivity tests.

## 8.10 PERFORMANCE_CHECKS

Hotspots :

- repeated rolling windows ;
- multi-domain scan ;
- routine computation per entity/person ;
- avoid per-day N+1.

## 8.11 REGRESSION_SET

```text
A_FULL
B_FINANCE_FULL
History shared M3/Activity/Place tests
no-live-tail-authority tests
typecheck
```

## 8.12 EXIT_GATE

```text
GLOBAL PHASE C = PASS
```

si anti-lookahead, support/persistence, normalized observations et current regime sont certifiés.

---

# 9. Phase D — Relations M5

## 9.1 Objectif

Construire un RelationshipEngine robuste, limité au catalogue autorisé, sans causalisation abusive.

## 9.2 ENTRY_GATE

```text
A PASS
B PASS
C PASS
source metrics stable
natural populations defined
relationship catalog available
```

E/F peuvent enrichir plus tard certaines familles de relations, mais le core D doit être certifié avant de les consommer.

## 9.3 Prompt groups

```text
D0 — relationship physical audit/catalog
D1 — candidate/matching/population engine
D2 — statistics/uncertainty/multiplicity/robustness
D3 — temporal status + insight eligibility
D4 — certification/adversarial tests
D5 — handoff/gate
```

Granularité : **5–6 prompts**.

## 9.4 UNIT_TESTS

- relation key canonicalization ;
- paired population intersection ;
- matching/stratification helper ;
- effect statistic ;
- uncertainty ;
- FDR/multiplicity ;
- robustness checks ;
- temporal lag/ordering when allowed ;
- candidate deduplication ;
- deterministic ranking.

## 9.5 ANALYTICS_INVARIANTS

- relation hors catalogue → impossible à publier ;
- association ≠ causalité ;
- population comparable obligatoire ;
- missing dimension excluded/partial according contract ;
- multiple testing controlled ;
- robustness threshold before insight ;
- no p-hacking by trying arbitrary windows until significance ;
- materiality + support + statistical eligibility jointly required when Master says so.

## 9.6 RECONCILIATIONS

Relations ne doivent pas « réconcilier » financièrement un total, mais doivent prouver :

- n paired observations correspond à declared population ;
- excludedN/eligibleN corrects ;
- effect can be recomputed independently from evidence fixture ;
- insight references same source metric versions.

## 9.7 CONTRACT_TESTS

Chaque relation publiée doit porter au minimum selon contrat :

- relation family/type ;
- subjects ;
- population/window ;
- support ;
- coverage ;
- effect ;
- uncertainty/robustness ;
- provenance ;
- methodVersion ;
- evidenceRefs ;
- wording class qui n’implique pas causalité.

## 9.8 SNAPSHOT_TESTS

- Relation RM ne contient que relations éligibles ;
- tri sélectionné serveur ;
- no React ranking ;
- details lazy possible sans giant payload.

## 9.9 PUBLICATION_TESTS

- relation artifact dependency closure inclut toutes source metrics ;
- correction source invalidates affected relationship family ;
- unrelated correction no-op prouvable.

## 9.10 PERFORMANCE_CHECKS

Hotspot majeur : combinatoire/N².

Mesurer :

- candidate count avant/après catalog gating ;
- paired observations ;
- runtime par relation family ;
- memory ;
- no cartesian expansion non bornée.

## 9.11 REGRESSION_SET

```text
A_FULL
B_FINANCE_FULL
C_TEMPORAL_FULL
causality shared doctrine tests
```

## 9.12 EXIT_GATE

```text
GLOBAL PHASE D = PASS
```

si aucun relation insight non catalogué/non robuste/causalisé n’est publiable.

---

# 10. Phase E — Moments / Geography M6 / M7

## 10.1 Objectif

Certifier séparément :

```text
E6 — Moments & expériences
E7 — Places & mobility
```

Ils partagent Phase E mais ne doivent pas être forcés dans un seul moteur.

## 10.2 ENTRY_GATE

```text
A-D PASS
HC2 Moment causal authority PASS
HC2 Place doctrine PASS
participant evidence contract known
geo authority map known
```

## 10.3 Prompt groups

```text
E0 — physical audit Moments/Geo
E1 — M6 Moment family/comparability engine
E2 — M6 causal/economic comparison certification
E3 — M7 Place importance/lifecycle engine
E4 — M7 localized finance/mobility conditional gates
E5 — cross M6/M7 + D recertification
E6 — handoff/gate
```

Granularité : **6–7 prompts**.

## 10.4 UNIT_TESTS M6

- Moment family/type/series identity ;
- comparability tier ;
- causal role aggregation ;
- refund/adjustment composition ;
- cost/day ;
- peer robust stats ;
- repetition ;
- narrative importance independent of cost.

## 10.5 ANALYTICS_INVARIANTS M6

```text
spentDuring ≠ causalCost
```

- temporal proximity seule ne crée pas causalité ;
- comparable label ≠ comparable series ;
- causal gross/refund/net reconcile ;
- low-cost important Moment remains possible ;
- participant unknown does not become shared.

## 10.6 RECONCILIATIONS M6

- causal components ↔ causal links evidence ;
- gross - refunds/adjustments ↔ net per contract ;
- spentDuring independently derived from temporal window ;
- difference causalCost/spentDuring explicitly testable.

## 10.7 UNIT_TESTS M7

- visit counts/days/duration ;
- nested place resolution ;
- STOP/STAY semantics ;
- importance score inputs ;
- routine penalty ;
- lifecycle state ;
- localized coverage ;
- route/fuel only when authority available.

## 10.8 ANALYTICS_INVARIANTS M7

```text
GPS point ≠ PlaceVisit
PlaceVisit ≠ transaction place
transaction place ≠ person presence
```

- coverage=1 jamais par simple présence d’un montant ;
- place label ne crée pas routine ;
- missing mobility authority → capability gated ;
- no distance/fuel cost invention.

## 10.9 RECONCILIATIONS M7

- visit metrics ↔ PlaceVisitFacts ;
- localized finance ↔ only components with valid location authority ;
- coverage numerator/denominator explicit ;
- lifecycle state ↔ observed historical visits.

## 10.10 CONTRACT_TESTS

M6/M7 outputs :

- support/coverage/provenance ;
- stable entity IDs ;
- media optional only ;
- evidence refs ;
- no presentation/media dependency ;
- capability gated mobility explicit.

## 10.11 SNAPSHOT_TESTS

- Moment/Place detail RMs contain server-selected values ;
- entity details lazy ;
- no blob/media binary ;
- no fallback as analytic data.

## 10.12 PUBLICATION_TESTS

- entity-scoped corrections invalidate relevant M6/M7 + D dependencies ;
- M6/M7 artifacts immutable once published ;
- optional mobility absent does not block core publication.

## 10.13 PERFORMANCE_CHECKS

- place hierarchy joins ;
- visit aggregation ;
- Moment peer comparisons ;
- no one-query-per-entity ;
- route/mobility gated before heavy processing.

## 10.14 REGRESSION_SET

```text
A-D FULL
History Moment/Activity/Place shared tests
D RELATION recertification for newly enabled source families
```

## 10.15 EXIT_GATE

```text
GLOBAL PHASE E = PASS
```

si M6/M7 core sont certifiés et toutes capabilities mobility/geo optionnelles ont un état explicite.

---

# 11. Phase F — Consumption M8

## 11.1 Objectif

Certifier le cœur Purchase/Merchant et les extensions produit uniquement si authorities disponibles.

## 11.2 ENTRY_GATE

```text
A-E PASS
PurchaseEvent authority confirmed
refund/adjustment semantics confirmed
merchant identity confirmed
Benefit Wallet compatibility rules loaded
product capabilities authority state explicit
```

## 11.3 Prompt groups

```text
F0 — Purchase/Merchant authority audit
F1 — PurchaseEvent core + refunds/splits semantics
F2 — frequency/ticket/merchant evolution engines
F3 — product/cycle conditional branch if authority available
F4 — Benefit Wallet compatibility certification (NO Swile implementation)
F5 — M8 certification/handoff
```

Granularité : **5–6 prompts**.

## 11.4 UNIT_TESTS

- PurchaseEvent identity ;
- source dedup ;
- split payment ;
- refund/adjustment ;
- mixed/cash semantics ;
- merchant vs processor ;
- frequency ;
- mean/median ticket ;
- frequency×ticket decomposition ;
- purchase lifecycle if authority ;
- substitution if authority.

## 11.5 ANALYTICS_INVARIANTS

```text
1 human acquisition = 1 PurchaseEvent
purchase ≠ funding ≠ bank transaction
provider ≠ merchant
economic consumption ≠ wallet funding ≠ bank flow
```

- refund ≠ negative new purchase ;
- unresolved mixed purchase becomes PARTIAL/MISSING_LINKAGE as contract requires ;
- no ProductLine analytics without authority ;
- no beneficiary from card/wallet ownership.

## 11.6 RECONCILIATIONS

- retained purchase count ↔ distinct authoritative PurchaseEvents ;
- ticket stats ↔ retained purchases ;
- frequency×ticket decomposition ↔ actual merchant/category change within declared method ;
- economic amount ↔ PurchaseEvent gross/net semantics ;
- funding components, when future fixture supplied, sum to gross but do not add consumption.

## 11.7 CONTRACT_TESTS

- M8 core contains no `if provider === SWILE` requirement ;
- merchant real identity separate processor/provider ;
- PurchaseLine/Product slots capability-gated ;
- person roles explicit/unknown ;
- support/coverage at PurchaseEvent grain.

## 11.8 SNAPSHOT_TESTS

- Merchant/Purchase detail resource bounded ;
- no raw bank line duplication ;
- no provider-specific parallel ReadModel family ;
- lazy details.

## 11.9 PUBLICATION_TESTS

- purchase correction invalidates M8 and declared downstream dependencies ;
- funding-only future mutation can be classified separately when it does/does not affect economic Facts ;
- product capabilities absent do not invalidate core M8 publication.

## 11.10 PERFORMANCE_CHECKS

- merchant aggregation ;
- PurchaseEvent dedup ;
- product joins only if enabled ;
- no per-purchase N+1 ;
- bounded detail pagination if corpus large.

## 11.11 REGRESSION_SET

```text
A-E FULL
B Finance economic reconciliations
D Relations families consuming Purchase data
Benefit Wallet compatibility invariant set
```

## 11.12 EXIT_GATE

```text
GLOBAL PHASE F = PASS
```

si M8 core est correct sans dépendre de Swile/Edenred et product gates sont explicites.

---

# 12. Phase G — People / Social M9 / M10

## 12.1 Objectif

Construire :

- PersonaDifferenceEngine M9 ;
- SharedParticipationResolver M10 ;
- social enrichments seulement selon authority.

## 12.2 ENTRY_GATE

```text
B-F stable
person attribution authority known
participant evidence contract known
current regime stable
common comparable support available
```

## 12.3 Prompt groups

```text
G0 — person/shared authority audit
G1 — person-scoped metric normalization/common support
G2 — M9 PersonaDifference + ranking/diversity/hysteresis
G3 — M10 SharedParticipation + shared metrics
G4 — social authority-gated enrichment if available
G5 — cross-person certification / anti-inference
G6 — handoff/gate
```

Granularité : **6–7 prompts**.

## 12.4 UNIT_TESTS M9

- common support intersection ;
- normalization ;
- comparable denominator ;
- Persona materiality ;
- exceptional exclusion ;
- deterministic ranking ;
- anti-redundancy ;
- diversity ;
- hysteresis ;
- card budget 4–6.

## 12.5 ANALYTICS_INVARIANTS M9

- comparer seulement common comparable support ;
- payer ≠ beneficiary ;
- bank account owner ≠ person attribution ;
- wallet owner ≠ beneficiary ;
- counts non comparables ne deviennent pas « trait de personnalité » ;
- wording non moral ;
- current regime respected ;
- no person-level result from household-only data.

## 12.6 UNIT_TESTS M10

- PRESENT/ABSENT/UNKNOWN/CONFLICT ;
- EXPLICIT_SHARED ;
- CANONICAL_SHARED ;
- STRONG_COPRESENCE ;
- inference catalog ;
- shared observable support ;
- normalized shared rates ;
- shared Activity/Place/Moment evidence.

## 12.7 ANALYTICS_INVARIANTS M10

- bank operation ≠ shared evidence ;
- co-presence at home/work ≠ shared activity automatically ;
- household amount ≠ 50/50 ;
- no fake Couple PersonId ;
- UNKNOWN participant ≠ shared ;
- pair-only vs with externals only if authority.

## 12.8 RECONCILIATIONS

M9 :

- per-person source metric ↔ official person-scoped outputs ;
- common support counts reproducible ;
- selected cards ↔ candidate ranking + diversity constraints.

M10 :

- shared numerator ↔ occurrences with accepted evidence ;
- denominator ↔ sharedObservableSupport ;
- shared cost never split arbitrarily.

## 12.9 CONTRACT_TESTS

- M9/M10 preserve provenance/evidence ;
- unresolved external contacts tolerated ;
- no social graph from frequency alone ;
- social capabilities conditionnelles explicitement gated.

## 12.10 SNAPSHOT_TESTS

- persona cards server-selected ;
- 4–6 budget enforced server-side ;
- M10 selected shared insights server-side ;
- no React moral/ranking logic ;
- person labels presentation-only.

## 12.11 PUBLICATION_TESTS

- correction person attribution invalidates M9/M10 relevant outputs ;
- activity/place/moment participant correction propagates ;
- household-only unrelated correction no-op when proven.

## 12.12 PERFORMANCE_CHECKS

- avoid recomputing B-F engines per person if person-scoped artifacts exist ;
- no person×module×filter explosion ;
- shared resolver bounded by candidate occurrences.

## 12.13 REGRESSION_SET

```text
A-F FULL
History Activity/Moment/Place participant semantics
D relations consuming person/shared signals
F Benefit Wallet person-role invariants
```

## 12.14 EXIT_GATE

```text
GLOBAL PHASE G = PASS
```

si Persona et Nous deux ne sur-infèrent ni personne ni partage.

---

# 13. Phase H — Query / ReadModels / UX / Global publication

## 13.1 Objectif

Transformer A→G certifiés en produit navigable snapshot-first :

```text
Global artifacts
→ Global publication
→ RuntimeSchemas
→ Primary RMs M1→M10
→ Detail/Relation/Entity RMs lazy
→ Query API
→ /analyse-globale
→ React presentation-only
```

## 13.2 ENTRY_GATE

```text
A-G PASS
all module analytics contracts frozen enough
Global publication profile decided
resource families decided
Media contract checkpoint complete
Contextual Summary handoff requirements known
Diagnostic observability requirements known
Refresh dependency export requirements known
```

## 13.3 Prompt groups

```text
H0 — physical RM/Query/publication design audit
H1 — Global publication profile + manifest/resource registry
H2 — Primary RMs M1→M10 + RuntimeSchemas
H3 — Detail/Relation/Entity RMs + Query adapters
H4 — /analyse-globale shell + React boundary
H5 — navigation/history links/accessibility/responsive foundations
H6 — snapshot/publication/cache/performance certification
H7 — deterministic core final gate
```

Granularité : **7–8 prompts**.

H peut être le plus découpé car il touche plusieurs frontières runtime ; ne pas fusionner publication, 10 RMs, React et certification dans un seul prompt.

## 13.4 UNIT_TESTS

- RM builders pure projection ;
- InsightSelectionEngine outputs only ;
- visibility states ;
- params validation ;
- resource key identity ;
- RuntimeSchema parse ;
- navigation destinations ;
- cache generation key ;
- formatting helpers.

## 13.5 ANALYTICS_INVARIANTS

H ne crée aucun nouveau calcul analytique.

Test bloquant :

```text
React-no-Analytics
```

Interdire dans React/Client :

- sum/mean/median business computation ;
- top N métier ;
- materiality ;
- Trend ;
- ChangePoint ;
- relation strength ;
- causal score ;
- Persona ranking ;
- SharedParticipation ;
- server visibility selection.

## 13.6 RECONCILIATIONS

Pour chaque Primary RM :

```text
RM values ↔ certified module artifacts
selected insight ↔ InsightSelectionEngine output
visibility ↔ GlobalPublicationEngine/capability state
quality metadata ↔ source metric envelopes
```

No divergence due to frontend projection.

## 13.7 CONTRACT_TESTS

### Page contract

- route canonique `/analyse-globale` ;
- Synthèse slot séparé ;
- M1→M10 order stable ;
- COMPACT default ;
- 0–1 main insight ;
- 0–3 KPIs compact ;
- Summary compact n’embarque pas secret expanded payload.

### Query contract

- snapshot-only/fail-closed ;
- RuntimeSchema obligatoire ;
- same publicationId across visible resources ;
- no dynamic Analytics adapter fallback ;
- typed params ;
- detail lazy ;
- no giant GET.

### Quality contract

- KNOWN/PARTIAL/UNKNOWN/N/A/CONFLICT rendered distinctly ;
- insufficient support ≠ zero ;
- coverage/provenance accessible ;
- methodology drilldown possible.

## 13.8 SNAPSHOT_TESTS

- every required Global resource materializes ;
- schema 100 % ;
- no duplicates active ;
- payload hashes stable ;
- content sizes measured ;
- detail resource missing → fail closed ;
- no hidden business calculation at read time.

## 13.9 PUBLICATION_TESTS

Minimum :

```text
stage inactive
→ validate completeness
→ validate RuntimeSchemas
→ certify module manifest
→ finalize atomically
→ exactly one active compatible Global generation
```

Tester :

- complete publication ;
- incomplete publication ;
- wrong revision ;
- retry/idempotence ;
- rollback ;
- old active while new build ;
- immutable published payload ;
- stale generation ;
- cache generation update ;
- no partial mixed generation served.

## 13.10 PERFORMANCE_CHECKS

Mesurer avant de fixer des seuils absolus :

- initial page payload ;
- total Primary RM payload ;
- largest detail payload ;
- Query count initial ;
- DB reads ;
- TTFB ;
- drilldown latency ;
- serialized JSON size ;
- duplicate-series ratio ;
- cache hit behavior ;
- no N+1.

### Hotspots à surveiller

- same series repeated M1/M2/M3 ;
- full entity lists inside compact RMs ;
- Persona duplication ;
- Relations N² ;
- Place lists ;
- all months × all entities precomputed unnecessarily.

## 13.11 Responsive / Accessibility checks

Sans pixel-perfect gate prématuré :

- mobile one-column possible ;
- keyboard navigation ;
- focus restored after drilldown ;
- `aria-expanded/controls` ;
- chart textual equivalent ;
- reduced motion ;
- no critical info hover-only ;
- no color-only state.

## 13.12 Future compatibility gates

### `MEDIA_CONTRACT_CHECKPOINT`

PASS si :

- optional refs possible ;
- no blobs ;
- media absent does not change analytics ;
- stable entity IDs.

### `CONTEXTUAL_SUMMARY_HANDOFF_GATE`

PASS si Global expose :

- selected insights ;
- supporting context ;
- limitations ;
- publication/facts lineage ;
- no AI required.

### `DIAGNOSTIC_OBSERVABILITY_GATE`

PASS si outputs conservent :

- support ;
- coverage ;
- provenance ;
- method/policy ;
- revision ;
- evidence/dependency refs.

### `REFRESH_DEPENDENCY_EXPORT_GATE`

PASS si toute ressource/famille peut déclarer :

- Fact dependencies ;
- entity dependencies ;
- historical lookback ;
- Global dependencies ;
- outputs.

## 13.13 REGRESSION_SET

```text
A-G FULL CERTIFICATION
shared architecture/materialization/query tests
History shared foundations untouched
React-no-Analytics
typecheck
build
```

## 13.14 EXIT_GATE

```text
GLOBAL PHASE H = PASS
```

si la publication Global déterministe est entièrement snapshot/query driven et React reste présentationnel.

---

# 14. Cross-phase regression matrix

Principe : la phase N ne rejoue pas nécessairement **tous** les tests coûteux à chaque micro-commit, mais son **phase gate** doit rejouer le regression set complet défini ci-dessous.

| Phase modifiée | Régression obligatoire au gate | Raison |
|---|---|---|
| A | History shared + A | foundations communes |
| B | A + History finance/shared | Finance autorité commune |
| C | A+B + History M3/Activity/Place shared | transformations utilisent B et human facts |
| D | A+B+C | relations consomment ces outputs |
| E | A-D + History Moment/Place | nouvelles familles peuvent enrichir D |
| F | A-E + B Finance + D Relations | Purchase peut affecter Finance/Relations |
| G | A-F + person/shared semantics | Persona/Nous deux consomment tout l’amont |
| H | A-G + runtime/materialization/publication + History shared | H projette tout et partage infra |

## 14.1 Règle de propagation

Si une phase ultérieure **modifie** réellement une primitive d’une phase antérieure au lieu de seulement la consommer :

```text
rejouer la certification complète de la phase propriétaire
+
toutes phases aval impactées
```

Exemple :

```text
F modifie PurchaseEventFact partagé avec B
→ B Finance recertification
→ D si relation Purchase activée
→ F
→ G
→ H plus tard
```

## 14.2 Aucune rétro-modification silencieuse

Interdit :

```text
G découvre un besoin Persona
→ change la définition de Actual dans un helper G
```

Correct :

```text
G découvre gap dans B
→ BLOCKED / return to B authority owner
→ B fix + certification
→ rerun aval
```

---

# 15. Stratégie de prompts recommandée

## 15.1 Pattern commun

Chaque phase devrait suivre :

```text
1. AUDIT PHYSIQUE
2. IMPLEMENTATION ENGINE/CONTRACT BORNÉE
3. TESTS UNITAIRES/TARGETED
4. CERTIFICATION ANALYTICS / RECONCILIATION
5. READMODEL/PUBLICATION HANDOFF si applicable
6. PHASE GATE
```

Le nombre réel varie.

## 15.2 Estimation de granularité

| Phase | Prompt groups recommandés | Pourquoi |
|---|---:|---|
| GA0 | 1–2 | rebase + decision map, pas de code |
| A | 4–5 | foundations transverses critiques |
| B | 5–6 | M1/M2 + références + tendances |
| C | 5–6 | ChangePoint + routines + anti-lookahead |
| D | 5–6 | statistiques/robustness sensibles |
| E | 6–7 | M6 et M7 distincts |
| F | 5–6 | Purchase core + gates produit/wallet |
| G | 6–7 | M9 et M10 distincts |
| H | 7–8 | publication + RMs + Query + React + perf |

Ordre de grandeur préparatoire : **44 à 53 prompts**, y compris audits/gates, mais l’Audit 08 devra fusionner les sous-prompts qui peuvent l’être sans augmenter le risque.

Ce nombre n’est **pas un objectif**. L’objectif est de conserver :

```text
prompt petit
→ résultat vérifiable
→ rapport
→ gate
→ prompt suivant
```

## 15.3 Quand fusionner deux prompts

Fusion autorisée si :

- même autorité ;
- mêmes fichiers/domaines ;
- même test gate ;
- pas de migration lourde ;
- pas de choix doctrinal intermédiaire ;
- échec facilement isolable.

## 15.4 Quand séparer obligatoirement

Séparer si :

- migration + code métier ;
- engine + UI ;
- deux autorités différentes ;
- hard stop possible entre les deux ;
- moteur statistique sophistiqué ;
- publication live/cutover ;
- M9 vs M10 ;
- M6 vs M7 ;
- product authority gated branch ;
- phase certification exhaustive.

---

# 16. Politique des tests statistiques

Le Master exige des résultats robustes ; les tests ne doivent pas vérifier uniquement une valeur exacte sur un dataset arbitraire.

## 16.1 Tests de propriétés

Pour Trend/ChangePoint/Relationship/Persona :

- monotonic synthetic series ;
- flat series ;
- one-off outlier ;
- missing intervals ;
- boundary support ;
- reversed order ;
- duplicate observations ;
- low coverage ;
- contradictory sources ;
- current-tail contamination.

## 16.2 Tests adversariaux

### Trend

Un dernier mois extrême ne doit pas automatiquement produire une tendance durable.

### ChangePoint

Une anomalie ponctuelle suivie d’un retour au niveau initial ne doit pas être `DURABLE_CHANGE`.

### Relationship

Deux séries co-tendantes par le temps ne doivent pas créer automatiquement une relation substantielle si la méthode exige matching/control.

### Persona

Deux personnes observées sur des périodes différentes ne doivent pas être comparées comme si le support était commun.

### Shared

Deux personnes localisées au domicile le même soir ne doivent pas automatiquement produire une activité partagée.

## 16.3 Seed et reproductibilité

Si bootstrap/permutation/resampling est utilisé :

- seed explicite ;
- seed/version dans evidence/method identity si nécessaire ;
- test stabilité sur répétition ;
- aucune dépendance au hasard système.

---

# 17. Tests de sensitivity / dependency closure

Pour chaque famille Global, ajouter des tests du type :

```text
changer input significatif
→ output ou dependency hash change
```

et :

```text
changer input non pertinent
→ output/hash métier ne change pas
```

## Minimum par phase

### B

- modifier un mois éligible Typical ;
- modifier une classification catégorie.

### C

- modifier une observation dans la fenêtre before/after ;
- modifier une observation hors fenêtre.

### D

- modifier une source metric participant à une relation ;
- modifier une metric non candidate.

### E

- modifier un causal link Moment ;
- modifier un PlaceVisit ;
- modifier une photo uniquement : no analytic change.

### F

- modifier PurchaseEvent amount ;
- modifier funding metadata seulement dans fixture future ;
- modifier product field gated.

### G

- modifier attribution person ;
- modifier participant evidence.

### H

- nouvelle publication identity → cache refresh ;
- même publication → no unnecessary refetch.

---

# 18. Publication / correction E2E Global — gate à préparer

Avant `GLOBAL_DETERMINISTIC_CORE = PASS`, un test E2E synthétique doit prouver :

```text
G1 active
↓
source/fact correction autorisée
↓
dataRevision / source revision change
↓
Global dependencies invalidated
↓
G1 reste ancienne génération traçable
↓
rebuild affected engines
↓
G2 staged inactive
↓
RuntimeSchemas
↓
certification
↓
atomic finalize
↓
G2 active
↓
client Query observe G2
↓
G1 non servie comme current
```

Ce test ne doit pas dépendre du futur Import UI.

Il teste le **runtime Global**, pas le Refresh Planner final.

---

# 19. Performance strategy

## 19.1 Ne pas inventer des seuils avant mesure

Au début :

```text
measure baseline
→ identify hotspots
→ set budgets
→ enforce regressions
```

## 19.2 Métriques à enregistrer au gate H

- build duration Global total ;
- duration par moteur ;
- peak candidate counts Relationships ;
- artifact count ;
- query snapshot count ;
- total JSONB bytes ;
- initial page bytes ;
- largest detail bytes ;
- query count initial ;
- DB reads ;
- TTFB ;
- drilldown latency ;
- client request count ;
- cache hit/miss ;
- duplication ratio.

## 19.3 Conditions bloquantes même sans budget chiffré

- N+1 évident ;
- combinatoire non bornée ;
- full raw dataset embedded in Primary RM ;
- all details loaded on first render ;
- calculation triggered on click/navigation ;
- same large series copied many times sans justification ;
- non-paginated unbounded entity list.

---

# 20. Definition of Ready — `GLOBAL_DETERMINISTIC_CORE = PASS`

Ce gate est **avant** :

- Benefit Wallet réel ;
- Résumé contextuel Global final ;
- Media Manager final ;
- Diagnostic final transverse ;
- Import/Refresh Planner final.

Il signifie que Global déterministe est suffisamment stable pour recevoir ces extensions.

## DoR-01 — History / GA0

```text
POST_HISTORY_ENTRY_GATE = PASS
GA0 = PASS
```

## DoR-02 — Autorités

- toutes capabilities `MUST_V1` du core ont une autorité ;
- toutes `AUTHORITY_GATED` ont un état post-History explicite ;
- aucune authority inventée ;
- aucune double vérité History/Global.

## DoR-03 — Foundations

- support/coverage/provenance/knowledge states certifiés ;
- natural grains ;
- populations ;
- methods/policies versionnés ;
- dependency closure.

## DoR-04 — M1/M2 Finance

- Actual/Typical/Minimal officiels ;
- reconciliations PASS ;
- Category/Need coverage honnête ;
- Trend/Stability core certifiés.

## DoR-05 — M3/M4 Temporal/Life

- anti-lookahead PASS ;
- ChangePoint/persistence PASS ;
- routines/normalized support PASS ;
- current regime PASS.

## DoR-06 — M5 Relations

- catalog gating ;
- matching/comparable population ;
- multiplicity/robustness ;
- no causal overclaim ;
- deterministic selection.

## DoR-07 — M6/M7

- causalCost Moment explicite ;
- spentDuring distinct ;
- Place presence/transaction/localized finance distinct ;
- mobility gates explicites.

## DoR-08 — M8

- PurchaseEvent identity certifiée ;
- refunds/splits ;
- frequency/ticket ;
- merchant identity ;
- product capabilities explicitement gated ;
- Benefit Wallet compatibility PASS sans Swile implémenté.

## DoR-09 — M9/M10

- common comparable support ;
- person attribution ;
- Persona deterministic ranking ;
- SharedParticipation evidence ;
- no 50/50/no fake couple identity.

## DoR-10 — ReadModels / Query

- M1→M10 Primary RMs ;
- details nécessaires ;
- RuntimeSchemas 100 % ;
- no React Analytics ;
- snapshot-only/fail-closed ;
- no giant GET.

## DoR-11 — Publication

- Global generation identity ;
- manifest/dependencies ;
- immutable published content ;
- exactly one active compatible generation ;
- rollback ;
- correction→new generation ;
- cache generation test.

## DoR-12 — Future compatibility

- Media contract checkpoint PASS ;
- Summary handoff PASS ;
- Diagnostic observability PASS ;
- Refresh dependency export PASS ;
- Benefit Wallet compatibility PASS.

## DoR-13 — Cross-phase regressions

- A→H phase certification sets PASS ;
- History shared regressions PASS ;
- architecture/typecheck/build PASS ;
- no blocking failure.

## DoR-14 — Performance

- baseline mesurée ;
- aucune pathologie bloquante ;
- budgets documentés pour régressions ultérieures.

## DoR-15 — Traceability

Rapport final enregistre :

- commit ;
- schema/migrations ;
- data/analytics revisions ;
- publicationId/generation ;
- contracts/method versions ;
- capability states ;
- tests ;
- performance baseline ;
- known deferred extensions.

---

# 21. Verdict final exact

À l’issue de H, utiliser :

```text
GLOBAL_DETERMINISTIC_CORE = PASS
```

ou :

```text
GLOBAL_DETERMINISTIC_CORE = PARTIAL
```

ou :

```text
GLOBAL_DETERMINISTIC_CORE = BLOCKED
```

## PASS signifie exactement

> La fondation déterministe de l’Analyse Globale V2 — Facts/Analytics officiels, modules M1→M10, support/coverage/provenance, dépendances, ReadModels, snapshots, publication, Query runtime et corrections — est suffisamment stable et certifiée pour recevoir les extensions Benefit Wallet, Résumé contextuel, Media, Diagnostic et Import sans redéfinir sa vérité métier.

PASS ne signifie pas :

- Swile intégré ;
- Edenred intégré ;
- Résumé contextuel généré ;
- Media Manager final ;
- Diagnostic final ;
- Import final ;
- polish UX définitivement terminé.

---

# 22. Matrice synthétique demandée

| PHASE | PROMPT_GROUPS | ENTRY_GATE | EXIT_GATE | DEPENDENCIES | REGRESSION_SET | HARD_STOP |
|---|---|---|---|---|---|---|
| A Foundations | A0–A4 | History Core + GA0 PASS | foundations certifiées | History/shared primitives | History shared + architecture + A | AUTHORITY/CONTRACT/DEPENDENCY/NON_DETERMINISM |
| B Finance | B0–B5 | A PASS + Economic authority | M1/M2 certified | A + Economic Facts | A + History finance | double authority / reconciliation / lookahead |
| C Temporal/Life | C0–C5 | A/B PASS + human observability | M3/M4 certified | B + PersonDay/Activity/Place | A+B + History shared | lookahead / false persistence / denominator |
| D Relations | D0–D5 | A–C PASS + catalog | M5 certified | B/C metrics | A–C | unwhitelisted / causal overclaim / multiplicity |
| E Moments/Geo | E0–E6 | A–D PASS + HC2 doctrines | M6/M7 certified | Moments/Place + D | A–D + History Moment/Place | causal authority / GPS over-inference |
| F Consumption | F0–F5 | A–E PASS + Purchase authority | M8 certified | Purchase/Merchant | A–E + B/D | bank=buy / provider=merchant / missing product authority |
| G People/Social | G0–G6 | B–F stable + attribution | M9/M10 certified | all upstream person/shared | A–F | payer=beneficiary / fake shared / incomparable support |
| H Query/RM/UX | H0–H7 | A–G certified | deterministic core gate | all modules + publication infra | A–G + runtime + History shared | client analytics / unsafe publication / mixed generation |

---

# 23. Ce que l’Audit 08 devra faire avec cette stratégie

Le futur `08` ne doit pas réinventer les tests.

Il doit :

1. consolider 01→07 ;
2. transformer les `PROMPT_GROUPS` ci-dessus en chaîne de prompts exécutable ;
3. décider quelles unités peuvent être fusionnées ;
4. associer à chaque prompt :
   - preconditions ;
   - scope ;
   - regression set ;
   - hard stop ;
   - deliverable ;
   - exit criterion ;
5. préparer GA0 qui réécrira uniquement les prompts touchés par HC2→HC6 ;
6. préserver `MUST_PRESERVE_FOR_FUTURE` de l’Audit 06.

La chaîne finale doit permettre le workflow utilisateur suivant :

```text
prompt Codex
↓
rapport PASS/PARTIAL/BLOCKED
↓
revue
↓
prompt suivant déjà préparé
```

sans devoir reconstruire toute la roadmap à chaque étape.

---

# 24. Conclusion

La stratégie de développement et de validation est maintenant suffisamment structurée pour préparer la chaîne finale.

Les trois principes les plus importants sont :

```text
1. Aucune phase aval ne redéfinit silencieusement une vérité amont.

2. Chaque phase possède son propre gate + regression set avant de continuer.

3. GLOBAL_DETERMINISTIC_CORE certifie la vérité Global avant les extensions,
   mais ne prétend pas que tout le produit Budgétisation est terminé.
```

Le résultat attendu n’est donc pas un « gros build qui compile », mais une succession de preuves :

```text
Foundations certifiées
→ Finance réconciliée
→ temporalité sans look-ahead
→ relations robustes
→ Moments/Places sans sur-inférence
→ Purchase sans confusion bancaire
→ Personnes/Nous deux sans attribution inventée
→ publication Global atomique
→ Query snapshot-only
→ React présentationnel
→ correction/republication prouvée
```

```text
GLOBAL TESTING / GATES STRATEGY
READY_FOR_IMPLEMENTATION_MAP
```
