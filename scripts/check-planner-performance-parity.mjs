// Synthetic business goldens recorded on the pre-P2-A HEAD. No network or DB writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { require } from './lib/phase2-ts-loader.mjs';
import { fixture, state, uuid, control, findSlot, simpleMonth, nightMonth, weekendMonth, renewalMonth, externalMonth, activity } from './fixtures/planner-headless.mjs';
import { fixture as kernelFixture, context as genericContext, emptyState, seal } from './fixtures/planner-kernel.mjs';
import { providers, visit } from './fixtures/planner-mobility.mjs';
const { evaluatePlanScenario } = require('@/server/phase2/planner/preview');
const { preparePlanningMobility } = require('@/server/phase2/planner/prospective-mobility-pricing');
const { publishAdjustmentCapabilities } = require('@/server/phase2/planner/balance-assistant');
const { plannerDigest } = require('@/domain/phase2/planner/json');
const { mutatePlanSemanticState } = require('@/server/phase2/planner/semantic-mutations');
const NativeDate = Date, cutoff = '2026-10-06T21:00:00Z';
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [cutoff])); }
  static now() { return NativeDate.parse(cutoff); }
};
const emptyBase = { expectedActiveRevisionId: null, expectedActiveRevisionNumber: 0 };
const cases = [];
const add = (name, value, base = emptyBase) => cases.push({ name, ...value, base });
add('empty-no-plan', { world: fixture(), semantic: state() });
add('explicit-neutral-revision', { world: fixture(), semantic: state() }, { expectedActiveRevisionId: uuid(9901), expectedActiveRevisionNumber: 3 });
add('simple-month', simpleMonth());
const category = fixture();
add('category-target', { world: category, semantic: state([control(findSlot(category, 'groceries').slotIdentityKey, { amount: '300.00' })]) });
add('savings-adjustment', { world: fixture(), semantic: state([control(`savings:${uuid(700)}`, { amount: '60.00' })]) });
add('night-out-uber', nightMonth());
add('night-out-tram', nightMonth('train'));
add('short-stay-unresolved', weekendMonth());
add('short-stay-confirmed-consumption', weekendMonth(true));
add('needs-two-in-one-purchase', renewalMonth());
const renewal = renewalMonth();
add('empty-renewal-authority', { world: renewal.world, semantic: state() });
add('external-intent', externalMonth());
add('family-visit-mobility', { world: fixture(), semantic: state([], [visit(100)]) });
add('friend-visit-mobility', { world: fixture(), semantic: state([], [visit(100, {}, {}, 'friend-visit')]) });
add('unknown-context-cost', { world: fixture(), semantic: state([], [activity(200, null)]) });
const legacy = kernelFixture();
legacy.monthInputs.decision.assumptions = { 'household-restaurants': { mode: 'CUSTOM', amount: '999.00' } };
add('legacy-neutralized-once', { world: seal(legacy), semantic: { ...emptyState(), controls: [control('restaurants', { count: '2' })] } });
add('unresolved-displacement', { world: kernelFixture(), semantic: { ...emptyState(), contexts: [genericContext({ displacement: 'UNKNOWN' })] } });
add('occurrence-consumption', { world: kernelFixture(), semantic: { ...emptyState(), contexts: [genericContext()] } });
const suggested = simpleMonth();
suggested.semantic = mutatePlanSemanticState(state(), { kind: 'SET_STATE', targetRef: findSlot(suggested.world, 'groceries').slotIdentityKey, value: { amount: '300.00' } });
add('accepted-adjustment', suggested);
const unknownFunding = nightMonth();
unknownFunding.semantic.contexts[0].slotSelections.outbound.items[0].pricing.fundingAllocations = [];
add('unknown-funding', unknownFunding);
const midnight = nightMonth();
midnight.semantic.contexts[0].fields.plannedDate = '2026-11-30';
add('month-end-context', midnight);
const preserved = fixture(), preferences = state();
preferences.preferences = { anchors: [uuid(9900)], flexibility: { [findSlot(preserved, 'groceries').slotIdentityKey]: 'PRESERVE' } };
add('preferences-only', { world: preserved, semantic: preferences });

function selectedValues(value, predicate, path = '', found = []) {
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    const next = `${path}/${key}`;
    if (predicate(key)) found.push([next, child]);
    selectedValues(child, predicate, next, found);
  }
  return found;
}
const results = {};
// Optional undefined properties are absent from the wire/business JSON contract.
const digest = value => plannerDigest(JSON.parse(JSON.stringify(value)));
try {
  for (const item of cases) {
    const before = structuredClone(item.world);
    const world = await preparePlanningMobility(item.world, item.semantic, providers().value);
    const preview = evaluatePlanScenario(world, item.semantic, item.base);
    const capabilities = publishAdjustmentCapabilities(world, item.semantic, preview);
    assert.deepEqual(item.world, before, `${item.name}: evaluation mutated its authorities`);
    results[item.name] = {
      baseline: preview.baselineDigest, semantic: preview.semanticStateDigest, manifest: preview.compiledManifestDigest,
      projection: preview.projectionDigest, preview: preview.previewDigest, fullBusiness: digest(preview),
      capabilities: digest(capabilities),
      knowledge: digest(selectedValues(preview, key => /knowledge|unresolved|diagnostic|completeness/i.test(key))),
      identities: digest(selectedValues(preview, key => /(?:Id|Ids|IdentityKey|sourceRefs)$/.test(key))),
    };
  }
} finally { globalThis.Date = NativeDate; }
const record = process.argv.indexOf('--record');
const target = record >= 0 ? process.argv[record + 1] : new URL('./fixtures/planner-performance-parity.json', import.meta.url);
if (record >= 0) fs.writeFileSync(target, JSON.stringify({ cutoff, results }, null, 2) + '\n');
else assert.deepEqual(results, JSON.parse(fs.readFileSync(target, 'utf8')).results, 'Pre/post P2-A business parity');
console.log(JSON.stringify({ cases: cases.length, hashesPerCase: 9, parity: record >= 0 ? 'RECORDED' : 'PASS', remoteWrites: 0 }));
