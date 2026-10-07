import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { loadPresenceAudit } from './lib/m7-presence-audit.mjs';
import { intervalCases, presenceFixture, visit } from './fixtures/m7-presence-intervals.mjs';
const before = loadPresenceAudit(true), after = loadPresenceAudit();
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pairs = result => result.pairs.map(JSON.stringify).sort();
const cases = intervalCases();
// Deterministic random intervals include zero/inverted intervals. No day buckets.
let seed = 0x73c254ab;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
const stamp = n => new Date(Date.UTC(2026, 0, 1) + n * 60000).toISOString();
for (let i = 0; i < 100; i++) {
  const start = random() % 5000, end = start + random() % 300;
  const visits = Array.from({ length: 40 }, (_, j) => {
    const a = random() % 10000, b = a + (random() % 1000) - 100;
    return visit(`seed-${i}-${j}`, stamp(a), stamp(b), { placeId: j % 3 ? 'context-place' : 'elsewhere' });
  });
  cases[`seeded-${i}`] = presenceFixture(stamp(start), stamp(end), visits);
}
let positive = 0;
for (const [name, input] of Object.entries(cases)) {
  const original = structuredClone(input), a = before(input), b = after(input);
  assert.deepEqual(b.authority ?? b.error, a.authority ?? a.error, `${name}: complete authority/error parity`);
  assert.deepEqual(pairs(b), pairs(a), `${name}: exact matched pair identities`);
  assert.deepEqual(input, original, `${name}: immutable facts`);
  positive += b.pairs.length;
}
assert.equal(after(cases.adjacent).pairs.length, 0);
assert.equal(after(cases['same-time-distinct-visits']).pairs.length, 2);
assert.equal(after(cases['conflicting-places']).authority.presenceResolutions[0].state, 'UNKNOWN');
assert.equal(after(cases['invalid-short-circuit']).error, undefined);
assert.equal(after(cases['invalid-start']).error?.name, 'RangeError');
const privateFile = process.argv[2];
let real;
if (privateFile) {
  const input = JSON.parse(fs.readFileSync(privateFile, 'utf8')), a = before(input), b = after(input);
  assert.ok(a.authority && b.authority, 'Captured real M7 build succeeds');
  assert.deepEqual(b.authority, a.authority, 'Complete captured real authority');
  assert.deepEqual(pairs(b), pairs(a), 'Captured real exact matched pairs');
  real = { before: { counts: a.counts, pairsHash: hash(pairs(a)), authorityHash: hash(a.authority), outputHash: a.authority.outputHash },
    after: { counts: b.counts, pairsHash: hash(pairs(b)), authorityHash: hash(b.authority), outputHash: b.authority.outputHash } };
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(real, null, 2) + '\n');
}
console.log(JSON.stringify({ cases: Object.keys(cases).length, positivePairs: positive, exactPairParity: 'PASS', completeAuthorityParity: 'PASS', real }));
