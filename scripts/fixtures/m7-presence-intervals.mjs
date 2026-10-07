// All identities and temporal facts in this fixture are synthetic.
export const householdId = '00000000-0000-4000-8000-000000000001';
export const personA = 'person-a', personB = 'person-b';
export const visit = (id, startAt, endAt, overrides = {}) => ({ householdId, personId: personB, visitKey: id,
  placeId: 'context-place', personDayId: `day:${id}`, localDate: '2000-01-01', timePrecision: 'exact',
  interval: { kind: 'known', startedAt: startAt, endedAt: endAt }, ...overrides });
export function presenceFixture(startAt, endAt, visits, overrides = {}) {
  const date = startAt.slice(0, 10);
  return { householdId, householdTimeZone: 'UTC', householdPersonIds: [personA, personB], personDays: [], placeVisits: visits,
    mobilityLegs: [{ householdId, legId: 'leg-a', date, origin: { placeId: 'home' }, destination: { placeId: 'context-place' },
      time: { authority: 'OBSERVED', type: 'ARRIVAL', observedTime: startAt.slice(0, 19) },
      distanceKm: '1', estimatedFuelLiters: '1', estimatedFuelCost: '1', evidenceRefs: ['leg-source'] }],
    lifeEventContexts: [{ lifeEventId: 'event-a', typeKey: 'visite_famille', startDate: date, endDate: endAt.slice(0, 10),
      validationStatus: 'CONFIRMED', placeIds: ['context-place'], evidenceRefs: ['event-source'],
      participations: [{ personId: personA, status: 'CONFIRMED', startAt, endAt, timePrecision: 'EXACT', evidenceRef: 'participation-source' }] }],
    ...overrides };
}
export function intervalCases() {
  const s = '2026-06-10T10:00:00Z', e = '2026-06-10T12:00:00Z';
  const pairs = {
    'no-overlap': ['2026-06-11T10:00:00Z', '2026-06-11T12:00:00Z'],
    'complete-overlap': ['2026-06-10T09:00:00Z', '2026-06-10T13:00:00Z'],
    'partial-left': ['2026-06-10T09:00:00Z', '2026-06-10T11:00:00Z'],
    'partial-right': ['2026-06-10T11:00:00Z', '2026-06-10T13:00:00Z'],
    identical: [s, e], 'same-start': [s, '2026-06-10T11:00:00Z'], 'same-end': ['2026-06-10T11:00:00Z', e],
    adjacent: [e, '2026-06-10T13:00:00Z'], contained: ['2026-06-10T10:30:00Z', '2026-06-10T11:30:00Z'],
    'zero-duration': ['2026-06-10T11:00:00Z', '2026-06-10T11:00:00Z'],
    inverted: ['2026-06-10T11:30:00Z', '2026-06-10T10:30:00Z'],
    'invalid-start': ['invalid-start', e], 'invalid-end': [s, 'invalid-end'],
    'invalid-short-circuit': ['invalid-start', '2026-06-09T12:00:00Z'],
    'missing-end-known': [s, null], 'equivalent-offsets': ['2026-06-10T12:00:00+02:00', '2026-06-10T14:00:00+02:00'],
    'nanoseconds': ['2026-06-10T11:59:59.999999999Z', '2026-06-10T12:00:00.000000001Z'],
  };
  const cases = Object.fromEntries(Object.entries(pairs).map(([name, [a, b]]) => [name, presenceFixture(s, e, [visit(name, a, b)])]));
  for (const [name, a, b, c, d] of [
    ['midnight', '2026-06-10T23:30:00Z', '2026-06-11T01:30:00Z', '2026-06-11T00:30:00Z', '2026-06-11T02:00:00Z'],
    ['month-boundary', '2026-06-30T23:30:00Z', '2026-07-01T01:30:00Z', '2026-07-01T00:30:00Z', '2026-07-01T02:00:00Z'],
    ['year-boundary', '2026-12-31T23:30:00Z', '2027-01-01T01:30:00Z', '2027-01-01T00:30:00Z', '2027-01-01T02:00:00Z'],
    ['dst-23h', '2026-03-28T23:00:00Z', '2026-03-29T22:00:00Z', '2026-03-29T01:30:00Z', '2026-03-29T02:30:00Z'],
    ['dst-25h', '2026-10-24T22:00:00Z', '2026-10-25T23:00:00Z', '2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z'],
    ['multi-day', '2026-06-10T10:00:00Z', '2026-06-15T12:00:00Z', '2026-06-13T10:00:00Z', '2026-06-16T12:00:00Z'],
  ]) cases[name] = presenceFixture(a, b, [visit(name, c, d)]);
  cases['same-person-many'] = presenceFixture(s, e, Array.from({ length: 30 }, (_, i) => visit(`visit-${i}`, s, e)));
  cases['same-time-distinct-visits'] = presenceFixture(s, e, [visit('visit-a', s, e), visit('visit-b', s, e)]);
  cases['same-place-distinct-visits'] = presenceFixture(s, e, [visit('visit-a', s, e), visit('visit-b', '2026-06-10T10:30:00Z', e)]);
  cases['different-people'] = presenceFixture(s, e, [visit('a', s, e, { personId: personA }), visit('b', s, e), visit('c', s, e, { personId: 'person-c' })], { householdPersonIds: [personA, personB, 'person-c'] });
  cases.unresolved = presenceFixture(s, e, [visit('unknown', null, null, { interval: { kind: 'unknown' }, timePrecision: 'unknown' })]);
  cases['partial-end-missing'] = presenceFixture(s, e, [visit('partial', s, null, { interval: { kind: 'partial', startedAt: s, endedAt: null }, timePrecision: 'approximate' })]);
  cases['conflicting-places'] = presenceFixture(s, e, [visit('here', s, e), visit('elsewhere', s, e, { placeId: 'elsewhere' })]);
  cases['invalid-unused-person'] = presenceFixture(s, e, [visit('invalid-unused', 'bad', 'bad', { personId: personA })]);
  cases['invalid-context-proxy'] = presenceFixture('invalid', e, [visit('valid', s, e)]);
  return cases;
}
