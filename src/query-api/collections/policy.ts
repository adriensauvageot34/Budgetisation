import {
  hasOwn,
  parseStrictRecord,
} from "../../core/validation";
import { canonicalSerializeQueryParams } from "../request/cache-key";
import { parseCursorToken } from "./cursor";
import { normalizeCollectionSearch } from "./search";
import { getSortDefinition, parseSortSpec } from "./sort";
import type {
  CollectionPolicy,
  CollectionRequestParams,
  SortSpec,
} from "./types";

export function defineCollectionPolicy<
  Resource extends import("../request/resource-key").QueryResourceKey,
  SortKey extends string,
  Filters extends object,
  SearchField extends string,
>(
  policy: CollectionPolicy<Resource, SortKey, Filters, SearchField>,
): CollectionPolicy<Resource, SortKey, Filters, SearchField> {
  if (
    !Number.isInteger(policy.defaultLimit) ||
    !Number.isInteger(policy.maxLimit) ||
    policy.defaultLimit < 1 ||
    policy.maxLimit < policy.defaultLimit
  ) {
    throw new TypeError("CollectionPolicy contient des limites invalides.");
  }
  if (policy.cursorPolicyVersion.trim().length === 0) {
    throw new TypeError("CollectionPolicy.cursorPolicyVersion est requise.");
  }
  const sortKeys = policy.allowedSorts.map(({ key }) => key);
  if (sortKeys.length === 0 || new Set(sortKeys).size !== sortKeys.length) {
    throw new TypeError("CollectionPolicy.allowedSorts doit être non vide et unique.");
  }
  const defaultDefinition = getSortDefinition(
    policy.allowedSorts,
    policy.defaultSort.key,
  );
  if (!(["asc", "desc"] as const).includes(policy.defaultSort.direction)) {
    throw new TypeError("CollectionPolicy.defaultSort.direction est invalide.");
  }
  if (
    policy.search.kind === "enabled" &&
    (!Number.isInteger(policy.search.maxLength) ||
      policy.search.maxLength < 1 ||
      policy.search.searchableFields.length === 0 ||
      new Set(policy.search.searchableFields).size !==
        policy.search.searchableFields.length)
  ) {
    throw new TypeError("CollectionPolicy.search est invalide.");
  }
  void defaultDefinition;
  return Object.freeze(policy);
}

function parseLimit(
  value: unknown,
  maxLimit: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > maxLimit
  ) {
    throw new TypeError("CollectionRequestParams.limit est invalide.");
  }
  return value;
}

export function parseCollectionRequestParams<
  Resource extends import("../request/resource-key").QueryResourceKey,
  SortKey extends string,
  Filters extends object,
  SearchField extends string,
>(
  value: unknown,
  policy: CollectionPolicy<Resource, SortKey, Filters, SearchField>,
): CollectionRequestParams<SortSpec<SortKey>, Filters> {
  const record = parseStrictRecord(
    value,
    ["search", "sort", "filters", "cursor", "limit"],
    "CollectionRequestParams",
  );
  const search = normalizeCollectionSearch(
    hasOwn(record, "search") ? record.search : null,
    policy.search,
  );
  const sort = hasOwn(record, "sort")
    ? parseSortSpec(record.sort, policy.allowedSorts)
    : { ...policy.defaultSort };
  const parsedFilters = policy.localFiltersSchema.parse(
    hasOwn(record, "filters") ? record.filters : {},
  );
  const filters = policy.normalizeLocalFilters(parsedFilters);
  canonicalSerializeQueryParams(filters);

  const cursor = hasOwn(record, "cursor")
    ? record.cursor === null
      ? null
      : parseCursorToken(record.cursor)
    : null;
  const limit = hasOwn(record, "limit")
    ? parseLimit(record.limit, policy.maxLimit)
    : policy.defaultLimit;

  return { search, sort, filters, cursor, limit };
}
