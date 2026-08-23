import {
  parseActivityId,
  parseCategoryId,
  parseMerchantId,
  parsePersonId,
  parsePlaceId,
  type ActivityId,
  type CategoryId,
  type MerchantId,
  type PersonId,
  type PlaceId,
} from "../../core/identity";
import {
  parseGlobalWindow,
  parseLocalDate,
  parseYearMonth,
  type GlobalWindow,
  type LocalDate,
  type YearMonth,
} from "../../core/time";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  validationFailure,
  withValidationPath,
  type UnknownRecord,
} from "../../core/validation";

export type OperationsNavigationFilters = {
  readonly timeKind?:
    | "bank_month"
    | "bank_range"
    | "economic_month"
    | "economic_range"
    | "global_window";
  readonly month?: YearMonth;
  readonly startDate?: LocalDate;
  readonly endExclusive?: LocalDate;
  readonly globalWindow?: GlobalWindow;
  readonly asOf?: YearMonth;
  readonly personId?: PersonId;
  readonly categoryIds?: readonly CategoryId[];
  readonly activityIds?: readonly ActivityId[];
  readonly merchantIds?: readonly MerchantId[];
  readonly placeIds?: readonly PlaceId[];
  readonly search?: string;
  readonly sort?:
    | "bank_date_desc"
    | "bank_date_asc"
    | "economic_timing_desc"
    | "bank_amount_desc"
    | "economic_net_desc";
  readonly mode?: "compact" | "standard" | "complete";
  readonly cursor?: string;
};

type IdParser<Id extends string> = (value: unknown) => Id;

function parseIdCollection<Id extends string>(
  value: unknown,
  parseId: IdParser<Id>,
  fieldName: string,
): readonly Id[] {
  if (!Array.isArray(value)) {
    validationFailure({
      path: [],
      code: "invalid_type",
      message: `${fieldName} doit être un tableau.`,
    });
  }

  const ids = value.map((item, index) =>
    withValidationPath(index, () => parseId(item)),
  );
  return [...new Set(ids)].sort((left, right) =>
    left === right ? 0 : left < right ? -1 : 1,
  );
}

function parseOptionalIdCollection<Id extends string>(
  record: UnknownRecord,
  key: string,
  parseId: IdParser<Id>,
): readonly Id[] | undefined {
  if (!hasOwn(record, key)) return undefined;
  const ids = withValidationPath(key, () =>
    parseIdCollection(record[key], parseId, key),
  );
  return ids.length === 0 ? undefined : ids;
}

export function parseOperationsNavigationFilters(
  value: unknown,
): OperationsNavigationFilters {
  const record = parseStrictRecord(
    value,
    [
      "month",
      "startDate",
      "endExclusive",
      "timeKind",
      "globalWindow",
      "asOf",
      "personId",
      "categoryIds",
      "activityIds",
      "merchantIds",
      "placeIds",
      "search",
      "sort",
      "mode",
      "cursor",
    ],
    "OperationsNavigationFilters",
  );
  const month = hasOwn(record, "month")
    ? withValidationPath("month", () => parseYearMonth(record.month))
    : undefined;
  const startDate = hasOwn(record, "startDate")
    ? withValidationPath("startDate", () => parseLocalDate(record.startDate))
    : undefined;
  const endExclusive = hasOwn(record, "endExclusive")
    ? withValidationPath("endExclusive", () =>
        parseLocalDate(record.endExclusive),
      )
    : undefined;
  const timeKindValues = new Set([
    "bank_month",
    "bank_range",
    "economic_month",
    "economic_range",
    "global_window",
  ]);
  const timeKind = hasOwn(record, "timeKind")
    ? typeof record.timeKind === "string" && timeKindValues.has(record.timeKind)
      ? record.timeKind as NonNullable<OperationsNavigationFilters["timeKind"]>
      : validationFailure({ path: ["timeKind"], code: "invalid_time_kind", message: "timeKind Opérations est invalide." })
    : undefined;
  const globalWindow = hasOwn(record, "globalWindow")
    ? withValidationPath("globalWindow", () => parseGlobalWindow(record.globalWindow))
    : undefined;
  const asOf = hasOwn(record, "asOf")
    ? withValidationPath("asOf", () => parseYearMonth(record.asOf))
    : undefined;

  if ((startDate === undefined) !== (endExclusive === undefined)) {
    validationFailure({
      path: [startDate === undefined ? "startDate" : "endExclusive"],
      code: "incomplete_date_range",
      message: "startDate et endExclusive doivent être fournis ensemble.",
    });
  }
  if (
    startDate !== undefined &&
    endExclusive !== undefined &&
    startDate >= endExclusive
  ) {
    validationFailure({
      path: ["endExclusive"],
      code: "invalid_date_range",
      message: "endExclusive doit être strictement postérieur à startDate.",
    });
  }
  if (month !== undefined && startDate !== undefined) {
    validationFailure({
      path: ["month"],
      code: "conflicting_periods",
      message: "month et une fenêtre de dates sont mutuellement exclusifs.",
    });
  }
  if ((globalWindow === undefined) !== (asOf === undefined)) {
    validationFailure({
      path: [globalWindow === undefined ? "globalWindow" : "asOf"],
      code: "incomplete_global_window",
      message: "globalWindow et asOf doivent être fournis ensemble.",
    });
  }
  if (globalWindow !== undefined && (month !== undefined || startDate !== undefined)) {
    validationFailure({
      path: ["globalWindow"],
      code: "conflicting_periods",
      message: "Une fenêtre globale ne peut pas être combinée à un mois ou une plage.",
    });
  }
  if (
    timeKind !== undefined &&
    ((timeKind.endsWith("_month") && month === undefined) ||
      (timeKind.endsWith("_range") && startDate === undefined) ||
      (timeKind === "global_window" && globalWindow === undefined))
  ) {
    validationFailure({
      path: ["timeKind"],
      code: "incomplete_period",
      message: "timeKind ne correspond pas aux paramètres temporels fournis.",
    });
  }

  const personId = hasOwn(record, "personId")
    ? withValidationPath("personId", () => parsePersonId(record.personId))
    : undefined;
  const categoryIds = parseOptionalIdCollection(
    record,
    "categoryIds",
    parseCategoryId,
  );
  const activityIds = parseOptionalIdCollection(
    record,
    "activityIds",
    parseActivityId,
  );
  const merchantIds = parseOptionalIdCollection(
    record,
    "merchantIds",
    parseMerchantId,
  );
  const placeIds = parseOptionalIdCollection(record, "placeIds", parsePlaceId);
  const search = hasOwn(record, "search")
    ? typeof record.search === "string" && record.search.trim().length > 0 && record.search.length <= 120
      ? record.search.trim()
      : validationFailure({ path: ["search"], code: "invalid_search", message: "search doit contenir 1 à 120 caractères." })
    : undefined;
  const sortValues = new Set([
    "bank_date_desc",
    "bank_date_asc",
    "economic_timing_desc",
    "bank_amount_desc",
    "economic_net_desc",
  ]);
  const sort = hasOwn(record, "sort")
    ? typeof record.sort === "string" && sortValues.has(record.sort)
      ? record.sort as NonNullable<OperationsNavigationFilters["sort"]>
      : validationFailure({ path: ["sort"], code: "invalid_sort", message: "sort Opérations est invalide." })
    : undefined;
  const modeValues = new Set(["compact", "standard", "complete"]);
  const mode = hasOwn(record, "mode")
    ? typeof record.mode === "string" && modeValues.has(record.mode)
      ? record.mode as NonNullable<OperationsNavigationFilters["mode"]>
      : validationFailure({ path: ["mode"], code: "invalid_mode", message: "mode Opérations est invalide." })
    : undefined;
  const cursor = hasOwn(record, "cursor")
    ? typeof record.cursor === "string" && record.cursor.length > 0
      ? record.cursor
      : validationFailure({ path: ["cursor"], code: "invalid_cursor", message: "cursor Opérations est invalide." })
    : undefined;

  return {
    ...(timeKind === undefined ? {} : { timeKind }),
    ...(month === undefined ? {} : { month }),
    ...(startDate === undefined ? {} : { startDate, endExclusive }),
    ...(globalWindow === undefined ? {} : { globalWindow, asOf }),
    ...(personId === undefined ? {} : { personId }),
    ...(categoryIds === undefined ? {} : { categoryIds }),
    ...(activityIds === undefined ? {} : { activityIds }),
    ...(merchantIds === undefined ? {} : { merchantIds }),
    ...(placeIds === undefined ? {} : { placeIds }),
    ...(search === undefined ? {} : { search }),
    ...(sort === undefined ? {} : { sort }),
    ...(mode === undefined ? {} : { mode }),
    ...(cursor === undefined ? {} : { cursor }),
  };
}

export const operationsNavigationFiltersSchema = createRuntimeSchema(
  parseOperationsNavigationFilters,
);
