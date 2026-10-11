import { notFound } from "next/navigation";
import { withProductAuthentication } from "@/app/product-query";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { readMonthComposer } from "@/server/phase2/planner/read-model";
import { composerUiModel } from "@/server/phase2/planner/composer-service";
import { plannerComposerEnabled } from "@/server/phase2/planner/cutover";
import { ComposerShell } from "./composer-shell";
import { composerInteraction } from "./actions";
import { composerDraftRead, composerDraftSave, composerDraftArchive, composerDraftRestore } from "./draft-actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Composer mon mois" };
export default async function ComposerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!plannerComposerEnabled()) notFound();
  const params = await searchParams;
  const month = typeof params.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/u.test(params.month) ? params.month : new Date().toISOString().slice(0, 7);
  const { model, drafts } = await withProductAuthentication(async () => {
    const { deps, householdId } = await authorizedPlanner();
    const drafts = process.env.COMPOSER_DRAFT_AUTOSAVE_ENABLED === "true" ? await composerDraftRead(month) : null;
    const model = await composerUiModel(deps, householdId,
      await readMonthComposer(deps, householdId, month, drafts?.active?.semanticState));
    return { model, drafts };
  });
  return <ComposerShell initialModel={model} transport={composerInteraction} initialDrafts={drafts}
    draftTransport={drafts ? { read: composerDraftRead, save: composerDraftSave,
      archive: composerDraftArchive, restore: composerDraftRestore } : null} />;
}
