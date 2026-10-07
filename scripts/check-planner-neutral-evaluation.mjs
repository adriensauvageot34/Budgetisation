// Count actual owner calls. No timing assertion, DB, network or personal data.
import assert from 'node:assert/strict';
import { require } from './lib/phase2-ts-loader.mjs';
import { fixture, state, uuid, control, findSlot, selections, component, activity,
  simpleMonth, nightMonth, weekendMonth, renewalMonth, externalMonth } from './fixtures/planner-headless.mjs';
import { fixture as kernelFixture, context as generic, emptyState, seal } from './fixtures/planner-kernel.mjs';
import { providers, visit } from './fixtures/planner-mobility.mjs';
const compiler = require('@/server/phase2/planner/compiler'), finance = require('@/server/phase2/month-scenario');
const { evaluatePlanScenario } = require('@/server/phase2/planner/preview');
const { preparePlanningMobility } = require('@/server/phase2/planner/prospective-mobility-pricing');
const { mutatePlanSemanticState } = require('@/server/phase2/planner/semantic-mutations');
const compile = compiler.compileSemanticPlan, derive = finance.deriveMonthScenario;
let calls, derives, completed;
compiler.compileSemanticPlan = function (input) { calls.push(input); const result = compile(input); completed++; return result; };
finance.deriveMonthScenario = function (...args) { derives++; return derive(...args); };
const base = { expectedActiveRevisionId: null, expectedActiveRevisionNumber: 0 }, cases = [];
const add = (name, value, reuse = false, revision = base) => cases.push({ name, ...value, reuse, base: revision });
add('empty-no-plan', { world: fixture(), semantic: state() }, true);
add('explicit-neutral-revision', { world: fixture(), semantic: state() }, true, { expectedActiveRevisionId: uuid(9901), expectedActiveRevisionNumber: 3 });
const removed = nightMonth();
add('fully-cancelled-context-final-state', { world: removed.world, semantic: mutatePlanSemanticState(removed.semantic,
  { kind: 'REMOVE_CONTEXT', contextOccurrenceId: removed.semantic.contexts[0].contextOccurrenceId }) }, true);
add('simple-month', simpleMonth());
const category = fixture();
add('category-target', { world: category, semantic: state([control(findSlot(category, 'groceries').slotIdentityKey, { amount: '300.00' })]) });
add('savings-adjustment', { world: fixture(), semantic: state([control(`savings:${uuid(700)}`, { amount: '60.00' })]) });
add('night-out-components-funding-mobility', nightMonth());
add('night-out-other-mobility-choice', nightMonth('train'));
add('short-stay-unresolved', weekendMonth());
add('short-stay-consumed-baseline', weekendMonth(true));
add('mobility-intent', { world: fixture(), semantic: state([], [visit(100)]) });
add('needs-attached', renewalMonth());
const auto = renewalMonth().world;
auto.baseline.slots.find(s => s.renewalAuthority).renewalAuthority.conditional = false; seal(auto);
add('automatically-owned-need-empty-state', { world: auto, semantic: state() }, true);
add('decision-on-automatically-owned-need', { world: auto, semantic: state([control(auto.baseline.slots.find(s => s.renewalAuthority).slotIdentityKey, { count: '0' })]) });
const legacy = kernelFixture();
legacy.monthInputs.decision.assumptions = { 'household-restaurants': { mode: 'CUSTOM', amount: '999.00' } };
add('legacy-neutralization', { world: seal(legacy), semantic: { ...emptyState(), controls: [control('restaurants', { count: '2' })] } });
add('unresolved-context-cost', { world: fixture(), semantic: state([], [activity(200, null)]) });
add('unresolved-displacement', { world: kernelFixture(), semantic: { ...emptyState(), contexts: [generic({ displacement: 'UNKNOWN' })] } });
add('baseline-occurrence-consumption', { world: kernelFixture(), semantic: { ...emptyState(), contexts: [generic()] } });
add('baseline-amount-consumption', { world: kernelFixture(), semantic: { ...emptyState(), contexts: [generic({ slot: 'clothing', amount: '30.00', count: null })] } });
const accepted = simpleMonth();
add('accepted-suggestion-SET_STATE', { world: accepted.world, semantic: mutatePlanSemanticState(state(),
  { kind: 'SET_STATE', targetRef: findSlot(accepted.world, 'groceries').slotIdentityKey, value: { amount: '300.00' } }) });
const unknown = nightMonth(); unknown.semantic.contexts[0].slotSelections.outbound.items[0].pricing.fundingAllocations = [];
add('unknown-funding', unknown);
const preferences = state(); preferences.preferences = { anchors: [uuid(9900)], flexibility: {} };
add('preferences-only', { world: fixture(), semantic: preferences });
const patched = nightMonth(), patchId = patched.semantic.contexts[0].contextOccurrenceId;
add('PATCH_CONTEXT', { world: patched.world, semantic: mutatePlanSemanticState(patched.semantic,
  { kind: 'PATCH_CONTEXT', contextOccurrenceId: patchId, slotKey: 'before', items: selections(component('before', '12.00')).items }) });
const partial = { world: fixture(), semantic: state([], [activity(200, '10.00'), activity(201, '15.00')]) };
partial.semantic = mutatePlanSemanticState(partial.semantic, { kind: 'REMOVE_CONTEXT', contextOccurrenceId: uuid(200) });
add('partial-CANCEL_CONTEXT', partial);
add('external-owned-target', externalMonth());
let passed = 0;
try {
  for (const item of cases) {
    const world = await preparePlanningMobility(item.world, item.semantic, providers().value);
    calls = []; derives = 0; completed = 0;
    const before = structuredClone(world), result = evaluatePlanScenario(world, item.semantic, item.base);
    assert.deepEqual(world, before, `${item.name}: authority mutation`);
    const references = calls.filter(input => Object.hasOwn(input, 'forcedOwnedSlotKeys'));
    assert.equal(references.length, item.reuse ? 0 : 1, `${item.name}: actual second compilation`);
    assert.equal(derives, completed, `${item.name}: financial owner used for every completed compilation`);
    if (item.reuse) { assert.equal(calls.length, 1); assert.equal(derives, 1); }
    else assert.ok(calls.length >= 2);
    if (item.name === 'legacy-neutralization') assert.ok(result.compiled.financialAdapterInput.adapterManifest.neutralizedLegacyAssumptions.length);
    if (item.name === 'automatically-owned-need-empty-state') assert.ok(result.compiled.financialAdapterInput.adapterManifest.planOwnedDecisionSlots.length);
    passed++; console.log(`${item.name} PASS (${calls.length} compile / ${derives} derive)`);
  }
  // A future Compiler requires its own equivalence proof; the default is recompute.
  const version = compiler.PLANNER_COMPILER_VERSION;
  try {
    compiler.PLANNER_COMPILER_VERSION = 'planner-semantic-compiler@future'; calls = []; derives = 0; completed = 0;
    evaluatePlanScenario(fixture(), state(), base);
    assert.equal(calls.length, 2); assert.equal(derives, 2); passed++;
  } finally { compiler.PLANNER_COMPILER_VERSION = version; }
  // Fail closed if an output ownership would change a reference slot. This
  // simulates an uncertain future effect without weakening the current guard.
  try {
    const world = fixture(), key = findSlot(world, 'groceries').slotIdentityKey;
    compiler.compileSemanticPlan = input => {
      const result = compile(input); calls.push(input); completed++;
      if (!Object.hasOwn(input, 'forcedOwnedSlotKeys')) result.financialAdapterInput.adapterManifest.planOwnedDecisionSlots.push(key);
      return result;
    };
    calls = []; derives = 0; completed = 0;
    evaluatePlanScenario(world, state(), base);
    assert.equal(calls.length, 2); assert.equal(derives, 2); passed++;
  } finally { compiler.compileSemanticPlan = compile; }
} finally { compiler.compileSemanticPlan = compile; finance.deriveMonthScenario = derive; }
console.log(JSON.stringify({ cases: passed, neutralReuse: 'PASS', failClosed: 'PASS', remoteWrites: 0 }));
