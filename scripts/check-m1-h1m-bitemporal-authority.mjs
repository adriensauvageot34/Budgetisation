import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

import { buildM1HistoricalMinimalBackfillPlan } from "./backfill-m1-historical-minimal-authority.mjs";

const root = process.cwd();
const require = createRequire(import.meta.url);
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function loadModule(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolveModule(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/") ? path.join(root, "src", request.slice(2)) : request;
  try { return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options); }
  catch (originalError) {
    if (path.extname(resolvedRequest) !== "") throw originalError;
    for (const candidate of [`${resolvedRequest}.ts`, `${resolvedRequest}.tsx`, path.join(resolvedRequest, "index.ts")]) {
      try { return originalResolveFilename.call(this, candidate, parent, isMain, options); } catch { /* continue */ }
    }
    throw originalError;
  }
};
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
    }).outputText;
    module._compile(output, filename);
  };
}

const baseline = require(path.join(root, "src/analytics/baseline/index.ts"));
const evidence = JSON.parse(fs.readFileSync(path.join(root,
  "docs/global-v2/execution/m1-economy/M1-H1-HUMAN-VALIDATION-CANDIDATES.json"), "utf8"));
const plan = buildM1HistoricalMinimalBackfillPlan(evidence);
const replayed = buildM1HistoricalMinimalBackfillPlan(evidence);
let checks = 0;
const check = (callback) => { callback(); checks += 1; };

check(() => assert.equal(plan.ruleVersions.length, 34));
check(() => assert.equal(plan.recurrenceStateVersions.length, 15));
check(() => assert.equal(plan.unknownRules.filter(({ reason }) => reason === "NO_HISTORICAL_EVIDENCE").length, 5));
check(() => assert.equal(plan.unknownRules.filter(({ reason }) => reason === "MIXED_COMPONENT_AUTHORITY_REQUIRED").length, 1));
check(() => assert.equal(plan.singleOccurrenceRecurrences.length, 1));
check(() => assert.equal(plan.singleOccurrenceRecurrences[0].historicalState, "UNKNOWN"));
check(() => assert.equal(plan.planHash, replayed.planHash));
check(() => assert.deepEqual(plan.ruleVersions, replayed.ruleVersions));
check(() => assert.equal(new Set(plan.ruleVersions.map(({ ruleVersionId }) => ruleVersionId)).size, 34));
check(() => assert.equal(new Set(plan.recurrenceStateVersions.map(({ stateVersionId }) => stateVersionId)).size, 15));
check(() => assert.ok(plan.ruleVersions.every(({ authorityType }) => authorityType === "RETROSPECTIVE_DECLARATION")));
check(() => assert.ok(plan.ruleVersions.every(({ effectiveFrom, evidenceRefs }) => evidenceRefs.includes(`first-evidence:${effectiveFrom}`))));
check(() => assert.equal(plan.ruleVersions.find(({ baselineRuleId }) => baselineRuleId === "109659db-177f-544d-b24c-e001e25f39cb").effectiveFrom, "2025-08-01"));
check(() => assert.equal(plan.ruleVersions.find(({ baselineRuleId }) => baselineRuleId === "4b43c704-9864-5306-9e06-4420faadba14").effectiveFrom, "2025-11-10"));
check(() => assert.equal(plan.ruleVersions.find(({ baselineRuleId }) => baselineRuleId === "934afb8d-b29d-5735-977d-2578045db244").conditionCode, "WORK_COMMUTE_FUEL_ONLY"));
check(() => assert.equal(plan.ruleVersions.find(({ baselineRuleId }) => baselineRuleId === "2d3e9f47-5453-58cc-85a3-37bcc36e0a25").effectiveFrom, "2025-09-06"));
check(() => assert.equal(plan.ruleVersions.find(({ baselineRuleId }) => baselineRuleId === "704b7737-f651-55fe-914f-e1f6bf33d34b").effectiveFrom, "2025-12-11"));
check(() => assert.equal(plan.ruleVersions.find(({ baselineRuleId }) => baselineRuleId === "9a94eaee-4dd2-5c59-865f-26d62a8de29d").effectiveFrom, "2026-03-11"));
check(() => assert.ok(plan.recurrenceStateVersions.every(({ validationRef }) => validationRef === "M1-H1-GROUPED-RECURRENCE-DECISION")));
check(() => assert.equal(plan.replay.length, 12));
check(() => assert.ok(plan.replay.every(({ minimalStateStatus }) => minimalStateStatus === "PARTIAL_SAFE")));

const version = (overrides = {}) => ({
  ruleVersionId: "version:1", baselineRuleId: "rule:1", masterRuleFamily: "VARIABLE_ESSENTIAL",
  effectiveFrom: "2025-08-01", declaredAt: "2026-09-08T00:00:00Z", sourceRevision: 2,
  authorityType: "RETROSPECTIVE_DECLARATION", declaredByRef: "human:approval", validationRef: "HV-001",
  methodVersion: "minimal_historical_authority@v1", evidenceRefs: ["evidence:1"], ...overrides,
});
check(() => assert.equal(baseline.selectHistoricalMinimalRuleVersion({
  baselineRuleId: "rule:1", effectiveOn: "2026-05-01", knownAt: "2026-05-31T23:59:59Z", versions: [version()],
}), undefined));
check(() => assert.equal(baseline.selectHistoricalMinimalRuleVersion({
  baselineRuleId: "rule:1", effectiveOn: "2026-05-01", knownAt: "2026-09-08T00:00:00Z", versions: [version()],
}).sourceRevision, 2));
check(() => assert.equal(baseline.selectHistoricalMinimalRuleVersion({
  baselineRuleId: "rule:1", effectiveOn: "2026-05-01", knownAt: "2026-09-08T00:00:00Z",
  versions: [version({ effectiveFrom: "2026-06-01" })],
}), undefined));
check(() => assert.equal(baseline.selectHistoricalMinimalRuleVersion({
  baselineRuleId: "rule:1", effectiveOn: "2026-06-01", knownAt: "2026-09-08T00:00:00Z",
  versions: [version({ effectiveTo: "2026-06-01" })],
}), undefined));
check(() => assert.throws(() => baseline.assertHistoricalAuthorityVersionSet({
  ruleVersions: [version(), version({ ruleVersionId: "version:2", masterRuleFamily: "FIXED_REQUIRED" })], recurrenceStateVersions: [],
}), /contradictoires/));

const common = {
  authorityId: "rule:variable", effectiveFrom: "2025-01-01", declaredAt: "2025-01-01T00:00:00Z",
  sourceRevision: 1, authorityType: "RETROSPECTIVE_DECLARATION", declaredByRef: "test:human",
  validationRef: "test:validation", methodVersion: "minimal_historical_authority@v1", evidenceRefs: ["test:evidence"],
};
const observation = (month, amount) => ({ month, status: "KNOWN", amount, eligible: true, evidenceRefs: [`fact:${month}`] });
const variableKnown = {
  canonicalComponentKey: "component:known", bucket: "NEUTRAL_VARIABLE", rule: { ...common, family: "VARIABLE_ESSENTIAL" },
  observations: ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06"].map((month, index) => observation(month, String(index * 10))),
};
const variableUnknown = {
  canonicalComponentKey: "component:unknown", bucket: "NEUTRAL_VARIABLE",
  rule: { ...common, authorityId: "rule:unknown", family: "VARIABLE_ESSENTIAL" }, observations: [observation("2025-01", "5")],
};
const state = baseline.resolveHistoricalMinimalState({
  targetMonth: "2026-01", authority: {
    model: "BITEMPORAL_TYPED_RULE_AND_RECURRENCE_AUTHORITY_V1", completeness: "COMPLETE_FOR_TARGET_MONTH",
    knowledgeAsOf: "2026-09-08T00:00:00Z", components: [variableKnown, variableUnknown],
  },
});
check(() => assert.equal(state.status, "UNKNOWN"));
check(() => assert.equal(state.componentStates.filter(({ status }) => status === "KNOWN").length, 1));
check(() => assert.equal(state.componentStates.find(({ status }) => status === "UNKNOWN").reasonCode, "INSUFFICIENT_ELIGIBLE_OBSERVATIONS"));

const repositorySource = fs.readFileSync(path.join(root, "src/server/canonical/repository.ts"), "utf8");
check(() => assert.match(repositorySource, /loadHistoricalMinimalAuthority/));
check(() => assert.match(repositorySource, /\.lte\("declared_at", this\.context\.asOf\)/));
check(() => assert.match(repositorySource, /effective_to\.is\.null,effective_to\.gt/));
const authorityMethod = repositorySource.slice(repositorySource.indexOf("async loadHistoricalMinimalAuthority"), repositorySource.indexOf("private loadComposition", repositorySource.indexOf("async loadHistoricalMinimalAuthority")));
check(() => assert.doesNotMatch(authorityMethod, /actif_prevision|minimal_month_cost@v1|history_/));

const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260908160000_m1_historical_minimal_bitemporal_authority.sql"), "utf8");
check(() => assert.match(migration, /create table public\.minimal_baseline_rule_versions/));
check(() => assert.match(migration, /create table public\.recurrence_state_history/));
check(() => assert.match(migration, /daterange\(v\.effective_from, v\.effective_to, '\[\)'\)/));
check(() => assert.match(migration, /enable row level security/g));
check(() => assert.match(migration, /private\.assert_history_v2_household_scope/g));
check(() => assert.match(migration, /revoke all on table public\.minimal_baseline_rule_versions from public, anon, authenticated/));
check(() => assert.match(migration, /append-only/));
check(() => assert.match(migration, /create function public\.apply_m1_historical_minimal_authority_backfill/));
check(() => assert.match(migration, /public\.record_analytics_mutation/));
check(() => assert.match(migration, /Partial M1-H1M backfill detected/));

const backfillSource = fs.readFileSync(path.join(root, "scripts/backfill-m1-historical-minimal-authority.mjs"), "utf8");
check(() => assert.match(backfillSource, /LIVE_BACKFILL_AUTHORIZED/));
check(() => assert.match(backfillSource, /assertLiveEvidenceUnchanged/));
check(() => assert.match(backfillSource, /MD5|createHash\("md5"\)/));
check(() => assert.match(backfillSource, /valeur_economique_brute::text/));
check(() => assert.match(backfillSource, /date_transaction_reelle \?\? operation\.date_bancaire/));
check(() => assert.match(backfillSource, /Drift: les règles live ne correspondent plus au paquet H1/));
check(() => assert.match(backfillSource, /Drift: les séries live ne correspondent plus au paquet H1/));
check(() => assert.match(backfillSource, /apply_m1_historical_minimal_authority_backfill/));
check(() => assert.doesNotMatch(backfillSource, /history_minimal_preview|history_month_balance_summary/));
check(() => assert.ok(!process.env.LIVE_BACKFILL_AUTHORIZED));

console.log(`M1-H1M bitemporal authority: ${checks}/${checks} PASS`);
