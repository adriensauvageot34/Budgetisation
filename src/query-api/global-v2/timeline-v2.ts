import { parseMoney, type Money } from "../../core/money";
import { parseLocalDate, type LocalDate } from "../../core/time";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  type RuntimeSchema,
} from "../../core/validation";
import type { GlobalReadModelPublicationMeta, GlobalReadModelResourceMeta } from "./types";

export const GLOBAL_LIFE_TIMELINE_V2_MAX_EVENTS = 256;
export const GLOBAL_LIFE_TIMELINE_V2_PAYLOAD_BUDGET_BYTES = 128 * 1024;
export const GLOBAL_TIMELINE_COMPARISON_MAX_PEERS = 255;
export const GLOBAL_TIMELINE_COMPARISON_PAYLOAD_BUDGET_BYTES = 96 * 1024;

export const globalLifeTimelineV2ResourceDefinition = Object.freeze({
  resource: "analysis_global_life_timeline",
  moduleKey: "RHYTHM",
  moduleRole: "PRESENTATION_ONLY",
  capabilityId: "GLOBAL_LIFE_TIMELINE",
  group: "exploration",
  paramsKind: "empty",
  family: "global_exploration",
  schemaVersion: "global-life-timeline@v2",
  availability: "AVAILABLE",
} as const);

export const globalTimelineEventComparisonResourceDefinition = Object.freeze({
  resource: "analysis_global_timeline_event_comparison",
  moduleKey: "RHYTHM",
  moduleRole: "PRESENTATION_ONLY",
  capabilityId: "GLOBAL_TIMELINE_EVENT_COMPARISON",
  group: "exploration",
  paramsKind: "event_comparison",
  family: "global_exploration",
  schemaVersion: "global-timeline-event-comparison@v1",
  availability: "AVAILABLE",
} as const);

export type GlobalTimelineComparisonLevel =
  | "SAME_SERIES"
  | "SAME_CLOSE_FAMILY"
  | "SAME_INTERMEDIATE_FAMILY";

export type GlobalTimelineSemanticClassification = Readonly<{
  taxonomyVersion: string;
  close: Readonly<{ key: string; label: string }>;
  intermediate: Readonly<{ key: string; label: string }>;
  grand: Readonly<{ key: string; label: string }>;
}>;

export type GlobalTimelineEventCost =
  | Readonly<{ authority: "M6_CAUSAL"; status: "KNOWN"; value: Money }>
  | Readonly<{ authority: "M6_CAUSAL"; status: "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT" }>
  | Readonly<{ authority: "CANONICAL_LINKED"; status: "KNOWN"; value: Money }>
  | Readonly<{ authority: "CANONICAL_LINKED"; status: "UNKNOWN" | "CONFLICT" }>
  | Readonly<{ authority: "NONE"; status: "UNKNOWN" }>;

export type GlobalTimelineComparisonDescriptor = Readonly<{
  level: GlobalTimelineComparisonLevel;
  label: string;
  supportStatus: "PARTIAL" | "KNOWN";
  peerCount: number;
  materiality: "MATERIAL" | "NOT_MATERIAL" | "UNKNOWN";
}>;

export type GlobalTimelineV2Event = Readonly<{
  eventRef: `moment:${string}` | `life-event:${string}`;
  sourceKind: "MOMENT" | "LIFE_EVENT";
  canonicalName: string;
  startDate: LocalDate;
  endDate: LocalDate;
  visibilityTier: "PRINCIPAL" | "EXTENDED";
  semanticClassification: GlobalTimelineSemanticClassification;
  eventCost: GlobalTimelineEventCost;
  series?: Readonly<{ seriesRef: string; label?: string }>;
  comparisonLevels: readonly GlobalTimelineComparisonDescriptor[];
  defaultComparisonLevel?: GlobalTimelineComparisonLevel;
  distinctiveComparisonLevel?: GlobalTimelineComparisonLevel;
  primaryPlaceLabel?: string;
  participantCount?: number;
  momentDetailAvailable: boolean;
}>;

export type GlobalLifeTimelineV2ReadModel = Readonly<{
  kind: "global_life_timeline";
  schemaVersion: "global-life-timeline@v2";
  resource: "analysis_global_life_timeline";
  moduleKey: "RHYTHM";
  events: readonly GlobalTimelineV2Event[];
  publicationMeta: GlobalReadModelPublicationMeta;
  resourceMeta: GlobalReadModelResourceMeta;
}>;

export type GlobalTimelineComparisonPeerObservation = Readonly<{
  eventRef: GlobalTimelineV2Event["eventRef"];
  sourceKind: GlobalTimelineV2Event["sourceKind"];
  canonicalName: string;
  startDate: LocalDate;
  endDate: LocalDate;
  visibilityTier: GlobalTimelineV2Event["visibilityTier"];
  eventCost: Extract<GlobalTimelineEventCost, { readonly status: "KNOWN" }>;
}>;

export type GlobalTimelineEventComparisonReadModel = Readonly<{
  kind: "global_timeline_event_comparison";
  schemaVersion: "global-timeline-event-comparison@v1";
  resource: "analysis_global_timeline_event_comparison";
  moduleKey: "RHYTHM";
  subject: GlobalTimelineComparisonPeerObservation;
  comparison: Readonly<{
    level: GlobalTimelineComparisonLevel;
    label: string;
    cohortKey: string;
    policyVersion: string;
  }>;
  support: Readonly<{ status: "PARTIAL" | "KNOWN"; peerCount: number }>;
  statistics: Readonly<{ median: Money; q1: Money; q3: Money; mad: Money }>;
  deltas: Readonly<{ absolute: Money; relative?: string }>;
  materiality: Readonly<{
    status: "MATERIAL" | "NOT_MATERIAL" | "UNKNOWN";
    policyRef: Readonly<{ id: string; version: string }>;
  }>;
  facetContext: readonly Readonly<{
    key: string;
    status: "KNOWN" | "UNKNOWN" | "CONFLICT";
    value?: string;
  }>[];
  peerObservations: readonly GlobalTimelineComparisonPeerObservation[];
  publicationMeta: GlobalReadModelPublicationMeta;
  resourceMeta: GlobalReadModelResourceMeta;
}>;

const HASH = /^[0-9a-f]{64}$/u;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/u;
const EVENT_REF = /^(?:moment|life-event):[^\s:]+$/u;
const comparisonLevels: ReadonlySet<GlobalTimelineComparisonLevel> = new Set([
  "SAME_SERIES",
  "SAME_CLOSE_FAMILY",
  "SAME_INTERMEDIATE_FAMILY",
]);

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) throw new TypeError(`${label}_INVALID`);
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

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
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
  const rawPolicies = requireProperty(record, "policyVersions", "GlobalTimelineResourceMeta");
  if (rawPolicies === null || typeof rawPolicies !== "object" || Array.isArray(rawPolicies)) throw new TypeError("GLOBAL_TIMELINE_POLICY_VERSIONS_INVALID");
  const policyVersions = Object.fromEntries(Object.entries(rawPolicies).map(([key, entry]) => [text(key, "policyKey"), text(entry, `policy:${key}`)]));
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

function parseSemanticNode(value: unknown, label: string): { readonly key: string; readonly label: string } {
  const record = parseStrictRecord(value, ["key", "label"], label);
  return { key: text(requireProperty(record, "key", label), `${label}Key`), label: text(requireProperty(record, "label", label), `${label}Label`) };
}

function parseSemanticClassification(value: unknown): GlobalTimelineSemanticClassification {
  const record = parseStrictRecord(value, ["taxonomyVersion", "close", "intermediate", "grand"], "GlobalTimelineSemanticClassification");
  return {
    taxonomyVersion: text(requireProperty(record, "taxonomyVersion", "GlobalTimelineSemanticClassification"), "taxonomyVersion"),
    close: parseSemanticNode(requireProperty(record, "close", "GlobalTimelineSemanticClassification"), "GlobalTimelineCloseFamily"),
    intermediate: parseSemanticNode(requireProperty(record, "intermediate", "GlobalTimelineSemanticClassification"), "GlobalTimelineIntermediateFamily"),
    grand: parseSemanticNode(requireProperty(record, "grand", "GlobalTimelineSemanticClassification"), "GlobalTimelineGrandFamily"),
  };
}

function parseEventRef(value: unknown, label: string): GlobalTimelineV2Event["eventRef"] {
  const ref = text(value, label);
  if (!EVENT_REF.test(ref)) throw new TypeError(`${label}_INVALID`);
  return ref as GlobalTimelineV2Event["eventRef"];
}

function parseEventCost(value: unknown, requireKnown = false): GlobalTimelineEventCost {
  const record = parseStrictRecord(value, ["authority", "status", "value"], "GlobalTimelineEventCost");
  const authority = parseStringLiteral<GlobalTimelineEventCost["authority"]>(requireProperty(record, "authority", "GlobalTimelineEventCost"), new Set(["M6_CAUSAL", "CANONICAL_LINKED", "NONE"]), "eventCostAuthority");
  const status = parseStringLiteral(requireProperty(record, "status", "GlobalTimelineEventCost"), new Set(["KNOWN", "PARTIAL", "UNKNOWN", "NOT_APPLICABLE", "CONFLICT"]), "eventCostStatus");
  const amount = optional(record, "value", parseMoney);
  if (status === "KNOWN") {
    if (amount === undefined || authority === "NONE") throw new TypeError("GLOBAL_TIMELINE_KNOWN_COST_INVALID");
    return { authority, status, value: amount } as Extract<GlobalTimelineEventCost, { readonly status: "KNOWN" }>;
  }
  if (requireKnown) throw new TypeError("GLOBAL_TIMELINE_COMPARISON_COST_MUST_BE_KNOWN");
  if (amount !== undefined) throw new TypeError("GLOBAL_TIMELINE_NON_KNOWN_COST_VALUE_FORBIDDEN");
  if (authority === "NONE" && status !== "UNKNOWN") throw new TypeError("GLOBAL_TIMELINE_NONE_COST_INVALID");
  if (authority === "CANONICAL_LINKED" && !["UNKNOWN", "CONFLICT"].includes(status)) throw new TypeError("GLOBAL_TIMELINE_CANONICAL_COST_STATUS_INVALID");
  return { authority, status } as GlobalTimelineEventCost;
}

function parseComparisonLevel(value: unknown, label = "comparisonLevel"): GlobalTimelineComparisonLevel {
  return parseStringLiteral<GlobalTimelineComparisonLevel>(value, comparisonLevels, label);
}

function parseDescriptor(value: unknown): GlobalTimelineComparisonDescriptor {
  const record = parseStrictRecord(value, ["level", "label", "supportStatus", "peerCount", "materiality"], "GlobalTimelineComparisonDescriptor");
  const peerCount = integer(requireProperty(record, "peerCount", "GlobalTimelineComparisonDescriptor"), "peerCount");
  const supportStatus = parseStringLiteral<GlobalTimelineComparisonDescriptor["supportStatus"]>(requireProperty(record, "supportStatus", "GlobalTimelineComparisonDescriptor"), new Set(["PARTIAL", "KNOWN"]), "supportStatus");
  if (peerCount < 3 || (supportStatus === "PARTIAL" ? peerCount > 4 : peerCount < 5)) throw new TypeError("GLOBAL_TIMELINE_DESCRIPTOR_SUPPORT_MISMATCH");
  return {
    level: parseComparisonLevel(requireProperty(record, "level", "GlobalTimelineComparisonDescriptor")),
    label: text(requireProperty(record, "label", "GlobalTimelineComparisonDescriptor"), "comparisonLabel"),
    supportStatus,
    peerCount,
    materiality: parseStringLiteral(requireProperty(record, "materiality", "GlobalTimelineComparisonDescriptor"), new Set(["MATERIAL", "NOT_MATERIAL", "UNKNOWN"]), "materiality"),
  };
}

function parseSeries(value: unknown): NonNullable<GlobalTimelineV2Event["series"]> {
  const record = parseStrictRecord(value, ["seriesRef", "label"], "GlobalTimelineSeries");
  const label = optional(record, "label", (entry) => text(entry, "seriesLabel"));
  return { seriesRef: text(requireProperty(record, "seriesRef", "GlobalTimelineSeries"), "seriesRef"), ...(label === undefined ? {} : { label }) };
}

function parseTimelineEvent(value: unknown): GlobalTimelineV2Event {
  const record = parseStrictRecord(value, ["eventRef", "sourceKind", "canonicalName", "startDate", "endDate", "visibilityTier", "semanticClassification", "eventCost", "series", "comparisonLevels", "defaultComparisonLevel", "distinctiveComparisonLevel", "primaryPlaceLabel", "participantCount", "momentDetailAvailable"], "GlobalTimelineV2Event");
  const eventRef = parseEventRef(requireProperty(record, "eventRef", "GlobalTimelineV2Event"), "eventRef");
  const sourceKind = parseStringLiteral<GlobalTimelineV2Event["sourceKind"]>(requireProperty(record, "sourceKind", "GlobalTimelineV2Event"), new Set(["MOMENT", "LIFE_EVENT"]), "sourceKind");
  if ((sourceKind === "MOMENT") !== eventRef.startsWith("moment:")) throw new TypeError("GLOBAL_TIMELINE_EVENT_REF_SOURCE_MISMATCH");
  const startDate = parseLocalDate(requireProperty(record, "startDate", "GlobalTimelineV2Event"));
  const endDate = parseLocalDate(requireProperty(record, "endDate", "GlobalTimelineV2Event"));
  if (endDate < startDate) throw new TypeError("GLOBAL_TIMELINE_EVENT_INTERVAL_INVALID");
  const descriptors = array(requireProperty(record, "comparisonLevels", "GlobalTimelineV2Event"), parseDescriptor, "comparisonLevels");
  const levels = descriptors.map(({ level }) => level);
  if (new Set(levels).size !== levels.length) throw new TypeError("GLOBAL_TIMELINE_COMPARISON_LEVEL_DUPLICATE");
  const defaultComparisonLevel = optional(record, "defaultComparisonLevel", parseComparisonLevel);
  const distinctiveComparisonLevel = optional(record, "distinctiveComparisonLevel", parseComparisonLevel);
  if (defaultComparisonLevel !== undefined && !levels.includes(defaultComparisonLevel)) throw new TypeError("GLOBAL_TIMELINE_DEFAULT_LEVEL_NOT_ADVERTISED");
  if (distinctiveComparisonLevel !== undefined && (!levels.includes(distinctiveComparisonLevel) || descriptors.find(({ level }) => level === distinctiveComparisonLevel)?.supportStatus !== "KNOWN" || descriptors.find(({ level }) => level === distinctiveComparisonLevel)?.materiality !== "MATERIAL")) throw new TypeError("GLOBAL_TIMELINE_DISTINCTIVE_LEVEL_INVALID");
  const series = optional(record, "series", parseSeries);
  const primaryPlaceLabel = optional(record, "primaryPlaceLabel", (entry) => text(entry, "primaryPlaceLabel"));
  const participantCount = optional(record, "participantCount", (entry) => integer(entry, "participantCount"));
  const momentDetailAvailable = requireProperty(record, "momentDetailAvailable", "GlobalTimelineV2Event");
  if (typeof momentDetailAvailable !== "boolean" || momentDetailAvailable !== (sourceKind === "MOMENT")) throw new TypeError("GLOBAL_TIMELINE_DETAIL_AVAILABILITY_INVALID");
  return {
    eventRef,
    sourceKind,
    canonicalName: text(requireProperty(record, "canonicalName", "GlobalTimelineV2Event"), "canonicalName"),
    startDate,
    endDate,
    visibilityTier: parseStringLiteral(requireProperty(record, "visibilityTier", "GlobalTimelineV2Event"), new Set(["PRINCIPAL", "EXTENDED"]), "visibilityTier"),
    semanticClassification: parseSemanticClassification(requireProperty(record, "semanticClassification", "GlobalTimelineV2Event")),
    eventCost: parseEventCost(requireProperty(record, "eventCost", "GlobalTimelineV2Event")),
    ...(series === undefined ? {} : { series }),
    comparisonLevels: descriptors,
    ...(defaultComparisonLevel === undefined ? {} : { defaultComparisonLevel }),
    ...(distinctiveComparisonLevel === undefined ? {} : { distinctiveComparisonLevel }),
    ...(primaryPlaceLabel === undefined ? {} : { primaryPlaceLabel }),
    ...(participantCount === undefined ? {} : { participantCount }),
    momentDetailAvailable,
  };
}

export function parseGlobalLifeTimelineV2ReadModel(value: unknown): GlobalLifeTimelineV2ReadModel {
  const record = parseStrictRecord(value, ["kind", "schemaVersion", "resource", "moduleKey", "events", "publicationMeta", "resourceMeta"], "GlobalLifeTimelineV2ReadModel");
  const events = array(requireProperty(record, "events", "GlobalLifeTimelineV2ReadModel"), parseTimelineEvent, "events");
  if (events.length > GLOBAL_LIFE_TIMELINE_V2_MAX_EVENTS) throw new TypeError("GLOBAL_LIFE_TIMELINE_EVENT_LIMIT");
  if (new Set(events.map(({ eventRef }) => eventRef)).size !== events.length) throw new TypeError("GLOBAL_LIFE_TIMELINE_EVENT_REF_DUPLICATE");
  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1]!;
    const current = events[index]!;
    if (previous.startDate > current.startDate || (previous.startDate === current.startDate && previous.eventRef >= current.eventRef)) throw new TypeError("GLOBAL_LIFE_TIMELINE_SORT_INVALID");
  }
  const parsed: GlobalLifeTimelineV2ReadModel = {
    kind: parseStringLiteral(requireProperty(record, "kind", "GlobalLifeTimelineV2ReadModel"), new Set(["global_life_timeline"]), "kind"),
    schemaVersion: parseStringLiteral(requireProperty(record, "schemaVersion", "GlobalLifeTimelineV2ReadModel"), new Set(["global-life-timeline@v2"]), "schemaVersion"),
    resource: parseStringLiteral(requireProperty(record, "resource", "GlobalLifeTimelineV2ReadModel"), new Set(["analysis_global_life_timeline"]), "resource"),
    moduleKey: parseStringLiteral(requireProperty(record, "moduleKey", "GlobalLifeTimelineV2ReadModel"), new Set(["RHYTHM"]), "moduleKey"),
    events,
    publicationMeta: parsePublicationMeta(requireProperty(record, "publicationMeta", "GlobalLifeTimelineV2ReadModel")),
    resourceMeta: parseResourceMeta(requireProperty(record, "resourceMeta", "GlobalLifeTimelineV2ReadModel")),
  };
  const payloadBytes = byteLength(parsed);
  if (payloadBytes >= GLOBAL_LIFE_TIMELINE_V2_PAYLOAD_BUDGET_BYTES) throw new TypeError(`GLOBAL_LIFE_TIMELINE_PAYLOAD_BUDGET_EXCEEDED:${payloadBytes}`);
  return parsed;
}

function parsePeerObservation(value: unknown): GlobalTimelineComparisonPeerObservation {
  const record = parseStrictRecord(value, ["eventRef", "sourceKind", "canonicalName", "startDate", "endDate", "visibilityTier", "eventCost"], "GlobalTimelineComparisonPeerObservation");
  const eventRef = parseEventRef(requireProperty(record, "eventRef", "GlobalTimelineComparisonPeerObservation"), "peerEventRef");
  const sourceKind = parseStringLiteral<GlobalTimelineV2Event["sourceKind"]>(requireProperty(record, "sourceKind", "GlobalTimelineComparisonPeerObservation"), new Set(["MOMENT", "LIFE_EVENT"]), "peerSourceKind");
  if ((sourceKind === "MOMENT") !== eventRef.startsWith("moment:")) throw new TypeError("GLOBAL_TIMELINE_PEER_REF_SOURCE_MISMATCH");
  const startDate = parseLocalDate(requireProperty(record, "startDate", "GlobalTimelineComparisonPeerObservation"));
  const endDate = parseLocalDate(requireProperty(record, "endDate", "GlobalTimelineComparisonPeerObservation"));
  if (endDate < startDate) throw new TypeError("GLOBAL_TIMELINE_PEER_INTERVAL_INVALID");
  return {
    eventRef,
    sourceKind,
    canonicalName: text(requireProperty(record, "canonicalName", "GlobalTimelineComparisonPeerObservation"), "peerCanonicalName"),
    startDate,
    endDate,
    visibilityTier: parseStringLiteral(requireProperty(record, "visibilityTier", "GlobalTimelineComparisonPeerObservation"), new Set(["PRINCIPAL", "EXTENDED"]), "peerVisibilityTier"),
    eventCost: parseEventCost(requireProperty(record, "eventCost", "GlobalTimelineComparisonPeerObservation"), true) as Extract<GlobalTimelineEventCost, { readonly status: "KNOWN" }>,
  };
}

function parsePolicyRef(value: unknown): { readonly id: string; readonly version: string } {
  const record = parseStrictRecord(value, ["id", "version"], "GlobalTimelineComparisonPolicyRef");
  return { id: text(requireProperty(record, "id", "GlobalTimelineComparisonPolicyRef"), "policyId"), version: text(requireProperty(record, "version", "GlobalTimelineComparisonPolicyRef"), "policyVersion") };
}

export function parseGlobalTimelineEventComparisonReadModel(value: unknown): GlobalTimelineEventComparisonReadModel {
  const record = parseStrictRecord(value, ["kind", "schemaVersion", "resource", "moduleKey", "subject", "comparison", "support", "statistics", "deltas", "materiality", "facetContext", "peerObservations", "publicationMeta", "resourceMeta"], "GlobalTimelineEventComparisonReadModel");
  const subject = parsePeerObservation(requireProperty(record, "subject", "GlobalTimelineEventComparisonReadModel"));
  const comparisonRecord = parseStrictRecord(requireProperty(record, "comparison", "GlobalTimelineEventComparisonReadModel"), ["level", "label", "cohortKey", "policyVersion"], "GlobalTimelineComparisonIdentity");
  const supportRecord = parseStrictRecord(requireProperty(record, "support", "GlobalTimelineEventComparisonReadModel"), ["status", "peerCount"], "GlobalTimelineComparisonSupport");
  const peerCount = integer(requireProperty(supportRecord, "peerCount", "GlobalTimelineComparisonSupport"), "peerCount");
  const supportStatus = parseStringLiteral<"PARTIAL" | "KNOWN">(requireProperty(supportRecord, "status", "GlobalTimelineComparisonSupport"), new Set(["PARTIAL", "KNOWN"]), "supportStatus");
  if (peerCount < 3 || peerCount > GLOBAL_TIMELINE_COMPARISON_MAX_PEERS || (supportStatus === "PARTIAL" ? peerCount > 4 : peerCount < 5)) throw new TypeError("GLOBAL_TIMELINE_COMPARISON_SUPPORT_MISMATCH");
  const statisticsRecord = parseStrictRecord(requireProperty(record, "statistics", "GlobalTimelineEventComparisonReadModel"), ["median", "q1", "q3", "mad"], "GlobalTimelineComparisonStatistics");
  const deltasRecord = parseStrictRecord(requireProperty(record, "deltas", "GlobalTimelineEventComparisonReadModel"), ["absolute", "relative"], "GlobalTimelineComparisonDeltas");
  const relative = optional(deltasRecord, "relative", (entry) => text(entry, "relativeDelta"));
  const materialityRecord = parseStrictRecord(requireProperty(record, "materiality", "GlobalTimelineEventComparisonReadModel"), ["status", "policyRef"], "GlobalTimelineComparisonMateriality");
  const facetContext = array(requireProperty(record, "facetContext", "GlobalTimelineEventComparisonReadModel"), (entry) => {
    const facet = parseStrictRecord(entry, ["key", "status", "value"], "GlobalTimelineComparisonFacet");
    const status = parseStringLiteral<"KNOWN" | "UNKNOWN" | "CONFLICT">(requireProperty(facet, "status", "GlobalTimelineComparisonFacet"), new Set(["KNOWN", "UNKNOWN", "CONFLICT"]), "facetStatus");
    const facetValue = optional(facet, "value", (candidate) => text(candidate, "facetValue"));
    if ((status === "KNOWN") !== (facetValue !== undefined)) throw new TypeError("GLOBAL_TIMELINE_COMPARISON_FACET_VALUE_MISMATCH");
    return { key: text(requireProperty(facet, "key", "GlobalTimelineComparisonFacet"), "facetKey"), status, ...(facetValue === undefined ? {} : { value: facetValue }) };
  }, "facetContext");
  if (new Set(facetContext.map(({ key }) => key)).size !== facetContext.length) throw new TypeError("GLOBAL_TIMELINE_COMPARISON_FACET_DUPLICATE");
  const peerObservations = array(requireProperty(record, "peerObservations", "GlobalTimelineEventComparisonReadModel"), parsePeerObservation, "peerObservations");
  if (peerObservations.length !== peerCount) throw new TypeError("GLOBAL_TIMELINE_COMPARISON_PEER_COUNT_MISMATCH");
  if (peerObservations.some(({ eventRef }) => eventRef === subject.eventRef) || new Set(peerObservations.map(({ eventRef }) => eventRef)).size !== peerObservations.length) throw new TypeError("GLOBAL_TIMELINE_COMPARISON_PEER_IDENTITY_INVALID");
  const parsed: GlobalTimelineEventComparisonReadModel = {
    kind: parseStringLiteral(requireProperty(record, "kind", "GlobalTimelineEventComparisonReadModel"), new Set(["global_timeline_event_comparison"]), "kind"),
    schemaVersion: parseStringLiteral(requireProperty(record, "schemaVersion", "GlobalTimelineEventComparisonReadModel"), new Set(["global-timeline-event-comparison@v1"]), "schemaVersion"),
    resource: parseStringLiteral(requireProperty(record, "resource", "GlobalTimelineEventComparisonReadModel"), new Set(["analysis_global_timeline_event_comparison"]), "resource"),
    moduleKey: parseStringLiteral(requireProperty(record, "moduleKey", "GlobalTimelineEventComparisonReadModel"), new Set(["RHYTHM"]), "moduleKey"),
    subject,
    comparison: {
      level: parseComparisonLevel(requireProperty(comparisonRecord, "level", "GlobalTimelineComparisonIdentity")),
      label: text(requireProperty(comparisonRecord, "label", "GlobalTimelineComparisonIdentity"), "comparisonLabel"),
      cohortKey: text(requireProperty(comparisonRecord, "cohortKey", "GlobalTimelineComparisonIdentity"), "cohortKey"),
      policyVersion: text(requireProperty(comparisonRecord, "policyVersion", "GlobalTimelineComparisonIdentity"), "policyVersion"),
    },
    support: { status: supportStatus, peerCount },
    statistics: {
      median: parseMoney(requireProperty(statisticsRecord, "median", "GlobalTimelineComparisonStatistics")),
      q1: parseMoney(requireProperty(statisticsRecord, "q1", "GlobalTimelineComparisonStatistics")),
      q3: parseMoney(requireProperty(statisticsRecord, "q3", "GlobalTimelineComparisonStatistics")),
      mad: parseMoney(requireProperty(statisticsRecord, "mad", "GlobalTimelineComparisonStatistics")),
    },
    deltas: { absolute: parseMoney(requireProperty(deltasRecord, "absolute", "GlobalTimelineComparisonDeltas")), ...(relative === undefined ? {} : { relative }) },
    materiality: {
      status: parseStringLiteral(requireProperty(materialityRecord, "status", "GlobalTimelineComparisonMateriality"), new Set(["MATERIAL", "NOT_MATERIAL", "UNKNOWN"]), "materiality"),
      policyRef: parsePolicyRef(requireProperty(materialityRecord, "policyRef", "GlobalTimelineComparisonMateriality")),
    },
    facetContext,
    peerObservations,
    publicationMeta: parsePublicationMeta(requireProperty(record, "publicationMeta", "GlobalTimelineEventComparisonReadModel")),
    resourceMeta: parseResourceMeta(requireProperty(record, "resourceMeta", "GlobalTimelineEventComparisonReadModel")),
  };
  const payloadBytes = byteLength(parsed);
  if (payloadBytes >= GLOBAL_TIMELINE_COMPARISON_PAYLOAD_BUDGET_BYTES) throw new TypeError(`GLOBAL_TIMELINE_COMPARISON_PAYLOAD_BUDGET_EXCEEDED:${payloadBytes}`);
  return parsed;
}

export function buildGlobalLifeTimelineV2ReadModel(input: GlobalLifeTimelineV2ReadModel): GlobalLifeTimelineV2ReadModel {
  return parseGlobalLifeTimelineV2ReadModel({
    ...input,
    events: [...input.events].map((event) => ({ ...event, comparisonLevels: [...event.comparisonLevels] })).sort((left, right) => left.startDate.localeCompare(right.startDate) || left.eventRef.localeCompare(right.eventRef)),
  });
}

export function buildGlobalTimelineEventComparisonReadModel(input: GlobalTimelineEventComparisonReadModel): GlobalTimelineEventComparisonReadModel {
  return parseGlobalTimelineEventComparisonReadModel({
    ...input,
    facetContext: [...input.facetContext].sort((left, right) => left.key.localeCompare(right.key)),
    peerObservations: [...input.peerObservations].sort((left, right) => left.eventRef.localeCompare(right.eventRef)),
  });
}

export const globalLifeTimelineV2ReadModelSchema = createRuntimeSchema(parseGlobalLifeTimelineV2ReadModel);
export const globalTimelineEventComparisonReadModelSchema = createRuntimeSchema(parseGlobalTimelineEventComparisonReadModel);

export function createGlobalLifeTimelineTransportSchema(
  legacySchema: RuntimeSchema<unknown>,
): RuntimeSchema<unknown> {
  return createRuntimeSchema((value) => {
    if (value !== null && typeof value === "object" && "schemaVersion" in value && (value as { readonly schemaVersion?: unknown }).schemaVersion === "global-life-timeline@v2") {
      return parseGlobalLifeTimelineV2ReadModel(value);
    }
    return legacySchema.parse(value);
  });
}
