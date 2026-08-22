import {
  parseActivityId,
  parseCategoryId,
  parseMerchantId,
  parsePersonId,
  parsePlaceId,
} from "../identity";
import { parseGlobalWindow, parseYearMonth } from "../time";
import {
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  type UnknownRecord,
} from "../validation";
import {
  parseDayContext,
  parseLifeScopeContext,
} from "./contexts";
import type {
  AnalysisFilters,
  AnalysisScope,
  AnalysisSubject,
  AnalysisTime,
} from "./types";

const subjectKinds: ReadonlySet<string> = new Set<AnalysisSubject["kind"]>([
  "household",
  "person",
]);
const timeKinds: ReadonlySet<string> = new Set<AnalysisTime["kind"]>([
  "month",
  "global",
]);

type ValueParser<T> = (value: unknown) => T;

function parseCollection<T>(
  value: unknown,
  parseValue: ValueParser<T>,
  fieldName: string,
): readonly T[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${fieldName} doit être un tableau.`);
  }
  return value.map((item, index) => {
    try {
      return parseValue(item);
    } catch {
      throw new TypeError(`${fieldName}[${index}] est invalide.`);
    }
  });
}

function parseOptionalCollection<T>(
  record: UnknownRecord,
  key: string,
  parseValue: ValueParser<T>,
): readonly T[] | undefined {
  return hasOwn(record, key)
    ? parseCollection(record[key], parseValue, `AnalysisFilters.${key}`)
    : undefined;
}

export function parseAnalysisFilters(value: unknown): AnalysisFilters {
  const record = parseStrictRecord(
    value,
    [
      "categoryIds",
      "activityIds",
      "merchantIds",
      "placeIds",
      "lifeScopeContext",
      "dayContext",
    ],
    "AnalysisFilters",
  );
  const categoryIds = parseOptionalCollection(
    record,
    "categoryIds",
    parseCategoryId,
  );
  const activityIds = parseOptionalCollection(
    record,
    "activityIds",
    parseActivityId,
  );
  const merchantIds = parseOptionalCollection(
    record,
    "merchantIds",
    parseMerchantId,
  );
  const placeIds = parseOptionalCollection(record, "placeIds", parsePlaceId);
  const lifeScopeContext = parseOptionalCollection(
    record,
    "lifeScopeContext",
    parseLifeScopeContext,
  );
  const dayContext = parseOptionalCollection(
    record,
    "dayContext",
    parseDayContext,
  );

  return {
    ...(categoryIds === undefined ? {} : { categoryIds }),
    ...(activityIds === undefined ? {} : { activityIds }),
    ...(merchantIds === undefined ? {} : { merchantIds }),
    ...(placeIds === undefined ? {} : { placeIds }),
    ...(lifeScopeContext === undefined ? {} : { lifeScopeContext }),
    ...(dayContext === undefined ? {} : { dayContext }),
  };
}

export function parseAnalysisSubject(value: unknown): AnalysisSubject {
  const candidate = parseStrictRecord(
    value,
    ["kind", "personId"],
    "AnalysisSubject",
  );
  const kind = parseStringLiteral<AnalysisSubject["kind"]>(
    requireProperty(candidate, "kind", "AnalysisSubject"),
    subjectKinds,
    "AnalysisSubject.kind",
  );

  if (kind === "household") {
    parseStrictRecord(value, ["kind"], "AnalysisSubject");
    return { kind };
  }

  const record = parseStrictRecord(
    value,
    ["kind", "personId"],
    "AnalysisSubject",
  );
  return {
    kind,
    personId: parsePersonId(
      requireProperty(record, "personId", "AnalysisSubject"),
    ),
  };
}

export function parseAnalysisTime(value: unknown): AnalysisTime {
  const candidate = parseStrictRecord(
    value,
    ["kind", "month", "observationWindow", "asOf"],
    "AnalysisTime",
  );
  const kind = parseStringLiteral<AnalysisTime["kind"]>(
    requireProperty(candidate, "kind", "AnalysisTime"),
    timeKinds,
    "AnalysisTime.kind",
  );

  if (kind === "month") {
    const record = parseStrictRecord(value, ["kind", "month"], "AnalysisTime");
    return {
      kind,
      month: parseYearMonth(requireProperty(record, "month", "AnalysisTime")),
    };
  }

  const record = parseStrictRecord(
    value,
    ["kind", "observationWindow", "asOf"],
    "AnalysisTime",
  );
  return {
    kind,
    observationWindow: parseGlobalWindow(
      requireProperty(record, "observationWindow", "AnalysisTime"),
    ),
    asOf: parseYearMonth(requireProperty(record, "asOf", "AnalysisTime")),
  };
}

export function parseAnalysisScope(value: unknown): AnalysisScope {
  const record = parseStrictRecord(
    value,
    ["subject", "time", "filters"],
    "AnalysisScope",
  );
  const subject = parseAnalysisSubject(
    requireProperty(record, "subject", "AnalysisScope"),
  );
  const time = parseAnalysisTime(
    requireProperty(record, "time", "AnalysisScope"),
  );
  const filters = hasOwn(record, "filters")
    ? parseAnalysisFilters(record.filters)
    : undefined;

  return {
    subject,
    time,
    ...(filters === undefined ? {} : { filters }),
  };
}
