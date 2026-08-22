import { focusFirstAvailable, getFocusableElements } from "../accessibility";

let activeTrapRelease: (() => void) | null = null;

export function focusOverlayInitialTarget(
  overlay: HTMLElement,
  explicitTarget?: HTMLElement | null,
): HTMLElement | null {
  const declaredTarget = overlay.querySelector<HTMLElement>("[data-overlay-initial-focus]");
  const contentTarget = overlay.querySelector<HTMLElement>("[data-overlay-title], [data-overlay-content]");
  return focusFirstAvailable([explicitTarget, declaredTarget, contentTarget, overlay]);
}
export function activateOverlayFocusTrap(overlay: HTMLElement): () => void {
  activeTrapRelease?.();
  let released = false;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements(overlay);
    if (focusable.length === 0) {
      event.preventDefault();
      overlay.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    } else if (!overlay.contains(document.activeElement)) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };
  overlay.addEventListener("keydown", onKeyDown);

  const release = () => {
    if (released) return;
    released = true;
    overlay.removeEventListener("keydown", onKeyDown);
    if (activeTrapRelease === release) activeTrapRelease = null;
  };
  activeTrapRelease = release;
  return release;
}
