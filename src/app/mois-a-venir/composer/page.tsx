import { notFound } from "next/navigation";
import { createHash } from "node:crypto";
import { withProductAuthentication } from "@/app/product-query";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { composerDraftAutosaveEnabledFor } from "@/server/phase2/planner/composer-draft-cutover";
import { composerRootRelationsEnabled } from "@/server/phase2/planner/root-relation-cutover";
import { readMonthComposer } from "@/server/phase2/planner/read-model";
import { composerUiModel } from "@/server/phase2/planner/composer-service";
import { readComposerOpening } from "@/server/phase2/planner/composer-opening";
import { readRootRelationDurableDrafts } from "@/server/phase2/planner/root-relation-durable-service";
import { rootRelationDurableEnabled } from "@/server/phase2/planner/root-relation-durable-policy";
import { rootRelationFinancialReadSnapshot, type RootRelationDurableSnapshot } from "@/domain/phase2/planner/root-relation-durable-contract";
import { plannerComposerEnabled } from "@/server/phase2/planner/cutover";
import { ComposerShell } from "./composer-shell";
import { composerInteraction } from "./actions";
import { observeSnapshot } from "@/server/phase2/planner/snapshot-observation";
export const dynamic = "force-dynamic";
export const metadata = { title: "Composer mon mois" };
export default async function ComposerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!plannerComposerEnabled()) notFound();
  const params = await searchParams;
  const month = typeof params.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/u.test(params.month) ? params.month : new Date().toISOString().slice(0, 7);
  const observed = await observeSnapshot(() => withProductAuthentication(async () => {
    const { deps, householdId, userId, supabase } = await authorizedPlanner();
    const rootRelationAccess = composerDraftAutosaveEnabledFor(userId) ? {
      scopeKey: createHash("sha256").update(`${userId}:${householdId}:${month}`).digest("hex"), enabled: composerRootRelationsEnabled(),
      durable: rootRelationDurableEnabled(),
    } : null;
    let rootDrafts: RootRelationDurableSnapshot | null = null;
    const readDrafts = async () => {
      if (!composerDraftAutosaveEnabledFor(userId)) return null;
      rootDrafts = await readRootRelationDurableDrafts({ supabase, userId, householdId,
        admission: { userId, householdId, deps, editorEnabled: true } }, month);
      return rootRelationFinancialReadSnapshot(rootDrafts); // READ only; Shell receives full source separately.
    };
    if (process.env.COMPOSER_P14_P1_READ_REUSE !== "0") {
      const opening = await readComposerOpening(deps, householdId, month, readDrafts);
      return { ...opening, rootRelationAccess, rootDrafts };
    }
    const drafts = await readDrafts();
    const model = await composerUiModel(deps, householdId,
      await readMonthComposer(deps, householdId, month, drafts?.active?.semanticState));
    return { model, drafts, rootRelationAccess, rootDrafts };
  }));
  const { model, drafts, rootRelationAccess, rootDrafts } = observed.value;
  return <><ComposerShell key={rootRelationAccess?.scopeKey ?? month} rootRelationAccess={rootRelationAccess} initialModel={model} transport={composerInteraction} initialDrafts={drafts} snapshotMetrics={!!observed.metrics} previewHttp={process.env.COMPOSER_PREVIEW_HTTP_ENABLED === "1"}
    durableDraftHttp={!!drafts} initialRootDrafts={rootDrafts} />
    {observed.metrics && <span hidden data-snap-server={JSON.stringify(observed.metrics)} />}</>;
}
