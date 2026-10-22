"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { inventoryItems, inventoryLayoutPages, inventoryPageFor, inventoryRootRef, inventoryColumns, inventorySpatialKey, bindInventoryLayout, inventoryMountedPage, type InventoryItem } from "./inventory-layout";
import { useComposerInteractions } from "./interactions";
import styles from "./composer.module.css";
import {barSurface,barOpeningScroll, type BarSurface, type InventoryAnchor} from "./bar-surface";
import type {InventoryPlacement} from "./inventory-layout";
const boardScrollBehavior=():ScrollBehavior=>matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';

export function BoardCarousel({ model, inventory, focused, render, emptyClick, children, dropProps, revealSequence, revealFocused, expandedId }: { model: ComposerUiModel; inventory?: readonly InventoryItem[]; focused: string | null;
  expandedId?: string; revealSequence?: number; revealFocused?: () => void;
  render: (item: InventoryItem) => ReactNode; emptyClick: () => void; children?: ReactNode; dropProps: React.HTMLAttributes<HTMLDivElement> & { [key: `data-${string}`]: boolean | string | number | undefined } }) {
  const viewport = useRef<HTMLDivElement>(null), [size, setSize] = useState({ width: 1000, height: 470 }), [page, setPage] = useState(0);
  const reception=useRef({enabled:false,mutations:0,resizes:0,measures:0,repacks:0});
  useEffect(()=>{reception.current.enabled=typeof window!=='undefined'&&new URLSearchParams(window.location?.search??'').get('barProbe')==='1';},[]);
  const note=(phase:'mutations'|'resizes'|'measures'|'repacks')=>{
    if(!reception.current.enabled)return;
    reception.current[phase]++;
    if(viewport.current)viewport.current.dataset.barLayoutProbe=JSON.stringify(reception.current);
  };
  const [expandedMeasure, setExpandedMeasure] = useState<{ id: string; height: number; surface: BarSurface; checkpoint: string } | null>(null);
  const [compactBarHeights,setCompactBarHeights]=useState<Readonly<Record<string,number>>>({});
  const interaction = useComposerInteractions(), dwell = useRef<ReturnType<typeof setTimeout> | null>(null), dwellEdge = useRef<number | null>(null);
  const projected = useMemo(() => inventory ?? inventoryItems(model), [model,inventory]);
  const stableItems = useRef(projected), stableSize = useRef(size), stableExpanded = useRef(expandedId);
  const stableExpandedHeight = useRef<number | undefined>(undefined);
  const dragging = !!interaction?.grabbed;
  const measuredItems=useMemo(()=>projected.map(item=>compactBarHeights[item.id]&&item.id!==expandedId?{...item,height:compactBarHeights[item.id]}:item),[projected,compactBarHeights,expandedId]);
  const items = dragging ? stableItems.current : measuredItems, layoutSize = dragging ? stableSize.current : size;
  const spatialKey = inventorySpatialKey(items);
  // The existing shelf observer is the only height budget. Never enlarge it
  // to fit a card: normal scenes compact; exceptional tasks scroll locally.
  const shelfHeight=Math.max(195,Math.floor((layoutSize.height+5)/10)*10-5);
  const expandedHeight = dragging ? stableExpandedHeight.current : expandedId ? Math.min(shelfHeight,expandedMeasure?.id===expandedId?expandedMeasure.height:520) : undefined;
  const previousGeometry=useRef<readonly (readonly InventoryPlacement[])[]>([]), activeAnchor=useRef<InventoryAnchor|undefined>(undefined);
  const originPage=previousGeometry.current.findIndex(p=>p.some(box=>box.item.id===expandedId));
  const origin=previousGeometry.current[originPage]?.find(box=>box.item.id===expandedId);
  // At explicit opening choose a usable local origin if the closed card was
  // near the bottom. Once established, this anchor survives fine edits.
  const anchor=expandedId ? activeAnchor.current?.id===expandedId ? activeAnchor.current
    : {id:expandedId,page:0,column:origin?.column??1,row:1} : undefined;
  const surface=expandedMeasure&&expandedMeasure.id===expandedId?expandedMeasure.surface:undefined;
  const geometry = useMemo(() => inventoryLayoutPages(items, layoutSize.width, layoutSize.height, dragging ? stableExpanded.current : expandedId, expandedHeight,{surface,anchor,continuous:true}), [spatialKey,layoutSize.width,layoutSize.height,dragging,expandedId,expandedHeight,surface,anchor?.id,anchor?.page,anchor?.column,anchor?.row]);
  useLayoutEffect(()=>{
    previousGeometry.current=geometry;
    if(!expandedId){activeAnchor.current=undefined;return;}
    const index=geometry.findIndex(p=>p.some(box=>box.item.id===expandedId)),box=geometry[index]?.find(box=>box.item.id===expandedId);
    if(box)activeAnchor.current={id:expandedId,page:index,column:box.column,row:box.row};
  },[geometry,expandedId]);
  useLayoutEffect(()=>note('repacks'),[geometry]);
  const layouts = useMemo(() => bindInventoryLayout(geometry,items), [geometry,items]);
  const pages = useMemo(() => layouts.map(layout => layout.map(placement => placement.item)), [layouts]);
  useLayoutEffect(() => { if (!dragging) { stableItems.current = measuredItems; stableSize.current = size; stableExpanded.current = expandedId; stableExpandedHeight.current = expandedHeight; } }, [dragging, measuredItems, size, expandedId, expandedHeight]);
  const active = Math.min(page, pages.length - 1), previousIds = useRef(new Set(items.map(item => item.id)));
  const [departing,setDeparting] = useState(0), [dirtyItems,setDirtyItems] = useState<readonly string[]>([]);
  const [dragOrigin,setDragOrigin] = useState<number|null>(null);
  // On a small Board the mount/unmount bookkeeping costs more than the
  // invisible cards. Keep the full page tree until it becomes dense.
  const mode = process.env.NEXT_PUBLIC_COMPOSER_P14_P4A_PAGES === "0" || items.length < 24 ? "all" : "neighbors";
  const pinned = new Set(layouts.flatMap((layout,index) => layout.some(p => dirtyItems.includes(p.item.id)) ? [index] : []));
  if (dragOrigin !== null && dragging) pinned.add(dragOrigin);
  const captureDirty = () => {
    const ids=[...viewport.current?.querySelectorAll<HTMLElement>("[data-inline-dirty=true]") ?? []]
      .map(node => node.closest<HTMLElement>("[data-inventory-id]")?.dataset.inventoryId).filter((id):id is string => !!id).sort();
    setDirtyItems(old => old.length === ids.length && old.every((id,i) => id === ids[i]) ? old : ids);
  };
  const previousScene = useRef<{ page:number; expandedId?:string; hasLivingBar?:boolean; rects:Map<string, DOMRect>; clusters:Map<string, readonly string[]> }>({ page:-1, rects:new Map(), clusters:new Map() });
  const cancelDwell = () => { if (dwell.current) { clearTimeout(dwell.current); dwell.current = null; } };
  const browsing = useRef(false);
  const go = (next: number, manual = true) => { browsing.current = manual; cancelDwell(); captureDirty(); document.querySelectorAll<HTMLElement>("[popover]:popover-open").forEach(p => p.hidePopover()); setDeparting(active); setPage(Math.max(0, Math.min(pages.length - 1, next))); };
  useEffect(() => { const timer=setTimeout(()=>setDeparting(active),300);return()=>clearTimeout(timer); },[active]);
  useLayoutEffect(captureDirty,[model]);
  useLayoutEffect(()=>{
    if(dragging||!viewport.current)return;
    const board=viewport.current;let lastSignature='';
    // Measure intrinsic children, not the stretched grid cell: otherwise the
    // reserved height feeds back into itself and can never shrink on folding.
    const cards=()=>[...board.querySelectorAll<HTMLElement>('[data-bar-living-card][data-expanded="false"]')];
    const resize=new ResizeObserver(()=>{note('resizes');measure(true);});
    function observe(){resize.disconnect();for(const card of cards())for(const child of card.children)if(child instanceof HTMLElement)resize.observe(child);}
    function measure(synchronous=false){note('measures');const heights:Record<string,number>={};for(const card of cards()){
      const id=card.dataset.context;if(!id||card.getAnimations().some(animation=>animation.playState==='running'))continue;
      heights[id]=Math.max(130,Math.ceil([...card.children].reduce((sum,child)=>sum+child.getBoundingClientRect().height,0)+2));
    }
      const signature=JSON.stringify(heights);if(signature===lastSignature)return;lastSignature=signature;
      const reserve=()=>setCompactBarHeights(previous=>{
        const next={...previous,...heights};for(const id of Object.keys(next))if(!projected.some(item=>item.id===id))delete next[id];
        return Object.keys(next).length===Object.keys(previous).length&&Object.entries(next).every(([id,height])=>previous[id]===height)?previous:next;
      });
      // Undo and Preview can remount a folded Bar before its prior height is
      // known. Reserve the intrinsic surface before paint, as for the editor.
      if(synchronous)flushSync(reserve);else reserve();
    }
    const mutations=new MutationObserver(()=>{note('mutations');observe();measure(true);});
    mutations.observe(board,{childList:true,subtree:true,characterData:true});observe();measure();
    return()=>{resize.disconnect();mutations.disconnect();};
  },[dragging,expandedId,size.width,projected]);
  useLayoutEffect(() => {
    if (!expandedId || dragging) return;
    // Measure the living content within the shelf left by the in-flow dock.
    // Normal moments compact to that budget; longer editing tasks retain
    // their own transient scroll surface without growing the Composer page.
    const board=viewport.current;if(!board)return;
    const findCard=()=>[...board.querySelectorAll<HTMLElement>("[data-inventory-id]")]
      .find(node=>node.dataset.inventoryId===expandedId)?.querySelector<HTMLElement>('[data-bar-living-card][data-expanded="true"]');
    let card=findCard();
    let lastHeight=expandedMeasure?.id===expandedId?expandedMeasure.height:null;
    let lastCheckpoint=expandedMeasure?.id===expandedId?expandedMeasure.checkpoint:null;
    const resize = new ResizeObserver(()=>{note('resizes');measure(true);});
    const observeContent = () => {
      card=findCard();resize.disconnect();if(!card)return;resize.observe(card);
      for (const child of card.children) if (child instanceof HTMLElement) resize.observe(child);
    };
    function measure(synchronous=false) {
      note('measures');
      card=findCard();
      if(card?.getAnimations().some(animation=>animation.playState==='running'))return;
      const editor = card?.querySelector<HTMLElement>("[data-bar-living-editor]");
      const header = card?.querySelector<HTMLElement>("header");
      if (!editor || !header) return; // Keep the previous geometry while the editor loads.
      const checkpoint=`${editor.dataset.barGeometryKey??editor.dataset.barStep??"summary"}:${Math.round(card!.getBoundingClientRect().width)}`;
      // The open card's people/actions footer is now in flow. Include it in
      // the existing reservation; otherwise every scene change can shrink
      // the card below its two rails and place avatars over the last row.
      const footer=card?.querySelector<HTMLElement>(':scope > [data-bar-open-footer]');
      // Bound tile sizing by the available shelf, not the card's allocated
      // height. The editor can then report its natural content height and
      // release the empty space below its rails without a sizing feedback loop.
      editor.style.setProperty('--bar-editor-budget',`${Math.max(0,shelfHeight-header.getBoundingClientRect().height-(footer?.getBoundingClientRect().height??0)-2)}px`);
      const height = Math.min(shelfHeight,Math.max(195, Math.ceil(header.getBoundingClientRect().height + editor.scrollHeight + (footer?.getBoundingClientRect().height??0) + 2)));
      // Provider results, typing, focus and images do not renegotiate a scene.
      // Retain its envelope until an explicit scene/page transition. Growing
      // contents may reserve more rows for access, but the anchor stays pinned.
      if(checkpoint===lastCheckpoint&&(height===lastHeight||height<(lastHeight??0)))return;
      const surface=barSurface(editor.dataset.barStep??"summary",card?.dataset.barSurfaceRich==="true",editor.dataset.barAdvanced==="true",card?.dataset.barSurfaceItems==="true");
      lastHeight=height;
      lastCheckpoint=checkpoint;
      const reserve=()=>setExpandedMeasure(previous => previous && previous.id === expandedId && previous.height === height && previous.checkpoint===checkpoint ? previous : { id: expandedId!, height, surface, checkpoint });
      // Observer delivery follows a DOM commit. Reserve the new intrinsic
      // height before the browser paints, rather than one rAF/React batch later.
      // Only an actual height change flushes; ordinary typing does not repack.
      if(synchronous)flushSync(reserve);else reserve();
    }
    const mutations = new MutationObserver(() => { note('mutations');observeContent(); measure(true); });
    // Packing can remount the same context on another page. Follow its new
    // host instead of keeping a ResizeObserver attached to the departed card.
    mutations.observe(board, { childList: true, subtree: true, characterData: true, attributes:true, attributeFilter:["data-bar-geometry-key"] });
    observeContent(); measure();
    return () => { resize.disconnect(); mutations.disconnect(); };
  }, [expandedId, dragging, size.width, size.height, shelfHeight, spatialKey, active]);
  useLayoutEffect(() => {
    if (!dragging) { setDragOrigin(null); return; }
    const sourceKey = interaction?.grabbed?.sourceKey;
    const source = [...viewport.current?.querySelectorAll<HTMLElement>("[data-drag-source]") ?? []]
      .find(node => node.dataset.dragSource === sourceKey);
    const id = source?.closest<HTMLElement>("[data-inventory-id]")?.dataset.inventoryId;
    if (id) setDragOrigin(layouts.findIndex(layout => layout.some(placement => placement.item.id === id)));
  }, [dragging, interaction?.grabbed?.sourceKey]);
  useLayoutEffect(() => {
    // Pagination reserves the same strip even on a single page. The
    // flex viewport therefore has a stable real height with or without a dock.
    const node = viewport.current; if (!node) return;
    const px = (value: string) => Number(value.replace("px", "")) || 0;
    const observe = () => { const plateau = node.querySelector<HTMLElement>("[data-board-page]");
      const padding = plateau && getComputedStyle(plateau);
      // The shelf budget is the screen space, not its content-driven minHeight.
      // Otherwise reserving rows enlarges the budget and repeatedly repacks it.
      const value = { width: Math.max(1, node.clientWidth - (padding ? px(padding.paddingLeft) + px(padding.paddingRight) : 0)),
        // Flex reserves the dock IN FLOW first. Read only the remaining Board
        // client box (excluding its horizontal scrollbar), never window guesses.
        height: Math.max(195,node.clientHeight-(padding ? px(padding.paddingTop)+px(padding.paddingBottom):0)) };
      setSize(old => old.width === value.width && old.height === value.height ? old : value); };
    observe(); const observer = new ResizeObserver(observe); observer.observe(node); return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const board = viewport.current, current = board?.querySelector<HTMLElement>(`[data-board-page="${active}"]`);
    if (!current) return;
    const cells = [...current.querySelectorAll<HTMLElement>("[data-inventory-id]")];
    const rects = new Map<string, DOMRect>();
    // Layout coordinates exclude scroll and in-flight translations. Repeated
    // content measurements must not cancel an unchanged transition.
    for (const cell of cells) rects.set(cell.dataset.inventoryId!,new DOMRect(cell.offsetLeft,cell.offsetTop,cell.offsetWidth,cell.offsetHeight));
    const before = previousScene.current, samePage = before.page === active;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The packer reserves the final surface immediately. Animate the Bar's
    // actual dimensions, never scale its text; neighbours only translate.
    const hasLivingBar = cells.some(cell => !!cell.querySelector('[data-bar-living-card]'));
    if (samePage && before.rects.size && !dragging && !reduced) for (const cell of cells) {
      const id = cell.dataset.inventoryId!, currentRect = rects.get(id)!;
      let origin = before.rects.get(id), entering = false;
      if (!origin) {
        const item = layouts[active]?.find(placement => placement.item.id === id)?.item;
        if (item?.kind === "CLUSTER") {
          const children = item.children.map(child => before.rects.get(child.id)).filter((rect): rect is DOMRect => !!rect);
          if (children.length) { const x = children.reduce((sum, rect) => sum + rect.x + rect.width / 2, 0) / children.length;
            const y = children.reduce((sum, rect) => sum + rect.y + rect.height / 2, 0) / children.length;
            origin = new DOMRect(x - currentRect.width / 2, y - currentRect.height / 2, currentRect.width, currentRect.height); entering = true; }
        } else {
          const former = [...before.clusters].find(([, children]) => children.includes(id));
          const clusterRect = former && before.rects.get(former[0]);
          if (clusterRect) { origin = new DOMRect(clusterRect.x + clusterRect.width / 2 - currentRect.width / 2,
            clusterRect.y + clusterRect.height / 2 - currentRect.height / 2, currentRect.width, currentRect.height); entering = true; }
        }
      }
      if (!origin) continue;
      if(origin.x===currentRect.x&&origin.y===currentRect.y&&origin.width===currentRect.width&&origin.height===currentRect.height&&!entering)continue;
      const bar=cell.querySelector<HTMLElement>('[data-bar-living-card]');
      const running=cell.getAnimations().some(animation=>animation.playState==='running')||bar?.getAnimations().some(animation=>animation.playState==='running');
      if(running){const transform=getComputedStyle(cell).transform,matrix=transform==='none'?new DOMMatrixReadOnly():new DOMMatrixReadOnly(transform);
        origin=new DOMRect(cell.offsetLeft+matrix.m41,cell.offsetTop+matrix.m42,bar?.getBoundingClientRect().width??currentRect.width,bar?.getBoundingClientRect().height??currentRect.height);
      }
      cell.getAnimations().forEach(animation=>animation.cancel());bar?.getAnimations().forEach(animation=>animation.cancel());
      const dx = origin.x - currentRect.x, dy = origin.y - currentRect.y;
      const grows=cell.dataset.inventoryId===expandedId||cell.dataset.inventoryId===before.expandedId;
      if(grows&&bar&&(Math.abs(origin.width-bar.offsetWidth)>2||Math.abs(origin.height-bar.offsetHeight)>2)){
        bar.animate([{width:`${origin.width}px`,height:`${origin.height}px`,overflow:'clip'},{width:`${bar.offsetWidth}px`,height:`${bar.offsetHeight}px`,overflow:'clip'}],{duration:240,delay:expandedId?120:0,fill:'backwards',easing:'cubic-bezier(.2,.75,.25,1)'});
      }
      if(Math.abs(dx)>2||Math.abs(dy)>2||entering)cell.animate([{transform:`translate(${dx}px, ${dy}px)`,opacity:entering ? .45 : 1},
        {transform:'translate(0, 0)',opacity:1}],{duration:expandedId||before.expandedId?120:240,delay:!expandedId&&before.expandedId?240:0,fill:'backwards',easing:'cubic-bezier(.2,.75,.25,1)'});
    }
    previousScene.current = { page:active, expandedId, hasLivingBar, rects, clusters:new Map(layouts[active]?.filter(placement => placement.item.kind === "CLUSTER")
      .map(placement => [placement.item.id, placement.item.kind === "CLUSTER" ? placement.item.children.map(child => child.id) : []] as const) ?? []) };
  }, [geometry, active, dragging, expandedId]);
  const openingIdentity=useRef<string|undefined>(undefined);
  useEffect(()=>{
    if(!expandedId){openingIdentity.current=undefined;return;}
    if(dragging||openingIdentity.current===expandedId)return;
    openingIdentity.current=expandedId;
    const board=viewport.current;if(!board)return;
    const openingProbe=(stage:string)=>{if(reception.current.enabled)board.dataset.barOpeningFocus=JSON.stringify({stage});};
    openingProbe('scheduled');
    let cancelled=false,firstGeometry='',frame=0,secondFrame=0,settle:ReturnType<typeof setTimeout>|undefined;
    const openedAt=performance.now();
    const cancel=(event:Event)=>{if(event.timeStamp>openedAt){cancelled=true;openingProbe(`user-${event.type}`);}};
    // User input always wins over the optional, single stabilisation pass.
    const events=['wheel','touchstart','pointerdown','keydown'] as const;
    events.forEach(name=>window.addEventListener(name,cancel,{passive:true}));
    const reveal=(stabilising=false)=>{
      if(cancelled)return;
      const cell=[...board.querySelectorAll<HTMLElement>('[data-inventory-id]')].find(node=>node.dataset.inventoryId===expandedId);
      if(!cell||!cell.querySelector('[data-bar-living-card][data-expanded="true"]')){openingProbe('surface-unavailable');return;}
      // Final layout coordinates exclude in-flight FLIP transforms.
      const rect=board.getBoundingClientRect(),cellRect=cell.getBoundingClientRect();
      const transform=getComputedStyle(cell).transform,matrix=transform==='none'?new DOMMatrixReadOnly():new DOMMatrixReadOnly(transform);
      const left=cellRect.left-matrix.m41-rect.left+board.scrollLeft;
      const signature=`${left}:${cell.offsetTop}:${cell.offsetWidth}:${cell.offsetHeight}`;
      if(stabilising&&signature===firstGeometry)return;
      firstGeometry=signature;
      board.scrollTo({left:barOpeningScroll(left,cell.offsetWidth,board.clientWidth,board.scrollWidth),behavior:boardScrollBehavior()});
      if(reception.current.enabled)board.dataset.barOpeningFocus=JSON.stringify({pass:stabilising?'stabilised':'initial',target:barOpeningScroll(left,cell.offsetWidth,board.clientWidth,board.scrollWidth),width:cell.offsetWidth,viewport:board.clientWidth});
      // The card starts on the first shelf row and fits its measured height.
      // Opening never scrolls the Composer/page vertically to reveal the dock.
    };
    frame=requestAnimationFrame(()=>{secondFrame=requestAnimationFrame(()=>{reveal();settle=setTimeout(()=>reveal(true),420);});});
    return()=>{cancelled=true;cancelAnimationFrame(frame);cancelAnimationFrame(secondFrame);clearTimeout(settle);events.forEach(name=>window.removeEventListener(name,cancel));};
    // Opening identity only: prices, providers and observers never restart this.
  },[expandedId,dragging]);
  const focusPage = inventoryPageFor(pages, focused, model);
  useEffect(()=>{
    if(!expandedId||dragging||focusPage<0)return;
    // Manual shelf browsing remains possible. A deliberate edit from the
    // living card or its dock resumes following that card across repacking.
    const resume=(event:Event)=>{
      if(!(event.target instanceof Element)||!event.target.closest('[data-bar-living-editor],[data-bar-dock]'))return;
      browsing.current=false;setPage(focusPage);
    };
    document.addEventListener('click',resume,true);
    document.addEventListener('focusin',resume,true);
    return()=>{document.removeEventListener('click',resume,true);document.removeEventListener('focusin',resume,true);};
  },[expandedId,dragging,focusPage]);
  const lastFocus = useRef(focused), lastReveal = useRef(revealSequence);
  useLayoutEffect(() => {
    if (lastFocus.current !== focused || lastReveal.current !== revealSequence) {
      browsing.current = false; lastFocus.current = focused; lastReveal.current = revealSequence;
    }
    // Recomposition follows the selection unless the user explicitly browsed
    // elsewhere. Drag geometry and manual edge navigation remain authoritative.
    if (!dragging && !browsing.current && focusPage >= 0) setPage(focusPage);
  }, [focused, focusPage, geometry, dragging, revealSequence]);
  useEffect(() => { const added = items.find(item => !previousIds.current.has(item.id)); previousIds.current = new Set(items.map(item => item.id));
    if (added && !dragging) { const index = inventoryPageFor(pages, added.id, model); if (index >= 0) { browsing.current = false; setPage(index); } } }, [items, pages, model, dragging]);
  const focusedLabel = model.board.contexts.find(card => card.contextOccurrenceId === focused)?.label
    ?? [...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings].find(card => card.targetRef === focused)?.label;
  const returnToSelection = () => { if (focusPage < 0 || dragging) return; go(focusPage, false); revealFocused?.(); };
  const focusedRequest = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!focused || !revealSequence || dragging || active !== focusPage) return;
    const frame = requestAnimationFrame(() => {
      if (document.querySelector("dialog[open]")) return;
      const root = inventoryRootRef(focused, model), item = pages[active]?.find(item => item.id === root || item.kind === "CLUSTER" && item.children.some(child => child.id === root));
      const cell = viewport.current?.querySelector<HTMLElement>(`[data-board-page="${active}"] [data-inventory-id="${CSS.escape(item?.id ?? root)}"]`);
      const barTitle = cell?.querySelector<HTMLElement>('[data-bar-living-card][data-expanded="false"] h3 button');
      const barFocusTarget = barTitle ?? cell?.querySelector<HTMLElement>('[data-bar-living-editor]');
      // Folding removes the dock, then repacks/remounts the card. Restore only
      // a lost body focus after that second layout, never a user's new focus.
      const lostBarFocus = barFocusTarget && document.activeElement === document.body;
      if (focusedRequest.current === revealSequence && !lostBarFocus) return;
      const target = barFocusTarget ?? cell;
      if (!target || target.closest('[inert]')) return;
      if(cell&&viewport.current&&!cell.querySelector('[data-bar-living-card][data-expanded="true"]')){const bounds=viewport.current.getBoundingClientRect(),card=target.getBoundingClientRect();
        if(card.left<bounds.left+24)viewport.current.scrollBy({left:card.left-bounds.left-24,behavior:boardScrollBehavior()});
        else if(card.right>bounds.right-24)viewport.current.scrollBy({left:card.right-bounds.right+24,behavior:boardScrollBehavior()});
      }
      target.focus({ preventScroll: true });
      if (document.activeElement === target) focusedRequest.current = revealSequence;
    });
    return () => cancelAnimationFrame(frame);
  }, [focused, revealSequence, dragging, active, focusPage, model, pages, departing]);
  useEffect(() => { if (!interaction?.grabbed) { cancelDwell(); dwellEdge.current = null; } }, [interaction?.grabbed]);
  useEffect(() => () => cancelDwell(), []);
  const strip=layouts[0]??[];
  const stripColumns=Math.max(inventoryColumns(layoutSize.width),...strip.map(box=>box.column+box.columnSpan-1));
  const availableWidth=Math.max(212,Math.min(1330,layoutSize.width));
  const baseColumns=inventoryColumns(availableWidth);
  const trackWidth=(availableWidth-(baseColumns-1)*10)/baseColumns;
  const stripWidth=Math.max(availableWidth,stripColumns*(trackWidth+10)-10);
  return <>
    <div ref={viewport} className={styles.carouselViewport} data-board-scroll data-board-continuous data-board-drop data-board-page-active={active} tabIndex={0} aria-label="Board du mois, défilement horizontal"
      data-bar-page={!!expandedId||(layouts[active]??[]).some(box=>compactBarHeights[box.item.id])||undefined}
      style={{'--bar-shelf-height':`${shelfHeight}px`} as React.CSSProperties} {...dropProps}
      onKeyDown={event=>{if(event.target!==event.currentTarget||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();viewport.current?.scrollBy({left:event.key==='ArrowRight'?260:-260,behavior:boardScrollBehavior()});}}
      onDragOverCapture={event=>{if(!interaction?.grabbed||!viewport.current)return;const rect=viewport.current.getBoundingClientRect(),x=event.clientX;
        if(x>rect.right-55)viewport.current.scrollLeft+=26;else if(x<rect.left+55)viewport.current.scrollLeft-=26;}}
      onClick={e => { if (e.target === e.currentTarget || e.target instanceof Element && e.target.matches("[data-mosaic],[data-board-page]")) emptyClick(); }}>
      <div className={styles.plateauTrack} data-plateau-track>
        {layouts.map((inventory, index) => <section key={index} className={styles.plateau} data-board-page={index} data-single-page={layouts.length === 1} aria-label="Espace de composition du mois"
          aria-hidden={index !== active} inert={index !== active}>
          <div className={styles.mosaic} data-mosaic data-has-focus={!!focused} data-completeness-focus={interaction?.completenessFocus}
            style={{ "--board-columns":stripColumns,gridTemplateColumns:`repeat(${stripColumns},${trackWidth}px)`,width:stripWidth } as React.CSSProperties}>
            {inventoryMountedPage(index,active,departing,mode,pinned) && inventory.map(({ item, column, row, columnSpan, rowSpan }) => <div key={item.id} className={styles.inventoryCell} data-inventory-id={item.id} tabIndex={-1}
              data-column-span={columnSpan} data-row-span={rowSpan} data-requested-surface={item.id===expandedId?surface?.size??"compact":undefined} data-geometry-scene={item.id===expandedId?surface?.scene:undefined}
              data-preferred-width={item.id===expandedId?surface?.preferredWidth:undefined} data-min-usable-width={item.id===expandedId?surface?.minUsableWidth:undefined}
              data-geometry-fallback={item.id===expandedId&&surface&&layoutSize.width<surface.minUsableWidth?"DOCUMENT_WIDTH_CONSTRAINED":undefined}
              data-geometry-checkpoint={item.id===expandedId?expandedMeasure?.checkpoint:undefined}
              data-density={item.density} data-spatial-family={item.spatialFamily}
              style={{ gridColumn:`${column} / span ${columnSpan}`, gridRow:`${row} / span ${rowSpan}` }}>{render(item)}</div>)}
          </div>
        </section>)}
      </div>
      {children}
    </div>
    {pages.length > 1 && <nav className={styles.plateauNavigation} aria-label="Pages du mois" data-carousel-nav data-single-page={pages.length === 1}
      onKeyDown={e => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return; e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? pages.length - 1 : active + (e.key === "ArrowRight" ? 1 : -1); go(next);
        e.currentTarget.querySelector<HTMLButtonElement>(`[data-page-index="${Math.max(0,Math.min(pages.length-1,next))}"]`)?.focus(); }}>
      <button className={styles.pageStep} aria-label="Page précédente du mois" title="Page précédente du mois" disabled={!active} onClick={() => go(active - 1)}><ChevronLeft size={16} /></button>
      <span className={styles.pageStatus} aria-live="polite">Page {active + 1} sur {pages.length}</span>
      <div>{pages.map((_, index) => <button key={index} data-page-index={index} aria-label={`Afficher la page ${index + 1}`} aria-current={index === active ? "page" : undefined} tabIndex={index === active ? 0 : -1} onClick={() => go(index)}>{index + 1}</button>)}</div>
      <button className={styles.pageStep} aria-label="Page suivante du mois" title="Page suivante du mois" disabled={active === pages.length - 1} onClick={() => go(active + 1)}><ChevronRight size={16} /></button>
      {focusedLabel && focusPage >= 0 && focusPage !== active && <button className={styles.returnToCard} data-return-to-card={focused} disabled={dragging} onClick={returnToSelection}>Voir {focusedLabel} · page {focusPage + 1}</button>}
    </nav>}
  </>;
}
