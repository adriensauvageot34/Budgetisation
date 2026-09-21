import type {
  DeclaredSignal,
  PersonaAuthority,
  PersonaClaimDimension,
  PersonaDeclaredValue,
  PersonaKnowledgeStatus,
  PersonaTemporalStatus,
  PersonaTraitCandidate,
} from "./persona-signals";

const temporalStatuses = new Set<PersonaTemporalStatus>([
  "STABLE",
  "EMERGING",
  "HISTORICAL",
  "PROJECT",
  "CHANGED",
  "UNKNOWN",
]);

const authorityRank: Readonly<Record<PersonaAuthority, number>> = {
  USER_VALIDATED: 4,
  CANONICAL_DB: 3,
  OBSERVED: 2,
  DERIVED: 1,
};

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function primaryAuthority(values: readonly PersonaAuthority[]): PersonaAuthority | undefined {
  return [...values].sort((a, b) => authorityRank[b] - authorityRank[a] || a.localeCompare(b))[0];
}

function subjectKey(value: PersonaTraitCandidate["subject"] | DeclaredSignal["subject"]): string {
  if (value.kind === "PERSON") return `PERSON:${value.personId}`;
  if (value.kind === "HOUSEHOLD") return `HOUSEHOLD:${value.householdId ?? "UNBOUND"}`;
  return `SHARED:${[...(value.personIds ?? [])].sort().join(":") || "UNBOUND"}`;
}

function periodsCompatible(
  left: Pick<PersonaTraitCandidate, "validFrom" | "validTo">,
  right: Pick<DeclaredSignal, "validFrom" | "validTo">,
): boolean {
  if (left.validFrom !== undefined && right.validTo !== undefined && left.validFrom > right.validTo) return false;
  if (right.validFrom !== undefined && left.validTo !== undefined && right.validFrom > left.validTo) return false;
  return true;
}

function declarationMatches(candidate: PersonaTraitCandidate, declaration: DeclaredSignal): boolean {
  return candidate.scope === declaration.scope
    && subjectKey(candidate.subject) === subjectKey(declaration.subject)
    && candidate.semanticKey === declaration.semanticKey
    && (candidate.context === undefined || declaration.context === undefined || candidate.context === declaration.context)
    && periodsCompatible(candidate, declaration);
}

function qualificationValues(value: PersonaDeclaredValue | undefined): readonly string[] {
  if (value === undefined || typeof value === "boolean") return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}

function declarationAuthorities(candidate: PersonaTraitCandidate | undefined, declaration: DeclaredSignal): readonly PersonaAuthority[] {
  return [...new Set([
    ...(candidate?.authorities ?? (candidate?.authority === undefined ? [] : [candidate.authority])),
    ...(declaration.authority === undefined ? [] : [declaration.authority]),
  ])].sort((a, b) => authorityRank[b] - authorityRank[a] || a.localeCompare(b));
}

function declarationDimensions(candidate: PersonaTraitCandidate | undefined, declaration: DeclaredSignal): readonly PersonaClaimDimension[] {
  return unique([
    ...(candidate?.dimensions ?? []),
    declaration.dimension ?? (declaration.action === "TEMPORAL_OVERRIDE" ? "TEMPORALITY" : "GENERAL"),
  ]) as readonly PersonaClaimDimension[];
}

function enrichCandidate(candidate: PersonaTraitCandidate, declaration: DeclaredSignal): PersonaTraitCandidate {
  const authorities = declarationAuthorities(candidate, declaration);
  const qualifications = declaration.action === "QUALIFY" || declaration.action === "AFFIRM"
    ? unique([...(candidate.qualifications ?? []), ...qualificationValues(declaration.value)])
    : candidate.qualifications;
  let temporalStatus = candidate.temporalStatus;
  if (declaration.action === "TEMPORAL_OVERRIDE") {
    if (typeof declaration.value !== "string" || !temporalStatuses.has(declaration.value as PersonaTemporalStatus)) {
      throw new TypeError(`PERSONA_DECLARATION_TEMPORAL_STATUS_INVALID:${declaration.signalId}`);
    }
    temporalStatus = declaration.value as PersonaTemporalStatus;
  }
  const knowledgeStatus: PersonaKnowledgeStatus = declaration.authority === "USER_VALIDATED"
    ? "USER_VALIDATED"
    : candidate.knowledgeStatus ?? "DERIVED";
  return {
    ...candidate,
    authority: primaryAuthority(authorities),
    authorities,
    knowledgeStatus,
    ...(temporalStatus === undefined ? {} : { temporalStatus }),
    dimensions: declarationDimensions(candidate, declaration),
    signalRefs: unique([...(candidate.signalRefs ?? []), declaration.signalId]),
    evidenceRefs: unique([...(candidate.evidenceRefs ?? []), ...(declaration.evidenceRefs ?? [])]),
    sourceModules: unique([...(candidate.sourceModules ?? []), declaration.sourceModule ?? "DECLARED"]),
    limitations: unique([...(candidate.limitations ?? []), ...(declaration.limitations ?? [])]),
    ...(qualifications === undefined || qualifications.length === 0 ? {} : { qualifications }),
    ...(candidate.context === undefined && declaration.context !== undefined ? { context: declaration.context } : {}),
    ...(candidate.validFrom === undefined && declaration.validFrom !== undefined ? { validFrom: declaration.validFrom } : {}),
    ...(candidate.validTo === undefined && declaration.validTo !== undefined ? { validTo: declaration.validTo } : {}),
    ...(candidate.groupKey === undefined && declaration.groupKey !== undefined ? { groupKey: declaration.groupKey } : {}),
  };
}

function createAffirmedCandidate(declaration: DeclaredSignal): PersonaTraitCandidate | undefined {
  if (declaration.value === false || declaration.kind === undefined || declaration.family === undefined) return undefined;
  const authorities = declarationAuthorities(undefined, declaration);
  const qualifications = qualificationValues(declaration.value);
  const temporalStatus = declaration.action === "TEMPORAL_OVERRIDE"
    ? typeof declaration.value === "string" && temporalStatuses.has(declaration.value as PersonaTemporalStatus)
      ? declaration.value as PersonaTemporalStatus
      : undefined
    : declaration.temporalStatus;
  return {
    candidateId: `persona-candidate:${declaration.scope}:${subjectKey(declaration.subject)}:${declaration.semanticKey}:declared`,
    subject: declaration.subject,
    scope: declaration.scope,
    kind: declaration.kind,
    family: declaration.family,
    semanticKey: declaration.semanticKey,
    authority: primaryAuthority(authorities),
    authorities,
    knowledgeStatus: declaration.authority === "USER_VALIDATED" ? "USER_VALIDATED" : declaration.knowledgeStatus ?? "DERIVED",
    ...(temporalStatus === undefined ? {} : { temporalStatus }),
    dimensions: declarationDimensions(undefined, declaration),
    ...(declaration.context === undefined ? {} : { context: declaration.context }),
    ...(declaration.validFrom === undefined ? {} : { validFrom: declaration.validFrom }),
    ...(declaration.validTo === undefined ? {} : { validTo: declaration.validTo }),
    signalRefs: [declaration.signalId],
    evidenceRefs: unique(declaration.evidenceRefs ?? []),
    sourceModules: [declaration.sourceModule ?? "DECLARED"],
    limitations: unique(declaration.limitations ?? []),
    ...(qualifications.length === 0 ? {} : { qualifications }),
    ...(declaration.groupKey === undefined ? {} : { groupKey: declaration.groupKey }),
  } as PersonaTraitCandidate;
}

function negates(candidate: PersonaTraitCandidate, declaration: DeclaredSignal): boolean {
  if (candidate.scope !== declaration.scope || subjectKey(candidate.subject) !== subjectKey(declaration.subject)) return false;
  const targets = new Set([declaration.semanticKey, ...(declaration.targetSemanticKeys ?? [])]);
  return targets.has(candidate.semanticKey)
    || declaration.groupKey !== undefined && candidate.groupKey === declaration.groupKey;
}

export function applyPersonaDeclarations(input: {
  readonly candidates: readonly PersonaTraitCandidate[];
  readonly declarations: readonly DeclaredSignal[];
}): readonly PersonaTraitCandidate[] {
  let candidates = input.candidates.map((candidate) => ({ ...candidate }));
  for (const declaration of [...input.declarations].sort((a, b) => a.signalId.localeCompare(b.signalId))) {
    if (declaration.action === "NEGATE") {
      candidates = candidates.filter((candidate) => !negates(candidate, declaration));
      continue;
    }
    const matching = candidates.map((candidate, index) => ({ candidate, index })).filter(({ candidate }) => declarationMatches(candidate, declaration));
    if (matching.length === 0) {
      if (declaration.action === "AFFIRM" || declaration.action === "TEMPORAL_OVERRIDE") {
        const created = createAffirmedCandidate(declaration);
        if (created !== undefined) candidates.push(created);
      }
      continue;
    }
    for (const { candidate, index } of matching) candidates[index] = enrichCandidate(candidate, declaration);
  }
  return candidates;
}
