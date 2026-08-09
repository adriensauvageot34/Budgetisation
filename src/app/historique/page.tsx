import type { Metadata } from "next";
import { getBudgetRepository } from "@/data";
import type {
  AnalyticalStatus,
  Importance,
  MonthKey,
  Recurrence,
} from "@/domain/budget";
import {
  HistoryDashboard,
  type HistoryInitialContext,
} from "@/features/history/history-dashboard";

export const metadata: Metadata = { title: "Historique" };
export const dynamic = "force-dynamic";

type HistoryQuery = {
  detail?: string;
  view?: string;
  month?: string;
  start?: string;
  end?: string;
  person?: string;
  account?: string;
  category?: string;
  subcategory?: string;
  importance?: string;
  recurrence?: string;
  status?: string;
  context?: string;
  event?: string;
  eventDetail?: string;
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<HistoryQuery>;
}) {
  const query = await searchParams;
  const repository = await getBudgetRepository();
  const [months, operations, categories, accounts] = await Promise.all([
    repository.getMonths(),
    repository.getOperations(),
    repository.getCategories(),
    repository.getAccounts(),
  ]);
  if (!months.length) {
    return <p className="card p-6">Aucune opération disponible.</p>;
  }

  const context: HistoryInitialContext = {
    detail: query.detail === "1",
    view: query.view === "month" ? "month" : "period",
    month: months.includes(query.month ?? "")
      ? (query.month as MonthKey)
      : months.at(-1),
    start: months.includes(query.start ?? "")
      ? (query.start as MonthKey)
      : months[0],
    end: months.includes(query.end ?? "")
      ? (query.end as MonthKey)
      : months.at(-1),
    person: query.person,
    account: query.account,
    category: query.category,
    subcategory: query.subcategory,
    importance: ["Indispensable", "Contrainte", "Ajustable", "Optionnelle"].includes(query.importance ?? "")
      ? (query.importance as Importance)
      : undefined,
    recurrence: ["Fixe", "Variable"].includes(query.recurrence ?? "")
      ? (query.recurrence as Recurrence)
      : undefined,
    status: ["Habituel", "Exceptionnel", "Hors budget", "À ventiler"].includes(query.status ?? "")
      ? (query.status as AnalyticalStatus)
      : undefined,
    context: ["current", "events", "unconfirmed"].includes(query.context ?? "")
      ? (query.context as "current" | "events" | "unconfirmed")
      : undefined,
    event: query.event,
    eventDetail: query.eventDetail,
  };

  return (
    <HistoryDashboard
      key={JSON.stringify(context)}
      months={months}
      operations={operations}
      categories={categories}
      accounts={accounts}
      initialContext={context}
    />
  );
}
