import { budgetRepository } from "@/data";
import type { MonthKey } from "@/domain/budget";
import { HomeDashboard } from "@/features/home/home-dashboard";

export default async function HomePage({
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
    <HomeDashboard
      months={months}
      operations={budgetRepository.getOperations()}
      categories={budgetRepository.getCategories()}
      accounts={budgetRepository.getAccounts()}
      initialMonth={initialMonth}
    />
  );
}
