"use client";

import { useLayoutEffect, useRef, type UIEvent } from "react";

export function useCategoryRankingScroll(selectedId?: string, mode?: string) {
  const ref = useRef<HTMLUListElement>(null);
  const rankingPosition = useRef(0);

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = selectedId ? 0 : rankingPosition.current;
  }, [mode, selectedId]);

  function onScroll(event: UIEvent<HTMLUListElement>) {
    if (!selectedId) rankingPosition.current = event.currentTarget.scrollTop;
  }

  return { ref, onScroll };
}

export function focusCategoryRankingRow(root: HTMLElement | null, id: string): boolean {
  const row = root?.querySelector<HTMLButtonElement>(`[data-category-list] [data-category-trigger="${CSS.escape(id)}"]`);
  const list = row?.closest<HTMLElement>("[data-category-list]");
  if (!list || !row || !row.getClientRects().length) return false;

  const bounds = list.getBoundingClientRect();
  const target = row.getBoundingClientRect();
  if (target.top < bounds.top) list.scrollTop += target.top - bounds.top;
  else if (target.bottom > bounds.bottom) list.scrollTop += target.bottom - bounds.bottom;
  row.focus({ preventScroll: true });
  return true;
}
