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
  GlobalModuleCapability,
  GlobalPrimaryModuleKey,
  GlobalReadModelPublicationMeta,
  GlobalReadModelResourceMeta,
} from "./types";

export const GLOBAL_EXPANDED_PAYLOAD_BUDGET_BYTES = 96 * 1024;
export const GLOBAL_MAX_EXPANDED_INSIGHTS = 5;
export const GLOBAL_MAX_SECONDARY_INSIGHTS = 4;
export const GLOBAL_MAX_SECTION_METRICS = 12;
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
  readonly knowledgeState: DataStatus;
  readonly partialMeaning?: PartialMeaning;
  readonly dataNature: "OBSERVED" | "DECLARED" | "ESTIMATED" | "HYBRID";
  readonly evidenceRefs: readonly string[];
};

export type GlobalDetailSeriesPoint = {
  readonly unitKey: string;
  readonly displayValue?: string;
  readonly knowledgeState: DataStatus;
};

export type GlobalDetailSeries = {
  readonly seriesId: string;
  readonly labelKey: string;
  readonly unit: string;
  readonly points: readonly GlobalDetailSeriesPoint[];
  readonly evidenceRefs: readonly string[];
};

export type GlobalDetailRow = {
  readonly rowId: string;
  readonly labelKey: string;
  readonly displayValue?: string;
  readonly knowledgeState: DataStatus;
  readonly entityRef?: string;
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

export const globalV2ExpandedResourceCatalog = Object.freeze([
  { resource: "analysis_global_economic_expanded", moduleKey: "ECONOMIC", capabilityId: "GLOBAL_ECONOMIC" },
  { resource: "analysis_global_categories_needs_expanded", moduleKey: "CATEGORIES_NEEDS", capabilityId: "GLOBAL_CATEGORIES_NEEDS" },
  { resource: "analysis_global_transformations_expanded", moduleKey: "TRANSFORMATIONS", capabilityId: "GLOBAL_TRANSFORMATIONS" },
  { resource: "analysis_global_rhythm_expanded", moduleKey: "RHYTHM", capabilityId: "GLOBAL_RHYTHM" },
  { resource: "analysis_global_relationships_expanded", moduleKey: "RELATIONSHIPS", capabilityId: "GLOBAL_RELATIONSHIPS" },
  { resource: "analysis_global_moments_expanded", moduleKey: "MOMENTS", capabilityId: "GLOBAL_MOMENTS" },
  { resource: "analysis_global_geo_mobility_expanded", moduleKey: "GEO_MOBILITY", capabilityId: "GLOBAL_GEO_MOBILITY" },
  { resource: "analysis_global_consumption_expanded", moduleKey: "CONSUMPTION", capabilityId: "GLOBAL_CONSUMPTION" },
  { resource: "analysis_global_personas_expanded", moduleKey: "PERSONAS", capabilityId: "GLOBAL_PERSONAS" },
  { resource: "analysis_global_together_expanded", moduleKey: "TOGETHER", capabilityId: "GLOBAL_TOGETHER" },
  { resource: "analysis_global_category_need_detail", moduleKey: "CATEGORIES_NEEDS", capabilityId: "GLOBAL_CATEGORY_NEED_DETAIL" },
  { resource: "analysis_global_transformation_detail", moduleKey: "TRANSFORMATIONS", capabilityId: "GLOBAL_TRANSFORMATION_DETAIL" },
  { resource: "analysis_global_routine_detail", moduleKey: "RHYTHM", capabilityId: "GLOBAL_ROUTINE_DETAIL" },
  { resource: "analysis_global_relationship_detail", moduleKey: "RELATIONSHIPS", capabilityId: "GLOBAL_RELATIONSHIP_DETAIL" },
  { resource: "analysis_global_moment_experience_detail", moduleKey: "MOMENTS", capabilityId: "GLOBAL_MOMENT_DETAIL" },
  { resource: "analysis_global_place_mobility_detail", moduleKey: "GEO_MOBILITY", capabilityId: "GLOBAL_PLACE_DETAIL" },
  { resource: "analysis_global_purchase_merchant_detail", moduleKey: "CONSUMPTION", capabilityId: "GLOBAL_PURCHASE_MERCHANT_DETAIL" },
  { resource: "analysis_global_product_detail", moduleKey: "CONSUMPTION", capabilityId: "GLOBAL_PRODUCT_DETAIL" },
  { resource: "analysis_global_route_detail", moduleKey: "GEO_MOBILITY", capabilityId: "GLOBAL_ROUTE_DETAIL" },
  { resource: "analysis_global_persona_detail", moduleKey: "PERSONAS", capabilityId: "GLOBAL_PERSONA_DETAIL" },
  { resource: "analysis_global_participation_detail", moduleKey: "TOGETHER", capabilityId: "GLOBAL_PARTICIPATION_DETAIL" },
  { resource: "analysis_global_methodology", moduleKey: "ECONOMIC", capabilityId: "GLOBAL_METHODOLOGY" },
] as const);

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
  const record = parseStrictRecord(value, ["metricId", "labelKey", "displayValue", "knowledgeState", "partialMeaning", "dataNature", "evidenceRefs"], "GlobalDetailMetric");
  const knowledgeState = status(requireProperty(record, "knowledgeState", "GlobalDetailMetric"));
  const partialMeaning = optional(record, "partialMeaning", (entry) => parseStringLiteral<PartialMeaning>(entry, new Set(["LOWER_BOUND", "OBSERVED_ONLY"]), "partialMeaning"));
  if ((knowledgeState === "PARTIAL") !== (partialMeaning !== undefined)) throw new TypeError("GLOBAL_DETAIL_METRIC_PARTIAL_MISMATCH");
  return { metricId: text(requireProperty(record, "metricId", "GlobalDetailMetric"), "metricId"), labelKey: text(requireProperty(record, "labelKey", "GlobalDetailMetric"), "labelKey"), displayValue: text(requireProperty(record, "displayValue", "GlobalDetailMetric"), "displayValue"), knowledgeState, ...(partialMeaning === undefined ? {} : { partialMeaning }), dataNature: parseStringLiteral(requireProperty(record, "dataNature", "GlobalDetailMetric"), new Set(["OBSERVED", "DECLARED", "ESTIMATED", "HYBRID"]), "dataNature"), evidenceRefs: strings(requireProperty(record, "evidenceRefs", "GlobalDetailMetric"), "metricEvidence") };
}
function parsePoint(value: unknown): GlobalDetailSeriesPoint {
  const record = parseStrictRecord(value, ["unitKey", "displayValue", "knowledgeState"], "GlobalDetailSeriesPoint");
  const knowledgeState = status(requireProperty(record, "knowledgeState", "GlobalDetailSeriesPoint"));
  const displayValue = optional(record, "displayValue", (entry) => text(entry, "displayValue"));
  if ((knowledgeState === "KNOWN" || knowledgeState === "PARTIAL") !== (displayValue !== undefined)) throw new TypeError("GLOBAL_DETAIL_POINT_VALUE_MISMATCH");
  return { unitKey: text(requireProperty(record, "unitKey", "GlobalDetailSeriesPoint"), "unitKey"), ...(displayValue === undefined ? {} : { displayValue }), knowledgeState };
}
function parseSeries(value: unknown): GlobalDetailSeries {
  const record = parseStrictRecord(value, ["seriesId", "labelKey", "unit", "points", "evidenceRefs"], "GlobalDetailSeries");
  const points = array(requireProperty(record, "points", "GlobalDetailSeries"), parsePoint, "points");
  if (points.length > GLOBAL_MAX_SERIES_POINTS) throw new TypeError("GLOBAL_DETAIL_SERIES_POINT_LIMIT");
  return { seriesId: text(requireProperty(record, "seriesId", "GlobalDetailSeries"), "seriesId"), labelKey: text(requireProperty(record, "labelKey", "GlobalDetailSeries"), "labelKey"), unit: text(requireProperty(record, "unit", "GlobalDetailSeries"), "unit"), points, evidenceRefs: strings(requireProperty(record, "evidenceRefs", "GlobalDetailSeries"), "seriesEvidence") };
}
function parseRow(value: unknown): GlobalDetailRow {
  const record = parseStrictRecord(value, ["rowId", "labelKey", "displayValue", "knowledgeState", "entityRef", "evidenceRefs"], "GlobalDetailRow");
  const displayValue = optional(record, "displayValue", (entry) => text(entry, "displayValue"));
  const entityRef = optional(record, "entityRef", (entry) => text(entry, "entityRef"));
  return { rowId: text(requireProperty(record, "rowId", "GlobalDetailRow"), "rowId"), labelKey: text(requireProperty(record, "labelKey", "GlobalDetailRow"), "labelKey"), ...(displayValue === undefined ? {} : { displayValue }), knowledgeState: status(requireProperty(record, "knowledgeState", "GlobalDetailRow")), ...(entityRef === undefined ? {} : { entityRef }), evidenceRefs: strings(requireProperty(record, "evidenceRefs", "GlobalDetailRow"), "rowEvidence") };
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
  const record = parseStrictRecord(value, ["kind", "schemaVersion", "resource", "moduleKey", "sectionKey", "visibility", "reasonCode", "primaryInsight", "secondaryInsights", "metrics", "series", "rows", "destinations", "quality", "capabilities", "publicationMeta", "resourceMeta"], "GlobalExpandedReadModel");
  const resource = parseStringLiteral<GlobalV2ExpandedResourceName>(requireProperty(record, "resource", "GlobalExpandedReadModel"), expandedResources, "expandedResource");
  const moduleKey = parseStringLiteral<GlobalPrimaryModuleKey>(requireProperty(record, "moduleKey", "GlobalExpandedReadModel"), moduleKeys, "moduleKey");
  const catalogModule = globalV2ExpandedResourceCatalog.find((entry) => entry.resource === resource)?.moduleKey;
  if (resource !== "analysis_global_methodology" && catalogModule !== moduleKey) throw new TypeError("GLOBAL_EXPANDED_RESOURCE_MODULE_MISMATCH");
  const visibility = parseStringLiteral<GlobalPublicationVisibility>(requireProperty(record, "visibility", "GlobalExpandedReadModel"), visibilities, "visibility");
  const reasonCode = optional(record, "reasonCode", (entry) => parseStringLiteral<GlobalPublicationReasonCode>(entry, reasons, "reasonCode"));
  const primaryInsight = optional(record, "primaryInsight", parseInsight);
  const secondaryInsights = array(requireProperty(record, "secondaryInsights", "GlobalExpandedReadModel"), parseInsight, "secondaryInsights");
  const metrics = array(requireProperty(record, "metrics", "GlobalExpandedReadModel"), parseMetric, "metrics");
  const series = array(requireProperty(record, "series", "GlobalExpandedReadModel"), parseSeries, "series");
  const rows = array(requireProperty(record, "rows", "GlobalExpandedReadModel"), parseRow, "rows");
  const destinations = array(requireProperty(record, "destinations", "GlobalExpandedReadModel"), parseDestination, "destinations");
  if (secondaryInsights.length > GLOBAL_MAX_SECONDARY_INSIGHTS || secondaryInsights.length + (primaryInsight === undefined ? 0 : 1) > GLOBAL_MAX_EXPANDED_INSIGHTS) throw new TypeError("GLOBAL_EXPANDED_INSIGHT_LIMIT");
  if (metrics.length > GLOBAL_MAX_SECTION_METRICS || series.length > GLOBAL_MAX_SECTION_SERIES || rows.length > GLOBAL_MAX_SECTION_ROWS || destinations.length > GLOBAL_MAX_SECTION_TARGETS) throw new TypeError("GLOBAL_EXPANDED_SECTION_LIMIT");
  if (visibility !== "VISIBLE" && (primaryInsight !== undefined || secondaryInsights.length + metrics.length + series.length + rows.length > 0)) throw new TypeError("GLOBAL_EXPANDED_NON_VISIBLE_CONTENT");
  if (visibility !== "VISIBLE" && reasonCode === undefined) throw new TypeError("GLOBAL_EXPANDED_REASON_REQUIRED");
  const insightIds = [primaryInsight, ...secondaryInsights].filter((entry): entry is GlobalCompactInsight => entry !== undefined).map(({ insightId }) => insightId);
  if (new Set(insightIds).size !== insightIds.length) throw new TypeError("GLOBAL_EXPANDED_INSIGHT_DUPLICATE");
  return { kind: parseStringLiteral(requireProperty(record, "kind", "GlobalExpandedReadModel"), new Set(["global_expanded"]), "kind"), schemaVersion: parseStringLiteral(requireProperty(record, "schemaVersion", "GlobalExpandedReadModel"), new Set(["global-expanded@v1"]), "schemaVersion"), resource, moduleKey, sectionKey: parseStringLiteral<GlobalExpandedSectionKey>(requireProperty(record, "sectionKey", "GlobalExpandedReadModel"), sectionKeys, "sectionKey"), visibility, ...(reasonCode === undefined ? {} : { reasonCode }), ...(primaryInsight === undefined ? {} : { primaryInsight }), secondaryInsights, metrics, series, rows, destinations, quality: parseQuality(requireProperty(record, "quality", "GlobalExpandedReadModel")), capabilities: array(requireProperty(record, "capabilities", "GlobalExpandedReadModel"), parseCapability, "capabilities"), publicationMeta: parsePublicationMeta(requireProperty(record, "publicationMeta", "GlobalExpandedReadModel")), resourceMeta: parseResourceMeta(requireProperty(record, "resourceMeta", "GlobalExpandedReadModel")) };
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
