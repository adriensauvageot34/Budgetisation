// Additional real-integration contracts on the existing synthetic PG17 database.
// No remote credentials, HTTP, source financial data, deletion or resets.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {require} from './lib/phase2-ts-loader.mjs';
import {connection,rpcClient,nativeSourceClient} from './lib/snap2-native-postgres.mjs';
import {history,uuid} from './fixtures/canonical-p14-p3.mjs';
import {householdId} from './fixtures/planner-headless.mjs';
const {CanonicalRepository}=require('@/server/canonical/repository');
const {createActivityHistoryStore}=require('@/server/phase2/planner/activity-history-store');
const {prepareRegisteredActivityHistory,trustedActivityHistoryStore}=require('@/server/phase2/planner/activity-history-maintenance');
const {activityHistoryPeriod}=require('@/server/phase2/planner/activity-history-period');
const {activityHistoryScope,admittedActivityHistory}=require('@/server/phase2/planner/activity-history-artifact');
const {plannerDigest}=require('@/domain/phase2/planner/json');
globalThis.fetch=async()=>{throw Error('SNAP_REAL_NATIVE_NETWORK_FORBIDDEN');};
const results=[],admin=await connection(),reader=await rpcClient(uuid(900)),publisher=await rpcClient(null,'service_role');
const context=history({household:householdId}).context;
Object.assign(context,{userId:uuid(900),contractVersion:'v2',dataRevision:1,analyticsRevision:1,asOf:'2026-10-05T10:00:00Z'});
const source=nativeSourceClient(admin),repository=new CanonicalRepository(source.client,context);
const period=activityHistoryPeriod(context,'2026-11',context.asOf),scope=activityHistoryScope(repository,period.range,period.cutoffDate),key=plannerDigest(scope);
const check=async(name,run)=>{await run();results.push({name,status:'PASS'});console.log(name+' PASS');};
try {
 await admin.query('UPDATE private.planner_activity_history_state SET enabled=true WHERE singleton');
 await check('MAINTENANCE-LOST-COMMIT-RECOVERED-WITHOUT-SECOND-PUBLISH',async()=>{
  const store=createActivityHistoryStore(reader,publisher);let writes=0;
  const result=await prepareRegisteredActivityHistory(repository,'2026-11',{...store,async publish(...args){writes++;assert.equal(await store.publish(...args),true);throw Error('synthetic lost response');}});
  assert.equal(result.status,'RECOVERED_COMMIT');assert.equal(writes,1);
  assert.ok(admittedActivityHistory(scope,await store.inspect(scope,key)));
 });
 await check('MAINTENANCE-DEFINITE-CAS-REJECTION-BOUNDED-TO-TWO',async()=>{
  const store=createActivityHistoryStore(reader,publisher);let writes=0;
  const result=await prepareRegisteredActivityHistory(repository,'2026-11',{...store,async publish(){writes++;return false;}});
  assert.equal(result.status,'STALE_REJECTED');assert.equal(writes,2);
 });
 const service={async rpc(name,args={}) {
  const fields=name==='registered_planner_activity_history_v1'?[]:['p_scope','p_key'];
  try {const {rows}=await publisher.c.query(`SELECT public.${name}(${fields.map((_,i)=>'$'+(i+1)).join(',')}) AS v`,fields.map(f=>args[f]));return {data:rows[0].v,error:null};}
  catch(error){return {data:null,error};}
 }};
 await check('TRUSTED-INSPECT-AND-REGISTRY-SERVICE-ONLY',async()=>{
  const trusted=trustedActivityHistoryStore(service);assert.ok(admittedActivityHistory(scope,await trusted.inspect(scope,key)));
  const registry=await service.rpc('registered_planner_activity_history_v1');assert.equal(registry.error,null);assert.ok(registry.data.length<=64);
  assert.ok(registry.data.some(s=>s.userId===context.userId));assert.ok(registry.data.every(s=>!('payload' in s)));
  for (const name of ['registered_planner_activity_history_v1','inspect_planner_activity_history_trusted_v1']) {
   const args=name.startsWith('inspect')?[scope,key]:[];
   await assert.rejects(reader.c.query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})`,args),e=>e.code==='42501');
  }
 });
 await check('TRUSTED-CURRENT-MEMBERSHIP-AND-BAN-NOT-CACHED',async()=>{
  await admin.query('BEGIN');
  try {
   await admin.query('UPDATE auth.users SET banned_until=now()+interval \'1 day\' WHERE id=$1',[context.userId]);
   // This admin session sees its pending ban; outside service sessions do not.
   const denied=await admin.query('SELECT private.activity_history_scope_allowed($1,$2) AS ok',[scope,context.userId]);assert.equal(denied.rows[0].ok,false);
  } finally {await admin.query('ROLLBACK');}
 });
 await check('PERIOD-SHARED-WITH-BASELINE-WITHOUT-DATE-CHANGE',async()=>{
  assert.equal(period.range.start,'2024-07-01');assert.equal(period.range.endExclusive,'2026-10-06');assert.equal(period.cutoffDate,'2026-10-05');
  assert.equal(activityHistoryPeriod(context,'2025-01',context.asOf).range.endExclusive,'2025-01-01');
 });
 fs.mkdirSync('outputs/p14-snap-real',{recursive:true});
 fs.writeFileSync('outputs/p14-snap-real/integration-native.json',JSON.stringify({environment:'PG17 synthetic only',results},null,2)+'\n');
} finally {await reader.close();await publisher.close();await admin.end();}
