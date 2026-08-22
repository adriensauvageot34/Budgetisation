export const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

function isRendered(element: HTMLElement): boolean {
  return element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true";
}
export function getFocusableElements(container: HTMLElement): readonly HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => isRendered(element) && element.closest("[inert]") === null,
  );
}

export function isFocusableElement(value: Element | null): value is HTMLElement {
  return value instanceof HTMLElement && value.matches(focusableSelector) && isRendered(value);
}

export function focusElement(element: HTMLElement | null | undefined): boolean {
  if (!element || !element.isConnected) return false;
  element.focus({ preventScroll: true });
  return document.activeElement === element;
}

export function focusFirstAvailable(
  candidates: readonly (HTMLElement | null | undefined)[],
): HTMLElement | null {
  for (const candidate of candidates) {
    if (focusElement(candidate)) return candidate ?? null;
  }
  return null;
}
