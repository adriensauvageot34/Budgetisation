"use client";
import type { ProspectivePersonRef, ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import { rankPlacesForPlannedContext, type PlannedPlaceOption } from "@/domain/phase2/planned-places";
import { resolvePlannedContext } from "@/domain/phase2/planned-rules";

/** Reuses the preparation owner's exact contact-home proof, never a historical name match. */
export function ContactPlaceReference({ contact, places, value, onChoose, friend = false, declined, decline }: {
  contact?: ProspectivePersonRef; places: readonly PlannedPlaceOption[]; value?: ProspectivePlaceRef;
  onChoose: (place: ProspectivePlaceRef) => void; friend?: boolean; declined: readonly string[]; decline: (key: string) => void;
}) {
  if (value || contact?.kind !== "CONTACT") return null;
  const references = rankPlacesForPlannedContext(places, resolvePlannedContext({ familyKey: "visit_trip", subtypeKey: friend ? "friend_visit" : "family_visit" }),
    { contactKey: contact.contactKey }).filter(candidate => candidate.reason === "CONTACT_HOME" && !declined.includes(`${contact.contactKey}:${candidate.place.placeId}`));
  if (!references.length) return null;
  return <div data-contact-place-reference><p>Lieu lié à ce contact · proposition à choisir</p>{references.slice(0, 2).map(({ place }) => <div key={place.placeId}>
    <button type="button" onClick={() => onChoose({ kind: "KNOWN", placeId: place.placeId })}>Choisir {place.name}</button>
    <button type="button" onClick={() => decline(`${contact.contactKey}:${place.placeId}`)}>Ignorer cette proposition</button>
  </div>)}</div>;
}
