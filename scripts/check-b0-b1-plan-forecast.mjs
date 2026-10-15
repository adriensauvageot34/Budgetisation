// Real Compiler / Finance V2 + unchanged C0 SQL on synthetic PGlite. No network, .env or real data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import Big from 'big.js';
import { require } from './lib/phase2-ts-loader.mjs';
import { fixture as kernel, context as generic, control, seal, userId } from './fixtures/planner-kernel.mjs';
import { fixture, state, uuid, householdId, weekendMonth, activity } from './fixtures/planner-headless.mjs';
import { providers } from './fixtures/planner-mobility.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';

const compiler = require('@/server/phase2/planner/compiler');
const financial = require('@/server/phase2/planner/financial-adapter');
let compilations = 0, financeCalls = 0;
const compile = compiler.compileSemanticPlan, derive = financial.deriveCompiledMonthScenario;
compiler.compileSemanticPlan = (...args) => { compilations++; return compile(...args); };
financial.deriveCompiledMonthScenario = (...args) => { financeCalls++; return derive(...args); };
const { evaluatePlanScenario } = require('@/server/phase2/planner/preview');
const { previewPlanScenario, applyPlanScenario } = require('@/server/phase2/planner/apply');
const { resolveEffectiveMonthScenario } = require('@/server/phase2/planner/effective-month-scenario');
const { officialPlanComparison } = require('@/server/phase2/planner/official-comparison');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { preparePlanningMobility } = require('@/server/phase2/planner/prospective-mobility-pricing');
const { deriveMonthScenario } = require('@/server/phase2/month-scenario');
const { plannerDigest } = require('@/domain/phase2/planner/json');
const { AppliedMonthView } = require('@/app/mois-a-venir/applied-month-view');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const pg = await createKernelPostgres(), repository = createPlanApplyRepository(pg.client);
let current = kernel(), worldReads = 0, pointerReads = 0, request = 91000;
const deps = { repository: { ...repository, readActivePointer: async (...args) => { pointerReads++; return repository.readActivePointer(...args); } },
  readWorld: async () => { worldReads++; return current; },
  validateContextReferences: async (household, refs) => {
    assert.equal(household, householdId);
    assert.ok(refs.placeIds.every(id => current.mobilityFacts?.places.some(place => place.placeId === id)));
    assert.ok(refs.personIds.every(id => current.baseline.slots.some(slot => slot.scope.personId === id)));
  },
  prepareWorld: (world, semantic) => preparePlanningMobility(world, semantic, providers().value),
  readDirectWorld: async () => ({ forecast: current.forecast, monthInputs: current.monthInputs, externalIntents: current.externalIntents, asOfDate: current.asOfDate }) };
const command = p => ({ expectedActiveRevisionId: p.baseActiveRevisionId, expectedActiveRevisionNumber: p.baseRevisionNumber,
  expectedBaselineDigest: p.baselineDigest, expectedPreviewDigest: p.previewDigest, applyRequestId: uuid(request++) });
const checks = [], examples = [], overhead = [];
const check = async (id, run) => { await run(); checks.push(id); console.log(`${id} PASS`); };
const evaluate = (world, semantic) => evaluatePlanScenario(world, semantic, { expectedActiveRevisionId: null, expectedActiveRevisionNumber: 0 });
async function official(world, semantic) {
  current = world;
  const p = await previewPlanScenario(deps, householdId, semantic), cmd = command(p);
  assert.notEqual(p.projection.applyReadiness, 'BLOCKED');
  const applied = await applyPlanScenario(deps, householdId, semantic, cmd), saved = plannerDigest(applied.revision);
  const reads = worldReads, pointers = pointerReads, writes = pg.rpcCalls;
  const result = await resolveEffectiveMonthScenario(deps, householdId, '2026-11');
  assert.equal(worldReads, reads + 1); assert.equal(pointerReads, pointers + 1); assert.equal(pg.rpcCalls, writes);
  assert.equal(result.evidenceStatus, 'EXACT'); assert.equal(result.comparison.freshness.activeRevision, 'CURRENT_AT_CHECK');
  assert.strictEqual(result.comparison.projection, result.projection);
  assert.equal(result.preview.projectionDigest, p.projectionDigest); assert.deepEqual(result.scenario, p.scenario);
  assert.equal(plannerDigest(applied.revision), saved);
  examples.push({ revision: result.revision.revisionNumber, preview: p.previewDigest, projection: p.projectionDigest,
    baseline: p.baselineDigest, impact: p.projection.plan.impactOnMonthEnd,
    decisions: result.comparison.decisions.map(row => ({ id: row.decisionId, marginal: row.marginalImpactOnMonthEnd, attribution: row.attribution })) });
  return { result, applied, p, cmd };
}
const mealWorld = () => { const world = kernel();
  world.baseline.slots.find(slot => slot.slotIdentityKey === 'restaurants').baselineValue.unitAmount = '40.00';
  const ref = world.forecast.referencePlan.flexible.find(part => part.key === 'household-restaurants');
  ref.low = ref.central = ref.high = '120.00'; return seal(world); };

try {
  await check('T1_NO_PLAN_DIRECT_V2', async () => {
    const reads = worldReads, pointers = pointerReads;
    const result = await resolveEffectiveMonthScenario(deps, householdId, '2026-11');
    assert.equal(result.owner, 'DIRECT_V2'); assert.equal(result.comparison, null);
    assert.equal(worldReads, reads); assert.equal(pointerReads, pointers);
    assert.deepEqual(result.scenario, deriveMonthScenario(current.forecast, current.monthInputs, null, current.asOfDate, []));
  });
  await check('T2_UNAPPLIED_DRAFT_HAS_NO_OFFICIAL_EFFECT', async () => {
    const before = await resolveEffectiveMonthScenario(deps, householdId, '2026-11');
    const draft = state([control('groceries', { amount: '999.00' })]); evaluate(current, draft);
    assert.deepEqual(await resolveEffectiveMonthScenario(deps, householdId, '2026-11'), before);
    assert.deepEqual(await pg.counts(), { plans: 0, revisions: 0 });
  });
  await check('T3_GROCERIES_350_TO_320', async () => {
    const world = kernel(); world.baseline.slots.find(slot => slot.slotIdentityKey === 'groceries').baselineValue.amount = '350.00';
    const ref = world.forecast.referencePlan.necessary[0]; ref.low = ref.central = ref.high = '350.00'; seal(world);
    const { result } = await official(world, state([control('groceries', { amount: '320.00' })]));
    assert.equal(result.projection.plan.impactOnMonthEnd, '30.00');
    assert.equal(result.comparison.decisions[0].marginalImpactOnMonthEnd, '30.00');
    assert.equal(result.comparison.slots.find(slot => slot.slotIdentityKey === 'groceries').effectiveAmount, '320.00');
  });
  await check('T4_GROCERIES_325_TO_350', async () => {
    const world = fixture();
    const { result } = await official(world, state([control('groceries', { amount: '350.00' })]));
    assert.equal(result.projection.plan.impactOnMonthEnd, '-25.00');
    assert.equal(result.comparison.decisions[0].marginalImpactOnMonthEnd, '-25.00');
  });
  await check('T5_RESTAURANT_CONSUMES_CAPACITY', async () => {
    const { result } = await official(mealWorld(), state([], [generic({ cost: '40.00' })]));
    assert.equal(result.projection.plan.impactOnMonthEnd, '0.00');
    const component = result.comparison.components[0];
    assert.equal(component.effect.slotRelation, 'CONSUMES_SLOT'); assert.equal(component.effect.displacedAmount, '40.00');
    assert.equal(component.effect.incrementalAmount, '0.00');
  });
  await check('T6_RESTAURANT_EXTRA_TO_SLOT', async () => {
    const { result } = await official(mealWorld(), state([], [generic({ relation: 'EXTRA_TO_SLOT', count: null, cost: '40.00' })]));
    assert.equal(result.projection.plan.impactOnMonthEnd, '-40.00');
    assert.equal(result.comparison.components[0].effect.incrementalAmount, '40.00');
  });
  await check('T7_PARENT_CHILD_SINGLE_ECONOMIC_CONTRIBUTION', async () => {
    const f = weekendMonth(true), { result } = await official(f.world, f.semantic);
    assert.equal(new Set(result.comparison.components.map(row => row.effect.componentId)).size, result.comparison.components.length);
    const restaurant = result.preview.compiled.contexts.find(row => row.templateKey === 'restaurant');
    const child = result.comparison.decisions.find(row => row.decisionId === restaurant.contextOccurrenceId);
    assert.equal(child.parentContextOccurrenceId, uuid(300));
    assert.ok(child.interactingDecisionIds.includes(uuid(300)));
    const owners = result.preview.compiled.financialAdapterInput.adapterManifest.syntheticPlannedEntryOwners;
    for (const id of restaurant.componentIds) assert.equal(owners.filter(row => row.ownerRef === id).length, 1);
    assert.equal(owners.filter(row => row.ownerRef === uuid(300)).length, 0);
  });
  await check('T8_SAVINGS_NOT_CONSUMPTION_OR_DUPLICATE_FUNDING', async () => {
    const world = kernel(), empty = evaluate(world, state());
    const { result } = await official(world, state([control(`savings:${uuid(700)}`, { amount: '60.00' })]));
    assert.equal(result.projection.plan.impactOnMonthEnd, '40.00');
    assert.equal(result.scenario.economicCost.central, empty.scenario.economicCost.central);
    assert.equal(result.preview.compiled.financialAdapterInput.plannedExpenseEntries.length, 0);
    const funded = generic({ relation: 'NO_RELATED_SLOT', slot: null, count: null, cost: '50.00', funding: [{ source: 'BANK', amount: '50.00' }] });
    const { result: expense } = await official(world, state([], [funded]));
    assert.equal(expense.projection.plan.impactOnMonthEnd, '-50.00');
    assert.deepEqual(expense.comparison.components[0].fundingAllocations, [{ source: 'BANK', amount: '50.00' }]);
    assert.equal(expense.scenario.economicPlan.plannedFunding.bankAllocated, '50.00');
  });
  await check('T9_MOBILITY_USAGE_IS_NOT_FUEL_PAYMENT', async () => {
    const f = weekendMonth(true), { result } = await official(f.world, f.semantic);
    assert.equal(result.projection.mobility.usageEconomicCost, '2.00');
    assert.equal(result.scenario.economicPlan.plannedFunding.bankAllocated, '0.00');
    assert.ok(result.projection.funding.timing.some(row => row.cashTreatment === 'ECONOMIC_ONLY'));
    assert.ok(result.comparison.components.some(row => row.physicalJourneyRequirementId));
  });
  await check('T10_UNKNOWN_PARTIAL_PRESERVE_KNOWN_INFORMATION', async () => {
    const f = fixture(), { result } = await official(f, state([control('groceries', { amount: '320.00' })], [activity(200, null)]));
    assert.equal(result.projection.plan.impactOnMonthEnd, null);
    assert.ok(result.comparison.components.some(row => row.effect.grossAmount === null));
    assert.equal(result.comparison.slots.find(slot => slot.decisionId === uuid(1)).effectiveAmount, '320.00');
    assert.ok(result.comparison.decisions.some(row => row.attribution === 'UNRESOLVED'));
    assert.ok(result.projection.diagnostics.some(row => row.code === 'COMPONENT_COST_UNKNOWN'));
    assert.equal(result.projection.cash.lowPointAmount, null);
  });
  await check('T11_CONCURRENT_REVISION_NEVER_FALSE_CURRENT', async () => {
    const world = kernel(), first = await official(world, state([control('groceries', { amount: '110.00' })]));
    const nextState = state([control('groceries', { amount: '120.00' })]);
    const next = await previewPlanScenario(deps, householdId, nextState); let applied;
    const result = await resolveEffectiveMonthScenario({ ...deps, readWorld: async () => {
      applied = await applyPlanScenario(deps, householdId, nextState, command(next)); return current;
    } }, householdId, '2026-11');
    assert.equal(result.revision.planRevisionId, first.applied.revision.planRevisionId);
    assert.equal(result.comparison.freshness.activeRevision, 'SUPERSEDED');
    assert.equal(result.comparison.freshness.checkedPointer.activeRevisionId, applied.revision.planRevisionId);
    assert.equal((await resolveEffectiveMonthScenario(deps, householdId, '2026-11')).comparison.freshness.activeRevision, 'CURRENT_AT_CHECK');
    const html = renderToStaticMarkup(React.createElement(AppliedMonthView, { projection: result.projection, semanticState: result.semanticState,
      plan: null, revision: result.revision.revisionNumber, comparison: result.comparison, today: world.asOfDate }));
    assert.ok(html.includes('data-official-comparison="official-plan-comparison@v1"'));
    assert.ok(html.includes('Une version plus récente de votre Plan existe.'));
    assert.ok(html.includes('Consulter la dernière version'));
  });
  await check('T12_CHANGED_AUTHORITIES_COHERENT_CURRENT_COMPARISON', async () => {
    const before = await repository.readActivePlan(householdId, '2026-11'), digest = plannerDigest(before.activeRevision);
    current.forecast.meta.sourceRevision++; current.forecast.publicationMeta.revision++; current.forecast.resourceMeta.resourceInputHash = 'synthetic-new-generation';
    const result = await resolveEffectiveMonthScenario(deps, householdId, '2026-11');
    assert.equal(result.evidenceStatus, 'CHANGED_AUTHORITIES');
    assert.equal(result.comparison.authorities.forecastRevision, current.forecast.publicationMeta.revision);
    assert.equal(result.comparison.revision.storedCompiledManifestDigest, before.activeRevision.compiledManifestDigest);
    assert.equal(plannerDigest((await repository.readActivePlan(householdId, '2026-11')).activeRevision), digest);
    assert.strictEqual(result.comparison.projection, result.preview.projection);
  });
  await check('T13_APPLY_REPLAY_NO_DUPLICATE_IMPACT', async () => {
    const f = kernel(), { applied, cmd, result } = await official(f, state([control('groceries', { amount: '130.00' })]));
    const counts = await pg.counts(), writes = pg.rpcCalls;
    const replay = await applyPlanScenario(deps, householdId, applied.revision.semanticState, cmd);
    assert.equal(replay.replayed, true); assert.equal(pg.rpcCalls, writes); assert.deepEqual(await pg.counts(), counts);
    assert.deepEqual((await resolveEffectiveMonthScenario(deps, householdId, '2026-11')).comparison, result.comparison);
  });
  await check('T14_REPOSITORY_RLS_AND_SCOPE_REFUSALS_SYNTHETIC', async () => {
    assert.equal(await repository.readActivePointer(uuid(9999), '2026-11'), null);
    await pg.db.query("select set_config('request.jwt.claim.sub',$1,false)", [uuid(9999)]);
    assert.equal(await repository.readActivePlan(householdId, '2026-11'), null);
    assert.equal(await repository.readActivePointer(householdId, '2026-11'), null);
    await pg.db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
    const stored = await repository.readActivePlan(householdId, '2026-11');
    await assert.rejects(() => resolveEffectiveMonthScenario({ ...deps, repository: { ...repository,
      readActivePlan: async () => ({ ...stored, activeRevision: { ...stored.activeRevision, householdId: uuid(9999) } }) } }, householdId, '2026-11'), /SCOPE_INVALID/);
  });
  await check('T15_NON_ADDITIVE_SHARED_CAPACITY', async () => {
    const world = mealWorld(), { result } = await official(world, state([control('restaurants', { count: '1' })], [generic({ cost: '40.00' }), generic({ n: 101, cost: '40.00' })]));
    assert.equal(result.comparison.decomposition, 'NON_ADDITIVE_MARGINALS_AND_COMPONENT_LENSES');
    assert.ok(result.comparison.decisions.every(row => row.interactingDecisionIds.length === 2));
    assert.ok(result.comparison.decisions.every(row => row.attribution === 'CONDITIONAL_MARGINAL_NOT_ADDITIVE'));
    assert.strictEqual(result.comparison.projection.plan, result.projection.plan);
    const marginalSum = result.comparison.decisions.reduce((sum, row) => sum.plus(row.marginalImpactOnMonthEnd), new Big(0)).toFixed(2);
    assert.notEqual(marginalSum, result.projection.plan.impactOnMonthEnd, 'conditional marginals are not a reconciliation sum');
  });
  await check('T16_POINTER_UNAVAILABLE_KEEPS_REVISION_NOT_FALSE_FRESH', async () => {
    const result = await resolveEffectiveMonthScenario({ ...deps, repository: { ...repository,
      readActivePointer: async () => { throw new Error('SYNTHETIC_NETWORK'); } } }, householdId, '2026-11');
    assert.equal(result.comparison.freshness.activeRevision, 'UNAVAILABLE'); assert.ok(result.projection.plan);
  });
  await check('T17_NO_ADDITIONAL_COMPILER_FINANCE_OR_WORLD_IN_VIEW', async () => {
    const result = await resolveEffectiveMonthScenario(deps, householdId, '2026-11');
    const calls = { compilations, financeCalls, worldReads }, snapshot = plannerDigest(result.preview);
    for (let n = 0; n < 50; n++) {
      const start = performance.now(); const comparison = officialPlanComparison(result.revision, result.preview, current,
        result.evidenceStatus, result.comparison.freshness.checkedPointer, true);
      overhead.push(performance.now() - start); assert.strictEqual(comparison.projection, result.preview.projection);
    }
    assert.deepEqual({ compilations, financeCalls, worldReads }, calls); assert.equal(plannerDigest(result.preview), snapshot);
  });
  await check('T18_CONSOLIDATED_BUDGET_AND_NEW_CONTEXT', async () => {
    const world = kernel(); world.baseline.slots.find(slot => slot.slotIdentityKey === 'groceries').baselineValue.amount = '350.00';
    const ref = world.forecast.referencePlan.necessary[0]; ref.low = ref.central = ref.high = '350.00'; seal(world);
    const semantic = state([control('groceries', { amount: '320.00' })],
      [generic({ relation: 'NO_RELATED_SLOT', slot: null, count: null, cost: '100.00' })]);
    const { result } = await official(world, semantic);
    assert.equal(result.projection.plan.impactOnMonthEnd, '-70.00');
    assert.deepEqual(result.comparison.decisions.map(row => row.marginalImpactOnMonthEnd), ['30.00', '-100.00']);
    assert.equal(new Big(result.projection.baseline.economicMonthEndRemainder).minus('70').toFixed(2), result.projection.plan.economicMonthEndRemainder);
  });
  await pg.verifyCanaries();
  const sorted = [...overhead].sort((a,b) => a-b);
  const report = { status: 'EXECUTED_PASS_PGLITE_SYNTHETIC_ONLY', checks, examples,
    performance: { sampleCount: overhead.length, p50Ms: sorted[Math.ceil(sorted.length*.5)-1], p95DescriptiveMs: sorted[Math.ceil(sorted.length*.95)-1],
      additionalCompilerCalls: 0, additionalFinanceCalls: 0, additionalWorldReads: 0,
      additionalPointerSelects: 'ONE_WITH_PLAN_ZERO_WITHOUT_PLAN', note: 'CPU interpretation only; not authenticated network latency' },
    authenticatedApply: 'NOT_RUN', remoteWrites: 0, historicalCanaries: 'UNCHANGED' };
  if (process.env.B0_B1_REPORT_PATH) fs.writeFileSync(process.env.B0_B1_REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, count: checks.length, performance: report.performance }));
} finally { await pg.close(); }
