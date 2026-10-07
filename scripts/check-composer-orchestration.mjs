// Execute the real orchestration with controlled owner completion; no network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { Temporal } from '@js-temporal/polyfill';
const require = createRequire(import.meta.url);
const householdId = '00000000-0000-4000-8000-000000000001';
const personId = '00000000-0000-4000-8000-000000000002';
const cutoff = '2026-10-06T21:00:00Z';
const keys = ['forecast', 'authorities', 'inputs', 'evidence', 'planned', 'products', 'legs', 'mobility', 'purchase', 'activities'];
const unhandled = [];
const onUnhandled = error => unhandled.push(error);
process.on('unhandledRejection', onUnhandled);
function load(file, imports) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  }, fileName: file }).outputText;
  new Function('require', 'exports', source)(name => {
    assert.ok(Object.hasOwn(imports, name), `Unstubbed import ${name}`);
    return imports[name];
  }, exports);
  return exports;
}
function fixture({ missingPeriods = false, unknown = false, conflict = false } = {}) {
  const gates = Object.fromEntries(keys.map(key => {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return [key, { promise, resolve, reject }];
  }));
  const calls = [], reads = [];
  const owner = key => (...args) => { calls.push({ key, args }); return gates[key].promise; };
  const forecast = { meta: { targetMonth: '2026-10', sourcePublicationId: 'publication-a', sourceRevision: 3, analyticsRevision: 4 },
    resourceMeta: { contractVersion: 'forecast-fixture' }, marker: 'published amounts unchanged' };
  const product = { needKey: 'synthetic-need', price: unknown ? null : '12.00', evidenceRefs: ['observation:synthetic'] };
  const values = {
    forecast, authorities: { publication: { publication_id: 'publication-a', source_revision: 3, published_analytics_revision: 4 }, background: { food: { status: unknown ? 'UNKNOWN' : 'KNOWN' } } },
    inputs: { inputs: { savings: [], decision: { assumptions: ['legacy'] } } }, evidence: { completeMonthsBySource: { MOBILITY: ['2026-09'] }, diagnostics: unknown ? ['UNKNOWN_AMOUNT'] : [] },
    planned: [{ id: 'external-intent', amount: unknown ? null : '20.00' }], products: [product],
    legs: [{ date: '2026-09-15', legId: 'leg-a' }], mobility: { contextLinks: [{ mobilityLegId: 'leg-a' }], presenceResolutions: [{ mobilityLegId: 'leg-a' }] },
    purchase: { status: 'PASS', facts: [{ fact: 'fct_purchase_aware_economic_component', knowledge: unknown ? 'UNKNOWN' : 'KNOWN', amount: unknown ? null : '12.00', sourceRefs: ['operation:synthetic'] }] },
    activities: [],
  };
  const client = { from(table) {
    const read = { table };
    const q = {};
    for (const method of ['select', 'eq', 'lte', 'order', 'range', 'in']) q[method] = (...args) => { read[method] = args; return q; };
    q.then = (resolve, reject) => {
      reads.push(read);
      assert.ok(['needs', 'person_habit_assertions'].includes(table));
      return Promise.resolve({ data: table === 'needs' ? [{ need_id: 'need-a', need_key: 'synthetic-need', person_id: personId }] : [], error: null }).then(resolve, reject);
    };
    return q;
  } };
  const repository = { client, context: { householdId, timezone: 'Europe/Paris', personIds: [personId], persons: [],
    periods: missingPeriods ? [] : [{ month: '2026-09', isClosed: true, sourceRevision: 3, locationStatus: 'complete' }] },
    loadActivityOccurrences: owner('activities'), loadActivityCausalFinancialLinkRows: async ids => { reads.push({ table: 'activity_links', ids }); return []; },
    loadMobilityLegFacts: owner('legs'), loadPurchaseAwareCanonical: owner('purchase') };
  const json = { plannerMonth: value => { if (!/^\d{4}-\d{2}$/.test(value)) throw new TypeError('BAD_MONTH'); return value; },
    plannerUuid: String, plannerString: String, parsePlannerJsonObject: value => value };
  const baseline = load('src/server/phase2/planner/baseline-adapters.ts', {
    'server-only': {}, '@js-temporal/polyfill': { Temporal }, '@/core/time': { parseLocalDate: String },
    '@/domain/phase2/planner/json': json,
    '@/analytics/global-v2/personal-mobility': { buildGlobalM7PersonalMobilityAuthority: input => input },
    '@/server/analytics/global-v2-mobility-context-authority': { resolveGlobalM7MobilityContextAuthority: owner('mobility') },
    '@/server/analytics/global-v2-persona-signals': { resolveGlobalPersonaProductObservations: owner('products') },
    '@/server/analytics/global-v2-need-subject-authority': { resolveGlobalM2NeedSubjects: () => ({ 'need-a': { scope: conflict ? 'CONFLICT' : 'PERSONAL', personId } }) },
    '../live-month-forecast': { loadMonthForecastAuthorities: owner('authorities') },
    '../month-forecast': { assembleMonthForecast: () => { throw new Error('Published forecast must be admitted'); } },
    '../month-prediction-evidence': { readMonthPredictionEvidence: owner('evidence') },
    '../month-inputs': { readMonthInputs: owner('inputs') }, '../planned-expenses': { readPlannedExpenses: owner('planned') },
    './baseline': { buildPlanningBaseline: value => value }, '@/analytics/facts': { parseActivityCausalFinancialLinks: value => value },
    './renewal-engine': { RENEWAL_NEED_KEYS: ['synthetic-auto'] },
  });
  const world = load('src/server/phase2/planner/world-reader.ts', {
    'server-only': {}, '@js-temporal/polyfill': { Temporal }, '../month-planning-read': { readPlanningMonthForecast: owner('forecast') },
    '../month-inputs': { readMonthInputs: owner('inputs') }, '../planned-expenses': { readPlannedExpenses: owner('planned') },
    './renewal-baseline': { buildRenewalPlanningBaseline: value => value }, './baseline-adapters': baseline,
    './repository': { createPlanApplyRepository: () => ({}) }, './mobility-adapter': { buildProspectiveMobilityFacts: sources => sources.personalMobility },
    './prospective-mobility-pricing': {}, '../planned-context': {}, './context-compiler': {}, './plan-slot-resolver': {}, './journey-resolver': {},
  });
  const dependencies = world.createPlannerDependencies(repository, client, () => cutoff);
  return { gates, calls, reads, values, dependencies, baseline, repository };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = (f, key, failures) => failures?.[key] ? f.gates[key].reject(failures[key]) : f.gates[key].resolve(f.values[key]);
let passed = 0;
try {
  let expected;
  for (const unknown of [false, true]) for (const order of [keys, [...keys].reverse()]) {
    const f = fixture({ unknown }), pending = f.dependencies.readWorld(householdId, '2026-10');
    const early = f.calls.map(c => c.key);
    for (const key of order) { settle(f, key); await tick(); }
    const output = await pending;
    assert.ok(early.includes('purchase') && early.includes('products'), 'Independent sources must start before Forecast is ready');
    assert.strictEqual(output.forecast.predictionEvidence, f.values.evidence);
    assert.strictEqual(output.baseline.forecast, f.values.forecast);
    assert.deepEqual(output.baseline.purchaseFacts, f.values.purchase.facts);
    assert.deepEqual(output.baseline.productObservations, f.values.products);
    assert.deepEqual(output.externalIntents, f.values.planned);
    assert.equal(output.asOfDate, '2026-10-06');
    const input = f.calls.find(c => c.key === 'purchase');
    assert.deepEqual(input.args, [{ start: '2026-09-01', endExclusive: '2026-10-01' }, 'PURCHASE_AWARE_PILOT']);
    const subjects = f.reads.find(r => r.table === 'needs');
    assert.deepEqual(subjects.select, ['need_id,need_key,person_id']);
    assert.deepEqual(subjects.in, ['need_key', ['synthetic-auto', 'synthetic-need']]);
    const serialized = JSON.stringify(output);
    if (order === keys) expected = serialized; else assert.equal(serialized, expected, 'Completion order must not change the whole world');
    if (unknown) assert.equal(output.baseline.purchaseFacts[0].amount, null);
    passed++;
  }
  for (const failures of [
    { forecast: new Error('FORECAST_FAILED') }, { purchase: new Error('PURCHASE_FAILED') },
    { products: new Error('PRODUCTS_FAILED') },
    { forecast: new Error('FORECAST_FIRST'), purchase: new Error('PURCHASE_SECOND') },
  ]) for (const order of [keys, [...keys].reverse()]) {
    const f = fixture(), pending = f.dependencies.readWorld(householdId, '2026-10');
    const captured = pending.then(() => null, error => error);
    for (const key of order) { settle(f, key, failures); await tick(); }
    assert.strictEqual(await captured, failures.forecast ?? failures.purchase ?? failures.products, 'Original Forecast-first failure boundary must remain');
    passed++;
  }
  for (const opts of [{ missingPeriods: true }, { conflict: true }]) {
    const f = fixture(opts), captured = f.dependencies.readWorld(householdId, '2026-10').then(() => null, error => error);
    for (const key of keys) settle(f, key);
    assert.equal((await captured).message, opts.missingPeriods ? 'BASELINE_CANONICAL_PERIODS_UNAVAILABLE' : 'BASELINE_NEED_SUBJECT_CONFLICT');
    passed++;
  }
  const f = fixture();
  f.values.forecast.meta.sourceRevision = 999;
  const changed = f.dependencies.readWorld(householdId, '2026-10').then(() => null, error => error);
  for (const key of [...keys].reverse()) settle(f, key);
  assert.equal((await changed).message, 'PLANNER_WORLD_AUTHORITIES_CHANGED_DURING_READ');
  passed++;
  await tick();
  assert.deepEqual(unhandled, [], 'No abandoned rejected Promise');
  console.log(`COMPOSER_ORCHESTRATION PASS (${passed} cases, order, failures, missing input, UNKNOWN, publication, scopes)`);
} finally { process.off('unhandledRejection', onUnhandled); }
