import {
  parseActivityId,
  parseCategoryId,
  parseLifeEventId,
  parseMerchantId,
  parseOperationId,
  parsePlaceId,
} from "../../core/identity";
import { parseMoney } from "../../core/money";
import {
  parseHouseholdTimeZone,
  parseInstant,
  parseLocalDate,
  parseYearMonth,
  yearMonthOf,
} from "../../core/time";
import {
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../../core/validation";
import { parseQueryCapabilities } from "../capabilities";
import { queryResourceKeys } from "../request";
import {
  parseMoneyEnvelope,
  parsePeriodCompleteness,
  parseReadModelSubject,
} from "../read-models";
import type {
  BoundedPreview,
  DayActivityPreviewItem,
  DayContextsReadModel,
  DayFinanceReadModel,
  DayHeaderReadModel,
  DayObservability,
  DayOperationPreviewItem,
  DayPlaceVisitPreviewItem,
  HistoryDayDetailReadModel,
} from "./types";
import {
  parseDayContextReadModel,
  parseLifeScopeSummary,
} from "./validation";

const observabilityValues: ReadonlySet<string> = new Set<DayObservability>([
  "observable",
  "partial",
  "unobserved",
]);
const validationStatuses: ReadonlySet<string> = new Set(["Confirmé", "Déduit"]);
const visitStates: ReadonlySet<string> = new Set(["known", "partial", "unknown"]);
const timePrecisions: ReadonlySet<string> = new Set([
  "exact",
  "approximate",
  "time_range",
  "unknown",
]);

function parseBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${name} doit être booléen.`);
  return value;
}

function parseLabel(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
    throw new TypeError(`${name} doit être une chaîne non vide normalisée.`);
  }
  return value;
}

function parseObservability(value: unknown): DayObservability {
  return parseStringLiteral<DayObservability>(
    value,
    observabilityValues,
    "DayObservability",
  );
}

function parseDayHeader(value: unknown): DayHeaderReadModel {
  const record = parseStrictRecord(
    value,
    ["date", "observability", "dayContext", "periodCompleteness"],
    "DayHeaderReadModel",
  );
  return {
    date: parseLocalDate(requireProperty(record, "date", "DayHeaderReadModel")),
    observability: parseObservability(
      requireProperty(record, "observability", "DayHeaderReadModel"),
    ),
    dayContext: parseDayContextReadModel(
      requireProperty(record, "dayContext", "DayHeaderReadModel"),
    ),
    periodCompleteness: parsePeriodCompleteness(
      requireProperty(record, "periodCompleteness", "DayHeaderReadModel"),
    ),
  };
}

function parseDayFinance(value: unknown): DayFinanceReadModel {
  const record = parseStrictRecord(
    value,
    [
      "economicAmount",
      "bankFlowAmount",
      "causalAmount",
      "duringAmount",
      "lifeScopeBreakdown",
    ],
    "DayFinanceReadModel",
  );
  return {
    economicAmount: parseMoneyEnvelope(
      requireProperty(record, "economicAmount", "DayFinanceReadModel"),
    ),
    ...(hasOwn(record, "bankFlowAmount")
      ? { bankFlowAmount: parseMoneyEnvelope(record.bankFlowAmount) }
      : {}),
    ...(hasOwn(record, "causalAmount")
      ? { causalAmount: parseMoneyEnvelope(record.causalAmount) }
      : {}),
    ...(hasOwn(record, "duringAmount")
      ? { duringAmount: parseMoneyEnvelope(record.duringAmount) }
      : {}),
    lifeScopeBreakdown: parseLifeScopeSummary(
      requireProperty(record, "lifeScopeBreakdown", "DayFinanceReadModel"),
    ),
  };
}

function parseDayContexts(value: unknown): DayContextsReadModel {
  const record = parseStrictRecord(
    value,
    ["dayContext", "lifeScopeSummary", "activitiesPresent", "placesPresent"],
    "DayContextsReadModel",
  );
  return {
    dayContext: parseDayContextReadModel(
      requireProperty(record, "dayContext", "DayContextsReadModel"),
    ),
    lifeScopeSummary: parseLifeScopeSummary(
      requireProperty(record, "lifeScopeSummary", "DayContextsReadModel"),
    ),
    activitiesPresent: parseBoolean(
      requireProperty(record, "activitiesPresent", "DayContextsReadModel"),
      "DayContextsReadModel.activitiesPresent",
    ),
    placesPresent: parseBoolean(
      requireProperty(record, "placesPresent", "DayContextsReadModel"),
      "DayContextsReadModel.placesPresent",
    ),
  };
}

function parseDayActivity(value: unknown): DayActivityPreviewItem {
  const record = parseStrictRecord(
    value,
    [
      "lifeEventId",
      "activityId",
      "label",
      "startsOn",
      "endsOn",
      "validationStatus",
      "causalAmount",
    ],
    "DayActivityPreviewItem",
  );
  const startsOn = parseLocalDate(requireProperty(record, "startsOn", "DayActivityPreviewItem"));
  const endsOn = parseLocalDate(requireProperty(record, "endsOn", "DayActivityPreviewItem"));
  if (endsOn < startsOn) throw new TypeError("Life Event doit respecter startsOn <= endsOn.");
  return {
    lifeEventId: parseLifeEventId(
      requireProperty(record, "lifeEventId", "DayActivityPreviewItem"),
    ),
    ...(hasOwn(record, "activityId")
      ? { activityId: parseActivityId(record.activityId) }
      : {}),
    label: parseLabel(
      requireProperty(record, "label", "DayActivityPreviewItem"),
      "DayActivityPreviewItem.label",
    ),
    startsOn,
    endsOn,
    validationStatus: parseStringLiteral(
      requireProperty(record, "validationStatus", "DayActivityPreviewItem"),
      validationStatuses,
      "ActivityOccurrenceValidationStatus",
    ),
    ...(hasOwn(record, "causalAmount")
      ? { causalAmount: parseMoneyEnvelope(record.causalAmount) }
      : {}),
  };
}

function parseDayPlace(value: unknown): DayPlaceVisitPreviewItem {
  const record = parseStrictRecord(
    value,
    [
      "placeId",
      "visitStart",
      "visitEnd",
      "visitState",
      "timePrecision",
      "localizedSpend",
    ],
    "DayPlaceVisitPreviewItem",
  );
  const visitState = parseStringLiteral<DayPlaceVisitPreviewItem["visitState"]>(
    requireProperty(record, "visitState", "DayPlaceVisitPreviewItem"),
    visitStates,
    "DayPlaceVisitPreviewItem.visitState",
  );
  const visitStart = hasOwn(record, "visitStart")
    ? parseInstant(record.visitStart)
    : undefined;
  const visitEnd = hasOwn(record, "visitEnd")
    ? parseInstant(record.visitEnd)
    : undefined;
  if (
    (visitState === "known" && (visitStart === undefined || visitEnd === undefined)) ||
    (visitState === "unknown" && (visitStart !== undefined || visitEnd !== undefined))
  ) {
    throw new TypeError("Visit state et intervalle sont incohérents.");
  }
  return {
    placeId: parsePlaceId(requireProperty(record, "placeId", "DayPlaceVisitPreviewItem")),
    ...(visitStart === undefined ? {} : { visitStart }),
    ...(visitEnd === undefined ? {} : { visitEnd }),
    visitState,
    timePrecision: parseStringLiteral(
      requireProperty(record, "timePrecision", "DayPlaceVisitPreviewItem"),
      timePrecisions,
      "PlaceVisitTimePrecision",
    ),
    ...(hasOwn(record, "localizedSpend")
      ? { localizedSpend: parseMoneyEnvelope(record.localizedSpend) }
      : {}),
  };
}

function parseDayOperation(value: unknown): DayOperationPreviewItem {
  const record = parseStrictRecord(
    value,
    [
      "operationId",
      "bankDate",
      "label",
      "amount",
      "categoryId",
      "merchantId",
      "placeId",
    ],
    "DayOperationPreviewItem",
  );
  return {
    operationId: parseOperationId(
      requireProperty(record, "operationId", "DayOperationPreviewItem"),
    ),
    bankDate: parseLocalDate(
      requireProperty(record, "bankDate", "DayOperationPreviewItem"),
    ),
    label: parseLabel(
      requireProperty(record, "label", "DayOperationPreviewItem"),
      "DayOperationPreviewItem.label",
    ),
    amount: parseMoney(requireProperty(record, "amount", "DayOperationPreviewItem")),
    ...(hasOwn(record, "categoryId")
      ? { categoryId: parseCategoryId(record.categoryId) }
      : {}),
    ...(hasOwn(record, "merchantId")
      ? { merchantId: parseMerchantId(record.merchantId) }
      : {}),
    ...(hasOwn(record, "placeId") ? { placeId: parsePlaceId(record.placeId) } : {}),
  };
}

function parseBoundedPreview<T>(
  value: unknown,
  parseItem: (item: unknown) => T,
  name: string,
): BoundedPreview<T> {
  const record = parseStrictRecord(value, ["items", "maxItems", "truncated"], name);
  const rawItems = requireProperty(record, "items", name);
  const maxItems = requireProperty(record, "maxItems", name);
  if (!Array.isArray(rawItems)) throw new TypeError(`${name}.items doit être un tableau.`);
  if (typeof maxItems !== "number" || !Number.isSafeInteger(maxItems) || maxItems < 1 || maxItems > 50) {
    throw new TypeError(`${name}.maxItems est invalide.`);
  }
  if (rawItems.length > maxItems) throw new TypeError(`${name} dépasse sa borne.`);
  return {
    items: rawItems.map(parseItem),
    maxItems,
    truncated: parseBoolean(requireProperty(record, "truncated", name), `${name}.truncated`),
  };
}

export function parseHistoryDayDetailReadModel(
  value: unknown,
): HistoryDayDetailReadModel {
  const record = parseStrictRecord(
    value,
    [
      "date",
      "timezone",
      "subject",
      "header",
      "finance",
      "contexts",
      "activities",
      "places",
      "operations",
      "capabilities",
    ],
    "HistoryDayDetailReadModel",
  );
  const date = parseLocalDate(requireProperty(record, "date", "HistoryDayDetailReadModel"));
  const header = parseDayHeader(requireProperty(record, "header", "HistoryDayDetailReadModel"));
  if (header.date !== date) throw new TypeError("Day header date est incohérente.");
  const finance = parseDayFinance(requireProperty(record, "finance", "HistoryDayDetailReadModel"));
  const contexts = parseDayContexts(requireProperty(record, "contexts", "HistoryDayDetailReadModel"));
  if (
    JSON.stringify(header.dayContext) !== JSON.stringify(contexts.dayContext) ||
    JSON.stringify(finance.lifeScopeBreakdown) !== JSON.stringify(contexts.lifeScopeSummary)
  ) {
    throw new TypeError("Day contexts sont incohérents entre les modules.");
  }
  const activities = parseBoundedPreview(
    requireProperty(record, "activities", "HistoryDayDetailReadModel"),
    parseDayActivity,
    "HistoryDayDetailReadModel.activities",
  );
  if (activities.items.some((item) => date < item.startsOn || date > item.endsOn)) {
    throw new TypeError("Une activité preview doit couvrir la date du Day Drawer.");
  }
  return {
    date,
    timezone: parseHouseholdTimeZone(
      requireProperty(record, "timezone", "HistoryDayDetailReadModel"),
    ),
    subject: parseReadModelSubject(
      requireProperty(record, "subject", "HistoryDayDetailReadModel"),
    ),
    header,
    finance,
    contexts,
    activities,
    places: parseBoundedPreview(
      requireProperty(record, "places", "HistoryDayDetailReadModel"),
      parseDayPlace,
      "HistoryDayDetailReadModel.places",
    ),
    operations: parseBoundedPreview(
      requireProperty(record, "operations", "HistoryDayDetailReadModel"),
      parseDayOperation,
      "HistoryDayDetailReadModel.operations",
    ),
    capabilities: parseQueryCapabilities(
      requireProperty(record, "capabilities", "HistoryDayDetailReadModel"),
      queryResourceKeys.historyDayDetail,
    ),
  };
}

export function assertDayDetailBelongsToMonth(
  detail: HistoryDayDetailReadModel,
  month: unknown,
): void {
  if (yearMonthOf(detail.date) !== parseYearMonth(month)) {
    throw new TypeError("History Day Detail est hors du mois demandé.");
  }
}
