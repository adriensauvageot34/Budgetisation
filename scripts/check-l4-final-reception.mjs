// Focused V5 branches. All identities/data are synthetic; no remote access.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { fixture, state, uuid, householdId } from './fixtures/planner-headless.mjs';
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { previewPlanScenario } = require('@/server/phase2/planner/apply');
const { fresh, buildComponentRow, fromSelection } = require('@/app/mois-a-venir/composer/night-out-components');
const { semanticStateDigest } = require('@/domain/phase2/planner/semantic-state');
const { editFamilyVisit } = require('@/domain/phase2/planner/family-visit-edit');
const { InlineEditRegistry } = require('@/app/mois-a-venir/composer/inline-edit-registry');
globalThis.fetch = async () => { throw Error('RECEPTION_REMOTE_FORBIDDEN'); };
const pg = await createKernelPostgres(), world = fixture(), beforeWorld = structuredClone(world);
const deps = { repository: createPlanApplyRepository(pg.client), readWorld: async () => world, householdPersons: [],
  readDirectWorld: async () => ({ forecast: world.forecast, monthInputs: world.monthInputs, externalIntents: world.externalIntents, asOfDate: world.asOfDate }) };
let sequence = 0, identity = 72000;
const nextId = () => uuid(identity++), results = [];
const request = async (operation, draft) => {
  const response = await handleComposerRequest(deps, householdId, { targetMonth: '2026-11', sequence: ++sequence, ...operation, ...(draft ? { draft } : {}) });
  assert.equal(response.ok, true, `${response.code}: ${response.message}`); return response.model;
};
const create = async (template, preset) => {
  const id = nextId();
  return { id, m: await request({ kind: 'DROP', assetKey: `template:${template}`, presetKey: preset, target: { kind: 'BOARD_ZONE' }, identity: id, selectionId: nextId(), values: {} }, state()) };
};
const context = (m, id) => m.semanticState.contexts.find(c => c.contextOccurrenceId === id);
const patch = (id, slotKey, items) => ({ kind: 'MUTATE', mutation: { kind: 'PATCH_CONTEXT', contextOccurrenceId: id, slotKey, items } });
const row = (option, label, amount, basis = 'ITEM', quantity = '1', people = '') => buildComponentRow({ ...fresh(label), id: nextId(),
  costMode: amount === null ? 'UNKNOWN' : 'MANUAL', amount: amount ?? '', quantity, unitBasis: basis, personCount: people }, option);
const prices = async m => (await previewPlanScenario(deps, householdId, m.semanticState)).compiled.components.map(c => c.evaluation.economicAmount).sort();
const travel = (mode, amount, id = nextId()) => ({ selectionId: id, optionKey: mode, kind: 'MOBILITY_INTENT', provenance: 'EXPLICIT_USER_DECISION',
  origin: { kind: 'TEXT', label: 'Origine fictive' }, destination: { kind: 'TEXT', label: 'Destination fictive' }, returnRequired: true,
  pricing: { fare: amount === null ? { kind: 'UNKNOWN' } : { kind: 'MANUAL', unitAmount: amount }, parking: { kind: 'UNKNOWN' }, fundingAllocations: [] } });
async function persistAndReedit(m, id, slot) {
  const snapshot = structuredClone(m.semanticState), digest = semanticStateDigest(snapshot);
  await request({ kind: 'APPLY', command: { ...m.proof, applyRequestId: nextId() } }, snapshot);
  const reloaded = await request({ kind: 'READ' });
  assert.equal(semanticStateDigest(reloaded.semanticState), digest);
  assert.deepEqual(reloaded.semanticState, snapshot);
  const prior = context(reloaded, id), items = prior.slotSelections[slot].items;
  const selected = items.find(item => item.kind === 'COMPONENT'); assert.ok(selected);
  const updated = buildComponentRow({ ...fromSelection(selected), edited: true, amount: '17', costMode: 'MANUAL' }, selected.optionKey);
  const changed = await request(patch(id, slot, items.map(item => item === selected ? updated : item)), reloaded.semanticState);
  const current = context(changed, id);
  assert.deepEqual(current.fields, prior.fields);
  for (const [key, value] of Object.entries(prior.slotSelections)) if (key !== slot) assert.deepEqual(current.slotSelections[key], value);
  for (const item of items) if (item !== selected) assert.deepEqual(current.slotSelections[slot].items.find(i => i.selectionId === item.selectionId), item);
  assert.equal(current.slotSelections[slot].items.find(i => i.selectionId === selected.selectionId).cost.unitAmount, '17');
  assert.deepEqual(changed.semanticState.contexts.filter(c => c.contextOccurrenceId !== id), snapshot.contexts.filter(c => c.contextOccurrenceId !== id));
  await request({ kind: 'APPLY', command: { ...changed.proof, applyRequestId: nextId() } }, changed.semanticState);
  assert.deepEqual((await request({ kind: 'READ' })).semanticState, changed.semanticState);
}
async function check(scenario, name, run) {
  const { m, id, slot } = await run();
  await persistAndReedit(m, id, slot);
  results.push({ scenario, name, branches: 'EXECUTED_PASS', applyReloadReedit: 'EXECUTED_PASS_PGLITE_SYNTHETIC_ONLY' });
  console.log(`${scenario} ${name} PASS`);
}
try {
  for (const [scenario, preset] of [['S1', 'techno-night'], ['S2', 'home-evening']]) await check(scenario, 'shared_partial_and_independent_return', async () => {
    let { m, id } = await create('night-out', preset);
    const bottle = row('extra', 'Bouteille commune', '25', 'SHARED'), unknown = row('extra', 'Repas à préciser', null);
    m = await request(patch(id, 'extras', [bottle, unknown]), m.semanticState);
    const outgoing = travel('taxi', '12'), returning = travel('taxi', '13');
    m = await request(patch(id, 'outbound', [outgoing]), m.semanticState);
    m = await request(patch(id, 'return', [returning]), m.semanticState);
    m = await request(patch(id, 'return', [travel('train', null, returning.selectionId)]), m.semanticState);
    assert.deepEqual(context(m, id).slotSelections.outbound.items, [outgoing]);
    assert.deepEqual(context(m, id).slotSelections.extras.items, [bottle, unknown]);
    assert.equal(context(m, id).fields.plannedDate, undefined);
    assert.equal(context(m, id).slotSelections.return.items[0].pricing.fare.kind, 'UNKNOWN');
    return { m, id, slot: 'extras' };
  });
  for (const [scenario, preset] of [['A1', 'spa-relax'], ['A2', 'hiking-nature']]) await check(scenario, 'quantity_partial_and_later_extra', async () => {
    let { m, id } = await create('activity', preset);
    m = await request(patch(id, 'main', [row('activity', 'Activité prévue', scenario === 'A1' ? '20' : null, 'PERSON', '1', '2')]), m.semanticState);
    m = await request(patch(id, 'extras', [row('extra', 'Parking choisi', '4')]), m.semanticState);
    assert.deepEqual(await prices(m), scenario === 'A1' ? ['4.00', '40.00'].sort() : ['4.00', null].sort());
    return { m, id, slot: 'extras' };
  });
  for (const [scenario, template, preset, total, first, extra] of [['R1', 'restaurant', 'restaurant-for-two', '60', '45', '15'], ['R2', 'fast-food', 'chicken-snack', '15', '12', '3'], ['R3', 'delivery', 'uber-eats-order', '35', '30', '5']])
    await check(scenario, 'total_detail_unknown_and_later_extra', async () => {
      let { m, id } = await create(template, preset);
      const original = row(template, 'Coût total', total, 'SHARED');
      m = await request(patch(id, 'meal', [original]), m.semanticState);
      m = await request({ kind: template === 'restaurant' ? 'EDIT_RESTAURANT' : 'EDIT_PRESET_CONTEXT', edit: { contextOccurrenceId: id,
        slots: { meal: [buildComponentRow({ ...fromSelection(original), edited: true, amount: first }, template)], extras: [row('extra', 'Détail compris', extra)] } } }, m.semanticState);
      assert.deepEqual(await prices(m), [first + '.00', extra + '.00'].sort());
      assert.equal(context(m, id).slotSelections.meal.items[0].selectionId, original.selectionId);
      const before = structuredClone(m.semanticState);
      const invalid = await handleComposerRequest(deps, householdId, { targetMonth: '2026-11', sequence: ++sequence, draft: before,
        kind: template === 'restaurant' ? 'EDIT_RESTAURANT' : 'EDIT_PRESET_CONTEXT', edit: { contextOccurrenceId: id, fields: { channel: 'invented' } } });
      assert.equal(invalid.ok, false); assert.deepEqual(m.semanticState, before);
      m = await request(patch(id, 'extras', [...context(m, id).slotSelections.extras.items, row('extra', 'Ajout ultérieur inconnu', null)]), m.semanticState);
      return { m, id, slot: 'meal' };
    });
  for (const [template, preset] of [['family-visit', 'fontes-family-visit'], ['friend-visit', 'visit-friends']]) await check('V1', template + '_native_contract_preserved', async () => {
    let { m, id } = await create(template, preset);
    if (template === 'friend-visit') assert.throws(() => editFamilyVisit(m.semanticState, { contextOccurrenceId: id, fields: {} }), /TARGET_INVALID/);
    m = await request({ kind: 'EDIT_CONTEXT', contextOccurrenceId: id, values: { personVisitedRef: { kind: 'TEXT', label: 'Proche fictif' },
      placeRef: { kind: 'TEXT', label: 'Destination décidée', provenance: 'USER_DECLARED_PROSPECTIVE' } } }, m.semanticState);
    const car = travel('car', null);
    m = await request(patch(id, 'transport', [car]), m.semanticState);
    const fields = structuredClone(context(m, id).fields);
    m = await request(patch(id, 'hospitality', [row('hospitality', 'Dessert', '10')]), m.semanticState);
    const extras = structuredClone(context(m, id).slotSelections.hospitality);
    m = await request(patch(id, 'transport', [travel('train', null, car.selectionId)]), m.semanticState);
    assert.deepEqual(context(m, id).fields, fields); assert.deepEqual(context(m, id).slotSelections.hospitality, extras);
    assert.equal(context(m, id).templateKey, template);
    return { m, id, slot: 'hospitality' };
  });
  await check('W1', 'composite_lodging_child_and_targeted_edit', async () => {
    let { m, id } = await create('short-stay', 'weekend-gite');
    const lodging = { ...row('lodging', 'Hébergement total', '240'), lodgingPricing: { version: 'lodging-pricing@v1', basis: 'TOTAL', nightCount: 2 } };
    m = await request({ kind: 'EDIT_SHORT_STAY', edit: { contextOccurrenceId: id, fields: { nightCount: 2 }, slots: { lodging: [lodging] } } }, m.semanticState);
    const childId = nextId();
    m = await request({ kind: 'DROP', assetKey: 'template:activity', target: { kind: 'CONTEXT_SOCKET', contextOccurrenceId: id, slotKey: 'activities' }, identity: childId, selectionId: nextId(), values: {} }, m.semanticState);
    m = await request(patch(childId, 'main', [row('activity', 'Activité enfant', '12')]), m.semanticState);
    assert.deepEqual(await prices(m), ['12.00', '240.00']);
    return { m, id, slot: 'lodging' };
  });
  for (const [scenario, preset] of [['P1', 'clothing-shopping'], ['P2', 'amazon-purchase'], ['M1', 'laundry-detergent']]) await check(scenario, 'purchase_domain_and_household_quantity', async () => {
    let { m, id } = await create('purchase', preset);
    const before = structuredClone(context(m, id).fields);
    m = await request(patch(id, 'item', [row('item', 'Article choisi', '6', 'ITEM', '2')]), m.semanticState);
    assert.deepEqual(await prices(m), ['12.00']);
    m = await request(patch(id, 'extras', [row('extra', 'Frais ultérieur', null)]), m.semanticState);
    assert.deepEqual(context(m, id).fields, before);
    if (scenario !== 'P1') assert.notEqual(context(m, id).fields.budgetDomain, 'clothing');
    assert.equal(context(m, id).fields.participantRefs, undefined);
    return { m, id, slot: 'item' };
  });
  await check('P3', 'recipient_classification_price_independent', async () => {
    let { m, id } = await create('gift', 'gift-present');
    m = await request({ kind: 'EDIT_GIFT', contextOccurrenceId: id, values: { recipientRef: { kind: 'TEXT', label: 'Alice fictive' }, occasion: 'Anniversaire',
      objectLabel: 'Livre choisi', objectAssetRef: { catalogVersion: 'planned-assets@v1', assetKey: 'gift:book', labelAtSelection: 'Livre', provenance: 'EXPLICIT_USER_DECISION' } }, item: row('gift', 'Livre choisi', '20') }, m.semanticState);
    m = await request(patch(id, 'extras', [row('extra', 'Emballage', '5')]), m.semanticState);
    const slots = structuredClone(context(m, id).slotSelections);
    m = await request({ kind: 'EDIT_CONTEXT', contextOccurrenceId: id, values: { recipientRef: { kind: 'TEXT', label: 'Bob fictif' } } }, m.semanticState);
    assert.deepEqual(context(m, id).slotSelections, slots); assert.equal(context(m, id).fields.occasion, 'Anniversaire');
    assert.equal(context(m, id).fields.objectAssetRef.assetKey, 'gift:book'); assert.deepEqual(await prices(m), ['20.00', '5.00'].sort());
    return { m, id, slot: 'item' };
  });
  await check('B1', 'manual_products_no_renewal_identity_invented', async () => {
    let { m, id } = await create('beauty-restock', 'mascara');
    const one = row('product', 'Produit manuel', '16'), unknown = row('product', 'Autre produit', null);
    m = await request(patch(id, 'products', [one, unknown]), m.semanticState);
    assert.equal(context(m, id).slotSelections.products.items[0].needOccurrenceId, undefined);
    assert.equal(context(m, id).slotSelections.products.items[0].provenance, 'EXPLICIT_USER_DECISION');
    return { m, id, slot: 'products' };
  });
  const registry = new InlineEditRegistry(); let discarded = 0;
  for (const dimension of ['gift', 'catalog', 'prospective', 'stay-posts', 'restaurant', 'equipment'])
    registry.set(dimension, { targetRef: dimension, dimension, kind: 'RAW', discard: () => discarded++, flush: () => assert.fail('RAW flush forbidden') });
  assert.equal(registry.flushPending(), 0); assert.equal(registry.confirmDiscard(() => false), false); assert.equal(discarded, 0);
  assert.equal(registry.confirmDiscard(() => true, new Set(['gift'])), true); assert.equal(discarded, 1); assert.equal(registry.count(), 5);
  assert.equal(registry.confirmDiscard(() => true), true); assert.equal(discarded, 6); assert.equal(registry.count(), 0);
  assert.deepEqual(world, beforeWorld); await pg.verifyCanaries();
  mkdirSync('outputs', { recursive: true });
  writeFileSync('outputs/l4-final-reception-contracts.json', JSON.stringify({ environment: 'PGLITE_SYNTHETIC_ONLY',
    scenarios: new Set(results.map(r => r.scenario)).size, results, rawRegistry: 'PASS', realFinancialWrites: 0, authenticated: 'NOT_RUN_AUTH' }, null, 2) + '\n');
} finally { await pg.db.close(); }
