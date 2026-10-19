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
  if (['DONE', 'ALREADY_VERIFIED', 'NO_CHANGE_REQUIRED_VERIFIED', 'IMPLEMENTED_VERIFIED', 'FIXED_BROWSER', 'FIXED_LOCAL_ONLY'].includes(item.status)) {
    assert.ok(item.evidence.length && item.product_sha && item.niveau_preuve !== 'NONE', `Unproven ${item.id}`);
  }
}
if (registry.closure27) {
  const targeted=items.filter(item=>item.closure27);
  assert.equal(targeted.length,27);
  assert.deepEqual(targeted.map(item=>item.id),[7,35,45,46,78,93,95,96,97,100,101,119,124,129,130,133,141,142,148,156,160,166,186,187,198,203,204].map(number=>`UI-${String(number).padStart(3,'0')}`));
  const counts={};for(const item of targeted){assert.equal(item.class,'A');counts[item.status]=(counts[item.status]??0)+1;}
  assert.deepEqual(counts,registry.closure27.counts);
  assert.equal(registry.closure27.previous_A,78);
  assert.equal(items.filter(item=>item.class==='B'&&item.reviewed).length,62);
}
console.log('PASS R5 registry: 222 unique, A105/B62/C55, 76 decisions, no completion without evidence');
