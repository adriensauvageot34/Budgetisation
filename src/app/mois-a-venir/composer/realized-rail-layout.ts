"use client";

import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { packRealizedCards, packRealizedCategories, type PackedCardPosition } from "./realized-card-view";
import type { RealizedCardSummary } from "./realized-overview";

type Entry = { card: RealizedCardSummary };
type Group = { id: string; entries: readonly Entry[] };
type Packing = ReturnType<typeof packRealizedCards> & Partial<Pick<ReturnType<typeof packRealizedCategories>, "frames">>;
type ColumnWindow = { first: number; last: number };
const denseBoard = 32;
const firstMountCount = 18;

export function realizedColumnWindow(left: number, width: number, step: number, columns: number): ColumnWindow {
  return {
    first: Math.max(0, Math.floor(left / step) - 2),
    last: Math.min(columns - 1, Math.ceil((left + width) / step) + 1),
  };
}

export function preserveRealizedRailOffset(
  left: number, viewport: number,
  previous: { step: number; packing: Packing }, next: { step: number; packing: Packing },
) {
  if (left <= 1) return left;
  const lastOffset = Math.max(0, previous.step * previous.packing.columns - viewport);
  if (lastOffset > 1 && left >= lastOffset - 12) return Math.max(0, next.step * next.packing.columns - viewport);
  const column = Math.floor(left / previous.step);
  const anchor = Object.entries(previous.packing.positions).find(([id, position]) =>
    position.column === column && next.packing.positions[id]);
  if (!anchor) return left;
  const [id, position] = anchor;
  return Math.max(0, left + next.packing.positions[id]!.column * next.step - position.column * previous.step);
}

function estimatedHeight(card: RealizedCardSummary, width: number) {
  const textWidth = Math.max(90, width - (card.badges.length > 1 ? 90 : 68));
  const lines = (text: string, lineHeight: number, maxLines = Infinity) =>
    Math.min(maxLines, Math.max(1, Math.ceil(text.length * 7 / textWidth))) * lineHeight;
  const text = 18 + lines(card.label, 20, 2) + (card.pilotStatus ? 19 : 0)
    + (card.amount === null ? 0 : card.hasTransfers ? 42 : 26)
    + (card.places?.[0] ? lines(card.places[0].label, 17, 2) : 0)
    + (card.caption ? lines(card.caption, 16) : 0)
    + (card.amount === null && (card.relatedCount || !card.trip) ? 18 : 0);
  const badgeRows = card.badges.length > 1 ? Math.ceil(Math.min(card.badges.length, 6) / 2) : card.badges.length;
  const visual = 42 + badgeRows * 33;
  const details = (card.trip ? 29 : 0) + (card.travel ? 29 : 0)
    + (card.mobilityNote ? lines(card.mobilityNote, 16) + 4 : 0);
  const footer = card.work ? 9 + Math.max(31, Math.ceil(card.work.items.length / 2) * 29) : card.participant ? 36 : 0;
  return 19 + Math.max(text, visual) + details + footer;
}

type Geometry = { width: number; viewport: number; height: number; gap: number; inset: number; heading: number };

export function useRealizedRailLayout(
  rail: RefObject<HTMLDivElement | null>, groups: readonly Group[], viewKey: string, byCategory: boolean, fillColumns: boolean,
) {
  const probe = useRef<HTMLSpanElement>(null);
  const [geometry, setGeometry] = useState<Geometry>();
  const [measurements, setMeasurements] = useState<{ key: string; heights: ReadonlyMap<string, number> }>();
  const [window, setWindow] = useState<ColumnWindow>();
  const [focusedId, setFocusedId] = useState<string>();
  const windowRef = useRef<ColumnWindow | undefined>(undefined);
  const previous = useRef<{ key: string; step: number; packing: Packing } | undefined>(undefined);
  const count = groups.reduce((sum, group) => sum + group.entries.length, 0);
  const virtual = count > denseBoard;
  const measurementKey = `${viewKey}:${geometry?.width ?? 0}`;
  const inset = byCategory ? geometry?.inset ?? 0 : 0;
  const step = geometry ? geometry.width + geometry.gap + inset * 2 : 0;
  const packing = useMemo<Packing | undefined>(() => {
    if (!geometry || !groups.length) return undefined;
    const sizes = measurements?.key === measurementKey ? measurements.heights : undefined;
    const measured = groups.map(group => ({ id: group.id, cards: group.entries.map(({ card }) => ({
      id: card.id, height: sizes?.get(card.id) ?? estimatedHeight(card, geometry.width),
    })) }));
    return byCategory ? packRealizedCategories(measured, geometry.height, geometry.gap, geometry.inset, geometry.heading)
      : packRealizedCards(measured[0]!.cards, geometry.height, geometry.gap, fillColumns);
  }, [groups, measurements, measurementKey, geometry, byCategory, fillColumns]);

  useLayoutEffect(() => {
    const node = rail.current, widthProbe = probe.current;
    if (!node || !widthProbe) return;
    const measure = () => {
      const style = getComputedStyle(node);
      const next = {
        width: widthProbe.getBoundingClientRect().width,
        viewport: node.clientWidth,
        height: node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 1,
        gap: parseFloat(style.getPropertyValue("--card-gap")),
        inset: parseFloat(style.getPropertyValue("--frame-inset")),
        heading: parseFloat(style.getPropertyValue("--frame-heading")),
      };
      if (next.height <= 0 || next.width <= 0) return;
      setGeometry(current => current && Object.keys(next).every(key =>
        next[key as keyof Geometry] === current[key as keyof Geometry]) ? current : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observer.observe(widthProbe);
    return () => observer.disconnect();
  }, [rail]);

  function updateWindow() {
    const node = rail.current;
    if (!node || !virtual || !geometry || !packing || !step) return;
    const next = realizedColumnWindow(node.scrollLeft, geometry.viewport, step, packing.columns);
    if (windowRef.current?.first !== next.first || windowRef.current?.last !== next.last) {
      windowRef.current = next;
      setWindow(next);
    }
  }

  useLayoutEffect(() => {
    const node = rail.current;
    if (!node || !geometry || !packing || !step) {
      previous.current = undefined;
      return;
    }
    const next = { key: viewKey, step, packing };
    const last = previous.current;
    if (virtual && last?.key === viewKey && last.packing !== packing) {
      const left = node.scrollLeft;
      const anchored = preserveRealizedRailOffset(left, geometry.viewport, last, next);
      if (Math.abs(anchored - left) >= 1) node.scrollLeft = anchored;
    }
    previous.current = next;
    updateWindow();
  }, [geometry, packing, rail, step, viewKey, virtual]);

  const activeWindow = window ?? (geometry && packing && step ? realizedColumnWindow(0, geometry.viewport, step, packing.columns) : undefined);
  const initial = virtual && !activeWindow ? new Set(groups.flatMap(group => group.entries).slice(0, firstMountCount).map(({ card }) => card.id)) : undefined;
  const containsColumn = (column: number) => !virtual || !activeWindow || column >= activeWindow.first && column <= activeWindow.last;
  const isMounted = (id: string, position: PackedCardPosition | undefined) =>
    !virtual || id === focusedId || (position ? containsColumn(position.column) : initial?.has(id) === true);
  const mountedKey = groups.flatMap(group => group.entries).filter(({ card }) => isMounted(card.id, packing?.positions[card.id]))
    .map(({ card }) => card.id).join("|");

  useLayoutEffect(() => {
    const node = rail.current;
    if (!node || !geometry) return;
    const contents = [...node.querySelectorAll<HTMLElement>("[data-realized-card-content]")];
    if (!contents.length) return;
    const measure = (elements: readonly HTMLElement[]) => {
      const changed = elements.flatMap(content => {
        const card = content.parentElement;
        return card ? [[card.id, Math.ceil(content.getBoundingClientRect().height + card.offsetHeight - card.clientHeight)] as const] : [];
      });
      setMeasurements(current => {
        const heights = current?.key === measurementKey ? current.heights : new Map<string, number>();
        const updated = changed.filter(([id, height]) => heights.get(id) !== height);
        return updated.length ? { key: measurementKey, heights: new Map([...heights, ...updated]) } : current;
      });
    };
    measure(contents);
    const observer = new ResizeObserver(entries => measure(entries.map(entry => entry.target as HTMLElement)));
    for (const content of contents) observer.observe(content, { box: "border-box" });
    return () => observer.disconnect();
  }, [geometry, measurementKey, mountedKey, rail]);

  return { probe, packing, containsColumn, isMounted, setFocusedId, updateWindow };
}
