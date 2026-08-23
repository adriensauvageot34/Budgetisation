import "server-only";

import type { CanonicalSourceName } from "./errors";

export type CanonicalSourceHealthStatus =
  | "AVAILABLE"
  | "MISSING_MIGRATION"
  | "UNAVAILABLE";

export type CanonicalSourceHealth = Readonly<
  Record<CanonicalSourceName, CanonicalSourceHealthStatus>
>;

export const initiallyAvailableCanonicalSources: CanonicalSourceHealth =
  Object.freeze({
    economic: "AVAILABLE",
    timing: "AVAILABLE",
    places: "AVAILABLE",
    person_days: "AVAILABLE",
    life_events: "AVAILABLE",
    purchase_events: "AVAILABLE",
    financial_links: "AVAILABLE",
    operations: "AVAILABLE",
    entities: "AVAILABLE",
  });
