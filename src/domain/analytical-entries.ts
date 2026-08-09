import type {
  AnalyticalStatus,
  Importance,
  LifeLayer,
  Moment,
  MonthKey,
  Operation,
  OperationAllocation,
  Recurrence,
} from "@/domain/budget";
import { isConsumptionExpense, netExpenseAmount } from "@/domain/calculations";
import {
  effectiveLifeContextFromParts,
  getEffectiveLifeContext,
  getLifeLayer,
  type EffectiveLifeContext,
} from "@/domain/life-analysis";

export type AnalyticalEntry = {
  id: string;
  sourceOperationId: string;
  amount: number;
  date: string;
  analysisMonth: MonthKey;
  normalizedMerchant: string;
  category: string;
  subcategory: string;
  preciseType: string | null;
  importance: Importance | null;
  recurrence: Recurrence | null;
  status: AnalyticalStatus;
  lifeContext: EffectiveLifeContext;
  lifeLayer: LifeLayer;
  momentId: string | null;
  momentName: string | null;
  momentType: string | null;
  source: "operation" | "allocation";
};

export type AllocationProblem = {
  operationId: string;
  available: number;
  allocated: number;
  exceededBy: number;
};

export type AnalyticalEntriesResult = {
  entries: AnalyticalEntry[];
  allocationProblems: AllocationProblem[];
};

export function toCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100);
}

export function fromCents(value: number) {
  return value / 100;
}

export function buildAnalyticalEntries(
  operations: Operation[],
  moments: Moment[],
  allocations: OperationAllocation[],
): AnalyticalEntriesResult {
  const momentById = new Map(moments.map((moment) => [moment.id, moment]));
  const allocationsByOperation = new Map<string, OperationAllocation[]>();
  for (const allocation of allocations) {
    const rows = allocationsByOperation.get(allocation.operationId) ?? [];
    rows.push(allocation);
    allocationsByOperation.set(allocation.operationId, rows);
  }

  const entries: AnalyticalEntry[] = [];
  const allocationProblems: AllocationProblem[] = [];
  for (const operation of operations.filter(isConsumptionExpense)) {
    const availableCents = Math.max(0, toCents(netExpenseAmount(operation, operations)));
    const operationAllocations = allocationsByOperation.get(operation.id) ?? [];
    const allocatedCents = operationAllocations.reduce(
      (sum, allocation) => sum + toCents(allocation.amount),
      0,
    );
    if (allocatedCents > availableCents) {
      allocationProblems.push({
        operationId: operation.id,
        available: fromCents(availableCents),
        allocated: fromCents(allocatedCents),
        exceededBy: fromCents(allocatedCents - availableCents),
      });
      continue;
    }

    const remainderCents = availableCents - allocatedCents;
    if (remainderCents > 0) {
      entries.push(entryFromOperation(operation, remainderCents, momentById));
    }
    for (const allocation of operationAllocations) {
      entries.push(entryFromAllocation(operation, allocation, momentById));
    }
  }
  return { entries, allocationProblems };
}

function momentFields(momentId: string | null, momentById: Map<string, Moment>) {
  const moment = momentId ? momentById.get(momentId) : undefined;
  return {
    momentId,
    momentName: moment?.name ?? null,
    momentType: moment?.type ?? null,
  };
}

function entryFromOperation(
  operation: Operation,
  amountCents: number,
  momentById: Map<string, Moment>,
): AnalyticalEntry {
  const lifeContext = getEffectiveLifeContext(operation);
  const moment = momentFields(operation.momentId ?? null, momentById);
  return {
    id: `operation:${operation.id}`,
    sourceOperationId: operation.id,
    amount: fromCents(amountCents),
    date: operation.date,
    analysisMonth: operation.analysisMonth ?? operation.importMonth,
    normalizedMerchant: operation.normalizedMerchant || operation.label,
    category: operation.category,
    subcategory: operation.subcategory,
    preciseType: operation.preciseType,
    importance: operation.importance,
    recurrence: operation.recurrence,
    status: operation.status,
    lifeContext,
    lifeLayer: getLifeLayer({ lifeContext, momentId: moment.momentId, status: operation.status }),
    ...moment,
    source: "operation",
  };
}

function entryFromAllocation(
  operation: Operation,
  allocation: OperationAllocation,
  momentById: Map<string, Moment>,
): AnalyticalEntry {
  const momentId = allocation.momentId ?? operation.momentId ?? null;
  const lifeContext = effectiveLifeContextFromParts({
    explicit: allocation.lifeContext,
    momentId,
    parent: operation,
  });
  const status = allocation.status ?? operation.status;
  const moment = momentFields(momentId, momentById);
  return {
    id: `allocation:${allocation.id}`,
    sourceOperationId: operation.id,
    amount: fromCents(toCents(allocation.amount)),
    date: operation.date,
    analysisMonth: operation.analysisMonth ?? operation.importMonth,
    normalizedMerchant: operation.normalizedMerchant || operation.label,
    category: allocation.category ?? operation.category,
    subcategory: allocation.subcategory ?? operation.subcategory,
    preciseType: allocation.preciseType ?? operation.preciseType,
    importance: allocation.importance ?? operation.importance,
    recurrence: allocation.recurrence ?? operation.recurrence,
    status,
    lifeContext,
    lifeLayer: getLifeLayer({ lifeContext, momentId: moment.momentId, status }),
    ...moment,
    source: "allocation",
  };
}

export function analyticalEntriesAsOperations(
  entries: AnalyticalEntry[],
  sourceOperations: Operation[],
) {
  const operationById = new Map(sourceOperations.map((operation) => [operation.id, operation]));
  return entries.map((entry): Operation => {
    const parent = operationById.get(entry.sourceOperationId)!;
    return {
      ...parent,
      id: entry.id,
      analyticalSourceOperationId: entry.sourceOperationId,
      date: entry.date,
      importMonth: entry.analysisMonth,
      analysisMonth: entry.analysisMonth,
      amount: -entry.amount,
      normalizedMerchant: entry.normalizedMerchant,
      label: entry.normalizedMerchant,
      category: entry.category,
      subcategory: entry.subcategory,
      preciseType: entry.preciseType,
      importance: entry.importance,
      recurrence: entry.recurrence,
      status: entry.status,
      lifeContext: entry.lifeContext === "À confirmer" ? null : entry.lifeContext,
      momentId: entry.momentId,
      spendingContext:
        entry.lifeContext === "Vie courante"
          ? "Vie courante"
          : entry.lifeContext === "Hors quotidien"
            ? "Événement"
            : null,
      event: entry.momentType ?? parent.event,
      eventDetail: entry.momentName ?? parent.eventDetail,
      reimbursesOperationId: null,
      fingerprint: `${parent.fingerprint}:${entry.id}`,
    };
  });
}
