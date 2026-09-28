import "server-only";

import Big from "big.js";
import type { MonthForecastSnapshot } from "./month-forecast-snapshot";
import { DEFAULT_SAFETY_RESERVE, type ForecastRange } from "./month-forecast";
import type { StatisticalComponent } from "./month-reference";
import type { PlannedExpenseScenarioEntry, PlannedBaselineKey } from "./planned-expenses";

export type MonthInputs = Readonly<{
  safetyReserve: string;
  openingBalance: { amount: string; asOfDate: string } | null;
  benefit: { currentBalance: { amount: string; asOfDate: string } | null; expectedLoading: { amount: string; expectedDate: string } | null };
  plannedEvents: readonly { id: string; label: string; plannedCost: string; baselineDisplaced: string; parentEnvelope: string | null; plannedDate: string }[];
  confirmedObligations: readonly { componentKey: string; amount: string; dueDate: string }[];
  excludedFixedObligations: readonly string[];
  declinedConditionalObligations: readonly string[];
  declaredResources: Readonly<Partial<Record<"benefit:swile" | "benefit:edenred", string>>>;
  resourceOverrides: Readonly<Record<string, string>>;
  fixedAmountOverrides: Readonly<Record<string, { amount: string; dueDate: string | null; reason: "MONTH_EXCEPTION" }>>;
  declaredOutflows: readonly { id: string; label: string; amount: string; dueDate: string | null; kind: "SAVINGS" }[];
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
  const legacyPlannedEvents = input.plannedEvents ?? [];
  if (!Array.isArray(legacyPlannedEvents) || legacyPlannedEvents.length > 30
    || !Array.isArray(input.confirmedObligations) || input.confirmedObligations.length > 10) throw new TypeError("MONTH_INPUT_LIST_INVALID");
  const parseKeys = (value: unknown): string[] => {
    if (value === undefined) return []; // Existing monthly JSON remains readable.
    if (!Array.isArray(value) || value.length > 50 || value.some((key) => typeof key !== "string" || !key.startsWith("obligation:"))
      || new Set(value).size !== value.length) throw new TypeError("MONTH_INPUT_DECISION_INVALID");
    return value as string[];
  };
  const parseAmounts = (value: unknown, allowed: (key: string) => boolean): Record<string, string> => {
    if (value === undefined) return {};
    const entries = Object.entries(record(value));
    if (entries.length > 30 || entries.some(([key]) => !allowed(key))) throw new TypeError("MONTH_INPUT_RESOURCE_KEY_INVALID");
    return Object.fromEntries(entries.map(([key, amount]) => [key, parseMoney(amount)]));
  };
  const fixedAmountOverrides = input.fixedAmountOverrides === undefined ? {} : Object.fromEntries(
    Object.entries(record(input.fixedAmountOverrides)).map(([key, raw]) => {
      if (!key.startsWith("obligation:")) throw new TypeError("MONTH_INPUT_FIXED_OVERRIDE_KEY_INVALID");
      const item = record(raw);
      if (item.reason !== "MONTH_EXCEPTION") throw new TypeError("MONTH_INPUT_FIXED_OVERRIDE_REASON_INVALID");
      return [key, { amount: parseMoney(item.amount), dueDate: item.dueDate === null ? null : parseDate(item.dueDate),
        reason: "MONTH_EXCEPTION" as const }];
    }));
  if (Object.keys(fixedAmountOverrides).length > 30) throw new TypeError("MONTH_INPUT_FIXED_OVERRIDE_LIMIT");
  const rawOutflows = input.declaredOutflows ?? [];
  if (!Array.isArray(rawOutflows) || rawOutflows.length > 20) throw new TypeError("MONTH_INPUT_DECLARED_OUTFLOWS_INVALID");
  return {
    safetyReserve: parseMoney(input.safetyReserve), openingBalance: parseDated(input.openingBalance, "asOfDate", true),
    benefit: { currentBalance: parseDated(benefit.currentBalance, "asOfDate"),
      expectedLoading: parseDated(benefit.expectedLoading, "expectedDate") },
    plannedEvents: legacyPlannedEvents.map((raw: unknown) => {
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
    declaredResources: parseAmounts(input.declaredResources, (key) => key === "benefit:swile" || key === "benefit:edenred"),
    resourceOverrides: parseAmounts(input.resourceOverrides, (key) => key.startsWith("income:")
      || key === "benefit:swile" || key === "benefit:edenred"),
    fixedAmountOverrides,
    declaredOutflows: rawOutflows.map((raw: unknown) => {
      const item = record(raw);
      if (typeof item.id !== "string" || !/^[0-9a-f-]{36}$/iu.test(item.id)
        || typeof item.label !== "string" || item.label.trim().length < 1 || item.label.length > 120
        || item.kind !== "SAVINGS") throw new TypeError("MONTH_INPUT_DECLARED_OUTFLOW_INVALID");
      return { id: item.id, label: item.label.trim(), amount: parseMoney(item.amount),
        dueDate: item.dueDate === null ? null : parseDate(item.dueDate), kind: "SAVINGS" as const };
    }),
  };
}};
export const defaultMonthInputs = (): MonthInputs => ({
  safetyReserve: DEFAULT_SAFETY_RESERVE, openingBalance: null,
  benefit: { currentBalance: null, expectedLoading: null },
  plannedEvents: [], confirmedObligations: [], excludedFixedObligations: [], declinedConditionalObligations: [],
  declaredResources: {}, resourceOverrides: {}, fixedAmountOverrides: {}, declaredOutflows: [],
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

type PlanResource = Readonly<{ key: string; label: string; amount: string; sourceAmount: string | null;
  provenance: "SNAPSHOT" | "USER_DECLARED" | "MONTH_OVERRIDE"; pocket: "BANK_CASH" | "MEAL_BENEFIT" }>;
type PlanOutflow = Readonly<{ key: string; label: string; amount: string; group: string;
  date: string | null; dateCertainty: "DECLARED" | "HISTORICAL_ESTIMATE" | "UNKNOWN";
  provenance: "SNAPSHOT" | "USER_DECLARED" | "MONTH_OVERRIDE"; kind: "FIXED" | "INSTALLMENT" | "SAVINGS" }>;
export type MonthEconomicPlan = Readonly<{ resources: readonly PlanResource[]; salaryCash: string; mealBenefits: string;
  economicResources: string; certainOutflows: { items: readonly PlanOutflow[];
    groups: readonly { label: string; total: string; items: readonly PlanOutflow[] }[];
    total: string; excludedKeys: readonly string[] };
  afterCertainOutflows: string; necessaryVariables: { items: readonly StatisticalComponent[]; total: ForecastRange };
  flexibleVariables: { items: readonly StatisticalComponent[]; total: ForecastRange };
  scenarios: { lowConsumption: string; central: string; highConsumption: string };
  plannedExpenses: { grossCost: string; plannedGross: string; declaredRealizedGross: string;
    netImpact: ForecastRange; absorbedByBaseline: ForecastRange };
  automaticEventProvision: "0.00"; declaredEventImpact: string }>;

const outflowGroup = (label: string): string => /Nexity|EDF|eau|loyer|veolia/iu.test(label) ? "Maison"
  : /SFR/iu.test(label) ? "Télécom" : /Pacifica/iu.test(label) ? "Assurances"
    : /Crédit Agricole/iu.test(label) ? "Banque" : "Abonnements";

function deriveEconomicPlan(forecast: MonthForecastSnapshot, inputs: MonthInputs,
  plannedExpenses: readonly PlannedExpenseScenarioEntry[]): MonthEconomicPlan | null {
  const reference = forecast.referencePlan;
  if (!reference) return null; // Older snapshots remain readable until their normal republication.
  const incomeKeys = [
    ["income:Digital Learning Contest", "Salaire Adrien"],
    ["income:Promotrans", "Salaire Manon"],
  ] as const;
  const resources: PlanResource[] = [];
  for (const [key, label] of incomeKeys) {
    const source = forecast.income.components.find((part) => part.key === key);
    if (!source || source.central === null) return null;
    resources.push({ key, label, amount: inputs.resourceOverrides[key] ?? source.central, sourceAmount: source.central,
      provenance: inputs.resourceOverrides[key] === undefined ? "SNAPSHOT" : "MONTH_OVERRIDE", pocket: "BANK_CASH" });
  }
  for (const [key, label] of [["benefit:swile", "Swile"], ["benefit:edenred", "Edenred"]] as const) {
    const declared = inputs.declaredResources[key];
    if (declared === undefined) return null;
    resources.push({ key, label, amount: inputs.resourceOverrides[key] ?? declared, sourceAmount: declared,
      provenance: inputs.resourceOverrides[key] === undefined ? "USER_DECLARED" : "MONTH_OVERRIDE", pocket: "MEAL_BENEFIT" });
  }
  if (Object.keys(inputs.resourceOverrides).some((key) => !resources.some((resource) => resource.key === key)))
    throw new TypeError("RESOURCE_OVERRIDE_TARGET_INVALID");
  const salaryCash = resources.filter((item) => item.pocket === "BANK_CASH")
    .reduce((sum, item) => sum.plus(item.amount), new Big(0));
  const mealBenefits = resources.filter((item) => item.pocket === "MEAL_BENEFIT")
    .reduce((sum, item) => sum.plus(item.amount), new Big(0));
  const items: PlanOutflow[] = [];
  for (const component of forecast.components) {
    if (component.nature !== "CONTRACTUAL_EXPECTED" || component.additiveGroup !== "obligations" || component.central === null
      || inputs.excludedFixedObligations.includes(component.key)) continue;
    const override = inputs.fixedAmountOverrides[component.key];
    if (override?.dueDate && !override.dueDate.startsWith(forecast.meta.targetMonth))
      throw new TypeError("FIXED_OVERRIDE_MONTH_INVALID");
    const estimated = reference.estimatedDays[component.key];
    const day = estimated?.day;
    const estimatedDate = day ? `${forecast.meta.targetMonth}-${String(day).padStart(2, "0")}` : null;
    items.push({ key: component.key, label: component.label, amount: override?.amount ?? component.central,
      group: outflowGroup(component.label), date: override?.dueDate ?? estimatedDate,
      dateCertainty: override?.dueDate ? "DECLARED" : estimatedDate ? "HISTORICAL_ESTIMATE" : "UNKNOWN",
      provenance: override ? "MONTH_OVERRIDE" : "SNAPSHOT", kind: "FIXED" });
  }
  if (Object.keys(inputs.fixedAmountOverrides).some((key) => !forecast.components.some((part) => part.key === key
    && part.nature === "CONTRACTUAL_EXPECTED" && part.additiveGroup === "obligations" && part.central !== null)))
    throw new TypeError("FIXED_OVERRIDE_TARGET_INVALID");
  for (const obligation of inputs.confirmedObligations) {
    const component = forecast.components.find((part) => part.key === obligation.componentKey);
    items.push({ key: obligation.componentKey, label: component?.label ?? "Échéance confirmée", amount: obligation.amount,
      group: "Permis", date: obligation.dueDate, dateCertainty: "DECLARED", provenance: "USER_DECLARED", kind: "INSTALLMENT" });
  }
  for (const outflow of inputs.declaredOutflows) {
    if (outflow.dueDate && !outflow.dueDate.startsWith(forecast.meta.targetMonth))
      throw new TypeError("DECLARED_OUTFLOW_MONTH_INVALID");
    items.push({ key: outflow.id, label: outflow.label, amount: outflow.amount, group: "Épargne",
      date: outflow.dueDate, dateCertainty: outflow.dueDate ? "DECLARED" : "UNKNOWN",
      provenance: "USER_DECLARED", kind: "SAVINGS" });
  }
  const certainOutflows = items.reduce((sum, item) => sum.plus(item.amount), new Big(0));
  const groups = [...new Set(items.map((item) => item.group))].map((label) => {
    const groupItems = items.filter((item) => item.group === label);
    return { label, total: euros(groupItems.reduce((sum, item) => sum.plus(item.amount), new Big(0))), items: groupItems };
  });
  const baselines = new Map<PlannedBaselineKey, Big>();
  let extra = new Big(0);
  let plannedGross = new Big(0);
  let declaredRealizedGross = new Big(0);
  for (const expense of plannedExpenses) {
    for (const item of expense.costItems) {
      const amount = new Big(item.amount);
      if (item.baselineKey === null) extra = extra.plus(amount);
      else baselines.set(item.baselineKey, (baselines.get(item.baselineKey) ?? new Big(0)).plus(amount));
      if (expense.status === "PLANNED") plannedGross = plannedGross.plus(amount);
      else declaredRealizedGross = declaredRealizedGross.plus(amount);
    }
  }
  const gross = plannedGross.plus(declaredRealizedGross);
  const baselinePart = (key: PlannedBaselineKey) => [...reference.necessary, ...reference.flexible]
    .find((part) => part.key === key);
  const plannedImpact = (scenario: "low" | "central" | "high") => {
    let impact = extra;
    for (const [key, amount] of baselines) {
      const available = baselinePart(key)?.[scenario];
      if (available === null || available === undefined) throw new TypeError(`PLANNED_EXPENSE_BASELINE_MISSING:${key}`);
      const excess = amount.minus(available);
      if (excess.gt(0)) impact = impact.plus(excess);
    }
    return impact;
  };
  const lowImpact = plannedImpact("low");
  const centralImpact = plannedImpact("central");
  const highImpact = plannedImpact("high");
  const economicResources = salaryCash.plus(mealBenefits);
  const afterCertain = economicResources.minus(certainOutflows);
  const necessary = reference.necessaryTotal;
  const flexible = reference.flexibleTotal;
  const lowConsumption = afterCertain.minus(necessary.low!).minus(flexible.low!).minus(lowImpact);
  const central = afterCertain.minus(necessary.central!).minus(flexible.central!).minus(centralImpact);
  const highConsumption = afterCertain.minus(necessary.high!).minus(flexible.high!).minus(highImpact);
  return { resources, salaryCash: euros(salaryCash), mealBenefits: euros(mealBenefits), economicResources: euros(economicResources),
    certainOutflows: { items, groups, total: euros(certainOutflows), excludedKeys: inputs.excludedFixedObligations },
    afterCertainOutflows: euros(afterCertain), necessaryVariables: { items: reference.necessary, total: necessary },
    flexibleVariables: { items: reference.flexible, total: flexible },
    scenarios: { lowConsumption: euros(lowConsumption), central: euros(central), highConsumption: euros(highConsumption) },
    plannedExpenses: { grossCost: euros(gross), plannedGross: euros(plannedGross), declaredRealizedGross: euros(declaredRealizedGross),
      netImpact: { low: euros(lowImpact), central: euros(centralImpact), high: euros(highImpact) },
      absorbedByBaseline: { low: euros(gross.minus(lowImpact)), central: euros(gross.minus(centralImpact)),
        high: euros(gross.minus(highImpact)) } },
    automaticEventProvision: "0.00", declaredEventImpact: euros(centralImpact) };
}

export function deriveMonthScenario(forecast: MonthForecastSnapshot, rawInputs: MonthInputs,
  rawPurchase: WhatIfPurchase | null, asOfDate: string,
  plannedExpenses: readonly PlannedExpenseScenarioEntry[] = []): Readonly<{
    targetMonth: string; publicationId: string; inputs: MonthInputs;
    whatIf: { amount: string; parentEnvelope: string | null; covered: string; additiveImpact: string } | null;
    userPlannedEventDelta: string | null; undeclaredEventDelta: null;
    fixedExpenseTotal: string | null; excludedFixedTotal: string;
    economicPlan: MonthEconomicPlan | null;
    economicCost: ForecastRange; freeToSpend: ForecastRange; cashPrudent: ForecastRange;
    benefitPotential: string | null;
    availableNow: { status: "AVAILABLE"; value: string; asOfDate: string } | { status: "UNAVAILABLE"; value: null; reason: string };
  }> {
  const inputs = monthInputsSchema.parse(rawInputs);
  if (inputs.plannedEvents.length !== 0) throw new TypeError("LEGACY_PLANNED_EVENTS_CUTOVER_REQUIRED");
  if (new Set(plannedExpenses.map((item) => item.id)).size !== plannedExpenses.length
    || plannedExpenses.some((item) => item.targetMonth !== forecast.meta.targetMonth
      || (item.status !== "PLANNED" && item.status !== "DECLARED_REALIZED")))
    throw new TypeError("PLANNED_EXPENSE_SCENARIO_INPUT_INVALID");
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
  for (const obligation of inputs.confirmedObligations) {
    const component = forecast.components.find((part) => part.key === obligation.componentKey);
    if (!component || component.knowledgeState !== "CONDITIONAL_UNKNOWN"
      || !/Ornikar|Alma/iu.test(component.label) || !obligation.dueDate.startsWith(forecast.meta.targetMonth))
      throw new TypeError("CONFIRMED_OBLIGATION_TARGET_INVALID");
  }
  if (new Set(inputs.confirmedObligations.map((part) => part.componentKey)).size !== inputs.confirmedObligations.length)
    throw new TypeError("CONFIRMED_OBLIGATION_DUPLICATE");
  for (const [key, override] of Object.entries(inputs.fixedAmountOverrides)) {
    if (!forecast.components.some((part) => part.key === key && part.nature === "CONTRACTUAL_EXPECTED"
      && part.additiveGroup === "obligations" && part.central !== null)
      || (override.dueDate !== null && !override.dueDate.startsWith(forecast.meta.targetMonth)))
      throw new TypeError("FIXED_OVERRIDE_TARGET_INVALID");
  }
  if (new Set(inputs.declaredOutflows.map((item) => item.id)).size !== inputs.declaredOutflows.length
    || inputs.declaredOutflows.some((item) => item.dueDate !== null && !item.dueDate.startsWith(forecast.meta.targetMonth)))
    throw new TypeError("DECLARED_OUTFLOW_MONTH_INVALID");
  if (Object.keys(inputs.resourceOverrides).some((key) => !forecast.income.components.some((part) => part.key === key)
    && key !== "benefit:swile" && key !== "benefit:edenred")) throw new TypeError("RESOURCE_OVERRIDE_TARGET_INVALID");
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
  const confirmedObligations = inputs.confirmedObligations.reduce((total, item) => total.plus(item.amount), new Big(0));
  const rawImpact = purchase ? new Big(purchase.amount).minus(purchase.amountAlreadyCoveredByParentEnvelope) : new Big(0);
  const additiveImpact = rawImpact.gt(0) ? rawImpact : new Big(0);
  const reserveDifference = new Big(inputs.safetyReserve).minus(forecast.reserve.amount);
  const totalCostDelta = confirmedObligations.plus(additiveImpact).minus(excludedFixedTotal);
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
    userPlannedEventDelta: null,
    undeclaredEventDelta: null, fixedExpenseTotal: forecast.obligations.central === null ? null
      : euros(new Big(forecast.obligations.central).minus(excludedFixedTotal)), excludedFixedTotal: euros(excludedFixedTotal),
    economicPlan: deriveEconomicPlan(forecast, inputs, plannedExpenses),
    economicCost, freeToSpend, cashPrudent, benefitPotential, availableNow,
  };
}

/** Draft simulation uses the exact saved-expense derivation, replacing an entity with the same ID. */
export function simulatePlannedExpenseScenario(forecast: MonthForecastSnapshot, inputs: MonthInputs,
  saved: readonly PlannedExpenseScenarioEntry[], draft: PlannedExpenseScenarioEntry, asOfDate: string): MonthScenario {
  const next = [...saved.filter((expense) => expense.id !== draft.id), draft];
  return deriveMonthScenario(forecast, inputs, null, asOfDate, next);
}

export type MonthScenario = ReturnType<typeof deriveMonthScenario>;
