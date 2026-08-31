import Big from "big.js";

import { addDays, addMonths, parseLocalDate, yearMonthOf } from "../../../core/time";
import type { LocalDate } from "../../../core/time";
import {
  addMoney,
  compareMoney,
  parseMoney,
  subtractMoney,
  type Money,
} from "../../../core/money";
import type { PurchaseEventFact } from "../../facts";
import { computeArtifactInputHash } from "../facts-hash";
import type {
  DailyEconomicAmount,
  DailyEconomicComponentSource,
  DailyEconomicLedgerInput,
  DailyEconomicLedgerMonthArtifact,
  DailyTimingAuthority,
  EconomicAllocationEntry,
  EconomicExpenseEvent,
} from "./types";

type Resolution = {
  entry: EconomicAllocationEntry;
  purchaseEventId?: string;
  conflict: boolean;
};

const zero = parseMoney("0");
const authorityRank: Record<DailyTimingAuthority, number> = {
  PURCHASE_EVENT: 1,
  EXPLICIT_CONSUMPTION_SOURCE: 2,
  CASH_USE_DATE: 3,
  TRUSTED_PURCHASE_SOURCE: 4,
};

function sortedUnique<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)].sort();
}

function sumMoney(values: readonly Money[]): Money {
  return values.reduce(addMoney, zero);
}

function absoluteNumber(value: Money): number {
  return Number(new Big(value).abs().toString());
}

function purchaseEventsForComponent(
  componentKey: string,
  purchaseEvents: readonly PurchaseEventFact[],
): readonly PurchaseEventFact[] {
  return purchaseEvents.filter(({ sources }) => sources.some((source) =>
    source.membershipKind === "CONSUMPTION_COMPONENT"
    && source.canonicalComponentKey === componentKey));
}

function unknownDate(reasonCode: "DATA_UNASSIGNED_TIMING" | "DATA_CONFLICTING_AUTHORITIES") {
  return {
    status: reasonCode === "DATA_CONFLICTING_AUTHORITIES" ? "CONFLICT" as const : "UNKNOWN" as const,
    quality: { reasonCode },
  };
}

function directResolution(component: DailyEconomicComponentSource): {
  date: LocalDate | null;
  authority?: DailyTimingAuthority;
  conflict: boolean;
  evidenceRefs: readonly string[];
} {
  const admissible = component.timingEvidence.filter((evidence) => {
    if (evidence.kind === "BANK_DATE_FALLBACK" || evidence.kind === "ECONOMIC_MONTH") return false;
    if (component.isRefund === true && component.linkedRefundSourceComponentKey === undefined) {
      return evidence.kind === "EXPLICIT_CONSUMPTION_SOURCE" || evidence.kind === "CASH_USE_DATE";
    }
    return evidence.kind !== "PURCHASE_EVENT";
  });
  if (admissible.length === 0) return { date: null, conflict: false, evidenceRefs: [] };
  const bestRank = Math.min(...admissible.map(({ kind }) =>
    authorityRank[kind as DailyTimingAuthority]));
  const best = admissible.filter(({ kind }) =>
    authorityRank[kind as DailyTimingAuthority] === bestRank);
  const dates = sortedUnique(best.flatMap(({ date }) => date === undefined ? [] : [date]));
  const evidenceRefs = sortedUnique(best.map(({ evidenceRef }) => evidenceRef));
  if (dates.length > 1) return { date: null, authority: best[0].kind as DailyTimingAuthority, conflict: true, evidenceRefs };
  return {
    date: dates[0] ?? null,
    authority: best[0].kind as DailyTimingAuthority,
    conflict: false,
    evidenceRefs,
  };
}

function resolveComponent(
  component: DailyEconomicComponentSource,
  purchaseEvents: readonly PurchaseEventFact[],
  resolvedByKey: ReadonlyMap<string, Resolution>,
): Resolution {
  const events = purchaseEventsForComponent(component.canonicalComponentKey, purchaseEvents);
  if (events.length > 1) {
    return {
      conflict: true,
      entry: {
        componentKey: component.canonicalComponentKey,
        amount: component.amount,
        economicMonth: component.economicMonth,
        effectiveEconomicDate: unknownDate("DATA_CONFLICTING_AUTHORITIES"),
        timingPrecision: "NONE",
        sourceRefs: sortedUnique(component.sourceRefs),
        provenance: component.provenance,
      },
    };
  }
  const event = events[0];
  if (event !== undefined) {
    const base = {
      componentKey: component.canonicalComponentKey,
      amount: component.amount,
      economicMonth: component.economicMonth,
      purchaseEventId: event.purchaseEventId as string,
      sourceRefs: sortedUnique([...component.sourceRefs, ...event.sources.flatMap(({ evidenceRefs }) => evidenceRefs)]),
      provenance: component.provenance,
    };
    if (
      event.timing.status === "KNOWN"
      && event.timing.precision === "DAY"
      && event.timing.economicDate !== null
    ) {
      return {
        conflict: false,
        purchaseEventId: event.purchaseEventId as string,
        entry: {
          ...base,
          effectiveEconomicDate: { status: "KNOWN", value: event.timing.economicDate },
          timingPrecision: "DAY",
          timingAuthority: "PURCHASE_EVENT",
        },
      };
    }
    const conflict = event.timing.status === "CONFLICT";
    return {
      conflict,
      purchaseEventId: event.purchaseEventId as string,
      entry: {
        ...base,
        effectiveEconomicDate: unknownDate(conflict ? "DATA_CONFLICTING_AUTHORITIES" : "DATA_UNASSIGNED_TIMING"),
        timingPrecision: event.timing.precision,
      },
    };
  }

  if (component.linkedRefundSourceComponentKey !== undefined) {
    const source = resolvedByKey.get(component.linkedRefundSourceComponentKey);
    if (source !== undefined) {
      return {
        conflict: source.conflict,
        ...(source.purchaseEventId === undefined ? {} : { purchaseEventId: source.purchaseEventId }),
        entry: {
          componentKey: component.canonicalComponentKey,
          amount: component.amount,
          economicMonth: component.economicMonth,
          ...(source.purchaseEventId === undefined ? {} : { purchaseEventId: source.purchaseEventId }),
          effectiveEconomicDate: source.entry.effectiveEconomicDate,
          timingPrecision: source.entry.timingPrecision,
          ...(source.entry.timingAuthority === undefined ? {} : { timingAuthority: source.entry.timingAuthority }),
          sourceRefs: sortedUnique([...component.sourceRefs, ...source.entry.sourceRefs]),
          provenance: component.provenance,
        },
      };
    }
  }

  const direct = directResolution(component);
  if (direct.conflict) {
    return {
      conflict: true,
      entry: {
        componentKey: component.canonicalComponentKey,
        amount: component.amount,
        economicMonth: component.economicMonth,
        effectiveEconomicDate: unknownDate("DATA_CONFLICTING_AUTHORITIES"),
        timingPrecision: "NONE",
        sourceRefs: sortedUnique([...component.sourceRefs, ...direct.evidenceRefs]),
        provenance: component.provenance,
      },
    };
  }
  if (direct.date !== null && yearMonthOf(direct.date) === component.economicMonth) {
    return {
      conflict: false,
      entry: {
        componentKey: component.canonicalComponentKey,
        amount: component.amount,
        economicMonth: component.economicMonth,
        effectiveEconomicDate: { status: "KNOWN", value: direct.date },
        timingPrecision: "DAY",
        ...(direct.authority === undefined ? {} : { timingAuthority: direct.authority }),
        sourceRefs: sortedUnique([...component.sourceRefs, ...direct.evidenceRefs]),
        provenance: component.provenance,
      },
    };
  }
  return {
    conflict: false,
    entry: {
      componentKey: component.canonicalComponentKey,
      amount: component.amount,
      economicMonth: component.economicMonth,
      effectiveEconomicDate: unknownDate("DATA_UNASSIGNED_TIMING"),
      timingPrecision: "NONE",
      sourceRefs: sortedUnique(component.sourceRefs),
      provenance: component.provenance,
    },
  };
}

function resolveAll(
  components: readonly DailyEconomicComponentSource[],
  purchaseEvents: readonly PurchaseEventFact[],
): readonly Resolution[] {
  const results = new Map<string, Resolution>();
  const byKey = new Map(components.map((component) => [component.canonicalComponentKey, component]));
  if (byKey.size !== components.length) throw new TypeError("Un composant économique apparaît plusieurs fois.");
  const pending = [...components].sort((a, b) => Number(a.isRefund === true) - Number(b.isRefund === true));
  for (const component of pending) {
    results.set(component.canonicalComponentKey, resolveComponent(component, purchaseEvents, results));
  }
  return components.map(({ canonicalComponentKey }) => results.get(canonicalComponentKey)!);
}

function monthDates(month: DailyEconomicLedgerInput["month"]): readonly LocalDate[] {
  const start = parseLocalDate(`${month}-01`);
  const end = addDays(parseLocalDate(`${addMonths(month, 1)}-01`), -1);
  const result: LocalDate[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) result.push(date);
  return result;
}

function dailyValue(
  date: LocalDate,
  resolved: readonly Resolution[],
  coverage: DailyEconomicLedgerMonthArtifact["timingCoverage"],
): DailyEconomicAmount {
  const assigned = resolved.filter(({ entry }) =>
    entry.effectiveEconomicDate.status === "KNOWN"
    && entry.effectiveEconomicDate.value === date);
  const unresolved = resolved.filter(({ entry }) => entry.effectiveEconomicDate.status !== "KNOWN");
  const conflict = unresolved.some((entry) => entry.conflict);
  const amount = sumMoney(assigned.map(({ entry }) => entry.amount));
  const purchaseEventIds = sortedUnique(assigned.flatMap(({ purchaseEventId }) =>
    purchaseEventId === undefined ? [] : [purchaseEventId]));
  const base = {
    date,
    assignedComponentCount: assigned.length,
    ...(purchaseEventIds.length === 0 ? {} : { assignedPurchaseEventCount: purchaseEventIds.length }),
    ...(coverage === null ? {} : { timingCoverage: coverage }),
  };
  if (unresolved.length === 0) {
    return { ...base, economicAmount: { status: "KNOWN", value: amount } };
  }
  if (assigned.length > 0) {
    return {
      ...base,
      economicAmount: {
        status: "PARTIAL",
        value: amount,
        partialMeaning: "OBSERVED_ONLY",
        quality: { reasonCode: conflict ? "DATA_CONFLICTING_AUTHORITIES" : "DATA_UNASSIGNED_TIMING" },
      },
    };
  }
  return {
    ...base,
    economicAmount: conflict
      ? { status: "CONFLICT", quality: { reasonCode: "DATA_CONFLICTING_AUTHORITIES" } }
      : { status: "UNKNOWN", quality: { reasonCode: "DATA_UNASSIGNED_TIMING" } },
  };
}

function expenseEvents(resolved: readonly Resolution[]): readonly EconomicExpenseEvent[] {
  const groups = new Map<string, Resolution[]>();
  for (const resolution of resolved) {
    const entry = resolution.entry;
    const key = resolution.purchaseEventId !== undefined
      ? `purchase_event:${resolution.purchaseEventId}`
      : entry.sourceRefs.some((ref) => ref.startsWith("cash_use:"))
        ? `cash_use:${entry.componentKey}`
        : `canonical_charge:${entry.componentKey}`;
    groups.set(key, [...(groups.get(key) ?? []), resolution]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, members]) => {
    const first = members[0].entry;
    const dates = sortedUnique(members.flatMap(({ entry }) =>
      entry.effectiveEconomicDate.status === "KNOWN" ? [entry.effectiveEconomicDate.value] : []));
    const conflict = members.some(({ conflict: value }) => value) || dates.length > 1;
    return {
      expenseEventId: key,
      kind: key.startsWith("purchase_event:")
        ? "PURCHASE_EVENT" as const
        : key.startsWith("cash_use:")
          ? "CASH_USE" as const
          : "CANONICAL_CHARGE" as const,
      componentKeys: sortedUnique(members.map(({ entry }) => entry.componentKey)),
      economicAmount: sumMoney(members.map(({ entry }) => entry.amount)),
      effectiveEconomicDate: conflict
        ? unknownDate("DATA_CONFLICTING_AUTHORITIES")
        : dates.length === 1
          ? { status: "KNOWN" as const, value: dates[0] }
          : first.effectiveEconomicDate,
    };
  });
}

export function buildDailyEconomicLedgerMonthArtifact(
  input: DailyEconomicLedgerInput,
): DailyEconomicLedgerMonthArtifact {
  const relevant = input.components.filter(({ economicMonth }) => economicMonth === input.month);
  const resolved = resolveAll(relevant, input.purchaseEvents);
  const allocationEntries = resolved.map(({ entry }) => entry);
  const assigned = allocationEntries.filter(({ effectiveEconomicDate }) => effectiveEconomicDate.status === "KNOWN");
  const unassigned = allocationEntries.filter(({ effectiveEconomicDate }) => effectiveEconomicDate.status !== "KNOWN");
  const assignedEconomicAmount = sumMoney(assigned.map(({ amount }) => amount));
  const unassignedAmount = sumMoney(unassigned.map(({ amount }) => amount));
  const residual = subtractMoney(
    subtractMoney(input.actualMonthAmount, assignedEconomicAmount),
    unassignedAmount,
  );
  if (compareMoney(residual, zero) !== 0) {
    throw new TypeError(
      `Daily Economic Ledger non réconcilié: Actual=${input.actualMonthAmount}, assigned=${assignedEconomicAmount}, unassigned=${unassignedAmount}, residual=${residual}.`,
    );
  }
  const denominator = relevant.reduce((sum, component) => sum + absoluteNumber(component.amount), 0);
  const numerator = assigned.reduce((sum, { amount }) => sum + absoluteNumber(amount), 0);
  const timingCoverage = denominator === 0
    ? null
    : {
        ratio: numerator / denominator,
        numerator,
        denominator,
        unit: "amount_abs" as const,
        basis: "absolute_economic_component_amount" as const,
      };
  const issues = sortedUnique([
    ...(unassigned.length === 0 ? [] : ["DATA_UNASSIGNED_TIMING"]),
    ...(resolved.some(({ conflict }) => conflict) ? ["DATA_CONFLICTING_AUTHORITIES"] : []),
  ]);
  const entries = allocationEntries.sort((a, b) => a.componentKey.localeCompare(b.componentKey));
  return {
    artifactFamily: "daily_economic_ledger_month",
    householdId: input.householdId,
    month: input.month,
    currency: input.currency,
    actualMonthAmount: input.actualMonthAmount,
    days: monthDates(input.month).map((date) => dailyValue(date, resolved, timingCoverage)),
    allocationEntries: entries,
    expenseEvents: expenseEvents(resolved),
    unassignedEconomicAmount: {
      status: "KNOWN",
      value: unassignedAmount,
      ...(unassigned.length === 0 ? {} : { quality: { reasonCode: "DATA_UNASSIGNED_TIMING" } }),
    },
    assignedEconomicAmount,
    reconciliationResidual: residual,
    timingCoverage,
    issues,
    dependencyPolicies: {
      canonical_purchase_event_timing: "v1",
      daily_economic_allocation: "v1",
      quality_visibility: "v1",
      facts_hash: "v1",
    },
    artifactInputHash: computeArtifactInputHash({
      identity: `daily_economic_ledger_month:${input.householdId}:${input.month}`,
      facts: entries.map((entry) => ({
        factType: "daily_economic_allocation",
        identity: entry.componentKey,
        value: JSON.parse(JSON.stringify(entry)),
      })),
    }),
  };
}

export function assertDailyEconomicReconciliation(
  artifact: DailyEconomicLedgerMonthArtifact,
): void {
  const sumDays = sumMoney(artifact.days.flatMap(({ economicAmount }) =>
    economicAmount.status === "KNOWN" || economicAmount.status === "PARTIAL"
      ? [economicAmount.value]
      : []));
  const unassigned = artifact.unassignedEconomicAmount.status === "KNOWN"
    ? artifact.unassignedEconomicAmount.value
    : zero;
  if (compareMoney(addMoney(sumDays, unassigned), artifact.actualMonthAmount) !== 0) {
    throw new TypeError("SUM(days) + unassignedEconomicAmount doit être égal à Actual.");
  }
}
