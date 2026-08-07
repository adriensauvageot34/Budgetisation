import type { Metadata } from "next";
import { budgetRepository } from "@/data";
import { AnalysisDashboard } from "@/features/analysis/analysis-dashboard";

export const metadata: Metadata = {
  title: "Analyse",
};

export default function AnalysisPage() {
  return (
    <AnalysisDashboard
      months={budgetRepository.getMonths()}
      operations={budgetRepository.getOperations()}
      categories={budgetRepository.getCategories()}
      accounts={budgetRepository.getAccounts()}
    />
  );
}
