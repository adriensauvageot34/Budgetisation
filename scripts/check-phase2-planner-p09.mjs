import assert from 'node:assert/strict';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { fixture, state, uuid, householdId, externalMonth, nightMonth } from './fixtures/planner-headless.mjs';
import { p09CompatibilityMonth } from './fixtures/planner-p09.mjs';
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { resolveEffectiveMonthScenario } = require('@/server/phase2/planner/effective-month-scenario');
const { stageLocalDecision, visualDraftModel } = require('@/app/mois-a-venir/composer/local-draft');
const { previewPlanScenario } = require('@/server/phase2/planner/apply');
const { AppliedMonthView } = require('@/app/mois-a-venir/applied-month-view');
const { ComposerShell } = require('@/app/mois-a-venir/composer/composer-shell');
const { ComposerResponseGate } = require('@/app/mois-a-venir/composer/draft-controller');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { PLANNED_ASSET_CATALOG_VERSION } = require('@/domain/phase2/planned-assets');
const pg = await createKernelPostgres(), world = fixture(), repository = createPlanApplyRepository(pg.client);
const deps = { repository, householdPersons: [{ personId: uuid(1), displayName: 'Alice Fixture' }],
  readWorld: async () => world, readDirectWorld: async () => ({ forecast: world.forecast, monthInputs: world.monthInputs,
    externalIntents: world.externalIntents, asOfDate: world.asOfDate }),
  validateContextReferences: async (_household, refs) => {
    if (refs.personIds.some(id => id !== uuid(1))) throw new TypeError('CONTEXT_PERSON_NOT_IN_HOUSEHOLD');
  } };
let sequence = 0;
const request = (operation, draft) => handleComposerRequest(deps, householdId,
  { sequence: ++sequence, targetMonth: '2026-11', draft, ...operation });
const ok = response => { assert.equal(response.ok, true, `${response.code}: ${response.message}`); return response.model; };
const checks = [], check = async (name, fn) => { await fn(); checks.push(name); console.log(`${name} PASS`); };
const id = { night: uuid(9901), before: uuid(9902), beforeLink: uuid(9903), bottle: uuid(9904), diluent: uuid(9905),
  main: uuid(9906), food: uuid(9907), drink: uuid(9908), shared: uuid(9909), outbound: uuid(9910), return: uuid(9911) };
const cost = (amount) => amount === null ? { kind: 'UNKNOWN' } : { kind: 'MANUAL', unitAmount: amount };
const part = (selectionId, optionKey, label, quantity, amount, extra = {}) => ({ selectionId, optionKey, kind: 'COMPONENT',
  provenance: 'EXPLICIT_USER_DECISION', label, quantity, unitBasis: 'ITEM', cost: cost(amount),
  fundingAllocations: amount === null ? [] : [{ source: 'BANK', amount: String(Number(quantity) * Number(amount)) }], ...extra });
const mobility = (selectionId, optionKey, amount) => ({ selectionId, optionKey, kind: 'MOBILITY_INTENT', provenance: 'EXPLICIT_USER_DECISION',
  origin: { kind: 'TEXT', label: 'Maison' }, destination: { kind: 'TEXT', label: 'Centre-ville' }, returnRequired: false,
  pricing: { fare: cost(amount), fundingAllocations: [{ source: 'BANK', amount }], preference: 'FASTEST' } });
const get = (model) => model.semanticState.contexts.find(c => c.contextOccurrenceId === id.night);
const child = (model) => model.semanticState.contexts.find(c => c.contextOccurrenceId === id.before);
try {
  const initial = ok(await request({ kind: 'READ' }, state()));
  const dropped = ok(await request({ kind: 'DROP', assetKey: 'template:night-out', target: { kind: 'BOARD_ZONE' },
    identity: id.night, selectionId: uuid(9912), values: {} }, initial.semanticState));
  await check('NIGHT-01-IDENTITY-AND-LOCAL-STAGING', () => {
    assert.equal(get(dropped).templateKey, 'night-out');
    assert.equal(stageLocalDecision(initial, initial.semanticState, { kind: 'DROP', assetKey: 'template:night-out',
      target: { kind: 'BOARD_ZONE' }, identity: id.night, selectionId: uuid(9912), values: {} }).contexts[0].contextOccurrenceId, id.night);
  });
  await check('NIGHT-02-03-04-TOTAL-UNITS-NO-PARTICIPANT-MULTIPLICATION', async () => {
    const total = ok(await request({ kind: 'EDIT_NIGHT_OUT', edit: { contextOccurrenceId: id.night, fields: {},
      slots: { extras: [part(id.drink, 'extra', 'Deux verres au total', '2', '5.00')] } } }, dropped.semanticState));
    const withPeople = ok(await request({ kind: 'EDIT_NIGHT_OUT', edit: { contextOccurrenceId: id.night,
      fields: { participantRefs: [{ kind: 'TEXT', label: 'Moi' }, { kind: 'TEXT', label: 'Compagne' }] } } }, total.semanticState));
    assert.equal(get(withPeople).slotSelections.extras.items[0].quantity, '2');
    assert.equal((await previewPlanScenario(deps, householdId, withPeople.semanticState)).compiled.components[0].evaluation.economicAmount, '10.00');
    const three = ok(await request({ kind: 'EDIT_NIGHT_OUT', edit: { contextOccurrenceId: id.night, fields: {},
      slots: { extras: [part(id.drink, 'extra', 'Trois verres au total', '3', '5.00')] } } }, withPeople.semanticState));
    assert.equal((await previewPlanScenario(deps, householdId, three.semanticState)).compiled.components[0].evaluation.economicAmount, '15.00');
  });
  const edit = { kind: 'EDIT_NIGHT_OUT', edit: { contextOccurrenceId: id.night,
    fields: { label: 'Soirée avec ma compagne', participantRefs: [{ kind: 'HOUSEHOLD_PERSON', personId: uuid(1) },
      { kind: 'TEXT', label: 'Ma compagne' }], placeRef: { kind: 'TEXT', label: 'Centre-ville', provenance: 'USER_DECLARED_PROSPECTIVE' },
      plannedDate: '', timingNote: 'Après le dîner' },
    before: { childContextOccurrenceId: id.before, selectionId: id.beforeLink,
      bottle: part(id.bottle, 'activity', 'Bouteille de vodka', '1', '20.00', { productAssetRef: { catalogVersion: PLANNED_ASSET_CATALOG_VERSION,
        assetKey: 'house_party:vodka', labelAtSelection: 'Vodka', provenance: 'EXPLICIT_USER_DECISION' } }),
      extras: [part(id.diluent, 'extra', 'Diluant', '2', '3.00')] },
    slots: { main: [part(id.main, 'main', 'Entrée', '2', '15.00')],
      food: [part(id.food, 'restaurant', 'Restaurant', '2', '25.00')],
      extras: [part(id.drink, 'extra', 'Verres', '4', '5.00', { unitBasis: 'PERSON', quantityEvidenceVersion: 'component-quantity@v1', quantityPerPerson: '2', pricedParticipantCount: 2 }),
        part(id.shared, 'extra', 'Bouteille partagée', '1', '10.00', { unitBasis: 'SHARED' })] } } };
  const local = stageLocalDecision(dropped, dropped.semanticState, edit);
  const configured = ok(await request(edit, dropped.semanticState));
  await check('NIGHT-02-03-05-06-STRUCTURE-AND-QUANTITY', () => {
    assert.deepEqual(local, configured.semanticState);
    assert.equal(get(configured).fields.plannedDate, undefined);
    assert.equal(get(configured).fields.participantRefs.length, 2);
    assert.equal(get(configured).slotSelections.extras.items.length, 2);
    assert.equal(get(configured).slotSelections.extras.items[0].quantity, '4');
    assert.equal(get(configured).slotSelections.extras.items[0].quantityPerPerson, '2');
    assert.equal(child(configured).slotSelections.extras.items[0].selectionId, id.diluent);
    assert.equal(child(configured).slotSelections.main.items[0].selectionId, id.bottle);
    assert.equal(child(configured).slotSelections.main.items[0].productAssetRef.assetKey, 'house_party:vodka');
    assert.equal(visualDraftModel(dropped, local).presentation.elementCount, dropped.presentation.elementCount);
  });
  await check('NIGHT-LOCAL-VISUAL-PRESERVES-EXTERNAL-OWNER-CARDS', async () => {
    const external = externalMonth();
    const current = ok(await handleComposerRequest({ ...deps, readWorld: async () => external.world }, householdId,
      { kind:'READ', sequence:++sequence,targetMonth:'2026-11',draft:configured.semanticState }));
    const externalCard = current.board.contexts.find(c => c.readOnly);
    assert.ok(externalCard);
    const changed = stageLocalDecision(current, current.semanticState, {kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id.night,fields:{label:'Nom local'}}});
    assert.deepEqual(visualDraftModel(current, changed).board.contexts.find(c => c.contextOccurrenceId === externalCard.contextOccurrenceId), externalCard);
  });
  await check('NIGHT-18-PARENT-NON-ADDITIVE', async () => {
    const compiled = (await previewPlanScenario(deps, householdId, configured.semanticState)).compiled;
    assert.equal(compiled.components.filter(c => [id.night, id.before].includes(c.contextOccurrenceId)).length, 6);
    assert.equal(compiled.components.find(c => c.selectionId === id.drink)?.evaluation.economicAmount ??
      compiled.components.find(c => c.label === 'Verres').evaluation.economicAmount, '20.00');
  });
  await check('NIGHT-FUNDING-INVALID-BLOCKS-APPLY-WITH-CONTEXT-NEUTRAL-MESSAGE', async () => {
    const before = child(configured);
    const invalid = ok(await request({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id.night,fields:{},before:{
      childContextOccurrenceId:id.before,selectionId:id.beforeLink,
      bottle:{...before.slotSelections.main.items[0],cost:cost('21.00')},extras:before.slotSelections.extras.items
    }}}, configured.semanticState));
    assert.equal(invalid.board.cockpit.applyReadiness, 'BLOCKED');
    const html = renderToStaticMarkup(React.createElement(ComposerShell, {initialModel:invalid,transport:async()=>{throw Error('SSR_TRANSPORT_FORBIDDEN');}}));
    assert.match(html, /coût du composant/u); assert.doesNotMatch(html, /coût du cadeau/u);
    const wallet = await request({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id.night,fields:{},before:{
      childContextOccurrenceId:id.before,selectionId:id.beforeLink,
      bottle:{...before.slotSelections.main.items[0],fundingAllocations:[{source:'SWILE',amount:'20.00'}]},extras:before.slotSelections.extras.items
    }}}, configured.semanticState);
    assert.equal(wallet.ok, false); assert.equal(wallet.code, 'PLANNER_WALLET_ELIGIBILITY_UNRESOLVED');
  });
  const restaurantChildId = uuid(9940);
  const withRestaurant = ok(await request({ kind: 'DROP', assetKey: 'template:restaurant', target: { kind: 'CONTEXT_SOCKET',
    contextOccurrenceId: id.night, slotKey: 'food' }, identity: restaurantChildId, selectionId: uuid(9941), values: {} }, configured.semanticState));
  const configuredRestaurant = ok(await request({ kind: 'MUTATE', mutation: { kind: 'PATCH_CONTEXT', contextOccurrenceId: restaurantChildId,
    slotKey: 'meal', items: [part(id.food, 'restaurant', 'Restaurant enfant', '2', '25.00')] } }, withRestaurant.semanticState));
  await check('NIGHT-07-CHILD-RESTAURANT-BINDING-ONCE', async () => {
    const compiled = (await previewPlanScenario(deps, householdId, configuredRestaurant.semanticState)).compiled;
    const meal = compiled.components.find(c => c.contextOccurrenceId === restaurantChildId);
    assert.equal(get(configuredRestaurant).slotSelections.food.items[0].kind, 'CHILD_CONTEXT');
    assert.equal(meal.binding.relation, 'CONSUMES_SLOT');
    assert.equal(compiled.financialAdapterInput.adapterManifest.baselineConsumptions.filter(c => c.componentId === meal.componentId).length, 1);
    assert.equal(compiled.components.filter(c => c.label === 'Restaurant enfant').length, 1);
    assert.ok(!compiled.components.some(c => c.label === 'Restaurant'));
  });
  const withTransport = ok(await request({ kind: 'MUTATE', mutation: { kind: 'PATCH_CONTEXT', contextOccurrenceId: id.night,
    slotKey: 'outbound', items: [mobility(id.outbound, 'taxi', '14.00')] } }, configuredRestaurant.semanticState));
  const full = ok(await request({ kind: 'MUTATE', mutation: { kind: 'PATCH_CONTEXT', contextOccurrenceId: id.night,
    slotKey: 'return', items: [mobility(id.return, 'bus', '2.00')] } }, withTransport.semanticState));
  await check('NIGHT-07-08-09-TRANSPORT-INDEPENDENCE', () => {
    assert.equal(get(full).slotSelections.outbound.items[0].optionKey, 'taxi');
    assert.equal(get(full).slotSelections.return.items[0].optionKey, 'bus');
    assert.equal(get(full).slotSelections.food.items[0].optionKey, 'restaurant');
  });
  await check('NIGHT-SIMILAR-ACTIVITY-CHILDREN-KEEP-DISTINCT-IDENTITIES', async () => {
    const mainChild = uuid(9942);
    const attached = ok(await request({ kind: 'DROP', assetKey: 'template:activity', target: { kind: 'CONTEXT_SOCKET',
      contextOccurrenceId: id.night, slotKey: 'main' }, identity: mainChild, selectionId: uuid(9943), values: {} }, full.semanticState));
    const equipped = ok(await request({ kind: 'MUTATE', mutation: { kind: 'PATCH_CONTEXT', contextOccurrenceId: mainChild,
      slotKey: 'main', items: [part(uuid(9944), 'activity', 'Club principal', '1', '30')] } }, attached.semanticState));
    const ids = equipped.semanticState.contexts.filter(c => c.templateKey === 'activity').map(c => c.contextOccurrenceId);
    assert.deepEqual(ids.sort(), [id.before, mainChild].sort());
    const compiled = (await previewPlanScenario(deps, householdId, equipped.semanticState)).compiled;
    assert.equal(compiled.components.filter(c => c.contextOccurrenceId === mainChild).length, 1);
    assert.equal(compiled.components.filter(c => c.contextOccurrenceId === id.before).length, 2);
  });
  const revisedDrink = { ...get(full).slotSelections.extras.items[0], quantity: '6.00', quantityPerPerson: '3.00',
    fundingAllocations: [{ source: 'BANK', amount: '30.00' }] };
  const revise = { kind: 'EDIT_NIGHT_OUT', edit: { contextOccurrenceId: id.night, fields: {},
    slots: { extras: [revisedDrink, get(full).slotSelections.extras.items[1]] } } };
  const changed = ok(await request(revise, full.semanticState));
  await check('NIGHT-04-15-QUANTITY-UNDO-REDO', () => {
    assert.equal(get(changed).slotSelections.extras.items[0].quantity, '6.00');
    assert.equal(get(full).slotSelections.extras.items[0].quantity, '4');
    assert.deepEqual(stageLocalDecision(full, full.semanticState, revise), changed.semanticState);
    assert.deepEqual(stageLocalDecision(changed, changed.semanticState, { kind: 'READ' }), null);
  });
  const withoutDiluent = ok(await request({ kind: 'EDIT_NIGHT_OUT', edit: { contextOccurrenceId: id.night, fields: {},
    before: { childContextOccurrenceId: id.before, selectionId: id.beforeLink,
      bottle: child(changed).slotSelections.main.items[0], extras: [] } } }, changed.semanticState));
  await check('NIGHT-10-REMOVE-DILUENT-ONLY', () => {
    assert.equal(child(withoutDiluent).slotSelections.extras.items.length, 0);
    assert.equal(child(withoutDiluent).slotSelections.main.items[0].selectionId, id.bottle);
    assert.equal(get(withoutDiluent).slotSelections.outbound.items[0].selectionId, id.outbound);
    const localRemove = stageLocalDecision(changed, changed.semanticState, { kind: 'CLEAR_SOCKET', contextOccurrenceId: id.before,
      slotKey: 'extras', selectionId: id.diluent });
    assert.deepEqual(localRemove, withoutDiluent.semanticState);
    assert.equal(visualDraftModel(changed, localRemove).presentation.sockets[`${id.before}:extras`].satellites.length, 0);
  });
  const switched = ok(await request({ kind: 'MUTATE', mutation: { kind: 'PATCH_CONTEXT', contextOccurrenceId: id.night,
    slotKey: 'outbound', items: [mobility(id.outbound, 'train', '4.00')] } }, withoutDiluent.semanticState));
  await check('NIGHT-11-REPLACE-ONE-OF', () => {
    assert.equal(get(switched).slotSelections.outbound.items.length, 1);
    assert.equal(get(switched).slotSelections.outbound.items[0].optionKey, 'train');
    assert.equal(get(switched).slotSelections.return.items[0].optionKey, 'bus');
  });
  await check('NIGHT-12-STALE-RESPONSE-GATE', () => {
    const gate = new ComposerResponseGate(), first = gate.next('older'); gate.invalidate(); const second = gate.next('newer');
    assert.equal(gate.accepts(first, first.sequence, 'newer'), false);
    assert.equal(gate.accepts(second, second.sequence, 'newer'), true);
  });
  const secondNight = ok(await request({ kind: 'DROP', assetKey: 'template:night-out', target: { kind: 'BOARD_ZONE' },
    identity: uuid(9920), selectionId: uuid(9921), values: {} }, switched.semanticState));
  await check('NIGHT-13-TWO-IDENTITIES', () => {
    assert.equal(secondNight.semanticState.contexts.filter(c => c.templateKey === 'night-out').length, 2);
    assert.equal(new Set(secondNight.semanticState.contexts.map(c => c.contextOccurrenceId)).size, secondNight.semanticState.contexts.length);
  });
  await check('NIGHT-14-INCOMPATIBLE-REPARENT-REFUSED', async () => {
    const rejected = await request({ kind: 'DROP', assetKey: `context-occurrence:${id.before}`, target: { kind: 'CONTEXT_SOCKET',
      contextOccurrenceId: uuid(9920), slotKey: 'outbound' }, identity: id.before, selectionId: uuid(9922), values: {} }, secondNight.semanticState);
    assert.equal(rejected.ok, false);
    const moved = ok(await request({ kind: 'DROP', assetKey: `context-occurrence:${id.before}`, target: { kind: 'CONTEXT_SOCKET',
      contextOccurrenceId: uuid(9920), slotKey: 'before' }, identity: id.before, selectionId: uuid(9923), values: {} }, secondNight.semanticState));
    assert.equal(child(moved).parentContextOccurrenceId, uuid(9920));
    assert.equal(get(moved).slotSelections.before.items.length, 0);
    assert.equal(child(moved).slotSelections.main.items[0].selectionId, id.bottle);
  });
  await check('NIGHT-17-UNKNOWN-IS-NOT-ZERO', async () => {
    const previous = get(switched).slotSelections.extras.items;
    const unknown = ok(await request({ kind: 'EDIT_NIGHT_OUT', edit: { contextOccurrenceId: id.night, fields: {},
      slots: { extras: [{ ...previous[0], cost: { kind: 'UNKNOWN' }, fundingAllocations: [] }, previous[1]] } } }, switched.semanticState));
    assert.equal(get(unknown).slotSelections.extras.items[0].cost.kind, 'UNKNOWN');
    assert.equal((await previewPlanScenario(deps, householdId, unknown.semanticState)).compiled.components.find(c => c.label === 'Verres').evaluation.economicAmount, null);
    assert.equal(get(unknown).slotSelections.extras.items[1].cost.unitAmount, '10.00');
    const zero = ok(await request({ kind: 'EDIT_NIGHT_OUT', edit: { contextOccurrenceId: id.night, fields: {},
      slots: { main: [part(id.main, 'main', 'Entrée gratuite', '1', '0')] } } }, unknown.semanticState));
    assert.equal((await previewPlanScenario(deps, householdId, zero.semanticState)).compiled.components.find(c => c.label === 'Entrée gratuite').evaluation.economicAmount, '0.00');
  });
  await check('NIGHT-PARTIAL-EDITS-LEGACY-UNKNOWN-AND-SUGGESTION', async () => {
    const legacy = ok(await request({ kind: 'READ' }, p09CompatibilityMonth().semantic));
    const contextId = uuid(9960), context = legacy.semanticState.contexts.find(c => c.contextOccurrenceId === contextId);
    const changed = ok(await request({ kind: 'EDIT_NIGHT_OUT', edit: { contextOccurrenceId: contextId,
      fields: { label: 'Nom modifié' }, slots: { extras: context.slotSelections.extras.items.map(item => item.selectionId === uuid(9966)
        ? { ...item, cost: cost('4') } : item) } } }, legacy.semanticState));
    const reread = changed.semanticState.contexts.find(c => c.contextOccurrenceId === contextId);
    for (const key of ['plannedDate', 'endDate', 'placeRef', 'timingNote']) assert.equal(reread.fields[key], null);
    assert.equal(reread.slotSelections.extras.items.find(item => item.selectionId === uuid(9964)).quantity, '2');
    assert.equal(reread.slotSelections.extras.items.find(item => item.selectionId === uuid(9965)).provenance, 'PERSONAL_SUGGESTION');
    const compiled = (await previewPlanScenario(deps, householdId, changed.semanticState)).compiled;
    assert.equal(compiled.components.find(c => c.label === 'Verres antérieurs').evaluation.economicAmount, '10.00');
    assert.ok(!compiled.components.some(c => c.label === 'Proposition historique non retenue'));
  });
  await check('NIGHT-PER-PERSON-EVIDENCE-VALIDATED-AND-PRESERVED', async () => {
    const bad = await request({ kind: 'EDIT_NIGHT_OUT', edit: { contextOccurrenceId: id.night, fields: {},
      slots: { extras: [{ ...revisedDrink, pricedParticipantCount: 3 }] } } }, changed.semanticState);
    assert.equal(bad.ok, false);
    const editedAmount = ok(await request({ kind: 'DROP', assetKey: 'option:night-out:extras:extra', target: { kind: 'CONTEXT_SOCKET',
      contextOccurrenceId: id.night, slotKey: 'extras' }, identity: uuid(9945), selectionId: id.drink,
      values: { label: 'Verres', quantity: '6.00', amount: '7.00', unitBasis: 'PERSON', funding: 'BANK', fundingAmount: '42.00' } }, changed.semanticState));
    const item = get(editedAmount).slotSelections.extras.items.find(item => item.selectionId === id.drink);
    assert.equal(item.quantityEvidenceVersion, 'component-quantity@v1');
    assert.equal(item.quantityPerPerson, '3.00'); assert.equal(item.pricedParticipantCount, 2);
    assert.equal((await previewPlanScenario(deps, householdId, editedAmount.semanticState)).compiled.components.find(c => c.label === 'Verres').evaluation.economicAmount, '42.00');
  });
  await check('NIGHT-PROTECTION-ROOT-AND-BEFORE-CHILD', async () => {
    const protectedParent = ok(await request({ kind: 'PRESERVE', targetRef: id.night, preserve: true }, switched.semanticState));
    assert.equal((await request({ kind: 'EDIT_NIGHT_OUT', edit: { contextOccurrenceId: id.night, fields: { label: 'Refusé' } } }, protectedParent.semanticState)).ok, false);
    const protectedChild = ok(await request({ kind: 'PRESERVE', targetRef: id.before, preserve: true }, switched.semanticState));
    assert.equal((await request({ kind: 'EDIT_NIGHT_OUT', edit: { contextOccurrenceId: id.night, fields: {}, before: null } }, protectedChild.semanticState)).ok, false);
    const fieldsOnly = await request({ kind: 'EDIT_NIGHT_OUT', edit: { contextOccurrenceId: id.night, fields: { label: 'Parent seul' } } }, protectedChild.semanticState);
    assert.equal(fieldsOnly.ok, false); // The existing C6 capability also locks this child's owning root.
    assert.equal(fieldsOnly.code, 'COMPOSER_CONTEXT_LOCKED');
    assert.deepEqual(child(protectedChild).slotSelections, child(switched).slotSelections);
  });
  await check('NIGHT-CATALOGUE-REFERENCE-INDEPENDENT-AND-INVALID-REF-REFUSED', async () => {
    const unknown = await request({ kind: 'EDIT_NIGHT_OUT', edit: { contextOccurrenceId: id.night, fields: {},
      slots: { extras: [{ ...revisedDrink, productAssetRef: { catalogVersion: PLANNED_ASSET_CATALOG_VERSION,
        assetKey: 'club:not_in_catalogue', labelAtSelection: 'Inventé', provenance: 'EXPLICIT_USER_DECISION' } }] } } }, changed.semanticState);
    assert.equal(unknown.ok, false);
    const existingUnknown = structuredClone(changed.semanticState);
    const before = existingUnknown.contexts.find(c => c.contextOccurrenceId === id.before);
    before.slotSelections.main.items[0].productAssetRef = { catalogVersion: PLANNED_ASSET_CATALOG_VERSION,
      assetKey: 'house_party:old_missing_type', labelAtSelection: 'Type retiré', provenance: 'EXPLICIT_USER_DECISION' };
    const readable = ok(await request({ kind: 'READ' }, existingUnknown));
    const amended = ok(await request({ kind: 'EDIT_NIGHT_OUT', edit: { contextOccurrenceId: id.night, fields: {},
      before: { childContextOccurrenceId: id.before, selectionId: id.beforeLink,
        bottle: { ...child(readable).slotSelections.main.items[0], cost: cost('21.00'), fundingAllocations: [{source:'BANK',amount:'21.00'}] },
        extras: child(readable).slotSelections.extras.items } } }, readable.semanticState));
    assert.equal(child(amended).slotSelections.main.items[0].productAssetRef.assetKey, 'house_party:old_missing_type');
    assert.equal(child(amended).slotSelections.main.items[0].label, 'Bouteille de vodka');
  });
  await check('NIGHT-LEGACY-BEFORE-PROMOTION-PRESERVES-UNAVAILABLE-REFERENCE', async () => {
    const legacy = nightMonth().semantic, parentId = uuid(400), newChildId = uuid(9980);
    const parent = legacy.contexts.find(c => c.contextOccurrenceId === parentId), before = parent.slotSelections.before.items[0];
    before.productAssetRef = {catalogVersion:PLANNED_ASSET_CATALOG_VERSION,assetKey:'house_party:old_missing_type',
      labelAtSelection:'Type retiré',provenance:'EXPLICIT_USER_DECISION'};
    const readable = ok(await request({kind:'READ'},legacy));
    const promoted = ok(await request({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:parentId,fields:{},before:{
      childContextOccurrenceId:newChildId,selectionId:before.selectionId,
      bottle:{...before,selectionId:uuid(9981),optionKey:'activity'},extras:[part(uuid(9982),'extra','Diluant','1','3.00')]
    }}},readable.semanticState));
    const root = promoted.semanticState.contexts.find(c=>c.contextOccurrenceId===parentId), activity = promoted.semanticState.contexts.find(c=>c.contextOccurrenceId===newChildId);
    assert.equal(root.slotSelections.before.items[0].kind,'CHILD_CONTEXT');
    assert.equal(root.slotSelections.before.items[0].selectionId,before.selectionId);
    assert.equal(activity.slotSelections.main.items[0].productAssetRef.assetKey,'house_party:old_missing_type');
    assert.equal(activity.slotSelections.main.items[0].cost.unitAmount,'8.00');
    const compiled = (await previewPlanScenario(deps,householdId,promoted.semanticState)).compiled;
    assert.equal(compiled.components.filter(c=>c.contextOccurrenceId===newChildId).length,2);
  });
  await check('NIGHT-16-APPLY-RELOAD-MON-PLAN-REEDIT', async () => {
    const applied = ok(await request({ kind: 'APPLY', command: { ...switched.proof, applyRequestId: uuid(9930) } }, switched.semanticState));
    assert.equal(applied.activeRevisionNumber, 1);
    const stored = await repository.readActivePlan(householdId, '2026-11');
    assert.deepEqual(stored.activeRevision.semanticState, switched.semanticState);
    const reloaded = ok(await request({ kind: 'READ' }));
    assert.deepEqual(reloaded.semanticState, switched.semanticState);
    const effective = await resolveEffectiveMonthScenario(deps, householdId, '2026-11');
    const html = renderToStaticMarkup(React.createElement(AppliedMonthView, { projection: effective.projection,
      semanticState: effective.semanticState, plan: null, revision: 1, today: world.asOfDate,
      persons: deps.householdPersons, composerHref: '/mois-a-venir/composer?month=2026-11' }));
    for (const expected of ['data-plan-night-out', 'Bouteille de vodka', 'Verres', '3.00 par personne', 'Centre-ville', 'Retour', 'Train / tram', 'Banque'])
      assert.ok(html.includes(expected), expected);
    assert.equal(get(reloaded).slotSelections.extras.items[0].selectionId, id.drink);
  });
  await check('RED-02-NON-MOBILITY-COHERENCE', async () => {
    const current = ok(await request({ kind: 'READ' }));
    const unavailable = ok(await request({ kind: 'MUTATE', mutation: { kind: 'PATCH_CONTEXT', contextOccurrenceId: id.night,
      slotKey: 'return', items: [{ ...mobility(id.return, 'unknown', '2.00'), pricing: { fare: { kind: 'UNKNOWN' }, fundingAllocations: [] } }] } }, current.semanticState));
    assert.equal(get(unavailable).slotSelections.extras.items[0].selectionId, id.drink);
    assert.equal(child(unavailable).slotSelections.main.items[0].selectionId, id.bottle);
    assert.equal((await previewPlanScenario(deps, householdId, unavailable.semanticState)).compiled.components.find(c => c.label === 'Verres').evaluation.economicAmount, '30.00');
  });
  await check('NIGHT-NO-TRANSVERSE-WRITES', async () => { await pg.verifyCanaries(); });
  console.log(JSON.stringify({ status: 'EXECUTED_PASS_PGLITE_SYNTHETIC_ONLY', checks, counts: await pg.counts(),
    rpcCalls: pg.rpcCalls, remoteWrites: 0, authenticated: 'NOT_RUN' }));
} finally { await pg.close(); }
