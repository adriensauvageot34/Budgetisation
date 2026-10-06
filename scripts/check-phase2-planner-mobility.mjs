import assert from 'node:assert/strict';
import fs from 'node:fs';
import { require } from './lib/phase2-ts-loader.mjs';
import { fixture, state, uuid, householdId, selections, component, mobility, context, activity, night, stay, child,
  car, visit, journey, intentId, home, destination, shop, providers } from './fixtures/planner-mobility.mjs';
import { externalExpense } from './fixtures/planner-kernel.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
const { preparePlanningMobility } = require('@/server/phase2/planner/prospective-mobility-pricing');
const { evaluatePlanScenario } = require('@/server/phase2/planner/preview');
const { previewPlanScenario, applyPlanScenario } = require('@/server/phase2/planner/apply');
const { resolveEffectiveMonthScenario } = require('@/server/phase2/planner/effective-month-scenario');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { deriveMonthScenario } = require('@/server/phase2/month-scenario');
const { financialAdapterForecast } = require('@/server/phase2/planner/financial-adapter');
const { buildProspectiveMobilityFacts } = require('@/server/phase2/planner/mobility-adapter');
const base = { expectedActiveRevisionId: null, expectedActiveRevisionNumber: 0 };
const passed = [], test = async (id, run) => { await run(); passed.push(id); console.log(`${id} PASS`); };
const warning = (p, code) => assert.ok(p.compiled.constraints.some(c => c.code === code), code);
async function evaluate(semantic, world = fixture(), owner = providers()) {
  const before = structuredClone(world), prepared = await preparePlanningMobility(world, semantic, owner.value);
  const result = evaluatePlanScenario(prepared, semantic, base); assert.deepEqual(world, before);
  return { ...result, prepared, owner };
}
const pg = await createKernelPostgres(); let current = fixture(), owner = providers(), requestId = 9500;
const deps = { repository: createPlanApplyRepository(pg.client), readWorld: async () => structuredClone(current),
  prepareWorld: (world, semantic) => preparePlanningMobility(world, semantic, owner.value),
  readDirectWorld: async () => ({ forecast: current.forecast, monthInputs: current.monthInputs, externalIntents: current.externalIntents, asOfDate: current.asOfDate }) };
const command = p => ({ expectedActiveRevisionId: p.baseActiveRevisionId, expectedActiveRevisionNumber: p.baseRevisionNumber,
  expectedBaselineDigest: p.baselineDigest, expectedPreviewDigest: p.previewDigest, applyRequestId: uuid(requestId++) });
async function roundTrip(semantic, world = fixture(), provider = providers()) {
  current = world; owner = provider; const before = structuredClone(world), p = await previewPlanScenario(deps, householdId, semantic);
  assert.notEqual(p.projection.applyReadiness, 'BLOCKED');
  const applied = await applyPlanScenario(deps, householdId, semantic, command(p));
  assert.deepEqual(applied.projectionEvidence.projection, p.projection);
  const reload = await resolveEffectiveMonthScenario(deps, householdId, '2026-11');
  assert.equal(reload.evidenceStatus, 'EXACT'); assert.deepEqual(reload.scenario, p.scenario);
  assert.deepEqual(reload.preview.projection, p.projection); assert.equal(reload.preview.compiledManifestDigest, p.compiledManifestDigest);
  assert.deepEqual(world, before); await pg.verifyCanaries(); return p;
}
try {
  await test('MOB-001', async () => {
    const p = await evaluate(state([], [visit(100), visit(101, {}, { plannedDate: '2026-11-13' })]));
    assert.equal(p.compiled.journeys.length, 2); assert.equal(p.projection.mobility.usageEconomicCost, '4.00'); assert.equal(p.owner.calls.routes.length, 2);
    assert.notEqual(...p.compiled.journeys.map(j => j.physicalJourneyRequirementId));
  });
  await test('MOB-002', async () => {
    const p = await roundTrip(state([], [visit(100), visit(101, { journey: journey('SHARES_JOURNEY', 100) })]));
    assert.equal(p.compiled.journeys.length, 1); assert.equal(p.compiled.journeys[0].participatingIntentIds.length, 2);
    assert.equal(p.projection.mobility.usageEconomicCost, '2.00'); assert.equal(p.projection.plan.impactOnMonthEnd, '-2.00');
  });
  await test('MOB-003', async () => {
    const semantic = state([], [visit(100, { returnRequired: true }), visit(101, { destination: shop, journey: journey('ADDS_STOP', 100, { stopIndex: 1 }) })]);
    const p = await evaluate(semantic); assert.equal(p.compiled.journeys.length, 1);
    assert.deepEqual(p.compiled.journeys[0].stops, [home, shop, destination, home]);
    assert.equal(p.projection.mobility.usageEconomicCost, '6.00'); assert.equal(p.owner.calls.routes.length, 2, 'One outbound and one return through the existing owner');
    assert.deepEqual(p.owner.calls.routes.map(r => r.coordinates.length), [3, 2]);
    await roundTrip(semantic);
  });
  await test('MOB-004', async () => {
    const undecided = state([], [visit(100), visit(101, { journey: journey('SHARES_JOURNEY', 100, { certainty: 'POSSIBLE' }) })]);
    const p = await evaluate(undecided); warning(p, 'MOBILITY_RELATION_NEEDS_CHOICE'); assert.equal(p.projection.plan.economicMonthEndRemainder, null);
    assert.equal(p.compiled.journeys.length, 2); assert.equal(p.owner.calls.routes.length, 1);
    for (const [choice, count] of [['MERGE', 1], ['SEPARATE', 2]]) {
      const next = await roundTrip(state([], [visit(100), visit(101, { journey: journey('SHARES_JOURNEY', 100, { certainty: 'POSSIBLE', choice }) })]));
      assert.equal(next.compiled.journeys.length, count);
    }
  });
  await test('MOB-005', async () => {
    const p = await evaluate(state([], [visit(100), visit(101, { journey: journey('SHARES_JOURNEY', 100, { certainty: 'SIMILAR_ONLY' }) })]));
    assert.equal(p.compiled.journeys.length, 2); assert.equal(p.projection.mobility.usageEconomicCost, '4.00'); warning(p, 'MOBILITY_SIMILARITY_NOT_IDENTITY');
    await assert.rejects(() => evaluate(state([], [visit(100), visit(101, { journey: journey('SHARES_JOURNEY', 100, { certainty: 'SIMILAR_ONLY', choice: 'MERGE' }) })])), /JOURNEY_DECLARATION_INVALID/);
  });
  await test('C5-006', async () => {
    const semantic = state([], [night(100, '20', { outbound: selections(car()), return: selections(car({ journey: journey('SHARES_JOURNEY', 100, { targetIntentId: intentId(100, 'outbound') }) })) })]);
    const p = await evaluate(semantic); assert.equal(p.compiled.mobilityIntents.length, 2); assert.equal(p.compiled.journeys.length, 1);
    assert.equal(p.owner.calls.routes.length, 1); assert.equal(p.compiled.components.filter(c => c.assetKey === 'transport:fuel_usage').length, 1);
    await roundTrip(semantic);
  });
  await test('C5-007', async () => {
    const p = await evaluate(state([], [visit(100, { pricing: { parking: { kind: 'MANUAL', unitAmount: '3' } } })]));
    const entries = p.compiled.financialAdapterInput.plannedExpenseEntries, fuel = entries.flatMap(e => e.costItems).filter(l => l.assetKey === 'transport:fuel_usage');
    assert.equal(fuel.length, 1); assert.deepEqual(fuel[0].fundingAllocations, []);
    assert.equal(p.scenario.economicPlan.plannedFunding.bankAllocated, '3.00'); assert.equal(p.scenario.economicPlan.plannedFunding.bankReserved, '3.00');
    assert.equal(p.projection.mobility.usageEconomicCost, '2.00'); assert.equal(p.projection.mobility.cashTransportCosts, '3.00');
    assert.equal(p.projection.plan.impactOnMonthEnd, '-5.00'); assert.equal(p.projection.funding.knownSyntheticCostWithUnknownFunding, '0.00');
  });
  await test('C5-008', async () => {
    const semantic = state([], [visit()]), aOwner = providers(), bOwner = providers(); bOwner.settings.price = '3.00';
    const a = await evaluate(semantic, fixture(), aOwner), b = await evaluate(semantic, fixture(), bOwner);
    assert.equal(a.compiled.journeys[0].physicalJourneyRequirementId, b.compiled.journeys[0].physicalJourneyRequirementId);
    assert.notEqual(a.compiledManifestDigest, b.compiledManifestDigest);
    const changed = await evaluate(state([], [visit(100, { destination: shop })]));
    assert.equal(a.compiled.journeys[0].physicalJourneyRequirementId, changed.compiled.journeys[0].physicalJourneyRequirementId);
  });
  await test('C5-009', async () => {
    const world = fixture(); world.costQuotes['historical-uber'] = { unitAmount: '20', evidenceRef: 'bank:payment-only', modelVersion: 'synthetic', observedAt: '2026-10-01' };
    const p = await evaluate(state([], [night(100, '20', { return: selections(mobility('taxi', 'uber', { pricing: { fare: { kind: 'QUOTE', quoteKey: 'historical-uber' } } })) })]), world);
    assert.deepEqual(p.compiled.journeys[0].stops, []); warning(p, 'MOBILITY_DIRECTION_UNRESOLVED');
    assert.equal(p.projection.plan.economicMonthEndRemainder, null); assert.equal(p.projection.mobility.cashTransportCosts, null);
    assert.equal(p.compiled.mobilityIntents[0].origin, null); assert.equal(p.compiled.mobilityIntents[0].destination, null);
  });
  await test('C5-010', async () => {
    const p = await evaluate(state([], [visit(100), visit(101)]));
    assert.equal(p.compiled.journeys.length, 2); assert.equal(p.owner.calls.routes.length, 2);
    assert.equal(p.compiled.journeyPrices[0].snapshot.route.geometryHash, p.compiled.journeyPrices[1].snapshot.route.geometryHash);
  });
  await test('C5-011', async () => {
    const world = fixture(), external = externalExpense(800);
    external.plannedDate = '2026-11-12'; external.context = { route: { mode: 'CAR', stops: [{ label: 'Home', placeId: home.placeId }, { label: 'Destination', placeId: destination.placeId }] } };
    external.costItems = [{ id: uuid(801), assetKey: 'transport:fuel_usage', label: 'Fuel', quantity: '1', unitAmount: '2', baselineKey: null },
      { id: uuid(802), assetKey: 'transport:toll', label: 'Toll', quantity: '1', unitAmount: '3', baselineKey: null, fundingAllocations: [{ source: 'BANK', amount: '3' }] },
      { id: uuid(803), assetKey: 'activity:entry', label: 'External activity', quantity: '1', unitAmount: '10', baselineKey: null }];
    world.externalIntents = [external];
    const semantic = state([], [visit(100, { journey: { relation: 'SHARES_JOURNEY', certainty: 'CERTAIN', externalExpenseId: external.id, externalCostLineIds: [uuid(801), uuid(802)] } }),
      visit(101, { journey: { relation: 'SHARES_JOURNEY', certainty: 'CERTAIN', externalExpenseId: external.id, externalCostLineIds: [uuid(802), uuid(801)] } })]);
    const p = await evaluate(semantic, world); assert.equal(p.compiled.journeys.length, 1); assert.equal(p.owner.calls.routes.length, 0);
    assert.equal(p.projection.mobility.usageEconomicCost, '2.00'); assert.equal(p.projection.mobility.cashTransportCosts, '3.00');
    assert.equal(p.compiled.financialAdapterInput.plannedExpenseEntries.length, 1); assert.deepEqual(p.compiled.financialAdapterInput.plannedExpenseEntries[0].costItems, external.costItems);
    assert.equal(p.projection.plan.impactOnMonthEnd, '0.00'); assert.equal(p.compiled.components.length, 0); await roundTrip(semantic, world);
    const incomplete = structuredClone(semantic); incomplete.contexts[0].slotSelections.transport.items[0].journey.externalCostLineIds = [uuid(801)];
    await assert.rejects(() => evaluate(incomplete, world), /JOURNEY_EXTERNAL_TRANSPORT_PROOF_REQUIRED/);
  });
  await test('C5-EXTRA-ACCESS-LEG', async () => {
    const semantic = state([], [visit(100), visit(101, { journey: journey('USES_ACCESS_LEG', 100, { accessLegIndex: 0 }) })]);
    const p = await roundTrip(semantic); assert.equal(p.compiled.journeys.length, 1); assert.equal(p.compiled.journeyDependencies.find(d => d.intentId === intentId(101)).accessLegIndex, 0);
    await assert.rejects(() => evaluate(state([], [visit(100), visit(101, { destination: shop, journey: journey('USES_ACCESS_LEG', 100, { accessLegIndex: 0 }) })])), /JOURNEY_ACCESS_LEG_INVALID/);
  });
  await test('C5-EXTRA-NO-ADDITIONAL', async () => {
    for (const optionKey of ['car', 'free']) {
      const p = await roundTrip(state([], [context(100, 'family-visit', { transport: selections(mobility(optionKey, 'none', { journey: { relation: 'NO_ADDITIONAL_MOBILITY', certainty: 'CERTAIN' } })) })]));
      assert.equal(p.compiled.journeys.length, 0); assert.equal(p.compiled.components.length, 0); assert.equal(p.projection.plan.impactOnMonthEnd, '0.00');
    }
  });
  await test('C5-EXTRA-PAID-MODES', async () => {
    for (const mode of ['train', 'bus', 'taxi', 'other']) {
      const p = await roundTrip(state([], [context(100, 'friend-visit', { transport: selections(mobility(mode, mode, { origin: home, destination,
        pricing: { fare: { kind: 'MANUAL', unitAmount: '12' }, fundingAllocations: [{ source: 'BANK', amount: '12' }] } })) })]));
      assert.equal(p.projection.mobility.cashTransportCosts, '12.00'); assert.equal(p.projection.mobility.usageEconomicCost, '0.00');
      assert.equal(p.projection.plan.impactOnMonthEnd, '-12.00'); assert.equal(p.scenario.economicPlan.plannedFunding.bankReserved, '12.00');
    }
  });
  await test('C5-EXTRA-ALL-DOMAINS', async () => {
    const contexts = [visit(100), visit(101, {}, {}, 'friend-visit'), { ...activity(102), slotSelections: { ...activity(102).slotSelections, transport: selections(car()) } },
      context(103, 'purchase', { item: selections(component('item', '10')), transport: selections(car()) }), night(104, '10', { outbound: selections(car()) }),
      stay(105, '10', { transport: selections(car()) }), context(106, 'home-project', { items: selections(component('item', '10')), transport: selections(car()) })];
    const p = await roundTrip(state([], contexts)); assert.equal(p.compiled.journeys.length, 7); assert.equal(p.projection.mobility.usageEconomicCost, '14.00');
  });
  await test('C5-EXTRA-UNKNOWN-PRICE-NOT-ZERO', async () => {
    const world = fixture(), mock = providers(); world.mobilityFacts.vehicle.fuelPricePerLiter = '0'; mock.settings.missingPrice = true;
    const p = await evaluate(state([], [visit()]), world, mock); assert.equal(p.projection.mobility.usageEconomicCost, null);
    assert.equal(p.compiled.journeyPrices[0].economicFuel, null); assert.equal(p.projection.plan.economicMonthEndRemainder, null); warning(p, 'MOBILITY_PRICING_UNRESOLVED');
  });
  await test('C5-EXTRA-UNKNOWN-TOLL-NOT-ZERO', async () => {
    const mock = providers(); mock.settings.missingToll = true;
    const p = await evaluate(state([], [visit()]), fixture(), mock); assert.equal(p.projection.mobility.usageEconomicCost, '2.00');
    assert.equal(p.projection.mobility.cashTransportCosts, null); assert.equal(p.projection.plan.economicMonthEndRemainder, null);
  });
  await test('C5-EXTRA-DIRECTED-HISTORY', async () => {
    const mock = providers(); mock.settings.routeUnavailable = true; const world = fixture();
    world.mobilityFacts.history = [{ originPlaceId: home.placeId, destinationPlaceId: destination.placeId, distanceKm: '10', fuelLiters: '1', method: 'synthetic-history', date: '2026-09-01' }];
    const outbound = await evaluate(state([], [visit()]), world, mock); assert.equal(outbound.compiled.journeyPrices[0].economicFuel, '2.00');
    assert.equal(outbound.compiled.journeyPrices[0].snapshot.route.provider, 'HISTORICAL_ROUTE'); assert.equal(outbound.projection.mobility.cashTransportCosts, null);
    const returning = await evaluate(state([], [visit(100, { origin: destination, destination: home })]), world, mock);
    assert.equal(returning.compiled.journeyPrices[0].economicFuel, null); assert.equal(returning.compiled.journeyPrices[0].snapshot, null);
  });
  await test('C5-EXTRA-AUTHORITY-ADAPTER', () => {
    const leg = (n, from, to, options = {}) => ({ legId: `synthetic-leg-${n}`, householdId, vehicleId: uuid(9150), date: '2026-09-01',
      origin: { placeId: from }, destination: { placeId: to }, distanceKm: '10', estimatedFuelLiters: '1', routeMethodRef: 'canonical-directed', source: { status: 'CERTIFIED_SOURCE' }, ...options });
    const authority = fixture().mobilityFacts.personalAuthority;
    const facts = buildProspectiveMobilityFacts({ householdId, knowledgeCutoff: '2026-10-05T00:00:00Z', personalMobility: authority,
      mobilityLegs: [leg(1, home.placeId, destination.placeId), leg(2, home.placeId, destination.placeId, { source: { status: 'SOURCE_PARTIAL' } }),
        leg(3, home.placeId, destination.placeId, { date: '2026-12-01' }), leg(4, home.placeId, null)] });
    assert.equal(facts.personalAuthority, authority); assert.equal(facts.vehicleHistory[uuid(9150)].length, 1); assert.equal(facts.history.length, 0);
    assert.deepEqual(facts.evidenceRefs, ['mobility-leg:synthetic-leg-1']);
  });
  await test('C5-EXTRA-WORK-STRUCTURAL', async () => {
    const world = fixture(), baseline = structuredClone(world.baseline); const p = await evaluate(state([], [visit()]), world);
    assert.deepEqual(p.baseline, baseline); const work = p.baseline.slots.filter(s => s.semanticKey === 'mobility:WORK'); assert.ok(work.length > 0);
    for (const slot of work) assert.ok(!slot.capabilities.some(c => ['SET_AMOUNT', 'SET_COUNT'].includes(c.action)));
    assert.deepEqual(p.compiled.manifest.unresolvedReserves, baseline.unresolvedReserves);
  });
  await test('C5-EXTRA-FINANCIAL-OWNER', async () => {
    const p = await evaluate(state([], [visit(100, { returnRequired: true }), visit(101, { journey: journey('SHARES_JOURNEY', 100) })]));
    assert.deepEqual(p.scenario, deriveMonthScenario(financialAdapterForecast(p.prepared, p.compiled.planSlots), p.compiled.financialAdapterInput.effectiveMonthInputs,
      null, p.prepared.asOfDate, p.compiled.financialAdapterInput.plannedExpenseEntries));
  });
  await test('C5-EXTRA-DETERMINISTIC-PRICING', async () => {
    const semantic = state([], [visit(100), visit(101, { journey: journey('SHARES_JOURNEY', 100) })]);
    const a = await evaluate(semantic), b = await evaluate({ ...semantic, contexts: [...semantic.contexts].reverse() });
    assert.equal(a.compiledManifestDigest, b.compiledManifestDigest); assert.deepEqual(a.projection, b.projection);
    assert.ok(!JSON.stringify(a.compiled.manifest.journeyPrices).includes('calculatedAt'));
  });
  await test('C5-EXTRA-STALE-ZERO-WRITES', async () => {
    current = fixture(); owner = providers(); const semantic = state([], [visit()]), p = await previewPlanScenario(deps, householdId, semantic), writes = pg.rpcCalls;
    owner.settings.price = '3.00'; await assert.rejects(() => applyPlanScenario(deps, householdId, semantic, command(p)), /PLANNER_PREVIEW_STALE/);
    assert.equal(pg.rpcCalls, writes);
  });
  await test('C5-EXTRA-INVALID-RELATION-ZERO-WRITES', async () => {
    current = fixture(); owner = providers(); const semantic = state([], [visit()]), p = await previewPlanScenario(deps, householdId, semantic), writes = pg.rpcCalls;
    const invalid = state([], [visit(100, { journey: journey('SHARES_JOURNEY', 101) }), visit(101, { journey: journey('SHARES_JOURNEY', 100) })]);
    await assert.rejects(() => applyPlanScenario(deps, householdId, invalid, command(p)), /JOURNEY_DEPENDENCY_CYCLE/); assert.equal(pg.rpcCalls, writes);
  });
  await test('C5-EXTRA-QUOTE-REQUEST-INVALIDATION', async () => {
    const semantic = state([], [visit()]), p = await evaluate(semantic);
    assert.throws(() => evaluatePlanScenario(p.prepared, state([], [visit(100, { destination: shop })]), base), /JOURNEY_PRICE_AUTHORITY_STALE/);
  });
  await test('C5-EXTRA-SUGGESTION-EXCLUDED', async () => {
    const p = await evaluate(state([], [context(100, 'family-visit', { transport: selections(car({ provenance: 'PERSONAL_SUGGESTION' })) })]));
    assert.equal(p.compiled.mobilityIntents.length, 0); assert.equal(p.compiled.journeys.length, 0); assert.equal(p.owner.calls.routes.length, 0);
  });
  await test('C5-EXTRA-UNSCHEDULED-RETURN', async () => {
    const p = await evaluate(state([], [visit(100, { returnRequired: true }, { plannedDate: null })]));
    assert.equal(p.compiled.journeys[0].returnLeg.kind, 'MONTH_UNSCHEDULED'); assert.equal(p.projection.mobility.usageEconomicCost, null);
    assert.equal(p.compiled.journeyPrices[0].evidence.code, 'VISIT_DEPARTURE_REQUIRED'); warning(p, 'MOBILITY_PRICING_UNRESOLVED');
  });
  await test('C5-EXTRA-WRITE-BOUNDARY', () => {
    for (const name of ['journey-resolver', 'mobility-adapter', 'mobility-selections', 'mobility-compiler', 'prospective-mobility-pricing']) {
      const source = fs.readFileSync(`src/server/phase2/planner/${name}.ts`, 'utf8');
      assert.ok(!/\bderiveMonthScenario\b|\.\s*(?:insert|upsert|update|rpc|from)\s*\(/u.test(source), name);
    }
  });
  await test('C5-EXTRA-CUTOFF-ADMISSION', async () => {
    const world = fixture(), mock = providers(); world.mobilityFacts.vehicle.fuelPricePerLiter = '0';
    mock.value.fuel.getReference = async () => ({ pricePerLiter: '2', source: 'FR_GOV_FUEL_INSTANT_V2', observedAt: '2026-12-01T00:00:00Z' });
    const futurePrice = await evaluate(state([], [visit()]), world, mock);
    assert.equal(futurePrice.compiled.journeyPrices[0].economicFuel, null);
    world.mobilityFacts.vehicle.fuelPricePerLiter = '2'; world.mobilityFacts.vehicle.fuelPriceObservedAt = '2026-12-01T00:00:00Z';
    const futureCanonical = await evaluate(state([], [visit()]), world, mock); assert.equal(futureCanonical.compiled.journeyPrices[0].economicFuel, null);
    mock.settings.routeUnavailable = true; mock.settings.missingPrice = false; const historical = fixture();
    historical.mobilityFacts.history = [{ originPlaceId: home.placeId, destinationPlaceId: destination.placeId, distanceKm: '10', fuelLiters: '1', method: 'future', date: '2026-12-01' }];
    const futureRoute = await evaluate(state([], [visit()]), historical, mock); assert.equal(futureRoute.compiled.journeyPrices[0].snapshot, null);
  });
  await test('C5-EXTRA-SHARED-INTENT-CONFLICT', async () => {
    await assert.rejects(() => evaluate(state([], [visit(100), visit(101, { journey: journey('SHARES_JOURNEY', 100), pricing: { parking: { kind: 'MANUAL', unitAmount: '10' } } })])), /JOURNEY_SHARED_PRICING_CONFLICT/);
    await assert.rejects(() => evaluate(state([], [visit(100), visit(101, { journey: journey('SHARES_JOURNEY', 100) }, { plannedDate: '2026-11-13' })])), /JOURNEY_SHARED_DATE_INCOMPATIBLE/);
    await assert.rejects(() => evaluate(state([], [visit(100), context(101, 'family-visit', { transport: selections(mobility('taxi', 'taxi', { origin: home, destination, journey: journey('SHARES_JOURNEY', 100) })) })])), /JOURNEY_SHARED_MODE_INCOMPATIBLE/);
    await assert.rejects(() => evaluate(state([], [visit(100, { journey: journey('SHARES_JOURNEY', 999, { certainty: 'POSSIBLE' }) })])), /JOURNEY_TARGET_INTENT_MISSING/);
  });
  await test('C5-EXTRA-DIRECTIONAL-DATES', async () => {
    const semantic = state([], [stay(100, '10', { transport: selections(car({ returnRequired: true, plannedTime: '08:00', returnTime: '18:00' })) })]);
    semantic.contexts[0].fields.endDate = '2026-11-15'; const p = await evaluate(semantic);
    assert.equal(p.owner.calls.routes.length, 2); assert.deepEqual(p.owner.calls.routes.map(r => [r.plannedDate, r.plannedTime]), [['2026-11-12', '08:00'], ['2026-11-15', '18:00']]);
    await roundTrip(semantic);
  });
  await test('C5-EXTRA-FREE-OWNED', async () => {
    const p = await evaluate(state([], [context(100, 'family-visit', { transport: selections(mobility('free', 'walk', { origin: home, destination,
      journey: { relation: 'OWNS_JOURNEY', certainty: 'CERTAIN' } })) })]));
    assert.equal(p.compiled.journeys.length, 1); assert.equal(p.compiled.journeys[0].pricingState, 'RESOLVED'); assert.equal(p.projection.plan.impactOnMonthEnd, '0.00');
  });
  await test('C5-EXTRA-OVERNIGHT-NIGHT-OUT', async () => {
    const semantic = state([], [night(100, '20', { outbound: selections(car({ plannedTime: '20:00' })),
      return: selections(car({ origin: destination, destination: home, plannedTime: '02:00' })) })]);
    semantic.contexts[0].fields.endDate = '2026-11-13'; const p = await evaluate(semantic);
    assert.equal(p.compiled.journeys.length, 2); assert.deepEqual(p.owner.calls.routes.map(r => [r.plannedDate, r.plannedTime]).sort(),
      [['2026-11-12', '20:00'], ['2026-11-13', '02:00']]); await roundTrip(semantic);
    await assert.rejects(() => evaluate(state([], [visit(100, { returnRequired: true, plannedTime: '20:00', returnTime: '02:00' })])), /JOURNEY_RETURN_BEFORE_DEPARTURE/);
    await assert.rejects(() => evaluate(state([], [visit(100, { plannedTime: '20:00' }, { plannedDate: null })])), /JOURNEY_TIME_REQUIRES_DATE/);
  });
  await test('C5-EXTRA-RETURN-ACCESS-LEG', async () => {
    const semantic = state([], [stay(100, '10', { transport: selections(car({ returnRequired: true })) }),
      visit(101, { origin: destination, destination: home, journey: journey('USES_ACCESS_LEG', 100, { accessLegIndex: 1 }) }, { plannedDate: '2026-11-15' })]);
    semantic.contexts[0].fields.endDate = '2026-11-15'; const p = await roundTrip(semantic);
    assert.equal(p.compiled.journeys.length, 1); assert.equal(p.projection.mobility.usageEconomicCost, '4.00');
    await assert.rejects(() => evaluate(state([], [visit(100), visit(101, { returnRequired: true, journey: journey('SHARES_JOURNEY', 100) })])), /JOURNEY_SHARED_RETURN_INCOMPATIBLE/);
  });
  await test('C5-EXTRA-AUTHORIZED-PLACES', async () => {
    const invalid = { kind: 'KNOWN', placeId: uuid(999999) };
    for (const mode of ['car', 'taxi']) await assert.rejects(() => evaluate(state([], [context(100, 'family-visit', {
      transport: selections(mobility(mode, mode, { origin: home, destination: invalid, pricing: { fare: { kind: 'MANUAL', unitAmount: '12' } } })) })])), /PLANNED_ROUTE_PLACE_INVALID/);
  });
  await test('C5-EXTRA-WORLD-READER-INTEGRATION', async () => {
    const optionsModule = require('@/server/phase2/planned-context'), pricingModule = require('@/server/phase2/planner/prospective-mobility-pricing');
    const oldOptions = optionsModule.readPlannedContextOptions, oldPricing = pricingModule.preparePlanningMobility;
    const world = fixture(), mock = providers(), canonicalClient = {}, persons = []; let optionsReads = 0;
    world.mobilityFacts.vehicleHistory = { [world.mobilityFacts.vehicle.vehicleId]: [] };
    optionsModule.readPlannedContextOptions = async (client, household, members) => {
      assert.equal(client, canonicalClient); assert.equal(household, householdId); assert.equal(members, persons); optionsReads++;
      return { places: world.mobilityFacts.places, vehicle: world.mobilityFacts.vehicle };
    };
    pricingModule.preparePlanningMobility = (facts, semantic) => oldPricing(facts, semantic, mock.value);
    try {
      const { createPlannerDependencies } = require('@/server/phase2/planner/world-reader');
      const actual = createPlannerDependencies({ client: canonicalClient, context: { householdId, persons } }, pg.client);
      const semantic = state([], [visit(100), visit(101, { journey: journey('SHARES_JOURNEY', 100) })]);
      const prepared = await actual.prepareWorld(world, semantic), p = evaluatePlanScenario(prepared, semantic, base);
      assert.equal(optionsReads, 1); assert.equal(mock.calls.routes.length, 1); assert.equal(p.projection.mobility.usageEconomicCost, '2.00');
      await actual.prepareWorld(world, state([], [visit(100, { journey: { relation: 'NO_ADDITIONAL_MOBILITY', certainty: 'CERTAIN' } })]));
      assert.equal(optionsReads, 1);
      const paid = state([], [context(100, 'family-visit', { transport: selections(mobility('taxi', 'taxi', { origin: home, destination,
        pricing: { fare: { kind: 'MANUAL', unitAmount: '12' } } })) })]);
      assert.equal(evaluatePlanScenario(await actual.prepareWorld(world, paid), paid, base).projection.mobility.cashTransportCosts, '12.00'); assert.equal(optionsReads, 2);
    } finally { optionsModule.readPlannedContextOptions = oldOptions; pricingModule.preparePlanningMobility = oldPricing; }
  });
  await test('C5-EXTRA-GROSS-HISTORY-NOT-ADDITIVE', async () => {
    const world = fixture();
    world.forecast.components.push({ key: 'mobility-usage', label: 'Synthetic historical gross mobility', nature: 'HABITUAL_RANGE',
      additiveGroup: 'mobility', low: '400', central: '400', high: '400' });
    world.forecast.referencePlan.necessary.push({ key: 'manon-work-mobility', low: '50', central: '50', high: '50',
      method: 'CANONICAL_MOBILITY_WORKDAY_SCENARIO', observationCount: 30, provenance: ['synthetic:structural-work'], note: null });
    const p = await evaluate(state([], [visit()]), world);
    assert.equal(p.projection.plan.impactOnMonthEnd, '-2.00'); assert.equal(p.projection.economic.certainCommitments, '500.00');
    assert.equal(p.compiled.manifest.effectiveForecast.referencePlan.necessary.find(s => s.key === 'manon-work-mobility').central, '50');
    assert.equal(p.scenario.economicPlan.necessaryVariables.items.find(s => s.key === 'manon-work-mobility').central, '50');
  });
  await pg.verifyCanaries(); console.log(`C5_MOBILITY_READY = YES (${passed.length} oracle groups)`);
  if (process.env.PLANNER_C5_REPORT_PATH) fs.writeFileSync(process.env.PLANNER_C5_REPORT_PATH, JSON.stringify({ gate: 'C5_MOBILITY_READY', status: 'YES', passed,
    rpcEnvironment: 'PGLITE_SYNTHETIC_ONLY', remoteWrites: 0, historicalCanaryWrites: 0, providerCalls: 'SYNTHETIC_ONLY' }, null, 2));
} finally { await pg.close(); }
