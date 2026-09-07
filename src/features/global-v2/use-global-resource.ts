"use client";

import { useEffect, useRef, useState } from "react";
import type { GlobalReadModelTransportState } from "@/query-api/global-v2";
import { globalUiErrorCode, type GlobalV2UiRequest, type GlobalV2VisitRuntime } from "./visit-runtime";

export function useGlobalV2Resource<Data>(
  runtime: GlobalV2VisitRuntime,
  request: GlobalV2UiRequest,
  enabled: boolean,
  priority: "DIRECT" | "BACKGROUND" = "BACKGROUND",
): { readonly state: GlobalReadModelTransportState<Data>; readonly retry: () => void } {
  const requestKey = runtime.cacheKey(request);
  const [attempt, setAttempt] = useState(0);
  const previous = useRef<Data | undefined>(runtime.peek(request)?.data as Data | undefined);
  const previousKey = useRef(requestKey);
  const [stateEntry, setStateEntry] = useState<{ readonly key: string; readonly state: GlobalReadModelTransportState<Data> }>(() => ({ key: requestKey, state: previous.current === undefined ? { status: "IDLE" } : { status: "READY", data: previous.current } }));
  const state: GlobalReadModelTransportState<Data> = stateEntry.key === requestKey ? stateEntry.state : { status: "IDLE" };

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const cached = runtime.peek(request)?.data as Data | undefined;
    if (previousKey.current !== requestKey) {
      previousKey.current = requestKey;
      previous.current = cached;
    }
    if (cached !== undefined) {
      previous.current = cached;
      setStateEntry({ key: requestKey, state: { status: "READY", data: cached } });
      return;
    }
    setStateEntry({ key: requestKey, state: { status: "LOADING" } });
    void runtime.request(request, priority).then((response) => {
      if (!active) return;
      previous.current = response.data as Data;
      setStateEntry({ key: requestKey, state: { status: "READY", data: response.data as Data } });
    }).catch((error: unknown) => {
      if (!active) return;
      const previousData = previous.current;
      setStateEntry({ key: requestKey, state: { status: "ERROR", errorCode: globalUiErrorCode(error), ...(previousData === undefined ? {} : { previousData }) } });
    });
    return () => { active = false; };
  }, [attempt, enabled, priority, requestKey, runtime]);

  return {
    state,
    retry: () => {
      runtime.invalidate(request);
      setAttempt((value) => value + 1);
    },
  };
}

export function useNearViewport(rootMargin = "150% 0px"): { readonly ref: React.RefObject<HTMLElement | null>; readonly near: boolean } {
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (element === null || near) return;
    if (!("IntersectionObserver" in window)) {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [near, rootMargin]);
  return { ref, near };
}

export function useMobileGlobalLayout(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return mobile;
}
