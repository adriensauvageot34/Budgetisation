"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiResponse } from "@/core/api";
import type { YearMonth } from "@/core/time";
import type { UiTransportState } from "@/ui";
import { HistoryGenerationCache } from "./history-generation-cache";

export const historyGenerationCache = new HistoryGenerationCache(async (month) => {
  const response = await fetch("/api/query", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(10_000),
    headers: { "content-type": "application/json", "x-history-generation": "1" },
    body: JSON.stringify({ month }),
  });
  if (!response.ok) throw new Error("Vérification de la génération History indisponible.");
  return response.json();
});

/** SSR, restored RSC and overlays use the same generation fence. */
export function useHistoryQuery<T>(input: {
  month: YearMonth; key: string; fetchPayload: () => Promise<ApiResponse<T>>;
  initial?: UiTransportState<T>;
} | null): UiTransportState<T> {
  const [stored, setStored] = useState<{ key: string; state: UiTransportState<T> } | null>(null);
  const current = useRef(input);
  current.current = input;
  const key = input?.key;
  const month = input?.month;
  const initial = input?.initial;
  useEffect(() => {
    if (key === undefined || month === undefined) return;
    let active = true;
    let attempt = 0;
    const read = () => {
      const selected = current.current;
      if (selected === null) return;
      const id = ++attempt;
      void historyGenerationCache.read(month, key, selected.fetchPayload,
        selected.initial?.status === "success" ? selected.initial.response : undefined)
        .then((response) => {
          if (active && id === attempt) setStored({ key, state: {
            status: "success", response: response as ApiResponse<T>, refreshing: false,
          } });
        }).catch((error: unknown) => {
          if (active && id === attempt) setStored({ key, state: { status: "error", error: {
            code: "TEMPORARY_UNAVAILABLE", retryable: true, requestId: "history-generation",
            message: error instanceof Error ? error.message : "Génération History indisponible.",
          } } });
        });
    };
    const unsubscribe = historyGenerationCache.subscribe(month, () => {
      // Never retain previousData from another generation in an ErrorState.
      if (active) { setStored({ key, state: { status: "loading" } }); queueMicrotask(read); }
    });
    const visible = () => { if (document.visibilityState === "visible") read(); };
    const restored = () => read();
    window.addEventListener("focus", restored);
    window.addEventListener("pageshow", restored);
    window.addEventListener("popstate", restored);
    document.addEventListener("visibilitychange", visible);
    read();
    return () => {
      active = false; unsubscribe();
      window.removeEventListener("focus", restored);
      window.removeEventListener("pageshow", restored);
      window.removeEventListener("popstate", restored);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [key, month, initial]);
  if (input === null) return { status: "idle" };
  if (stored !== null && stored.key === key) {
    if (stored.state.status !== "success" || historyGenerationCache.matches(input.month, stored.state.response)) return stored.state;
    return { status: "loading" };
  }
  // Render an SSR response for hydration, then verify it before further use.
  return input.initial ?? { status: "loading" };
}
