import "server-only";

import type { CanonicalSourceName } from "./errors";

export type CanonicalSourceHealthStatus =
  | "AVAILABLE"
  | "MISSING_MIGRATION"
  | "UNAVAILABLE";

export type CanonicalSourceHealth = Readonly<
  Record<CanonicalSourceName, CanonicalSourceHealthStatus>
>;

export function unavailableCanonicalSourceHealth(): CanonicalSourceHealth {
  return {
    economic: "UNAVAILABLE",
    timing: "UNAVAILABLE",
    places: "UNAVAILABLE",
    person_days: "UNAVAILABLE",
    life_events: "UNAVAILABLE",
    purchase_events: "UNAVAILABLE",
    financial_links: "UNAVAILABLE",
    operations: "UNAVAILABLE",
    entities: "UNAVAILABLE",
  };
}
