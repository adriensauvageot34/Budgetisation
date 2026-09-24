import { createRuntimeSchema, hasOwn, parseStrictRecord, parseStringLiteral, requireProperty, type RuntimeSchema } from "../../core/validation";
import {
  GLOBAL_LIFE_TIMELINE_V2_MAX_EVENTS,
  GLOBAL_LIFE_TIMELINE_V2_PAYLOAD_BUDGET_BYTES,
  buildGlobalLifeTimelineV2ReadModel,
  parseGlobalLifeTimelineV2ReadModel,
  type GlobalLifeTimelineV2ReadModel,
  type GlobalLifeTimelineV2Snapshot,
  type GlobalTimelineV2Event,
} from "./timeline-v2";

export const GLOBAL_LIFE_TIMELINE_V3_MAX_EVENTS = GLOBAL_LIFE_TIMELINE_V2_MAX_EVENTS;
export const GLOBAL_LIFE_TIMELINE_V3_PAYLOAD_BUDGET_BYTES = GLOBAL_LIFE_TIMELINE_V2_PAYLOAD_BUDGET_BYTES;

export const globalLifeTimelineV3ResourceDefinition = Object.freeze({
  resource: "analysis_global_life_timeline",
  moduleKey: "RHYTHM",
  moduleRole: "PRESENTATION_ONLY",
  capabilityId: "GLOBAL_LIFE_TIMELINE",
  group: "exploration",
  paramsKind: "empty",
  family: "global_exploration",
  schemaVersion: "global-life-timeline@v3",
  availability: "AVAILABLE",
} as const);

export type GlobalTimelineMobilityContext = Readonly<{
  status: "KNOWN" | "PARTIAL";
  physicalLegCount: number;
  tripCount: number;
  distanceKm: string;
  estimatedFuelLiters: string;
  estimatedFuelCost: string;
  validationStatus: "CONFIRMED" | "DERIVED" | "MIXED";
}>;

export type GlobalTimelineMobilityMeta = Readonly<{
  metricId: "mobility_usage_estimated_fuel_cost";
  metricMethodVersion: "mobility_usage_estimated_fuel_cost@v1";
  monetaryNature: "ESTIMATED_MOBILITY_USAGE";
  attributionPolicyVersion: "global-m7-event-mobility-physical-attribution@v1";
  ownerMethodVersion: "global_m7_event_mobility@v1";
  crossEventAdditivity: "NON_ADDITIVE_RECOMPUTE_ON_TARGET_GROUP";
}>;

export type GlobalTimelineV3Event = GlobalTimelineV2Event & Readonly<{ mobilityContext?: GlobalTimelineMobilityContext }>;
export type GlobalLifeTimelineV3ReadModel = Omit<GlobalLifeTimelineV2ReadModel, "schemaVersion" | "events"> & Readonly<{
  schemaVersion: "global-life-timeline@v3";
  mobilityMeta: GlobalTimelineMobilityMeta;
  events: readonly GlobalTimelineV3Event[];
}>;

export type GlobalTimelineCompactMobilityContext = readonly [
  status: GlobalTimelineMobilityContext["status"],
  physicalLegCount: number,
  tripCount: number,
  distanceKm: string,
  estimatedFuelLiters: string,
  estimatedFuelCost: string,
  validationStatus: GlobalTimelineMobilityContext["validationStatus"],
];

export type GlobalLifeTimelineV3Snapshot = Omit<GlobalLifeTimelineV2Snapshot, "schemaVersion" | "events"> & Readonly<{
  schemaVersion: "global-life-timeline@v3";
  mobilityMeta: GlobalTimelineMobilityMeta;
  events: readonly (GlobalLifeTimelineV2Snapshot["events"][number] & Readonly<{ mobilityContext?: GlobalTimelineCompactMobilityContext }>)[];
}>;

const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const mobilityKeys = ["status", "physicalLegCount", "tripCount", "distanceKm", "estimatedFuelLiters", "estimatedFuelCost", "validationStatus"] as const;
const metaKeys = ["metricId", "metricMethodVersion", "monetaryNature", "attributionPolicyVersion", "ownerMethodVersion", "crossEventAdditivity"] as const;

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new TypeError(`${label}_INVALID`);
  return value;
}

function nonNegativeDecimal(value: unknown, label: string): string {
  if (typeof value !== "string" || !DECIMAL.test(value)) throw new TypeError(`${label}_INVALID`);
  return value;
}

function parseMobilityContext(value: unknown): GlobalTimelineMobilityContext {
  const source = Array.isArray(value)
    ? (() => {
      if (value.length !== 7) throw new TypeError("GLOBAL_TIMELINE_MOBILITY_TUPLE_INVALID");
      return Object.fromEntries(mobilityKeys.map((key, index) => [key, value[index]]));
    })()
    : value;
  const record = parseStrictRecord(source, mobilityKeys, "GlobalTimelineMobilityContext");
  return {
    status: parseStringLiteral(requireProperty(record, "status", "GlobalTimelineMobilityContext"), new Set(["KNOWN", "PARTIAL"]), "mobilityStatus"),
    physicalLegCount: positiveInteger(requireProperty(record, "physicalLegCount", "GlobalTimelineMobilityContext"), "physicalLegCount"),
    tripCount: positiveInteger(requireProperty(record, "tripCount", "GlobalTimelineMobilityContext"), "tripCount"),
    distanceKm: nonNegativeDecimal(requireProperty(record, "distanceKm", "GlobalTimelineMobilityContext"), "distanceKm"),
    estimatedFuelLiters: nonNegativeDecimal(requireProperty(record, "estimatedFuelLiters", "GlobalTimelineMobilityContext"), "estimatedFuelLiters"),
    estimatedFuelCost: nonNegativeDecimal(requireProperty(record, "estimatedFuelCost", "GlobalTimelineMobilityContext"), "estimatedFuelCost"),
    validationStatus: parseStringLiteral(requireProperty(record, "validationStatus", "GlobalTimelineMobilityContext"), new Set(["CONFIRMED", "DERIVED", "MIXED"]), "mobilityValidationStatus"),
  };
}

function parseMobilityMeta(value: unknown): GlobalTimelineMobilityMeta {
  const record = parseStrictRecord(value, metaKeys, "GlobalTimelineMobilityMeta");
  return {
    metricId: parseStringLiteral(requireProperty(record, "metricId", "GlobalTimelineMobilityMeta"), new Set(["mobility_usage_estimated_fuel_cost"]), "mobilityMetricId"),
    metricMethodVersion: parseStringLiteral(requireProperty(record, "metricMethodVersion", "GlobalTimelineMobilityMeta"), new Set(["mobility_usage_estimated_fuel_cost@v1"]), "mobilityMetricMethodVersion"),
    monetaryNature: parseStringLiteral(requireProperty(record, "monetaryNature", "GlobalTimelineMobilityMeta"), new Set(["ESTIMATED_MOBILITY_USAGE"]), "mobilityMonetaryNature"),
    attributionPolicyVersion: parseStringLiteral(requireProperty(record, "attributionPolicyVersion", "GlobalTimelineMobilityMeta"), new Set(["global-m7-event-mobility-physical-attribution@v1"]), "mobilityAttributionPolicyVersion"),
    ownerMethodVersion: parseStringLiteral(requireProperty(record, "ownerMethodVersion", "GlobalTimelineMobilityMeta"), new Set(["global_m7_event_mobility@v1"]), "mobilityOwnerMethodVersion"),
    crossEventAdditivity: parseStringLiteral(requireProperty(record, "crossEventAdditivity", "GlobalTimelineMobilityMeta"), new Set(["NON_ADDITIVE_RECOMPUTE_ON_TARGET_GROUP"]), "mobilityCrossEventAdditivity"),
  };
}

/** V2 validates every existing card field; V3 validates only its sparse mobility extension. */
export function parseGlobalLifeTimelineV3ReadModel(value: unknown): GlobalLifeTimelineV3ReadModel {
  const record = parseStrictRecord(value, ["kind", "schemaVersion", "resource", "moduleKey", "semanticClassifications", "comparisonLevelLabels", "events", "mobilityMeta", "publicationMeta", "resourceMeta"], "GlobalLifeTimelineV3ReadModel");
  if (record.schemaVersion !== "global-life-timeline@v3") throw new TypeError("GLOBAL_LIFE_TIMELINE_V3_SCHEMA_INVALID");
  const mobilityMeta = parseMobilityMeta(requireProperty(record, "mobilityMeta", "GlobalLifeTimelineV3ReadModel"));
  const rawEvents = requireProperty(record, "events", "GlobalLifeTimelineV3ReadModel");
  if (!Array.isArray(rawEvents)) throw new TypeError("GLOBAL_LIFE_TIMELINE_EVENTS_INVALID");
  const mobilityContexts = rawEvents.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) throw new TypeError("GLOBAL_LIFE_TIMELINE_EVENT_INVALID");
    const event = entry as Readonly<Record<string, unknown>>;
    return hasOwn(event, "mobilityContext") ? parseMobilityContext(event.mobilityContext) : undefined;
  });
  const baseEvents = rawEvents.map((entry) => {
    const { mobilityContext: _mobilityContext, ...base } = entry as Record<string, unknown>;
    return base;
  });
  const { mobilityMeta: _mobilityMeta, ...base } = record;
  const parsedV2 = parseGlobalLifeTimelineV2ReadModel({ ...base, schemaVersion: "global-life-timeline@v2", events: baseEvents });
  const parsed: GlobalLifeTimelineV3ReadModel = {
    ...parsedV2,
    schemaVersion: "global-life-timeline@v3",
    mobilityMeta,
    events: parsedV2.events.map((event, index) => ({ ...event, ...(mobilityContexts[index] === undefined ? {} : { mobilityContext: mobilityContexts[index] }) })),
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (payloadBytes >= GLOBAL_LIFE_TIMELINE_V3_PAYLOAD_BUDGET_BYTES) throw new TypeError(`GLOBAL_LIFE_TIMELINE_V3_PAYLOAD_BUDGET_EXCEEDED:${payloadBytes}`);
  return parsed;
}

export function buildGlobalLifeTimelineV3ReadModel(input: GlobalLifeTimelineV3ReadModel): GlobalLifeTimelineV3Snapshot {
  const contexts = new Map(input.events.flatMap((event) => event.mobilityContext === undefined ? [] : [[event.eventRef, event.mobilityContext] as const]));
  const baseEvents: GlobalTimelineV2Event[] = input.events.map(({ mobilityContext: _mobilityContext, ...event }) => event);
  const compactV2 = buildGlobalLifeTimelineV2ReadModel({
    kind: input.kind, schemaVersion: "global-life-timeline@v2", resource: input.resource, moduleKey: input.moduleKey,
    events: baseEvents, publicationMeta: input.publicationMeta, resourceMeta: input.resourceMeta,
  });
  const compact: GlobalLifeTimelineV3Snapshot = {
    ...compactV2,
    schemaVersion: "global-life-timeline@v3",
    mobilityMeta: input.mobilityMeta,
    events: compactV2.events.map((event) => {
      const context = contexts.get(event.eventRef);
      return { ...event, ...(context === undefined ? {} : { mobilityContext: [context.status, context.physicalLegCount, context.tripCount, context.distanceKm, context.estimatedFuelLiters, context.estimatedFuelCost, context.validationStatus] as const }) };
    }),
  };
  parseGlobalLifeTimelineV3ReadModel(compact);
  return compact;
}

export const globalLifeTimelineV3ReadModelSchema = createRuntimeSchema(parseGlobalLifeTimelineV3ReadModel);

export type GlobalLifeTimelineRollbackReadModel = GlobalLifeTimelineV2ReadModel | GlobalLifeTimelineV3ReadModel;

export function parseGlobalLifeTimelineRollbackReadModel(value: unknown): GlobalLifeTimelineRollbackReadModel {
  const schemaVersion = value !== null && typeof value === "object" && "schemaVersion" in value
    ? (value as { readonly schemaVersion?: unknown }).schemaVersion : undefined;
  if (schemaVersion === "global-life-timeline@v3") return parseGlobalLifeTimelineV3ReadModel(value);
  if (schemaVersion === "global-life-timeline@v2") return parseGlobalLifeTimelineV2ReadModel(value);
  throw new TypeError("GLOBAL_LIFE_TIMELINE_SCHEMA_UNSUPPORTED");
}

export function createGlobalLifeTimelineV3TransportSchema(legacySchema: RuntimeSchema<unknown>): RuntimeSchema<unknown> {
  return createRuntimeSchema((value) => {
    const schemaVersion = value !== null && typeof value === "object" && "schemaVersion" in value
      ? (value as { readonly schemaVersion?: unknown }).schemaVersion : undefined;
    if (schemaVersion === "global-life-timeline@v1") return legacySchema.parse(value);
    return parseGlobalLifeTimelineRollbackReadModel(value);
  });
}
