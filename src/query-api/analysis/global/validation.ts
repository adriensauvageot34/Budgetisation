import {
  getMetricRegistryEntry,
  isActiveMetricId,
} from "../../../analytics/production";
import {
  parseGlobalWindow,
  parseYearMonth,
  resolveGlobalWindowMonths,
} from "../../../core/time";
import {
  hasOwn,
  parseStrictRecord,
  requireProperty,
} from "../../../core/validation";
import { parseQueryCapabilities } from "../../capabilities";
import { queryResourceKeys } from "../../request";
import {
  parseCountEnvelope,
  parseReadModelSubject,
  parseScopedMoneyMetricReadModel,
} from "../../read-models";
import {
  parseAnalysisBreakdownReadModel,
  parseAnalysisContextsBase,
  parseAnalysisSeriesPoints,
  parseAnalysisStructureReadModel,
} from "../shared/validation";
import type {
  AnalysisGlobalBreakdownReadModel,
  AnalysisGlobalContextsReadModel,
  AnalysisGlobalEvolutionReadModel,
  AnalysisGlobalInitialReadModel,
} from "./types";

export function parseAnalysisGlobalInitialReadModel(
  value: unknown,
): AnalysisGlobalInitialReadModel {
  const record = parseStrictRecord(
    value,
    [
      "observationWindow",
      "asOf",
      "subject",
      "observedPeriodCount",
      "monthlyTypical",
      "structure",
      "capabilities",
    ],
    "AnalysisGlobalInitialReadModel",
  );
  const asOf = parseYearMonth(
    requireProperty(record, "asOf", "AnalysisGlobalInitialReadModel"),
  );
  const monthlyTypical = hasOwn(record, "monthlyTypical")
    ? parseScopedMoneyMetricReadModel(record.monthlyTypical)
    : undefined;
  if (monthlyTypical !== undefined) {
    if (
      monthlyTypical.metricId !== "typical_month_cost" ||
      monthlyTypical.envelope.reference?.family !== "current" ||
      monthlyTypical.envelope.reference.asOf !== asOf
    ) {
      throw new TypeError(
        "Global monthlyTypical doit rester un Typical Month courant autoritaire.",
      );
    }
  }
  const capabilities = parseQueryCapabilities(
    requireProperty(record, "capabilities", "AnalysisGlobalInitialReadModel"),
    queryResourceKeys.analysisGlobalInitial,
  );
  if (
    monthlyTypical !== undefined &&
    !capabilities.availableMeasures.includes("typical_month_cost")
  ) {
    throw new TypeError("Global monthlyTypical dépasse les capabilities.");
  }
  return {
    observationWindow: parseGlobalWindow(
      requireProperty(
        record,
        "observationWindow",
        "AnalysisGlobalInitialReadModel",
      ),
    ),
    asOf,
    subject: parseReadModelSubject(
      requireProperty(record, "subject", "AnalysisGlobalInitialReadModel"),
    ),
    observedPeriodCount: parseCountEnvelope(
      requireProperty(
        record,
        "observedPeriodCount",
        "AnalysisGlobalInitialReadModel",
      ),
    ),
    ...(monthlyTypical === undefined ? {} : { monthlyTypical }),
    structure: parseAnalysisStructureReadModel(
      requireProperty(record, "structure", "AnalysisGlobalInitialReadModel"),
    ),
    capabilities,
  };
}

export function parseAnalysisGlobalBreakdownReadModel(
  value: unknown,
): AnalysisGlobalBreakdownReadModel {
  const record = parseStrictRecord(
    value,
    ["observationWindow", "asOf", "subject", "breakdown"],
    "AnalysisGlobalBreakdownReadModel",
  );
  const breakdown = parseAnalysisBreakdownReadModel(
    requireProperty(record, "breakdown", "AnalysisGlobalBreakdownReadModel"),
    queryResourceKeys.analysisGlobalBreakdown,
  );
  if (
    !getMetricRegistryEntry(breakdown.measure).allowedTimeKinds.includes(
      "global",
    ) ||
    !breakdown.capabilities.availableMeasures.includes(breakdown.measure)
  ) {
    throw new TypeError("Global breakdown measure est incompatible.");
  }
  return {
    observationWindow: parseGlobalWindow(
      requireProperty(
        record,
        "observationWindow",
        "AnalysisGlobalBreakdownReadModel",
      ),
    ),
    asOf: parseYearMonth(
      requireProperty(record, "asOf", "AnalysisGlobalBreakdownReadModel"),
    ),
    subject: parseReadModelSubject(
      requireProperty(record, "subject", "AnalysisGlobalBreakdownReadModel"),
    ),
    breakdown,
  };
}

export function parseAnalysisGlobalEvolutionReadModel(
  value: unknown,
): AnalysisGlobalEvolutionReadModel {
  const record = parseStrictRecord(
    value,
    [
      "observationWindow",
      "asOf",
      "subject",
      "metricId",
      "points",
      "capabilities",
    ],
    "AnalysisGlobalEvolutionReadModel",
  );
  const observationWindow = parseGlobalWindow(
    requireProperty(
      record,
      "observationWindow",
      "AnalysisGlobalEvolutionReadModel",
    ),
  );
  const asOf = parseYearMonth(
    requireProperty(record, "asOf", "AnalysisGlobalEvolutionReadModel"),
  );
  const metricId = requireProperty(
    record,
    "metricId",
    "AnalysisGlobalEvolutionReadModel",
  );
  if (
    !isActiveMetricId(metricId) ||
    !getMetricRegistryEntry(metricId).allowedTimeKinds.includes("month")
  ) {
    throw new TypeError("Global evolution exige une métrique mensuelle active.");
  }
  const points = parseAnalysisSeriesPoints(
    requireProperty(record, "points", "AnalysisGlobalEvolutionReadModel"),
    metricId,
  );
  const allowedPeriods: ReadonlySet<string> = new Set(
    resolveGlobalWindowMonths(observationWindow, asOf),
  );
  if (points.some(({ period }) => !allowedPeriods.has(period))) {
    throw new TypeError("Global evolution contient un point hors GlobalWindow.");
  }
  const capabilities = parseQueryCapabilities(
    requireProperty(record, "capabilities", "AnalysisGlobalEvolutionReadModel"),
    queryResourceKeys.analysisGlobalEvolution,
  );
  if (!capabilities.availableMeasures.includes(metricId)) {
    throw new TypeError("Global evolution MetricId doit être disponible.");
  }
  return {
    observationWindow,
    asOf,
    subject: parseReadModelSubject(
      requireProperty(record, "subject", "AnalysisGlobalEvolutionReadModel"),
    ),
    metricId,
    points,
    capabilities,
  };
}

export function parseAnalysisGlobalContextsReadModel(
  value: unknown,
): AnalysisGlobalContextsReadModel {
  const record = parseStrictRecord(
    value,
    ["observationWindow", "asOf", "subject", "contexts"],
    "AnalysisGlobalContextsReadModel",
  );
  return {
    observationWindow: parseGlobalWindow(
      requireProperty(
        record,
        "observationWindow",
        "AnalysisGlobalContextsReadModel",
      ),
    ),
    asOf: parseYearMonth(
      requireProperty(record, "asOf", "AnalysisGlobalContextsReadModel"),
    ),
    subject: parseReadModelSubject(
      requireProperty(record, "subject", "AnalysisGlobalContextsReadModel"),
    ),
    contexts: parseAnalysisContextsBase(
      requireProperty(record, "contexts", "AnalysisGlobalContextsReadModel"),
      queryResourceKeys.analysisGlobalContexts,
    ),
  };
}
