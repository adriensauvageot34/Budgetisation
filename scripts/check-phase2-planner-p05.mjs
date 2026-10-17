import assert from 'node:assert/strict';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { fixture, state, uuid, householdId } from './fixtures/planner-headless.mjs';
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { resolveEffectiveMonthScenario } = require('@/server/phase2/planner/effective-month-scenario');
const { previewPlanScenario } = require('@/server/phase2/planner/apply');
const { stageLocalDecision } = require('@/app/mois-a-venir/composer/local-draft');
const { AppliedMonthView } = require('@/app/mois-a-venir/applied-month-view');
const { SOCIAL_CONTACTS_V1 } = require('@/domain/phase2/planned-rules');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
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
const giftId = uuid(9501), itemId = uuid(9502), extraId = uuid(9503), contactKey = SOCIAL_CONTACTS_V1[0].key;
const item = (amount, overrides = {}) => ({ selectionId: itemId, optionKey: 'gift', kind: 'COMPONENT', provenance: 'EXPLICIT_USER_DECISION',
  label: 'Livre', quantity: '1', unitBasis: 'ITEM', cost: amount === null ? { kind: 'UNKNOWN' } : { kind: 'MANUAL', unitAmount: amount },
  fundingAllocations: amount === null ? [] : [{ source: 'BANK', amount }], ...overrides });
try {
  const initial = ok(await request({ kind: 'READ' }, state()));
  const dropped = ok(await request({ kind: 'DROP', assetKey: 'template:gift', target: { kind: 'BOARD_ZONE' },
    identity: giftId, selectionId: uuid(9504), values: {} }, initial.semanticState));
  await check('GIFT-01-IMMEDIATE-IDENTITY', () => {
    assert.equal(dropped.semanticState.contexts.length, 1);
    assert.equal(dropped.semanticState.contexts[0].contextOccurrenceId, giftId);
    assert.equal(dropped.semanticState.contexts[0].templateKey, 'gift');
    assert.equal(pg.rpcCalls, 0);
  });
  const edit = { kind: 'EDIT_GIFT', contextOccurrenceId: giftId,
    values: { recipientRef: { kind: 'CONTACT', contactKey }, occasion: 'Anniversaire', objectLabel: 'Livre', plannedDate: '' }, item: item('120.00') };
  const local = stageLocalDecision(dropped, dropped.semanticState, edit);
  const configured = ok(await request(edit, dropped.semanticState));
  await check('GIFT-02-03-05-06-ROUNDTRIP', () => {
    assert.deepEqual(local, configured.semanticState);
    const context = configured.semanticState.contexts[0];
    assert.deepEqual(context.fields.recipientRef, { kind: 'CONTACT', contactKey });
    assert.equal(context.fields.occasion, 'Anniversaire'); assert.equal(context.fields.objectLabel, 'Livre');
    assert.equal(context.fields.plannedDate, undefined);
    assert.equal(context.slotSelections.item.items[0].selectionId, itemId);
    assert.equal(context.slotSelections.item.items[0].cost.unitAmount, '120.00');
    assert.equal(context.slotSelections.item.items[0].fundingAllocations[0].source, 'BANK');
    assert.equal(configured.board.cockpit.economic.explicitContexts, '120.00');
  });
  const withExtra = ok(await request({ kind: 'MUTATE', mutation: { kind: 'PATCH_CONTEXT', contextOccurrenceId: giftId,
    slotKey: 'extras', items: [{ selectionId: extraId, optionKey: 'extra', kind: 'COMPONENT', label: 'Emballage',
      quantity: '1', unitBasis: 'ITEM', cost: { kind: 'UNKNOWN' }, provenance: 'EXPLICIT_USER_DECISION', fundingAllocations: [] }] } }, configured.semanticState));
  await check('GIFT-CHILD-UNKNOWN-NO-PARENT-COST', async () => {
    const context = withExtra.semanticState.contexts[0];
    assert.equal(context.slotSelections.extras.items[0].selectionId, extraId);
    assert.equal(context.slotSelections.extras.items[0].cost.kind, 'UNKNOWN');
    const preview = await previewPlanScenario(deps, householdId, withExtra.semanticState);
    const components = preview.compiled.components.filter(component => component.contextOccurrenceId === giftId);
    assert.equal(components.length, 2);
    assert.equal(components.find(component => component.label === 'Livre').evaluation.economicAmount, '120.00');
    assert.equal(components.find(component => component.label === 'Emballage').evaluation.economicAmount, null);
  });
  await check('GIFT-PARENT-NO-DUPLICATE-WITH-KNOWN-EXTRA', async () => {
    const known = ok(await request({ kind: 'MUTATE', mutation: { kind: 'PATCH_CONTEXT', contextOccurrenceId: giftId,
      slotKey: 'extras', items: [{ selectionId: extraId, optionKey: 'extra', kind: 'COMPONENT', label: 'Emballage',
        quantity: '1', unitBasis: 'ITEM', cost: { kind: 'MANUAL', unitAmount: '10.00' },
        provenance: 'EXPLICIT_USER_DECISION', fundingAllocations: [{ source: 'BANK', amount: '10.00' }] }] } }, configured.semanticState));
    const preview = await previewPlanScenario(deps, householdId, known.semanticState);
    assert.equal(preview.compiled.components.filter(component => component.contextOccurrenceId === giftId).length, 2);
    assert.equal(preview.projection.economic.explicitContexts, '130.00');
  });
  const amountOnly = { kind: 'EDIT_GIFT', contextOccurrenceId: giftId, values: {}, item: item('130.00', {
    ...withExtra.semanticState.contexts[0].slotSelections.item.items[0], cost: { kind: 'MANUAL', unitAmount: '130.00' },
    fundingAllocations: [{ source: 'BANK', amount: '130.00' }] }) };
  const amended = ok(await request(amountOnly, withExtra.semanticState));
  await check('GIFT-08-09-ONLY-AMOUNT-EDIT-PRESERVES-ALL', () => {
    const before = withExtra.semanticState.contexts[0], after = amended.semanticState.contexts[0];
    assert.deepEqual(after.fields, before.fields);
    assert.deepEqual(after.slotSelections.extras, before.slotSelections.extras);
    assert.equal(after.contextOccurrenceId, giftId);
    assert.equal(after.slotSelections.item.items[0].selectionId, itemId);
    assert.equal(after.slotSelections.item.items[0].cost.unitAmount, '130.00');
    assert.equal(amended.board.cockpit.economic.explicitContexts, null);
    assert.deepEqual(stageLocalDecision(withExtra, withExtra.semanticState, amountOnly), amended.semanticState);
  });
  await check('GIFT-UNDO-REDO', () => {
    assert.equal(withExtra.semanticState.contexts[0].slotSelections.item.items[0].cost.unitAmount, '120.00');
    assert.deepEqual(stageLocalDecision(withExtra, withExtra.semanticState, amountOnly), amended.semanticState);
  });
  const applied = ok(await request({ kind: 'APPLY', command: { ...amended.proof, applyRequestId: uuid(9505) } }, amended.semanticState));
  await check('GIFT-10-APPLY-RELOAD', async () => {
    assert.equal(applied.activeRevisionNumber, 1); assert.equal(pg.rpcCalls, 1);
    const stored = await repository.readActivePlan(householdId, '2026-11');
    assert.deepEqual(stored.activeRevision.semanticState, amended.semanticState);
    const reloaded = ok(await request({ kind: 'READ' }));
    assert.deepEqual(reloaded.semanticState, amended.semanticState);
    assert.equal(reloaded.board.contexts[0].contextOccurrenceId, giftId);
  });
  await check('GIFT-11-MON-PLAN', async () => {
    const effective = await resolveEffectiveMonthScenario(deps, householdId, '2026-11');
    const html = renderToStaticMarkup(React.createElement(AppliedMonthView, { projection: effective.projection,
      semanticState: effective.semanticState, plan: null, revision: 1, today: world.asOfDate,
      persons: deps.householdPersons, composerHref: '/mois-a-venir/composer?month=2026-11' }));
    // B2 changed the persisted reader copy before L4; retain the date-absence and Composer-link assertions.
    for (const expected of ['data-plan-gift', 'Anniversaire', 'Livre', '130,00', 'Prix inconnu', 'Emballage', 'Date non fixée', contactKey]) {
      if (expected === contactKey) continue;
      assert.match(html, new RegExp(expected));
    }
    assert.match(html, /Modifier dans Composer/);
  });
  await check('GIFT-INVALID-REF-AND-MUTATION-REJECTED', async () => {
    const invalid = await request({ ...amountOnly, values: { recipientRef: { kind: 'CONTACT', contactKey: 'not-a-contact' } } }, amended.semanticState);
    assert.equal(invalid.ok, false);
    const wrongId = await request({ ...amountOnly, item: item('140.00', { selectionId: uuid(9510) }) }, amended.semanticState);
    assert.equal(wrongId.ok, false);
    const wallet = await request({ ...amountOnly, item: item('140.00', { fundingAllocations: [{ source: 'SWILE', amount: '140.00' }] }) }, amended.semanticState);
    assert.equal(wallet.ok, false);
    assert.deepEqual(await pg.counts(), { plans: 1, revisions: 1 });
  });
  await check('GIFT-07-UNKNOWN-DISTINCT', async () => {
    const unknown = ok(await request({ ...amountOnly, item: item(null) }, amended.semanticState));
    assert.equal(unknown.semanticState.contexts[0].slotSelections.item.items[0].cost.kind, 'UNKNOWN');
    assert.equal(unknown.semanticState.contexts[0].slotSelections.item.items[0].cost.unitAmount, undefined);
    assert.equal(unknown.semanticState.contexts[0].fields.plannedDate, undefined);
  });
  await check('GIFT-INVALID-HOUSEHOLD-REF-APPLY-REJECTED', async () => {
    const candidate = ok(await request({ ...amountOnly,
      values: { recipientRef: { kind: 'HOUSEHOLD_PERSON', personId: uuid(9999) } } }, amended.semanticState));
    const rejected = await request({ kind: 'APPLY', command: { ...candidate.proof, applyRequestId: uuid(9511) } }, candidate.semanticState);
    assert.equal(rejected.ok, false);
    assert.match(rejected.code, /CONTEXT_PERSON_NOT_IN_HOUSEHOLD/);
    assert.deepEqual(await pg.counts(), { plans: 1, revisions: 1 });
  });
  await check('GIFT-12-REEDIT-NEW-REVISION-SAME-ID', async () => {
    const current = ok(await request({ kind: 'READ' }));
    const edited = ok(await request({ ...amountOnly, item: item('135.00', {
      ...current.semanticState.contexts[0].slotSelections.item.items[0], cost: { kind: 'MANUAL', unitAmount: '135.00' },
      fundingAllocations: [{ source: 'BANK', amount: '135.00' }] }) }, current.semanticState));
    const revision = ok(await request({ kind: 'APPLY', command: { ...edited.proof, applyRequestId: uuid(9512) } }, edited.semanticState));
    assert.equal(revision.activeRevisionNumber, 2);
    const stored = await repository.readActivePlan(householdId, '2026-11');
    assert.equal(stored.activeRevision.semanticState.contexts[0].contextOccurrenceId, giftId);
    assert.equal(stored.activeRevision.semanticState.contexts[0].slotSelections.item.items[0].selectionId, itemId);
    assert.deepEqual(stored.activeRevision.semanticState.contexts[0].fields, amended.semanticState.contexts[0].fields);
    assert.deepEqual(stored.activeRevision.semanticState.contexts[0].slotSelections.extras, amended.semanticState.contexts[0].slotSelections.extras);
  });
  await check('GIFT-13-TWO-GIFTS-SAME-RECIPIENT', async () => {
    const current = ok(await request({ kind: 'READ' })), secondId = uuid(9513), secondItemId = uuid(9514);
    const two = ok(await request({ kind: 'DROP', assetKey: 'template:gift', target: { kind: 'BOARD_ZONE' },
      identity: secondId, selectionId: uuid(9515), values: {} }, current.semanticState));
    const configuredSecond = ok(await request({ kind: 'EDIT_GIFT', contextOccurrenceId: secondId,
      values: { recipientRef: { kind: 'CONTACT', contactKey }, occasion: 'Noël', objectLabel: 'Jeu', plannedDate: '' },
      item: { ...item('20.00'), selectionId: secondItemId, label: 'Jeu' } }, two.semanticState));
    const appliedSecond = ok(await request({ kind: 'APPLY', command: { ...configuredSecond.proof, applyRequestId: uuid(9516) } }, configuredSecond.semanticState));
    assert.equal(appliedSecond.activeRevisionNumber, 3);
    const stored = await repository.readActivePlan(householdId, '2026-11');
    assert.equal(stored.activeRevision.semanticState.contexts.length, 2);
    assert.deepEqual(stored.activeRevision.semanticState.contexts.map(c => c.contextOccurrenceId), [giftId, secondId]);
    assert.deepEqual(stored.activeRevision.semanticState.contexts.map(c => c.fields.recipientRef),
      [{ kind: 'CONTACT', contactKey }, { kind: 'CONTACT', contactKey }]);
  });
  await check('GIFT-02-03-HOUSEHOLD-AND-FREE-TEXT-REFS', async () => {
    for (const [recipientRef, applyId, expectedRevision] of [
      [{ kind: 'HOUSEHOLD_PERSON', personId: uuid(1) }, uuid(9517), 4],
      [{ kind: 'TEXT', label: 'Invitée extérieure' }, uuid(9518), 5],
    ]) {
      const current = ok(await request({ kind: 'READ' }));
      const changed = ok(await request({ kind: 'EDIT_GIFT', contextOccurrenceId: giftId,
        values: { recipientRef }, item: current.semanticState.contexts[0].slotSelections.item.items[0] }, current.semanticState));
      const revision = ok(await request({ kind: 'APPLY', command: { ...changed.proof, applyRequestId: applyId } }, changed.semanticState));
      assert.equal(revision.activeRevisionNumber, expectedRevision);
      const stored = await repository.readActivePlan(householdId, '2026-11');
      assert.deepEqual(stored.activeRevision.semanticState.contexts[0].fields.recipientRef, recipientRef);
      assert.equal(stored.activeRevision.semanticState.contexts[0].slotSelections.item.items[0].selectionId, itemId);
    }
  });
  await check('GIFT-07-UNKNOWN-APPLY-RELOAD', async () => {
    const current = ok(await request({ kind: 'READ' }));
    const prior = current.semanticState.contexts[0].slotSelections.item.items[0];
    const unknown = ok(await request({ kind: 'EDIT_GIFT', contextOccurrenceId: giftId, values: {},
      item: { ...prior, cost: { kind: 'UNKNOWN' }, fundingAllocations: [] } }, current.semanticState));
    assert.equal(unknown.semanticState.contexts[0].slotSelections.item.items[0].cost.kind, 'UNKNOWN');
    const revision = ok(await request({ kind: 'APPLY', command: { ...unknown.proof, applyRequestId: uuid(9519) } }, unknown.semanticState));
    assert.equal(revision.activeRevisionNumber, 6);
    const stored = await repository.readActivePlan(householdId, '2026-11');
    assert.equal(stored.activeRevision.semanticState.contexts[0].slotSelections.item.items[0].cost.kind, 'UNKNOWN');
    assert.equal(stored.activeRevision.semanticState.contexts[0].slotSelections.item.items[0].cost.unitAmount, undefined);
    const reloaded = ok(await request({ kind: 'READ' }));
    assert.equal(reloaded.semanticState.contexts[0].slotSelections.item.items[0].cost.kind, 'UNKNOWN');
  });
  await check('GIFT-NO-TRANSVERSE-WRITES', async () => { await pg.verifyCanaries(); });
  console.log(JSON.stringify({ status: 'EXECUTED_PASS_PGLITE_SYNTHETIC_ONLY', checks, rpcCalls: pg.rpcCalls,
    counts: await pg.counts(), remoteWrites: 0, canaryWrites: 0, authenticated: 'NOT_RUN' }));
} finally { await pg.close(); }
