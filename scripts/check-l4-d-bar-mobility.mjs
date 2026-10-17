// Real Compiler / Finance V2 / C0 path, synthetic owners and isolated PGlite only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {p10Month,p10Route} from './fixtures/planner-p10.mjs';
import {uuid,householdId,home,destination,providers} from './fixtures/planner-mobility.mjs';
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {preparePlanningMobility}=require('@/server/phase2/planner/prospective-mobility-pricing');
const {previewPlanScenario}=require('@/server/phase2/planner/apply');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const {barPlaceOperation,barSameModeReturn}=require('@/app/mois-a-venir/composer/bar-living-operations');
const pg=await createKernelPostgres(),fixture=p10Month(),world=fixture.world,before=structuredClone(world),provider=providers();
globalThis.fetch=async()=>{throw Error('L4D_REMOTE_NETWORK_FORBIDDEN');};
const deps={repository:createPlanApplyRepository(pg.client),readWorld:async()=>world,householdPersons:[],
 prepareWorld:(w,s)=>preparePlanningMobility(w,s,provider.value),readMobilityOptions:async()=>({places:world.mobilityFacts.places,vehicle:world.mobilityFacts.vehicle}),
 validateContextReferences:async(h,refs)=>{assert.equal(h,householdId);assert.ok(refs.placeIds.every(id=>world.mobilityFacts.places.some(p=>p.placeId===id)));},
 readDirectWorld:async()=>({forecast:world.forecast,monthInputs:world.monthInputs,externalIntents:world.externalIntents,asOfDate:world.asOfDate})};
let sequence=0,model;const id=uuid(87001),checks=[];
const request=async(operation,draft=model?.semanticState)=>{const response=await handleComposerRequest(deps,householdId,{sequence:++sequence,targetMonth:'2026-11',draft,...operation});assert.equal(response.ok,true,`${response.code}: ${response.message}`);return response.model;};
const current=()=>model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
const check=async(name,fn)=>{await fn();checks.push({name,status:'EXECUTED_PASS_PGLITE_SYNTHETIC_ONLY'});console.log(name+' PASS');};
try{
 model=await request({kind:'DROP',assetKey:'template:night-out',presetKey:'bar-apero',identity:id,selectionId:uuid(87002),values:{},target:{kind:'BOARD_ZONE'}},fixture.semantic);
 const car={kind:'MOBILITY_INTENT',selectionId:uuid(87003),optionKey:'car',provenance:'EXPLICIT_USER_DECISION',origin:home,destination,returnRequired:false,
  pricing:{fare:{kind:'UNKNOWN'},parking:{kind:'UNKNOWN'},fundingAllocations:[],preference:'FASTEST'},route:{...p10Route(),stops:p10Route().stops.slice(0,2)}};
 await check('BAR_DIRECTED_CAR_AND_EXPLICIT_RETURN_COMPILER_2_LEGS',async()=>{
  model=await request({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{placeRef:destination,plannedDate:null},slots:{outbound:[car]}}});
  model=await request(barSameModeReturn(current(),uuid(87004)));const p=await previewPlanScenario(deps,householdId,model.semanticState);
  assert.equal(p.compiled.journeys.length,2);assert.equal(p.compiled.journeyPrices.length,2);
  assert.deepEqual(p.compiled.journeyPrices.map(price=>price.economicFuel),['2.00','2.00']);
  assert.deepEqual(p.compiled.journeyPrices.map(price=>price.snapshot.route.distanceKm),['10','10']);
  assert.equal(p.compiled.components.filter(c=>c.assetKey==='transport:fuel_usage').length,2);
  assert.equal(p.compiled.components.filter(c=>c.label==='Bar / Apéro').length,0);
 });
 const carState=structuredClone(model.semanticState),out=current().slotSelections.outbound.items[0],back=current().slotSelections.return.items[0];
 await check('BAR_RETURN_TAXI_ONLY_REMOVES_RETURN_FUEL',async()=>{
  const taxi={kind:'MOBILITY_INTENT',selectionId:back.selectionId,optionKey:'taxi',provenance:'EXPLICIT_USER_DECISION',origin:back.origin,destination:back.destination,returnRequired:false,
   pricing:{fare:{kind:'MANUAL',unitAmount:'12'},parking:{kind:'UNKNOWN'},fundingAllocations:[],preference:'FASTEST'}};
  model=await request({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{},slots:{return:[taxi]}}});
  assert.deepEqual(current().slotSelections.outbound.items[0],out);const p=await previewPlanScenario(deps,householdId,model.semanticState);
  assert.equal(p.compiled.components.filter(c=>c.assetKey==='transport:fuel_usage').length,1);
  assert.equal(p.compiled.journeyPrices.filter(price=>price.cashTransport==='12.00').length,1);
  assert.ok(p.compiled.journeyPrices.some(price=>price.economicFuel==='2.00'));
 });
 await check('BAR_PLACE_TEXT_INVALIDATES_BOTH_DERIVATIONS_NOT_INDEPENDENT_COMPONENTS',async()=>{
  const components=structuredClone(current().slotSelections.extras);model=await request(barPlaceOperation(current(),{kind:'TEXT',label:'Lieu libre synthétique',provenance:'USER_DECLARED_PROSPECTIVE'}));
  const p=await previewPlanScenario(deps,householdId,model.semanticState);assert.equal(p.compiled.journeys.length,2);
  assert.equal(p.compiled.journeyPrices.some(price=>price.economicFuel==='2.00'),false);assert.equal(p.compiled.journeyPrices.some(price=>price.cashTransport==='12.00'),false);
  assert.deepEqual(current().slotSelections.extras,components);assert.equal(current().slotSelections.return.items[0].destination.placeId,home.placeId);
 });
 await check('BAR_PROVIDER_OUTAGE_NOT_BOARD_FAILURE_AND_RESTORE_DIGEST',async()=>{
  provider.settings.routeUnavailable=true;model=await request({kind:'READ'},carState);assert.ok(model.mobilitySummaries.every(item=>item.economicFuel===null));
  provider.settings.routeUnavailable=false;const a=await previewPlanScenario(deps,householdId,carState),b=await previewPlanScenario(deps,householdId,carState);
  assert.equal(a.compiledManifestDigest,b.compiledManifestDigest);assert.equal(a.scenarioDigest,b.scenarioDigest);
 });
 await check('BAR_TWO_LEGS_APPLY_RELOAD_C0_IDENTITIES_NO_OWNER_WRITES',async()=>{
  model=await request({kind:'READ'},carState);const expected=structuredClone(model.semanticState);
  model=await request({kind:'APPLY',command:{...model.proof,applyRequestId:uuid(87005)}});model=await request({kind:'READ'},undefined);
  const stored=await deps.repository.readActivePlan(householdId,'2026-11');assert.deepEqual(stored.activeRevision.semanticState,expected);
  for(const slot of ['outbound','return'])assert.deepEqual(current().slotSelections[slot],expected.contexts.find(c=>c.contextOccurrenceId===id).slotSelections[slot]);
  assert.deepEqual(world,before);await pg.verifyCanaries();
 });
 fs.mkdirSync('outputs/l4d',{recursive:true});fs.writeFileSync('outputs/l4d/mobility.json',JSON.stringify({checks,remoteWrites:0,providers:'SYNTHETIC',authenticated:'NOT_RUN_AUTH',counts:await pg.counts()},null,2));
}finally{await pg.close();}
