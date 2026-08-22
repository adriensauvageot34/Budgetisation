import { focusFirstAvailable } from "../accessibility";

export type FocusRestorationTarget = {
  readonly invoker?: HTMLElement | null;
  readonly semanticFallback?: HTMLElement | null;
  readonly contentFallback?: HTMLElement | null;
};

export function captureFocusRestorationTarget(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}
export function restoreOverlayFocus(target: FocusRestorationTarget): boolean {
  return focusFirstAvailable([
    target.invoker,
    target.semanticFallback,
    target.contentFallback,
  ]) !== null;
}

export function scheduleOverlayFocusRestoration(
  target: FocusRestorationTarget,
): () => void {
  const frame = requestAnimationFrame(() => restoreOverlayFocus(target));
  return () => cancelAnimationFrame(frame);
}
