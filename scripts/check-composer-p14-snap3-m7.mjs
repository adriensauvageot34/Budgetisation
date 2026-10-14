// Native PostgreSQL 17 synthetic test. SQL roles do not replace real Supabase JWTs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';
import {require} from './lib/phase2-ts-loader.mjs';
import {history,uuid} from './fixtures/canonical-p14-p3.mjs';
const {CanonicalRepository}=require('@/server/canonical/repository');
const {buildGlobalM7MobilityContextAuthority}=require('@/analytics/global-v2/mobility-context');
const {plannerDigest}=require('@/domain/phase2/planner/json');
const {historicalBasisScope,createHistoricalBasisStore,makeHistoricalBasisArtifact}=require('@/server/phase2/planner/historical-basis');
const {historicalM7Scope,admittedHistoricalM7Basis}=require('@/server/phase2/planner/historical-m7-basis');
const base={host:'127.0.0.1',port:55434,user:'postgres',database:'postgres',ssl:false};
const control=new pg.Client(base);await control.connect();
const db='snap2_snap3_m7_'+Date.now();await control.query('CREATE DATABASE '+db);await control.end();
process.env.SNAP2_LOCAL_DATABASE=db;
process.env.SNAP2_MIGRATION_SQL='supabase/migrations/20261014105944_planner_activity_history_durable.sql';
const {setupNative,connection}=await import('./lib/snap2-native-postgres.mjs');
const data=history({months:2,eventsPerMonth:1});Object.assign(data.context,{userId:uuid(900),contractVersion:'v2'});
const admin=await setupNative(data),results=[];
const test=async(name,fn)=>{await fn();results.push({name,status:'PASS'});console.log(name+' PASS');};
const canonicalTables=['operations','operation_allocations','operation_items','payment_components','cash_economic_uses','refund_allocations',
 'economic_consumption_segments','operation_place_links','financial_source_person_links','categories','subcategories','merchants',
 'purchase_events','purchase_event_memberships','purchase_event_timing_assertions','purchase_economic_components',
 'purchase_event_classification_assertions','economic_component_classifications','analysis_periods'];
const m7Tables=['mobility_legs','person_days','location_occurrences','life_events','life_event_types','life_event_participations',
 'life_event_localizations','life_event_financial_links'];
for(const name of [...canonicalTables,...m7Tables]) await admin.query('CREATE TABLE IF NOT EXISTS public.'+name+' (synthetic_id integer primary key,value integer)');
for(const name of ['financial_bank_cost_canonical','financial_refund_source_canonical','financial_economic_cost_canonical',
 'financial_economic_timing_canonical','financial_economic_timing_control','financial_canonical_reconciliation_control','operation_place_canonical'])
 await admin.query('CREATE VIEW public.'+name+' AS SELECT synthetic_id FROM public.operations');
const actor=await connection(),publisher=await connection();
await actor.query('SET ROLE authenticated');await actor.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[data.context.userId]);
await publisher.query('SET ROLE service_role');
const rpc=c=>({async rpc(name,args){const fields=name.startsWith('publish')?['p_scope','p_key','p_expected_generation','p_artifact']:['p_scope','p_key'];
 try{const r=await c.query('SELECT public.'+name+'('+fields.map((_,i)=>'$'+(i+1)).join(',')+') v',fields.map(k=>args[k]));return {data:r.rows[0].v,error:null};}
 catch(error){return{data:null,error};}}});
const store=createHistoricalBasisStore(rpc(actor),rpc(publisher));
const repository=new CanonicalRepository({},data.context),range={start:'2024-07-01',endExclusive:'2024-09-01'};
try{
 await test('BASE-MIGRATION-PG17',()=>admin.query(fs.readFileSync('supabase/migrations/20261014165936_composer_historical_basis_canonical.sql','utf8')));
 const canonical=historicalBasisScope(repository,range),canonicalKey=plannerDigest(canonical);
 await test('CANONICAL-ARTIFACT-BEFORE-UPGRADE',async()=>{
  const before=await store.inspect(canonical,canonicalKey),a=makeHistoricalBasisArtifact(canonical,before.proof,1,{purchaseFacts:[]});
  assert.equal(await store.publish(canonical,canonicalKey,0,a),true);
 });
 await test('M7-MIGRATION-PG17',()=>admin.query(fs.readFileSync('supabase/candidates/P14_SNAP3_M7_BASIS_REVIEW_DO_NOT_EXECUTE.sql','utf8')));
 await test('SCHEMA-EPOCH-FENCES-OLD-ARTIFACT',async()=>{
  const next=await store.inspect(canonical,canonicalKey);
  assert.equal(next.proof.coverage,'composer-historical-writers@v2');assert.equal(next.proof.schemaEpoch,'2');
  assert.equal(next.generation,1);assert.equal(next.artifact,null);
 });
 const scope=historicalM7Scope(repository,range),key=plannerDigest(scope);
 await test('M7-OWNER-OUTPUT-LOSSLESS',async()=>{
  const mobilityContext=buildGlobalM7MobilityContextAuthority({householdId:data.context.householdId,
   householdTimeZone:data.context.timezone,householdPersonIds:data.context.personIds,
   mobilityLegs:[],lifeEventContexts:[],placeVisits:[],personDays:[]});
  const payload={simpleOccurrences:{occurrences:[],links:[]},mobilityLegs:[],mobilityContext};
  const before=await store.inspect(scope,key),a=makeHistoricalBasisArtifact(scope,before.proof,1,payload);
  assert.equal(await store.publish(scope,key,0,a),true);
  assert.deepEqual(admittedHistoricalM7Basis(scope,await store.inspect(scope,key)),payload);
 });
 await test('M7-NONEMPTY-LEG-ROUNDTRIP',async()=>{
  const legId=uuid(301),vehicleId=uuid(302),placeId=uuid(303),datasetId=uuid(304);
  const leg={fact:'fct_mobility_leg',legId,householdId:data.context.householdId,vehicleId,date:'2024-07-12',
   origin:{placeId,sourceLabel:null,resolutionState:'EXPLICIT_MAPPING'},
   destination:{placeId,sourceLabel:null,resolutionState:'EXPLICIT_MAPPING'},
   distanceKm:'10',durationSeconds:'600',durationNoTrafficSeconds:'540',estimatedFuelLiters:'1',estimatedFuelCost:'2',
   fuel:{fuelType:'SP95',pricePerLiter:'2',pricePeriod:'2024-07',geoScope:'NATIONAL',source:'fixture',quality:'P4_NATIONAL_FALLBACK',observationId:null},
   time:{observedTime:'2024-07-12T08:00:00',authority:'OBSERVED',type:'ARRIVAL',routeTimeBasis:null,routeProxyTimes:[]},
   consumptionModelRef:'fixture@v1',routeMethodRef:'fixture@v1',
   source:{datasetId,sourceLegId:'NAV-0301',group:'NAV',sheet:'fixture',reconstruction:'fixture',quality:'fixture',status:'CERTIFIED_SOURCE',confidence:'HIGH',sourceRowHash:'a'.repeat(64)},
   methodVersion:'mobility@v1',evidenceRefs:['mobility:301'],provenance:'estimated'};
  const mobilityContext=buildGlobalM7MobilityContextAuthority({householdId:data.context.householdId,
   householdTimeZone:data.context.timezone,householdPersonIds:data.context.personIds,
   mobilityLegs:[leg],lifeEventContexts:[],placeVisits:[],personDays:[]});
  const payload={simpleOccurrences:{occurrences:[],links:[]},mobilityLegs:[leg],mobilityContext};
  const before=await store.inspect(scope,key),a=makeHistoricalBasisArtifact(scope,before.proof,before.generation+1,payload);
  assert.equal(await store.publish(scope,key,before.generation,a),true);
  assert.deepEqual(admittedHistoricalM7Basis(scope,await store.inspect(scope,key)),payload);
 });
 await test('M7-WRITERS-ALWAYS-AND-ROLLBACK',async()=>{
  for(const table of m7Tables){const before=await store.inspect(scope,key);
   await admin.query('UPDATE public.'+table+' SET '+(table==='life_events'?'life_event_id=life_event_id':
    table==='life_event_types'?'life_event_type_id=life_event_type_id':
    table==='life_event_participations'?'life_event_id=life_event_id':
    table==='life_event_financial_links'?'financial_link_id=financial_link_id':'synthetic_id=synthetic_id')+' WHERE false');
   const next=await store.inspect(scope,key);assert.equal(Number(next.proof.revision),Number(before.proof.revision)+1);
   assert.equal(next.artifact,null);
  }
  const before=await store.inspect(scope,key);await admin.query('BEGIN');
  await admin.query('UPDATE public.mobility_legs SET synthetic_id=synthetic_id WHERE false');await admin.query('ROLLBACK');
  assert.deepEqual((await store.inspect(scope,key)).proof,before.proof);
 });
 await test('M7-AUTH-SCOPE-AND-NO-DIRECT-DML',async()=>{
  assert.equal((await admin.query('SELECT private.composer_basis_writer_coverage() ok')).rows[0].ok,true);
  assert.equal((await admin.query("SELECT count(*)::int n FROM pg_trigger WHERE tgname='snap3_historical_basis_version' AND tgenabled='A'")).rows[0].n,30);
  for(const altered of [{...scope,userId:uuid(999)},{...scope,householdId:uuid(998)},{...scope,personIds:[]}])
   await assert.rejects(store.inspect(altered,plannerDigest(altered)),e=>e.code==='42501');
  await assert.rejects(actor.query('SELECT public.publish_composer_historical_basis_v1($1,$2,0,$3)',[scope,key,{}]),e=>e.code==='42501');
 });
 fs.mkdirSync('docs/status/evidence/p14-snap3',{recursive:true});
 fs.writeFileSync('docs/status/evidence/p14-snap3/m7-native.json',JSON.stringify({environment:'PostgreSQL 17 synthetic; SQL roles, no real JWT',results},null,2)+'\n');
}finally{await actor.end();await publisher.end();await admin.end();}
