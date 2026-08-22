export type ElementScrollSnapshot = {
  readonly top: number;
  readonly left: number;
};

export function captureElementScroll(element: HTMLElement): ElementScrollSnapshot {
  return { top: element.scrollTop, left: element.scrollLeft };
}
export function restoreElementScroll(
  element: HTMLElement,
  snapshot: ElementScrollSnapshot,
): void {
  element.scrollTo({ top: snapshot.top, left: snapshot.left, behavior: "auto" });
}

export function waitForContentReady(
  ready: () => boolean,
  signal?: AbortSignal,
): Promise<"ready" | "cancelled"> {
  if (ready()) return Promise.resolve("ready");
  if (signal?.aborted) return Promise.resolve("cancelled");

  return new Promise((resolve) => {
    let frame = 0;
    const finish = (result: "ready" | "cancelled") => {
      cancelAnimationFrame(frame);
      signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };
    const onAbort = () => finish("cancelled");
    const check = () => {
      if (ready()) finish("ready");
      else frame = requestAnimationFrame(check);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    frame = requestAnimationFrame(check);
  });
}
