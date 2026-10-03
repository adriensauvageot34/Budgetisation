import "server-only";
import Big from "big.js";
import { plannedLineGross, costItemCashTreatment } from "@/domain/phase2/planned-money";
import type { PlannedExpenseScenarioEntry } from "./planned-expenses";
import type { EconomicReferenceEntry } from "./month-reference";
import type { ObservationRef } from "./forecast-opportunities";

export type BankObservation = Readonly<{ id: string; date: string; amount: string; direction: "IN" | "OUT" | "TRANSFER";
  merchant: string | null; merchantId?: string | null; recurrenceSeriesId?: string | null;
  contractRef?: string | null; transferPeerId?: string | null }>;
export const economicObservationIdentity = (row: EconomicReferenceEntry) => row.purchaseEventId ? `purchase:${row.purchaseEventId}` : `operation:${row.operationId}`;
/** Aggregate components within the same real purchase, never across nearby purchases. */
export function economicObservations(rows: readonly EconomicReferenceEntry[]): EconomicReferenceEntry[] {
  const groups = new Map<string, EconomicReferenceEntry>();
  for (const row of rows) {
    const key = economicObservationIdentity(row), previous = groups.get(key);
    groups.set(key, previous ? { ...previous, amount: new Big(previous.amount).plus(row.amount).toFixed(2),
      subcategory: previous.subcategory === row.subcategory ? previous.subcategory : "",
      need: previous.need === row.need ? previous.need : null,
      preciseType: previous.preciseType === row.preciseType ? previous.preciseType : null,
      person: previous.person === row.person ? previous.person : null,
      amountStatus: previous.amountStatus === "PARTIAL" || row.amountStatus === "PARTIAL" ? "PARTIAL" : "KNOWN",
      fundingComplete: previous.fundingComplete === true && row.fundingComplete === true,
      bankPaymentObserved: previous.bankPaymentObserved === true && row.bankPaymentObserved === true,
      funding: Object.fromEntries((["BANK", "SWILE", "EDENRED"] as const).map(source => [source,
        new Big(previous.funding?.[source] ?? 0).plus(row.funding?.[source] ?? 0).toFixed(2)])) } : row);
  }
  return [...groups.values()].sort((a, b) => economicObservationIdentity(a).localeCompare(economicObservationIdentity(b)));
}
export type PlannedObservationMatch = Readonly<{ plannedExpenseId: string; observedRef: ObservationRef;
  plannedEconomic: string; observedEconomic: string; variance: string; declared: boolean; level: "USER_CONFIRMED" | "EXACT_UNIQUE";
  bankObserved: boolean; unbookedBankAmount: string | null }>;
export function plannedObservationCategory(expense: Pick<PlannedExpenseScenarioEntry, "costItems">): string | null {
  const roots = new Set(expense.costItems.map(item => item.baselineKey ?? (["restaurant", "fast_food"].includes(item.modulePath?.at(-1) ?? "") ? "household-restaurants" : null)));
  return roots.size === 1 ? [...roots][0]! : null;
}
export function coherentPlannedObservation(expense: Pick<PlannedExpenseScenarioEntry, "costItems" | "context">, row: EconomicReferenceEntry,
  matchesCategory: (key: string, row: EconomicReferenceEntry) => boolean, personNames: Readonly<Record<string, string>>) {
  const key = plannedObservationCategory(expense);
  const refs = [...(expense.context?.participantPersonIds ?? []), ...(expense.context?.participantRefs ?? []).flatMap(r => r.kind === "HOUSEHOLD_PERSON" ? [r.personId] : [])];
  return row.amountStatus !== "PARTIAL" && key !== null && matchesCategory(key, row)
    && (row.person === null || refs.some(id => personNames[id] === row.person));
}
export function reconcilePlannedObservations(expenses: readonly PlannedExpenseScenarioEntry[], observations: readonly EconomicReferenceEntry[],
  matchesCategory: (key: string, row: EconomicReferenceEntry) => boolean, personNames: Readonly<Record<string, string>>) {
  const facts = economicObservations(observations), candidates = new Map<string, { row: EconomicReferenceEntry; level: PlannedObservationMatch["level"] }[]>();
  for (const expense of expenses) {
    const link = expense.context?.realityLink;
    const gross = expense.costItems.reduce((n, item) => n.plus(plannedLineGross(item)), new Big(0));
    const refs = [...(expense.context?.participantPersonIds ?? []), ...(expense.context?.participantRefs ?? []).flatMap(r => r.kind === "HOUSEHOLD_PERSON" ? [r.personId] : [])];
    const expectedFunding = new Set(expense.costItems.filter(i => costItemCashTreatment(i) !== "ECONOMIC_ONLY")
      .flatMap(i => (i.fundingAllocations ?? [{ source: "BANK", amount: plannedLineGross(i) }]).filter(a => new Big(a.amount).gt(0)).map(a => a.source)));
    const seller = expense.context?.seller;
    const options = facts.flatMap<{ row: EconomicReferenceEntry; level: PlannedObservationMatch["level"] }>(row => {
      if (link) return coherentPlannedObservation(expense, row, matchesCategory, personNames)
        && (link.kind === "PURCHASE_EVENT" ? row.purchaseEventId === link.id : row.operationId === link.id)
        ? [{ row, level: "USER_CONFIRMED" as const }] : [];
      // Category, exact identity, date, amount, attribution and funding are all required.
      // Multi-module projects remain candidates until a user supplies a reality link.
      if (!coherentPlannedObservation(expense, row, matchesCategory, personNames) || !seller || !row.merchant || seller !== row.merchant
        || expense.plannedDate !== row.date || !gross.eq(row.amount) || row.amountStatus === "PARTIAL"
        || (row.person !== null && !refs.some(id => personNames[id] === row.person))) return [];
      const actualFunding = new Set(Object.entries(row.funding ?? {}).filter(([, amount]) => new Big(amount!).gt(0)).map(([source]) => source));
      if (!row.fundingComplete || actualFunding.size !== expectedFunding.size || [...expectedFunding].some(source => !actualFunding.has(source))) return [];
      return [{ row, level: "EXACT_UNIQUE" as const }];
    });
    candidates.set(expense.id, options);
  }
  const matches: PlannedObservationMatch[] = [];
  for (const expense of expenses) {
    const options = candidates.get(expense.id)!;
    if (options.length !== 1) continue;
    const { row, level } = options[0]!, identity = economicObservationIdentity(row);
    if ([...candidates.values()].filter(values => values.some(c => economicObservationIdentity(c.row) === identity)).length !== 1) continue;
    const gross = expense.costItems.reduce((n, item) => n.plus(plannedLineGross(item)), new Big(0)).toFixed(2);
    matches.push({ plannedExpenseId: expense.id, observedRef: { kind: row.purchaseEventId ? "PURCHASE_EVENT" : "OPERATION", id: row.purchaseEventId ?? row.operationId },
      plannedEconomic: gross, observedEconomic: row.amount, variance: new Big(row.amount).minus(gross).toFixed(2),
      declared: expense.status === "DECLARED_REALIZED", level,
      bankObserved: !row.purchaseEventId || row.bankPaymentObserved === true,
      unbookedBankAmount: row.fundingComplete ? row.funding?.BANK ?? "0.00" : null });
  }
  const matchedIds = new Set(matches.map(m => m.plannedExpenseId));
  return { matches, unmatchedExpenses: expenses.filter(e => !matchedIds.has(e.id)),
    candidates: [...candidates.entries()].filter(([id, rows]) => !matchedIds.has(id) && rows.length).map(([id, rows]) => ({ plannedExpenseId: id, observedIds: rows.map(r => economicObservationIdentity(r.row)) })) };
}

export type FixedOccurrence = Readonly<{ key: string; date: string | null; amount: string; label: string;
  state: "UPCOMING" | "PENDING_OBSERVATION" | "OVERDUE_UNOBSERVED" | "OBSERVED" | "CANCELLED";
  expectedAmount: string; observedAmount: string | null; observedRef: string | null }>;
/** Exact recurrence/contract takes priority. Ambiguous or merely probable debits stay reserved. */
export function reconcileFixedOccurrences(items: readonly { key: string; date: string | null; amount: string; label: string }[],
  bank: readonly BankObservation[], month: string, today: string, bankSafeThrough: string | null): FixedOccurrence[] {
  const current = bank.filter(o => o.date.startsWith(month) && o.date <= today && o.direction === "OUT");
  const options = items.map(item => {
    const series = item.key.startsWith("obligation:") ? item.key.slice(11) : null;
    const exact = current.filter(o => series && (o.recurrenceSeriesId === series || o.contractRef === series));
    const fallback = current.filter(o => o.merchant === item.label && new Big(o.amount).abs().eq(item.amount) && item.date !== null
      && Math.abs(Date.parse(o.date) - Date.parse(item.date)) <= 3 * 86400000);
    return { item, candidates: exact.length ? exact : fallback };
  });
  return options.map(({ item, candidates }) => {
    const observed = candidates.length === 1 && options.filter(other => other.candidates.some(o => o.id === candidates[0]!.id)).length === 1 ? candidates[0]! : null;
    const state = observed ? "OBSERVED" : item.date === null ? "PENDING_OBSERVATION" : item.date >= today ? "UPCOMING"
      : bankSafeThrough !== null && item.date <= bankSafeThrough ? "OVERDUE_UNOBSERVED" : "PENDING_OBSERVATION";
    return { ...item, state, expectedAmount: item.amount, amount: observed ? new Big(observed.amount).abs().toFixed(2) : item.amount,
      observedAmount: observed ? new Big(observed.amount).abs().toFixed(2) : null, observedRef: observed?.id ?? null };
  });
}
