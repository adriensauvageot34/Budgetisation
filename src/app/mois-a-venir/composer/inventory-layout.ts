import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerCardView, ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";

/** Pixel dimensions concern presentation only. They never enter a semantic mutation. */
export type InventoryItem = Readonly<{ id: string; kind: "CONTROL" | "CONTEXT"; span: number; height: number;
  control?: ComposerCardView; context?: ComposerContextCardView }>;
export function inventoryItems(model: ComposerUiModel): InventoryItem[] {
  const available = new Set(model.presentation.availableReservationRefs ?? []);
  return [
    ...model.board.contexts.filter(c => !c.parentContextOccurrenceId).map(context => ({ id: context.contextOccurrenceId, kind: "CONTEXT" as const,
      span: context.sockets.length > 4 ? 2 : 1, height: 260, context })),
    ...[...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings].filter(c => !available.has(c.targetRef))
      .map(control => ({ id: control.targetRef, kind: "CONTROL" as const, span: 1, height: 166, control }))
  ];
}
export function inventoryPages(items: readonly InventoryItem[], width: number, height: number): InventoryItem[][] {
  const columns = inventoryColumns(width), availableHeight = Math.max(242, height), gap = 13;
  const pages: InventoryItem[][] = []; let page: InventoryItem[] = [], row: InventoryItem[] = [], used = 0, rowHeight = 0, consumed = 0;
  const finishRow = () => { page.push(...row); consumed += (consumed ? gap : 0) + rowHeight; row = []; used = 0; rowHeight = 0; };
  const finishPage = () => { if (page.length) pages.push(page); page = []; consumed = 0; };
  for (const item of items) {
    const span = Math.min(columns, item.span);
    if (row.length && used + span > columns) finishRow();
    const candidateHeight = Math.max(rowHeight, item.height);
    if (consumed && consumed + gap + candidateHeight > availableHeight) { if (row.length) finishRow(); finishPage(); }
    row.push(item); used += span; rowHeight = Math.max(rowHeight, item.height);
  }
  if (row.length) finishRow(); finishPage(); return pages.length ? pages : [[]];
}
export const inventoryColumns = (width: number) => Math.max(2, Math.min(7, Math.floor((width + 13) / 223)));
export function inventoryPageFor(pages: readonly (readonly InventoryItem[])[], ref: string | null, model: ComposerUiModel) {
  if (!ref) return -1;
  let root = ref, context = model.board.contexts.find(c => c.contextOccurrenceId === ref);
  while (context?.parentContextOccurrenceId) { root = context.parentContextOccurrenceId; context = model.board.contexts.find(c => c.contextOccurrenceId === root); }
  return pages.findIndex(page => page.some(item => item.id === root));
}
