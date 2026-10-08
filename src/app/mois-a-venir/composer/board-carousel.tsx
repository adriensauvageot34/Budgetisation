"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { inventoryItems, inventoryLayoutPages, inventoryPageFor, inventoryColumns, type InventoryItem } from "./inventory-layout";
import { useComposerInteractions } from "./interactions";
import styles from "./composer.module.css";

export function BoardCarousel({ model, focused, render, emptyClick, children, dropProps }: { model: ComposerUiModel; focused: string | null;
  render: (item: InventoryItem) => ReactNode; emptyClick: () => void; children?: ReactNode; dropProps: React.HTMLAttributes<HTMLDivElement> & { [key: `data-${string}`]: boolean | string | number | undefined } }) {
  const viewport = useRef<HTMLDivElement>(null), [size, setSize] = useState({ width: 1000, height: 470 }), [page, setPage] = useState(0);
  const interaction = useComposerInteractions(), dwell = useRef<ReturnType<typeof setTimeout> | null>(null), dwellEdge = useRef<number | null>(null);
  const projected = useMemo(() => inventoryItems(model), [model]);
  const stableItems = useRef(projected), stableSize = useRef(size);
  const dragging = !!interaction?.grabbed;
  const items = dragging ? stableItems.current : projected, layoutSize = dragging ? stableSize.current : size;
  const layouts = useMemo(() => inventoryLayoutPages(items, layoutSize.width, layoutSize.height), [items, layoutSize]);
  const pages = useMemo(() => layouts.map(layout => layout.map(placement => placement.item)), [layouts]);
  useLayoutEffect(() => { if (!dragging) { stableItems.current = projected; stableSize.current = size; } }, [dragging, projected, size]);
  const active = Math.min(page, pages.length - 1), previousIds = useRef(new Set(items.map(item => item.id)));
  const previousScene = useRef<{ page:number; rects:Map<string, DOMRect>; clusters:Map<string, readonly string[]> }>({ page:-1, rects:new Map(), clusters:new Map() });
  const cancelDwell = () => { if (dwell.current) { clearTimeout(dwell.current); dwell.current = null; } };
  const go = (next: number) => { cancelDwell(); document.querySelectorAll<HTMLElement>("[popover]:popover-open").forEach(p => p.hidePopover()); setPage(Math.max(0, Math.min(pages.length - 1, next))); };
  useLayoutEffect(() => {
    // Pagination always reserves its 30px strip, even on a single page. The
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
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && !entering) continue;
      cell.animate([{ transform:`translate(${dx}px, ${dy}px) scale(${entering ? .95 : 1})`, opacity:entering ? .45 : 1 },
        { transform:"translate(0, 0) scale(1)", opacity:1 }], { duration:entering ? 290 : 220, easing:"cubic-bezier(.2,.75,.25,1)" });
    }
    previousScene.current = { page:active, rects, clusters:new Map(layouts[active]?.filter(placement => placement.item.kind === "CLUSTER")
      .map(placement => [placement.item.id, placement.item.kind === "CLUSTER" ? placement.item.children.map(child => child.id) : []] as const) ?? []) };
  }, [layouts, active, dragging]);
  const focusPage = inventoryPageFor(pages, focused, model);
  useEffect(() => { if (focusPage >= 0) setPage(focusPage); }, [focused]);
  useEffect(() => { const added = items.find(item => !previousIds.current.has(item.id)); previousIds.current = new Set(items.map(item => item.id));
    if (added) { const index = inventoryPageFor(pages, added.id, model); if (index >= 0) setPage(index); } }, [items, pages, model]);
  useEffect(() => { if (!interaction?.grabbed) { cancelDwell(); dwellEdge.current = null; } }, [interaction?.grabbed]);
  useEffect(() => () => cancelDwell(), []);
  const edge = (direction: -1 | 1) => { if (!interaction?.grabbed || dwell.current || dwellEdge.current === direction || active + direction < 0 || active + direction >= pages.length) return;
    dwellEdge.current = direction;
    dwell.current = setTimeout(() => { dwell.current = null; interaction.over(null); go(active + direction); }, 600); };
  return <>
    <div ref={viewport} className={styles.carouselViewport} data-board-scroll data-board-drop data-board-page-active={active} {...dropProps}
      onClick={e => { if (e.target === e.currentTarget || e.target instanceof Element && e.target.matches("[data-mosaic],[data-board-page]")) emptyClick(); }}>
      <div className={styles.plateauTrack} style={{ transform: `translateX(-${active * 100}%)` }} data-plateau-track>
        {layouts.map((inventory, index) => <section key={index} className={styles.plateau} data-board-page={index} data-single-page={layouts.length === 1} aria-label={`Page ${index + 1} sur ${pages.length}`}
          aria-hidden={index !== active} inert={index !== active}>
          <div className={styles.mosaic} data-mosaic data-has-focus={!!focused} data-completeness-focus={interaction?.completenessFocus}
            style={{ "--board-columns":inventoryColumns(layoutSize.width) } as React.CSSProperties}>
            {inventory.map(({ item, column, row, columnSpan, rowSpan }) => <div key={item.id} className={styles.inventoryCell} data-inventory-id={item.id}
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
    <nav className={styles.plateauNavigation} aria-label="Pages du mois" data-carousel-nav data-single-page={pages.length === 1}
      aria-hidden={pages.length === 1} inert={pages.length === 1}
      onKeyDown={e => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return; e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? pages.length - 1 : active + (e.key === "ArrowRight" ? 1 : -1); go(next);
        e.currentTarget.querySelector<HTMLButtonElement>(`[data-page-index="${Math.max(0,Math.min(pages.length-1,next))}"]`)?.focus(); }}>
      <button className={styles.iconButton} aria-label="Page précédente du mois" disabled={!active} onClick={() => go(active - 1)}><ChevronLeft size={16} /></button>
      <div>{pages.map((_, index) => <button key={index} data-page-index={index} aria-label={`Afficher la page ${index + 1}`} aria-current={index === active ? "page" : undefined} tabIndex={index === active ? 0 : -1} onClick={() => go(index)}><i /></button>)}</div>
      <span>{active + 1} / {pages.length} · {items.length - pages[active].length} autres</span>
      <button className={styles.iconButton} aria-label="Page suivante du mois" disabled={active === pages.length - 1} onClick={() => go(active + 1)}><ChevronRight size={16} /></button>
    </nav>
  </>;
}
