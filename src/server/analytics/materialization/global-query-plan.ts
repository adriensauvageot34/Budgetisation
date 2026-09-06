import "server-only";

import { createHash } from "node:crypto";

import { canonicalSerializeGlobal, computeGlobalAnalysisScopeV2Hash, type NormalizedGlobalAnalysisScopeV2 } from "@/core/global-v2";
import { globalV2QueryRegistry, parseGlobalV2QueryParams, type GlobalExpandedReadModel, type GlobalInitialReadModel, type GlobalModuleCompactReadModel, type GlobalV2QueryParams, type GlobalV2QueryResourceName } from "@/query-api/global-v2";
import { buildGlobalV2PublicationManifest, type GlobalV2Closure, type GlobalV2ManifestInput, type GlobalV2PublicationManifest, type GlobalV2ResolvedDependency, type GlobalV2ResourceVersion } from "./global-v2";

export type GlobalV2QueryInstanceInput = {
  readonly resource: GlobalV2QueryResourceName;
  readonly scope: NormalizedGlobalAnalysisScopeV2;
  readonly params: GlobalV2QueryParams;
  readonly payload: unknown;
  readonly dependencies: readonly GlobalV2ResolvedDependency[];
};

export type GlobalV2QueryInstance = GlobalV2QueryInstanceInput & {
  readonly key: string;
  readonly scopeHash: string;
  readonly resourceInputHash: string;
  readonly methodSignature: string;
};

export type GlobalV2QueryPlan = {
  readonly instances: readonly GlobalV2QueryInstance[];
  readonly requiredQueryKeys: readonly string[];
  readonly queryVersions: readonly GlobalV2ResourceVersion[];
  readonly closures: readonly GlobalV2Closure[];
  readonly externalQueryRefs: readonly string[];
  readonly totalPayloadBytes: number;
  readonly duplicatePayloadBytes: number;
};

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalSerializeGlobal(value), "utf8").digest("hex");
}

function canonicalDependencies(values: readonly GlobalV2ResolvedDependency[]): readonly GlobalV2ResolvedDependency[] {
  const result = [...values].sort((left, right) => `${left.authority}:${left.family}:${left.identity}`.localeCompare(`${right.authority}:${right.family}:${right.identity}`));
  const identities = result.map((value) => `${value.authority}:${value.family}:${value.identity}`);
  if (new Set(identities).size !== identities.length) throw new TypeError("GLOBAL_QUERY_DEPENDENCY_DUPLICATE");
  return result;
}

export function globalV2QueryInstanceKey(resource: GlobalV2QueryResourceName, scopeHash: string, params: GlobalV2QueryParams): string {
  return `global-query:${resource}:${scopeHash}:${sha256(params)}`;
}

export function globalV2QueryMethodSignature(resource: GlobalV2QueryResourceName): string {
  const contract = globalV2QueryRegistry[resource];
  return sha256({ resource, contractVersion: contract.contractVersion, methodVersion: contract.methodVersion, policyVersions: contract.policyVersions });
}

export function globalV2QueryResourceInputHash(input: Pick<GlobalV2QueryInstanceInput, "resource" | "scope" | "params" | "dependencies">): string {
  return sha256({ resource: input.resource, scope: input.scope, params: input.params, dependencies: canonicalDependencies(input.dependencies) });
}

function destinations(payload: unknown): readonly { readonly kind: string; readonly resource: string; readonly instanceKey?: string; readonly targetId: string }[] {
  if (payload !== null && typeof payload === "object" && "destinations" in payload && Array.isArray((payload as GlobalExpandedReadModel).destinations)) return (payload as GlobalExpandedReadModel).destinations;
  return [];
}

function detailEntries(payload: unknown): readonly { readonly targetResource: string; readonly targetRef: string }[] {
  if (payload !== null && typeof payload === "object" && "detailEntries" in payload && Array.isArray((payload as GlobalModuleCompactReadModel).detailEntries)) return (payload as GlobalModuleCompactReadModel).detailEntries;
  return [];
}

export function buildGlobalV2QueryPlan(input: {
  readonly instances: readonly GlobalV2QueryInstanceInput[];
  readonly declaredExternalQueryRefs?: readonly string[];
}): GlobalV2QueryPlan {
  const instances = input.instances.map((source): GlobalV2QueryInstance => {
    const contract = globalV2QueryRegistry[source.resource];
    if (contract.availability !== "AVAILABLE") throw new TypeError("GLOBAL_QUERY_AUTHORITY_GATED_INSTANCE_FORBIDDEN");
    const params = parseGlobalV2QueryParams(source.resource, source.params);
    const dependencies = canonicalDependencies(source.dependencies);
    if (dependencies.length === 0 || dependencies.some((dependency) => !dependency.digest || !dependency.identity || !dependency.family)) throw new TypeError("GLOBAL_QUERY_DEPENDENCY_CLOSURE_INCOMPLETE");
    const scopeHash = computeGlobalAnalysisScopeV2Hash(source.scope);
    const resourceInputHash = globalV2QueryResourceInputHash({ ...source, params, dependencies });
    const methodSignature = globalV2QueryMethodSignature(source.resource);
    const parsed = contract.schema.parse(source.payload);
    if (parsed !== null && typeof parsed === "object" && "resourceMeta" in parsed) {
      const meta = (parsed as { readonly resourceMeta: { readonly contractVersion: string; readonly methodSignature: string; readonly resourceInputHash: string; readonly policyVersions: Readonly<Record<string, string>> } }).resourceMeta;
      if (meta.contractVersion !== contract.contractVersion || meta.methodSignature !== methodSignature || meta.resourceInputHash !== resourceInputHash || canonicalSerializeGlobal(meta.policyVersions) !== canonicalSerializeGlobal(contract.policyVersions)) throw new TypeError("GLOBAL_QUERY_PAYLOAD_RESOURCE_META_MISMATCH");
    }
    return {
      ...source,
      params,
      payload: parsed,
      dependencies,
      scopeHash,
      key: globalV2QueryInstanceKey(source.resource, scopeHash, params),
      resourceInputHash,
      methodSignature,
    };
  }).sort((left, right) => left.key.localeCompare(right.key));
  if (new Set(instances.map(({ key }) => key)).size !== instances.length) throw new TypeError("GLOBAL_QUERY_INSTANCE_DUPLICATE");

  const publicationIdentities = new Set(instances.map(({ payload }) => {
    if (payload === null || typeof payload !== "object" || !("publicationMeta" in payload)) throw new TypeError("GLOBAL_QUERY_PUBLICATION_META_MISSING");
    return canonicalSerializeGlobal((payload as { readonly publicationMeta: unknown }).publicationMeta);
  }));
  if (publicationIdentities.size !== 1) throw new TypeError("GLOBAL_QUERY_MIXED_PUBLICATION_GENERATIONS");

  const instanceKeys = new Set(instances.map(({ key }) => key));
  const external = new Set(input.declaredExternalQueryRefs ?? []);
  for (const instance of instances) {
    for (const destination of destinations(instance.payload)) {
      const publicationMeta = (instance.payload as { readonly publicationMeta: { readonly publicationId: string; readonly revision: number } }).publicationMeta;
      const fullDestination = destination as typeof destination & { readonly scopeHash: string; readonly sourcePublicationId: string; readonly sourceAnalyticsRevision: number };
      if (fullDestination.scopeHash !== instance.scopeHash || fullDestination.sourcePublicationId !== publicationMeta.publicationId || fullDestination.sourceAnalyticsRevision !== publicationMeta.revision) throw new TypeError("GLOBAL_QUERY_DEEP_LINK_GENERATION_MISMATCH");
      if (destination.kind === "GLOBAL_QUERY") {
        if (destination.instanceKey === undefined || !instanceKeys.has(destination.instanceKey)) throw new TypeError("GLOBAL_QUERY_REACHABLE_INSTANCE_MISSING");
      } else {
        external.add(`${destination.kind}:${destination.resource}:${destination.targetId}`);
      }
    }
    for (const entry of detailEntries(instance.payload)) {
      if (!instanceKeys.has(entry.targetRef)) throw new TypeError(`GLOBAL_QUERY_DETAIL_INSTANCE_MISSING:${entry.targetResource}`);
    }
    if ((instance.payload as Partial<GlobalInitialReadModel>).kind === "global_initial") {
      const initial = instance.payload as GlobalInitialReadModel;
      for (const target of initial.navigation) {
        if (!instances.some((candidate) => candidate.resource === target.resource && candidate.scopeHash === instance.scopeHash)) throw new TypeError("GLOBAL_QUERY_INITIAL_MODULE_MISSING");
      }
    }
  }

  const queryVersions = instances.map((instance): GlobalV2ResourceVersion => {
    const contract = globalV2QueryRegistry[instance.resource];
    return { key: instance.key, family: contract.family, contractVersion: contract.contractVersion, methodSignature: instance.methodSignature, policyVersions: contract.policyVersions, resourceInputHash: instance.resourceInputHash };
  });
  const closures = instances.map((instance): GlobalV2Closure => ({
    outputKey: instance.key,
    declarationDigest: sha256(instance.dependencies.map(({ authority, family, identity, required }) => ({ authority, family, identity, required }))),
    inputDigest: sha256(instance.dependencies.map(({ authority, family, identity, digest }) => ({ authority, family, identity, digest }))),
    dependencies: instance.dependencies,
  }));
  const payloadSerializations = instances.map(({ payload }) => canonicalSerializeGlobal(payload));
  const totalPayloadBytes = payloadSerializations.reduce((sum, value) => sum + Buffer.byteLength(value), 0);
  const uniqueBytes = [...new Set(payloadSerializations)].reduce((sum, value) => sum + Buffer.byteLength(value), 0);
  return {
    instances,
    requiredQueryKeys: instances.map(({ key }) => key),
    queryVersions,
    closures,
    externalQueryRefs: [...external].sort(),
    totalPayloadBytes,
    duplicatePayloadBytes: totalPayloadBytes - uniqueBytes,
  };
}

export function attachGlobalV2QueryPlanToManifest(input: {
  readonly base: Omit<GlobalV2ManifestInput, "requiredQueryKeys" | "queryVersions" | "externalDependencyRefs" | "closures"> & {
    readonly artifactClosures: readonly GlobalV2Closure[];
    readonly externalDependencyRefs?: readonly string[];
  };
  readonly plan: GlobalV2QueryPlan;
}): GlobalV2PublicationManifest {
  const { artifactClosures, externalDependencyRefs = [], ...base } = input.base;
  return buildGlobalV2PublicationManifest({
    ...base,
    requiredQueryKeys: input.plan.requiredQueryKeys,
    queryVersions: input.plan.queryVersions,
    closures: [...artifactClosures, ...input.plan.closures],
    externalDependencyRefs: [...externalDependencyRefs, ...input.plan.externalQueryRefs],
  });
}

export function assertGlobalV2NoResidualKeys(next: GlobalV2QueryPlan, activeKeysAfterFinalize: readonly string[]): void {
  const expected = [...next.requiredQueryKeys].sort();
  const active = [...activeKeysAfterFinalize].sort();
  if (canonicalSerializeGlobal(active) !== canonicalSerializeGlobal(expected)) throw new TypeError("GLOBAL_QUERY_RESIDUAL_OR_MISSING_KEY");
}
