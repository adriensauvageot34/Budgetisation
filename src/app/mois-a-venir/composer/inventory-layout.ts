import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { composePresentationNodes } from "./presentation/adapter";
import type { ComposerPresentationNode } from "./presentation/node-types";

/** Pixel dimensions concern presentation only. They never enter a semantic mutation. */
export type InventoryItem = ComposerPresentationNode;
export const inventoryItems = composePresentationNodes;
export function inventoryPages(items: readonly InventoryItem[], width: number, height: number): InventoryItem[][] {
  const availableHeight = Math.max(218, height), availableWidth = Math.max(212, Math.min(1330, width)), gap = 10;
  const pages: InventoryItem[][] = []; let page: InventoryItem[] = [], row: InventoryItem[] = [], used = 0, rowHeight = 0, consumed = 0;
  const finishRow = () => { page.push(...row); consumed += (consumed ? gap : 0) + rowHeight; row = []; used = 0; rowHeight = 0; };
  const finishPage = () => { if (page.length) pages.push(page); page = []; consumed = 0; };
  for (const item of items) {
    const itemWidth = Math.min(availableWidth, item.width);
    if (row.length && used + gap + itemWidth > availableWidth) finishRow();
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
  return pages.findIndex(page => page.some(item => item.id === root || item.kind === "CLUSTER" && item.children.some(child => child.id === root)));
}
