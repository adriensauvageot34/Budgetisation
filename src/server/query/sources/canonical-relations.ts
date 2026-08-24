import "server-only";

import type { PersonId } from "@/core/identity";
import type { AuthorizedRuntimeContext } from "@/server/canonical/context";
import {
  canonicalString,
  optionalCanonicalString,
  type CanonicalRecord,
} from "@/server/canonical/record";
import type { CanonicalRepository } from "@/server/canonical/repository";

export function canonicalHumanLabel(row: CanonicalRecord, fallback: string): string {
  return optionalCanonicalString(row, [
    "nom_canonique",
    "display_name",
    "title",
    "name",
    "label",
    "nom",
    "titre",
    "libelle",
  ]) ?? fallback;
}

export function canonicalLabelMap(
  rows: readonly CanonicalRecord[],
  idKeys: readonly string[],
): ReadonlyMap<string, string> {
  return new Map(rows.map((row) => {
    const id = canonicalString(row, idKeys, "entities");
    return [id, canonicalHumanLabel(row, id)] as const;
  }));
}

export async function loadMomentParticipantsByMomentId(input: {
  readonly repository: CanonicalRepository;
  readonly context: AuthorizedRuntimeContext;
  readonly momentIds: readonly string[];
}): Promise<ReadonlyMap<string, readonly { readonly personId: PersonId; readonly label?: string }[]>> {
  const links = await input.repository.loadMomentLifeEventRowsByMomentIds(input.momentIds);
  const eventIds = [...new Set(links.map((row) =>
    canonicalString(row, ["life_event_id"], "life_events"),
  ))];
  const participations = await input.repository.loadLifeEventParticipationRows(eventIds);
  const personsByEvent = new Map<string, Set<PersonId>>();
  for (const row of participations) {
    const lifeEventId = canonicalString(row, ["life_event_id"], "life_events");
    const personId = canonicalString(row, ["person_id"], "life_events") as PersonId;
    if (!input.context.personIds.includes(personId)) continue;
    const ids = personsByEvent.get(lifeEventId) ?? new Set<PersonId>();
    ids.add(personId);
    personsByEvent.set(lifeEventId, ids);
  }
  const eventIdsByMoment = new Map<string, Set<string>>();
  for (const row of links) {
    const momentId = canonicalString(row, ["moment_id"], "life_events");
    const lifeEventId = canonicalString(row, ["life_event_id"], "life_events");
    const ids = eventIdsByMoment.get(momentId) ?? new Set<string>();
    ids.add(lifeEventId);
    eventIdsByMoment.set(momentId, ids);
  }
  return new Map(input.momentIds.map((momentId) => {
    const personIds = [...(eventIdsByMoment.get(momentId) ?? [])]
      .flatMap((lifeEventId) => [...(personsByEvent.get(lifeEventId) ?? [])]);
    const uniquePersonIds = [...new Set(personIds)].sort();
    return [momentId, uniquePersonIds.map((personId) => ({
      personId,
      ...(input.context.persons.find((person) => person.personId === personId)?.displayName === undefined
        ? {}
        : { label: input.context.persons.find((person) => person.personId === personId)!.displayName }),
    }))] as const;
  }));
}
