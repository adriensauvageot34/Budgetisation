// Supplement: a real row outside the consumed period, not only a zero-row UPDATE.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {require} from './lib/phase2-ts-loader.mjs';
import {history,uuid} from './fixtures/canonical-p14-p3.mjs';
import {householdId} from './fixtures/planner-headless.mjs';
import {connection,durableStore,nativeSourceClient} from './lib/snap2-native-postgres.mjs';
const {CanonicalRepository}=require('@/server/canonical/repository');
const {readActivityHistory,prepareActivityHistory}=require('@/server/phase2/planner/activity-history-artifact');
const {plannerDigest}=require('@/domain/phase2/planner/json');
globalThis.fetch=async()=>{throw Error('SNAP2_REMOTE_NETWORK_FORBIDDEN');};
process.env.COMPOSER_P14_P3_HISTORICAL_REUSE='0';process.env.COMPOSER_P14_SNAP1_ACTIVITY_HISTORY='1';
const data=history({household:householdId,unknown:true});Object.assign(data.context,{userId:uuid(900),contractVersion:'v2'});
const c=await connection(),port=await durableStore(data.context.userId),range={start:data.broad.start,endExclusive:'2026-10-06'},cutoff='2026-10-05';
const repo=()=>new CanonicalRepository(nativeSourceClient(c).client,data.context);
try{
 const original=await readActivityHistory(repo(),range,cutoff,port.store);
 await c.query("INSERT INTO life_events(life_event_id,life_event_type_id,start_date,end_date,validation_status,title) VALUES($1,$2,'2030-01-01','2030-01-01','Confirmé','Synthetic outside period')",[uuid(777005),uuid(50)]);
 assert.equal(await prepareActivityHistory(repo(),range,cutoff,port.store),true);
 const at=performance.now(),mutation=await c.query('UPDATE life_events SET title=title WHERE life_event_id=$1',[uuid(777005)]),mutationMs=performance.now()-at;
 assert.equal(mutation.rowCount,1);const events=[];
 const facts=await readActivityHistory(repo(),range,cutoff,port.store,e=>events.push(e));
 assert.equal(events[0].reason,'SOURCE_VERSION_CHANGED');assert.deepEqual(facts,original);
 assert.equal(await prepareActivityHistory(repo(),range,cutoff,port.store),true);
 const proof={status:'PASS_NATIVE_SYNTHETIC',rowCount:1,outsideRange:true,n:1,mutationMs,unchangedFactsDigest:plannerDigest(facts),events,
  automaticReconstructions:0,explicitPreparations:2,financialWrites:0};
 fs.writeFileSync('outputs/p14-snap2/unrelated-period.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await port.close();await c.end();}
