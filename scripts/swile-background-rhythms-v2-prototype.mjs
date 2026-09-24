import assert from "node:assert/strict";
import fs from "node:fs";
import Big from "big.js";
import { registerHooks } from "node:module";
import { canonicalSerializeGlobal } from "../src/core/global-v2/hash.ts";

// C0-R measurement only. Input files are private read-only exports; never commit them.
// FULL benefit coverage is a wire-size scenario, not a certification of the absent source workbook.

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") || /\.[cm]?[jt]s$/u.test(specifier)) throw error;
    for (const candidate of [specifier + ".ts", specifier + "/index.ts"]) {
      try { return next(candidate, context); } catch { /* next candidate */ }
    }
    throw error;
  }
} });
const { createRuntimeSchema } = await import("../src/core/validation/schema.ts");

const ANNUAL_CAP = 48 * 1024;
const HEADROOM_SLO = 2 * 1024;
const FEATURE_CAP = 150 * 1024;
const STREAMS = ["COURSES", "RESTAURANT", "DELIVERY"];
const MONEY_FIELDS = ["courses", "restaurants", "deliveries", "total", "nonGroceryAmount"];
const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const COVERAGE = ["FULL", "PARTIAL"];
const MONTH_COVERAGE = ["IN_COVERAGE", "OUT_OF_COVERAGE"];

const b = (value) => new Big(String(value ?? 0));
const sum = (values) => values.reduce((total, value) => total.plus(b(value)), b(0));
const bytes = (value) => Buffer.byteLength(canonicalSerializeGlobal(value), "utf8");
const decimal = (value, label) => {
  assert.equal(typeof value, "string", label + " must be text");
  assert.match(value, DECIMAL, label + " must be nonnegative decimal");
  return value;
};
const money = (amount, mask, bit) => ({
  amount: decimal(amount, "FoodMoney"),
  quality: mask & (1 << bit) ? "LOWER_BOUND" : "KNOWN",
});
const monthIndex = (months, month) => {
  const index = months.findIndex((row) => row[0] === month);
  assert.ok(index >= 0, "Oracle month outside annual window: " + month);
  return index;
};
export function validateAndExpandPrototype(wire) {
  assert.equal(wire.schemaVersion, "global-background-rhythms@v2");
  assert.equal(wire.food.methodVersion, "global_food_rhythm@v2");
  assert.equal(wire.food.months.length, 12);
  const annualQuality = wire.food.annual.moneyQuality;
  assert.ok(Array.isArray(annualQuality) && annualQuality.length === 3);
  assert.ok(Number.isInteger(annualQuality[0]) && annualQuality[0] >= 0 && annualQuality[0] <= 31);
  decimal(annualQuality[1], "annual exact subtotal");
  decimal(annualQuality[2], "annual lower minimum");
  assert.equal(b(annualQuality[1]).plus(annualQuality[2]).toString(), wire.food.annual.total);
  const coverage = wire.food.benefitCoverage;
  assert.ok(COVERAGE.includes(coverage.status));
  assert.equal(coverage.startMonth, wire.food.months[0][0]);
  assert.equal(coverage.endMonth, wire.food.months.at(-1)[0]);
  assert.ok(Array.isArray(coverage.exceptions));
  if (coverage.status === "FULL") assert.equal(coverage.exceptions.length, 0);
  const exceptions = new Map();
  for (const entry of coverage.exceptions) {
    assert.ok(Array.isArray(entry) && entry.length === 2);
    assert.ok(Number.isInteger(entry[0]) && entry[0] >= 0 && entry[0] < 12);
    assert.ok(MONTH_COVERAGE.includes(entry[1]));
    assert.ok(!exceptions.has(entry[0]), "Duplicate coverage override");
    exceptions.set(entry[0], entry[1]);
  }
  const funding = new Map();
  assert.ok(Array.isArray(wire.food.monthlyBenefitFunding));
  for (const entry of wire.food.monthlyBenefitFunding) {
    assert.ok(Array.isArray(entry) && entry.length === 2);
    assert.ok(Number.isInteger(entry[0]) && entry[0] >= 0 && entry[0] < 12);
    assert.ok(!funding.has(entry[0]), "Duplicate funding month");
    funding.set(entry[0], decimal(entry[1], "monthly benefit funding"));
  }
  let compactHighlights = 0;
  const months = wire.food.months.map((row, index) => {
    assert.ok(Array.isArray(row) && row.length === 13, "Invalid v2 month tuple");
    const quality = row[12];
    assert.ok(Array.isArray(quality) && quality.length === 3);
    assert.ok(Number.isInteger(quality[0]) && quality[0] >= 0 && quality[0] <= 31);
    decimal(quality[1], "month exact subtotal");
    decimal(quality[2], "month lower minimum");
    assert.equal(b(quality[1]).plus(quality[2]).toString(), row[4]);
    const covered = (exceptions.get(index) ?? (coverage.status === "FULL" ? "IN_COVERAGE" : "OUT_OF_COVERAGE")) === "IN_COVERAGE";
    if (!covered) assert.ok(!funding.has(index), "Out-of-coverage funding must be absent");
    const highlights = row[10].map((bucket) => bucket.map((tuple) => {
      assert.ok(Array.isArray(tuple) && tuple.length >= 5 && tuple.length <= 10);
      for (const field of tuple.slice(0, 5)) assert.notEqual(field, undefined);
      if (tuple.length < 10) compactHighlights += 1;
      return [...tuple, ...Array(10 - tuple.length).fill(null)];
    }));
    return {
      month: row[0],
      money: Object.fromEntries(MONEY_FIELDS.map((field, bit) => [field, money(row[[1, 2, 3, 4, 5][bit]], quality[0], bit)])),
      exactKnownSubtotal: quality[1],
      lowerBoundMinimum: quality[2],
      benefitCoverage: covered ? "IN_COVERAGE" : "OUT_OF_COVERAGE",
      monthlyBenefitFunding: covered ? (funding.get(index) ?? "0") : "NOT_OBSERVED",
      highlights,
    };
  });
  return {
    annualMoney: Object.fromEntries(MONEY_FIELDS.map((field, bit) => [field, money(wire.food.annual[field], annualQuality[0], bit)])),
    annualExactKnownSubtotal: annualQuality[1],
    annualLowerBoundMinimum: annualQuality[2],
    months,
    compactHighlights,
  };
}

export const prototypeV2Schema = createRuntimeSchema(validateAndExpandPrototype);

export function buildPrototype(base, deltaRows, fundingRows) {
  assert.equal(base.schemaVersion, "global-background-rhythms@v1");
  assert.equal(base.food.months.length, 12);
  const wire = JSON.parse(JSON.stringify(base));
  const deltas = new Map(deltaRows.map((row) => [String(row.month) + "|" + String(row.stream), row]));
  const funding = new Map(fundingRows.map((row) => [String(row.month) + "|" + String(row.stream), row]));
  assert.equal(deltas.size, 36);
  const annualStreamTotals = STREAMS.map((stream) => sum(deltaRows.filter((row) => row.stream === stream).map((row) => row.target_minimum_total)));
  const annualLower = sum(deltaRows.map((row) => row.lower_bound_incremental_minimum));
  const annualExact = sum(deltaRows.map((row) => row.target_known_exact_subtotal));
  const annualTotal = sum(annualStreamTotals);
  assert.equal(annualTotal.toString(), "8546.07", "A3 annual oracle mismatch");
  const annualMask = STREAMS.reduce((mask, stream, index) =>
    mask | (deltaRows.some((row) => row.stream === stream && b(row.lower_bound_incremental_minimum).gt(0)) ? 1 << index : 0), 0);
  wire.schemaVersion = "global-background-rhythms@v2";
  wire.food.methodVersion = "global_food_rhythm@v2";
  for (let index = 0; index < 3; index += 1) wire.food.annual[MONEY_FIELDS[index]] = annualStreamTotals[index].toString();
  wire.food.annual.total = annualTotal.toString();
  wire.food.annual.nonGroceryAmount = annualStreamTotals[1].plus(annualStreamTotals[2]).toString();
  wire.food.annual.nonGroceryShare = annualLower.gt(0) ? null : annualStreamTotals[1].plus(annualStreamTotals[2]).div(annualTotal).toString();
  wire.food.annual.moneyQuality = [annualMask | (annualLower.gt(0) ? 1 << 3 : 0) |
    (STREAMS.slice(1).some((stream) => deltaRows.some((row) => row.stream === stream && b(row.lower_bound_incremental_minimum).gt(0))) ? 1 << 4 : 0),
    annualExact.toString(), annualLower.toString()];
  wire.food.benefitCoverage = { status: "FULL", startMonth: wire.food.months[0][0],
    endMonth: wire.food.months.at(-1)[0], exceptions: [] };
  wire.food.monthlyBenefitFunding = [];
  let removedNulls = 0;
  for (const row of wire.food.months) {
    const month = row[0];
    const current = STREAMS.map((stream) => {
      const result = deltas.get(month + "|" + stream);
      assert.ok(result, "Missing month/stream A3 oracle: " + month + "/" + stream);
      return result;
    });
    const amounts = current.map((entry) => b(entry.target_minimum_total));
    for (let index = 0; index < 3; index += 1) row[index + 1] = amounts[index].toString();
    const total = sum(amounts);
    row[4] = total.toString();
    row[5] = amounts[1].plus(amounts[2]).toString();
    const lower = sum(current.map((entry) => entry.lower_bound_incremental_minimum));
    row[6] = lower.gt(0) ? null : amounts[1].plus(amounts[2]).div(total).toString();
    const exact = sum(current.map((entry) => entry.target_known_exact_subtotal));
    let mask = current.reduce((value, entry, index) => value | (b(entry.lower_bound_incremental_minimum).gt(0) ? 1 << index : 0), 0);
    if (lower.gt(0)) mask |= 1 << 3;
    if (b(current[1].lower_bound_incremental_minimum).plus(current[2].lower_bound_incremental_minimum).gt(0)) mask |= 1 << 4;
    row.push([mask, exact.toString(), lower.toString()]);
    const benefit = sum(current.map((entry) => funding.get(month + "|" + entry.stream)?.benefit_funding ?? 0));
    if (benefit.gt(0)) wire.food.monthlyBenefitFunding.push([monthIndex(wire.food.months, month), benefit.toString()]);
    for (const bucket of row[10]) for (const tuple of bucket) {
      assert.equal(tuple.length, 10);
      while (tuple.length > 5 && tuple.at(-1) === null) { tuple.pop(); removedNulls += 1; }
    }
  }
  const expanded = prototypeV2Schema.parse(wire);
  assert.equal(expanded.compactHighlights, 49);
  assert.equal(removedNulls, 245);
  assert.equal(expanded.annualMoney.total.quality, "LOWER_BOUND");
  assert.equal(expanded.annualMoney.total.amount, "8546.07");
  const outOfCoverage = JSON.parse(JSON.stringify(wire));
  outOfCoverage.food.benefitCoverage.status = "PARTIAL";
  outOfCoverage.food.benefitCoverage.exceptions = [[0, "OUT_OF_COVERAGE"], ...outOfCoverage.food.months.slice(1).map((_, index) => [index + 1, "IN_COVERAGE"])];
  outOfCoverage.food.monthlyBenefitFunding = outOfCoverage.food.monthlyBenefitFunding.filter(([index]) => index !== 0);
  assert.equal(prototypeV2Schema.parse(outOfCoverage).months[0].monthlyBenefitFunding, "NOT_OBSERVED");
  const invalidMask = JSON.parse(JSON.stringify(wire));
  invalidMask.food.months[0][12][0] = 32;
  assert.equal(prototypeV2Schema.safeParse(invalidMask).success, false);
  return { wire, expanded, removedNulls };
}

async function main() {
  const [payloadPath, oraclePath] = process.argv.slice(2);
  if (!payloadPath || !oraclePath) throw new Error("Usage: node --experimental-strip-types scripts/swile-background-rhythms-v2-prototype.mjs <read-only-payload-json> <final-master-oracles-json>");
  const input = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
  assert.ok(input.annual && Array.isArray(input.details) && input.details.length === 12);
  const { delta, funding } = JSON.parse(fs.readFileSync(oraclePath, "utf8"));
  const result = buildPrototype(input.annual, delta, funding);
  const currentBytes = bytes(input.annual);
  const candidateBytes = bytes(result.wire);
  const featureBytes = candidateBytes + input.details.reduce((total, payload) => total + bytes(payload), 0);
  console.log(JSON.stringify({
    currentBytes, candidateBytes, reductionVsPreviousSimulationBytes: 47886 - candidateBytes,
    headroomBytes: ANNUAL_CAP - candidateBytes, headroomSloBytes: HEADROOM_SLO,
    headroomResult: ANNUAL_CAP - candidateBytes >= HEADROOM_SLO ? "PASS" : "FAIL",
    featureBytes, featureBudgetBytes: FEATURE_CAP, featureResult: featureBytes <= FEATURE_CAP ? "PASS" : "FAIL",
    snapshotCount: 1 + input.details.length, removedNulls: result.removedNulls,
    moneyQualityMask: result.wire.food.annual.moneyQuality[0],
    monthlyFundingEntries: result.wire.food.monthlyBenefitFunding.length,
  }, null, 2));
}

if (process.argv[1]?.endsWith("swile-background-rhythms-v2-prototype.mjs")) await main();


\n