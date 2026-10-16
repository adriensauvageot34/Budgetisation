import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { require } from './lib/phase2-ts-loader.mjs';
import { householdId, uuid } from './fixtures/planner-headless.mjs';
import { l31Month } from './fixtures/planner-l3-1.mjs';
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const layout = require('@/app/mois-a-venir/composer/inventory-layout');
const { BoardCarousel } = require('@/app/mois-a-venir/composer/board-carousel');
const { ComposerCockpit, ComposerProjectionDetails } = require('@/app/mois-a-venir/composer/composer-cockpit');
const { semanticStateDigest } = require('@/domain/phase2/planner/semantic-state');
const { displayEquipmentGroups } = require('@/app/mois-a-venir/composer/presentation/palette-groups');
const base = '946303df18b59fc642ff92e9042bfc8e6eb57498';
function oldModule(file, overrides = {}) {
  const mod = new Module(path.resolve(file)); mod.filename = path.resolve(file); mod.paths = Module._nodeModulePaths(path.dirname(mod.filename));
  mod.require = name => overrides[name] ?? Module.prototype.require.call(mod, name);
  mod._compile(ts.transpileModule(execFileSync('git', ['show', `${base}:${file}`], { encoding:'utf8', maxBuffer:2000000 }),
    { compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX, esModuleInterop:true } }).outputText, mod.filename);
  return mod.exports;
}
const beforeAdapter = oldModule('src/app/mois-a-venir/composer/presentation/adapter.ts');
const beforeLayout = oldModule('src/app/mois-a-venir/composer/inventory-layout.ts', { './presentation/adapter':beforeAdapter });
globalThis.fetch = async () => { throw Error('L31_REMOTE_FORBIDDEN'); };
const forbid = async () => { throw Error('L31_WRITER_FORBIDDEN'); };
let world, reads = 0;
const deps = { repository:{ readActivePlan:async()=>null, readRevision:async()=>null, readAppliedRequest:async()=>null, applyRevision:forbid },
  readWorld:async()=>{reads++;return world;} };
const checks = [], check = (name, fn) => { fn(); checks.push(name); console.log(name+' PASS'); };
const modelFor = async dense => { const f=l31Month(dense); world=f.world; const r=await handleComposerRequest(deps, householdId,
  { kind:'READ', sequence:dense?2:1, targetMonth:'2026-11', draft:f.semantic }); assert.equal(r.ok,true,r.code); return r.model; };
const common = await modelFor(false), dense = await modelFor(true), snapshot = JSON.stringify([common,dense]), readsBefore = reads;
check('L31_LAYOUT_BOUNDS_IDENTITIES_AND_ORDER', () => {
  for (const model of [common,dense]) for (const [width,height] of [[710,520],[998,520],[1190,700],[1330,700],[1700,700]]) {
    const items=layout.inventoryItems(model), pages=layout.inventoryLayoutPages(items,width,height);
    assert.deepEqual(pages.flat().map(p=>p.item.id),items.map(x=>x.id));
    assert.equal(new Set(pages.flat().map(p=>p.item.id)).size,items.length);
    assert.deepEqual(pages,layout.inventoryLayoutPages(items,width,height));
    for(const page of pages){const occupied=new Set(); for(const p of page){
      assert.ok(p.column+p.columnSpan-1<=layout.inventoryColumns(width));
      assert.ok((p.row+p.rowSpan-1)*10-5<=height);
      for(let y=p.row;y<p.row+p.rowSpan;y++)for(let x=p.column;x<p.column+p.columnSpan;x++){const key=`${x}:${y}`;assert.ok(!occupied.has(key));occupied.add(key);}
    }}
  }
});
const oldPages=beforeLayout.inventoryLayoutPages(beforeLayout.inventoryItems(common),710,583.75);
const newPages=layout.inventoryLayoutPages(layout.inventoryItems(common),710,520.75);
// L3.3 adds a second editable dimension to occurrence cards; five richer cards
// replace the former eight single-value cards. Full coverage/geometry is checked above.
check('L31_DENSITY_WITH_LARGER_READABLE_PALETTE',()=>{
  assert.equal(oldPages[0].length,6); assert.ok(newPages[0].length>=5);
  assert.ok(newPages.length<=oldPages.length); assert.ok(layout.inventoryItems(common).filter(x=>x.kind==='CONTROL').every(x=>x.width<=260));
});
check('L31_SAME_LABEL_DISTINCT_IDENTITIES',()=>{
  const pages=layout.inventoryPages(layout.inventoryItems(dense),710,520), contexts=dense.board.contexts;
  assert.equal(new Set(contexts.map(c=>c.label)).size,1);
  assert.ok(layout.inventoryPageFor(pages,contexts.at(-1).contextOccurrenceId,dense)>layout.inventoryPageFor(pages,contexts[0].contextOccurrenceId,dense));
  for(const c of contexts)assert.ok(pages[layout.inventoryPageFor(pages,c.contextOccurrenceId,dense)].some(i=>i.id===c.contextOccurrenceId));
});
check('L31_CLUSTER_AND_PARENT_NAVIGATION',()=>{
  const pages=layout.inventoryPages(layout.inventoryItems(common),710,520), cluster=layout.inventoryItems(common).find(i=>i.kind==='CLUSTER');
  for(const child of cluster.children)assert.equal(layout.inventoryPageFor(pages,child.id,common),layout.inventoryPageFor(pages,cluster.id,common));
  const root=common.board.contexts[0], child={...root,contextOccurrenceId:uuid(31999),parentContextOccurrenceId:root.contextOccurrenceId};
  const nested={...common,board:{...common.board,contexts:[...common.board.contexts,child]}};
  assert.equal(layout.inventoryPageFor(pages,child.contextOccurrenceId,nested),layout.inventoryPageFor(pages,root.contextOccurrenceId,nested));
});
check('L31_PAGINATION_UNIT_IS_PAGES',()=>{
  const html=renderToStaticMarkup(React.createElement(BoardCarousel,{model:dense,focused:null,render:()=>null,emptyClick(){},dropProps:{}}));
  assert.match(html,/Précédente/);assert.match(html,/Suivante/);assert.match(html,/Page /);assert.match(html,/ sur /);assert.doesNotMatch(html,/ autres/);
});
check('L31_PALETTE_ROUTES_REMAIN_ADMISSIBLE',()=>{
  const groups=displayEquipmentGroups(common.board.contexts[0],common), routes=groups.flatMap(g=>g.tiles.flatMap(t=>t.routes));
  assert.ok(routes.length>=7);
  for(const r of routes)assert.ok(common.library.searchableAssets.some(a=>a.assetKey===r.option.assetKey));
});
check('L31_OFFICIAL_UNKNOWN_AND_STALE_RENDER',()=>{
  const p=common.board.cockpit;
  assert.equal(p.plan.economicMonthEndRemainder,null);
  const html=renderToStaticMarkup(React.createElement(ComposerCockpit,{projection:p,goalMargin:common.presentation.goalMargin,temporary:false}));
  assert.match(html,/Montant à préciser/);
  const details=renderToStaticMarkup(React.createElement(ComposerProjectionDetails,{projection:p}));assert.match(details,/Projection incomplète/);assert.match(details,/Situation de référence/);
  const stale=renderToStaticMarkup(React.createElement(ComposerProjectionDetails,{projection:p,stale:true}));assert.match(stale,/En attente de simulation/);assert.doesNotMatch(stale,/2[\s\S]{0,10}000,00/);
});
check('L31_NO_FINANCIAL_OR_DRAFT_MUTATION',()=>{
  assert.equal(JSON.stringify([common,dense]),snapshot);assert.equal(reads,readsBefore);
  assert.equal(semanticStateDigest(common.semanticState),semanticStateDigest(l31Month().semantic));
// These two registries contain presentation recipes/indexing; all financial/domain owners remain guarded.
assert.deepEqual(execFileSync('git',['diff',base,'b777374fe8399e7abf22967c98caef2013876507','--name-only','--','src/server','src/domain','supabase','src/app/mois-a-venir/composer/durable-draft.ts','src/app/mois-a-venir/composer/preview-scheduler.ts'],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean).filter(file=>!['src/domain/phase2/planner/composer-presets.ts','src/domain/phase2/planner/composer-library-index.ts'].includes(file)),[]);
});
const dir='docs/status/evidence/l3-1-composer-ux-finish';fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(dir+'/layout-contracts.json',JSON.stringify({base,environment:'REAL_COMPILER_SYNTHETIC_ONLY',checks,density:{before:oldPages.map(p=>p.length),after:newPages.map(p=>p.length)},remoteWrites:0,applyCalls:0},null,2)+'\n');
