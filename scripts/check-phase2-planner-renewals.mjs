import assert from 'node:assert/strict';
import fs from 'node:fs';
import { require } from './lib/phase2-ts-loader.mjs';
import { fixture, state, control, uuid, householdId, context, component, selections, adrien, manon,
  keys, observations, rebuild, need, profile, needSlot, restock } from './fixtures/planner-renewals.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
const { buildRenewalReadModel } = require('@/server/phase2/planner/renewal-engine');
const { evaluatePlanScenario } = require('@/server/phase2/planner/preview');
const { previewPlanScenario, applyPlanScenario } = require('@/server/phase2/planner/apply');
const { resolveEffectiveMonthScenario } = require('@/server/phase2/planner/effective-month-scenario');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { parsePlanSemanticState } = require('@/domain/phase2/planner/semantic-state');
const { deriveMonthScenario } = require('@/server/phase2/month-scenario');
const { financialAdapterForecast } = require('@/server/phase2/planner/financial-adapter');
const passed = [], test = async (id, run) => { await run(); passed.push(id); console.log(`${id} PASS`); };
const base = { expectedActiveRevisionId: null, expectedActiveRevisionNumber: 0 };
const evaluate = (world, semantic = state()) => evaluatePlanScenario(world, semantic, base);
const pg = await createKernelPostgres(); let current = fixture(), requestId = 12000;
const deps = { repository: createPlanApplyRepository(pg.client), readWorld: async () => structuredClone(current),
  readDirectWorld: async () => ({ forecast: current.forecast, monthInputs: current.monthInputs, externalIntents: current.externalIntents, asOfDate: current.asOfDate }) };
const command = p => ({ expectedActiveRevisionId: p.baseActiveRevisionId, expectedActiveRevisionNumber: p.baseRevisionNumber,
  expectedBaselineDigest: p.baselineDigest, expectedPreviewDigest: p.previewDigest, applyRequestId: uuid(requestId++) });
async function roundTrip(world, semantic) {
  current = world; const before = structuredClone(world), p = await previewPlanScenario(deps, householdId, semantic);
  assert.notEqual(p.projection.applyReadiness, 'BLOCKED', JSON.stringify(p.compiled.constraints.filter(c => c.severity === 'BLOCK')));
  const applied = await applyPlanScenario(deps, householdId, semantic, command(p));
  assert.deepEqual(applied.projectionEvidence.projection, p.projection);
  const reload = await resolveEffectiveMonthScenario(deps, householdId, '2026-11');
  assert.equal(reload.evidenceStatus, 'EXACT'); assert.deepEqual(reload.scenario, p.scenario);
  assert.equal(reload.preview.compiledManifestDigest, p.compiledManifestDigest); assert.deepEqual(reload.preview.projection, p.projection);
  assert.deepEqual(world, before); await pg.verifyCanaries(); return p;
}
try {
  await test('REN-001', () => {
    const w = fixture(); w.sources.productObservations.push(...['blue', 'coconut'].map((product, i) => ({
      ...w.sources.productObservations[0], observationId: `mask-${i}`, needKey: 'synthetic-mask', productKey: product, observedAt: '2026-09-12' })));
    w.sources.needSubjects.mask = { needKey: 'synthetic-mask', personId: manon }; rebuild(w);
    const episodes = w.baseline.renewals.acquisitionEpisodes.filter(e => e.needId === 'mask');
    assert.equal(episodes.length, 1); assert.equal(episodes[0].observationIds.length, 2); assert.equal(episodes[0].productKeys.length, 2);
    assert.equal(w.baseline.renewals.replenishmentProfiles.find(p => p.needId === 'mask').intervalCount, 0);
  });
  await test('REN-002', () => {
    const w = fixture(); assert.notEqual(profile(w, 'mascara').medianGapDays, profile(w, 'brows').medianGapDays);
    const episodes = w.baseline.renewals.acquisitionEpisodes.filter(e => e.date === '2026-09-25');
    assert.equal(episodes.length, 2); assert.notEqual(episodes[0].acquisitionEpisodeId, episodes[1].acquisitionEpisodeId);
  });
  await test('REN-003', () => {
    const w = fixture(); assert.equal(need(w, 'brows').dueState, 'LATE');
    w.sources.periods.find(p => p.month.startsWith('2026-10')).financeStatus = 'partial'; rebuild(w);
    assert.equal(need(w, 'brows').dueState, 'UNKNOWN'); assert.equal(need(w, 'brows').autoEligible, false);
    assert.equal(profile(w, 'brows').coverageThrough, '2026-09-30'); assert.equal(needSlot(w, 'brows').baselineValue.count, null);
  });
  await test('REN-004', () => {
    const a = fixture(), b = fixture(); b.sources.productObservations = [...b.sources.productObservations.filter(o => o.needKey !== keys.mascara), ...observations(keys.mascara, [30, 30, 30, 30, 30])];
    rebuild(b); assert.equal(need(a, 'mascara').needOccurrenceId, need(b, 'mascara').needOccurrenceId);
    assert.equal(profile(b, 'mascara').status, 'REPLENISHMENT_CERTIFIED');
    assert.equal(need(a, 'mascara').dueWindow.central.slice(0, 7), '2026-11'); assert.equal(need(b, 'mascara').dueWindow.central.slice(0, 7), '2026-10');
  });
  await test('REN-005', async () => {
    const w = fixture(), p = await roundTrip(w, state([], [restock(w)]));
    assert.equal(p.compiled.components.length, 2); assert.equal(p.compiled.financialAdapterInput.adapterManifest.baselineConsumptions.length, 2);
    for (const name of ['mascara', 'brows']) {
      const component = p.compiled.components.find(c => c.needOccurrenceId === need(w, name).needOccurrenceId);
      assert.equal(component.binding.relation, 'CONSUMES_SLOT');
      const slot = p.compiled.planSlots.find(s => s.baseline.renewalAuthority?.needOccurrenceId === component.needOccurrenceId);
      assert.equal(slot.remainingCount, '0.00'); assert.equal(slot.remainingEconomicAmount, '0.00');
    }
    assert.equal(p.projection.economic.explicitContexts, '41.99'); assert.equal(p.projection.plan.impactOnMonthEnd, '-41.99');
  });
  await test('C6-006', async () => {
    const w = fixture(); w.sources.needSubjects['weak-household-haircut'] = { needKey: 'coiffeur_foyer', personId: null };
    w.sources.productObservations.push(...observations('coiffeur_foyer', [45, 45, 45], '2026-09-25', '90.00').map(o => ({ ...o, subject: { kind: 'HOUSEHOLD', householdId } }))); rebuild(w);
    const slot = w.baseline.slots.find(s => s.semanticKey === 'hairdresser'), hair = w.baseline.renewals.replenishmentProfiles.find(p => p.needKey === 'hairdresser');
    assert.equal(hair.authority, 'USER_VALIDATED'); assert.equal(hair.referencePriceBasis, 'INDICATIVE_PRICE_NOT_PAYMENT');
    assert.equal(slot.baselineValue.count, '2.00'); assert.equal(slot.baselineValue.unitAmount, '14.00');
    assert.equal(hair.medianGapDays, null);
    const p = await roundTrip(w, state([control(slot.slotIdentityKey, { count: '0' })]));
    assert.equal(p.projection.plan.impactOnMonthEnd, '28.00'); assert.equal(p.baselineDigest, w.baseline.digest);
  });
  await test('C6-007', async () => {
    const w = fixture(); w.sources.productObservations = observations(keys.mascara, [60]); rebuild(w);
    assert.equal(profile(w, 'mascara').status, 'DISCRETIONARY_OBSERVED'); assert.equal(need(w, 'mascara').autoEligible, false);
    assert.equal(needSlot(w, 'mascara').baselineValue.count, null); assert.deepEqual(need(w, 'mascara').dueWindow, { earliest: null, central: null, latest: null });
    const semantic = state([], [context(510, 'beauty-restock', { products: selections(component('product', '32.00', 'manual', { needOccurrenceId: need(w, 'mascara').needOccurrenceId })) })]);
    const p = await roundTrip(w, semantic); assert.equal(p.compiled.components[0].binding.relation, 'NO_RELATED_SLOT');
    assert.equal(p.projection.plan.impactOnMonthEnd, '-32.00'); assert.equal(p.compiled.financialAdapterInput.adapterManifest.baselineConsumptions.length, 0);
  });
  await test('C6-008', () => {
    const w = fixture(), p = evaluate(w, state([], [restock(w)]));
    assert.equal(new Set(p.compiled.components.map(c => c.needOccurrenceId)).size, 2);
    assert.equal(p.compiled.contexts.length, 1); assert.equal(p.compiled.needs.filter(n => ['synthetic-need:mascara', 'synthetic-need:brows'].includes(n.needId)).length, 2);
    assert.notEqual(profile(w, 'mascara').medianGapDays, profile(w, 'brows').medianGapDays);
  });
  await test('C6-009', () => {
    const w = fixture(), a = need(w, 'mascara'); w.sources.targetMonth = '2026-12'; w.sources.forecast.meta.targetMonth = '2026-12';
    rebuild(w); assert.equal(a.needOccurrenceId, need(w, 'mascara').needOccurrenceId); assert.equal(need(w, 'mascara').targetMonthRelation, 'OUTSIDE');
  });
  await test('C6-010', () => {
    assert.throws(() => parsePlanSemanticState(state([{ ...control('renewal:any', {}), kind: 'SWAP_PRODUCT' }])), /INVALID/);
    const w = fixture(), semantic = state([], [restock(w)]); semantic.contexts[0].slotSelections.products.items[0].replacementProductKey = 'forged';
    assert.throws(() => evaluate(w, semantic), /FIELD/);
  });
  await test('C6-011', () => {
    const w = fixture(), before = buildRenewalReadModel(w.sources);
    w.sources.productObservations.forEach(o => { o.groupKey = 'imaginary-shopping-session'; });
    assert.deepEqual(buildRenewalReadModel(w.sources), before);
    const p = evaluate(w); assert.equal(p.compiled.contexts.length, 0); assert.equal(p.compiled.components.length, 0);
    for (const name of ['renewal-engine', 'renewal-baseline', 'renewal-compiler']) assert.ok(!/\.\s*(?:insert|upsert|update|delete|rpc)\s*\(/u.test(fs.readFileSync(`src/server/phase2/planner/${name}.ts`, 'utf8')));
  });
  await test('C6-EXTRA-DETERMINISM', () => {
    const a = fixture(), b = fixture(); b.sources.productObservations.reverse(); b.sources.periods.reverse(); b.sources.habitAssertions.reverse(); rebuild(b);
    assert.deepEqual(a.baseline, b.baseline); assert.equal(evaluate(a).compiledManifestDigest, evaluate(b).compiledManifestDigest);
  });
  await test('C6-EXTRA-CUTOFF-AUTHORITY', () => {
    const a = fixture(), b = fixture();
    b.sources.habitAssertions.unshift({ ...b.sources.habitAssertions[0], assertionId: uuid(990), monthlyVisitEstimate: '99', typicalVisitPrice: '999.00', validatedAt: '2027-01-01T00:00:00Z' });
    b.sources.productObservations.push({ ...b.sources.productObservations[0], observationId: 'future-product', observedAt: '2027-01-01' }); rebuild(b);
    assert.deepEqual(a.baseline, b.baseline); assert.equal(evaluate(a).compiledManifestDigest, evaluate(b).compiledManifestDigest);
  });
  await test('C6-EXTRA-ELIGIBILITY', () => {
    const w = fixture(); for (const name of ['eyeliner', 'wax']) w.sources.productObservations.push(...observations(keys[name], [40, 40, 40, 40, 40], '2026-09-25', '15.00', name === 'wax' ? adrien : manon));
    for (const key of ['skincare', 'haircare', 'discretionary-care']) {
      w.sources.needSubjects[key] = { needKey: key, personId: manon }; w.sources.productObservations.push(...observations(key, [40, 40, 40, 40, 40]));
    }
    rebuild(w);
    for (const p of w.baseline.renewals.replenishmentProfiles.filter(p => p.eligibility === 'EXPLICIT_ONLY')) {
      assert.notEqual(p.status, 'REPLENISHMENT_CERTIFIED'); const n = w.baseline.renewals.needOccurrences.find(n => n.needId === p.needId);
      assert.equal(n.autoEligible, false); assert.equal(n.dueWindow.central, null);
    }
  });
  await test('C6-EXTRA-THRESHOLDS', () => {
    for (const [gaps, status] of [[[], 'DISCRETIONARY_OBSERVED'], [[45], 'DISCRETIONARY_OBSERVED'], [[45, 45], 'REPLENISHMENT_CANDIDATE'], [[45, 45, 45], 'REPLENISHMENT_CERTIFIED']]) {
      const w = fixture(); w.sources.productObservations = observations(keys.mascara, gaps); rebuild(w); assert.equal(profile(w, 'mascara').status, status);
    }
    const w = fixture(); w.sources.productObservations = observations(keys.mascara, [5, 140, 10, 130]); rebuild(w);
    assert.equal(need(w, 'mascara').autoEligible, false);
  });
  await test('C6-EXTRA-MIXED-PRODUCT', () => {
    const w = fixture(); w.sources.productObservations[0].productKey = 'different-product'; rebuild(w);
    assert.equal(profile(w, 'mascara').productIdentityState, 'MIXED'); assert.equal(need(w, 'mascara').autoEligible, false);
    assert.equal(profile(w, 'mascara').referenceUnitAmount, null);
  });
  await test('C6-EXTRA-INTERVAL-COVERAGE', () => {
    const w = fixture(); w.sources.periods.find(p => p.month.startsWith('2026-06')).lifeStatus = 'partial'; rebuild(w);
    assert.equal(need(w, 'mascara').autoEligible, false); assert.ok(profile(w, 'mascara').limitations.includes('ACQUISITION_COVERAGE_GAP'));
  });
  await test('C6-EXTRA-NO-AUTO-RESERVATION', () => {
    const w = fixture(), p = evaluate(w); assert.equal(p.compiled.components.length, 0);
    for (const name of ['mascara', 'brows', 'eyeliner', 'wax']) {
      const slot = p.compiled.planSlots.find(s => s.baseline.renewalAuthority?.needOccurrenceId === need(w, name).needOccurrenceId);
      assert.equal(slot.owned, false); assert.equal(slot.remainingEconomicAmount, '0.00');
    }
    assert.equal(p.compiled.financialAdapterInput.plannedExpenseEntries.filter(e => e.costItems[0].label === 'hairdresser').length, 1);
  });
  await test('C6-EXTRA-CONFIRM-DEFER', async () => {
    const w = fixture(), key = needSlot(w, 'mascara').slotIdentityKey;
    const confirmed = await roundTrip(w, state([control(key, { count: '1' })])); assert.equal(confirmed.projection.plan.impactOnMonthEnd, '-32.00');
    const deferred = await roundTrip(w, state([control(key, { count: '0' })])); assert.equal(deferred.projection.plan.impactOnMonthEnd, '0.00');
    assert.equal(confirmed.baselineDigest, deferred.baselineDigest); assert.deepEqual(confirmed.compiled.needs, deferred.compiled.needs);
    const linked = await roundTrip(w, state([control(key, { count: '1' })], [restock(w, ['mascara'])]));
    assert.equal(linked.projection.plan.impactOnMonthEnd, '-32.00');
  });
  await test('C6-EXTRA-UNKNOWN-PRICE', async () => {
    const w = fixture(); w.sources.productObservations.filter(o => o.needKey === keys.mascara).forEach(o => delete o.price); rebuild(w);
    assert.equal(needSlot(w, 'mascara').baselineValue.unitAmount, null);
    const p = evaluate(w, state([], [restock(w, ['mascara'])])); assert.equal(p.projection.plan.economicMonthEndRemainder, null);
    const confirmed = await roundTrip(w, state([control(needSlot(w, 'mascara').slotIdentityKey, { count: '1', unitAmount: '33.00' })]));
    assert.equal(confirmed.projection.plan.impactOnMonthEnd, '-33.00'); assert.equal(needSlot(w, 'mascara').baselineValue.unitAmount, null);
  });
  await test('C6-EXTRA-SUGGESTION', () => {
    const w = fixture(), p = evaluate(w, state([], [restock(w, ['mascara'], 500, { provenance: 'PERSONAL_SUGGESTION' })]));
    assert.equal(p.compiled.components.length, 0); assert.equal(p.compiled.planSlots.find(s => s.baseline.planSlotId === needSlot(w, 'mascara').planSlotId).owned, false);
    assert.ok(!p.compiled.financialAdapterInput.plannedExpenseEntries.some(e => e.costItems[0].label.includes('mascara')));
    assert.equal(p.projection.plan.economicMonthEndRemainder, null, 'an active restock still requires an accepted economic selection');
  });
  await test('C6-EXTRA-CURRENT-MONTH-COVERAGE', () => {
    const w = fixture(); w.sources.knowledgeCutoff = '2026-11-07T00:00:00Z'; rebuild(w);
    assert.equal(need(w, 'brows').dueState, 'UNKNOWN'); assert.equal(need(w, 'brows').autoEligible, false);
  });
  await test('C6-EXTRA-ROW-CORRECTION-IDENTITY', () => {
    const w = fixture(), before = need(w, 'mascara');
    w.sources.productObservations.push({ ...w.sources.productObservations.find(o => o.needKey === keys.mascara && o.observedAt === '2026-09-25'), observationId: 'second-line-same-acquisition' }); rebuild(w);
    assert.equal(before.needOccurrenceId, need(w, 'mascara').needOccurrenceId); assert.equal(profile(w, 'mascara').distinctAcquisitionCount, 6);
  });
  await test('C6-EXTRA-FULL-PRODUCT-CORPUS', () => {
    const w = fixture();
    w.sources.periods.push(...['2025-10', '2025-11', '2025-12'].map(month => ({ ...w.sources.periods[0], analysisPeriodId: `period:${month}`, month: `${month}-01` })));
    w.sources.productObservations = observations(keys.mascara, [65, 98, 60, 56, 71], '2026-09-25'); rebuild(w);
    assert.equal(profile(w, 'mascara').distinctAcquisitionCount, 6); assert.equal(profile(w, 'mascara').medianGapDays, 65);
    assert.equal(profile(w, 'mascara').p25GapDays, 60); assert.equal(profile(w, 'mascara').p75GapDays, 71);
    assert.equal(profile(w, 'mascara').status, 'REPLENISHMENT_CERTIFIED');
    assert.ok(w.baseline.renewals.acquisitionEpisodes.some(e => e.date < '2026-01-01'));
  });
  await test('C6-EXTRA-DOUBLE-CONSUMPTION', () => {
    const w = fixture(); assert.throws(() => evaluate(w, state([], [restock(w, ['mascara'], 500), restock(w, ['mascara'], 501)])), /CONSUMED_TWICE/);
    const p = evaluate(w, state([], [restock(w, ['mascara'], 500), restock(w, ['mascara'], 501, { binding: { mode: 'EXTRA_TO_SLOT' } })]));
    assert.equal(p.compiled.financialAdapterInput.adapterManifest.baselineConsumptions.length, 1); assert.equal(p.projection.plan.impactOnMonthEnd, '-64.00');
  });
  await test('C6-EXTRA-ACQUISITION-ADVANCES-IDENTITY', () => {
    const w = fixture(), before = need(w, 'mascara'); w.sources.productObservations.push({ ...w.sources.productObservations[0], observationId: 'new-real-acquisition', observedAt: '2026-10-28' }); rebuild(w);
    assert.notEqual(before.needOccurrenceId, need(w, 'mascara').needOccurrenceId);
    assert.throws(() => evaluate(w, state([], [context(510, 'beauty-restock', { products: selections(component('product', '32.00', 'old', { needOccurrenceId: before.needOccurrenceId })) })])), /OCCURRENCE_UNKNOWN/);
  });
  await test('C6-EXTRA-SCOPE', () => {
    const w = fixture(); w.sources.productObservations[0].subject.personId = uuid(999); assert.throws(() => buildRenewalReadModel(w.sources), /SCOPE/);
    const other = fixture(); other.sources.needSubjects['synthetic-need:mascara'].personId = adrien; assert.throws(() => buildRenewalReadModel(other.sources), /SUBJECT_CONFLICT/);
  });
  await test('C6-EXTRA-UNMAPPED-OBSERVATION', () => {
    const w = fixture(); w.sources.productObservations.push({ ...w.sources.productObservations[0],
      observationId: 'legacy-unmapped-observation', needKey: 'legacy-unmapped-product', observedAt: '2026-08-01', evidenceRefs: ['product-observation:legacy-unmapped-observation'] });
    rebuild(w);
    assert.ok(w.baseline.renewals.diagnostics.some(d => d.code === 'RENEWAL_NEED_MAPPING_UNAVAILABLE' && d.evidenceRefs.includes('product-observation:legacy-unmapped-observation')));
    assert.ok(!w.baseline.renewals.needOccurrences.some(n => n.needKey === 'legacy-unmapped-product'));
    assert.ok(!w.baseline.renewals.acquisitionEpisodes.some(e => e.observationIds.includes('legacy-unmapped-observation')));
    assert.ok(!w.baseline.slots.some(s => s.semanticKey === 'need:legacy-unmapped-product'));
    assert.ok(w.baseline.sourceRefs.some(r => r.evidenceRefs.includes('product-observation:legacy-unmapped-observation')));
  });
  await test('C6-EXTRA-PRICE-NOT-BANK', () => {
    const w = fixture(); w.sources.productObservations.filter(o => o.observedAt === '2026-09-25').forEach(o => o.evidenceRefs.push('operation:shared-basket-35.15'));
    rebuild(w); assert.equal(profile(w, 'mascara').referenceUnitAmount, '32.00'); assert.equal(profile(w, 'brows').referenceUnitAmount, '9.99');
    assert.ok(w.baseline.renewals.replenishmentProfiles.every(p => p.referencePriceBasis !== 'BANK_ALLOCATION'));
  });
  await test('C6-EXTRA-FINANCIAL-OWNER', () => {
    const w = fixture(), before = structuredClone(w), p = evaluate(w, state([], [restock(w)]));
    assert.deepEqual(p.scenario, deriveMonthScenario(financialAdapterForecast(w, p.compiled.planSlots), p.compiled.financialAdapterInput.effectiveMonthInputs, null, w.asOfDate, p.compiled.financialAdapterInput.plannedExpenseEntries));
    assert.deepEqual(w, before);
  });
  await test('C6-EXTRA-STALE-ZERO-WRITES', async () => {
    current = fixture(); const semantic = state([], [restock(current)]), p = await previewPlanScenario(deps, householdId, semantic), writes = pg.rpcCalls;
    current.sources.productObservations.find(o => o.needKey === keys.mascara).price = '36.00'; rebuild(current);
    await assert.rejects(() => applyPlanScenario(deps, householdId, semantic, command(p)), /PREVIEW_STALE/); assert.equal(pg.rpcCalls, writes);
  });
  await test('C6-EXTRA-FORGED-CAPABILITY-ZERO-WRITES', async () => {
    current = fixture(); const semantic = state([], [restock(current)]), p = await previewPlanScenario(deps, householdId, semantic), writes = pg.rpcCalls;
    semantic.contexts[0].slotSelections.products.items[0].needOccurrenceId = 'forged';
    await assert.rejects(() => applyPlanScenario(deps, householdId, semantic, command(p)), /OCCURRENCE_UNKNOWN/); assert.equal(pg.rpcCalls, writes);
    const wrong = state([], [context(502, 'activity', { main: selections(component('activity', '1.00', 'forged', { needOccurrenceId: need(current, 'mascara').needOccurrenceId })) })]);
    assert.throws(() => evaluate(current, wrong), /FIELD/);
  });
  await pg.verifyCanaries(); console.log(`C6_RENEWALS_READY = YES (${passed.length} oracle groups)`);
  if (process.env.PLANNER_C6_REPORT_PATH) fs.writeFileSync(process.env.PLANNER_C6_REPORT_PATH, JSON.stringify({
    gate: 'C6_RENEWALS_READY', status: 'YES', passed, rpcEnvironment: 'PGLITE_SYNTHETIC_ONLY', remoteWrites: 0, historicalCanaryWrites: 0
  }, null, 2));
} finally { await pg.close(); }
