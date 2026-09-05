/** Shared semantic keys only. Clock boundaries remain authority-gated until a
 * dated/versioned product policy defines them; engines and React must not each
 * invent their own ranges.
 */
export const globalDayPartCatalog = Object.freeze({
  version: "global-day-part-catalog@v1",
  keys: ["MORNING", "MIDDAY", "AFTERNOON", "EVENING", "NIGHT"] as const,
  clockBoundaryPolicy: "UNDEFINED_REQUIRES_EXPLICIT_UPSTREAM_CLASSIFICATION" as const,
});

export type GlobalDayPartKey = typeof globalDayPartCatalog.keys[number];

export function parseGlobalDayPartKey(value: unknown): GlobalDayPartKey {
  if (typeof value !== "string" || !(globalDayPartCatalog.keys as readonly string[]).includes(value)) {
    throw new TypeError("DayPart must come from Global DayPartCatalog.");
  }
  return value as GlobalDayPartKey;
}
