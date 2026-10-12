import assert from 'node:assert/strict';
import { require } from './lib/phase2-ts-loader.mjs';
import { fixture, state, rebuild, control, uuid, householdId } from './fixtures/planner-simple-levers.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';

const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { previewPlanScenario, applyPlanScenario } = require('@/server/phase2/planner/apply');
const { resolveEffectiveMonthScenario } = require('@/server/phase2/planner/effective-month-scenario');
const { appliedPlanControls } = require('@/server/phase2/planner/applied-plan-read');
const { stageLocalDecision } = require('@/app/mois-a-venir/composer/local-draft');
const { semanticStateDigest, parsePlanSemanticState } = require('@/domain/phase2/planner/semantic-state');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { AppliedMonthView } = require('@/app/mois-a-venir/applied-month-view');

const adjustable = `savings:${uuid(700)}`, protectedRef = `savings:${uuid(701)}`;
const checks = [];
const check = async (id, run) => { await run(); checks.push(id); console.log(`${id} PASS`); };
const command = (preview, id) => ({ expectedActiveRevisionId: preview.baseActiveRevisionId,
  expectedActiveRevisionNumber: preview.baseRevisionNumber, expectedBaselineDigest: preview.baselineDigest,
  expectedPreviewDigest: preview.previewDigest, applyRequestId: uuid(id) });
const mutate = (ref, amount) => ({ kind: 'MUTATE', mutation: { kind: 'SET_STATE', targetRef: ref, value: { amount } } });
const makeDeps = (pg, world) => ({ repository: createPlanApplyRepository(pg.client), readWorld: async () => structuredClone(world),
  readDirectWorld: async () => ({ forecast: world.forecast, monthInputs: world.monthInputs,
    externalIntents: world.externalIntents, asOfDate: world.asOfDate }) });
const accepted = response => { assert.equal(response.ok, true, response.code); return response.model; };

const pg = await createKernelPostgres();
const world = fixture();
world.monthInputs.declaredOutflows.push({ id: uuid(701), label: 'Cagnotte protégée fictive', kind: 'SAVINGS',
  amount: '30.00', dueDate: null, adjustability: 'PROTECTED', source: 'MONTH_INPUT', annualGoalRef: null });
rebuild(world);
const deps = makeDeps(pg, world);
let sequence = 0;
const request = (operation, draft) => handleComposerRequest(deps, householdId,
  { sequence: ++sequence, targetMonth: '2026-11', draft, ...operation });
try {
  const initial = accepted(await request({ kind: 'READ' }, state()));
  await check('SAVE-01', () => {
    assert.equal(initial.board.savings.length, 2);
    assert.equal(initial.board.savings.find(card => card.targetRef === adjustable).label, 'Synthetic adjustable saving');
    assert.equal(initial.board.savings.find(card => card.targetRef === adjustable).value.declaredAmount, '100.00');
    assert.equal(initial.board.savings.find(card => card.targetRef === protectedRef).value.reservationAdjustability, 'PROTECTED');
    assert.equal(initial.board.savings.find(card => card.targetRef === adjustable).value.reservationSource, 'MONTH_INPUT');
  });
  const chosen = accepted(await request(mutate(adjustable, '40.00'), initial.semanticState));
  await check('SAVE-02', () => {
    assert.deepEqual(chosen.board.savings.find(card => card.targetRef === adjustable).capability.actions, ['SET_SAVINGS_ALLOCATION']);
    assert.equal(chosen.board.savings.find(card => card.targetRef === adjustable).value.amount, '40.00');
    assert.equal(chosen.semanticState.controls.length, 1);
    assert.equal(chosen.semanticState.controls[0].decisionSlotKey, adjustable);
    assert.equal(chosen.semanticState.controls[0].provenance, 'EXPLICIT_USER_DECISION');
    assert.equal(semanticStateDigest(parsePlanSemanticState(JSON.parse(JSON.stringify(chosen.semanticState)))), semanticStateDigest(chosen.semanticState));
  });
  await check('SAVE-03', async () => {
    const before = await previewPlanScenario(deps, householdId, initial.semanticState);
    const after = await previewPlanScenario(deps, householdId, chosen.semanticState);
    assert.equal(Number(after.projection.plan.economicMonthEndRemainder) - Number(before.projection.plan.economicMonthEndRemainder), 60);
    assert.equal(Number(before.projection.economic.savingsReservations) - Number(after.projection.economic.savingsReservations), 60);
    assert.equal(after.compiled.financialAdapterInput.plannedExpenseEntries.length, 0);
    assert.equal(after.compiled.financialAdapterInput.effectiveMonthInputs.declaredOutflows.find(row => row.id === uuid(700)).amount, '40.00');
    assert.equal(world.monthInputs.declaredOutflows.find(row => row.id === uuid(700)).amount, '100.00');
  });
  await check('SAVE-04', async () => {
    const rejected = await request(mutate(adjustable, '1000000000.00'), chosen.semanticState);
    assert.equal(rejected.ok, false); assert.match(rejected.code, /AMOUNT_INVALID/);
    assert.equal(pg.rpcCalls, 0);
  });
  await check('SAVE-05', async () => {
    const card = initial.board.savings.find(item => item.targetRef === protectedRef);
    assert.deepEqual(card.capability.actions, []);
    assert.equal(initial.presentation.dragSources[`control:${protectedRef}`].protected, true);
    const rejected = await request(mutate(protectedRef, '0.00'), initial.semanticState);
    assert.equal(rejected.ok, false); assert.match(rejected.code, /CONTROL_LOCKED/);
    const forged = state([control(protectedRef, { amount: '0.00' })]);
    const preview = await previewPlanScenario(deps, householdId, forged);
    assert.equal(preview.projection.applyReadiness, 'BLOCKED');
    await assert.rejects(() => applyPlanScenario(deps, householdId, forged, command(preview, 9811)), /PLANNER_APPLY_BLOCKED/);
  });
  await check('SAVE-06', async () => {
    assert.equal(initial.dropCapabilities.some(cap => cap.sourceAssetKey === `control:${protectedRef}` && cap.target.kind === 'TRASH' && cap.resolution !== 'BLOCKED'), false);
    const rejected = await request({ kind: 'DROP', assetKey: `control:${protectedRef}`, target: { kind: 'TRASH' },
      values: {}, identity: uuid(701), selectionId: uuid(701) }, initial.semanticState);
    assert.equal(rejected.ok, false);
    assert.equal(pg.rpcCalls, 0);
  });
  await check('SAVE-07', async () => {
    assert.ok(world.baseline.structuralFacts.savingsReservations.some(row => row.reservationId === 'policy:safety-reserve'));
    assert.equal(initial.board.savings.some(card => card.targetRef === 'savings:policy:safety-reserve'), false);
    assert.equal(initial.library.searchableAssets.some(asset => asset.capabilityRef === 'savings:policy:safety-reserve'), false);
    const rejected = await request(mutate('savings:policy:safety-reserve', '0.00'), initial.semanticState);
    assert.equal(rejected.ok, false);
  });
  await check('SAVE-08', () => {
    const staged = stageLocalDecision(initial, initial.semanticState, mutate(adjustable, '40.00'));
    assert.deepEqual(staged, chosen.semanticState);
    const undone = initial.semanticState, redone = stageLocalDecision(initial, undone, mutate(adjustable, '40.00'));
    assert.deepEqual(redone, staged);
    assert.equal(stageLocalDecision(initial, initial.semanticState, mutate(protectedRef, '0.00')), null);
  });
  await check('SAVE-12', async () => {
    const zero = accepted(await request(mutate(adjustable, '0.00'), chosen.semanticState));
    assert.equal(zero.board.savings.find(card => card.targetRef === adjustable).value.amount, '0.00');
    assert.equal(zero.semanticState.controls[0].decisionId, chosen.semanticState.controls[0].decisionId);
    const preview = await previewPlanScenario(deps, householdId, zero.semanticState);
    assert.notEqual(preview.projection.applyReadiness, 'BLOCKED');
    assert.equal(preview.compiled.financialAdapterInput.effectiveMonthInputs.declaredOutflows.find(row => row.id === uuid(700)).amount, '0.00');
  });
  const applied = accepted(await request({ kind: 'APPLY', command: { ...chosen.proof, applyRequestId: uuid(9812) } }, chosen.semanticState));
  await check('SAVE-09', async () => {
    assert.equal(applied.activeRevisionNumber, 1);
    const stored = await deps.repository.readActivePlan(householdId, '2026-11');
    assert.equal(stored.activeRevision.semanticState.controls[0].value.amount, '40.00');
    assert.equal(stored.activeRevision.semanticState.controls[0].decisionId, chosen.semanticState.controls[0].decisionId);
    const reload = accepted(await request({ kind: 'READ' }));
    assert.equal(reload.board.savings.find(card => card.targetRef === adjustable).value.amount, '40.00');
    assert.equal(reload.board.draft.dirty, false);
    await pg.verifyCanaries();
  });
  await check('SAVE-10', async () => {
    const effective = await resolveEffectiveMonthScenario(deps, householdId, '2026-11');
    assert.equal(effective.evidenceStatus, 'EXACT');
    const controls = appliedPlanControls(effective.preview.compiled, effective.semanticState, effective.revision.baselineSnapshot);
    assert.equal(controls.find(item => item.slotIdentityKey === adjustable).savings.declaredAmount, '100.00');
    assert.equal(controls.find(item => item.slotIdentityKey === adjustable).amount, '40.00');
    const html = renderToStaticMarkup(React.createElement(AppliedMonthView, { projection: effective.projection,
      semanticState: effective.semanticState, controls, plan: null, revision: 1,
      composerHref: '/mois-a-venir/composer?month=2026-11', today: world.asOfDate }));
    assert.match(html, new RegExp(`data-plan-saving="${uuid(700)}"`));
    assert.match(html, /40,00/); assert.match(html, /déclaré 100,00/);
    assert.equal(effective.preview.compiled.financialAdapterInput.plannedExpenseEntries.length, 0);
  });
  await check('SAVE-11', async () => {
    const pending = accepted(await request(mutate(adjustable, '50.00'), applied.semanticState));
    world.monthInputs.declaredOutflows.find(row => row.id === uuid(700)).amount = '120.00';
    rebuild(world);
    const saved = await deps.repository.readActivePlan(householdId, '2026-11');
    const currentPreview = await previewPlanScenario(deps, householdId, saved.activeRevision.semanticState);
    assert.equal(appliedPlanControls(currentPreview.compiled, saved.activeRevision.semanticState,
      saved.activeRevision.baselineSnapshot).find(item => item.slotIdentityKey === adjustable).savings.declaredAmount, '100.00');
    const latest = accepted(await request({ kind: 'READ' }, pending.semanticState));
    assert.equal(latest.board.savings.find(card => card.targetRef === adjustable).value.amount, '50.00');
    assert.equal(latest.board.savings.find(card => card.targetRef === adjustable).value.declaredAmount, '120.00');
    const rejected = await request({ kind: 'APPLY', command: { ...pending.proof, applyRequestId: uuid(9813) } }, pending.semanticState);
    assert.equal(rejected.ok, false); assert.match(rejected.code, /PREVIEW_STALE/);
    assert.deepEqual(await pg.counts(), { plans: 1, revisions: 1 });
    world.monthInputs.declaredOutflows.find(row => row.id === uuid(700)).adjustability = 'PROTECTED';
    rebuild(world);
    const incompatible = await previewPlanScenario(deps, householdId, pending.semanticState);
    assert.equal(incompatible.projection.applyReadiness, 'BLOCKED');
    assert.equal(incompatible.compiled.constraints.some(item => item.code === 'PROTECTED_SAVINGS_RELEASE_FORBIDDEN'), true);
    assert.equal(pending.semanticState.controls[0].value.amount, '50.00');
  });
  await pg.verifyCanaries();
} finally { await pg.close(); }

const redPg = await createKernelPostgres();
try {
  const redWorld = fixture(), redDeps = makeDeps(redPg, redWorld);
  const apply = async (semantic, id) => {
    const preview = await previewPlanScenario(redDeps, householdId, semantic);
    assert.notEqual(preview.projection.applyReadiness, 'BLOCKED');
    return applyPlanScenario(redDeps, householdId, semantic, command(preview, id));
  };
  await apply(state(), 9821);
  await apply(state([control(adjustable, { amount: '90.00' })]), 9822);
  await check('RED-04', async () => {
    const tabA = state([control(adjustable, { amount: '50.00' })]);
    const pending = await previewPlanScenario(redDeps, householdId, tabA);
    assert.equal(pending.baseRevisionNumber, 2);
    await apply(state([control(adjustable, { amount: '80.00' })]), 9823);
    await assert.rejects(() => applyPlanScenario(redDeps, householdId, tabA, command(pending, 9824)), /PLANNER_ACTIVE_REVISION_STALE/);
    const official = await redDeps.repository.readActivePlan(householdId, '2026-11');
    assert.equal(official.plan.activeRevisionNumber, 3);
    assert.equal(official.activeRevision.semanticState.controls[0].value.amount, '80.00');
    assert.equal(tabA.controls[0].value.amount, '50.00');
    assert.deepEqual(await redPg.counts(), { plans: 1, revisions: 3 });
    await redPg.verifyCanaries();
  });
} finally { await redPg.close(); }
console.log(JSON.stringify({ status: 'EXECUTED_PASS_PGLITE_SYNTHETIC_ONLY', checks, remoteWrites: 0,
  authenticatedApplyReload: 'NOT_RUN', browserAutosave: 'NOT_RUN' }));
