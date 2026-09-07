import type { ActivityOccurrenceFact } from "../facts";
import { SharedParticipationResolver, type GlobalSharedParticipationResult } from "./shared-participation";

/** Facts -> M10 adapter. participantIds are positive Canonical evidence only:
 * the Fact does not claim roster exhaustiveness and therefore cannot prove ABSENT. */
export function projectGlobalSharedActivitiesFromFacts(input: {
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly personIds: readonly [string, string];
  readonly activityTypeByActivityId: Readonly<Record<string, string | undefined>>;
}): readonly GlobalSharedParticipationResult[] {
  const resolver = new SharedParticipationResolver();
  const seen = new Map<string, ActivityOccurrenceFact>();
  for (const occurrence of input.occurrences) {
    const id = String(occurrence.lifeEventId), previous = seen.get(id);
    if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(occurrence)) throw new TypeError("M10_CONTRADICTORY_ACTIVITY_FACT");
    seen.set(id, occurrence);
  }
  return [...seen.values()].sort((a, b) => String(a.lifeEventId).localeCompare(String(b.lifeEventId))).map((occurrence) => {
    const participants = occurrence.participantIds.map(String);
    return resolver.resolve({
      unitId: String(occurrence.lifeEventId), universeId: `activity:${occurrence.activityId}`, grain: "OCCURRENCE",
      personIds: input.personIds,
      assertions: input.personIds.flatMap((personId) => participants.includes(personId) ? [{ personId, state: "PRESENT" as const, authority: "CANONICAL" as const, evidenceRefs: [`fct_activity_occurrence:${occurrence.lifeEventId}:participant:${personId}`] }] : []),
      ...(input.activityTypeByActivityId[String(occurrence.activityId)] === undefined ? {} : { activityType: input.activityTypeByActivityId[String(occurrence.activityId)] }),
      evidenceRefs: [`fct_activity_occurrence:${occurrence.lifeEventId}`],
    });
  });
}
