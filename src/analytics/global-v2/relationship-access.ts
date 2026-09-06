/** Analytics access policy (Master GLO-PUB-044–047), not UI/card selection.
 * Rejected comparisons remain inspectable explicitly; no p/q is sent to AI.
 */
export function relationshipAccessPolicy(input: {
  readonly evidenceStatus: "PUBLISHED" | "SUGGESTIVE_INTERNAL" | "REJECTED";
  readonly hasComparison: boolean;
  readonly temporalState: "STABLE_CURRENT_REGIME" | "RECENT_ONLY" | "HISTORICAL_ONLY" | "CHANGED_RELATIONSHIP" | "INSUFFICIENT_TEMPORAL_SUPPORT";
}) {
  const automatic = input.evidenceStatus === "PUBLISHED" && (input.temporalState === "STABLE_CURRENT_REGIME" || input.temporalState === "RECENT_ONLY");
  return {
    autoGlobal: automatic ? "VISIBLE" as const : "HIDDEN" as const,
    moduleDetailAutomatic: automatic ? "VISIBLE" as const : "HIDDEN" as const,
    explicitExploration: input.hasComparison ? "VISIBLE" as const : "UNAVAILABLE" as const,
    aiEligible: automatic,
    statisticalValuesInAi: false as const,
    languageKey: automatic ? input.temporalState === "RECENT_ONLY" ? "RECENT_ASSOCIATION" : "OBSERVED_ASSOCIATION" : "NO_ROBUST_ASSOCIATION_ESTABLISHED",
    causalityMode: "ASSOCIATION_ONLY" as const,
    policyVersion: "global-relationship-access@v1",
  };
}
