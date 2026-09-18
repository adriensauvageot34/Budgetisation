import type { EconomicComponentFact } from "../facts";
import type { GlobalKnowledgeValue } from "../../core/global-v2";
import { addMoney, parseMoney, type Money } from "../../core/money";
import type { LocalDate } from "../../core/time";

export type GlobalSpentDuringWindow = Readonly<{
  status: "KNOWN" | "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE";
  value?: Money;
  components: readonly Readonly<{ componentKey: string; amount: Money }>[];
}>;

/**
 * Shared temporal-spend primitive. It uses authoritative economic timing only;
 * proximity to an event never creates causal ownership.
 */
export function resolveGlobalSpentDuringWindow(input: Readonly<{
  householdId: string;
  startDate?: LocalDate;
  endDate?: LocalDate;
  temporalPrecision: "DAY" | "INSTANT" | "UNKNOWN";
  facts: readonly EconomicComponentFact[];
}>): GlobalSpentDuringWindow {
  if (input.startDate === undefined || input.endDate === undefined || input.temporalPrecision === "UNKNOWN") return { status: "UNKNOWN", components: [] };
  if (input.startDate === input.endDate && input.temporalPrecision !== "INSTANT") return { status: "NOT_APPLICABLE", components: [] };
  if (input.temporalPrecision === "INSTANT") return { status: "UNKNOWN", components: [] };

  const amounts = new Map<string, Money>();
  let unresolved = false;
  for (const fact of input.facts) {
    if (String(fact.householdId) !== input.householdId) continue;
    if (fact.economicTiming.kind === "unknown" || fact.economicTiming.kind === "conflict") { unresolved = true; continue; }
    if (fact.economicTiming.kind === "partial") unresolved = true;
    for (const segment of fact.economicTiming.segments) {
      if (segment.timingState !== "known" || segment.periodStart === null || segment.periodEnd === null) { unresolved = true; continue; }
      const intersects = segment.periodStart <= input.endDate && segment.periodEnd >= input.startDate;
      if (!intersects) continue;
      if (segment.periodStart < input.startDate || segment.periodEnd > input.endDate) { unresolved = true; continue; }
      const key = String(fact.canonicalComponentKey);
      amounts.set(key, addMoney(amounts.get(key) ?? parseMoney("0"), segment.amount));
    }
  }
  const components = [...amounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([componentKey, amount]) => ({ componentKey, amount }));
  const value = components.reduce((sum, component) => addMoney(sum, component.amount), parseMoney("0"));
  if (!unresolved) return { status: "KNOWN", value, components };
  return components.length > 0 ? { status: "PARTIAL", value, components } : { status: "UNKNOWN", components: [] };
}

export function spentDuringKnowledgeValue(window: GlobalSpentDuringWindow): GlobalKnowledgeValue<Money> {
  if (window.status === "KNOWN") return { status: "KNOWN", value: window.value ?? parseMoney("0") };
  if (window.status === "PARTIAL") return { status: "PARTIAL", value: window.value ?? parseMoney("0"), partialMeaning: "OBSERVED_ONLY", partialReasons: ["MISSING_INTERVALS"] };
  return { status: window.status };
}
