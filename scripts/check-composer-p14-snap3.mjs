// Native PG17 synthetic-only; SQL roles here are not Supabase JWT proofs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';
import {deflateRawSync} from 'node:zlib';
import {require} from './lib/phase2-ts-loader.mjs';
import {history,uuid} from './fixtures/canonical-p14-p3.mjs';
const {CanonicalRepository}=require('@/server/canonical/repository');
const {projectPurchaseAwareCanonical}=require('@/analytics/facts/purchase-aware');
const {plannerDigest,canonicalPlannerJson}=require('@/domain/phase2/planner/json');
const {historicalBasisScope,admittedHistoricalBasis,createHistoricalBasisStore,readHistoricalBasis}=require('@/server/phase2/planner/historical-basis');
const base={host:'127.0.0.1',port:55434,user:'postgres',database:'postgres',ssl:false};
const control=new pg.Client(base);await control.connect();
const db='snap2_snap3_'+Date.now();await control.query('CREATE DATABASE '+db);await control.end();
process.env.SNAP2_LOCAL_DATABASE=db;
process.env.SNAP2_MIGRATION_SQL='supabase/migrations/20261014105944_planner_activity_history_durable.sql';
const {setupNative,connection}=await import('./lib/snap2-native-postgres.mjs');
const data=history({months:2,eventsPerMonth:1});Object.assign(data.context,{userId:uuid(900),contractVersion:'v2'});
const admin=await setupNative(data);const results=[];
const test=async(name,fn)=>{await fn();results.push({name,status:'PASS'});console.log(name+' PASS');};
const sourceNames=['operations','operation_allocations','operation_items','payment_components','cash_economic_uses','refund_allocations','economic_consumption_segments','operation_place_links','financial_source_person_links','categories','subcategories','merchants','purchase_events','purchase_event_memberships','purchase_event_timing_assertions','purchase_economic_components','purchase_event_classification_assertions','economic_component_classifications','analysis_periods'];
for(const name of sourceNames)await admin.query('CREATE TABLE public.'+name+' (synthetic_id integer primary key,value integer)');
for(const name of ['financial_bank_cost_canonical','financial_refund_source_canonical','financial_economic_cost_canonical','financial_economic_timing_canonical','financial_economic_timing_control','financial_canonical_reconciliation_control','operation_place_canonical'])await admin.query('CREATE VIEW public.'+name+' AS SELECT synthetic_id FROM public.operations');
await test('MIGRATION-EXACT-PG17',()=>admin.query(fs.readFileSync('supabase/candidates/P14_SNAP3_CANONICAL_BASIS_REVIEW.sql','utf8')));
const actor=await connection(),publisher=await connection();await actor.query('SET ROLE authenticated');await actor.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[data.context.userId]);await publisher.query('SET ROLE service_role');
const rpc=c=>({async rpc(name,args){const fields=name.startsWith('publish')?['p_scope','p_key','p_expected_generation','p_artifact']:['p_scope','p_key'];try{const r=await c.query('SELECT public.'+name+'('+fields.map((_,i)=>'$'+(i+1)).join(',')+') v',fields.map(k=>args[k]));return {data:r.rows[0].v,error:null};}catch(error){return{data:null,error};}}});
const store=createHistoricalBasisStore(rpc(actor),rpc(publisher)),repository=new CanonicalRepository({},data.context),range={start:'2024-07-01',endExclusive:'2024-09-01'};
const scope=historicalBasisScope(repository,range),key=plannerDigest(scope);
const makePayload=()=>({purchaseFacts:['KNOWN','PARTIAL','UNKNOWN'].flatMap((status,i)=>projectPurchaseAwareCanonical({visibility:'PURCHASE_AWARE_PILOT',householdId:data.context.householdId,range,legacyFacts:[],purchases:[{
 purchaseEventId:uuid(10+i),householdId:data.context.householdId,grossAmount:status==='UNKNOWN'?null:'25.80',grossAmountStatus:status,
 sources:[{purchaseEventId:uuid(10+i),membershipKind:'CONSUMPTION_COMPONENT',kind:'purchase_component',sourceId:uuid(20+i),canonicalComponentKey:'purchase_component:'+uuid(20+i),evidenceRefs:['synthetic:owner'],provenance:'STRUCTURED_CANONICAL_SOURCE'}],
 nativeComponent:{purchaseComponentId:uuid(20+i),canonicalComponentKey:'purchase_component:'+uuid(20+i),purchaseEventId:uuid(10+i),categoryId:null,subcategoryId:null,needId:null,merchantId:null},
 timingAssertions:[{authority:'TRUSTED_PURCHASE_SOURCE',precision:'MONTH',economicDate:null,economicMonth:'2024-08-01',evidenceRefs:['synthetic:timing']}],purchaseClassifications:[]
}]}).facts)});
const prepared=makePayload();
const artifact=(current,bodyPayload=prepared)=>{const text=canonicalPlannerJson(bodyPayload),body={scope,proof:current.proof,generation:current.generation+1,status:'READY',codec:'deflate-raw-json@1',payload:deflateRawSync(text).toString('base64'),payloadBytes:Buffer.byteLength(text),payloadDigest:plannerDigest(bodyPayload)};return {...body,digest:plannerDigest(body)};};
try{
 await test('OWNER-OUTPUT-LOSSLESS-UNKNOWN-PARTIAL-TIMING',async()=>{const current=await store.inspect(scope,key),a=artifact(current);assert.equal(await store.publish(scope,key,current.generation,a),true);assert.deepEqual(admittedHistoricalBasis(scope,await store.inspect(scope,key)),prepared);});
 await test('HIT-NO-CANONICAL-RECONSTRUCTION-OFF-NO-ADMISSION',async()=>{assert.deepEqual(await readHistoricalBasis(repository,range,store),prepared);let reads=0;const r={...repository,loadPurchaseAwareCanonical:async()=>{reads++;return{status:'PASS',facts:prepared.purchaseFacts};}};assert.deepEqual(await readHistoricalBasis(r,range),prepared);assert.equal(reads,1);});
 await test('CAS-CONCURRENT-PUBLISH-ONE-WINNER',async()=>{const current=await store.inspect(scope,key),a=artifact(current);const wins=await Promise.all([store.publish(scope,key,current.generation,a),store.publish(scope,key,current.generation,a)]);assert.equal(wins.filter(Boolean).length,1);});
 await test('LOST-RESPONSE-REINSPECT-RECOGNIZES-COMMIT',async()=>{const current=await store.inspect(scope,key),a=artifact(current);assert.equal(await store.publish(scope,key,current.generation,a),true);const next=await store.inspect(scope,key);assert.equal(next.generation,a.generation);assert.equal(next.artifact.digest,a.digest);assert.equal(await store.publish(scope,key,current.generation,a),false);});
 await test('ALL-22-DEPENDENCY-WRITERS-INSERT-UPDATE-DELETE-TRUNCATE',async()=>{
  for(const table of sourceNames){for(const sql of ['INSERT INTO public.'+table+' VALUES(1,1)','UPDATE public.'+table+' SET value=2 WHERE synthetic_id=1','DELETE FROM public.'+table+' WHERE synthetic_id=1','TRUNCATE public.'+table]){const before=await store.inspect(scope,key);await admin.query(sql);const after=await store.inspect(scope,key);assert.equal(Number(after.proof.revision),Number(before.proof.revision)+1);assert.equal(after.artifact,null);assert.equal(await store.publish(scope,key,before.generation,artifact(before)),false);}}
  for(const table of ['households','persons','private.household_memberships']){const name=table.includes('.')?table:'public.'+table;const before=await store.inspect(scope,key);await admin.query('UPDATE '+name+' SET '+(table==='households'?'timezone=timezone':table==='persons'?'person_id=person_id':'user_id=user_id')+' WHERE false');const after=await store.inspect(scope,key);assert.equal(Number(after.proof.revision),Number(before.proof.revision)+1);}
 });
 await test('ROLLBACK-NO-INVALIDATION',async()=>{const current=await store.inspect(scope,key);await admin.query('BEGIN');await admin.query('INSERT INTO operations VALUES(2,1)');await admin.query('ROLLBACK');assert.deepEqual((await store.inspect(scope,key)).proof,current.proof);});
 await test('AUTHORIZATION-AND-NO-DIRECT-DML',async()=>{for(const altered of [{...scope,userId:uuid(999)},{...scope,householdId:uuid(998)},{...scope,personIds:[]}])await assert.rejects(store.inspect(altered,plannerDigest(altered)),e=>e.code==='42501');await assert.rejects(actor.query('INSERT INTO private.composer_historical_basis_artifacts VALUES($1,$2,$3,1,$4,now())',[key,data.context.userId,data.context.householdId,{}]),e=>e.code==='42501');await assert.rejects(actor.query('SELECT public.publish_composer_historical_basis_v1($1,$2,0,$3)',[scope,key,{}]),e=>e.code==='42501');});
 await test('MEMBERSHIP-REVOCATION-FRESH-ON-EVERY-INSPECT',async()=>{await admin.query('BEGIN');await admin.query('DELETE FROM private.household_memberships WHERE user_id=$1',[data.context.userId]);assert.equal((await admin.query('SELECT private.composer_basis_scope_allowed($1,$2) ok',[scope,data.context.userId])).rows[0].ok,false);await admin.query('ROLLBACK');assert.ok((await store.inspect(scope,key)).proof);});
 await test('DISABLED-MISSING-TRIGGER-AND-DDL-FAIL-CLOSED',async()=>{await admin.query('UPDATE private.composer_historical_basis_state SET enabled=false');assert.equal((await store.inspect(scope,key)).proof,null);await admin.query('UPDATE private.composer_historical_basis_state SET enabled=true');await admin.query('ALTER TABLE operations DISABLE TRIGGER snap3_historical_basis_version');assert.equal((await store.inspect(scope,key)).proof,null);await admin.query('ALTER TABLE operations ENABLE ALWAYS TRIGGER snap3_historical_basis_version');await admin.query('CREATE OR REPLACE VIEW financial_bank_cost_canonical AS SELECT synthetic_id FROM operations WHERE value=1');assert.equal((await store.inspect(scope,key)).proof,null);});
 fs.mkdirSync('docs/status/evidence/p14-snap3',{recursive:true});fs.writeFileSync('docs/status/evidence/p14-snap3/canonical-native.json',JSON.stringify({environment:'PostgreSQL 17 synthetic, SQL roles not real JWT',database:db,results},null,2)+'\n');
}finally{await actor.end();await publisher.end();await admin.end();}
