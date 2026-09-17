import Big from "big.js";

import { compareMoney, parseMoney, type Money } from "../../core/money";

const sortedMoney = (values: readonly Money[]) => [...values].sort((left, right) => compareMoney(left, right));
const midpoint = (left: Money, right: Money) => parseMoney(new Big(left).plus(right).div(2).toFixed());

/** Exact historical M6 median definition, reused without changing the frozen M6 owner. */
export function medianMoney(values: readonly Money[]): Money | undefined {
  if (values.length === 0) return undefined;
  const sorted = sortedMoney(values);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : midpoint(sorted[middle - 1], sorted[middle]);
}

/** Exact historical M6 Tukey-hinges convention. */
export function moneyQuartiles(values: readonly Money[]): Readonly<{ q1?: Money; q3?: Money }> {
  const sorted = sortedMoney(values);
  if (sorted.length === 0) return {};
  const middle = Math.floor(sorted.length / 2);
  const lower = sorted.slice(0, middle);
  const upper = sorted.slice(sorted.length % 2 === 1 ? middle + 1 : middle);
  return {
    q1: medianMoney(lower.length === 0 ? sorted : lower),
    q3: medianMoney(upper.length === 0 ? sorted : upper),
  };
}

/** Exact historical M6 median absolute deviation definition. */
export function moneyMedianAbsoluteDeviation(values: readonly Money[], median: Money): Money | undefined {
  return medianMoney(values.map((value) => parseMoney(new Big(value).minus(median).abs().toFixed())));
}
