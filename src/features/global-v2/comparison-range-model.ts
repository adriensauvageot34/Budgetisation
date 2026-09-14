import type { GlobalTypedMeasure } from "@/query-api/global-v2";

const DISPLAY_PADDING_PERCENT = 7;

export type ComparisonRangeInput = {
  readonly observed: GlobalTypedMeasure;
  readonly median: GlobalTypedMeasure;
  readonly lower?: GlobalTypedMeasure | undefined;
  readonly upper?: GlobalTypedMeasure | undefined;
  readonly supportCount?: GlobalTypedMeasure | undefined;
  readonly subjectLabel?: string | undefined;
  readonly comparisonLabel?: string | undefined;
};

export type ComparisonRangeModel = {
  readonly mode: "Q1_Q3" | "MEDIAN_ONLY";
  readonly observed: number;
  readonly median: number;
  readonly lower?: number;
  readonly upper?: number;
  readonly supportCount?: number;
  readonly observedPosition: number;
  readonly medianPosition: number;
  readonly lowerPosition?: number;
  readonly upperPosition?: number;
  readonly accessibleLabel: string;
};

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function monetaryValue(measure: GlobalTypedMeasure | undefined, expectedUnit?: string): number | undefined {
  if (measure?.kind !== "MONEY" || measure.value.trim().length === 0 || expectedUnit !== undefined && measure.unit !== expectedUnit) return undefined;
  const value = Number(measure.value);
  return Number.isFinite(value) ? value : undefined;
}

function countValue(measure: GlobalTypedMeasure | undefined): number | undefined {
  if (measure?.kind !== "COUNT" || measure.value.trim().length === 0) return undefined;
  const value = Number(measure.value);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function displayPosition(value: number, minimum: number, maximum: number): number {
  if (minimum === maximum) return 50;
  const usableWidth = 100 - DISPLAY_PADDING_PERCENT * 2;
  return DISPLAY_PADDING_PERCENT + (value - minimum) / (maximum - minimum) * usableWidth;
}

export function buildComparisonRangeModel(input: ComparisonRangeInput): ComparisonRangeModel | undefined {
  if (input.observed.unit !== "EUR") return undefined;
  const observed = monetaryValue(input.observed);
  const median = monetaryValue(input.median, input.observed.unit);
  if (observed === undefined || median === undefined) return undefined;

  const candidateLower = monetaryValue(input.lower, input.observed.unit);
  const candidateUpper = monetaryValue(input.upper, input.observed.unit);
  const hasReferenceRange = candidateLower !== undefined && candidateUpper !== undefined && candidateLower <= candidateUpper;
  const lower = hasReferenceRange ? candidateLower : undefined;
  const upper = hasReferenceRange ? candidateUpper : undefined;
  const supportCount = countValue(input.supportCount);
  const domainValues = lower === undefined || upper === undefined ? [observed, median] : [observed, median, lower, upper];
  const minimum = Math.min(...domainValues);
  const maximum = Math.max(...domainValues);
  const subjectLabel = input.subjectLabel?.trim() || "Ce moment";
  const comparisonLabel = input.comparisonLabel?.trim() || "moments comparables";
  const supportCopy = supportCount === undefined ? "" : ` parmi ${integerFormatter.format(supportCount)} ${comparisonLabel}`;
  const rangeCopy = lower === undefined || upper === undefined
    ? ""
    : ` La plage de référence va de ${moneyFormatter.format(lower)} à ${moneyFormatter.format(upper)}.`;

  return {
    mode: lower === undefined || upper === undefined ? "MEDIAN_ONLY" : "Q1_Q3",
    observed,
    median,
    ...(lower === undefined || upper === undefined ? {} : { lower, upper }),
    ...(supportCount === undefined ? {} : { supportCount }),
    observedPosition: displayPosition(observed, minimum, maximum),
    medianPosition: displayPosition(median, minimum, maximum),
    ...(lower === undefined || upper === undefined ? {} : {
      lowerPosition: displayPosition(lower, minimum, maximum),
      upperPosition: displayPosition(upper, minimum, maximum),
    }),
    accessibleLabel: `${subjectLabel} : ${moneyFormatter.format(observed)}, contre une médiane de ${moneyFormatter.format(median)}${supportCopy}.${rangeCopy}`,
  };
}
