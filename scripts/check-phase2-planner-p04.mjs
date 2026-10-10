import assert from 'node:assert/strict';
import fs from 'node:fs';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { fixture, state, uuid, householdId, findSlot, rebuild, weekendMonth } from './fixtures/planner-headless.mjs';
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { resolveEffectiveMonthScenario } = require('@/server/phase2/planner/effective-month-scenario');
const { appliedPlanControls } = require('@/server/phase2/planner/applied-plan-read');
const { previewPlanScenario } = require('@/server/phase2/planner/apply');
const { evaluatePlanScenario } = require('@/server/phase2/planner/preview');
const { stageLocalDecision } = require('@/app/mois-a-venir/composer/local-draft');
const { ComposerResponseGate } = require('@/app/mois-a-venir/composer/draft-controller');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { AppliedMonthView } = require('@/app/mois-a-venir/applied-month-view');
const pg = await createKernelPostgres(), world = fixture(), repository = createPlanApplyRepository(pg.client);
const grocery = findSlot(world, 'groceries'), targetRef = grocery.slotIdentityKey;
let sequence = 0, failReadAfterRpc = Infinity;
const deps = { repository, readWorld: async () => { if (pg.rpcCalls >= failReadAfterRpc) throw new Error('SYNTHETIC_POST_COMMIT_READ_FAILURE'); return world; },
  readDirectWorld: async () => ({ forecast: world.forecast, monthInputs: world.monthInputs, externalIntents: world.externalIntents, asOfDate: world.asOfDate }) };
const request = (operation, draft) => handleComposerRequest(deps, householdId, { sequence: ++sequence, targetMonth: '2026-11', draft, ...operation });
const ok = response => { assert.equal(response.ok, true, response.code); return response.model; };
const checks = [], check = async (name, fn) => { await fn(); checks.push(name); console.log(`${name} PASS`); };
const mutation = amount => ({ kind: 'MUTATE', mutation: { kind: 'SET_STATE', targetRef, value: { amount } } });
try {
  const initial = ok(await request({ kind: 'READ' }, state()));
  await check('P04-01-LIBRARY-BOARD-ONE-SLOT', () => {
    assert.equal(grocery.baselineValue.amount, '325.00');
    assert.equal(initial.board.baselineControls.filter(card => card.targetRef === targetRef).length, 1);
    assert.equal(initial.library.searchableAssets.filter(asset => asset.assetKey === `control:${targetRef}`).length, 1);
    assert.equal(initial.dropCapabilities.filter(capability => capability.sourceAssetKey === `control:${targetRef}` && capability.target.kind === 'BOARD_ZONE').length, 0);
    assert.equal(initial.semanticState.controls.length, 0);
    assert.equal(initial.board.baselineControls.find(card => card.targetRef === targetRef).historicalReferences.range.central, '325.00');
  });
  await check('P04-02-S2-EXPLORATION-SEPARATE', async () => {
    const hypothetical = ok(await request(mutation('350.00'), initial.semanticState));
    assert.equal(initial.semanticState.controls.length, 0);
    assert.equal(initial.board.baselineControls.find(card => card.targetRef === targetRef).value.owned, false);
    assert.equal(hypothetical.semanticState.controls.length, 1);
    assert.equal(hypothetical.semanticState.controls[0].provenance, 'EXPLICIT_USER_DECISION');
    assert.notEqual(hypothetical.board.draft.semanticStateDigest, initial.board.draft.semanticStateDigest);
    assert.equal(pg.rpcCalls, 0);
  });
  await check('P04-02B-ZERO-UNKNOWN-ABSENT-DISTINCT', async () => {
    const zero = ok(await request(mutation('0'), initial.semanticState));
    const slot = zero.board.baselineControls.find(card => card.targetRef === targetRef);
    assert.equal(slot.value.amount, '0'); assert.equal(slot.value.owned, true);
    const preview = await previewPlanScenario(deps, householdId, zero.semanticState);
    assert.equal(Number(preview.compiled.planSlots.find(candidate => candidate.baseline.slotIdentityKey === targetRef).effectiveAmount), 0);
    assert.equal(initial.semanticState.controls.length, 0);
    assert.equal(initial.board.baselineControls.find(card => card.targetRef === targetRef).value.amount, '325.00');
    assert.ok(world.baseline.slots.some(other => other.baselineValue.amount === null && other.baselineValue.count === null));
  });
  await check('P04-02C-TWO-MONTHS-NO-MEDIAN', () => {
    const thin = fixture(), closed = thin.sources.periods.filter(period => period.isClosed).slice(-2).map(period => period.month.slice(0, 7));
    thin.sources.periods = thin.sources.periods.map(period => ({ ...period, isClosed: closed.includes(period.month.slice(0, 7)) }));
    rebuild(thin);
    const slot = findSlot(thin, 'groceries');
    assert.equal(slot.historicalReferences.comparableMonths.length, 2);
    assert.equal(slot.historicalReferences.range.central, null);
    assert.equal(slot.baselineValue.amount, null);
  });
  const chosen = ok(await request(mutation('350.00'), initial.semanticState));
  await check('P04-03-325-TO-350-SUBSTITUTION', async () => {
    const before = await previewPlanScenario(deps, householdId, initial.semanticState);
    const after = await previewPlanScenario(deps, householdId, chosen.semanticState);
    assert.equal(after.compiled.planSlots.filter(slot => slot.baseline.slotIdentityKey === targetRef).length, 1);
    assert.equal(after.compiled.planSlots.find(slot => slot.baseline.slotIdentityKey === targetRef).effectiveAmount, '350.00');
    assert.equal(Number(after.projection.economic.needsAndHabits) - Number(before.projection.economic.needsAndHabits), 25);
    assert.equal(Number(before.projection.plan.economicMonthEndRemainder) - Number(after.projection.plan.economicMonthEndRemainder), 25);
    assert.equal(after.compiled.financialAdapterInput.adapterManifest.planOwnedDecisionSlots.filter(key => key === targetRef).length, 1);
    assert.equal(chosen.semanticState.controls.length, 1);
  });
  await check('P04-03B-350-BACK-TO-325', async () => {
    const restored = ok(await request(mutation('325.00'), chosen.semanticState));
    assert.equal(restored.semanticState.controls.length, 1);
    const baseline = await previewPlanScenario(deps, householdId, initial.semanticState);
    const back = await previewPlanScenario(deps, householdId, restored.semanticState);
    assert.equal(back.compiled.planSlots.find(slot => slot.baseline.slotIdentityKey === targetRef).effectiveAmount, '325.00');
    assert.equal(back.projection.plan.economicMonthEndRemainder, baseline.projection.plan.economicMonthEndRemainder);
  });
  await check('P04-03C-STAY-GROCERIES-BINDING', () => {
    for (const confirmed of [false, true]) {
      const stay = weekendMonth(confirmed), preview = evaluatePlanScenario(stay.world, stay.semantic,
        { expectedActiveRevisionId: null, expectedActiveRevisionNumber: 0 });
      const linked = preview.compiled.components.filter(component => component.binding.slotIdentityKey === targetRef);
      assert.equal(linked.length, 1);
      assert.equal(linked[0].binding.relation, confirmed ? 'CONSUMES_SLOT' : 'UNRESOLVED');
      assert.equal(preview.compiled.planSlots.filter(slot => slot.baseline.slotIdentityKey === targetRef).length, 1);
    }
  });
  await check('P04-04-UNDO-REDO-DIGESTS', () => {
    const operation = mutation('350.00');
    const staged = stageLocalDecision(initial, initial.semanticState, operation);
    assert.deepEqual(staged, chosen.semanticState);
    const undone = initial.semanticState, redone = stageLocalDecision(initial, undone, operation);
    assert.deepEqual(redone, staged);
    const gate = new ComposerResponseGate(), old = gate.next(initial.board.draft.semanticStateDigest), newest = gate.next(chosen.board.draft.semanticStateDigest);
    assert.equal(gate.accepts(old, old.sequence, chosen.board.draft.semanticStateDigest), false);
    assert.equal(gate.accepts(newest, newest.sequence, chosen.board.draft.semanticStateDigest), true);
  });
  const applyId = uuid(9401), command = { ...chosen.proof, applyRequestId: applyId };
  const applied = ok(await request({ kind: 'APPLY', command }, chosen.semanticState));
  await check('P04-05-APPLY-REVISION-RELOAD', async () => {
    assert.equal(applied.activeRevisionNumber, 1);
    assert.equal(pg.rpcCalls, 1);
    const stored = await repository.readActivePlan(householdId, '2026-11');
    assert.equal(stored.activeRevision.semanticState.controls[0].decisionSlotKey, targetRef);
    assert.equal(stored.activeRevision.semanticState.controls[0].value.amount, '350.00');
    assert.equal(stored.activeRevision.semanticState.controls[0].decisionId, chosen.semanticState.controls[0].decisionId);
    assert.equal(stored.activeRevision.baselineSnapshot.slots.find(slot => slot.slotIdentityKey === targetRef).baselineValue.amount, '325.00');
    const reloaded = ok(await request({ kind: 'READ' }));
    assert.deepEqual(reloaded.semanticState, chosen.semanticState);
    assert.equal(reloaded.board.baselineControls.find(card => card.targetRef === targetRef).value.amount, '350.00');
    assert.equal(reloaded.board.draft.dirty, false);
  });
  await check('P04-06-MON-PLAN-REEDIT', async () => {
    const effective = await resolveEffectiveMonthScenario(deps, householdId, '2026-11');
    assert.equal(effective.owner, 'PLAN_V1'); assert.equal(effective.evidenceStatus, 'EXACT');
    const controls = appliedPlanControls(effective.preview.compiled, effective.semanticState, effective.preview.baseline);
    assert.equal(controls.filter(control => control.slotIdentityKey === targetRef).length, 1);
    assert.equal(controls.find(control => control.slotIdentityKey === targetRef).amount, '350.00');
    assert.equal(controls.find(control => control.slotIdentityKey === targetRef).decisionId, chosen.semanticState.controls[0].decisionId);
    const html = renderToStaticMarkup(React.createElement(AppliedMonthView, { projection: effective.projection,
      semanticState: effective.semanticState, controls, plan: null, revision: effective.revision.revisionNumber,
      composerHref: '/mois-a-venir/composer?month=2026-11', today: world.asOfDate }));
    assert.match(html, /data-my-plan/); assert.match(html, /data-plan-control="HOUSEHOLD:household:groceries"/);
    assert.match(html, /350,00/); assert.match(html, /Rééditer mon Plan/);
  });
  await check('P04-07-HISTORY-CHANGE-PRESERVES-CHOICE', async () => {
    const old = world.sources.food.months;
    world.sources.food.months = old.map(row => [row[0], String(Number(row[1]) + 15), ...row.slice(2)]);
    rebuild(world);
    const reloaded = ok(await request({ kind: 'READ' }));
    assert.equal(reloaded.board.baselineControls.find(card => card.targetRef === targetRef).value.amount, '350.00');
    assert.equal(reloaded.board.baselineControls.find(card => card.targetRef === targetRef).historicalReferences.range.central, '340.00');
    world.sources.food.months = old; rebuild(world);
  });
  await check('P04-07B-RED-01-UPDATED-HISTORY-BEFORE-APPLY', async () => {
    const redPg = await createKernelPostgres(), redWorld = fixture(), redRepository = createPlanApplyRepository(redPg.client);
    const redDeps = { repository: redRepository, readWorld: async () => redWorld,
      readDirectWorld: async () => ({ forecast: redWorld.forecast, monthInputs: redWorld.monthInputs,
        externalIntents: redWorld.externalIntents, asOfDate: redWorld.asOfDate }) };
    let redSequence = 0;
    const redRequest = (operation, draft) => handleComposerRequest(redDeps, householdId,
      { sequence: ++redSequence, targetMonth: '2026-11', draft, ...operation });
    try {
      const before = ok(await redRequest({ kind: 'READ' }, state()));
      assert.equal(before.board.baselineControls.find(card => card.targetRef === targetRef).historicalReferences.range.central, '325.00');
      const selected = ok(await redRequest(mutation('350.00'), before.semanticState));
      redWorld.sources.food.months = redWorld.sources.food.months.map(row => [row[0], String(Number(row[1]) + 15), ...row.slice(2)]);
      rebuild(redWorld);
      const refreshed = ok(await redRequest({ kind: 'READ' }, selected.semanticState));
      const card = refreshed.board.baselineControls.find(item => item.targetRef === targetRef);
      assert.equal(card.historicalReferences.range.central, '340.00');
      assert.equal(card.value.amount, '350.00');
      assert.equal(refreshed.semanticState.controls[0].decisionId, selected.semanticState.controls[0].decisionId);
      const committed = ok(await redRequest({ kind: 'APPLY', command: { ...refreshed.proof, applyRequestId: uuid(9403) } }, refreshed.semanticState));
      assert.equal(committed.activeRevisionNumber, 1);
      const stored = await redRepository.readActivePlan(householdId, '2026-11');
      assert.equal(stored.activeRevision.semanticState.controls[0].value.amount, '350.00');
      assert.equal(stored.activeRevision.semanticState.controls[0].decisionId, selected.semanticState.controls[0].decisionId);
      assert.equal(stored.activeRevision.baselineSnapshot.slots.find(slot => slot.slotIdentityKey === targetRef).baselineValue.amount, '340.00');
      assert.equal(redPg.rpcCalls, 1);
      await redPg.verifyCanaries();
    } finally { await redPg.close(); }
  });
  await check('P04-08-IMMUTABLE-REPLAY', async () => {
    const replay = ok(await request({ kind: 'APPLY', command }, chosen.semanticState));
    assert.equal(replay.activeRevisionNumber, 1);
    assert.deepEqual(await pg.counts(), { plans: 1, revisions: 1 });
  });
  await check('P04-09-POST-COMMIT-READ-FAILURE', async () => {
    const next = ok(await request(mutation('360.00'), chosen.semanticState));
    failReadAfterRpc = pg.rpcCalls + 1;
    const result = await request({ kind: 'APPLY', command: { ...next.proof, applyRequestId: uuid(9402) } }, next.semanticState);
    failReadAfterRpc = Infinity;
    assert.equal(result.ok, false); assert.equal(result.applied, true); assert.equal(result.revisionNumber, 2);
    assert.equal(result.code, 'COMPOSER_APPLIED_RELOAD_UNAVAILABLE');
    assert.match(result.message, /enregistrée/);
    assert.deepEqual(await pg.counts(), { plans: 1, revisions: 2 });
    const reloaded = ok(await request({ kind: 'READ' }));
    assert.equal(reloaded.board.baselineControls.find(card => card.targetRef === targetRef).value.amount, '360.00');
    assert.equal(reloaded.board.draft.dirty, false);
  });
  await check('P04-10-NO-TRANSVERSE-WRITES', async () => { await pg.verifyCanaries(); });
  const report = { status: 'EXECUTED_PASS_PGLITE_SYNTHETIC_ONLY', checks, rpcCalls: pg.rpcCalls,
    counts: await pg.counts(), authenticated: 'NOT_RUN', remoteWrites: 0, canaryWrites: 0 };
  if (process.env.PLANNER_P04_REPORT_PATH) fs.writeFileSync(process.env.PLANNER_P04_REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await pg.close(); }
