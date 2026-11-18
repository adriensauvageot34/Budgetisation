import type { ProspectivePlaceRef } from "../planned-contract";
import { validGooglePlaceId } from "../restaurant-places";
import type { PlannedContextState } from "./semantic-state";

export type GoogleCardPlace = Extract<ProspectivePlaceRef, { kind: "TEXT" }> & { googlePlaceId: string };

export function isGoogleCardPlace(value: unknown): value is GoogleCardPlace {
  if (!value || typeof value !== "object") return false;
  const place = value as Record<string, unknown>;
  return place.kind === "TEXT" && typeof place.label === "string" && !!place.label.trim()
    && place.label.length <= 120 && validGooglePlaceId(place.googlePlaceId);
}

export function savedCardGooglePlaces(contexts: readonly PlannedContextState[]): GoogleCardPlace[] {
  const places = new Map<string, GoogleCardPlace>();
  for (const context of contexts) {
    if (context.status !== "ACTIVE") continue;
    for (const place of [context.fields.placeRef, context.fields.destinationRef]) {
      if (isGoogleCardPlace(place) && !places.has(place.googlePlaceId)) places.set(place.googlePlaceId, place);
    }
  }
  return [...places.values()];
}

export function routePlaceFromInput(contexts: readonly PlannedContextState[], text: string | undefined,
  googlePlaceId: string | undefined, previous: ProspectivePlaceRef | null | undefined): ProspectivePlaceRef | null {
  if (text === undefined) return previous ?? null;
  const label = text.trim();
  if (googlePlaceId) {
    const candidates = [...(isGoogleCardPlace(previous) ? [previous] : []), ...savedCardGooglePlaces(contexts)];
    const saved = candidates.find(place => place.googlePlaceId === googlePlaceId && place.label === label);
    if (!saved) throw new TypeError("PLANNER_GOOGLE_CARD_PLACE_NOT_ADMITTED");
    return saved;
  }
  if (!label) return previous?.kind === "KNOWN" ? previous : null;
  return googlePlaceId === undefined && previous?.kind === "TEXT" && previous.label === label ? previous : { kind: "TEXT", label };
}
