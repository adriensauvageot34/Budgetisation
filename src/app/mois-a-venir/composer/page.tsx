import { notFound } from "next/navigation";
import { withProductAuthentication } from "@/app/product-query";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { composerDraftAutosaveEnabledFor } from "@/server/phase2/planner/composer-draft-cutover";
import { readMonthComposer } from "@/server/phase2/planner/read-model";
import { composerUiModel } from "@/server/phase2/planner/composer-service";
import { readComposerOpening } from "@/server/phase2/planner/composer-opening";
import { readComposerDrafts } from "@/server/phase2/planner/composer-draft-service";
import { plannerComposerEnabled } from "@/server/phase2/planner/cutover";
import { ComposerShell } from "./composer-shell";
import { composerInteraction } from "./actions";
import { observeSnapshot } from "@/server/phase2/planner/snapshot-observation";
export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";
export const metadata = { title: "Composer mon mois" };
export default async function ComposerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!plannerComposerEnabled()) notFound();
  const params = await searchParams;
  const month = typeof params.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/u.test(params.month) ? params.month : new Date().toISOString().slice(0, 7);
  const observed = await observeSnapshot(() => withProductAuthentication(async () => {
    const { deps, householdId, userId, supabase } = await authorizedPlanner();
    if (process.env.COMPOSER_P14_P1_READ_REUSE !== "0") return readComposerOpening(deps, householdId, month,
      () => composerDraftAutosaveEnabledFor(userId) ? readComposerDrafts({ supabase, userId, householdId }, month) : Promise.resolve(null));
    const drafts = composerDraftAutosaveEnabledFor(userId) ? await readComposerDrafts({ supabase, userId, householdId }, month) : null;
    const model = await composerUiModel(deps, householdId,
      await readMonthComposer(deps, householdId, month, drafts?.active?.semanticState));
    return { model, drafts };
  }));
  const { model, drafts } = observed.value;
  return <><ComposerShell initialModel={model} transport={composerInteraction} initialDrafts={drafts} snapshotMetrics={!!observed.metrics} previewHttp={process.env.COMPOSER_PREVIEW_HTTP_ENABLED === "1"}
    durableDraftHttp={!!drafts} />
    {observed.metrics && <span hidden data-snap-server={JSON.stringify(observed.metrics)} />}</>;
}
