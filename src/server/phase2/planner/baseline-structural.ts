import "server-only";
import { Temporal } from "@js-temporal/polyfill";
import { parsePlannerJsonObject } from "@/domain/phase2/planner/json";
import type { BaselineStructuralFact, BaselineSavingsReservation, ExternalKnownContext } from "@/domain/phase2/planner/baseline-contract";
import { parseSavingsMetadata } from "@/domain/phase2/savings-allocations";
import type { PlanningBaselineSources } from "./baseline-sources";
import { compare, diagnostic, money, nullRange, sourceRef } from "./baseline-evidence";

/** Strict allowlist: legacy decisions/events/exclusions never drive factual amounts. */
export function factualMonthInputs(s: PlanningBaselineSources) {
  const i = s.monthInputs;
  return { safetyReserve: i.safetyReserve, openingBalance: i.openingBalance, benefitWallets: i.benefitWallets ?? null,
    benefit: i.benefit, declaredResources: i.declaredResources, resourceOverrides: i.resourceOverrides,
    confirmedObligations: [...i.confirmedObligations].sort((a, b) => compare(a.componentKey, b.componentKey)),
    fixedAmountOverrides: i.fixedAmountOverrides,
    declaredOutflows: [...i.declaredOutflows].sort((a, b) => compare(a.id, b.id)) };
}
export function buildStructuralBaseline(s: PlanningBaselineSources) {
  const resources: BaselineStructuralFact[] = [], obligations: BaselineStructuralFact[] = [], diagnostics = [];
  const i = factualMonthInputs(s), forecastKey = "forecast:structural", inputsKey = "month-inputs:facts";
  const parts = [...s.forecast.income.components, ...s.forecast.components.filter(c => c.key.startsWith("obligation:"))]
    .sort((a, b) => compare(a.key, b.key));
  if (new Set(parts.map(c => c.key)).size !== parts.length) throw new TypeError("BASELINE_STRUCTURAL_IDENTITY_CONFLICT");
  for (const part of parts) {
    const income = !part.key.startsWith("obligation:"), confirmation = i.confirmedObligations.find(c => c.componentKey === part.key);
    const override = income ? i.resourceOverrides[part.key] : i.fixedAmountOverrides[part.key]?.amount ?? confirmation?.amount;
    const known = override !== undefined || part.knowledgeState === "PROBABLE" && part.central !== null;
    const value = override !== undefined ? { low: money(override), central: money(override), high: money(override) }
      : known ? { low: part.low === null ? null : money(part.low), central: money(part.central!), high: part.high === null ? null : money(part.high) } : nullRange();
    const dueDate = income ? null : i.fixedAmountOverrides[part.key]?.dueDate ?? confirmation?.dueDate ?? null;
    if (dueDate && !dueDate.startsWith(s.targetMonth)) throw new TypeError("BASELINE_OBLIGATION_MONTH_INVALID");
    (income ? resources : obligations).push({ factKey: part.key, label: part.label, value,
      knowledge: override !== undefined ? "DECLARED" : known ? "ESTIMATED" : "UNKNOWN",
      provenance: ["CANONICAL_FACT"], sourceRefs: [forecastKey, ...(override === undefined ? [] : [inputsKey])], dueDate,
      metadata: { ownerAuthority: part.ownerAuthority, nature: part.nature, fundingPlan: part.fundingPlan } });
    if (!known) diagnostics.push(diagnostic("BASELINE_STRUCTURAL_AMOUNT_UNKNOWN", part.key, part.provenance));
  }
  for (const c of i.confirmedObligations) {
    if (!c.dueDate.startsWith(s.targetMonth)) throw new TypeError("BASELINE_OBLIGATION_MONTH_INVALID");
    if (!obligations.some(o => o.factKey === c.componentKey)) obligations.push({ factKey: c.componentKey, label: c.componentKey,
      value: { low: money(c.amount), central: money(c.amount), high: money(c.amount) }, dueDate: c.dueDate,
      knowledge: "DECLARED", provenance: ["CANONICAL_FACT"], sourceRefs: [inputsKey], metadata: {} });
  }
  for (const [key, amount] of Object.entries({ ...i.declaredResources, ...i.resourceOverrides }).sort(([a], [b]) => compare(a, b))) {
    if (!resources.some(r => r.factKey === key)) resources.push({ factKey: key, label: key,
      value: { low: money(amount), central: money(amount), high: money(amount) }, dueDate: null,
      knowledge: "DECLARED", provenance: ["CANONICAL_FACT"], sourceRefs: [inputsKey], metadata: {} });
  }
  if (i.openingBalance) {
    if (Temporal.PlainDate.compare(i.openingBalance.asOfDate, Temporal.Instant.from(s.knowledgeCutoff).toZonedDateTimeISO(s.timezone).toPlainDate()) > 0)
      throw new TypeError("BASELINE_BALANCE_AFTER_CUTOFF");
    resources.push({ factKey: "bank:observed-stock", label: "Observed bank stock", value: { low: money(i.openingBalance.amount), central: money(i.openingBalance.amount), high: money(i.openingBalance.amount) },
      dueDate: i.openingBalance.asOfDate, knowledge: "DECLARED", provenance: ["CANONICAL_FACT"], sourceRefs: [inputsKey], metadata: { role: "STOCK_NOT_INCOME" } });
  }
  const savingsReservations: BaselineSavingsReservation[] = i.declaredOutflows.map(o => {
    if (o.dueDate && !o.dueDate.startsWith(s.targetMonth)) throw new TypeError("BASELINE_SAVINGS_MONTH_INVALID");
    return { reservationId: o.id, label: o.label, amount: money(o.amount), dueDate: o.dueDate,
      ...parseSavingsMetadata({ ...o }), provenance: "CANONICAL_FACT", sourceRefs: [inputsKey] };
  });
  savingsReservations.push({ reservationId: "policy:safety-reserve", label: "Safety reserve", amount: money(i.safetyReserve), dueDate: null,
    adjustability: "PROTECTED", source: "MONTH_INPUT", annualGoalRef: null, provenance: "CANONICAL_FACT", sourceRefs: [inputsKey] });
  if (new Set(savingsReservations.map(o => o.reservationId)).size !== savingsReservations.length) throw new TypeError("BASELINE_SAVINGS_IDENTITY_CONFLICT");
  const externalKnownContexts: ExternalKnownContext[] = [], externals = new Map<string, typeof s.plannedExpenses[number]>();
  for (const p of s.plannedExpenses) {
    if (p.householdId !== s.householdId || p.targetMonth !== s.targetMonth) throw new TypeError("BASELINE_EXTERNAL_SCOPE_INVALID");
    const previous = externals.get(p.id);
    if (previous && sourceRef(p.id, "external", previous).digest !== sourceRef(p.id, "external", p).digest) throw new TypeError("BASELINE_EXTERNAL_IDENTITY_CONFLICT");
    externals.set(p.id, p);
  }
  for (const p of [...externals.values()].sort((a, b) => compare(a.id, b.id))) externalKnownContexts.push({ externalContextId: p.id,
    owner: "phase2_planned_expenses", status: p.status, targetMonth: p.targetMonth,
    intent: parsePlannerJsonObject({ title: p.title, familyKey: p.familyKey, subtypeKey: p.subtypeKey,
      plannedDate: p.plannedDate, costItems: p.costItems, context: p.context }), sourceRefs: ["planned-expenses:intents"] });
  for (const p of [...s.monthInputs.plannedEvents].sort((a, b) => compare(a.id, b.id))) {
    if (externals.has(p.id)) continue;
    externalKnownContexts.push({ externalContextId: p.id, owner: "legacy_month_event", status: "PLANNED", targetMonth: s.targetMonth,
      intent: parsePlannerJsonObject(p), sourceRefs: ["planned-expenses:intents"] });
  }
  if (new Set(externalKnownContexts.map(c => c.externalContextId)).size !== externalKnownContexts.length) throw new TypeError("BASELINE_EXTERNAL_IDENTITY_CONFLICT");
  const sourceRefs = [sourceRef(inputsKey, "phase2_month_inputs", i),
    sourceRef(forecastKey, "MonthForecast", { targetMonth: s.forecast.meta.targetMonth, parts }, parts.flatMap(p => p.provenance)),
    sourceRef("planned-expenses:intents", "phase2_planned_expenses", externalKnownContexts)];
  return { structuralFacts: { resources, obligations, savingsReservations, externalKnownContexts }, diagnostics, sourceRefs };
}
