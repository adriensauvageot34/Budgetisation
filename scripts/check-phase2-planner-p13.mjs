import assert from 'node:assert/strict';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { fixture, state, uuid, householdId, findSlot, rebuild } from './fixtures/planner-headless.mjs';

const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { resolveEffectiveMonthScenario } = require('@/server/phase2/planner/effective-month-scenario');
const { appliedPlanRevisionControls } = require('@/server/phase2/planner/applied-plan-read');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { AppliedMonthView } = require('@/app/mois-a-venir/applied-month-view');

const pg = await createKernelPostgres(), world = fixture(), repository = createPlanApplyRepository(pg.client);
let sequence = 0, failWorldAfterRpc = Infinity, worldReads = 0;
const deps = { repository, readWorld: async () => {
  worldReads++;
  if (pg.rpcCalls >= failWorldAfterRpc) throw new Error('SYNTHETIC_WORLD_UNAVAILABLE');
  return world;
}, readDirectWorld: async () => ({ forecast: world.forecast, monthInputs: world.monthInputs,
  externalIntents: world.externalIntents, asOfDate: world.asOfDate }) };
const request = (operation, draft, using = deps) => handleComposerRequest(using, householdId,
  { sequence: ++sequence, targetMonth: '2026-11', draft, ...operation });
const ok = response => { assert.equal(response.ok, true, response.code); return response.model; };
const checks = [], check = async (name, fn) => { await fn(); checks.push(name); console.log(`${name} PASS`); };
const targetRef = findSlot(world, 'groceries').slotIdentityKey;
const mutation = amount => ({ kind: 'MUTATE', mutation: { kind: 'SET_STATE', targetRef, value: { amount } } });

try {
  const initial = ok(await request({ kind: 'READ' }, state()));
  const firstDraft = ok(await request(mutation('350.00'), initial.semanticState));
  const firstCommand = { ...firstDraft.proof, applyRequestId: uuid(13001) };
  const first = await request({ kind: 'APPLY', command: firstCommand }, firstDraft.semanticState);
  await check('P13-01-APPLIED-RECEIPT', async () => {
    ok(first); assert.equal(first.applyReceipt.outcome, 'APPLIED'); assert.equal(first.applyReceipt.headStatus, 'ACTIVE');
    assert.equal(first.applyReceipt.revisionNumber, 1); assert.equal(first.applyReceipt.applyRequestId, firstCommand.applyRequestId);
    assert.equal(first.applyReceipt.semanticStateDigest, firstDraft.board.draft.semanticStateDigest);
    assert.deepEqual(await pg.counts(), { plans: 1, revisions: 1 });
  });
  await check('P13-02-REPLAY-AND-PAYLOAD-CONFLICT', async () => {
    const writes = pg.rpcCalls;
    const replay = await request({ kind: 'APPLY', command: firstCommand }, firstDraft.semanticState);
    ok(replay); assert.equal(replay.applyReceipt.outcome, 'REPLAYED'); assert.equal(replay.applyReceipt.headStatus, 'ACTIVE');
    assert.equal(pg.rpcCalls, writes);
    const different = ok(await request(mutation('360.00'), firstDraft.semanticState));
    const conflict = await request({ kind: 'APPLY', command: firstCommand }, different.semanticState);
    assert.equal(conflict.ok, false); assert.equal(conflict.code, 'PLANNER_IDEMPOTENCY_CONFLICT');
    assert.equal(pg.rpcCalls, writes);
  });
  const secondDraft = ok(await request(mutation('360.00'), firstDraft.semanticState));
  const secondCommand = { ...secondDraft.proof, applyRequestId: uuid(13002) };
  await check('P13-03-LOST-RPC-RESPONSE-RECOVERED', async () => {
    const lost = { ...deps, repository: { ...repository, applyRevision: async input => {
      await repository.applyRevision(input); throw new Error('SYNTHETIC_RESPONSE_LOST');
    } } };
    const result = await request({ kind: 'APPLY', command: secondCommand }, secondDraft.semanticState, lost);
    ok(result); assert.equal(result.applyReceipt.outcome, 'REPLAYED'); assert.equal(result.applyReceipt.headStatus, 'ACTIVE');
    assert.deepEqual(await pg.counts(), { plans: 1, revisions: 2 });
  });
  const thirdDraft = ok(await request(mutation('370.00'), secondDraft.semanticState));
  const thirdCommand = { ...thirdDraft.proof, applyRequestId: uuid(13003) };
  await check('P13-04-COMMIT-THEN-RELOAD-FAILS', async () => {
    failWorldAfterRpc = pg.rpcCalls + 1;
    const result = await request({ kind: 'APPLY', command: thirdCommand }, thirdDraft.semanticState);
    assert.equal(result.ok, false); assert.equal(result.applied, true);
    assert.equal(result.code, 'COMPOSER_APPLIED_RELOAD_UNAVAILABLE');
    assert.equal(result.applyReceipt.revisionNumber, 3); assert.equal(result.applyReceipt.headStatus, 'UNAVAILABLE');
    const writes = pg.rpcCalls, reads = worldReads;
    const recovered = await request({ kind: 'CHECK_APPLY', command: thirdCommand }, thirdDraft.semanticState);
    assert.equal(recovered.ok, false); assert.equal(recovered.applied, true);
    assert.equal(recovered.applyReceipt.planRevisionId, result.applyReceipt.planRevisionId);
    assert.equal(pg.rpcCalls, writes); assert.equal(worldReads, reads + 1);
    failWorldAfterRpc = Infinity;
    const refreshed = await request({ kind: 'CHECK_APPLY', command: thirdCommand }, thirdDraft.semanticState);
    ok(refreshed); assert.equal(refreshed.applyReceipt.headStatus, 'ACTIVE');
    assert.equal(refreshed.applyReceipt.planRevisionId, result.applyReceipt.planRevisionId);
    assert.equal(pg.rpcCalls, writes);
  });
  await check('P13-05-OLD-REPLAY-DOES-NOT-REACTIVATE', async () => {
    const writes = pg.rpcCalls;
    const replay = await request({ kind: 'APPLY', command: firstCommand }, firstDraft.semanticState);
    ok(replay); assert.equal(replay.applyReceipt.outcome, 'REPLAYED');
    assert.equal(replay.applyReceipt.revisionNumber, 1); assert.equal(replay.applyReceipt.headStatus, 'SUPERSEDED');
    assert.equal(replay.model.activeRevisionNumber, 3); assert.equal(pg.rpcCalls, writes);
  });
  await check('P13-05B-AMBIGUOUS-SERVER-READ-RECOVERED', async () => {
    const writes = pg.rpcCalls;
    const unavailable = { ...deps, repository: { ...repository, readAppliedRequest: async () => {
      throw new Error('SYNTHETIC_REQUEST_LOOKUP_UNAVAILABLE');
    } } };
    const unknown = await request({ kind: 'APPLY', command: firstCommand }, firstDraft.semanticState, unavailable);
    assert.equal(unknown.ok, false); assert.equal(unknown.code, 'COMPOSER_APPLY_UNCONFIRMED');
    const confirmed = await request({ kind: 'CHECK_APPLY', command: firstCommand }, firstDraft.semanticState);
    ok(confirmed); assert.equal(confirmed.applyReceipt.revisionNumber, 1);
    assert.equal(confirmed.applyReceipt.headStatus, 'SUPERSEDED'); assert.equal(pg.rpcCalls, writes);
  });
  await check('P13-06-STALE-CAS-AND-UNCONFIRMED-READ', async () => {
    const writes = pg.rpcCalls;
    const stale = await request({ kind: 'APPLY', command: { ...secondDraft.proof, applyRequestId: uuid(13004) } }, secondDraft.semanticState);
    assert.equal(stale.ok, false); assert.equal(stale.code, 'PLANNER_ACTIVE_REVISION_STALE');
    const missing = await request({ kind: 'CHECK_APPLY', command: { ...thirdDraft.proof, applyRequestId: uuid(13005) } }, thirdDraft.semanticState);
    assert.equal(missing.ok, false); assert.equal(missing.code, 'COMPOSER_APPLY_UNCONFIRMED');
    assert.equal(pg.rpcCalls, writes); assert.deepEqual(await pg.counts(), { plans: 1, revisions: 3 });
  });
  await check('P13-07-HISTORICAL-DECISIONS-VS-CURRENT-PROJECTION', async () => {
    const stored = await repository.readActivePlan(householdId, '2026-11');
    const old = await repository.readAppliedRequest(householdId, '2026-11', firstCommand.applyRequestId);
    assert.equal(appliedPlanRevisionControls(old).find(control => control.slotIdentityKey === targetRef).amount, '350.00');
    assert.equal(appliedPlanRevisionControls(stored.activeRevision).find(control => control.slotIdentityKey === targetRef).amount, '370.00');
    const oldFood = world.sources.food.months;
    world.sources.food.months = oldFood.map(row => [row[0], String(Number(row[1]) + 15), ...row.slice(2)]);
    rebuild(world);
    const effective = await resolveEffectiveMonthScenario(deps, householdId, '2026-11');
    assert.equal(effective.evidenceStatus, 'CHANGED_AUTHORITIES');
    const historicalRemainder = stored.activeRevision.projectionEvidence.projection.plan.economicMonthEndRemainder;
    const html = renderToStaticMarkup(React.createElement(AppliedMonthView, { projection: effective.projection,
      semanticState: effective.semanticState, controls: appliedPlanRevisionControls(stored.activeRevision), plan: null,
      revision: stored.activeRevision.revisionNumber, evidenceStatus: effective.evidenceStatus,
      historicalRemainder, today: world.asOfDate }));
    assert.match(html, /data-applied-authorities-changed/);
    assert.match(html, /data-plan-control="HOUSEHOLD:household:groceries"/);
    assert.match(html, /370,00/);
    world.sources.food.months = oldFood; rebuild(world);
  });
  await pg.verifyCanaries();
  console.log(`P13_FIXTURE_PASS ${checks.length} checks; revisions=${(await pg.counts()).revisions}; rpcCalls=${pg.rpcCalls}`);
} finally { await pg.close(); }
