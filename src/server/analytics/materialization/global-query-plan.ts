import "server-only";

import { createHash } from "node:crypto";

import { canonicalSerializeGlobal, computeGlobalAnalysisScopeV2Hash, type NormalizedGlobalAnalysisScopeV2 } from "@/core/global-v2";
import { globalV2ExpectedQueryMethodSignature, globalV2QueryRegistry, parseGlobalV2QueryParams, type GlobalExpandedReadModel, type GlobalInitialReadModel, type GlobalLifeTimelineReadModel, type GlobalLifeTimelineV2ReadModel, type GlobalModuleCompactReadModel, type GlobalTimelineEventComparisonReadModel, type GlobalV2QueryParams, type GlobalV2QueryResourceName } from "@/query-api/global-v2";
import { buildGlobalV2PublicationManifest, globalV2ClosureDeclarationDigest, globalV2ClosureInputDigest, globalV2PublicationFactsHash, type GlobalV2Closure, type GlobalV2ManifestInput, type GlobalV2PublicationManifest, type GlobalV2ResolvedDependency, type GlobalV2ResourceVersion } from "./global-v2";

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

export function globalV2QueryInstanceKey(resource: GlobalV2QueryResourceName, scopeHash: string, params: GlobalV2QueryParams, generation?: string): string {
  if (resource === "analysis_global_timeline_event_comparison") {
    if (generation === undefined || generation.length === 0) throw new TypeError("GLOBAL_TIMELINE_COMPARISON_GENERATION_REQUIRED");
    return `global-query:${resource}:${scopeHash}:${generation}:${sha256(params)}`;
  }
  return `global-query:${resource}:${scopeHash}:${sha256(params)}`;
}

export function globalV2QueryMethodSignature(resource: GlobalV2QueryResourceName): string {
  return globalV2ExpectedQueryMethodSignature(resource);
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
    const publicationMeta = source.payload !== null && typeof source.payload === "object" && "publicationMeta" in source.payload
      ? (source.payload as { readonly publicationMeta?: { readonly publicationId?: unknown } }).publicationMeta
      : undefined;
    const generation = typeof publicationMeta?.publicationId === "string" ? publicationMeta.publicationId : undefined;
    return {
      ...source,
      params,
      payload: parsed,
      dependencies,
      scopeHash,
      key: globalV2QueryInstanceKey(source.resource, scopeHash, params, generation),
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
    if ((instance.payload as Partial<GlobalLifeTimelineReadModel>).kind === "global_life_timeline") {
      if ((instance.payload as { readonly schemaVersion?: unknown }).schemaVersion === "global-life-timeline@v1") {
        const timeline = instance.payload as GlobalLifeTimelineReadModel;
        for (const event of timeline.events.filter(({ sourceKind }) => sourceKind === "MOMENT")) {
          const destination = timeline.destinations.find(({ entityRef, resource }) => entityRef === event.eventRef && resource === "analysis_global_moment_experience_detail");
          if (destination?.instanceKey === undefined || !instanceKeys.has(destination.instanceKey)) throw new TypeError(`GLOBAL_TIMELINE_MOMENT_DETAIL_MISSING:${event.eventRef}`);
        }
      } else {
        const timeline = instance.payload as GlobalLifeTimelineV2ReadModel;
        for (const event of timeline.events.filter(({ momentDetailAvailable }) => momentDetailAvailable)) {
          const detail = instances.find((candidate) => candidate.resource === "analysis_global_moment_experience_detail" && candidate.scopeHash === instance.scopeHash && candidate.params.entityRef === event.eventRef);
          if (detail === undefined) throw new TypeError(`GLOBAL_TIMELINE_MOMENT_DETAIL_MISSING:${event.eventRef}`);
        }
      }
    }
    if ((instance.payload as Partial<GlobalExpandedReadModel>).resource === "analysis_global_moment_experience_detail") {
      const detail = instance.payload as GlobalExpandedReadModel;
      for (const peer of detail.peerObservations ?? []) {
        const destination = detail.destinations.find(({ entityRef, instanceKey }) => entityRef === peer.peerRef && instanceKey === peer.detailRef);
        if (destination === undefined || !instanceKeys.has(peer.detailRef)) throw new TypeError(`GLOBAL_MOMENT_PEER_DETAIL_MISSING:${peer.peerRef}`);
      }
    }
    if ((instance.payload as Partial<GlobalInitialReadModel>).kind === "global_initial") {
      const initial = instance.payload as GlobalInitialReadModel;
      for (const target of initial.navigation) {
        if (!instances.some((candidate) => candidate.resource === target.resource && candidate.scopeHash === instance.scopeHash)) throw new TypeError("GLOBAL_QUERY_INITIAL_MODULE_MISSING");
      }
    }
  }

  const timelineV2Instances = instances.filter((instance) => instance.resource === "analysis_global_life_timeline" && (instance.payload as { readonly schemaVersion?: unknown }).schemaVersion === "global-life-timeline@v2");
  if (instances.some(({ resource }) => resource === "analysis_global_timeline_event_comparison") && timelineV2Instances.length === 0) throw new TypeError("GLOBAL_TIMELINE_COMPARISON_TIMELINE_V2_MISSING");
  for (const comparison of instances.filter(({ resource }) => resource === "analysis_global_timeline_event_comparison")) {
    if (!timelineV2Instances.some(({ scopeHash }) => scopeHash === comparison.scopeHash)) throw new TypeError("GLOBAL_TIMELINE_COMPARISON_SAME_SCOPE_TIMELINE_MISSING");
  }
  for (const timelineInstance of timelineV2Instances) {
    const timeline = timelineInstance.payload as GlobalLifeTimelineV2ReadModel;
    const events = new Map(timeline.events.map((event) => [event.eventRef, event] as const));
    const advertised = new Set(timeline.events.flatMap((event) => event.comparisonLevels.map(({ level }) => `${event.eventRef}|${level}`)));
    const comparisons = instances.filter((instance) => instance.resource === "analysis_global_timeline_event_comparison" && instance.scopeHash === timelineInstance.scopeHash);
    const realized = new Set<string>();
    for (const instance of comparisons) {
      const payload = instance.payload as GlobalTimelineEventComparisonReadModel;
      const paramsEventRef = instance.params.eventRef;
      const paramsLevel = instance.params.comparisonLevel;
      const pair = `${paramsEventRef}|${paramsLevel}`;
      if (payload.subject.eventRef !== paramsEventRef || payload.comparison.level !== paramsLevel) throw new TypeError("GLOBAL_TIMELINE_COMPARISON_PARAMS_PAYLOAD_MISMATCH");
      if (!advertised.has(pair) || realized.has(pair)) throw new TypeError("GLOBAL_TIMELINE_COMPARISON_LEVEL_NOT_ADVERTISED");
      realized.add(pair);
      const subject = events.get(payload.subject.eventRef);
      if (subject === undefined || subject.eventCost.status !== "KNOWN") throw new TypeError("GLOBAL_TIMELINE_COMPARISON_SUBJECT_INVALID");
      const descriptor = subject.comparisonLevels.find(({ level }) => level === payload.comparison.level)!;
      if (descriptor.peerCount !== payload.support.peerCount || descriptor.supportStatus !== payload.support.status || descriptor.materiality !== payload.materiality.status) throw new TypeError("GLOBAL_TIMELINE_COMPARISON_DESCRIPTOR_MISMATCH");
      for (const peer of payload.peerObservations) {
        const source = events.get(peer.eventRef);
        if (source === undefined || source.eventCost.status !== "KNOWN" || source.sourceKind !== peer.sourceKind || source.canonicalName !== peer.canonicalName || source.startDate !== peer.startDate || source.endDate !== peer.endDate || source.visibilityTier !== peer.visibilityTier || source.eventCost.authority !== peer.eventCost.authority || source.eventCost.value !== peer.eventCost.value) throw new TypeError(`GLOBAL_TIMELINE_COMPARISON_PEER_MISMATCH:${peer.eventRef}`);
      }
    }
    if (canonicalSerializeGlobal([...realized].sort()) !== canonicalSerializeGlobal([...advertised].sort())) throw new TypeError("GLOBAL_TIMELINE_COMPARISON_SNAPSHOT_SET_INCOMPLETE");
  }

  const queryVersions = instances.map((instance): GlobalV2ResourceVersion => {
    const contract = globalV2QueryRegistry[instance.resource];
    return { key: instance.key, family: contract.family, contractVersion: contract.contractVersion, methodSignature: instance.methodSignature, policyVersions: contract.policyVersions, resourceInputHash: instance.resourceInputHash };
  });
  const closures = instances.map((instance): GlobalV2Closure => ({
    outputKey: instance.key,
    declarationDigest: globalV2ClosureDeclarationDigest(instance.dependencies),
    inputDigest: globalV2ClosureInputDigest(instance.dependencies),
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
  readonly base: Omit<GlobalV2ManifestInput, "requiredQueryKeys" | "queryVersions" | "externalDependencyRefs" | "closures" | "publicationFactsHash"> & {
    readonly artifactClosures: readonly GlobalV2Closure[];
    readonly externalDependencyRefs?: readonly string[];
  };
  readonly plan: GlobalV2QueryPlan;
}): GlobalV2PublicationManifest {
  const { artifactClosures, externalDependencyRefs = [], ...base } = input.base;
  const closures = [...artifactClosures, ...input.plan.closures];
  return buildGlobalV2PublicationManifest({
    ...base,
    requiredQueryKeys: input.plan.requiredQueryKeys,
    queryVersions: input.plan.queryVersions,
    closures,
    externalDependencyRefs: [...externalDependencyRefs, ...input.plan.externalQueryRefs],
    publicationFactsHash: globalV2PublicationFactsHash({
      householdId: base.householdId,
      asOf: base.asOf,
      certifiedThrough: base.certifiedThrough,
      ...(base.liveThrough === undefined ? {} : { liveThrough: base.liveThrough }),
      sourceRevision: base.sourceRevision,
      closures,
    }),
  });
}

export function assertGlobalV2NoResidualKeys(next: GlobalV2QueryPlan, activeKeysAfterFinalize: readonly string[]): void {
  const expected = [...next.requiredQueryKeys].sort();
  const active = [...activeKeysAfterFinalize].sort();
  if (canonicalSerializeGlobal(active) !== canonicalSerializeGlobal(expected)) throw new TypeError("GLOBAL_QUERY_RESIDUAL_OR_MISSING_KEY");
}
