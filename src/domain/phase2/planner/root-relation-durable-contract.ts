import type { CompatibleStoredRootRelationDraft, RootRelationDraftSavePacket } from "./root-relation-draft-contract";
import type { ComposerDraftSnapshot } from "./composer-draft-contract";
import { rootRelationBaseState } from "./root-relation-state";
export type RootRelationDurableSnapshot = Readonly<{
  active: CompatibleStoredRootRelationDraft | null;
  archives: readonly CompatibleStoredRootRelationDraft[];
  activePlanRevisionId: string | null; activePlanRevisionNumber: number; baseStale: boolean;
}>;
export type RootRelationDurableReceipt = Readonly<{ contract: "composer-draft-http@2-root-relations";
  kind: "SAVE_RECEIPT"; draft: CompatibleStoredRootRelationDraft; replayed: boolean }>;
export type RootRelationDurableTransport = Readonly<{
  read(month: string): Promise<RootRelationDurableSnapshot>;
  save(packet: RootRelationDraftSavePacket): Promise<RootRelationDurableReceipt>;
}>;
/** Financial READ/publication only. The full snapshot always remains the durable source;
 * this projection must never be submitted to the historical V1 writer for an N1 Draft. */
export function rootRelationFinancialReadSnapshot(snapshot: RootRelationDurableSnapshot): ComposerDraftSnapshot {
  const read = (row: CompatibleStoredRootRelationDraft) => ({ ...row, semanticState: row.semanticState.version === "month-plan-state@v1"
    ? row.semanticState : rootRelationBaseState(row.semanticState) });
  return { ...snapshot, active: snapshot.active ? read(snapshot.active) : null, archives: snapshot.archives.map(read) };
}
