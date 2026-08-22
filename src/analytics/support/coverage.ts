import { parseCoverage, type Coverage } from "../../core/metrics";

export function coverageFromExplicitRatio(input: {
  readonly numerator: number;
  readonly denominator: number;
}): Coverage {
  if (
    !Number.isFinite(input.numerator) ||
    !Number.isFinite(input.denominator) ||
    input.numerator < 0 ||
    input.denominator <= 0 ||
    input.numerator > input.denominator
  ) {
    throw new TypeError(
      "Coverage exige 0 <= numerator <= denominator avec denominator > 0.",
    );
  }
  if (input.numerator === input.denominator) {
    return parseCoverage({ level: "complete" });
  }
  return parseCoverage({
    level: "partial",
    coveredShare: input.numerator / input.denominator,
  });
}

export function receiveCoverage(value: unknown): Coverage {
  return parseCoverage(value);
}
