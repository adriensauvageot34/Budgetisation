import Big from "big.js";
import type { EconomicComponentClassificationFact, EconomicComponentFact, ActivityOccurrenceCostFact, ActivityOccurrenceFact } from "../facts";
import { isCausalActivityRelation } from "../facts";
import { addMoney, compareMoney, parseMoney, type Money } from "../../core/money";
import type { MetricValue } from "../../core/history-v2";
import type { SpendingComponentInput, LocalizedAmountVisibility } from "./month-balance/types";
import { resolveLocalizedAmountVisibility } from "./month-balance/engine";

export const historySharedDoctrinesVersion = "history_shared_doctrines@v3";
const zero = parseMoney("0");

/** Explicit LifeEvent.primary_place_id only; visits never assign an Activity to a Place. */
export function historyPlaceActivityTypes(
  occurrences: readonly ActivityOccurrenceFact[],
  primaryPlaces: readonly { readonly lifeEventId: string; readonly placeId: string }[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const activityByEvent = new Map(occurrences.map((occurrence) => [String(occurrence.lifeEventId), String(occurrence.activityId)]));
  const types = new Map<string, Set<string>>();
  for (const { lifeEventId, placeId } of primaryPlaces) {
    const activityId = activityByEvent.get(lifeEventId);
    if (activityId === undefined) continue;
    const group = types.get(placeId) ?? new Set<string>();
    group.add(activityId);
    types.set(placeId, group);
  }
  return types;
}

/** Only the classification Fact resolves authority; these are exact enum projections. */
export function projectHistorySpendingComponents(
  components: readonly EconomicComponentFact[],
  classifications: readonly EconomicComponentClassificationFact[],
): readonly SpendingComponentInput[] {
  const byKey = new Map(classifications.map((fact) => [`${fact.householdId}:${fact.canonicalComponentKey}`, fact]));
  if (byKey.size !== classifications.length) throw new TypeError("Classification Fact dupliquée.");
  const maps = {
    necessity: { Indispensable: "INDISPENSABLE", Contraint: "CONSTRAINED", Optionnel: "OPTIONAL" },
    behavior: { Fixe: "FIXED", Variable: "VARIABLE" },
    lifeScope: { "Vie courante": "CURRENT_LIFE", "Hors quotidien": "OUT_OF_DAILY" },
  } as const;
  return components.map((component) => {
    const fact = byKey.get(`${component.householdId}:${component.canonicalComponentKey}`);
    const projected: { necessity?: SpendingComponentInput["necessity"]; behavior?: SpendingComponentInput["behavior"]; lifeScope?: SpendingComponentInput["lifeScope"] } = {};
    const classificationStates: NonNullable<SpendingComponentInput["classificationStates"]> = {
      necessity: fact?.necessity.status ?? "UNKNOWN",
      behavior: fact?.behavior.status ?? "UNKNOWN",
      lifeScope: fact?.lifeScope.status ?? "UNKNOWN",
    };
    for (const axis of ["necessity", "behavior", "lifeScope"] as const) {
      const resolution = fact?.[axis];
      if (resolution?.status !== "KNOWN") continue;
      const values: Readonly<Record<string, string>> = maps[axis];
      const value = resolution.value === null || !Object.hasOwn(values, resolution.value) ? undefined : values[resolution.value];
      if (value === undefined || resolution.authority === null || resolution.evidenceRefs.length === 0) {
        throw new TypeError("Classification KNOWN sans valeur/autorité/preuve admissible.");
      }
      Object.assign(projected, { [axis]: value });
    }
    return {
      componentKey: String(component.canonicalComponentKey), amount: component.net,
      ...projected, classificationStates,
      ...(component.category.kind === "resolved" ? { categoryId: String(component.category.id) } : {}),
      ...(component.subcategory.kind === "resolved" ? { subcategoryId: String(component.subcategory.id) } : {}),
      nonNegative: compareMoney(component.net, zero) >= 0,
    };
  });
}

export type MomentFinancialRelation = {
  readonly householdId: string;
  readonly momentId: string;
  readonly componentKey: string;
} & (
  | { readonly kind: "UNDEFINED"; readonly authority: "CANONICAL_MOMENT_REFERENCE" }
  | { readonly kind: "CONTEXTUAL"; readonly authority: "EXPLICIT_CANONICAL_ASSOCIATION"; readonly evidenceRefs: readonly string[] }
  | { readonly kind: "CAUSAL"; readonly authority: "CANONICAL_COMPONENT_MOMENT" | "EXPLICIT_CANONICAL_CAUSAL_LINK"; readonly evidenceRefs: readonly string[]; readonly amount: Money; readonly sourceEconomicAmount: Money }
);

/** Global §26: the canonical EconomicComponentFact Moment is a causal authority.
 * The canonical projector maps financial_economic_cost_canonical.moment_id exactly
 * to fact.moment; this is NOT an adapter for arbitrary contextual Moment references.
 * Pass whole canonical components, never month-prorated Daily allocations.
 */
export function projectCanonicalMomentRelations(components: readonly EconomicComponentFact[]): readonly MomentFinancialRelation[] {
  return components.flatMap((component) => component.moment.kind !== "resolved" ? [] : [{
    householdId: String(component.householdId), momentId: String(component.moment.id),
    componentKey: String(component.canonicalComponentKey),
    kind: "CAUSAL" as const, authority: "CANONICAL_COMPONENT_MOMENT" as const,
    evidenceRefs: [`financial_economic_cost_canonical:${component.canonicalComponentKey}:moment_id:${component.moment.id}`],
    amount: component.net, sourceEconomicAmount: component.net,
  }]);
}

/** Validate attribution across Moments BEFORE selecting the requested Moment. */
export function resolveMomentFinancialCost(input: {
  readonly householdId: string;
  readonly momentId: string;
  readonly relations: readonly MomentFinancialRelation[];
}): { readonly causalCost: MetricValue<Money>; readonly causalComponentKeys: readonly string[]; readonly causalAmounts: ReadonlyMap<string, Money>; readonly fullyAttributedComponentKeys: readonly string[] } {
  const householdRelations = input.relations.filter((relation) => relation.householdId === input.householdId);
  const relations = householdRelations.filter((relation) => relation.momentId === input.momentId);
  const requestedKeys = new Set(relations.map(({ componentKey }) => componentKey));
  const sources = new Map<string, { source: Money; byMoment: Map<string, Money> }>();
  const conflict = () => ({ causalCost: { status: "CONFLICT" as const, quality: { reasonCode: "DATA_CONFLICTING_AUTHORITIES" as const } }, causalComponentKeys: [], causalAmounts: new Map<string, Money>(), fullyAttributedComponentKeys: [] });
  const amounts = new Map<string, Money>();
  for (const relation of householdRelations.filter(({ componentKey }) => requestedKeys.has(componentKey))) {
    if (relation.kind === "CONTEXTUAL" && (relation.authority !== "EXPLICIT_CANONICAL_ASSOCIATION" || !Array.isArray(relation.evidenceRefs) || relation.evidenceRefs.length === 0 || relation.evidenceRefs.some((ref) => !ref.trim()))) {
      throw new TypeError("Une association Moment qualifiée exige une autorité explicite et ses preuves.");
    }
    if (relation.kind !== "CAUSAL") continue;
    if ((relation.authority !== "EXPLICIT_CANONICAL_CAUSAL_LINK" && relation.authority !== "CANONICAL_COMPONENT_MOMENT") || !Array.isArray(relation.evidenceRefs) || relation.evidenceRefs.length === 0 || relation.evidenceRefs.some((ref) => !ref.trim())) {
      throw new TypeError("Un coût causal Moment exige une assertion causale canonique explicite et ses preuves.");
    }
    const amount = parseMoney(relation.amount);
    const source = parseMoney(relation.sourceEconomicAmount);
    const group = sources.get(relation.componentKey) ?? { source, byMoment: new Map<string, Money>() };
    const previous = group.byMoment.get(relation.momentId);
    if (compareMoney(group.source, source) !== 0 || (previous !== undefined && compareMoney(previous, amount) !== 0)
      || (new Big(amount).gt(0) && new Big(source).lte(0)) || (new Big(amount).lt(0) && new Big(source).gte(0))
      || (relation.authority === "CANONICAL_COMPONENT_MOMENT" && compareMoney(source, amount) !== 0)) return conflict();
    group.byMoment.set(relation.momentId, amount);
    sources.set(relation.componentKey, group);
    if (relation.momentId === input.momentId) amounts.set(relation.componentKey, amount);
  }
  for (const { source, byMoment } of sources.values()) {
    const attributed = [...byMoment.values()].reduce((total, amount) => total.plus(new Big(amount).abs()), new Big(0));
    if (attributed.gt(new Big(source).abs())) return conflict();
  }
  if (amounts.size === 0) return { causalCost: { status: "UNKNOWN", quality: { reasonCode: "DATA_NO_CAUSAL_LINK" } }, causalComponentKeys: [], causalAmounts: amounts, fullyAttributedComponentKeys: [] };
  const incomplete = relations.some((relation) => relation.kind !== "CAUSAL" && !amounts.has(relation.componentKey));
  const value = [...amounts.values()].reduce(addMoney, zero);
  return {
    causalCost: incomplete
      ? { status: "PARTIAL", value, partialMeaning: "OBSERVED_ONLY", quality: { reasonCode: "DATA_PARTIAL_SOURCE" } }
      : { status: "KNOWN", value },
    causalComponentKeys: [...amounts.keys()].sort(),
    causalAmounts: amounts,
    fullyAttributedComponentKeys: [...amounts].filter(([key, amount]) => compareMoney(amount, sources.get(key)!.source) === 0).map(([key]) => key).sort(),
  };
}

/** A human expense can be displayed as wholly causal only if every component and
 * its full amount are covered. Mixed/partially attributed purchases stay unowned.
 */
export function isWhollyCausalMomentExpense(
  expense: { readonly componentKeys: readonly string[]; readonly amount: Money },
  resolved: ReturnType<typeof resolveMomentFinancialCost>,
): boolean {
  if (resolved.causalCost.status !== "KNOWN" && resolved.causalCost.status !== "PARTIAL") return false;
  const keys = new Set(expense.componentKeys);
  return keys.size > 0 && keys.size === expense.componentKeys.length
    && [...keys].every((key) => resolved.fullyAttributedComponentKeys.includes(key))
    && compareMoney([...keys].reduce<Money>((sum, key) => addMoney(sum, resolved.causalAmounts.get(key)!), zero), expense.amount) === 0;
}

/** Contextual links cannot enter this aggregate; ASSOCIATED has no current adapter. */
export function resolveHistoryActivityCost(facts: readonly ActivityOccurrenceCostFact[]): {
  readonly costKind: "CAUSAL" | "NONE";
  readonly cost: MetricValue<Money>;
} {
  const seen = new Set<string>();
  for (const fact of facts) {
    const identity = `${fact.householdId}:${fact.occurrenceId}`;
    if (seen.has(identity)) throw new TypeError("Coût Activity dupliqué par occurrence.");
    seen.add(identity);
    if (fact.evidence.some((proof) => !proof.financialLinkId || !isCausalActivityRelation(proof.relationType))
      || (fact.causalCost.availability === "known" && fact.evidence.length === 0)) {
      throw new TypeError("CAUSAL Activity exige une preuve causale.");
    }
  }
  const hasEvidence = facts.some(({ evidence }) => evidence.length > 0);
  const known = facts.filter((fact) => fact.causalCost.availability === "known");
  if (known.length === 0) return { costKind: hasEvidence ? "CAUSAL" : "NONE", cost: { status: "UNKNOWN", quality: { reasonCode: hasEvidence ? "DATA_PARTIAL_SOURCE" : "DATA_NO_CAUSAL_LINK" } } };
  const value = known.reduce((total, fact) => addMoney(total, fact.causalCost.availability === "known" ? fact.causalCost.value : zero), zero);
  return { costKind: "CAUSAL", cost: known.length === facts.length
    ? { status: "KNOWN", value }
    : { status: "PARTIAL", value, partialMeaning: "OBSERVED_ONLY", quality: { reasonCode: "COVERAGE_PARTIAL" } } };
}

/** Coverage universe: scoped economic components excluding explicit non-spatial NA. */
export function resolveHistoryPlaceFinance(components: readonly EconomicComponentFact[], placeId: string): LocalizedAmountVisibility {
  const seen = new Set<string>();
  for (const component of components) {
    if (seen.has(String(component.canonicalComponentKey))) throw new TypeError("Composante Place dupliquée.");
    seen.add(String(component.canonicalComponentKey));
  }
  const localizable = components.filter(({ canonicalPlace }) => canonicalPlace.kind !== "not_applicable");
  const authoritative = localizable.filter(({ canonicalPlace }) => canonicalPlace.kind === "resolved");
  const localized = authoritative.filter(({ canonicalPlace }) => canonicalPlace.kind === "resolved" && canonicalPlace.placeId === placeId);
  const absoluteTotal = (facts: readonly EconomicComponentFact[]) => parseMoney(facts.reduce((sum, fact) => sum.plus(new Big(fact.net).abs()), new Big(0)).toFixed());
  const visibility = resolveLocalizedAmountVisibility({
    localizedAmount: localized.reduce((sum, fact) => addMoney(sum, fact.net), zero),
    authoritativeLocalizableAbsoluteAmount: absoluteTotal(authoritative),
    allLocalizableAbsoluteAmount: absoluteTotal(localizable),
    monotoneNonNegative: localizable.every((fact) => compareMoney(fact.net, zero) >= 0),
  });
  if (localized.length > 0 || visibility.cardAmount.status === "NOT_APPLICABLE") return visibility;
  // A visit, or missing transaction-place evidence, cannot manufacture even a zero total.
  const unknown = { status: "UNKNOWN" as const, quality: { reasonCode: "DATA_NO_LOCATION_AUTHORITY" as const } };
  return { ...visibility, cardAmount: unknown, detailAmount: unknown };
}
