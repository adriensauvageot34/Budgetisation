import type {
  AnalyticalStatus,
  Importance,
  MonthKey,
  Operation,
  Recurrence,
  ResourceType,
  LifeLayer,
} from "@/domain/budget";
import { isConsumptionExpense, netExpenseAmount } from "@/domain/calculations";
import { effectiveResourceType, operationAnalysisMonth } from "@/domain/inflow-analysis";
import { getEffectiveLifeContext, getLifeLayer } from "@/domain/life-analysis";

export type HistoryFlow = "expenses" | "inflows";
export type HistoryContext = "current" | "events" | "unconfirmed";

export type HistoryFilters = {
  flows: HistoryFlow[];
  families: string[];
  categories: string[];
  merchants: string[];
  statuses: AnalyticalStatus[];
  importances: Importance[];
  recurrences: Recurrence[];
  contexts: HistoryContext[];
  events: string[];
  eventDetails: string[];
  resourceTypes: ResourceType[];
  moments: string[];
  momentTypes: string[];
  lifeLayers: LifeLayer[];
};

export const defaultHistoryFilters: HistoryFilters = {
  flows: ["expenses", "inflows"],
  families: [],
  categories: [],
  merchants: [],
  statuses: [],
  importances: [],
  recurrences: [],
  contexts: [],
  events: [],
  eventDetails: [],
  resourceTypes: [],
  moments: [],
  momentTypes: [],
  lifeLayers: [],
};

export function operationHistoryFlow(operation: Operation): HistoryFlow | null {
  if (isConsumptionExpense(operation)) return "expenses";
  if (operation.amount > 0) return "inflows";
  return null;
}

export function operationHistoryMonth(operation: Operation) {
  return isConsumptionExpense(operation)
    ? operation.importMonth
    : operationAnalysisMonth(operation);
}

export function operationMerchant(operation: Operation) {
  return operation.normalizedMerchant &&
    operation.normalizedMerchant !== "Non renseigné"
    ? operation.normalizedMerchant
    : operation.label || operation.sourceLabel;
}

export function operationHistoryResourceType(operation: Operation): ResourceType {
  return effectiveResourceType(operation) ?? "À qualifier";
}

function contextKey(operation: Operation): HistoryContext | null {
  const context = getEffectiveLifeContext(operation);
  if (context === "Vie courante") return "current";
  if (context === "Hors quotidien") return "events";
  if (context === "À confirmer") return "unconfirmed";
  return null;
}

function matchesAny(value: string | null | undefined, selected: string[]) {
  return !selected.length || Boolean(value && selected.includes(value));
}

export function operationsInHistoryPeriod(
  operations: Operation[],
  start: MonthKey,
  end: MonthKey,
) {
  return operations.filter((operation) => {
    const month = operationHistoryMonth(operation);
    return month >= start && month <= end && Boolean(operationHistoryFlow(operation));
  });
}

export function filterHistoryOperations(
  operations: Operation[],
  filters: HistoryFilters,
) {
  return operations.filter((operation) => {
    const flow = operationHistoryFlow(operation);
    if (!flow || !filters.flows.includes(flow)) return false;
    if (!matchesAny(operationMerchant(operation), filters.merchants)) return false;

    if (flow === "expenses") {
      return (
        matchesAny(operation.category, filters.families) &&
        matchesAny(operation.subcategory, filters.categories) &&
        matchesAny(operation.status, filters.statuses) &&
        matchesAny(operation.importance, filters.importances) &&
        matchesAny(operation.recurrence, filters.recurrences) &&
        (!filters.contexts.length ||
          Boolean(contextKey(operation) && filters.contexts.includes(contextKey(operation)!))) &&
        matchesAny(operation.event, filters.events) &&
        matchesAny(operation.eventDetail, filters.eventDetails)
        && matchesAny(operation.event, filters.moments)
        && matchesAny(operation.eventDetail, filters.momentTypes)
        && (!filters.lifeLayers.length || filters.lifeLayers.includes(getLifeLayer({
          lifeContext: getEffectiveLifeContext(operation),
          momentId: operation.momentId ?? null,
          status: operation.status,
        })))
      );
    }

    const resourceType = operationHistoryResourceType(operation);
    return !filters.resourceTypes.length || filters.resourceTypes.includes(resourceType);
  });
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .sort((a, b) => a.localeCompare(b, "fr"));
}

export function historyFacetOptions(
  periodOperations: Operation[],
  draft: HistoryFilters,
) {
  const byFlow = periodOperations.filter((operation) => {
    const flow = operationHistoryFlow(operation);
    return Boolean(flow && draft.flows.includes(flow));
  });
  const expenseRows = byFlow.filter(isConsumptionExpense);
  const inflowRows = byFlow.filter((operation) => operationHistoryFlow(operation) === "inflows");
  const byFamily = expenseRows.filter((operation) =>
    matchesAny(operation.category, draft.families),
  );
  const byCategory = byFamily.filter((operation) =>
    matchesAny(operation.subcategory, draft.categories),
  );
  const eventRows = byCategory.filter(
    (operation) => getEffectiveLifeContext(operation) === "Hors quotidien",
  );
  const byEvent = eventRows.filter((operation) =>
    matchesAny(operation.event, draft.events),
  );

  return {
    families: unique(expenseRows.map((operation) => operation.category)),
    categories: unique(byFamily.map((operation) => operation.subcategory)),
    merchants: unique(
      [...byCategory, ...inflowRows].map(operationMerchant),
    ),
    statuses: unique(byCategory.map((operation) => operation.status)) as AnalyticalStatus[],
    importances: unique(byCategory.map((operation) => operation.importance)) as Importance[],
    recurrences: unique(byCategory.map((operation) => operation.recurrence)) as Recurrence[],
    contexts: unique(byCategory.map(contextKey)) as HistoryContext[],
    events: unique(eventRows.map((operation) => operation.event)),
    eventDetails: unique(byEvent.map((operation) => operation.eventDetail)),
    resourceTypes: unique(inflowRows.map(operationHistoryResourceType)) as ResourceType[],
    moments: unique(eventRows.map((operation) => operation.event)),
    momentTypes: unique(eventRows.map((operation) => operation.eventDetail)),
    lifeLayers: unique(byCategory.map((operation) => getLifeLayer({
      lifeContext: getEffectiveLifeContext(operation),
      momentId: operation.momentId ?? null,
      status: operation.status,
    }))) as LifeLayer[],
  };
}

export function cleanHistoryFilters(
  periodOperations: Operation[],
  filters: HistoryFilters,
) {
  let cleaned = { ...filters };
  for (let index = 0; index < 2; index += 1) {
    const options = historyFacetOptions(periodOperations, cleaned);
    cleaned = {
      ...cleaned,
      families: cleaned.families.filter((value) => options.families.includes(value)),
      categories: cleaned.categories.filter((value) => options.categories.includes(value)),
      merchants: cleaned.merchants.filter((value) => options.merchants.includes(value)),
      statuses: cleaned.statuses.filter((value) => options.statuses.includes(value)),
      importances: cleaned.importances.filter((value) => options.importances.includes(value)),
      recurrences: cleaned.recurrences.filter((value) => options.recurrences.includes(value)),
      contexts: cleaned.contexts.filter((value) => options.contexts.includes(value)),
      events: cleaned.contexts.includes("events")
        ? cleaned.events.filter((value) => options.events.includes(value))
        : [],
      eventDetails: cleaned.contexts.includes("events") && cleaned.events.length
        ? cleaned.eventDetails.filter((value) => options.eventDetails.includes(value))
        : [],
      resourceTypes: cleaned.resourceTypes.filter((value) =>
        options.resourceTypes.includes(value),
      ),
      moments: cleaned.contexts.includes("events")
        ? cleaned.moments.filter((value) => options.moments.includes(value))
        : [],
      momentTypes: cleaned.contexts.includes("events")
        ? cleaned.momentTypes.filter((value) => options.momentTypes.includes(value))
        : [],
      lifeLayers: cleaned.lifeLayers.filter((value) => options.lifeLayers.includes(value)),
    };
  }
  return cleaned;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function mondayOf(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function lastDayOfMonth(month: MonthKey) {
  const [year, monthNumber] = month.split("-").map(Number);
  return isoDate(new Date(Date.UTC(year, monthNumber, 0)));
}

export function weeklyExpenseSummaries(
  operations: Operation[],
  start: MonthKey,
  end: MonthKey,
  allOperations: Operation[],
) {
  const rangeStart = `${start}-01`;
  const rangeEnd = lastDayOfMonth(end);
  const firstMonday = mondayOf(rangeStart);
  const lastMonday = mondayOf(rangeEnd);
  const weeks: Array<{ weekStart: string; weekEnd: string; expenses: number }> = [];

  for (
    const cursor = new Date(firstMonday);
    cursor <= lastMonday;
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  ) {
    const weekStart = isoDate(cursor);
    const sunday = new Date(cursor);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    const weekEnd = isoDate(sunday);
    const expenses = operations
      .filter(
        (operation) =>
          isConsumptionExpense(operation) &&
          operation.date >= weekStart &&
          operation.date <= weekEnd &&
          operation.date >= rangeStart &&
          operation.date <= rangeEnd,
      )
      .reduce(
        (total, operation) => total + netExpenseAmount(operation, allOperations),
        0,
      );
    weeks.push({ weekStart, weekEnd, expenses });
  }
  return weeks;
}

