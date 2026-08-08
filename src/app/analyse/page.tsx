import type { Metadata } from "next";
import { getBudgetRepository } from "@/data";
import { AnalysisDashboard } from "@/features/analysis/analysis-dashboard";

export const metadata: Metadata = { title: "Analyse" };
export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
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

  return (
    <AnalysisDashboard
      months={months}
      operations={operations}
      categories={categories}
      accounts={accounts}
    />
  );
}
