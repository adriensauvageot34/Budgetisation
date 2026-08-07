import type { Metadata } from "next";
import { getBudgetRepository } from "@/data";
import { ImportsWorkspace } from "@/features/imports/imports-workspace";

export const metadata: Metadata = { title: "Imports" };
export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const repository = await getBudgetRepository();
  return <ImportsWorkspace batches={await repository.getImportBatches()} />;
}
