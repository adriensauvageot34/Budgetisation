import assert from 'node:assert/strict';
import fs from 'node:fs';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { visualMonth } from './fixtures/planner-visual-fidelity.mjs';
import { householdId } from './fixtures/planner-headless.mjs';
import { providers } from './fixtures/planner-mobility.mjs';

const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { preparePlanningMobility } = require('@/server/phase2/planner/prospective-mobility-pricing');
const { equipmentGroups, displayEquipmentGroups } = require('@/app/mois-a-venir/composer/presentation/palette-groups');
const { visibleEmptySocketKeys } = require('@/app/mois-a-venir/composer/presentation/socket-visibility');
const { inventoryItems, inventoryPages } = require('@/app/mois-a-venir/composer/inventory-layout');
const pg = await createKernelPostgres(), fixture = visualMonth(), owner = providers(), passed = [];
globalThis.fetch = async () => { throw new Error('R6_P35_REMOTE_NETWORK_FORBIDDEN'); };
const deps = { repository: createPlanApplyRepository(pg.client), readWorld: async () => fixture.world,
  prepareWorld: (world, state) => preparePlanningMobility(world, state, owner.value) };
const check = (id, fn) => { fn(); passed.push(id); console.log(`${id} PASS`); };
try {
  const response = await handleComposerRequest(deps, householdId, { kind: 'READ', sequence: 1, targetMonth: '2026-11', draft: fixture.semantic });
  assert.equal(response.ok, true, response.code);
  const model = response.model, digest = JSON.stringify(model);
  const night = model.board.contexts.find(card => card.templateKey === 'night-out');
  const weekend = model.board.contexts.find(card => card.templateKey === 'short-stay');
  const raw = card => equipmentGroups(card, model).flatMap(group => group.entries.map(entry => `${group.key}:${entry.socket.slotKey}:${entry.option.assetKey}`));
  const shown = card => displayEquipmentGroups(card, model).flatMap(group => group.tiles.flatMap(tile => tile.routes.map(route => `${group.key}:${route.socket.slotKey}:${route.option.assetKey}`)));
  check('R6-P35-001', () => { for (const card of [night, weekend]) for (const group of displayEquipmentGroups(card, model)) {
    assert.equal(new Set(group.tiles.map(tile => tile.visualKey)).size, group.tiles.length);
    assert.equal(new Set(group.tiles.map(tile => tile.routes[0].option.assetKey)).size, group.tiles.length);
  } });
  check('R6-P35-002', () => { for (const card of [night, weekend]) assert.deepEqual(shown(card).sort(), raw(card).sort());
    assert.equal(JSON.stringify(model), digest); });
  check('R6-P35-003', () => { const groups = displayEquipmentGroups(night, model);
    assert.equal(groups.find(group => group.key === 'meal').tiles.length, 3);
    assert.equal(groups.find(group => group.key === 'travel').tiles.length, 7);
    for (const tile of groups.flatMap(group => group.tiles).filter(tile => tile.routes.length > 1)) {
      assert.equal(new Set(tile.routes.map(route => `${route.socket.slotKey}:${route.option.assetKey}`)).size, tile.routes.length);
      assert.ok(tile.routes.every(route => model.presentation.dragSources[route.option.assetKey] ||
        model.library.searchableAssets.some(asset => asset.assetKey === route.option.assetKey)));
    }
    const source = fs.readFileSync('src/app/mois-a-venir/composer/context-palette.tsx','utf8');
    assert.ok(source.includes('multiple ? openChoices() : equip(first)'));
    assert.ok(source.includes('draggable={!busy && !multiple}'));
    assert.ok(source.includes('data-palette-route={route.asset.assetKey}'));
  });
  check('R6-P35-004', () => assert.equal(visibleEmptySocketKeys(night,model,'REST').size,0));
  check('R6-P35-005', () => assert.equal(visibleEmptySocketKeys(night,model,'SELECTED').size,1));
  check('R6-P35-006', () => { for (const card of [night, weekend]) for (const source of new Set(model.dropCapabilities.map(capability => capability.sourceAssetKey))) {
    const expected = card.sockets.filter(socket => model.dropCapabilities.some(capability => capability.sourceAssetKey === source &&
      capability.target.kind === 'CONTEXT_SOCKET' && capability.target.contextOccurrenceId === card.contextOccurrenceId &&
      capability.target.slotKey === socket.slotKey && capability.resolution !== 'BLOCKED')).map(socket => socket.slotKey);
    assert.deepEqual([...visibleEmptySocketKeys(card,model,'DRAGGING',source)].sort(), expected.sort());
  } });
  check('R6-P35-007', () => assert.equal(visibleEmptySocketKeys(weekend,model,'REST').size,0));
  check('R6-P35-008', () => assert.equal(visibleEmptySocketKeys(weekend,model,'SELECTED').size,1));
  const pages = inventoryPages(inventoryItems(model),1320,600), first = pages[0];
  check('R6-P35-009', () => { assert.ok(first.some(item => item.id === 'cluster:food')); assert.equal(inventoryItems(model).find(item => item.id === 'cluster:food').height,178); });
  check('R6-P35-010', () => { for (const template of ['gift','family-visit']) assert.ok(first.some(item => item.kind === 'CONTEXT' && item.context.templateKey === template && item.height === 178)); });
  check('R6-P35-011', () => { assert.equal(first.length,11); assert.ok(170+10+225+10+178 <= 600);
    assert.equal(inventoryPages(inventoryItems(model),1330,900)[0].length,17); });
  check('R6-P35-012', () => { assert.ok(inventoryPages(inventoryItems(model),1070,600).length > 1);
    const source=fs.readFileSync('src/app/mois-a-venir/composer/board-carousel.tsx','utf8');
    assert.ok(source.includes('data-single-page={pages.length === 1}')); });
  check('R6-P35-013', () => { const css=fs.readFileSync('src/app/mois-a-venir/composer/composer.module.css','utf8');
    assert.match(css,/\.paletteOptions\s*\{[^}]*overflow-x:auto/s); });
  check('R6-P35-014', () => { for (const name of ['context-palette.tsx','presentation/palette-groups.ts','board-carousel.tsx','inventory-layout.ts']) {
    const source=fs.readFileSync(`src/app/mois-a-venir/composer/${name}`,'utf8');
    assert.ok(!/readWorld|fetch\(|new Big|parseFloat\(.*amount|react-dnd|dnd-kit/.test(source),name);
  } });
  await pg.verifyCanaries(); assert.deepEqual(await pg.counts(), { plans:0, revisions:0 }); assert.equal(pg.rpcCalls,0);
  console.log(JSON.stringify({ status:'PASS', passed, remoteWrites:0, dbWrites:0 }));
} finally { await pg.close(); }
