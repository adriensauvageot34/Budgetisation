import {
  parseActivityId,
  parseCategoryId,
  parseLifeEventId,
  parseMerchantId,
  parseMomentId,
  parsePlaceId,
  parseSubcategoryId,
  type ActivityId,
  type CategoryId,
  type LifeEventId,
  type MerchantId,
  type MomentId,
  type PlaceId,
  type SubcategoryId,
} from "../../core/identity";
import { parseMoney, type Money } from "../../core/money";
import {
  parseGlobalWindow,
  parseLocalDate,
  parseYearMonth,
  type GlobalWindow,
  type LocalDate,
  type YearMonth,
} from "../../core/time";
import {
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../../core/validation";
import {
  parseCursorToken,
  type CursorToken,
  type SortDirection,
  type SortSpec,
} from "../collections";

export type OperationsBrowseSortKey =
  | "bank_date"
  | "economic_timing"
  | "bank_amount"
  | "economic_net";

export type OperationsTimeFilter =
  | { readonly kind: "bank_month"; readonly month: YearMonth }
  | {
      readonly kind: "bank_range";
      readonly start: LocalDate;
      readonly endExclusive: LocalDate;
    }
  | { readonly kind: "economic_month"; readonly month: YearMonth }
  | {
      readonly kind: "economic_range";
      readonly start: LocalDate;
      readonly endExclusive: LocalDate;
    }
  | {
      readonly kind: "global_window";
      readonly window: GlobalWindow;
      readonly asOf: YearMonth;
    };

export type OperationQualityFilter =
  | "complete"
  | "partial"
  | "conflict"
  | "unknown";

export type OperationsBrowseFilters = {
  readonly categoryIds: readonly CategoryId[];
  readonly subcategoryIds: readonly SubcategoryId[];
  readonly merchantIds: readonly MerchantId[];
  readonly activityIds: readonly ActivityId[];
  readonly momentIds: readonly MomentId[];
  readonly lifeEventIds: readonly LifeEventId[];
  readonly placeIds: readonly PlaceId[];
  readonly accountIds: readonly string[];
  readonly preciseTypes: readonly string[];
  readonly necessity: readonly ("necessary" | "discretionary" | "unknown")[];
  readonly fixedVariable: readonly ("fixed" | "variable" | "unknown")[];
  readonly lifeScope: readonly ("Vie courante" | "Hors quotidien")[];
  readonly dayContext: readonly (
    | "work_onsite"
    | "remote"
    | "weekend_home"
    | "leave_home"
  )[];
  readonly quality: readonly OperationQualityFilter[];
  readonly amountMin: Money | null;
  readonly amountMax: Money | null;
};

export type OperationsBrowseParams = {
  readonly time: OperationsTimeFilter;
  readonly search?: string | null;
  readonly sort?: SortSpec<OperationsBrowseSortKey>;
  readonly filters?: Partial<OperationsBrowseFilters>;
  readonly cursor?: CursorToken | string | null;
  readonly limit?: number;
};

export type NormalizedOperationsBrowseParams = {
  readonly time: OperationsTimeFilter;
  readonly search: string | null;
  readonly sort: SortSpec<OperationsBrowseSortKey>;
  readonly filters: OperationsBrowseFilters;
  readonly cursor: CursorToken | null;
  readonly limit: number;
};

const sortKeys = new Set<OperationsBrowseSortKey>([
  "bank_date",
  "economic_timing",
  "bank_amount",
  "economic_net",
]);
const directions = new Set(["asc", "desc"] as const);
const qualityValues = new Set<OperationQualityFilter>([
  "complete",
  "partial",
  "conflict",
  "unknown",
]);
const necessityValues = new Set(["necessary", "discretionary", "unknown"] as const);
const fixedVariableValues = new Set(["fixed", "variable", "unknown"] as const);
const lifeScopeValues = new Set(["Vie courante", "Hors quotidien"] as const);
const dayContextValues = new Set([
  "work_onsite",
  "remote",
  "weekend_home",
  "leave_home",
] as const);
const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function parseString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} doit être une chaîne non vide.`);
  }
  return value.trim();
}

function parseUuid(value: unknown): string {
  const parsed = parseString(value, "AccountId");
  if (!uuidPattern.test(parsed)) throw new TypeError("AccountId doit être un UUID canonique.");
  return parsed;
}

function list<Id extends string>(
  value: unknown,
  parser: (candidate: unknown) => Id,
  name: string,
): readonly Id[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${name} doit être un tableau.`);
  return [...new Set(value.map(parser))].sort();
}

function literalList<Value extends string>(
  value: unknown,
  values: ReadonlySet<string>,
  name: string,
): readonly Value[] {
  return list(value, (candidate) => parseStringLiteral(candidate, values, name), name);
}

function parseTime(value: unknown): OperationsTimeFilter {
  const candidate = parseStrictRecord(
    value,
    ["kind", "month", "start", "endExclusive", "window", "asOf"],
    "OperationsTimeFilter",
  );
  const kind = requireProperty(candidate, "kind", "OperationsTimeFilter");
  if (kind === "bank_month" || kind === "economic_month") {
    const record = parseStrictRecord(value, ["kind", "month"], "OperationsTimeFilter");
    return { kind, month: parseYearMonth(requireProperty(record, "month", "OperationsTimeFilter")) };
  }
  if (kind === "bank_range" || kind === "economic_range") {
    const record = parseStrictRecord(value, ["kind", "start", "endExclusive"], "OperationsTimeFilter");
    const start = parseLocalDate(requireProperty(record, "start", "OperationsTimeFilter"));
    const endExclusive = parseLocalDate(requireProperty(record, "endExclusive", "OperationsTimeFilter"));
    if (start >= endExclusive) throw new TypeError("OperationsTimeFilter range est invalide.");
    return { kind, start, endExclusive };
  }
  if (kind === "global_window") {
    const record = parseStrictRecord(value, ["kind", "window", "asOf"], "OperationsTimeFilter");
    return {
      kind,
      window: parseGlobalWindow(requireProperty(record, "window", "OperationsTimeFilter")),
      asOf: parseYearMonth(requireProperty(record, "asOf", "OperationsTimeFilter")),
    };
  }
  throw new TypeError("OperationsTimeFilter.kind est invalide.");
}

function parseFilters(value: unknown): OperationsBrowseFilters {
  const record = parseStrictRecord(
    value ?? {},
    [
      "categoryIds",
      "subcategoryIds",
      "merchantIds",
      "activityIds",
      "momentIds",
      "lifeEventIds",
      "placeIds",
      "accountIds",
      "preciseTypes",
      "necessity",
      "fixedVariable",
      "lifeScope",
      "dayContext",
      "quality",
      "amountMin",
      "amountMax",
    ],
    "OperationsBrowseFilters",
  );
  const amountMin = hasOwn(record, "amountMin") && record.amountMin !== null
    ? parseMoney(record.amountMin)
    : null;
  const amountMax = hasOwn(record, "amountMax") && record.amountMax !== null
    ? parseMoney(record.amountMax)
    : null;
  return {
    categoryIds: list(record.categoryIds, parseCategoryId, "categoryIds"),
    subcategoryIds: list(record.subcategoryIds, parseSubcategoryId, "subcategoryIds"),
    merchantIds: list(record.merchantIds, parseMerchantId, "merchantIds"),
    activityIds: list(record.activityIds, parseActivityId, "activityIds"),
    momentIds: list(record.momentIds, parseMomentId, "momentIds"),
    lifeEventIds: list(record.lifeEventIds, parseLifeEventId, "lifeEventIds"),
    placeIds: list(record.placeIds, parsePlaceId, "placeIds"),
    accountIds: list(record.accountIds, parseUuid, "accountIds"),
    preciseTypes: list(record.preciseTypes, (item) => parseString(item, "preciseType"), "preciseTypes"),
    necessity: literalList(record.necessity, necessityValues, "necessity"),
    fixedVariable: literalList(record.fixedVariable, fixedVariableValues, "fixedVariable"),
    lifeScope: literalList(record.lifeScope, lifeScopeValues, "lifeScope"),
    dayContext: literalList(record.dayContext, dayContextValues, "dayContext"),
    quality: literalList(record.quality, qualityValues, "quality"),
    amountMin,
    amountMax,
  };
}

export function parseOperationsBrowseParams(value: unknown): NormalizedOperationsBrowseParams {
  const record = parseStrictRecord(
    value,
    ["time", "search", "sort", "filters", "cursor", "limit"],
    "OperationsBrowseParams",
  );
  const rawSearch = hasOwn(record, "search") ? record.search : null;
  if (rawSearch !== null && typeof rawSearch !== "string") {
    throw new TypeError("OperationsBrowseParams.search est invalide.");
  }
  const search = rawSearch === null || rawSearch.trim().length === 0
    ? null
    : rawSearch.trim();
  if (search !== null && search.length > 120) {
    throw new TypeError("OperationsBrowseParams.search dépasse 120 caractères.");
  }
  const rawSort = hasOwn(record, "sort") ? record.sort : { key: "bank_date", direction: "desc" };
  const sortRecord = parseStrictRecord(rawSort, ["key", "direction"], "OperationsBrowseSort");
  const sort = {
    key: parseStringLiteral<OperationsBrowseSortKey>(
      requireProperty(sortRecord, "key", "OperationsBrowseSort"),
      sortKeys,
      "OperationsBrowseSort.key",
    ),
    direction: parseStringLiteral<SortDirection>(
      requireProperty(sortRecord, "direction", "OperationsBrowseSort"),
      directions,
      "OperationsBrowseSort.direction",
    ),
  };
  const rawLimit = hasOwn(record, "limit") ? record.limit : 50;
  if (typeof rawLimit !== "number" || !Number.isSafeInteger(rawLimit) || rawLimit < 1 || rawLimit > 50) {
    throw new TypeError("OperationsBrowseParams.limit doit être compris entre 1 et 50.");
  }
  return {
    time: parseTime(requireProperty(record, "time", "OperationsBrowseParams")),
    search,
    sort,
    filters: parseFilters(hasOwn(record, "filters") ? record.filters : {}),
    cursor: !hasOwn(record, "cursor") || record.cursor === null
      ? null
      : parseCursorToken(record.cursor),
    limit: rawLimit,
  };
}
