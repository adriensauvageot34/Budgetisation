// Synthetic parity and read-graph checks. Never connects to Supabase.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {require} from './lib/phase2-ts-loader.mjs';

const baseSha='34798ffd4f9296d5196fc0d2e95d285ab8186c64';
const filename=path.resolve('src/server/phase2/month-prediction-evidence.baseline.ts');
const baselineModule=new Module(filename);baselineModule.filename=filename;
baselineModule.paths=Module._nodeModulePaths(path.dirname(filename));
baselineModule._compile(ts.transpileModule(execFileSync('git',['show',`${baseSha}:src/server/phase2/month-prediction-evidence.ts`],{encoding:'utf8'}),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const before=baselineModule.exports.readMonthPredictionEvidence;
const after=require('@/server/phase2/month-prediction-evidence').readMonthPredictionEvidence;
const {defaultMonthInputs}=require('@/server/phase2/month-scenario');
const {plannerDigest}=require('@/domain/phase2/planner/json');
const household='00000000-0000-4000-8000-000000000001',month='2026-07';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function fixture(){
 const operations=Array.from({length:1001},(_,i)=>({operation_id:`op:${i}`,date_bancaire:'2026-06-30',montant:'1.00',flux:'Dépense',source_system:'BANK',
  personne_concernee:null,type_precis:null,marchand:null,merchant_id:null,need_id:null,recurrence_series_id:null,reference_contrat:null,transfert_associe_operation_id:null}));
 const event=(id,status,amount)=>({household_id:household,purchase_event_id:id,purchase_visibility:'PURCHASE_AWARE_PILOT',
  gross_amount:amount,gross_amount_status:status,subcategory_id:'groceries',need_id:null,merchant_id:null,semantic_purpose:null});
 return {canonical_household_scope_control:[{household_count:1,household_id:household,status:'READY'}],
  households:[{household_id:household,timezone:'Europe/Paris'}],operations,
  financial_economic_cost_canonical:operations.map((op,i)=>({operation_id:op.operation_id,subcategory_id:'groceries',canonical_economic_net:'1.00',canonical_component_key:`component:${i}`})),
  subcategories:[{subcategory_id:'groceries',nom_canonique:'Courses alimentaires'}],needs:[],
  persons:[{household_id:household,person_id:'fixture-person',display_name:'Fixture person'}],
  import_batches:[{household_id:household,source_system:'BANK',status:'imported',coverage_status:'FULL',period_start:'2025-07-01',period_end:'2026-07-17'}],
  benefit_wallets:[],mobility_datasets:[],mobility_legs:[],benefit_wallet_ledger_entries:[],
  phase2_month_inputs:[{household_id:household,target_month:'2026-06-01',payload:{...defaultMonthInputs(),openingBalance:{amount:'500.00',asOfDate:'2026-06-30'}}}],
  purchase_events:[event('known','KNOWN','3.00'),event('partial','PARTIAL','4.00'),event('unknown','UNKNOWN',null)],
  purchase_event_memberships:[{household_id:household,purchase_event_id:'known',operation_id:'op:0',membership_kind:'BANK',purchase_event_membership_id:'m1'}],
  purchase_event_timing_assertions:['known','partial'].map(id=>({household_id:household,purchase_event_id:id,is_active:true,
   purchase_event_timing_assertion_id:`t:${id}`,timing_authority:'TRUSTED_PURCHASE_SOURCE',timing_precision:'DAY',economic_date:'2026-06-30',economic_month:'2026-06',evidence_refs:[]})),
  purchase_funding_components:[{household_id:household,purchase_event_id:'known',purchase_funding_component_id:'f1',funding_kind:'BANK_CARD',amount:'3.00',amount_status:'KNOWN',bank_operation_id:'op:0'}]};
}
function clientFor(tables,options={}){
 const reads=[];
 return {reads,from(table){assert(Object.hasOwn(tables,table),`Unexpected source ${table}`);
  const filters=[];let columns='',sort=null,limit=null,range=null,single=false,promise;
  const execute=()=>promise??=(async()=>{
   const log={table,columns,filters:[...filters],start:performance.now(),end:null};reads.push(log);
   await pause(options.delays?.[table]??0);
   let rows=structuredClone(tables[table]);
   for(const [op,key,value]of filters)rows=rows.filter(row=>op==='eq'?row[key]===value:op==='gte'?row[key]>=value:op==='lte'?row[key]<=value:row[key]<value);
   if(sort){const [key,ascending]=sort;rows.sort((a,b)=>String(a[key]).localeCompare(String(b[key]))*(ascending?1:-1));}
   if(limit!==null)rows=rows.slice(0,limit);if(range)rows=rows.slice(range[0],range[1]+1);
   log.end=performance.now();
   return {data:options.errors?.[table]?null:single?(rows[0]??null):rows,error:options.errors?.[table]??null};
  })();
  const q={select(value){columns=value;return q;},eq(key,value){filters.push(['eq',key,value]);return q;},
   gte(key,value){filters.push(['gte',key,value]);return q;},lte(key,value){filters.push(['lte',key,value]);return q;},
   lt(key,value){filters.push(['lt',key,value]);return q;},order(key,opts){sort=[key,opts?.ascending!==false];return q;},
   limit(value){limit=value;return q;},range(a,b){range=[a,b];return q;},maybeSingle(){single=true;return execute();},
   then(resolve,reject){return execute().then(resolve,reject);}};return q;
 }};
}
const checks=[];const check=async(name,run)=>{await run();checks.push(name);};
const opts={asOfDate:'2026-07-17',timezone:'Europe/Paris'};
await check('exact evidence parity with pagination, purchase replacement, PARTIAL and UNKNOWN',async()=>{
 const oldClient=clientFor(fixture()),newClient=clientFor(fixture());
 const [a,b]=await Promise.all([before(oldClient,household,month,false,opts),after(newClient,household,month,false,opts)]);
 assert.deepEqual(b,a);assert.equal(b.history.economicEntries.length,1002);
 assert(b.limitationCodes.includes('PURCHASE_DAY_UNRESOLVED'));assert(b.limitationCodes.includes('PURCHASE_AMOUNT_LOWER_BOUND'));
 assert.equal(newClient.reads.filter(r=>r.table==='financial_economic_cost_canonical').length,2);
 assert.equal(oldClient.reads.length-newClient.reads.length,1);assert(!newClient.reads.some(r=>r.table==='households'));
});
await check('standalone timezone, temporal boundaries and permissive history preserve output',async()=>{
 for(const target of ['2026-06','2026-07','2026-08'])for(const timezone of [undefined,'America/New_York']){
  const options={asOfDate:'2026-07-01',...(timezone?{timezone}:{})};
  assert.deepEqual(await after(clientFor(fixture()),household,target,true,options),await before(clientFor(fixture()),household,target,true,options));
 }
 const old=fixture(),next=fixture();old.operations=[];next.operations=[];
 await assert.rejects(after(clientFor(next),household,month,false,opts),/HISTORY_MISSING/);
 assert.deepEqual(await after(clientFor(next),household,month,true,opts),await before(clientFor(old),household,month,true,opts));
});
await check('scope is admitted before any downstream read',async()=>{
 const client=clientFor(fixture());
 await assert.rejects(after(client,'00000000-0000-4000-8000-000000000002',month,false,opts),/SCOPE_INVALID/);
 assert.deepEqual(client.reads.map(r=>r.table),['canonical_household_scope_control']);
});
await check('metadata failure remains authoritative over concurrent history failure',async()=>{
 const metadataError=new Error('metadata fixture failure'),historyError=new Error('history fixture failure');
 const client=clientFor(fixture(),{errors:{subcategories:metadataError,purchase_events:historyError},delays:{subcategories:8}});
 await assert.rejects(after(client,household,month,false,opts),error=>error===metadataError);
 await pause(12);
});
let graph;
await check('independent metadata and history overlap without a request cache',async()=>{
 const delays={subcategories:25,financial_economic_cost_canonical:35};
 const old=clientFor(fixture(),{delays}),next=clientFor(fixture(),{delays});
 const a=await before(old,household,month,false,opts),b=await after(next,household,month,false,opts);assert.deepEqual(b,a);
 const meta=next.reads.find(r=>r.table==='subcategories'),history=next.reads.find(r=>r.table==='financial_economic_cost_canonical');
 assert(history.start<meta.end,'history should not wait for independent metadata');
 const oldMeta=old.reads.find(r=>r.table==='subcategories'),oldHistory=old.reads.find(r=>r.table==='financial_economic_cost_canonical');
 assert(oldHistory.start>=oldMeta.end);
 const tables=fixture(),client=clientFor(tables),first=await after(client,household,month,false,opts);
 tables.financial_economic_cost_canonical[1].canonical_economic_net='2.00';
 const second=await after(client,household,month,false,opts);assert.notEqual(plannerDigest(first),plannerDigest(second));
 graph={referenceRequests:old.reads.length,candidateRequests:next.reads.length,timezoneRequestsAvoided:1,
  independentBarriersOverlap:true,syntheticDelaysOnly:true};
});
const result={status:'EXECUTED_PASS_SYNTHETIC_OWNER_READER_ONLY',baselineSha:baseSha,checks,graph,realPerformanceGain:'NOT_MEASURED',remoteWrites:0};
const out=process.argv[2];if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));
