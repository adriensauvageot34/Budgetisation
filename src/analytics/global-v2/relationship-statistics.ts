/** Statistical primitives only; no eligibility, materiality or publication authority. */
export const relationshipStatisticsPolicy = Object.freeze({
  version: "relationship-statistics@v1",
  signExactMaximumPairs: 16,
  permutations: 19999,
  bootstrapReplicates: 3999,
  confidence: 0.95,
  randomGenerator: "mulberry32@v1",
  twoSided: "ABSOLUTE_STATISTIC_INCLUSIVE",
  bootstrap: "PAIRED_PERCENTILE_TYPE7",
  mcnemar: "EXACT_BINOMIAL_TWO_SIDED",
  signStatistic: "PAIRED_MEDIAN_DIFFERENCE",
  fisher: "FIXED_MARGINS_PROBABILITY_ORDERING",
} as const);

export function relationshipMedian(values: readonly number[]): number {
  if (!values.length || values.some((value) => !Number.isFinite(value))) throw new TypeError("M5_FINITE_NONEMPTY_SAMPLE_REQUIRED");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function relationshipRandom(seed: number): () => number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new TypeError("M5_UINT32_SEED_REQUIRED");
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const integer = (n: number) => { if (!Number.isSafeInteger(n) || n < 0) throw new TypeError("M5_NONNEGATIVE_COUNT_REQUIRED"); };
const logChoose = (n: number, k: number) => {
  let value = 0;
  for (let i = 1; i <= Math.min(k, n - k); i++) value += Math.log(n - i + 1) - Math.log(i);
  return value;
};

export function relationshipMcNemar(exposedOnly: number, controlOnly: number): number {
  integer(exposedOnly); integer(controlOnly);
  const n = exposedOnly + controlOnly;
  if (!n) return 1;
  let tail = 0;
  for (let k = 0; k <= Math.min(exposedOnly, controlOnly); k++) tail += Math.exp(logChoose(n, k) - n * Math.LN2);
  return Math.min(1, 2 * tail);
}

/** This primitive cannot authorize an unpaired catalogue definition. */
export function relationshipFisher(table: readonly [number, number, number, number]): number {
  table.forEach(integer);
  const [a, b, c, d] = table, row = a + b, col = a + c, n = a + b + c + d;
  if (!n) return 1;
  const probability = (x: number) => Math.exp(logChoose(col, x) + logChoose(n - col, row - x) - logChoose(n, row));
  const observed = probability(a);
  let p = 0;
  for (let x = Math.max(0, row - (n - col)); x <= Math.min(row, col); x++) {
    const mass = probability(x);
    if (mass <= observed * (1 + 1e-12)) p += mass;
  }
  return Math.min(1, p);
}

export function relationshipSignPermutation(differences: readonly number[], seed: number) {
  const sample = [...differences].sort((a, b) => a - b);
  const statistic = relationshipMedian(sample);
  const exact = sample.length <= relationshipStatisticsPolicy.signExactMaximumPairs;
  const resamples = exact ? 2 ** sample.length : relationshipStatisticsPolicy.permutations;
  const random = relationshipRandom(seed);
  let extreme = 0;
  for (let i = 0; i < resamples; i++) {
    const shuffled = sample.map((value, j) => value * ((exact ? (i >>> j) & 1 : random() >= 0.5) ? 1 : -1));
    if (Math.abs(relationshipMedian(shuffled)) >= Math.abs(statistic)) extreme++;
  }
  return { statistic, pValue: exact ? extreme / resamples : (extreme + 1) / (resamples + 1), exact, resamples, seed };
}

export function relationshipPairedBootstrap(differences: readonly number[], seed: number, statistic: "MEDIAN" | "MEAN" = "MEDIAN") {
  const sample = [...differences].sort((a, b) => a - b);
  relationshipMedian(sample);
  const random = relationshipRandom(seed);
  const medians = Array.from({ length: relationshipStatisticsPolicy.bootstrapReplicates }, () => {
    const resampled = sample.map(() => sample[Math.floor(random() * sample.length)]);
    return statistic === "MEDIAN" ? relationshipMedian(resampled) : resampled.reduce((sum, value) => sum + value, 0) / resampled.length;
  }).sort((a, b) => a - b);
  const quantile = (p: number) => {
    const position = (medians.length - 1) * p, lower = Math.floor(position), weight = position - lower;
    return medians[lower] * (1 - weight) + medians[Math.min(lower + 1, medians.length - 1)] * weight;
  };
  return { interval95: [quantile(0.025), quantile(0.975)] as const, resamples: medians.length, seed, statistic, method: relationshipStatisticsPolicy.bootstrap };
}

export function relationshipBenjaminiHochberg(tests: readonly { readonly id: string; readonly pValue: number }[]) {
  const ids = new Set<string>();
  for (const test of tests) {
    if (!test.id || ids.has(test.id) || !Number.isFinite(test.pValue) || test.pValue < 0 || test.pValue > 1) throw new TypeError("M5_INVALID_FDR_UNIVERSE");
    ids.add(test.id);
  }
  const sorted = [...tests].sort((a, b) => a.pValue - b.pValue || (a.id < b.id ? -1 : 1));
  const adjusted: { id: string; pValue: number; qValue: number }[] = [];
  let next = 1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    next = Math.min(next, sorted[i].pValue * sorted.length / (i + 1));
    adjusted.push({ ...sorted[i], qValue: next });
  }
  return adjusted.sort((a, b) => a.id < b.id ? -1 : 1);
}

function ranks(values: readonly number[]): number[] {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result: number[] = [];
  for (let i = 0; i < sorted.length;) {
    let end = i + 1;
    while (end < sorted.length && sorted[end].value === sorted[i].value) end++;
    for (let j = i; j < end; j++) result[sorted[j].index] = (i + 1 + end) / 2;
    i = end;
  }
  return result;
}

export function relationshipSpearman(x: readonly number[], y: readonly number[]): number | null {
  if (x.length !== y.length) throw new TypeError("M5_PAIRED_LENGTH_REQUIRED");
  relationshipMedian(x); relationshipMedian(y);
  const a = ranks(x), b = ranks(y), mean = (x.length + 1) / 2;
  const covariance = a.reduce((sum, value, i) => sum + (value - mean) * (b[i] - mean), 0);
  const variance = (values: number[]) => values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const denominator = Math.sqrt(variance(a) * variance(b));
  return denominator === 0 ? null : covariance / denominator;
}

/** Descriptive linear trend removal, not a regime/stability qualification. */
export function relationshipDetrend(time: readonly number[], values: readonly number[]): number[] {
  if (time.length !== values.length) throw new TypeError("M5_PAIRED_LENGTH_REQUIRED");
  relationshipMedian(time); relationshipMedian(values);
  const mean = (a: readonly number[]) => a.reduce((sum, n) => sum + n, 0) / a.length;
  const mt = mean(time), mv = mean(values);
  const denominator = time.reduce((sum, t) => sum + (t - mt) ** 2, 0);
  if (!denominator) throw new TypeError("M5_TIME_VARIATION_REQUIRED");
  const slope = time.reduce((sum, t, i) => sum + (t - mt) * (values[i] - mv), 0) / denominator;
  return time.map((t, i) => values[i] - (mv + slope * (t - mt)));
}
