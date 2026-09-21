import { canonicalSerializeGlobal } from "../../core/global-v2";
import { parseMethodVersion } from "../../core/versions";
import type {
  PersonaAuthority,
  PersonaKnowledgeStatus,
  PersonaMetrics,
  PersonaTemporalStatus,
  PersonaTrait,
  PersonaTraitChild,
  PersonaTraitKind,
} from "./persona-signals";
import type { GlobalPersonaFamily } from "./persona";

export const GLOBAL_PERSONA_SELECTION_METHOD_VERSION = parseMethodVersion("global_persona_selection@v1");
export const GLOBAL_PERSONA_GROUPING_CATALOG_VERSION = "global_persona_grouping_catalog@v1" as const;

type GroupDefinition = {
  readonly groupKey: "beauty_and_care" | "creative_projects";
  readonly semanticKey: "universe.beauty_and_care" | "universe.creative_projects";
  readonly family: GlobalPersonaFamily;
  readonly scope: "PERSONAL";
  readonly minimumChildren: number;
  readonly needKeys: readonly string[];
  readonly semanticKeys: readonly string[];
  readonly semanticPrefixes: readonly string[];
};

const groupingCatalog: readonly GroupDefinition[] = Object.freeze([
  {
    groupKey: "beauty_and_care",
    semanticKey: "universe.beauty_and_care",
    family: "PERSONAL_CARE",
    scope: "PERSONAL",
    minimumChildren: 2,
    needKeys: [
      "epilation_manon",
      "maquillage_manon_mascara",
      "maquillage_manon_sourcils",
      "skincare_manon_masque",
    ],
    semanticKeys: ["beauty.epilation", "beauty.mascara", "beauty.skincare", "beauty.brows"],
    semanticPrefixes: ["beauty.", "product-need:maquillage_manon_", "product-need:epilation_manon", "product-need:skincare_manon_"],
  },
  {
    groupKey: "creative_projects",
    semanticKey: "universe.creative_projects",
    family: "LEISURE_AND_ACTIVITIES",
    scope: "PERSONAL",
    minimumChildren: 2,
    needKeys: [],
    semanticKeys: [
      "creative.photo",
      "creative.photo.adrien",
      "creative.music",
      "creative.music.adrien",
      "creative.home_studio",
      "creative.home_studio.adrien",
    ],
    semanticPrefixes: ["creative.photo.", "creative.music.", "creative.home_studio."],
  },
]);

const authorityRank: Readonly<Record<PersonaAuthority, number>> = {
  USER_VALIDATED: 4,
  CANONICAL_DB: 3,
  OBSERVED: 2,
  DERIVED: 1,
};

const knowledgeRank: Readonly<Record<PersonaKnowledgeStatus, number>> = {
  USER_VALIDATED: 4,
  OBSERVED: 3,
  DERIVED: 2,
  TO_CONFIRM: 1,
};

const temporalInterest: Readonly<Record<PersonaTemporalStatus, number>> = {
  PROJECT: 2.8,
  EMERGING: 2.6,
  STABLE: 2.5,
  CHANGED: 2.3,
  HISTORICAL: 1.4,
  UNKNOWN: 0.8,
};

const narrativeInterest: Readonly<Record<PersonaTraitKind, number>> = {
  UNIVERSE: 3,
  PROJECT: 2.8,
  HOUSEHOLD_ORGANIZATION: 2.6,
  MOBILITY: 2.4,
  ROUTINE: 2.2,
  HABIT: 1.6,
};

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function subjectKey(trait: PersonaTrait): string {
  if (trait.subject.kind === "PERSON") return `PERSON:${trait.subject.personId}`;
  if (trait.subject.kind === "HOUSEHOLD") return `HOUSEHOLD:${trait.subject.householdId ?? "UNBOUND"}`;
  return `SHARED:${[...(trait.subject.personIds ?? [])].sort().join(":") || "UNBOUND"}`;
}

function profileKey(trait: PersonaTrait): string {
  return `${trait.scope}:${subjectKey(trait)}`;
}

function authoritiesOf(trait: PersonaTrait): readonly PersonaAuthority[] {
  return [...new Set([
    ...(trait.authorities ?? []),
    ...(trait.authority === undefined ? [] : [trait.authority]),
  ])].sort((a, b) => authorityRank[b] - authorityRank[a] || a.localeCompare(b));
}

function childFromTrait(trait: PersonaTrait): PersonaTraitChild {
  const authorities = authoritiesOf(trait);
  return {
    traitId: trait.traitId,
    semanticKey: trait.semanticKey,
    kind: trait.kind,
    family: trait.family,
    ...(trait.temporalStatus === undefined ? {} : { temporalStatus: trait.temporalStatus }),
    authorities,
    sourceModules: unique(trait.sourceModules ?? []),
    evidenceRefs: unique(trait.evidenceRefs ?? []),
    limitations: unique(trait.limitations ?? []),
    ...(trait.metrics === undefined ? {} : { metrics: trait.metrics }),
  };
}

function membershipReason(definition: GroupDefinition, trait: PersonaTrait): string | undefined {
  if (trait.scope !== definition.scope || trait.semanticKey === definition.semanticKey) return undefined;
  if ((trait.needKeys ?? []).some((needKey) => definition.needKeys.includes(needKey))) return "COMMON_NEED";
  if (definition.semanticKeys.includes(trait.semanticKey)) return "CANONICAL_SEMANTIC_KEY";
  if (trait.groupKey === definition.groupKey) return "ADAPTER_GROUP_KEY";
  if (authoritiesOf(trait).includes("USER_VALIDATED")
    && definition.semanticPrefixes.some((prefix) => trait.semanticKey.startsWith(prefix))) return "USER_VALIDATED_DECLARATION";
  if (definition.semanticPrefixes.some((prefix) => trait.semanticKey.startsWith(prefix))) return "VERSIONED_GROUPING_CATALOG";
  return undefined;
}

function parentTemporalStatus(children: readonly PersonaTrait[]): PersonaTemporalStatus | undefined {
  const values = new Set(children.flatMap(({ temporalStatus }) => temporalStatus === undefined ? [] : [temporalStatus]));
  for (const status of ["PROJECT", "EMERGING", "STABLE", "CHANGED", "HISTORICAL", "UNKNOWN"] as const) {
    if (values.has(status)) return status;
  }
  return undefined;
}

function strongestKnowledge(children: readonly PersonaTrait[]): PersonaKnowledgeStatus {
  return children.flatMap(({ knowledgeStatus }) => knowledgeStatus === undefined ? [] : [knowledgeStatus])
    .sort((a, b) => knowledgeRank[b] - knowledgeRank[a] || a.localeCompare(b))[0] ?? "DERIVED";
}

function buildUniverseParent(
  definition: GroupDefinition,
  children: readonly PersonaTrait[],
  membershipReasons: readonly string[],
): PersonaTrait {
  const first = children[0]!;
  const sourceAuthorities = [...new Set(children.flatMap(authoritiesOf))]
    .sort((a, b) => authorityRank[b] - authorityRank[a] || a.localeCompare(b));
  const authorities = [...new Set([...sourceAuthorities, "DERIVED" as const])]
    .sort((a, b) => authorityRank[b] - authorityRank[a] || a.localeCompare(b));
  const userValidated = authorities.includes("USER_VALIDATED");
  const temporalStatus = parentTemporalStatus(children);
  const childTraits = children.map(childFromTrait).sort((a, b) => a.traitId.localeCompare(b.traitId));
  return {
    traitId: `persona-trait:${definition.scope}:${subjectKey(first)}:${definition.semanticKey}:ANY`,
    subject: first.subject,
    scope: definition.scope,
    kind: "UNIVERSE",
    family: definition.family,
    semanticKey: definition.semanticKey,
    authority: userValidated ? "USER_VALIDATED" : "DERIVED",
    authorities,
    knowledgeStatus: userValidated ? "USER_VALIDATED" : strongestKnowledge(children) === "TO_CONFIRM" ? "TO_CONFIRM" : "DERIVED",
    ...(temporalStatus === undefined ? {} : { temporalStatus }),
    dimensions: unique(children.flatMap(({ dimensions }) => dimensions ?? [])) as PersonaTrait["dimensions"],
    signalRefs: unique(children.flatMap(({ signalRefs }) => signalRefs ?? [])),
    evidenceRefs: unique(children.flatMap(({ evidenceRefs }) => evidenceRefs ?? [])),
    sourceModules: unique([...children.flatMap(({ sourceModules }) => sourceModules ?? []), "M9_GROUPING"]),
    limitations: unique(children.flatMap(({ limitations }) => limitations ?? [])),
    qualifications: unique(children.flatMap(({ qualifications }) => qualifications ?? [])),
    metrics: { childCount: childTraits.length },
    groupKey: definition.groupKey,
    needKeys: unique(children.flatMap(({ needKeys }) => needKeys ?? [])),
    children: childTraits,
    summary: `${GLOBAL_PERSONA_GROUPING_CATALOG_VERSION}:${unique(membershipReasons).join("+")}`,
  } as PersonaTrait;
}

/** Adds explicit universe parents while retaining every original child in allTraits. */
export function promotePersonaTraitUniverses(traits: readonly PersonaTrait[]): readonly PersonaTrait[] {
  const canonical = new Map<string, PersonaTrait>();
  for (const trait of traits) {
    const previous = canonical.get(trait.traitId);
    if (previous !== undefined && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(trait)) {
      throw new TypeError(`PERSONA_CONTRADICTORY_TRAIT:${trait.traitId}`);
    }
    canonical.set(trait.traitId, trait);
  }
  const result = [...canonical.values()];
  const profiles = new Map<string, PersonaTrait[]>();
  for (const trait of result) profiles.set(profileKey(trait), [...(profiles.get(profileKey(trait)) ?? []), trait]);
  for (const profileTraits of profiles.values()) {
    for (const definition of groupingCatalog) {
      const matched = profileTraits.flatMap((trait) => {
        const reason = membershipReason(definition, trait);
        return reason === undefined ? [] : [{ trait, reason }];
      });
      const semanticChildren = new Set(matched.map(({ trait }) => trait.semanticKey));
      if (semanticChildren.size < definition.minimumChildren) continue;
      const parent = buildUniverseParent(
        definition,
        matched.map(({ trait }) => trait).sort((a, b) => a.traitId.localeCompare(b.traitId)),
        matched.map(({ reason }) => reason),
      );
      const previous = canonical.get(parent.traitId);
      if (previous !== undefined && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(parent)) {
        throw new TypeError(`PERSONA_CONTRADICTORY_GROUP_PARENT:${parent.traitId}`);
      }
      if (previous === undefined) {
        canonical.set(parent.traitId, parent);
        result.push(parent);
      }
    }
  }
  return result.sort((a, b) => a.traitId.localeCompare(b.traitId));
}

function numericMetric(metrics: PersonaMetrics | undefined, key: string): number {
  const value = metrics?.[key];
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function featureWorthy(trait: PersonaTrait): boolean {
  const authorities = authoritiesOf(trait);
  const sources = unique(trait.sourceModules ?? []);
  const signalCount = unique(trait.signalRefs ?? []).length;
  const evidenceCount = unique(trait.evidenceRefs ?? []).length;
  if (authorities.length === 0 && evidenceCount === 0) return false;
  if (trait.knowledgeStatus === "TO_CONFIRM" && !authorities.includes("USER_VALIDATED") && sources.length < 2) return false;
  if ((trait.children?.length ?? 0) >= 2 || authorities.includes("USER_VALIDATED")) return true;
  if (trait.temporalStatus === "PROJECT" || trait.temporalStatus === "EMERGING") return true;
  if (sources.length >= 2 || signalCount >= 2) return true;
  if (numericMetric(trait.metrics, "occurrenceCount") >= 2 || numericMetric(trait.metrics, "sharedOccurrences") >= 1) return true;
  return evidenceCount > 0 && ["ROUTINE", "PROJECT", "MOBILITY", "HOUSEHOLD_ORGANIZATION", "UNIVERSE"].includes(trait.kind);
}

function characteristicScore(trait: PersonaTrait): number {
  const authorities = authoritiesOf(trait);
  const authority = Math.max(0, ...authorities.map((value) => authorityRank[value])) * 1.8;
  const convergence = Math.min(unique(trait.sourceModules ?? []).length, 4) * 1.1
    + Math.min(authorities.length, 3) * 0.4
    + Math.min(unique(trait.signalRefs ?? []).length, 4) * 0.25;
  const temporal = temporalInterest[trait.temporalStatus ?? "UNKNOWN"];
  const specificity = trait.semanticKey.includes(".") || trait.semanticKey.startsWith("universe.") ? 1.5 : 0.8;
  const narrative = narrativeInterest[trait.kind]
    + Math.min(trait.children?.length ?? 0, 4) * 0.7
    + (trait.context === undefined ? 0 : 0.4)
    + Math.min(trait.qualifications?.length ?? 0, 2) * 0.2;
  const differencePenalty = isDifferenceTrait(trait) ? 2.5 : 0;
  return Number((authority + convergence + temporal + specificity + narrative - differencePenalty).toFixed(6));
}

function isDifferenceTrait(trait: PersonaTrait): boolean {
  return (trait.sourceModules ?? []).includes("M9_HISTORICAL_DIFFERENCE") || trait.semanticKey.startsWith("difference:");
}

function selectionReasons(trait: PersonaTrait, incumbent: boolean): readonly string[] {
  const reasons = [
    ...(authoritiesOf(trait).includes("USER_VALIDATED") ? ["USER_VALIDATED_AUTHORITY"] : []),
    ...(unique(trait.sourceModules ?? []).length >= 2 ? ["MULTI_SOURCE_CONVERGENCE"] : []),
    ...(trait.temporalStatus === "PROJECT" || trait.temporalStatus === "EMERGING" ? [`TEMPORAL_INTEREST_${trait.temporalStatus}`] : []),
    ...((trait.children?.length ?? 0) >= 2 ? ["EXPLICIT_UNIVERSE_WITH_REAL_CHILDREN"] : []),
    ...(incumbent ? ["HYSTERESIS_INCUMBENT"] : []),
    ["PROJECT", "UNIVERSE", "ROUTINE", "MOBILITY", "HOUSEHOLD_ORGANIZATION"].includes(trait.kind) ? `NARRATIVE_KIND_${trait.kind}` : "SPECIFIC_EVIDENCED_HABIT",
    "NON_REDUNDANT_SELECTION",
  ];
  return unique(reasons);
}

function explainFeaturedTrait(trait: PersonaTrait, reasonCodes: readonly string[]): PersonaTrait {
  const authorities = authoritiesOf(trait);
  const children = [...(trait.children ?? [])].sort((a, b) => a.traitId.localeCompare(b.traitId));
  const summaryCode = children.length > 0
    ? "UNIVERSE_SUPPORTED_BY_EXPLICIT_CHILD_TRAITS"
    : unique(trait.sourceModules ?? []).length > 1
      ? "TRAIT_SUPPORTED_BY_CONVERGENT_SOURCES"
      : "TRAIT_SUPPORTED_BY_AUTHORITY_AND_EVIDENCE";
  return {
    ...trait,
    explanation: {
      summaryCode,
      reasonCodes,
      authorities,
      sourceModules: unique(trait.sourceModules ?? []),
      signalRefs: unique(trait.signalRefs ?? []),
      evidenceRefs: unique(trait.evidenceRefs ?? []),
      limitations: unique(trait.limitations ?? []),
      ...(trait.metrics === undefined ? {} : { metrics: trait.metrics }),
      children,
    },
    selection: {
      featured: true,
      reasonCodes,
      methodVersion: GLOBAL_PERSONA_SELECTION_METHOD_VERSION,
    },
  };
}

function conflictsWithSelection(candidate: PersonaTrait, selected: readonly PersonaTrait[]): boolean {
  if (selected.some(({ traitId }) => traitId === candidate.traitId)) return true;
  if (candidate.groupKey !== undefined && selected.some(({ groupKey }) => groupKey === candidate.groupKey)) return true;
  const selectedIds = new Set(selected.map(({ traitId }) => traitId));
  if ((candidate.children ?? []).some(({ traitId }) => selectedIds.has(traitId))) return true;
  return selected.some((trait) => (trait.children ?? []).some(({ traitId }) => traitId === candidate.traitId));
}

export function selectFeaturedPersonaTraits(input: {
  readonly allTraits: readonly PersonaTrait[];
  readonly previousFeaturedTraits?: readonly PersonaTrait[];
  readonly maxFeatured?: number;
}): readonly PersonaTrait[] {
  const maxFeatured = input.maxFeatured ?? 8;
  if (!Number.isSafeInteger(maxFeatured) || maxFeatured < 1) throw new TypeError("PERSONA_FEATURED_MAX_INVALID");
  const canonical = new Map<string, PersonaTrait>();
  for (const trait of input.allTraits) {
    const previous = canonical.get(trait.traitId);
    if (previous !== undefined && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(trait)) {
      throw new TypeError(`PERSONA_CONTRADICTORY_TRAIT:${trait.traitId}`);
    }
    canonical.set(trait.traitId, trait);
  }
  const previousIds = new Set((input.previousFeaturedTraits ?? []).map(({ traitId }) => traitId));
  const remaining = [...canonical.values()].filter(featureWorthy).map((trait) => ({
    trait,
    score: characteristicScore(trait),
    incumbent: previousIds.has(trait.traitId),
  }));
  const selected: PersonaTrait[] = [];
  const familyCount = new Map<GlobalPersonaFamily, number>();
  let differenceSelected = false;
  while (selected.length < maxFeatured) {
    const eligible = remaining.filter(({ trait }) => !conflictsWithSelection(trait, selected) && (!isDifferenceTrait(trait) || !differenceSelected));
    if (eligible.length === 0) break;
    const next = eligible.sort((left, right) => {
      const leftPriority = left.score * (left.incumbent ? 1.1 : 1) - (familyCount.get(left.trait.family) ?? 0) * 0.65;
      const rightPriority = right.score * (right.incumbent ? 1.1 : 1) - (familyCount.get(right.trait.family) ?? 0) * 0.65;
      return rightPriority - leftPriority || left.trait.traitId.localeCompare(right.trait.traitId);
    })[0]!;
    const reasons = selectionReasons(next.trait, next.incumbent);
    selected.push(explainFeaturedTrait(next.trait, reasons));
    familyCount.set(next.trait.family, (familyCount.get(next.trait.family) ?? 0) + 1);
    if (isDifferenceTrait(next.trait)) differenceSelected = true;
    const index = remaining.indexOf(next);
    remaining.splice(index, 1);
  }
  return selected;
}

export function personaGroupingCatalog(): readonly GroupDefinition[] {
  return groupingCatalog;
}
