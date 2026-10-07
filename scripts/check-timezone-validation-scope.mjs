import assert from 'node:assert/strict';
import { require } from './lib/phase2-ts-loader.mjs';
const time = require('@/core/time');
const { parsePersonDayFact, dedupePersonDays } = require('@/analytics/facts');
const { CanonicalRepository } = require('@/server/canonical/repository');
const hh = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const personId = '33333333-3333-4333-8333-333333333333';
const rawDay = { fact: 'fct_person_day', householdId: hh, householdTimeZone: 'Europe/Paris',
  personDayId: '44444444-4444-4444-8444-444444444444', personId, localDate: '2026-03-29', locationObservability: 'unknown' };
const outcome = fn => { try { return { value: fn() }; } catch (error) { return { name: error.name, message: error.message }; } };
const invalids = [null, 12, '', ' Europe/Paris', 'Europe/Paris ', '+01:00', 'Invalid/Zone'];
const expectedErrors = invalids.map(value => outcome(() => time.parseHouseholdTimeZone(value)));
const Native = Intl.DateTimeFormat;
let validations = 0;
function Counted(...args) { if (args[1]?.timeZone !== undefined) validations++; return new Native(...args); }
Counted.prototype = Native.prototype; Object.setPrototypeOf(Counted, Native);
Intl.DateTimeFormat = Counted;
try {
  const scope = time.createHouseholdTimeZoneValidationScope(hh);
  assert.ok(Object.isFrozen(scope));
  for (let n = 0; n < 500; n++) assert.equal(scope.parse('Europe/Paris', hh), 'Europe/Paris');
  assert.equal(validations, 1);
  scope.parse('UTC', hh); scope.parse('UTC', hh); assert.equal(validations, 2);
  scope.parse('Europe/Paris', other); scope.parse('Europe/Paris', other);
  assert.equal(validations, 4, 'A mismatched household never reuses this scope');
  const otherScope = time.createHouseholdTimeZoneValidationScope(other);
  otherScope.parse('Europe/Paris', other); otherScope.parse('Europe/Paris', other);
  assert.equal(validations, 5);
  const nextBuild = time.createHouseholdTimeZoneValidationScope(hh);
  nextBuild.parse('Europe/Paris', hh); assert.equal(validations, 6, 'No cross-build cache');
  assert.deepEqual(invalids.map(value => outcome(() => scope.parse(value, hh))), expectedErrors);
  const beforeInvalid = validations;
  for (let n = 0; n < 2; n++) assert.throws(() => scope.parse('Invalid/Zone', hh), TypeError);
  assert.equal(validations - beforeInvalid, 2, 'Validation errors are not cached');
  const beforeFacts = validations;
  for (let n = 0; n < 100; n++) {
    const fact = parsePersonDayFact(rawDay, scope);
    assert.deepEqual(fact, rawDay); assert.deepEqual(dedupePersonDays([fact, fact], scope), [fact]);
  }
  assert.equal(validations, beforeFacts, 'Projection/parse/dedupe reuse the validated scalar only');
  assert.throws(() => parsePersonDayFact({ ...rawDay, householdTimeZone: 'Invalid/Zone' }, scope), TypeError);
  const beforeUsers = validations;
  const a = new CanonicalRepository({}, { householdId: hh, timezone: 'Europe/Paris', userId: 'user-a' });
  const b = new CanonicalRepository({}, { householdId: hh, timezone: 'Europe/Paris', userId: 'user-b' });
  assert.notEqual(a.household.timeZoneValidation, b.household.timeZoneValidation);
  for (const repo of [a, b]) for (let n = 0; n < 10; n++) parsePersonDayFact(rawDay, repo.household.timeZoneValidation);
  assert.equal(validations - beforeUsers, 2, 'Each authorized user/request repository validates independently');
} finally { Intl.DateTimeFormat = Native; }
const scope = time.createHouseholdTimeZoneValidationScope(hh), paris = scope.parse('Europe/Paris', hh), ny = scope.parse('America/New_York', hh);
for (const [date, hours] of [['2026-03-29', 23], ['2026-10-25', 25]]) {
  const day = time.parseLocalDate(date), start = time.startOfLocalDate(day, paris), end = time.endExclusiveOfLocalDate(day, paris);
  assert.equal((Date.parse(end) - Date.parse(start)) / 3600000, hours);
  assert.equal(start, time.startOfLocalDate(day, time.parseHouseholdTimeZone('Europe/Paris')));
}
const boundary = time.parseInstant('2026-06-30T22:30:00Z');
assert.equal(time.instantToLocalDate(boundary, paris), '2026-07-01');
assert.equal(time.instantToLocalDate(boundary, ny), '2026-06-30');
console.log(JSON.stringify({ timezoneScope: 'PASS', invalid: 'PASS', householdUserBuildIsolation: 'PASS', dstAndMonthBoundary: 'PASS', remoteWrites: 0 }));
