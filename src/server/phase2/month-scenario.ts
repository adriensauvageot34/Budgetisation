import "server-only";

import Big from "big.js";
import type { MonthForecastSnapshot } from "./month-forecast-snapshot";
import { DEFAULT_SAFETY_RESERVE, type ForecastRange } from "./month-forecast";

export type MonthInputs = Readonly<{
  safetyReserve: string;
  openingBalance: { amount: string; asOfDate: string } | null;
  benefit: { currentBalance: { amount: string; asOfDate: string } | null; expectedLoading: { amount: string; expectedDate: string } | null };
  plannedEvents: readonly { id: string; label: string; plannedCost: string; baselineDisplaced: string; parentEnvelope: string | null; plannedDate: string }[];
  confirmedObligations: readonly { componentKey: string; amount: string; dueDate: string }[];
  excludedFixedObligations: readonly string[];
  declinedConditionalObligations: readonly string[];
}>;
const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("MONTH_INPUT_OBJECT_INVALID");
  return value as Record<string, unknown>;
};
const parseMoney = (value: unknown): string => {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/u.test(value)) throw new TypeError("MONTH_INPUT_MONEY_INVALID");
  return value;
};
const parseSignedMoney = (value: unknown): string => {
  if (typeof value !== "string" || !/^-?(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/u.test(value)) throw new TypeError("MONTH_INPUT_BALANCE_INVALID");
  return value;
};
const parseDate = (value: unknown): string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)
    || Number.isNaN(Date.parse(`${value}T12:00:00Z`))) throw new TypeError("MONTH_INPUT_DATE_INVALID");
  return value;
};
const parseDated = (value: unknown, dateKey: "asOfDate" | "expectedDate", signed = false) => value === null ? null :
  { amount: signed ? parseSignedMoney(record(value).amount) : parseMoney(record(value).amount),
    [dateKey]: parseDate(record(value)[dateKey]) } as { amount: string; asOfDate: string } & { expectedDate: string };
const parseParent = (value: unknown): string | null => {
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0) throw new TypeError("MONTH_INPUT_EVENT_PARENT_INVALID");
  return value;
};
export const monthInputsSchema = { parse(value: unknown): MonthInputs {
  const input = record(value);
  const benefit = record(input.benefit);
  if (!Array.isArray(input.plannedEvents) || input.plannedEvents.length > 30
    || !Array.isArray(input.confirmedObligations) || input.confirmedObligations.length > 10) throw new TypeError("MONTH_INPUT_LIST_INVALID");
  const parseKeys = (value: unknown): string[] => {
    if (value === undefined) return []; // Existing monthly JSON remains readable.
    if (!Array.isArray(value) || value.length > 50 || value.some((key) => typeof key !== "string" || !key.startsWith("obligation:"))
      || new Set(value).size !== value.length) throw new TypeError("MONTH_INPUT_DECISION_INVALID");
    return value as string[];
  };
  return {
    safetyReserve: parseMoney(input.safetyReserve), openingBalance: parseDated(input.openingBalance, "asOfDate", true),
    benefit: { currentBalance: parseDated(benefit.currentBalance, "asOfDate"),
      expectedLoading: parseDated(benefit.expectedLoading, "expectedDate") },
    plannedEvents: input.plannedEvents.map((raw: unknown) => {
      const item = record(raw);
      if (typeof item.id !== "string" || !/^[0-9a-f-]{36}$/iu.test(item.id)
        || typeof item.label !== "string" || item.label.trim().length < 1 || item.label.length > 120) throw new TypeError("MONTH_INPUT_EVENT_INVALID");
      return { id: item.id, label: item.label.trim(), plannedCost: parseMoney(item.plannedCost),
        baselineDisplaced: parseMoney(item.baselineDisplaced),
        parentEnvelope: parseParent(item.parentEnvelope),
        plannedDate: parseDate(item.plannedDate) };
    }),
    confirmedObligations: input.confirmedObligations.map((raw: unknown) => {
      const item = record(raw);
      if (typeof item.componentKey !== "string" || !item.componentKey.startsWith("obligation:")) throw new TypeError("MONTH_INPUT_OBLIGATION_INVALID");
      return { componentKey: item.componentKey, amount: parseMoney(item.amount), dueDate: parseDate(item.dueDate) };
    }),
    excludedFixedObligations: parseKeys(input.excludedFixedObligations),
    declinedConditionalObligations: parseKeys(input.declinedConditionalObligations),
  };
}};
export const defaultMonthInputs = (): MonthInputs => ({
  safetyReserve: DEFAULT_SAFETY_RESERVE, openingBalance: null,
  benefit: { currentBalance: null, expectedLoading: null },
  plannedEvents: [], confirmedObligations: [], excludedFixedObligations: [], declinedConditionalObligations: [],
});

export type WhatIfPurchase = Readonly<{ amount: string; parentEnvelope: string | null; amountAlreadyCoveredByParentEnvelope: string }>;
export const REPLACEABLE_ENVELOPES = ["food", "health", "personal-care", "tobacco-vape", "work-coffee", "animal-care"] as const;
export const whatIfPurchaseSchema = { parse(value: WhatIfPurchase): WhatIfPurchase {
  if (value.parentEnvelope !== null && (!value.parentEnvelope || typeof value.parentEnvelope !== "string")) throw new TypeError("WHAT_IF_PARENT_INVALID");
  return { amount: parseMoney(value.amount), parentEnvelope: value.parentEnvelope,
    amountAlreadyCoveredByParentEnvelope: parseMoney(value.amountAlreadyCoveredByParentEnvelope) };
}};
const euros = (value: Big) => value.round(2).toFixed(2);
const subtract = (value: string | null, delta: Big): string | null => value === null ? null : euros(new Big(value).minus(delta));
const add = (value: string | null, delta: Big): string | null => value === null ? null : euros(new Big(value).plus(delta));

export function deriveMonthScenario(forecast: MonthForecastSnapshot, rawInputs: MonthInputs,
  rawPurchase: WhatIfPurchase | null, asOfDate: string): Readonly<{
    targetMonth: string; publicationId: string; inputs: MonthInputs;
    whatIf: { amount: string; parentEnvelope: string | null; covered: string; additiveImpact: string } | null;
    userPlannedEventDelta: string | null; undeclaredEventDelta: null;
    fixedExpenseTotal: string | null; excludedFixedTotal: string;
    economicCost: ForecastRange; freeToSpend: ForecastRange; cashPrudent: ForecastRange;
    benefitPotential: string | null;
    availableNow: { status: "AVAILABLE"; value: string; asOfDate: string } | { status: "UNAVAILABLE"; value: null; reason: string };
  }> {
  const inputs = monthInputsSchema.parse(rawInputs);
  parseDate(asOfDate);
  const purchase = rawPurchase === null ? null : whatIfPurchaseSchema.parse(rawPurchase);
  if (purchase?.parentEnvelope === null && purchase.amountAlreadyCoveredByParentEnvelope !== "0" && new Big(purchase.amountAlreadyCoveredByParentEnvelope).gt(0))
    throw new TypeError("WHAT_IF_COVERAGE_REQUIRES_PARENT");
  const parent = purchase?.parentEnvelope ? forecast.components.find((part) => part.key === purchase.parentEnvelope
    && REPLACEABLE_ENVELOPES.some((key) => key === part.key) && part.additiveGroup !== null && part.parentEnvelope === null) : null;
  if (purchase?.parentEnvelope && !parent)
    throw new TypeError("WHAT_IF_PARENT_ENVELOPE_UNKNOWN");
  if (purchase && new Big(purchase.amountAlreadyCoveredByParentEnvelope).gt(purchase.amount))
    throw new TypeError("WHAT_IF_COVERAGE_EXCEEDS_PURCHASE");
  if (purchase && parent && (parent.central === null || new Big(purchase.amountAlreadyCoveredByParentEnvelope).gt(parent.central)))
    throw new TypeError("WHAT_IF_COVERAGE_EXCEEDS_PARENT");
  const displacedByParent = new Map<string, Big>();
  for (const event of inputs.plannedEvents) {
    if (!event.plannedDate.startsWith(forecast.meta.targetMonth))
      throw new TypeError("PLANNED_EVENT_MONTH_OR_DISPLACEMENT_INVALID");
    if (new Big(event.baselineDisplaced).gt(0)) {
      const envelope = forecast.components.find((part) => part.key === event.parentEnvelope
        && REPLACEABLE_ENVELOPES.some((key) => key === part.key) && part.additiveGroup !== null && part.parentEnvelope === null);
      if (!envelope || envelope.central === null) throw new TypeError("PLANNED_EVENT_PARENT_UNKNOWN");
      const displaced = (displacedByParent.get(envelope.key) ?? new Big(0)).plus(event.baselineDisplaced);
      if (displaced.gt(envelope.central)) throw new TypeError("PLANNED_EVENT_DISPLACEMENT_EXCEEDS_PARENT");
      displacedByParent.set(envelope.key, displaced);
    }
  }
  if (parent && new Big(purchase!.amountAlreadyCoveredByParentEnvelope)
    .plus(displacedByParent.get(parent.key) ?? 0).gt(parent.central!)) throw new TypeError("WHAT_IF_PARENT_ALREADY_DISPLACED");
  for (const obligation of inputs.confirmedObligations) {
    const component = forecast.components.find((part) => part.key === obligation.componentKey);
    if (!component || component.knowledgeState !== "CONDITIONAL_UNKNOWN"
      || !/Ornikar|Alma/iu.test(component.label) || !obligation.dueDate.startsWith(forecast.meta.targetMonth))
      throw new TypeError("CONFIRMED_OBLIGATION_TARGET_INVALID");
  }
  if (new Set(inputs.confirmedObligations.map((part) => part.componentKey)).size !== inputs.confirmedObligations.length)
    throw new TypeError("CONFIRMED_OBLIGATION_DUPLICATE");
  if (inputs.declinedConditionalObligations.some((key) => inputs.confirmedObligations.some((part) => part.componentKey === key)))
    throw new TypeError("CONDITIONAL_DECISION_CONFLICT");
  for (const key of inputs.declinedConditionalObligations) {
    const component = forecast.components.find((part) => part.key === key);
    if (component && component.knowledgeState !== "CONDITIONAL_UNKNOWN") throw new TypeError("CONDITIONAL_DECISION_TARGET_INVALID");
  }
  const excludedFixedTotal = inputs.excludedFixedObligations.reduce((total, key) => {
    const component = forecast.components.find((part) => part.key === key);
    if (!component) return total; // An obsolete monthly decision must not break a newer publication.
    if (component.nature !== "CONTRACTUAL_EXPECTED" || component.additiveGroup !== "obligations"
      || component.central === null || component.low !== component.central || component.high !== component.central)
      throw new TypeError("FIXED_EXCLUSION_TARGET_INVALID");
    return total.plus(component.central);
  }, new Big(0));
  const eventDelta = inputs.plannedEvents.reduce((total, event) => total.plus(event.plannedCost).minus(event.baselineDisplaced), new Big(0));
  const confirmedObligations = inputs.confirmedObligations.reduce((total, item) => total.plus(item.amount), new Big(0));
  const rawImpact = purchase ? new Big(purchase.amount).minus(purchase.amountAlreadyCoveredByParentEnvelope) : new Big(0);
  const additiveImpact = rawImpact.gt(0) ? rawImpact : new Big(0);
  const reserveDifference = new Big(inputs.safetyReserve).minus(forecast.reserve.amount);
  const totalCostDelta = eventDelta.plus(confirmedObligations).plus(additiveImpact).minus(excludedFixedTotal);
  const spendDelta = totalCostDelta.plus(reserveDifference);
  const economicCost: ForecastRange = {
    low: add(forecast.economicCost.low, totalCostDelta), central: add(forecast.economicCost.central, totalCostDelta),
    high: add(forecast.economicCost.high, totalCostDelta),
  };
  const freeToSpend: ForecastRange = {
    low: subtract(forecast.freeToSpend.low, spendDelta), central: subtract(forecast.freeToSpend.central, spendDelta),
    high: subtract(forecast.freeToSpend.high, spendDelta),
  };
  // Prudent cash ignores unconfirmed Benefit; fuel paid is already in the published cash view.
  const cashPrudent: ForecastRange = {
    low: forecast.income.low === null || forecast.cash.grossBeforeUnconfirmedFunding.high === null ? null
      : euros(new Big(forecast.income.low).minus(forecast.cash.grossBeforeUnconfirmedFunding.high).minus(inputs.safetyReserve).minus(totalCostDelta)),
    central: forecast.income.central === null || forecast.cash.grossBeforeUnconfirmedFunding.central === null ? null
      : euros(new Big(forecast.income.central).minus(forecast.cash.grossBeforeUnconfirmedFunding.central).minus(inputs.safetyReserve).minus(totalCostDelta)),
    high: forecast.income.high === null || forecast.cash.grossBeforeUnconfirmedFunding.low === null ? null
      : euros(new Big(forecast.income.high).minus(forecast.cash.grossBeforeUnconfirmedFunding.low).minus(inputs.safetyReserve).minus(totalCostDelta)),
  };
  const benefitPotential = inputs.benefit.currentBalance === null ? null : euros(new Big(inputs.benefit.currentBalance.amount)
    .plus(inputs.benefit.expectedLoading?.amount ?? 0));
  const opening = inputs.openingBalance;
  const availableNow = opening === null
    ? { status: "UNAVAILABLE" as const, value: null, reason: "OPENING_BALANCE_UNKNOWN" }
    : opening.asOfDate !== asOfDate
      ? { status: "UNAVAILABLE" as const, value: null, reason: "CASH_MOVEMENTS_SINCE_OPENING_UNKNOWN" }
      : { status: "AVAILABLE" as const, value: euros(new Big(opening.amount).minus(inputs.safetyReserve)), asOfDate };
  return {
    targetMonth: forecast.meta.targetMonth, publicationId: forecast.meta.sourcePublicationId, inputs,
    whatIf: purchase === null ? null : { amount: purchase.amount, parentEnvelope: purchase.parentEnvelope,
      covered: purchase.amountAlreadyCoveredByParentEnvelope, additiveImpact: euros(additiveImpact) },
    userPlannedEventDelta: inputs.plannedEvents.length ? euros(eventDelta) : null,
    undeclaredEventDelta: null, fixedExpenseTotal: forecast.obligations.central === null ? null
      : euros(new Big(forecast.obligations.central).minus(excludedFixedTotal)), excludedFixedTotal: euros(excludedFixedTotal),
    economicCost, freeToSpend, cashPrudent, benefitPotential, availableNow,
  };
}

export type MonthScenario = ReturnType<typeof deriveMonthScenario>;
