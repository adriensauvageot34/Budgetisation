"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { inventoryItems, inventoryPages, inventoryPageFor, type InventoryItem } from "./inventory-layout";
import { useComposerInteractions } from "./interactions";
import styles from "./composer.module.css";

export function BoardCarousel({ model, focused, paletteOpen = false, render, emptyClick, children, dropProps }: { model: ComposerUiModel; focused: string | null; paletteOpen?: boolean;
  render: (item: InventoryItem) => ReactNode; emptyClick: () => void; children?: ReactNode; dropProps: React.HTMLAttributes<HTMLDivElement> & { [key: `data-${string}`]: boolean | string | number | undefined } }) {
  const viewport = useRef<HTMLDivElement>(null), [size, setSize] = useState({ width: 1000, height: 470 }), [page, setPage] = useState(0);
  const interaction = useComposerInteractions(), dwell = useRef<ReturnType<typeof setTimeout> | null>(null), dwellEdge = useRef<number | null>(null);
  const items = useMemo(() => inventoryItems(model), [model]), pages = useMemo(() => {
    const fullHeight = inventoryPages(items, size.width, size.height);
    return fullHeight.length === 1 ? fullHeight : inventoryPages(items, size.width, size.height - 30);
  }, [items, size]);
  const active = Math.min(page, pages.length - 1), previousIds = useRef(new Set(items.map(item => item.id)));
  const cancelDwell = () => { if (dwell.current) { clearTimeout(dwell.current); dwell.current = null; } };
  const go = (next: number) => { cancelDwell(); document.querySelectorAll<HTMLElement>("[popover]:popover-open").forEach(p => p.hidePopover()); setPage(Math.max(0, Math.min(pages.length - 1, next))); };
  useLayoutEffect(() => {
    // Measure the stable Board, so conditional pagination cannot shrink the
    // measured viewport and trigger a ResizeObserver feedback loop.
    const node = viewport.current?.parentElement; if (!node) return;
    const observe = () => { const box = node.getBoundingClientRect(); const value = { width: Math.max(1, box.width - 44), height: Math.max(1, box.height - 36 - (paletteOpen ? 108 : 0)) };
      setSize(old => old.width === value.width && old.height === value.height ? old : value); };
    observe(); const observer = new ResizeObserver(observe); observer.observe(node); return () => observer.disconnect();
  }, [paletteOpen]);
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
        {pages.map((inventory, index) => <section key={index} className={styles.plateau} data-board-page={index} aria-label={`Page ${index + 1} sur ${pages.length}`}
          aria-hidden={index !== active} inert={index !== active}>
          <div className={styles.mosaic} data-mosaic data-has-focus={!!focused} data-completeness-focus={interaction?.completenessFocus}>
            {inventory.map(item => <div key={item.id} className={styles.inventoryCell} data-inventory-id={item.id} style={{ width: item.width }}>{render(item)}</div>)}
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
    {pages.length > 1 && <nav className={styles.plateauNavigation} aria-label="Pages du mois" data-carousel-nav
      onKeyDown={e => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return; e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? pages.length - 1 : active + (e.key === "ArrowRight" ? 1 : -1); go(next);
        e.currentTarget.querySelector<HTMLButtonElement>(`[data-page-index="${Math.max(0,Math.min(pages.length-1,next))}"]`)?.focus(); }}>
      <button className={styles.iconButton} aria-label="Page précédente du mois" disabled={!active} onClick={() => go(active - 1)}><ChevronLeft size={16} /></button>
      <div>{pages.map((_, index) => <button key={index} data-page-index={index} aria-label={`Afficher la page ${index + 1}`} aria-current={index === active ? "page" : undefined} tabIndex={index === active ? 0 : -1} onClick={() => go(index)}><i /></button>)}</div>
      <span>{active + 1} / {pages.length} · {items.length - pages[active].length} autres</span>
      <button className={styles.iconButton} aria-label="Page suivante du mois" disabled={active === pages.length - 1} onClick={() => go(active + 1)}><ChevronRight size={16} /></button>
    </nav>}
  </>;
}
