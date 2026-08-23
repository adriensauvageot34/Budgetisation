import type { EconomicComponentFact } from "./types";

export type CanonicalStructurePartition = {
  readonly key: string;
  readonly label: string;
  readonly facts: readonly EconomicComponentFact[];
  readonly undetermined: boolean;
};

function assertExhaustive(
  source: readonly EconomicComponentFact[],
  partitions: readonly CanonicalStructurePartition[],
): void {
  const sourceKeys = source.map(({ canonicalComponentKey }) => canonicalComponentKey).sort();
  const partitionKeys = partitions.flatMap(({ facts }) => facts.map(({ canonicalComponentKey }) => canonicalComponentKey)).sort();
  if (sourceKeys.length !== partitionKeys.length || sourceKeys.some((key, index) => key !== partitionKeys[index])) {
    throw new TypeError("La partition Structure n'est pas exhaustive et exclusive.");
  }
}

export function partitionEconomicComponentsForStructure(
  facts: readonly EconomicComponentFact[],
  dimension: "category" | "fixed_variable" | "life_context",
): readonly CanonicalStructurePartition[] {
  const keyFor = (fact: EconomicComponentFact): string => {
    if (dimension === "category") {
      return fact.category.kind === "resolved" ? fact.category.id : "À déterminer";
    }
    const value = dimension === "fixed_variable" ? fact.behavior : fact.lifeScope;
    const allowed = dimension === "fixed_variable"
      ? new Set(["Fixe", "Variable"])
      : new Set(["Vie courante", "Hors quotidien"]);
    return value.kind === "resolved" && allowed.has(value.value) ? value.value : "À déterminer";
  };
  const keys = dimension === "fixed_variable"
    ? ["Fixe", "Variable"]
    : dimension === "life_context"
      ? ["Vie courante", "Hors quotidien"]
      : [...new Set(facts.map(keyFor).filter((key) => key !== "À déterminer"))].sort();
  if (facts.some((fact) => keyFor(fact) === "À déterminer")) keys.push("À déterminer");
  const partitions = keys.map((key) => ({
    key,
    label: key,
    facts: facts.filter((fact) => keyFor(fact) === key),
    undetermined: key === "À déterminer",
  }));
  assertExhaustive(facts, partitions);
  return partitions;
}
