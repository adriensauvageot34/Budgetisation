import type { GlobalExpandedSectionKey, GlobalV2ExpandedResourceName } from "@/query-api/global-v2";

export type RhythmDetailOrigin = "NARRATIVE" | "HABITS_COLLECTION" | "MOMENTS_COLLECTION";

export type RhythmDetailContext = {
  readonly kind: "ACTIVITY" | "MOMENT";
  readonly entityRef: string;
  readonly origin: RhythmDetailOrigin;
  readonly resource: GlobalV2ExpandedResourceName;
};

function hasStructuredSuffix(entityRef: string, prefix: string): boolean {
  return entityRef.startsWith(prefix) && entityRef.slice(prefix.length).trim().length > 0;
}

export function resolveRhythmDetailContext(entityRef: string, origin: RhythmDetailOrigin): RhythmDetailContext | undefined {
  if (hasStructuredSuffix(entityRef, "moment:")) {
    return { kind: "MOMENT", entityRef, origin, resource: "analysis_global_moment_experience_detail" };
  }
  if (hasStructuredSuffix(entityRef, "household-activity:") || hasStructuredSuffix(entityRef, "person-activity:")) {
    return { kind: "ACTIVITY", entityRef, origin, resource: "analysis_global_routine_detail" };
  }
  return undefined;
}

export function rhythmDetailReturnSection(context: RhythmDetailContext | undefined): GlobalExpandedSectionKey | undefined {
  if (context?.origin === "HABITS_COLLECTION") return "PATTERNS";
  if (context?.origin === "MOMENTS_COLLECTION") return "BREAKDOWN";
  return undefined;
}
