import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { composePresentationNodes } from "./presentation/adapter";
import type { ComposerPresentationNode } from "./presentation/node-types";

/** All geometry is a deterministic, transient CSS Grid projection. */
export type InventoryItem = ComposerPresentationNode;
export type InventoryPlacement = Readonly<{ item: InventoryItem; column: number; row: number; columnSpan: number; rowSpan: number }>;
export const inventoryItems = composePresentationNodes;
const columnGap = 10, rowGap = 5, rowTrack = 5;

export const inventoryColumns = (width: number) => Math.max(2, Math.min(16, Math.floor((Math.max(212, width) + columnGap) / 83)));

export function inventoryLayoutPages(items: readonly InventoryItem[], width: number, height: number): InventoryPlacement[][] {
  const availableWidth = Math.max(212, Math.min(1330, width));
  const columns = inventoryColumns(availableWidth), columnWidth = (availableWidth - (columns - 1) * columnGap) / columns;
  // Reserve room for intrinsic context content and the carousel's quiet bottom edge.
  const maxTracks = Math.max(23, Math.floor((Math.max(218, height) - 35 + rowGap) / (rowTrack + rowGap)));
  const pages: InventoryPlacement[][] = [];
  let page: InventoryPlacement[] = [], occupied = new Set<number>();
  const flushPage = () => { if (page.length) pages.push(page); page = []; occupied = new Set(); };
  for (const item of items) {
    const columnSpan = Math.max(1, Math.min(columns, Math.round((item.width + columnGap) / (columnWidth + columnGap))
      + (item.kind === "CLUSTER" && item.family === "BEAUTY" && columns >= 15 ? 1 : 0)));
    const rowSpan = Math.max(1, Math.min(maxTracks, Math.ceil((item.height + rowGap) / (rowTrack + rowGap))));
    const findSlot = () => {
      for (let row = 0; row <= maxTracks - rowSpan; row++) for (let column = 0; column <= columns - columnSpan; column++) {
        let free = true;
        for (let y = row; free && y < row + rowSpan; y++) for (let x = column; x < column + columnSpan; x++)
          if (occupied.has(y * columns + x)) { free = false; break; }
        if (free) return { row, column };
      }
      return null;
    };
    let slot = findSlot();
    if (!slot) { flushPage(); slot = findSlot(); }
    if (!slot) throw new Error(`Inventory item exceeds page geometry: ${item.id}`);
    for (let y = slot.row; y < slot.row + rowSpan; y++) for (let x = slot.column; x < slot.column + columnSpan; x++) occupied.add(y * columns + x);
    page.push({ item, column:slot.column + 1, row:slot.row + 1, columnSpan, rowSpan });
  }
  flushPage();
  return pages.length ? pages : [[]];
}

export function inventoryPages(items: readonly InventoryItem[], width: number, height: number): InventoryItem[][] {
  return inventoryLayoutPages(items, width, height).map(page => page.map(placement => placement.item));
}

export function inventoryPageFor(pages: readonly (readonly InventoryItem[])[], ref: string | null, model: ComposerUiModel) {
  if (!ref) return -1;
  let root = ref, context = model.board.contexts.find(c => c.contextOccurrenceId === ref);
  while (context?.parentContextOccurrenceId) { root = context.parentContextOccurrenceId; context = model.board.contexts.find(c => c.contextOccurrenceId === root); }
  return pages.findIndex(page => page.some(item => item.id === root || item.kind === "CLUSTER" && item.children.some(child => child.id === root)));
}
