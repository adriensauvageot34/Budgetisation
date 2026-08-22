import type { MetricDisplayQualifier } from "./metric-display.types";

export const metricQualifierLabels: Readonly<
  Record<MetricDisplayQualifier, string>
> = {
  partial: "Partiel",
  limited_support: "Support limité",
  insufficient_support: "Support insuffisant",
  derived: "Dérivé",
  estimated: "Estimé",
};

export const metricQualifierAccessibleLabels: Readonly<
  Record<MetricDisplayQualifier, string>
> = {
  partial: "couverture partielle",
  limited_support: "support statistique limité",
  insufficient_support: "support statistique insuffisant",
  derived: "valeur dérivée",
  estimated: "valeur estimée",
};
