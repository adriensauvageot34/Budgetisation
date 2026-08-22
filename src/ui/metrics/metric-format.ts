import Big from "big.js";
import {
  isCountMetricUnit,
  isRatioMetricUnit,
  type MetricUnit,
} from "../../core/money";
import type {
  MetricDisplayValue,
  MetricPrecisionPolicy,
} from "./metric-display.types";

const INTEGER_GROUP_SEPARATOR = "\u202f";

export type FormattedMetricValue = {
  readonly primaryText: string;
  readonly unitText: string;
  readonly accessibleValueText: string;
};

function assertFractionDigits(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 12) {
    throw new TypeError("La précision doit être un entier compris entre 0 et 12.");
  }
}

function decimalSource(value: MetricDisplayValue): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Une métrique affichable doit être un nombre fini.");
    }
    return new Big(String(value)).toFixed();
  }
  return value;
}

function trimFraction(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/0+$/, "").replace(/\.$/, "");
}

function applyPrecision(
  source: string,
  policy: MetricPrecisionPolicy,
): string {
  if (policy.kind === "exact") return new Big(source).toFixed();
  if (policy.kind === "fixed") {
    assertFractionDigits(policy.fractionDigits);
    return new Big(source).toFixed(policy.fractionDigits, Big.roundHalfUp);
  }
  const maximumFractionDigits = policy.maximumFractionDigits ?? 1;
  assertFractionDigits(maximumFractionDigits);
  return trimFraction(
    new Big(source).toFixed(maximumFractionDigits, Big.roundHalfUp),
  );
}

function formatFrenchDecimal(value: string): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer, fraction] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, INTEGER_GROUP_SEPARATOR);
  return `${negative ? "-" : ""}${grouped}${fraction ? `,${fraction}` : ""}`;
}

function defaultPrecision(unit: MetricUnit): MetricPrecisionPolicy {
  if (isCountMetricUnit(unit)) return { kind: "fixed", fractionDigits: 0 };
  if (isRatioMetricUnit(unit)) return { kind: "human", maximumFractionDigits: 1 };
  return { kind: "human", maximumFractionDigits: 2 };
}

export function metricUnitText(unit: MetricUnit): string {
  switch (unit) {
    case "EUR":
      return "€";
    case "EUR/day":
      return "€ / jour";
    case "EUR/week":
      return "€ / semaine";
    case "EUR/month":
      return "€ / mois";
    case "EUR/occurrence":
      return "€ / occurrence";
    case "count":
      return "";
    case "count/month":
      return "/ mois";
    case "ratio":
      return "%";
  }
}

function accessibleUnitText(unit: MetricUnit, decimal: string): string {
  const singular = new Big(decimal).abs().eq(1);
  switch (unit) {
    case "EUR":
      return singular ? "euro" : "euros";
    case "EUR/day":
      return `${singular ? "euro" : "euros"} par jour`;
    case "EUR/week":
      return `${singular ? "euro" : "euros"} par semaine`;
    case "EUR/month":
      return `${singular ? "euro" : "euros"} par mois`;
    case "EUR/occurrence":
      return `${singular ? "euro" : "euros"} par occurrence`;
    case "count":
      return singular ? "élément" : "éléments";
    case "count/month":
      return `${singular ? "élément" : "éléments"} par mois`;
    case "ratio":
      return "pour cent";
  }
}

export function formatMetricValue(
  value: MetricDisplayValue,
  unit: MetricUnit,
  policy: MetricPrecisionPolicy = defaultPrecision(unit),
  signed = false,
): FormattedMetricValue {
  const rawSource = decimalSource(value);
  const displaySource = isRatioMetricUnit(unit)
    ? new Big(rawSource).times(100).toFixed()
    : rawSource;
  const precise = applyPrecision(displaySource, policy);
  const positivePrefix = signed && new Big(precise).gt(0) ? "+" : "";
  const formattedNumber = `${positivePrefix}${formatFrenchDecimal(precise)}`;
  const unitText = metricUnitText(unit);
  const primaryText = unitText
    ? `${formattedNumber}${unitText === "%" ? "" : " "}${unitText}`
    : formattedNumber;
  const accessibleNumber = formattedNumber.replaceAll(INTEGER_GROUP_SEPARATOR, " ");
  const accessibleUnit = accessibleUnitText(unit, precise);

  return {
    primaryText,
    unitText,
    accessibleValueText: `${accessibleNumber} ${accessibleUnit}`,
  };
}

export function formatCoveredShare(coveredShare: number): string {
  if (
    !Number.isFinite(coveredShare) ||
    coveredShare < 0 ||
    coveredShare > 1
  ) {
    throw new TypeError("coveredShare doit être compris entre 0 et 1.");
  }
  const percentage = new Big(String(coveredShare)).times(100).toFixed(1);
  return `${formatFrenchDecimal(trimFraction(percentage))} %`;
}
