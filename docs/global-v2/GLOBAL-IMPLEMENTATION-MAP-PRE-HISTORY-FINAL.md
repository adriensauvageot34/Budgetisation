# Analyse Globale V2 — GLOBAL IMPLEMENTATION MAP — PRE-HISTORY-FINAL

> **Nature du document** : synthèse maître préparatoire et carte d’implémentation PROVISOIRE.
>
> **AUCUNE IMPLEMENTATION. Aucune migration. Aucun changement de code produit. Aucune écriture Supabase.**
>
> **Baseline repository distante observée** : branche `main`, commit `3ba2a285a63ccad90f3c9698801d87ed38c89790` (`docs(global-v2): define testing and phase gates strategy`).
>
> **Prérequis projet déclaré** : HC1 = `PASS`; HC2 → HC6 non fermés. Aucun prompt Global d’implémentation ne peut être exécuté avant `POST_HISTORY_ENTRY_GATE = PASS`, puis `GA0 — POST-HISTORY REALITY CHECK`.
>
> **Autorité normative** : `Brief_Technique_Analyse_Globale_V2_FINAL_EXHAUSTIF_MASTER.docx` et ses registres verrouillés. Les audits préparatoires 01→07 sont des cartes de lecture, jamais une doctrine concurrente.
>
> **Objectif de ce document** : éviter d’avoir à reconstruire toute la réflexion de séquencement quand History sera fermé. Après HC6, GA0 devra uniquement rebaser cette carte sur la réalité finale du repo, de Supabase et des rapports HC1→HC6.

---

# 0. Verdict exécutif

Les sept audits préparatoires convergent vers une architecture et une stratégie suffisamment cohérentes pour préparer dès maintenant la future chaîne Codex Global.

Le principe central est :

```text
History et Global partagent la vérité en amont
mais pas les projections en aval.

Canonical / Facts / Analytics communs
                 │
        ┌────────┴────────┐
        ↓                 ↓
 History projections   Global Analytics spécialisés
        ↓                 ↓
 History snapshots     Global ReadModels
        ↓                 ↓
 History UI            Global UI
```

Global ne doit jamais être construit par concaténation des douze ReadModels History.

La cible finale de calcul reste :

```text
Canonical
→ Facts
→ Analytics officiels
→ Analytics Global spécialisés
→ artifacts
→ ReadModels Global
→ RuntimeSchemas
→ génération Global inactive
→ certification
→ activation atomique
→ Query snapshots
→ React
```

et jamais :

```text
ouvrir /analyse-globale
→ calculer Trend / Relations / Persona / Places / Consumption
→ afficher
```

Le plan recommandé est :

```text
POST_HISTORY_ENTRY_GATE = PASS
↓
GA0 — POST-HISTORY REALITY CHECK
↓
A — Foundations
↓
B — Finance M1/M2
↓
C — Temporal / Life M3/M4
↓
D — Relations M5 — core
↓
E — Moments / Geography M6/M7
↓
F — Consumption M8
↓
D/E/F recertifications croisées si de nouvelles relation families deviennent disponibles
↓
G — People / Social M9/M10
↓
H — Query / ReadModels / UX / Global publication runtime
↓
GLOBAL DETERMINISTIC CERTIFICATION
↓
GLOBAL_DETERMINISTIC_CORE = PASS
↓
Benefit Wallet / Swile pilote
↓
Edenred adapter
↓
rebuild / recertification History + Global si la vérité économique évolue
↓
Résumé contextuel Global
↓
Media final
↓
Diagnostic transverse final
↓
Import & Actualisation / Refresh Planner final
```

Le Master conserve conceptuellement la Phase I `Contextual Summary` après H. Dans la trajectoire produit de ce projet, son **implémentation réelle peut être volontairement différée après Benefit Wallet** afin de ne pas générer immédiatement un résumé sur une vérité dont on sait qu’elle va être enrichie par les achats wallet. Ce point est traité comme un **sequencing decision explicite**, pas comme une modification de doctrine Analytics.

La chaîne de prompts proposée ci-dessous contient **35 groupes principaux maximum**, dont plusieurs sont conditionnels et peuvent être supprimés après GA0. La cible pratique attendue est plutôt **30 à 33 prompts réellement exécutés**, selon les capacités `AUTHORITY_GATED` disponibles.

```text
GLOBAL IMPLEMENTATION PREPARATION STATUS
READY FOR POST-HISTORY REBASE
```

---

# 1. Sources consolidées

Les sept documents relus et consolidés sont :

1. `docs/global-v2/prep-audits/01-global-master-capability-map.md`
2. `docs/global-v2/prep-audits/02-history-global-boundary-audit.md`
3. `docs/global-v2/prep-audits/03-global-authority-dependency-preaudit.md`
4. `docs/global-v2/prep-audits/04-global-runtime-publication-query-audit.md`
5. `docs/global-v2/prep-audits/05-global-readmodel-ux-contract-audit.md`
6. `docs/global-v2/prep-audits/06-global-future-integration-compatibility-audit.md`
7. `docs/global-v2/prep-audits/07-global-testing-gates-strategy.md`

En complément, ces audits s’appuient déjà sur :

- Master Global FINAL EXHAUSTIF ;
- `GLOBAL_REQUIREMENTS_MATRIX` ;
- `GLOBAL_CAPABILITY_SCOPE_REGISTRY` ;
- `GLOBAL_AUTHORITY_GATED_REGISTRY` ;
- `GLOBAL_TEST_CATALOG` ;
- `GLOBAL_CONCEPTUAL_DEPENDENCY_AND_IMPLEMENTATION_PLAN` ;
- audits History 20→24 ;
- rapports History Core disponibles ;
- AGENTS.md ;
- code courant ;
- schéma et lectures Supabase V2 effectuées durant les audits concernés.

---

# 2. Carte produit consolidée

## 2.1 M1 — Notre fonctionnement économique

### Question

Comment fonctionne l’économie du Household sur le temps long ?

### Cible

- Actual économique ;
- Typical ;
- Minimal ;
- Typical ↔ Minimal ;
- structure nécessité ;
- structure fixe/variable ;
- LifeScope ;
- évolution ;
- Trend ;
- Stability / volatility ;
- Recent Change ;
- Structural Monthly Equivalent ;
- récurrences ;
- contributeurs.

### Grain

Mois, composant économique, récurrence selon la question.

### Dépendances principales

A Foundations → B Finance.

### Future compatibility

Benefit Wallet doit enrichir la vérité économique sans créer une deuxième définition d’Actual.

---

## 2.2 M2 — Catégories & Needs

### Question

Où va l’argent et quels besoins finance-t-il ?

### Cible

- catégories ;
- sous-catégories ;
- Needs ;
- shares ;
- séries ;
- Typical par dimension ;
- contributeurs ;
- frequency × ticket lorsque réellement disponible ;
- drill-downs.

### Grain

Composant économique / mois / PurchaseEvent selon la question.

### Dépendances

A + B.

### Tension connue

M2 core arrive avant M8, alors que certains merchant/purchase drivers pourront être enrichis par Consumption.

**Décision de séquencement** : M2 core doit être certifiable sans M8. Après F, seules les dimensions réellement enrichies sont recertifiées. Aucun cycle B↔F n’est autorisé.

---

## 2.3 M3 — Chapitres & transformations

### Question

Quand la vie a-t-elle réellement changé ?

### Cible

- ChangePoint ;
- before/after robuste ;
- persistence ;
- DURABLE_CHANGE ;
- NEW_PHASE ;
- TEMPORARY_CHAPTER ;
- current regime ;
- fusion multi-domaines ;
- semantic anchors.

### Grain

Multi-grain selon signal réel.

### Dépendances

A+B, puis certains signaux M4/E/F peuvent enrichir la détection et les explications.

---

## 2.4 M4 — Routines, cadences & rythmes

### Question

Quelles habitudes et cadences structurent réellement la vie ?

### Cible

- frequency ;
- rate ;
- cadence ;
- routine ;
- weekly patterns ;
- seasonal/anchored patterns si support ;
- normalized counts ;
- support-aware observations.

### Grain

Occurrence, PersonDay, visite, jour selon famille.

### Dépendances

A+B+C foundations.

---

## 2.5 M5 — Relations Vie ↔ Argent

### Question

Quelles associations sont robustes, et lesquelles ne le sont pas ?

### Cible

- matching ;
- effect statistics ;
- uncertainty ;
- multiplicity / FDR ;
- robustness ;
- relation catalog ;
- anti-causality-overclaim ;
- relation temporal state ;
- evidence.

### Grain

Grain naturel de chaque relation.

### Dépendances

A+B+C pour le core.

E/F peuvent ensuite ajouter des familles de signaux Moments/Places/Purchase.

### Tension connue

Le plan conceptuel place D avant E/F, mais M5 cible peut consommer certains outputs E/F.

**Décision préparatoire** :

```text
D = Relationship core engine + relation families B/C
E/F = nouvelles sources autoritaires
→ D-RECERT = enrichissement/replay des familles nouvellement disponibles
```

Pas de cycle de dépendance silencieux.

---

## 2.6 M6 — Moments & expériences

### Question

Comment comparer des expériences sans confondre causalité et simultanéité ?

### Cible

- Moment Family/Type/Series ;
- comparability ;
- tiers ;
- causalCost ;
- spentDuring distinct ;
- gross/net/refund ;
- before/core/after-effect ;
- cost/day ;
- repetition ;
- peer robust stats.

### Dépendances

HC2 final pour causalité + A→D.

---

## 2.7 M7 — Lieux & mobilité

### Question

Quels lieux et déplacements structurent réellement la vie ?

### Cible

- PlaceVisit ;
- visit count/days/duration ;
- Place importance ;
- lifecycle ;
- localized finance ;
- route/mobility/fuel uniquement si autorités disponibles.

### Risque central

```text
GPS presence
≠ visit semantics
≠ transaction place
≠ localized finance
```

### Dépendances

HC2 Place + A→D.

---

## 2.8 M8 — Consumption

### Question

Comment les achats se structurent-ils réellement ?

### Cible core

- PurchaseEvent identity ;
- adjustments/refunds ;
- retained count ;
- frequency ;
- mean/median ticket ;
- frequency×ticket ;
- Merchant ;
- channel ;
- evolution ;
- drill-downs.

### Conditionnels

- PurchaseLine ;
- ProductFamily / Variant / Format ;
- product cycle ;
- substitution ;
- personal price index ;
- normalized unit.

### Invariant futur majeur

```text
purchase ≠ funding ≠ bank transaction
```

et :

```text
economic consumption ≠ wallet funding ≠ bank flow
```

### Dépendances

A→E + Purchase authority.

---

## 2.9 M9 — Persona Adrien / Manon

### Question

Quelles différences sont réellement distinctives entre les personnes ?

### Cible

- person-scoped metrics ;
- common comparable support ;
- normalization ;
- Persona materiality ;
- current regime ;
- exceptional exclusion ;
- deterministic ranking ;
- anti-redundancy ;
- diversity ;
- hysteresis ;
- 4–6 top cards maximum ;
- non-moral wording.

### Dépendances

B→F stabilisés.

---

## 2.10 M10 — Nous deux

### Question

Qu’est-ce qui est réellement partagé par le couple ?

### Cible

- SharedParticipationResolver ;
- PRESENT / ABSENT / UNKNOWN / CONFLICT ;
- EXPLICIT_SHARED ;
- CANONICAL_SHARED ;
- STRONG_COPRESENCE ;
- sharedObservableSupport ;
- SharedActivityOccurrence ;
- shared Place ;
- shared Moment ;
- aucun fake Couple PersonId ;
- aucun 50/50 inventé.

### Dépendances

B→F + participant evidence.

---

# 3. Dependency graph consolidé

## 3.1 DAG principal

```text
History Core final
        ↓
GA0
        ↓
A Foundations
        ↓
B Finance M1/M2
        ↓
C Temporal/Life M3/M4
        ↓
D Relations M5 core
        ↓
E Moments/Geo M6/M7
        ↓
F Consumption M8
        ↓
D recert/enrichment si E/F ouvrent de nouvelles relation families
        ↓
G People/Social M9/M10
        ↓
H Query/RM/UX/Publications
        ↓
Global deterministic certification
```

## 3.2 Dépendances transverses principales

```text
Finance → Temporal
Finance → Relations
Finance → People
Temporal → Relations
Temporal → People
Activity → Temporal
Activity → Relations
Activity → People
Moment → Relations
Moment → People
Place → Relations
Place → People
Purchase → Finance enrichments éventuels
Purchase → Relations
Purchase → People
Participation → People/Social
```

## 3.3 Dépendances interdites

```text
History ReadModel → Global Analytics
React → Global Analytics
Media → Global Analytics
Contextual Summary → Global Analytics
Diagnostic → Global business truth
Import UI → Global Analytics
Swile provider specifics → Global economic model
```

## 3.4 Anti-cycle rules

### M2 / M8

M2 core ne dépend jamais de M8 pour exister.

Si M8 enrichit des merchant/purchase drivers :

```text
F PASS
→ targeted B/M2 recertification
```

### M5 / E/F

M5 core existe après B/C.

E/F ajoutent des relation families seulement si leurs autorités deviennent disponibles.

```text
E/F PASS
→ targeted M5 recertification
```

### Persona

M9 ne doit jamais modifier les moteurs B–F pour rendre une différence plus spectaculaire.

Persona consomme des métriques stables ; il ne devient pas une source amont.

---

# 4. Séparation CERTAIN / PROVISOIRE

## 4.1 `PRODUCT_REQUIREMENT_STABLE`

Ces éléments sont considérés comme stables parce qu’ils viennent directement du Master final :

- 10 modules M1→M10 ;
- dimension sociale transversale ;
- page produit Global unique ;
- aucun filtre temporel Global universel ;
- grains naturels ;
- `CERTIFIED_HISTORY` distinct de `LIVE_TAIL` ;
- support / coverage / provenance ;
- knowledge states ;
- materiality ;
- no look-ahead ;
- aucune causalité par simple temporalité ;
- PurchaseEvent comme achat humain ;
- Persona comparable support ;
- SharedParticipation avec preuve ;
- Summary non autoritaire ;
- React sans Analytics ;
- publication Global cohérente ;
- ordre utilisateur stable des modules ;
- COMPACT par défaut ;
- selected insights server-side.

## 4.2 `ARCHITECTURE_PRINCIPLE_STABLE`

- Canonical → Facts → Analytics → ReadModels → snapshots ;
- History/Global partagent l’amont, pas les projections ;
- aucune reconstruction métier à la navigation ;
- RuntimeSchema obligatoire ;
- ancienne génération active pendant build ;
- activation atomique ;
- nouvelle vérité = nouvelle génération ;
- old generation traceable ;
- no React aggregation ;
- no AI as Analytics ;
- dependency declarations nécessaires ;
- publicationId cohérent dans la page ;
- lazy loading oui, lazy business calculation non.

## 4.3 `LIKELY_REUSE`

À confirmer GA0 :

- `CanonicalRepository` ;
- `FactSourceResolver` ;
- `EconomicComponentFact` ;
- `PurchaseEventFact` conceptuel ;
- `ActivityOccurrenceFact` ;
- `ActivityOccurrenceCostFact` ;
- `PersonDayFact` ;
- `PlaceVisitFact` ;
- Metric envelopes ;
- ProducedMetric / Metric Registry ;
- Query API générique ;
- MaterializationStore générique ;
- RuntimeSchema mechanism ;
- dataRevision / analyticsRevision model ;
- analytics_artifacts ;
- analytics_query_snapshots ;
- atomic publication finalizer conceptuel ;
- History publication concepts après HC3/HC4.

## 4.4 `REVALIDATE_AFTER_HISTORY`

Obligatoire après HC6 :

- Necessity ;
- Behavior ;
- LifeScope ;
- Moment causalCost ;
- Activity causal semantics ;
- Place/localized coverage ;
- factsHash closure ;
- durable manifest ;
- publication immutability ;
- correction/republication ;
- cache generation identity ;
- invalidation scopes ;
- old generation traceability ;
- History → Global dependency boundary physique.

## 4.5 `AUTHORITY_GATED`

Les 31 gates normatifs restent ouverts jusqu’à GA0.

Familles principales :

- MobilityLeg / RouteDefinition ;
- route distance ;
- vehicle/fuel authorities ;
- PurchaseLine ;
- ProductFamily/Variant/Format ;
- product comparable identity ;
- normalized units ;
- product cycles ;
- personal price index ;
- Contact / ContactAlias / ContactRelation / ContactGroup ;
- certaines attributions social/person ;
- capacités avancées conditionnelles listées par le registre.

Aucun prompt ne doit inventer un fallback.

## 4.6 `UNKNOWN`

À décider après réalité physique :

- noms exacts des nouvelles ressources Query ;
- schéma physique final Global manifest ;
- stratégie de partage d’artifacts immuables entre générations ;
- granularité exacte de certaines Detail RMs ;
- tables/RPC finales du Refresh Planner ;
- modèle physique MediaAsset/MediaAssignment ;
- persistence finale Diagnostic ;
- quantité exacte de snapshots Global ;
- budget payload final ;
- timing précis de retirement legacy Global.

---

# 5. Contradictions / tensions détectées

Les audits 01→07 sont globalement cohérents. Les éléments ci-dessous sont les vraies tensions qui ne doivent pas être résolues silencieusement.

## CT-01 — Phase I Summary conceptuelle vs exécution après Benefit Wallet

### Source A

Le plan conceptuel Master :

```text
A→H
→ I Contextual Summary
```

### Source B

La stratégie projet future compatibility recommande :

```text
Global deterministic core
→ Benefit Wallet
→ recertification
→ Summary
```

### Statut

`SEQUENCING_TENSION`, pas contradiction métier.

### Règle préparatoire

- le contrat Summary est préparé dans H ;
- aucune IA n’est exécutée pendant A→H ;
- `GLOBAL_DETERMINISTIC_CORE = PASS` avant extensions ;
- l’implémentation Phase I peut être mise en `HOLD_AFTER_WALLET`.

GA0 ne doit pas changer cette doctrine ; il doit seulement confirmer qu’aucun contrat H ne bloque le Summary.

---

## CT-02 — D Relations avant E/F alors que M5 consomme E/F

### Risque

Cycle conceptuel.

### Règle préparatoire

Deux passes :

```text
D core = familles B/C
E/F = nouvelles autorités
D-RECERT = enrichissement ciblé
```

Pas de recompute permanent ni de dépendance circulaire.

---

## CT-03 — B M2 avant F M8 alors que purchase drivers peuvent enrichir M2

### Règle

M2 core existe sans M8.

Après F :

```text
si Purchase/merchant inputs réellement autoritaires changent M2
→ targeted B/M2 recertification
```

Aucun `B DEPENDS_ON F` au niveau core.

---

## CT-04 — A Foundations vs H Runtime publication

### Risque

Deux phases deviennent autorités du même contrat de publication.

### Règle

A définit et implémente seulement les **primitives/transversal contracts nécessaires aux Analytics** : support, coverage, provenance, scope semantics, dependency declarations, method/policy identity.

H construit la **projection produit Global** : Global publication profile, ReadModels, Query resources, RuntimeSchemas, page shell, snapshots, cache/cutover.

Le finalizer/store générique peut être adapté plus tôt seulement si nécessaire pour A et si GA0 le recommande explicitement.

---

## CT-05 — Diagnostic final plus tard vs certification pendant Global

### Distinction

```text
Certification harness Global
≠
Diagnostic product final
```

Les phases A→H ont besoin de tests/certification indépendants.

Le Diagnostic transverse final vient plus tard et observe tous les modules.

Aucun besoin de construire le produit Diagnostic pour obtenir `GLOBAL_DETERMINISTIC_CORE = PASS`.

---

## CT-06 — Media checkpoint avant H vs Media final après Global

### Distinction

Avant H :

```text
contract checkpoint only
```

Après Global :

```text
MediaAsset / MediaAssignment / manager / content publication
```

Aucun moteur A→G ne dépend des médias.

---

## CT-07 — Global scope actuel avec `observationWindow` vs absence de période universelle

### Existant

Le scope Global legacy porte une window unique.

### Master

Chaque métrique a son propre corpus et support.

### Règle

`asOf` peut rester une identité de publication Global.

`observationWindow` ne peut pas devenir la fenêtre métier universelle de M1→M10.

GA0 doit classer le scope actuel `ADAPT` ou le remplacer.

---

## CT-08 — Génération Global complète vs réutilisation d’artifacts immuables

Deux options restent ouvertes :

### Option A

Chaque nouvelle publication G43 restage tous les outputs M1→M10.

### Option B

G43 référence des artifacts immuables de G42 pour les familles non affectées.

### Risques Option B

- manifest plus complexe ;
- rollback plus complexe ;
- dependency lineage plus exigeant ;
- immutabilité cross-generation à prouver.

### Statut

`UNKNOWN — GA0/Phase H decision`.

Aucun prompt préparatoire ne doit figer cette stratégie avant HC3/HC4 final.

---

## CT-09 — Legacy `analysis_global_*` encore présent dans `npm run verify`

Le test courant vérifie l’ancien Global à 7 ressources et l’ancienne route.

### Règle

Ne pas le supprimer en A/B/C.

Le cutover H doit :

1. prouver que la nouvelle pile Global est complète ;
2. remplacer les contrôles de certification ;
3. retirer ou isoler legacy seulement après consumer search ;
4. maintenir `npm run verify` vert sans laisser le legacy devenir l’autorité V2.

---

## CT-10 — `GLOBAL_DETERMINISTIC_CORE` avant Benefit Wallet

M8 core doit être certifiable avec la vérité autoritaire disponible.

Si certaines capacités wallet/product sont absentes :

```text
AUTHORITY_GATED / DATA_GATED
→ UNKNOWN / PLACEHOLDER / HIDDEN selon contrat
```

Le gate Global n’exige pas Swile.

Après Wallet, la nouvelle vérité peut provoquer une nouvelle génération Global et une recertification.

---

# 6. Future compatibility consolidée

## 6.1 Media

### Maintenant

Préserver :

- stable entity IDs ;
- optional content hooks ;
- refs, jamais blobs ;
- media absent ≠ analytic UNKNOWN ;
- content revision distinct analytic revision si possible.

### Plus tard

- MediaAsset ;
- MediaAssignment ;
- private binary lifecycle ;
- content-scoped publication ;
- media manager.

---

## 6.2 Contextual Summary

Global doit exposer :

- publicationId ;
- factsHash/corpus hash ;
- revision ;
- selectedInsight IDs ;
- supporting context ;
- limitations ;
- support ;
- coverage ;
- provenance ;
- entity refs.

Summary :

```text
consumes certified truth
never computes truth
```

---

## 6.3 Benefit Wallet

Preserve :

```text
1 human acquisition = 1 PurchaseEvent
purchase ≠ funding ≠ bank transaction
provider ≠ merchant
wallet owner ≠ payer/beneficiary
```

No Swile-specific branching inside Global Analytics.

---

## 6.4 Diagnostic

Every Global output should remain independently diagnosable through :

- support ;
- coverage ;
- provenance ;
- methodVersion ;
- policyVersion ;
- revision ;
- dependency refs ;
- publication metadata ;
- evidence refs.

Diagnostic remains read-only.

---

## 6.5 Import / Refresh Planner

Every Global family must be able to declare conceptually :

- Facts dependencies ;
- entity dependencies ;
- historical lookback ;
- Global dependencies ;
- outputs produced ;
- recompute semantics.

Planner orchestrates official engines ; it never reimplements them.

---

# 7. Strategy de tests consolidée

## 7.1 Cinq niveaux

```text
L1 primitive/unit
L2 analytics/invariant
L3 module/reconciliation
L4 materialization/publication/query
L5 cross-module/E2E/global gate
```

## 7.2 Invariants communs

- deterministic same-input/same-version output ;
- no oracle as product source ;
- no UNKNOWN→0 ;
- no PARTIAL→KNOWN ;
- support and coverage explicit ;
- no look-ahead ;
- no causal claim from association ;
- no person attribution without proof ;
- no place finance from GPS presence ;
- no purchase from bank row identity ;
- no client business calculation ;
- no query read-through after publication target ;
- RuntimeSchemas 100% ;
- coherent publicationId ;
- single active generation ;
- old generation traceable ;
- no hot-swap during a page reading session.

## 7.3 Global regression rule

If a later phase modifies an upstream shared Fact/metric contract :

```text
owner phase must be re-opened
→ recertify owner
→ replay dependent phases
```

Never patch a downstream phase to hide an upstream semantic defect.

---

# 8. HARD STOP catalog for future prompts

Every prompt should understand at least :

```text
AUTHORITY_GATED
CONTRACT_CONFLICT
MISSING_CANONICAL
MISSING_FACT
HISTORY_SEMANTIC_CONFLICT
NON_DETERMINISM
RECONCILIATION_FAILURE
PUBLICATION_UNSAFE
UNKNOWN_REQUIREMENT
LIVE_TAIL_AUTHORITY_LEAK
CLIENT_ANALYTICS_LEAK
DEPENDENCY_CLOSURE_GAP
CAPABILITY_SCOPE_VIOLATION
CAUSALITY_OVERCLAIM
PERSON_ATTRIBUTION_OVERCLAIM
```

Required behavior :

```text
STOP
→ report concept
→ observed sources
→ ambiguity/conflict
→ blocked outputs/phases
→ required human/rebase decision
```

Forbidden behavior : invent heuristic and continue.

---

# 9. Final provisional prompt chain

The IDs below are **provisional prompt-group IDs**, not filenames or implementation APIs.

The objective is to create prompts bounded enough to review between runs, without splitting trivial edits into dozens of tiny tasks.

---

# 10. GA0 — POST-HISTORY REALITY CHECK

## GA0 — one mandatory prompt

### Mission

Rebase all preparation audits on final History reality after HC6.

### Preconditions

```text
POST_HISTORY_ENTRY_GATE = PASS
HC1→HC6 reports available
History final commit known
working tree clean or explicitly understood
migrations final known
Supabase final readable
```

### Must read

- Master Global + registries ;
- audits Global 01→08 ;
- History audits 20→24 ;
- HC1→HC6 reports ;
- `30-post-history-entry-gate.md` ;
- current repo ;
- Supabase schema/data state read-only ;
- AGENTS.md.

### Must replace all provisional classes with

```text
REUSE
ADAPT
NEW_METRIC
NEW_ENGINE
NEW_FACT
NEW_READMODEL
NEW_DATA
REMOVE_LEGACY
AUTHORITY_GATED
```

### Must produce

1. final History→Global reuse matrix ;
2. physical `GLOBAL_ANALYTICS_DEPENDENCY_MATRIX` ;
3. final authority gated status ;
4. exact global scope model ;
5. exact publication/runtime primitives reusable ;
6. legacy retirement/cutover map ;
7. list of preparatory prompt IDs that remain valid ;
8. list of prompt IDs to rewrite ;
9. list of prompt IDs to delete as unnecessary ;
10. final phase dependency graph ;
11. `GA0_ENTRY_GATE = PASS / PARTIAL / BLOCKED`.

### No implementation

GA0 modifies only audit/planning docs if needed.

### Hard stop

Any unresolved authority conflict blocking A.

---

# 11. Phase A — Foundations

Target : **3 prompt groups**.

## A1 — Physical foundations audit + contract freeze

### Goal

Map final shared contracts after GA0 :

- support ;
- coverage ;
- provenance ;
- knowledge states ;
- partial reasons ;
- materiality foundations ;
- AnalysisScope / asOf semantics ;
- natural windows ;
- method/policy identities ;
- dependency declarations ;
- capability registry interaction.

### Output

`A_FOUNDATION_IMPLEMENTATION_PLAN`.

No code if a major contract conflict remains.

---

## A2 — Implement shared Global foundation contracts

### Scope

Only the missing/adapted primitives identified by A1/GA0.

No M1→M10 product analytics yet.

### Required extension compatibility

Media/Summary/Wallet/Diagnostic/Import clauses.

---

## A3 — Foundations certification + handoff

### Tests

- support/coverage adversarial cases ;
- natural window/no universal observationWindow ;
- provenance lineage ;
- deterministic hashes ;
- knowledge states ;
- capability gating ;
- dependency declaration validation ;
- architecture/typecheck/build/regression History.

### Exit

```text
GLOBAL PHASE A = PASS
```

---

# 12. Phase B — Finance M1/M2

Target : **4 prompt groups**.

## B1 — Finance physical audit / reuse-adapt-new plan

Final inventory :

- Actual ;
- Typical ;
- Minimal ;
- category amounts ;
- Needs ;
- recurrence ;
- Materiality ;
- Trend dependencies ;
- History shared metrics ;
- category classifications after HC2.

No business implementation until authority map is clear.

---

## B2 — M1 economic engines

Implement/adapter only M1 foundations :

- Actual reuse ;
- Typical ;
- Minimal ;
- structural monthly equivalents ;
- references ;
- recurrence/contributors if in B scope ;
- inputs needed by Trend later without duplicating C engines.

No frontend.

---

## B3 — M2 Category & Needs analytics

Implement :

- category/subcategory/Need aggregations ;
- reconciliation ;
- shares ;
- category references ;
- contributors supported by current authority.

Do not fabricate purchase drivers reserved to F/Wallet.

---

## B4 — Finance certification + handoff

Must prove :

- M1/M2 reconcile with economic truth ;
- no bank-flow double authority ;
- no oracle dependency ;
- no Unknown→0 ;
- additive/non-additive semantics correct ;
- History shared metrics unaffected ;
- Wallet compatibility invariant.

Exit :

```text
GLOBAL PHASE B = PASS
```

---

# 13. Phase C — Temporal / Life M3/M4

Target : **4 prompt groups**.

## C1 — Temporal physical audit + statistical policy freeze

Audit :

- series inputs ;
- Trend ;
- Stability ;
- Recent Change ;
- ChangePoint ;
- persistence ;
- routine/cadence ;
- seasonality ;
- natural grains ;
- LIVE_TAIL boundary.

---

## C2 — Trend / Stability / ChangePoint / Transformation engine set

Build engines with :

- no look-ahead ;
- robust windows ;
- current regime ;
- persistence ;
- change classifications ;
- support-aware states.

No UI.

---

## C3 — M4 Cadence / Routine engine set

Build :

- normalized rates ;
- cadence ;
- routine ;
- recurring patterns ;
- data-gated seasonality only with support.

Do not force all inputs to month grain.

---

## C4 — Temporal/Life certification + handoff

Adversarial tests :

- one outlier ≠ trend ;
- anomaly then return ≠ durable change ;
- LIVE_TAIL alone ≠ new certified trend ;
- incomplete support ≠ routine ;
- normalized counts across exposure.

Exit :

```text
GLOBAL PHASE C = PASS
```

---

# 14. Phase D — Relations M5 core

Target : **3 prompt groups**.

## D1 — Relation catalog / authority / statistics audit

Freeze :

- allowed relation families ;
- natural grain ;
- matching strategy ;
- effect size ;
- uncertainty ;
- multiplicity ;
- FDR ;
- robustness ;
- association vs causal semantics.

---

## D2 — RelationshipEngine core

Implement relation families whose inputs are already certified B/C.

Do not include E/F families before their authorities are ready.

---

## D3 — Relationship core certification

Must prove :

- no spurious causal claim ;
- time trend confounding tests ;
- population comparability ;
- multiplicity correction ;
- deterministic ranking/materiality ;
- evidence refs.

Exit :

```text
GLOBAL PHASE D CORE = PASS
```

---

# 15. Phase E — Moments / Geography M6/M7

Target : **4 prompt groups**, 1 conditionnel interne.

## E1 — Moment/Place physical authority audit

Revalidate HC2 final :

- Moment causal relation ;
- spentDuring ;
- Activity links ;
- PlaceVisit ;
- localized finance ;
- Place coverage ;
- mobility authorities AG gates.

---

## E2 — M6 Moment analytics

Implement :

- comparability ;
- series ;
- causal cost ;
- temporal roles ;
- peer stats ;
- repetition ;
- low-cost important moments ;
- gross/net/refund.

Must never derive causal from temporal proximity.

---

## E3 — M7 Place/Geo analytics

Implement core Place :

- importance ;
- lifecycle ;
- visits ;
- routine penalty ;
- localized finance with real coverage.

### Conditional sublot

Mobility/route/fuel only if GA0/AUTHORITY_GATED declares prerequisite available.

If unavailable : explicit capability gated output, no invented distance/cost.

---

## E4 — M6/M7 certification + D recert decision

After E PASS :

- identify new M5 relation families enabled by Moment/Place outputs ;
- rerun D only if dependency matrix says affected.

Exit :

```text
GLOBAL PHASE E = PASS
```

---

# 16. Phase F — Consumption M8

Target : **4 prompt groups**.

## F1 — Purchase authority / Wallet compatibility audit

Freeze :

- PurchaseEvent ;
- adjustment/refund ;
- Merchant ;
- channel ;
- funding separation ;
- product gates ;
- person role semantics.

Hard stop if implementation path assumes bank operation = purchase.

---

## F2 — M8 Purchase/Merchant core

Implement :

- retained purchase count ;
- frequency ;
- mean/median ticket ;
- frequency×ticket ;
- Merchant analytics ;
- channel ;
- evolution ;
- adjustments/refunds.

Provider-agnostic.

---

## F3 — Product/Cycle conditional analytics

Execute only for authorities GA0 marks available :

- PurchaseLine ;
- ProductVariant ;
- normalized units ;
- cycles ;
- substitution ;
- price analytics ;
- personal consumption price index.

If gates unavailable, this prompt becomes a **certified skip/placeholder contract prompt**, not an invention prompt.

---

## F4 — Consumption certification + cross-phase recert

Must prove :

```text
purchase ≠ funding ≠ bank transaction
```

No double-counting.

Then dependency matrix decides whether to recertify :

- M2 purchase/merchant drivers ;
- M5 purchase relations ;
- downstream G.

Exit :

```text
GLOBAL PHASE F = PASS
```

---

# 17. Phase G — People / Social M9/M10

Target : **4 prompt groups**.

## G1 — Person attribution / shared evidence audit

Freeze :

- payer vs beneficiary ;
- Person-scoped support ;
- comparable intersections ;
- participant evidence ;
- shared inference catalog ;
- Contact gates.

---

## G2 — Person normalization + PersonaDifferenceEngine

Implement :

- common comparable support ;
- normalized metrics ;
- Persona materiality ;
- current regime ;
- exceptional exclusion ;
- ranking ;
- anti-redundancy ;
- diversity ;
- hysteresis.

---

## G3 — SharedParticipationResolver + M10

Implement :

- PRESENT/ABSENT/UNKNOWN/CONFLICT ;
- evidence tiers ;
- shared Activity ;
- shared Place ;
- shared Moment ;
- normalized support.

No fake 50/50.

No automatic shared status from bank operation or co-presence alone.

---

## G4 — People/Social certification

Adversarial tests :

- incomparable support ;
- wallet/bank owner not beneficiary ;
- home co-presence not shared activity ;
- missing participant evidence ;
- PersonA/PersonB asymmetry ;
- non-moral wording/selection constraints.

Exit :

```text
GLOBAL PHASE G = PASS
```

---

# 18. Phase H — Query / ReadModels / UX / publication

Target : **6 prompt groups**.

## H1 — H physical audit + cutover plan

Before code :

- inspect A→G outputs ;
- decide Query resource families ;
- decide exact Global publication profile ;
- decide artifact reuse vs restage strategy ;
- decide RuntimeSchema families ;
- decide legacy cutover ;
- decide cache generation identity ;
- run Media contract checkpoint ;
- run Summary handoff checkpoint.

No frontend until contracts are frozen.

---

## H2 — Global publication profile / materialization / RuntimeSchemas

Implement :

- Global generation identity ;
- manifest ;
- artifacts/query snapshot closure ;
- staging inactive ;
- certification metadata ;
- finalization ;
- single-active behavior ;
- rollback/traceability as required ;
- cache generation signal.

No React.

---

## H3 — Primary ReadModels M1→M10

For each module :

```text
COMPACT
0–1 selected insight
0–3 KPIs
quality/provenance state
references
no hidden expanded payload
```

Server selects insight/top-N/materiality.

---

## H4 — Detail / Relation / Entity RMs + Query registry

Implement bounded lazy resources :

- module details ;
- relation details ;
- entity details ;
- History links ;
- Methodology ;
- Purchase destination if needed.

Avoid one Query per micro-line.

Avoid giant JSON containing all details.

---

## H5 — `/analyse-globale` React / navigation / accessibility

Implement presentation only :

- page shell ;
- module order ;
- COMPACT/EXPANDED ;
- lazy details ;
- History deep links ;
- focus restoration ;
- keyboard ;
- reduced motion ;
- chart text equivalents ;
- mobile one-column ;
- sticky Global navigation ;
- no critical hover-only info.

React cannot calculate Analytics.

---

## H6 — H certification / performance / legacy cutover

Must prove :

- publication coherence ;
- RuntimeSchemas ;
- snapshot-only navigation ;
- no dynamic Analytics read-through ;
- client no analytics ;
- no hot swap ;
- cache generation behavior ;
- payload budgets measured ;
- no N+1 ;
- initial payload bounded ;
- lazy details bounded ;
- old `analysis_global_*` consumers inventoried ;
- legacy tests retired/reclassified safely ;
- `npm run verify`, typecheck, build PASS.

Exit :

```text
GLOBAL PHASE H = PASS
```

---

# 19. GLOBAL DETERMINISTIC CERTIFICATION

Target : **2 prompt groups**.

## GC1 — Exhaustive deterministic certification / pre-publication gate

Must execute the complete catalog against the final A→H implementation.

Required dimensions :

- 10 modules ;
- capability registry ;
- authority gated states ;
- dependency matrix ;
- no-lookahead ;
- support/coverage/provenance ;
- cross-module regressions ;
- publication closure ;
- factsHash/manifest ;
- RuntimeSchemas ;
- immutability ;
- correction invalidation ;
- new generation ;
- cache generation ;
- Query snapshot-only ;
- React-no-Analytics ;
- performance baseline ;
- History regressions.

No live publication without explicit authorization if required.

---

## GC2 — Final Global publication / smoke / gate report

If migrations/live cutover require human authorization : STOP with exact instructions.

After explicit authorization only :

```text
build final Global generation
→ stage inactive
→ certify
→ finalize atomically
→ read-only live proof
→ smoke /analyse-globale
```

Create final report with :

- commit ;
- migrations ;
- dataRevision ;
- analyticsRevision ;
- Global publicationId ;
- generation key ;
- manifest/factsHash ;
- resource count ;
- snapshot count/size ;
- RuntimeSchema coverage ;
- tests ;
- performance ;
- legacy status ;
- git status.

Final verdict :

```text
GLOBAL_DETERMINISTIC_CORE = PASS / PARTIAL / BLOCKED
```

PASS means only that Global deterministic truth/runtime/UI is stable enough for the next product extensions.

---

# 20. Prompt count provisional

| Group | Count max |
|---|---:|
| GA0 | 1 |
| A | 3 |
| B | 4 |
| C | 4 |
| D | 3 |
| E | 4 |
| F | 4 |
| G | 4 |
| H | 6 |
| Deterministic certification | 2 |
| **TOTAL MAX** | **35** |

Conditional gates can reduce the actual count.

Likely practical count : **30–33**.

Why not 50 : audit 07 intentionally listed a maximal safe decomposition. This master map merges only the steps whose boundaries can remain testable and reviewable without creating giant monolithic prompts.

Why not 10 : statistical engines, authority gates, publication, ReadModels and cutover have too much semantic risk to be collapsed into one prompt per phase.

---

# 21. Exact template required for every future implementation prompt

Every prompt must contain these sections in this order or an equivalent explicit form.

## 21.1 MISSION

One bounded objective.

## 21.2 PRECONDITIONS

Previous gate(s) that must be PASS.

## 21.3 AUTHORITY

- Master section(s) ;
- relevant registry ;
- final GA0 classification ;
- Canonical/Facts source ;
- current code as EXISTING only.

## 21.4 IN_SCOPE

Exact concepts/files/families allowed.

## 21.5 OUT_OF_SCOPE

Adjacent modules and future extensions explicitly forbidden.

## 21.6 IMPLEMENTATION

Expected deterministic behavior, never exact code guessed in advance when GA0 must choose physical forms.

## 21.7 TESTS

- unit ;
- adversarial ;
- reconciliation ;
- contract ;
- regression ;
- typecheck/build as relevant.

## 21.8 HARD_STOP

Use standard catalog.

## 21.9 DELIVERABLE

Phase report + changed files + tests + migrations if any.

## 21.10 EXIT_GATE

Exact `PASS / PARTIAL / BLOCKED` wording.

## 21.11 REGRESSION_SET

Previous phase suites that must rerun.

## 21.12 EXTENSION_COMPATIBILITY — DO NOT IMPLEMENT

Mandatory in every A→H prompt.

### Media

```text
no Analytics dependency on media
absence of media ≠ missing analytics
refs only, never blobs
```

### Contextual Summary

```text
narrable deterministic outputs
publication/facts lineage preserved
no AI logic
```

### Benefit Wallet

```text
purchase ≠ funding ≠ bank transaction
provider-agnostic
no Swile-specific analytics
```

### Diagnostic

```text
support/coverage/provenance/method/revision observable
no Diagnostic implementation unless prompt explicitly belongs to future Diagnostic project
```

### Import

```text
declare dependencies
no Refresh Planner implementation
no business calc at navigation
```

---

# 22. GA0 rebase contract — detailed

GA0 is the single most important prompt after HC6.

## 22.1 Inputs

Must read :

```text
AGENTS.md
Master Global final
Global registries
Global audits 01→08
History audits 20→24
HC1 report
HC2 report
HC3 report
HC4 report
HC5 report
HC6 POST_HISTORY_ENTRY_GATE
current code
current migrations
current Supabase schema/data read-only
```

## 22.2 Required comparisons

For every foundation / capability / engine :

```text
TARGET
vs
CURRENT_CODE
vs
CURRENT_SUPABASE
vs
HISTORY_FINAL_CONTRACT
```

## 22.3 Required classifications

Only :

```text
REUSE
ADAPT
NEW_METRIC
NEW_ENGINE
NEW_FACT
NEW_READMODEL
NEW_DATA
REMOVE_LEGACY
AUTHORITY_GATED
```

No `PROVISIONAL_*` survives GA0.

## 22.4 Required final dependency matrix columns

At minimum :

```text
GLOBAL_OUTPUT
MODULE
ENGINE
CANONICAL_INPUTS
FACT_INPUTS
UPSTREAM_ANALYTICS
OTHER_MODULE_DEPENDENCIES
NATURAL_GRAIN
TIME_WINDOW_POLICY
PERSON_SCOPE
ENTITY_SCOPE
SUPPORT_POLICY
COVERAGE_POLICY
MATERIALITY_POLICY
METHOD_VERSION
POLICY_VERSION
FACT_DEPENDENCIES
ENTITY_DEPENDENCIES
HISTORICAL_LOOKBACK
PUBLICATION_OUTPUTS
INVALIDATION_SCOPE
CLASSIFICATION
AUTHORITY_GATE
IMPLEMENTATION_OWNER_PHASE
REGRESSION_SET
```

## 22.5 Required prompt rebase output

For each provisional prompt ID A1→GC2 :

```text
KEEP_AS_IS
REWRITE
MERGE_WITH
SPLIT_INTO
DELETE_NOT_NEEDED
CONDITIONAL
BLOCKED
```

GA0 must then state exactly why.

## 22.6 GA0 cannot

- implement code ;
- create schema ;
- choose arbitrary authority ;
- bypass an AUTHORITY_GATED ;
- revive History oracle ;
- reuse legacy Global because it looks convenient.

## 22.7 GA0 exit

```text
GA0_ENTRY_GATE = PASS
```

only if A can start without unresolved structural ambiguity.

---

# 23. Legacy Global strategy

Current legacy stack includes :

```text
analysis_global_initial
analysis_global_baseline
analysis_global_typical
analysis_global_evolution
analysis_global_habits
analysis_global_profiles
analysis_global_universe
```

and old route under History.

This stack is :

```text
EXISTING
not TARGET AUTHORITY
```

GA0 must classify each primitive :

```text
REUSE technical
ADAPT
REMOVE_LEGACY
```

The final cutover must never create :

```text
old Global partly active
+ new Global partly active
```

as the user-facing truth.

The old test `check:analysis-global-contracts` can remain a temporary regression tool until H cutover but cannot certify M1→M10 V2.

---

# 24. Publication strategy to decide after HC3/HC4

The following decision remains intentionally deferred :

```text
new Global generation
= full restage
or
= immutable artifact reuse across generations
```

GA0/H1 must choose using :

- History durable manifest final ;
- immutability model ;
- rollback semantics ;
- factsHash/dependency closure ;
- storage costs ;
- complexity ;
- debug traceability.

Decision priority : correctness and explainability over storage micro-optimization.

---

# 25. Performance strategy

No speculative optimization before measurement.

## Initial page

Target architecture :

```text
light page shell
+ 10 compact primary module payloads
```

not one giant payload with all drilldowns.

## Expanded views

```text
lazy network loading
but precomputed business truth
```

## Hotspots to measure

- long time series ;
- Relation candidate matrix ;
- person×module duplication ;
- Place/entity detail cardinality ;
- Purchase/Product cardinality ;
- repeated supporting context ;
- duplicate arrays across RMs ;
- publication restage size ;
- N+1 Query patterns.

## Forbidden performance shortcut

Do not remove a meaningful analytical result solely because its payload is heavy. Redesign projection/granularity first.

---

# 26. Final deterministic core gate

`GLOBAL_DETERMINISTIC_CORE = PASS` requires at minimum :

```text
POST_HISTORY_ENTRY_GATE = PASS
GA0_ENTRY_GATE = PASS
A PASS
B PASS
C PASS
D CORE PASS
E PASS
F PASS
D recert PASS if impacted
G PASS
H PASS
```

plus :

```text
M1→M10 capability states explicit
AUTHORITY_GATED states explicit
no silent fallback
natural grain preserved
no universal Global observation window
no look-ahead
support PASS
coverage PASS
provenance PASS
knowledge states PASS
materiality PASS
relation robustness PASS
Moment causal boundary PASS
Place authority PASS
Purchase identity PASS
Persona comparability PASS
SharedParticipation PASS
dependency matrix closure PASS
publication manifest PASS
factsHash PASS
RuntimeSchemas 100%
single active Global generation PASS
immutability PASS
rollback/traceability PASS
correction→invalidation→new generation PASS
cache generation PASS
snapshot-only Query runtime PASS
React-no-Analytics PASS
cross-phase regressions PASS
performance baseline recorded
History regressions PASS
```

PASS does not mean :

- Swile implemented ;
- Edenred implemented ;
- Contextual Summary imported ;
- Media Manager built ;
- final Diagnostic built ;
- Import Console built.

---

# 27. Post-Global extension roadmap

## 27.1 Benefit Wallet audit

After deterministic Global core :

```text
Global final contracts
→ Benefit Wallet post-Global audit
→ generic wallet/funding model
```

## 27.2 Swile pilot

Provider adapter only.

Validate :

```text
PurchaseEvent unchanged conceptually
Actual still economic
funding split correct
no double counting
```

## 27.3 Edenred

Second adapter.

If adding Edenred requires rewriting M8 core, the wallet abstraction failed.

## 27.4 Rebuild History/Global

If Swile/Edenred adds new economic truth :

```text
new dataRevision
→ dependency plan
→ History affected generations
→ Global affected families
→ new publications
```

## 27.5 Contextual Summary

Only after deterministic outputs intended for narration are stable.

Manual export/import, no API AI.

## 27.6 Media final

Implement content layer without changing Analytics.

## 27.7 Diagnostic final

Read-only observer across all completed modules.

## 27.8 Import & Actualisation final

Only now can Refresh Planner be frozen against the full dependency graph.

---

# 28. What the user should do when Codex credits return

The immediate operational sequence remains History first :

```text
HC2
→ review
HC3
→ review
HC4
→ review
HC5
→ review
HC6
→ POST_HISTORY_ENTRY_GATE
```

Then :

```text
GA0
```

The prepared Global chain must **not** begin at A before GA0.

After each future prompt :

```text
Codex output/report
→ review PASS/PARTIAL/BLOCKED
→ only then next prompt
```

This keeps the preparation useful without making it rigid.

---

# 29. Final prompt-generation backlog

The future final prompts to generate from this map are :

```text
GA0
A1 A2 A3
B1 B2 B3 B4
C1 C2 C3 C4
D1 D2 D3
E1 E2 E3 E4
F1 F2 F3 F4
G1 G2 G3 G4
H1 H2 H3 H4 H5 H6
GC1 GC2
```

Each should be drafted only once we choose to prepare the executable pack, and all must begin with a rebase clause saying :

```text
Use GA0 final classifications and current code.
If this prompt conflicts with GA0 or a newer certified phase report,
STOP and report the conflict instead of following stale assumptions.
```

This single clause prevents the pre-History prompt pack from becoming a stale authority.

---

# 30. Risk register for implementation sequencing

| Risk | Severity | Owner | Prevention |
|---|---|---|---|
| History semantic drift | HIGH | GA0 | rebase HC1→HC6 |
| Legacy Global reused as target | HIGH | GA0/H | per-resource classification |
| Universal observationWindow reused | HIGH | A | natural window contract |
| Oracle reintroduced | CRITICAL | all | authority checks |
| React analytics | CRITICAL | H | static + runtime contract tests |
| Relation causal overclaim | CRITICAL | D/E | explicit causal evidence only |
| M2↔M8 cycle | HIGH | B/F | core + targeted recert |
| D↔E/F cycle | HIGH | D/E/F | core + targeted recert |
| bank operation = purchase | CRITICAL | F | PurchaseEvent invariant |
| Place GPS over-inference | CRITICAL | E | HC2 + coverage |
| Persona incomparable support | HIGH | G | common support |
| fake shared couple inference | CRITICAL | G | SharedParticipation evidence |
| publication partial mix | CRITICAL | H | manifest + atomic generation |
| cache stale after republish | HIGH | H | generation identity |
| Summary becomes analytics | CRITICAL | future I | deterministic corpus only |
| Media changes analytics | HIGH | future Media | content scoped |
| Refresh Planner becomes engine | CRITICAL | future Import | dependency orchestration only |
| Diagnostic self-validates | HIGH | future Diagnostic | independent checks |

---

# 31. Final readiness statement

The preparation performed before History final is intentionally **architecture-rich but implementation-provisional**.

What is already stable enough to preserve :

```text
product map
module order
grain doctrine
knowledge states
server/client boundary
History→Global boundary
future extension boundaries
test hierarchy
hard stops
phase sequencing
prompt structure
```

What must still be rebased after HC6 :

```text
physical reuse decisions
authority gates
exact Facts contracts
exact metric implementations
exact Global scope
exact dependency matrix
exact manifest/publication implementation
exact Query resources
exact legacy retirement
exact migrations
```

That is precisely the intended balance : the reasoning chain is prepared now, while the future implementation remains constrained by the final factual state of History and Supabase.

GLOBAL IMPLEMENTATION PREPARATION
READY_FOR_POST_HISTORY_REBASE