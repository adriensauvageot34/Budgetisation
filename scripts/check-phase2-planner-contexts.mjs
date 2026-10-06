import assert from 'node:assert/strict';
import fs from 'node:fs';
import { require } from './lib/phase2-ts-loader.mjs';
import { fixture, state, control, uuid, householdId, findSlot, rebuild, selections, component, child, mobility, context, restaurant, activity, stay, night } from './fixtures/planner-contexts.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { externalExpense } from './fixtures/planner-kernel.mjs';
const { publishContextRegistry } = require('@/server/phase2/planner/context-registry');
const { setContextSlotSelections, acceptContextSuggestion, reparentContext, promoteComponentToChildContext } = require('@/server/phase2/planner/context-state');
const { evaluatePlanScenario } = require('@/server/phase2/planner/preview');
const { previewPlanScenario, applyPlanScenario } = require('@/server/phase2/planner/apply');
const { resolveEffectiveMonthScenario } = require('@/server/phase2/planner/effective-month-scenario');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { deriveMonthScenario } = require('@/server/phase2/month-scenario');
const { financialAdapterForecast } = require('@/server/phase2/planner/financial-adapter');
const base = { expectedActiveRevisionId: null, expectedActiveRevisionNumber: 0 };
const evaluate = (semantic, world = fixture()) => evaluatePlanScenario(world, semantic, base);
const warning = (p, code) => assert.ok(p.compiled.constraints.some(c => c.code === code), code);
const passed = [], test = async (id, run) => { await run(); passed.push(id); console.log(`${id} PASS`); };
const pg = await createKernelPostgres(); let current = fixture(), requestId = 6000;
const deps = { repository: createPlanApplyRepository(pg.client), readWorld: async () => structuredClone(current),
  readDirectWorld: async () => ({ forecast: current.forecast, monthInputs: current.monthInputs, externalIntents: current.externalIntents, asOfDate: current.asOfDate }) };
const command = p => ({ expectedActiveRevisionId: p.baseActiveRevisionId, expectedActiveRevisionNumber: p.baseRevisionNumber,
  expectedBaselineDigest: p.baselineDigest, expectedPreviewDigest: p.previewDigest, applyRequestId: uuid(requestId++) });
async function roundTrip(semantic, world = fixture()) {
  current = world;
  const before = structuredClone(world), p = await previewPlanScenario(deps, householdId, semantic), cmd = command(p);
  assert.notEqual(p.projection.applyReadiness, 'BLOCKED');
  const applied = await applyPlanScenario(deps, householdId, semantic, cmd);
  assert.deepEqual(applied.projectionEvidence.projection, p.projection);
  const reload = await resolveEffectiveMonthScenario(deps, householdId, '2026-11');
  assert.equal(reload.evidenceStatus, 'EXACT'); assert.deepEqual(reload.scenario, p.scenario);
  assert.deepEqual(reload.preview.projection, p.projection); assert.equal(reload.preview.compiledManifestDigest, p.compiledManifestDigest);
  assert.deepEqual(world, before); await pg.verifyCanaries(); return p;
}
try {
  await test('CTX-001', async () => {
    const first = state([], [night(400, '20.00', { return: selections(mobility('taxi')) })]);
    const second = setContextSlotSelections(first, uuid(400), 'return', [mobility('train')]);
    const a = evaluate(first), b = await roundTrip(second);
    assert.equal(a.compiled.mobilityIntents.length, 1); assert.equal(b.compiled.mobilityIntents.length, 1);
    assert.equal(a.compiled.mobilityIntents[0].mobilityIntentId, b.compiled.mobilityIntents[0].mobilityIntentId);
    assert.equal(b.compiled.mobilityIntents[0].mode, 'TRAIN'); assert.equal(b.compiled.mobilityIntents[0].role, 'RETURN');
    assert.equal(b.compiled.components.length, 1); assert.equal(b.projection.economic.explicitContexts, '20.00');
    assert.deepEqual(b.compiled.journeys, []); warning(b, 'CONTEXT_MOBILITY_PRICING_PENDING_C5');
  });
  await test('CTX-002', async () => {
    const first = state([], [stay(300, '100.00', { restaurants: selections(component('restaurant', '20.00', 'dinner')) })]);
    const promoted = promoteComponentToChildContext(first, uuid(300), 'restaurants', 'dinner', restaurant(100, '25.00'));
    const p = await roundTrip(promoted);
    assert.equal(p.compiled.contexts.length, 2); assert.equal(p.compiled.components.length, 2);
    assert.equal(p.projection.economic.explicitContexts, '125.00'); assert.equal(p.projection.plan.impactOnMonthEnd, '-105.00');
    assert.equal(p.compiled.planSlots.find(s => s.baseline.simpleAuthority?.domain === 'restaurants').remainingCount, '1.00');
    assert.equal(p.compiled.contexts.find(c => c.contextOccurrenceId === uuid(300)).componentIds.length, 1);
  });
  await test('C4-001', async () => {
    const semantic = state([], [night(400, '20.00', { extras: selections(component('extra', '50.00', 'optional', { provenance: 'PERSONAL_SUGGESTION' })) })]);
    const p = await roundTrip(semantic); assert.equal(p.compiled.components.length, 1); assert.equal(p.projection.plan.impactOnMonthEnd, '-20.00');
    warning(p, 'CONTEXT_SUGGESTION_EXCLUDED');
    const accepted = acceptContextSuggestion(semantic, uuid(400), 'extras', 'optional'), next = await roundTrip(accepted);
    assert.equal(next.compiled.components.length, 2); assert.equal(next.projection.plan.impactOnMonthEnd, '-70.00'); assert.equal(next.baselineDigest, p.baselineDigest);
    assert.equal(next.compiled.components.find(c => c.role === 'extras').selectionProvenance, 'EXPLICIT_USER_DECISION');
  });
  await test('C4-002', async () => {
    const first = state([], [night(400, '20.00', { food: selections(component('restaurant', '25.00', 'first')) })]);
    const second = setContextSlotSelections(first, uuid(400), 'food', [component('fast-food', '12.00', 'second')]);
    const p = await roundTrip(second);
    assert.equal(p.compiled.components.length, 2); assert.equal(p.projection.economic.explicitContexts, '32.00');
    assert.ok(!p.compiled.components.some(c => c.label === 'Synthetic restaurant'));
    assert.equal(p.compiled.planSlots.find(s => s.baseline.simpleAuthority?.domain === 'restaurants').remainingCount, '2.00');
    assert.equal(p.compiled.planSlots.find(s => s.baseline.simpleAuthority?.domain === 'fast-food').remainingCount, '0.00');
    assert.equal(first.contexts[0].slotSelections.food.items[0].optionKey, 'restaurant');
    assert.throws(() => evaluate(state([], [night(400, '20.00', { food: selections(component('restaurant', '20.00'), component('fast-food', '10.00')) })])), /ONE_OF_MULTIPLE_SELECTIONS/);
  });
  await test('C4-003', async () => {
    const n = 12, children = Array.from({ length: n }, (_, i) => activity(200 + i, '1.00', 300));
    const semantic = state([], [stay(300, '80.00', { activities: selections(...children.map(c => child('activity', Number(c.contextOccurrenceId.slice(-12))))) }), ...children]);
    const p = await roundTrip(semantic);
    assert.equal(p.compiled.contexts.length, 13); assert.equal(p.compiled.components.length, 13); assert.equal(p.projection.economic.explicitContexts, '92.00');
    assert.equal(p.compiled.contexts.find(c => c.contextOccurrenceId === uuid(300)).childContextIds.length, n);
  });
  await test('C4-004', async () => {
    const first = state([], [stay(300, '30.00', { activities: selections(child('activity', 200)) }), stay(301, '40.00'), activity(200, '10.00', 300)]);
    const second = reparentContext(first, uuid(200), uuid(301), 'activities', 'relocated');
    const a = await roundTrip(first), b = await roundTrip(second);
    assert.equal(second.contexts.find(c => c.contextOccurrenceId === uuid(200)).parentContextOccurrenceId, uuid(301));
    assert.equal(a.compiled.components.find(c => c.contextOccurrenceId === uuid(200)).componentId, b.compiled.components.find(c => c.contextOccurrenceId === uuid(200)).componentId);
    assert.deepEqual(a.scenario, b.scenario); assert.equal(b.compiled.contexts.find(c => c.contextOccurrenceId === uuid(300)).childContextIds.length, 0);
  });
  await test('C4-005', async () => {
    const p = await roundTrip(state([], [restaurant()])), request = p.compiled.components[0], effect = p.compiled.contextualEffects[0];
    assert.equal(request.binding.relation, 'CONSUMES_SLOT'); assert.equal(effect.displacedAmount, '20.00'); assert.equal(effect.incrementalAmount, '0.00');
    assert.equal(p.projection.plan.impactOnMonthEnd, '0.00'); assert.equal(p.compiled.planSlots.find(s => s.baseline.simpleAuthority?.domain === 'restaurants').remainingCount, '1.00');
    assert.ok(effect.evidenceRefs.some(ref => ref.startsWith('capability:'))); assert.ok(effect.evidenceRefs.some(ref => ref.startsWith('decision:')));
  });
  await test('C4-006', async () => {
    const first = state([], [stay(300, '100.00', { groceries: selections(component('groceries', '50.00')) })]);
    const p = await roundTrip(first), effect = p.compiled.contextualEffects.find(e => e.slotRelation === 'UNRESOLVED');
    assert.equal(effect.displacedAmount, null); assert.equal(effect.incrementalAmount, null); assert.equal(effect.economicRelation, 'UNKNOWN');
    assert.equal(p.compiled.planSlots.find(s => s.baseline.simpleAuthority?.domain === 'groceries').owned, false);
    assert.equal(p.projection.plan.economicMonthEndRemainder, null); assert.equal(p.projection.projectionCompleteness, 'UNKNOWN');
    const confirmed = setContextSlotSelections(first, uuid(300), 'groceries', [component('groceries', '50.00', 'groceries', { binding: { mode: 'CONFIRMED_CONSUMPTION' } })]);
    const known = await roundTrip(confirmed); assert.equal(known.projection.plan.impactOnMonthEnd, '-100.00');
    assert.equal(known.compiled.contextualEffects.find(e => e.slotRelation === 'CONSUMES_SLOT').displacedAmount, '50.00');
  });
  await test('C4-007', async () => {
    const semantic = state([], [night(400, '10.00', { before: selections(component('before', '15.00')), food: selections(component('restaurant', '20.00')),
      extras: selections(component('extra', '3.00')) })]);
    const p = await roundTrip(semantic); assert.equal(p.compiled.components.length, 4); assert.equal(p.projection.economic.explicitContexts, '48.00');
    assert.equal(p.projection.plan.impactOnMonthEnd, '-28.00');
    const next = evaluate(setContextSlotSelections(semantic, uuid(400), 'main', [component('main', '20.00')]));
    assert.equal(next.projection.economic.explicitContexts, '58.00');
    assert.throws(() => evaluate(state([], [context(400, 'night-out', {}, { total: '99.00' })])), /PLANNER_FIELDS_INVALID/);
  });
  await test('C4-008', async () => {
    const semantic = state([], [stay(300, '100.00', { restaurants: selections(child('restaurant', 100)), activities: selections(child('activity', 200)) }),
      restaurant(100, '20.00', 300), activity(200, '10.00', 300)]);
    const p = await roundTrip(semantic); assert.equal(p.compiled.components.length, 3); assert.equal(p.projection.economic.explicitContexts, '130.00');
    assert.equal(p.projection.plan.impactOnMonthEnd, '-110.00');
    for (const key of ['night-out', 'short-stay']) {
      const template = publishContextRegistry().templates.find(t => t.templateKey === key);
      assert.ok(!JSON.stringify(template).includes('unitAmount')); assert.ok(!JSON.stringify(template).includes('economicAmount'));
    }
  });
  await test('C4-009', async () => {
    const semantic = state([], [context(500, 'other-context', { children: selections(child('friend-visit', 600)) }),
      context(600, 'friend-visit', { activities: selections(child('activity', 200)) }, {}, 500), activity(200, '10.00', 600)]);
    const p = await roundTrip(semantic); assert.equal(p.compiled.components.length, 1); assert.equal(p.projection.economic.explicitContexts, '10.00');
    assert.equal(new Set(p.compiled.components.map(c => c.componentId)).size, 1);
    assert.equal(p.compiled.financialAdapterInput.adapterManifest.syntheticPlannedEntryOwners.filter(o => o.ownerRef === p.compiled.components[0].componentId).length, 1);
  });
  await test('C4-010', async () => {
    current = fixture(); const semantic = state([], [restaurant()]), before = await pg.counts(), calls = pg.rpcCalls;
    const p = await previewPlanScenario(deps, householdId, semantic); assert.deepEqual(await pg.counts(), before); assert.equal(pg.rpcCalls, calls);
    assert.equal(current.externalIntents.length, 0); assert.ok(p.compiled.financialAdapterInput.plannedExpenseEntries.some(e => e.id.startsWith('planner:')));
    await roundTrip(semantic); assert.equal(pg.rpcCalls, calls + 1); await pg.verifyCanaries();
    assert.deepEqual(Object.keys(require('@/server/phase2/planner/repository').createPlanRepository(pg.client)).sort(), ['readActivePlan', 'readRevision']);
  });
  await test('C4-EXTRA-REGISTRY', () => {
    const registry = publishContextRegistry();
    assert.deepEqual(registry.templates.map(t => t.templateKey).sort(), ['restaurant', 'fast-food', 'delivery', 'activity', 'family-visit', 'friend-visit', 'purchase', 'night-out', 'short-stay', 'beauty-restock', 'gift', 'home-project', 'other-context'].sort());
    for (const template of registry.templates) {
      const p = evaluate(state([], [context(100, template.templateKey, {}, { plannedDate: null })]));
      assert.equal(p.compiled.components.length, 0); assert.ok(p.compiled.contexts[0].componentSlots.length);
      assert.ok(!p.compiled.constraints.some(c => c.severity === 'BLOCK'));
      for (const slot of template.componentSlots) assert.ok(template.capabilities.some(c => c.slotKey === slot.slotKey));
      const pricedSlot = template.componentSlots.find(s => s.cardinality === 'REQUIRED_ONE' && s.options.some(o => o.kind === 'COMPONENT'))
        ?? template.componentSlots.find(s => s.options.some(o => o.kind === 'COMPONENT'));
      const option = pricedSlot.options.find(o => o.kind === 'COMPONENT');
      const priced = evaluate(state([], [context(100, template.templateKey, { [pricedSlot.slotKey]: selections(component(option.optionKey, '5.00', 'valued', { quantity: '2' })) })]));
      assert.equal(priced.compiled.components.length, 1, template.templateKey); assert.equal(priced.projection.economic.explicitContexts, '10.00', template.templateKey);
      assert.deepEqual(priced.compiled.needs, []); assert.deepEqual(priced.compiled.journeys, []);
    }
    assert.throws(() => registry.templates.push({}), TypeError);
    assert.throws(() => registry.templates[0].componentSlots[0].options.push({}), TypeError);
  });
  await test('C4-EXTRA-INCOMPLETE', async () => {
    const p = await roundTrip(state([], [context(400, 'night-out', {}, { plannedDate: null })]));
    assert.equal(p.compiled.components.length, 0); assert.equal(p.projection.economic.explicitContexts, null); assert.equal(p.projection.plan.economicMonthEndRemainder, null);
    assert.equal(p.projection.applyReadiness, 'READY_WITH_WARNINGS'); warning(p, 'CONTEXT_COMPONENT_SLOT_UNRESOLVED');
    assert.equal(p.compiled.contexts[0].componentSlots.find(s => s.slotKey === 'main').selections[0].provenance, 'STRUCTURAL_DEFAULT');
  });
  await test('C4-EXTRA-PURCHASE-AMOUNT', async () => {
    const semantic = state([control('clothing', { amount: '100.00' })], [context(700, 'purchase', { item: selections(component('item', '70.00')) }, { budgetDomain: 'clothing' })]);
    const p = await roundTrip(semantic), effect = p.compiled.contextualEffects[0];
    assert.equal(effect.displacedAmount, '70.00'); assert.equal(effect.incrementalAmount, '0.00');
    assert.equal(p.compiled.planSlots.find(s => s.baseline.simpleAuthority?.domain === 'clothing').remainingAmount, '30.00');
    assert.equal(p.projection.plan.impactOnMonthEnd, '-100.00');
    const larger = evaluate(setContextSlotSelections(semantic, uuid(700), 'item', [component('item', '130.00')]));
    assert.equal(larger.compiled.contextualEffects[0].displacedAmount, '100.00'); assert.equal(larger.compiled.contextualEffects[0].incrementalAmount, '30.00');
    assert.equal(larger.projection.plan.impactOnMonthEnd, '-130.00');
  });
  await test('C4-EXTRA-CHILD-SUGGESTION', async () => {
    const semantic = state([], [stay(300, '100.00', { activities: selections(child('activity', 200, 'suggestion', 'PERSONAL_SUGGESTION')) }), activity(200, '50.00', 300)]);
    const p = await roundTrip(semantic); assert.equal(p.compiled.components.length, 1); assert.equal(p.projection.economic.explicitContexts, '100.00');
    assert.equal(p.compiled.contexts.find(c => c.contextOccurrenceId === uuid(200)).status, 'SUGGESTED');
    const accepted = await roundTrip(acceptContextSuggestion(semantic, uuid(300), 'activities', 'suggestion'));
    assert.equal(accepted.projection.economic.explicitContexts, '150.00');
  });
  await test('C4-EXTRA-ONE-OF-CHILD', async () => {
    const semantic = state([], [night(400, '20.00', { food: selections(child('restaurant', 100)) }), restaurant(100, '25.00', 400)]);
    const replaced = setContextSlotSelections(semantic, uuid(400), 'food', [component('delivery', '15.00')]);
    assert.equal(replaced.contexts.length, 1); const p = await roundTrip(replaced);
    assert.equal(p.compiled.components.length, 2); assert.equal(p.projection.economic.explicitContexts, '35.00');
    assert.equal(p.compiled.contextualEffects.find(e => e.slotRelation === 'CONSUMES_SLOT').displacedAmount, '15.00');
  });
  await test('C4-EXTRA-GRAPH-GUARDS', () => {
    assert.throws(() => evaluate(state([], [stay(300), activity(200, '10.00', 300)])), /PARENT_SOCKET_REQUIRED/);
    assert.throws(() => evaluate(state([], [night(400, '20.00', { food: selections(child('activity', 200)) }), activity(200, '10.00', 400)])), /CHILD_CAPABILITY_FORBIDDEN/);
    assert.throws(() => evaluate(state([], [stay(300, '100.00', { activities: selections(child('activity', 200, 'a'), child('activity', 200, 'b')) }), activity(200, '10.00', 300)])), /CHILD_MULTIPLE_OWNERS/);
    assert.throws(() => evaluate(state([], [stay(300, '100.00', { activities: selections(child('activity', 200)) }), activity(200)])), /CHILD_LINK_INVALID/);
    const semantic = state([], [context(500, 'other-context', { children: selections(child('friend-visit', 600)) }), context(600, 'friend-visit', {}, {}, 500)]);
    assert.throws(() => reparentContext(semantic, uuid(500), uuid(600), 'activities', 'cycle'), /CHILD_CAPABILITY_FORBIDDEN/);
  });
  await test('C4-EXTRA-STRUCTURAL-AUTHORITY', () => {
    assert.throws(() => evaluate(state([], [night(400, '20.00', { extras: selections(component('extra', '999.00', 'forged', { provenance: 'STRUCTURAL_DEFAULT' })) })])), /STRUCTURAL_DEFAULT_FORGED/);
    assert.throws(() => evaluate(state([], [night(400, '20.00', { invented: selections(component('extra', '5.00')) })])), /PLANNER_FIELDS_INVALID/);
    assert.throws(() => evaluate(state([], [context(300, 'short-stay', {}, { plannedDate: '2026-11-20', endDate: '2026-11-19' })])), /CONTEXT_DATE_RANGE_INVALID/);
  });
  await test('C4-EXTRA-UNCOVERED-BINDING', () => {
    const world = fixture(); delete world.sources.simpleOccurrences; rebuild(world);
    const p = evaluate(state([], [restaurant()]), world); assert.equal(p.compiled.components[0].binding.relation, 'UNRESOLVED');
    assert.equal(p.compiled.contextualEffects[0].displacedAmount, null); assert.equal(findSlot(world, 'restaurants').baselineValue.count, null);
  });
  await test('C4-EXTRA-PROJECT-INCOMPLETE', async () => {
    for (const key of ['beauty-restock', 'home-project', 'other-context']) {
      const incomplete = evaluate(state([], [context(700, key)]));
      assert.equal(incomplete.projection.plan.economicMonthEndRemainder, null); assert.equal(incomplete.projection.economic.explicitContexts, null);
      assert.equal(incomplete.compiled.components.length, 0); warning(incomplete, 'CONTEXT_COMPONENT_SLOT_UNRESOLVED');
    }
    const home = await roundTrip(state([], [context(700, 'home-project', { services: selections(component('service', '30.00')) })]));
    assert.equal(home.projection.economic.explicitContexts, '30.00'); assert.equal(home.projection.plan.impactOnMonthEnd, '-30.00');
    assert.equal(home.compiled.contextualEffects[0].slotRelation, 'NO_RELATED_SLOT');
  });
  await test('C4-EXTRA-MOBILITY-NO-FUSION', async () => {
    const places = { origin: { kind: 'TEXT', label: 'Synthetic origin' }, destination: { kind: 'TEXT', label: 'Synthetic destination' } };
    const semantic = state([], [night(400, '20.00', { outbound: selections(mobility('car', 'out', places)), return: selections(mobility('car', 'back', places)) })]);
    const p = await roundTrip(semantic); assert.equal(p.compiled.mobilityIntents.length, 2);
    assert.equal(new Set(p.compiled.mobilityIntents.map(i => i.mobilityIntentId)).size, 2); assert.deepEqual(p.compiled.journeys, []);
    assert.equal(p.projection.plan.economicMonthEndRemainder, null); assert.equal(p.compiled.components.length, 1);
    const unknown = evaluate(state([], [night(400, '20.00', { return: selections(mobility('unknown')) })]));
    assert.equal(unknown.compiled.mobilityIntents[0].knowledge, 'UNKNOWN');
    const suggested = state([], [night(400, '20.00', { return: selections(mobility('free', 'suggested', { ...places, provenance: 'PERSONAL_SUGGESTION' })) })]);
    assert.equal(evaluate(suggested).compiled.mobilityIntents.length, 0);
    const accepted = acceptContextSuggestion(suggested, uuid(400), 'return', 'suggested'), declared = evaluate(accepted);
    assert.equal(declared.compiled.mobilityIntents.length, 1); assert.equal(declared.compiled.mobilityIntents[0].origin.provenance, 'USER_DECLARED_PROSPECTIVE');
    assert.equal(declared.compiled.mobilityIntents[0].knowledge, 'DECLARED'); assert.equal(declared.projection.plan.impactOnMonthEnd, '-20.00');
    assert.throws(() => evaluate(state([], [night(400, '20.00', { return: selections({ ...mobility('car'), cost: { kind: 'MANUAL', unitAmount: '3.00' } }) })])), /PLANNER_FIELDS_INVALID/);
  });
  await test('C4-EXTRA-EXPLICIT-RELATIONS', async () => {
    for (const mode of ['EXTRA_TO_SLOT', 'NO_RELATED_SLOT']) {
      const p = await roundTrip(state([], [context(100, 'restaurant', { meal: selections(component('restaurant', '20.00', 'meal', { binding: { mode } })) })]));
      assert.equal(p.compiled.contextualEffects[0].slotRelation, mode); assert.equal(p.compiled.contextualEffects[0].displacedAmount, '0.00');
      assert.equal(p.projection.plan.impactOnMonthEnd, '-20.00');
    }
  });
  await test('C4-EXTRA-UNPRICED-INTENTION', async () => {
    const p = await roundTrip(state([], [activity(200, null)]));
    assert.equal(p.compiled.components[0].evaluation.economicAmount, null); assert.equal(p.projection.economic.explicitContexts, null);
    assert.equal(p.projection.plan.economicMonthEndRemainder, null); assert.equal(p.projection.plan.impactOnMonthEnd, null);
    assert.equal(p.projection.applyReadiness, 'READY_WITH_WARNINGS');
    assert.ok(p.compiled.constraints.some(c => c.code === 'COMPONENT_COST_UNKNOWN' && c.severity === 'WARN'));
    assert.equal(p.compiled.financialAdapterInput.plannedExpenseEntries.length, 0);
  });
  await test('C4-EXTRA-FREQUENCY-VS-QUANTITY', async () => {
    const semantic = state([], [context(100, 'restaurant', { meal: selections(component('restaurant', '20.00', 'meal', { quantity: '2' })), extras: selections(component('extra', '5.00')) })]);
    const p = await roundTrip(semantic); assert.equal(p.projection.economic.explicitContexts, '45.00');
    assert.equal(p.compiled.financialAdapterInput.adapterManifest.baselineConsumptions.length, 1); assert.equal(p.compiled.financialAdapterInput.adapterManifest.baselineConsumptions[0].count, '1.00');
    assert.equal(p.projection.plan.impactOnMonthEnd, '-25.00');
  });
  await test('C4-EXTRA-EXTERNAL-ONCE', async () => {
    const world = fixture(), expense = externalExpense(); expense.costItems[0].unitAmount = '20.00';
    world.externalIntents = [expense]; world.sources.plannedExpenses = [expense]; rebuild(world);
    const p = await roundTrip(state([], [restaurant()]), world);
    assert.equal(p.compiled.planSlots.find(s => s.baseline.simpleAuthority?.domain === 'restaurants').remainingCount, '0.00');
    assert.equal(p.compiled.financialAdapterInput.plannedExpenseEntries.filter(e => e.id === expense.id).length, 1);
    assert.equal(p.projection.plan.impactOnMonthEnd, '0.00');
  });
  await test('C4-EXTRA-FINANCIAL-OWNER', () => {
    const world = fixture(), semantic = state([], [stay(300, '100.00', { restaurants: selections(child('restaurant', 100)) }), restaurant(100, '20.00', 300)]), before = structuredClone(world);
    const p = evaluate(semantic, world);
    assert.deepEqual(p.scenario, deriveMonthScenario(financialAdapterForecast(world, p.compiled.planSlots), p.compiled.financialAdapterInput.effectiveMonthInputs, null, world.asOfDate, p.compiled.financialAdapterInput.plannedExpenseEntries));
    assert.deepEqual(world, before);
    const reversed = { ...semantic, contexts: [...semantic.contexts].reverse() };
    assert.equal(evaluate(reversed, world).compiledManifestDigest, p.compiledManifestDigest);
    for (const name of ['context-registry', 'context-state', 'context-selections', 'context-compiler']) {
      const source = fs.readFileSync(`src/server/phase2/planner/${name}.ts`, 'utf8');
      assert.ok(!/\bderiveMonthScenario\b|\.\s*(?:insert|upsert|update|delete|rpc)\s*\(/u.test(source), name);
    }
  });
  await test('C4-EXTRA-STALE-ZERO-WRITES', async () => {
    current = fixture(); current.costQuotes.hotel = { unitAmount: '100.00', evidenceRef: 'synthetic:hotel', modelVersion: 'synthetic-quote@v1', observedAt: '2026-10-01T00:00:00Z' };
    const semantic = state([], [stay(300, '100.00', { lodging: selections(component('lodging', '100.00', 'hotel', { cost: { kind: 'QUOTE', quoteKey: 'hotel' } })) })]);
    const p = await previewPlanScenario(deps, householdId, semantic), writes = pg.rpcCalls;
    current.costQuotes.hotel.unitAmount = '120.00';
    await assert.rejects(() => applyPlanScenario(deps, householdId, semantic, command(p)), /PLANNER_PREVIEW_STALE/); assert.equal(pg.rpcCalls, writes);
  });
  await test('C4-EXTRA-INCOMPATIBLE-ZERO-WRITES', async () => {
    current = fixture(); const semantic = state([], [restaurant()]), p = await previewPlanScenario(deps, householdId, semantic), writes = pg.rpcCalls;
    const invalid = state([], [night(400, '20.00', { food: selections(child('activity', 200)) }), activity(200, '10.00', 400)]);
    await assert.rejects(() => applyPlanScenario(deps, householdId, invalid, command(p)), /CHILD_CAPABILITY_FORBIDDEN/); assert.equal(pg.rpcCalls, writes);
  });
  await pg.verifyCanaries(); console.log(`C4_CONTEXT_KERNEL_READY = YES (${passed.length} oracle groups)`);
  if (process.env.PLANNER_C4_REPORT_PATH) fs.writeFileSync(process.env.PLANNER_C4_REPORT_PATH, JSON.stringify({
    gate: 'C4_CONTEXT_KERNEL_READY', status: 'YES', passed, rpcEnvironment: 'PGLITE_SYNTHETIC_ONLY', remoteWrites: 0, historicalCanaryWrites: 0
  }, null, 2));
} finally { await pg.close(); }
