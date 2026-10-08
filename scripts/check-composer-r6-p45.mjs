import assert from 'node:assert/strict';
import fs from 'node:fs';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { visualMonth, visualThreeBeautyMonth } from './fixtures/planner-visual-fidelity.mjs';
import { householdId } from './fixtures/planner-headless.mjs';
import { providers } from './fixtures/planner-mobility.mjs';

const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { preparePlanningMobility } = require('@/server/phase2/planner/prospective-mobility-pricing');
const { inventoryItems, inventoryLayoutPages, inventoryColumns } = require('@/app/mois-a-venir/composer/inventory-layout');
const { controlDensity, contextDensity, semanticRank } = require('@/app/mois-a-venir/composer/presentation/adapter');
const { iconRegistry, resolveVisualIcon } = require('@/app/mois-a-venir/composer/planner-icons/icon-registry');
const base = 'src/app/mois-a-venir/composer/';
const read = name => fs.readFileSync(`${base}${name}`,'utf8');
const pg = await createKernelPostgres(), owner = providers(), passed = [];
globalThis.fetch = async () => { throw Error('R6_P45_REMOTE_NETWORK_FORBIDDEN'); };
const check = (id, fn) => { fn(); passed.push(id); console.log(`${id} PASS`); };
const modelFor = async fixture => {
  const response = await handleComposerRequest({ repository:createPlanApplyRepository(pg.client), readWorld:async()=>fixture.world,
    prepareWorld:(world,state)=>preparePlanningMobility(world,state,owner.value) }, householdId,
    { kind:'READ', sequence:1, targetMonth:'2026-11', draft:fixture.semantic });
  assert.equal(response.ok,true,response.code); return response.model;
};
try {
  const model = await modelFor(visualMonth()), three = await modelFor(visualThreeBeautyMonth());
  const before = JSON.stringify(model), nodes = inventoryItems(model), threeNodes = inventoryItems(three);
  const css = read('composer.module.css'), board = read('board-carousel.tsx'), context = read('context-card.tsx');
  const layouts = [[1330,760],[1320,600],[1070,600]].map(([w,h]) => ({w,h,pages:inventoryLayoutPages(nodes,w,h)}));
  const clusters = nodes.filter(node=>node.kind==='CLUSTER');
  check('R6-P45-001',()=>assert.ok(nodes.every(node=>['SPARSE','NORMAL','RICH'].includes(node.density))));
  check('R6-P45-002',()=>assert.ok(nodes.filter(node=>node.density==='SPARSE').every(node=>node.height<=142)));
  check('R6-P45-003',()=>assert.ok(nodes.every(node=>['DAILY','MOMENTS','PERSONAL_CARE','FOOD','SAVINGS','HOME','PURCHASES','OTHER'].includes(node.spatialFamily))));
  check('R6-P45-004',()=>assert.deepEqual(inventoryItems(model),nodes));
  check('R6-P45-005',()=>{assert.doesNotMatch(JSON.stringify(model.semanticState),/"(?:x|y|uiPosition|boardPosition)"\s*:/);assert.doesNotMatch(board,/localStorage|sessionStorage/);});
  check('R6-P45-006',()=>{const ids=new Set(nodes.map(node=>node.id));for(const cluster of clusters)for(const child of cluster.children)assert.ok(!ids.has(child.id));});
  check('R6-P45-007',()=>assert.match(context,/data-context-equipment-row/));
  check('R6-P45-008',()=>assert.doesNotMatch(context,/orbitGrid|orbitGroup|data-orbit/));
  check('R6-P45-009',()=>{const childIds=threeNodes.find(node=>node.kind==='CLUSTER'&&node.family==='BEAUTY').children.map(node=>node.id);assert.equal(new Set(childIds).size,3);});
  check('R6-P45-010',()=>{const ids=new Set(threeNodes.map(node=>node.id));assert.ok(ids.has('cluster:beauty'));assert.ok(!threeNodes.some(node=>node.kind==='CLUSTER'&&node.children.length<3));});
  check('R6-P45-011',()=>assert.match(board,/prefers-reduced-motion: reduce/));
  check('R6-P45-012',()=>assert.match(board,/dragging \? stableItems\.current : projected/));
  check('R6-P45-013',()=>assert.equal(JSON.stringify(model),before));
  check('R6-P45-014',()=>assert.match(read('comparison.ts'),/finishComparison/));
  check('R6-P45-015',()=>assert.match(read('composer-cockpit.tsx'),/knowledge|—/));
  check('R6-P45-016',()=>assert.match(context,/preferences\.flexibility\[card\.contextOccurrenceId\]/));
  check('R6-P45-017',()=>{for(const node of nodes)assert.ok(resolveVisualIcon(node.iconKey,node.id));assert.ok(iconRegistry.gift&&iconRegistry.family);});
  check('R6-P45-018',()=>assert.doesNotMatch(read('presentation/adapter.ts'),/label\.includes|label\.match|label\.startsWith/));
  check('R6-P45-019',()=>{for(const name of ['composer-library.tsx','context-card.tsx','context-satellite.tsx'])assert.match(read(name),/onKeyDown|onClick|button/);});
  check('R6-P45-020',()=>{for(const name of ['presentation/adapter.ts','board-carousel.tsx'])assert.doesNotMatch(read(name),/new Big|parseFloat\([^)]*amount|\.plus\(|\.minus\(/);});
  check('R6-P45-021',()=>assert.doesNotMatch(read('presentation/adapter.ts')+board,/readWorld|fetch\(/));
  check('R6-P45-022',()=>assert.equal(pg.rpcCalls,0));
  check('R6-P45-023',()=>{for(const {w,h,pages} of layouts){assert.ok(pages.length);for(const page of pages)for(const p of page){assert.ok(p.column+p.columnSpan-1<=inventoryColumns(w));assert.ok((p.row+p.rowSpan-1)*10-5<=h+5);}}});
  check('R6-P45-024',()=>assert.ok(layouts.find(x=>x.w===1320).pages.length>=1));
  check('R6-P45-025',()=>assert.ok(layouts.find(x=>x.w===1070).pages.length>1));
  check('R6-P45-026',()=>{const page=layouts[0].pages[0];assert.ok(new Set(page.map(p=>p.rowSpan)).size>1);assert.ok(new Set(page.map(p=>p.columnSpan)).size>1);});
  check('R6-P45-027',()=>assert.match(css,/\.library\s*\{/));
  check('R6-P45-028',()=>assert.match(css,/scroll-snap-type:x proximity/));
  check('R6-P45-029',()=>assert.match(css,/:focus-visible\s*\{\s*outline:3px/));
  check('R6-P45-030',()=>{assert.ok(clusters.length>=2);assert.match(css,/\.visualCluster/);assert.match(css,/\.contextEquipmentRow/);});
  for(const control of model.board.baselineControls)assert.ok(controlDensity(control,model));
  for(const card of model.board.contexts)assert.ok(contextDensity(card,model));
  assert.ok(nodes.every((node,index)=>!index||semanticRank(nodes[index-1])<=semanticRank(node)));
  await pg.verifyCanaries(); assert.deepEqual(await pg.counts(),{plans:0,revisions:0});
  console.log(JSON.stringify({status:'PASS',checks:passed.length,remoteCalls:0,dbWrites:0}));
} finally { await pg.close(); }
