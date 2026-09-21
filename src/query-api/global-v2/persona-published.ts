import type { PersonId } from "../../core/identity";
import {
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../../core/validation";
import type { MethodVersion } from "../../core/versions";
import {
  personaTraitKindCatalog,
  type PersonaMetrics,
  type PersonaProfileOutput,
  type PersonaTemporalStatus,
  type PersonaTrait,
  type PersonaTraitChild,
  type PersonaTraitKind,
} from "../../analytics/global-v2/persona-signals";

export const PERSONA_PUBLISHED_PROFILE_CONTRACT_VERSION = "persona-published-profile@v1" as const;

export type PersonaPublishedSubject = {
  readonly kind: "PERSON";
  readonly personId: PersonId;
};

export type PersonaPublishedTraitChild = {
  readonly traitId: string;
  readonly semanticKey: string;
  readonly kind: PersonaTraitKind;
  readonly temporalStatus?: PersonaTemporalStatus;
  readonly metrics?: PersonaMetrics;
};

export type PersonaPublishedTrait = {
  readonly traitId: string;
  readonly subject: PersonaPublishedSubject;
  readonly scope: "PERSONAL";
  readonly kind: PersonaTraitKind;
  readonly semanticKey: string;
  readonly temporalStatus?: PersonaTemporalStatus;
  readonly metrics?: PersonaMetrics;
  readonly qualifications?: readonly string[];
  readonly children?: readonly PersonaPublishedTraitChild[];
};

export type PersonaPublishedProfile = {
  readonly subject: PersonaPublishedSubject;
  readonly scope: "PERSONAL";
  readonly featuredTraits: readonly PersonaPublishedTrait[];
};

export type PersonaPublishedProfileOutput = {
  readonly contractVersion: typeof PERSONA_PUBLISHED_PROFILE_CONTRACT_VERSION;
  readonly methodVersion: MethodVersion;
  readonly profiles: readonly PersonaPublishedProfile[];
};

const temporalStatuses = new Set<PersonaTemporalStatus>([
  "STABLE",
  "EMERGING",
  "HISTORICAL",
  "PROJECT",
  "CHANGED",
  "UNKNOWN",
]);
const traitKinds = new Set<PersonaTraitKind>(personaTraitKindCatalog);

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${label}_INVALID`);
  return value;
}

function array<T>(value: unknown, parse: (entry: unknown, index: number) => T, label: string): readonly T[] {
  if (!Array.isArray(value)) throw new TypeError(`${label}_INVALID`);
  return value.map(parse);
}

function optional<T>(record: Readonly<Record<string, unknown>>, key: string, parse: (value: unknown) => T): T | undefined {
  return hasOwn(record, key) ? parse(record[key]) : undefined;
}

function strings(value: unknown, label: string): readonly string[] {
  const result = array(value, (entry) => text(entry, label), label);
  if (new Set(result).size !== result.length) throw new TypeError(`${label}_DUPLICATE`);
  return result;
}

function parseMetrics(value: unknown): PersonaMetrics {
  const keys = typeof value === "object" && value !== null && !Array.isArray(value) ? Object.keys(value) : [];
  const record = parseStrictRecord(value, keys, "PersonaPublishedMetrics");
  for (const [key, metric] of Object.entries(record)) {
    if (key.trim().length === 0 || typeof metric !== "string" && (typeof metric !== "number" || !Number.isFinite(metric))) {
      throw new TypeError("PERSONA_PUBLISHED_METRIC_INVALID");
    }
  }
  return record as PersonaMetrics;
}

function parseSubject(value: unknown): PersonaPublishedSubject {
  const record = parseStrictRecord(value, ["kind", "personId"], "PersonaPublishedSubject");
  parseStringLiteral(requireProperty(record, "kind", "PersonaPublishedSubject"), new Set(["PERSON"]), "PersonaPublishedSubject.kind");
  return {
    kind: "PERSON",
    personId: text(requireProperty(record, "personId", "PersonaPublishedSubject"), "PersonaPublishedSubject.personId") as PersonId,
  };
}

function parseChild(value: unknown): PersonaPublishedTraitChild {
  const record = parseStrictRecord(value, ["traitId", "semanticKey", "kind", "temporalStatus", "metrics"], "PersonaPublishedTraitChild");
  const temporalStatus = optional(record, "temporalStatus", (entry) => parseStringLiteral<PersonaTemporalStatus>(entry, temporalStatuses, "PersonaPublishedTraitChild.temporalStatus"));
  const metrics = optional(record, "metrics", parseMetrics);
  return {
    traitId: text(requireProperty(record, "traitId", "PersonaPublishedTraitChild"), "PersonaPublishedTraitChild.traitId"),
    semanticKey: text(requireProperty(record, "semanticKey", "PersonaPublishedTraitChild"), "PersonaPublishedTraitChild.semanticKey"),
    kind: parseStringLiteral<PersonaTraitKind>(requireProperty(record, "kind", "PersonaPublishedTraitChild"), traitKinds, "PersonaPublishedTraitChild.kind"),
    ...(temporalStatus === undefined ? {} : { temporalStatus }),
    ...(metrics === undefined ? {} : { metrics }),
  };
}

function parseTrait(value: unknown): PersonaPublishedTrait {
  const record = parseStrictRecord(value, ["traitId", "subject", "scope", "kind", "semanticKey", "temporalStatus", "metrics", "qualifications", "children"], "PersonaPublishedTrait");
  const temporalStatus = optional(record, "temporalStatus", (entry) => parseStringLiteral<PersonaTemporalStatus>(entry, temporalStatuses, "PersonaPublishedTrait.temporalStatus"));
  const metrics = optional(record, "metrics", parseMetrics);
  const qualifications = optional(record, "qualifications", (entry) => strings(entry, "PersonaPublishedTrait.qualifications"));
  const children = optional(record, "children", (entry) => array(entry, parseChild, "PersonaPublishedTrait.children"));
  if (children !== undefined && new Set(children.map(({ traitId }) => traitId)).size !== children.length) throw new TypeError("PERSONA_PUBLISHED_CHILD_DUPLICATE");
  return {
    traitId: text(requireProperty(record, "traitId", "PersonaPublishedTrait"), "PersonaPublishedTrait.traitId"),
    subject: parseSubject(requireProperty(record, "subject", "PersonaPublishedTrait")),
    scope: parseStringLiteral(requireProperty(record, "scope", "PersonaPublishedTrait"), new Set(["PERSONAL"]), "PersonaPublishedTrait.scope"),
    kind: parseStringLiteral<PersonaTraitKind>(requireProperty(record, "kind", "PersonaPublishedTrait"), traitKinds, "PersonaPublishedTrait.kind"),
    semanticKey: text(requireProperty(record, "semanticKey", "PersonaPublishedTrait"), "PersonaPublishedTrait.semanticKey"),
    ...(temporalStatus === undefined ? {} : { temporalStatus }),
    ...(metrics === undefined ? {} : { metrics }),
    ...(qualifications === undefined ? {} : { qualifications }),
    ...(children === undefined ? {} : { children }),
  };
}

function parseProfile(value: unknown): PersonaPublishedProfile {
  const record = parseStrictRecord(value, ["subject", "scope", "featuredTraits"], "PersonaPublishedProfile");
  const subject = parseSubject(requireProperty(record, "subject", "PersonaPublishedProfile"));
  const featuredTraits = array(requireProperty(record, "featuredTraits", "PersonaPublishedProfile"), parseTrait, "PersonaPublishedProfile.featuredTraits");
  if (new Set(featuredTraits.map(({ traitId }) => traitId)).size !== featuredTraits.length) throw new TypeError("PERSONA_PUBLISHED_TRAIT_DUPLICATE");
  if (featuredTraits.some((trait) => trait.subject.personId !== subject.personId)) throw new TypeError("PERSONA_PUBLISHED_SUBJECT_MISMATCH");
  return {
    subject,
    scope: parseStringLiteral(requireProperty(record, "scope", "PersonaPublishedProfile"), new Set(["PERSONAL"]), "PersonaPublishedProfile.scope"),
    featuredTraits,
  };
}

export function parsePersonaPublishedProfileOutput(value: unknown): PersonaPublishedProfileOutput {
  const record = parseStrictRecord(value, ["contractVersion", "methodVersion", "profiles"], "PersonaPublishedProfileOutput");
  const profiles = array(requireProperty(record, "profiles", "PersonaPublishedProfileOutput"), parseProfile, "PersonaPublishedProfileOutput.profiles");
  if (new Set(profiles.map(({ subject }) => subject.personId)).size !== profiles.length) throw new TypeError("PERSONA_PUBLISHED_PROFILE_DUPLICATE");
  return {
    contractVersion: parseStringLiteral(requireProperty(record, "contractVersion", "PersonaPublishedProfileOutput"), new Set([PERSONA_PUBLISHED_PROFILE_CONTRACT_VERSION]), "PersonaPublishedProfileOutput.contractVersion"),
    methodVersion: text(requireProperty(record, "methodVersion", "PersonaPublishedProfileOutput"), "PersonaPublishedProfileOutput.methodVersion") as MethodVersion,
    profiles,
  };
}

function projectChild(child: PersonaTraitChild): PersonaPublishedTraitChild {
  return {
    traitId: child.traitId,
    semanticKey: child.semanticKey,
    kind: child.kind,
    ...(child.temporalStatus === undefined ? {} : { temporalStatus: child.temporalStatus }),
    ...(child.metrics === undefined ? {} : { metrics: { ...child.metrics } }),
  };
}

function projectTrait(trait: PersonaTrait, personId: PersonId): PersonaPublishedTrait {
  if (trait.scope !== "PERSONAL" || trait.subject.kind !== "PERSON" || trait.subject.personId !== personId) {
    throw new TypeError("PERSONA_PUBLISHED_SOURCE_SUBJECT_MISMATCH");
  }
  return {
    traitId: trait.traitId,
    subject: { kind: "PERSON", personId },
    scope: "PERSONAL",
    kind: trait.kind,
    semanticKey: trait.semanticKey,
    ...(trait.temporalStatus === undefined ? {} : { temporalStatus: trait.temporalStatus }),
    ...(trait.metrics === undefined ? {} : { metrics: { ...trait.metrics } }),
    ...(trait.qualifications === undefined ? {} : { qualifications: [...trait.qualifications] }),
    ...(trait.children === undefined ? {} : { children: trait.children.map(projectChild) }),
  };
}

/** Projects the exhaustive engine output into the strictly presentational published contract. */
export function projectPersonaPublishedProfile(input: PersonaProfileOutput): PersonaPublishedProfileOutput {
  const projected: PersonaPublishedProfileOutput = {
    contractVersion: PERSONA_PUBLISHED_PROFILE_CONTRACT_VERSION,
    methodVersion: input.methodVersion,
    profiles: input.profiles.flatMap((profile) => {
      if (profile.scope !== "PERSONAL" || profile.subject.kind !== "PERSON") return [];
      return [{
        subject: { kind: "PERSON", personId: profile.subject.personId },
        scope: "PERSONAL" as const,
        featuredTraits: profile.featuredTraits.map((trait) => projectTrait(trait, profile.subject.personId)),
      }];
    }),
  };
  return parsePersonaPublishedProfileOutput(projected);
}
