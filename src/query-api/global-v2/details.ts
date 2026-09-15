import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../../core/validation";
import type { RuntimeSchema } from "../../core/validation";
import type { DataStatus, PartialMeaning } from "../../core/history-v2";
import type { GlobalPublicationReasonCode, GlobalPublicationVisibility } from "../../analytics/global-v2/publication";
import type {
  GlobalCompactInsight,
  GlobalCompactQuality,
  GlobalPhenomenonQuality,
  GlobalTypedMeasure,
  GlobalModuleCapability,
  GlobalPrimaryModuleKey,
  GlobalReadModelPublicationMeta,
  GlobalReadModelResourceMeta,
} from "./types";
import { parseGlobalPhenomenonQuality, parseGlobalTypedMeasure } from "./typed-values";
import { parseLocalDate, parseYearMonth } from "../../core/time";

export const GLOBAL_EXPANDED_PAYLOAD_BUDGET_BYTES = 96 * 1024;
export const GLOBAL_MAX_EXPANDED_INSIGHTS = 5;
export const GLOBAL_MAX_SECONDARY_INSIGHTS = 4;
export const GLOBAL_MAX_SECTION_METRICS = 12;
const GLOBAL_MAX_M1_EVOLUTION_METRICS = 16;
export const GLOBAL_MAX_SECTION_SERIES = 3;
export const GLOBAL_MAX_SERIES_POINTS = 36;
export const GLOBAL_MAX_SECTION_ROWS = 50;
export const GLOBAL_MAX_SECTION_TARGETS = 24;

export const globalExpandedSectionKeys = Object.freeze([
  "OVERVIEW", "EVOLUTION", "BREAKDOWN", "PATTERNS", "COMPARISONS", "METHODOLOGY",
] as const);
export type GlobalExpandedSectionKey = (typeof globalExpandedSectionKeys)[number];

export type GlobalDetailMetric = {
  readonly metricId: string;
  readonly labelKey: string;
  readonly displayValue: string;
  readonly typedMeasure?: GlobalTypedMeasure;
  readonly phenomenonRef?: string;
  readonly phenomenonQuality?: GlobalPhenomenonQuality;
  readonly knowledgeState: DataStatus;
  readonly partialMeaning?: PartialMeaning;
  readonly dataNature: "OBSERVED" | "DECLARED" | "ESTIMATED" | "HYBRID";
  readonly evidenceRefs: readonly string[];
};

export type GlobalDetailSeriesPoint = {
  readonly unitKey: string;
  readonly displayValue?: string;
  readonly typedMeasure?: GlobalTypedMeasure;
  readonly phenomenonRef?: string;
  readonly phenomenonQuality?: GlobalPhenomenonQuality;
  readonly knowledgeState: DataStatus;
};

export type GlobalDetailSeries = {
  readonly seriesId: string;
  readonly labelKey: string;
  readonly unit: string;
  readonly points: readonly GlobalDetailSeriesPoint[];
  readonly evidenceRefs: readonly string[];
};

export type GlobalActivityCostProfileContext = {
  readonly knownCausalCostCount: GlobalTypedMeasure;
  readonly totalOccurrenceCount: GlobalTypedMeasure;
  readonly coverageRatio: GlobalTypedMeasure;
  readonly nonAdditiveAcrossActivities: true;
};

export type GlobalMomentComparisonContext = {
  readonly comparisonTier: "SAME_SERIES" | "SAME_TYPE" | "SAME_FAMILY";
  readonly comparisonProfileId: string;
  readonly peerCount: GlobalTypedMeasure;
  readonly subjectCost: GlobalTypedMeasure;
  readonly peerMedian: GlobalTypedMeasure;
  readonly q1?: GlobalTypedMeasure;
  readonly q3?: GlobalTypedMeasure;
  readonly mad?: GlobalTypedMeasure;
  readonly absoluteDelta: GlobalTypedMeasure;
  readonly relativeDelta?: GlobalTypedMeasure;
};

export type GlobalMomentCost =
  | { readonly status: "KNOWN" | "PARTIAL"; readonly value: GlobalTypedMeasure }
  | { readonly status: "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT" };

export type GlobalMomentComponentRow = {
  readonly componentRef: string;
  readonly primaryLabel: string;
  readonly labelSource: "ITEM" | "PRECISE_DESCRIPTION" | "PRECISE_TYPE" | "CANONICAL_MERCHANT" | "SUBCATEGORY" | "CATEGORY" | "BANK_LABEL" | "CONTEXTUAL_NOTE" | "SOURCE_GRAIN";
  readonly amount: GlobalTypedMeasure;
  readonly sourceKind: "Operation_parent" | "Operation_residual" | "Allocation" | "Item" | "Payment_component" | "Cash_economic_use";
  readonly sourceOperationRef?: string;
  readonly categoryRef?: string;
  readonly categoryLabel?: string;
  readonly subcategoryRef?: string;
  readonly subcategoryLabel?: string;
  readonly merchantRef?: string;
  readonly merchantLabel?: string;
  readonly causalRole?: string;
  readonly compositionGroup?: string;
  readonly evidenceRefs: readonly string[];
};

export type GlobalMomentComponentGroup = { readonly groupKey: string; readonly groupLabel: string; readonly amount: GlobalTypedMeasure; readonly componentRefs: readonly string[]; readonly count: number };
export type GlobalMomentPeerObservation = { readonly peerRef: string; readonly canonicalName: string; readonly startDate: string; readonly endDate: string; readonly typeKey: string; readonly typeLabel: string; readonly familyKey: string; readonly causalCost: GlobalMomentCost; readonly placeSummary?: readonly string[]; readonly componentPreview: readonly GlobalMomentComponentRow[]; readonly detailRef: string };
export type GlobalMomentSimilarity = { readonly basis: "SAME_SERIES" | "SAME_TYPE" | "SAME_FAMILY"; readonly requiredFacetKeys: readonly string[]; readonly matchedFacets: readonly { readonly facetKey: string; readonly value: string }[]; readonly supportPolicyRef: string };
export type GlobalSpentDuringContext = { readonly label: string; readonly cost: GlobalMomentCost; readonly relationToCausalCost: "INDEPENDENT_SCOPE" };
export type GlobalGroceryRhythmContext = {
  readonly grain: "HOUSEHOLD_MONTH";
  readonly policyRef: string;
  readonly thresholds: { readonly p25: GlobalTypedMeasure; readonly p75: GlobalTypedMeasure };
  readonly eligibleMonthCount: number;
  readonly historicalComparisonGate: "AVAILABLE" | "GATED";
  readonly months: readonly { readonly month: string; readonly occurrenceCount: number; readonly knownCostOccurrenceCount: number; readonly coverage: number; readonly basketStructure: { readonly status: "KNOWN"; readonly small: number; readonly intermediate: number; readonly large: number } | { readonly status: "GATED"; readonly reasonCode: "COVERAGE_BELOW_70_PERCENT" }; readonly monthlyGrocerySpend: GlobalMomentCost; readonly limitationCodes: readonly string[] }[];
};

export type GlobalDetailRow = {
  readonly rowId: string;
  readonly labelKey: string;
  readonly displayValue?: string;
  readonly typedMeasure?: GlobalTypedMeasure;
  readonly phenomenonRef?: string;
  readonly phenomenonQuality?: GlobalPhenomenonQuality;
  readonly knowledgeState: DataStatus;
  readonly entityRef?: string;
  readonly activityCostProfile?: GlobalActivityCostProfileContext;
  readonly momentComparison?: GlobalMomentComparisonContext;
  readonly evidenceRefs: readonly string[];
};

export type GlobalNavigationDestination = {
  readonly targetId: string;
  readonly kind: "GLOBAL_QUERY" | "HISTORY" | "OPERATIONS" | "ENTITY" | "METHODOLOGY";
  readonly resource: string;
  readonly instanceKey?: string;
  readonly entityRef?: string;
  readonly scopeHash: string;
  readonly sourcePublicationId: string;
  readonly sourceAnalyticsRevision: number;
};

export type GlobalExpandedReadModel = {
  readonly kind: "global_expanded";
  readonly schemaVersion: "global-expanded@v1";
  readonly resource: GlobalV2ExpandedResourceName;
  readonly moduleKey: GlobalPrimaryModuleKey;
  readonly sectionKey: GlobalExpandedSectionKey;
  readonly visibility: GlobalPublicationVisibility;
  readonly reasonCode?: GlobalPublicationReasonCode;
  readonly primaryInsight?: GlobalCompactInsight;
  readonly secondaryInsights: readonly GlobalCompactInsight[];
  readonly metrics: readonly GlobalDetailMetric[];
  readonly series: readonly GlobalDetailSeries[];
  readonly rows: readonly GlobalDetailRow[];
  readonly destinations: readonly GlobalNavigationDestination[];
  readonly peerObservations?: readonly GlobalMomentPeerObservation[];
  readonly similarity?: GlobalMomentSimilarity;
  readonly momentComponentRows?: readonly GlobalMomentComponentRow[];
  readonly componentGroups?: readonly GlobalMomentComponentGroup[];
  readonly spentDuringContext?: GlobalSpentDuringContext;
  readonly groceryRhythm?: GlobalGroceryRhythmContext;
  readonly quality: GlobalCompactQuality;
  readonly capabilities: readonly GlobalModuleCapability[];
  readonly publicationMeta: GlobalReadModelPublicationMeta;
  readonly resourceMeta: GlobalReadModelResourceMeta;
};

export type ImportedGlobalSummaryReadModel = {
  readonly kind: "global_imported_summary";
  readonly schemaVersion: "global-imported-summary@v1";
  readonly status: "FRESH" | "STALE" | "MISSING";
  readonly sanitizedHtml?: string;
  readonly importedAt?: string;
  readonly contentHash?: string;
  readonly publicationMeta: GlobalReadModelPublicationMeta;
  readonly resourceMeta: GlobalReadModelResourceMeta;
};

const expandedSection = <const Resource extends string, const ModuleKey extends GlobalPrimaryModuleKey>(
  resource: Resource,
  moduleKey: ModuleKey,
  capabilityId: string,
) => Object.freeze({ resource, moduleKey, capabilityId, group: "expanded_section" as const, paramsKind: "section_key" as const, family: "global_module" as const, availability: "AVAILABLE" as const });

const entityDetail = <const Resource extends string, const ModuleKey extends GlobalPrimaryModuleKey>(
  resource: Resource,
  moduleKey: ModuleKey,
  capabilityId: string,
  availability: "AVAILABLE" | "AUTHORITY_GATED" = "AVAILABLE",
) => Object.freeze({ resource, moduleKey, capabilityId, group: "entity_detail" as const, paramsKind: "entity_ref" as const, family: "global_entity_detail" as const, availability });

export const globalV2ExpandedResourceCatalog = Object.freeze([
  expandedSection("analysis_global_economic_expanded", "ECONOMIC", "GLOBAL_ECONOMIC"),
  expandedSection("analysis_global_categories_needs_expanded", "CATEGORIES_NEEDS", "GLOBAL_CATEGORIES_NEEDS"),
  expandedSection("analysis_global_transformations_expanded", "TRANSFORMATIONS", "GLOBAL_TRANSFORMATIONS"),
  expandedSection("analysis_global_rhythm_expanded", "RHYTHM", "GLOBAL_RHYTHM"),
  expandedSection("analysis_global_relationships_expanded", "RELATIONSHIPS", "GLOBAL_RELATIONSHIPS"),
  expandedSection("analysis_global_moments_expanded", "MOMENTS", "GLOBAL_MOMENTS"),
  expandedSection("analysis_global_geo_mobility_expanded", "GEO_MOBILITY", "GLOBAL_GEO_MOBILITY"),
  expandedSection("analysis_global_consumption_expanded", "CONSUMPTION", "GLOBAL_CONSUMPTION"),
  expandedSection("analysis_global_personas_expanded", "PERSONAS", "GLOBAL_PERSONAS"),
  expandedSection("analysis_global_together_expanded", "TOGETHER", "GLOBAL_TOGETHER"),
  entityDetail("analysis_global_economic_recurrence_detail", "ECONOMIC", "GLOBAL_ECONOMIC_RECURRENCE_DETAIL"),
  entityDetail("analysis_global_category_need_detail", "CATEGORIES_NEEDS", "GLOBAL_CATEGORY_NEED_DETAIL"),
  entityDetail("analysis_global_transformation_detail", "TRANSFORMATIONS", "GLOBAL_TRANSFORMATION_DETAIL"),
  entityDetail("analysis_global_routine_detail", "RHYTHM", "GLOBAL_ROUTINE_DETAIL"),
  entityDetail("analysis_global_relationship_detail", "RELATIONSHIPS", "GLOBAL_RELATIONSHIP_DETAIL"),
  entityDetail("analysis_global_moment_experience_detail", "MOMENTS", "GLOBAL_MOMENT_DETAIL"),
  entityDetail("analysis_global_place_mobility_detail", "GEO_MOBILITY", "GLOBAL_PLACE_DETAIL"),
  entityDetail("analysis_global_purchase_merchant_detail", "CONSUMPTION", "GLOBAL_PURCHASE_MERCHANT_DETAIL"),
  entityDetail("analysis_global_product_detail", "CONSUMPTION", "GLOBAL_PRODUCT_DETAIL", "AUTHORITY_GATED"),
  entityDetail("analysis_global_route_detail", "GEO_MOBILITY", "GLOBAL_ROUTE_DETAIL", "AUTHORITY_GATED"),
  entityDetail("analysis_global_persona_detail", "PERSONAS", "GLOBAL_PERSONA_DETAIL"),
  entityDetail("analysis_global_participation_detail", "TOGETHER", "GLOBAL_PARTICIPATION_DETAIL"),
  Object.freeze({ resource: "analysis_global_methodology", moduleKey: "ECONOMIC", capabilityId: "GLOBAL_METHODOLOGY", group: "methodology" as const, paramsKind: "methodology" as const, family: "global_methodology" as const, availability: "AVAILABLE" as const }),
] as const);

export function globalV2MethodRef(moduleKey: GlobalPrimaryModuleKey): string {
  return `method:global-${moduleKey.toLowerCase().replaceAll("_", "-")}@v1`;
}

export type GlobalV2ExpandedResourceName = (typeof globalV2ExpandedResourceCatalog)[number]["resource"];

const expandedResources = new Set(globalV2ExpandedResourceCatalog.map(({ resource }) => resource));
const moduleKeys = new Set(globalV2ExpandedResourceCatalog.map(({ moduleKey }) => moduleKey));
const sectionKeys = new Set(globalExpandedSectionKeys);
const knowledge = new Set(["KNOWN", "PARTIAL", "UNKNOWN", "NOT_APPLICABLE", "CONFLICT"]);
const visibilities = new Set(["VISIBLE", "PLACEHOLDER", "HIDDEN"]);
const reasons = new Set([
  "NOT_APPLICABLE", "NO_ELIGIBLE_UNIVERSE", "CAPABILITY_NOT_AVAILABLE", "CAPABILITY_DISABLED_BY_POLICY",
  "SEMANTICALLY_INVALID", "UNKNOWN_REQUIRED_VALUE", "BLOCKING_CONFLICT", "MISSING_REQUIRED_LINKAGE",
  "MISSING_PROVENANCE", "INCOMPATIBLE_BASE", "INCOMPLETE_PUBLICATION_EVIDENCE",
  "INSUFFICIENT_CERTIFIED_HISTORY", "UNCERTIFIED_REQUIRED_PERIOD", "INSUFFICIENT_SUPPORT", "PARTIAL_SUPPORT_ONLY",
  "INSUFFICIENT_COMPARABLE_PEERS", "INSUFFICIENT_MATCHED_PAIRS", "INSUFFICIENT_CYCLES", "INSUFFICIENT_REPETITIONS",
  "INSUFFICIENT_COVERAGE", "PARTIAL_COVERAGE_ONLY", "BELOW_MATERIALITY", "STATISTICAL_GATE_FAILED",
  "MULTIPLICITY_GATE_FAILED", "TEMPORAL_ROBUSTNESS_FAILED", "HYPOTHESIS_ONLY", "REDUNDANT_WITH_HIGHER_PRIORITY",
  "NOT_SELECTED_FOR_SURFACE", "SURFACE_LIMIT_REACHED",
]);
const HASH = /^[0-9a-f]{64}$/u;
const INSTANT = /^\d{4}-\d{2}-\d{2}T/u;

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) throw new TypeError(`${label}_INVALID`);
  return value;
}
function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label}_INVALID`);
  return value;
}
function optional<T>(record: Readonly<Record<string, unknown>>, key: string, parse: (value: unknown) => T): T | undefined {
  return hasOwn(record, key) ? parse(record[key]) : undefined;
}
function array<T>(value: unknown, parse: (entry: unknown, index: number) => T, label: string): readonly T[] {
  if (!Array.isArray(value)) throw new TypeError(`${label}_INVALID`);
  return value.map(parse);
}
function strings(value: unknown, label: string): readonly string[] {
  const parsed = array(value, (entry) => text(entry, label), label);
  if (new Set(parsed).size !== parsed.length || parsed.some((entry, index) => index > 0 && parsed[index - 1].localeCompare(entry) >= 0)) throw new TypeError(`${label}_NON_CANONICAL`);
  return parsed;
}
function status(value: unknown): DataStatus {
  return parseStringLiteral<DataStatus>(value, knowledge, "Global detail knowledge state");
}

function parsePublicationMeta(value: unknown): GlobalReadModelPublicationMeta {
  const record = parseStrictRecord(value, ["publicationId", "revision", "factsHash", "generatedAt", "profileId", "manifestHash"], "GlobalDetailPublicationMeta");
  const factsHash = text(requireProperty(record, "factsHash", "GlobalDetailPublicationMeta"), "factsHash");
  const manifestHash = text(requireProperty(record, "manifestHash", "GlobalDetailPublicationMeta"), "manifestHash");
  const generatedAt = text(requireProperty(record, "generatedAt", "GlobalDetailPublicationMeta"), "generatedAt");
  if (!HASH.test(factsHash) || !HASH.test(manifestHash) || !INSTANT.test(generatedAt)) throw new TypeError("GLOBAL_DETAIL_PUBLICATION_META_INVALID");
  return { publicationId: text(requireProperty(record, "publicationId", "GlobalDetailPublicationMeta"), "publicationId"), revision: integer(requireProperty(record, "revision", "GlobalDetailPublicationMeta"), "revision"), factsHash, generatedAt, profileId: parseStringLiteral(requireProperty(record, "profileId", "GlobalDetailPublicationMeta"), new Set(["global-v2-household@v1"]), "profileId"), manifestHash };
}
function parseResourceMeta(value: unknown): GlobalReadModelResourceMeta {
  const record = parseStrictRecord(value, ["contractVersion", "methodSignature", "policyVersions", "resourceInputHash"], "GlobalDetailResourceMeta");
  const methodSignature = text(requireProperty(record, "methodSignature", "GlobalDetailResourceMeta"), "methodSignature");
  const resourceInputHash = text(requireProperty(record, "resourceInputHash", "GlobalDetailResourceMeta"), "resourceInputHash");
  if (!HASH.test(methodSignature) || !HASH.test(resourceInputHash)) throw new TypeError("GLOBAL_DETAIL_RESOURCE_HASH_INVALID");
  const valueRecord = requireProperty(record, "policyVersions", "GlobalDetailResourceMeta");
  if (valueRecord === null || typeof valueRecord !== "object" || Array.isArray(valueRecord)) throw new TypeError("GLOBAL_DETAIL_POLICIES_INVALID");
  const policyVersions = Object.fromEntries(Object.entries(valueRecord).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [text(key, "policyKey"), text(item, "policyVersion")]));
  if (Object.keys(policyVersions).length === 0) throw new TypeError("GLOBAL_DETAIL_POLICIES_EMPTY");
  return { contractVersion: text(requireProperty(record, "contractVersion", "GlobalDetailResourceMeta"), "contractVersion"), methodSignature, policyVersions, resourceInputHash };
}
function parseQuality(value: unknown): GlobalCompactQuality {
  const record = parseStrictRecord(value, ["knowledgeState", "partialMeaning", "supportStatus", "effectiveCoverage", "dataNature", "limitationCodes", "evidenceRefs"], "GlobalDetailQuality");
  const knowledgeState = status(requireProperty(record, "knowledgeState", "GlobalDetailQuality"));
  const partialMeaning = optional(record, "partialMeaning", (entry) => parseStringLiteral<PartialMeaning>(entry, new Set(["LOWER_BOUND", "OBSERVED_ONLY"]), "partialMeaning"));
  if ((knowledgeState === "PARTIAL") !== (partialMeaning !== undefined)) throw new TypeError("GLOBAL_DETAIL_PARTIAL_MISMATCH");
  const supportStatus = optional(record, "supportStatus", (entry) => parseStringLiteral<"INSUFFICIENT" | "PARTIAL_SUPPORT" | "SUFFICIENT" | "STRONG">(entry, new Set(["INSUFFICIENT", "PARTIAL_SUPPORT", "SUFFICIENT", "STRONG"]), "supportStatus"));
  const effectiveCoverage = optional(record, "effectiveCoverage", (entry) => {
    if (typeof entry !== "number" || !Number.isFinite(entry) || entry < 0 || entry > 1) throw new TypeError("GLOBAL_DETAIL_COVERAGE_INVALID");
    return entry;
  });
  return { knowledgeState, ...(partialMeaning === undefined ? {} : { partialMeaning }), ...(supportStatus === undefined ? {} : { supportStatus }), ...(effectiveCoverage === undefined ? {} : { effectiveCoverage }), dataNature: parseStringLiteral(requireProperty(record, "dataNature", "GlobalDetailQuality"), new Set(["OBSERVED", "DECLARED", "ESTIMATED", "HYBRID"]), "dataNature"), limitationCodes: strings(requireProperty(record, "limitationCodes", "GlobalDetailQuality"), "limitations"), evidenceRefs: strings(requireProperty(record, "evidenceRefs", "GlobalDetailQuality"), "qualityEvidence") };
}
function parseInsight(value: unknown): GlobalCompactInsight {
  const record = parseStrictRecord(value, ["insightId", "phenomenonId", "kind", "titleKey", "statementKey", "primaryMetricRef", "comparisonRef", "entityRefs", "evidenceRefs", "detailRefs", "editorialRank"], "GlobalDetailInsight");
  const primaryMetricRef = optional(record, "primaryMetricRef", (entry) => text(entry, "primaryMetricRef"));
  const comparisonRef = optional(record, "comparisonRef", (entry) => text(entry, "comparisonRef"));
  const editorialRank = integer(requireProperty(record, "editorialRank", "GlobalDetailInsight"), "editorialRank");
  if (editorialRank < 1) throw new TypeError("GLOBAL_DETAIL_INSIGHT_RANK_INVALID");
  return { insightId: text(requireProperty(record, "insightId", "GlobalDetailInsight"), "insightId"), phenomenonId: text(requireProperty(record, "phenomenonId", "GlobalDetailInsight"), "phenomenonId"), kind: text(requireProperty(record, "kind", "GlobalDetailInsight"), "kind"), titleKey: text(requireProperty(record, "titleKey", "GlobalDetailInsight"), "titleKey"), statementKey: text(requireProperty(record, "statementKey", "GlobalDetailInsight"), "statementKey"), ...(primaryMetricRef === undefined ? {} : { primaryMetricRef }), ...(comparisonRef === undefined ? {} : { comparisonRef }), entityRefs: strings(requireProperty(record, "entityRefs", "GlobalDetailInsight"), "insightEntities"), evidenceRefs: strings(requireProperty(record, "evidenceRefs", "GlobalDetailInsight"), "insightEvidence"), detailRefs: strings(requireProperty(record, "detailRefs", "GlobalDetailInsight"), "insightDetails"), editorialRank };
}
function parseMetric(value: unknown): GlobalDetailMetric {
  const record = parseStrictRecord(value, ["metricId", "labelKey", "displayValue", "typedMeasure", "phenomenonRef", "phenomenonQuality", "knowledgeState", "partialMeaning", "dataNature", "evidenceRefs"], "GlobalDetailMetric");
  const knowledgeState = status(requireProperty(record, "knowledgeState", "GlobalDetailMetric"));
  const partialMeaning = optional(record, "partialMeaning", (entry) => parseStringLiteral<PartialMeaning>(entry, new Set(["LOWER_BOUND", "OBSERVED_ONLY"]), "partialMeaning"));
  const typedMeasure = optional(record, "typedMeasure", parseGlobalTypedMeasure);
  const phenomenonRef = optional(record, "phenomenonRef", (entry) => text(entry, "phenomenonRef"));
  const phenomenonQuality = optional(record, "phenomenonQuality", parseGlobalPhenomenonQuality);
  if ((knowledgeState === "PARTIAL") !== (partialMeaning !== undefined)) throw new TypeError("GLOBAL_DETAIL_METRIC_PARTIAL_MISMATCH");
  return { metricId: text(requireProperty(record, "metricId", "GlobalDetailMetric"), "metricId"), labelKey: text(requireProperty(record, "labelKey", "GlobalDetailMetric"), "labelKey"), displayValue: text(requireProperty(record, "displayValue", "GlobalDetailMetric"), "displayValue"), ...(typedMeasure === undefined ? {} : { typedMeasure }), ...(phenomenonRef === undefined ? {} : { phenomenonRef }), ...(phenomenonQuality === undefined ? {} : { phenomenonQuality }), knowledgeState, ...(partialMeaning === undefined ? {} : { partialMeaning }), dataNature: parseStringLiteral(requireProperty(record, "dataNature", "GlobalDetailMetric"), new Set(["OBSERVED", "DECLARED", "ESTIMATED", "HYBRID"]), "dataNature"), evidenceRefs: strings(requireProperty(record, "evidenceRefs", "GlobalDetailMetric"), "metricEvidence") };
}
function parsePoint(value: unknown): GlobalDetailSeriesPoint {
  const record = parseStrictRecord(value, ["unitKey", "displayValue", "typedMeasure", "phenomenonRef", "phenomenonQuality", "knowledgeState"], "GlobalDetailSeriesPoint");
  const knowledgeState = status(requireProperty(record, "knowledgeState", "GlobalDetailSeriesPoint"));
  const displayValue = optional(record, "displayValue", (entry) => text(entry, "displayValue"));
  const typedMeasure = optional(record, "typedMeasure", parseGlobalTypedMeasure);
  const phenomenonRef = optional(record, "phenomenonRef", (entry) => text(entry, "phenomenonRef"));
  const phenomenonQuality = optional(record, "phenomenonQuality", parseGlobalPhenomenonQuality);
  if ((knowledgeState === "KNOWN" || knowledgeState === "PARTIAL") !== (displayValue !== undefined)) throw new TypeError("GLOBAL_DETAIL_POINT_VALUE_MISMATCH");
  return { unitKey: text(requireProperty(record, "unitKey", "GlobalDetailSeriesPoint"), "unitKey"), ...(displayValue === undefined ? {} : { displayValue }), ...(typedMeasure === undefined ? {} : { typedMeasure }), ...(phenomenonRef === undefined ? {} : { phenomenonRef }), ...(phenomenonQuality === undefined ? {} : { phenomenonQuality }), knowledgeState };
}
function parseSeries(value: unknown): GlobalDetailSeries {
  const record = parseStrictRecord(value, ["seriesId", "labelKey", "unit", "points", "evidenceRefs"], "GlobalDetailSeries");
  const points = array(requireProperty(record, "points", "GlobalDetailSeries"), parsePoint, "points");
  if (points.length > GLOBAL_MAX_SERIES_POINTS) throw new TypeError("GLOBAL_DETAIL_SERIES_POINT_LIMIT");
  return { seriesId: text(requireProperty(record, "seriesId", "GlobalDetailSeries"), "seriesId"), labelKey: text(requireProperty(record, "labelKey", "GlobalDetailSeries"), "labelKey"), unit: text(requireProperty(record, "unit", "GlobalDetailSeries"), "unit"), points, evidenceRefs: strings(requireProperty(record, "evidenceRefs", "GlobalDetailSeries"), "seriesEvidence") };
}
function typedMeasureOfKind(value: unknown, kind: GlobalTypedMeasure["kind"], label: string): GlobalTypedMeasure {
  const parsed = parseGlobalTypedMeasure(value);
  if (parsed.kind !== kind) throw new TypeError(`${label}_KIND_INVALID`);
  return parsed;
}
function parseActivityCostProfile(value: unknown): GlobalActivityCostProfileContext {
  const record = parseStrictRecord(value, ["knownCausalCostCount", "totalOccurrenceCount", "coverageRatio", "nonAdditiveAcrossActivities"], "GlobalActivityCostProfileContext");
  if (requireProperty(record, "nonAdditiveAcrossActivities", "GlobalActivityCostProfileContext") !== true) throw new TypeError("GLOBAL_ACTIVITY_COST_NON_ADDITIVITY_REQUIRED");
  return {
    knownCausalCostCount: typedMeasureOfKind(requireProperty(record, "knownCausalCostCount", "GlobalActivityCostProfileContext"), "COUNT", "GLOBAL_ACTIVITY_COST_KNOWN_COUNT"),
    totalOccurrenceCount: typedMeasureOfKind(requireProperty(record, "totalOccurrenceCount", "GlobalActivityCostProfileContext"), "COUNT", "GLOBAL_ACTIVITY_COST_TOTAL_COUNT"),
    coverageRatio: typedMeasureOfKind(requireProperty(record, "coverageRatio", "GlobalActivityCostProfileContext"), "RATIO", "GLOBAL_ACTIVITY_COST_COVERAGE"),
    nonAdditiveAcrossActivities: true,
  };
}
function parseMomentComparison(value: unknown): GlobalMomentComparisonContext {
  const record = parseStrictRecord(value, ["comparisonTier", "comparisonProfileId", "peerCount", "subjectCost", "peerMedian", "q1", "q3", "mad", "absoluteDelta", "relativeDelta"], "GlobalMomentComparisonContext");
  const money = (key: "subjectCost" | "peerMedian" | "q1" | "q3" | "mad" | "absoluteDelta") => typedMeasureOfKind(requireProperty(record, key, "GlobalMomentComparisonContext"), "MONEY", `GLOBAL_MOMENT_COMPARISON_${key.toUpperCase()}`);
  return {
    comparisonTier: parseStringLiteral(requireProperty(record, "comparisonTier", "GlobalMomentComparisonContext"), new Set(["SAME_SERIES", "SAME_TYPE", "SAME_FAMILY"]), "comparisonTier"),
    comparisonProfileId: text(requireProperty(record, "comparisonProfileId", "GlobalMomentComparisonContext"), "comparisonProfileId"),
    peerCount: typedMeasureOfKind(requireProperty(record, "peerCount", "GlobalMomentComparisonContext"), "COUNT", "GLOBAL_MOMENT_COMPARISON_PEER_COUNT"),
    subjectCost: money("subjectCost"),
    peerMedian: money("peerMedian"),
    ...(hasOwn(record, "q1") ? { q1: money("q1") } : {}),
    ...(hasOwn(record, "q3") ? { q3: money("q3") } : {}),
    ...(hasOwn(record, "mad") ? { mad: money("mad") } : {}),
    absoluteDelta: money("absoluteDelta"),
    ...(hasOwn(record, "relativeDelta") ? { relativeDelta: typedMeasureOfKind(requireProperty(record, "relativeDelta", "GlobalMomentComparisonContext"), "DECIMAL", "GLOBAL_MOMENT_COMPARISON_RELATIVE_DELTA") } : {}),
  };
}

function parseMomentCost(value: unknown): GlobalMomentCost {
  const record = parseStrictRecord(value, ["status", "value"], "GlobalMomentCost");
  const costStatus = parseStringLiteral<GlobalMomentCost["status"]>(requireProperty(record, "status", "GlobalMomentCost"), knowledge, "GlobalMomentCost.status");
  const valueMeasure = optional(record, "value", (entry) => typedMeasureOfKind(entry, "MONEY", "GLOBAL_MOMENT_COST"));
  if ((costStatus === "KNOWN" || costStatus === "PARTIAL") !== (valueMeasure !== undefined)) throw new TypeError("GLOBAL_MOMENT_COST_STATUS_VALUE_MISMATCH");
  return costStatus === "KNOWN" || costStatus === "PARTIAL" ? { status: costStatus, value: valueMeasure! } : { status: costStatus };
}

function parseMomentComponent(value: unknown): GlobalMomentComponentRow {
  const record = parseStrictRecord(value, ["componentRef", "primaryLabel", "labelSource", "amount", "sourceKind", "sourceOperationRef", "categoryRef", "categoryLabel", "subcategoryRef", "subcategoryLabel", "merchantRef", "merchantLabel", "causalRole", "compositionGroup", "evidenceRefs"], "GlobalMomentComponentRow");
  const read = (key: string) => optional(record, key, (entry) => text(entry, key));
  const sourceOperationRef = read("sourceOperationRef"), categoryRef = read("categoryRef"), categoryLabel = read("categoryLabel"), subcategoryRef = read("subcategoryRef"), subcategoryLabel = read("subcategoryLabel"), merchantRef = read("merchantRef"), merchantLabel = read("merchantLabel"), causalRole = read("causalRole"), compositionGroup = read("compositionGroup");
  return {
    componentRef: text(requireProperty(record, "componentRef", "GlobalMomentComponentRow"), "componentRef"),
    primaryLabel: text(requireProperty(record, "primaryLabel", "GlobalMomentComponentRow"), "primaryLabel"),
    labelSource: parseStringLiteral<GlobalMomentComponentRow["labelSource"]>(requireProperty(record, "labelSource", "GlobalMomentComponentRow"), new Set(["ITEM", "PRECISE_DESCRIPTION", "PRECISE_TYPE", "CANONICAL_MERCHANT", "SUBCATEGORY", "CATEGORY", "BANK_LABEL", "CONTEXTUAL_NOTE", "SOURCE_GRAIN"]), "labelSource"),
    amount: typedMeasureOfKind(requireProperty(record, "amount", "GlobalMomentComponentRow"), "MONEY", "GLOBAL_MOMENT_COMPONENT_AMOUNT"),
    sourceKind: parseStringLiteral<GlobalMomentComponentRow["sourceKind"]>(requireProperty(record, "sourceKind", "GlobalMomentComponentRow"), new Set(["Operation_parent", "Operation_residual", "Allocation", "Item", "Payment_component", "Cash_economic_use"]), "sourceKind"),
    ...(sourceOperationRef === undefined ? {} : { sourceOperationRef }), ...(categoryRef === undefined ? {} : { categoryRef }), ...(categoryLabel === undefined ? {} : { categoryLabel }), ...(subcategoryRef === undefined ? {} : { subcategoryRef }), ...(subcategoryLabel === undefined ? {} : { subcategoryLabel }), ...(merchantRef === undefined ? {} : { merchantRef }), ...(merchantLabel === undefined ? {} : { merchantLabel }), ...(causalRole === undefined ? {} : { causalRole }), ...(compositionGroup === undefined ? {} : { compositionGroup }),
    evidenceRefs: strings(requireProperty(record, "evidenceRefs", "GlobalMomentComponentRow"), "componentEvidence"),
  };
}

function parseComponentGroup(value: unknown): GlobalMomentComponentGroup {
  const record = parseStrictRecord(value, ["groupKey", "groupLabel", "amount", "componentRefs", "count"], "GlobalMomentComponentGroup");
  const componentRefs = strings(requireProperty(record, "componentRefs", "GlobalMomentComponentGroup"), "groupComponentRefs");
  const count = integer(requireProperty(record, "count", "GlobalMomentComponentGroup"), "count");
  if (count !== componentRefs.length) throw new TypeError("GLOBAL_MOMENT_COMPONENT_GROUP_COUNT_MISMATCH");
  return { groupKey: text(requireProperty(record, "groupKey", "GlobalMomentComponentGroup"), "groupKey"), groupLabel: text(requireProperty(record, "groupLabel", "GlobalMomentComponentGroup"), "groupLabel"), amount: typedMeasureOfKind(requireProperty(record, "amount", "GlobalMomentComponentGroup"), "MONEY", "GLOBAL_MOMENT_COMPONENT_GROUP_AMOUNT"), componentRefs, count };
}

function parsePeerObservation(value: unknown): GlobalMomentPeerObservation {
  const record = parseStrictRecord(value, ["peerRef", "canonicalName", "startDate", "endDate", "typeKey", "typeLabel", "familyKey", "causalCost", "placeSummary", "componentPreview", "detailRef"], "GlobalMomentPeerObservation");
  const componentPreview = array(requireProperty(record, "componentPreview", "GlobalMomentPeerObservation"), parseMomentComponent, "componentPreview");
  if (componentPreview.length > 3) throw new TypeError("GLOBAL_MOMENT_COMPONENT_PREVIEW_LIMIT");
  const placeSummary = optional(record, "placeSummary", (entry) => strings(entry, "peerPlaces"));
  const startDate = parseLocalDate(requireProperty(record, "startDate", "GlobalMomentPeerObservation"));
  const endDate = parseLocalDate(requireProperty(record, "endDate", "GlobalMomentPeerObservation"));
  if (endDate < startDate) throw new TypeError("GLOBAL_MOMENT_PEER_INTERVAL_INVALID");
  return { peerRef: text(requireProperty(record, "peerRef", "GlobalMomentPeerObservation"), "peerRef"), canonicalName: text(requireProperty(record, "canonicalName", "GlobalMomentPeerObservation"), "canonicalName"), startDate, endDate, typeKey: text(requireProperty(record, "typeKey", "GlobalMomentPeerObservation"), "typeKey"), typeLabel: text(requireProperty(record, "typeLabel", "GlobalMomentPeerObservation"), "typeLabel"), familyKey: text(requireProperty(record, "familyKey", "GlobalMomentPeerObservation"), "familyKey"), causalCost: parseMomentCost(requireProperty(record, "causalCost", "GlobalMomentPeerObservation")), ...(placeSummary === undefined ? {} : { placeSummary }), componentPreview, detailRef: text(requireProperty(record, "detailRef", "GlobalMomentPeerObservation"), "detailRef") };
}

function parseSimilarity(value: unknown): GlobalMomentSimilarity {
  const record = parseStrictRecord(value, ["basis", "requiredFacetKeys", "matchedFacets", "supportPolicyRef"], "GlobalMomentSimilarity");
  const matchedFacets = array(requireProperty(record, "matchedFacets", "GlobalMomentSimilarity"), (entry) => { const facet = parseStrictRecord(entry, ["facetKey", "value"], "GlobalMomentMatchedFacet"); return { facetKey: text(requireProperty(facet, "facetKey", "GlobalMomentMatchedFacet"), "facetKey"), value: text(requireProperty(facet, "value", "GlobalMomentMatchedFacet"), "value") }; }, "matchedFacets");
  return { basis: parseStringLiteral<GlobalMomentSimilarity["basis"]>(requireProperty(record, "basis", "GlobalMomentSimilarity"), new Set(["SAME_SERIES", "SAME_TYPE", "SAME_FAMILY"]), "basis"), requiredFacetKeys: strings(requireProperty(record, "requiredFacetKeys", "GlobalMomentSimilarity"), "requiredFacetKeys"), matchedFacets, supportPolicyRef: text(requireProperty(record, "supportPolicyRef", "GlobalMomentSimilarity"), "supportPolicyRef") };
}

function parseSpentDuring(value: unknown): GlobalSpentDuringContext {
  const record = parseStrictRecord(value, ["label", "cost", "relationToCausalCost"], "GlobalSpentDuringContext");
  return { label: text(requireProperty(record, "label", "GlobalSpentDuringContext"), "label"), cost: parseMomentCost(requireProperty(record, "cost", "GlobalSpentDuringContext")), relationToCausalCost: parseStringLiteral(requireProperty(record, "relationToCausalCost", "GlobalSpentDuringContext"), new Set(["INDEPENDENT_SCOPE"]), "relationToCausalCost") };
}

function parseGroceryRhythm(value: unknown): GlobalGroceryRhythmContext {
  const record = parseStrictRecord(value, ["grain", "policyRef", "thresholds", "eligibleMonthCount", "historicalComparisonGate", "months"], "GlobalGroceryRhythmContext");
  const thresholds = parseStrictRecord(requireProperty(record, "thresholds", "GlobalGroceryRhythmContext"), ["p25", "p75"], "GlobalGroceryThresholds");
  const months = array(requireProperty(record, "months", "GlobalGroceryRhythmContext"), (entry) => {
    const month = parseStrictRecord(entry, ["month", "occurrenceCount", "knownCostOccurrenceCount", "coverage", "basketStructure", "monthlyGrocerySpend", "limitationCodes"], "GlobalGroceryMonth");
    const coverage = requireProperty(month, "coverage", "GlobalGroceryMonth");
    if (typeof coverage !== "number" || !Number.isFinite(coverage) || coverage < 0 || coverage > 1) throw new TypeError("GLOBAL_GROCERY_COVERAGE_INVALID");
    const basket = parseStrictRecord(requireProperty(month, "basketStructure", "GlobalGroceryMonth"), ["status", "small", "intermediate", "large", "reasonCode"], "GlobalGroceryBasketStructure");
    const basketStatus = parseStringLiteral<"KNOWN" | "GATED">(requireProperty(basket, "status", "GlobalGroceryBasketStructure"), new Set(["KNOWN", "GATED"]), "basketStatus");
    const basketStructure = basketStatus === "KNOWN" ? { status: "KNOWN" as const, small: integer(requireProperty(basket, "small", "GlobalGroceryBasketStructure"), "small"), intermediate: integer(requireProperty(basket, "intermediate", "GlobalGroceryBasketStructure"), "intermediate"), large: integer(requireProperty(basket, "large", "GlobalGroceryBasketStructure"), "large") } : { status: "GATED" as const, reasonCode: parseStringLiteral<"COVERAGE_BELOW_70_PERCENT">(requireProperty(basket, "reasonCode", "GlobalGroceryBasketStructure"), new Set(["COVERAGE_BELOW_70_PERCENT"]), "reasonCode") };
    return { month: parseYearMonth(requireProperty(month, "month", "GlobalGroceryMonth")), occurrenceCount: integer(requireProperty(month, "occurrenceCount", "GlobalGroceryMonth"), "occurrenceCount"), knownCostOccurrenceCount: integer(requireProperty(month, "knownCostOccurrenceCount", "GlobalGroceryMonth"), "knownCostOccurrenceCount"), coverage, basketStructure, monthlyGrocerySpend: parseMomentCost(requireProperty(month, "monthlyGrocerySpend", "GlobalGroceryMonth")), limitationCodes: strings(requireProperty(month, "limitationCodes", "GlobalGroceryMonth"), "groceryLimitations") };
  }, "groceryMonths");
  return { grain: parseStringLiteral<"HOUSEHOLD_MONTH">(requireProperty(record, "grain", "GlobalGroceryRhythmContext"), new Set(["HOUSEHOLD_MONTH"]), "grain"), policyRef: text(requireProperty(record, "policyRef", "GlobalGroceryRhythmContext"), "policyRef"), thresholds: { p25: typedMeasureOfKind(requireProperty(thresholds, "p25", "GlobalGroceryThresholds"), "MONEY", "GROCERY_P25"), p75: typedMeasureOfKind(requireProperty(thresholds, "p75", "GlobalGroceryThresholds"), "MONEY", "GROCERY_P75") }, eligibleMonthCount: integer(requireProperty(record, "eligibleMonthCount", "GlobalGroceryRhythmContext"), "eligibleMonthCount"), historicalComparisonGate: parseStringLiteral<"AVAILABLE" | "GATED">(requireProperty(record, "historicalComparisonGate", "GlobalGroceryRhythmContext"), new Set(["AVAILABLE", "GATED"]), "historicalComparisonGate"), months };
}
function parseRow(value: unknown): GlobalDetailRow {
  const record = parseStrictRecord(value, ["rowId", "labelKey", "displayValue", "typedMeasure", "phenomenonRef", "phenomenonQuality", "knowledgeState", "entityRef", "activityCostProfile", "momentComparison", "evidenceRefs"], "GlobalDetailRow");
  const displayValue = optional(record, "displayValue", (entry) => text(entry, "displayValue"));
  const entityRef = optional(record, "entityRef", (entry) => text(entry, "entityRef"));
  const typedMeasure = optional(record, "typedMeasure", parseGlobalTypedMeasure);
  const phenomenonRef = optional(record, "phenomenonRef", (entry) => text(entry, "phenomenonRef"));
  const phenomenonQuality = optional(record, "phenomenonQuality", parseGlobalPhenomenonQuality);
  const activityCostProfile = optional(record, "activityCostProfile", parseActivityCostProfile);
  const momentComparison = optional(record, "momentComparison", parseMomentComparison);
  return { rowId: text(requireProperty(record, "rowId", "GlobalDetailRow"), "rowId"), labelKey: text(requireProperty(record, "labelKey", "GlobalDetailRow"), "labelKey"), ...(displayValue === undefined ? {} : { displayValue }), ...(typedMeasure === undefined ? {} : { typedMeasure }), ...(phenomenonRef === undefined ? {} : { phenomenonRef }), ...(phenomenonQuality === undefined ? {} : { phenomenonQuality }), knowledgeState: status(requireProperty(record, "knowledgeState", "GlobalDetailRow")), ...(entityRef === undefined ? {} : { entityRef }), ...(activityCostProfile === undefined ? {} : { activityCostProfile }), ...(momentComparison === undefined ? {} : { momentComparison }), evidenceRefs: strings(requireProperty(record, "evidenceRefs", "GlobalDetailRow"), "rowEvidence") };
}
function parseDestination(value: unknown): GlobalNavigationDestination {
  const record = parseStrictRecord(value, ["targetId", "kind", "resource", "instanceKey", "entityRef", "scopeHash", "sourcePublicationId", "sourceAnalyticsRevision"], "GlobalNavigationDestination");
  const kind = parseStringLiteral<GlobalNavigationDestination["kind"]>(requireProperty(record, "kind", "GlobalNavigationDestination"), new Set(["GLOBAL_QUERY", "HISTORY", "OPERATIONS", "ENTITY", "METHODOLOGY"]), "destinationKind");
  const instanceKey = optional(record, "instanceKey", (entry) => text(entry, "instanceKey"));
  const entityRef = optional(record, "entityRef", (entry) => text(entry, "entityRef"));
  if (kind === "GLOBAL_QUERY" && instanceKey === undefined) throw new TypeError("GLOBAL_DESTINATION_INSTANCE_REQUIRED");
  if (kind !== "GLOBAL_QUERY" && instanceKey !== undefined) throw new TypeError("GLOBAL_EXTERNAL_DESTINATION_INSTANCE_FORBIDDEN");
  if (kind === "ENTITY" && entityRef === undefined) throw new TypeError("GLOBAL_ENTITY_DESTINATION_REF_REQUIRED");
  const scopeHash = text(requireProperty(record, "scopeHash", "GlobalNavigationDestination"), "scopeHash");
  if (!HASH.test(scopeHash)) throw new TypeError("GLOBAL_DESTINATION_SCOPE_HASH_INVALID");
  return { targetId: text(requireProperty(record, "targetId", "GlobalNavigationDestination"), "targetId"), kind, resource: text(requireProperty(record, "resource", "GlobalNavigationDestination"), "resource"), ...(instanceKey === undefined ? {} : { instanceKey }), ...(entityRef === undefined ? {} : { entityRef }), scopeHash, sourcePublicationId: text(requireProperty(record, "sourcePublicationId", "GlobalNavigationDestination"), "sourcePublicationId"), sourceAnalyticsRevision: integer(requireProperty(record, "sourceAnalyticsRevision", "GlobalNavigationDestination"), "sourceAnalyticsRevision") };
}
function parseCapability(value: unknown): GlobalModuleCapability {
  const record = parseStrictRecord(value, ["capabilityId", "state", "reasonCodes"], "GlobalDetailCapability");
  return { capabilityId: text(requireProperty(record, "capabilityId", "GlobalDetailCapability"), "capabilityId"), state: parseStringLiteral(requireProperty(record, "state", "GlobalDetailCapability"), new Set(["AVAILABLE", "PARTIAL", "UNAVAILABLE", "CONFLICT"]), "capabilityState"), reasonCodes: strings(requireProperty(record, "reasonCodes", "GlobalDetailCapability"), "capabilityReasons") };
}

export function parseGlobalExpandedReadModel(value: unknown): GlobalExpandedReadModel {
  const record = parseStrictRecord(value, ["kind", "schemaVersion", "resource", "moduleKey", "sectionKey", "visibility", "reasonCode", "primaryInsight", "secondaryInsights", "metrics", "series", "rows", "destinations", "peerObservations", "similarity", "momentComponentRows", "componentGroups", "spentDuringContext", "groceryRhythm", "quality", "capabilities", "publicationMeta", "resourceMeta"], "GlobalExpandedReadModel");
  const resource = parseStringLiteral<GlobalV2ExpandedResourceName>(requireProperty(record, "resource", "GlobalExpandedReadModel"), expandedResources, "expandedResource");
  const moduleKey = parseStringLiteral<GlobalPrimaryModuleKey>(requireProperty(record, "moduleKey", "GlobalExpandedReadModel"), moduleKeys, "moduleKey");
  const catalogModule = globalV2ExpandedResourceCatalog.find((entry) => entry.resource === resource)?.moduleKey;
  if (resource !== "analysis_global_methodology" && catalogModule !== moduleKey) throw new TypeError("GLOBAL_EXPANDED_RESOURCE_MODULE_MISMATCH");
  const sectionKey = parseStringLiteral<GlobalExpandedSectionKey>(requireProperty(record, "sectionKey", "GlobalExpandedReadModel"), sectionKeys, "sectionKey");
  const visibility = parseStringLiteral<GlobalPublicationVisibility>(requireProperty(record, "visibility", "GlobalExpandedReadModel"), visibilities, "visibility");
  const reasonCode = optional(record, "reasonCode", (entry) => parseStringLiteral<GlobalPublicationReasonCode>(entry, reasons, "reasonCode"));
  const primaryInsight = optional(record, "primaryInsight", parseInsight);
  const secondaryInsights = array(requireProperty(record, "secondaryInsights", "GlobalExpandedReadModel"), parseInsight, "secondaryInsights");
  const metrics = array(requireProperty(record, "metrics", "GlobalExpandedReadModel"), parseMetric, "metrics");
  const series = array(requireProperty(record, "series", "GlobalExpandedReadModel"), parseSeries, "series");
  const rows = array(requireProperty(record, "rows", "GlobalExpandedReadModel"), parseRow, "rows");
  const destinations = array(requireProperty(record, "destinations", "GlobalExpandedReadModel"), parseDestination, "destinations");
  const peerObservations = optional(record, "peerObservations", (entry) => array(entry, parsePeerObservation, "peerObservations"));
  const similarity = optional(record, "similarity", parseSimilarity);
  const momentComponentRows = optional(record, "momentComponentRows", (entry) => array(entry, parseMomentComponent, "momentComponentRows"));
  const componentGroups = optional(record, "componentGroups", (entry) => array(entry, parseComponentGroup, "componentGroups"));
  const spentDuringContext = optional(record, "spentDuringContext", parseSpentDuring);
  const groceryRhythm = optional(record, "groceryRhythm", parseGroceryRhythm);
  if ([peerObservations, similarity, momentComponentRows, componentGroups, spentDuringContext].some((entry) => entry !== undefined) && resource !== "analysis_global_moment_experience_detail") throw new TypeError("GLOBAL_MOMENT_DETAIL_EXTENSION_RESOURCE_MISMATCH");
  if (groceryRhythm !== undefined && resource !== "analysis_global_routine_detail") throw new TypeError("GLOBAL_GROCERY_DETAIL_RESOURCE_MISMATCH");
  if (peerObservations !== undefined && new Set(peerObservations.map(({ peerRef }) => peerRef)).size !== peerObservations.length) throw new TypeError("GLOBAL_MOMENT_PEER_DUPLICATE");
  if (momentComponentRows !== undefined && new Set(momentComponentRows.map(({ componentRef }) => componentRef)).size !== momentComponentRows.length) throw new TypeError("GLOBAL_MOMENT_COMPONENT_DUPLICATE");
  if (secondaryInsights.length > GLOBAL_MAX_SECONDARY_INSIGHTS || secondaryInsights.length + (primaryInsight === undefined ? 0 : 1) > GLOBAL_MAX_EXPANDED_INSIGHTS) throw new TypeError("GLOBAL_EXPANDED_INSIGHT_LIMIT");
  const metricLimit = resource === "analysis_global_economic_expanded" && sectionKey === "EVOLUTION" ? GLOBAL_MAX_M1_EVOLUTION_METRICS : GLOBAL_MAX_SECTION_METRICS;
  if (metrics.length > metricLimit || series.length > GLOBAL_MAX_SECTION_SERIES || rows.length > GLOBAL_MAX_SECTION_ROWS || destinations.length > GLOBAL_MAX_SECTION_TARGETS) throw new TypeError("GLOBAL_EXPANDED_SECTION_LIMIT");
  if (visibility !== "VISIBLE" && (primaryInsight !== undefined || secondaryInsights.length + metrics.length + series.length + rows.length > 0)) throw new TypeError("GLOBAL_EXPANDED_NON_VISIBLE_CONTENT");
  if (visibility !== "VISIBLE" && reasonCode === undefined) throw new TypeError("GLOBAL_EXPANDED_REASON_REQUIRED");
  const insightIds = [primaryInsight, ...secondaryInsights].filter((entry): entry is GlobalCompactInsight => entry !== undefined).map(({ insightId }) => insightId);
  if (new Set(insightIds).size !== insightIds.length) throw new TypeError("GLOBAL_EXPANDED_INSIGHT_DUPLICATE");
  return { kind: parseStringLiteral(requireProperty(record, "kind", "GlobalExpandedReadModel"), new Set(["global_expanded"]), "kind"), schemaVersion: parseStringLiteral(requireProperty(record, "schemaVersion", "GlobalExpandedReadModel"), new Set(["global-expanded@v1"]), "schemaVersion"), resource, moduleKey, sectionKey, visibility, ...(reasonCode === undefined ? {} : { reasonCode }), ...(primaryInsight === undefined ? {} : { primaryInsight }), secondaryInsights, metrics, series, rows, destinations, ...(peerObservations === undefined ? {} : { peerObservations }), ...(similarity === undefined ? {} : { similarity }), ...(momentComponentRows === undefined ? {} : { momentComponentRows }), ...(componentGroups === undefined ? {} : { componentGroups }), ...(spentDuringContext === undefined ? {} : { spentDuringContext }), ...(groceryRhythm === undefined ? {} : { groceryRhythm }), quality: parseQuality(requireProperty(record, "quality", "GlobalExpandedReadModel")), capabilities: array(requireProperty(record, "capabilities", "GlobalExpandedReadModel"), parseCapability, "capabilities"), publicationMeta: parsePublicationMeta(requireProperty(record, "publicationMeta", "GlobalExpandedReadModel")), resourceMeta: parseResourceMeta(requireProperty(record, "resourceMeta", "GlobalExpandedReadModel")) };
}

export function parseImportedGlobalSummaryReadModel(value: unknown): ImportedGlobalSummaryReadModel {
  const record = parseStrictRecord(value, ["kind", "schemaVersion", "status", "sanitizedHtml", "importedAt", "contentHash", "publicationMeta", "resourceMeta"], "ImportedGlobalSummaryReadModel");
  const resultStatus = parseStringLiteral<ImportedGlobalSummaryReadModel["status"]>(requireProperty(record, "status", "ImportedGlobalSummaryReadModel"), new Set(["FRESH", "STALE", "MISSING"]), "summaryStatus");
  const sanitizedHtml = optional(record, "sanitizedHtml", (entry) => text(entry, "sanitizedHtml"));
  const importedAt = optional(record, "importedAt", (entry) => text(entry, "importedAt"));
  const contentHash = optional(record, "contentHash", (entry) => text(entry, "contentHash"));
  if (resultStatus === "MISSING" ? sanitizedHtml !== undefined || importedAt !== undefined || contentHash !== undefined : sanitizedHtml === undefined || importedAt === undefined || contentHash === undefined) throw new TypeError("GLOBAL_IMPORTED_SUMMARY_STATE_MISMATCH");
  if (sanitizedHtml !== undefined) {
    if (/<\s*(script|iframe|object|embed)|\son[a-z]+\s*=|javascript:/iu.test(sanitizedHtml)) throw new TypeError("GLOBAL_IMPORTED_SUMMARY_UNSAFE_HTML");
    const paragraphs = sanitizedHtml.match(/<p(?:\s[^>]*)?>[\s\S]*?<\/p>/giu)?.length ?? 0;
    if (paragraphs < 2 || paragraphs > 4) throw new TypeError("GLOBAL_IMPORTED_SUMMARY_PARAGRAPH_COUNT");
  }
  if (importedAt !== undefined && !INSTANT.test(importedAt)) throw new TypeError("GLOBAL_IMPORTED_SUMMARY_DATE_INVALID");
  if (contentHash !== undefined && !HASH.test(contentHash)) throw new TypeError("GLOBAL_IMPORTED_SUMMARY_HASH_INVALID");
  return { kind: parseStringLiteral(requireProperty(record, "kind", "ImportedGlobalSummaryReadModel"), new Set(["global_imported_summary"]), "kind"), schemaVersion: parseStringLiteral(requireProperty(record, "schemaVersion", "ImportedGlobalSummaryReadModel"), new Set(["global-imported-summary@v1"]), "schemaVersion"), status: resultStatus, ...(sanitizedHtml === undefined ? {} : { sanitizedHtml }), ...(importedAt === undefined ? {} : { importedAt }), ...(contentHash === undefined ? {} : { contentHash }), publicationMeta: parsePublicationMeta(requireProperty(record, "publicationMeta", "ImportedGlobalSummaryReadModel")), resourceMeta: parseResourceMeta(requireProperty(record, "resourceMeta", "ImportedGlobalSummaryReadModel")) };
}

export function buildGlobalExpandedReadModel(input: GlobalExpandedReadModel): GlobalExpandedReadModel {
  const canonical = {
    ...input,
    secondaryInsights: [...input.secondaryInsights].sort((a, b) => a.editorialRank - b.editorialRank || a.insightId.localeCompare(b.insightId)),
    metrics: [...input.metrics].sort((a, b) => a.metricId.localeCompare(b.metricId)),
    series: [...input.series].sort((a, b) => a.seriesId.localeCompare(b.seriesId)),
    rows: [...input.rows].sort((a, b) => a.rowId.localeCompare(b.rowId)),
    destinations: [...input.destinations].sort((a, b) => a.targetId.localeCompare(b.targetId)),
    ...(input.peerObservations === undefined ? {} : { peerObservations: [...input.peerObservations].sort((a, b) => a.peerRef.localeCompare(b.peerRef)) }),
    ...(input.momentComponentRows === undefined ? {} : { momentComponentRows: [...input.momentComponentRows].sort((a, b) => a.componentRef.localeCompare(b.componentRef)) }),
    ...(input.componentGroups === undefined ? {} : { componentGroups: [...input.componentGroups].map((group) => ({ ...group, componentRefs: [...group.componentRefs].sort() })).sort((a, b) => a.groupKey.localeCompare(b.groupKey)) }),
    capabilities: [...input.capabilities].map((entry) => ({ ...entry, reasonCodes: [...entry.reasonCodes].sort() })).sort((a, b) => a.capabilityId.localeCompare(b.capabilityId)),
  };
  const parsed = parseGlobalExpandedReadModel(canonical);
  if (new TextEncoder().encode(JSON.stringify(parsed)).byteLength > GLOBAL_EXPANDED_PAYLOAD_BUDGET_BYTES) throw new TypeError("GLOBAL_EXPANDED_PAYLOAD_BUDGET_EXCEEDED");
  return parsed;
}

export function buildImportedGlobalSummaryReadModel(input: ImportedGlobalSummaryReadModel): ImportedGlobalSummaryReadModel {
  return parseImportedGlobalSummaryReadModel(input);
}

export const globalExpandedReadModelSchema = createRuntimeSchema(parseGlobalExpandedReadModel);
export const importedGlobalSummaryReadModelSchema = createRuntimeSchema(parseImportedGlobalSummaryReadModel);
export const globalExpandedReadModelSchemas = Object.freeze(Object.fromEntries(globalV2ExpandedResourceCatalog.map(({ resource }) => [resource, globalExpandedReadModelSchema])) as Readonly<Record<GlobalV2ExpandedResourceName, RuntimeSchema<GlobalExpandedReadModel>>>);
