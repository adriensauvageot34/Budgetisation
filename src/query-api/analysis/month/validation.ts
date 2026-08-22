import {
  getMetricRegistryEntry,
  isActiveMetricId,
} from "../../../analytics/production";
import { compareYearMonth, parseYearMonth } from "../../../core/time";
import {
  hasOwn,
  parseStrictRecord,
  requireProperty,
} from "../../../core/validation";
import { parseQueryCapabilities } from "../../capabilities";
import { queryResourceKeys } from "../../request";
import {
  parsePeriodCompleteness,
  parseReadModelSubject,
  parseScopedMoneyMetricReadModel,
} from "../../read-models";
import {
  parseAnalysisBreakdownReadModel,
  parseAnalysisContextsBase,
  parseAnalysisSeriesPoints,
  parseAnalysisStructureReadModel,
  parseMoneyComparisonResult,
} from "../shared/validation";
import type {
  AnalysisMonthBreakdownReadModel,
  AnalysisMonthContextsReadModel,
  AnalysisMonthEvolutionReadModel,
  AnalysisMonthInitialReadModel,
} from "./types";

export function parseAnalysisMonthInitialReadModel(
  value: unknown,
): AnalysisMonthInitialReadModel {
  const record = parseStrictRecord(
    value,
    [
      "month",
      "subject",
      "periodCompleteness",
      "actual",
      "typical",
      "actualVsTypical",
      "structure",
      "capabilities",
    ],
    "AnalysisMonthInitialReadModel",
  );
  const actual = parseScopedMoneyMetricReadModel(
    requireProperty(record, "actual", "AnalysisMonthInitialReadModel"),
  );
  if (actual.metricId !== "economic_consumption_net_attributable") {
    throw new TypeError("Analysis Month actual doit réutiliser le KPI principal.");
  }
  const typical = hasOwn(record, "typical")
    ? parseScopedMoneyMetricReadModel(record.typical)
    : undefined;
  if (typical !== undefined && typical.metricId !== "typical_month_cost") {
    throw new TypeError("Analysis Month typical doit venir de Typical Month.");
  }
  const actualVsTypical = hasOwn(record, "actualVsTypical")
    ? parseMoneyComparisonResult(record.actualVsTypical)
    : undefined;
  if (actualVsTypical !== undefined) {
    if (
      typical === undefined ||
      actualVsTypical.target.metricId !== actual.metricId ||
      actualVsTypical.reference.metricId !== typical.metricId ||
      JSON.stringify(actualVsTypical.target.envelope) !==
        JSON.stringify(actual.envelope) ||
      JSON.stringify(actualVsTypical.reference.envelope) !==
        JSON.stringify(typical.envelope)
    ) {
      throw new TypeError("actualVsTypical doit être le résultat Analytics exact.");
    }
  }
  const structure = parseAnalysisStructureReadModel(
    requireProperty(record, "structure", "AnalysisMonthInitialReadModel"),
  );
  if (structure.axes.some(({ metric }) => metric.scopeHash !== actual.scopeHash)) {
    throw new TypeError("Analysis Month structure doit partager le scope du Réel.");
  }
  const capabilities = parseQueryCapabilities(
    requireProperty(record, "capabilities", "AnalysisMonthInitialReadModel"),
    queryResourceKeys.analysisMonthInitial,
  );
  if (
    !capabilities.availableMeasures.includes(
      "economic_consumption_net_attributable",
    ) ||
    (typical !== undefined &&
      !capabilities.availableMeasures.includes("typical_month_cost"))
  ) {
    throw new TypeError("Analysis Month fields dépassent les capabilities.");
  }
  return {
    month: parseYearMonth(
      requireProperty(record, "month", "AnalysisMonthInitialReadModel"),
    ),
    subject: parseReadModelSubject(
      requireProperty(record, "subject", "AnalysisMonthInitialReadModel"),
    ),
    periodCompleteness: parsePeriodCompleteness(
      requireProperty(
        record,
        "periodCompleteness",
        "AnalysisMonthInitialReadModel",
      ),
    ),
    actual,
    ...(typical === undefined ? {} : { typical }),
    ...(actualVsTypical === undefined ? {} : { actualVsTypical }),
    structure,
    capabilities,
  };
}

export function parseAnalysisMonthBreakdownReadModel(
  value: unknown,
): AnalysisMonthBreakdownReadModel {
  const record = parseStrictRecord(
    value,
    ["month", "subject", "breakdown"],
    "AnalysisMonthBreakdownReadModel",
  );
  const breakdown = parseAnalysisBreakdownReadModel(
    requireProperty(record, "breakdown", "AnalysisMonthBreakdownReadModel"),
    queryResourceKeys.analysisMonthBreakdown,
  );
  if (!breakdown.capabilities.availableMeasures.includes(breakdown.measure)) {
    throw new TypeError("Breakdown measure doit être disponible.");
  }
  return {
    month: parseYearMonth(
      requireProperty(record, "month", "AnalysisMonthBreakdownReadModel"),
    ),
    subject: parseReadModelSubject(
      requireProperty(record, "subject", "AnalysisMonthBreakdownReadModel"),
    ),
    breakdown,
  };
}

export function parseAnalysisMonthEvolutionReadModel(
  value: unknown,
): AnalysisMonthEvolutionReadModel {
  const record = parseStrictRecord(
    value,
    ["month", "subject", "metricId", "points", "capabilities"],
    "AnalysisMonthEvolutionReadModel",
  );
  const month = parseYearMonth(
    requireProperty(record, "month", "AnalysisMonthEvolutionReadModel"),
  );
  const metricId = requireProperty(
    record,
    "metricId",
    "AnalysisMonthEvolutionReadModel",
  );
  if (!isActiveMetricId(metricId)) {
    throw new TypeError("Analysis evolution MetricId doit être actif.");
  }
  if (!getMetricRegistryEntry(metricId).allowedTimeKinds.includes("month")) {
    throw new TypeError("MetricId n'est pas compatible avec une série mensuelle.");
  }
  const points = parseAnalysisSeriesPoints(
    requireProperty(record, "points", "AnalysisMonthEvolutionReadModel"),
    metricId,
  );
  if (
    points.some(({ period }) => compareYearMonth(period, month) > 0)
  ) {
    throw new TypeError("Analysis Month evolution ne contient aucun mois futur.");
  }
  const capabilities = parseQueryCapabilities(
    requireProperty(record, "capabilities", "AnalysisMonthEvolutionReadModel"),
    queryResourceKeys.analysisMonthEvolution,
  );
  if (!capabilities.availableMeasures.includes(metricId)) {
    throw new TypeError("Evolution MetricId doit être disponible.");
  }
  return {
    month,
    subject: parseReadModelSubject(
      requireProperty(record, "subject", "AnalysisMonthEvolutionReadModel"),
    ),
    metricId,
    points,
    capabilities,
  };
}

export function parseAnalysisMonthContextsReadModel(
  value: unknown,
): AnalysisMonthContextsReadModel {
  const record = parseStrictRecord(
    value,
    ["month", "subject", "contexts"],
    "AnalysisMonthContextsReadModel",
  );
  return {
    month: parseYearMonth(
      requireProperty(record, "month", "AnalysisMonthContextsReadModel"),
    ),
    subject: parseReadModelSubject(
      requireProperty(record, "subject", "AnalysisMonthContextsReadModel"),
    ),
    contexts: parseAnalysisContextsBase(
      requireProperty(record, "contexts", "AnalysisMonthContextsReadModel"),
      queryResourceKeys.analysisMonthContexts,
    ),
  };
}
