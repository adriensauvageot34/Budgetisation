import assert from 'node:assert/strict';
import fs from 'node:fs';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { visualMonth } from './fixtures/planner-visual-fidelity.mjs';
import { householdId } from './fixtures/planner-headless.mjs';
import { providers } from './fixtures/planner-mobility.mjs';

const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { preparePlanningMobility } = require('@/server/phase2/planner/prospective-mobility-pricing');
const { ComposerBoard } = require('@/app/mois-a-venir/composer/composer-board');
const { composePresentationNodes } = require('@/app/mois-a-venir/composer/presentation/adapter');
const { visibleEmptySocketKeys } = require('@/app/mois-a-venir/composer/presentation/socket-visibility');
const { equipmentGroups } = require('@/app/mois-a-venir/composer/presentation/palette-groups');
const { preparedDrop, publishedDrop } = require('@/app/mois-a-venir/composer/interactions');
const pg = await createKernelPostgres(), fixture = visualMonth(), owner = providers(), passed = [];
globalThis.fetch = async () => { throw new Error('R6_P3_REMOTE_NETWORK_FORBIDDEN'); };
const deps = { repository: createPlanApplyRepository(pg.client), readWorld: async () => fixture.world,
  prepareWorld: (world, state) => preparePlanningMobility(world, state, owner.value) };
const noop = () => {};
const props = { busy: false, selected: null, focused: null, focus: noop, edit: noop, editContext: noop, choose: noop,
  drag: noop, drop: noop, request: noop, hover: noop, add: noop, preview: noop, balance: noop, details: noop };
const check = (id, fn) => { fn(); passed.push(id); console.log(`${id} PASS`); };
try {
  const response = await handleComposerRequest(deps, householdId, { kind: 'READ', sequence: 1, targetMonth: '2026-11', draft: fixture.semantic });
  assert.equal(response.ok, true, response.code);
  const model = response.model, before = JSON.stringify(model);
  const night = model.board.contexts.find(card => card.templateKey === 'night-out');
  const weekend = model.board.contexts.find(card => card.templateKey === 'short-stay');
  const html = focused => renderToStaticMarkup(React.createElement(ComposerBoard, { ...props, model, focused }));
  const emptyCount = source => (source.match(/data-empty="true"/g) ?? []).length;
  check('R6-P3-001', () => { for (const card of model.board.contexts) assert.equal(visibleEmptySocketKeys(card, model, 'REST').size, 0);
    assert.equal(emptyCount(html(null)), 0); });
  check('R6-P3-002', () => { for (const card of model.board.contexts) assert.ok(visibleEmptySocketKeys(card, model, 'SELECTED').size <= 2);
    assert.equal(visibleEmptySocketKeys(night, model, 'SELECTED').size, 1); assert.equal(emptyCount(html(night.contextOccurrenceId)), 1); });
  check('R6-P3-003', () => { const dragged = 'option:night-out:food:restaurant';
    assert.ok(visibleEmptySocketKeys(night, model, 'DRAGGING', dragged).has('food'));
    for (const card of [night, weekend]) for (const socket of card.sockets) {
      const groups = equipmentGroups(card, model), keys = groups.flatMap(group => group.entries.filter(entry => entry.socket.slotKey === socket.slotKey).map(entry => entry.option.assetKey));
      assert.deepEqual(keys, model.presentation.sockets[`${card.contextOccurrenceId}:${socket.slotKey}`].options.map(option => option.assetKey));
    } });
  check('R6-P3-004', () => assert.deepEqual(equipmentGroups(night, model).map(group => group.title), ['Avant', 'Moment', 'Repas', 'Aller / retour', 'Compléments']));
  check('R6-P3-005', () => assert.deepEqual(equipmentGroups(weekend, model).map(group => group.title), ['Hébergement', 'Courses', 'Repas', 'Activités', 'Achats', 'Transport']));
  check('R6-P3-006', () => { const food = equipmentGroups(night, model).find(group => group.key === 'meal');
    assert.ok(food.entries.length > new Set(food.entries.map(entry => model.library.searchableAssets.find(asset => asset.assetKey === entry.option.assetKey).label)).size,
      'same visible label still identifies distinct published assets');
    assert.equal(new Set(food.entries.map(entry => `${entry.socket.slotKey}:${entry.option.assetKey}`)).size, food.entries.length); });
  check('R6-P3-007', () => { const key = Object.keys(model.presentation.dragSources).find(key => key.includes(`satellite:${night.contextOccurrenceId}:outbound:`));
    const source = model.presentation.dragSources[key], target = { kind: 'CONTEXT_SOCKET', contextOccurrenceId: night.contextOccurrenceId, slotKey: 'return' };
    assert.ok(source.selection && source.sourceSocket); assert.ok(publishedDrop(model, source.assetKey, target));
    const operation = preparedDrop(source, target, 'gesture-id', 'new-selection-id');
    assert.deepEqual(operation.sourceSocket, source.sourceSocket); assert.equal(operation.selectionId, source.selection.selectionId);
    assert.equal(operation.values.targetIntentId, source.selection.journey?.targetIntentId ?? ''); });
  check('R6-P3-008', () => { const target = { kind: 'CONTEXT_SOCKET', contextOccurrenceId: night.contextOccurrenceId, slotKey: 'outbound' };
    const car = model.presentation.dragSources['option:night-out:outbound:car'];
    assert.ok(publishedDrop(model, car.assetKey, target));
    const operation = preparedDrop(car, target, 'replace-id', 'car-id');
    assert.equal(operation.kind, 'DROP'); assert.equal(operation.target.slotKey, 'outbound');
    assert.equal(operation.assetKey, car.assetKey); });
  check('R6-P3-009', () => { const source = model.presentation.dragSources[`context-occurrence:${night.contextOccurrenceId}`];
    assert.equal(source.removeOperation.kind, 'DROP'); assert.equal(source.removeOperation.target.kind, 'TRASH'); });
  check('R6-P3-010', () => { const key = Object.keys(model.presentation.dragSources).find(key => key.includes(`satellite:${night.contextOccurrenceId}:outbound:`));
    assert.equal(model.presentation.dragSources[key].removeOperation.kind, 'CLEAR_SOCKET'); });
  check('R6-P3-012', () => { const beauty = composePresentationNodes(model).find(node => node.kind === 'CLUSTER' && node.family === 'BEAUTY');
    const childContext = beauty.children.find(child => child.context);
    assert.equal(model.presentation.dragSources[`context-occurrence:${childContext.id}`].removeOperation.target.kind, 'TRASH'); });
  check('R6-P3-013', () => { const beauty = composePresentationNodes(model).find(node => node.kind === 'CLUSTER' && node.family === 'BEAUTY');
    const removed = new Set(beauty.children.slice(0, 3).map(child => child.id));
    const board = { ...model.board, contexts: model.board.contexts.filter(card => !removed.has(card.contextOccurrenceId)),
      baselineControls: model.board.baselineControls.filter(card => !removed.has(card.targetRef)),
      discretionaryControls: model.board.discretionaryControls.filter(card => !removed.has(card.targetRef)),
      savings: model.board.savings.filter(card => !removed.has(card.targetRef)) };
    const after = composePresentationNodes({ ...model, board });
    assert.ok(!after.some(node => node.kind === 'CLUSTER' && node.family === 'BEAUTY'));
    assert.equal(after.filter(node => beauty.children.some(child => child.id === node.id)).length, 2);
    assert.equal(JSON.stringify(model), before, 'dissolution is only a projection'); });
  check('R6-P3-014', () => assert.equal(JSON.stringify(model), before, 'rendering and popover markup do not mutate published state'));
  check('R6-P3-016', () => { for (const name of ['context-card.tsx', 'context-socket.tsx', 'context-satellite.tsx', 'context-palette.tsx']) {
    const source = fs.readFileSync(`src/app/mois-a-venir/composer/${name}`, 'utf8');
    assert.ok(!/new Big|parseFloat|\.reduce\(|\.plus\(|\.minus\(/u.test(source), name);
  } });
  await pg.verifyCanaries(); assert.deepEqual(await pg.counts(), { plans: 0, revisions: 0 }); assert.equal(pg.rpcCalls, 0);
  console.log(JSON.stringify({ status: 'PASS', passed, remoteWrites: 0, dbWrites: 0 }));
} finally { await pg.close(); }
