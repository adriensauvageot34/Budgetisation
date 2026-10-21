import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { composePresentationNodes } from "./presentation/adapter";
import type { ComposerPresentationNode } from "./presentation/node-types";
import {presetForContext} from "@/domain/phase2/planner/composer-presets";
import {barSurface, type BarSurface, type InventoryAnchor} from "./bar-surface";

/** All geometry is a deterministic, transient CSS Grid projection. */
export type InventoryItem = ComposerPresentationNode;
export type InventoryPlacement = Readonly<{ item: InventoryItem; column: number; row: number; columnSpan: number; rowSpan: number }>;
export const inventoryItems = composePresentationNodes;
/** Geometry only. Current item data is rebound after reuse so a fresh amount,
 * knowledge, capability or socket projection cannot be hidden by this key. */
export function inventorySpatialKey(items: readonly InventoryItem[]) {
  return JSON.stringify(items.map(item => [item.id,item.kind,item.width,item.height,item.density,item.spatialFamily,
    item.kind === "CLUSTER" ? item.family : null]));
}
export function bindInventoryLayout(pages: readonly (readonly InventoryPlacement[])[], items: readonly InventoryItem[]): InventoryPlacement[][] {
  const current = new Map(items.map(item => [item.id,item]));
  return pages.map(page => page.map(placement => ({...placement,item:current.get(placement.item.id)!})));
}
export function inventoryMountedPage(index: number, active: number, departing: number, mode: "all" | "neighbors", pinned: ReadonlySet<number>) {
  return mode === "all" || pinned.has(index)
    || Math.abs(index-active) <= 1 || index >= Math.min(active,departing) && index <= Math.max(active,departing);
}
const columnGap = 10, rowGap = 5, rowTrack = 5;

// Finer tracks let three ordinary cards fit a ~710px shelf instead of
// rounding each 230px card up to ~260px. CSS and packing use the same cap.
export const inventoryColumns = (width: number) => Math.max(2, Math.min(18, Math.floor((Math.max(212, Math.min(1330, width)) + columnGap) / 76)));

export function inventoryLayoutPages(items: readonly InventoryItem[], width: number, height: number, expandedId?: string, expandedHeight = 520,
  options: { surface?: BarSurface; anchor?: InventoryAnchor; continuous?: boolean; previous?: readonly InventoryPlacement[] } = {}): InventoryPlacement[][] {
  const availableWidth = Math.max(212, Math.min(1330, width));
  const columns = inventoryColumns(availableWidth), columnWidth = (availableWidth - (columns - 1) * columnGap) / columns;
  // The measured viewport already excludes pagination and the palette.
  const maxTracks = Math.max(23, Math.floor((Math.max(218, height) - 8 + rowGap) / (rowTrack + rowGap)));
  const pages: InventoryPlacement[][] = [], occupancy: Set<number>[] = [];
  const ensurePage=(index:number)=>{while(pages.length<=index){pages.push([]);occupancy.push(new Set());}};
  const dimensions=(item:InventoryItem)=>{
    const livingBar=item.kind==="CONTEXT"&&!!item.context&&presetForContext(item.context)?.presetKey==="bar-apero", expanded=item.id===expandedId;
    const surface=options.surface??barSurface("summary",item.density==="RICH");
    const requestedWidth=expanded ? livingBar ? Math.min(surface.preferredWidth,availableWidth) : Math.min(760,availableWidth) : item.width;
    const columnSpan=Math.max(1,Math.min(columns,(livingBar&&expanded?Math.ceil:Math.round)((requestedWidth+columnGap)/(columnWidth+columnGap))
      +(item.kind==="CLUSTER"&&item.family==="BEAUTY"&&columns>=15?1:0)));
    const requested=Math.ceil(((expanded?expandedHeight:item.height)+rowGap)/(rowTrack+rowGap));
    return {columnSpan,rowSpan:Math.max(1,livingBar?requested:Math.min(maxTracks,requested)),livingBar};
  };
  if(options.continuous){
    const strip:InventoryPlacement[]=[],occupied=new Set<string>();
    const occupyStrip=(item:InventoryItem,column:number,row:number,columnSpan:number,rowSpan:number)=>{
      for(let y=row;y<row+rowSpan;y++)for(let x=column;x<column+columnSpan;x++)occupied.add(`${x}:${y}`);
      strip.push({item,column:column+1,row:row+1,columnSpan,rowSpan});
    };
    const pinned=items.find(item=>item.id===expandedId&&item.id===options.anchor?.id&&dimensions(item).livingBar);
    if(pinned&&options.anchor){const {columnSpan,rowSpan}=dimensions(pinned);
      occupyStrip(pinned,Math.max(0,options.anchor.column-1),Math.max(0,options.anchor.row-1),columnSpan,rowSpan);
    }
    const freeAt=(column:number,row:number,columnSpan:number,rowSpan:number)=>{
      for(let y=row;y<row+rowSpan;y++)for(let x=column;x<column+columnSpan;x++)if(occupied.has(`${x}:${y}`))return false;
      return true;
    };
    // During a living-card expansion keep each existing row and horizontal
    // order. Only collisions push right; closing uses the original compact pack.
    if(pinned&&options.previous)for(const prior of [...options.previous].sort((a,b)=>a.column-b.column||a.row-b.row)){
      const item=items.find(item=>item.id===prior.item.id);if(!item||item===pinned)continue;
      const {columnSpan,rowSpan}=dimensions(item),row=prior.row-1;let column=prior.column-1;
      while(!freeAt(column,row,columnSpan,rowSpan))column++;
      occupyStrip(item,column,row,columnSpan,rowSpan);
    }
    for(const item of items){
      if(strip.some(placed=>placed.item.id===item.id))continue;
      const {columnSpan,rowSpan}=dimensions(item),rowLimit=Math.max(maxTracks,rowSpan);
      let placed=false;
      // Keep the viewport-height shelf, then extend only as many columns as
      // needed. Stable input order and the same dimension contract as pages.
      for(let column=0;!placed;column++)for(let row=0;!placed&&row<=rowLimit-rowSpan;row++){
        let free=true;for(let y=row;free&&y<row+rowSpan;y++)for(let x=column;x<column+columnSpan;x++)if(occupied.has(`${x}:${y}`)){free=false;break;}
        if(free){occupyStrip(item,column,row,columnSpan,rowSpan);placed=true;}
      }
    }
    const order=new Map(items.map((item,index)=>[item.id,index]));
    return [strip.sort((a,b)=>order.get(a.item.id)!-order.get(b.item.id)!)];
  }
  const occupy=(index:number,item:InventoryItem,column:number,row:number,columnSpan:number,rowSpan:number)=>{
    ensurePage(index);
    for(let y=row;y<row+rowSpan;y++)for(let x=column;x<column+columnSpan;x++)occupancy[index].add(y*columns+x);
    pages[index].push({item,column:column+1,row:row+1,columnSpan,rowSpan});
  };
  const pinned=items.find(item=>item.id===expandedId&&item.id===options.anchor?.id&&dimensions(item).livingBar);
  // Reserve the active rectangle first. Neighbours flow around it in their
  // existing relative order. Only the active card may precede an earlier item;
  // no semantic order or identity is changed, and folding drops this reservation.
  if(pinned&&options.anchor){const {columnSpan,rowSpan}=dimensions(pinned),anchor=options.anchor;
    occupy(Math.max(0,anchor.page),pinned,Math.max(0,Math.min(anchor.column-1,columns-columnSpan)),Math.max(0,anchor.row-1),columnSpan,rowSpan);
  }
  let index=0;
  for(const item of items){
    if(item===pinned)continue;
    const {columnSpan,rowSpan}=dimensions(item),trackLimit=Math.max(maxTracks,rowSpan);
    let slot:{row:number;column:number}|null=null;
    while(!slot){
      ensurePage(index);const occupied=occupancy[index];
      for(let row=0;!slot&&row<=trackLimit-rowSpan;row++)for(let column=0;!slot&&column<=columns-columnSpan;column++){
        let free=true;for(let y=row;free&&y<row+rowSpan;y++)for(let x=column;x<column+columnSpan;x++)if(occupied.has(y*columns+x)){free=false;break;}
        if(free)slot={row,column};
      }
      if(!slot)index++;
    }
    occupy(index,item,slot.column,slot.row,columnSpan,rowSpan);
  }
  const order=new Map(items.map((item,index)=>[item.id,index]));
  return pages.length?pages.map(page=>page.sort((a,b)=>order.get(a.item.id)!-order.get(b.item.id)!)):[[]];
}

export function inventoryPages(items: readonly InventoryItem[], width: number, height: number): InventoryItem[][] {
  return inventoryLayoutPages(items, width, height).map(page => page.map(placement => placement.item));
}

export function inventoryRootRef(ref: string, model: ComposerUiModel) {
  let root = ref, context = model.board.contexts.find(c => c.contextOccurrenceId === ref);
  while (context?.parentContextOccurrenceId) { root = context.parentContextOccurrenceId; context = model.board.contexts.find(c => c.contextOccurrenceId === root); }
  return root;
}
export function inventoryPageFor(pages: readonly (readonly InventoryItem[])[], ref: string | null, model: ComposerUiModel) {
  if (!ref) return -1;
  const root = inventoryRootRef(ref, model);
  return pages.findIndex(page => page.some(item => item.id === root || item.kind === "CLUSTER" && item.children.some(child => child.id === root)));
}
