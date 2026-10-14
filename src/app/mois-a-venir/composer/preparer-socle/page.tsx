import { notFound } from "next/navigation";
import { plannerMonth } from "@/domain/phase2/planner/json";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { HistoryPreparation } from "../preparer-historique/preparation";
import { snapshotBenchmarkReadOnly } from "@/server/phase2/planner/snapshot-observation";
export const dynamic = "force-dynamic";
export default async function BasisPreparationPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  if (process.env.COMPOSER_P14_SNAP3_PREPARE_ENABLED !== "1") notFound();
  await authorizedPlanner();
  const month = plannerMonth((await searchParams).month);
  return <main><h1>Préparer le socle historique</h1><p>Préparation explicite des sorties historiques existantes. Aucun mois n’est appliqué.</p>
    <section><h2>Canonical économique</h2><HistoryPreparation month={month} securityChecks={snapshotBenchmarkReadOnly()} endpoint="historical-basis" /></section>
    <section><h2>Contextes M7</h2><HistoryPreparation month={month} securityChecks={snapshotBenchmarkReadOnly()} endpoint="historical-basis" owner="m7" /></section></main>;
}
