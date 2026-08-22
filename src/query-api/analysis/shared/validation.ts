import {
  COMPARISON_METHOD_VERSION,
  type ComparableMetric,
  type ComparisonDelta,
  type ComparisonQualification,
  type ComparisonReason,
  type ComparisonRelation,
  type ComparisonSemantic,
  type MoneyComparisonResult,
} from "../../../analytics/comparisons";
import {
  getContextCapability,
  isContextCapabilityId,
} from "../../../analytics/context";
import {
  getMetricRegistryEntry,
  isActiveMetricId,
  type ActiveMetricId,
} from "../../../analytics/production";
import {
  isZeroMoney,
  parseDecimalString,
  parseMoney,
  type Money,
} from "../../../core/money";
import {
  createMetricEnvelopeParser,
  parseAvailability,
  parseSupport,
  type MetricEnvelope,
} from "../../../core/metrics";
import { compareYearMonth, parseYearMonth } from "../../../core/time";
import {
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../../../core/validation";
import { parseMethodVersion } from "../../../core/versions";
import { parseQueryCapabilities } from "../../capabilities";
import {
  analysisMeasuresByDimension,
  type AnalysisBreakdownDimension,
  type QueryResourceKey,
} from "../../request";
import {
  parsePeriodCompleteness,
  parseScopedMetricReadModel,
  parseScopedMoneyMetricReadModel,
} from "../../read-models";
import type {
  AnalysisBreakdownFlag,
  AnalysisBreakdownReadModel,
  AnalysisBreakdownRow,
  AnalysisContextRow,
  AnalysisContextSection,
  AnalysisContextsReadModelBase,
  AnalysisReconciliation,
  AnalysisSeriesPoint,
  AnalysisStructureAxis,
  AnalysisStructureReadModel,
  BreakdownBucketIdentity,
} from "./types";

const comparisonRelations: ReadonlySet<string> = new Set<ComparisonRelation>([
  "above",
  "equal",
  "below",
  "not_comparable",
]);
const comparisonReasons: ReadonlySet<string> = new Set<ComparisonReason>([
  "target_unavailable",
  "reference_unavailable",
  "unit_mismatch",
  "scope_mismatch",
  "incompatible_reference",
  "relative_denominator_zero",
  "relative_not_supported",
  "method_blocked",
]);
const comparisonSemantics: ReadonlySet<string> = new Set<ComparisonSemantic>([
  "actual",
  "typical_month",
  "minimal",
  "adjusted_minimal",
  "context",
  "context_reference",
  "activity_frequency",
  "habitual_activity_frequency",
  "ticket",
  "habitual_ticket",
]);
const qualifications: ReadonlySet<string> = new Set<ComparisonQualification>([
  "statistically_qualified",
  "descriptive_only",
  "not_assessed",
]);
const reconciliations: ReadonlySet<string> = new Set<AnalysisReconciliation>([
  "exact",
  "partial",
  "not_applicable",
]);
const structureAxes: readonly AnalysisStructureAxis[] = [
  "necessity",
  "fixed_variable",
  "life_scope",
];
const breakdownFlags: readonly AnalysisBreakdownFlag[] = [
  "partial_coverage",
  "conflict",
];
const parseRatioEnvelope = createMetricEnvelopeParser({
  parseValue(value: unknown) {
    const record = parseStrictRecord(
      value,
      ["numerator", "denominator", "decimal"],
      "ExactRatio",
    );
    const numerator = parseDecimalString(
      requireProperty(record, "numerator", "ExactRatio"),
    );
    const denominator = parseDecimalString(
      requireProperty(record, "denominator", "ExactRatio"),
    );
    if (denominator === "0") {
      throw new TypeError("ExactRatio.denominator ne peut pas être nul.");
    }
    const rawDecimal = requireProperty(record, "decimal", "ExactRatio");
    const decimal = rawDecimal === null ? null : parseDecimalString(rawDecimal);
    return { numerator, denominator, decimal };
  },
  allowedUnits: ["ratio"] as const,
});
const parseMoneyDeltaEnvelope = createMetricEnvelopeParser({
  parseValue: parseMoney,
  allowedUnits: [
    "EUR",
    "EUR/day",
    "EUR/week",
    "EUR/month",
    "EUR/occurrence",
  ] as const,
});
const monetaryUnits: ReadonlySet<string> = new Set([
  "EUR",
  "EUR/day",
  "EUR/week",
  "EUR/month",
  "EUR/occurrence",
]);

function parseLabel(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
    throw new TypeError(`${name} doit être une chaîne non vide normalisée.`);
  }
  return value;
}

function parseReconciliation(value: unknown): AnalysisReconciliation {
  return parseStringLiteral<AnalysisReconciliation>(
    value,
    reconciliations,
    "AnalysisReconciliation",
  );
}

function envelopePayload(record: Readonly<Record<string, unknown>>) {
  return {
    availability: record.availability,
    value: record.value,
    unit: record.unit,
    provenance: record.provenance,
    ...(hasOwn(record, "coverage") ? { coverage: record.coverage } : {}),
    ...(hasOwn(record, "support") ? { support: record.support } : {}),
    ...(hasOwn(record, "reference") ? { reference: record.reference } : {}),
    ...(hasOwn(record, "methodVersion")
      ? { methodVersion: record.methodVersion }
      : {}),
  };
}

function parseComparableMoneyMetric(value: unknown): ComparableMetric<Money, import("../../../core/money").MonetaryMetricUnit> {
  const record = parseStrictRecord(
    value,
    ["metricId", "semantic", "scopeHash", "envelope"],
    "ComparableMetric",
  );
  const metric = parseScopedMoneyMetricReadModel({
    metricId: requireProperty(record, "metricId", "ComparableMetric"),
    scopeHash: requireProperty(record, "scopeHash", "ComparableMetric"),
    envelope: requireProperty(record, "envelope", "ComparableMetric"),
  });
  return {
    metricId: metric.metricId,
    semantic: parseStringLiteral<ComparisonSemantic>(
      requireProperty(record, "semantic", "ComparableMetric"),
      comparisonSemantics,
      "ComparisonSemantic",
    ),
    scopeHash: metric.scopeHash,
    envelope: metric.envelope,
  };
}

function parseComparisonDelta(
  value: unknown,
  kind: "money" | "ratio",
): ComparisonDelta<Money, import("../../../core/money").MonetaryMetricUnit> | ComparisonDelta<import("../../../analytics/comparisons").ExactRatio, "ratio"> {
  const candidate = parseStrictRecord(
    value,
    [
      "publishable",
      "availability",
      "value",
      "unit",
      "coverage",
      "support",
      "provenance",
      "reference",
      "methodVersion",
      "reason",
    ],
    "ComparisonDelta",
  );
  const publishable = requireProperty(candidate, "publishable", "ComparisonDelta");
  if (publishable === true) {
    const record = parseStrictRecord(
      value,
      [
        "publishable",
        "availability",
        "value",
        "unit",
        "coverage",
        "support",
        "provenance",
        "reference",
        "methodVersion",
      ],
      "ComparisonDelta.publishable",
    );
    const parsedEnvelope =
      kind === "money"
        ? parseMoneyDeltaEnvelope(envelopePayload(record))
        : parseRatioEnvelope(envelopePayload(record));
    return { publishable, ...parsedEnvelope } as never;
  }
  if (publishable !== false) {
    throw new TypeError("ComparisonDelta.publishable doit être booléen.");
  }
  const record = parseStrictRecord(
    value,
    ["publishable", "availability", "value", "unit", "reason"],
    "ComparisonDelta.blocked",
  );
  const availability = parseAvailability(
    requireProperty(record, "availability", "ComparisonDelta"),
  );
  if (availability === "known" || requireProperty(record, "value", "ComparisonDelta") !== null) {
    throw new TypeError("ComparisonDelta bloqué doit être indisponible et null.");
  }
  const unit = requireProperty(record, "unit", "ComparisonDelta");
  if (
    (kind === "ratio" && unit !== "ratio") ||
    (kind === "money" &&
      (typeof unit !== "string" || !monetaryUnits.has(unit)))
  ) {
    throw new TypeError("ComparisonDelta.unit est invalide.");
  }
  return {
    publishable,
    availability,
    value: null,
    unit,
    reason: parseStringLiteral<ComparisonReason>(
      requireProperty(record, "reason", "ComparisonDelta"),
      comparisonReasons,
      "ComparisonReason",
    ),
  } as never;
}

export function parseMoneyComparisonResult(
  value: unknown,
): MoneyComparisonResult {
  const record = parseStrictRecord(
    value,
    [
      "target",
      "reference",
      "relation",
      "absoluteDelta",
      "relativeDelta",
      "reason",
      "methodVersion",
      "compositeMethodVersion",
      "comparisonSupport",
      "qualification",
    ],
    "MoneyComparisonResult",
  );
  const target = parseComparableMoneyMetric(
    requireProperty(record, "target", "MoneyComparisonResult"),
  );
  const reference = parseComparableMoneyMetric(
    requireProperty(record, "reference", "MoneyComparisonResult"),
  );
  if (
    target.scopeHash !== reference.scopeHash ||
    target.envelope.unit !== reference.envelope.unit
  ) {
    throw new TypeError("Comparison target/reference sont incohérents.");
  }
  const absoluteDelta = parseComparisonDelta(
    requireProperty(record, "absoluteDelta", "MoneyComparisonResult"),
    "money",
  ) as MoneyComparisonResult["absoluteDelta"];
  const relativeDelta = parseComparisonDelta(
    requireProperty(record, "relativeDelta", "MoneyComparisonResult"),
    "ratio",
  ) as MoneyComparisonResult["relativeDelta"];
  if (absoluteDelta.unit !== target.envelope.unit) {
    throw new TypeError("Comparison absolute delta unit est incohérente.");
  }
  if (
    reference.envelope.availability === "known" &&
    isZeroMoney(reference.envelope.value) &&
    (relativeDelta.publishable ||
      relativeDelta.reason !== "relative_denominator_zero")
  ) {
    throw new TypeError("Une référence nulle ne publie jamais un ratio infini.");
  }
  const methodVersion = parseMethodVersion(
    requireProperty(record, "methodVersion", "MoneyComparisonResult"),
  );
  if (methodVersion !== COMPARISON_METHOD_VERSION) {
    throw new TypeError("Comparison MethodVersion est incohérente.");
  }
  const reason = hasOwn(record, "reason")
    ? parseStringLiteral<ComparisonReason>(
        record.reason,
        comparisonReasons,
        "ComparisonReason",
      )
    : undefined;
  const compositeMethodVersion = hasOwn(record, "compositeMethodVersion")
    ? parseMethodVersion(record.compositeMethodVersion)
    : undefined;
  const comparisonSupport = hasOwn(record, "comparisonSupport")
    ? parseSupport(record.comparisonSupport)
    : undefined;
  return {
    target,
    reference,
    relation: parseStringLiteral<ComparisonRelation>(
      requireProperty(record, "relation", "MoneyComparisonResult"),
      comparisonRelations,
      "ComparisonRelation",
    ),
    absoluteDelta,
    relativeDelta,
    ...(reason === undefined ? {} : { reason }),
    methodVersion,
    ...(compositeMethodVersion === undefined
      ? {}
      : { compositeMethodVersion }),
    ...(comparisonSupport === undefined ? {} : { comparisonSupport }),
    qualification: parseStringLiteral<ComparisonQualification>(
      requireProperty(record, "qualification", "MoneyComparisonResult"),
      qualifications,
      "ComparisonQualification",
    ),
  };
}

export {
  parseAnalysisBreakdownReadModel,
  parseAnalysisStructureReadModel,
} from "./breakdown-validation";
export { parseAnalysisSeriesPoints } from "./series-validation";
export { parseAnalysisContextsBase } from "./contexts-validation";

