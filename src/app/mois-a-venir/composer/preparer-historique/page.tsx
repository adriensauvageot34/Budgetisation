import { notFound } from "next/navigation";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { plannerMonth } from "@/domain/phase2/planner/json";
import { HistoryPreparation } from "./preparation";
import { snapshotBenchmarkReadOnly } from "@/server/phase2/planner/snapshot-observation";

export const dynamic = "force-dynamic";
export default async function Page({searchParams}: {searchParams: Promise<{month?:string}>}) {
  if (process.env.COMPOSER_P14_SNAP_PREPARE_ENABLED !== "1") notFound();
  await authorizedPlanner();
  const month = plannerMonth((await searchParams).month);
  return <main style={{maxWidth:640,margin:"4rem auto",padding:24}}>
    <h1>Préparer l’historique de Composer</h1>
    <p>Cette préparation actualise la lecture historique pour {month}. Elle ne modifie ni vos opérations, ni votre Plan, ni votre brouillon.</p>
    <HistoryPreparation month={month} securityChecks={snapshotBenchmarkReadOnly()}/>
  </main>;
}
