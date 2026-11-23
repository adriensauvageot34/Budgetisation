import { notFound } from "next/navigation";
import { createHash } from "node:crypto";
import { withProductAuthentication } from "@/app/product-query";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { composerDraftAutosaveEnabledFor } from "@/server/phase2/planner/composer-draft-cutover";
import { composerRootRelationsEnabled } from "@/server/phase2/planner/root-relation-cutover";
import { readMonthComposer } from "@/server/phase2/planner/read-model";
import { composerUiModel } from "@/server/phase2/planner/composer-service";
import { readComposerOpening } from "@/server/phase2/planner/composer-opening";
import { readComposerDrafts } from "@/server/phase2/planner/composer-draft-service";
import { plannerComposerEnabled } from "@/server/phase2/planner/cutover";
import { ComposerShell } from "./composer-shell";
import { composerInteraction } from "./actions";
import { observeSnapshot } from "@/server/phase2/planner/snapshot-observation";
import { isRealized2025Month, JULY_COMPOSER_MONTH } from "@/domain/phase2/planner/realized-month-entry";
import { ArchivedRealizedMonth } from "./archived-realized-month";
import { readRealizedMonth } from "@/server/phase2/planner/realized-month";
import { reconstructJulyDraft } from "@/server/phase2/planner/reconstruct-july-draft";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { parseYearMonth } from "@/core/time";
export const dynamic = "force-dynamic";
export const metadata = { title: "Composer mon mois" };
export default async function ComposerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!plannerComposerEnabled()) notFound();
  const params = await searchParams;
  const month = typeof params.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/u.test(params.month) ? params.month : new Date().toISOString().slice(0, 7);
  if (isRealized2025Month(month)) {
    const board = await withProductAuthentication(async () => {
      const context = await getBootstrapContext();
      if (!context.household) notFound();
      return readRealizedMonth(context, parseYearMonth(month));
    });
    return <ArchivedRealizedMonth board={board} />;
  }
  const isReconstruction = month === JULY_COMPOSER_MONTH;
  const observed = await observeSnapshot(() => withProductAuthentication(async () => {
    const { deps, householdId, userId, supabase } = await authorizedPlanner();
    const draftEnabled = composerDraftAutosaveEnabledFor(userId);
    const rootRelationAccess = !isReconstruction && draftEnabled ? {
      scopeKey: createHash("sha256").update(`${userId}:${householdId}:${month}`).digest("hex"), enabled: composerRootRelationsEnabled(),
    } : null;
    const readDrafts = () => draftEnabled ? readComposerDrafts({ supabase, userId, householdId }, month) : Promise.resolve(null);
    if (isReconstruction) {
      const realizedRead = getBootstrapContext().then(context => readRealizedMonth(context, parseYearMonth(month)));
      const [opening, reconstruction] = await Promise.all([
        readComposerOpening(deps, householdId, month, readDrafts, async () => reconstructJulyDraft(await realizedRead)),
        realizedRead,
      ]);
      return { ...opening, rootRelationAccess, reconstruction };
    }
    if (process.env.COMPOSER_P14_P1_READ_REUSE !== "0") return {
      ...await readComposerOpening(deps, householdId, month, readDrafts), rootRelationAccess, reconstruction: null,
    };
    const drafts = await readDrafts();
    const model = await composerUiModel(deps, householdId,
      await readMonthComposer(deps, householdId, month, drafts?.active?.semanticState));
    return { model, drafts, rootRelationAccess, reconstruction: null };
  }));
  const { model, drafts, rootRelationAccess, reconstruction } = observed.value;
  return <><ComposerShell key={rootRelationAccess?.scopeKey ?? month} rootRelationAccess={rootRelationAccess} initialModel={model} transport={composerInteraction} initialDrafts={drafts} snapshotMetrics={!!observed.metrics} previewHttp={process.env.COMPOSER_PREVIEW_HTTP_ENABLED === "1"}
    durableDraftHttp={!!drafts} reconstruction={reconstruction ?? undefined} initialReconstructionEditing={isReconstruction && params.view === "edition"} />
    {observed.metrics && <span hidden data-snap-server={JSON.stringify(observed.metrics)} />}</>;
}
