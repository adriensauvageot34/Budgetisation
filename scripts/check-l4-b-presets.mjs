import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { fixture, state, uuid, householdId } from './fixtures/planner-headless.mjs';

const { COMPOSER_PRESETS, presetForContext } = require('@/domain/phase2/planner/composer-presets');
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { stageLocalDecision } = require('@/app/mois-a-venir/composer/local-draft');
const { parsePlanSemanticState, semanticStateDigest } = require('@/domain/phase2/planner/semantic-state');
const { publishContextRegistry } = require('@/server/phase2/planner/context-registry');
const { guidedContextShape } = require('@/domain/phase2/planner/guided-context-edit');

globalThis.fetch = async () => { throw Error('L4B_REMOTE_FORBIDDEN'); };
const pg = await createKernelPostgres();
const world = fixture(), unchangedWorld = structuredClone(world);
const deps = { repository: createPlanApplyRepository(pg.client), readWorld: async () => world,
  readDirectWorld: async () => ({ forecast: world.forecast, monthInputs: world.monthInputs,
    externalIntents: world.externalIntents, asOfDate: world.asOfDate }), householdPersons: [] };
const editorFor = key => ['restaurant','fast-food','delivery','activity','purchase'].includes(key) ? 'restaurant-editor'
  : key === 'night-out' ? 'night-out-workshop' : key === 'gift' ? 'gift-editor'
    : key === 'family-visit' ? 'family-visit-editor' : key === 'short-stay' ? 'short-stay-editor' : 'catalog-context-editor';
const scenarioFor = preset => {
  switch (preset.templateKey) {
    case 'night-out': return ['friends-evening','home-evening'].includes(preset.presetKey) ? 'S2' : 'S1';
    case 'activity': return ['hiking-nature','beach-day','fishing-day'].includes(preset.presetKey) ? 'A2' : 'A1';
    case 'restaurant': return 'R1'; case 'fast-food': return 'R2'; case 'delivery': return 'R3';
    case 'family-visit': case 'friend-visit': return 'V1'; case 'short-stay': return 'W1';
    case 'gift': return 'P3'; case 'beauty-restock': return 'B1';
    case 'purchase': return preset.categoryKey === 'HOME' ? 'M1' : ['amazon-purchase','shein-purchase','aliexpress-purchase'].includes(preset.presetKey) ? 'P2' : 'P1';
    default: throw Error(`Unexpected preset template: ${preset.templateKey}`);
  }
};
const rows = [];
let sequence = 0;
const request = (operation, draft) => handleComposerRequest(deps, householdId,
  { sequence: ++sequence, targetMonth: '2026-11', draft, ...operation });
const accepted = response => { assert.equal(response.ok, true, `${response.code}: ${response.message}`); return response.model; };

try {
  assert.equal(COMPOSER_PRESETS.length, 47);
  assert.equal(new Set(COMPOSER_PRESETS.map(preset => preset.presetKey)).size, 47);
  for (const [index, preset] of COMPOSER_PRESETS.entries()) {
    const original = state(), contextOccurrenceId = uuid(49000 + index), selectionId = uuid(50000 + index);
    const initial = accepted(await request({ kind: 'READ' }, original));
    const drop = { kind: 'DROP', assetKey: `template:${preset.templateKey}`, presetKey: preset.presetKey,
      target: { kind: 'BOARD_ZONE' }, identity: contextOccurrenceId, selectionId, values: {} };
    const added = accepted(await request(drop, original));
    assert.deepEqual(stageLocalDecision(initial, original, drop), added.semanticState, preset.presetKey);
    const created = added.semanticState.contexts.find(context => context.contextOccurrenceId === contextOccurrenceId);
    assert.ok(created, preset.presetKey);
    assert.equal(presetForContext(created)?.presetKey, preset.presetKey);
    assert.equal(created.fields.plannedDate, undefined);
    assert.equal(created.fields.placeRef, undefined);
    assert.equal(!!created.slotSelections.item?.items?.some(item => item.kind === 'COMPONENT'), false);
    assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(added.semanticState))), added.semanticState);

    const edit = { kind: 'EDIT_CONTEXT', contextOccurrenceId, values: { label: `Intention ${index + 1}` } };
    const edited = accepted(await request(edit, added.semanticState));
    assert.equal(edited.semanticState.contexts.find(context => context.contextOccurrenceId === contextOccurrenceId).fields.label,
      `Intention ${index + 1}`);
    assert.equal(presetForContext(edited.semanticState.contexts.find(context => context.contextOccurrenceId === contextOccurrenceId))?.presetKey,
      preset.presetKey);
    const serialized = JSON.parse(JSON.stringify(edited.semanticState));
    assert.equal(semanticStateDigest(parsePlanSemanticState(serialized)), semanticStateDigest(edited.semanticState));
    const reread = accepted(await request({ kind: 'READ' }, parsePlanSemanticState(serialized)));
    assert.deepEqual(reread.semanticState, edited.semanticState);
    const shape = ['restaurant','fast-food','delivery','activity','purchase'].includes(preset.templateKey)
      ? guidedContextShape(preset.templateKey) : null;
    // Exercise the actual published component writer for every preset, then edit
    // only its price. The immutable C0 round-trip runs on synthetic PGlite.
    const definition = publishContextRegistry().templates.find(template => template.templateKey === preset.templateKey);
    const socket = definition.componentSlots.find(slot => slot.options.some(option => option.kind === 'COMPONENT'));
    const option = socket.options.find(option => option.kind === 'COMPONENT');
    const equip = { kind: 'DROP', assetKey: 'option:' + preset.templateKey + ':' + socket.slotKey + ':' + option.optionKey,
      target: { kind: 'CONTEXT_SOCKET', contextOccurrenceId, slotKey: socket.slotKey }, identity: uuid(51000 + index),
      selectionId: uuid(52000 + index), values: { label: 'Poste synthétique', quantity: '2', unitBasis: 'ITEM', amount: '6' } };
    const equipped = accepted(await request(equip, reread.semanticState));
    const priced = accepted(await request({ ...equip, values: { ...equip.values, amount: '7' } }, equipped.semanticState));
    const currentContext = priced.semanticState.contexts.find(context => context.contextOccurrenceId === contextOccurrenceId);
    const line = currentContext.slotSelections[socket.slotKey].items[0];
    assert.equal(line.selectionId, equip.selectionId);
    assert.equal(line.cost.unitAmount, '7');
    assert.equal(line.quantity, '2');
    assert.deepEqual(currentContext.fields, equipped.semanticState.contexts.find(context => context.contextOccurrenceId === contextOccurrenceId).fields);
    const applied = accepted(await request({ kind: 'APPLY', command: { ...priced.proof, applyRequestId: uuid(53000 + index) } }, priced.semanticState));
    const persisted = await deps.repository.readActivePlan(householdId, '2026-11');
    assert.deepEqual(persisted.activeRevision.semanticState, priced.semanticState);
    assert.deepEqual(accepted(await request({ kind: 'READ' })).semanticState, priced.semanticState);
    assert.equal(applied.activeRevisionNumber, index + 1);
    rows.push({ presetKey: preset.presetKey, templateKey: preset.templateKey, scenario: scenarioFor(preset),
      editor: editorFor(preset.templateKey), mainSlot: shape?.slot ?? null,
      create: 'EXECUTED_PASS_PGLITE', editLabel: 'EXECUTED_PASS_PGLITE', serializeReload: 'EXECUTED_PASS_PGLITE',
      priceAndEquipment: 'EXECUTED_PASS_PGLITE', applyReload: 'EXECUTED_PASS_PGLITE_SYNTHETIC_ONLY', browser: 'NOT_RUN_THIS_MATRIX', authenticated: 'NOT_RUN' });
    console.log(`${preset.presetKey} ${scenarioFor(preset)} CONTRACT_PASS`);
  }
  assert.deepEqual(world, unchangedWorld);
  mkdirSync('docs/status/evidence/l4-b-all-assets', { recursive: true });
  writeFileSync('docs/status/evidence/l4-b-all-assets/preset-matrix.json',
    JSON.stringify({ environment: 'PGLITE_SYNTHETIC_ONLY', count: rows.length, realWrites: 0, rows }, null, 2) + '\n');
  console.log('L4B-47-PRESET-CREATE-EDIT-SERIALIZE-RELOAD PASS_PGLITE_SYNTHETIC_ONLY');
} finally { await pg.db.close(); }
