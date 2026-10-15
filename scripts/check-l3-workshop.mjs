// Real Compiler / Finance V2, synthetic inputs, no network or database writer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {require} from './lib/phase2-ts-loader.mjs';
import {fixture,state,householdId,weekendMonth,context,component,selections} from './fixtures/planner-headless.mjs';
import {fixture as kernel,control,seal} from './fixtures/planner-kernel.mjs';
import {providers} from './fixtures/planner-mobility.mjs';
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {preparePlanningMobility}=require('@/server/phase2/planner/prospective-mobility-pricing');
const {ComposerCockpit,ComposerProjectionDetails}=require('@/app/mois-a-venir/composer/composer-cockpit');
const {ComposerFinancialInspector}=require('@/app/mois-a-venir/composer/composer-financial-inspector');
const base='ddfcf4b41d36b1ee024d4aecb0698907d7144cca';
const gitFile=file=>execFileSync('git',['show',`${base}:${file}`],{encoding:'utf8',maxBuffer:2000000}).replaceAll('\r\n','\n');
const cockpitFile='src/app/mois-a-venir/composer/composer-cockpit.tsx';
const oldModule=new Module(path.resolve(cockpitFile));oldModule.filename=path.resolve(cockpitFile);oldModule.paths=Module._nodeModulePaths(path.dirname(oldModule.filename));
oldModule._compile(ts.transpileModule(gitFile(cockpitFile),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,oldModule.filename);
globalThis.fetch=async()=>{throw Error('L3_NETWORK_FORBIDDEN');};
const forbidden=async()=>{throw Error('L3_WRITER_FORBIDDEN');};
let world=fixture(),reads=0,sequence=0;
const deps={repository:{readActivePlan:async()=>null,readRevision:async()=>null,readAppliedRequest:async()=>null,applyRevision:forbidden},
  readWorld:async()=>{reads++;return world;},prepareWorld:(w,s)=>preparePlanningMobility(w,s,providers().value),
  validateContextReferences:async(_household,refs)=>{
    assert.ok(refs.personIds.every(id=>world.baseline.slots.some(slot=>slot.scope.personId===id)));
    assert.ok(refs.placeIds.every(id=>world.mobilityFacts?.places.some(place=>place.placeId===id)));
  }};
const mealWorld=()=>{const w=kernel();w.baseline.slots.find(s=>s.slotIdentityKey==='restaurants').baselineValue.unitAmount='40.00';
  const ref=w.forecast.referencePlan.flexible.find(p=>p.key==='household-restaurants');ref.low=ref.central=ref.high='120.00';return seal(w);};
const partial=weekendMonth(false);
const cases=[['A_UNCHANGED',fixture(),state(),null],['B_GROCERIES_350',fixture(),state([control('groceries',{amount:'350.00'})]),'-25.00'],
  ['C_RESTAURANT_COVERED',mealWorld(),state([],[context(100,'restaurant',{meal:selections(component('restaurant','40.00','meal',{binding:{mode:'CONFIRMED_CONSUMPTION'}}))})]),'0.00'],
  ['D_RESTAURANT_EXTRA',mealWorld(),state([],[context(100,'restaurant',{meal:selections(component('restaurant','40.00','meal',{binding:{mode:'EXTRA_TO_SLOT'}}))})]),'-40.00'],
  ['E_PARTIAL_UNKNOWN',partial.world,partial.semantic,null]];
const checks=[];
for(const [name,w,semantic,expectedImpact] of cases){world=w;
  const response=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:++sequence,targetMonth:'2026-11',draft:semantic});
  assert.equal(response.ok,true,`${name}: ${response.code}: ${response.message}`);const model=response.model,p=model.board.cockpit;
  if(expectedImpact!==null)assert.equal(p.plan.impactOnMonthEnd,expectedImpact);
  const before=JSON.stringify(model),readsBefore=reads;
  const props={projection:p,goalMargin:model.presentation.goalMargin,temporary:false};
  const old=renderToStaticMarkup(React.createElement(oldModule.exports.ComposerCockpit,props));
  const hud=renderToStaticMarkup(React.createElement(ComposerCockpit,props));
  if(p.plan.economicMonthEndRemainder!==null)assert.equal(hud.match(/data-remainder[^>]*>(.*?)<\/strong>/)?.[1],old.match(/data-remainder[^>]*>(.*?)<\/strong>/)?.[1]);
  assert.ok(!hud.includes('Sans changements'));
  if(p.goal.targetMonthEnd===null)assert.ok(!hud.includes('Marge sur l’objectif'));
  if(p.plan.impactOnMonthEnd==='0.00')assert.ok(!hud.includes('Impact de mes choix'));
  const details=renderToStaticMarkup(React.createElement(ComposerProjectionDetails,{projection:p}));
  assert.match(details,/Situation de référence/);assert.match(details,/Impact consolidé/);
  for(const mode of ['FINANCE','UNRESOLVED'])assert.doesNotThrow(()=>renderToStaticMarkup(React.createElement(ComposerFinancialInspector,{model,mode,stale:false,focused:null,focus:()=>{},close:()=>{}})));
  const stale=renderToStaticMarkup(React.createElement(ComposerCockpit,{...props,stale:true,pending:true}));
  assert.match(stale,/data-remainder[^>]*>—<\/strong>/);assert.match(stale,/Simulation en cours/);
  assert.ok(!renderToStaticMarkup(React.createElement(ComposerProjectionDetails,{projection:p,stale:true})).includes('data-remainder'));
  assert.equal(JSON.stringify(model),before);assert.equal(reads,readsBefore);
  checks.push({name,impact:p.plan.impactOnMonthEnd,projectionCompleteness:p.projectionCompleteness,inputUnchanged:true,additionalWorldReads:0});console.log(name+' PASS');
}
const shellFile='src/app/mois-a-venir/composer/composer-shell.tsx',shell=fs.readFileSync(shellFile,'utf8').replaceAll('\r\n','\n'),oldShell=gitFile(shellFile);
const guard=s=>s.slice(s.indexOf('  function apply() {'),s.indexOf('  const openProjectionDetails'));
assert.equal(guard(shell),guard(oldShell),'Official Apply guards must remain byte-identical after newline normalization');
assert.equal(execFileSync('git',['diff',base,'--name-only','--','src/server','src/domain','src/app/mois-a-venir/composer/durable-draft.ts','src/app/mois-a-venir/composer/preview-scheduler.ts','supabase'],{encoding:'utf8'}),'');
checks.push({name:'AUTHORITIES_APPLY_CAS_SCHEDULER_DRAFT_UNCHANGED',pass:true});
const dir='docs/status/evidence/l3-composer-workshop';fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(dir+'/workshop-contracts.json',JSON.stringify({environment:'REAL_COMPILER_SYNTHETIC_INPUTS_NO_DATABASE',base,checks,authenticated:false,remoteWrites:0},null,2)+'\n');
console.log('L3 workshop contracts PASS');
