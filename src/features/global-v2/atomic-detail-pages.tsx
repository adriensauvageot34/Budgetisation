"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./global-atomic.module.css";

export function AtomicDetailPages({ children }: { readonly children: ReactNode }) {
  const region = useRef<HTMLDivElement>(null);
  const columns = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(1);

  useLayoutEffect(() => {
    const viewport = region.current;
    const content = columns.current;
    if (!viewport || !content) return;
    let frame = 0;
    function measure() {
      frame = 0;
      if (!viewport || !content || viewport.clientWidth === 0) return;
      const gap = Number.parseFloat(getComputedStyle(content).columnGap) || 0;
      const stride = viewport.clientWidth + gap;
      setCount(Math.max(1, Math.round((viewport.scrollWidth + gap) / stride)));
      setPage(Math.round(viewport.scrollLeft / stride));
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure);
    }
    const resize = new ResizeObserver(schedule);
    const mutation = new MutationObserver(schedule);
    resize.observe(viewport);
    mutation.observe(content, { childList: true, subtree: true, characterData: true, attributes: true });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
    };
  }, []);

  function goTo(next: number) {
    const viewport = region.current;
    const content = columns.current;
    if (!viewport || !content) return;
    const gap = Number.parseFloat(getComputedStyle(content).columnGap) || 0;
    viewport.scrollTo({ left: next * (viewport.clientWidth + gap), behavior: "instant" });
    setPage(next);
  }

  return <div className={styles.detailPages}>
    <div ref={region} className={styles.detailViewport} onScroll={(event) => {
      const gap = columns.current ? Number.parseFloat(getComputedStyle(columns.current).columnGap) || 0 : 0;
      const viewport = event.currentTarget;
      setPage(Math.round(viewport.scrollLeft / (viewport.clientWidth + gap)));
    }} onFocusCapture={(event) => {
      const viewport = event.currentTarget;
      const gap = columns.current ? Number.parseFloat(getComputedStyle(columns.current).columnGap) || 0 : 0;
      const left = event.target.getBoundingClientRect().left - viewport.getBoundingClientRect().left + viewport.scrollLeft;
      goTo(Math.max(0, Math.floor((left + 1) / (viewport.clientWidth + gap))));
    }}>
      <div ref={columns} className={styles.detailColumns}>{children}</div>
    </div>
    <nav className={styles.pagination} aria-label="Pages du détail" hidden={count <= 1}>
      <button type="button" disabled={page <= 0} onClick={() => goTo(page - 1)} aria-label="Page précédente du détail"><ChevronLeft size={15} /></button>
      <span aria-live="polite">{page + 1} / {count}</span>
      <button type="button" disabled={page >= count - 1} onClick={() => goTo(page + 1)} aria-label="Page suivante du détail"><ChevronRight size={15} /></button>
    </nav>
  </div>;
}
