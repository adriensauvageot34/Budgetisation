import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import Big from 'big.js';
import { require } from './lib/phase2-ts-loader.mjs';
import { fixture, state, uuid, householdId, selections, component, mobility, context, activity, night, stay, child,
  control, findSlot, rebuild, simpleMonth, nightMonth, weekendMonth, renewalMonth, externalMonth } from './fixtures/planner-headless.mjs';
import { providers } from './fixtures/planner-mobility.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
const { preparePlanningMobility } = require('@/server/phase2/planner/prospective-mobility-pricing');
const { readMonthComposer, resolveComposerDrop } = require('@/server/phase2/planner/read-model');
const { readPlanBalanceSuggestions, acceptPlanBalanceSuggestion } = require('@/server/phase2/planner/balance-assistant');
const { previewPlanScenario, applyPlanScenario } = require('@/server/phase2/planner/apply');
const { resolveEffectiveMonthScenario } = require('@/server/phase2/planner/effective-month-scenario');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { evaluatePlanScenario } = require('@/server/phase2/planner/preview');
const { deriveMonthScenario } = require('@/server/phase2/month-scenario');
const { financialAdapterForecast } = require('@/server/phase2/planner/financial-adapter');
const { mutatePlanSemanticState } = require('@/server/phase2/planner/semantic-mutations');
const { semanticStateDigest } = require('@/domain/phase2/planner/semantic-state');
const { plannerDigest } = require('@/domain/phase2/planner/json');
const pg = await createKernelPostgres();
let current = fixture(), owner = providers(), requestId = 18000, worldReads = 0;
const deps = { repository: createPlanApplyRepository(pg.client), readWorld: async () => { worldReads++; return structuredClone(current); },
  prepareWorld: (world, semantic) => preparePlanningMobility(world, semantic, owner.value),
  readDirectWorld: async () => ({ forecast: current.forecast, monthInputs: current.monthInputs, externalIntents: current.externalIntents, asOfDate: current.asOfDate }) };
const passed = [], fixtures = {};
const test = async (id, run) => { await run(); passed.push(id); console.log(`${id} PASS`); };
const command = p => ({ expectedActiveRevisionId: p.baseActiveRevisionId, expectedActiveRevisionNumber: p.baseRevisionNumber,
  expectedBaselineDigest: p.baselineDigest, expectedPreviewDigest: p.previewDigest, applyRequestId: uuid(requestId++) });
async function loadFixture(f) { current = f.world; owner = providers(); return f.semantic; }
async function roundTrip(name, f) {
  const semantic = await loadFixture(f), before = structuredClone(current);
  const board = await readMonthComposer(deps, householdId, '2026-11', semantic), p = await previewPlanScenario(deps, householdId, semantic);
  assert.deepEqual(board.board.cockpit, p.projection); assert.notEqual(p.projection.applyReadiness, 'BLOCKED');
  const applied = await applyPlanScenario(deps, householdId, semantic, command(p));
  const reload = await resolveEffectiveMonthScenario(deps, householdId, '2026-11');
  const reread = await readMonthComposer(deps, householdId, '2026-11');
  assert.equal(reload.evidenceStatus, 'EXACT'); assert.deepEqual(reload.scenario, p.scenario);
  assert.deepEqual(reload.projection, p.projection); assert.deepEqual(reload.semanticState, applied.revision.semanticState);
  assert.deepEqual(reread.board.cockpit, p.projection); assert.equal(reread.board.draft.dirty, false);
  assert.deepEqual(current, before); await pg.verifyCanaries();
  fixtures[name] = { semanticStateDigest: p.semanticStateDigest, projectionDigest: p.projectionDigest, manifestDigest: p.compiledManifestDigest,
    remainder: p.projection.plan.economicMonthEndRemainder, completeness: p.projection.projectionCompleteness };
  return { p, board, applied, reload };
}
try {
  await test('C7-010', async () => {
    const before = worldReads, direct = await resolveEffectiveMonthScenario(deps, householdId, '2026-11');
    assert.equal(direct.owner, 'DIRECT_V2'); assert.equal(direct.projection, null); assert.equal(worldReads, before);
    assert.deepEqual(direct.scenario, deriveMonthScenario(current.forecast, current.monthInputs, null, current.asOfDate, current.externalIntents));
  });
  await test('C7-FIXTURE-A', async () => { const { p } = await roundTrip('A', simpleMonth());
    assert.equal(p.compiled.planSlots.find(s => s.role === 'SAVINGS').effectiveAmount, '60.00');
    assert.equal(p.compiled.planSlots.find(s => s.baseline.simpleAuthority?.domain === 'groceries').effectiveAmount, '300.00'); });
  await test('C7-FIXTURE-B-UBER', async () => { const { p } = await roundTrip('B-Uber', nightMonth());
    assert.equal(p.projection.mobility.cashTransportCosts, '14.00'); assert.equal(p.projection.economic.explicitContexts, '28.00'); });
  await test('C7-FIXTURE-B-TRAM-ONE-OF', async () => {
    const semantic = await loadFixture(nightMonth()), model = await readMonthComposer(deps, householdId, '2026-11', semantic);
    const replacement = nightMonth('train').semantic.contexts[0].slotSelections.outbound.items;
    const drop = resolveComposerDrop(model, 'option:night-out:outbound:train',
      { kind: 'CONTEXT_SOCKET', contextOccurrenceId: uuid(400), slotKey: 'outbound' },
      { kind: 'PATCH_CONTEXT', contextOccurrenceId: uuid(400), slotKey: 'outbound', items: replacement });
    const changed = mutatePlanSemanticState(semantic, drop.semanticMutation);
    assert.equal(changed.contexts[0].slotSelections.outbound.items.length, 1);
    const { p } = await roundTrip('B-Tram', { world: current, semantic: changed });
    assert.equal(p.projection.mobility.cashTransportCosts, '2.00'); assert.equal(p.compiled.mobilityIntents.length, 1);
  });
  await test('C7-FIXTURE-C-UNRESOLVED', async () => { const { p } = await roundTrip('C-Unresolved', weekendMonth());
    assert.equal(p.projection.plan.economicMonthEndRemainder, null); assert.equal(p.compiled.journeys.length, 1);
    assert.equal(p.projection.mobility.usageEconomicCost, '2.00'); assert.equal(p.compiled.contexts.length, 3); });
  await test('C7-FIXTURE-C-CONFIRMED', async () => { const { p } = await roundTrip('C-Confirmed', weekendMonth(true));
    assert.notEqual(p.projection.plan.economicMonthEndRemainder, null); assert.equal(p.compiled.journeys.length, 1);
    assert.equal(p.compiled.journeys[0].participatingIntentIds.length, 3); });
  await test('C7-FIXTURE-D', async () => { const { p } = await roundTrip('D', renewalMonth());
    assert.equal(p.compiled.components.filter(c => c.needOccurrenceId).length, 2);
    assert.equal(new Set(p.compiled.components.map(c => c.needOccurrenceId)).size, 2); assert.equal(p.projection.economic.explicitContexts, '41.99'); });
  await test('C7-FIXTURE-E', async () => { const { p, board } = await roundTrip('E', externalMonth());
    assert.equal(p.compiled.financialAdapterInput.plannedExpenseEntries.filter(e => e.id === uuid(800)).length, 1);
    assert.equal(board.board.contexts.filter(c => c.externalIntentId === uuid(800)).length, 1);
    assert.equal(board.board.contexts.find(c => c.externalIntentId === uuid(800)).readOnly, true); });
  await test('C7-001', async () => {
    for (const f of [simpleMonth(), nightMonth(), weekendMonth(true), renewalMonth(), externalMonth()]) {
      const semantic = await loadFixture(f), model = await readMonthComposer(deps, householdId, '2026-11', semantic);
      assert.strictEqual(model.board.cockpit, model.preview.projection);
      assert.deepEqual(model.board.cockpit, (await previewPlanScenario(deps, householdId, semantic)).projection);
    }
  });
  await test('C7-002', async () => {
    const semantic = await loadFixture(simpleMonth()), suggestions = await readPlanBalanceSuggestions(deps, householdId, '2026-11', semantic);
    assert.ok(suggestions.candidates.length >= 2);
    for (const candidate of suggestions.candidates) {
      const changed = mutatePlanSemanticState(semantic, candidate.semanticMutation);
      const independent = await previewPlanScenario(deps, householdId, changed), original = await previewPlanScenario(deps, householdId, semantic);
      assert.equal(candidate.projectionDigest, independent.projectionDigest);
      assert.deepEqual(candidate.projection, independent.projection);
      assert.equal(candidate.impactOnMonthEnd, new Big(independent.projection.plan.economicMonthEndRemainder).minus(original.projection.plan.economicMonthEndRemainder).toFixed(2));
    }
  });
  await test('C7-003', async () => {
    const semantic = await loadFixture(simpleMonth()), old = await readPlanBalanceSuggestions(deps, householdId, '2026-11', semantic), writes = pg.rpcCalls;
    const accepted = await acceptPlanBalanceSuggestion(deps, householdId, '2026-11', semantic, old.candidateSetDigest, old.candidates[0].candidateId);
    assert.equal(accepted.invalidatedCandidateSetDigest, old.candidateSetDigest);
    assert.notEqual(accepted.suggestions.candidateSetDigest, old.candidateSetDigest);
    assert.ok(accepted.suggestions.candidates.every(c => !old.candidates.some(prior => prior.candidateId === c.candidateId)));
    await assert.rejects(() => acceptPlanBalanceSuggestion(deps, householdId, '2026-11', accepted.semanticState, old.candidateSetDigest, old.candidates[0].candidateId), /CANDIDATES_STALE/);
    assert.equal(pg.rpcCalls, writes);
  });
  await test('C7-004', async () => {
    const f = simpleMonth(); f.world.sources.monthInputs.declaredOutflows.push({ ...f.world.monthInputs.declaredOutflows[0], id: uuid(701), label: 'Protected', amount: '50.00', adjustability: 'PROTECTED' });
    f.world.monthInputs = f.world.sources.monthInputs; rebuild(f.world);
    const semantic = await loadFixture(f), suggestions = await readPlanBalanceSuggestions(deps, householdId, '2026-11', semantic);
    const cap = suggestions.capabilities.find(c => c.targetRef === `savings:${uuid(701)}`); assert.equal(cap.flexibility, 'LOCKED'); assert.deepEqual(cap.actions, []);
    assert.ok(!suggestions.candidates.some(c => c.targetRef === cap.targetRef));
  });
  await test('C7-005', async () => {
    const f = simpleMonth(), groceries = findSlot(f.world, 'groceries'); f.semantic.contexts = [night(400, '20.00')];
    f.semantic.preferences = { anchors: [uuid(400)], flexibility: { [groceries.planSlotId]: 'PRESERVE', [uuid(3)]: 'PRESERVE' } };
    const semantic = await loadFixture(f), suggestions = await readPlanBalanceSuggestions(deps, householdId, '2026-11', semantic);
    assert.ok(!suggestions.candidates.some(c => [groceries.slotIdentityKey, uuid(400), `savings:${uuid(700)}`].includes(c.targetRef)));
    const model = await readMonthComposer(deps, householdId, '2026-11', semantic);
    assert.equal(resolveComposerDrop(model, `context-occurrence:${uuid(400)}`, { kind: 'TRASH' }).capability.resolution, 'BLOCKED');
  });
  await test('C7-006', async () => {
    const semantic = await loadFixture({ world: fixture(), semantic: state([], [activity(200, null)]) });
    const p = await previewPlanScenario(deps, householdId, semantic);
    assert.equal(p.projection.economic.explicitContexts, null); assert.equal(p.projection.plan.economicMonthEndRemainder, null);
    assert.equal(p.projection.projectionCompleteness, 'UNKNOWN'); assert.ok(p.projection.diagnostics.some(d => d.code === 'COMPONENT_COST_UNKNOWN'));
    const suggestions = await readPlanBalanceSuggestions(deps, householdId, '2026-11', semantic);
    assert.ok(suggestions.candidates.every(c => c.impactOnMonthEnd === null)); assert.ok(suggestions.candidates.every(c => c.knowledge === 'UNKNOWN'));
  });
  await test('C7-007', async () => {
    const semantic = await loadFixture(simpleMonth()), counts = await pg.counts(), writes = pg.rpcCalls, before = structuredClone(current);
    await readMonthComposer(deps, householdId, '2026-11', semantic); assert.equal(pg.rpcCalls, writes);
    assert.deepEqual(await pg.counts(), counts); assert.deepEqual(current, before);
  });
  await test('C7-008', async () => {
    const semantic = await loadFixture(nightMonth()), counts = await pg.counts(), writes = pg.rpcCalls;
    await previewPlanScenario(deps, householdId, semantic); await readPlanBalanceSuggestions(deps, householdId, '2026-11', semantic);
    assert.equal(pg.rpcCalls, writes); assert.deepEqual(await pg.counts(), counts);
  });
  await test('C7-009', async () => { await roundTrip('PARITY-FINAL', weekendMonth(true)); });
  await test('FIN-004', async () => {
    const semantic = await loadFixture(externalMonth()), p = await previewPlanScenario(deps, householdId, semantic);
    const line = p.compiled.financialAdapterInput.plannedExpenseEntries.find(e => e.id === uuid(800)).costItems[0];
    assert.deepEqual(line.fundingAllocations, []); assert.equal(p.scenario.economicPlan.plannedFunding.bankAllocated, '0.00');
    assert.equal(p.projection.cash.knowledge, 'UNKNOWN'); assert.equal(p.projection.cash.lowPointAmount, null);
    assert.ok(p.projection.diagnostics.some(d => d.code === 'PLAN_FUNDING_UNRESOLVED'));
  });
  await test('C7-EXTRA-TIMING', async () => {
    const f = nightMonth(); f.semantic.contexts[0].fields.plannedDate = null;
    const semantic = await loadFixture(f), p = await previewPlanScenario(deps, householdId, semantic);
    assert.ok(p.projection.funding.timing.some(t => t.plannedDate === null && t.certainty === 'UNKNOWN'));
    assert.equal(p.projection.cash.lowPointDate, null); assert.ok(p.projection.diagnostics.some(d => d.code === 'PLAN_TIMING_UNRESOLVED'));
  });
  await test('C7-EXTRA-ECONOMIC-RECONCILIATION', async () => {
    for (const f of [simpleMonth(), weekendMonth(true), renewalMonth(), externalMonth()]) {
      const semantic = await loadFixture(f), p = await previewPlanScenario(deps, householdId, semantic), e = p.projection.economic;
      assert.equal(new Big(e.resources).minus(e.certainCommitments).minus(e.savingsReservations).minus(e.needsAndHabits)
        .minus(e.discretionaryLife).minus(e.mobilityUsageEconomicCost).toFixed(2), p.projection.plan.economicMonthEndRemainder);
      assert.deepEqual(p.scenario, deriveMonthScenario(financialAdapterForecast(current, p.compiled.planSlots), p.compiled.financialAdapterInput.effectiveMonthInputs,
        null, current.asOfDate, p.compiled.financialAdapterInput.plannedExpenseEntries));
    }
  });
  await test('C7-EXTRA-FUEL-NO-DEBIT', async () => {
    const semantic = await loadFixture(weekendMonth(true)), p = await previewPlanScenario(deps, householdId, semantic);
    const fuel = p.compiled.financialAdapterInput.plannedExpenseEntries.flatMap(e => e.costItems).find(c => c.assetKey === 'transport:fuel_usage');
    assert.deepEqual(fuel.fundingAllocations, []); assert.ok(p.projection.funding.timing.some(t => t.cashTreatment === 'ECONOMIC_ONLY'));
  });
  await test('FIN-003', async () => {
    const semantic = await loadFixture(weekendMonth(true)), p = await previewPlanScenario(deps, householdId, semantic);
    assert.equal(p.projection.mobility.usageEconomicCost, '2.00');
    assert.equal(p.scenario.economicPlan.plannedFunding.bankAllocated, '0.00');
  });
  await test('C7-EXTRA-PREDICTION-OWNER', async () => {
    const f = simpleMonth();
    // C1's synthetic recurrence tags are not dated bank observations. The
    // financial owner receives an explicit empty synthetic bank ledger.
    f.world.forecast.predictionEvidence = { ...f.world.sources.evidence, bankObservations: [] };
    const semantic = await loadFixture(f), p = await previewPlanScenario(deps, householdId, semantic), e = p.projection.economic;
    assert.ok(p.scenario.economicPlan.narrative.prediction);
    assert.equal(new Big(e.resources).minus(e.certainCommitments).minus(e.savingsReservations).minus(e.needsAndHabits)
      .minus(e.discretionaryLife).minus(e.mobilityUsageEconomicCost).toFixed(2), p.projection.plan.economicMonthEndRemainder);
    const optionalNeeds = p.scenario.economicPlan.narrative.prediction.optional.filter(c => ['adrien-work-meals', 'manon-work-meals'].includes(c.key));
    assert.ok(optionalNeeds.length > 0);
    await roundTrip('A-With-Canonical-Prediction', f);
  });
  await test('C7-EXTRA-SCOPE', async () => {
    const semantic = await loadFixture(simpleMonth()), writes = pg.rpcCalls;
    await assert.rejects(() => readMonthComposer(deps, uuid(999), '2026-11', semantic), /SCOPE_INVALID/);
    await assert.rejects(() => readMonthComposer(deps, householdId, '2026-12', semantic), /SCOPE_INVALID/);
    assert.equal(pg.rpcCalls, writes);
  });
  await test('C7-EXTRA-UNRESOLVED-SOCKET', async () => {
    const semantic = await loadFixture({ world: fixture(), semantic: state([], [context(200, 'activity')]) });
    const model = await readMonthComposer(deps, householdId, '2026-11', semantic);
    assert.equal(model.board.contexts[0].knowledge, 'UNKNOWN');
    assert.equal(model.board.contexts[0].sockets.find(s => s.slotKey === 'main').visualState, 'UNRESOLVED');
    assert.equal(model.board.cockpit.plan.economicMonthEndRemainder, null);
    const renewal = await loadFixture(renewalMonth()), due = await readMonthComposer(deps, householdId, '2026-11', renewal);
    assert.ok(due.board.baselineControls.some(c => c.value.needOccurrence?.needKey === 'maquillage_manon_mascara'));
  });
  await test('C7-EXTRA-STALE-AUTHORITY', async () => {
    const semantic = await loadFixture(simpleMonth()), before = await readPlanBalanceSuggestions(deps, householdId, '2026-11', semantic), writes = pg.rpcCalls;
    current.monthInputs.declaredResources['benefit:swile'] = '10.00';
    await assert.rejects(() => acceptPlanBalanceSuggestion(deps, householdId, '2026-11', semantic, before.candidateSetDigest, before.candidates[0].candidateId), /CANDIDATES_STALE/);
    assert.equal(pg.rpcCalls, writes);
  });
  await test('C7-EXTRA-STALE-APPLY', async () => {
    const semantic = await loadFixture(simpleMonth()), p = await previewPlanScenario(deps, householdId, semantic), writes = pg.rpcCalls;
    current.monthInputs.declaredResources['benefit:edenred'] = '20.00';
    await assert.rejects(() => applyPlanScenario(deps, householdId, semantic, command(p)), /PREVIEW_STALE/); assert.equal(pg.rpcCalls, writes);
  });
  await test('C7-EXTRA-DETERMINISM', async () => {
    const semantic = await loadFixture(simpleMonth());
    assert.deepEqual(await readPlanBalanceSuggestions(deps, householdId, '2026-11', semantic), await readPlanBalanceSuggestions(deps, householdId, '2026-11', semantic));
    assert.deepEqual(await readMonthComposer(deps, householdId, '2026-11', semantic), await readMonthComposer(deps, householdId, '2026-11', semantic));
  });
  await test('C7-EXTRA-NESTED-ANCHOR', async () => {
    const f = weekendMonth(true); f.semantic.preferences.anchors = [uuid(200)];
    const semantic = await loadFixture(f), suggestions = await readPlanBalanceSuggestions(deps, householdId, '2026-11', semantic);
    assert.ok(!suggestions.candidates.some(c => c.semanticMutation.kind === 'REMOVE_CONTEXT'));
  });
  await test('C7-EXTRA-COMPONENT-ANCHOR', async () => {
    const semantic = await loadFixture(nightMonth()), p = await previewPlanScenario(deps, householdId, semantic);
    semantic.preferences.anchors = [p.compiled.components.find(c => c.role === 'main').componentId];
    const suggestions = await readPlanBalanceSuggestions(deps, householdId, '2026-11', semantic);
    assert.ok(!suggestions.candidates.some(c => c.targetRef === uuid(400)));
  });
  await test('C7-EXTRA-DROP-CAPABILITY', async () => {
    const semantic = await loadFixture(nightMonth()), model = await readMonthComposer(deps, householdId, '2026-11', semantic);
    assert.equal(resolveComposerDrop(model, 'template:short-stay', { kind: 'CONTEXT_SOCKET', contextOccurrenceId: uuid(400), slotKey: 'food' }).capability.resolution, 'BLOCKED');
    assert.equal(resolveComposerDrop(model, 'template:activity', { kind: 'BOARD_ZONE' }).capability.resolution, 'NEEDS_CHOICE');
    const attachment = resolveComposerDrop(model, 'template:activity', { kind: 'CONTEXT_SOCKET', contextOccurrenceId: uuid(400), slotKey: 'before' },
      { kind: 'ATTACH_CONTEXT', context: activity(200, '10.00'), parentContextOccurrenceId: uuid(400), slotKey: 'before', selectionId: 'new-before' });
    const changed = mutatePlanSemanticState(semantic, attachment.semanticMutation);
    assert.equal(changed.contexts.find(c => c.contextOccurrenceId === uuid(200)).parentContextOccurrenceId, uuid(400));
    assert.equal((await previewPlanScenario(deps, householdId, changed)).compiled.contexts.length, 2);
  });
  await test('C7-EXTRA-WORK-MOBILITY', async () => {
    const semantic = await loadFixture(simpleMonth()), suggestions = await readPlanBalanceSuggestions(deps, householdId, '2026-11', semantic);
    assert.ok(!suggestions.candidates.some(c => /commute|work-mobility/i.test(c.targetRef)));
  });
  await test('C7-EXTRA-DECISION-IMPACTS', async () => {
    const semantic = await loadFixture(simpleMonth()), p = await previewPlanScenario(deps, householdId, semantic);
    for (const c of semantic.controls) {
      const alternative = await previewPlanScenario(deps, householdId, { ...semantic, controls: semantic.controls.filter(other => other.decisionId !== c.decisionId) });
      const impact = p.projection.impacts.find(i => i.targetRef === c.decisionId);
      assert.equal(impact.marginalImpactOnMonthEnd, new Big(p.projection.plan.economicMonthEndRemainder).minus(alternative.projection.plan.economicMonthEndRemainder).toFixed(2));
    }
  });
  await test('C7-EXTRA-SERVER-AUTH', async () => {
    const semantic = await loadFixture(simpleMonth()), originalLoad = Module._load, writes = pg.rpcCalls;
    const auth = { changed: false, denied: false };
    const supabase = pg.client, user = { id: uuid(900) };
    Module._load = function(request, parent, isMain) {
      if (request === '@/server/bootstrap/auth') return { getAuthenticatedBootstrapClient: async () => { if (auth.denied) throw new TypeError('AUTH_REQUIRED'); return { supabase, user }; } };
      if (request === '@/server/bootstrap/context') return { getBootstrapContext: async () => ({ user: { id: auth.changed ? uuid(901) : user.id },
        household: { householdId, timezone: 'Europe/Paris' }, persons: [], periods: [], revision: { dataRevision: 1, analyticsRevision: 1 } }) };
      if (request === '@/server/canonical/client') return { createCanonicalReadClient: () => ({}) };
      if (request === '@/server/canonical/repository') return { CanonicalRepository: class { constructor(client, context) { this.client = client; this.context = context; } } };
      if (request === '@/server/phase2/planner/world-reader') return { createPlannerDependencies: (canonical, client) => {
        assert.equal(String(canonical.context.householdId), householdId); assert.strictEqual(client, supabase); return deps; } };
      return originalLoad.call(this, request, parent, isMain);
    };
    try {
      const actions = require('@/app/mois-a-venir/planner-actions');
      const composerActions = require('@/app/mois-a-venir/composer/actions');
      const composer = await composerActions.composerInteraction({ kind: 'READ', targetMonth: '2026-11', sequence: 0, draft: semantic });
      assert.equal(composer.ok, true); assert.equal(pg.rpcCalls, writes);
      const model = await actions.readMonthComposer('2026-11', semantic), p = await actions.previewPlanScenario('2026-11', semantic);
      assert.equal(model.preview.projectionDigest, p.projectionDigest);
      await actions.readPlanBalanceSuggestions('2026-11', semantic);
      auth.changed = true; await assert.rejects(() => actions.readMonthComposer('2026-11'), /SESSION_CHANGED/);
      await assert.rejects(() => composerActions.composerInteraction({ kind: 'READ', targetMonth: '2026-11', sequence: 1 }), /SESSION_CHANGED/);
      auth.changed = false; auth.denied = true; await assert.rejects(() => actions.applyPlanScenario('2026-11', semantic, command(p)), /AUTH_REQUIRED/);
      await assert.rejects(() => composerActions.composerInteraction({ kind: 'READ', targetMonth: '2026-11', sequence: 2 }), /AUTH_REQUIRED/);
      await assert.rejects(() => actions.previewPlanScenario('2026-12', semantic), /DRAFT_MONTH_INVALID/);
      assert.equal(pg.rpcCalls, writes);
      auth.denied = false;
      const fresh = await actions.previewPlanScenario('2026-11', semantic);
      const applied = await actions.applyPlanScenario('2026-11', semantic, command(fresh));
      assert.equal(pg.rpcCalls, writes + 1);
      const reload = await actions.readMonthComposer('2026-11');
      assert.deepEqual(reload.board.cockpit, fresh.projection);
      assert.deepEqual(reload.semanticState, applied.revision.semanticState);
    } finally { Module._load = originalLoad; }
  });
  await pg.verifyCanaries();
  console.log(`C7_HEADLESS_PLANNER_CERTIFIED = YES (${passed.length} oracle groups)`);
  if (process.env.PLANNER_C7_REPORT_PATH) fs.writeFileSync(process.env.PLANNER_C7_REPORT_PATH, JSON.stringify({
    gate: 'C7_HEADLESS_PLANNER_CERTIFIED', status: 'YES', passed, fixtures, rpcEnvironment: 'PGLITE_SYNTHETIC_ONLY',
    remoteWrites: 0, historicalCanaryWrites: 0, canaryTables: 8
  }, null, 2));
} finally { await pg.close(); }
