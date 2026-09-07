import { canonicalSerializeGlobal } from "../../core/global-v2";
import { computeGlobalSharedInputHash } from "./shared-participation";

export const GLOBAL_SOCIAL_CONTEXT_METHOD_VERSION = "global_social_context@v1" as const;

export type GlobalSocialOccurrence = {
  readonly occurrenceId: string;
  readonly resolvedInternalParticipantIds: readonly string[];
  readonly knownExternalContactIds: readonly string[];
  readonly unresolvedExternalParticipantCount: number;
  readonly rosterCompleteness: "POSITIVE_ONLY" | "EXHAUSTIVE" | "UNKNOWN";
  readonly evidenceRefs: readonly string[];
};

export type GlobalSocialContextSummary = {
  readonly occurrenceCount: number;
  readonly participantResolvedOccurrences: number;
  readonly contactIdentityResolvedOccurrences: number;
  readonly participantCoverage: number | null;
  readonly contactIdentityCoverage: number | null;
  readonly unresolvedExternalParticipantCount: number;
  readonly contactCapabilities: "AUTHORITY_GATED";
  readonly unavailableCapabilities: readonly ["CONTACT_ALIAS", "CONTACT_RELATION", "CONTACT_GROUP", "RELATIONSHIP_SCORE", "COST_PER_CONTACT"];
  readonly evidenceRefs: readonly string[];
  readonly methodVersion: typeof GLOBAL_SOCIAL_CONTEXT_METHOD_VERSION;
  readonly inputHash: string;
};

/** Social occurrence analytics remain usable while Contact/Alias/Relation/Group
 * stay gated. Contact identity and participant coverage are intentionally distinct. */
export function buildGlobalSocialContextSummary(values: readonly GlobalSocialOccurrence[]): GlobalSocialContextSummary {
  const byId = new Map<string, GlobalSocialOccurrence>();
  for (const value of values) {
    if (!value.occurrenceId || value.evidenceRefs.length === 0 || value.unresolvedExternalParticipantCount < 0) throw new TypeError("M10_SOCIAL_OCCURRENCE_INVALID");
    const normalized = { ...value, resolvedInternalParticipantIds: [...new Set(value.resolvedInternalParticipantIds)].sort(), knownExternalContactIds: [...new Set(value.knownExternalContactIds)].sort(), evidenceRefs: [...new Set(value.evidenceRefs)].sort() };
    const previous = byId.get(value.occurrenceId);
    if (previous !== undefined && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(normalized)) throw new TypeError("M10_CONTRADICTORY_SOCIAL_OCCURRENCE");
    byId.set(value.occurrenceId, normalized);
  }
  const rows = [...byId.values()].sort((a, b) => a.occurrenceId.localeCompare(b.occurrenceId));
  const participantResolved = rows.filter((row) => row.rosterCompleteness !== "UNKNOWN").length;
  const contactResolved = rows.filter((row) => row.unresolvedExternalParticipantCount === 0 && row.rosterCompleteness !== "UNKNOWN").length;
  const base = {
    occurrenceCount: rows.length,
    participantResolvedOccurrences: participantResolved,
    contactIdentityResolvedOccurrences: contactResolved,
    participantCoverage: rows.length === 0 ? null : participantResolved / rows.length,
    contactIdentityCoverage: rows.length === 0 ? null : contactResolved / rows.length,
    unresolvedExternalParticipantCount: rows.reduce((sum, row) => sum + row.unresolvedExternalParticipantCount, 0),
    contactCapabilities: "AUTHORITY_GATED" as const,
    unavailableCapabilities: ["CONTACT_ALIAS", "CONTACT_RELATION", "CONTACT_GROUP", "RELATIONSHIP_SCORE", "COST_PER_CONTACT"] as const,
    evidenceRefs: [...new Set(rows.flatMap((row) => row.evidenceRefs))].sort(),
    methodVersion: GLOBAL_SOCIAL_CONTEXT_METHOD_VERSION,
  };
  return { ...base, inputHash: computeGlobalSharedInputHash(base) };
}
