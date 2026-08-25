import type { Money } from "../../core/money";
import { yearMonthOf, type LocalDate, type YearMonth } from "../../core/time";
import type {
  CanonicalComponentKey,
  EconomicTiming,
  EconomicTimingSegment,
} from "./types";

export type HistoricalEconomicTimingSource =
  | "explicit_economic_segment"
  | "forced_analytic_month"
  | "real_transaction_date"
  | "bank_date_fallback"
  | "unresolved";

export type HistoricalEconomicTimingResolution = {
  readonly timing: EconomicTiming;
  readonly source: HistoricalEconomicTimingSource;
  readonly exactDayKnown: boolean;
};

export type HistoricalEconomicTimingInput = {
  readonly explicitTiming: EconomicTiming;
  readonly canonicalComponentKey: CanonicalComponentKey;
  readonly canonicalEconomicNet: Money;
  readonly forcedAnalyticMonth: YearMonth | null;
  readonly realTransactionDate: LocalDate | null;
  readonly realTransactionDateReliable: boolean;
  readonly bankDate: LocalDate | null;
};

function inferredSegment(
  input: HistoricalEconomicTimingInput,
  source: Exclude<HistoricalEconomicTimingSource, "explicit_economic_segment" | "unresolved">,
  economicMonth: YearMonth,
  exactDate: LocalDate | null,
): EconomicTimingSegment {
  return {
    segmentKey: `${input.canonicalComponentKey}:${source}` as EconomicTimingSegment["segmentKey"],
    timingState: "known",
    periodStart: exactDate,
    periodEnd: exactDate,
    economicMonth,
    amount: input.canonicalEconomicNet,
  };
}

/** Central authority for historical economic timing. */
export function resolveHistoricalEconomicTiming(
  input: HistoricalEconomicTimingInput,
): HistoricalEconomicTimingResolution {
  if (input.explicitTiming.kind !== "unknown") {
    return {
      timing: input.explicitTiming,
      source: "explicit_economic_segment",
      exactDayKnown:
        input.explicitTiming.kind !== "conflict" &&
        input.explicitTiming.segments.every(
          ({ timingState, periodStart, periodEnd }) =>
            timingState === "known" &&
            periodStart !== null &&
            periodStart === periodEnd,
        ),
    };
  }

  if (input.forcedAnalyticMonth !== null) {
    const exactDate =
      input.realTransactionDateReliable &&
      input.realTransactionDate !== null &&
      yearMonthOf(input.realTransactionDate) === input.forcedAnalyticMonth
        ? input.realTransactionDate
        : null;
    return {
      timing: {
        kind: "known",
        segments: [
          inferredSegment(input, "forced_analytic_month", input.forcedAnalyticMonth, exactDate),
        ],
      },
      source: "forced_analytic_month",
      exactDayKnown: exactDate !== null,
    };
  }

  if (input.realTransactionDateReliable && input.realTransactionDate !== null) {
    return {
      timing: {
        kind: "known",
        segments: [
          inferredSegment(
            input,
            "real_transaction_date",
            yearMonthOf(input.realTransactionDate),
            input.realTransactionDate,
          ),
        ],
      },
      source: "real_transaction_date",
      exactDayKnown: true,
    };
  }

  if (input.bankDate !== null) {
    return {
      timing: {
        kind: "known",
        segments: [
          inferredSegment(input, "bank_date_fallback", yearMonthOf(input.bankDate), input.bankDate),
        ],
      },
      source: "bank_date_fallback",
      exactDayKnown: true,
    };
  }

  return {
    timing: { kind: "unknown" },
    source: "unresolved",
    exactDayKnown: false,
  };
}
