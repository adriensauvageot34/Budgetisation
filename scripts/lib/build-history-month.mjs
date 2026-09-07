import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Concrete producer port for materialization/history-rebuild.buildHistoryMonth.
 * Reuses the HC1/HC2 Canonical fixture reader, official analytics, builders and
 * invariant runner. No network, SQL or Finalize; the caller owns the server stage.
 * The source must be a read-only Canonical export at the requested revision.
 */
export function produceCertifiedHistoryMonth({ context, month, sourceRevision,
  fixtureDirectory, oracleReportFile, outputDirectory, repositoryRoot = process.cwd() }) {
  assert.equal(sourceRevision, context.dataRevision);
  const bundleFile = path.resolve(outputDirectory, `history-${month}-preflight.json`);
  execFileSync(process.execPath, ["scripts/check-history-v2-certification-12-months.mjs",
    fixtureDirectory, oracleReportFile, outputDirectory, `--month=${month}`,
    `--household=${context.householdId}`, `--source-revision=${sourceRevision}`], {
    cwd: repositoryRoot, stdio: "inherit",
    env: { ...process.env, HISTORY_V2_PREFLIGHT_BUNDLE_FILE: bundleFile },
  });
  const report = JSON.parse(fs.readFileSync(path.resolve(outputDirectory, "history-v2-certification-12-months.json"), "utf8"));
  const bundle = JSON.parse(fs.readFileSync(bundleFile, "utf8"));
  assert.equal(report.gate, "PASS");
  assert.equal(report.mode, "READ_ONLY");
  assert.equal(report.months.length, 1);
  assert.equal(bundle.months.length, 1);
  assert.equal(bundle.months[0].month, month);
  assert.equal(report.householdId, context.householdId);
  assert.equal(report.sourceRevision, sourceRevision);
  assert.equal(report.implementationSha, bundle.implementationSha);
  assert.equal(report.implementationSha, bundle.months[0].preflight.manifest.implementation.gitSha);
  assert.equal(bundle.context.analyticsRevision, context.analyticsRevision);
  assert.equal(report.months[0].manifestHash, bundle.months[0].preflight.manifest.manifestHash);
  return {
    preflight: bundle.months[0].preflight,
    certification: { mode: report.mode, gate: report.gate, householdId: report.householdId,
      sourceRevision, month, manifestHash: report.months[0].manifestHash, checks: report.months[0].checks },
  };
}
