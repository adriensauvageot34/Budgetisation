import { parseLocalDate, type LocalDate } from "../../core/time";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../../core/validation";
import type { DataStatus, PartialMeaning } from "../../core/history-v2";
import type {
  GlobalCompactQuality,
  GlobalReadModelPublicationMeta,
  GlobalReadModelResourceMeta,
  GlobalTypedMeasure,
} from "./types";
import type { GlobalNavigationDestination } from "./details";
import { parseGlobalTypedMeasure } from "./typed-values";

export const GLOBAL_LIFE_TIMELINE_MAX_EVENTS = 64;
export const GLOBAL_LIFE_TIMELINE_MAX_DESTINATIONS = 64;
export const GLOBAL_LIFE_TIMELINE_PAYLOAD_BUDGET_BYTES = 96 * 1024;

export const globalLifeTimelineResourceDefinition = Object.freeze({
  resource: "analysis_global_life_timeline",
  moduleKey: "RHYTHM",
  moduleRole: "PRESENTATION_ONLY",
  capabilityId: "GLOBAL_LIFE_TIMELINE",
  group: "exploration",
  paramsKind: "empty",
  family: "global_exploration",
  schemaVersion: "global-life-timeline@v1",
  availability: "AVAILABLE",
} as const);

export type GlobalLifeTimelineResourceName = typeof globalLifeTimelineResourceDefinition.resource;

export type GlobalTimelineCausalCost =
  | { readonly status: "KNOWN" | "PARTIAL"; readonly value: GlobalTypedMeasure }
  | { readonly status: "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT" };

export type GlobalTimelinePlace = {
  readonly placeRef: string;
  readonly label?: string;
};

export type GlobalTimelineComparisonSummary = {
  readonly status: "UNKNOWN" | "PARTIAL" | "KNOWN" | "NOT_APPLICABLE";
  readonly comparisonTier?: "SAME_SERIES" | "SAME_TYPE" | "SAME_FAMILY";
  readonly peerCount: number;
  readonly materiality: "MATERIAL" | "NOT_MATERIAL" | "UNKNOWN";
};

export type GlobalTimelineEvent = {
  readonly eventRef: string;
  readonly sourceKind: "MOMENT" | "LIFE_EVENT";
  readonly canonicalName: string;
  readonly startDate: LocalDate;
  readonly endDate: LocalDate;
  readonly typeKey: string;
  readonly typeLabel: string;
  readonly familyKey: string;
  readonly familySource: "M6" | "LIFE_EVENT";
  readonly momentStructure?: string;
  readonly participantRefs: readonly string[];
  readonly places: readonly GlobalTimelinePlace[];
  readonly causalCost: GlobalTimelineCausalCost;
  readonly seriesRef?: string;
  readonly comparisonSummary?: GlobalTimelineComparisonSummary;
  readonly componentCount?: number;
  readonly detailAvailability: "MOMENT_DETAIL" | "INLINE_ONLY";
  readonly quality: GlobalCompactQuality;
  readonly sourceModule: "MOMENTS" | "CANONICAL";
  readonly sourceOwner: "M6" | "CANONICAL";
};

/** Deferred M3/M5 surfaces remain explicitly empty in v1 until their typed owner contracts are introduced. */
export type GlobalLifeTimelineReadModel = {
  readonly kind: "global_life_timeline";
  readonly schemaVersion: "global-life-timeline@v1";
  readonly resource: "analysis_global_life_timeline";
  readonly moduleKey: "RHYTHM";
  readonly events: readonly GlobalTimelineEvent[];
  readonly chapterOverlays: readonly [];
  readonly contextSignals: readonly [];
  readonly destinations: readonly GlobalNavigationDestination[];
  readonly quality: GlobalCompactQuality;
  readonly publicationMeta: GlobalReadModelPublicationMeta;
  readonly resourceMeta: GlobalReadModelResourceMeta;
};

const HASH = /^[0-9a-f]{64}$/u;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/u;
const knowledgeValues: ReadonlySet<DataStatus> = new Set(["KNOWN", "PARTIAL", "UNKNOWN", "NOT_APPLICABLE", "CONFLICT"]);

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) throw new TypeError(`${label}_INVALID`);
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label}_INVALID`);
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${label}_INVALID`);
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
  const values = array(value, (entry, index) => text(entry, `${label}_${index}`), label);
  if (new Set(values).size !== values.length) throw new TypeError(`${label}_DUPLICATE`);
  return values;
}

function parsePublicationMeta(value: unknown): GlobalReadModelPublicationMeta {
  const record = parseStrictRecord(value, ["publicationId", "revision", "factsHash", "generatedAt", "profileId", "manifestHash"], "GlobalTimelinePublicationMeta");
  const factsHash = text(requireProperty(record, "factsHash", "GlobalTimelinePublicationMeta"), "factsHash");
  const manifestHash = text(requireProperty(record, "manifestHash", "GlobalTimelinePublicationMeta"), "manifestHash");
  const generatedAt = text(requireProperty(record, "generatedAt", "GlobalTimelinePublicationMeta"), "generatedAt");
  if (!HASH.test(factsHash) || !HASH.test(manifestHash) || !INSTANT.test(generatedAt)) throw new TypeError("GLOBAL_TIMELINE_PUBLICATION_META_INVALID");
  return {
    publicationId: text(requireProperty(record, "publicationId", "GlobalTimelinePublicationMeta"), "publicationId"),
    revision: integer(requireProperty(record, "revision", "GlobalTimelinePublicationMeta"), "revision"),
    factsHash,
    generatedAt,
    profileId: parseStringLiteral(requireProperty(record, "profileId", "GlobalTimelinePublicationMeta"), new Set(["global-v2-household@v1"]), "profileId"),
    manifestHash,
  };
}

function parseResourceMeta(value: unknown): GlobalReadModelResourceMeta {
  const record = parseStrictRecord(value, ["contractVersion", "methodSignature", "policyVersions", "resourceInputHash"], "GlobalTimelineResourceMeta");
  const policyRecord = parseStrictRecord(requireProperty(record, "policyVersions", "GlobalTimelineResourceMeta"), Reflect.ownKeys(requireProperty(record, "policyVersions", "GlobalTimelineResourceMeta") as object).filter((key): key is string => typeof key === "string"), "GlobalTimelinePolicyVersions");
  const policyVersions = Object.fromEntries(Object.entries(policyRecord).map(([key, entry]) => [text(key, "policyKey"), text(entry, `policy:${key}`)]));
  const methodSignature = text(requireProperty(record, "methodSignature", "GlobalTimelineResourceMeta"), "methodSignature");
  const resourceInputHash = text(requireProperty(record, "resourceInputHash", "GlobalTimelineResourceMeta"), "resourceInputHash");
  if (!HASH.test(methodSignature) || !HASH.test(resourceInputHash)) throw new TypeError("GLOBAL_TIMELINE_RESOURCE_META_HASH_INVALID");
  return {
    contractVersion: text(requireProperty(record, "contractVersion", "GlobalTimelineResourceMeta"), "contractVersion"),
    methodSignature,
    policyVersions,
    resourceInputHash,
  };
}

function parseQuality(value: unknown): GlobalCompactQuality {
  const record = parseStrictRecord(value, ["knowledgeState", "partialMeaning", "supportStatus", "effectiveCoverage", "dataNature", "limitationCodes", "evidenceRefs"], "GlobalTimelineQuality");
  const knowledgeState = parseStringLiteral<DataStatus>(requireProperty(record, "knowledgeState", "GlobalTimelineQuality"), knowledgeValues, "knowledgeState");
  const partialMeaning = optional(record, "partialMeaning", (entry) => parseStringLiteral<PartialMeaning>(entry, new Set(["LOWER_BOUND", "OBSERVED_ONLY"]), "partialMeaning"));
  const supportStatus = optional(record, "supportStatus", (entry) => parseStringLiteral<GlobalCompactQuality["supportStatus"] & string>(entry, new Set(["INSUFFICIENT", "PARTIAL_SUPPORT", "SUFFICIENT", "STRONG"]), "supportStatus"));
  const effectiveCoverage = optional(record, "effectiveCoverage", (entry) => finite(entry, "effectiveCoverage"));
  if ((knowledgeState === "PARTIAL") !== (partialMeaning !== undefined)) throw new TypeError("GLOBAL_TIMELINE_QUALITY_PARTIAL_MISMATCH");
  if (effectiveCoverage !== undefined && (effectiveCoverage < 0 || effectiveCoverage > 1)) throw new TypeError("GLOBAL_TIMELINE_COVERAGE_RANGE");
  return {
    knowledgeState,
    ...(partialMeaning === undefined ? {} : { partialMeaning }),
    ...(supportStatus === undefined ? {} : { supportStatus }),
    ...(effectiveCoverage === undefined ? {} : { effectiveCoverage }),
    dataNature: parseStringLiteral(requireProperty(record, "dataNature", "GlobalTimelineQuality"), new Set(["OBSERVED", "DECLARED", "ESTIMATED", "HYBRID"]), "dataNature"),
    limitationCodes: strings(requireProperty(record, "limitationCodes", "GlobalTimelineQuality"), "limitationCodes"),
    evidenceRefs: strings(requireProperty(record, "evidenceRefs", "GlobalTimelineQuality"), "evidenceRefs"),
  };
}

function parseCausalCost(value: unknown): GlobalTimelineCausalCost {
  const record = parseStrictRecord(value, ["status", "value"], "GlobalTimelineCausalCost");
  const status = parseStringLiteral<GlobalTimelineCausalCost["status"]>(requireProperty(record, "status", "GlobalTimelineCausalCost"), new Set(["KNOWN", "PARTIAL", "UNKNOWN", "NOT_APPLICABLE", "CONFLICT"]), "causalCostStatus");
  const measure = optional(record, "value", parseGlobalTypedMeasure);
  if (status === "KNOWN" || status === "PARTIAL") {
    if (measure === undefined || measure.kind !== "MONEY") throw new TypeError("GLOBAL_TIMELINE_CAUSAL_COST_MONEY_REQUIRED");
    return { status, value: measure };
  }
  if (measure !== undefined) throw new TypeError("GLOBAL_TIMELINE_UNKNOWN_CAUSAL_COST_VALUE_FORBIDDEN");
  return { status };
}

function parsePlace(value: unknown): GlobalTimelinePlace {
  const record = parseStrictRecord(value, ["placeRef", "label"], "GlobalTimelinePlace");
  const label = optional(record, "label", (entry) => text(entry, "placeLabel"));
  return { placeRef: text(requireProperty(record, "placeRef", "GlobalTimelinePlace"), "placeRef"), ...(label === undefined ? {} : { label }) };
}

function parseComparisonSummary(value: unknown): GlobalTimelineComparisonSummary {
  const record = parseStrictRecord(value, ["status", "comparisonTier", "peerCount", "materiality"], "GlobalTimelineComparisonSummary");
  const comparisonTier = optional(record, "comparisonTier", (entry) => parseStringLiteral<GlobalTimelineComparisonSummary["comparisonTier"] & string>(entry, new Set(["SAME_SERIES", "SAME_TYPE", "SAME_FAMILY"]), "comparisonTier"));
  return {
    status: parseStringLiteral(requireProperty(record, "status", "GlobalTimelineComparisonSummary"), new Set(["UNKNOWN", "PARTIAL", "KNOWN", "NOT_APPLICABLE"]), "comparisonStatus"),
    ...(comparisonTier === undefined ? {} : { comparisonTier }),
    peerCount: integer(requireProperty(record, "peerCount", "GlobalTimelineComparisonSummary"), "peerCount"),
    materiality: parseStringLiteral(requireProperty(record, "materiality", "GlobalTimelineComparisonSummary"), new Set(["MATERIAL", "NOT_MATERIAL", "UNKNOWN"]), "comparisonMateriality"),
  };
}

function parseEvent(value: unknown): GlobalTimelineEvent {
  const record = parseStrictRecord(value, ["eventRef", "sourceKind", "canonicalName", "startDate", "endDate", "typeKey", "typeLabel", "familyKey", "familySource", "momentStructure", "participantRefs", "places", "causalCost", "seriesRef", "comparisonSummary", "componentCount", "detailAvailability", "quality", "sourceModule", "sourceOwner"], "GlobalTimelineEvent");
  const sourceKind = parseStringLiteral<GlobalTimelineEvent["sourceKind"]>(requireProperty(record, "sourceKind", "GlobalTimelineEvent"), new Set(["MOMENT", "LIFE_EVENT"]), "sourceKind");
  const eventRef = text(requireProperty(record, "eventRef", "GlobalTimelineEvent"), "eventRef");
  const startDate = parseLocalDate(requireProperty(record, "startDate", "GlobalTimelineEvent"));
  const endDate = parseLocalDate(requireProperty(record, "endDate", "GlobalTimelineEvent"));
  if (endDate < startDate) throw new TypeError("GLOBAL_TIMELINE_EVENT_INTERVAL_INVALID");
  const familySource = parseStringLiteral<GlobalTimelineEvent["familySource"]>(requireProperty(record, "familySource", "GlobalTimelineEvent"), new Set(["M6", "LIFE_EVENT"]), "familySource");
  const momentStructure = optional(record, "momentStructure", (entry) => text(entry, "momentStructure"));
  const seriesRef = optional(record, "seriesRef", (entry) => text(entry, "seriesRef"));
  const comparisonSummary = optional(record, "comparisonSummary", parseComparisonSummary);
  const componentCount = optional(record, "componentCount", (entry) => integer(entry, "componentCount"));
  const places = array(requireProperty(record, "places", "GlobalTimelineEvent"), parsePlace, "places");
  if (new Set(places.map(({ placeRef }) => placeRef)).size !== places.length) throw new TypeError("GLOBAL_TIMELINE_PLACE_DUPLICATE");
  const causalCost = parseCausalCost(requireProperty(record, "causalCost", "GlobalTimelineEvent"));
  const detailAvailability = parseStringLiteral<GlobalTimelineEvent["detailAvailability"]>(requireProperty(record, "detailAvailability", "GlobalTimelineEvent"), new Set(["MOMENT_DETAIL", "INLINE_ONLY"]), "detailAvailability");
  const sourceModule = parseStringLiteral<GlobalTimelineEvent["sourceModule"]>(requireProperty(record, "sourceModule", "GlobalTimelineEvent"), new Set(["MOMENTS", "CANONICAL"]), "sourceModule");
  const sourceOwner = parseStringLiteral<GlobalTimelineEvent["sourceOwner"]>(requireProperty(record, "sourceOwner", "GlobalTimelineEvent"), new Set(["M6", "CANONICAL"]), "sourceOwner");
  if (sourceKind === "MOMENT") {
    if (!eventRef.startsWith("moment:") || familySource !== "M6" || sourceModule !== "MOMENTS" || sourceOwner !== "M6" || detailAvailability !== "MOMENT_DETAIL") throw new TypeError("GLOBAL_TIMELINE_MOMENT_PROVENANCE_INVALID");
  } else if (!eventRef.startsWith("life-event:") || familySource !== "LIFE_EVENT" || sourceModule !== "CANONICAL" || sourceOwner !== "CANONICAL" || detailAvailability !== "INLINE_ONLY" || causalCost.status !== "UNKNOWN" || momentStructure !== undefined || seriesRef !== undefined || comparisonSummary !== undefined || componentCount !== undefined) {
    throw new TypeError("GLOBAL_TIMELINE_LIFE_EVENT_PROVENANCE_INVALID");
  }
  return {
    eventRef,
    sourceKind,
    canonicalName: text(requireProperty(record, "canonicalName", "GlobalTimelineEvent"), "canonicalName"),
    startDate,
    endDate,
    typeKey: text(requireProperty(record, "typeKey", "GlobalTimelineEvent"), "typeKey"),
    typeLabel: text(requireProperty(record, "typeLabel", "GlobalTimelineEvent"), "typeLabel"),
    familyKey: text(requireProperty(record, "familyKey", "GlobalTimelineEvent"), "familyKey"),
    familySource,
    ...(momentStructure === undefined ? {} : { momentStructure }),
    participantRefs: strings(requireProperty(record, "participantRefs", "GlobalTimelineEvent"), "participantRefs"),
    places,
    causalCost,
    ...(seriesRef === undefined ? {} : { seriesRef }),
    ...(comparisonSummary === undefined ? {} : { comparisonSummary }),
    ...(componentCount === undefined ? {} : { componentCount }),
    detailAvailability,
    quality: parseQuality(requireProperty(record, "quality", "GlobalTimelineEvent")),
    sourceModule,
    sourceOwner,
  };
}

function parseDestination(value: unknown): GlobalNavigationDestination {
  const record = parseStrictRecord(value, ["targetId", "kind", "resource", "instanceKey", "entityRef", "scopeHash", "sourcePublicationId", "sourceAnalyticsRevision"], "GlobalTimelineDestination");
  const kind = parseStringLiteral<GlobalNavigationDestination["kind"]>(requireProperty(record, "kind", "GlobalTimelineDestination"), new Set(["GLOBAL_QUERY", "HISTORY", "OPERATIONS", "ENTITY", "METHODOLOGY"]), "destinationKind");
  const instanceKey = optional(record, "instanceKey", (entry) => text(entry, "instanceKey"));
  const entityRef = optional(record, "entityRef", (entry) => text(entry, "entityRef"));
  if (kind === "GLOBAL_QUERY" && instanceKey === undefined) throw new TypeError("GLOBAL_TIMELINE_DESTINATION_INSTANCE_REQUIRED");
  if (kind !== "GLOBAL_QUERY" && instanceKey !== undefined) throw new TypeError("GLOBAL_TIMELINE_EXTERNAL_DESTINATION_INSTANCE_FORBIDDEN");
  if (kind === "ENTITY" && entityRef === undefined) throw new TypeError("GLOBAL_TIMELINE_ENTITY_DESTINATION_REF_REQUIRED");
  const scopeHash = text(requireProperty(record, "scopeHash", "GlobalTimelineDestination"), "scopeHash");
  if (!HASH.test(scopeHash)) throw new TypeError("GLOBAL_TIMELINE_DESTINATION_SCOPE_HASH_INVALID");
  return {
    targetId: text(requireProperty(record, "targetId", "GlobalTimelineDestination"), "targetId"),
    kind,
    resource: text(requireProperty(record, "resource", "GlobalTimelineDestination"), "resource"),
    ...(instanceKey === undefined ? {} : { instanceKey }),
    ...(entityRef === undefined ? {} : { entityRef }),
    scopeHash,
    sourcePublicationId: text(requireProperty(record, "sourcePublicationId", "GlobalTimelineDestination"), "sourcePublicationId"),
    sourceAnalyticsRevision: integer(requireProperty(record, "sourceAnalyticsRevision", "GlobalTimelineDestination"), "sourceAnalyticsRevision"),
  };
}

function emptyDeferredArray(value: unknown, label: string): readonly [] {
  if (!Array.isArray(value) || value.length !== 0) throw new TypeError(`${label}_MUST_BE_EMPTY_IN_V1`);
  return [];
}

export function parseGlobalLifeTimelineReadModel(value: unknown): GlobalLifeTimelineReadModel {
  const record = parseStrictRecord(value, ["kind", "schemaVersion", "resource", "moduleKey", "events", "chapterOverlays", "contextSignals", "destinations", "quality", "publicationMeta", "resourceMeta"], "GlobalLifeTimelineReadModel");
  const events = array(requireProperty(record, "events", "GlobalLifeTimelineReadModel"), parseEvent, "events");
  const destinations = array(requireProperty(record, "destinations", "GlobalLifeTimelineReadModel"), parseDestination, "destinations");
  if (events.length > GLOBAL_LIFE_TIMELINE_MAX_EVENTS) throw new TypeError("GLOBAL_LIFE_TIMELINE_EVENT_LIMIT");
  if (destinations.length > GLOBAL_LIFE_TIMELINE_MAX_DESTINATIONS) throw new TypeError("GLOBAL_LIFE_TIMELINE_DESTINATION_LIMIT");
  if (new Set(events.map(({ eventRef }) => eventRef)).size !== events.length) throw new TypeError("GLOBAL_LIFE_TIMELINE_EVENT_REF_DUPLICATE");
  if (new Set(destinations.map(({ targetId }) => targetId)).size !== destinations.length) throw new TypeError("GLOBAL_LIFE_TIMELINE_DESTINATION_DUPLICATE");
  const parsed: GlobalLifeTimelineReadModel = {
    kind: parseStringLiteral(requireProperty(record, "kind", "GlobalLifeTimelineReadModel"), new Set(["global_life_timeline"]), "kind"),
    schemaVersion: parseStringLiteral(requireProperty(record, "schemaVersion", "GlobalLifeTimelineReadModel"), new Set(["global-life-timeline@v1"]), "schemaVersion"),
    resource: parseStringLiteral(requireProperty(record, "resource", "GlobalLifeTimelineReadModel"), new Set(["analysis_global_life_timeline"]), "resource"),
    moduleKey: parseStringLiteral(requireProperty(record, "moduleKey", "GlobalLifeTimelineReadModel"), new Set(["RHYTHM"]), "moduleKey"),
    events,
    chapterOverlays: emptyDeferredArray(requireProperty(record, "chapterOverlays", "GlobalLifeTimelineReadModel"), "GLOBAL_LIFE_TIMELINE_CHAPTER_OVERLAYS"),
    contextSignals: emptyDeferredArray(requireProperty(record, "contextSignals", "GlobalLifeTimelineReadModel"), "GLOBAL_LIFE_TIMELINE_CONTEXT_SIGNALS"),
    destinations,
    quality: parseQuality(requireProperty(record, "quality", "GlobalLifeTimelineReadModel")),
    publicationMeta: parsePublicationMeta(requireProperty(record, "publicationMeta", "GlobalLifeTimelineReadModel")),
    resourceMeta: parseResourceMeta(requireProperty(record, "resourceMeta", "GlobalLifeTimelineReadModel")),
  };
  if (new TextEncoder().encode(JSON.stringify(parsed)).byteLength > GLOBAL_LIFE_TIMELINE_PAYLOAD_BUDGET_BYTES) throw new TypeError("GLOBAL_LIFE_TIMELINE_PAYLOAD_BUDGET_EXCEEDED");
  return parsed;
}

export const globalLifeTimelineReadModelSchema = createRuntimeSchema(parseGlobalLifeTimelineReadModel);
