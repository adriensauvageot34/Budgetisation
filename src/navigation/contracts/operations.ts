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
  parseLocalDate,
  parseYearMonth,
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
  readonly month?: YearMonth;
  readonly startDate?: LocalDate;
  readonly endExclusive?: LocalDate;
  readonly personId?: PersonId;
  readonly categoryIds?: readonly CategoryId[];
  readonly activityIds?: readonly ActivityId[];
  readonly merchantIds?: readonly MerchantId[];
  readonly placeIds?: readonly PlaceId[];
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
      "personId",
      "categoryIds",
      "activityIds",
      "merchantIds",
      "placeIds",
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

  return {
    ...(month === undefined ? {} : { month }),
    ...(startDate === undefined ? {} : { startDate, endExclusive }),
    ...(personId === undefined ? {} : { personId }),
    ...(categoryIds === undefined ? {} : { categoryIds }),
    ...(activityIds === undefined ? {} : { activityIds }),
    ...(merchantIds === undefined ? {} : { merchantIds }),
    ...(placeIds === undefined ? {} : { placeIds }),
  };
}

export const operationsNavigationFiltersSchema = createRuntimeSchema(
  parseOperationsNavigationFilters,
);
