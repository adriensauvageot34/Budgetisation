export const GLOBAL_DEPENDENCY_REGISTRY_VERSION = "global-dependency-registry@v1" as const;
export type GlobalInvalidationCause = "DATA_CHANGE" | "SEMANTIC_LINK_CHANGE" | "CERTIFICATION_CHANGE" | "METHOD_CHANGE" | "POLICY_CHANGE" | "REFERENCE_CHANGE" | "MANUAL_REVIEW" | "UI_ONLY_CHANGE";
export type GlobalInvalidationAction = "NO_ACTION" | "RECOMPUTE" | "REPUBLISH_ONLY" | "MARK_STALE";
export type GlobalDependencyDescriptor = { readonly consumerKey: string; readonly consumes: readonly { readonly authority: "CANONICAL" | "FACT" | "METRIC" | "ARTIFACT"; readonly family: string; readonly dimensions?: readonly string[] }[]; readonly outputFamily: string; readonly propagationPolicy: string; readonly methodVersion: string };
export type GlobalInvalidationEvent = { readonly invalidationId: string; readonly cause: GlobalInvalidationCause; readonly sourceType: string; readonly sourceId?: string; readonly changedFields?: readonly string[]; readonly affectedSubjects?: readonly string[]; readonly affectedPersonIds?: readonly string[]; readonly sourceTimeRange?: { readonly from?: string; readonly to?: string }; readonly oldRevision?: string; readonly newRevision: string; readonly createdAt: string };
export type GlobalInvalidationPlan = { readonly invalidationId: string; readonly affectedOutputs: readonly { readonly outputFamily: string; readonly action: GlobalInvalidationAction; readonly reason: string; readonly subjectRefs?: readonly string[]; readonly affectedRange?: { readonly from?: string; readonly to?: string } }[]; readonly dependencyRegistryVersion: typeof GLOBAL_DEPENDENCY_REGISTRY_VERSION };

export function planGlobalInvalidation(event: GlobalInvalidationEvent, registry: readonly GlobalDependencyDescriptor[]): GlobalInvalidationPlan {
  if (!event.invalidationId || !event.sourceType || !event.newRevision || !event.createdAt) throw new TypeError("GLOBAL_INVALIDATION_EVENT_INVALID");
  if (event.cause === "UI_ONLY_CHANGE") return { invalidationId: event.invalidationId, affectedOutputs: [], dependencyRegistryVersion: GLOBAL_DEPENDENCY_REGISTRY_VERSION };
  const changed = new Set(event.changedFields ?? []), selected = new Map<string, GlobalInvalidationPlan["affectedOutputs"][number]>();
  const pending = [event.sourceType];
  const examined = new Set<string>();
  while (pending.length > 0) {
    const sourceFamily = pending.shift()!;
    if (examined.has(sourceFamily)) continue;
    examined.add(sourceFamily);
    for (const descriptor of registry) {
      const matching = descriptor.consumes.filter((input) => input.family === sourceFamily && (sourceFamily !== event.sourceType || input.dimensions === undefined || changed.size === 0 || input.dimensions.some((field) => changed.has(field))));
      if (matching.length === 0) continue;
      const action: GlobalInvalidationAction = "RECOMPUTE";
      const output = { outputFamily: descriptor.outputFamily, action, reason: `${event.cause}:${descriptor.consumerKey}`, ...(event.affectedSubjects === undefined ? {} : { subjectRefs: [...new Set(event.affectedSubjects)].sort() }), ...(event.sourceTimeRange === undefined ? {} : { affectedRange: event.sourceTimeRange }) };
      if (!selected.has(output.outputFamily)) selected.set(output.outputFamily, output);
      pending.push(output.outputFamily);
    }
  }
  return { invalidationId: event.invalidationId, affectedOutputs: [...selected.values()].sort((a, b) => a.outputFamily.localeCompare(b.outputFamily)), dependencyRegistryVersion: GLOBAL_DEPENDENCY_REGISTRY_VERSION };
}
