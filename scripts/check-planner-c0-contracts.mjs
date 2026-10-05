import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { plannerModule, plannerRepositoryModule } from "./lib/planner-fixture-modules.mjs";
import { householdId, otherHouseholdId, userId, contextId, decisionId, state, evidence,
  parsePlanSemanticState, semanticStateDigest, emptyPlanSemanticState } from "./fixtures/planner-c0.mjs";

const json = plannerModule("json"), ids = plannerModule("identity"), contracts = plannerModule("plan-contract");
const passed = [];
const test = async (id, run) => { await run(); passed.push(id); };
const planId = randomUUID(), revisionId = randomUUID(), requestId = randomUUID();
const planRow = { plan_id: planId, household_id: householdId, target_month: "2026-11-01", active_revision_id: revisionId,
  active_revision_number: 1, created_by: userId, updated_by: userId, created_at: "2026-10-05T10:00:00Z", updated_at: "2026-10-05T10:00:00Z" };
const revisionRow = { plan_revision_id: revisionId, plan_id: planId, household_id: householdId, target_month: "2026-11-01",
  revision_number: 1, parent_revision_id: null, apply_request_id: requestId, ...evidence, created_by: userId, created_at: planRow.created_at };

await test("C0-ID-001", () => {
  const reloaded = parsePlanSemanticState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(reloaded, state);
  assert.equal(reloaded.controls[0].decisionId, decisionId);
  assert.equal(reloaded.contexts[0].contextOccurrenceId, contextId);
  assert.equal(ids.componentId(contextId, "FOOD", "main"), ids.componentId(reloaded.contexts[0].contextOccurrenceId, "FOOD", "main"));
  assert.notEqual(ids.componentId(contextId, "FOOD", "main"), ids.componentId(contextId, "FOOD", "second"));
  assert.equal(ids.mobilityIntentId(contextId, "PRIMARY"), ids.mobilityIntentId(contextId.toUpperCase(), "PRIMARY"));
  assert.equal(ids.physicalJourneyRequirementId(planId, contextId, "main"), ids.physicalJourneyRequirementId(planId, contextId, "main"));
  assert.notEqual(ids.physicalJourneyRequirementId(planId, contextId, "main"), ids.physicalJourneyRequirementId(planId, contextId, "second"));
  assert.equal(ids.needOccurrenceId("need-fixture", "episode-1"), ids.needOccurrenceId("need-fixture", "episode-1"));
  assert.notEqual(ids.needOccurrenceId("need-fixture", "episode-1"), ids.needOccurrenceId("need-fixture", "episode-2"));
  assert.notEqual(ids.needOccurrenceId("need-fixture", null), ids.needOccurrenceId("need-fixture", "null"));
  assert.notEqual(ids.planSlotId("amount/one"), ids.planSlotId("amount/two"));
});
await test("C0-ID-002", () => {
  const draft = { semanticState: state, layout: { x: 1, y: 2 }, selectedCard: contextId };
  const moved = { ...draft, layout: { x: 99, y: 24 }, selectedCard: null };
  assert.equal(semanticStateDigest(draft.semanticState), semanticStateDigest(moved.semanticState));
  assert.throws(() => parsePlanSemanticState({ ...state, layout: draft.layout }), /FIELDS_INVALID/);
  assert.notEqual(semanticStateDigest(state), semanticStateDigest({ ...state, controls: [] }));
});
await test("C0-PARSE-001", () => assert.throws(() => parsePlanSemanticState({ ...state, version: "month-plan-state@v2" }), /VERSION_UNSUPPORTED/));
await test("C0-PARSE-002", () => {
  assert.equal(contracts.parsePlanRevisionRow(revisionRow).semanticStateDigest, evidence.semantic_state_digest);
  for (const patch of [{ target_month: "2026-12-01" }, { revision_number: 0 }, { parent_revision_id: randomUUID() },
    { semantic_state_digest: "d".repeat(64) }, { baseline_snapshot: null }, { compiled_manifest: [] },
    { change_set: [true] }, { model_versions: { fixture: false } }, { created_at: "invalid" }, { invented: 1 }]) {
    assert.throws(() => contracts.parsePlanRevisionRow({ ...revisionRow, ...patch }), TypeError);
  }
  assert.throws(() => contracts.parsePlanRow({ ...planRow, active_revision_number: 0 }), /ACTIVE_REVISION_INVALID/);
});
await test("C0-NORMALIZATION", () => {
  const nextDecision = { ...state.controls[0], decisionId: randomUUID(), value: { amount: "0.00" } };
  const normalized = parsePlanSemanticState({ ...state, controls: [...state.controls, nextDecision] });
  assert.equal(normalized.controls.length, 1);
  assert.equal(normalized.controls[0].decisionId, nextDecision.decisionId);
  assert.equal(normalized.controls[0].value.amount, "0.00");
  const secondContext = { ...state.contexts[0], contextOccurrenceId: randomUUID(), parentContextOccurrenceId: contextId };
  const nested = parsePlanSemanticState({ ...state, contexts: [secondContext, ...state.contexts] });
  assert.equal(nested.contexts.length, 2);
  assert.equal(semanticStateDigest(nested), semanticStateDigest({ ...nested, contexts: [...nested.contexts].reverse() }));
  assert.throws(() => parsePlanSemanticState({ ...state, contexts: [...state.contexts, state.contexts[0]] }), /ID_DUPLICATE/);
  assert.throws(() => parsePlanSemanticState({ ...state, contexts: [{ ...state.contexts[0], parentContextOccurrenceId: randomUUID() }] }), /PARENT_MISSING/);
  assert.throws(() => parsePlanSemanticState({ ...state, contexts: [{ ...state.contexts[0], parentContextOccurrenceId: contextId }] }), /CYCLE/);
  assert.throws(() => parsePlanSemanticState({ ...state, controls: [{ ...state.controls[0], provenance: "PERSONAL_SUGGESTION" }] }), /DECISION_INVALID/);
  assert.throws(() => parsePlanSemanticState({ ...state, contexts: [{ ...state.contexts[0], status: "CANCELLED" }] }), /CONTEXT_INVALID/);
  assert.equal(emptyPlanSemanticState("2026-11").controls.length, 0);
});
await test("C0-JSON", () => {
  const value = { b: [null, 0, false], a: { z: "é", x: true } }, canonical = '{"a":{"x":true,"z":"é"},"b":[null,0,false]}';
  assert.equal(json.canonicalPlannerJson(value), canonical);
  assert.equal(json.plannerDigest(value), createHash("sha256").update(canonical).digest("hex"));
  for (const invalid of [undefined, NaN, Infinity, BigInt(1), new Date(), { x: undefined }, Array(1)]) assert.throws(() => json.canonicalPlannerJson(invalid));
  for (const month of ["2026-00", "2026-13", "2026-11-01", "26-11"]) assert.throws(() => json.plannerMonth(month));
});
await test("C0-REPOSITORY", async () => {
  const queries = [];
  const client = { from(table) {
    const filters = []; queries.push({ table, filters });
    return { select(selection) { assert.equal(selection, "*"); return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      async maybeSingle() { return { data: table === "phase2_month_plans" ? planRow : revisionRow, error: null }; } };
  } };
  const repository = plannerRepositoryModule().createPlanRepository(client);
  const stored = await repository.readActivePlan(householdId, "2026-11");
  assert.equal(stored.activeRevision.planRevisionId, revisionId);
  assert.deepEqual(Object.keys(repository).sort(), ["readActivePlan", "readRevision"]);
  for (const query of queries) assert.deepEqual(query.filters.slice(0, 2), [["household_id", householdId], ["target_month", "2026-11-01"]]);
  assert.deepEqual(queries[1].filters.slice(2), [["plan_id", planId], ["plan_revision_id", revisionId]]);
  const emptyClient = { from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: null, error: null }; } }; } };
  assert.equal(await plannerRepositoryModule().createPlanRepository(emptyClient).readActivePlan(householdId, "2026-11"), null);
  const badClient = { from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { ...planRow, household_id: otherHouseholdId }, error: null }; } }; } };
  await assert.rejects(() => plannerRepositoryModule().createPlanRepository(badClient).readActivePlan(householdId, "2026-11"), /SCOPE_INVALID/);
});
console.log(JSON.stringify({ suite: "planner-c0-contracts", passed, zeroLiveWrites: true }));
