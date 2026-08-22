import { parseDecimalString, type DecimalString } from "../../core/money";

export type ExactRatio = {
  readonly numerator: DecimalString;
  readonly denominator: DecimalString;
  readonly decimal: DecimalString | null;
};

type Fraction = {
  readonly numerator: bigint;
  readonly denominator: bigint;
};

const BIG_ZERO = BigInt(0);
const BIG_ONE = BigInt(1);
const BIG_TWO = BigInt(2);
const BIG_FIVE = BigInt(5);
const BIG_TEN = BigInt(10);
const BIG_NEGATIVE_ONE = BigInt(-1);

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < BIG_ZERO ? -left : left;
  let b = right < BIG_ZERO ? -right : right;
  while (b !== BIG_ZERO) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function reduceFraction(fraction: Fraction): Fraction {
  if (fraction.denominator === BIG_ZERO) {
    throw new TypeError("Un ratio exact ne peut pas avoir un dénominateur nul.");
  }
  const sign =
    fraction.denominator < BIG_ZERO ? BIG_NEGATIVE_ONE : BIG_ONE;
  const numerator = fraction.numerator * sign;
  const denominator = fraction.denominator * sign;
  if (numerator === BIG_ZERO) {
    return { numerator: BIG_ZERO, denominator: BIG_ONE };
  }
  const divisor = greatestCommonDivisor(numerator, denominator);
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  };
}

function decimalToFraction(value: DecimalString): Fraction {
  const [integer, decimals = ""] = value.split(".");
  return reduceFraction({
    numerator: BigInt(`${integer.startsWith("-") ? "-" : ""}${integer.replace("-", "")}${decimals}`),
    denominator: BIG_TEN ** BigInt(decimals.length),
  });
}

function terminatingDecimal(fraction: Fraction): DecimalString | null {
  if (fraction.numerator === BIG_ZERO) return parseDecimalString("0");
  let remainder = fraction.denominator;
  let powersOfTwo = 0;
  let powersOfFive = 0;
  while (remainder % BIG_TWO === BIG_ZERO) {
    remainder /= BIG_TWO;
    powersOfTwo += 1;
  }
  while (remainder % BIG_FIVE === BIG_ZERO) {
    remainder /= BIG_FIVE;
    powersOfFive += 1;
  }
  if (remainder !== BIG_ONE) return null;

  const scale = Math.max(powersOfTwo, powersOfFive);
  const multiplier =
    BIG_TWO ** BigInt(scale - powersOfTwo) *
    BIG_FIVE ** BigInt(scale - powersOfFive);
  const scaled = fraction.numerator * multiplier;
  if (scale === 0) return parseDecimalString(scaled.toString());

  const negative = scaled < BIG_ZERO;
  const digits = (negative ? -scaled : scaled).toString().padStart(scale + 1, "0");
  const split = digits.length - scale;
  return parseDecimalString(
    `${negative ? "-" : ""}${digits.slice(0, split)}.${digits.slice(split)}`,
  );
}

export function exactRatioFromDivision(
  numeratorValue: DecimalString,
  denominatorValue: DecimalString,
): ExactRatio {
  const numerator = decimalToFraction(parseDecimalString(numeratorValue));
  const denominator = decimalToFraction(parseDecimalString(denominatorValue));
  const ratio = reduceFraction({
    numerator: numerator.numerator * denominator.denominator,
    denominator: numerator.denominator * denominator.numerator,
  });
  return {
    numerator: parseDecimalString(ratio.numerator.toString()),
    denominator: parseDecimalString(ratio.denominator.toString()),
    decimal: terminatingDecimal(ratio),
  };
}
