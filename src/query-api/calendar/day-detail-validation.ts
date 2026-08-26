import {
  parseCategoryId,
  parseMerchantId,
  parseOperationId,
  parsePersonId,
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
  DayContextsReadModel,
  DayFinanceReadModel,
  DayHeaderReadModel,
  DayJournalMoment,
  DayObservability,
  DayOperationPreviewItem,
  HistoryDayDetailReadModel,
} from "./types";
import {
  parseCalendarDayMarker,
  parseCalendarExplorationTarget,
  parseCalendarLabel,
  parseCalendarMarkerKind,
  parseCalendarPlaceRef,
  parseDayContextReadModel,
  parseLifeScopeSummary,
} from "./validation";

const observabilityValues = new Set<DayObservability>([
  "observable",
  "partial",
  "unobserved",
]);

function parseBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${name} doit être booléen.`);
  return value;
}

function parseDayHeader(value: unknown): DayHeaderReadModel {
  const record = parseStrictRecord(value, ["date", "observability", "dayContext", "periodCompleteness"], "DayHeaderReadModel");
  return {
    date: parseLocalDate(requireProperty(record, "date", "DayHeaderReadModel")),
    observability: parseStringLiteral(requireProperty(record, "observability", "DayHeaderReadModel"), observabilityValues, "DayObservability"),
    dayContext: parseDayContextReadModel(requireProperty(record, "dayContext", "DayHeaderReadModel")),
    periodCompleteness: parsePeriodCompleteness(requireProperty(record, "periodCompleteness", "DayHeaderReadModel")),
  };
}

function parseDayFinance(value: unknown): DayFinanceReadModel {
  const record = parseStrictRecord(value, ["economicAmount", "bankFlowAmount", "causalAmount", "duringAmount", "lifeScopeBreakdown"], "DayFinanceReadModel");
  return {
    economicAmount: parseMoneyEnvelope(requireProperty(record, "economicAmount", "DayFinanceReadModel")),
    ...(hasOwn(record, "bankFlowAmount") ? { bankFlowAmount: parseMoneyEnvelope(record.bankFlowAmount) } : {}),
    ...(hasOwn(record, "causalAmount") ? { causalAmount: parseMoneyEnvelope(record.causalAmount) } : {}),
    ...(hasOwn(record, "duringAmount") ? { duringAmount: parseMoneyEnvelope(record.duringAmount) } : {}),
    lifeScopeBreakdown: parseLifeScopeSummary(requireProperty(record, "lifeScopeBreakdown", "DayFinanceReadModel")),
  };
}

function parseDayContexts(value: unknown): DayContextsReadModel {
  const record = parseStrictRecord(value, ["dayContext", "lifeScopeSummary", "activitiesPresent", "placesPresent"], "DayContextsReadModel");
  return {
    dayContext: parseDayContextReadModel(requireProperty(record, "dayContext", "DayContextsReadModel")),
    lifeScopeSummary: parseLifeScopeSummary(requireProperty(record, "lifeScopeSummary", "DayContextsReadModel")),
    activitiesPresent: parseBoolean(requireProperty(record, "activitiesPresent", "DayContextsReadModel"), "DayContextsReadModel.activitiesPresent"),
    placesPresent: parseBoolean(requireProperty(record, "placesPresent", "DayContextsReadModel"), "DayContextsReadModel.placesPresent"),
  };
}

function parseDayOperation(value: unknown): DayOperationPreviewItem {
  const record = parseStrictRecord(value, ["operationId", "bankDate", "label", "amount", "categoryId", "merchantId", "placeId"], "DayOperationPreviewItem");
  return {
    operationId: parseOperationId(requireProperty(record, "operationId", "DayOperationPreviewItem")),
    bankDate: parseLocalDate(requireProperty(record, "bankDate", "DayOperationPreviewItem")),
    label: parseCalendarLabel(requireProperty(record, "label", "DayOperationPreviewItem"), "DayOperationPreviewItem.label"),
    amount: parseMoney(requireProperty(record, "amount", "DayOperationPreviewItem")),
    ...(hasOwn(record, "categoryId") ? { categoryId: parseCategoryId(record.categoryId) } : {}),
    ...(hasOwn(record, "merchantId") ? { merchantId: parseMerchantId(record.merchantId) } : {}),
    ...(hasOwn(record, "placeId") ? { placeId: parsePlaceId(record.placeId) } : {}),
  };
}

function parseOperations(value: unknown, name: string): readonly DayOperationPreviewItem[] {
  if (!Array.isArray(value)) throw new TypeError(`${name} doit être un tableau.`);
  const operations = value.map(parseDayOperation);
  if (new Set(operations.map(({ operationId }) => operationId)).size !== operations.length) {
    throw new TypeError(`${name} contient des opérations dupliquées.`);
  }
  return operations;
}

function parseDayJournalMoment(value: unknown): DayJournalMoment {
  const record = parseStrictRecord(
    value,
    ["id", "kind", "label", "startsOn", "endsOn", "participantIds", "startAt", "endAt", "place", "economicAmount", "operations", "target"],
    "DayJournalMoment",
  );
  const startsOn = parseLocalDate(requireProperty(record, "startsOn", "DayJournalMoment"));
  const endsOn = parseLocalDate(requireProperty(record, "endsOn", "DayJournalMoment"));
  if (endsOn < startsOn) throw new TypeError("DayJournalMoment doit respecter startsOn <= endsOn.");
  const rawParticipants = requireProperty(record, "participantIds", "DayJournalMoment");
  if (!Array.isArray(rawParticipants)) throw new TypeError("DayJournalMoment.participantIds doit être un tableau.");
  const participantIds = rawParticipants.map(parsePersonId);
  if (new Set(participantIds).size !== participantIds.length || participantIds.some((id, index) => index > 0 && participantIds[index - 1]! > id)) {
    throw new TypeError("DayJournalMoment.participantIds doit être unique et trié.");
  }
  const startAt = hasOwn(record, "startAt") ? parseInstant(record.startAt) : undefined;
  const endAt = hasOwn(record, "endAt") ? parseInstant(record.endAt) : undefined;
  if (startAt !== undefined && endAt !== undefined && endAt < startAt) {
    throw new TypeError("DayJournalMoment doit respecter startAt <= endAt.");
  }
  return {
    id: parseCalendarLabel(requireProperty(record, "id", "DayJournalMoment"), "DayJournalMoment.id"),
    kind: parseCalendarMarkerKind(requireProperty(record, "kind", "DayJournalMoment")),
    label: parseCalendarLabel(requireProperty(record, "label", "DayJournalMoment"), "DayJournalMoment.label"),
    startsOn,
    endsOn,
    participantIds,
    ...(startAt === undefined ? {} : { startAt }),
    ...(endAt === undefined ? {} : { endAt }),
    ...(hasOwn(record, "place") ? { place: parseCalendarPlaceRef(record.place) } : {}),
    ...(hasOwn(record, "economicAmount") ? { economicAmount: parseMoneyEnvelope(record.economicAmount) } : {}),
    operations: parseOperations(requireProperty(record, "operations", "DayJournalMoment"), "DayJournalMoment.operations"),
    ...(hasOwn(record, "target") ? { target: parseCalendarExplorationTarget(record.target) } : {}),
  };
}

export function parseHistoryDayDetailReadModel(value: unknown): HistoryDayDetailReadModel {
  const record = parseStrictRecord(
    value,
    ["date", "timezone", "subject", "header", "finance", "contexts", "markers", "moments", "unlinkedOperations", "capabilities"],
    "HistoryDayDetailReadModel",
  );
  const date = parseLocalDate(requireProperty(record, "date", "HistoryDayDetailReadModel"));
  const header = parseDayHeader(requireProperty(record, "header", "HistoryDayDetailReadModel"));
  if (header.date !== date) throw new TypeError("Day header date est incohérente.");
  const finance = parseDayFinance(requireProperty(record, "finance", "HistoryDayDetailReadModel"));
  const contexts = parseDayContexts(requireProperty(record, "contexts", "HistoryDayDetailReadModel"));
  if (JSON.stringify(header.dayContext) !== JSON.stringify(contexts.dayContext) || JSON.stringify(finance.lifeScopeBreakdown) !== JSON.stringify(contexts.lifeScopeSummary)) {
    throw new TypeError("Day contexts sont incohérents entre les modules.");
  }
  const rawMarkers = requireProperty(record, "markers", "HistoryDayDetailReadModel");
  const rawMoments = requireProperty(record, "moments", "HistoryDayDetailReadModel");
  if (!Array.isArray(rawMarkers) || !Array.isArray(rawMoments)) {
    throw new TypeError("History Day Detail markers et moments doivent être des tableaux.");
  }
  const markers = rawMarkers.map(parseCalendarDayMarker);
  const moments = rawMoments.map(parseDayJournalMoment);
  if (moments.some((moment) => date < moment.startsOn || date > moment.endsOn)) {
    throw new TypeError("Chaque moment du journal doit couvrir sa date.");
  }
  if (new Set(markers.map(({ id }) => id)).size !== markers.length || new Set(moments.map(({ id }) => id)).size !== moments.length) {
    throw new TypeError("History Day Detail contient des identités dupliquées.");
  }
  const unlinkedOperations = parseOperations(requireProperty(record, "unlinkedOperations", "HistoryDayDetailReadModel"), "HistoryDayDetailReadModel.unlinkedOperations");
  const allLinkedOperationIds = moments.flatMap(({ operations }) => operations.map(({ operationId }) => operationId));
  const linkedOperationIds = new Set(allLinkedOperationIds);
  if (linkedOperationIds.size !== allLinkedOperationIds.length) {
    throw new TypeError("Une opération liée ne peut apparaître que dans un seul moment.");
  }
  if (unlinkedOperations.some(({ operationId }) => linkedOperationIds.has(operationId))) {
    throw new TypeError("Une opération ne peut apparaître à la fois liée et non liée.");
  }
  return {
    date,
    timezone: parseHouseholdTimeZone(requireProperty(record, "timezone", "HistoryDayDetailReadModel")),
    subject: parseReadModelSubject(requireProperty(record, "subject", "HistoryDayDetailReadModel")),
    header,
    finance,
    contexts,
    markers,
    moments,
    unlinkedOperations,
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "HistoryDayDetailReadModel"), queryResourceKeys.historyDayDetail),
  };
}

export function assertDayDetailBelongsToMonth(detail: HistoryDayDetailReadModel, month: unknown): void {
  if (yearMonthOf(detail.date) !== parseYearMonth(month)) {
    throw new TypeError("History Day Detail est hors du mois demandé.");
  }
}
