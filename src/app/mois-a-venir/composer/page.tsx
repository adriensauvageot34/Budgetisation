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
import { ComposerEditor } from "./composer-editor";
import { composerInteraction } from "./actions";
import { observeSnapshot } from "@/server/phase2/planner/snapshot-observation";
import { isArchivedRealizedMonth, isImportedRealizedMonth, JULY_COMPOSER_MONTH, reconstructedId } from "@/domain/phase2/planner/realized-month-entry";
import { julyPilotStatuses } from "@/domain/phase2/planner/july-pilot";
import { ArchivedRealizedMonth } from "./archived-realized-month";
import { JulyPilotMonth } from "./july-pilot-month";
import { realizedOperationCardId } from "./realized-card-view";
import { readComposerRealizedBoard } from "@/server/phase2/planner/read-composer-realized-board";
import { projectJulyPilot } from "@/server/phase2/planner/july-pilot";
import { reconstructJulyDraft } from "@/server/phase2/planner/reconstruct-july-draft";
export const dynamic = "force-dynamic";
export const metadata = { title: "Composer mon mois" };
export default async function ComposerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!plannerComposerEnabled()) notFound();
  const params = await searchParams;
  const month = typeof params.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/u.test(params.month) ? params.month : new Date().toISOString().slice(0, 7);
  const isReconstruction = month === JULY_COMPOSER_MONTH;
  async function readBoard() {
    return await readComposerRealizedBoard(month) ?? notFound();
  }
  if (isArchivedRealizedMonth(month) || isImportedRealizedMonth(month) && params.view !== "edition" || isReconstruction && params.view === "bilan") {
    const board = await withProductAuthentication(readBoard);
    const cardId = params.carte;
    const initialCardId = typeof cardId === "string" && board.cards.some(card => card.id === cardId ||
      card.payments.some(payment => realizedOperationCardId(payment.id) === cardId)) ? cardId : undefined;
    return <ArchivedRealizedMonth key={month} board={board} initialCardId={initialCardId} />;
  }
  if (isReconstruction && params.view !== "edition") {
    const source = await withProductAuthentication(readBoard);
    const board = projectJulyPilot(source);
    const initialStatus = julyPilotStatuses.find(status => status === params.statut);
    const cardId = params.carte;
    const initialCardId = typeof cardId === "string"
      ? board.cards.find(card => card.id === cardId)?.id
        ?? board.cards.find(card => card.pilotSourceId === cardId)?.id
        ?? (board.cards.some(card => card.payments.some(payment => realizedOperationCardId(payment.id) === cardId)) ? cardId : undefined)
      : undefined;
    const editableSourceIds = source.cards.filter(card => card.section !== "flows").map(card => card.id);
    return <JulyPilotMonth board={board} initialStatus={initialStatus} initialCardId={initialCardId}
      editableSourceIds={editableSourceIds} />;
  }
  const observed = await observeSnapshot(() => withProductAuthentication(async () => {
    const { deps, householdId, userId, supabase } = await authorizedPlanner({ readCacheMonth: month });
    const draftEnabled = composerDraftAutosaveEnabledFor(userId);
    const rootRelationAccess = !isReconstruction && draftEnabled ? {
      scopeKey: createHash("sha256").update(`${userId}:${householdId}:${month}`).digest("hex"), enabled: composerRootRelationsEnabled(),
    } : null;
    const readDrafts = () => draftEnabled ? readComposerDrafts({ supabase, userId, householdId }, month) : Promise.resolve(null);
    if (isReconstruction) {
      const realizedRead = readBoard();
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
  const julyPilot = reconstruction ? projectJulyPilot(reconstruction) : undefined;
  const initialEditCard = typeof params.carte === "string" && reconstruction?.cards.some(card => card.id === params.carte && card.section !== "flows")
    ? reconstructedId(month, params.carte) : undefined;
  return <><ComposerEditor key={rootRelationAccess?.scopeKey ?? month} rootRelationAccess={rootRelationAccess} initialModel={model} transport={composerInteraction} initialDrafts={drafts} snapshotMetrics={!!observed.metrics} previewHttp={process.env.COMPOSER_PREVIEW_HTTP_ENABLED === "1"}
    durableDraftHttp={!!drafts} reconstruction={reconstruction ?? undefined} julyPilot={julyPilot}
    initialEditCard={initialEditCard} />
    {observed.metrics && <span hidden data-snap-server={JSON.stringify(observed.metrics)} />}</>;
}
