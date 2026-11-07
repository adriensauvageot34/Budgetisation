/** Native DB-backed lifetime, drift and MAC tests. No shared infrastructure. */
import assert from 'node:assert/strict';import pg from 'pg';import{createHmac,randomUUID}from'node:crypto';import{setTimeout as pause}from'node:timers/promises';
import{createRootNativeRecipe}from'./lib/root-relation-native-recipe.mjs';import{require}from'./lib/phase2-ts-loader.mjs';import path from'node:path';
const moduleUnderTest=require(process.env.N1_WRITER_UNDER_TEST?path.resolve(process.env.N1_WRITER_UNDER_TEST):'@/server/phase2/planner/root-relation-durable-writer');
const{canonicalPlannerJson}=require('@/domain/phase2/planner/json');
process.env.COMPOSER_ROOT_RELATIONS_ENABLED='true';process.env.COMPOSER_ROOT_RELATIONS_DURABLE_SAVE_ENABLED='true';
const f=await createRootNativeRecipe(),checks=[],observations=[],writers=[];
const config={host:'127.0.0.1',port:55439,user:'composer_n1_server',database:f.database,ssl:false,application_name:'n1-lifetime-test'};
const key=(await f.db.query("select encode(signing_key,'hex') value from private.phase2_root_authority_key")).rows[0].value;
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function until(predicate){for(let i=0;i<600;i++){const r=await f.db.query("select pid,state,pg_blocking_pids(pid) blockers,extract(epoch from(clock_timestamp()-xact_start))*1000 transaction_age_ms,(select count(*)::int from pg_locks l where l.pid=a.pid and l.mode='ExclusiveLock' and l.granted and l.relation is not null) exclusive_tables from pg_stat_activity a where datname=current_database() and application_name='n1-lifetime-test'");if(predicate(r.rows))return r.rows;await pause(5);}throw Error('LIFETIME_BARRIER_NOT_REACHED');}
const check=async(name,fn)=>{await fn();checks.push(name);console.log(name+' PASS');};
const scope={userId:f.actor,householdId:f.householdId,targetMonth:'2026-11'};
async function signedOpen(client){const b=(await client.query('select pg_current_xact_id()::text xid,pg_backend_pid()::text pid')).rows[0];
 const proof={kind:'n1-session-scope@1',userId:f.actor,householdId:f.householdId,targetMonth:'2026-11',transactionId:b.xid,backendId:b.pid,nonce:randomUUID()};
 const mac=createHmac('sha256',Buffer.from(key,'hex')).update(canonicalPlannerJson(proof)).digest('hex');
 return client.query('select private.begin_root_draft_authority_v1($1,$2,$3,$4,$5)',[f.actor,f.householdId,'2026-11-01',proof,mac]);}
try{
 if(process.argv.includes('--baseline')){
  const writer=moduleUnderTest.createRootRelationWriter(config,key,180);writers.push(writer);const gate=deferred(),reached=deferred();let settled=false;
  const work=writer.run(scope,async()=>{reached.resolve();await gate.promise;return 'released';});void work.finally(()=>settled=true);await reached.promise;await pause(300);
  const active=await until(r=>r.some(x=>x.state==='idle in transaction'));assert.equal(settled,false);gate.resolve();await work;
  console.log(JSON.stringify({status:'BASELINE_REPRODUCED',defect:'TOTAL_JS_BUDGET_IGNORED_TRANSACTION_STILL_OPEN',active}));
 }else{
  await check('TOTAL_DEADLINE_RELEASES_LOCKS_AND_LATE_COMMIT_IS_REJECTED',async()=>{
   const writer=moduleUnderTest.createRootRelationWriter(config,key,220);writers.push(writer);const gate=deferred(),reached=deferred(),late=deferred();
   await f.db.query('create table public.n1_lifetime_unrelated(value int);insert into public.n1_lifetime_unrelated values(0)');
   const unrelated=new pg.Client({...config,user:'postgres',application_name:'n1-lifetime-unrelated'});await unrelated.connect();
   const before=JSON.stringify(await f.rows()),start=performance.now();
   const work=writer.run(scope,async tx=>{reached.resolve();await gate.promise;try{await tx.commit({},{});}catch(e){late.resolve(e.message);}return 'must not commit';});void work.catch(()=>{});
   await reached.promise;const held=await until(r=>r.some(x=>x.state==='idle in transaction'));assert(held[0].exclusive_tables>0);
   const waiting=unrelated.query('update public.n1_lifetime_unrelated set value=1');void waiting.catch(()=>{});
   let blocker;for(let i=0;i<100;i++){blocker=(await f.db.query('select pg_blocking_pids($1) blockers',[unrelated.processID])).rows[0].blockers;if(blocker.length)break;await pause(2);}assert(blocker.length);
   await assert.rejects(()=>work,/N1_AUTHORITY_TIMEOUT/);const elapsedMs=performance.now()-start;
   await until(r=>r.length===0);await waiting;await unrelated.end();gate.resolve();assert.equal(await late.promise,'N1_AUTHORITY_TIMEOUT');assert.equal(JSON.stringify(await f.rows()),before);
   // A new command can reuse the pool safely, on a fresh connection, after destruction.
   assert.equal(await writer.run(scope,async()=> 'fresh transaction'),'fresh transaction');observations.push({test:'NODE_TOTAL_DEADLINE',elapsedMs,held,noOpenBackend:true,lateCommitRefused:true,unrelatedWriterBlockers:blocker,unrelatedWriteRecovered:true});
  });
  await check('POSTGRES_TOTAL_TIMEOUT_SURVIVES_NODE_WITHOUT_WATCHDOG',async()=>{
   const c=new pg.Client(config);c.on('error',()=>{});await c.connect();let ended=false;c.on('end',()=>ended=true);
   try{await c.query("set transaction_timeout='160ms'");await c.query('begin');await signedOpen(c);const start=performance.now();
    await until(r=>!r.some(x=>x.pid===c.processID));await pause(0);assert(ended);observations.push({test:'DB_TOTAL_TIMEOUT',elapsedMs:performance.now()-start,backendTerminated:true});
   }finally{await c.end();}
  });
  await check('SQL_STATEMENT_FAILURE_DESTROYS_CONNECTION_AND_RELEASES_ALL_LOCKS',async()=>{
   const writer=moduleUnderTest.createRootRelationWriter(config,key);writers.push(writer);
   await assert.rejects(()=>writer.run(scope,()=>{throw Error('SYNTHETIC_AUTHORITY_NETWORK_FAILURE');}),/N1_DURABLE_UNAVAILABLE/);
   await until(r=>r.every(x=>x.state==='idle'));assert.equal(await writer.run(scope,async()=> 'recovered'),'recovered');
  });
  await check('LOCK_TIMEOUT_REFUSES_SAVE_AND_NEVER_RECYCLES_OPEN_TRANSACTION',async()=>{
   const blocker=new pg.Client({...config,user:'postgres',application_name:'n1-lifetime-blocker'});await blocker.connect();
   const writer=moduleUnderTest.createRootRelationWriter(config,key);writers.push(writer);let entered=false;
   try{await blocker.query('begin;lock table auth.users in row exclusive mode');const start=performance.now();
    const work=writer.run(scope,async()=>{entered=true;return 'must not enter';});void work.catch(()=>{});
    const blocked=await until(r=>r.some(x=>x.blockers.includes(blocker.processID)));await assert.rejects(()=>work,/N1_DRAFT_CONFLICT/);
    assert.equal(entered,false);await until(r=>!r.some(x=>x.state==='active'||x.state==='idle in transaction'||x.state==='idle in transaction (aborted)'));
    observations.push({test:'LOCK_TIMEOUT',elapsedMs:performance.now()-start,blocked,noAbortedTransaction:true});
   }finally{await blocker.query('rollback');await blocker.end();}
   assert.equal(await writer.run(scope,async()=> 'after lock timeout'),'after lock timeout');
  });
  await check('SHARED_RUNTIME_STAYS_CLOSED_EVEN_WITH_BOTH_GATES_AND_CREDENTIAL_NAMES',async()=>{
   process.env.COMPOSER_ROOT_RELATIONS_DATABASE_URL='postgresql://unprovisioned.invalid/never-connect';process.env.COMPOSER_ROOT_RELATIONS_AUTHORITY_KEY='a'.repeat(64);
   try{assert.equal(moduleUnderTest.runtimeRootRelationWriter(),undefined);}finally{delete process.env.COMPOSER_ROOT_RELATIONS_DATABASE_URL;delete process.env.COMPOSER_ROOT_RELATIONS_AUTHORITY_KEY;}
  });
  await check('HMAC_SQL_NODE_CONFORMITY_AND_CANONICAL_UNICODE',async()=>{
   for(const value of [{kind:'OPEN',unicode:'é😀',number:1e-7},[],{source:null,packet:{z:1,a:2}}]){
    const message=canonicalPlannerJson(value),expected=createHmac('sha256',Buffer.from(key,'hex')).update(message).digest('hex');
    assert.equal((await f.db.query("select private.root_draft_mac_v1(decode($1,'hex'),$2) value",[key,message])).rows[0].value,expected);
   }
  });
  await check('POST_PROVISION_MEMBERSHIP_AND_DIRECT_GRANT_DRIFT_REFUSE_OPENING',async()=>{
   const before=JSON.stringify(await f.rows());
   for(const [grant,revoke]of[
    ['grant authenticated to composer_n1_server','revoke authenticated from composer_n1_server'],
    ['grant select on phase2_composer_drafts to composer_n1_server','revoke select on phase2_composer_drafts from composer_n1_server']]){
    await f.db.query(grant);const c=new pg.Client(config);await c.connect();try{await c.query('begin');await assert.rejects(()=>signedOpen(c),e=>e.code==='42501'&&e.message==='N1_SERVER_ROLE_UNSAFE');}finally{await c.query('rollback');await c.end();await f.db.query(revoke);}
   }assert.equal(JSON.stringify(await f.rows()),before);
  });
  console.log(JSON.stringify({status:'PASS',checks,observations,database:f.database,sharedAuthorityProtocol:'NOT_RECEIVED',authRlsRemote:'NOT_RUN'}));
 }
}finally{await Promise.all(writers.map(w=>w.close()));await f.close();delete process.env.COMPOSER_ROOT_RELATIONS_ENABLED;delete process.env.COMPOSER_ROOT_RELATIONS_DURABLE_SAVE_ENABLED;}
