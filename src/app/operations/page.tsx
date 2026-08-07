import type { Metadata } from "next";
import { budgetRepository } from "@/data";
import type { MonthKey } from "@/domain/budget";
import { OperationsTable } from "@/features/operations/operations-table";

export const metadata: Metadata = {
  title: "Opérations",
};

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const query = await searchParams;
  const months = budgetRepository.getMonths();
  const requestedMonth = query.month as MonthKey | undefined;
  const initialMonth = months.includes(requestedMonth as MonthKey)
    ? (requestedMonth as MonthKey)
    : months.at(-1)!;

  return (
    <OperationsTable
      months={months}
      operations={budgetRepository.getOperations()}
      categories={budgetRepository.getCategories()}
      accounts={budgetRepository.getAccounts()}
      initialMonth={initialMonth}
    />
  );
}
