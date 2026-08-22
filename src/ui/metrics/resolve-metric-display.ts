import type { MetricUnit } from "../../core/money";
import type { MetricEnvelope } from "../../core/metrics";
import { formatCoveredShare, formatMetricValue, metricUnitText } from "./metric-format";
import {
  metricQualifierAccessibleLabels,
} from "./metric-presentation";
import type {
  MetricDisplayQualifier,
  MetricDisplayValue,
  ResolveMetricDisplayOptions,
  ResolvedMetricDisplay,
} from "./metric-display.types";

function resolveQualifiers<T extends MetricDisplayValue, U extends MetricUnit>(
  metric: MetricEnvelope<T, U>,
  mode: "essential" | "full",
): readonly MetricDisplayQualifier[] {
  const qualifiers: MetricDisplayQualifier[] = [];
  if (metric.coverage?.level === "partial") qualifiers.push("partial");
  if (metric.support?.level === "limited") qualifiers.push("limited_support");
  if (metric.support?.level === "insufficient") {
    qualifiers.push("insufficient_support");
  }
  if (metric.provenance === "derived" && mode === "full") {
    qualifiers.push("derived");
  }
  if (metric.provenance === "estimated") qualifiers.push("estimated");
  return qualifiers;
}

function preservedSemantics<T extends MetricDisplayValue, U extends MetricUnit>(
  metric: MetricEnvelope<T, U>,
) {
  return {
    availability: metric.availability,
    unit: metric.unit,
    provenance: metric.provenance,
    ...(metric.coverage === undefined ? {} : { coverage: metric.coverage }),
    ...(metric.support === undefined ? {} : { support: metric.support }),
    ...(metric.reference === undefined ? {} : { reference: metric.reference }),
  };
}

export function resolveMetricDisplay<
  T extends MetricDisplayValue,
  U extends MetricUnit,
>(
  metric: MetricEnvelope<T, U>,
  options: ResolveMetricDisplayOptions = {},
): ResolvedMetricDisplay<U> {
  const variant = options.variant ?? "standard";
  const qualifierMode = options.qualifierMode ?? "essential";
  const qualifiers = resolveQualifiers(metric, qualifierMode);
  const unitText = metricUnitText(metric.unit);
  const coverageDetailText =
    qualifierMode === "full" &&
    metric.coverage?.level === "partial" &&
    metric.coverage.coveredShare !== undefined
      ? `Couverture : ${formatCoveredShare(metric.coverage.coveredShare)}`
      : null;
  const semantics = preservedSemantics(metric);

  if (metric.availability === "not_applicable") {
    return {
      ...semantics,
      state: "not_applicable",
      variant,
      primaryText: null,
      unitText,
      qualifiers: [],
      coverageDetailText: null,
      accessibleText: null,
    };
  }

  if (metric.availability === "conflict") {
    return {
      ...semantics,
      state: "conflict",
      variant,
      primaryText: "À vérifier",
      unitText,
      qualifiers: [],
      coverageDetailText: null,
      accessibleText: "Valeur en conflit, à vérifier",
    };
  }

  if (metric.availability === "unknown") {
    const presentation =
      options.unknownPresentation ??
      (metric.provenance === "estimated" ? "not_estimated" : "unavailable");
    const notEstimated = presentation === "not_estimated";
    return {
      ...semantics,
      state: "unknown",
      variant,
      primaryText: notEstimated ? "Non estimé" : "Non disponible",
      unitText,
      qualifiers: [],
      coverageDetailText: null,
      accessibleText: notEstimated
        ? "Valeur non estimée"
        : "Valeur non disponible",
    };
  }

  if (metric.value === null) {
    throw new TypeError("MetricEnvelope known exige une valeur non nulle.");
  }
  const formatted = formatMetricValue(
    metric.value,
    metric.unit,
    options.precision,
    options.signed,
  );
  const accessibleQualifiers = qualifiers.map(
    (qualifier) => metricQualifierAccessibleLabels[qualifier],
  );

  return {
    ...semantics,
    state: "value",
    variant,
    primaryText: formatted.primaryText,
    unitText: formatted.unitText,
    qualifiers,
    coverageDetailText,
    accessibleText: [formatted.accessibleValueText, ...accessibleQualifiers].join(", "),
  };
}
