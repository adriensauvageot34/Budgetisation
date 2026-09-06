import type { RelationshipDailyExposure } from "./relationship-comparators";

export type DailyRelationshipDefinition = {
  readonly id: string;
  readonly exposure: RelationshipDailyExposure;
  readonly outcome: string;
  readonly outcomeKind: "BINARY" | "MONEY";
  readonly grain: "PERSON_DAY";
  readonly minimumPairs: 15;
  readonly authority: "ACTIVITY_OCCURRENCE" | "PERSON_DAILY_ECONOMIC_CONSUMPTION";
  readonly requiredControls: readonly string[];
};

const define = (id: string, exposure: RelationshipDailyExposure, outcome: string, outcomeKind: "BINARY" | "MONEY"): DailyRelationshipDefinition => Object.freeze({ id, exposure, outcome, outcomeKind, grain: "PERSON_DAY", minimumPairs: 15, authority: outcomeKind === "BINARY" ? "ACTIVITY_OCCURRENCE" : "PERSON_DAILY_ECONOMIC_CONSUMPTION", requiredControls: ["PERSON", "REGIME_WHEN_DETECTED", exposure === "ONSITE" || exposure === "REMOTE" ? "EXACT_WEEKDAY" : exposure === "WEEKEND" ? "EXPLICIT_CALENDAR_CONTRAST" : "CALENDAR_CLASS", "TEMPORAL_PROXIMITY_56_DAYS", "DATA_COVERAGE", "ESTABLISHED_SEASON_WHEN_APPLICABLE"] });

/** Explicit direction: reverse questions are separate catalogue members, not inferred. */
export const dailyRelationshipCatalog = Object.freeze([
  define("onsite-restaurant", "ONSITE", "RESTAURANT", "BINARY"),
  define("onsite-external-meal", "ONSITE", "REPAS_EXTERIEUR", "BINARY"),
  define("remote-restaurant", "REMOTE", "RESTAURANT", "BINARY"),
  define("leave-rest-leisure", "LEAVE_REST", "LEISURE_ACTIVITY", "BINARY"),
  define("weekend-social", "WEEKEND", "SOCIAL_ACTIVITY", "BINARY"),
  define("weekend-restaurant", "WEEKEND", "RESTAURANT", "BINARY"),
  define("onsite-external-meal-cost", "ONSITE", "RESTAURATION_EXTERIEURE_COST", "MONEY"),
  define("remote-external-meal-cost", "REMOTE", "RESTAURATION_EXTERIEURE_COST", "MONEY"),
  define("weekend-leisure-cost", "WEEKEND", "LOISIRS_COST", "MONEY"),
  define("leave-leisure-cost", "LEAVE_REST", "LOISIRS_COST", "MONEY"),
]);

export const relationshipCatalogVersion = "relationship-catalog-explicit-families@v2";

/** Named catalogue questions only. No Cartesian product of entity/category IDs.
 * A deferred/excluded question remains in the FDR examination record, without a
 * fabricated p-value. Its future activation requires its owning provider gate.
 */
export const nonDailyRelationshipPlan = Object.freeze([
  { id: "onsite-transport-activity", family: "B", grain: "PERSON_DAY", owner: "P08", reason: "SPECIALIZED_MOBILITY_PROVIDER_PENDING" },
  { id: "onsite-mobility-cost", family: "B", grain: "PERSON_DAY", owner: "P08", reason: "SPECIALIZED_MOBILITY_PROVIDER_PENDING" },
  { id: "remote-mobility-cost", family: "B", grain: "PERSON_DAY", owner: "P08", reason: "SPECIALIZED_MOBILITY_PROVIDER_PENDING" },
  { id: "leave-mobility", family: "B", grain: "PERSON_DAY", owner: "P08", reason: "SPECIALIZED_MOBILITY_PROVIDER_PENDING" },
  { id: "weekend-mobility", family: "B", grain: "PERSON_DAY", owner: "P08", reason: "SPECIALIZED_MOBILITY_PROVIDER_PENDING" },
  { id: "onsite-transport-cost", family: "C", grain: "PERSON_DAY", owner: "P08", reason: "SPECIALIZED_MOBILITY_PROVIDER_PENDING" },
  { id: "family-visit-mobility-cost", family: "D", grain: "OCCURRENCE", owner: "P08", reason: "SPECIALIZED_MOBILITY_PROVIDER_PENDING" },
  { id: "social-outing-mobility-cost", family: "D", grain: "OCCURRENCE", owner: "P08", reason: "SPECIALIZED_MOBILITY_PROVIDER_PENDING" },
  { id: "leisure-activity-mobility-cost", family: "D", grain: "OCCURRENCE", owner: "P08", reason: "SPECIALIZED_MOBILITY_PROVIDER_PENDING" },
  { id: "activity-category-association", family: "E", grain: "OCCURRENCE", owner: "P06", reason: "AUTHORITY_GATED_EXPLICIT_ACTIVITY_CATEGORY_PAIR_REQUIRED" },
  { id: "moment-type-outside-daily", family: "F", grain: "MOMENT", owner: "P08", reason: "MOMENT_COMPARABLE_UNITS_PENDING" },
  { id: "moment-type-mobility", family: "F", grain: "MOMENT", owner: "P08", reason: "MOMENT_COMPARABLE_UNITS_PENDING" },
  { id: "moment-type-restauration", family: "F", grain: "MOMENT", owner: "P08", reason: "MOMENT_COMPARABLE_UNITS_PENDING" },
  { id: "family-place-visit-mobility", family: "G", grain: "VISIT", owner: "P08", reason: "VISIT_SEMANTICS_MOBILITY_PENDING" },
  { id: "work-place-visit-external-meal", family: "G", grain: "VISIT", owner: "P08", reason: "VISIT_SEMANTICS_PENDING" },
  { id: "specific-place-visit-localized-purchase", family: "G", grain: "VISIT", owner: "P10", reason: "LOCALIZED_PURCHASE_PROVIDER_PENDING" },
  { id: "shared-activity-causal-cost", family: "H", grain: "OCCURRENCE", owner: "P06", reason: "CAUSAL_COMPOSITION_OUTSIDE_ASSOCIATION_ENGINE" },
  { id: "shared-outing-mobility", family: "H", grain: "OCCURRENCE", owner: "P08", reason: "SHARED_PARTICIPATION_AND_MOBILITY_PENDING" },
  { id: "shared-weekend-outside-daily", family: "H", grain: "PERSON_DAY", owner: "P06", reason: "AUTHORITY_GATED_SHARED_PARTICIPATION_AND_DAILY_FINANCE" },
] as const);

export function deferredRelationshipExaminations() {
  return nonDailyRelationshipPlan.map((definition) => ({
    ...definition,
    status: definition.owner === "P08" || definition.owner === "P10" ? "DEFERRED_P08_P10" as const : "EXCLUDED_WITH_REASON" as const,
    eligible: false as const,
    exclusionReason: definition.reason,
  }));
}
// Not authorized to execute early. These entries are a dependency inventory,
// not fabricated completed definitions or automatic cross-products.
export const relationshipPendingFamilies = Object.freeze([
  { family: "B/D mobility", owner: "P08", reason: "SPECIALIZED_MOBILITY_PROVIDER_PENDING" },
  { family: "F Moments", owner: "P08", reason: "MOMENT_COMPARABLE_UNITS_PENDING" },
  { family: "G Place/Purchase", owner: "P08/P10", reason: "VISIT_SEMANTICS_LOCALIZED_PURCHASE_PENDING" },
  { family: "H shared", owner: "SHARED_PARTICIPATION_PROVIDER", reason: "SHARED_AUTHORITY_REQUIRED" },
]);
