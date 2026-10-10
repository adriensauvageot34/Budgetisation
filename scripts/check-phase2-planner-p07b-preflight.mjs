import assert from 'node:assert/strict';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';

const { parsePlanSemanticState, semanticStateDigest } = require('@/domain/phase2/planner/semantic-state');
const id = suffix => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
const month = '2026-11';
const context = (suffix, fields, slotSelections = {}) => ({
  contextOccurrenceId: id(suffix), templateKey: 'gift', status: 'ACTIVE',
  parentContextOccurrenceId: null, fields, slotSelections,
  provenance: 'EXPLICIT_USER_DECISION',
});
const base = { version: 'month-plan-state@v1', targetMonth: month,
  controls: [], contexts: [], preferences: { anchors: [], flexibility: {} } };
const cases = [
  ['EMPTY_DRAFT', base],
  ['NO_DATE_UNEQUIPPED', { ...base, contexts: [context(1, { plannedDate: null })] }],
  ['UNKNOWN_PRICE', { ...base, contexts: [context(2, { plannedDate: null, objectLabel: 'Livre' }, {
    item: { items: [{ selectionId: 'gift-item', optionKey: 'book', kind: 'COMPONENT',
      provenance: 'EXPLICIT_USER_DECISION', cost: { kind: 'UNKNOWN' } }] },
  })] }],
  ['NO_DATE_FIELD', { ...base, contexts: [context(3, {})] }],
];

// The semantic Draft boundary is structural. Financial readiness must not be a save prerequisite.
for (const [name, input] of cases) {
  const parsed = parsePlanSemanticState(input);
  assert.equal(parsed.contexts.length, input.contexts.length);
  assert.match(semanticStateDigest(parsed), /^[a-f0-9]{64}$/u);
  console.log(`${name}_TS PASS`);
}

for (const [name, count, expectedFits] of [
  ['LARGE_FITS', 400, true], ['LARGE_EXCEEDS', 500, false],
]) {
  const parsed = parsePlanSemanticState({ ...base, contexts: Array.from({ length: count }, (_, index) =>
    context(index + 100, { note: 'x'.repeat(2200), plannedDate: null })) });
  const bytes = Buffer.byteLength(JSON.stringify(parsed), 'utf8');
  assert.equal(bytes <= 1048576, expectedFits);
  console.log(`${name}_TS ${bytes} bytes PASS`);
}

// PGlite here checks only the existing SQL shape validator. It does not certify Supabase RLS.
const pg = await createKernelPostgres();
try {
  await pg.db.exec('reset role');
  for (const [name, input] of cases) {
    const parsed = parsePlanSemanticState(input);
    const { rows } = await pg.db.query(
      'select private.phase2_month_plan_state_valid_v1($1::jsonb,$2::date) as valid',
      [JSON.stringify(parsed), `${month}-01`],
    );
    assert.equal(rows[0].valid, true, `${name} must be saveable while incomplete`);
    console.log(`${name}_SQL_PGLITE PASS`);
  }
  const invalid = { ...base, contexts: [{ ...context(4, {}), slotSelections: undefined }] };
  assert.throws(() => parsePlanSemanticState(invalid));
  const { rows } = await pg.db.query(
    'select private.phase2_month_plan_state_valid_v1($1::jsonb,$2::date) as valid',
    [JSON.stringify(invalid), `${month}-01`],
  );
  assert.equal(rows[0].valid, false);
  console.log('MISSING_REQUIRED_STRUCTURE_REJECTED PASS');
} finally {
  await pg.close();
}
