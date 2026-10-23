/** D1 checkpoint A: actual Compiler/Cost Evaluation/V2, synthetic facts only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Big from 'big.js';
import {require} from './lib/phase2-ts-loader.mjs';
import {fixture,state,uuid,selections,component,mobility,home,destination,providers} from './fixtures/planner-mobility.mjs';
const {editNightOut}=require('@/domain/phase2/planner/night-out-edit');
const {parsePlanSemanticState,semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {plannerDigest}=require('@/domain/phase2/planner/json');
const {validateContextGraph}=require('@/server/phase2/planner/context-selections');
const {preparePlanningMobility}=require('@/server/phase2/planner/prospective-mobility-pricing');
const {evaluatePlanScenario}=require('@/server/phase2/planner/preview');
const {setContextSlotSelections}=require('@/server/phase2/planner/context-state');
const id=uuid(99110),childId=uuid(99111),globalId=uuid(99112);
export const parentId=id, beforeId=childId;
export function d1Fixture(){
 const parent={contextOccurrenceId:id,templateKey:'night-out',status:'ACTIVE',parentContextOccurrenceId:null,provenance:'EXPLICIT_USER_DECISION',
  fields:{fieldSchemaVersion:'context-fields@v2',label:'Bar / Apéro',composerPresentation:{version:'composer-context-presentation@v1',presetKey:'bar-apero'}},
  slotSelections:{before:selections({kind:'CHILD_CONTEXT',selectionId:uuid(99113),optionKey:'activity',childContextOccurrenceId:childId,provenance:'EXPLICIT_USER_DECISION'}),
   extras:selections({...component('extra','5',uuid(99114)),label:'Bière',quantity:'4'}),
   return:selections(mobility('taxi',uuid(99115),{origin:destination,destination:home,pricing:{fare:{kind:'MANUAL',unitAmount:'11'},fundingAllocations:[]}}))}};
 const before={contextOccurrenceId:childId,templateKey:'activity',status:'ACTIVE',parentContextOccurrenceId:id,provenance:'EXPLICIT_USER_DECISION',fields:{fieldSchemaVersion:'context-fields@v2',label:'Before'},
  slotSelections:{main:selections({...component('activity','15',uuid(99116)),label:'Vodka'}),extras:selections({...component('extra','5',uuid(99117)),label:'Diluant'})}};
 return parsePlanSemanticState(state([],[parent,before]));
}
export const globalCommand=(s,mode='GLOBAL',extra={})=>({contextOccurrenceId:id,fields:{},globalConsumption:{version:'night-out-consumption@v2',mode,expectedStateDigest:plannerDigest(s),confirmed:true,selectionId:globalId,...extra}});
export const toGlobal=(s,amount='40')=>editNightOut(s,globalCommand(s,'GLOBAL',{amount}));
export const toDetail=s=>editNightOut(s,globalCommand(s,'DETAILED'));
const parent=s=>s.contexts.find(c=>c.contextOccurrenceId===id);
const checkResults=[];
const check=async(name,run)=>{await run();checkResults.push({name,status:'PASS'});console.log(name+' PASS');};
export async function compiledD1(s){const world=await preparePlanningMobility(fixture(),s,providers().value);return evaluatePlanScenario(world,s,{expectedActiveRevisionId:null,expectedActiveRevisionNumber:0});}
export const totalD1=p=>p.compiled.components.reduce((sum,c)=>sum.plus(c.evaluation.economicAmount??0),new Big(0)).toFixed(2);
export async function checkpointA(){
 const detailed=d1Fixture(),global=toGlobal(detailed),snapshot=structuredClone(detailed);
 await check('DETAIL_20_BEFORE_20_BAR_11_TAXI_EQUALS_51',async()=>{const p=await compiledD1(detailed);assert.equal(totalD1(p),'51.00');assert.equal(p.compiled.components.length,4);});
 await check('GLOBAL_40_PLUS_11_EQUALS_51_ONE_AUTHORITY',async()=>{const p=await compiledD1(global);assert.equal(totalD1(p),'51.00');assert.equal(p.compiled.components.length,2);assert.equal(p.compiled.components.filter(c=>c.label==='Consommations de la sortie').length,1);assert.deepEqual(detailed,snapshot);assert.deepEqual(global.contexts.find(c=>c.contextOccurrenceId===childId),snapshot.contexts.find(c=>c.contextOccurrenceId===childId));});
 await check('COVERED_UNKNOWN_NOT_FINANCIAL_UNKNOWN',async()=>{const c=parent(global),beer={...c.slotSelections.extras.items[0],cost:{kind:'UNKNOWN'}};const next=editNightOut(global,{contextOccurrenceId:id,fields:{},slots:{extras:[beer]}});const p=await compiledD1(next);assert.equal(totalD1(p),'51.00');assert.ok(p.compiled.components.every(c=>c.evaluation.economicAmount!==null));});
 await check('TAXI_UNKNOWN_REMAINS_PARTIAL',async()=>{const c=parent(global),leg=c.slotSelections.return.items[0];const next=editNightOut(global,{contextOccurrenceId:id,fields:{},slots:{return:[{...leg,pricing:{...leg.pricing,fare:{kind:'UNKNOWN'}}}]}});const p=await compiledD1(next);assert.ok(p.compiled.components.some(c=>c.evaluation.economicAmount===null));assert.equal(p.projection.plan.economicMonthEndRemainder,null);});
 await check('GLOBAL_ZERO_KNOWN_NOT_UNKNOWN',async()=>{const p=await compiledD1(toGlobal(detailed,'0'));assert.equal(totalD1(p),'11.00');assert.equal(p.compiled.components.find(c=>c.label==='Consommations de la sortie').evaluation.economicAmount,'0.00');});
 let six;
 await check('QUANTITY_SIX_GLOBAL_40_THEN_DETAIL_RESTORES_5_PER_BEER',async()=>{const c=parent(global);six=editNightOut(global,{contextOccurrenceId:id,fields:{},slots:{extras:[{...c.slotSelections.extras.items[0],quantity:'6'}]}});assert.equal(totalD1(await compiledD1(six)),'51.00');const next=toDetail(six);assert.equal(totalD1(await compiledD1(next)),'61.00');assert.equal(parent(next).slotSelections.extras.items[0].cost.unitAmount,'5');});
 await check('ADD_REMOVE_GLOBAL_NO_GHOST_OR_RESURRECTION',async()=>{const added=component('extra',null,uuid(99118));let next=editNightOut(global,{contextOccurrenceId:id,fields:{},slots:{extras:[...parent(global).slotSelections.extras.items,added]}});assert.equal(parent(next).fields.nightOutConsumption.covered.length,4);next=setContextSlotSelections(next,id,'extras',[added]);assert.equal(totalD1(await compiledD1(next)),'51.00');assert.equal(parent(next).fields.nightOutConsumption.covered.length,3);const back=toDetail(next);assert.deepEqual(parent(back).slotSelections.extras.items.map(i=>i.selectionId),[added.selectionId]);assert.equal(parent(toGlobal(back)).fields.nightOutConsumption.amount,'40');});
 await check('CYCLE_AND_DISPLAY_ORDER_INDEPENDENT',async()=>{const cycle=toGlobal(toDetail(six));assert.equal(totalD1(await compiledD1(cycle)),'51.00');assert.deepEqual(parent(cycle).slotSelections,parent(six).slotSelections);const reordered=parsePlanSemanticState({...cycle,contexts:[...cycle.contexts].reverse().map(c=>({...c,slotSelections:Object.fromEntries(Object.entries(c.slotSelections).reverse().map(([key,s])=>[key,{items:[...s.items].reverse()}]))}))});assert.equal(totalD1(await compiledD1(reordered)),'51.00');});
 await check('PARENT_CHILD_REFERENCES_AND_PRICE_IDENTITIES_UNCHANGED',()=>{const refs=parent(global).fields.nightOutConsumption.covered;assert.equal(refs.length,3);assert.ok(refs.some(r=>r.contextOccurrenceId===childId&&r.slotKey==='main'));assert.deepEqual(parent(global).slotSelections.before,parent(detailed).slotSelections.before);assert.deepEqual(toDetail(global).contexts.map(c=>c.slotSelections),detailed.contexts.map(c=>c.slotSelections));});
 await check('ADDITIVE_MEAL_AND_MOBILITY_NEVER_ABSORBED',async()=>{const additive={...component('extra','7',uuid(99119)),economicScope:{version:'component-economic-scope@v1',kind:'ADDITIVE_CONTRIBUTION',coveredSelectionIds:[uuid(99119)]}};const next=editNightOut(global,{contextOccurrenceId:id,fields:{},slots:{extras:[...parent(global).slotSelections.extras.items,additive],food:[component('restaurant','8',uuid(99120))]}});const p=await compiledD1(next);assert.equal(totalD1(p),'66.00');assert.equal(parent(next).fields.nightOutConsumption.covered.length,3);});
 await check('V1_FINANCED_AGGREGATE_PROTECTED_AND_STALE_SAFE_REFUSAL',()=>{const stale=globalCommand(detailed,'GLOBAL',{amount:'40'});let changed=setContextSlotSelections(detailed,childId,'extras',[component('extra','6',uuid(99117))]);assert.throws(()=>editNightOut(changed,stale),/STALE/);assert.throws(()=>editNightOut({...detailed,preferences:{anchors:[childId],flexibility:{}}},globalCommand({...detailed,preferences:{anchors:[childId],flexibility:{}}},'GLOBAL',{amount:'40'})),/LOCKED/);const c=parent(detailed),beer=c.slotSelections.extras.items[0];for(const item of [{...beer,fundingAllocations:[{source:'BANK',amount:'20'}]},{...beer,economicScope:{version:'component-economic-scope@v1',kind:'AGGREGATED_SUBSTITUTIVE_ESTIMATE',coveredSelectionIds:[beer.selectionId]}}]){const s=editNightOut(detailed,{contextOccurrenceId:id,fields:{},slots:{extras:[item]}});assert.throws(()=>toGlobal(s),/SCOPE_NEEDS_CHOICE/);}
 const v1=editNightOut(detailed,{contextOccurrenceId:id,fields:{},consumption:{mode:'DIRECT',expectedContextDigest:plannerDigest(c),amount:'40',selectionId:uuid(99121),acceptLegacy:true}});assert.throws(()=>toGlobal(v1),/V1_DIRECT_NEEDS_DETAILS/);assert.equal(parent(v1).fields.nightOutConsumption.version,'night-out-consumption@v1');assert.equal(semanticStateDigest(parsePlanSemanticState(JSON.parse(JSON.stringify(v1)))),semanticStateDigest(v1));});
 await check('FORGED_COVERAGE_REJECTED_NO_SILENT_REPAIR',()=>{const raw=structuredClone(global);parent(raw).fields.nightOutConsumption.covered.pop();assert.throws(()=>parsePlanSemanticState(raw),/COVERAGE_STALE/);validateContextGraph(global);});
 fs.mkdirSync('outputs/bar-d1',{recursive:true});fs.writeFileSync('outputs/bar-d1/checkpoint-a.json',JSON.stringify({level:'SYNTHETIC_REAL_COMPILER_FINANCE_V2',checks:checkResults,remoteWrites:0,totals:{detailed:'51.00',global:'51.00',sixDetailed:'61.00'}},null,2));
}
if(process.argv[1]?.endsWith('check-bar-d1-global.mjs'))await checkpointA();
