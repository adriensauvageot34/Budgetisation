import type { DataStatus, PartialMeaning } from "../../core/history-v2";
import type {
  GlobalPublicationQualification,
  GlobalPublicationReasonCode,
  GlobalPublicationVisibility,
} from "../../analytics/global-v2/publication";

export const globalPrimaryModuleCatalog = Object.freeze([
  { moduleKey: "ECONOMIC", resource: "analysis_global_economic", order: 1 },
  { moduleKey: "CATEGORIES_NEEDS", resource: "analysis_global_categories_needs", order: 2 },
  { moduleKey: "TRANSFORMATIONS", resource: "analysis_global_transformations", order: 3 },
  { moduleKey: "RHYTHM", resource: "analysis_global_rhythm", order: 4 },
  { moduleKey: "RELATIONSHIPS", resource: "analysis_global_relationships", order: 5 },
  { moduleKey: "MOMENTS", resource: "analysis_global_moments", order: 6 },
  { moduleKey: "GEO_MOBILITY", resource: "analysis_global_geo_mobility", order: 7 },
  { moduleKey: "CONSUMPTION", resource: "analysis_global_consumption", order: 8 },
  { moduleKey: "PERSONAS", resource: "analysis_global_personas", order: 9 },
  { moduleKey: "TOGETHER", resource: "analysis_global_together", order: 10 },
] as const);

export type GlobalPrimaryModule = (typeof globalPrimaryModuleCatalog)[number];
export type GlobalPrimaryModuleKey = GlobalPrimaryModule["moduleKey"];
export type GlobalPrimaryResourceName = GlobalPrimaryModule["resource"];

export type GlobalReadModelPublicationMeta = {
  readonly publicationId: string;
  readonly revision: number;
  readonly factsHash: string;
  readonly generatedAt: string;
  readonly profileId: "global-v2-household@v1";
  readonly manifestHash: string;
};

export type GlobalReadModelResourceMeta = {
  readonly contractVersion: string;
  readonly methodSignature: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly resourceInputHash: string;
};

export type GlobalCompactQuality = {
  readonly knowledgeState: DataStatus;
  readonly partialMeaning?: PartialMeaning;
  readonly supportStatus?: "INSUFFICIENT" | "PARTIAL_SUPPORT" | "SUFFICIENT" | "STRONG";
  readonly effectiveCoverage?: number;
  readonly dataNature: "OBSERVED" | "DECLARED" | "ESTIMATED" | "HYBRID";
  readonly limitationCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
};

export type GlobalCompactInsight = {
  readonly insightId: string;
  readonly phenomenonId: string;
  readonly kind: string;
  readonly titleKey: string;
  readonly statementKey: string;
  readonly primaryMetricRef?: string;
  readonly comparisonRef?: string;
  readonly entityRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly detailRefs: readonly string[];
  readonly editorialRank: number;
};

/** Machine-readable analytical value. displayValue remains presentation-only. */
export type GlobalTypedMeasure = {
  readonly kind: "MONEY" | "DECIMAL" | "RATIO" | "COUNT";
  readonly value: string;
  readonly unit: string;
};

/** Quality belongs to the phenomenon, not only to the enclosing module. */
export type GlobalPhenomenonQuality = {
  readonly knowledgeState: DataStatus;
  readonly supportStatus?: "INSUFFICIENT" | "PARTIAL_SUPPORT" | "SUFFICIENT" | "STRONG";
  readonly effectiveCoverage?: number;
  readonly materialityStatus?: "MATERIAL" | "NOT_MATERIAL" | "UNKNOWN";
  readonly limitationCodes: readonly string[];
  readonly dataNature: "OBSERVED" | "DECLARED" | "ESTIMATED" | "HYBRID";
  readonly methodVersion: string;
  readonly inputHash: string;
};

export type GlobalCompactKpi = {
  readonly kpiId: string;
  readonly phenomenonId: string;
  readonly labelKey: string;
  readonly displayValue: string;
  readonly typedMeasure?: GlobalTypedMeasure;
  readonly phenomenonRef?: string;
  readonly phenomenonQuality?: GlobalPhenomenonQuality;
  readonly metricRef: string;
  readonly evidenceRefs: readonly string[];
};

export type GlobalDetailEntry = {
  readonly entryId: string;
  readonly labelKey: string;
  readonly targetResource: string;
  readonly targetRef: string;
};

export type GlobalModuleCapability = {
  readonly capabilityId: string;
  readonly state: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE" | "CONFLICT";
  readonly reasonCodes: readonly string[];
};

export type GlobalModuleCompactReadModel<
  ModuleKey extends GlobalPrimaryModuleKey = GlobalPrimaryModuleKey,
  Resource extends GlobalPrimaryResourceName = GlobalPrimaryResourceName,
> = {
  readonly kind: "global_module_compact";
  readonly schemaVersion: "global-module-compact@v1";
  readonly moduleKey: ModuleKey;
  readonly resource: Resource;
  readonly order: number;
  readonly visibility: GlobalPublicationVisibility;
  readonly qualification?: GlobalPublicationQualification;
  readonly reasonCode?: GlobalPublicationReasonCode;
  readonly placeholder?: { readonly messageKey: string; readonly progress?: { readonly current: number; readonly required: number; readonly unit: string } };
  readonly primaryInsight?: GlobalCompactInsight;
  readonly kpis: readonly GlobalCompactKpi[];
  readonly quality: GlobalCompactQuality;
  readonly capabilities: readonly GlobalModuleCapability[];
  readonly detailEntries: readonly GlobalDetailEntry[];
  readonly publicationMeta: GlobalReadModelPublicationMeta;
  readonly resourceMeta: GlobalReadModelResourceMeta;
};

export type GlobalInitialModuleEntry = {
  readonly moduleKey: GlobalPrimaryModuleKey;
  readonly resource: GlobalPrimaryResourceName;
  readonly order: number;
  readonly visibility: GlobalPublicationVisibility;
  readonly qualification?: GlobalPublicationQualification;
  readonly reasonCode?: GlobalPublicationReasonCode;
};

export type GlobalInitialReadModel = {
  readonly kind: "global_initial";
  readonly schemaVersion: "global-initial@v1";
  readonly navigation: readonly GlobalInitialModuleEntry[];
  readonly capabilities: readonly GlobalModuleCapability[];
  readonly publicationMeta: GlobalReadModelPublicationMeta;
  readonly resourceMeta: GlobalReadModelResourceMeta;
};

/** Transport is deliberately outside the published analytical payload. */
export type GlobalReadModelTransportState<Data> =
  | { readonly status: "IDLE" | "LOADING" }
  | { readonly status: "READY"; readonly data: Data }
  | { readonly status: "ERROR"; readonly errorCode: string; readonly previousData?: Data };
