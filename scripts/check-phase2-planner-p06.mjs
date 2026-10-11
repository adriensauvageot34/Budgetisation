import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { require } from './lib/phase2-ts-loader.mjs';
import { fixture, state, householdId, findSlot, control } from './fixtures/planner-headless.mjs';

const { projectCardKnowledge } = require('@/server/phase2/planner/card-knowledge');
const { references } = require('@/server/phase2/planner/baseline-evidence');
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { evaluatePlanScenario } = require('@/server/phase2/planner/preview');
const { semanticStateDigest } = require('@/domain/phase2/planner/semantic-state');
const { CardKnowledgePanel } = require('@/app/mois-a-venir/composer/card-knowledge-panel');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');

const world = fixture();
const assets = [
  ...world.baseline.slots.map(slot => ({ assetKey: `control:${slot.slotIdentityKey}`, kind: 'PLAN_CONTROL', capabilityRef: slot.slotIdentityKey })),
  ...['restaurant', 'fast-food', 'delivery', 'gift', 'family-visit', 'beauty-restock', 'night-out', 'short-stay', 'purchase']
    .map(templateKey => ({ assetKey: `template:${templateKey}`, kind: 'CONTEXT_ASSET', templateKey })),
  { assetKey: 'option:gift:item:gift', kind: 'SLOT_OPTION_ASSET', templateKey: 'gift' },
];
const cards = projectCardKnowledge(world, assets);
const grocery = findSlot(world, 'groceries'), restaurant = findSlot(world, 'restaurants');
const groceryKey = `control:${grocery.slotIdentityKey}`, restaurantKey = `control:${restaurant.slotIdentityKey}`;
const dimension = (card, key) => card.dimensions.find(item => item.key === key);
const checks = [], check = (name, fn) => { fn(); checks.push(name); console.log(`${name} PASS`); };
const clone = value => structuredClone(value);
const withHistory = (slot, samples) => {
  const next = clone(world);
  const target = next.baseline.slots.find(item => item.slotIdentityKey === slot.slotIdentityKey);
  target.historicalReferences = references(slot.historicalReferences.basis, slot.historicalReferences.requiredSources, samples);
  return projectCardKnowledge(next, assets);
};

check('A5-T01-UNCOVERED-IS-NOT-ZERO', () => {
  const result = withHistory(grocery, [{ month: '2026-01', value: '0.00', minimum: '0.00', evidenceRefs: ['zero'] },
    { month: '2026-02', value: null, minimum: null, evidenceRefs: [] },
    { month: '2026-03', value: '100.00', minimum: '100.00', evidenceRefs: ['known'] }]);
  const d = dimension(result[groceryKey], 'MONTH_AMOUNT');
  assert.equal(d.nCoveredMonths, 2); assert.equal(d.value, null); assert.equal(d.suggestionPolicy, 'REFERENCE_ONLY');
});
check('A5-T02-OWNER-ROBUST-MEDIAN', () => {
  const result = withHistory(grocery, ['100', '100', '100', '1000'].map((value, index) => ({
    month: `2026-0${index + 1}`, value, minimum: value, evidenceRefs: [`e${index}`] })));
  const d = dimension(result[groceryKey], 'MONTH_AMOUNT');
  assert.equal(d.value, '100.00'); assert.equal(d.p50, '100.00');
});
check('A5-T03-MONTH-OCCURRENCE-AND-UNIT-SEPARATE', () => {
  assert.equal(dimension(cards[groceryKey], 'MONTH_AMOUNT').unit, 'EUR_PER_MONTH');
  assert.equal(dimension(cards[restaurantKey], 'OCCURRENCE_COUNT').unit, 'OCCURRENCES_PER_MONTH');
  assert.equal(dimension(cards[restaurantKey], 'UNIT_PRICE').unit, 'EUR_PER_OCCURRENCE');
  assert.equal(dimension(cards['template:restaurant'], 'UNIT_PRICE').suggestionPolicy, 'REFERENCE_ONLY');
});
check('A5-T04-ONE-OBSERVATION-IS-NOT-HABIT', () => {
  const result = withHistory(grocery, [{ month: '2026-01', value: '450.00', minimum: '450.00', evidenceRefs: ['only'] }]);
  assert.equal(dimension(result[groceryKey], 'MONTH_AMOUNT').value, null);
});
check('A5-T05-THREE-MONTHS-NO-GENERIC-CONFIDENCE', () => {
  const d = dimension(cards[groceryKey], 'MONTH_AMOUNT');
  assert.equal(d.nCoveredMonths, 6); assert.equal(d.suggestionPolicy, 'OFFER_PREFILL');
  assert.equal(Object.hasOwn(d, 'confidenceScore'), false);
  const manon = world.baseline.slots.find(slot => slot.semanticKey === 'manon-work-meals');
  assert.equal(dimension(cards[`control:${manon.slotIdentityKey}`], 'OCCURRENCE_COUNT').suggestionPolicy, 'REFERENCE_ONLY');
  assert.ok(dimension(cards[`control:${manon.slotIdentityKey}`], 'OCCURRENCE_COUNT').reasonCodes.includes('OWNER_NEEDS_NEW_INPUT'));
});
check('A5-T06-PAYMENTS-DO-NOT-COUNT-RESTAURANTS', () => {
  assert.equal(dimension(cards[restaurantKey], 'OCCURRENCE_COUNT').sourceAuthority, 'planner-simple-occurrences@v1');
  assert.equal(dimension(cards['template:restaurant'], 'OCCURRENCE_COUNT').suggestionPolicy, 'REFERENCE_ONLY');
});
check('A5-T07-HOUSEHOLD-DOES-NOT-IMPLY-PARTICIPANTS', () => {
  assert.equal(cards['template:restaurant'].subjectScope, 'HOUSEHOLD');
  assert.equal(cards['template:restaurant'].subjectRef, null);
});
check('A5-T08-DECLARATION-DIFFERS-FROM-OBSERVATION', () => {
  const slot = world.baseline.slots.find(item => item.semanticKey === 'hairdresser');
  const d = dimension(cards[`control:${slot.slotIdentityKey}`], 'OCCURRENCE_COUNT');
  assert.equal(d.evidenceState, 'DECLARED'); assert.equal(d.nCoveredMonths, null);
  assert.equal(d.suggestionPolicy, 'REFERENCE_ONLY');
});
check('A5-T09-PRICE-DOES-NOT-INVENT-RENEWAL-DATE', () => {
  const slot = world.baseline.slots.find(item => item.semanticKey === 'hairdresser');
  const d = dimension(cards[`control:${slot.slotIdentityKey}`], 'UNIT_PRICE');
  assert.equal(d.value, '14.00'); assert.equal(d.coverageTo, null);
  assert.equal(cards['template:beauty-restock'].dimensions[0].suggestionPolicy, 'UNAVAILABLE');
});
check('A5-T10-ROUTE-DOES-NOT-PROVE-VISIT', () => {
  assert.equal(cards['template:family-visit'].dimensions[0].reasonCodes[0], 'ROUTE_DOES_NOT_PROVE_VISIT');
  assert.equal(cards['template:family-visit'].dimensions[0].value, null);
});
check('A5-T11-CHANGING-REFERENCE-DOES-NOT-OVERWRITE-DECISION', () => {
  const decided = state([control(grocery.slotIdentityKey, { amount: '350.00' }, 1)]);
  const before = semanticStateDigest(decided);
  const updated = clone(world); updated.baseline.slots.find(slot => slot.slotIdentityKey === grocery.slotIdentityKey)
    .historicalReferences.range.central = '400.00';
  const next = projectCardKnowledge(updated, assets);
  assert.equal(dimension(next[groceryKey], 'MONTH_AMOUNT').value, '400.00');
  assert.equal(semanticStateDigest(decided), before);
  assert.equal(decided.controls[0].value.amount, '350.00');
});
check('A5-T12-UNACCEPTED-REFERENCE-DOES-NOT-COMPILE', () => {
  const draft = state(), base = { expectedActiveRevisionId: null, expectedActiveRevisionNumber: 0 };
  const before = evaluatePlanScenario(world, draft, base).previewDigest;
  projectCardKnowledge(world, assets);
  assert.equal(evaluatePlanScenario(world, draft, base).previewDigest, before);
});
check('A5-T13-NO-PARENT-CONTEXT-PRICE', () => {
  for (const key of ['template:gift', 'template:night-out', 'template:short-stay'])
    assert.equal(cards[key].dimensions[0].suggestionPolicy, 'UNAVAILABLE');
});
check('A5-T14-SOURCE-REVISION-AND-EVIDENCE', () => {
  const d = dimension(cards[groceryKey], 'MONTH_AMOUNT');
  assert.deepEqual(d.sourceRefs, grocery.sourceRefs);
  assert.match(d.sourceDigests[0], /^[^:]+:[a-f0-9]{64}$/u);
  assert.equal(d.coverageFrom, '2026-01'); assert.equal(d.coverageTo, '2026-06');
});
check('A5-T15-READ-ONLY-NO-WRITER', () => {
  assert.equal(typeof projectCardKnowledge, 'function');
  assert.equal(cards['template:gift'].dimensions[0].value, null);
  assert.equal(world.baseline.slots.find(slot => slot.slotIdentityKey === grocery.slotIdentityKey).historicalReferences.range.central, '325.00');
});
check('A5-T16-DETERMINISTIC', () => {
  assert.deepEqual(projectCardKnowledge(world, assets), cards);
  const html = renderToStaticMarkup(React.createElement(CardKnowledgePanel, { knowledge: cards[groceryKey] }));
  assert.match(html, /6 mois comparables/u); assert.match(html, /2026-01 à 2026-06/u);
  assert.match(html, /propositions non retenues/u);
});
check('P06-FORECAST-IS-REFERENCE-ONLY', () => {
  const next = clone(world);
  next.forecast.components.push({ ...next.forecast.components[0], key: 'groceries', central: '345.00',
    low: '330.00', high: '360.00', ownerAuthority: 'GlobalForecastFixture', provenance: ['forecast:groceries'] });
  const forecast = dimension(projectCardKnowledge(next, assets)[groceryKey], 'FORECAST_MONTH');
  assert.equal(forecast.value, '345.00'); assert.equal(forecast.p50, null);
  assert.equal(forecast.suggestionPolicy, 'REFERENCE_ONLY');
  assert.equal(forecast.sourceAuthority, 'GlobalForecastFixture');
  next.forecast.components.at(-1).knowledgeState = 'CONDITIONAL_UNKNOWN';
  assert.equal(dimension(projectCardKnowledge(next, assets)[groceryKey], 'FORECAST_MONTH'), undefined);
});
check('P06-SOURCE-REVISION-CHANGE-IS-VISIBLE', () => {
  const next = clone(world), source = next.baseline.sourceRefs.find(ref => ref.sourceKey === grocery.sourceRefs[0]);
  source.digest = 'a'.repeat(64);
  const changed = dimension(projectCardKnowledge(next, assets)[groceryKey], 'MONTH_AMOUNT');
  assert.equal(changed.value, dimension(cards[groceryKey], 'MONTH_AMOUNT').value);
  assert.notDeepEqual(changed.sourceDigests, dimension(cards[groceryKey], 'MONTH_AMOUNT').sourceDigests);
});

const repository = { readActivePlan: async () => null };
const deps = { repository, readWorld: async () => world };
const response = await handleComposerRequest(deps, householdId, { kind: 'READ', sequence: 1, targetMonth: '2026-11', draft: state() });
assert.equal(response.ok, true, response.message);
assert.equal(response.model.cardKnowledge[groceryKey].dimensions[0].value, '325.00');
assert.equal(response.model.cardKnowledge['template:gift'].dimensions[0].value, null);
console.log('P06-COMPOSER-READ-MODEL PASS');

const baselineBytes = Buffer.byteLength(JSON.stringify({ ...response.model, cardKnowledge: undefined }));
const knowledgeBytes = Buffer.byteLength(JSON.stringify(response.model.cardKnowledge));
const samples = [];
for (let i = 0; i < 100; i++) {
  const start = performance.now(); projectCardKnowledge(world, response.model.library.searchableAssets); samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
console.log(JSON.stringify({ status: 'EXECUTED_PASS_SYNTHETIC_ONLY', checks, cards: Object.keys(response.model.cardKnowledge).length,
  baselineDtoBytes: baselineBytes, knowledgeDtoBytes: knowledgeBytes, totalDtoBytes: baselineBytes + knowledgeBytes,
  projectionP50Ms: Number(samples[49].toFixed(3)), projectionP95Ms: Number(samples[94].toFixed(3)),
  readWorldCalls: 1, remoteWrites: 0, authenticated: 'NOT_RUN' }));
