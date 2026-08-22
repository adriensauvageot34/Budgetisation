import type { SearchPolicy } from "./types";

export function normalizeCollectionSearch(
  value: unknown,
  policy: SearchPolicy,
): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new TypeError("La recherche doit être une chaîne ou null.");
  }

  const normalized = value.trim();
  if (normalized.length === 0) return null;

  if (policy.kind === "disabled") {
    throw new TypeError("La recherche n'est pas autorisée pour cette ressource.");
  }
  if (normalized.length > policy.maxLength) {
    throw new TypeError("La recherche dépasse la longueur autorisée.");
  }
  return normalized;
}
