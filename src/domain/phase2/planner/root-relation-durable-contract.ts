import type { CompatibleStoredRootRelationDraft, RootRelationDraftSavePacket } from "./root-relation-draft-contract";
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
