import type { HouseholdId, LifeEventId } from "../../core/identity";

export type ContinuityQualifier = "CONTINUOUS" | "NOT_CONTINUOUS";
export type LifeEventContinuityFact = {
  readonly fact: "fct_life_event_continuity";
  readonly householdId: HouseholdId;
  readonly lifeEventId: LifeEventId;
  readonly status: "KNOWN" | "UNKNOWN" | "CONFLICT";
  readonly continuityQualifier: ContinuityQualifier | null;
  readonly authority: string | null;
  readonly evidenceRefs: readonly string[];
  readonly provenance:
    | "EXPLICIT_USER_ASSERTION"
    | "STRUCTURED_CANONICAL_SOURCE"
    | "CONTROLLED_BACKFILL"
    | null;
};

export function continuityForSpanBehavior(
  spanBehavior: "AUTO_CONTINUOUS" | "POINT" | "EXPLICIT_CONTINUITY",
  fact: LifeEventContinuityFact,
): ContinuityQualifier | "UNKNOWN" | "CONFLICT" | null {
  if (spanBehavior !== "EXPLICIT_CONTINUITY") return null;
  if (fact.status !== "KNOWN") return fact.status;
  return fact.continuityQualifier;
}
