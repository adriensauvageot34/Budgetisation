import { rovingDirectionForKey, type RovingOrientation } from "./keyboard";

export type RovingFocusItem = { readonly disabled?: boolean };

function firstEnabled(items: readonly RovingFocusItem[]): number {
  return items.findIndex((item) => item.disabled !== true);
}

function lastEnabled(items: readonly RovingFocusItem[]): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.disabled !== true) return index;
  }
  return -1;
}

export function resolveRovingIndex(
  items: readonly RovingFocusItem[],
  currentIndex: number,
  key: string,
  orientation: RovingOrientation,
): number | null {
  const direction = rovingDirectionForKey(key, orientation);
  if (direction === null || items.length === 0) return null;
  if (direction === "first") return firstEnabled(items);
  if (direction === "last") return lastEnabled(items);

  const safeIndex = currentIndex >= 0 && currentIndex < items.length
    ? currentIndex
    : firstEnabled(items);
  if (safeIndex < 0) return -1;

  for (let step = 1; step <= items.length; step += 1) {
    const candidate = (safeIndex + direction * step + items.length) % items.length;
    if (items[candidate]?.disabled !== true) return candidate;
  }
  return safeIndex;
}

export function initialRovingIndex(
  items: readonly RovingFocusItem[],
  preferredIndex: number,
): number {
  if (
    preferredIndex >= 0 &&
    preferredIndex < items.length &&
    items[preferredIndex]?.disabled !== true
  ) return preferredIndex;
  return firstEnabled(items);
}
