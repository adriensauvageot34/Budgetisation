// Synthetic transport and consumer contract. No database or network access.
import assert from 'node:assert/strict';
import { require } from './lib/phase2-ts-loader.mjs';
const { CanonicalRepository, sourceAwareEconomicDimensions } = require('@/server/canonical/repository');
const { operationFromCanonicalRow } = require('@/server/query/sources/shared');
const { buildOperationRow } = require('@/server/query/sources/operations');
const { resolveGlobalM2NeedAuthorities } = require('@/server/analytics/global-v2-category-needs-authority');
const householdId = '00000000-0000-4000-8000-000000000001';
const ids = Array.from({ length: 241 }, (_, n) => `00000000-0000-4000-8000-${String(n + 10).padStart(12, '0')}`);
const required = [
  'operation_id', 'date_bancaire', 'mois_analytique_force', 'date_transaction_reelle',
  'date_transaction_precision', 'merchant_id', 'importance', 'nature_fixe_variable',
  'contexte_vie', 'montant', 'montant_bancaire_exact', 'libelle_bancaire', 'category_id',
  'subcategory_id', 'type_precis', 'operation_mixte', 'mode_prevision',
  'recurrence_series_id', 'need_id', 'annual_event_id', 'provision_pool_id',
  'marchand', 'description_precise',
];
const full = ids.map(operation_id => ({
  operation_id, date_bancaire: '2026-01-15', mois_analytique_force: '2025-12',
  date_transaction_reelle: '2026-01-13', date_transaction_precision: 'Exacte',
  merchant_id: null, importance: 'Essentiel', nature_fixe_variable: 'Variable',
  contexte_vie: 'Vie courante', montant: 1, montant_bancaire_exact: '9007199254740993.01',
  libelle_bancaire: 'Synthetic operation', category_id: null, subcategory_id: null,
  type_precis: 'Synthetic type', operation_mixte: true, mode_prevision: 'Cadence de rachat',
  recurrence_series_id: 'recurrence-a', need_id: 'need-a', annual_event_id: 'annual-a',
  provision_pool_id: 'pool-a', marchand: 'Synthetic merchant', description_precise: 'Synthetic detail',
  note: 'unused'.repeat(1000), source_enrichissement: 'unused', financial_match_note: 'unused',
}));
function fixture() {
  const calls = [];
  const client = { from(table) {
    const call = { table, ids: [], order: [] };
    const query = {
      select(value) { call.select = value; return query; },
      limit(value) { call.limit = value; return query; },
      in(column, values) { call.column = column; call.ids = [...values]; return query; },
      order(column, options) { call.order.push([column, options]); return query; },
      then(resolve, reject) {
        calls.push(call);
        if (table === 'canonical_household_scope_control') return Promise.resolve({
          data: [{ household_count: 1, household_id: householdId, status: 'READY' }], error: null,
        }).then(resolve, reject);
        assert.equal(table, 'operations');
        const selected = call.select.split(',');
        const data = full.filter(row => call.ids.includes(row.operation_id)).map(row => selected.includes('*')
          ? { ...row }
          : Object.fromEntries(selected.map(field => {
            const name = field.split(':')[0];
            assert.ok(Object.hasOwn(row, name), `Synthetic fixture missing selected column ${name}`);
            return [name, row[name]];
          })));
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  } };
  return { calls, repository: new CanonicalRepository(client, { householdId, timezone: 'Europe/Paris', persons: [], personIds: [] }) };
}
for (const [size, expected] of [[120, [120, 120, 1]], [100, [100, 100, 41]]]) {
  const { repository, calls } = fixture();
  const rows = await repository.loadOperationsByIds([...ids].reverse().concat(ids[0]), size);
  const reads = calls.filter(c => c.table === 'operations');
  assert.deepEqual(reads.map(c => c.ids.length), expected);
  assert.deepEqual(reads.flatMap(c => c.ids), ids);
  assert.deepEqual(rows.map(r => r.operation_id), ids);
  assert.equal(rows.length, full.length);
  for (const read of reads) {
    assert.equal(read.column, 'operation_id');
    assert.deepEqual(read.order, [['operation_id', { ascending: true }]]);
    assert.ok(!read.select.includes('*'), 'Historical Operations must use its audited fieldset');
    assert.ok(read.select.includes('montant_bancaire_exact:montant::text'));
    assert.deepEqual(read.select.split(',').map(f => f.split(':')[0]).sort(), [...required].sort());
  }
  assert.equal(rows[0].montant_bancaire_exact, full[0].montant_bancaire_exact);
  assert.equal(operationFromCanonicalRow(rows[0]).bankAmount, '9007199254740993.01');
  for (let n = 0; n < rows.length; n++) {
    assert.deepEqual(buildOperationRow(operationFromCanonicalRow(rows[n]), []), buildOperationRow(operationFromCanonicalRow(full[n]), []));
    assert.deepEqual(sourceAwareEconomicDimensions(rows[n], { importance: null }), sourceAwareEconomicDimensions(full[n], { importance: null }));
  }
  const facts = full.map(row => ({ canonicalComponentKey: `operation:${row.operation_id}`, sourceOperation: { kind: 'resolved', id: row.operation_id } }));
  const bundle = operations => ({ operations, economicFacts: facts, allocations: [], items: [], paymentComponents: [], cashUses: [], needs: [{ need_id: 'need-a' }] });
  assert.deepEqual(resolveGlobalM2NeedAuthorities(bundle(rows)), resolveGlobalM2NeedAuthorities(bundle(full)));
  const before = reads.length;
  assert.strictEqual(await repository.loadOperationsByIds(ids, size), rows);
  assert.equal(calls.filter(c => c.table === 'operations').length, before);
}
console.log('HISTORICAL_OPERATIONS_FIELDSET PASS (population, batches, exact money, browse, dimensions, Need authority, memo)');
