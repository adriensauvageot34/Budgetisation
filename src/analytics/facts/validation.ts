import {
  parseActivityId,
  parseCategoryId,
  parseHouseholdId,
  parseLifeEventId,
  parseMerchantId,
  parseMomentId,
  parseOperationId,
  parsePersonId,
  parsePlaceId,
  parseSubcategoryId,
} from "../../core/identity";
import {
  addMoney,
  compareMoney,
  parseMoney,
  subtractMoney,
  type Money,
} from "../../core/money";
import {
  parseHouseholdTimeZone,
  parseInstant,
  parseLocalDate,
  parseYearMonth,
} from "../../core/time";
import {
  createRuntimeSchema,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  withValidationPath,
} from "../../core/validation";
import type {
  ActivityOccurrenceFact,
  ActivityOccurrenceValidationStatus,
  AnalyticCategoryValue,
  AnalyticDateValue,
  AnalyticDimensionValue,
  AnalyticFact,
  AnalyticTextDimensionValue,
  CanonicalComponentKey,
  CanonicalPlaceValue,
  CashUseId,
  EconomicComponentFact,
  EconomicTiming,
  EconomicTimingSegment,
  EconomicTimingSegmentKey,
  LifeEventSeriesId,
  PersonDayFact,
  PersonDayId,
  PersonDayObservability,
  PlaceVisitInterval,
  PlaceVisitFact,
  PlaceVisitKey,
  PlaceVisitTimePrecision,
  PurchaseEventFact,
  PurchaseEventId,
  PurchaseEventSource,
} from "./types";

const dimensionKinds = new Set([
  "resolved",
  "unknown",
  "not_applicable",
  "conflict",
] as const);
const categoryKinds = new Set([
  "resolved",
  "undetermined",
  "unknown",
  "not_applicable",
  "conflict",
] as const);
const dateKinds = new Set(["known", "unknown", "conflict"] as const);
const timingKinds = new Set([
  "known",
  "partial",
  "unknown",
  "conflict",
] as const);
const timingSegmentStates = new Set(["known", "partial", "unknown"] as const);
const placeKinds = new Set([
  "resolved",
  "unknown",
  "not_applicable",
  "conflict",
] as const);
const observabilityValues = new Set<PersonDayObservability>([
  "observable",
  "partial",
  "unknown",
  "conflict",
]);
const visitIntervalKinds = new Set(["known", "partial", "unknown"] as const);
const visitTimePrecisionValues = new Set<PlaceVisitTimePrecision>([
  "exact",
  "approximate",
  "time_range",
  "unknown",
]);
const canonicalComponentKeyPattern =
  /^(operation|allocation|item|payment_component|cash_use):[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const canonicalUuidPattern =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function parseOpaqueKey<Key extends string>(
  value: unknown,
  typeName: string,
): Key {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${typeName} doit être une chaîne non vide.`);
  }
  return value as Key;
}

export function parseCanonicalComponentKey(
  value: unknown,
): CanonicalComponentKey {
  if (typeof value !== "string" || !canonicalComponentKeyPattern.test(value)) {
    throw new TypeError(
      "CanonicalComponentKey doit utiliser exactement operation, allocation, item, payment_component ou cash_use suivi d'un UUID.",
    );
  }
  return value as CanonicalComponentKey;
}

function parseCanonicalUuidKey<Key extends string>(
  value: unknown,
  typeName: string,
): Key {
  if (typeof value !== "string" || !canonicalUuidPattern.test(value)) {
    throw new TypeError(`${typeName} doit être un UUID canonique.`);
  }
  return value as Key;
}

function parseNullable<Value>(
  value: unknown,
  parse: (candidate: unknown) => Value,
): Value | null {
  return value === null ? null : parse(value);
}

function parseDimensionValue<Id extends string>(
  value: unknown,
  parseId: (candidate: unknown) => Id,
  typeName: string,
): AnalyticDimensionValue<Id> {
  const candidate = parseStrictRecord(value, ["kind", "id"], typeName);
  const kind = parseStringLiteral<AnalyticDimensionValue<Id>["kind"]>(
    requireProperty(candidate, "kind", typeName),
    dimensionKinds,
    `${typeName}.kind`,
  );
  if (kind === "resolved") {
    const record = parseStrictRecord(value, ["kind", "id"], typeName);
    return {
      kind,
      id: withValidationPath("id", () =>
        parseId(requireProperty(record, "id", typeName)),
      ),
    };
  }
  parseStrictRecord(value, ["kind"], typeName);
  return { kind };
}

function parseCategoryValue(value: unknown): AnalyticCategoryValue {
  const candidate = parseStrictRecord(
    value,
    ["kind", "id"],
    "AnalyticCategoryValue",
  );
  const kind = parseStringLiteral<AnalyticCategoryValue["kind"]>(
    requireProperty(candidate, "kind", "AnalyticCategoryValue"),
    categoryKinds,
    "AnalyticCategoryValue.kind",
  );
  if (kind === "resolved") {
    const record = parseStrictRecord(
      value,
      ["kind", "id"],
      "AnalyticCategoryValue",
    );
    return {
      kind,
      id: parseCategoryId(
        requireProperty(record, "id", "AnalyticCategoryValue"),
      ),
    };
  }
  parseStrictRecord(value, ["kind"], "AnalyticCategoryValue");
  return { kind };
}

function parseTextDimensionValue(
  value: unknown,
  typeName: string,
): AnalyticTextDimensionValue {
  const candidate = parseStrictRecord(value, ["kind", "value"], typeName);
  const kind = parseStringLiteral<AnalyticTextDimensionValue["kind"]>(
    requireProperty(candidate, "kind", typeName),
    new Set(["resolved", "unknown", "not_applicable", "conflict"]),
    `${typeName}.kind`,
  );
  if (kind === "resolved") {
    const record = parseStrictRecord(value, ["kind", "value"], typeName);
    const resolvedValue = requireProperty(record, "value", typeName);
    if (typeof resolvedValue !== "string" || resolvedValue.trim().length === 0) {
      throw new TypeError(`${typeName}.value doit être une chaîne non vide.`);
    }
    return { kind, value: resolvedValue };
  }
  parseStrictRecord(value, ["kind"], typeName);
  return { kind };
}

export function parseAnalyticDateValue(value: unknown): AnalyticDateValue {
  const candidate = parseStrictRecord(value, ["kind", "date"], "AnalyticDateValue");
  const kind = parseStringLiteral<AnalyticDateValue["kind"]>(
    requireProperty(candidate, "kind", "AnalyticDateValue"),
    dateKinds,
    "AnalyticDateValue.kind",
  );
  if (kind === "known") {
    const record = parseStrictRecord(
      value,
      ["kind", "date"],
      "AnalyticDateValue",
    );
    return {
      kind,
      date: parseLocalDate(
        requireProperty(record, "date", "AnalyticDateValue"),
      ),
    };
  }
  parseStrictRecord(value, ["kind"], "AnalyticDateValue");
  return { kind };
}

function parseNonNegativeMoney(value: unknown, fieldName: string): Money {
  const amount = parseMoney(value);
  if (compareMoney(amount, parseMoney("0")) < 0) {
    throw new TypeError(`${fieldName} doit être positif ou nul.`);
  }
  return amount;
}

function parseEconomicTimingSegment(
  value: unknown,
): EconomicTimingSegment {
  const record = parseStrictRecord(
    value,
    [
      "segmentKey",
      "timingState",
      "periodStart",
      "periodEnd",
      "economicMonth",
      "amount",
    ],
    "EconomicTimingSegment",
  );
  const timingState = parseStringLiteral<EconomicTimingSegment["timingState"]>(
    requireProperty(record, "timingState", "EconomicTimingSegment"),
    timingSegmentStates,
    "EconomicTimingSegment.timingState",
  );
  const periodStart = parseNullable(
    requireProperty(record, "periodStart", "EconomicTimingSegment"),
    parseLocalDate,
  );
  const periodEnd = parseNullable(
    requireProperty(record, "periodEnd", "EconomicTimingSegment"),
    parseLocalDate,
  );
  const economicMonth = parseNullable(
    requireProperty(record, "economicMonth", "EconomicTimingSegment"),
    parseYearMonth,
  );
  if (periodStart !== null && periodEnd !== null && periodEnd < periodStart) {
    throw new TypeError("EconomicTimingSegment.periodEnd précède periodStart.");
  }
  if (
    timingState === "unknown" &&
    (periodStart !== null || periodEnd !== null || economicMonth !== null)
  ) {
    throw new TypeError(
      "Un segment Unknown ne peut pas contenir de période économique.",
    );
  }
  return {
    segmentKey: parseOpaqueKey<EconomicTimingSegmentKey>(
      requireProperty(record, "segmentKey", "EconomicTimingSegment"),
      "EconomicTimingSegmentKey",
    ),
    timingState,
    periodStart,
    periodEnd,
    economicMonth,
    amount: parseMoney(
      requireProperty(record, "amount", "EconomicTimingSegment"),
    ),
  };
}

function parseEconomicTiming(value: unknown, net: Money): EconomicTiming {
  const candidate = parseStrictRecord(
    value,
    ["kind", "segments"],
    "EconomicTiming",
  );
  const kind = parseStringLiteral<EconomicTiming["kind"]>(
    requireProperty(candidate, "kind", "EconomicTiming"),
    timingKinds,
    "EconomicTiming.kind",
  );
  if (kind === "unknown" || kind === "conflict") {
    parseStrictRecord(value, ["kind"], "EconomicTiming");
    return { kind };
  }

  const record = parseStrictRecord(
    value,
    ["kind", "segments"],
    "EconomicTiming",
  );
  const rawSegments = requireProperty(record, "segments", "EconomicTiming");
  if (!Array.isArray(rawSegments)) {
    throw new TypeError("EconomicTiming.segments doit être un tableau.");
  }
  const segments = rawSegments.map((segment, index) =>
    withValidationPath(index, () => parseEconomicTimingSegment(segment)),
  );
  if (segments.length === 0) {
    throw new TypeError("EconomicTiming.segments ne peut pas être vide.");
  }
  const keys = new Set(segments.map((segment) => segment.segmentKey));
  if (keys.size !== segments.length) {
    throw new TypeError("EconomicTiming.segments contient une clé dupliquée.");
  }
  if (kind === "known") {
    if (segments.some((segment) => segment.timingState !== "known")) {
      throw new TypeError("Un timing Known ne contient que des segments Known.");
    }
    const total = segments.reduce(
      (sum, segment) => addMoney(sum, segment.amount),
      parseMoney("0"),
    );
    if (compareMoney(total, net) !== 0) {
      throw new TypeError(
        "La somme des segments économiques Known doit être égale au net du composant.",
      );
    }
  }
  return {
    kind,
    segments: [...segments].sort((left, right) =>
      (left.economicMonth ?? left.periodStart ?? "") ===
      (right.economicMonth ?? right.periodStart ?? "")
        ? left.segmentKey.localeCompare(right.segmentKey)
        : (left.economicMonth ?? left.periodStart ?? "").localeCompare(
            right.economicMonth ?? right.periodStart ?? "",
          ),
    ),
  };
}

function parseCanonicalPlace(value: unknown): CanonicalPlaceValue {
  const candidate = parseStrictRecord(
    value,
    ["kind", "placeId", "resolution"],
    "CanonicalPlaceValue",
  );
  const kind = parseStringLiteral<CanonicalPlaceValue["kind"]>(
    requireProperty(candidate, "kind", "CanonicalPlaceValue"),
    placeKinds,
    "CanonicalPlaceValue.kind",
  );
  if (kind !== "resolved") {
    parseStrictRecord(value, ["kind"], "CanonicalPlaceValue");
    return { kind };
  }
  const record = parseStrictRecord(
    value,
    ["kind", "placeId", "resolution"],
    "CanonicalPlaceValue",
  );
  return {
    kind,
    placeId: parsePlaceId(
      requireProperty(record, "placeId", "CanonicalPlaceValue"),
    ),
    resolution: parseStringLiteral(
      requireProperty(record, "resolution", "CanonicalPlaceValue"),
      new Set(["operation_place_canonical"]),
      "CanonicalPlaceValue.resolution",
    ),
  };
}

function normalizeIds<Id extends string>(
  value: unknown,
  parseId: (candidate: unknown) => Id,
  fieldName: string,
  requireNonEmpty = false,
): readonly Id[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${fieldName} doit être un tableau.`);
  }
  const ids = value.map((candidate, index) =>
    withValidationPath(index, () => parseId(candidate)),
  );
  const normalized = [...new Set(ids)].sort();
  if (normalized.length !== ids.length) {
    throw new TypeError(`${fieldName} contient une identité dupliquée.`);
  }
  if (requireNonEmpty && normalized.length === 0) {
    throw new TypeError(`${fieldName} doit contenir au moins une identité.`);
  }
  return normalized;
}

export function parseEconomicComponentFact(
  value: unknown,
): EconomicComponentFact {
  const record = parseStrictRecord(
    value,
    [
      "fact",
      "householdId",
      "householdTimeZone",
      "canonicalComponentKey",
      "sourceOperation",
      "gross",
      "refundApplied",
      "net",
      "bankDate",
      "economicTiming",
      "person",
      "category",
      "subcategory",
      "activity",
      "merchant",
      "moment",
      "canonicalPlace",
      "necessity",
      "behavior",
      "lifeScope",
    ],
    "EconomicComponentFact",
  );
  const gross = parseMoney(
    requireProperty(record, "gross", "EconomicComponentFact"),
  );
  const refundApplied = parseNonNegativeMoney(
    requireProperty(record, "refundApplied", "EconomicComponentFact"),
    "EconomicComponentFact.refundApplied",
  );
  const net = parseMoney(requireProperty(record, "net", "EconomicComponentFact"));
  if (compareMoney(gross, parseMoney("0")) >= 0) {
    if (compareMoney(refundApplied, gross) > 0) {
      throw new TypeError("refundApplied ne peut pas dépasser gross.");
    }
    if (compareMoney(subtractMoney(gross, refundApplied), net) !== 0) {
      throw new TypeError("net doit être égal à gross - refundApplied.");
    }
  } else if (
    compareMoney(refundApplied, parseMoney("0")) !== 0 ||
    compareMoney(net, gross) !== 0
  ) {
    throw new TypeError(
      "Un ajustement économique négatif conserve gross = net et refundApplied = 0.",
    );
  }

  return {
    fact: parseStringLiteral(
      requireProperty(record, "fact", "EconomicComponentFact"),
      new Set(["fct_economic_component"]),
      "EconomicComponentFact.fact",
    ),
    householdId: parseHouseholdId(
      requireProperty(record, "householdId", "EconomicComponentFact"),
    ),
    householdTimeZone: parseHouseholdTimeZone(
      requireProperty(
        record,
        "householdTimeZone",
        "EconomicComponentFact",
      ),
    ),
    canonicalComponentKey: parseCanonicalComponentKey(
      requireProperty(
        record,
        "canonicalComponentKey",
        "EconomicComponentFact",
      ),
    ),
    sourceOperation: parseDimensionValue(
      requireProperty(record, "sourceOperation", "EconomicComponentFact"),
      parseOperationId,
      "EconomicComponentFact.sourceOperation",
    ),
    gross,
    refundApplied,
    net,
    bankDate: parseAnalyticDateValue(
      requireProperty(record, "bankDate", "EconomicComponentFact"),
    ),
    economicTiming: parseEconomicTiming(
      requireProperty(record, "economicTiming", "EconomicComponentFact"),
      net,
    ),
    person: parseDimensionValue(
      requireProperty(record, "person", "EconomicComponentFact"),
      parsePersonId,
      "EconomicComponentFact.person",
    ),
    category: parseCategoryValue(
      requireProperty(record, "category", "EconomicComponentFact"),
    ),
    subcategory: parseDimensionValue(
      requireProperty(record, "subcategory", "EconomicComponentFact"),
      parseSubcategoryId,
      "EconomicComponentFact.subcategory",
    ),
    activity: parseDimensionValue(
      requireProperty(record, "activity", "EconomicComponentFact"),
      parseActivityId,
      "EconomicComponentFact.activity",
    ),
    merchant: parseDimensionValue(
      requireProperty(record, "merchant", "EconomicComponentFact"),
      parseMerchantId,
      "EconomicComponentFact.merchant",
    ),
    moment: parseDimensionValue(
      requireProperty(record, "moment", "EconomicComponentFact"),
      parseMomentId,
      "EconomicComponentFact.moment",
    ),
    canonicalPlace: parseCanonicalPlace(
      requireProperty(record, "canonicalPlace", "EconomicComponentFact"),
    ),
    necessity: parseTextDimensionValue(
      requireProperty(record, "necessity", "EconomicComponentFact"),
      "EconomicComponentFact.necessity",
    ),
    behavior: parseTextDimensionValue(
      requireProperty(record, "behavior", "EconomicComponentFact"),
      "EconomicComponentFact.behavior",
    ),
    lifeScope: parseTextDimensionValue(
      requireProperty(record, "lifeScope", "EconomicComponentFact"),
      "EconomicComponentFact.lifeScope",
    ),
  };
}

export function parseActivityOccurrenceFact(
  value: unknown,
): ActivityOccurrenceFact {
  const record = parseStrictRecord(
    value,
    [
      "fact",
      "householdId",
      "householdTimeZone",
      "lifeEventId",
      "activityId",
      "lifeEventSeriesId",
      "parentLifeEventId",
      "startDate",
      "endDate",
      "validationStatus",
      "participantIds",
    ],
    "ActivityOccurrenceFact",
  );
  const startDate = parseLocalDate(
    requireProperty(record, "startDate", "ActivityOccurrenceFact"),
  );
  const endDate = parseLocalDate(
    requireProperty(record, "endDate", "ActivityOccurrenceFact"),
  );
  if (endDate < startDate) {
    throw new TypeError("ActivityOccurrenceFact.endDate précède startDate.");
  }

  return {
    fact: parseStringLiteral(
      requireProperty(record, "fact", "ActivityOccurrenceFact"),
      new Set(["fct_activity_occurrence"]),
      "ActivityOccurrenceFact.fact",
    ),
    householdId: parseHouseholdId(
      requireProperty(record, "householdId", "ActivityOccurrenceFact"),
    ),
    householdTimeZone: parseHouseholdTimeZone(
      requireProperty(
        record,
        "householdTimeZone",
        "ActivityOccurrenceFact",
      ),
    ),
    lifeEventId: parseLifeEventId(
      requireProperty(record, "lifeEventId", "ActivityOccurrenceFact"),
    ),
    activityId: parseActivityId(
      requireProperty(record, "activityId", "ActivityOccurrenceFact"),
    ),
    lifeEventSeriesId: parseNullable(
      requireProperty(record, "lifeEventSeriesId", "ActivityOccurrenceFact"),
      (candidate) =>
        parseCanonicalUuidKey<LifeEventSeriesId>(candidate, "LifeEventSeriesId"),
    ),
    parentLifeEventId: parseNullable(
      requireProperty(record, "parentLifeEventId", "ActivityOccurrenceFact"),
      parseLifeEventId,
    ),
    startDate,
    endDate,
    validationStatus: parseStringLiteral<ActivityOccurrenceValidationStatus>(
      requireProperty(record, "validationStatus", "ActivityOccurrenceFact"),
      new Set(["Confirmé", "Déduit"]),
      "ActivityOccurrenceFact.validationStatus",
    ),
    participantIds: normalizeIds(
      requireProperty(record, "participantIds", "ActivityOccurrenceFact"),
      parsePersonId,
      "ActivityOccurrenceFact.participantIds",
    ),
  };
}

export function parsePersonDayFact(value: unknown): PersonDayFact {
  const record = parseStrictRecord(
    value,
    [
      "fact",
      "householdId",
      "householdTimeZone",
      "personDayId",
      "personId",
      "localDate",
      "locationObservability",
    ],
    "PersonDayFact",
  );
  return {
    fact: parseStringLiteral(
      requireProperty(record, "fact", "PersonDayFact"),
      new Set(["fct_person_day"]),
      "PersonDayFact.fact",
    ),
    householdId: parseHouseholdId(
      requireProperty(record, "householdId", "PersonDayFact"),
    ),
    householdTimeZone: parseHouseholdTimeZone(
      requireProperty(record, "householdTimeZone", "PersonDayFact"),
    ),
    personDayId: parseCanonicalUuidKey<PersonDayId>(
      requireProperty(record, "personDayId", "PersonDayFact"),
      "PersonDayId",
    ),
    personId: parsePersonId(
      requireProperty(record, "personId", "PersonDayFact"),
    ),
    localDate: parseLocalDate(
      requireProperty(record, "localDate", "PersonDayFact"),
    ),
    locationObservability: parseStringLiteral<PersonDayObservability>(
      requireProperty(record, "locationObservability", "PersonDayFact"),
      observabilityValues,
      "PersonDayFact.locationObservability",
    ),
  };
}

export function parsePurchaseEventId(value: unknown): PurchaseEventId {
  return parseCanonicalUuidKey<PurchaseEventId>(value, "PurchaseEventId");
}

export function parseCashUseId(value: unknown): CashUseId {
  return parseCanonicalUuidKey<CashUseId>(value, "CashUseId");
}

function parsePurchaseEventSource(value: unknown): PurchaseEventSource {
  const candidate = parseStrictRecord(value, [
    "membershipKind",
    "kind",
    "sourceId",
    "canonicalComponentKey",
    "evidenceRefs",
    "provenance",
  ], "PurchaseEventSource");
  const evidenceRefs = requireProperty(candidate, "evidenceRefs", "PurchaseEventSource");
  if (!Array.isArray(evidenceRefs) || evidenceRefs.some((ref) => typeof ref !== "string" || ref.length === 0)) {
    throw new TypeError("PurchaseEventSource.evidenceRefs doit être un tableau de chaînes non vides.");
  }
  const kind = parseStringLiteral<PurchaseEventSource["kind"]>(
    requireProperty(candidate, "kind", "PurchaseEventSource"),
    new Set(["operation", "allocation", "item", "payment_component", "cash_use"] as const),
    "PurchaseEventSource.kind",
  );
  const sourceId = parseOpaqueKey<string>(
    requireProperty(candidate, "sourceId", "PurchaseEventSource"),
    "PurchaseEventSource.sourceId",
  );
  const canonicalComponentKey = parseCanonicalComponentKey(
    requireProperty(candidate, "canonicalComponentKey", "PurchaseEventSource"),
  );
  if (canonicalComponentKey !== `${kind}:${sourceId}`) {
    throw new TypeError("PurchaseEventSource ne correspond pas à canonicalComponentKey.");
  }
  return {
    membershipKind: parseStringLiteral(
      requireProperty(candidate, "membershipKind", "PurchaseEventSource"),
      new Set(["CONSUMPTION_COMPONENT", "EVIDENCE_SOURCE"] as const),
      "PurchaseEventSource.membershipKind",
    ),
    kind,
    sourceId,
    canonicalComponentKey,
    evidenceRefs: [...evidenceRefs].sort(),
    provenance: parseStringLiteral(
      requireProperty(candidate, "provenance", "PurchaseEventSource"),
      new Set(["EXPLICIT_USER_ASSERTION", "STRUCTURED_CANONICAL_SOURCE", "CONTROLLED_BACKFILL"] as const),
      "PurchaseEventSource.provenance",
    ),
  };
}

function normalizePurchaseEventSources(
  value: unknown,
): readonly PurchaseEventSource[] {
  if (!Array.isArray(value)) {
    throw new TypeError("PurchaseEventFact.sources doit être un tableau.");
  }
  const sources = value.map((source, index) =>
    withValidationPath(index, () => parsePurchaseEventSource(source)),
  );
  const keys = sources.map((source) =>
    `${source.membershipKind}:${source.canonicalComponentKey}`);
  if (new Set(keys).size !== keys.length) {
    throw new TypeError("PurchaseEventFact.sources contient une source dupliquée.");
  }
  if (!sources.some(({ membershipKind }) => membershipKind === "CONSUMPTION_COMPONENT")) {
    throw new TypeError("PurchaseEventFact.sources exige un composant de consommation.");
  }
  return [...sources].sort((left, right) => {
    const leftKey = `${left.membershipKind}:${left.canonicalComponentKey}`;
    const rightKey = `${right.membershipKind}:${right.canonicalComponentKey}`;
    return leftKey.localeCompare(rightKey);
  });
}

export function parsePurchaseEventFact(value: unknown): PurchaseEventFact {
  const record = parseStrictRecord(
    value,
    [
      "fact",
      "householdId",
      "householdTimeZone",
      "purchaseEventId",
      "sources",
      "economicAmount",
      "timing",
      "provenance",
    ],
    "PurchaseEventFact",
  );
  return {
    fact: parseStringLiteral(
      requireProperty(record, "fact", "PurchaseEventFact"),
      new Set(["fct_purchase_event"]),
      "PurchaseEventFact.fact",
    ),
    householdId: parseHouseholdId(
      requireProperty(record, "householdId", "PurchaseEventFact"),
    ),
    householdTimeZone: parseHouseholdTimeZone(
      requireProperty(record, "householdTimeZone", "PurchaseEventFact"),
    ),
    purchaseEventId: parsePurchaseEventId(
      requireProperty(record, "purchaseEventId", "PurchaseEventFact"),
    ),
    sources: normalizePurchaseEventSources(
      requireProperty(record, "sources", "PurchaseEventFact"),
    ),
    economicAmount: parseMoney(
      requireProperty(record, "economicAmount", "PurchaseEventFact"),
    ),
    timing: (() => {
      const timing = parseStrictRecord(
        requireProperty(record, "timing", "PurchaseEventFact"),
        ["status", "precision", "economicDate", "economicMonth", "authority", "evidenceRefs"],
        "PurchaseEventFact.timing",
      );
      const refs = requireProperty(timing, "evidenceRefs", "PurchaseEventFact.timing");
      if (!Array.isArray(refs) || refs.some((ref) => typeof ref !== "string" || ref.length === 0)) {
        throw new TypeError("PurchaseEventFact.timing.evidenceRefs est invalide.");
      }
      const status = parseStringLiteral<PurchaseEventFact["timing"]["status"]>(
        requireProperty(timing, "status", "PurchaseEventFact.timing"),
        new Set(["KNOWN", "PARTIAL", "UNKNOWN", "CONFLICT"] as const),
        "PurchaseEventFact.timing.status",
      );
      const precision = parseStringLiteral<PurchaseEventFact["timing"]["precision"]>(
        requireProperty(timing, "precision", "PurchaseEventFact.timing"),
        new Set(["DAY", "MONTH", "NONE"] as const),
        "PurchaseEventFact.timing.precision",
      );
      const dateValue = requireProperty(timing, "economicDate", "PurchaseEventFact.timing");
      const monthValue = requireProperty(timing, "economicMonth", "PurchaseEventFact.timing");
      const authorityValue = requireProperty(timing, "authority", "PurchaseEventFact.timing");
      const result: PurchaseEventFact["timing"] = {
        status,
        precision,
        economicDate: dateValue === null ? null : parseLocalDate(dateValue),
        economicMonth: monthValue === null ? null : parseYearMonth(monthValue),
        authority: authorityValue === null ? null : parseStringLiteral<Exclude<PurchaseEventFact["timing"]["authority"], null>>(
          authorityValue,
          new Set(["EXPLICIT_EVENT", "EXPLICIT_CONSUMPTION_SOURCE", "TRUSTED_PURCHASE_SOURCE", "ECONOMIC_MONTH"] as const),
          "PurchaseEventFact.timing.authority",
        ),
        evidenceRefs: [...refs].sort(),
      };
      const validShape =
        (result.status === "KNOWN" && result.precision === "DAY" && result.economicDate !== null && result.economicMonth !== null && result.authority !== null) ||
        (result.status === "PARTIAL" && result.precision === "MONTH" && result.economicDate === null && result.economicMonth !== null && result.authority !== null) ||
        (result.status === "UNKNOWN" && result.precision === "NONE" && result.economicDate === null && result.economicMonth === null && result.authority === null) ||
        (result.status === "CONFLICT" && result.economicDate === null && result.authority !== null &&
          ((result.precision === "MONTH" && result.economicMonth !== null) ||
            (result.precision === "NONE" && result.economicMonth === null)));
      if (!validShape) {
        throw new TypeError("PurchaseEventFact.timing porte une combinaison incohérente.");
      }
      return result;
    })(),
    provenance: parseStringLiteral(
      requireProperty(record, "provenance", "PurchaseEventFact"),
      new Set(["EXPLICIT_USER_ASSERTION", "STRUCTURED_CANONICAL_SOURCE", "CONTROLLED_BACKFILL"] as const),
      "PurchaseEventFact.provenance",
    ),
  };
}

export function parsePlaceVisitFact(value: unknown): PlaceVisitFact {
  const record = parseStrictRecord(
    value,
    [
      "fact",
      "householdId",
      "householdTimeZone",
      "visitKey",
      "personDayId",
      "personId",
      "placeId",
      "localDate",
      "interval",
      "timePrecision",
      "sequenceIndex",
    ],
    "PlaceVisitFact",
  );
  const intervalRecord = parseStrictRecord(
    requireProperty(record, "interval", "PlaceVisitFact"),
    ["kind", "startedAt", "endedAt"],
    "PlaceVisitInterval",
  );
  const intervalKind = parseStringLiteral<PlaceVisitInterval["kind"]>(
    requireProperty(intervalRecord, "kind", "PlaceVisitInterval"),
    visitIntervalKinds,
    "PlaceVisitInterval.kind",
  );
  let interval: PlaceVisitInterval;
  if (intervalKind === "unknown") {
    parseStrictRecord(
      requireProperty(record, "interval", "PlaceVisitFact"),
      ["kind"],
      "PlaceVisitInterval",
    );
    interval = { kind: intervalKind };
  } else {
    const preciseInterval = parseStrictRecord(
      requireProperty(record, "interval", "PlaceVisitFact"),
      ["kind", "startedAt", "endedAt"],
      "PlaceVisitInterval",
    );
    const startedAt = parseNullable(
      requireProperty(preciseInterval, "startedAt", "PlaceVisitInterval"),
      parseInstant,
    );
    const endedAt = parseNullable(
      requireProperty(preciseInterval, "endedAt", "PlaceVisitInterval"),
      parseInstant,
    );
    if (intervalKind === "known") {
      if (startedAt === null || endedAt === null || startedAt >= endedAt) {
        throw new TypeError(
          "Un intervalle de visite Known exige startedAt < endedAt.",
        );
      }
      interval = { kind: intervalKind, startedAt, endedAt };
    } else {
      if ((startedAt === null) === (endedAt === null)) {
        throw new TypeError(
          "Un intervalle de visite Partial conserve exactement une borne connue.",
        );
      }
      interval = { kind: intervalKind, startedAt, endedAt };
    }
  }
  const sequenceIndex = requireProperty(
    record,
    "sequenceIndex",
    "PlaceVisitFact",
  );
  if (!Number.isSafeInteger(sequenceIndex) || (sequenceIndex as number) < 1) {
    throw new TypeError("PlaceVisitFact.sequenceIndex doit être un entier positif.");
  }
  return {
    fact: parseStringLiteral(
      requireProperty(record, "fact", "PlaceVisitFact"),
      new Set(["fct_place_visit"]),
      "PlaceVisitFact.fact",
    ),
    householdId: parseHouseholdId(
      requireProperty(record, "householdId", "PlaceVisitFact"),
    ),
    householdTimeZone: parseHouseholdTimeZone(
      requireProperty(record, "householdTimeZone", "PlaceVisitFact"),
    ),
    visitKey: parseCanonicalUuidKey<PlaceVisitKey>(
      requireProperty(record, "visitKey", "PlaceVisitFact"),
      "PlaceVisitKey",
    ),
    personDayId: parseCanonicalUuidKey<PersonDayId>(
      requireProperty(record, "personDayId", "PlaceVisitFact"),
      "PersonDayId",
    ),
    personId: parsePersonId(
      requireProperty(record, "personId", "PlaceVisitFact"),
    ),
    placeId: parsePlaceId(
      requireProperty(record, "placeId", "PlaceVisitFact"),
    ),
    localDate: parseLocalDate(
      requireProperty(record, "localDate", "PlaceVisitFact"),
    ),
    interval,
    timePrecision: parseStringLiteral<PlaceVisitTimePrecision>(
      requireProperty(record, "timePrecision", "PlaceVisitFact"),
      visitTimePrecisionValues,
      "PlaceVisitFact.timePrecision",
    ),
    sequenceIndex: sequenceIndex as number,
  };
}

export function parseAnalyticFact(value: unknown): AnalyticFact {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("AnalyticFact doit être un objet.");
  }
  switch ((value as { readonly fact?: unknown }).fact) {
    case "fct_economic_component":
      return parseEconomicComponentFact(value);
    case "fct_activity_occurrence":
      return parseActivityOccurrenceFact(value);
    case "fct_person_day":
      return parsePersonDayFact(value);
    case "fct_purchase_event":
      return parsePurchaseEventFact(value);
    case "fct_place_visit":
      return parsePlaceVisitFact(value);
    default:
      throw new TypeError("AnalyticFact.fact est inconnu.");
  }
}

export const economicComponentFactSchema = createRuntimeSchema(
  parseEconomicComponentFact,
);
export const activityOccurrenceFactSchema = createRuntimeSchema(
  parseActivityOccurrenceFact,
);
export const personDayFactSchema = createRuntimeSchema(parsePersonDayFact);
export const purchaseEventFactSchema = createRuntimeSchema(
  parsePurchaseEventFact,
);
export const placeVisitFactSchema = createRuntimeSchema(parsePlaceVisitFact);
export const analyticFactSchema = createRuntimeSchema(parseAnalyticFact);
