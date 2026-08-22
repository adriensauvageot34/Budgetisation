export type InertSnapshot = {
  readonly inert: boolean;
  readonly ariaHidden: string | null;
};

type SuspensionEntry = { readonly snapshot: InertSnapshot; count: number };
const suspensions = new WeakMap<HTMLElement, SuspensionEntry>();

export function suspendElement(element: HTMLElement): () => void {
  const existing = suspensions.get(element);
  if (existing) existing.count += 1;
  else {
    suspensions.set(element, {
      count: 1,
      snapshot: {
        inert: element.inert,
        ariaHidden: element.getAttribute("aria-hidden"),
      },
    });
    element.inert = true;
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("data-ui-suspended", "");
  }

  let restored = false;

  return () => {
    if (restored) return;
    restored = true;
    const entry = suspensions.get(element);
    if (!entry) return;
    entry.count -= 1;
    if (entry.count > 0) return;
    suspensions.delete(element);
    element.inert = entry.snapshot.inert;
    if (entry.snapshot.ariaHidden === null) element.removeAttribute("aria-hidden");
    else element.setAttribute("aria-hidden", entry.snapshot.ariaHidden);
    element.removeAttribute("data-ui-suspended");
  };
}
