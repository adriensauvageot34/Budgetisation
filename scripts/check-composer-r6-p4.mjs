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
const { visibleEmptySocketKeys } = require('@/app/mois-a-venir/composer/presentation/socket-visibility');
const { inventoryItems, inventoryPages } = require('@/app/mois-a-venir/composer/inventory-layout');
const { iconRegistry, resolveVisualIcon } = require('@/app/mois-a-venir/composer/planner-icons/icon-registry');
const { finishComparison } = require('@/app/mois-a-venir/composer/comparison');
const base = 'src/app/mois-a-venir/composer/';
const read = name => fs.readFileSync(`${base}${name}`, 'utf8');
const pg = await createKernelPostgres(), fixture = visualMonth(), owner = providers(), passed = [];
globalThis.fetch = async () => { throw new Error('R6_P4_REMOTE_NETWORK_FORBIDDEN'); };
const deps = { repository: createPlanApplyRepository(pg.client), readWorld: async () => fixture.world,
  prepareWorld: (world, state) => preparePlanningMobility(world, state, owner.value) };
const check = (id, fn) => { fn(); passed.push(id); console.log(`${id} PASS`); };
try {
  const response = await handleComposerRequest(deps, householdId, { kind:'READ', sequence:1, targetMonth:'2026-11', draft:fixture.semantic });
  assert.equal(response.ok, true, response.code);
  const model = response.model, before = JSON.stringify(model);
  const night = model.board.contexts.find(card => card.templateKey === 'night-out');
  const weekend = model.board.contexts.find(card => card.templateKey === 'short-stay');
  const source = read('context-card.tsx'), css = read('composer.module.css');
  const nodes = inventoryItems(model), pages = (width,height) => inventoryPages(nodes,width,height);
  check('R6-P4-001', () => { assert.match(source,/data-context-equipment-row/); assert.match(source,/sockets\.map\(socket/); assert.doesNotMatch(source,/orbitGrid|orbitGroup|data-orbit/); });
  check('R6-P4-002', () => { for (const card of [night,weekend]) assert.equal(visibleEmptySocketKeys(card,model,'REST').size,0); });
  check('R6-P4-003', () => { for (const card of [night,weekend]) assert.ok(visibleEmptySocketKeys(card,model,'SELECTED').size<=1); });
  check('R6-P4-004', () => { for (const card of [night,weekend]) for (const socket of card.sockets) {
    const view=model.presentation.sockets[`${card.contextOccurrenceId}:${socket.slotKey}`];
    assert.ok(view); assert.equal(view.satellites.length,socket.currentItems.length);
    for (const item of socket.currentItems) assert.ok(view.satellites.some(s=>s.selectionId===item.selectionId));
  } assert.match(source,/remove=\{item => request/); assert.match(source,/accept=\{item => request/); });
  check('R6-P4-005', () => { assert.equal(JSON.stringify(model),before); assert.deepEqual([...night.sockets.map(s=>s.slotKey)].sort(),[...model.board.contexts.find(c=>c.contextOccurrenceId===night.contextOccurrenceId).sockets.map(s=>s.slotKey)].sort()); });
  check('R6-P4-006', () => { for (const cluster of nodes.filter(n=>n.kind==='CLUSTER')) { assert.equal(cluster.amount,null); assert.ok(cluster.children.length>=3); } });
  check('R6-P4-007', () => { const ids=new Set(nodes.map(n=>n.id)); for (const cluster of nodes.filter(n=>n.kind==='CLUSTER')) for (const child of cluster.children) assert.ok(!ids.has(child.id),child.id); });
  check('R6-P4-008', () => { assert.ok(nodes.some(n=>n.kind==='CLUSTER')); assert.ok(nodes.some(n=>n.kind==='CONTEXT')); assert.ok(nodes.some(n=>n.kind==='CONTROL'&&n.control.kind==='SAVINGS'));
    for (const selector of ['.card[data-variant=SIMPLE]','.contextCard','.visualCluster','.card[data-variant=SAVINGS]']) assert.ok(css.includes(selector),selector); });
  check('R6-P4-009', () => { assert.doesNotMatch(JSON.stringify(model.semanticState),/"(x|y|width|height|position)"\s*:/); assert.doesNotMatch(read('inventory-layout.ts'),/localStorage|sessionStorage/); });
  check('R6-P4-010', () => { assert.deepEqual(inventoryItems(model),nodes); assert.deepEqual(pages(1320,600),pages(1320,600)); });
  check('R6-P4-011', () => { for (const [width,height] of [[1330,760],[1320,600],[1070,600]]) for (const page of pages(width,height)) {
    const rowHeights=[]; let used=0,rowHeight=0; for (const node of page) { if (used&&used+10+node.width>width) {rowHeights.push(rowHeight);used=0;rowHeight=0;} used+=(used?10:0)+node.width;rowHeight=Math.max(rowHeight,node.height); } if (used)rowHeights.push(rowHeight);
    assert.ok(rowHeights.reduce((sum,h)=>sum+h,0)+10*Math.max(0,rowHeights.length-1)<=height);
  } });
  check('R6-P4-012', () => { const cockpit=before.match(/"cockpit":\{[^]*?\},"/)?.[0]; assert.ok(cockpit); assert.equal(JSON.stringify(model),before); assert.match(read('composer-cockpit.tsx'),/money\(/); });
  check('R6-P4-013', () => { const snapshot={model,past:[],future:[],suggestions:null}; assert.equal(finishComparison(snapshot,model,false),snapshot);
    assert.equal(finishComparison(snapshot,model,true).model,model); assert.deepEqual(finishComparison(snapshot,model,true).past,[]); });
  check('R6-P4-014', () => { assert.match(read('atomic-popover.tsx'),/aria-expanded/); assert.match(read('context-satellite.tsx'),/AtomicPopover/); assert.match(read('composer-library.tsx'),/onKeyDown|onClick/); });
  check('R6-P4-015', () => assert.match(css,/@media\s*\(prefers-reduced-motion:\s*reduce\)/));
  check('R6-P4-016', () => { for (const cluster of nodes.filter(n=>n.kind==='CLUSTER')) assert.equal(cluster.amount,null); assert.match(read('composer-cockpit.tsx'),/knowledge|money|—/); });
  check('R6-P4-017', () => { assert.match(source,/preferences\.flexibility\[card\.contextOccurrenceId\]/); assert.doesNotMatch(source,/variant\s*===\s*["']SAVINGS["']\s*\?\s*.*Lock/); });
  check('R6-P4-018', () => { for (const name of ['context-card.tsx','context-satellite.tsx','context-socket.tsx','atomic-popover.tsx','presentation/adapter.ts']) assert.doesNotMatch(read(name),/new Big|parseFloat\([^)]*amount|\.plus\(|\.minus\(/,name); });
  check('R6-P4-019', () => { for (const name of ['context-card.tsx','context-satellite.tsx','context-socket.tsx','atomic-popover.tsx','presentation/adapter.ts']) assert.doesNotMatch(read(name),/readWorld|fetch\(/,name); });
  check('R6-P4-020', () => { for (const node of nodes) assert.ok(resolveVisualIcon(node.iconKey,node.id)); assert.ok(iconRegistry.gift&&iconRegistry.family); assert.match(read('planner-icons/planner-icon.tsx'),/resolveVisualIcon/); });
  await pg.verifyCanaries(); assert.deepEqual(await pg.counts(),{plans:0,revisions:0}); assert.equal(pg.rpcCalls,0);
  console.log(JSON.stringify({status:'PASS',passed,remoteWrites:0,dbWrites:0}));
} finally { await pg.close(); }
