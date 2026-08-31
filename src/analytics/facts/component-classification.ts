import type { HouseholdId, OperationId } from "../../core/identity";
import type { CanonicalComponentKey } from "./types";

export type ComponentClassificationAxis = "NECESSITY" | "BEHAVIOR" | "LIFE_SCOPE";
export type NecessityValue = "Indispensable" | "Contraint" | "Optionnel";
export type BehaviorValue = "Fixe" | "Variable";
export type LifeScopeValue = "Vie courante" | "Hors quotidien";
export type ComponentClassificationValue = NecessityValue | BehaviorValue | LifeScopeValue;
export type ComponentClassificationAuthority =
  | "EXPLICIT_COMPONENT_OVERRIDE"
  | "AUTHORITATIVE_COMPONENT_SOURCE"
  | "OPERATION_FALLBACK";

export type ComponentAxisClassification = {
  readonly status: "KNOWN" | "UNKNOWN" | "CONFLICT";
  readonly value: ComponentClassificationValue | null;
  readonly authority: ComponentClassificationAuthority | null;
  readonly evidenceRefs: readonly string[];
  readonly provenance:
    | "EXPLICIT_USER_ASSERTION"
    | "STRUCTURED_CANONICAL_SOURCE"
    | "CONTROLLED_BACKFILL"
    | null;
};

export type EconomicComponentClassificationFact = {
  readonly fact: "fct_economic_component_classification";
  readonly householdId: HouseholdId;
  readonly canonicalComponentKey: CanonicalComponentKey;
  readonly sourceOperationId: OperationId;
  readonly necessity: ComponentAxisClassification;
  readonly behavior: ComponentAxisClassification;
  readonly lifeScope: ComponentAxisClassification;
};

export type ComponentClassificationCandidate = {
  readonly householdId: HouseholdId;
  readonly canonicalComponentKey: CanonicalComponentKey;
  readonly sourceOperationId: OperationId;
  readonly operationMixed: boolean;
  readonly sourceValues: Readonly<Record<ComponentClassificationAxis, unknown>>;
  readonly operationValues: Readonly<Record<ComponentClassificationAxis, unknown>>;
};

export type ComponentClassificationAssertion = {
  readonly canonicalComponentKey: CanonicalComponentKey;
  readonly axis: ComponentClassificationAxis;
  readonly resolution: ComponentAxisClassification;
};

const axisToProperty = {
  NECESSITY: "necessity",
  BEHAVIOR: "behavior",
  LIFE_SCOPE: "lifeScope",
} as const;

export function normalizeComponentClassificationValue(
  axis: ComponentClassificationAxis,
  value: unknown,
): ComponentClassificationValue | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (axis === "NECESSITY") {
    if (normalized === "Contrainte") return "Contraint";
    if (normalized === "Optionnelle") return "Optionnel";
    return ["Indispensable", "Contraint", "Optionnel"].includes(normalized)
      ? normalized as NecessityValue
      : null;
  }
  if (axis === "BEHAVIOR") {
    return ["Fixe", "Variable"].includes(normalized) ? normalized as BehaviorValue : null;
  }
  return ["Vie courante", "Hors quotidien"].includes(normalized)
    ? normalized as LifeScopeValue
    : null;
}

function known(
  value: ComponentClassificationValue,
  authority: ComponentClassificationAuthority,
  evidenceRef: string,
): ComponentAxisClassification {
  return {
    status: "KNOWN",
    value,
    authority,
    evidenceRefs: [evidenceRef],
    provenance: "STRUCTURED_CANONICAL_SOURCE",
  };
}

const unknown: ComponentAxisClassification = {
  status: "UNKNOWN",
  value: null,
  authority: null,
  evidenceRefs: [],
  provenance: null,
};

export function resolveEconomicComponentClassifications(input: {
  readonly candidates: readonly ComponentClassificationCandidate[];
  readonly assertions: readonly ComponentClassificationAssertion[];
}): readonly EconomicComponentClassificationFact[] {
  const assertionByKey = new Map(input.assertions.map((assertion) => [
    `${assertion.canonicalComponentKey}:${assertion.axis}`,
    assertion.resolution,
  ]));
  const operationProfiles = new Map<string, Readonly<Record<ComponentClassificationAxis, {
    readonly knownValues: ReadonlySet<ComponentClassificationValue>;
    readonly hasUnknown: boolean;
  }>>>();
  for (const candidate of input.candidates) {
    if (operationProfiles.has(candidate.sourceOperationId)) continue;
    const siblings = input.candidates.filter(({ sourceOperationId }) =>
      sourceOperationId === candidate.sourceOperationId);
    operationProfiles.set(candidate.sourceOperationId, Object.fromEntries(
      (["NECESSITY", "BEHAVIOR", "LIFE_SCOPE"] as const).map((axis) => {
        const values = siblings.map(({ sourceValues }) =>
          normalizeComponentClassificationValue(axis, sourceValues[axis]));
        return [axis, {
          knownValues: new Set(values.filter((value): value is ComponentClassificationValue => value !== null)),
          hasUnknown: values.some((value) => value === null),
        }];
      }),
    ) as unknown as Readonly<Record<ComponentClassificationAxis, {
      readonly knownValues: ReadonlySet<ComponentClassificationValue>;
      readonly hasUnknown: boolean;
    }>>);
  }

  return input.candidates.map((candidate) => {
    const profile = operationProfiles.get(candidate.sourceOperationId)!;
    const resolutions = Object.fromEntries(
      (["NECESSITY", "BEHAVIOR", "LIFE_SCOPE"] as const).map((axis) => {
        const assertion = assertionByKey.get(`${candidate.canonicalComponentKey}:${axis}`);
        if (assertion !== undefined) return [axisToProperty[axis], assertion];
        const sourceValue = normalizeComponentClassificationValue(axis, candidate.sourceValues[axis]);
        if (sourceValue !== null) {
          return [axisToProperty[axis], known(
            sourceValue,
            "AUTHORITATIVE_COMPONENT_SOURCE",
            `${candidate.canonicalComponentKey}:${axis}`,
          )];
        }
        const axisMixed = profile[axis].knownValues.size > 1;
        const fallbackAllowed = !axisMixed && (!candidate.operationMixed || !profile[axis].hasUnknown);
        const operationValue = normalizeComponentClassificationValue(axis, candidate.operationValues[axis]);
        return [axisToProperty[axis], fallbackAllowed && operationValue !== null
          ? known(operationValue, "OPERATION_FALLBACK", `operation:${candidate.sourceOperationId}:${axis}`)
          : unknown];
      }),
    ) as Pick<EconomicComponentClassificationFact, "necessity" | "behavior" | "lifeScope">;
    return {
      fact: "fct_economic_component_classification",
      householdId: candidate.householdId,
      canonicalComponentKey: candidate.canonicalComponentKey,
      sourceOperationId: candidate.sourceOperationId,
      ...resolutions,
    };
  });
}
