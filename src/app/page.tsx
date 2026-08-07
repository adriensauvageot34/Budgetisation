import { getBudgetRepository } from "@/data";
import type { MonthKey } from "@/domain/budget";
import { HomeDashboard } from "@/features/home/home-dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage({
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
    return (
      <section className="card p-6">
        <h1 className="text-2xl font-black">Aucune opération disponible</h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Exécutez le bootstrap Supabase ou utilisez la page Imports.
        </p>
      </section>
    );
  }

  return (
    <HomeDashboard
      months={months}
      operations={operations}
      categories={categories}
      accounts={accounts}
      initialMonth={initialMonth}
    />
  );
}
