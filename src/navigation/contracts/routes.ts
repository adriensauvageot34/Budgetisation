import { parsePersonId, type Brand, type PersonId } from "../../core/identity";
import type { GlobalWindow, LocalDate, YearMonth } from "../../core/time";
import {
  parseGlobalWindow,
  parseLocalDate,
  parseYearMonth,
  yearMonthOf,
} from "../../core/time";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  validationFailure,
  withValidationPath,
} from "../../core/validation";
import {
  operationsNavigationFiltersSchema,
  type OperationsNavigationFilters,
} from "./operations";

export type CalendarWeekRef = Brand<string, "CalendarWeekRef">;

export type CalendarRouteContext =
  | {
      readonly kind: "calendar_overview";
      readonly personId?: PersonId;
    }
  | {
      readonly kind: "calendar_month";
      readonly month: YearMonth;
      readonly day?: LocalDate;
      readonly personId?: PersonId;
    }
  | {
      readonly kind: "calendar_week";
      readonly month: YearMonth;
      readonly week: CalendarWeekRef;
      readonly personId?: PersonId;
    };

export type AnalysisRouteContext =
  | {
      readonly kind: "analysis_month";
      readonly month: YearMonth;
      readonly personId?: PersonId;
    }
  | {
      readonly kind: "analysis_global";
      readonly observationWindow: GlobalWindow;
      readonly asOf?: YearMonth;
      readonly personId?: PersonId;
    };

export type HistoryRootContext =
  | {
      readonly area: "calendar";
      readonly context: CalendarRouteContext;
    }
  | {
      readonly area: "analysis";
      readonly context: AnalysisRouteContext;
    };

export type OperationsRouteContext = {
  readonly kind: "operations";
  readonly filters: OperationsNavigationFilters;
};

export type RootNavigationContext = HistoryRootContext | OperationsRouteContext;

const historyAreas = new Set<HistoryRootContext["area"]>([
  "calendar",
  "analysis",
]);
const calendarKinds = new Set<CalendarRouteContext["kind"]>([
  "calendar_overview",
  "calendar_month",
  "calendar_week",
]);
const analysisKinds = new Set<AnalysisRouteContext["kind"]>([
  "analysis_month",
  "analysis_global",
]);
const calendarWeekPattern = /^semaine-(0[1-9]|[1-4]\d|5[0-3])$/;

export function parseCalendarWeekRef(value: unknown): CalendarWeekRef {
  if (typeof value !== "string" || !calendarWeekPattern.test(value)) {
    validationFailure({
      path: [],
      code: "invalid_format",
      message: "CalendarWeekRef doit respecter le format semaine-NN (01 à 53).",
    });
  }

  return value as CalendarWeekRef;
}

function parseCalendarRouteContext(value: unknown): CalendarRouteContext {
  const candidate = parseStrictRecord(
    value,
    ["kind", "month", "day", "week", "personId"],
    "CalendarRouteContext",
  );
  const kind = withValidationPath("kind", () =>
    parseStringLiteral<CalendarRouteContext["kind"]>(
      requireProperty(candidate, "kind", "CalendarRouteContext"),
      calendarKinds,
      "CalendarRouteContext.kind",
    ),
  );

  if (kind === "calendar_overview") {
    const record = parseStrictRecord(value, ["kind", "personId"], "CalendarRouteContext");
    const personId = hasOwn(record, "personId")
      ? withValidationPath("personId", () => parsePersonId(record.personId))
      : undefined;
    return { kind, ...(personId === undefined ? {} : { personId }) };
  }

  if (kind === "calendar_week") {
    const record = parseStrictRecord(
      value,
      ["kind", "month", "week", "personId"],
      "CalendarRouteContext",
    );
    return {
      kind,
      month: withValidationPath("month", () =>
        parseYearMonth(requireProperty(record, "month", "CalendarRouteContext")),
      ),
      week: withValidationPath("week", () =>
        parseCalendarWeekRef(
          requireProperty(record, "week", "CalendarRouteContext"),
        ),
      ),
      ...(hasOwn(record, "personId")
        ? { personId: withValidationPath("personId", () => parsePersonId(record.personId)) }
        : {}),
    };
  }

  const record = parseStrictRecord(
    value,
    ["kind", "month", "day", "personId"],
    "CalendarRouteContext",
  );
  const month = withValidationPath("month", () =>
    parseYearMonth(requireProperty(record, "month", "CalendarRouteContext")),
  );
  const day = hasOwn(record, "day")
    ? withValidationPath("day", () => parseLocalDate(record.day))
    : undefined;

  if (day !== undefined && yearMonthOf(day) !== month) {
    validationFailure({
      path: ["day"],
      code: "inconsistent_value",
      message: "CalendarRouteContext.day doit appartenir au mois demandé.",
    });
  }

  return {
    kind,
    month,
    ...(day === undefined ? {} : { day }),
    ...(hasOwn(record, "personId")
      ? { personId: withValidationPath("personId", () => parsePersonId(record.personId)) }
      : {}),
  };
}

function parseAnalysisRouteContext(value: unknown): AnalysisRouteContext {
  const candidate = parseStrictRecord(
    value,
    ["kind", "month", "observationWindow", "asOf", "personId"],
    "AnalysisRouteContext",
  );
  const kind = withValidationPath("kind", () =>
    parseStringLiteral<AnalysisRouteContext["kind"]>(
      requireProperty(candidate, "kind", "AnalysisRouteContext"),
      analysisKinds,
      "AnalysisRouteContext.kind",
    ),
  );

  if (kind === "analysis_month") {
    const record = parseStrictRecord(
      value,
      ["kind", "month", "personId"],
      "AnalysisRouteContext",
    );
    const personId = hasOwn(record, "personId")
      ? withValidationPath("personId", () => parsePersonId(record.personId))
      : undefined;
    return {
      kind,
      month: withValidationPath("month", () =>
        parseYearMonth(requireProperty(record, "month", "AnalysisRouteContext")),
      ),
      ...(personId === undefined ? {} : { personId }),
    };
  }

  const record = parseStrictRecord(
    value,
    ["kind", "observationWindow", "asOf", "personId"],
    "AnalysisRouteContext",
  );
  const observationWindow = withValidationPath("observationWindow", () =>
    parseGlobalWindow(
      requireProperty(record, "observationWindow", "AnalysisRouteContext"),
    ),
  );
  const asOf = hasOwn(record, "asOf")
    ? withValidationPath("asOf", () => parseYearMonth(record.asOf))
    : undefined;
  const personId = hasOwn(record, "personId")
    ? withValidationPath("personId", () => parsePersonId(record.personId))
    : undefined;

  return {
    kind,
    observationWindow,
    ...(asOf === undefined ? {} : { asOf }),
    ...(personId === undefined ? {} : { personId }),
  };
}

export function parseHistoryRootContext(value: unknown): HistoryRootContext {
  const record = parseStrictRecord(
    value,
    ["area", "context"],
    "HistoryRootContext",
  );
  const area = withValidationPath("area", () =>
    parseStringLiteral<HistoryRootContext["area"]>(
      requireProperty(record, "area", "HistoryRootContext"),
      historyAreas,
      "HistoryRootContext.area",
    ),
  );
  const context = requireProperty(record, "context", "HistoryRootContext");

  return area === "calendar"
    ? {
        area,
        context: withValidationPath("context", () =>
          parseCalendarRouteContext(context),
        ),
      }
    : {
        area,
        context: withValidationPath("context", () =>
          parseAnalysisRouteContext(context),
        ),
      };
}

export const calendarWeekRefSchema = createRuntimeSchema(parseCalendarWeekRef);
export const historyRootContextSchema = createRuntimeSchema(
  parseHistoryRootContext,
);

export function parseRootNavigationContext(
  value: unknown,
): RootNavigationContext {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "kind" in value
  ) {
    const record = parseStrictRecord(
      value,
      ["kind", "filters"],
      "OperationsRouteContext",
    );
    withValidationPath("kind", () =>
      parseStringLiteral(
        requireProperty(record, "kind", "OperationsRouteContext"),
        new Set(["operations"]),
        "OperationsRouteContext.kind",
      ),
    );
    return {
      kind: "operations",
      filters: withValidationPath("filters", () =>
        operationsNavigationFiltersSchema.parse(
          requireProperty(record, "filters", "OperationsRouteContext"),
        ),
      ),
    };
  }

  return parseHistoryRootContext(value);
}

export const rootNavigationContextSchema = createRuntimeSchema(
  parseRootNavigationContext,
);
