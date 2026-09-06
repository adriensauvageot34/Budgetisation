export const globalM10CapabilityStates = Object.freeze({
  sharedParticipationResolver: "AVAILABLE" as const,
  explicitShared: "AVAILABLE" as const,
  canonicalShared: "AVAILABLE" as const,
  strongCopresence: "AVAILABLE" as const,
  inferenceCatalog: "AVAILABLE" as const,
  observableSupport: "AVAILABLE" as const,
  normalizedSharedRate: "AVAILABLE" as const,
  sharedActivityOccurrence: "AVAILABLE" as const,
  sharedPlaceVisit: "AVAILABLE" as const,
  sharedMoment: "AVAILABLE" as const,
  externalParticipants: "AVAILABLE" as const,
  sharedRoutine: "DATA_GATED" as const,
  sharedEvolution: "DATA_GATED" as const,
  sharedCausalCosts: "DATA_GATED" as const,
  pairExclusivity: "DATA_GATED" as const,
  sharedMobilityLeg: "AUTHORITY_GATED" as const,
  namedExternalContacts: "AUTHORITY_GATED" as const,
  contactAliases: "AUTHORITY_GATED" as const,
  contactRelations: "AUTHORITY_GATED" as const,
  contactGroups: "AUTHORITY_GATED" as const,
  socialGraph: "FORBIDDEN" as const,
  relationshipScore: "FORBIDDEN" as const,
  costPerContact: "FORBIDDEN" as const,
});

export function recertifyGlobalSharedDownstreamClosure() {
  return Object.freeze({
    "global-v2:m3-transformations": "NO_DECLARED_INPUT_EDGE",
    "global-v2:m4-rhythm-routines": "NO_DECLARED_INPUT_EDGE",
    "global-v2:m5-relationships": "NO_DECLARED_INPUT_EDGE",
    "global-v2:m9-persona": "NO_DECLARED_INPUT_EDGE",
  } as const);
}
