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
  type ActivityId,
  type HouseholdId,
  type LifeEventId,
  type OperationId,
  type PersonId,
} from "../../core/identity";
import {
  addMoney,
  compareMoney,
  parseMoney,
  type Money,
} from "../../core/money";
import {
  parseHouseholdTimeZone,
  parseInstant,
  parseLocalDate,
  parseYearMonth,
  type HouseholdTimeZone,
  type LocalDate,
  type YearMonth,
} from "../../core/time";
import {
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  withValidationPath,
} from "../../core/validation";
import type {
  ActivityOccurrenceFact,
  CanonicalComponentKey,
  CanonicalPlaceValue,
  EconomicComponentFact,
  EconomicTiming,
  EconomicTimingSegment,
  LifeEventSeriesId,
  PersonDayFact,
  PersonDayId,
  PlaceVisitFact,
  PlaceVisitInterval,
  PlaceVisitKey,
  PlaceVisitTimePrecision,
  PurchaseEventFact,
  PurchaseEventId,
} from "./types";
import {
  parseActivityOccurrenceFact,
  parseCashUseId,
  parseCanonicalComponentKey,
  parseEconomicComponentFact,
  parsePersonDayFact,
  parsePlaceVisitFact,
  parsePurchaseEventFact,
  parsePurchaseEventId,
} from "./validation";
import { resolveHistoricalEconomicTiming } from "./economic-timing";
import {
  resolvePurchaseEventTiming,
  type PurchaseEventTimingAssertion,
} from "./purchase-event";

export const canonicalFactSources = {
  economicComponent: "financial_economic_cost_canonical",
  economicReconciliation: "financial_canonical_reconciliation_control",
  economicTiming: "financial_economic_timing_canonical",
  economicTimingControl: "financial_economic_timing_control",
  placeResolution: "operation_place_canonical",
  sourceAttribution: "financial_source_attribution_control",
  personDay: "person_days",
  placeVisit: "location_occurrences",
  activityOccurrence: [
    "life_events",
    "life_event_types",
    "life_event_participations",
  ],
  purchaseEvent: [
    "purchase_events",
    "purchase_event_memberships",
    "purchase_event_timing_assertions",
  ],
} as const;

type CanonicalSourceKind =
  | "Operation"
  | "Allocation"
  | "Item"
  | "Payment_component"
  | "Cash_use";

type CanonicalTimingControlStatus =
  | "ORPHAN_SEGMENT"
  | "HOUSEHOLD_MISMATCH"
  | "UNKNOWN"
  | "PARTIAL"
  | "RECONCILED"
  | "AMOUNT_MISMATCH";

export type CanonicalHouseholdContext = {
  readonly householdId: HouseholdId;
  readonly householdTimeZone: HouseholdTimeZone;
};

type ParsedEconomicComponentRow = {
  readonly operationId: ReturnType<typeof parseOperationId>;
  readonly sourceKind: CanonicalSourceKind;
  readonly componentId: string;
  readonly canonicalComponentKey: CanonicalComponentKey;
  readonly gross: Money;
  readonly refundApplied: Money;
  readonly net: Money;
  readonly categoryId: ReturnType<typeof parseCategoryId> | null;
  readonly subcategoryId: ReturnType<typeof parseSubcategoryId> | null;
  readonly momentId: ReturnType<typeof parseMomentId> | null;
};

type ParsedOperationContextRow = {
  readonly operationId: ReturnType<typeof parseOperationId>;
  readonly bankDate: LocalDate;
  readonly forcedAnalyticMonth: YearMonth | null;
  readonly realTransactionDate: LocalDate | null;
  readonly realTransactionDateReliable: boolean;
  readonly merchantId: ReturnType<typeof parseMerchantId> | null;
  readonly necessity: string | null;
  readonly behavior: string | null;
  readonly lifeScope: string | null;
};

const uuidPattern =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const sourceKinds = new Set<CanonicalSourceKind>([
  "Operation",
  "Allocation",
  "Item",
  "Payment_component",
  "Cash_use",
]);
const sourceLayers = new Set([
  "Operation_parent",
  "Operation_residual",
  "Allocation",
  "Item",
  "Payment_component",
  "Cash_economic_use",
]);
const placeResolutionStates = new Set([
  "known",
  "unknown",
  "conflict",
  "not_applicable",
] as const);
const timingStates = new Set(["Known", "Partial", "Unknown"] as const);
const timingControlStatuses = new Set<CanonicalTimingControlStatus>([
  "ORPHAN_SEGMENT",
  "HOUSEHOLD_MISMATCH",
  "UNKNOWN",
  "PARTIAL",
  "RECONCILED",
  "AMOUNT_MISMATCH",
]);

function parseUuid(value: unknown, typeName: string): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new TypeError(`${typeName} doit être un UUID canonique.`);
  }
  return value;
}

function parseNullable<Value>(
  value: unknown,
  parse: (candidate: unknown) => Value,
): Value | null {
  return value === null ? null : parse(value);
}

function parseNullableText(value: unknown, typeName: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${typeName} doit être NULL ou une chaîne non vide.`);
  }
  return value;
}

function parseInteger(value: unknown, typeName: string): number {
  const parsed =
    typeof value === "string" && /^-?\d+$/.test(value)
      ? Number(value)
      : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed)) {
    throw new TypeError(`${typeName} doit être un entier sûr.`);
  }
  return parsed;
}

function parseCanonicalMoney(value: unknown, typeName: string): Money {
  if (typeof value !== "string") {
    throw new TypeError(
      `${typeName} doit être sélectionné comme texte décimal pour préserver Money exactement.`,
    );
  }
  return parseMoney(value);
}

function parseNullableCanonicalMoney(
  value: unknown,
  typeName: string,
): Money | null {
  return value === null ? null : parseCanonicalMoney(value, typeName);
}

function textDimension(value: string | null) {
  return value === null
    ? ({ kind: "unknown" } as const)
    : ({ kind: "resolved", value } as const);
}

function idDimension<Id extends string>(value: Id | null) {
  return value === null
    ? ({ kind: "unknown" } as const)
    : ({ kind: "resolved", id: value } as const);
}

export function parseCanonicalHouseholdScope(
  scopeValue: unknown,
): HouseholdId {
  const scope = parseStrictRecord(
    scopeValue,
    ["household_count", "household_id", "status"],
    "canonical_household_scope_control",
  );
  const householdCount = parseInteger(
    requireProperty(scope, "household_count", "canonical_household_scope_control"),
    "canonical_household_scope_control.household_count",
  );
  const status = parseStringLiteral(
    requireProperty(scope, "status", "canonical_household_scope_control"),
    new Set(["READY", "AMBIGUOUS"]),
    "canonical_household_scope_control.status",
  );
  const scopeHouseholdId = parseNullable(
    requireProperty(scope, "household_id", "canonical_household_scope_control"),
    parseHouseholdId,
  );
  if (status !== "READY" || householdCount !== 1 || scopeHouseholdId === null) {
    throw new TypeError("Le scope canonique Household n'est pas READY et univoque.");
  }
  return scopeHouseholdId;
}

export function parseCanonicalHouseholdContext(
  scopeValue: unknown,
  householdValue: unknown,
): CanonicalHouseholdContext {
  const scopeHouseholdId = parseCanonicalHouseholdScope(scopeValue);

  const household = parseStrictRecord(
    householdValue,
    ["household_id", "timezone"],
    "households",
  );
  const householdId = parseHouseholdId(
    requireProperty(household, "household_id", "households"),
  );
  if (householdId !== scopeHouseholdId) {
    throw new TypeError("households ne correspond pas au scope Household canonique.");
  }
  return {
    householdId,
    householdTimeZone: parseHouseholdTimeZone(
      requireProperty(household, "timezone", "households"),
    ),
  };
}

function parseEconomicComponentRow(value: unknown): ParsedEconomicComponentRow {
  const row = parseStrictRecord(
    value,
    [
      "operation_id",
      "cash_use_id",
      "source_layer",
      "component_id",
      "canonical_economic_gross",
      "refund_applied",
      "canonical_economic_net",
      "category_id",
      "subcategory_id",
      "moment_id",
      "canonical_economic_amount",
      "canonical_component_key",
      "source_kind",
    ],
    "financial_economic_cost_canonical",
  );
  const operationId = parseOperationId(
    requireProperty(row, "operation_id", "financial_economic_cost_canonical"),
  );
  const sourceKind = parseStringLiteral<CanonicalSourceKind>(
    requireProperty(row, "source_kind", "financial_economic_cost_canonical"),
    sourceKinds,
    "financial_economic_cost_canonical.source_kind",
  );
  const sourceLayer = parseStringLiteral(
    requireProperty(row, "source_layer", "financial_economic_cost_canonical"),
    sourceLayers,
    "financial_economic_cost_canonical.source_layer",
  );
  const componentId = parseUuid(
    requireProperty(row, "component_id", "financial_economic_cost_canonical"),
    "financial_economic_cost_canonical.component_id",
  );
  const canonicalComponentKey = parseCanonicalComponentKey(
    requireProperty(
      row,
      "canonical_component_key",
      "financial_economic_cost_canonical",
    ),
  );
  const prefixBySource: Record<CanonicalSourceKind, string> = {
    Operation: "operation",
    Allocation: "allocation",
    Item: "item",
    Payment_component: "payment_component",
    Cash_use: "cash_use",
  };
  if (canonicalComponentKey !== `${prefixBySource[sourceKind]}:${componentId}`) {
    throw new TypeError(
      "canonical_component_key ne correspond pas à source_kind + component_id.",
    );
  }
  const allowedLayerBySource: Record<CanonicalSourceKind, ReadonlySet<string>> = {
    Operation: new Set(["Operation_parent", "Operation_residual"]),
    Allocation: new Set(["Allocation"]),
    Item: new Set(["Item"]),
    Payment_component: new Set(["Payment_component"]),
    Cash_use: new Set(["Cash_economic_use"]),
  };
  if (!allowedLayerBySource[sourceKind].has(sourceLayer)) {
    throw new TypeError("source_layer ne correspond pas à source_kind.");
  }

  const cashUseId = parseNullable(
    requireProperty(row, "cash_use_id", "financial_economic_cost_canonical"),
    (candidate) => parseUuid(candidate, "financial_economic_cost_canonical.cash_use_id"),
  );
  if (
    (sourceKind === "Cash_use" && cashUseId !== componentId) ||
    (sourceKind !== "Cash_use" && cashUseId !== null)
  ) {
    throw new TypeError("cash_use_id ne correspond pas au grain canonique.");
  }

  const gross = parseCanonicalMoney(
    requireProperty(
      row,
      "canonical_economic_gross",
      "financial_economic_cost_canonical",
    ),
    "financial_economic_cost_canonical.canonical_economic_gross",
  );
  const refundApplied = parseCanonicalMoney(
    requireProperty(row, "refund_applied", "financial_economic_cost_canonical"),
    "financial_economic_cost_canonical.refund_applied",
  );
  const net = parseCanonicalMoney(
    requireProperty(
      row,
      "canonical_economic_net",
      "financial_economic_cost_canonical",
    ),
    "financial_economic_cost_canonical.canonical_economic_net",
  );
  const amount = parseCanonicalMoney(
    requireProperty(
      row,
      "canonical_economic_amount",
      "financial_economic_cost_canonical",
    ),
    "financial_economic_cost_canonical.canonical_economic_amount",
  );
  if (compareMoney(amount, net) !== 0) {
    throw new TypeError("canonical_economic_amount doit égaler canonical_economic_net.");
  }

  return {
    operationId,
    sourceKind,
    componentId,
    canonicalComponentKey,
    gross,
    refundApplied,
    net,
    categoryId: parseNullable(
      requireProperty(row, "category_id", "financial_economic_cost_canonical"),
      parseCategoryId,
    ),
    subcategoryId: parseNullable(
      requireProperty(row, "subcategory_id", "financial_economic_cost_canonical"),
      parseSubcategoryId,
    ),
    momentId: parseNullable(
      requireProperty(row, "moment_id", "financial_economic_cost_canonical"),
      parseMomentId,
    ),
  };
}

function parseOperationContextRow(value: unknown): ParsedOperationContextRow {
  const row = parseStrictRecord(
    value,
    [
      "operation_id",
      "date_bancaire",
      "mois_analytique_force",
      "date_transaction_reelle",
      "date_transaction_precision",
      "merchant_id",
      "importance",
      "nature_fixe_variable",
      "contexte_vie",
    ],
    "operations",
  );
  const transactionPrecision = parseNullableText(
    requireProperty(row, "date_transaction_precision", "operations"),
    "operations.date_transaction_precision",
  );
  return {
    operationId: parseOperationId(requireProperty(row, "operation_id", "operations")),
    bankDate: parseLocalDate(requireProperty(row, "date_bancaire", "operations")),
    forcedAnalyticMonth: parseNullable(
      requireProperty(row, "mois_analytique_force", "operations"),
      parseYearMonth,
    ),
    realTransactionDate: parseNullable(
      requireProperty(row, "date_transaction_reelle", "operations"),
      parseLocalDate,
    ),
    realTransactionDateReliable: transactionPrecision === "Jour exact",
    merchantId: parseNullable(
      requireProperty(row, "merchant_id", "operations"),
      parseMerchantId,
    ),
    necessity: parseNullableText(
      requireProperty(row, "importance", "operations"),
      "operations.importance",
    ),
    behavior: parseNullableText(
      requireProperty(row, "nature_fixe_variable", "operations"),
      "operations.nature_fixe_variable",
    ),
    lifeScope: parseNullableText(
      requireProperty(row, "contexte_vie", "operations"),
      "operations.contexte_vie",
    ),
  };
}

function parseCanonicalPlace(
  value: unknown,
  component: ParsedEconomicComponentRow,
): CanonicalPlaceValue {
  const row = parseStrictRecord(
    value,
    ["canonical_component_key", "operation_id", "place_id", "resolution_state"],
    "operation_place_canonical",
  );
  const key = parseCanonicalComponentKey(
    requireProperty(row, "canonical_component_key", "operation_place_canonical"),
  );
  if (key !== component.canonicalComponentKey) {
    throw new TypeError("operation_place_canonical ne correspond pas au composant.");
  }
  const operationId = parseNullable(
    requireProperty(row, "operation_id", "operation_place_canonical"),
    parseOperationId,
  );
  if (
    (component.sourceKind === "Cash_use" && operationId !== null) ||
    (component.sourceKind !== "Cash_use" && operationId !== component.operationId)
  ) {
    throw new TypeError("operation_place_canonical.operation_id est incohérent.");
  }
  const resolutionState = parseStringLiteral<
    "known" | "unknown" | "conflict" | "not_applicable"
  >(
    requireProperty(row, "resolution_state", "operation_place_canonical"),
    placeResolutionStates,
    "operation_place_canonical.resolution_state",
  );
  const placeId = parseNullable(
    requireProperty(row, "place_id", "operation_place_canonical"),
    parsePlaceId,
  );
  if (resolutionState === "known") {
    if (placeId === null) {
      throw new TypeError("Un lieu canonique known exige place_id.");
    }
    return {
      kind: "resolved",
      placeId,
      resolution: "operation_place_canonical",
    };
  }
  if (placeId !== null) {
    throw new TypeError("Un lieu non known ne peut pas retenir place_id.");
  }
  return { kind: resolutionState };
}

function parseEconomicReconciliation(
  value: unknown,
  component: ParsedEconomicComponentRow,
): void {
  const row = parseStrictRecord(
    value,
    [
      "operation_id",
      "economic_gross_delta",
      "economic_refund_resolution",
      "economic_status",
    ],
    "financial_canonical_reconciliation_control",
  );
  const operationId = parseOperationId(
    requireProperty(
      row,
      "operation_id",
      "financial_canonical_reconciliation_control",
    ),
  );
  if (operationId !== component.operationId) {
    throw new TypeError("Le contrôle de réconciliation vise une autre opération.");
  }
  const status = parseStringLiteral(
    requireProperty(
      row,
      "economic_status",
      "financial_canonical_reconciliation_control",
    ),
    new Set(["OK", "MISMATCH", "NOT_APPLICABLE"]),
    "financial_canonical_reconciliation_control.economic_status",
  );
  parseStringLiteral(
    requireProperty(
      row,
      "economic_refund_resolution",
      "financial_canonical_reconciliation_control",
    ),
    new Set(["NONE", "RESOLVED", "UNRESOLVED_COMPONENT_SPLIT"]),
    "financial_canonical_reconciliation_control.economic_refund_resolution",
  );
  const delta = parseNullableCanonicalMoney(
    requireProperty(
      row,
      "economic_gross_delta",
      "financial_canonical_reconciliation_control",
    ),
    "financial_canonical_reconciliation_control.economic_gross_delta",
  );
  if (status !== "OK" || delta === null || compareMoney(delta, parseMoney("0")) !== 0) {
    throw new TypeError("La réconciliation économique canonique n'est pas OK.");
  }
}

function parseEconomicMonth(value: unknown): ReturnType<typeof parseYearMonth> | null {
  if (value === null) return null;
  const date = parseLocalDate(value);
  if (!date.endsWith("-01")) {
    throw new TypeError("economic_month doit être stocké au premier jour du mois.");
  }
  return parseYearMonth(date.slice(0, 7));
}

function projectEconomicTiming(
  rowValues: readonly unknown[],
  controlValue: unknown,
  component: ParsedEconomicComponentRow,
  household: CanonicalHouseholdContext,
): EconomicTiming {
  const control = parseStrictRecord(
    controlValue,
    [
      "canonical_component_key",
      "canonical_economic_net",
      "segment_count",
      "known_count",
      "partial_count",
      "unknown_count",
      "household_count",
      "household_mismatch_count",
      "segment_amount_sum",
      "amount_delta",
      "status",
    ],
    "financial_economic_timing_control",
  );
  const controlKey = parseCanonicalComponentKey(
    requireProperty(
      control,
      "canonical_component_key",
      "financial_economic_timing_control",
    ),
  );
  if (controlKey !== component.canonicalComponentKey) {
    throw new TypeError("Le contrôle timing vise un autre composant.");
  }
  const controlNet = parseCanonicalMoney(
    requireProperty(
      control,
      "canonical_economic_net",
      "financial_economic_timing_control",
    ),
    "financial_economic_timing_control.canonical_economic_net",
  );
  if (compareMoney(controlNet, component.net) !== 0) {
    throw new TypeError("Le contrôle timing ne porte pas le net canonique attendu.");
  }
  const status = parseStringLiteral<CanonicalTimingControlStatus>(
    requireProperty(control, "status", "financial_economic_timing_control"),
    timingControlStatuses,
    "financial_economic_timing_control.status",
  );
  const segmentCount = parseInteger(
    requireProperty(control, "segment_count", "financial_economic_timing_control"),
    "financial_economic_timing_control.segment_count",
  );
  parseInteger(
    requireProperty(control, "known_count", "financial_economic_timing_control"),
    "financial_economic_timing_control.known_count",
  );
  parseInteger(
    requireProperty(control, "partial_count", "financial_economic_timing_control"),
    "financial_economic_timing_control.partial_count",
  );
  parseInteger(
    requireProperty(control, "unknown_count", "financial_economic_timing_control"),
    "financial_economic_timing_control.unknown_count",
  );
  parseInteger(
    requireProperty(control, "household_count", "financial_economic_timing_control"),
    "financial_economic_timing_control.household_count",
  );
  const householdMismatchCount = parseInteger(
    requireProperty(
      control,
      "household_mismatch_count",
      "financial_economic_timing_control",
    ),
    "financial_economic_timing_control.household_mismatch_count",
  );
  parseNullableCanonicalMoney(
    requireProperty(
      control,
      "segment_amount_sum",
      "financial_economic_timing_control",
    ),
    "financial_economic_timing_control.segment_amount_sum",
  );
  parseNullableCanonicalMoney(
    requireProperty(control, "amount_delta", "financial_economic_timing_control"),
    "financial_economic_timing_control.amount_delta",
  );

  if (
    status === "ORPHAN_SEGMENT" ||
    status === "HOUSEHOLD_MISMATCH" ||
    status === "AMOUNT_MISMATCH" ||
    householdMismatchCount > 0
  ) {
    return { kind: "conflict" };
  }

  const segments: EconomicTimingSegment[] = [];
  for (const [index, value] of rowValues.entries()) {
    const row = withValidationPath(index, () =>
      parseStrictRecord(
        value,
        [
          "household_id",
          "canonical_component_key",
          "economic_segment_id",
          "timing_state",
          "period_start",
          "period_end",
          "economic_month",
          "economic_amount",
          "attribution_method",
          "method_version",
        ],
        "financial_economic_timing_canonical",
      ),
    );
    const key = parseCanonicalComponentKey(
      requireProperty(
        row,
        "canonical_component_key",
        "financial_economic_timing_canonical",
      ),
    );
    if (key !== component.canonicalComponentKey) {
      throw new TypeError("Une ligne timing vise un autre composant.");
    }
    const householdId = parseNullable(
      requireProperty(row, "household_id", "financial_economic_timing_canonical"),
      parseHouseholdId,
    );
    if (householdId !== household.householdId) {
      throw new TypeError("Une ligne timing ne correspond pas au Household.");
    }
    const timingState = parseStringLiteral(
      requireProperty(row, "timing_state", "financial_economic_timing_canonical"),
      timingStates,
      "financial_economic_timing_canonical.timing_state",
    );
    const segmentId = parseNullable(
      requireProperty(
        row,
        "economic_segment_id",
        "financial_economic_timing_canonical",
      ),
      (candidate) =>
        parseUuid(candidate, "financial_economic_timing_canonical.economic_segment_id"),
    );
    const periodStart = parseNullable(
      requireProperty(row, "period_start", "financial_economic_timing_canonical"),
      parseLocalDate,
    );
    const periodEnd = parseNullable(
      requireProperty(row, "period_end", "financial_economic_timing_canonical"),
      parseLocalDate,
    );
    const economicMonth = parseEconomicMonth(
      requireProperty(row, "economic_month", "financial_economic_timing_canonical"),
    );
    const amount = parseCanonicalMoney(
      requireProperty(row, "economic_amount", "financial_economic_timing_canonical"),
      "financial_economic_timing_canonical.economic_amount",
    );
    parseNullableText(
      requireProperty(row, "attribution_method", "financial_economic_timing_canonical"),
      "financial_economic_timing_canonical.attribution_method",
    );
    parseNullableText(
      requireProperty(row, "method_version", "financial_economic_timing_canonical"),
      "financial_economic_timing_canonical.method_version",
    );

    if (segmentId === null) {
      if (
        status !== "UNKNOWN" ||
        timingState !== "Unknown" ||
        periodStart !== null ||
        periodEnd !== null ||
        economicMonth !== null
      ) {
        throw new TypeError("La pseudo-ligne timing Unknown est incohérente.");
      }
      continue;
    }
    segments.push({
      segmentKey: segmentId as EconomicTimingSegment["segmentKey"],
      timingState: timingState.toLowerCase() as EconomicTimingSegment["timingState"],
      periodStart,
      periodEnd,
      economicMonth,
      amount,
    });
  }

  if (status === "UNKNOWN") {
    if (segmentCount !== 0 || segments.length !== 0) {
      throw new TypeError("Un timing UNKNOWN ne contient aucun segment physique.");
    }
    return { kind: "unknown" };
  }
  if (segments.length !== segmentCount || segments.length === 0) {
    throw new TypeError("Le nombre de segments timing ne correspond pas au contrôle.");
  }
  return status === "RECONCILED"
    ? { kind: "known", segments }
    : { kind: "partial", segments };
}

export type EconomicComponentProjectionInput = {
  readonly household: CanonicalHouseholdContext;
  readonly economicComponent: unknown;
  readonly operation: unknown;
  readonly place: unknown;
  readonly timingRows: readonly unknown[];
  readonly timingControl: unknown;
  readonly reconciliationControl: unknown;
};

export function projectEconomicComponentFact(
  input: EconomicComponentProjectionInput,
): EconomicComponentFact {
  const component = parseEconomicComponentRow(input.economicComponent);
  const operation = parseOperationContextRow(input.operation);
  if (operation.operationId !== component.operationId) {
    throw new TypeError("L'opération ne correspond pas au composant économique.");
  }
  parseEconomicReconciliation(input.reconciliationControl, component);
  const explicitTiming = projectEconomicTiming(
    input.timingRows,
    input.timingControl,
    component,
    input.household,
  );
  const timing = resolveHistoricalEconomicTiming({
    explicitTiming,
    canonicalComponentKey: component.canonicalComponentKey,
    canonicalEconomicNet: component.net,
    forcedAnalyticMonth: operation.forcedAnalyticMonth,
    realTransactionDate: operation.realTransactionDate,
    realTransactionDateReliable: operation.realTransactionDateReliable,
    bankDate: operation.bankDate,
  }).timing;
  return parseEconomicComponentFact({
    fact: "fct_economic_component",
    householdId: input.household.householdId,
    householdTimeZone: input.household.householdTimeZone,
    canonicalComponentKey: component.canonicalComponentKey,
    sourceOperation: { kind: "resolved", id: component.operationId },
    gross: component.gross,
    refundApplied: component.refundApplied,
    net: component.net,
    bankDate: { kind: "known", date: operation.bankDate },
    economicTiming: timing,
    person: { kind: "unknown" },
    category:
      component.categoryId === null
        ? { kind: "undetermined" }
        : { kind: "resolved", id: component.categoryId },
    subcategory: idDimension(component.subcategoryId),
    activity: { kind: "unknown" },
    merchant: idDimension(operation.merchantId),
    moment: idDimension(component.momentId),
    canonicalPlace: parseCanonicalPlace(input.place, component),
    necessity: textDimension(operation.necessity),
    behavior: textDimension(operation.behavior),
    lifeScope: textDimension(operation.lifeScope),
  });
}

function parsePersonMembership(
  value: unknown,
  expectedPersonId: PersonId,
  household: CanonicalHouseholdContext,
): void {
  const row = parseStrictRecord(
    value,
    ["person_id", "household_id"],
    "persons",
  );
  const personId = parsePersonId(requireProperty(row, "person_id", "persons"));
  const householdId = parseHouseholdId(
    requireProperty(row, "household_id", "persons"),
  );
  if (personId !== expectedPersonId || householdId !== household.householdId) {
    throw new TypeError("La personne ne correspond pas au Household canonique.");
  }
}

type ParsedPersonDaySource = {
  readonly personDayId: PersonDayId;
  readonly personId: PersonId;
  readonly localDate: LocalDate;
  readonly locationObservability: PersonDayFact["locationObservability"];
};

function parsePersonDaySource(value: unknown): ParsedPersonDaySource {
  const row = parseStrictRecord(
    value,
    ["person_day_id", "person_id", "date", "couverture_localisation"],
    "person_days",
  );
  const coverage = parseStringLiteral<"Complète" | "Partielle" | "Absente">(
    requireProperty(row, "couverture_localisation", "person_days"),
    new Set(["Complète", "Partielle", "Absente"]),
    "person_days.couverture_localisation",
  );
  const observabilityByCoverage = {
    Complète: "observable",
    Partielle: "partial",
    Absente: "unknown",
  } as const;
  return {
    personDayId: parseUuid(
      requireProperty(row, "person_day_id", "person_days"),
      "person_days.person_day_id",
    ) as PersonDayId,
    personId: parsePersonId(requireProperty(row, "person_id", "person_days")),
    localDate: parseLocalDate(requireProperty(row, "date", "person_days")),
    locationObservability: observabilityByCoverage[coverage],
  };
}

export function projectPersonDayFact(input: {
  readonly household: CanonicalHouseholdContext;
  readonly personDay: unknown;
  readonly person: unknown;
}): PersonDayFact {
  const source = parsePersonDaySource(input.personDay);
  parsePersonMembership(input.person, source.personId, input.household);
  return parsePersonDayFact({
    fact: "fct_person_day",
    householdId: input.household.householdId,
    householdTimeZone: input.household.householdTimeZone,
    personDayId: source.personDayId,
    personId: source.personId,
    localDate: source.localDate,
    locationObservability: source.locationObservability,
  });
}

const timePrecisionMap = {
  Exact: "exact",
  Approximatif: "approximate",
  "Plage horaire": "time_range",
  Inconnu: "unknown",
} as const satisfies Record<string, PlaceVisitTimePrecision>;

export function projectPlaceVisitFact(input: {
  readonly household: CanonicalHouseholdContext;
  readonly locationOccurrence: unknown;
  readonly personDay: unknown;
  readonly person: unknown;
}): PlaceVisitFact {
  const personDay = parsePersonDaySource(input.personDay);
  parsePersonMembership(input.person, personDay.personId, input.household);
  const row = parseStrictRecord(
    input.locationOccurrence,
    [
      "localization_id",
      "person_day_id",
      "person_id",
      "place_id",
      "start_at",
      "end_at",
      "time_precision",
      "sequence_index",
      "occurrence_type",
    ],
    "location_occurrences",
  );
  const occurrenceType = parseStringLiteral(
    requireProperty(row, "occurrence_type", "location_occurrences"),
    new Set(["Présence", "Transit"]),
    "location_occurrences.occurrence_type",
  );
  if (occurrenceType !== "Présence") {
    throw new TypeError("Un Transit ne peut pas devenir fct_place_visit.");
  }
  const sourcePersonDayId = parseUuid(
    requireProperty(row, "person_day_id", "location_occurrences"),
    "location_occurrences.person_day_id",
  );
  const sourcePersonId = parsePersonId(
    requireProperty(row, "person_id", "location_occurrences"),
  );
  if (
    sourcePersonDayId !== personDay.personDayId ||
    sourcePersonId !== personDay.personId
  ) {
    throw new TypeError("Location_occurrences ne correspond pas au Person_day.");
  }
  const startedAt = parseNullable(
    requireProperty(row, "start_at", "location_occurrences"),
    parseInstant,
  );
  const endedAt = parseNullable(
    requireProperty(row, "end_at", "location_occurrences"),
    parseInstant,
  );
  let interval: PlaceVisitInterval;
  if (startedAt === null && endedAt === null) {
    interval = { kind: "unknown" };
  } else if (startedAt === null || endedAt === null) {
    interval = { kind: "partial", startedAt, endedAt };
  } else {
    interval = { kind: "known", startedAt, endedAt };
  }
  const precision = parseStringLiteral(
    requireProperty(row, "time_precision", "location_occurrences"),
    new Set(Object.keys(timePrecisionMap)),
    "location_occurrences.time_precision",
  ) as keyof typeof timePrecisionMap;
  const sequenceIndex = parseInteger(
    requireProperty(row, "sequence_index", "location_occurrences"),
    "location_occurrences.sequence_index",
  );
  return parsePlaceVisitFact({
    fact: "fct_place_visit",
    householdId: input.household.householdId,
    householdTimeZone: input.household.householdTimeZone,
    visitKey: parseUuid(
      requireProperty(row, "localization_id", "location_occurrences"),
      "location_occurrences.localization_id",
    ) as PlaceVisitKey,
    personDayId: personDay.personDayId,
    personId: personDay.personId,
    placeId: parsePlaceId(requireProperty(row, "place_id", "location_occurrences")),
    localDate: personDay.localDate,
    interval,
    timePrecision: timePrecisionMap[precision],
    sequenceIndex,
  });
}

export type ActivityOccurrenceCanonicalCandidate = {
  readonly lifeEventId: LifeEventId;
  readonly lifeEventSeriesId: LifeEventSeriesId | null;
  readonly parentLifeEventId: LifeEventId | null;
  readonly activityId: ActivityId;
  readonly startDate: LocalDate;
  readonly endDate: LocalDate;
  readonly validationStatus: "Confirmé" | "Déduit" | "À valider";
  readonly canSpanDays: boolean;
  readonly activeType: boolean;
  readonly participations: readonly {
    readonly personDayId: PersonDayId;
    readonly personId: PersonId;
    readonly status: "Confirmée" | "Déduite" | "Inconnue";
  }[];
  readonly participantIds: readonly PersonId[];
};

function parseBoolean(value: unknown, typeName: string): boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(`${typeName} doit être un booléen.`);
  }
  return value;
}

export function parseActivityOccurrenceCanonicalCandidate(input: {
  readonly lifeEvent: unknown;
  readonly lifeEventType: unknown;
  readonly participations: readonly unknown[];
}): ActivityOccurrenceCanonicalCandidate {
  const event = parseStrictRecord(
    input.lifeEvent,
    [
      "life_event_id",
      "life_event_type_id",
      "life_event_series_id",
      "parent_life_event_id",
      "start_date",
      "end_date",
      "validation_status",
    ],
    "life_events",
  );
  const eventId = parseLifeEventId(
    requireProperty(event, "life_event_id", "life_events"),
  );
  const eventTypeId = parseUuid(
    requireProperty(event, "life_event_type_id", "life_events"),
    "life_events.life_event_type_id",
  );
  const lifeEventSeriesId = parseNullable(
    requireProperty(event, "life_event_series_id", "life_events"),
    (candidate) =>
      parseUuid(
        candidate,
        "life_events.life_event_series_id",
      ) as LifeEventSeriesId,
  );
  const parentLifeEventId = parseNullable(
    requireProperty(event, "parent_life_event_id", "life_events"),
    parseLifeEventId,
  );
  const startDate = parseLocalDate(requireProperty(event, "start_date", "life_events"));
  const endDate = parseLocalDate(requireProperty(event, "end_date", "life_events"));
  if (endDate < startDate) {
    throw new TypeError("life_events.end_date précède start_date.");
  }
  const validationStatus = parseStringLiteral<
    ActivityOccurrenceCanonicalCandidate["validationStatus"]
  >(
    requireProperty(event, "validation_status", "life_events"),
    new Set(["Confirmé", "Déduit", "À valider"]),
    "life_events.validation_status",
  );

  const eventType = parseStrictRecord(
    input.lifeEventType,
    ["life_event_type_id", "type_key", "can_span_days", "active"],
    "life_event_types",
  );
  const sourceTypeId = parseUuid(
    requireProperty(eventType, "life_event_type_id", "life_event_types"),
    "life_event_types.life_event_type_id",
  );
  if (sourceTypeId !== eventTypeId) {
    throw new TypeError("Life_event_types ne correspond pas au Life_event.");
  }
  const activityId = parseActivityId(
    requireProperty(eventType, "type_key", "life_event_types"),
  );
  const canSpanDays = parseBoolean(
    requireProperty(eventType, "can_span_days", "life_event_types"),
    "life_event_types.can_span_days",
  );
  if (startDate !== endDate && !canSpanDays) {
    throw new TypeError("Un Life Event multi-jour utilise un type qui l'interdit.");
  }
  const participations = input.participations.map((value, index) =>
    withValidationPath(index, () => {
      const participation = parseStrictRecord(
        value,
        ["life_event_id", "person_day_id", "person_id", "participation_status"],
        "life_event_participations",
      );
      if (
        parseLifeEventId(
          requireProperty(participation, "life_event_id", "life_event_participations"),
        ) !== eventId
      ) {
        throw new TypeError("Une participation vise un autre Life Event.");
      }
      const status = parseStringLiteral<"Confirmée" | "Déduite" | "Inconnue">(
        requireProperty(
          participation,
          "participation_status",
          "life_event_participations",
        ),
        new Set(["Confirmée", "Déduite", "Inconnue"]),
        "life_event_participations.participation_status",
      );
      return {
        personDayId: parseUuid(
          requireProperty(
            participation,
            "person_day_id",
            "life_event_participations",
          ),
          "life_event_participations.person_day_id",
        ) as PersonDayId,
        personId: parsePersonId(
          requireProperty(participation, "person_id", "life_event_participations"),
        ),
        status,
      };
    }),
  );
  const participantIds = [...new Set(participations.map(({ personId }) => personId))].sort();
  return {
    lifeEventId: eventId,
    lifeEventSeriesId,
    parentLifeEventId,
    activityId,
    startDate,
    endDate,
    validationStatus,
    canSpanDays,
    activeType: parseBoolean(
      requireProperty(eventType, "active", "life_event_types"),
      "life_event_types.active",
    ),
    participations,
    participantIds,
  };
}

export function projectActivityOccurrenceFact(input: {
  readonly household: CanonicalHouseholdContext;
  readonly lifeEvent: unknown;
  readonly lifeEventType: unknown;
  readonly participations: readonly unknown[];
}): ActivityOccurrenceFact | null {
  const candidate = parseActivityOccurrenceCanonicalCandidate(input);
  if (candidate.validationStatus === "À valider") {
    return null;
  }

  return parseActivityOccurrenceFact({
    fact: "fct_activity_occurrence",
    householdId: input.household.householdId,
    householdTimeZone: input.household.householdTimeZone,
    lifeEventId: candidate.lifeEventId,
    activityId: candidate.activityId,
    lifeEventSeriesId: candidate.lifeEventSeriesId,
    parentLifeEventId: candidate.parentLifeEventId,
    startDate: candidate.startDate,
    endDate: candidate.endDate,
    validationStatus: candidate.validationStatus,
    participantIds: candidate.participantIds,
  });
}

export type PurchaseEventCanonicalSource = {
  readonly purchaseEventId: PurchaseEventId;
  readonly membershipKind: "CONSUMPTION_COMPONENT" | "EVIDENCE_SOURCE";
  readonly kind: "operation" | "allocation" | "item" | "payment_component" | "cash_use";
  readonly sourceId: string;
  readonly canonicalComponentKey: CanonicalComponentKey;
  readonly evidenceRefs: readonly string[];
  readonly provenance: "EXPLICIT_USER_ASSERTION" | "STRUCTURED_CANONICAL_SOURCE" | "CONTROLLED_BACKFILL";
};

function parsePurchaseEventCanonicalSource(
  value: unknown,
): PurchaseEventCanonicalSource {
  const row = parseStrictRecord(
    value,
    [
      "purchase_event_id", "membership_kind", "operation_id", "allocation_id",
      "item_id", "payment_component_id", "cash_use_id", "canonical_component_key",
      "evidence_refs", "provenance",
    ],
    "purchase_event_memberships",
  );
  const sources = [
    ["operation", "operation_id"],
    ["allocation", "allocation_id"],
    ["item", "item_id"],
    ["payment_component", "payment_component_id"],
    ["cash_use", "cash_use_id"],
  ] as const;
  const present = sources.flatMap(([kind, column]) => {
    const sourceId = requireProperty(row, column, "purchase_event_memberships");
    return sourceId === null ? [] : [{ kind, sourceId: String(sourceId) }];
  });
  if (present.length !== 1) {
    throw new TypeError("purchase_event_memberships exige exactement une source canonique.");
  }
  const canonicalComponentKey = parseCanonicalComponentKey(
    requireProperty(row, "canonical_component_key", "purchase_event_memberships"),
  );
  if (canonicalComponentKey !== `${present[0].kind}:${present[0].sourceId}`) {
    throw new TypeError("purchase_event_memberships.canonical_component_key ne correspond pas à sa source.");
  }
  const evidenceRefs = requireProperty(row, "evidence_refs", "purchase_event_memberships");
  if (!Array.isArray(evidenceRefs) || evidenceRefs.some((ref) => typeof ref !== "string" || ref.length === 0)) {
    throw new TypeError("purchase_event_memberships.evidence_refs est invalide.");
  }
  return {
    purchaseEventId: parsePurchaseEventId(
      requireProperty(row, "purchase_event_id", "purchase_event_memberships"),
    ),
    membershipKind: parseStringLiteral(
      requireProperty(row, "membership_kind", "purchase_event_memberships"),
      new Set(["CONSUMPTION_COMPONENT", "EVIDENCE_SOURCE"] as const),
      "purchase_event_memberships.membership_kind",
    ),
    kind: present[0].kind,
    sourceId: present[0].sourceId,
    canonicalComponentKey,
    evidenceRefs: [...evidenceRefs].sort(),
    provenance: parseStringLiteral(
      requireProperty(row, "provenance", "purchase_event_memberships"),
      new Set(["EXPLICIT_USER_ASSERTION", "STRUCTURED_CANONICAL_SOURCE", "CONTROLLED_BACKFILL"] as const),
      "purchase_event_memberships.provenance",
    ),
  };
}

export function parsePurchaseEventCanonicalSources(
  values: readonly unknown[],
): readonly PurchaseEventCanonicalSource[] {
  const membershipKeys = new Set<string>();
  const sources = values.map((value, index) =>
    withValidationPath(index, () => {
      const source = parsePurchaseEventCanonicalSource(value);
      const key = `${source.purchaseEventId}:${source.membershipKind}:${source.canonicalComponentKey}`;
      if (membershipKeys.has(key)) {
        throw new TypeError("Un membership Purchase Event est dupliqué.");
      }
      membershipKeys.add(key);
      return source;
    }),
  );
  return [...sources].sort((left, right) => {
    const eventOrder = left.purchaseEventId.localeCompare(right.purchaseEventId);
    if (eventOrder !== 0) return eventOrder;
    const leftKey = `${left.membershipKind}:${left.canonicalComponentKey}`;
    const rightKey = `${right.membershipKind}:${right.canonicalComponentKey}`;
    return leftKey.localeCompare(rightKey);
  });
}

export function projectPurchaseEventFact(input: {
  readonly household: CanonicalHouseholdContext;
  readonly purchaseEvent: unknown;
  readonly sources: readonly unknown[];
  readonly timingAssertions: readonly unknown[];
  readonly economicComponents: readonly EconomicComponentFact[];
}): PurchaseEventFact {
  const event = parseStrictRecord(
    input.purchaseEvent,
    ["purchase_event_id", "household_id", "provenance"],
    "purchase_events",
  );
  const purchaseEventId = parsePurchaseEventId(
    requireProperty(event, "purchase_event_id", "purchase_events"),
  );
  const householdId = parseHouseholdId(
    requireProperty(event, "household_id", "purchase_events"),
  );
  if (householdId !== input.household.householdId) {
    throw new TypeError(
      "purchase_events.household_id ne correspond pas au Household canonique.",
    );
  }

  const canonicalSources = parsePurchaseEventCanonicalSources(input.sources);
  if (
    canonicalSources.some(
      (source) => source.purchaseEventId !== purchaseEventId,
    )
  ) {
    throw new TypeError(
      "purchase_event_sources contient une source d'un autre Purchase Event.",
    );
  }

  const consumptionSources = canonicalSources.filter(({ membershipKind }) =>
    membershipKind === "CONSUMPTION_COMPONENT");
  if (consumptionSources.length === 0) {
    throw new TypeError("Un Purchase Event doit posséder au moins un composant de consommation.");
  }
  const componentByKey = new Map(input.economicComponents.map((component) =>
    [component.canonicalComponentKey, component]));
  const economicAmount = consumptionSources.reduce((total, source) => {
    const component = componentByKey.get(source.canonicalComponentKey);
    if (component === undefined) {
      throw new TypeError("Un composant économique du Purchase Event est absent.");
    }
    if (component.householdId !== householdId) {
      throw new TypeError("Un composant économique du Purchase Event appartient à un autre Household.");
    }
    return addMoney(total, component.net);
  }, parseMoney("0"));

  const timingAssertions = input.timingAssertions.map((value) => {
    const row = parseStrictRecord(value, [
      "purchase_event_id", "timing_authority", "timing_precision", "economic_date",
      "economic_month", "evidence_refs",
    ], "purchase_event_timing_assertions");
    if (parsePurchaseEventId(requireProperty(row, "purchase_event_id", "purchase_event_timing_assertions")) !== purchaseEventId) {
      throw new TypeError("Une assertion temporelle appartient à un autre Purchase Event.");
    }
    const refs = requireProperty(row, "evidence_refs", "purchase_event_timing_assertions");
    if (!Array.isArray(refs) || refs.some((ref) => typeof ref !== "string" || ref.length === 0)) {
      throw new TypeError("purchase_event_timing_assertions.evidence_refs est invalide.");
    }
    return {
      authority: parseStringLiteral(
        requireProperty(row, "timing_authority", "purchase_event_timing_assertions"),
        new Set(["EXPLICIT_EVENT", "EXPLICIT_CONSUMPTION_SOURCE", "TRUSTED_PURCHASE_SOURCE", "ECONOMIC_MONTH"] as const),
        "purchase_event_timing_assertions.timing_authority",
      ),
      precision: parseStringLiteral(
        requireProperty(row, "timing_precision", "purchase_event_timing_assertions"),
        new Set(["DAY", "MONTH"] as const),
        "purchase_event_timing_assertions.timing_precision",
      ),
      economicDate: requireProperty(row, "economic_date", "purchase_event_timing_assertions") as string | null,
      economicMonth: String(requireProperty(row, "economic_month", "purchase_event_timing_assertions")),
      evidenceRefs: [...refs],
    } satisfies PurchaseEventTimingAssertion;
  });

  return parsePurchaseEventFact({
    fact: "fct_purchase_event",
    householdId,
    householdTimeZone: input.household.householdTimeZone,
    purchaseEventId,
    sources: canonicalSources.map((source) => ({
      membershipKind: source.membershipKind,
      kind: source.kind,
      sourceId: source.sourceId,
      canonicalComponentKey: source.canonicalComponentKey,
      evidenceRefs: source.evidenceRefs,
      provenance: source.provenance,
    })),
    economicAmount,
    timing: resolvePurchaseEventTiming(timingAssertions),
    provenance: parseStringLiteral(
      requireProperty(event, "provenance", "purchase_events"),
      new Set(["EXPLICIT_USER_ASSERTION", "STRUCTURED_CANONICAL_SOURCE", "CONTROLLED_BACKFILL"] as const),
      "purchase_events.provenance",
    ),
  });
}

export function assertCanonicalSourceAttributionControls(
  values: readonly unknown[],
): void {
  values.forEach((value, index) =>
    withValidationPath(index, () => {
      const row = parseStrictRecord(
        value,
        [
          "canonical_component_key",
          "canonical_amount",
          "causal_allocated_amount",
          "delta",
          "status",
          "causal_link_count",
          "unquantified_causal_link_count",
        ],
        "financial_source_attribution_control",
      );
      parseCanonicalComponentKey(
        requireProperty(
          row,
          "canonical_component_key",
          "financial_source_attribution_control",
        ),
      );
      parseNullableCanonicalMoney(
        requireProperty(row, "canonical_amount", "financial_source_attribution_control"),
        "financial_source_attribution_control.canonical_amount",
      );
      parseCanonicalMoney(
        requireProperty(
          row,
          "causal_allocated_amount",
          "financial_source_attribution_control",
        ),
        "financial_source_attribution_control.causal_allocated_amount",
      );
      parseNullableCanonicalMoney(
        requireProperty(row, "delta", "financial_source_attribution_control"),
        "financial_source_attribution_control.delta",
      );
      const status = parseStringLiteral(
        requireProperty(row, "status", "financial_source_attribution_control"),
        new Set(["OK", "OVER_ALLOCATED", "UNQUANTIFIED", "UNRESOLVED_SOURCE"]),
        "financial_source_attribution_control.status",
      );
      parseInteger(
        requireProperty(
          row,
          "causal_link_count",
          "financial_source_attribution_control",
        ),
        "financial_source_attribution_control.causal_link_count",
      );
      const unquantified = parseInteger(
        requireProperty(
          row,
          "unquantified_causal_link_count",
          "financial_source_attribution_control",
        ),
        "financial_source_attribution_control.unquantified_causal_link_count",
      );
      if (status !== "OK" || unquantified !== 0) {
        throw new TypeError("Le contrôle causal canonique n'est pas réconcilié.");
      }
    }),
  );
}
