import { createHash } from "node:crypto";

import {
  historyV2PolicyRegistry,
  parseFactsHash,
  type FactsHash,
} from "../../core/history-v2";
import type { Brand, HouseholdId } from "../../core/identity";
import type { YearMonth } from "../../core/time";

export const factsHashPolicyVersion = historyV2PolicyRegistry.facts_hash;

export type FactsHashScalar = string | number | boolean | null;
export type FactsHashValue =
  | FactsHashScalar
  | readonly FactsHashValue[]
  | { readonly [key: string]: FactsHashValue };

export type FactsHashFact = {
  readonly factType: string;
  readonly identity: string;
  readonly value: FactsHashValue;
};

export type HashDependency = {
  readonly dependencyId: string;
  readonly dependencyHash: string;
};

export type ResourceInputHash = Brand<string, "HistoryV2ResourceInputHash">;
export type ArtifactInputHash = Brand<string, "HistoryV2ArtifactInputHash">;

export type PublicationFactsInput = {
  readonly householdId: HouseholdId;
  readonly month: YearMonth;
  readonly facts: readonly FactsHashFact[];
  readonly dependencies?: readonly HashDependency[];
};

export type PublicationFactsClosure = {
  /** Diagnostic label only. It deliberately does not participate in the digest. */
  readonly closureId: string;
  readonly facts: readonly FactsHashFact[];
  readonly dependencies?: readonly HashDependency[];
};

export type HistoryV2PublicationFactsInput = {
  readonly householdId: HouseholdId;
  readonly month: YearMonth;
  /**
   * Transitive, de-duplicated union for both shared artifacts, all 15 resources,
   * every reachable drill-down and their real historical dependencies.
   */
  readonly closures: readonly PublicationFactsClosure[];
};

export type InternalDependencyHashInput = {
  readonly identity: string;
  readonly facts: readonly FactsHashFact[];
  readonly dependencies?: readonly HashDependency[];
};

const forbiddenMetadataKeys = new Set([
  "generatedAt",
  "publicationId",
  "revision",
  "policyVersions",
  "contractVersion",
]);

function requireNonEmpty(value: string, fieldName: string): string {
  if (value.trim().length === 0) {
    throw new TypeError(`${fieldName} doit être une chaîne non vide.`);
  }
  return value;
}

function canonicalNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError("factsHash refuse les nombres non finis.");
  }
  return Object.is(value, -0) ? 0 : value;
}

function canonicalValue(value: FactsHashValue): unknown {
  if (value === null) return ["null"];
  switch (typeof value) {
    case "string":
      return ["string", value];
    case "boolean":
      return ["boolean", value];
    case "number":
      return ["number", canonicalNumber(value)];
    case "object":
      if (Array.isArray(value)) {
        return ["array", value.map(canonicalValue)];
      }
      if (
        Object.getPrototypeOf(value) !== Object.prototype
        && Object.getPrototypeOf(value) !== null
      ) {
        throw new TypeError("factsHash accepte uniquement des objets JSON stricts.");
      }
      const record = value as { readonly [key: string]: FactsHashValue };
      return [
        "object",
        Object.keys(record)
          .sort()
          .map((key) => {
            if (forbiddenMetadataKeys.has(key)) {
              throw new TypeError(
                `factsHash interdit la metadata volatile ${key}.`,
              );
            }
            const child = record[key];
            if (child === undefined) {
              throw new TypeError("factsHash refuse les propriétés undefined.");
            }
            return [key, canonicalValue(child)];
          }),
      ];
    default:
      throw new TypeError("factsHash accepte uniquement des valeurs JSON strictes.");
  }
}

function sortedFacts(facts: readonly FactsHashFact[]) {
  const parsed = facts.map((fact) => ({
    factType: requireNonEmpty(fact.factType, "FactsHashFact.factType"),
    identity: requireNonEmpty(fact.identity, "FactsHashFact.identity"),
    value: canonicalValue(fact.value),
  }));
  const deduplicated = new Map<string, (typeof parsed)[number]>();
  for (const fact of parsed) {
    const key = `${fact.factType}\u0000${fact.identity}`;
    const current = deduplicated.get(key);
    if (current !== undefined && JSON.stringify(current.value) !== JSON.stringify(fact.value)) {
      throw new TypeError("La fermeture factsHash contient deux valeurs pour le même fait stable.");
    }
    deduplicated.set(key, fact);
  }
  return [...deduplicated.values()].sort((left, right) =>
    left.factType.localeCompare(right.factType)
    || left.identity.localeCompare(right.identity));
}

function sortedDependencies(
  dependencies: readonly HashDependency[],
) {
  const parsed = dependencies.map((dependency) => ({
    dependencyId: requireNonEmpty(
      dependency.dependencyId,
      "FactsHashDependency.dependencyId",
    ),
    dependencyHash: parseFactsHash(dependency.dependencyHash),
  }));
  const deduplicated = new Map<string, (typeof parsed)[number]>();
  for (const dependency of parsed) {
    const current = deduplicated.get(dependency.dependencyId);
    if (current !== undefined && current.dependencyHash !== dependency.dependencyHash) {
      throw new TypeError("La fermeture factsHash contient deux digests pour la même dépendance.");
    }
    deduplicated.set(dependency.dependencyId, dependency);
  }
  return [...deduplicated.values()].sort((left, right) =>
    left.dependencyId.localeCompare(right.dependencyId));
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function canonicalPublicationFacts(
  input: PublicationFactsInput,
): string {
  return JSON.stringify({
    format: "history-v2-publication-facts@v1",
    householdId: input.householdId,
    month: input.month,
    facts: sortedFacts(input.facts),
    dependencies: sortedDependencies(input.dependencies ?? []),
  });
}

export function computePublicationFactsHash(
  input: PublicationFactsInput,
): FactsHash {
  return parseFactsHash(sha256(canonicalPublicationFacts(input)));
}

export function computeHistoryV2PublicationFactsHash(
  input: HistoryV2PublicationFactsInput,
): FactsHash {
  for (const closure of input.closures) {
    requireNonEmpty(closure.closureId, "PublicationFactsClosure.closureId");
  }
  return computePublicationFactsHash({
    householdId: input.householdId,
    month: input.month,
    facts: input.closures.flatMap(({ facts }) => facts),
    dependencies: input.closures.flatMap(({ dependencies }) => dependencies ?? []),
  });
}

function canonicalInternalInputs(
  kind: "resource" | "artifact",
  input: InternalDependencyHashInput,
): string {
  return JSON.stringify({
    format: `history-v2-${kind}-inputs@v1`,
    identity: requireNonEmpty(input.identity, `${kind}InputHash.identity`),
    facts: sortedFacts(input.facts),
    dependencies: sortedDependencies(input.dependencies ?? []),
  });
}

export function computeResourceInputHash(
  input: InternalDependencyHashInput,
): ResourceInputHash {
  return parseResourceInputHash(sha256(canonicalInternalInputs("resource", input)));
}

export function parseResourceInputHash(value: unknown): ResourceInputHash {
  return parseFactsHash(value) as unknown as ResourceInputHash;
}

export function parseArtifactInputHash(value: unknown): ArtifactInputHash {
  return parseFactsHash(value) as unknown as ArtifactInputHash;
}

export function computeArtifactInputHash(
  input: InternalDependencyHashInput,
): ArtifactInputHash {
  return parseArtifactInputHash(sha256(canonicalInternalInputs("artifact", input)));
}
