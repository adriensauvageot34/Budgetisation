"use client";

export function startDetailTiming(surface: string) {
  const start = performance.now();
  const phases = new Set<string>();
  let cancelled = false;
  let shift = 0;
  const observer = typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("layout-shift")
    ? new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const sample = entry as PerformanceEntry & { value: number };
        if (sample.startTime >= start) shift += sample.value;
      }
    }) : undefined;
  observer?.observe({ type: "layout-shift" });
  const stop = () => {
    clearTimeout(expiry);
    observer?.disconnect();
  };
  const expiry = setTimeout(stop, 10_000);
  return {
    cancel() { cancelled = true; stop(); },
    visible(phase: "structure" | "content") {
      if (phases.has(phase)) return;
      phases.add(phase);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (cancelled) return;
        const name = `budgetisation:${surface}:${phase}`;
        performance.clearMeasures(name);
        performance.measure(name, { start, end: performance.now() });
        if (phase === "content") {
          stop();
          if (observer) {
            const stability = `budgetisation:${surface}:layout`;
            performance.clearMarks(stability);
            performance.mark(stability, { detail: { shift } });
          }
        }
      }));
    },
  };
}
