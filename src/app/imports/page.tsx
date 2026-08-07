import type { Metadata } from "next";
import { budgetRepository } from "@/data";
import { ImportsWorkspace } from "@/features/imports/imports-workspace";

export const metadata: Metadata = {
  title: "Imports",
};

export default function ImportsPage() {
  return <ImportsWorkspace batches={budgetRepository.getImportBatches()} />;
}
