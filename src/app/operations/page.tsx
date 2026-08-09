import type { Metadata } from "next";
import { getBudgetRepository } from "@/data";
import type {
  AnalyticalStatus,
  Importance,
  MonthKey,
} from "@/domain/budget";
import {
  OperationsTable,
  type OperationsInitialFilters,
} from "@/features/operations/operations-table";

export const metadata: Metadata = { title: "Opérations" };
export const dynamic = "force-dynamic";

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{
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
    returnTo?: string;
  }>;
}) {
  const query = await searchParams;
  const repository = await getBudgetRepository();
  const [months, operations, categories, accounts] = await Promise.all([
    repository.getMonths(),
    repository.getOperations(),
    repository.getCategories(),
    repository.getAccounts(),
  ]);
  const requestedMonth = query.month as MonthKey | undefined;
  const initialMonth = months.includes(requestedMonth ?? "")
    ? requestedMonth!
    : months.at(-1);
  const initialFilters: OperationsInitialFilters = {
    month: months.includes(query.month ?? "")
      ? (query.month as MonthKey)
      : undefined,
    startMonth: months.includes(query.start ?? "")
      ? (query.start as MonthKey)
      : undefined,
    endMonth: months.includes(query.end ?? "")
      ? (query.end as MonthKey)
      : undefined,
    category: query.category,
    subcategory: query.subcategory,
    person: query.person,
    accountId: query.account,
    importance: query.importance as Importance | undefined,
    recurrence: query.recurrence as "Fixe" | "Variable" | undefined,
    status: query.status as AnalyticalStatus | undefined,
    event: query.event,
    eventDetail: query.eventDetail,
    scope: ["all", "current", "events", "unconfirmed"].includes(
      query.context ?? query.scope ?? "",
    )
      ? ((query.context ?? query.scope) as
          | "all"
          | "current"
          | "events"
          | "unconfirmed")
      : undefined,
  };
  const returnTo = query.returnTo?.startsWith("/historique")
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
      initialMonth={initialMonth}
      initialFilters={initialFilters}
      returnTo={returnTo}
    />
  );
}
