import assert from 'node:assert/strict';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { fixture, state, uuid, householdId } from './fixtures/planner-headless.mjs';

const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { resolveEffectiveMonthScenario } = require('@/server/phase2/planner/effective-month-scenario');
const { previewPlanScenario } = require('@/server/phase2/planner/apply');
const { manifestContextRegistry, GIFT_ASSET_CONTEXT_REGISTRY_VERSION, CONTEXT_REGISTRY_VERSION } = require('@/server/phase2/planner/context-registry');
const { stageLocalDecision } = require('@/app/mois-a-venir/composer/local-draft');
const { AppliedMonthView } = require('@/app/mois-a-venir/applied-month-view');
const { PLANNED_ASSET_CATALOG_VERSION } = require('@/domain/phase2/planned-assets');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');

const pg = await createKernelPostgres(), world = fixture(), repository = createPlanApplyRepository(pg.client);
const deps = { repository, householdPersons: [{ personId: uuid(1), displayName: 'Alice Fixture' }],
  readWorld: async () => world, readDirectWorld: async () => ({ forecast: world.forecast, monthInputs: world.monthInputs,
    externalIntents: world.externalIntents, asOfDate: world.asOfDate }), validateContextReferences: async () => {} };
let sequence = 0;
const request = (operation, draft) => handleComposerRequest(deps, householdId,
  { sequence: ++sequence, targetMonth: '2026-11', draft, ...operation });
const ok = response => { assert.equal(response.ok, true, `${response.code}: ${response.message}`); return response.model; };
const checks = [], check = async (name, fn) => { await fn(); checks.push(name); console.log(`${name} PASS`); };
const giftId = uuid(9701), itemId = uuid(9702);
const assetRef = { catalogVersion: PLANNED_ASSET_CATALOG_VERSION, assetKey: 'gift:book', labelAtSelection: 'Livre',
  provenance: 'EXPLICIT_USER_DECISION' };
const item = amount => ({ selectionId: itemId, optionKey: 'gift', kind: 'COMPONENT', provenance: 'EXPLICIT_USER_DECISION',
  label: 'Roman dédicacé', quantity: '1', unitBasis: 'ITEM', cost: { kind: 'MANUAL', unitAmount: amount },
  fundingAllocations: [{ source: 'BANK', amount }] });
const clone = value => JSON.parse(JSON.stringify(value));
try {
  const initial = ok(await request({ kind: 'READ' }, state()));
  const dropped = ok(await request({ kind: 'DROP', assetKey: 'template:gift', target: { kind: 'BOARD_ZONE' },
    identity: giftId, selectionId: uuid(9703), values: {} }, initial.semanticState));
  const edit = { kind: 'EDIT_GIFT', contextOccurrenceId: giftId,
    values: { objectAssetRef: assetRef, objectLabel: 'Roman dédicacé', occasion: 'Anniversaire', plannedDate: '' }, item: item('80.00') };
  const configured = ok(await request(edit, dropped.semanticState));
  await check('GIFT04-EXPLICIT-CATALOG-IDENTITY', () => {
    assert.deepEqual(stageLocalDecision(dropped, dropped.semanticState, edit), configured.semanticState);
    assert.deepEqual(configured.semanticState.contexts[0].fields.objectAssetRef, assetRef);
    assert.equal(configured.semanticState.contexts[0].fields.objectLabel, 'Roman dédicacé');
    assert.equal(configured.semanticState.contexts[0].fields.fieldSchemaVersion, 'context-fields@v3');
    assert.equal(manifestContextRegistry(configured.semanticState).version, GIFT_ASSET_CONTEXT_REGISTRY_VERSION);
    assert.equal(configured.board.cockpit.economic.explicitContexts, '80.00');
  });
  const amountOnly = { kind: 'EDIT_GIFT', contextOccurrenceId: giftId, values: {}, item: item('90.00') };
  const amended = ok(await request(amountOnly, configured.semanticState));
  await check('GIFT04-PARTIAL-EDIT-UNDO-REDO', () => {
    assert.deepEqual(amended.semanticState.contexts[0].fields, configured.semanticState.contexts[0].fields);
    assert.deepEqual(stageLocalDecision(configured, configured.semanticState, amountOnly), amended.semanticState);
    assert.equal(configured.semanticState.contexts[0].slotSelections.item.items[0].cost.unitAmount, '80.00');
    assert.equal(amended.semanticState.contexts[0].slotSelections.item.items[0].selectionId, itemId);
  });
  const applied = ok(await request({ kind: 'APPLY', command: { ...amended.proof, applyRequestId: uuid(9704) } }, amended.semanticState));
  await check('GIFT04-APPLY-RELOAD-MON-PLAN', async () => {
    assert.equal(applied.activeRevisionNumber, 1);
    const stored = await repository.readActivePlan(householdId, '2026-11');
    assert.deepEqual(stored.activeRevision.semanticState.contexts[0].fields.objectAssetRef, assetRef);
    assert.deepEqual(ok(await request({ kind: 'READ' })).semanticState, amended.semanticState);
    const effective = await resolveEffectiveMonthScenario(deps, householdId, '2026-11');
    const html = renderToStaticMarkup(React.createElement(AppliedMonthView, { projection: effective.projection,
      semanticState: effective.semanticState, plan: null, revision: 1, today: world.asOfDate }));
    assert.match(html, /Achat · Cadeau · Livre/);
    assert.match(html, /Roman dédicacé/);
    assert.match(html, /90,00/);
  });
  await check('GIFT04-REEDIT-RETAINS-CLASSIFICATION', async () => {
    const current = ok(await request({ kind: 'READ' }));
    const edited = ok(await request({ kind: 'EDIT_GIFT', contextOccurrenceId: giftId,
      values: { objectLabel: 'Édition signée' }, item: { ...item('90.00'), label: 'Édition signée' } }, current.semanticState));
    assert.deepEqual(edited.semanticState.contexts[0].fields.objectAssetRef, assetRef);
    const next = ok(await request({ kind: 'APPLY', command: { ...edited.proof, applyRequestId: uuid(9705) } }, edited.semanticState));
    assert.equal(next.activeRevisionNumber, 2);
    const stored = await repository.readActivePlan(householdId, '2026-11');
    assert.deepEqual(stored.activeRevision.semanticState.contexts[0].fields.objectAssetRef, assetRef);
    assert.equal(stored.activeRevision.semanticState.contexts[0].fields.objectLabel, 'Édition signée');
    assert.equal(stored.activeRevision.semanticState.contexts[0].contextOccurrenceId, giftId);
  });
  await check('GIFT04-OLD-V2-NO-SILENT-INFERENCE', async () => {
    const old = clone(configured.semanticState);
    delete old.contexts[0].fields.objectAssetRef;
    old.contexts[0].fields.fieldSchemaVersion = 'context-fields@v2';
    old.contexts[0].fields.objectLabel = 'Livre';
    const model = ok(await request({ kind: 'READ' }, old));
    assert.equal(model.semanticState.contexts[0].fields.objectAssetRef, undefined);
    assert.equal(manifestContextRegistry(model.semanticState).version, CONTEXT_REGISTRY_VERSION);
  });
  await check('GIFT04-UNKNOWN-OLD-REFERENCE-EXPLICIT', async () => {
    const old = clone(configured.semanticState);
    old.contexts[0].fields.objectAssetRef.assetKey = 'gift:retired';
    const model = ok(await request({ kind: 'READ' }, old));
    assert.equal(model.semanticState.contexts[0].fields.objectAssetRef.assetKey, 'gift:retired');
    const changed = ok(await request({ kind: 'EDIT_GIFT', contextOccurrenceId: giftId, values: {}, item: item('90.00') }, model.semanticState));
    assert.equal(changed.semanticState.contexts[0].fields.objectAssetRef.assetKey, 'gift:retired');
    const preview = await previewPlanScenario(deps, householdId, changed.semanticState);
    const html = renderToStaticMarkup(React.createElement(AppliedMonthView, { projection: preview.projection,
      semanticState: changed.semanticState, plan: null, revision: 0, today: world.asOfDate }));
    assert.match(html, /Référence de catalogue indisponible · Livre \(gift:retired\)/);
  });
  await check('GIFT04-INVALID-NEW-REFERENCES-REJECTED', async () => {
    for (const candidate of [
      { ...assetRef, assetKey: 'gift:retired' }, { ...assetRef, assetKey: 'tech:phone' },
      { ...assetRef, catalogVersion: 'planned-assets@unknown' }, { ...assetRef, provenance: 'PERSONAL_SUGGESTION' },
      { ...assetRef, labelAtSelection: 'Téléphone' },
    ]) {
      const rejected = await request({ ...edit, values: { objectAssetRef: candidate } }, configured.semanticState);
      assert.equal(rejected.ok, false);
    }
    assert.deepEqual(await pg.counts(), { plans: 1, revisions: 2 });
  });
  await check('GIFT04-EXPLICIT-CLEAR-NO-INFERENCE', async () => {
    const current = ok(await request({ kind: 'READ' }));
    const cleared = ok(await request({ kind: 'EDIT_GIFT', contextOccurrenceId: giftId,
      values: { objectAssetRef: '', objectLabel: 'Livre' }, item: { ...item('90.00'), label: 'Livre' } }, current.semanticState));
    assert.equal(cleared.semanticState.contexts[0].fields.objectAssetRef, undefined);
    assert.equal(cleared.semanticState.contexts[0].fields.objectLabel, 'Livre');
    assert.equal(cleared.semanticState.contexts[0].fields.fieldSchemaVersion, 'context-fields@v3');
  });
  await check('GIFT04-NO-TRANSVERSE-WRITES', async () => { await pg.verifyCanaries(); });
  console.log(JSON.stringify({ status: 'EXECUTED_PASS_PGLITE_SYNTHETIC_ONLY', checks,
    counts: await pg.counts(), rpcCalls: pg.rpcCalls, remoteWrites: 0, canaryWrites: 0, authenticated: 'NOT_RUN' }));
} finally { await pg.close(); }
