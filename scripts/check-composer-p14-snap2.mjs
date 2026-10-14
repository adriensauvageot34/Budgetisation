// Native PostgreSQL 17, exclusively synthetic. No Supabase, credentials or HTTP.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {require} from './lib/phase2-ts-loader.mjs';
import {history,uuid} from './fixtures/canonical-p14-p3.mjs';
import {householdId} from './fixtures/planner-headless.mjs';
import {connection,setupNative,nativeSourceClient,durableStore,rpcClient} from './lib/snap2-native-postgres.mjs';
import {isolatedStore} from './lib/snap1-isolated-store.mjs';
import {checkNativeWorld} from './lib/snap2-world-check.mjs';
const {CanonicalRepository}=require('@/server/canonical/repository');
const {plannerDigest}=require('@/domain/phase2/planner/json');
const {readActivityHistory,prepareActivityHistory,activityHistoryScope}=require('@/server/phase2/planner/activity-history-artifact');
globalThis.fetch=async()=>{throw Error('SNAP2_REMOTE_NETWORK_FORBIDDEN');};
process.env.COMPOSER_P14_P3_HISTORICAL_REUSE='0';
process.env.COMPOSER_P14_SNAP1_ACTIVITY_HISTORY='1';
const out=path.resolve(process.env.SNAP2_OUTPUT??'outputs/p14-snap2');fs.mkdirSync(out,{recursive:true});
const data=history({household:householdId,unknown:true});
Object.assign(data.context,{userId:uuid(900),contractVersion:'v2',dataRevision:1,analyticsRevision:1,asOf:'2026-10-05T10:00:00Z'});
const range={start:data.broad.start,endExclusive:'2026-10-06'},cutoff='2026-10-05';
const eventId=data.tables.life_events[0].life_event_id;
data.tables.life_event_financial_links=[null,'12.00'].map((economic_amount_linked,i)=>({financial_link_id:uuid(950+i),life_event_id:eventId,source_kind:'Operation',operation_id:uuid(960+i),
 allocation_id:null,item_id:null,cash_use_id:null,relation_type:'Preparation',economic_amount_linked,validation_status:'Confirmé'}));
const scope=activityHistoryScope({context:data.context},range,cutoff),key=plannerDigest(scope);
if(process.argv.includes('--child')){
 const admin=await connection(),port=await durableStore(data.context.userId);try{
  const source=nativeSourceClient(admin),events=[];
  const facts=await readActivityHistory(new CanonicalRepository(source.client,data.context),range,cutoff,port.store,e=>events.push(e));
  assert.equal(events[0].status,'HIT');assert.equal(source.calls.length,0);
  const backend=(await port.reader.c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  console.log(JSON.stringify({pid:process.pid,backend,status:'PASS',digest:plannerDigest(facts),sourceReads:0}));
 }finally{await port.close();await admin.end();}process.exit(0);
}
const checks=[],preparations=[],benchmarks=[],costs=[],races=[],independent=[],sameEngine=[];
let worldProof;
let sqlProperties;
let admin,port,writer,other;
const summary=items=>{const a=items.toSorted((a,b)=>a-b);return {n:a.length,p50:a[Math.ceil(a.length*.5)-1],p95:a[Math.ceil(a.length*.95)-1],min:a[0],max:a.at(-1)};};
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'});console.log(name+' PASS');};
const inspect=()=>port.store.inspect(scope,key);
const read=async({enabled=true,context=data.context,selectedRange=range,store=port.store,sourceOptions={}}={})=>{
 process.env.COMPOSER_P14_SNAP1_ACTIVITY_HISTORY=enabled?'1':'0';const source=nativeSourceClient(admin,sourceOptions),events=[],before=port.reader.metrics.length,at=performance.now();
 const facts=await readActivityHistory(new CanonicalRepository(source.client,context),selectedRange,cutoff,store,e=>events.push(e));
 const rpcs=port.reader.metrics.slice(before);
 return {ms:performance.now()-at,facts,digest:plannerDigest(facts),events,reads:source.calls.length+rpcs.length,sourceReads:source.calls.length,
  bytes:source.calls.reduce((n,c)=>n+c.bytes,0)+rpcs.reduce((n,c)=>n+c.bytes,0)};
};
const prepare=async({store=port.store,sourceOptions={}}={})=>{
 const source=nativeSourceClient(admin,sourceOptions),at=performance.now(),events=[];
 const result=await prepareActivityHistory(new CanonicalRepository(source.client,data.context),range,cutoff,store,e=>events.push(e));
 preparations.push({ok:result,ms:performance.now()-at,reads:source.calls.length,events});return result;
};
const nextArtifact=current=>{const {digest,...body}=current.artifact;body.proof=current.proof;body.generation=current.generation+1;return {...body,digest:plannerDigest(body)};};
const snapshotCanaries=async()=>plannerDigest((await admin.query(`SELECT
 (SELECT jsonb_agg(t) FROM household_revisions t) AS revisions,
 (SELECT jsonb_agg(t) FROM analytics_publications t) AS publications,
 (SELECT jsonb_agg(t) FROM analytics_artifacts t) AS artifacts`)).rows);
const deny=promise=>assert.rejects(promise,e=>e.code==='42501');
try{
 admin=await setupNative(data);port=await durableStore(data.context.userId);writer=await connection();other=await connection();
 await writer.query('SET ROLE snap2_importer');const beforeCanaries=await snapshotCanaries();
 await check('01-DISABLED-THEN-EXACT-HIT',async()=>{
  assert.equal((await read()).events[0].status,'MISS');await assert.rejects(()=>prepare(),/WRITERS_NOT_COVERED/);
  await admin.query('UPDATE private.planner_activity_history_state SET enabled=true');
  assert.equal(await prepare(),true);const a=await read({enabled:false}),b=await read();
  assert.deepEqual(b.facts,a.facts);assert.equal(b.events[0].status,'HIT');assert.equal(b.sourceReads,0);assert.equal(b.reads,1);
  assert.equal(b.facts.links[0].economicAmountLinked,null);assert.ok(b.facts.occurrences.some(f=>f.parentLifeEventId));
 });
 await check('02-ALL-FOUR-TABLES-INSERT-UPDATE-DELETE-TRUNCATE-ROLLBACK',async()=>{
  for(const table of ['life_events','life_event_types','life_event_participations','life_event_financial_links']){
   const row={...data.tables[table][0]};delete row.extra_unselected;
   if(table==='life_events')row.life_event_id=uuid(777001);
   if(table==='life_event_types')row.life_event_type_id=uuid(777002);
   if(table==='life_event_financial_links')row.financial_link_id=uuid(777003);
   const fields=Object.keys(row),base=(await inspect()).proof;
   await writer.query('BEGIN');
   try{
    const rev=async()=>Number((await admin.query('SELECT revision FROM private.planner_activity_history_state')).rows[0].revision);
    const initial=await rev();
    await writer.query(`INSERT INTO ${table}(${fields.join(',')}) VALUES(${fields.map((_,i)=>'$'+(i+1)).join(',')})`,fields.map(f=>row[f]));
    // Other sessions still see committed source/version, not the uncommitted increment.
    assert.equal(await rev(),initial);assert.equal((await read()).events[0].status,'HIT');
    await writer.query(`UPDATE ${table} SET ${fields[0]}=${fields[0]}`);
    await writer.query(`DELETE FROM ${table}`);await writer.query(`TRUNCATE ${table}`);
   }finally{await writer.query('ROLLBACK');}
   assert.deepEqual((await inspect()).proof,base);assert.equal((await read()).events[0].status,'HIT');
   // Each operation also commits, proving transactional invalidation (restore only synthetic rows).
   await writer.query(`INSERT INTO ${table}(${fields.join(',')}) VALUES(${fields.map((_,i)=>'$'+(i+1)).join(',')})`,fields.map(f=>row[f]));
   assert.equal((await read()).events[0].status,'MISS');await prepare();
   await writer.query(`UPDATE ${table} SET ${fields[0]}=${fields[0]}`);assert.equal((await read()).events[0].status,'MISS');await prepare();
   const priorDelete=(await inspect()).proof;
   await writer.query(`DELETE FROM ${table}`);assert.notDeepEqual((await inspect()).proof,priorDelete);
   if(table==='life_event_types')await assert.rejects(()=>read(),/Life_event_type est absent/);
   else assert.equal((await read()).events[0].status,'MISS');
   const priorTruncate=(await inspect()).proof;
   await writer.query(`TRUNCATE ${table}`);assert.notDeepEqual((await inspect()).proof,priorTruncate);
   if(table!=='life_event_types')assert.equal((await read()).events[0].status,'MISS');
   for(const original of data.tables[table]){const names=Object.keys(original).filter(f=>f!=='extra_unselected');
    await writer.query(`INSERT INTO ${table}(${names.join(',')}) VALUES(${names.map((_,i)=>'$'+(i+1)).join(',')})`,names.map(f=>original[f]));}
   await prepare();
  }
 });
 await check('03-RETROACTIVE-AND-REPLICA-WRITERS',async()=>{
  await admin.query("SET session_replication_role=replica");
  await admin.query('UPDATE life_events SET start_date=$2,end_date=$2 WHERE life_event_id=$1',[eventId,'2024-06-01']);
  await admin.query('SET session_replication_role=origin');const b=await read();assert.equal(b.events[0].status,'MISS');
  assert.ok(!b.facts.occurrences.some(f=>f.lifeEventId===eventId));
  await writer.query('UPDATE life_events SET start_date=$2,end_date=$2 WHERE life_event_id=$1',[eventId,data.tables.life_events[0].start_date]);await prepare();
 });
 await check('04-MUTATION-DURING-PREPARATION-REJECTED',async()=>{
  let once=false;const g=(await inspect()).generation;
  assert.equal(await prepare({sourceOptions:{before:async table=>{if(table==='life_events'&&!once){once=true;await writer.query('UPDATE life_events SET title=title WHERE life_event_id=$1',[eventId]);}}}}),false);
  assert.equal((await inspect()).generation,g);await prepare();
 });
 await check('05-TWO-ACTUAL-CONCURRENT-PUBLISHERS-CAS',async()=>{
  const second=await durableStore(data.context.userId);try{
   const current=await inspect(),a=nextArtifact(current),at=performance.now();
   const result=await Promise.all([port.store.publish(scope,key,current.generation,a),second.store.publish(scope,key,current.generation,a)]);
   assert.equal(result.filter(Boolean).length,1);assert.equal((await inspect()).generation,current.generation+1);
   assert.equal(await port.store.publish(scope,key,current.generation,a),false);
   races.push({kind:'simultaneous-publish',ms:performance.now()-at,accepted:result});
  }finally{await second.close();}
 });
 await check('06-WRITER-LOCK-OVERLAP-WITH-PUBLISH-AND-READ',async()=>{
  const current=await inspect(),a=nextArtifact(current);
  await writer.query('BEGIN');await writer.query('UPDATE life_events SET title=title WHERE life_event_id=$1',[eventId]);
  const writerPid=(await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  const pubPid=(await port.publisher.c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  const at=performance.now(),pending=port.store.publish(scope,key,current.generation,a);let blocked=false;
  try{
   for(let i=0;i<100;i++){const r=await other.query('SELECT $1::int=ANY(pg_blocking_pids($2)) AS blocked',[writerPid,pubPid]);
    if(r.rows[0].blocked){blocked=true;break;}await new Promise(r=>setTimeout(r,10));}
   assert.equal(blocked,true,'actual overlapping backend lock required');
   assert.equal((await read()).events[0].status,'HIT'); // prior committed version, while mutation is invisible
  }finally{await writer.query('COMMIT');}
  assert.equal(await pending,false);assert.equal((await read()).events[0].status,'MISS');
  races.push({kind:'writer-blocks-publish',observedBlockingPid:true,ms:performance.now()-at});await prepare();
 });
 await check('07-PUBLICATION-FAILURE-AND-LOST-RESPONSE-RECOVERY',async()=>{
  const current=await inspect();
  await admin.query(`CREATE FUNCTION private.snap2_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_PUBLICATION_FAILURE'; END $$;
   CREATE TRIGGER snap2_test_fail BEFORE INSERT OR UPDATE ON private.planner_activity_history_artifacts FOR EACH ROW EXECUTE FUNCTION private.snap2_test_fail()`);
  await assert.rejects(()=>prepare(),e=>e.message==='SYNTHETIC_PUBLICATION_FAILURE');assert.equal((await inspect()).generation,current.generation);
  await admin.query('DROP TRIGGER snap2_test_fail ON private.planner_activity_history_artifacts; DROP FUNCTION private.snap2_test_fail()');
  let writes=0;const lost={...port.store,async publish(...args){writes++;assert.equal(await port.store.publish(...args),true);throw Error('SYNTHETIC_RESPONSE_LOST_AFTER_COMMIT');}};
  await assert.rejects(()=>prepare({store:lost}),/RESPONSE_LOST/);
  const recovered=await inspect();assert.equal(recovered.generation,current.generation+1);assert.equal(writes,1);
  assert.equal((await read()).events[0].status,'HIT'); // recognition via re-read, no second mutation
 });
 await check('08-TWO-INDEPENDENT-PROCESSES-PERSISTED-HIT',async()=>{
  for(let i=0;i<2;i++){const result=spawnSync(process.execPath,[process.argv[1],'--child'],{env:process.env,encoding:'utf8',timeout:60000});
   if(result.error)throw result.error;assert.equal(result.status,0,result.stderr);independent.push(JSON.parse(result.stdout));}
  assert.notEqual(independent[0].pid,independent[1].pid);assert.notEqual(independent[0].backend,independent[1].backend);
  assert.equal(independent[0].digest,independent[1].digest);
 });
 await check('09-NATIVE-PERMISSIONS-RLS-AND-CURRENT-MEMBERSHIP',async()=>{
  await admin.query('INSERT INTO auth.users(id) VALUES($1),($2)',[uuid(901),uuid(902)]);
  await admin.query('INSERT INTO households VALUES($1,$2)',[uuid(990),'Europe/Paris']);
  await admin.query('INSERT INTO private.household_memberships VALUES($1,$2),($3,$4)',[uuid(901),householdId,uuid(902),uuid(990)]);
  for(const [actor,role] of [[uuid(901),'authenticated'],[uuid(902),'authenticated'],[null,'anon']]){
   const r=await rpcClient(actor,role);try{const denial=await r.rpc('inspect_planner_activity_history_v1',{p_scope:scope,p_key:key});assert.equal(denial.error?.code,'42501');}
   finally{await r.close();}
  }
  await deny(port.reader.c.query('SELECT * FROM private.planner_activity_history_artifacts'));
  await deny(port.reader.c.query('UPDATE private.planner_activity_history_artifacts SET generation=generation'));
  await deny(port.reader.c.query('INSERT INTO private.planner_activity_history_artifacts(scope_key,owner_user_id,household_id,generation,artifact) VALUES($1,$2,$3,1,$4)',[key,data.context.userId,householdId,{}]));
  await deny(port.reader.c.query('DELETE FROM private.planner_activity_history_artifacts'));
  assert.equal((await port.reader.rpc('publish_planner_activity_history_v1',{p_scope:scope,p_key:key,p_expected_generation:0,p_artifact:{}})).error?.code,'42501');
  // Prove native RLS itself also denies rows, even if SELECT were accidentally granted.
  await admin.query('GRANT SELECT ON private.planner_activity_history_artifacts TO authenticated');
  assert.equal((await port.reader.c.query('SELECT * FROM private.planner_activity_history_artifacts')).rows.length,0);
  await admin.query('REVOKE SELECT ON private.planner_activity_history_artifacts FROM authenticated');
  await admin.query('DELETE FROM private.household_memberships WHERE user_id=$1',[data.context.userId]);await deny(inspect());
  await admin.query('INSERT INTO private.household_memberships VALUES($1,$2)',[data.context.userId,householdId]);
  assert.equal((await read()).events[0].status,'MISS');await prepare();
  await admin.query("UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id=$1",[data.context.userId]);await deny(inspect());
  await admin.query('UPDATE auth.users SET banned_until=NULL WHERE id=$1',[data.context.userId]);
 });
 await check('10-SCOPE-TIMEZONE-PERIOD-METHOD-PERSON',async()=>{
  await deny(read({context:{...data.context,personIds:[uuid(777)]}}));
  await deny(read({context:{...data.context,householdId:uuid(990)}}));
  const invalid={...scope,method:'incompatible'};await deny(port.store.inspect(invalid,plannerDigest(invalid)));
  const absent=await read({selectedRange:{start:'2023-01-01',endExclusive:'2023-02-01'}});assert.equal(absent.events[0].status,'MISS');assert.deepEqual(absent.facts,{occurrences:[],links:[]});
  await admin.query('UPDATE households SET timezone=$2 WHERE household_id=$1',[householdId,'America/New_York']);await deny(inspect());
  assert.equal((await read({context:{...data.context,timezone:'America/New_York'}})).events[0].status,'MISS');
  await admin.query('UPDATE households SET timezone=$2 WHERE household_id=$1',[householdId,data.context.timezone]);await prepare();
 });
 await check('11-CORRUPTION-INCOMPLETE-PAGE-NULL-PAYLOAD',async()=>{
  const current=await inspect();
  await admin.query("UPDATE private.planner_activity_history_artifacts SET artifact=jsonb_set(artifact,'{payload,occurrences}','[]') WHERE scope_key=$1",[key]);
  await assert.rejects(()=>read(),/CORRUPT_OR_INCOMPATIBLE/);
  await admin.query('UPDATE private.planner_activity_history_artifacts SET artifact=$2 WHERE scope_key=$1',[key,current.artifact]);
  await assert.rejects(()=>prepare({sourceOptions:{cap:100}}),/INCOMPLETE_SOURCE/);
  await assert.rejects(()=>port.store.publish(scope,key,current.generation,null),e=>e.code==='23514');
  await assert.rejects(()=>port.store.publish(scope,key,current.generation,{...nextArtifact(current),digest:'forged'}),e=>e.code==='23514');
  assert.equal((await inspect()).generation,current.generation);
 });
 await check('12-DISABLE-DDL-PROTOCOL-AND-EXACT-OFF',async()=>{
  const expected=(await read()).facts;
  await admin.query('UPDATE private.planner_activity_history_state SET enabled=false');assert.equal((await read()).events[0].status,'MISS');
  await admin.query('ALTER TABLE life_events DISABLE TRIGGER snap2_activity_history_version');
  await writer.query('UPDATE life_events SET title=title');await admin.query('UPDATE private.planner_activity_history_state SET enabled=true');
  assert.equal((await read()).events[0].reason,'DEPENDENCY_COVERAGE_UNAVAILABLE');await assert.rejects(()=>prepare(),/WRITERS_NOT_COVERED/);
  await admin.query('ALTER TABLE life_events ENABLE ALWAYS TRIGGER snap2_activity_history_version');
  await admin.query('UPDATE private.planner_activity_history_state SET schema_epoch=schema_epoch+1');
  assert.equal((await read()).events[0].status,'MISS');await prepare();
  const broken={inspect:async()=>{throw Error('storage unavailable');}};
  const off=await read({enabled:false,store:broken});assert.deepEqual(off.facts,expected);assert.equal(off.events[0].status,'OFF');
  process.env.COMPOSER_P14_SNAP1_ACTIVITY_HISTORY='1';
 });
 await check('13-EXISTING-PUBLICATIONS-REVISIONS-UNCHANGED',async()=>assert.equal(await snapshotCanaries(),beforeCanaries));
 await check('14-BOUNDED-NATIVE-COSTS-AND-IMPORT-COALESCING',async()=>{
  await prepare();
  for(let i=0;i<40;i++){
   const pair={};for(const side of i%2?['hit','direct']:['direct','hit']){const r=await read({enabled:side==='hit'});delete r.facts;pair[side]=r;}
   assert.equal(pair.hit.digest,pair.direct.digest);benchmarks.push(pair);
  }
  for(let i=0;i<20;i++){
   const at=performance.now();await writer.query('UPDATE life_events SET title=title WHERE life_event_id=$1',[eventId]);const mutation=performance.now()-at;
   const miss=await read();assert.equal(miss.events[0].status,'MISS');await prepare();costs.push({mutation,miss:miss.ms,validation:miss.events[0].validationMs});
  }
  const g=(await inspect()).generation;
  for(let i=0;i<10;i++)await writer.query('UPDATE life_events SET title=title WHERE life_event_id=$1',[eventId]);
  assert.equal((await inspect()).generation,g);assert.equal(await prepare(),true);assert.equal((await inspect()).generation,g+1);
  // Global invalidation is intentionally conservative, including an unrelated date.
  const at=performance.now();await writer.query("UPDATE life_events SET title=title WHERE start_date>'2026-10-05'");
  costs.push({unrelatedPeriodMutation:performance.now()-at});assert.equal((await read()).events[0].status,'MISS');await prepare();
 });
 await check('15-SNAP1-SNAP2-SAME-NATIVE-ENGINE-CONSUMPTION',async()=>{
  const c=await connection();const bridge={waitReady:Promise.resolve(),query:(...a)=>c.query(...a),exec:s=>c.query(s),close:()=>c.end(),
   async transaction(fn){await c.query('BEGIN');try{const value=await fn(this);await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK');throw e;}}};
  const s1=await isolatedStore(null,{initialize:true,data,nativeTestDatabase:bridge});try{
   assert.equal(await prepareActivityHistory(new CanonicalRepository(s1.client,data.context),range,cutoff,s1.store),true);
   for(let i=0;i<40;i++){const pair={};for(const side of i%2?['snap2','snap1']:['snap1','snap2']){
    const r=await read({store:side==='snap1'?s1.store:port.store});delete r.facts;pair[side]=r;}
    assert.equal(pair.snap1.digest,pair.snap2.digest);sameEngine.push(pair);}
  }finally{await s1.close();}
 });
 await check('16-INTEGRATED-WORLD-LIVE-OWNERS-FINANCE-AND-APPLY',async()=>{worldProof=await checkNativeWorld({admin,port,data,scope,key});});
 await check('17-CANDIDATE-OWNERS-SEARCH-PATH-GRANTS-RLS',async()=>{
  const functions=(await admin.query(`SELECT n.nspname AS schema,p.proname AS name,r.rolname AS owner,p.prosecdef AS definer,p.proconfig AS settings
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
   WHERE p.proname=ANY($1) ORDER BY p.proname`,[['bump_planner_activity_history','fence_planner_activity_history_configuration','activity_history_canonical_json',
    'activity_history_scope_allowed','activity_history_writer_coverage','activity_history_proof','inspect_planner_activity_history_v1','publish_planner_activity_history_v1']])).rows;
  assert.equal(functions.length,8);for(const f of functions){assert.equal(f.owner,'postgres');assert.ok(f.settings.includes('search_path=""'));}
  const tables=(await admin.query("SELECT relname,relrowsecurity FROM pg_class WHERE relnamespace='private'::regnamespace AND relkind='r' AND relname LIKE 'planner_activity_history_%' ORDER BY relname")).rows;
  assert.equal(tables.length,2);assert.ok(tables.every(t=>t.relrowsecurity));
  const grants=(await admin.query(`SELECT
   has_function_privilege('authenticated','public.inspect_planner_activity_history_v1(jsonb,text)','EXECUTE') AS auth_inspect,
   has_function_privilege('anon','public.inspect_planner_activity_history_v1(jsonb,text)','EXECUTE') AS anon_inspect,
   has_function_privilege('authenticated','public.publish_planner_activity_history_v1(jsonb,text,bigint,jsonb)','EXECUTE') AS auth_publish,
   has_function_privilege('service_role','public.publish_planner_activity_history_v1(jsonb,text,bigint,jsonb)','EXECUTE') AS service_publish,
   has_table_privilege('service_role','private.planner_activity_history_artifacts','INSERT') AS service_direct_dml`)).rows[0];
  assert.deepEqual(grants,{auth_inspect:true,anon_inspect:false,auth_publish:false,service_publish:true,service_direct_dml:false});
  sqlProperties={functions,tables,grants};
 });
 const stored=await inspect();
 const report={status:'EXECUTED_PASS_NATIVE_POSTGRESQL_17_SYNTHETIC_ONLY',checks,races,independent,
  databaseVersion:(await admin.query('SHOW server_version')).rows[0].server_version,
  segment:Object.fromEntries(['direct','hit'].map(side=>[side,{...summary(benchmarks.map(p=>p[side].ms)),reads:benchmarks[0][side].reads,bytes:benchmarks[0][side].bytes}])),
  validation:summary(benchmarks.map(p=>p.hit.events[0].validationMs)),decode:summary(benchmarks.map(p=>p.hit.events[0].decodeMs)),
  mutation:summary(costs.filter(c=>c.mutation!==undefined).map(c=>c.mutation)),miss:summary(costs.filter(c=>c.miss!==undefined).map(c=>c.miss)),
  publication:summary(port.publisher.metrics.filter(m=>m.status==='OK').map(m=>m.ms)),
  sameEngine:{description:'Unchanged SNAP1 admission/store SQL on native PG17 through test bridge; same fixture, decoder and process as SNAP2. Historical PGlite timings are not directly comparable.',
   snap1:summary(sameEngine.map(p=>p.snap1.ms)),snap2:summary(sameEngine.map(p=>p.snap2.ms)),pairs:sameEngine},
  world:{...worldProof,segment:Object.fromEntries(['direct','hit'].map(side=>[side,{...summary(worldProof.benchmarks.map(p=>p[side].ms)),reads:worldProof.benchmarks[0][side].reads}]))},
  artifactBytes:Buffer.byteLength(JSON.stringify(stored.artifact)),preparations,benchmarks,costs,
  importBatch:{writes:10,reconstructionsAutomaticallyTriggered:0,explicitPreparations:1},nativeRLS:'EXECUTED_PASS_SYNTHETIC_ROLES',supabaseJWT:'NOT_RUN',remoteWrites:0,
  flags:{P3:'0',snapshotRuntimeDefault:'OFF',productionAdapterWiring:'NONE'}};
 report.sqlProperties=sqlProperties;
 fs.writeFileSync(path.join(out,'native-tests.json'),JSON.stringify(report,null,2));console.log('SNAP2 NATIVE PASS '+JSON.stringify(report.segment));
}catch(error){fs.writeFileSync(path.join(out,'native-failure.json'),JSON.stringify({checks,error:{name:error.name,message:error.message,code:error.code,stack:error.stack}},null,2));throw error;}
finally{await port?.close();await writer?.end();await other?.end();await admin?.end();}
