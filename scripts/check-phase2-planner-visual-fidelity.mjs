import assert from 'node:assert/strict';
import fs from 'node:fs';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {visualMonth,sparseMonth} from './fixtures/planner-visual-fidelity.mjs';
import {householdId} from './fixtures/planner-headless.mjs';
import {providers} from './fixtures/planner-mobility.mjs';
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {readMonthComposer}=require('@/server/phase2/planner/read-model');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const {preparePlanningMobility}=require('@/server/phase2/planner/prospective-mobility-pricing');
const {inventoryItems,inventoryPages}=require('@/app/mois-a-venir/composer/inventory-layout');
const {ComposerLibrary}=require('@/app/mois-a-venir/composer/composer-library');
const {ComposerShell}=require('@/app/mois-a-venir/composer/composer-shell');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
globalThis.fetch=async()=>{throw new Error('R5_REMOTE_NETWORK_FORBIDDEN');};
const pg=await createKernelPostgres(),owner=providers(),passed=[];
let fixture=visualMonth(),sequence=0;
const deps={repository:createPlanApplyRepository(pg.client),readWorld:async()=>fixture.world,
  prepareWorld:(world,state)=>preparePlanningMobility(world,state,owner.value)};
const read=async()=>{const r=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:++sequence,targetMonth:'2026-11',draft:fixture.semantic});assert.equal(r.ok,true,r.code);return r.model;};
const check=async(ids,fn)=>{await fn();passed.push(...ids);console.log(ids.join(' ')+' PASS');};
const source=file=>fs.readFileSync('src/app/mois-a-venir/composer/'+file,'utf8');
try{
  const model=await read(),snapshot=JSON.stringify(model),items=inventoryItems(model);
  const html=renderToStaticMarkup(React.createElement(ComposerShell,{initialModel:model,transport:async()=>{throw new Error('SSR_NO_CALL');}}));
  await check(['R5-001','R5-002','R5-003','R5-015'],()=>{assert.ok(!html.includes('L’inventaire du mois'));assert.ok(!html.includes('Vos objets, vos moments'));assert.ok(!html.includes('Explorer les ajustements'));assert.ok(!html.includes('data-palette-dock'));assert.ok(!html.includes('Sélectionnez un moment'));});
  await check(['R5-008','R5-017'],()=>{const library=renderToStaticMarkup(React.createElement(ComposerLibrary,{model,openToken:0,busy:false,selected:null,choose:()=>{},drag:()=>{}}));assert.ok(!/Situations|Composants|Leviers/u.test(library));assert.match(library,/Sortir/);assert.ok(!/\p{Extended_Pictographic}/u.test(html));});
  await check(['R5-012','R5-013','R5-033'],async()=>{for(const size of [[1300,710],[1490,890],[1010,710],[1010,570]]){const pages=inventoryPages(items,...size);assert.deepEqual(pages,inventoryPages(items,...size));assert.deepEqual(pages.flat().map(i=>i.id),items.map(i=>i.id));assert.equal(new Set(pages.flat().map(i=>i.id)).size,items.length);assert.ok(pages[0].some(i=>i.context&&model.presentation.objects[i.id].variant==='COMPOSITE'));}assert.equal(JSON.stringify(model),snapshot);assert.deepEqual((await read()).proof,model.proof);assert.ok(!('page' in model.semanticState));});
  await check(['R5-020','R5-021','R5-022'],async()=>{const independent=await readMonthComposer(deps,householdId,'2026-11',model.semanticState);assert.deepEqual(independent.preview.projection,model.board.cockpit);assert.ok(model.presentation.unresolvedRefs.length);const visibleOrGroupedUnresolved=html.includes('Budget à préciser') || items.some(item=>item.kind==='CLUSTER'&&item.children.some(child=>model.presentation.unresolvedRefs.includes(child.id)));assert.ok(visibleOrGroupedUnresolved,'unresolved objects remain visible or reachable in a visual cluster');for(const file of fs.readdirSync('src/app/mois-a-venir/composer').filter(n=>n.endsWith('.tsx'))){assert.ok(!/new Big|parseFloat|\.plus\(|\.minus\(/u.test(source(file)),file);}assert.equal(model.board.cockpit.plan.economicMonthEndRemainder,null);assert.match(html,/data-remainder[^>]*>—/);});
  await check(['R5-031','R5-032'],()=>{const css=source('composer.module.css');assert.ok(!/@media[^\{]*(max-width|min-width|width\s*:)/u.test(css));assert.match(css,/@media \(prefers-reduced-motion: reduce\)/u);assert.match(css,/transition:none!important/u);assert.match(css,/animation:none!important/u);});
  await check(['R5-READY-CONTRACT'],()=>{const ready={...model,board:{...model.board,cockpit:{...model.board.cockpit,projectionCompleteness:'COMPLETE',applyReadiness:'READY'}}};assert.ok(renderToStaticMarkup(React.createElement(ComposerShell,{initialModel:ready,transport:async()=>{}})).includes('data-plan-ready'));assert.ok(!html.includes('data-plan-ready'));assert.equal(pg.rpcCalls,0);});
  await check(['R5-SPARSE'],async()=>{fixture=sparseMonth();const sparse=await read();assert.equal(inventoryItems(sparse).length,3);assert.ok(inventoryItems(sparse).every(i=>i.width<=236));});
  await pg.verifyCanaries();assert.deepEqual(await pg.counts(),{plans:0,revisions:0});assert.equal(pg.rpcCalls,0);
  console.log(JSON.stringify({passed,remoteWrites:0,localWrites:0,readyFixture:'UI contract only; C7 COMPLETE provider absent.'}));
}finally{await pg.close();}
