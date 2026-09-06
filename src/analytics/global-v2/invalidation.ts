import { canonicalSerializeGlobal } from "../../core/global-v2";

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
  for (const descriptor of registry) {
    const matching = descriptor.consumes.filter((input) => input.family === event.sourceType && (input.dimensions === undefined || changed.size === 0 || input.dimensions.some((field) => changed.has(field))));
    if (matching.length === 0) continue;
    const action: GlobalInvalidationAction = event.cause === "POLICY_CHANGE" ? "REPUBLISH_ONLY" : "RECOMPUTE";
    const output = { outputFamily: descriptor.outputFamily, action, reason: `${event.cause}:${descriptor.consumerKey}`, ...(event.affectedSubjects === undefined ? {} : { subjectRefs: [...new Set(event.affectedSubjects)].sort() }), ...(event.sourceTimeRange === undefined ? {} : { affectedRange: event.sourceTimeRange }) };
    const previous = selected.get(output.outputFamily);
    if (previous !== undefined && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(output)) throw new TypeError("GLOBAL_INVALIDATION_CONTRADICTORY_OUTPUT_PLAN");
    selected.set(output.outputFamily, output);
  }
  return { invalidationId: event.invalidationId, affectedOutputs: [...selected.values()].sort((a, b) => a.outputFamily.localeCompare(b.outputFamily)), dependencyRegistryVersion: GLOBAL_DEPENDENCY_REGISTRY_VERSION };
}
