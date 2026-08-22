import type {
  CollectionRestrictionState,
  CollectionState,
  CursorPage,
  CursorToken,
} from "./types";

export function deriveCollectionState(input: {
  readonly returnedCount: number;
  readonly isFirstPage: boolean;
  readonly restrictions: CollectionRestrictionState;
}): CollectionState {
  if (!Number.isInteger(input.returnedCount) || input.returnedCount < 0) {
    throw new TypeError("returnedCount doit être un entier positif ou nul.");
  }
  if (input.returnedCount > 0 || !input.isFirstPage) return "nonempty";
  return input.restrictions.searchActive ||
    input.restrictions.localFiltersActive ||
    input.restrictions.restrictiveScopeFilters.length > 0
    ? "filtered_empty"
    : "empty";
}

export function createCursorPage<T>(input: {
  readonly items: readonly T[];
  readonly nextCursor: CursorToken | null;
  readonly isFirstPage: boolean;
  readonly restrictions: CollectionRestrictionState;
  readonly totalCount?: number;
}): CursorPage<T> {
  if (input.items.length === 0 && input.nextCursor !== null) {
    throw new TypeError("Une page vide ne peut pas annoncer un cursor suivant.");
  }
  if (
    input.totalCount !== undefined &&
    (!Number.isInteger(input.totalCount) || input.totalCount < input.items.length)
  ) {
    throw new TypeError("totalCount optionnel est invalide.");
  }

  const hasMore = input.nextCursor !== null;
  return {
    items: [...input.items],
    pageInfo: {
      nextCursor: input.nextCursor,
      hasMore,
      returnedCount: input.items.length,
      ...(input.totalCount === undefined
        ? {}
        : { totalCount: input.totalCount }),
    },
    state: deriveCollectionState({
      returnedCount: input.items.length,
      isFirstPage: input.isFirstPage,
      restrictions: input.restrictions,
    }),
  };
}
