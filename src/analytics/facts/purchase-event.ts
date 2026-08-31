import { parseLocalDate, parseYearMonth, yearMonthOf } from "../../core/time";
import type { PurchaseEventTiming } from "./types";

export type PurchaseEventTimingAssertion = {
  readonly authority: Exclude<PurchaseEventTiming["authority"], null>;
  readonly precision: "DAY" | "MONTH";
  readonly economicDate: string | null;
  readonly economicMonth: string;
  readonly evidenceRefs: readonly string[];
};

const authorityRank = {
  EXPLICIT_EVENT: 1,
  EXPLICIT_CONSUMPTION_SOURCE: 2,
  TRUSTED_PURCHASE_SOURCE: 3,
  ECONOMIC_MONTH: 4,
} as const;

export function resolvePurchaseEventTiming(
  assertions: readonly PurchaseEventTimingAssertion[],
): PurchaseEventTiming {
  if (assertions.length === 0) {
    return {
      status: "UNKNOWN",
      precision: "NONE",
      economicDate: null,
      economicMonth: null,
      authority: null,
      evidenceRefs: [],
    };
  }
  const bestRank = Math.min(...assertions.map(({ authority }) => authorityRank[authority]));
  const selected = assertions.filter(({ authority }) => authorityRank[authority] === bestRank);
  const authority = selected[0].authority;
  const evidenceRefs = [...new Set(selected.flatMap(({ evidenceRefs: refs }) => refs))].sort();
  const dayValues = [...new Set(selected.flatMap(({ economicDate }) =>
    economicDate === null ? [] : [parseLocalDate(economicDate)]))].sort();
  const monthValues = [...new Set(selected.map(({ economicMonth }) =>
    parseYearMonth(economicMonth.slice(0, 7))))].sort();

  if (dayValues.length === 1) {
    return {
      status: "KNOWN",
      precision: "DAY",
      economicDate: dayValues[0],
      economicMonth: yearMonthOf(dayValues[0]),
      authority,
      evidenceRefs,
    };
  }
  if (dayValues.length > 1) {
    return {
      status: "CONFLICT",
      precision: monthValues.length === 1 ? "MONTH" : "NONE",
      economicDate: null,
      economicMonth: monthValues.length === 1 ? monthValues[0] : null,
      authority,
      evidenceRefs,
    };
  }
  if (monthValues.length === 1) {
    return {
      status: "PARTIAL",
      precision: "MONTH",
      economicDate: null,
      economicMonth: monthValues[0],
      authority,
      evidenceRefs,
    };
  }
  return {
    status: "CONFLICT",
    precision: "NONE",
    economicDate: null,
    economicMonth: null,
    authority,
    evidenceRefs,
  };
}
