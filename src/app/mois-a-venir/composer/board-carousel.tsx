"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { inventoryItems, inventoryLayoutPages, inventoryPageFor, inventoryRootRef, inventoryColumns, inventorySpatialKey, bindInventoryLayout, inventoryMountedPage, type InventoryItem } from "./inventory-layout";
import { useComposerInteractions } from "./interactions";
import styles from "./composer.module.css";

export function BoardCarousel({ model, inventory, focused, render, emptyClick, children, dropProps, revealSequence, revealFocused, expandedId }: { model: ComposerUiModel; inventory?: readonly InventoryItem[]; focused: string | null;
  expandedId?: string; revealSequence?: number; revealFocused?: () => void;
  render: (item: InventoryItem) => ReactNode; emptyClick: () => void; children?: ReactNode; dropProps: React.HTMLAttributes<HTMLDivElement> & { [key: `data-${string}`]: boolean | string | number | undefined } }) {
  const viewport = useRef<HTMLDivElement>(null), [size, setSize] = useState({ width: 1000, height: 470 }), [page, setPage] = useState(0);
  const [expandedMeasure, setExpandedMeasure] = useState<{ id: string; height: number } | null>(null);
  const [compactBarHeights,setCompactBarHeights]=useState<Readonly<Record<string,number>>>({});
  const interaction = useComposerInteractions(), dwell = useRef<ReturnType<typeof setTimeout> | null>(null), dwellEdge = useRef<number | null>(null);
  const projected = useMemo(() => inventory ?? inventoryItems(model), [model,inventory]);
  const stableItems = useRef(projected), stableSize = useRef(size), stableExpanded = useRef(expandedId);
  const stableExpandedHeight = useRef<number | undefined>(undefined);
  const dragging = !!interaction?.grabbed;
  const measuredItems=useMemo(()=>projected.map(item=>compactBarHeights[item.id]&&item.id!==expandedId?{...item,height:compactBarHeights[item.id]}:item),[projected,compactBarHeights,expandedId]);
  const items = dragging ? stableItems.current : measuredItems, layoutSize = dragging ? stableSize.current : size;
  const spatialKey = inventorySpatialKey(items);
  const expandedHeight = dragging ? stableExpandedHeight.current : expandedMeasure && expandedMeasure.id === expandedId ? expandedMeasure.height : undefined;
  const geometry = useMemo(() => inventoryLayoutPages(items, layoutSize.width, layoutSize.height, dragging ? stableExpanded.current : expandedId, expandedHeight), [spatialKey,layoutSize.width,layoutSize.height,dragging,expandedId,expandedHeight]);
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
  const previousScene = useRef<{ page:number; rects:Map<string, DOMRect>; clusters:Map<string, readonly string[]> }>({ page:-1, rects:new Map(), clusters:new Map() });
  const cancelDwell = () => { if (dwell.current) { clearTimeout(dwell.current); dwell.current = null; } };
  const browsing = useRef(false);
  const go = (next: number, manual = true) => { browsing.current = manual; cancelDwell(); captureDirty(); document.querySelectorAll<HTMLElement>("[popover]:popover-open").forEach(p => p.hidePopover()); setDeparting(active); setPage(Math.max(0, Math.min(pages.length - 1, next))); };
  useEffect(() => { const timer=setTimeout(()=>setDeparting(active),300);return()=>clearTimeout(timer); },[active]);
  useLayoutEffect(captureDirty,[model]);
  useLayoutEffect(()=>{
    if(dragging||!viewport.current)return;
    const board=viewport.current;let frame=0;
    // Measure intrinsic children, not the stretched grid cell: otherwise the
    // reserved height feeds back into itself and can never shrink on folding.
    const cards=()=>[...board.querySelectorAll<HTMLElement>('[data-bar-living-card][data-expanded="false"]')];
    const resize=new ResizeObserver(schedule);
    function observe(){resize.disconnect();for(const card of cards())for(const child of card.children)if(child instanceof HTMLElement)resize.observe(child);}
    function measure(){frame=0;const heights:Record<string,number>={};for(const card of cards()){
      const id=card.dataset.context;if(!id)continue;
      heights[id]=Math.max(130,Math.ceil([...card.children].reduce((sum,child)=>sum+child.getBoundingClientRect().height,0)+2));
    }
      setCompactBarHeights(previous=>{
        const next={...previous,...heights};for(const id of Object.keys(next))if(!projected.some(item=>item.id===id))delete next[id];
        return Object.keys(next).length===Object.keys(previous).length&&Object.entries(next).every(([id,height])=>previous[id]===height)?previous:next;
      });
    }
    function schedule(){if(!frame)frame=requestAnimationFrame(measure);}
    const mutations=new MutationObserver(()=>{observe();schedule();});
    mutations.observe(board,{childList:true,subtree:true,characterData:true});observe();schedule();
    return()=>{resize.disconnect();mutations.disconnect();if(frame)cancelAnimationFrame(frame);};
  },[dragging,expandedId,size.width,projected]);
  useLayoutEffect(() => {
    if (!expandedId || dragging) return;
    // Measure only the living Bar's rendered content. The grid owns the outer
    // rectangle. A tall living card also grows the page instead of being cut
    // by the finite shelf; no overlay or semantic edit.
    const board=viewport.current;if(!board)return;
    const findCard=()=>[...board.querySelectorAll<HTMLElement>("[data-inventory-id]")]
      .find(node=>node.dataset.inventoryId===expandedId)?.querySelector<HTMLElement>('[data-bar-living-card][data-expanded="true"]');
    let card=findCard();
    let frame = 0;
    const resize = new ResizeObserver(schedule);
    const observeContent = () => {
      card=findCard();resize.disconnect();if(!card)return;resize.observe(card);
      for (const child of card.children) if (child instanceof HTMLElement) resize.observe(child);
    };
    function measure() {
      frame = 0;
      card=findCard();
      const editor = card?.querySelector<HTMLElement>("[data-bar-living-editor]");
      const header = card?.querySelector<HTMLElement>("header");
      if (!editor || !header) return; // Keep the previous geometry while the editor loads.
      const height = Math.max(240, Math.ceil(header.getBoundingClientRect().height + editor.scrollHeight + 2));
      setExpandedMeasure(previous => previous && previous.id === expandedId && previous.height === height ? previous : { id: expandedId!, height });
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(measure); }
    const mutations = new MutationObserver(() => { observeContent(); schedule(); });
    // Packing can remount the same context on another page. Follow its new
    // host instead of keeping a ResizeObserver attached to the departed card.
    mutations.observe(board, { childList: true, subtree: true, characterData: true });
    observeContent(); schedule();
    return () => { resize.disconnect(); mutations.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [expandedId, dragging, size.width, spatialKey, active]);
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
      const value = { width: Math.max(1, (plateau?.clientWidth ?? node.clientWidth) - (padding ? px(padding.paddingLeft) + px(padding.paddingRight) : 0)),
        height: Math.max(1, node.clientHeight - (padding ? px(padding.paddingTop) + px(padding.paddingBottom) : 0)) };
      setSize(old => old.width === value.width && old.height === value.height ? old : value); };
    observe(); const observer = new ResizeObserver(observe); observer.observe(node); return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const board = viewport.current, current = board?.querySelector<HTMLElement>(`[data-board-page="${active}"]`);
    if (!current) return;
    const cells = [...current.querySelectorAll<HTMLElement>("[data-inventory-id]")];
    const rects = new Map<string, DOMRect>();
    for (const cell of cells) { cell.getAnimations().forEach(animation => animation.cancel()); rects.set(cell.dataset.inventoryId!, cell.getBoundingClientRect()); }
    const before = previousScene.current, samePage = before.page === active;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
      const dx = origin.x - currentRect.x, dy = origin.y - currentRect.y;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && !entering) {
        // Real Grid tracks already reflowed. Reveal the new surface without
        // scaling its text or placing an editor over the neighboring cards.
        if (id === expandedId && (Math.abs(origin.width-currentRect.width)>2 || Math.abs(origin.height-currentRect.height)>2))
          cell.animate([{clipPath:`inset(0 ${Math.max(0,currentRect.width-origin.width)}px ${Math.max(0,currentRect.height-origin.height)}px 0 round 22px)`},{clipPath:"inset(0 round 22px)"}],{duration:220,easing:"ease-out"});
        continue;
      }
      cell.animate([{ transform:`translate(${dx}px, ${dy}px) scale(${entering ? .95 : 1})`, opacity:entering ? .45 : 1 },
        { transform:"translate(0, 0) scale(1)", opacity:1 }], { duration:entering ? 290 : 220, easing:"cubic-bezier(.2,.75,.25,1)" });
    }
    previousScene.current = { page:active, rects, clusters:new Map(layouts[active]?.filter(placement => placement.item.kind === "CLUSTER")
      .map(placement => [placement.item.id, placement.item.kind === "CLUSTER" ? placement.item.children.map(child => child.id) : []] as const) ?? []) };
  }, [geometry, active, dragging]);
  const focusPage = inventoryPageFor(pages, focused, model);
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
      // Folding removes the dock, then repacks/remounts the card. Restore only
      // a lost body focus after that second layout, never a user's new focus.
      const lostBarFocus = barTitle && document.activeElement === document.body;
      if (focusedRequest.current === revealSequence && !lostBarFocus) return;
      const target = barTitle ?? cell;
      if (!target || target.closest('[inert]')) return;
      target.focus({ preventScroll: true });
      if (document.activeElement === target) focusedRequest.current = revealSequence;
    });
    return () => cancelAnimationFrame(frame);
  }, [focused, revealSequence, dragging, active, focusPage, model, pages, departing]);
  useEffect(() => { if (!interaction?.grabbed) { cancelDwell(); dwellEdge.current = null; } }, [interaction?.grabbed]);
  useEffect(() => () => cancelDwell(), []);
  const edge = (direction: -1 | 1) => { if (!interaction?.grabbed || dwell.current || dwellEdge.current === direction || active + direction < 0 || active + direction >= pages.length) return;
    dwellEdge.current = direction;
    dwell.current = setTimeout(() => { dwell.current = null; interaction.over(null); go(active + direction); }, 600); };
  return <>
    <div ref={viewport} className={styles.carouselViewport} data-board-scroll data-board-drop data-board-page-active={active}
      style={expandedId && expandedHeight ? { minHeight: expandedHeight + 24 } : undefined} {...dropProps}
      onClick={e => { if (e.target === e.currentTarget || e.target instanceof Element && e.target.matches("[data-mosaic],[data-board-page]")) emptyClick(); }}>
      <div className={styles.plateauTrack} style={{ transform: `translateX(-${active * 100}%)` }} data-plateau-track onTransitionEnd={event=>{if(event.target===event.currentTarget)setDeparting(active);}}>
        {layouts.map((inventory, index) => <section key={index} className={styles.plateau} data-board-page={index} data-single-page={layouts.length === 1} aria-label={`Page ${index + 1} sur ${pages.length}`}
          aria-hidden={index !== active} inert={index !== active}>
          <div className={styles.mosaic} data-mosaic data-has-focus={!!focused} data-completeness-focus={interaction?.completenessFocus}
            style={{ "--board-columns":inventoryColumns(layoutSize.width) } as React.CSSProperties}>
            {inventoryMountedPage(index,active,departing,mode,pinned) && inventory.map(({ item, column, row, columnSpan, rowSpan }) => <div key={item.id} className={styles.inventoryCell} data-inventory-id={item.id} tabIndex={-1}
              data-density={item.density} data-spatial-family={item.spatialFamily}
              style={{ gridColumn:`${column} / span ${columnSpan}`, gridRow:`${row} / span ${rowSpan}` }}>{render(item)}</div>)}
          </div>
        </section>)}
      </div>
      {children}
      {interaction?.grabbed && pages.length > 1 && ([-1, 1] as const).map(direction => <div key={direction} className={styles.pageEdge} data-board-edge={direction === 1 ? "next" : "previous"}
        data-available={active + direction >= 0 && active + direction < pages.length} aria-hidden="true"
        onDragEnter={e => { e.stopPropagation(); edge(direction); }} onDragOver={e => { e.preventDefault(); e.stopPropagation(); interaction.over(null); edge(direction); }}
        onDragLeave={() => { cancelDwell(); dwellEdge.current = null; }} onDrop={e => { e.preventDefault(); e.stopPropagation(); cancelDwell(); dwellEdge.current = null; interaction.over(null); }}>
        {direction === 1 ? <><span>Page suivante</span><ChevronRight size={19} /></> : <><ChevronLeft size={19} /><span>Page précédente</span></>}
      </div>)}
    </div>
    {pages.length > 1 && <nav className={styles.plateauNavigation} aria-label="Pages du mois" data-carousel-nav data-single-page={pages.length === 1}
      onKeyDown={e => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return; e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? pages.length - 1 : active + (e.key === "ArrowRight" ? 1 : -1); go(next);
        e.currentTarget.querySelector<HTMLButtonElement>(`[data-page-index="${Math.max(0,Math.min(pages.length-1,next))}"]`)?.focus(); }}>
      <button className={styles.pageStep} aria-label="Page précédente du mois" disabled={!active} onClick={() => go(active - 1)}><ChevronLeft size={16} /> Précédente</button>
      <span className={styles.pageStatus} aria-live="polite">Page {active + 1} sur {pages.length}</span>
      <div>{pages.map((_, index) => <button key={index} data-page-index={index} aria-label={`Afficher la page ${index + 1}`} aria-current={index === active ? "page" : undefined} tabIndex={index === active ? 0 : -1} onClick={() => go(index)}>{index + 1}</button>)}</div>
      <button className={styles.pageStep} aria-label="Page suivante du mois" disabled={active === pages.length - 1} onClick={() => go(active + 1)}>Suivante <ChevronRight size={16} /></button>
      {focusedLabel && focusPage >= 0 && focusPage !== active && <button className={styles.returnToCard} data-return-to-card={focused} disabled={dragging} onClick={returnToSelection}>Voir {focusedLabel} · page {focusPage + 1}</button>}
    </nav>}
  </>;
}
