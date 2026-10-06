import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerCardView, ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";

/** Pixel dimensions concern presentation only. They never enter a semantic mutation. */
export type InventoryItem = Readonly<{ id: string; kind: "CONTROL" | "CONTEXT"; span: number; width: number; height: number;
  control?: ComposerCardView; context?: ComposerContextCardView }>;
export function inventoryItems(model: ComposerUiModel): InventoryItem[] {
  const available = new Set(model.presentation.availableReservationRefs ?? []);
  const items: InventoryItem[] = [
    ...model.board.contexts.filter(c => !c.parentContextOccurrenceId).map(context => ({ id: context.contextOccurrenceId, kind: "CONTEXT" as const,
      span: 1, width: model.presentation.objects[context.contextOccurrenceId].variant === "COMPOSITE" ? 288 : 212, height: 218, context })),
    ...[...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings].filter(c => !available.has(c.targetRef))
      .map(control => ({ id: control.targetRef, kind: "CONTROL" as const, span: 1,
        width: control.kind === "SAVINGS" ? 236 : model.presentation.objects[control.targetRef].variant === "SIMPLE" ? 196 : 212, height: 154, control }))
  ];
  const lanes = ["HABIT", "COMPOSITE", "SIMPLE", "SAVINGS"] as const;
  const queues = lanes.map(variant => items.filter(item => model.presentation.objects[item.id].variant === variant));
  const packed: InventoryItem[] = [];
  // Stable round-robin is presentation only: a composite appears in the first row.
  while (queues.some(queue => queue.length)) for (const queue of queues) { const item = queue.shift(); if (item) packed.push(item); }
  return packed;
}
export function inventoryPages(items: readonly InventoryItem[], width: number, height: number): InventoryItem[][] {
  const availableHeight = Math.max(218, height), availableWidth = Math.max(212, Math.min(1330, width)), gap = 14;
  const pages: InventoryItem[][] = []; let page: InventoryItem[] = [], row: InventoryItem[] = [], used = 0, rowHeight = 0, consumed = 0, rows = 0;
  const finishRow = () => { page.push(...row); consumed += (consumed ? gap : 0) + rowHeight; rows++; row = []; used = 0; rowHeight = 0; };
  const finishPage = () => { if (page.length) pages.push(page); page = []; consumed = 0; rows = 0; };
  for (const item of items) {
    const itemWidth = Math.min(availableWidth, item.width);
    if (row.length && used + gap + itemWidth > availableWidth) finishRow();
    if (!row.length && rows === 3) finishPage();
    const candidateHeight = Math.max(rowHeight, item.height);
    if (consumed && consumed + gap + candidateHeight > availableHeight) { if (row.length) finishRow(); finishPage(); }
    row.push(item); used += (row.length > 1 ? gap : 0) + itemWidth; rowHeight = Math.max(rowHeight, item.height);
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
