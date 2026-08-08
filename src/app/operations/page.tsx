import type { Metadata } from "next";
import { getBudgetRepository } from "@/data";
import type { MonthKey } from "@/domain/budget";
import { OperationsTable } from "@/features/operations/operations-table";

export const metadata: Metadata = { title: "Opérations" };
export const dynamic = "force-dynamic";

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
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
    />
  );
}
