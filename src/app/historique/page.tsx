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
  HistoryRangeDashboard,
  type HistoryRangeContext,
} from "@/features/history/history-range-dashboard";

export const metadata: Metadata = { title: "Historique" };
export const dynamic = "force-dynamic";

type HistoryQuery = {
  detail?: string;
  detailLabel?: string;
  view?: string;
  month?: string;
  start?: string;
  end?: string;
  flux?: string;
  families?: string;
  categories?: string;
  merchants?: string;
  statuses?: string;
  contexts?: string;
  events?: string;
  eventDetails?: string;
  moments?: string;
  momentTypes?: string;
  lifeLayers?: string;
  resourceTypes?: string;
  importances?: string;
  recurrences?: string;
  category?: string;
  subcategory?: string;
  importance?: string;
  recurrence?: string;
  status?: string;
  context?: string;
  event?: string;
  eventDetail?: string;
};

const flowValues: HistoryFlow[] = ["expenses", "inflows"];
const statusValues: AnalyticalStatus[] = [
  "Habituel",
  "Exceptionnel",
  "Hors budget",
  "À ventiler",
];
const contextValues: HistoryContext[] = ["current", "events", "unconfirmed"];
const resourceTypeValues: ResourceType[] = [
  "Revenu",
  "Entrée d'argent",
  "Remboursement",
  "Transfert interne",
  "Flux technique",
  "À qualifier",
];
const importanceValues: Importance[] = [
  "Indispensable",
  "Contrainte",
  "Ajustable",
  "Optionnelle",
];
const recurrenceValues: Recurrence[] = ["Fixe", "Variable"];
const lifeLayerValues: LifeLayer[] = ["Routine", "Moment", "Ponctuel", "Imprévu", "À confirmer"];

function list(value?: string) {
  return value?.split(",").map((entry) => entry.trim()).filter(Boolean) ?? [];
}

function enumList<T extends string>(value: string | undefined, allowed: T[]) {
  return list(value).filter((entry): entry is T => allowed.includes(entry as T));
}

function legacyValue(current: string | undefined, legacy: string | undefined) {
  const values = list(current);
  return values.length ? values : legacy ? [legacy] : [];
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<HistoryQuery>;
}) {
  const query = await searchParams;
  const repository = await getBudgetRepository();
  const [months, operations, moments, allocations] = await Promise.all([
    repository.getMonths(),
    repository.getOperations(),
    repository.getMoments(),
    repository.getOperationAllocations(),
  ]);

  let start = months.includes(query.start ?? "")
    ? (query.start as MonthKey)
    : undefined;
  let end = months.includes(query.end ?? "")
    ? (query.end as MonthKey)
    : undefined;
  if ((!start || !end) && months.includes(query.month ?? "")) {
    start = query.month as MonthKey;
    end = query.month as MonthKey;
  } else if ((!start || !end) && query.view === "period" && months.length) {
    start = months[0];
    end = months.at(-1);
  } else if ((!start || !end) && query.view === "month" && months.length) {
    start = months.at(-1);
    end = months.at(-1);
  }
  if (start && end && start > end) [start, end] = [end, start];

  const explicitFlows = enumList(query.flux, flowValues);
  const filters: HistoryFilters = {
    ...defaultHistoryFilters,
    flows: explicitFlows.length ? explicitFlows : defaultHistoryFilters.flows,
    families: legacyValue(query.families, query.category),
    categories: legacyValue(query.categories, query.subcategory),
    merchants: list(query.merchants),
    statuses: enumList(query.statuses ?? query.status, statusValues),
    contexts: enumList(query.contexts ?? query.context, contextValues),
    events: legacyValue(query.events, query.event),
    eventDetails: legacyValue(query.eventDetails, query.eventDetail),
    resourceTypes: enumList(query.resourceTypes, resourceTypeValues),
    importances: enumList(query.importances ?? query.importance, importanceValues),
    recurrences: enumList(query.recurrences ?? query.recurrence, recurrenceValues),
    moments: list(query.moments),
    momentTypes: list(query.momentTypes),
    lifeLayers: enumList(query.lifeLayers, lifeLayerValues),
  };
  const context: HistoryRangeContext = {
    start,
    end,
    detail: query.detail === "1",
    detailLabel: query.detailLabel,
    filters,
  };

  return (
    <HistoryRangeDashboard
      key={JSON.stringify(context)}
      months={months}
      operations={operations}
      moments={moments}
      allocations={allocations}
      initialContext={context}
    />
  );
}

