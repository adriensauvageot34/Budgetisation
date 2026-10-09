import assert from 'node:assert/strict';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { fixture, state, context, component, child, mobility, selections, control, uuid, householdId, findSlot } from './fixtures/planner-contexts.mjs';

const { patchContextEditorFields, readContextEditorPayload } = require('@/server/phase2/planner/context-state');
const { parsePlanSemanticState, semanticStateDigest } = require('@/domain/phase2/planner/semantic-state');
const { readContextSelections } = require('@/server/phase2/planner/context-selections');
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { previewPlanScenario, applyPlanScenario } = require('@/server/phase2/planner/apply');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { resolveEffectiveMonthScenario } = require('@/server/phase2/planner/effective-month-scenario');

const passed = [];
const check = async (name, fn) => { await fn(); passed.push(name); console.log(`${name} PASS`); };
const world = fixture(), pg = await createKernelPostgres();
const deps = { repository: createPlanApplyRepository(pg.client), readWorld: async () => structuredClone(world),
  readDirectWorld: async () => ({ forecast: world.forecast, monthInputs: world.monthInputs, externalIntents: world.externalIntents, asOfDate: world.asOfDate }) };
let requestId = 28000;
const command = preview => ({ expectedActiveRevisionId: preview.baseActiveRevisionId,
  expectedActiveRevisionNumber: preview.baseRevisionNumber, expectedBaselineDigest: preview.baselineDigest,
  expectedPreviewDigest: preview.previewDigest, applyRequestId: uuid(requestId++) });
const person = label => ({ kind: 'TEXT', label });
const place = label => ({ kind: 'TEXT', label, provenance: 'USER_DECLARED_PROSPECTIVE' });
const bank = amount => [{ source: 'BANK', amount }];
const componentWith = (key, amount, id, other = {}) => {
  const quantity = other.quantity ?? '2';
  return component(key, amount, id,
    { quantity, unitBasis: 'PERSON', fundingAllocations: bank((Number(amount) * Number(quantity)).toFixed(2)), ...other });
};
const move = (mode, id, amount) => mobility(mode, id, { origin: place('Départ libre'), destination: place('Destination libre'),
  pricing: { fare: { kind: 'MANUAL', unitAmount: amount }, fundingAllocations: bank(amount), preference: 'FASTEST' } });

try {
  const legacy = state([], [context(90, 'gift', { item: selections(component('gift', '15.00', 'legacy-item')) })]);
  let legacyRevision;
  await check('P02-LEGACY-REVISION-READABLE', async () => {
    const p = await previewPlanScenario(deps, householdId, legacy);
    assert.notEqual(p.projection.applyReadiness, 'BLOCKED');
    legacyRevision = (await applyPlanScenario(deps, householdId, legacy, command(p))).revision;
    assert.deepEqual(legacyRevision.semanticState, parsePlanSemanticState(legacy));
    assert.equal(legacyRevision.semanticState.contexts[0].fields.fieldSchemaVersion, undefined);
  });

  const gift = context(101, 'gift', { item: selections(componentWith('gift', '25.00', 'gift-item', { quantity: '1', unitBasis: 'ITEM' })) });
  const restaurant = context(102, 'restaurant', { meal: selections(componentWith('restaurant', '20.00', 'restaurant-meal', { quantity: '1', unitBasis: 'SHARED' })) });
  const visit = context(103, 'family-visit', { activities: selections(child('activity', 104, 'visit-child')),
    transport: selections(move('train', 'visit-outbound', '8.00')) });
  const visitChild = context(104, 'activity', { main: selections(component('activity', '12.00', 'visit-activity')) }, {}, 103);
  const night = context(105, 'night-out', { before: selections(componentWith('before', '6.00', 'night-before')),
    main: selections(componentWith('main', '18.00', 'night-main')),
    outbound: selections(move('train', 'night-outbound', '4.00')),
    return: selections(move('taxi', 'night-return', '10.00')) });
  const stay = context(106, 'short-stay', { lodging: selections(component('lodging', '90.00', 'stay-lodging')),
    groceries: selections(component('groceries', '20.00', 'stay-groceries', { binding: { mode: 'EXTRA_TO_SLOT' } })),
    activities: selections(child('activity', 107, 'stay-child')),
    transport: selections(move('train', 'stay-outbound', '25.00')) },
    { plannedDate: null, endDate: null });
  const stayChild = context(107, 'activity', { main: selections(component('activity', '10.00', 'stay-activity')) }, {}, 106);
  let semantic = state([
    control(findSlot(world, 'groceries').slotIdentityKey, { amount: '300.00' }, 10),
    control(`savings:${uuid(700)}`, { amount: '60.00' }, 11)
  ], [legacy.contexts[0], gift, restaurant, visit, visitChild, night, stay, stayChild]);
  const rich = [
    [101, { recipientRef: person('Destinataire déclaré'), occasion: 'Anniversaire', objectLabel: 'Livre choisi', plannedDate: null }],
    [102, { participantRefs: [person('Adrien'), person('Manon')], placeRef: place('Restaurant déclaré') }],
    [103, { personVisitedRef: person('Famille visitée'), participantRefs: [person('Adrien'), person('Manon')],
      placeRef: place('Adresse familiale déclarée'), timingNote: 'Vers la fin du mois', plannedDate: null }],
    [105, { participantRefs: [person('Adrien'), person('Manon')], placeRef: place('Lieu de soirée déclaré'),
      timingNote: 'Après le travail', endDate: null }],
    [106, { participantRefs: [person('Adrien'), person('Manon')], destinationRef: place('Destination libre'),
      nightCount: 2, lodgingKind: 'HOTEL', timingNote: 'Un week-end après paie', plannedDate: null, endDate: null }]
  ];
  await check('P02-TEMPLATE-ADAPTERS', () => {
    for (const [id, fields] of rich) semantic = patchContextEditorFields(semantic, uuid(id), fields);
    for (const [id] of rich) {
      const payload = readContextEditorPayload(semantic, uuid(id));
      const actual = semantic.contexts.find(item => item.contextOccurrenceId === uuid(id));
      assert.deepEqual(payload.fields, actual.fields);
      assert.deepEqual(payload.slotSelections, actual.slotSelections);
      assert.equal(payload.parentContextOccurrenceId, actual.parentContextOccurrenceId);
      assert.equal(payload.fieldSchemaVersion, 'context-fields@v2');
      readContextSelections(actual, semantic.targetMonth);
    }
    assert.equal(semantic.contexts.find(item => item.contextOccurrenceId === uuid(104)).parentContextOccurrenceId, uuid(103));
    assert.equal(semantic.contexts.find(item => item.contextOccurrenceId === uuid(107)).parentContextOccurrenceId, uuid(106));
    assert.equal(semantic.contexts.find(item => item.contextOccurrenceId === uuid(105)).slotSelections.main.items[0].unitBasis, 'PERSON');
    assert.equal(semantic.contexts.find(item => item.contextOccurrenceId === uuid(106)).fields.plannedDate, null);
    assert.equal(semantic.controls.length, 2);
  });
  await check('P02-EDIT-OTHER-FIELD-PRESERVES-RICH', async () => {
    const typed = await handleComposerRequest(deps, householdId, { kind: 'EDIT_CONTEXT', sequence: 0,
      targetMonth: semantic.targetMonth, draft: semantic, contextOccurrenceId: uuid(103),
      values: { personVisitedRef: person('Famille visitée, confirmée') } });
    assert.equal(typed.ok, true, typed.code);
    semantic = typed.model.semanticState;
    assert.deepEqual(semantic.contexts.find(item => item.contextOccurrenceId === uuid(103)).fields.personVisitedRef,
      person('Famille visitée, confirmée'));
    const before = semantic.contexts.find(item => item.contextOccurrenceId === uuid(101));
    const result = await handleComposerRequest(deps, householdId, { kind: 'EDIT_CONTEXT', sequence: 1,
      targetMonth: semantic.targetMonth, draft: semantic, contextOccurrenceId: uuid(101), values: { label: 'Cadeau renommé' } });
    assert.equal(result.ok, true, result.code);
    semantic = result.model.semanticState;
    const after = semantic.contexts.find(item => item.contextOccurrenceId === uuid(101));
    assert.equal(after.fields.label, 'Cadeau renommé');
    for (const key of ['recipientRef', 'occasion', 'objectLabel', 'plannedDate', 'fieldSchemaVersion'])
      assert.deepEqual(after.fields[key], before.fields[key]);
    assert.deepEqual(after.slotSelections, before.slotSelections);
    assert.equal(after.contextOccurrenceId, before.contextOccurrenceId);
  });
  await check('P02-VALIDATION-NO-LOSS', () => {
    assert.throws(() => patchContextEditorFields(semantic, uuid(101), { alien: 'x' }), /PLANNER_FIELDS_INVALID/);
    assert.throws(() => patchContextEditorFields(semantic, uuid(101), { fieldSchemaVersion: 'context-fields@v2' }), /PLANNER_FIELDS_INVALID/);
    assert.throws(() => patchContextEditorFields(semantic, uuid(101), { recipientRef: { kind: 'HOUSEHOLD_PERSON', personId: 'not-an-id' } }), /PLANNER_ID_INVALID/);
    assert.throws(() => patchContextEditorFields(semantic, uuid(101), { recipientRef: { kind: 'CONTACT', contactKey: 'forged-contact' } }), /CONTEXT_CONTACT_UNKNOWN/);
    assert.throws(() => patchContextEditorFields(semantic, uuid(102), { participantRefs: [person('Adrien'), person('Adrien')] }), /CONTEXT_PARTICIPANTS_INVALID/);
    assert.throws(() => patchContextEditorFields(semantic, uuid(106), { endDate: '2026-12-01' }), /PLANNER_CONTEXT_DATE_INVALID/);
    assert.throws(() => patchContextEditorFields(semantic, uuid(106), { nightCount: 0 }), /PLANNER_INTEGER_INVALID/);
    assert.throws(() => patchContextEditorFields(semantic, uuid(105), { placeRef: { kind: 'KNOWN', placeId: 'not-an-id' } }), /PLANNER_ID_INVALID/);
    const wallet = structuredClone(semantic);
    wallet.contexts.find(item => item.contextOccurrenceId === uuid(101)).slotSelections.item.items[0].fundingAllocations = [{ source: 'SWILE', amount: '25.00' }];
    assert.throws(() => readContextSelections(wallet.contexts.find(item => item.contextOccurrenceId === uuid(101)), wallet.targetMonth),
      /PLANNER_WALLET_ELIGIBILITY_UNRESOLVED/);
    const cleared = patchContextEditorFields(semantic, uuid(101), { occasion: '' });
    assert.equal(cleared.contexts.find(item => item.contextOccurrenceId === uuid(101)).fields.occasion, undefined);
    assert.equal(semantic.contexts.find(item => item.contextOccurrenceId === uuid(101)).fields.occasion, 'Anniversaire');
  });
  await check('P02-SERIALIZE-UNDO-REDO', () => {
    const encoded = JSON.stringify(semantic), decoded = parsePlanSemanticState(JSON.parse(encoded));
    assert.deepEqual(decoded, parsePlanSemanticState(semantic));
    const previous = semantic, changed = patchContextEditorFields(decoded, uuid(103), { label: 'Visite modifiée' });
    assert.deepEqual(parsePlanSemanticState(previous), decoded);
    assert.equal(changed.contexts.find(item => item.contextOccurrenceId === uuid(103)).fields.label, 'Visite modifiée');
    assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(changed))), changed);
    assert.equal(semanticStateDigest(decoded), semanticStateDigest(previous));
  });
  await check('P02-UNKNOWN-REMAINS-UNKNOWN', () => {
    const unknown = state([], [context(180, 'gift', { item: selections(component('gift', null, 'unknown-price',
      { quantity: '2', unitBasis: 'PERSON' })) })]);
    const restored = parsePlanSemanticState(JSON.parse(JSON.stringify(unknown)));
    const selected = readContextSelections(restored.contexts[0], restored.targetMonth).get('item')[0];
    assert.equal(selected.cost.kind, 'UNKNOWN');
    assert.equal(selected.quantity, '2');
    assert.equal(selected.unitBasis, 'PERSON');
  });
  await check('P02-KNOWN-REF-FAIL-CLOSED', async () => {
    const forged = patchContextEditorFields(semantic, uuid(101), { recipientRef: { kind: 'HOUSEHOLD_PERSON', personId: uuid(999) } });
    const p = await previewPlanScenario(deps, householdId, forged), before = pg.rpcCalls;
    await assert.rejects(() => applyPlanScenario(deps, householdId, forged, command(p)), /CONTEXT_REFERENCE_OWNER_UNAVAILABLE/);
    const scoped = { ...deps, validateContextReferences: async (household, refs) => {
      assert.equal(household, householdId); assert.deepEqual(refs.personIds, [uuid(999)]);
      throw new TypeError('CONTEXT_PERSON_NOT_IN_HOUSEHOLD');
    } };
    await assert.rejects(() => applyPlanScenario(scoped, householdId, forged, command(p)), /CONTEXT_PERSON_NOT_IN_HOUSEHOLD/);
    assert.equal(pg.rpcCalls, before);
  });
  await check('P02-APPLY-RELOAD-PGLITE-FIXTURE', async () => {
    const p = await previewPlanScenario(deps, householdId, semantic);
    if (p.projection.applyReadiness === 'BLOCKED') console.log('P02_BLOCKERS', p.compiled.constraints.filter(c => c.severity === 'BLOCKING' || c.severity === 'BLOCKED').map(c => c.code),
      p.projection.diagnostics.map(d => d.code));
    assert.notEqual(p.projection.applyReadiness, 'BLOCKED');
    const applied = await applyPlanScenario(deps, householdId, semantic, command(p));
    assert.equal(applied.replayed, false);
    const saved = await deps.repository.readActivePlan(householdId, semantic.targetMonth);
    const old = await deps.repository.readRevision(householdId, semantic.targetMonth, saved.plan.planId, legacyRevision.planRevisionId);
    assert.deepEqual(old.semanticState, legacyRevision.semanticState);
    assert.deepEqual(saved.activeRevision.semanticState, parsePlanSemanticState(semantic));
    assert.equal(saved.activeRevision.semanticStateDigest, semanticStateDigest(semantic));
    const effective = await resolveEffectiveMonthScenario(deps, householdId, semantic.targetMonth);
    assert.equal(effective.evidenceStatus, 'EXACT');
    assert.deepEqual(effective.semanticState, parsePlanSemanticState(semantic));
    assert.deepEqual(readContextEditorPayload(effective.semanticState, uuid(106)).fields,
      readContextEditorPayload(semantic, uuid(106)).fields);
    assert.equal((await pg.counts()).revisions, 2);
    await pg.verifyCanaries();
  });
  console.log(`P02_CONSERVATION_FIXTURE_PASS = ${passed.length} groups; rpcCalls=${pg.rpcCalls}; remoteWrites=0`);
} finally {
  await pg.close();
}
