import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../../core/validation";
import type {
  GlobalCompactInsight,
  GlobalCompactKpi,
  GlobalCompactQuality,
  GlobalPhenomenonQuality,
  GlobalTypedMeasure,
  GlobalDetailEntry,
  GlobalInitialModuleEntry,
  GlobalInitialReadModel,
  GlobalModuleCapability,
  GlobalModuleCompactReadModel,
  GlobalPrimaryModuleKey,
  GlobalPrimaryResourceName,
  GlobalReadModelPublicationMeta,
  GlobalReadModelResourceMeta,
  GlobalReadModelTransportState,
} from "./types";
import { parseGlobalPhenomenonQuality, parseGlobalTypedMeasure } from "./typed-values";
import { globalPrimaryModuleCatalog } from "./types";
import type { DataStatus, PartialMeaning } from "../../core/history-v2";
import type { GlobalPublicationQualification, GlobalPublicationReasonCode, GlobalPublicationVisibility } from "../../analytics/global-v2/publication";

const moduleKeys = new Set(globalPrimaryModuleCatalog.map(({ moduleKey }) => moduleKey));
const resources = new Set(globalPrimaryModuleCatalog.map(({ resource }) => resource));
const visibilityValues: ReadonlySet<GlobalPublicationVisibility> = new Set(["VISIBLE", "PLACEHOLDER", "HIDDEN"]);
const knowledgeValues: ReadonlySet<DataStatus> = new Set(["KNOWN", "PARTIAL", "UNKNOWN", "NOT_APPLICABLE", "CONFLICT"]);
const qualificationValues: ReadonlySet<GlobalPublicationQualification> = new Set(["NONE", "PARTIAL_COVERAGE", "PARTIAL_SUPPORT", "RECENT_ONLY", "ESTIMATED", "HYBRID", "OBSERVED_SUBSET", "LOWER_BOUND"]);
const reasonValues: ReadonlySet<GlobalPublicationReasonCode> = new Set([
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
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/u;

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${label}_INVALID`);
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${label}_INVALID`);
  return value;
}

function integer(value: unknown, label: string): number {
  const result = finite(value, label);
  if (!Number.isSafeInteger(result) || result < 0) throw new TypeError(`${label}_INVALID`);
  return result;
}

function array<T>(value: unknown, parse: (entry: unknown, index: number) => T, label: string): readonly T[] {
  if (!Array.isArray(value)) throw new TypeError(`${label}_INVALID`);
  return value.map(parse);
}

function strings(value: unknown, label: string): readonly string[] {
  const result = array(value, (entry) => text(entry, label), label);
  if (new Set(result).size !== result.length || result.some((entry, index) => index > 0 && result[index - 1].localeCompare(entry) >= 0)) {
    throw new TypeError(`${label}_NON_CANONICAL`);
  }
  return result;
}

function optional<T>(record: Readonly<Record<string, unknown>>, key: string, parse: (value: unknown) => T): T | undefined {
  return hasOwn(record, key) ? parse(record[key]) : undefined;
}

function parsePublicationMeta(value: unknown): GlobalReadModelPublicationMeta {
  const record = parseStrictRecord(value, ["publicationId", "revision", "factsHash", "generatedAt", "profileId", "manifestHash"], "GlobalReadModelPublicationMeta");
  const factsHash = text(requireProperty(record, "factsHash", "GlobalReadModelPublicationMeta"), "factsHash");
  const manifestHash = text(requireProperty(record, "manifestHash", "GlobalReadModelPublicationMeta"), "manifestHash");
  const generatedAt = text(requireProperty(record, "generatedAt", "GlobalReadModelPublicationMeta"), "generatedAt");
  if (!HASH.test(factsHash) || !HASH.test(manifestHash) || !INSTANT.test(generatedAt)) throw new TypeError("GLOBAL_PUBLICATION_META_INVALID");
  return {
    publicationId: text(requireProperty(record, "publicationId", "GlobalReadModelPublicationMeta"), "publicationId"),
    revision: integer(requireProperty(record, "revision", "GlobalReadModelPublicationMeta"), "revision"),
    factsHash,
    generatedAt,
    profileId: parseStringLiteral(requireProperty(record, "profileId", "GlobalReadModelPublicationMeta"), new Set(["global-v2-household@v1"]), "Global profile"),
    manifestHash,
  };
}

function parseResourceMeta(value: unknown): GlobalReadModelResourceMeta {
  const record = parseStrictRecord(value, ["contractVersion", "methodSignature", "policyVersions", "resourceInputHash"], "GlobalReadModelResourceMeta");
  const methodSignature = text(requireProperty(record, "methodSignature", "GlobalReadModelResourceMeta"), "methodSignature");
  const resourceInputHash = text(requireProperty(record, "resourceInputHash", "GlobalReadModelResourceMeta"), "resourceInputHash");
  if (!HASH.test(methodSignature) || !HASH.test(resourceInputHash)) throw new TypeError("GLOBAL_RESOURCE_HASH_INVALID");
  const policies = parseStrictRecord(requireProperty(record, "policyVersions", "GlobalReadModelResourceMeta"), Object.keys(requireProperty(record, "policyVersions", "GlobalReadModelResourceMeta") as object), "GlobalPolicyVersions");
  const policyVersions = Object.fromEntries(Object.entries(policies).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [text(key, "policyKey"), text(item, "policyVersion")]));
  if (Object.keys(policyVersions).length === 0) throw new TypeError("GLOBAL_POLICY_VERSIONS_EMPTY");
  return { contractVersion: text(requireProperty(record, "contractVersion", "GlobalReadModelResourceMeta"), "contractVersion"), methodSignature, policyVersions, resourceInputHash };
}

function parseQuality(value: unknown): GlobalCompactQuality {
  const record = parseStrictRecord(value, ["knowledgeState", "partialMeaning", "supportStatus", "effectiveCoverage", "dataNature", "limitationCodes", "evidenceRefs"], "GlobalCompactQuality");
  const knowledgeState = parseStringLiteral<DataStatus>(requireProperty(record, "knowledgeState", "GlobalCompactQuality"), knowledgeValues, "knowledgeState");
  const partialMeaning = optional(record, "partialMeaning", (entry) => parseStringLiteral<PartialMeaning>(entry, new Set(["LOWER_BOUND", "OBSERVED_ONLY"]), "partialMeaning"));
  if ((knowledgeState === "PARTIAL") !== (partialMeaning !== undefined)) throw new TypeError("GLOBAL_PARTIAL_MEANING_MISMATCH");
  const supportStatus = optional(record, "supportStatus", (entry) => parseStringLiteral<"INSUFFICIENT" | "PARTIAL_SUPPORT" | "SUFFICIENT" | "STRONG">(entry, new Set(["INSUFFICIENT", "PARTIAL_SUPPORT", "SUFFICIENT", "STRONG"]), "supportStatus"));
  const effectiveCoverage = optional(record, "effectiveCoverage", (entry) => finite(entry, "effectiveCoverage"));
  if (effectiveCoverage !== undefined && (effectiveCoverage < 0 || effectiveCoverage > 1)) throw new TypeError("GLOBAL_COVERAGE_INVALID");
  return {
    knowledgeState,
    ...(partialMeaning === undefined ? {} : { partialMeaning }),
    ...(supportStatus === undefined ? {} : { supportStatus }),
    ...(effectiveCoverage === undefined ? {} : { effectiveCoverage }),
    dataNature: parseStringLiteral(requireProperty(record, "dataNature", "GlobalCompactQuality"), new Set(["OBSERVED", "DECLARED", "ESTIMATED", "HYBRID"]), "dataNature"),
    limitationCodes: strings(requireProperty(record, "limitationCodes", "GlobalCompactQuality"), "limitationCodes"),
    evidenceRefs: strings(requireProperty(record, "evidenceRefs", "GlobalCompactQuality"), "evidenceRefs"),
  };
}

function parseInsight(value: unknown): GlobalCompactInsight {
  const record = parseStrictRecord(value, ["insightId", "phenomenonId", "kind", "titleKey", "statementKey", "primaryMetricRef", "comparisonRef", "entityRefs", "evidenceRefs", "detailRefs", "editorialRank"], "GlobalCompactInsight");
  const primaryMetricRef = optional(record, "primaryMetricRef", (entry) => text(entry, "primaryMetricRef"));
  const comparisonRef = optional(record, "comparisonRef", (entry) => text(entry, "comparisonRef"));
  const editorialRank = integer(requireProperty(record, "editorialRank", "GlobalCompactInsight"), "editorialRank");
  if (editorialRank < 1) throw new TypeError("GLOBAL_EDITORIAL_RANK_INVALID");
  return {
    insightId: text(requireProperty(record, "insightId", "GlobalCompactInsight"), "insightId"),
    phenomenonId: text(requireProperty(record, "phenomenonId", "GlobalCompactInsight"), "phenomenonId"),
    kind: text(requireProperty(record, "kind", "GlobalCompactInsight"), "kind"),
    titleKey: text(requireProperty(record, "titleKey", "GlobalCompactInsight"), "titleKey"),
    statementKey: text(requireProperty(record, "statementKey", "GlobalCompactInsight"), "statementKey"),
    ...(primaryMetricRef === undefined ? {} : { primaryMetricRef }),
    ...(comparisonRef === undefined ? {} : { comparisonRef }),
    entityRefs: strings(requireProperty(record, "entityRefs", "GlobalCompactInsight"), "entityRefs"),
    evidenceRefs: strings(requireProperty(record, "evidenceRefs", "GlobalCompactInsight"), "evidenceRefs"),
    detailRefs: strings(requireProperty(record, "detailRefs", "GlobalCompactInsight"), "detailRefs"),
    editorialRank,
  };
}

function parseKpi(value: unknown): GlobalCompactKpi {
  const record = parseStrictRecord(value, ["kpiId", "phenomenonId", "labelKey", "displayValue", "typedMeasure", "phenomenonRef", "phenomenonQuality", "metricRef", "evidenceRefs"], "GlobalCompactKpi");
  const typedMeasure = optional<GlobalTypedMeasure>(record, "typedMeasure", parseGlobalTypedMeasure);
  const phenomenonRef = optional(record, "phenomenonRef", (entry) => text(entry, "phenomenonRef"));
  const phenomenonQuality = optional<GlobalPhenomenonQuality>(record, "phenomenonQuality", parseGlobalPhenomenonQuality);
  return {
    kpiId: text(requireProperty(record, "kpiId", "GlobalCompactKpi"), "kpiId"),
    phenomenonId: text(requireProperty(record, "phenomenonId", "GlobalCompactKpi"), "phenomenonId"),
    labelKey: text(requireProperty(record, "labelKey", "GlobalCompactKpi"), "labelKey"),
    displayValue: text(requireProperty(record, "displayValue", "GlobalCompactKpi"), "displayValue"),
    ...(typedMeasure === undefined ? {} : { typedMeasure }),
    ...(phenomenonRef === undefined ? {} : { phenomenonRef }),
    ...(phenomenonQuality === undefined ? {} : { phenomenonQuality }),
    metricRef: text(requireProperty(record, "metricRef", "GlobalCompactKpi"), "metricRef"),
    evidenceRefs: strings(requireProperty(record, "evidenceRefs", "GlobalCompactKpi"), "evidenceRefs"),
  };
}

function parseDetail(value: unknown): GlobalDetailEntry {
  const record = parseStrictRecord(value, ["entryId", "labelKey", "targetResource", "targetRef"], "GlobalDetailEntry");
  return Object.fromEntries(["entryId", "labelKey", "targetResource", "targetRef"].map((key) => [key, text(requireProperty(record, key, "GlobalDetailEntry"), key)])) as GlobalDetailEntry;
}

function parseCapability(value: unknown): GlobalModuleCapability {
  const record = parseStrictRecord(value, ["capabilityId", "state", "reasonCodes"], "GlobalModuleCapability");
  return {
    capabilityId: text(requireProperty(record, "capabilityId", "GlobalModuleCapability"), "capabilityId"),
    state: parseStringLiteral(requireProperty(record, "state", "GlobalModuleCapability"), new Set(["AVAILABLE", "PARTIAL", "UNAVAILABLE", "CONFLICT"]), "capabilityState"),
    reasonCodes: strings(requireProperty(record, "reasonCodes", "GlobalModuleCapability"), "capabilityReasonCodes"),
  };
}

function parsePlaceholder(value: unknown) {
  const record = parseStrictRecord(value, ["messageKey", "progress"], "GlobalPlaceholder");
  const progress = optional(record, "progress", (entry) => {
    const item = parseStrictRecord(entry, ["current", "required", "unit"], "GlobalPlaceholderProgress");
    const current = finite(requireProperty(item, "current", "GlobalPlaceholderProgress"), "current");
    const required = finite(requireProperty(item, "required", "GlobalPlaceholderProgress"), "required");
    if (current < 0 || required <= 0 || current > required) throw new TypeError("GLOBAL_PLACEHOLDER_PROGRESS_INVALID");
    return { current, required, unit: text(requireProperty(item, "unit", "GlobalPlaceholderProgress"), "unit") };
  });
  return { messageKey: text(requireProperty(record, "messageKey", "GlobalPlaceholder"), "messageKey"), ...(progress === undefined ? {} : { progress }) };
}

export function parseGlobalModuleCompactReadModel(value: unknown): GlobalModuleCompactReadModel {
  const record = parseStrictRecord(value, ["kind", "schemaVersion", "moduleKey", "resource", "order", "visibility", "qualification", "reasonCode", "placeholder", "primaryInsight", "kpis", "quality", "capabilities", "detailEntries", "publicationMeta", "resourceMeta"], "GlobalModuleCompactReadModel");
  const moduleKey = parseStringLiteral<GlobalPrimaryModuleKey>(requireProperty(record, "moduleKey", "GlobalModuleCompactReadModel"), moduleKeys, "moduleKey");
  const resource = parseStringLiteral<GlobalPrimaryResourceName>(requireProperty(record, "resource", "GlobalModuleCompactReadModel"), resources, "resource");
  const expected = globalPrimaryModuleCatalog.find((entry) => entry.moduleKey === moduleKey);
  const order = integer(requireProperty(record, "order", "GlobalModuleCompactReadModel"), "order");
  if (expected?.resource !== resource || expected.order !== order) throw new TypeError("GLOBAL_MODULE_RESOURCE_IDENTITY_MISMATCH");
  const visibility = parseStringLiteral<GlobalPublicationVisibility>(requireProperty(record, "visibility", "GlobalModuleCompactReadModel"), visibilityValues, "visibility");
  const qualification = optional(record, "qualification", (entry) => parseStringLiteral<GlobalPublicationQualification>(entry, qualificationValues, "qualification"));
  const reasonCode = optional(record, "reasonCode", (entry) => parseStringLiteral<GlobalPublicationReasonCode>(entry, reasonValues, "reasonCode"));
  const placeholder = optional(record, "placeholder", parsePlaceholder);
  const primaryInsight = optional(record, "primaryInsight", parseInsight);
  const kpis = array(requireProperty(record, "kpis", "GlobalModuleCompactReadModel"), parseKpi, "kpis");
  const capabilities = array(requireProperty(record, "capabilities", "GlobalModuleCompactReadModel"), parseCapability, "capabilities");
  const detailEntries = array(requireProperty(record, "detailEntries", "GlobalModuleCompactReadModel"), parseDetail, "detailEntries");
  if (kpis.length > 3) throw new TypeError("GLOBAL_COMPACT_KPI_LIMIT");
  if (visibility !== "VISIBLE" && (primaryInsight !== undefined || kpis.length > 0)) throw new TypeError("GLOBAL_NON_VISIBLE_CONTENT_FORBIDDEN");
  if (visibility === "PLACEHOLDER" && (placeholder === undefined || reasonCode === undefined)) throw new TypeError("GLOBAL_PLACEHOLDER_INCOMPLETE");
  if (visibility !== "PLACEHOLDER" && placeholder !== undefined) throw new TypeError("GLOBAL_PLACEHOLDER_VISIBILITY_MISMATCH");
  return {
    kind: parseStringLiteral(requireProperty(record, "kind", "GlobalModuleCompactReadModel"), new Set(["global_module_compact"]), "kind"),
    schemaVersion: parseStringLiteral(requireProperty(record, "schemaVersion", "GlobalModuleCompactReadModel"), new Set(["global-module-compact@v1"]), "schemaVersion"),
    moduleKey, resource, order, visibility,
    ...(qualification === undefined || qualification === "NONE" ? {} : { qualification }),
    ...(reasonCode === undefined ? {} : { reasonCode }),
    ...(placeholder === undefined ? {} : { placeholder }),
    ...(primaryInsight === undefined ? {} : { primaryInsight }),
    kpis,
    quality: parseQuality(requireProperty(record, "quality", "GlobalModuleCompactReadModel")),
    capabilities,
    detailEntries,
    publicationMeta: parsePublicationMeta(requireProperty(record, "publicationMeta", "GlobalModuleCompactReadModel")),
    resourceMeta: parseResourceMeta(requireProperty(record, "resourceMeta", "GlobalModuleCompactReadModel")),
  };
}

function parseInitialModule(value: unknown): GlobalInitialModuleEntry {
  const record = parseStrictRecord(value, ["moduleKey", "resource", "order", "visibility", "qualification", "reasonCode"], "GlobalInitialModuleEntry");
  const moduleKey = parseStringLiteral<GlobalPrimaryModuleKey>(requireProperty(record, "moduleKey", "GlobalInitialModuleEntry"), moduleKeys, "moduleKey");
  const resource = parseStringLiteral<GlobalPrimaryResourceName>(requireProperty(record, "resource", "GlobalInitialModuleEntry"), resources, "resource");
  const expected = globalPrimaryModuleCatalog.find((entry) => entry.moduleKey === moduleKey);
  const order = integer(requireProperty(record, "order", "GlobalInitialModuleEntry"), "order");
  if (expected?.resource !== resource || expected.order !== order) throw new TypeError("GLOBAL_INITIAL_MODULE_IDENTITY_MISMATCH");
  const qualification = optional(record, "qualification", (entry) => parseStringLiteral<GlobalPublicationQualification>(entry, qualificationValues, "qualification"));
  const reasonCode = optional(record, "reasonCode", (entry) => parseStringLiteral<GlobalPublicationReasonCode>(entry, reasonValues, "reasonCode"));
  return {
    moduleKey, resource, order,
    visibility: parseStringLiteral<GlobalPublicationVisibility>(requireProperty(record, "visibility", "GlobalInitialModuleEntry"), visibilityValues, "visibility"),
    ...(qualification === undefined || qualification === "NONE" ? {} : { qualification }),
    ...(reasonCode === undefined ? {} : { reasonCode }),
  };
}

export function parseGlobalInitialReadModel(value: unknown): GlobalInitialReadModel {
  const record = parseStrictRecord(value, ["kind", "schemaVersion", "navigation", "capabilities", "publicationMeta", "resourceMeta"], "GlobalInitialReadModel");
  const navigation = array(requireProperty(record, "navigation", "GlobalInitialReadModel"), parseInitialModule, "navigation");
  if (navigation.length !== globalPrimaryModuleCatalog.length || navigation.some((entry, index) => entry.moduleKey !== globalPrimaryModuleCatalog[index].moduleKey)) throw new TypeError("GLOBAL_INITIAL_NAVIGATION_INCOMPLETE");
  return {
    kind: parseStringLiteral(requireProperty(record, "kind", "GlobalInitialReadModel"), new Set(["global_initial"]), "kind"),
    schemaVersion: parseStringLiteral(requireProperty(record, "schemaVersion", "GlobalInitialReadModel"), new Set(["global-initial@v1"]), "schemaVersion"),
    navigation,
    capabilities: array(requireProperty(record, "capabilities", "GlobalInitialReadModel"), parseCapability, "capabilities"),
    publicationMeta: parsePublicationMeta(requireProperty(record, "publicationMeta", "GlobalInitialReadModel")),
    resourceMeta: parseResourceMeta(requireProperty(record, "resourceMeta", "GlobalInitialReadModel")),
  };
}

export const globalModuleCompactReadModelSchema = createRuntimeSchema(parseGlobalModuleCompactReadModel);
export const globalInitialReadModelSchema = createRuntimeSchema(parseGlobalInitialReadModel);
export function createGlobalReadModelTransportSchema<Data>(parseData: (value: unknown) => Data) {
  return createRuntimeSchema<GlobalReadModelTransportState<Data>>((value) => {
    const record = parseStrictRecord(value, ["status", "data", "errorCode", "previousData"], "GlobalReadModelTransportState");
    const status = parseStringLiteral<"IDLE" | "LOADING" | "READY" | "ERROR">(requireProperty(record, "status", "GlobalReadModelTransportState"), new Set(["IDLE", "LOADING", "READY", "ERROR"]), "transportStatus");
    if (status === "IDLE" || status === "LOADING") {
      if (hasOwn(record, "data") || hasOwn(record, "errorCode") || hasOwn(record, "previousData")) throw new TypeError("GLOBAL_TRANSPORT_PENDING_HAS_PAYLOAD");
      return { status };
    }
    if (status === "READY") {
      if (!hasOwn(record, "data") || hasOwn(record, "errorCode") || hasOwn(record, "previousData")) throw new TypeError("GLOBAL_TRANSPORT_READY_INVALID");
      return { status, data: parseData(record.data) };
    }
    if (!hasOwn(record, "errorCode") || hasOwn(record, "data")) throw new TypeError("GLOBAL_TRANSPORT_ERROR_INVALID");
    const previousData = optional(record, "previousData", parseData);
    return { status, errorCode: text(record.errorCode, "errorCode"), ...(previousData === undefined ? {} : { previousData }) };
  });
}
export const globalPrimaryReadModelSchemas = Object.freeze(Object.fromEntries(
  globalPrimaryModuleCatalog.map(({ resource }) => [resource, globalModuleCompactReadModelSchema]),
) as Readonly<Record<GlobalPrimaryResourceName, typeof globalModuleCompactReadModelSchema>>);
