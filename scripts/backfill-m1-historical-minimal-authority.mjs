import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const EVIDENCE_RELATIVE = "docs/global-v2/execution/m1-economy/M1-H1-HUMAN-VALIDATION-CANDIDATES.json";
const EVIDENCE_SHA256 = "ebd9a49497f2b46b6f549d879ed425748d558cc5fd8d389ff59e6ed1cac01366";
const SOURCE_REVISION = 2;
const DECLARED_AT = "2026-09-08T00:00:00Z";
const DECLARED_BY_REF = "M1-H1M-HUMAN-APPROVAL-2026-09-08";
const RULE_METHOD_VERSION = "minimal_historical_authority@v1";
const RECURRENCE_METHOD_VERSION = "minimal_recurrence_state@v1";

const fixedRequiredLabels = new Set([
  "Assurance automobile", "Assurance habitation", "Protection juridique", "Responsabilité civile",
  "Cotisation Offre Essentiel", "Tenue de compte", "Logement", "Télécom",
]);
const variableDecisions = new Map([
  ["Courses alimentaires", { effectiveFrom: "2025-08-01" }],
  ["Épicerie / alimentation générale", { effectiveFrom: "2025-11-10" }],
  ["Carburant", { conditionCode: "WORK_COMMUTE_FUEL_ONLY" }],
  ["Coiffure", { effectiveFrom: "2025-09-06" }],
  ["Skincare", { effectiveFrom: "2025-12-11" }],
  ["Maquillage", { effectiveFrom: "2026-03-11" }],
]);

const canonical = (value) => Array.isArray(value)
  ? value.map(canonical)
  : value !== null && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    : value;
const digest = (value) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
const orderedPrivateAmountsDigest = (operations) => createHash("md5")
  .update(operations.map(({ valeur_economique_brute_text: amount }) => amount ?? "NULL").join("|"))
  .digest("hex");
const economicObservationDate = (operation) => operation.date_transaction_reelle ?? operation.date_bancaire;

function deterministicUuid(seed) {
  const bytes = Buffer.from(createHash("sha256").update(seed).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function labelOf(rule) {
  return rule.subcategoryLabel ?? rule.categoryLabel;
}

function validationByEntity(evidence) {
  return new Map(evidence.humanDecisions.map((decision) => [decision.entityId, decision.decisionId]));
}

export function buildM1HistoricalMinimalBackfillPlan(evidence) {
  assert.equal(evidence.schemaVersion, "m1-h1-human-validation-candidates@v1");
  assert.equal(evidence.projectRef, "ipuuhxrblxormwgoaqnz");
  assert.equal(evidence.sourceRevision, 1);
  assert.equal(evidence.rules.length, 40);
  assert.equal(evidence.recurrences.length, 35);
  assert.equal(evidence.humanDecisions.length, 51);
  const decisions = validationByEntity(evidence);
  const selectedRuleIds = new Set();
  const ruleVersions = [];
  const addRule = (rule, family, effectiveFrom, decisionGroup, conditionCode) => {
    assert.ok(!selectedRuleIds.has(rule.baselineRuleId), `Décision dupliquée pour ${rule.baselineRuleId}`);
    assert.ok(effectiveFrom && effectiveFrom >= rule.firstHistoricalEvidenceDate, "Une règle ne peut précéder sa première preuve.");
    const validationRef = decisions.get(rule.baselineRuleId);
    assert.ok(validationRef, `Validation H1 absente pour ${rule.baselineRuleId}`);
    selectedRuleIds.add(rule.baselineRuleId);
    ruleVersions.push({
      ruleVersionId: deterministicUuid(`m1-h1m:rule:${rule.baselineRuleId}:${SOURCE_REVISION}`),
      baselineRuleId: rule.baselineRuleId,
      masterRuleFamily: family,
      ...(conditionCode === undefined ? {} : { conditionCode }),
      effectiveFrom,
      declaredAt: DECLARED_AT,
      sourceRevision: SOURCE_REVISION,
      authorityType: "RETROSPECTIVE_DECLARATION",
      declaredByRef: DECLARED_BY_REF,
      validationRef,
      decisionGroup,
      methodVersion: RULE_METHOD_VERSION,
      evidenceRefs: [
        `h1:${validationRef}`,
        `canonical-rule:${rule.baselineRuleId}`,
        `first-evidence:${rule.firstHistoricalEvidenceDate}`,
        `component-count:${rule.linkedComponentsCount}`,
      ],
    });
  };

  for (const rule of evidence.rules) {
    if (rule.currentEligibility === "Excluded" && rule.linkedComponentsCount > 0 && rule.masterRuleFamilyCandidate === "EXCLUDED_FROM_MINIMAL") {
      addRule(rule, "EXCLUDED_FROM_MINIMAL", rule.firstHistoricalEvidenceDate, "D1");
    }
  }
  for (const rule of evidence.rules) {
    if (fixedRequiredLabels.has(labelOf(rule))) addRule(rule, "FIXED_REQUIRED", rule.firstHistoricalEvidenceDate, "D2");
  }
  for (const rule of evidence.rules) {
    const decision = variableDecisions.get(labelOf(rule));
    if (decision === undefined) continue;
    addRule(rule, "VARIABLE_ESSENTIAL", decision.effectiveFrom ?? rule.firstHistoricalEvidenceDate,
      ["Coiffure", "Skincare", "Maquillage"].includes(labelOf(rule)) ? "D4" : "D3", decision.conditionCode);
  }

  assert.equal(ruleVersions.filter(({ decisionGroup }) => decisionGroup === "D1").length, 20);
  assert.equal(ruleVersions.filter(({ decisionGroup }) => decisionGroup === "D2").length, 8);
  assert.equal(ruleVersions.filter(({ decisionGroup }) => decisionGroup === "D3").length, 3);
  assert.equal(ruleVersions.filter(({ decisionGroup }) => decisionGroup === "D4").length, 3);
  assert.equal(ruleVersions.length, 34);

  const unknownRules = evidence.rules.filter((rule) => !selectedRuleIds.has(rule.baselineRuleId)).map((rule) => ({
    baselineRuleId: rule.baselineRuleId,
    reason: rule.categoryLabel === "Mixte / multi-catégories"
      ? "MIXED_COMPONENT_AUTHORITY_REQUIRED"
      : "NO_HISTORICAL_EVIDENCE",
  }));
  assert.equal(unknownRules.filter(({ reason }) => reason === "NO_HISTORICAL_EVIDENCE").length, 5);
  assert.equal(unknownRules.filter(({ reason }) => reason === "MIXED_COMPONENT_AUTHORITY_REQUIRED").length, 1);

  const relevantRecurrences = evidence.recurrences.filter(({ minimalRelevant }) => minimalRelevant);
  assert.equal(relevantRecurrences.length, 16);
  const recurrenceStateVersions = relevantRecurrences.filter(({ robustCadencePossible }) => robustCadencePossible).map((recurrence) => {
    const validationRef = decisions.get(recurrence.recurrenceSeriesId);
    assert.ok(validationRef, `Validation H1 absente pour ${recurrence.recurrenceSeriesId}`);
    return {
      stateVersionId: deterministicUuid(`m1-h1m:recurrence:${recurrence.recurrenceSeriesId}:${SOURCE_REVISION}`),
      recurrenceSeriesId: recurrence.recurrenceSeriesId,
      historicalState: "ACTIVE_FOR_MINIMAL",
      effectiveFrom: recurrence.firstObservedOccurrence,
      declaredAt: DECLARED_AT,
      sourceRevision: SOURCE_REVISION,
      authorityType: "RETROSPECTIVE_DECLARATION",
      declaredByRef: DECLARED_BY_REF,
      validationRef: "M1-H1-GROUPED-RECURRENCE-DECISION",
      decisionRef: validationRef,
      methodVersion: RECURRENCE_METHOD_VERSION,
      evidenceRefs: [
        `h1:${validationRef}`,
        `canonical-recurrence:${recurrence.recurrenceSeriesId}`,
        `first-observed:${recurrence.firstObservedOccurrence}`,
        `last-observed:${recurrence.lastObservedOccurrence}`,
        `occurrence-count:${recurrence.observedAmountCount}`,
        `private-amount-digest:${recurrence.observedAmountDigest}`,
      ],
    };
  });
  assert.equal(recurrenceStateVersions.length, 15);
  const singleOccurrence = relevantRecurrences.filter(({ robustCadencePossible }) => !robustCadencePossible);
  assert.equal(singleOccurrence.length, 1);
  assert.equal(singleOccurrence[0].observedAmountCount, 1);

  const months = ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"];
  const replay = months.map((month) => {
    const on = `${month}-01`;
    const rulesUsed = ruleVersions.filter(({ effectiveFrom }) => effectiveFrom <= on);
    const recurrenceStates = recurrenceStateVersions.filter(({ effectiveFrom }) => effectiveFrom <= on);
    const unknownComponents = rulesUsed.filter(({ masterRuleFamily }) => masterRuleFamily !== "EXCLUDED_FROM_MINIMAL").length + unknownRules.length;
    return {
      month,
      minimalStateStatus: rulesUsed.length === 0 ? "UNKNOWN" : "PARTIAL_SAFE",
      rulesUsed: rulesUsed.length,
      activeMinimalRecurrences: recurrenceStates.length,
      unknownComponents,
      sourceRevision: SOURCE_REVISION,
      methodVersion: "minimal_month_cost@v2",
    };
  });
  const logical = {
    schemaVersion: "m1-h1m-backfill-plan@v1",
    projectRef: evidence.projectRef,
    sourceEvidenceSha256: EVIDENCE_SHA256,
    previousSourceRevision: evidence.sourceRevision,
    sourceRevision: SOURCE_REVISION,
    declaredAt: DECLARED_AT,
    ruleVersions: ruleVersions.map(({ decisionGroup: _decisionGroup, ...version }) => version),
    recurrenceStateVersions: recurrenceStateVersions.map(({ decisionRef: _decisionRef, ...version }) => version),
    unknownRules,
    singleOccurrenceRecurrences: singleOccurrence.map(({ recurrenceSeriesId, firstObservedOccurrence, observedAmountDigest }) => ({ recurrenceSeriesId, firstObservedOccurrence, observedAmountDigest, historicalState: "UNKNOWN" })),
    replay,
  };
  return { ...logical, planHash: digest(logical) };
}

function loadAuditedEvidence() {
  const file = path.join(ROOT, EVIDENCE_RELATIVE);
  const bytes = fs.readFileSync(file);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), EVIDENCE_SHA256, "Le pack H1 a changé; nouveau contrôle humain requis.");
  return JSON.parse(bytes.toString("utf8"));
}

async function readAll(queryFactory) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await queryFactory().range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

async function assertLiveEvidenceUnchanged(client, evidence) {
  const [rules, recurrences, operations] = await Promise.all([
    readAll(() => client.from("minimal_baseline_rules").select("baseline_rule_id,category_id,subcategory_id,eligibility,condition_code,valid_from,valid_to,method_version").order("baseline_rule_id")),
    readAll(() => client.from("recurrence_series").select("recurrence_series_id,cadence_estimee,statut_serie,actif_prevision,source_prevision_canonique").order("recurrence_series_id")),
    readAll(() => client.from("operations")
      .select("operation_id,recurrence_series_id,date_transaction_reelle,date_bancaire,valeur_economique_brute_text:valeur_economique_brute::text")
      .not("recurrence_series_id", "is", null)
      .order("operation_id")),
  ]);
  assert.equal(rules.length, 40, "Drift: le live ne contient plus 40 règles.");
  assert.equal(recurrences.length, 35, "Drift: le live ne contient plus 35 séries.");
  const expectedRules = [...evidence.rules].sort((a, b) => a.baselineRuleId.localeCompare(b.baselineRuleId));
  const expectedRecurrences = [...evidence.recurrences].sort((a, b) => a.recurrenceSeriesId.localeCompare(b.recurrenceSeriesId));
  assert.deepEqual(rules.map((row) => ({
    baselineRuleId: row.baseline_rule_id,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    eligibility: row.eligibility,
    conditionCode: row.condition_code,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    methodVersion: row.method_version,
  })), expectedRules.map((row) => ({
    baselineRuleId: row.baselineRuleId,
    categoryId: row.categoryId,
    subcategoryId: row.subcategoryId,
    eligibility: row.currentEligibility,
    conditionCode: row.conditionCode,
    validFrom: row.currentValidFrom,
    validTo: row.currentValidTo,
    methodVersion: row.currentMethodVersion,
  })), "Drift: les règles live ne correspondent plus au paquet H1.");
  assert.deepEqual(recurrences.map((row) => ({
    recurrenceSeriesId: row.recurrence_series_id,
    cadence: row.cadence_estimee,
    status: row.statut_serie,
    activeForForecast: row.actif_prevision,
    forecastSource: row.source_prevision_canonique,
  })), expectedRecurrences.map((row) => ({
    recurrenceSeriesId: row.recurrenceSeriesId,
    cadence: row.currentCadence,
    status: row.currentStatus,
    activeForForecast: row.currentActifPrevision,
    forecastSource: row.sourcePrevisionCanonique,
  })), "Drift: les séries live ne correspondent plus au paquet H1.");
  const grouped = new Map();
  for (const operation of operations) {
    const current = grouped.get(operation.recurrence_series_id) ?? [];
    current.push(operation);
    grouped.set(operation.recurrence_series_id, current);
  }
  for (const expected of evidence.recurrences) {
    const observed = [...(grouped.get(expected.recurrenceSeriesId) ?? [])].sort((left, right) =>
      economicObservationDate(left).localeCompare(economicObservationDate(right))
      || left.operation_id.localeCompare(right.operation_id));
    assert.equal(observed.length, expected.linkedOperationsCount, `Drift occurrence count ${expected.recurrenceSeriesId}`);
    assert.equal(observed.filter(({ valeur_economique_brute_text: amount }) => amount !== null).length,
      expected.observedAmountCount, `Drift observed amount count ${expected.recurrenceSeriesId}`);
    assert.equal(economicObservationDate(observed[0] ?? {}), expected.firstObservedOccurrence,
      `Drift first occurrence ${expected.recurrenceSeriesId}`);
    assert.equal(economicObservationDate(observed.at(-1) ?? {}), expected.lastObservedOccurrence,
      `Drift last occurrence ${expected.recurrenceSeriesId}`);
    assert.equal(
      orderedPrivateAmountsDigest(observed),
      expected.observedAmountDigest,
      `Drift private amount digest ${expected.recurrenceSeriesId}`,
    );
  }
}

function databaseRows(plan, householdId) {
  return {
    rules: plan.ruleVersions.map((row) => ({
      rule_version_id: row.ruleVersionId, household_id: householdId, baseline_rule_id: row.baselineRuleId,
      master_rule_family: row.masterRuleFamily, ...(row.conditionCode === undefined ? {} : { condition_code: row.conditionCode }),
      effective_from: row.effectiveFrom, effective_to: null, declared_at: row.declaredAt, source_revision: row.sourceRevision,
      authority_type: row.authorityType, declared_by_ref: row.declaredByRef, validation_ref: row.validationRef,
      method_version: row.methodVersion, evidence_refs: row.evidenceRefs, supersedes_version_id: null,
    })),
    recurrences: plan.recurrenceStateVersions.map((row) => ({
      state_version_id: row.stateVersionId, household_id: householdId, recurrence_series_id: row.recurrenceSeriesId,
      historical_state: row.historicalState, effective_from: row.effectiveFrom, effective_to: null,
      declared_at: row.declaredAt, source_revision: row.sourceRevision, authority_type: row.authorityType,
      declared_by_ref: row.declaredByRef, validation_ref: row.validationRef, method_version: row.methodVersion,
      evidence_refs: row.evidenceRefs, supersedes_version_id: null,
    })),
  };
}

async function applyPlan(plan, evidence, householdId) {
  assert.equal(process.env.LIVE_BACKFILL_AUTHORIZED, "YES", "LIVE_BACKFILL_AUTHORIZED=YES est obligatoire.");
  assert.match(householdId ?? "", /^[0-9a-f-]{36}$/i, "--household-id est obligatoire.");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(url && key, "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont obligatoires.");
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  await assertLiveEvidenceUnchanged(client, evidence);
  const rows = databaseRows(plan, householdId);
  const { data: applied, error: applyError } = await client.rpc("apply_m1_historical_minimal_authority_backfill", {
    p_household_id: householdId,
    p_expected_data_revision: evidence.sourceRevision,
    p_plan_hash: plan.planHash,
    p_rule_versions: rows.rules,
    p_recurrence_state_versions: rows.recurrences,
  });
  if (applyError) throw applyError;
  const [{ data: rules, error: ruleError }, { data: recurrences, error: recurrenceError }] = await Promise.all([
    client.from("minimal_baseline_rule_versions").select("rule_version_id").eq("household_id", householdId).eq("source_revision", SOURCE_REVISION),
    client.from("recurrence_state_history").select("state_version_id").eq("household_id", householdId).eq("source_revision", SOURCE_REVISION),
  ]);
  if (ruleError) throw ruleError;
  if (recurrenceError) throw recurrenceError;
  assert.equal(rules.length, 34);
  assert.equal(recurrences.length, 15);
  return { ruleVersions: rules.length, recurrenceStateVersions: recurrences.length, transaction: applied?.[0] ?? null };
}

async function main() {
  const evidence = loadAuditedEvidence();
  const plan = buildM1HistoricalMinimalBackfillPlan(evidence);
  const apply = process.argv.includes("--apply");
  const householdArg = process.argv.find((value) => value.startsWith("--household-id="));
  if (!apply) {
    console.log(JSON.stringify({ mode: "DRY_RUN", liveWrites: 0, ...plan }, null, 2));
    return;
  }
  const result = await applyPlan(plan, evidence, householdArg?.slice("--household-id=".length));
  console.log(JSON.stringify({ mode: "APPLIED", ...result, planHash: plan.planHash }, null, 2));
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Backfill failed closed.");
    process.exitCode = 1;
  });
}
