"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import styles from "./global-atomic.module.css";

type Destination = { readonly label: string; readonly offset: number };

const headingSelector = "h2,h3,h4,h5,h6,summary,[data-detail-heading]";
const rowSelector = "dt,li,article,button,a,p";

function labelFor(element: HTMLElement) {
  return (element.getAttribute("data-detail-heading") || element.getAttribute("aria-label")
    || element.innerText || "").replace(/\s+/gu, " ").trim();
}

function measureDestinations(viewport: HTMLElement, content: HTMLElement): readonly Destination[] {
  const width = viewport.clientWidth;
  if (!width || viewport.scrollWidth <= width + 2) return [];
  const gap = Number.parseFloat(getComputedStyle(content).columnGap) || 0;
  const stride = width + gap;
  const left = viewport.getBoundingClientRect().left - viewport.scrollLeft;
  const destinations = new Map<number, { label: string; rank: number }>();
  const find = (element: HTMLElement, rank: number) => {
    const label = labelFor(element);
    if (!label) return;
    for (const fragment of element.getClientRects()) {
      if (!fragment.width || !fragment.height) continue;
      const column = Math.max(0, Math.floor((fragment.left - left + 2) / stride));
      if ((destinations.get(column)?.rank ?? -1) >= rank) continue;
      const excerpt = label.length > 72 ? `${label.slice(0, 69).trimEnd()}…` : label;
      destinations.set(column, { label: excerpt, rank });
    }
  };
  for (const element of content.querySelectorAll<HTMLElement>(headingSelector)) find(element, 2);
  for (const element of content.querySelectorAll<HTMLElement>(rowSelector)) find(element, 1);
  if (!destinations.has(0)) destinations.set(0, { label: "Vue d’ensemble", rank: 0 });
  return [...destinations.entries()].sort(([a], [b]) => a - b).map(([column, item]) => ({
    label: item.label, offset: Math.min(column * stride, viewport.scrollWidth - width),
  }));
}

export function AtomicDetailPages({ children }: { readonly children: ReactNode }) {
  const region = useRef<HTMLDivElement>(null);
  const columns = useRef<HTMLDivElement>(null);
  const [destinations, setDestinations] = useState<readonly Destination[]>([]);
  const [offset, setOffset] = useState(0);
  const choice = useRef<string | null>(null);

  useLayoutEffect(() => {
    const viewport = region.current;
    const content = columns.current;
    if (!viewport || !content) return;

    let frame = 0;
    function measure() {
      frame = 0;
      if (!viewport || !content) return;
      const next = measureDestinations(viewport, content);
      setDestinations((current) => current.length === next.length
        && current.every((item, index) => item.label === next[index]?.label && item.offset === next[index]?.offset) ? current : next);
      const active = next.find(({ label }) => label === choice.current);
      if (active && Math.abs(viewport.scrollLeft - active.offset) > 1) viewport.scrollLeft = active.offset;
      setOffset(viewport.scrollLeft);
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

  const selected = destinations.reduce<Destination | undefined>((nearest, item) =>
    !nearest || Math.abs(item.offset - offset) < Math.abs(nearest.offset - offset) ? item : nearest, undefined);

  return <div className={styles.detailPages}>
    {destinations.length > 1 && <label className={styles.detailPicker}>
      Aller directement à
      <select value={selected?.offset ?? 0} onChange={(event) => {
        const next = destinations.find((item) => item.offset === Number(event.currentTarget.value));
        if (!next || !region.current) return;
        choice.current = next.label;
        region.current.scrollLeft = next.offset;
        setOffset(next.offset);
      }}>
        {destinations.map((item) => <option key={item.offset} value={item.offset}>{item.label}</option>)}
      </select>
    </label>}
    <div ref={region} className={styles.detailViewport} onScroll={(event) => setOffset(event.currentTarget.scrollLeft)}
      onFocusCapture={(event) => {
        const viewport = event.currentTarget;
        const focus = event.target.getBoundingClientRect();
        const bounds = viewport.getBoundingClientRect();
        if (focus.left >= bounds.left - 1 && focus.right <= bounds.right + 1) return;
        const x = focus.left - bounds.left + viewport.scrollLeft;
        const target = destinations.findLast((item) => item.offset <= x + 2);
        if (!target) return;
        choice.current = target.label;
        viewport.scrollLeft = target.offset;
        setOffset(target.offset);
      }}>
      <div ref={columns} className={styles.detailColumns}>{children}</div>
    </div>
  </div>;
}
