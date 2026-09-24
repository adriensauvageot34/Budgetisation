import {
  canonicalSerializeGlobal,
  computeGlobalAnalysisScopeV2Hash,
  normalizeGlobalAnalysisScopeV2,
  type GlobalAnalysisScopeV2,
  type GlobalScopeValidationContext,
  type NormalizedGlobalAnalysisScopeV2,
} from "../../core/global-v2";
import { hasOwn, parseStrictRecord, parseStringLiteral, requireProperty } from "../../core/validation";
import type { RuntimeSchema } from "../../core/validation";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { globalExpandedReadModelSchemas, globalExpandedSectionKeys, globalV2ExpandedResourceCatalog, importedGlobalSummaryReadModelSchema, type GlobalExpandedSectionKey, type GlobalV2ExpandedResourceName } from "./details";
import { globalInitialReadModelSchema, globalPrimaryReadModelSchemas } from "./schemas";
import { globalLifeTimelineReadModelSchema, type GlobalLifeTimelineResourceName } from "./timeline";
import {
  createGlobalLifeTimelineTransportSchema,
  globalLifeTimelineV2ResourceDefinition,
  globalTimelineEventComparisonReadModelSchema,
  globalTimelineEventComparisonResourceDefinition,
  type GlobalTimelineComparisonLevel,
} from "./timeline-v2";
import {
  globalBackgroundRhythmMonthDetailReadModelSchema,
  globalBackgroundRhythmMonthDetailResourceDefinition,
  globalBackgroundRhythmsReadModelSchema,
  globalBackgroundRhythmsResourceDefinition,
} from "./background-rhythms";
import { globalPrimaryModuleCatalog, type GlobalPrimaryModuleKey, type GlobalPrimaryResourceName, type GlobalV2QueryParamsKind, type GlobalV2ResourceFamily, type GlobalV2ResourceGroup } from "./types";

export const globalV2TopLevelResources = Object.freeze([
  "analysis_global_manifest",
  "analysis_global_summary_ai",
  ...globalPrimaryModuleCatalog.map(({ resource }) => resource),
] as const);

export type GlobalV2TopLevelResourceName = (typeof globalV2TopLevelResources)[number];
export type GlobalV2QueryResourceName = GlobalV2TopLevelResourceName | GlobalV2ExpandedResourceName | GlobalLifeTimelineResourceName | typeof globalTimelineEventComparisonResourceDefinition.resource | typeof globalBackgroundRhythmsResourceDefinition.resource | typeof globalBackgroundRhythmMonthDetailResourceDefinition.resource;

export type GlobalV2QueryParams = Readonly<Record<string, string>>;
export type GlobalV2QueryRequest = {
  readonly resource: GlobalV2QueryResourceName;
  readonly scope: GlobalAnalysisScopeV2;
  readonly params: GlobalV2QueryParams;
  readonly expectedGeneration: {
    readonly publicationId: string;
    readonly analyticsRevision: number;
  };
};

export type NormalizedGlobalV2QueryRequest = Omit<GlobalV2QueryRequest, "scope"> & {
  readonly scope: NormalizedGlobalAnalysisScopeV2;
  readonly scopeHash: string;
};

export type GlobalV2QueryContract = {
  readonly resource: GlobalV2QueryResourceName;
  readonly family: GlobalV2ResourceFamily;
  readonly group: GlobalV2ResourceGroup;
  readonly paramsKind: GlobalV2QueryParamsKind;
  readonly moduleKey?: GlobalPrimaryModuleKey;
  readonly moduleRole?: "PRESENTATION_ONLY";
  readonly capabilityId: string;
  readonly availability: "AVAILABLE" | "AUTHORITY_GATED";
  readonly schemaVersion?: string;
  readonly transport?: Readonly<{ readonly priority: "BACKGROUND" | "DIRECT"; readonly activation: "NEAR_VIEWPORT" | "ON_DEMAND_CLICK" }>;
  readonly contractVersion: "global-v2-query@v1";
  readonly methodVersion: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly schema: RuntimeSchema<unknown>;
};

const overviewResourceCatalog = Object.freeze([
  { resource: "analysis_global_manifest", group: "overview", paramsKind: "empty", family: "global_overview", capabilityId: "GLOBAL_MANIFEST", availability: "AVAILABLE" },
  { resource: "analysis_global_summary_ai", group: "overview", paramsKind: "empty", family: "global_overview", capabilityId: "GLOBAL_IMPORTED_SUMMARY", availability: "AVAILABLE" },
] as const);
const resourceCatalog = Object.freeze([
  ...overviewResourceCatalog,
  ...globalPrimaryModuleCatalog,
  ...globalV2ExpandedResourceCatalog,
  globalLifeTimelineV2ResourceDefinition,
  globalTimelineEventComparisonResourceDefinition,
  globalBackgroundRhythmsResourceDefinition,
  globalBackgroundRhythmMonthDetailResourceDefinition,
] as const);
type GlobalV2ResourceDefinition = (typeof resourceCatalog)[number];
const definitionByResource = new Map<string, GlobalV2ResourceDefinition>(resourceCatalog.map((entry) => [entry.resource, entry]));
const resourceSet = new Set<string>(definitionByResource.keys());
const sectionSet = new Set<string>(globalExpandedSectionKeys);
const moduleSet = new Set<string>(globalPrimaryModuleCatalog.map(({ moduleKey }) => moduleKey));
const m1V2ProjectionResources = new Set<string>(["analysis_global_economic", "analysis_global_economic_expanded", "analysis_global_economic_recurrence_detail"]);
const lifeSpendingV2ProjectionResources = new Set<string>(["analysis_global_rhythm", "analysis_global_rhythm_expanded", "analysis_global_routine_detail", "analysis_global_moment_experience_detail"]);
const timelineSemanticResources = new Set<string>(["analysis_global_life_timeline", "analysis_global_timeline_event_comparison"]);
const backgroundRhythmResources = new Set<string>(["analysis_global_background_rhythms", "analysis_global_background_rhythm_month_detail"]);
const personaDetailIndexResources = new Set<string>(["analysis_global_persona_detail"]);
const placeMobilityV2ProjectionResources = new Set<string>(["analysis_global_place_mobility_detail"]);
const timelineComparisonLevels: ReadonlySet<GlobalTimelineComparisonLevel> = new Set(["SAME_SERIES", "SAME_CLOSE_FAMILY", "SAME_INTERMEDIATE_FAMILY", "SAME_GRAND_FAMILY"]);

function definitionFor(resource: GlobalV2QueryResourceName): GlobalV2ResourceDefinition {
  const definition = definitionByResource.get(resource);
  if (definition === undefined) throw new TypeError("GLOBAL_V2_QUERY_RESOURCE_UNREGISTERED");
  return definition;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) throw new TypeError(`${label}_INVALID`);
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label}_INVALID`);
  return value;
}

export function parseGlobalV2QueryParams(resource: GlobalV2QueryResourceName, value: unknown): GlobalV2QueryParams {
  switch (definitionFor(resource).paramsKind) {
    case "empty":
      parseStrictRecord(value, [], "GlobalV2EmptyParams");
      return Object.freeze({});
    case "section_key": {
      const record = parseStrictRecord(value, ["sectionKey"], "GlobalV2ExpandedParams");
      return Object.freeze({ sectionKey: parseStringLiteral<GlobalExpandedSectionKey>(requireProperty(record, "sectionKey", "GlobalV2ExpandedParams"), sectionSet, "sectionKey") });
    }
    case "methodology": {
      const record = parseStrictRecord(value, ["moduleKey", "methodRef"], "GlobalV2MethodologyParams");
      return Object.freeze({
        methodRef: text(requireProperty(record, "methodRef", "GlobalV2MethodologyParams"), "methodRef"),
        moduleKey: parseStringLiteral<GlobalPrimaryModuleKey>(requireProperty(record, "moduleKey", "GlobalV2MethodologyParams"), moduleSet, "moduleKey"),
      });
    }
    case "entity_ref": {
      const record = parseStrictRecord(value, ["entityRef"], "GlobalV2EntityParams");
      return Object.freeze({ entityRef: text(requireProperty(record, "entityRef", "GlobalV2EntityParams"), "entityRef") });
    }
    case "event_comparison": {
      const record = parseStrictRecord(value, ["eventRef", "comparisonLevel"], "GlobalV2EventComparisonParams");
      const eventRef = text(requireProperty(record, "eventRef", "GlobalV2EventComparisonParams"), "eventRef");
      if (!/^(?:moment|life-event):[^\s:]+$/u.test(eventRef)) throw new TypeError("GLOBAL_V2_EVENT_COMPARISON_REF_INVALID");
      return Object.freeze({
        eventRef,
        comparisonLevel: parseStringLiteral<GlobalTimelineComparisonLevel>(requireProperty(record, "comparisonLevel", "GlobalV2EventComparisonParams"), timelineComparisonLevels, "comparisonLevel"),
      });
    }
    case "rhythm_month": {
      const record = parseStrictRecord(value, ["domain", "month"], "GlobalV2RhythmMonthParams");
      const domain = requireProperty(record, "domain", "GlobalV2RhythmMonthParams");
      const month = text(requireProperty(record, "month", "GlobalV2RhythmMonthParams"), "month");
      if (domain !== "CAR_MOBILITY" || !/^\d{4}-(0[1-9]|1[0-2])$/u.test(month)) throw new TypeError("GLOBAL_V2_RHYTHM_MONTH_PARAMS_INVALID");
      return Object.freeze({ domain, month });
    }
  }
}

function schemaFor(resource: GlobalV2QueryResourceName): RuntimeSchema<unknown> {
  if (resource === "analysis_global_manifest") return globalInitialReadModelSchema as RuntimeSchema<unknown>;
  if (resource === "analysis_global_summary_ai") return importedGlobalSummaryReadModelSchema as RuntimeSchema<unknown>;
  if (resource === globalLifeTimelineV2ResourceDefinition.resource) return createGlobalLifeTimelineTransportSchema(globalLifeTimelineReadModelSchema as RuntimeSchema<unknown>);
  if (resource === globalTimelineEventComparisonResourceDefinition.resource) return globalTimelineEventComparisonReadModelSchema as RuntimeSchema<unknown>;
  if (resource === globalBackgroundRhythmsResourceDefinition.resource) return globalBackgroundRhythmsReadModelSchema as RuntimeSchema<unknown>;
  if (resource === globalBackgroundRhythmMonthDetailResourceDefinition.resource) return globalBackgroundRhythmMonthDetailReadModelSchema as RuntimeSchema<unknown>;
  if (definitionFor(resource).group === "module_section") return globalPrimaryReadModelSchemas[resource as GlobalPrimaryResourceName] as RuntimeSchema<unknown>;
  return globalExpandedReadModelSchemas[resource as GlobalV2ExpandedResourceName] as RuntimeSchema<unknown>;
}

export const globalV2QueryRegistry = Object.freeze(Object.fromEntries(
  [...resourceSet].sort().map((resourceValue) => {
    const resource = resourceValue as GlobalV2QueryResourceName;
    const definition = definitionFor(resource);
    const moduleKey = "moduleKey" in definition && definition.group !== "methodology" ? definition.moduleKey : undefined;
    const moduleRole = "moduleRole" in definition ? definition.moduleRole : undefined;
    const schemaVersion = "schemaVersion" in definition ? definition.schemaVersion : undefined;
    const transport = "transport" in definition ? definition.transport : undefined;
    const contract: GlobalV2QueryContract = {
      resource,
      family: definition.family,
      group: definition.group,
      paramsKind: definition.paramsKind,
      ...(moduleKey === undefined ? {} : { moduleKey }),
      ...(moduleRole === undefined ? {} : { moduleRole }),
      capabilityId: definition.capabilityId,
      availability: definition.availability,
      ...(schemaVersion === undefined ? {} : { schemaVersion }),
      ...(transport === undefined ? {} : { transport }),
      contractVersion: "global-v2-query@v1",
      methodVersion: m1V2ProjectionResources.has(resource) || lifeSpendingV2ProjectionResources.has(resource) || timelineSemanticResources.has(resource) || personaDetailIndexResources.has(resource) || placeMobilityV2ProjectionResources.has(resource) ? `${resource}@v2` : `${resource}@v1`,
      policyVersions: timelineSemanticResources.has(resource)
        ? Object.freeze({ projection: "timeline-semantic-projection@v1", comparator: "timeline-semantic-comparator@v2", transport: "global-v2-snapshot-only@sh05-v2" })
        : backgroundRhythmResources.has(resource)
          ? Object.freeze({ projection: "global-background-rhythms-query@v1", wire: "global-background-rhythms-compact-wire@v1", transport: resource === "analysis_global_background_rhythms" ? "background-near-viewport@v1" : "direct-on-demand-click@v1" })
        : Object.freeze({ projection: m1V2ProjectionResources.has(resource) ? "global-m1-query-projection@v2" : lifeSpendingV2ProjectionResources.has(resource) ? "global-life-spending-query-projection@v1" : personaDetailIndexResources.has(resource) ? "global-persona-detail-index-projection@v2" : placeMobilityV2ProjectionResources.has(resource) ? "global-m7-person-place-query-projection@v1" : "global-v2-query-projection@v1", transport: "global-v2-snapshot-only@v1" }),
      schema: schemaFor(resource),
    };
    return [resource, Object.freeze(contract)] as const;
  }),
) as Readonly<Record<GlobalV2QueryResourceName, GlobalV2QueryContract>>);

export function globalV2ExpectedQueryMethodSignature(resource: GlobalV2QueryResourceName): string {
  const contract = globalV2QueryRegistry[resource];
  return bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal({
    resource,
    contractVersion: contract.contractVersion,
    methodVersion: contract.methodVersion,
    policyVersions: contract.policyVersions,
    ...(contract.transport === undefined ? {} : { transport: contract.transport }),
  }))));
}

function legacyTimelineQueryMethodSignature(): string {
  return bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal({
    resource: "analysis_global_life_timeline",
    contractVersion: "global-v2-query@v1",
    methodVersion: "analysis_global_life_timeline@v1",
    policyVersions: { projection: "global-v2-query-projection@v1", transport: "global-v2-snapshot-only@v1" },
  }))));
}

/** Temporary SH-05 cutover bridge: the active v1 generation remains readable until S7. */
export function globalV2AcceptedQueryMethodSignatures(resource: GlobalV2QueryResourceName): readonly string[] {
  const current = globalV2ExpectedQueryMethodSignature(resource);
  return resource === "analysis_global_life_timeline"
    ? Object.freeze([current, legacyTimelineQueryMethodSignature()])
    : Object.freeze([current]);
}

export function parseGlobalV2QueryRequest(value: unknown, context: GlobalScopeValidationContext): NormalizedGlobalV2QueryRequest {
  const record = parseStrictRecord(value, ["resource", "scope", "params", "expectedGeneration"], "GlobalV2QueryRequest");
  const resource = parseStringLiteral<GlobalV2QueryResourceName>(requireProperty(record, "resource", "GlobalV2QueryRequest"), resourceSet, "GlobalV2QueryResource");
  const scope = normalizeGlobalAnalysisScopeV2(requireProperty(record, "scope", "GlobalV2QueryRequest") as GlobalAnalysisScopeV2, context);
  const expected = parseStrictRecord(requireProperty(record, "expectedGeneration", "GlobalV2QueryRequest"), ["publicationId", "analyticsRevision"], "GlobalV2ExpectedGeneration");
  return {
    resource,
    scope,
    scopeHash: computeGlobalAnalysisScopeV2Hash(scope),
    params: parseGlobalV2QueryParams(resource, requireProperty(record, "params", "GlobalV2QueryRequest")),
    expectedGeneration: {
      publicationId: text(requireProperty(expected, "publicationId", "GlobalV2ExpectedGeneration"), "publicationId"),
      analyticsRevision: integer(requireProperty(expected, "analyticsRevision", "GlobalV2ExpectedGeneration"), "analyticsRevision"),
    },
  };
}

export function globalV2QueryCacheKey(request: NormalizedGlobalV2QueryRequest): string {
  return canonicalSerializeGlobal({
    publicationId: request.expectedGeneration.publicationId,
    analyticsRevision: request.expectedGeneration.analyticsRevision,
    resource: request.resource,
    scopeHash: request.scopeHash,
    params: request.params,
  });
}

export function assertGlobalV2QueryRegistryComplete(): void {
  if (Object.keys(globalV2QueryRegistry).length !== resourceSet.size) throw new TypeError("GLOBAL_V2_QUERY_REGISTRY_INCOMPLETE");
  for (const resource of resourceSet) {
    const contract = globalV2QueryRegistry[resource as GlobalV2QueryResourceName];
    if (contract.resource !== resource || contract.schema === undefined) throw new TypeError("GLOBAL_V2_QUERY_REGISTRY_INVALID");
  }
}

export function globalV2RequestHasPresentUndefined(value: unknown): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(globalV2RequestHasPresentUndefined);
  if (value !== null && typeof value === "object") return Reflect.ownKeys(value).some((key) => typeof key !== "string" || globalV2RequestHasPresentUndefined((value as Record<string, unknown>)[key]));
  return false;
}
