import type { Brand } from "../../core/identity";
import type { RuntimeSchema } from "../../core/validation";
import type { QueryFilterKey } from "../capabilities/types";
import type { QueryResourceKey } from "../request/resource-key";

export type CollectionState = "nonempty" | "empty" | "filtered_empty";

export type CursorToken = Brand<string, "CursorToken">;

export type CursorPage<T> = {
  readonly items: readonly T[];
  readonly pageInfo: {
    readonly nextCursor: CursorToken | null;
    readonly hasMore: boolean;
    readonly returnedCount: number;
    readonly totalCount?: number;
  };
  readonly state: CollectionState;
};

export type SortDirection = "asc" | "desc";
export type NullOrder = "first" | "last";
export type StableIdKind = "string" | "number";

export type SortSpec<Key extends string> = {
  readonly key: Key;
  readonly direction: SortDirection;
};

export type SortDefinition<Key extends string> = {
  readonly key: Key;
  readonly defaultDirection: SortDirection;
  readonly nulls: NullOrder;
  readonly stableIdKind: StableIdKind;
};

export type SearchPolicy<Field extends string = string> =
  | { readonly kind: "disabled" }
  | {
      readonly kind: "enabled";
      readonly searchableFields: readonly Field[];
      readonly maxLength: number;
    };

export type CollectionRequestParams<
  Sort extends SortSpec<string>,
  Filters extends object,
> = {
  readonly search: string | null;
  readonly sort: Sort;
  readonly filters: Filters;
  readonly cursor: CursorToken | null;
  readonly limit: number;
};

export type CollectionPolicy<
  Resource extends QueryResourceKey,
  SortKey extends string,
  Filters extends object,
  SearchField extends string = string,
> = {
  readonly resource: Resource;
  readonly cursorPolicyVersion: string;
  readonly defaultLimit: number;
  readonly maxLimit: number;
  readonly defaultSort: SortSpec<SortKey>;
  readonly allowedSorts: readonly SortDefinition<SortKey>[];
  readonly search: SearchPolicy<SearchField>;
  readonly localFiltersSchema: RuntimeSchema<Filters>;
  readonly normalizeLocalFilters: (filters: Filters) => Filters;
};

export type CollectionRestrictionState = {
  readonly searchActive: boolean;
  readonly localFiltersActive: boolean;
  readonly restrictiveScopeFilters: readonly QueryFilterKey[];
};

export type KeysetSortValue = string | number | boolean | null;
export type KeysetStableId = string | number;

export type KeysetAnchor = {
  readonly sortValue: KeysetSortValue;
  readonly stableId: KeysetStableId;
};
