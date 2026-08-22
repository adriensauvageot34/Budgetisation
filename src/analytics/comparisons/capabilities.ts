import type {
  ComparisonCapability,
  ComparisonCapabilityId,
} from "./types";

const observedDerivedPairs = [
  ["observed", "derived"],
  ["derived", "derived"],
] as const;

export const comparisonCapabilities = {
  same_metric: {
    id: "same_metric",
    allowedReferenceKinds: ["same_period", "rolling_comparison"],
    relativeAllowed: true,
    allowedProvenancePairs: [
      ["observed", "observed"],
      ["derived", "derived"],
    ],
  },
  actual_vs_typical_month: {
    id: "actual_vs_typical_month",
    targetSemantic: "actual",
    referenceSemantic: "typical_month",
    allowedReferenceKinds: ["rolling_comparison"],
    relativeAllowed: true,
    allowedProvenancePairs: observedDerivedPairs,
  },
  typical_vs_minimal: {
    id: "typical_vs_minimal",
    targetSemantic: "typical_month",
    referenceSemantic: "minimal",
    allowedReferenceKinds: ["same_period"],
    relativeAllowed: true,
    allowedProvenancePairs: [["derived", "derived"]],
  },
  actual_vs_adjusted_minimal: {
    id: "actual_vs_adjusted_minimal",
    targetSemantic: "actual",
    referenceSemantic: "adjusted_minimal",
    allowedReferenceKinds: ["same_period"],
    relativeAllowed: true,
    allowedProvenancePairs: observedDerivedPairs,
  },
  context_vs_context_reference: {
    id: "context_vs_context_reference",
    targetSemantic: "context",
    referenceSemantic: "context_reference",
    allowedReferenceKinds: ["rolling_comparison"],
    relativeAllowed: true,
    allowedProvenancePairs: observedDerivedPairs,
  },
  activity_frequency_vs_habitual: {
    id: "activity_frequency_vs_habitual",
    targetSemantic: "activity_frequency",
    referenceSemantic: "habitual_activity_frequency",
    allowedReferenceKinds: ["rolling_comparison"],
    relativeAllowed: true,
    allowedProvenancePairs: observedDerivedPairs,
  },
  ticket_vs_habitual: {
    id: "ticket_vs_habitual",
    targetSemantic: "ticket",
    referenceSemantic: "habitual_ticket",
    allowedReferenceKinds: ["rolling_comparison"],
    relativeAllowed: true,
    allowedProvenancePairs: observedDerivedPairs,
  },
} as const satisfies Record<ComparisonCapabilityId, ComparisonCapability>;

export function isComparisonCapabilityId(
  value: unknown,
): value is ComparisonCapabilityId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(comparisonCapabilities, value)
  );
}

export function getComparisonCapability(
  value: unknown,
): ComparisonCapability {
  if (!isComparisonCapabilityId(value)) {
    throw new TypeError("La méthode de comparaison n'est pas autorisée.");
  }
  return comparisonCapabilities[value];
}
