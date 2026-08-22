import Big from "big.js";
import type { DecimalString, Money } from "./types";

const decimalPattern = /^-?\d+(?:\.\d+)?$/;

function moneyFromBig(value: Big): Money {
  return value.toFixed() as Money;
}

export function parseDecimalString(value: unknown): DecimalString {
  if (typeof value !== "string" || !decimalPattern.test(value)) {
    throw new TypeError(
      "DecimalString doit être une chaîne décimale base 10.",
    );
  }

  try {
    return new Big(value).toFixed() as DecimalString;
  } catch {
    throw new TypeError("DecimalString doit être une chaîne décimale valide.");
  }
}

export function parseMoney(value: unknown): Money {
  return parseDecimalString(value) as Money;
}

export function serializeMoney(value: Money): string {
  return value;
}

export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  const comparison = new Big(a).cmp(b);
  return comparison < 0 ? -1 : comparison > 0 ? 1 : 0;
}

export function addMoney(a: Money, b: Money): Money {
  return moneyFromBig(new Big(a).plus(b));
}

export function subtractMoney(a: Money, b: Money): Money {
  return moneyFromBig(new Big(a).minus(b));
}

export function averageMoney(a: Money, b: Money): Money {
  return moneyFromBig(new Big(a).plus(b).div(2));
}

export function isZeroMoney(value: Money): boolean {
  return new Big(value).eq("0");
}
