import type { Metadata } from "next";
import { getBudgetRepository } from "@/data";
import type {
  AnalyticalStatus,
  Importance,
  LifeLayer,
  MonthKey,
  Recurrence,
  ResourceType,
} from "@/domain/budget";
import {
  defaultHistoryFilters,
  type HistoryContext,
  type HistoryFilters,
  type HistoryFlow,
} from "@/domain/history-filters";
import {
  OperationsTable,
  type OperationsInitialFilters,
} from "@/features/operations/operations-table";

export const metadata: Metadata = { title: "Opérations" };
export const dynamic = "force-dynamic";

type OperationsQuery = {
  month?: string;
  start?: string;
  end?: string;
  category?: string;
  subcategory?: string;
  person?: string;
  account?: string;
  importance?: string;
  recurrence?: string;
  status?: string;
  event?: string;
  eventDetail?: string;
  scope?: string;
  context?: string;
  flux?: string;
  families?: string;
  categories?: string;
  merchants?: string;
  statuses?: string;
  contexts?: string;
  events?: string;
  eventDetails?: string;
  resourceTypes?: string;
  importances?: string;
  recurrences?: string;
  moments?: string;
  momentTypes?: string;
  lifeLayers?: string;
  returnTo?: string;
  selectForRefund?: string;
  operationIds?: string;
};

const flowValues: HistoryFlow[] = ["expenses", "inflows"];
const statusValues: AnalyticalStatus[] = ["Habituel", "Exceptionnel", "Hors budget", "À ventiler"];
const contextValues: HistoryContext[] = ["current", "events", "unconfirmed"];
const resourceTypeValues: ResourceType[] = ["Revenu", "Entrée d'argent", "Remboursement", "Transfert interne", "Flux technique", "À qualifier"];
const importanceValues: Importance[] = ["Indispensable", "Contrainte", "Ajustable", "Optionnelle"];
const recurrenceValues: Recurrence[] = ["Fixe", "Variable"];
const lifeLayerValues: LifeLayer[] = ["Routine", "Moment", "Ponctuel", "Imprévu", "À confirmer"];

function list(value?: string) {
  return value?.split(",").map((entry) => entry.trim()).filter(Boolean) ?? [];
}

function enumList<T extends string>(value: string | undefined, allowed: T[]) {
  return list(value).filter((entry): entry is T => allowed.includes(entry as T));
}

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<OperationsQuery>;
}) {
  const query = await searchParams;
  const repository = await getBudgetRepository();
  const [months, operations, categories, accounts, moments, allocations] = await Promise.all([
    repository.getMonths(),
    repository.getOperations(),
    repository.getCategories(),
    repository.getAccounts(),
    repository.getMoments(),
    repository.getOperationAllocations(),
  ]);
  const requestedMonth = query.month as MonthKey | undefined;
  const initialMonth = months.includes(requestedMonth ?? "")
    ? requestedMonth!
    : months.at(-1);
  const hasHistoryContext = Boolean(
    query.start || query.end || query.flux || query.families || query.categories ||
    query.merchants || query.statuses || query.contexts || query.events ||
    query.eventDetails || query.resourceTypes || query.importances || query.recurrences ||
    query.moments || query.momentTypes || query.lifeLayers,
  );
  const flows = enumList(query.flux, flowValues);
  const historyFilters: HistoryFilters | undefined = hasHistoryContext
    ? {
        ...defaultHistoryFilters,
        flows: flows.length ? flows : defaultHistoryFilters.flows,
        families: list(query.families),
        categories: list(query.categories),
        merchants: list(query.merchants),
        statuses: enumList(query.statuses, statusValues),
        contexts: enumList(query.contexts, contextValues),
        events: list(query.events),
        eventDetails: list(query.eventDetails),
        resourceTypes: enumList(query.resourceTypes, resourceTypeValues),
        importances: enumList(query.importances, importanceValues),
        recurrences: enumList(query.recurrences, recurrenceValues),
        moments: list(query.moments),
        momentTypes: list(query.momentTypes),
        lifeLayers: enumList(query.lifeLayers, lifeLayerValues),
      }
    : undefined;
  const initialFilters: OperationsInitialFilters = {
    month: months.includes(query.month ?? "") ? (query.month as MonthKey) : undefined,
    startMonth: months.includes(query.start ?? "") ? (query.start as MonthKey) : undefined,
    endMonth: months.includes(query.end ?? "") ? (query.end as MonthKey) : undefined,
    category: query.category,
    subcategory: query.subcategory,
    person: query.person,
    accountId: query.account,
    importance: query.importance as Importance | undefined,
    recurrence: query.recurrence as Recurrence | undefined,
    status: query.status as AnalyticalStatus | undefined,
    event: query.event,
    eventDetail: query.eventDetail,
    scope: ["all", "current", "events", "unconfirmed"].includes(query.context ?? query.scope ?? "")
      ? ((query.context ?? query.scope) as "all" | "current" | "events" | "unconfirmed")
      : undefined,
    historyFilters,
    operationIds: list(query.operationIds),
  };
  const returnTo = query.returnTo?.startsWith("/historique") || query.returnTo?.startsWith("/?")
    ? query.returnTo
    : undefined;

  if (!initialMonth) {
    return <p className="card p-6">Aucune opération disponible.</p>;
  }

  return (
    <OperationsTable
      months={months}
      operations={operations}
      categories={categories}
      accounts={accounts}
      moments={moments}
      allocations={allocations}
      initialMonth={initialMonth}
      initialFilters={initialFilters}
      returnTo={returnTo}
      selectForRefund={query.selectForRefund}
    />
  );
}

