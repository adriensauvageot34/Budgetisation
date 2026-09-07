import assert from "node:assert/strict";
import { registerHooks } from "node:module";
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") || /\.[cm]?[jt]s$/.test(specifier)) throw error;
    for (const path of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try { return next(path, context); } catch { /* Next existing module candidate. */ }
    }
    throw error;
  }
} });
const { buildGlobalTemporalDescriptive: build } = await import("../src/analytics/global-v2/temporal-descriptive.ts");
const point = (i, value) => ({ month: `2026-${String(i).padStart(2, "0")}`, corpus: "CERTIFIED_HISTORY", status: "KNOWN", value: String(value), eligible: true, complete: true, dependencyRefs: [`fact:${i}`] });
const run = (points) => build({ certifiedThroughMonth: "2026-12", points });
const series = Array.from({ length: 12 }, (_, i) => point(i + 1, 100 + 5 * i));
const result = run(series);
assert.equal(result.trend.slopePerMonth, "5");
assert.equal(result.trend.startLevel, "100");
assert.equal(result.trend.endLevel, "155");
assert.equal(result.recentChange.delta, "15");
assert.equal(run([...series].reverse()).inputHash, result.inputHash);
assert.equal(run([...series, { ...point(1, 9000), month: "2027-01" }]).inputHash, result.inputHash);
assert.equal(run([...series, { ...point(1, 9000), corpus: "LIVE_TAIL" }]).inputHash, result.inputHash);
assert.equal(run(series.filter((p) => p.month !== "2026-05")).trend.slopePerMonth, "5");
assert.equal(run(series.slice(0, 5)).trend.status, "UNKNOWN");
assert.equal(run(series.slice(0, 6)).trend.status, "KNOWN");
const stable = series.map((p) => ({ ...p, value: "100" }));
assert.equal(run(stable).dispersion.mad, "0");
assert.equal(run(stable).trend.slopePerMonth, "0");
assert.equal(run(stable.map((p, i) => i === 5 ? { ...p, value: "9999" } : p)).trend.slopePerMonth, "0");
assert.equal(result.dispersion.classification.status, "UNKNOWN");
assert.throws(() => run([...series, { ...series[0], value: "999" }]), /contradictoires/);
assert.throws(() => run([{ ...series[0], value: undefined }]), /undefined/);
assert.notEqual(run(series.map((p, i) => i === 0 ? { ...p, value: "99" } : p)).inputHash, result.inputHash);
console.log("P04 descriptive primitives: 17/17 PASS (descriptive suite)");
