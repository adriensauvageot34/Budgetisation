import assert from 'node:assert/strict';
import fs from 'node:fs';
import { require } from './lib/phase2-ts-loader.mjs';
// Spy on the same CommonJS polyfill instance used by the TS fixture loader.
const { Temporal } = require('@js-temporal/polyfill');
const { buildGlobalM7MobilityContextAuthority: build } = require('@/analytics/global-v2/mobility-context');
const householdId = '00000000-0000-4000-8000-000000000001', a = 'person-a', b = 'person-b';
const leg = (id, overrides = {}) => ({ householdId, legId: id, date: '2026-06-10', origin: { placeId: 'home' }, destination: { placeId: 'visit' },
  time: { observedTime: '2026-06-10T10:00:00', authority: 'OBSERVED', type: 'ARRIVAL' },
  distanceKm: '10', estimatedFuelLiters: '1', estimatedFuelCost: '2', evidenceRefs: [`leg:${id}`], ...overrides });
const participation = (personId, startAt = '2026-06-10T08:00:00Z', endAt = '2026-06-10T10:00:00Z') =>
  ({ personId, startAt, endAt, status: 'CONFIRMED', timePrecision: 'EXACT', evidenceRef: `person:${personId}` });
const event = (id, typeKey = 'visite_famille', participations = [participation(a)], overrides = {}) =>
  ({ lifeEventId: id, typeKey, startDate: '2026-06-10', endDate: '2026-06-10', placeIds: ['visit'],
    participations, validationStatus: 'CONFIRMED', evidenceRefs: [`event:${id}`], ...overrides });
const visit = (key, startAt, endAt, placeId = 'visit') => ({ householdId, visitKey: key, personId: b, placeId, personDayId: 'day-b',
  localDate: '2026-06-10', timePrecision: 'exact', interval: { kind: 'known', startedAt: startAt, endedAt: endAt } });
const input = overrides => ({ householdId, householdTimeZone: 'Europe/Paris', householdPersonIds: [a, b], mobilityLegs: [leg('leg-a')],
  lifeEventContexts: [event('family')], placeVisits: [], personDays: [], ...overrides });
const repeated = input({ mobilityLegs: Array.from({ length: 8 }, (_, n) => leg(`leg-${n}`)),
  lifeEventContexts: ['visite_famille', 'visite_ami', 'activite_loisir', 'shopping_commerce', 'travail_site'].map((type, n) => event(`event-${n}`, type)),
  placeVisits: Array.from({ length: 12 }, (_, n) => visit(`visit-${n}`, '2026-06-10T08:00:00Z', '2026-06-10T10:00:00Z')) });
const cases = {
  repeated,
  adjacent: input({ placeVisits: [visit('adjacent', '2026-06-10T10:00:00Z', '2026-06-10T11:00:00Z')] }),
  overlap: input({ placeVisits: [visit('overlap', '2026-06-10T09:59:59Z', '2026-06-10T11:00:00Z')] }),
  equivalentOffsets: input({ placeVisits: [visit('offset', '2026-06-10T10:00:00+02:00', '2026-06-10T12:00:00+02:00')] }),
  unknown: input({ lifeEventContexts: [event('unknown', 'visite_ami', [{ ...participation(a), startAt: null, endAt: null, timePrecision: 'UNKNOWN' }])] }),
  invalidStart: input({ lifeEventContexts: [event('invalid', 'visite_ami', [participation(a, 'invalid')])] }),
  invalidEnd: input({ lifeEventContexts: [event('invalid', 'visite_ami', [participation(a, undefined, 'invalid')])] }),
  inverted: input({ lifeEventContexts: [event('inverted', 'visite_ami', [participation(a, '2026-06-10T11:00:00Z', '2026-06-10T10:00:00Z')])] }),
  invalidZone: input({ householdTimeZone: 'Invalid/Zone' }),
  newYork: input({ householdTimeZone: 'America/New_York' }),
  midnight: input({ mobilityLegs: [leg('return', { date: '2026-06-11', origin: { placeId: 'visit' }, destination: { placeId: 'home' },
    time: { observedTime: '2026-06-11T00:30:00', authority: 'OBSERVED', type: 'DEPARTURE' } })],
    lifeEventContexts: [event('night', 'activite_loisir', [participation(a, '2026-06-10T21:00:00Z', '2026-06-10T22:15:00Z')], { endDate: '2026-06-11' })] }),
};
for (const [name, date, startAt, endAt] of [
  ['dstFall', '2026-10-25', '2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z'],
  ['dstSpring', '2026-03-29', '2026-03-29T01:30:00Z', '2026-03-29T02:30:00Z'],
]) cases[name] = input({ mobilityLegs: [leg(name, { date, time: { observedTime: `${date}T02:30:00`, authority: 'OBSERVED', type: 'UNTYPED' } })],
  lifeEventContexts: [event(name, 'activite_loisir', [participation(a, startAt, endAt)], { startDate: date, endDate: date })] });
const outcome = value => { try { return { authority: build(value) }; } catch (error) { return { error: { name: error.name, message: error.message } }; } };
const results = Object.fromEntries(Object.entries(cases).map(([key, value]) => [key, outcome(value)]));
const fingerprints = Object.fromEntries(Object.entries(results).map(([key, result]) => [key, result.authority
  ? { inputHash: result.authority.inputHash, outputHash: result.authority.outputHash, physicalTotals: result.authority.physicalTotals }
  : result]));
const record = process.argv.indexOf('--record');
if (record >= 0) fs.writeFileSync(process.argv[record + 1], JSON.stringify(fingerprints, null, 2) + '\n');
else {
  assert.deepEqual(fingerprints, JSON.parse(fs.readFileSync(new URL('./fixtures/mobility-performance-parity.json', import.meta.url), 'utf8')));
  const original = Temporal.Instant.from, counts = new Map();
  Temporal.Instant.from = function(value, ...options) { counts.set(value, (counts.get(value) ?? 0) + 1); return original.call(this, value, ...options); };
  try {
    build(repeated);
    assert.equal(counts.size, 2, 'Only the two literal bounds are parsed by this repeated fixture');
    assert.ok([...counts.values()].every(count => count === 1), 'Each timestamp parsed once per M7 build');
    counts.clear(); build(repeated);
    assert.ok([...counts.values()].every(count => count === 1), 'Next build must parse again');
    counts.clear();
    for (let attempt = 0; attempt < 2; attempt++) assert.throws(() => build(cases.invalidStart), RangeError);
    assert.equal(counts.get('invalid'), 2, 'Errors are never memoized');
    const otherHousehold = { ...repeated, householdId: 'other-household',
      mobilityLegs: repeated.mobilityLegs.map(value => ({ ...value, householdId: 'other-household' })),
      placeVisits: repeated.placeVisits.map(value => ({ ...value, householdId: 'other-household' })) };
    counts.clear(); build(otherHousehold);
    assert.ok([...counts.values()].every(count => count === 1), 'Households never share memo instances');
    assert.equal(results.adjacent.authority.presenceResolutions[0].state, 'UNKNOWN');
    assert.equal(results.overlap.authority.presenceResolutions[0].state, 'CO_PRESENT_CONFIRMED');
    assert.equal(results.midnight.authority.contextLinks[0].linkState, 'LINKED');
    assert.notEqual(results.repeated.authority.outputHash, results.newYork.authority.outputHash);
    assert.equal(results.dstFall.authority.contextLinks[0].linkState, 'LINKED');
    assert.equal(results.dstSpring.authority.contextLinks[0].linkState, 'LINKED');
  } finally { Temporal.Instant.from = original; }
}
console.log(JSON.stringify({ cases: Object.keys(cases).length, parity: record >= 0 ? 'RECORDED' : 'PASS', memoScope: record >= 0 ? 'BASELINE' : 'PASS' }));
