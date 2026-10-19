import assert from 'node:assert/strict';
import fs from 'node:fs';
const path = 'docs/status/subassets-r5/requirements.json';
const registry = JSON.parse(fs.readFileSync(path, 'utf8'));
const items = registry.requirements;
assert.equal(items.length, 222);
assert.equal(new Set(items.map(item => item.id)).size, 222);
for (const [group, count] of Object.entries({ A: 105, B: 62, C: 55 })) {
  assert.equal(items.filter(item => item.class === group).length, count, group);
}
assert.equal(registry.decisions.length, 76);
for (let number = 1; number <= 222; number++) {
  const item = items.find(item => item.id === `UI-${String(number).padStart(3, '0')}`);
  assert.ok(item?.source && item.normative_status && item.owner, `Incomplete ${number}`);
  assert.ok(item.precision !== undefined && item.r5_decision_references !== undefined);
  if (item.class === 'C') assert.equal(item.status, 'OUT_OF_SCOPE_NEXT_STAGE');
  if (['DONE', 'ALREADY_VERIFIED', 'NO_CHANGE_REQUIRED_VERIFIED', 'IMPLEMENTED_VERIFIED'].includes(item.status)) {
    assert.ok(item.evidence.length && item.product_sha && item.niveau_preuve !== 'NONE', `Unproven ${item.id}`);
  }
}
console.log('PASS R5 registry: 222 unique, A105/B62/C55, 76 decisions, no completion without evidence');
