import type { BarPlaceSearchState } from "./bar-place-search";

/** Transient navigation only. Never serialized into a Draft or browser storage. */
export type BarViewMemory = {
  queries: Record<string, string>;
  googleSearch?: BarPlaceSearchState;
  pages: Record<string, number>;
  dockScroll: Record<string, number>;
  allPlaces: boolean;
  allBefore: boolean;
  family?: "drinks" | "food" | null;
};

/** Owned by one mounted Composer, scoped to month and occurrence identity. */
export function rememberBarView(cache: Map<string, BarViewMemory>, key: string, view: BarViewMemory) {
  cache.delete(key);
  cache.set(key, view);
  if (cache.size > 32) cache.delete(cache.keys().next().value!);
}
