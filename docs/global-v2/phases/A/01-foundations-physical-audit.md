# A1 — Physical Foundations Audit + Contract Freeze

## 1. Executive verdict

`GLOBAL PHASE A1 = PASS`.

The post-History baseline is structurally compatible with the Global V2 target. The target contracts are frozen below without introducing a universal business window, weakening strict validation, inventing an authority, or modifying product code. The implementation strategy is additive: keep the current `AnalysisScope` and Global V1 path intact, introduce a parallel strict Global V2 foundation, and let later phases cut consumers over deliberately.

The only physical delta requiring a Fact adaptation is person attribution on `EconomicComponentFact`. The live table already contains explicit evidence, but the current projector always emits `unknown`. The A2 plan is fail-closed at the exact financial-source grain: beneficiary evidence may be projected; payer/account ownership/co-presence never may; absent or ambiguous evidence remains unresolved.

No hard stop remains open for A2. The 31 GA0 authority gates remain closed capability boundaries and are not treated as missing foundation authority.

```text
POST_HISTORY_ENTRY_GATE = PASS
FINAL_HISTORY_COMMIT = 9a70f9b1643747f8d60214cf66c94f58d193112c
GA0_ENTRY_GATE = PASS
B1_STATUS = MERGED_INTO_A1
SUPABASE_WRITES = 0
PRODUCT_CODE_CHANGES = 0
```

## 2. Baseline GA0/History used

- Git baseline: branch `main`, HEAD `9a70f9b1643747f8d60214cf66c94f58d193112c`.
- GA0 baseline: `GA0_ENTRY_GATE = PASS`, `UNRESOLVED_HARD_STOPS = 0`, classifications `REUSE=14`, `ADAPT=15`, `NEW_METRIC=10`, `NEW_ENGINE=16`, `NEW_FACT=0`, `NEW_READMODEL=11`, `NEW_DATA=1`, `REMOVE_LEGACY=14`, `AUTHORITY_GATED=35`.
- Final History baseline: `POST_HISTORY_ENTRY_GATE = PASS`, 12/12 months, 15/15 Query families, 947/947 Query payloads, 24/24 artifacts, 12/12 durable manifests and 971/971 dependency closures.
- Live revisions inherited from the final History gate: `dataRevision=1`, `analyticsRevision=79`.
- GA0 decisions used as fixed inputs: A1=`REWRITE`, A2=`REWRITE`, A3=`REWRITE`, old B1=`MERGE_WITH A1`; no pre-History prompt is executable as-is.
- Authority order used: Master target → GA0 post-History baseline → final History foundations → current specs → code/Supabase physical reality.

No History output, manifest, snapshot, artifact or active generation was changed by A1.

## 3. Sources and code read

Normative and planning sources:

- `AGENTS.md`;
- `Brief_Technique_Analyse_Globale_V2_FINAL_EXHAUSTIF_MASTER.docx`, including its requirements, capability, authority-gate, test and conceptual-plan registers;
- `docs/global-v2/GA0-post-history-reality-check.md`;
- `docs/global-v2/GLOBAL_ANALYTICS_DEPENDENCY_MATRIX.md`;
- `docs/global-v2/GLOBAL_PROMPT_REBASE_TABLE.md`;
- final History reports 25 through 30;
- `docs/specs/SOURCE_OF_TRUTH.md`;
- `docs/specs/SUPABASE_V2_REFERENCE.md`;
- `docs/specs/ANALYTICS_MATERIALIZATION.md`.

Physical code inspected:

- `src/core/scope/{types,normalize,validation,hash,schema}.ts`;
- `src/core/metrics/{availability,support,coverage,provenance,metric-envelope,reference-meta}.ts`;
- `src/core/history-v2/{quality,reason-codes,policy-versions,publication}.ts`;
- `src/analytics/facts/{types,canonical,validation,index}.ts`;
- `src/analytics/context/operations.ts`;
- `src/analytics/production/{types,registry,producer,validation,period-qualification}.ts`;
- `src/analytics/insights/marked-facts.ts`;
- relevant `src/analytics/history-v2/*`, especially dependency graph, facts hash, balance authority and shared doctrines;
- `src/server/canonical/repository.ts`;
- `src/server/analytics/fact-source-resolver.ts`;
- `src/server/analytics/materialization/{identity,global-planner,store,history-v2,history-manifest-store}.ts` for boundary evidence only;
- `src/query-api/analysis/global/*` and `src/server/query/sources/analysis.ts` as legacy existing code only;
- navigation/query/materialization consumers returned by the mandatory `observationWindow` and `AnalysisScope` searches.

Read-only Supabase inspection targeted project `ipuuhxrblxormwgoaqnz`: `financial_source_person_links` columns, constraints, indexes, relation/source cardinalities and aggregate exact-source coverage against `financial_economic_cost_canonical`. No row identifier, personal label or financial amount is recorded in this report.

## 4. Current foundation inventory

| Foundation | Current implementation | Physical finding | Decision |
|---|---|---|---|
| Scope/time | `AnalysisTime.global = {observationWindow, asOf: YearMonth}`; strict parser and `analysis-scope:v1` hash | One universal monthly window is embedded in identity and consumed across navigation, Query, Facts and materialization | Keep V1; add separate V2 scope/time contract |
| Knowledge | core metrics has four lowercase states; History V2 has the five exact uppercase states | History V2 already enforces value/no-value invariants and PARTIAL | Reuse History state semantics; add Global qualification only |
| Partial | History `PartialMeaning = LOWER_BOUND | OBSERVED_ONLY` | Master additionally requires five machine-readable causes | Reuse meanings, add Global `PartialReason` |
| Support | legacy `Support` counts one unit; History `Support` is light | Neither represents eligible/observable/included/gaps/comparable support completely | Add Global support envelope; do not mutate History payloads |
| Coverage | legacy complete/partial; History ratio/numerator/denominator/basis | History shape is close, but lacks typed dimensions and effective-min semantics | Add typed Global coverage set reusing strict ratio rules |
| Provenance | legacy 3-value enum; History canonical/derived/imported/manual refs | Master needs result nature, precision, integration mode, monetary basis, revisions and lineage | Add Global evidence/provenance envelope |
| Versions | metric `methodVersion`; History policy registry and resource signatures | Version patterns exist and are deterministic | Reuse branded versions; add Global engine/policy identity |
| Dependency closure | HC3 History groups + durable manifest | History closure is resource-specific and monthly | Add declarative Global dependency contract; H owns manifest |
| Capability | Query capabilities and GA0 registry exist separately | Authority-gated is not an analytic data state | Add explicit capability/authority result contract |
| Person/entity | root subject household/person; Fact person dimension exists | ECF projector always `unknown`; only one current consumer filters it | Adapt exact-source attribution in A2 |
| Materiality | `marked_facts_materiality_v1` total/category only | Thresholds, robust-Z and deterministic anti-overlap are useful precedents, not the target engine | Freeze shared candidate contract; engines stay out of A2 |
| Global legacy | seven `analysis_global_*` resources calculate/read dynamically around `observationWindow` | Existing, not target doctrine | Preserve until H cutover; never use as target contract |
| Publication | monthly History frozen publication is certified; current global identity only has `asOf: YearMonth` | Global profile/manifest strategy is not an A2 responsibility | H1/H2 owner |

The consumer search found 23 product/script files containing `observationWindow`, including scope, navigation, Query schemas/builders, Fact range resolution, materialization identity/store and the legacy Global page. It found 47 product/script files consuming `AnalysisScope`, `NormalizedAnalysisScope`, scope serialization or hash. This rules out an in-place V1 type rewrite.

## 5. GLOBAL_TIME_CONTRACT_FREEZE

### 5.1 Root contract

A2 must introduce a parallel target contract, not mutate the V1 one:

```ts
type GlobalAnalysisTimeV2 = {
  readonly kind: "global_v2";
  readonly asOf: Instant;
  readonly certifiedThrough: LocalDate;
  readonly liveThrough?: LocalDate;
};

type GlobalAnalysisScopeV2 = {
  readonly subject: AnalysisSubject; // household | one proved PersonId
  readonly time: GlobalAnalysisTimeV2;
  readonly filters?: AnalysisFilters;
};
```

Rules:

1. `asOf` is the exact timezone-bearing read instant, not a month.
2. `certifiedThrough` is the last date admitted to certified structural history.
3. `liveThrough`, when present, is the last non-certified date visible descriptively and must be strictly after `certifiedThrough` and not after the local date derived from `asOf` in the Household timezone.
4. Absence is encoded by an absent property, never `undefined`.
5. `observationWindow` is absent from every V2 scope and is not replaced by another universal business window.
6. `AnalysisScope`, `AnalysisTime`, `normalizeAnalysisScope`, `analysisScopeSchema`, `analysis-scope:v1` and all existing consumers remain unchanged and become explicitly legacy-compatible foundations.
7. V2 parsing remains strict; unknown keys, invalid chronology and present-`undefined` values fail.

Legacy-only fields/contracts are frozen explicitly:

| Existing field/contract | Status after A2 |
|---|---|
| `AnalysisTime.global.observationWindow` | legacy-only; valid only in V1 scope |
| `AnalysisTime.global.asOf: YearMonth` | legacy-only monthly boundary; not V2 `asOf` |
| `ReferenceMeta.requestedObservationWindow/effectiveWindow` | legacy/reference compatibility only; not a Global V2 root window |
| `AnalysisGlobalIdentity.observationWindow/asOf` in `src/query-api/analysis/global/*` | legacy Query identity until H cutover |
| `MaterializationPeriodIdentity.global.asOf: YearMonth` | legacy materialization identity until H defines the Global V2 profile |

### 5.2 Natural grain and natural window

```ts
type GlobalNaturalGrain =
  | "MONTH" | "WEEK" | "DAY" | "PERSON_DAY"
  | "ECONOMIC_COMPONENT" | "OCCURRENCE" | "VISIT"
  | "MOMENT" | "PURCHASE_EVENT";

type HistoricalLookback =
  | { readonly kind: "ALL_RELIABLE" }
  | { readonly kind: "LAST_ELIGIBLE_UNITS"; readonly count: number }
  | { readonly kind: "DECLARED_RANGE"; readonly start: LocalDate; readonly end: LocalDate }
  | { readonly kind: "COMPARABLE_INTERSECTION"; readonly unit: GlobalNaturalGrain };

type GlobalTimeWindowPolicy = {
  readonly policyId: string;
  readonly policyVersion: PolicyVersion;
  readonly naturalGrain: GlobalNaturalGrain;
  readonly corpus: "CERTIFIED_HISTORY" | "CERTIFIED_PLUS_DESCRIPTIVE_LIVE_TAIL";
  readonly lookback: HistoricalLookback;
  readonly gapPolicy: "PRESERVE";
  readonly comparableIntersection: "NOT_REQUIRED" | "EXACT_NATURAL_UNIT";
};
```

Every engine/resource declaration must reference one policy. A resolved execution window records `supportStart`, `supportEnd`, eligible/observed/included units and gaps. Month is legitimate only for monthly economics; it cannot be imposed on occurrences, visits, person-days, Moments or PurchaseEvents.

`PERSON_DAY` and `ECONOMIC_COMPONENT` are deliberately present in the target union because the Master defines those as natural grains for exposure and finance, even where an illustrative shorter grain list names only month/week/day/occurrence/visit/Moment/PurchaseEvent. This is a faithful expansion of the same doctrine, not a new business window.

### 5.3 Identity and hashing

- V2 root canonical serialization includes `subject`, exact `asOf`, `certifiedThrough`, optional `liveThrough`, and normalized filters in a fixed key order.
- Hash prefix is new and immutable, proposed `global-analysis-scope:v2\n`; it can never collide with `analysis-scope:v1\n`.
- Per-resource identity additionally hashes the time-window policy ID/version, natural grain and resolved support/window digest. Two resources sharing a root may therefore have different admissible corpora without different root URLs.
- Strict JSON only: no `undefined`, `Date`, `Map`, non-finite number or implicit decimal rounding. Set-like arrays are de-duplicated and lexically sorted; ordered business arrays preserve order and declare that fact.
- Changing only `asOf` changes root identity. Changing `certifiedThrough`/`liveThrough`, the resolved eligible set, gaps, policy or relevant revisions changes the relevant dependency/resource hash.

### 5.4 Structural no-lookahead

Structural engines accept only facts/analytics whose effective natural date is `<= certifiedThrough`. LIVE_TAIL is delivered through a separately typed input and cannot enter trend, change-point, persistence, regime or phase dependencies. A structural output whose closure contains a LIVE_TAIL dependency fails with `LIVE_TAIL_AUTHORITY_LEAK`; it is never downgraded silently.

## 6. CERTIFIED_HISTORY_LIVE_TAIL_CONTRACT

```ts
type CorpusAuthority = "CERTIFIED_HISTORY" | "LIVE_TAIL";

type CorpusSlice = {
  readonly authority: CorpusAuthority;
  readonly start?: LocalDate;
  readonly end: LocalDate;
  readonly support: GlobalSupport;
  readonly provenance: GlobalValueProvenance;
  readonly dependencyRefs: readonly string[];
};
```

- Certified History (CH) is authoritative for structural trends, change points, persistence, regimes, phases, Typical/Minimal references, structural comparisons, Persona reference and certified summary inputs.
- LIVE_TAIL (LT) may describe current counters, new observed activity/visit/Moment and descriptively confirm an already-certified phase. Every LT value carries its authority, support, coverage and provenance.
- Target intervals are disjoint: CH ends inclusively at `certifiedThrough`; LT begins strictly after it and ends at `liveThrough`. If no LT exists, `liveThrough` and the LT slice are absent—not empty/zero.
- A record duplicated between CH and LT is deduplicated by its stable source identity and the overlap is reported. Contradictory authorities yield `CONFLICT`; an LT record is never allowed to overwrite CH.
- Gaps before/inside CH remain CH support gaps. A gap between CH and LT remains visible and prevents any claim of continuity. Gaps in LT qualify only the descriptive LT result.
- Both slice identities and dependency digests participate in resource hashing. LT dependencies are prohibited from structural output declarations.

Adversarial decisions:

| Case | Required result |
|---|---|
| One recent LT month reverses a CH trend | Display descriptive divergence; do not create a new certified trend/phase |
| LT repeats a CH source identity | One contribution; overlap evidence retained; no double count |
| LT contradicts CH for the same authoritative identity | `CONFLICT`; no preferred value |
| CH ends 30 June, LT starts 3 July | 1–2 July are explicit gaps; no continuity claim |
| No post-certification data | No `liveThrough`, no LT result, no synthetic empty series |

## 7. KNOWLEDGE_STATE_CONTRACT

The exact target states are reused from History V2:

- `KNOWN`: value assertable for the declared universe; no known missing part.
- `PARTIAL`: value exists for a proved subset/lower bound and is explicitly qualified.
- `UNKNOWN`: no reliable value; it carries no value and is never zero.
- `NOT_APPLICABLE`: the concept does not apply to this scope; not a data failure.
- `CONFLICT`: authoritative evidence contradicts; no value is chosen.

A2 must reuse `DataStatus` and the proven History value/no-value rules rather than the lowercase V1 `Availability` as the Global target. Global values add qualification fields without altering existing History payloads. A capability status is not a knowledge state: a gated feature can be `UNAVAILABLE` while its underlying observed facts remain `KNOWN`.

Examples:

| State | Valid example | Invalid shortcut |
|---|---|---|
| KNOWN | Actual over the complete declared certified economic universe | Calling a small observed subset the full universe |
| PARTIAL | Localized spend known for 136 of 1,484 eligible components, labeled observed subset | Publishing the observed amount as complete localized spend |
| UNKNOWN | Beneficiary absent for an economic component | `personId=household owner` or amount `0` |
| NOT_APPLICABLE | Product-cycle result for a concept where cycle is inapplicable | Using it for missing Product identity |
| CONFLICT | Two incompatible authoritative classifications | Picking the latest/first row silently |

Missing media never changes these states. It changes presentation capability only.

## 8. PARTIAL_REASON_CONTRACT

History `PartialMeaning` is reused exactly (`LOWER_BOUND`, `OBSERVED_ONLY`). Global adds a required non-empty, de-duplicated, sorted set when `status=PARTIAL`:

```ts
type GlobalPartialReason =
  | "OBSERVED_SUBSET"
  | "LOWER_BOUND"
  | "MISSING_INTERVALS"
  | "MISSING_LINKAGE"
  | "PARTIAL_SOURCE";
```

`LOWER_BOUND` as a meaning says how to read the value; `LOWER_BOUND` as a reason records why the universe is partial. `MISSING_LINKAGE` covers, for example, a provable spend population lacking some explicit person/place linkage. Small sample size alone is a support condition and must not create PARTIAL. Non-PARTIAL states cannot carry partial reasons.

## 9. SUPPORT_CONTRACT

```ts
type GlobalSupportStatus =
  | "INSUFFICIENT" | "PARTIAL_SUPPORT" | "SUFFICIENT" | "STRONG";

type GlobalSupport = {
  readonly naturalGrain: GlobalNaturalGrain;
  readonly eligibleUnits: number;
  readonly observedUnits: number;
  readonly includedUnits: number;
  readonly excludedObservedUnits: number;
  readonly minimumRequired: number;
  readonly supportStatus: GlobalSupportStatus;
  readonly supportStart?: LocalDate;
  readonly supportEnd?: LocalDate;
  readonly gapCount?: number;
  readonly largestGapUnits?: number;
  readonly occurrenceCount?: number;
  readonly matchedSetCount?: number;
  readonly comparableEntityCount?: number;
  readonly policyRef: string;
};
```

Invariants: all counts are non-negative integers; `includedUnits <= observedUnits <= eligibleUnits`; `excludedObservedUnits = observedUnits - includedUnits`; missing units are `eligibleUnits - observedUnits`; zero eligible units is represented but cannot yield a percentage coverage; date bounds are absent together or ordered; the status is policy-derived, never inferred only from volume. Support is not coverage.

Adversarial cases:

| Case | Frozen interpretation |
|---|---|
| 12 calendar months, 8 eligible | `eligibleUnits=8`; calendar span may still be 12, but support is 8 months |
| 100 occurrences over 20 observable days | occurrence support and person-day exposure are separate counters/grains |
| Person A has 12 comparable months, B has 7 | direct comparison uses the common exact intersection, not 12 or an average |
| 10,000 rows with incompatible entities/units | quantity may be strong; comparable support remains insufficient |
| Recent data only in LT | descriptive LT support only; certified structural support unchanged |
| 10 months with a 3-month gap | `gapCount`/`largestGapUnits` retained; no zero fill; policy may segment/reject trend |

## 10. COVERAGE_CONTRACT

Coverage always proves a numerator and denominator for a named universe:

```ts
type GlobalCoverageDimension =
  | "FINANCIAL_SOURCE" | "CLASSIFICATION" | "NEED"
  | "PERSON_ATTRIBUTION" | "PERSON_DAY" | "PLACE"
  | "PARTICIPANT" | "PURCHASE_EVENT" | "PRODUCT"
  | "MOMENT_METADATA" | "MOMENT_PARTICIPANT" | "MOMENT_FINANCIAL"
  | "COMPARABLE_PERSON_SUPPORT";

type GlobalCoverageMeasure = {
  readonly dimension: GlobalCoverageDimension;
  readonly status: "KNOWN" | "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT";
  readonly numerator?: number;
  readonly denominator?: number;
  readonly ratio?: number;
  readonly unit: string;
  readonly basis: string;
  readonly evidenceRefs: readonly string[];
  readonly policyRef: string;
};

type GlobalCoverageSet = {
  readonly dimensions: readonly GlobalCoverageMeasure[];
  readonly requiredDimensions: readonly GlobalCoverageDimension[];
  readonly effective?: number;
  readonly aggregation: "MIN_REQUIRED_DIMENSIONS";
};
```

For KNOWN/PARTIAL ratios, denominator is strictly positive, numerator is between zero and denominator, and ratio equals the quotient. If the denominator is not provable, the measure is UNKNOWN and has no invented ratio. If the eligible universe is genuinely empty, the dimension is NOT_APPLICABLE rather than 100%. Effective coverage is the minimum of all required resolved dimensions, never an average.

Required patterns:

- localized finance: resolved canonical-place economic components / eligible localizable economic components;
- person attribution: economically eligible components (and, for monetary use, eligible economic amount) explicitly attributable / eligible population; payer/account owner is not numerator evidence;
- classification: amount/components with a usable canonical classification / eligible amount/components;
- Activity: admissible occurrences (and exposed person-days when the metric needs rates) / eligible occurrences/days;
- Place: sufficiently located person-days or explicit visit occurrences according to the declared metric—not GPS presence alone;
- PurchaseEvent: resolved PurchaseEvent facts / eligible financial events after declared exclusions; a bank operation is not automatically an event;
- comparable Persona: exact comparable natural units included for every compared person / exact eligible intersection.

Adversarial decisions: a known localized amount over a small population does not imply 100%; GPS presence does not prove localized finance; a known account does not prove beneficiary; a known transaction does not prove PurchaseEvent.

## 11. PROVENANCE_EVIDENCE_CONTRACT

The target extends, rather than replaces, History provenance:

```ts
type GlobalValueProvenance = {
  readonly resultNature: "OBSERVED" | "DECLARED" | "ESTIMATED" | "HYBRID";
  readonly precision: "EXACT" | "APPROXIMATE" | "RANGE";
  readonly integrationMode:
    | "INFORMATIONAL_ONLY" | "SUPPLEMENT_UNOBSERVED"
    | "REPLACEMENT_ESTIMATE" | "DERIVED_FROM_OBSERVED";
  readonly monetaryBasis:
    | "AUTHORITATIVE_ECONOMIC" | "ENRICHED_ANALYTICAL" | "CONTEXTUAL_ESTIMATE";
  readonly sourceRefs: readonly string[];
  readonly factRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly entityRefs: readonly string[];
  readonly upstreamMetricRefs: readonly string[];
  readonly replacesContributionIds?: readonly string[];
  readonly derivedFromContributionIds?: readonly string[];
  readonly coverageGapRef?: string;
  readonly methodVersion?: MethodVersion;
  readonly policyVersions: Readonly<Record<string, PolicyVersion>>;
  readonly dataRevision: DataRevision;
  readonly analyticsRevision: AnalyticsRevision;
  readonly publicationLineage?: {
    readonly publicationId: string;
    readonly revision: number;
    readonly factsHash: string;
    readonly manifestHash?: string;
  };
  readonly estimateLifecycle?: "DYNAMIC" | "SNAPSHOT";
};
```

Refs are stable machine identities, never labels or narrative text. Before values are added, the engine must prove phenomenon identity, economic identity, integration mode and monetary basis, and show no overlap. If it cannot, the values cannot be added. The exact source/fact/entity/upstream refs and revisions must be hashed through the dependency closure; optional publication lineage is included only when an upstream materialized publication is the actual source.

## 12. METHOD_POLICY_IDENTITY_CONTRACT

```ts
type GlobalEngineIdentity = {
  readonly engineId: string;
  readonly methodVersion: MethodVersion;
  readonly naturalGrain: GlobalNaturalGrain;
  readonly statisticalPolicy?: { readonly id: string; readonly version: PolicyVersion };
  readonly timeWindowPolicy: { readonly id: string; readonly version: PolicyVersion };
  readonly supportPolicy: { readonly id: string; readonly version: PolicyVersion };
  readonly coveragePolicy: { readonly id: string; readonly version: PolicyVersion };
  readonly materialityPolicy?: { readonly id: string; readonly version: PolicyVersion };
};
```

Rules:

- Bump `methodVersion` for formula, statistic, admissibility/exclusion, attribution, comparison, deterministic tie semantics or published semantic changes. This aligns with existing `requiresMethodVersionBump()`.
- Bump the specific policy version for threshold, lookback/window, support, coverage, materiality, gap or authority-policy changes. If the output meaning also changes, bump method and policy.
- Result-preserving refactors, indexes and cache changes do not bump a semantic version, but the relevant implementation digest may change in the eventual H manifest.
- Resource method signatures canonically hash the engine method, all referenced policy IDs/versions, natural grain and target contract version. Any relevant version change changes dependency closure/resource identity and requires a new candidate generation.
- Versions are never inferred from Git timestamps or filenames.

## 13. DEPENDENCY_DECLARATION_CONTRACT

Every future Global analytics/resource declaration must be strict and complete:

```ts
type GlobalDependencyDeclaration = {
  readonly declarationVersion: "global-dependency-declaration@v1";
  readonly resourceId: string;
  readonly factDependencies: readonly DependencyRef[];
  readonly entityDependencies: readonly DependencyRef[];
  readonly upstreamAnalytics: readonly DependencyRef[];
  readonly otherModuleDependencies: readonly DependencyRef[];
  readonly naturalGrain: GlobalNaturalGrain;
  readonly timeWindowPolicy: PolicyRef;
  readonly historicalLookback: HistoricalLookback;
  readonly personScope: GlobalPersonScopePolicy;
  readonly entityScope: GlobalEntityScopePolicy;
  readonly supportPolicy: PolicyRef;
  readonly coveragePolicy: PolicyRef;
  readonly materialityPolicy?: PolicyRef;
  readonly methodVersion: MethodVersion;
  readonly policyVersions: Readonly<Record<string, PolicyVersion>>;
  readonly publicationOutputs: readonly PublicationOutputRef[];
  readonly invalidationScope: GlobalInvalidationScope;
  readonly capabilityRequirements: readonly CapabilityRequirement[];
};
```

`DependencyRef` contains stable kind/ID, required/optional status and the declared scope relation. Required arrays are present even when empty. Set arrays are canonicalized by stable ID; duplicates conflict. A declaration is incomplete if a real Fact/entity/upstream/module/policy input is omitted. A2 validates the declaration and computes its deterministic declaration digest; it does not build the Global publication manifest. H1/H2 owns resolved input digests, publication facts hash, manifest, persistence, rollback and publication profile.

Invalidation scopes are explicit unions: exact resource, exact entity, affected natural-date interval, affected person scope, affected module or full Global generation. No invalidation is derived from the legacy universal window.

## 14. CAPABILITY_AUTHORITY_CONTRACT

```ts
type GlobalCapabilityState = "AVAILABLE" | "PARTIAL" | "UNAVAILABLE" | "CONFLICT";

type GlobalCapability = {
  readonly capabilityId: string;
  readonly state: GlobalCapabilityState;
  readonly authorityGateIds: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly supportedPersonScopes: readonly GlobalPersonScopeKind[];
  readonly supportedEntityScopes: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly policyRef: string;
};
```

- `AVAILABLE` requires every referenced authority gate to be open for the requested scope and required support/coverage to be satisfiable.
- `PARTIAL` exposes only the proved sub-capability and its boundaries; it does not upgrade the analytic knowledge state.
- `UNAVAILABLE` suppresses the capability/output branch with a machine reason; it is not automatically an UNKNOWN metric.
- `CONFLICT` means capability authorities contradict; no engine result may be selected.
- A closed `AUTHORITY_GATED` registry entry can never be serialized as AVAILABLE.

All GA0 gates AG001–AG031 remain UNAVAILABLE. In particular, Place routine role, Mobility/Route/Fuel, Product/Cycle/Price Index and Contact/Social branches stay closed. Raw tables, labels, GPS points, operation items or participation rows do not open them.

## 15. PERSON_ENTITY_SCOPE_CONTRACT

Root navigation retains only household or one proved PersonId. Analytics declarations may additionally describe comparison/shared scopes without inventing a synthetic couple:

```ts
type GlobalPersonScopePolicy =
  | { readonly kind: "HOUSEHOLD" }
  | { readonly kind: "PERSON"; readonly personId: PersonId }
  | { readonly kind: "COMPARABLE_PERSONS"; readonly personIds: readonly PersonId[]; readonly intersectionPolicy: PolicyRef }
  | { readonly kind: "EXPLICIT_SHARED"; readonly personIds: readonly PersonId[]; readonly evidencePolicy: PolicyRef };

type GlobalEntityScopePolicy =
  | { readonly kind: "NONE" }
  | { readonly kind: "ENTITY_SET"; readonly entityType: string; readonly entityIds: readonly string[] };
```

Person IDs must belong to the authorized Household, be unique and sorted. `COMPARABLE_PERSONS` compares only exact common natural units. `EXPLICIT_SHARED` requires authoritative participation/beneficiary evidence for every included unit; co-presence alone is insufficient. Entity IDs are stable canonical IDs, never labels. Coverage is computed separately per person and for the intersection.

## 16. ECONOMIC_COMPONENT_PERSON_ADAPTATION_PLAN

### 16.1 Physical evidence

`financial_source_person_links` has exact source kinds `Operation`, `Allocation`, `Item`, `Cash_use`; relation types are constrained to `payer`, `beneficiary`, `beneficiary_share`; `share` is null or in `(0,1]`; exactly one source FK must match `source_kind`; `(source, person, relation_type)` is unique. It has no `household_id`, so Household membership must be proved through the authorized source component and `context.persons`.

Live aggregate, read-only:

| ECF source kind | Eligible components | Components with exact link | Exactly one beneficiary | Multiple beneficiaries | No beneficiary authority |
|---|---:|---:|---:|---:|---:|
| Allocation | 34 | 16 | 16 | 0 | 18 |
| Cash_use | 40 | 0 | 0 | 0 | 40 |
| Item | 13 | 10 | 10 | 0 | 3 |
| Operation | 1,396 | 68 | 66 | 2 | 1,328 |
| Payment_component | 1 | 0 | 0 | 0 | 1 |
| **Total** | **1,484** | **94** | **92** | **2** | **1,390** |

The source table has 128 rows, all currently `beneficiary`, none `payer`/`beneficiary_share`; 96 rows match an active exact-grain ECF component, covering 94 components. Count-based complete single-beneficiary coverage is therefore `92/1,484 = 6.20%`; the two multi-beneficiary components are ambiguous, not shared by convention. Rows targeting sources not present in the active canonical component set are not projected.

Current code proof: `projectEconomicComponentFact()` sets `person: {kind:"unknown"}` unconditionally. `CanonicalRepository.projectEconomicComponentRows()` already validates each component's source kind/key but does not load person links. The only current ECF-person consumer found is `selectEconomicComponentsForSubject()` in `src/analytics/context/operations.ts`; Household paths do not filter on person.

### 16.2 Frozen resolution policy

Match only the component's own canonical source identity:

| ECF `source_kind` | Exact link source |
|---|---|
| Operation | same `operation_id = component_id` |
| Allocation | same `allocation_id = component_id` |
| Item | same `item_id = component_id` |
| Cash_use | same `cash_use_id = component_id` |
| Payment_component | unsupported by current person-link table → UNKNOWN |

No operation link is inherited by an Allocation, Item, Payment_component or Cash_use. No account-owner, merchant, label, Household, amount or 50/50 fallback is allowed.

Target ECF person attribution:

- one exact `beneficiary`, valid Household person, no competing beneficiary/share rows → resolved full beneficiary;
- zero beneficiary authority → unknown (`NO_EXPLICIT_BENEFICIARY` or `UNSUPPORTED_SOURCE_KIND`);
- more than one unshared `beneficiary` → conflict (`MULTIPLE_UNALLOCATED_BENEFICIARIES`);
- `payer` rows are retained as evidence outside beneficiary resolution but never resolve `person`;
- exact `beneficiary_share` rows are usable only as their explicit fractions: total=1 yields complete shared attribution; total<1 yields partial attribution; total>1, duplicate/mixed beneficiary semantics or out-of-Household person yields conflict;
- no unresolved state contributes to a person total as zero.

A2 may specialize `EconomicComponentFact.person` from generic `AnalyticDimensionValue<PersonId>` to a backward-readable `EconomicPersonAttribution` union supporting resolved, shared, partial, unknown, not-applicable and conflict plus stable evidence refs. Existing `{kind:"resolved",id}` reads remain valid. Person monetary aggregation must consume fractions only through a new coverage-aware selection result; it must not silently reuse whole component `net` for a shared/partial row.

### 16.3 Compatibility and hash impact

- Current active History publications are immutable and untouched.
- Household History calculations ignore `person`, so payload semantics stay unchanged; a future rebuild legitimately gets new Fact/dependency hashes because Canonical evidence changed.
- Current person-scoped legacy metrics may move from UNKNOWN to partially supported only after the adapted selector exposes coverage and the method/policy identity is bumped. A2 must not label them complete.
- No schema migration is required: the table, constraints and indexes already exist.

## 17. MATERIALITY_INSIGHT_FOUNDATION_BOUNDARY

`marked_facts_materiality_v1` is retained unchanged for its current total/category consumers. It proves useful patterns—versioned thresholds, robust-Z qualification, stable sort and phenomenon/evidence anti-overlap—but its candidate kinds and policy are not Global-complete.

A2 creates only shared contract primitives:

```ts
type GlobalMaterialityCandidate = {
  readonly candidateId: string;
  readonly phenomenonId: string;
  readonly parentPhenomenonId?: string;
  readonly metricRef: string;
  readonly effect: { readonly absolute?: string; readonly relative?: string; readonly standardized?: number };
  readonly knowledgeState: DataStatus;
  readonly support: GlobalSupport;
  readonly coverage: GlobalCoverageSet;
  readonly evidenceRefs: readonly string[];
  readonly entityRefs: readonly string[];
  readonly methodVersion: MethodVersion;
  readonly materialityPolicy: PolicyRef;
};
```

Boundary rules:

- Materiality answers whether a proved phenomenon is analytically important; UI selection answers which already-material candidates are presented.
- Neither layer repairs support/coverage/authority. Candidates failing required authority are ineligible, not scored as zero.
- Anti-redundancy uses explicit phenomenon, parent and evidence identities; never label similarity.
- Engine-specific score and thresholds remain policy-owned. The final deterministic tie fallback is stable phenomenon ID then candidate ID; presentation order is not a business score.
- A2 supplies types/parsers/identity only. `GlobalMaterialityEngine` is implemented first in B4 after B2/B3 provide real candidates, then reused by later modules. `InsightSelectionEngine` belongs to H3/H4 when all module candidates and publication outputs exist. Neither engine belongs to A2.

## 18. B1_MERGED_DELTA_HANDOFF

### 18.1 Authorities confirmed

| Concept | Decision | Exact authority/boundary |
|---|---|---|
| Actual | REUSE | `economic_consumption_net_attributable`, ECF net on economic timing; never bank flow |
| Typical | ADAPT | existing official `typical_month_cost` producer/reference-window logic; expose its actual included months, support, coverage and method identity |
| Minimal | ADAPT | existing official Canonical Minimal planning resolution; current compare-only evidence is never a source |
| M3 classification | REUSE | `EconomicComponentClassificationFact` and certified canonical/fallback policy; no Global reclassification |
| Category amount | REUSE | `category_amount` / ECF category aggregation; not a ReadModel sum in React |
| EXPECTED/oracle | EXCLUDED | comparison after production only; never Fact, source, builder input or payload input |

### 18.2 B2 boundary

B2 consumes exact monthly official outputs and their declared identities:

- monthly Actual series from ECF/economic timing plus its support/coverage;
- official Typical metric and `MonthReferenceWindow` (`includedPeriods`, exclusions, support, methodVersion);
- official Minimal metric and Canonical component resolution, with no `CertifiedHistoricalMinimalSource` injected;
- canonical classification facts and category amounts where required;
- A2 time/CH-LT, quality, support, coverage, provenance, method/policy and dependency declarations.

B2 creates only M1 bridge, residual and structural-equivalent outputs. It does not reimplement Actual/Typical/Minimal and does not consume History ReadModels as production facts.

### 18.3 B3 boundary and anti-cycle

B3 core consumes ECF, category/Need classifications, official category amount/Typical, stable M1 outputs and the A2 foundations. It remains complete without PurchaseEvent, product identity or M8. Merchant/purchase explanations are an optional future capability and remain unavailable while M19/AG002 are closed.

Future M8 declares a one-way optional enrichment dependency into B outputs. Opening it changes the optional dependency/policy hash and triggers targeted B recertification. M8 depends only on stable M1/M2 core inputs, never on its own enriched B output; therefore no B↔F cycle exists.

## 19. Extension compatibility invariants

### Media

- No Analytics dependency on media availability; absence of media never changes analytic knowledge state.
- Only stable optional entity/media refs; no blobs in Facts, Analytics, dependency declarations or hashes.

### Contextual summary

- Deterministic narrable outputs retain insight identity, support, coverage, provenance, evidence refs, limitations and publication lineage.
- AI/narrative text is never an Analytics input or authority.

### Benefit wallet

- Purchase ≠ funding ≠ bank transaction; economic consumption ≠ wallet funding ≠ bank flow.
- Contracts are provider-agnostic; no Swile/Edenred-specific Analytics primitive.

### Diagnostic

- Support, coverage, provenance, versions, revisions, dependencies, evidence refs and lineage remain machine-observable. A2 does not build a Diagnostic product.

### Import/actualisation

- Each engine declares inputs, dependencies, lookbacks, outputs, invalidation scope and rebuild semantics.
- Refresh Planner orchestrates official engines; it never reimplements them. No business calculation occurs on navigation.

## 20. Current-vs-target file map

| Area | Current file(s) | Current role | Target action/owner |
|---|---|---|---|
| Legacy scope | `src/core/scope/*` | V1 month/global scope with universal window | KEEP unchanged; V2 parallel files in A2 |
| Global V1 Query | `src/query-api/analysis/global/*`, `src/server/query/sources/analysis.ts` | Existing dynamic resources/RMs | KEEP until H cutover; no reuse as target doctrine |
| Navigation | `src/navigation/*`, `src/features/analysis/global/*` | Serializes V1 window | No A2 change; later Query/UI cutover |
| Quality | `src/core/history-v2/quality.ts`, reason codes | Certified five-state behavior | REUSE imports; Global extension in new folder |
| Legacy metrics | `src/core/metrics/*` | Current ProducedMetric contracts | KEEP; no in-place widening in A2 |
| Versions | `src/core/versions/*`, History policies, materialization identity | Branded versions/signatures | REUSE; compose Global identity in A2 |
| Facts person | `src/analytics/facts/{types,canonical,validation,index}.ts` | ECF person always unknown | ADAPT in A2 with exact evidence policy |
| Person loading | `src/server/canonical/repository.ts` | Does not load person links for ECF | ADAPT batched exact-source read in A2 |
| Person consumption | `src/analytics/context/operations.ts` | Resolved-only filter; no coverage result | Preserve legacy helper; add coverage-aware resolver in A2 |
| Dependency closure | History dependency/facts hash | Certified monthly closure | REUSE hashing concepts; new declaration only in A2; H manifest later |
| Materiality | `src/analytics/insights/marked-facts.ts` | total/category V1 selection | KEEP; shared candidate types A2, engine B4, selection H3/H4 |
| Publication | `src/server/analytics/materialization/*` | History plus legacy global mechanics | Read-only reference; no A2 change; H1/H2 owner |

## 21. Migration needs — document only

No migration is required for A2:

- `financial_source_person_links` and its four source FKs, relation/share checks and uniqueness index already exist live;
- the missing behavior is repository/projector consumption, not schema;
- Global publication/manifest physical decisions belong to H1/H2 and are deliberately not designed here;
- no retroactive person link, PurchaseEvent, classification or authority data may be fabricated.

If a future need arises to link `Payment_component` directly to a person, that is a new Canonical contract/migration requiring human validation. A2 must keep such components UNKNOWN rather than add a column or inherit the Operation link.

## 22. A_FOUNDATION_IMPLEMENTATION_PLAN

| ID | CONTRACT | CURRENT_FILE | TARGET_FILE | CURRENT_BEHAVIOR | TARGET_BEHAVIOR | REUSE_OR_ADAPT | DEPENDENCIES | CONSUMERS | MIGRATION_REQUIRED | LIVE_WRITE_REQUIRED | METHOD_VERSION_IMPACT | POLICY_VERSION_IMPACT | HISTORY_REGRESSION_SET | GLOBAL_FUTURE_CONSUMERS | TESTS_REQUIRED | HARD_STOP_IF |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A2-01 | Global V2 root time/scope | `src/core/scope/*` | `src/core/global-v2/{types,validation,hash}.ts` | global V1 requires monthly window/asOf month | strict Instant/CH/LT scope, no universal window, new hash namespace | ADAPT parallel | identity, time, validation | all Global engines/resources | NO | NO | new V2 identity only | time-boundary policy v1 | V1 scope/hash unchanged | B–H | strict parse, chronology, absent undefined, hash determinism | V1 identity changes or V2 accepts observationWindow |
| A2-02 | CH/LT and resolved natural windows | none exact | `src/core/global-v2/types.ts`, `validation.ts` | no typed authority boundary | disjoint corpus slices, no-lookahead, gaps | NEW primitive | A2-01 | B–G structural/descriptive engines | NO | NO | none | CH/LT policy v1 | History untouched | B–H | overlap/gap/no-LT/adversarial leak | LT can enter structural input |
| A2-03 | Knowledge/PARTIAL qualification | History quality | `src/core/global-v2/{types,validation}.ts` | five states proven; only 2 meanings | reuse states/meanings, require Global partial reasons | ADAPT composition | History quality | all Global outputs | NO | NO | none | quality policy v1 | History schemas byte-compatible | B–H | five states, value prohibition, partial reasons | UNKNOWN can carry value or PARTIAL lacks reason |
| A2-04 | Global support | core/History support | `src/core/global-v2/{types,validation}.ts` | incomplete counters/grains/gaps | eligible→observed→included, thresholds, gaps/intersection | ADAPT parallel | A2-01 | every engine | NO | NO | none | support policy v1 | existing support parsers unchanged | B–H | all adversarial support cases | support conflated with coverage |
| A2-05 | Global coverage | History coverage | `src/core/global-v2/{types,validation}.ts` | ratio/basis but no typed dimension/effective min | denominator-proof dimensions and min aggregation | ADAPT parallel | A2-03 | every engine/person/place/purchase | NO | NO | none | coverage policy v1 | History coverage unchanged | B–H | ratios, zero denominator, effective min, false-100 cases | denominator can be omitted for a ratio |
| A2-06 | Provenance/evidence | core/History provenance | `src/core/global-v2/{types,validation}.ts` | partial refs/authority | full typed result nature/integration/basis/revisions/lineage | ADAPT parallel | versions, revisions | all Global outputs/diagnostic | NO | NO | none | provenance policy v1 | History payloads unchanged | B–H/extensions | strict refs, no blobs/text, additive identity | values can combine without integration proof |
| A2-07 | Engine/method/policy identity | registry/History signatures | `src/core/global-v2/{types,validation,hash}.ts` | patterns exist per current domain | complete Global engine identity + canonical signature | REUSE+ADAPT | version brands | dependency declarations/H | NO | NO | new identities only | individual policy v1 | existing signatures unchanged | B–H | semantic-vs-technical bump table, hash sensitivity | relevant policy omitted from signature |
| A2-08 | Dependency declaration | History graph | `src/core/global-v2/{types,validation,hash}.ts` | monthly History groups only | strict declaration with all required dimensions | ADAPT | A2-01–07 | B–H; H resolves manifest | NO | NO | declaration digest v1 | declaration format v1 | History manifest untouched | B–H | completeness, duplicates, sensitivity/non-relevance | real input absent from declaration |
| A2-09 | Capability/authority registry | Query capabilities + GA0 doc | `src/core/global-v2/authority-gates.ts` | no shared authority-state contract | 31 closed gates plus scoped capability results | ADAPT | A2-03–05 | B–H RMs/engines | NO | NO | none | capability policy v1 | History capabilities unchanged | conditional C/E/F/G/H | AG001–031 consistency, closed≠available | closed gate becomes AVAILABLE |
| A2-10 | Person/entity scope | AnalysisSubject | `src/core/global-v2/{types,validation}.ts` | household/person root only | root reuse + comparison/shared/entity declaration | ADAPT | identity, A2-04/05/09 | G and any person-scoped engine | NO | NO | none | person-scope policy v1 | current scopes unchanged | B–H | membership, set order, intersections, no fake couple | unproved person/entity accepted |
| A2-11 | ECF person attribution | Fact types/projector/repository | existing Fact files + repository + context operation helper | person always unknown | exact-source beneficiary/shared/partial/conflict with coverage-aware selection | ADAPT | live table; A2-03–06/10 | later person financial metrics | NO | NO | person attribution consumers must bump before exposure | person-attribution policy v1 | active History untouched; future hashes expected to change; household parity | G1/G2/G3, scoped B–F | exact source kinds, payer exclusion, no link, multi-link, shares, coverage, History household parity | source inheritance or arbitrary beneficiary choice |
| A2-12 | Materiality candidate boundary | `marked-facts.ts` | `src/core/global-v2/types.ts` | total/category-only selection | support/coverage/evidence-qualified candidate contract only | ADAPT primitive | A2-03–07 | B4 engine, H selection | NO | NO | none | materiality-contract v1 | marked facts unchanged | B–H | deterministic canonical candidate, eligibility, anti-label heuristic | A2 implements/scopes a product engine |
| A2-13 | Gate/report | existing scripts/package | `scripts/check-global-v2-foundations.mjs`, `package.json`, A2 report | no A2 gate | one static/adversarial gate, typecheck/architecture | NEW test/doc | A2-01–12 | A3 | NO | NO | none | none | targeted History suites | A3 | all frozen cases and consumer guards | product/module/query/UI code enters diff |

## 23. Exact A2 IN_SCOPE

- Add strict Global V2 foundation types/parsers/hashes for time, CH/LT, natural grain/window, knowledge qualification, partial reasons, support, coverage, provenance/evidence, method/policy identity, dependency declarations, capability/authority and person/entity scope.
- Encode AG001–AG031 as still closed; do not open any authority.
- Adapt ECF person attribution from exact `financial_source_person_links` evidence, including deterministic unresolved/conflict/share behavior and coverage-aware selection.
- Preserve the existing V1 scope/hash/global resources and final History contracts.
- Add one targeted foundation gate, consumer guards, typecheck/architecture coverage and an A2 implementation report.
- Use only read-only fixture/Canonical reads in tests; no live dependency is required to pass A2.

## 24. Exact A2 OUT_OF_SCOPE

- `GlobalTemporalBoundaryResolver` execution engine;
- `GlobalMaterialityEngine`, `InsightSelectionEngine`;
- M1–M10 engines/metrics, Global ReadModels, RuntimeSchemas and Query resources;
- Global publication profile, manifest persistence, staging/finalize/rollback and strategy choice;
- React/navigation cutover and removal of `analysis_global_*`;
- Supabase migration/write/revision/backfill;
- PurchaseEvent population, product, wallet, media, summary, diagnostic, import or refresh planner;
- any change to final History active publications, payload contracts or frontend behavior.

## 25. Exact A2 changed-file candidates

Planned candidates only; A1 did not change them:

```text
src/core/global-v2/types.ts                         NEW
src/core/global-v2/validation.ts                    NEW
src/core/global-v2/hash.ts                          NEW
src/core/global-v2/authority-gates.ts               NEW
src/core/global-v2/index.ts                         NEW
src/analytics/facts/types.ts                        ADAPT person union
src/analytics/facts/canonical.ts                    ADAPT projector input/resolution
src/analytics/facts/validation.ts                   ADAPT strict person parser
src/analytics/facts/index.ts                        ADAPT exports
src/server/canonical/repository.ts                  ADAPT batched exact-source link load
src/analytics/context/operations.ts                 ADAPT/add coverage-aware person selection; preserve legacy helper
scripts/check-global-v2-foundations.mjs             NEW
scripts/check-architecture-imports.mjs              ADAPT only if a new import boundary is required
package.json                                        ADAPT add targeted gate script
docs/global-v2/phases/A/02-shared-foundation-contracts-report.md  NEW
```

`src/core/scope/*`, `src/core/history-v2/*`, `src/server/analytics/materialization/*`, `src/query-api/*`, React and Supabase migrations are explicitly excluded from the A2 changed-file set unless A2 stops and obtains a new reviewed plan.

## 26. Exact A2 regression set

Mandatory targeted A2 checks:

1. GA0 counts/gates consistency and AG001–AG031 closed-state registry.
2. V1 `AnalysisScope` parsing/normalization/canonical serialization/hash golden tests unchanged.
3. V2 time parser: Instant timezone, chronology, absent optional field, no `observationWindow`, deterministic v2 hash.
4. Natural-grain/window declarations, gaps and no-lookahead; LT cannot satisfy structural input.
5. KNOWN/PARTIAL/UNKNOWN/NOT_APPLICABLE/CONFLICT and partial-reason invariants.
6. Six support adversarial cases from section 9.
7. Coverage denominator/effective-min and false-100 adversarial cases from section 10.
8. Provenance/evidence strict serialization, additive identity and revision/version hash sensitivity.
9. Dependency declaration completeness, set/order behavior, relevant-change sensitivity and irrelevant-change stability.
10. Capability-state/knowledge-state independence and authority-gate fail-closed behavior.
11. Person exact-source matrix: one beneficiary, no link, payer-only, multiple beneficiaries, full shares, partial shares, over-allocation/mixed relations, out-of-Household, unsupported Payment_component, no inheritance.
12. Person selection coverage; unresolved components excluded without becoming zero.
13. Household Actual/Typical/Minimal and final History household ReadModel parity; future dependency hash change explicitly expected when person evidence enters ECF.
14. Oracle exclusion: no current/legacy evidence import in a production Global source.
15. M2 core dependency declaration contains no required M8/PurchaseEvent edge.
16. `marked_facts_materiality_v1` existing tests unchanged; A2 adds no product materiality result.
17. `npm run check:architecture`, `npm run typecheck`, targeted History transversal/materialization/facts tests, `git diff --check`.
18. Diff inventory proves no React, History builder/schema, materialization, migration or SQL file changed.
19. Supabase write count remains zero.

## 27. Hard stops / unresolved decisions

`UNRESOLVED_HARD_STOPS = 0` for A1/A2.

| Candidate stop | Result |
|---|---|
| Universal-window conflict | Closed by parallel V2 scope; V1 remains legacy-only |
| LIVE_TAIL authority leak | Closed by disjoint typed slices and structural dependency prohibition |
| Knowledge/support/coverage conflict | Closed by separate contracts and strict invariants |
| Dependency closure gap | Closed at declaration shape; resolved manifest remains correctly owned by H |
| Person attribution overclaim | Closed by exact-source beneficiary policy and conflict/unknown states |
| History semantic conflict | None; target composes certified foundations without changing History |
| Oracle production authority | Prohibited; Global adapter must not inject `CertifiedHistoricalMinimalSource` |
| Capability scope violation | AG001–AG031 stay closed; no gated capability is needed for A2 |

Deferred but non-blocking owner decisions:

- H1 chooses `FULL RESTAGE` versus safe immutable cross-generation artifact reuse after measuring closure/rollback/size.
- A direct Payment_component→person Canonical relation requires a future human-approved schema contract; until then it is UNKNOWN.
- Product/Purchase, Mobility, Place routine and Contact branches require their existing authority/data gates; they do not block foundations or B core.

## 28. Final gate

All required foundation semantics are frozen: exact Global time identity without a universal business window; CH/LT; five knowledge states and partial reasons; separate support/coverage; diagnostic provenance/evidence; version/hash rules; complete dependency declaration; capability/authority semantics; person/entity scopes; exact ECF-person plan; Materiality/Insight owner boundary; and B1 delta handoff.

Validation evidence for A1 includes mandatory consumer searches, strict-contract inspection, read-only Supabase schema/cardinality/coverage aggregates and adversarial examples above. Only this report is an A1 deliverable; pre-existing untracked GA0 baseline documents are not A1 modifications.

| Read-only check | Result |
|---|---|
| Global legacy contracts | PASS — `ANALYSIS_GLOBAL_CONTRACTS=PASS` |
| Analytics materialization contracts | PASS |
| History V2 transversal contracts | PASS — 48 checks |
| History dependency manifest gate | PASS |
| Architecture imports | PASS — 470 files |
| TypeScript `--noEmit` | PASS |
| Tracked `git diff --check` | PASS |
| A1 report no-index whitespace check | PASS after removing the final blank line; only the expected LF/CRLF warning remains |

```text
GLOBAL PHASE A1 = PASS
B1_STATUS = MERGED_INTO_A1

CURRENT_STEP = A1
TYPE = AUDIT_ONLY_CONTRACT_FREEZE

POST_HISTORY_ENTRY_GATE = PASS
GA0_ENTRY_GATE = PASS

GLOBAL_PHASE_A1 = PASS
B1_STATUS = MERGED_INTO_A1

FOUNDATION_CONTRACTS_FROZEN =
TIME_CONTRACT = PASS
CH_LT_CONTRACT = PASS
KNOWLEDGE_CONTRACT = PASS
SUPPORT_CONTRACT = PASS
COVERAGE_CONTRACT = PASS
PROVENANCE_CONTRACT = PASS
METHOD_POLICY_CONTRACT = PASS
DEPENDENCY_DECLARATION_CONTRACT = PASS
CAPABILITY_CONTRACT = PASS
PERSON_SCOPE_CONTRACT = PASS
ECF_PERSON_PLAN = PASS
MATERIALITY_BOUNDARY = PASS
B1_MERGED_DELTA = PASS

FILES_CREATED = docs/global-v2/phases/A/01-foundations-physical-audit.md
FILES_MODIFIED = NONE

SUPABASE_WRITES = 0
MIGRATIONS_APPLIED = 0
PRODUCT_CODE_CHANGES = 0
HISTORY_BEHAVIOR_CHANGES = 0

UNRESOLVED_HARD_STOPS = 0

NEXT_PERMITTED_STEP =
A2 — IMPLEMENT SHARED GLOBAL FOUNDATION CONTRACTS
```
