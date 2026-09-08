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
import { globalPrimaryModuleCatalog, type GlobalPrimaryModuleKey, type GlobalPrimaryResourceName } from "./types";

export const globalV2TopLevelResources = Object.freeze([
  "analysis_global_manifest",
  "analysis_global_summary_ai",
  ...globalPrimaryModuleCatalog.map(({ resource }) => resource),
] as const);

export type GlobalV2TopLevelResourceName = (typeof globalV2TopLevelResources)[number];
export type GlobalV2QueryResourceName = GlobalV2TopLevelResourceName | GlobalV2ExpandedResourceName;

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
  readonly family: "global_overview" | "global_module" | "global_exploration" | "global_entity_detail" | "global_methodology";
  readonly moduleKey?: GlobalPrimaryModuleKey;
  readonly capabilityId: string;
  readonly availability: "AVAILABLE" | "AUTHORITY_GATED";
  readonly contractVersion: "global-v2-query@v1";
  readonly methodVersion: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly schema: RuntimeSchema<unknown>;
};

const topLevelSet = new Set<string>(globalV2TopLevelResources);
const expandedSet = new Set<string>(globalV2ExpandedResourceCatalog.map(({ resource }) => resource));
const resourceSet = new Set<string>([...topLevelSet, ...expandedSet]);
const sectionSet = new Set<string>(globalExpandedSectionKeys);
const moduleSet = new Set<string>(globalPrimaryModuleCatalog.map(({ moduleKey }) => moduleKey));
const expandedModuleResources = new Set<string>(globalV2ExpandedResourceCatalog.slice(0, 10).map(({ resource }) => resource));
const authorityGatedResources = new Set<string>(["analysis_global_product_detail", "analysis_global_route_detail"]);
const m1V2ProjectionResources = new Set<string>(["analysis_global_economic", "analysis_global_economic_expanded", "analysis_global_economic_recurrence_detail"]);

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) throw new TypeError(`${label}_INVALID`);
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label}_INVALID`);
  return value;
}

export function parseGlobalV2QueryParams(resource: GlobalV2QueryResourceName, value: unknown): GlobalV2QueryParams {
  if (topLevelSet.has(resource)) {
    parseStrictRecord(value, [], "GlobalV2EmptyParams");
    return Object.freeze({});
  }
  if (expandedModuleResources.has(resource)) {
    const record = parseStrictRecord(value, ["sectionKey"], "GlobalV2ExpandedParams");
    return Object.freeze({ sectionKey: parseStringLiteral<GlobalExpandedSectionKey>(requireProperty(record, "sectionKey", "GlobalV2ExpandedParams"), sectionSet, "sectionKey") });
  }
  if (resource === "analysis_global_methodology") {
    const record = parseStrictRecord(value, ["moduleKey", "methodRef"], "GlobalV2MethodologyParams");
    return Object.freeze({
      methodRef: text(requireProperty(record, "methodRef", "GlobalV2MethodologyParams"), "methodRef"),
      moduleKey: parseStringLiteral<GlobalPrimaryModuleKey>(requireProperty(record, "moduleKey", "GlobalV2MethodologyParams"), moduleSet, "moduleKey"),
    });
  }
  const record = parseStrictRecord(value, ["entityRef"], "GlobalV2EntityParams");
  return Object.freeze({ entityRef: text(requireProperty(record, "entityRef", "GlobalV2EntityParams"), "entityRef") });
}

function schemaFor(resource: GlobalV2QueryResourceName): RuntimeSchema<unknown> {
  if (resource === "analysis_global_manifest") return globalInitialReadModelSchema as RuntimeSchema<unknown>;
  if (resource === "analysis_global_summary_ai") return importedGlobalSummaryReadModelSchema as RuntimeSchema<unknown>;
  if (topLevelSet.has(resource)) return globalPrimaryReadModelSchemas[resource as GlobalPrimaryResourceName] as RuntimeSchema<unknown>;
  return globalExpandedReadModelSchemas[resource as GlobalV2ExpandedResourceName] as RuntimeSchema<unknown>;
}

function familyFor(resource: GlobalV2QueryResourceName): GlobalV2QueryContract["family"] {
  if (resource === "analysis_global_manifest" || resource === "analysis_global_summary_ai") return "global_overview";
  if (globalPrimaryModuleCatalog.some((entry) => entry.resource === resource) || expandedModuleResources.has(resource)) return "global_module";
  if (resource === "analysis_global_methodology") return "global_methodology";
  if (resource.endsWith("_detail")) return "global_entity_detail";
  return "global_exploration";
}

function moduleFor(resource: GlobalV2QueryResourceName): GlobalPrimaryModuleKey | undefined {
  return globalPrimaryModuleCatalog.find((entry) => entry.resource === resource)?.moduleKey
    ?? globalV2ExpandedResourceCatalog.find((entry) => entry.resource === resource)?.moduleKey;
}

export const globalV2QueryRegistry = Object.freeze(Object.fromEntries(
  [...resourceSet].sort().map((resourceValue) => {
    const resource = resourceValue as GlobalV2QueryResourceName;
    const moduleKey = moduleFor(resource);
    const contract: GlobalV2QueryContract = {
      resource,
      family: familyFor(resource),
      ...(moduleKey === undefined || resource === "analysis_global_methodology" ? {} : { moduleKey }),
      capabilityId: globalV2ExpandedResourceCatalog.find((entry) => entry.resource === resource)?.capabilityId ?? (resource === "analysis_global_summary_ai" ? "GLOBAL_IMPORTED_SUMMARY" : resource === "analysis_global_manifest" ? "GLOBAL_MANIFEST" : `GLOBAL_${moduleKey}`),
      availability: authorityGatedResources.has(resource) ? "AUTHORITY_GATED" : "AVAILABLE",
      contractVersion: "global-v2-query@v1",
      methodVersion: m1V2ProjectionResources.has(resource) ? `${resource}@v2` : `${resource}@v1`,
      policyVersions: Object.freeze({ projection: m1V2ProjectionResources.has(resource) ? "global-m1-query-projection@v2" : "global-v2-query-projection@v1", transport: "global-v2-snapshot-only@v1" }),
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
  }))));
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
