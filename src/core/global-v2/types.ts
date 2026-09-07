import type {
  ActivityId,
  Brand,
  CategoryId,
  MerchantId,
  PersonId,
  PlaceId,
} from "../identity";
import type { DataStatus, PartialMeaning } from "../history-v2";
import type { AnalysisFilters, AnalysisSubject } from "../scope";
import type { Instant, LocalDate } from "../time";
import type {
  AnalyticsRevision,
  DataRevision,
  MethodVersion,
  PolicyVersion,
} from "../versions";

export type GlobalAnalysisScopeHash = Brand<string, "GlobalAnalysisScopeHash">;
export type GlobalDependencyDigest = Brand<string, "GlobalDependencyDigest">;
export type GlobalMethodSignature = Brand<string, "GlobalMethodSignature">;

export type GlobalAnalysisTimeV2 = {
  readonly kind: "global_v2";
  readonly asOf: Instant;
  readonly certifiedThrough: LocalDate;
  readonly liveThrough?: LocalDate;
};

export type GlobalAnalysisScopeV2 = {
  readonly subject: AnalysisSubject;
  readonly time: GlobalAnalysisTimeV2;
  readonly filters?: AnalysisFilters;
};

export type NormalizedGlobalAnalysisFilters = {
  readonly categoryIds: readonly CategoryId[];
  readonly activityIds: readonly ActivityId[];
  readonly merchantIds: readonly MerchantId[];
  readonly placeIds: readonly PlaceId[];
  readonly lifeScopeContext: readonly string[];
  readonly dayContext: readonly string[];
};

export type NormalizedGlobalAnalysisScopeV2 = {
  readonly subject: AnalysisSubject;
  readonly time: GlobalAnalysisTimeV2;
  readonly filters: NormalizedGlobalAnalysisFilters;
};

export type GlobalNaturalGrain =
  | "MONTH"
  | "WEEK"
  | "DAY"
  | "PERSON_DAY"
  | "ECONOMIC_COMPONENT"
  | "OCCURRENCE"
  | "VISIT"
  | "MOMENT"
  | "PURCHASE_EVENT";

export type HistoricalLookback =
  | { readonly kind: "ALL_RELIABLE" }
  | { readonly kind: "LAST_ELIGIBLE_UNITS"; readonly count: number }
  | {
      readonly kind: "DECLARED_RANGE";
      readonly start: LocalDate;
      readonly end: LocalDate;
    }
  | {
      readonly kind: "COMPARABLE_INTERSECTION";
      readonly unit: GlobalNaturalGrain;
    };

export type PolicyRef = {
  readonly id: string;
  readonly version: PolicyVersion;
};

export type GlobalTimeWindowPolicy = {
  readonly policyId: string;
  readonly policyVersion: PolicyVersion;
  readonly naturalGrain: GlobalNaturalGrain;
  readonly corpus:
    | "CERTIFIED_HISTORY"
    | "CERTIFIED_PLUS_DESCRIPTIVE_LIVE_TAIL";
  readonly lookback: HistoricalLookback;
  readonly gapPolicy: "PRESERVE";
  readonly comparableIntersection: "NOT_REQUIRED" | "EXACT_NATURAL_UNIT";
};

export type GlobalSupportStatus =
  | "INSUFFICIENT"
  | "PARTIAL_SUPPORT"
  | "SUFFICIENT"
  | "STRONG";

export type GlobalSupport = {
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

export type CorpusAuthority = "CERTIFIED_HISTORY" | "LIVE_TAIL";

export type CorpusSlice = {
  readonly authority: CorpusAuthority;
  readonly start?: LocalDate;
  readonly end: LocalDate;
  readonly support: GlobalSupport;
  readonly provenance: GlobalValueProvenance;
  readonly dependencyRefs: readonly string[];
};

export type GlobalResolvedNaturalWindow = {
  readonly naturalGrain: GlobalNaturalGrain;
  readonly certified: CorpusSlice;
  readonly liveTail?: CorpusSlice;
  readonly gapDates: readonly LocalDate[];
};

export type GlobalPartialReason =
  | "OBSERVED_SUBSET"
  | "LOWER_BOUND"
  | "MISSING_INTERVALS"
  | "MISSING_LINKAGE"
  | "PARTIAL_SOURCE";

export type GlobalCoverageDimension =
  | "FINANCIAL_SOURCE"
  | "CLASSIFICATION"
  | "NEED"
  | "PERSON_ATTRIBUTION"
  | "PERSON_DAY"
  | "PLACE"
  | "PARTICIPANT"
  | "PURCHASE_EVENT"
  | "PRODUCT"
  | "MOMENT_METADATA"
  | "MOMENT_PARTICIPANT"
  | "MOMENT_FINANCIAL"
  | "COMPARABLE_PERSON_SUPPORT";

export type GlobalCoverageMeasure = {
  readonly dimension: GlobalCoverageDimension;
  readonly status: DataStatus;
  readonly numerator?: number;
  readonly denominator?: number;
  readonly ratio?: number;
  readonly unit: string;
  readonly basis: string;
  readonly evidenceRefs: readonly string[];
  readonly policyRef: string;
};

export type GlobalCoverageSet = {
  readonly dimensions: readonly GlobalCoverageMeasure[];
  readonly requiredDimensions: readonly GlobalCoverageDimension[];
  readonly effective?: number;
  readonly aggregation: "MIN_REQUIRED_DIMENSIONS";
};

export type GlobalValueProvenance = {
  readonly resultNature: "OBSERVED" | "DECLARED" | "ESTIMATED" | "HYBRID";
  readonly precision: "EXACT" | "APPROXIMATE" | "RANGE";
  readonly integrationMode:
    | "INFORMATIONAL_ONLY"
    | "SUPPLEMENT_UNOBSERVED"
    | "REPLACEMENT_ESTIMATE"
    | "DERIVED_FROM_OBSERVED";
  readonly monetaryBasis:
    | "AUTHORITATIVE_ECONOMIC"
    | "ENRICHED_ANALYTICAL"
    | "CONTEXTUAL_ESTIMATE";
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

export type GlobalKnowledgeValue<Value> =
  | {
      readonly status: "KNOWN";
      readonly value: Value;
      readonly support?: GlobalSupport;
      readonly coverage?: GlobalCoverageSet;
      readonly provenance?: GlobalValueProvenance;
    }
  | {
      readonly status: "PARTIAL";
      readonly value: Value;
      readonly partialMeaning: PartialMeaning;
      readonly partialReasons: readonly GlobalPartialReason[];
      readonly support?: GlobalSupport;
      readonly coverage?: GlobalCoverageSet;
      readonly provenance?: GlobalValueProvenance;
    }
  | {
      readonly status: "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT";
      readonly support?: GlobalSupport;
      readonly coverage?: GlobalCoverageSet;
      readonly provenance?: GlobalValueProvenance;
    };

export type GlobalEngineIdentity = {
  readonly engineId: string;
  readonly methodVersion: MethodVersion;
  readonly naturalGrain: GlobalNaturalGrain;
  readonly statisticalPolicy?: PolicyRef;
  readonly timeWindowPolicy: PolicyRef;
  readonly supportPolicy: PolicyRef;
  readonly coveragePolicy: PolicyRef;
  readonly materialityPolicy?: PolicyRef;
};

export type GlobalPersonScopeKind =
  | "HOUSEHOLD"
  | "PERSON"
  | "COMPARABLE_PERSONS"
  | "EXPLICIT_SHARED";

export type GlobalPersonScopePolicy =
  | { readonly kind: "HOUSEHOLD" }
  | { readonly kind: "PERSON"; readonly personId: PersonId }
  | {
      readonly kind: "COMPARABLE_PERSONS";
      readonly personIds: readonly PersonId[];
      readonly intersectionPolicy: PolicyRef;
    }
  | {
      readonly kind: "EXPLICIT_SHARED";
      readonly personIds: readonly PersonId[];
      readonly evidencePolicy: PolicyRef;
    };

export type GlobalEntityScopePolicy =
  | { readonly kind: "NONE" }
  | {
      readonly kind: "ENTITY_SET";
      readonly entityType: string;
      readonly entityIds: readonly string[];
    };

export type DependencyRef = {
  readonly kind: "FACT" | "ENTITY" | "ANALYTICS" | "MODULE" | "POLICY";
  readonly id: string;
  readonly requirement: "REQUIRED" | "OPTIONAL";
  readonly scopeRelation: string;
  readonly corpusAuthority?: CorpusAuthority;
};

export type PublicationOutputRef = {
  readonly kind: "ARTIFACT" | "QUERY_SNAPSHOT";
  readonly id: string;
};

export type CapabilityRequirement = {
  readonly capabilityId: string;
  readonly requirement: "REQUIRED" | "OPTIONAL";
};

export type GlobalInvalidationScope =
  | { readonly kind: "RESOURCE"; readonly resourceId: string }
  | { readonly kind: "ENTITY"; readonly entityType: string; readonly entityId: string }
  | { readonly kind: "NATURAL_DATE_INTERVAL"; readonly start: LocalDate; readonly end: LocalDate }
  | { readonly kind: "PERSON_SCOPE"; readonly personIds: readonly PersonId[] }
  | { readonly kind: "MODULE"; readonly moduleId: string }
  | { readonly kind: "GLOBAL_GENERATION" };

export type GlobalDependencyDeclaration = {
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

export type GlobalDependencyConsumption = {
  readonly factDependencyIds: readonly string[];
  readonly entityDependencyIds: readonly string[];
  readonly upstreamAnalyticsIds: readonly string[];
  readonly otherModuleDependencyIds: readonly string[];
  readonly policyIds: readonly string[];
};

export type GlobalCapabilityState =
  | "AVAILABLE"
  | "PARTIAL"
  | "UNAVAILABLE"
  | "CONFLICT";

export type GlobalCapability = {
  readonly capabilityId: string;
  readonly state: GlobalCapabilityState;
  readonly authorityGateIds: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly supportedPersonScopes: readonly GlobalPersonScopeKind[];
  readonly supportedEntityScopes: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly policyRef: string;
};

export type GlobalMaterialityCandidate = {
  readonly candidateId: string;
  readonly phenomenonId: string;
  readonly parentPhenomenonId?: string;
  readonly metricRef: string;
  readonly effect: {
    readonly absolute?: string;
    readonly relative?: string;
    readonly standardized?: number;
  };
  readonly knowledgeState: DataStatus;
  readonly support: GlobalSupport;
  readonly coverage: GlobalCoverageSet;
  readonly evidenceRefs: readonly string[];
  readonly entityRefs: readonly string[];
  readonly methodVersion: MethodVersion;
  readonly materialityPolicy: PolicyRef;
};
