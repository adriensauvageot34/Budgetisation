import "server-only";
import Big from "big.js";
import { continuousCoverage, type AsOfContext, type CoverageInterval } from "./forecast-opportunities";
import { plannedLineGross, costItemCashTreatment } from "@/domain/phase2/planned-money";
import type { PlannedExpenseScenarioEntry } from "./planned-expenses";
import { economicObservations, type BankObservation, type FixedOccurrence, type PlannedObservationMatch } from "./planned-observation-reconciliation";
import type { EconomicReferenceEntry } from "./month-reference";
import type { RemainingCategory, FundingRange } from "./remaining-month-forecast";

export type MoneyKnowledge = Readonly<{ status: "KNOWN"; amount: string; asOfDate?: string; provenance: readonly string[] }>
  | Readonly<{ status: "UNKNOWN"; amount: null; reason: string }>;
export type IncomeOccurrence = Readonly<{ key: string; amount: string; date: string | null;
  state: "EXPECTED" | "RECEIVED" | "UNCERTAIN" | "CANCELLED"; observedRef: string | null }>;
export type BankCashProjection = Readonly<{ currentRealBankBalance: MoneyKnowledge; futureKnownBankIncome: MoneyKnowledge;
  remainingCertainBankOutflows: MoneyKnowledge; pendingBankOutflows: MoneyKnowledge; plannedBankCashRemaining: MoneyKnowledge;
  remainingEssentialBankCash: FundingRange; remainingOptionalBankCash: FundingRange; afterCertain: MoneyKnowledge;
  savingsBudgetReservation: MoneyKnowledge; afterSavings: MoneyKnowledge;
  plannedAvailable: MoneyKnowledge; afterEssential: FundingRange; endOfMonth: FundingRange;
  incomeOccurrences: readonly IncomeOccurrence[]; calibrated: false; limitations: readonly string[] }>;
const known = (amount: string | Big, provenance: string[], asOfDate?: string): MoneyKnowledge => ({ status: "KNOWN", amount: new Big(amount).toFixed(2), provenance, ...(asOfDate ? { asOfDate } : {}) });
const unknown = (reason: string): MoneyKnowledge => ({ status: "UNKNOWN", amount: null, reason });
/** Manual observation is a stock. Carry it only across a proven complete bank ledger.
 * TRANSFER rows must have reciprocal peers, whose signed household net is exactly zero. */
export function resolveRealBankBalance(input: { observation: { amount: string; asOfDate: string } | null; today: string;
  bank: readonly BankObservation[]; intervals?: readonly CoverageInterval[] }): MoneyKnowledge {
  const { observation, today, bank } = input;
  if (!observation) return unknown("BANK_BALANCE_UNOBSERVED");
  if (observation.asOfDate === today) return known(observation.amount, ["manualBankBalanceObservation"], today);
  if (observation.asOfDate > today) return unknown("BANK_BALANCE_AFTER_ASOF");
  if ((continuousCoverage(input.intervals ?? [], observation.asOfDate) ?? "") < today) return unknown("BANK_LEDGER_CONTINUITY_UNKNOWN");
  const movements = bank.filter(o => o.date > observation.asOfDate && o.date <= today);
  const transfers = movements.filter(o => o.direction === "TRANSFER" || o.transferPeerId);
  for (const o of transfers) {
    const peer = transfers.find(p => p.id === o.transferPeerId && p.transferPeerId === o.id);
    if (!peer || !new Big(o.amount).plus(peer.amount).eq(0)) return unknown("INTERNAL_TRANSFER_NOT_RECONCILED");
  }
  const delta = movements.filter(o => !transfers.includes(o)).reduce((sum, o) => sum.plus(o.direction === "IN" ? new Big(o.amount).abs() : new Big(o.amount).abs().times(-1)), new Big(0));
  return known(new Big(observation.amount).plus(delta), ["manualBankBalanceObservation", "continuousBANKLedger"], today);
}
export function resolveIncomeOccurrences(resources: readonly { key: string; amount: string; pocket: string }[], bank: readonly BankObservation[],
  context: AsOfContext): IncomeOccurrence[] {
  return resources.filter(r => r.pocket === "BANK_CASH").map(resource => {
    const merchant = resource.key.slice("income:".length);
    const current = bank.filter(o => o.direction === "IN" && o.merchant === merchant && o.date.startsWith(context.targetMonth) && o.date <= context.today);
    const observed = current.length === 1 ? current[0]! : null;
    const history = bank.filter(o => o.direction === "IN" && o.merchant === merchant && o.date < context.monthStart && o.date <= context.today);
    const sortedDays = history.map(o => Number(o.date.slice(8))).sort((a, b) => a - b);
    const day = sortedDays.length >= 3 ? sortedDays[Math.floor(sortedDays.length / 2)]! : null;
    const date = day === null ? null : `${context.targetMonth}-${String(Math.min(day, Number(context.monthEnd.slice(8)))).padStart(2, "0")}`;
    return { key: resource.key, amount: observed ? new Big(observed.amount).abs().toFixed(2) : resource.amount,
      date: observed?.date ?? date, state: observed ? "RECEIVED" : current.length > 1 || date === null || date < context.today ? "UNCERTAIN" : "EXPECTED", observedRef: observed?.id ?? null };
  });
}
const sumFunding = (categories: readonly RemainingCategory[]): FundingRange => Object.fromEntries((["low", "central", "high"] as const).map(k => [k,
  categories.some(c => c.remainingForecastBankCash[k] === null) ? null : categories.reduce((sum, c) => sum.plus(c.remainingForecastBankCash[k]!), new Big(0)).toFixed(2)])) as FundingRange;
const subtract = (from: MoneyKnowledge, cost: FundingRange): FundingRange => Object.fromEntries((["low", "central", "high"] as const).map(k => [k,
  from.status === "UNKNOWN" || cost[k] === null ? null : new Big(from.amount).minus(cost[k]!).toFixed(2)])) as FundingRange;
/** Pure bank layer. Never includes wallet resources, fuel usage or baseline absorption as cash. */
export function projectBankCashAsOf(input: { context: AsOfContext; balance: MoneyKnowledge; income: readonly IncomeOccurrence[];
  fixed: readonly FixedOccurrence[]; savingsBudgetReservation?: string; expenses: readonly PlannedExpenseScenarioEntry[]; matchedExpenseIds: readonly string[];
  reconciliation?: readonly PlannedObservationMatch[]; forecastAvailable?: boolean; observedPurchases?: readonly EconomicReferenceEntry[];
  essential: readonly RemainingCategory[]; optional: readonly RemainingCategory[] }): BankCashProjection {
  const limitations = new Set<string>();
  if (input.balance.status === "UNKNOWN") limitations.add(input.balance.reason);
  const uncertainIncome = input.income.some(i => i.state === "UNCERTAIN");
  const income = uncertainIncome ? unknown("INCOME_TIMING_OR_MATCH_UNCERTAIN") : known(input.income.filter(i => i.state === "EXPECTED").reduce((n, i) => n.plus(i.amount), new Big(0)), ["incomeOccurrences:EXPECTED"]);
  if (uncertainIncome) limitations.add("INCOME_TIMING_OR_MATCH_UNCERTAIN");
  const certain = known(input.fixed.filter(o => !["OBSERVED", "CANCELLED"].includes(o.state)).reduce((n, o) => n.plus(o.amount), new Big(0)), ["remainingFixedOccurrences"]);
  let planned = new Big(0), pending = new Big(0);
  for (const expense of input.expenses.filter(e => !input.matchedExpenseIds.includes(e.id))) for (const item of expense.costItems) {
    if (costItemCashTreatment(item) === "ECONOMIC_ONLY") continue;
    const bank = (item.fundingAllocations ?? [{ source: "BANK", amount: plannedLineGross(item) }]).filter(a => a.source === "BANK").reduce((n, a) => n.plus(a.amount), new Big(0));
    if (expense.status === "DECLARED_REALIZED") pending = pending.plus(bank); else planned = planned.plus(bank);
  }
  const unbookedPurchases = economicObservations((input.observedPurchases ?? []).filter(r => r.date <= input.context.today
    && r.date.startsWith(input.context.targetMonth))).filter(r => r.purchaseEventId && r.bankPaymentObserved !== true);
  const purchaseIds = new Set(unbookedPurchases.map(r => r.purchaseEventId));
  const unbooked = (input.reconciliation ?? []).filter(m => !m.bankObserved
    && !(m.observedRef.kind === "PURCHASE_EVENT" && purchaseIds.has(m.observedRef.id)));
  const pendingUnknown = unbooked.some(m => m.unbookedBankAmount === null) || unbookedPurchases.some(r => !r.fundingComplete);
  pending = unbooked.reduce((n, m) => n.plus(m.unbookedBankAmount ?? 0), pending);
  pending = unbookedPurchases.reduce((n, r) => n.plus(r.funding?.BANK ?? 0), pending);
  const unpriced = input.expenses.some(expense => (expense.context?.project?.unpricedComponents?.length ?? 0) > 0);
  const pendingBankOutflows = pendingUnknown ? unknown("OBSERVED_PURCHASE_BANK_PAYMENT_UNRESOLVED") : known(pending, ["DECLARED_OR_PURCHASE_BANK_NOT_BOOKED"]),
    plannedBankCashRemaining = unpriced ? unknown("PROJECT_COST_UNPRICED") : known(planned, ["unobservedPlannedBANKAllocations"]);
  if (unpriced) limitations.add("PROJECT_COST_UNPRICED");
  if (pendingUnknown) limitations.add("OBSERVED_PURCHASE_BANK_PAYMENT_UNRESOLVED");
  if (input.context.temporalMode !== "CURRENT_MONTH") limitations.add("OTHER_MONTH_BANK_BRIDGE_UNCERTIFIED");
  const afterCertain = input.context.temporalMode === "CURRENT_MONTH" && input.balance.status === "KNOWN" && income.status === "KNOWN" ? known(new Big(input.balance.amount).plus(income.amount).minus(certain.amount!), ["currentBalance+futureIncome-remainingCertain"])
    : unknown("BANK_PROJECTION_INPUT_UNKNOWN");
  // A reservation is known budget intent. The observed stock has no account scope
  // proving whether savings were already transferred out; never deduct them twice.
  const savingsBudgetReservation = known(input.savingsBudgetReservation ?? "0", ["monthlySavingsBudgetIntent"]);
  const hasSavings = new Big(savingsBudgetReservation.amount!).gt(0);
  const afterSavings = hasSavings ? unknown("BANK_BALANCE_SAVINGS_SCOPE_UNRESOLVED") : afterCertain;
  if (hasSavings) limitations.add("BANK_BALANCE_SAVINGS_SCOPE_UNRESOLVED");
  const available = afterSavings.status === "KNOWN" && !pendingUnknown && !unpriced ? known(new Big(afterSavings.amount).minus(planned).minus(pending), ["afterSavings-pending-plannedCash"]) : unknown(hasSavings ? "BANK_BALANCE_SAVINGS_SCOPE_UNRESOLVED" : "BANK_PROJECTION_INPUT_UNKNOWN");
  const missingForecast: FundingRange = { low: null, central: null, high: null };
  const essential = input.forecastAvailable === false ? missingForecast : sumFunding(input.essential),
    optional = input.forecastAvailable === false ? missingForecast : sumFunding(input.optional), afterEssential = subtract(available, essential);
  const end = Object.fromEntries((["low", "central", "high"] as const).map(k => [k, afterEssential[k] === null || optional[k] === null ? null : new Big(afterEssential[k]!).minus(optional[k]!).toFixed(2)])) as FundingRange;
  if (essential.central === null || optional.central === null) limitations.add("EXPECTED_BANK_FUNDING_UNKNOWN");
  return { currentRealBankBalance: input.balance, futureKnownBankIncome: income, remainingCertainBankOutflows: certain,
    pendingBankOutflows, plannedBankCashRemaining, remainingEssentialBankCash: essential, remainingOptionalBankCash: optional,
    afterCertain, savingsBudgetReservation, afterSavings, plannedAvailable: available, afterEssential, endOfMonth: end, incomeOccurrences: input.income, calibrated: false, limitations: [...limitations].sort() };
}
