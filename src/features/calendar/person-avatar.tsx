"use client";

import type { PersonId } from "@/core/identity";
import type { CalendarPerson } from "./types";
import styles from "./calendar.module.css";

function toneFor(personId: PersonId): number {
  let total = 0;
  for (let index = 0; index < personId.length; index += 1) total += personId.charCodeAt(index);
  return total % 5;
}

function initials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toLocaleUpperCase("fr") ?? "").join("") || "P";
}

export function PersonAvatar({ personId, persons }: { readonly personId: PersonId; readonly persons: readonly CalendarPerson[] }) {
  const label = persons.find((person) => person.personId === personId)?.displayName ?? "Personne";
  return (
    <span className={styles.avatar} data-person-tone={toneFor(personId)} aria-label={label} title={label}>
      {initials(label)}
    </span>
  );
}

export function PersonAvatarCluster({ participantIds, persons }: { readonly participantIds: readonly PersonId[]; readonly persons: readonly CalendarPerson[] }) {
  if (participantIds.length === 0) return null;
  return (
    <span className={styles.avatarCluster} aria-label={`${participantIds.length} participant${participantIds.length > 1 ? "s" : ""}`}>
      {participantIds.map((personId) => <PersonAvatar key={personId} personId={personId} persons={persons} />)}
    </span>
  );
}

