/** Contradictory contention receipt. Independent native PG clients + pg_blocking_pids barriers.
 * Synthetic local cluster only; blocked writes are OBSERVED risks, never performance PASSes. */
import assert from 'node:assert/strict';import fs from 'node:fs';import pg from 'pg';
import {setTimeout as pause} from 'node:timers/promises';
import{createRootNativeRecipe}from'./lib/root-relation-native-recipe.mjs';import{require}from'./lib/phase2-ts-loader.mjs';
const{saveRootRelationDurableDraft}=require('@/server/phase2/planner/root-relation-durable-service');
const{rootRelationDocument}=require('@/domain/phase2/planner/root-relation-local');
const{rootRelationStateDigest}=require('@/domain/phase2/planner/root-relation-state');
const{semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
process.env.COMPOSER_ROOT_RELATIONS_ENABLED='true';process.env.COMPOSER_ROOT_RELATIONS_DURABLE_SAVE_ENABLED='true';
const f=await createRootNativeRecipe(),checks=[],observations=[],clients=[],heldReleases=[];let request=6000;
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const group={version:'root-context-relation@v1',relationId:f.groupId,targetMonth:'2026-11',orderedContextIds:f.ids.slice(0,3),provenance:'EXPLICIT_USER_DECISION'};
const document=rootRelationDocument({draft:f.base,relations:[group]});
const packet=row=>({contract:'composer-draft-http@2-root-relations',kind:'SAVE',command:{targetMonth:'2026-11',expectedDraftId:row.draft_id,expectedDraftVersion:row.draft_version,
 expectedDocumentVersion:row.semantic_state.version,expectedDraftDigest:row.semantic_state_digest,expectedBaseRevisionId:row.base_plan_revision_id,expectedBaseRevisionNumber:row.base_plan_revision_number,
 requestId:`f07b0000-0000-4000-8000-${String(++request).padStart(12,'0')}`,semanticState:document,digest:rootRelationStateDigest(document)}});
async function client(actor){const c=new pg.Client({host:'127.0.0.1',port:55439,user:'postgres',database:f.database,ssl:false});await c.connect();clients.push(c);
 if(actor){await c.query('set role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);}return c;}
async function until(sql,args,predicate){for(let i=0;i<800;i++){const r=await f.db.query(sql,args);if(predicate(r.rows))return r.rows;await pause(5);}throw Error('PG_BARRIER_NOT_REACHED '+sql);}
const pendingFor=pid=>until('select pid,wait_event,pg_blocking_pids(pid) blockers from pg_stat_activity where pid=$1',[pid],r=>r[0]?.blockers.length);
async function heldSave(){const reached=deferred(),release=deferred(),s=await f.scope(),before=(await f.rows())[0];let holder;const measurement={};
 heldReleases.push(release.resolve);
 const writer=s.writer;s.writer={run:(scope,work)=>writer.run(scope,tx=>work({commit:async(...args)=>{
  const info=(await f.db.query("select pid,xact_start,clock_timestamp() observed_at,extract(epoch from(clock_timestamp()-xact_start))*1000 age_ms from pg_stat_activity where datname=current_database() and usename='composer_n1_server' and state='idle in transaction'")).rows[0];holder=info.pid;Object.assign(measurement,{xactStart:info.xact_start,ownerAdmittedAt:info.observed_at,transactionAgeAtAdmissionMs:Number(info.age_ms)});
  reached.resolve();await release.promise;return tx.commit(...args);}}))};
 const pending=saveRootRelationDurableDraft(s,packet(before)).then(async result=>{measurement.receiptObservedAt=(await f.db.query('select clock_timestamp() t')).rows[0].t;return result;});void pending.catch(()=>{});await Promise.race([reached.promise,pending.then(()=>{throw Error('MISSING_BARRIER');})]);
 return{pending,release:()=>release.resolve(),holder,before,measurement};}
const check=async(name,fn)=>{await fn();checks.push(name);console.log(name+' PASS (assertions)');};
const oldSave=(c,household,month,doc,row=null)=>c.query('select public.save_phase2_composer_draft_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) value',
 [household,month+'-01',row?.draft_id??null,row?.draft_version??0,`f07b0000-0000-4000-8000-${String(++request).padStart(12,'0')}`,null,null,0,doc,semanticStateDigest(doc)]);
try{
 await f.db.query(`create table public.n1_unrelated(household_id uuid,month date,value int);alter table public.n1_unrelated enable row level security;
 grant select,update on public.n1_unrelated to authenticated;
 create policy own_read on public.n1_unrelated to authenticated using(private.user_has_household_access(household_id)) with check(private.user_has_household_access(household_id));`);
 await f.db.query("insert into public.n1_unrelated values($1,'2026-11-01',0),($1,'2026-12-01',0),($2,'2026-11-01',0)",[f.householdId,f.foreignHousehold]);
 let inventory;
 await check('T1_UNRELATED_WRITE_SAME_HOUSEHOLD_IS_BLOCKED_BY_GLOBAL_PROTOCOL',async()=>{
  const held=await heldSave(),c=await client(f.actor),start=performance.now();
  inventory=(await f.db.query(`select n.nspname||'.'||c.relname table_name,l.mode from pg_locks l join pg_class c on c.oid=l.relation join pg_namespace n on n.oid=c.relnamespace
   where l.pid=$1 and l.granted and l.mode='ExclusiveLock' and n.nspname in('public','private','auth') order by 1`,[held.holder])).rows;
  const work=c.query('update public.n1_unrelated set value=value+1 where household_id=$1',[f.householdId]);void work.catch(()=>{});
  const blocked=await pendingFor(c.processID);assert(blocked[0].blockers.includes(held.holder));
  // ACCESS SHARE remains compatible; EXCLUSIVE is not ACCESS EXCLUSIVE.
  assert.equal((await f.db.query('select count(*) from public.n1_unrelated')).rowCount,1);
  held.release();await held.pending;await work;observations.push({test:'T1',effect:'UNRELATED_WRITE_BLOCKED',blocked,elapsedMs:performance.now()-start,tables:inventory,transaction:held.measurement});
 });
 await check('T2_OTHER_HOUSEHOLD_AND_OTHER_MONTH_REAL_V1_WRITERS_ARE_BLOCKED',async()=>{
  const held=await heldSave(),b=await client(f.foreignActor),otherMonth=await client(f.actor),start=performance.now();
  const a=oldSave(b,f.foreignHousehold,'2026-11',f.base),m=oldSave(otherMonth,f.householdId,'2026-12',{...f.base,targetMonth:'2026-12'});void a.catch(()=>{});void m.catch(()=>{});
  const blocked=await Promise.all([pendingFor(b.processID),pendingFor(otherMonth.processID)]);assert(blocked.every(r=>r[0].blockers.includes(held.holder)));
  held.release();await held.pending;await a;await m;observations.push({test:'T2',effect:'OTHER_HOUSEHOLD_AND_MONTH_BLOCKED',blocked,elapsedMs:performance.now()-start});
 });
 await check('T3_SYNTHETIC_AUTH_USER_UPDATE_IS_BLOCKED',async()=>{
  const held=await heldSave(),c=await client(),start=performance.now();const work=c.query('update auth.users set banned_until=null where id=$1',[f.foreignActor]);void work.catch(()=>{});
  const blocked=await pendingFor(c.processID);assert(blocked[0].blockers.includes(held.holder));held.release();await held.pending;await work;
  observations.push({test:'T3',effect:'OTHER_AUTH_USER_UPDATE_BLOCKED',blocked,elapsedMs:performance.now()-start});
 });
 await check('T4_COMMITTED_REVOKE_BEFORE_SAVE_REFUSES_WITHOUT_MUTATION',async()=>{
  const before=JSON.stringify(await f.rows()),stale=await f.scope();await f.db.query('update private.n1_recipe_facts set editor_enabled=false');
  await assert.rejects(()=>saveRootRelationDurableDraft(stale,packet(JSON.parse(before)[0])),/N1_PERMISSION_DENIED/);assert.equal(JSON.stringify(await f.rows()),before);
  await f.db.query('update private.n1_recipe_facts set editor_enabled=true');
 });
 await check('T5_REVOKE_HOLDS_RESOURCE_SAVE_WAITS_THEN_REFUSES',async()=>{
  const revoke=await client(),stale=await f.scope(),before=JSON.stringify(await f.rows());await revoke.query('begin');await revoke.query('update private.n1_recipe_facts set editor_enabled=false');
  const work=saveRootRelationDurableDraft(stale,packet(JSON.parse(before)[0]));void work.catch(()=>{});
  const waiting=await until("select pid,pg_blocking_pids(pid) blockers from pg_stat_activity where datname=current_database() and usename='composer_n1_server'",[],r=>r.some(x=>x.blockers.includes(revoke.processID)));
  await revoke.query('commit');await assert.rejects(()=>work,/N1_PERMISSION_DENIED/);assert.equal(JSON.stringify(await f.rows()),before);
  observations.push({test:'T5',effect:'REVOCATION_COMMITTED_FIRST_SAVE_REFUSED',waiting});await f.db.query('update private.n1_recipe_facts set editor_enabled=true');
 });
 await check('T6_AFTER_OWNER_ADMISSION_REVOKE_SERIALIZES_AFTER_SAVE_COMMIT',async()=>{
  const held=await heldSave(),c=await client();const revoke=c.query('update private.n1_recipe_facts set editor_enabled=false');void revoke.catch(()=>{});
  await pendingFor(c.processID);held.release();const receipt=await held.pending;await revoke;assert.equal(receipt.draft.version,held.before.draft_version+1);
  const after=JSON.stringify(await f.rows()),revokedScope=await f.scope();await assert.rejects(()=>saveRootRelationDurableDraft(revokedScope,packet(JSON.parse(after)[0])),/N1_PERMISSION_DENIED/);
  observations.push({test:'T6',effect:'SAVE_COMMIT_PRECEDES_EFFECTIVE_REVOCATION'});await f.db.query('update private.n1_recipe_facts set editor_enabled=true');
 });
 await check('T7_PLAN_BASE_CONCURRENT_CHANGE_IS_OBSERVED_AFTER_WAIT',async()=>{
  const c=await client(),stale=await f.scope(),before=(await f.rows())[0];await c.query('begin');
  // A synthetic base identity is changed under a real conflicting table lock; no financial Apply.
  const planId='f07b0000-0000-4000-8000-000000006901',revision='f07b0000-0000-4000-8000-000000006902',digest=semanticStateDigest(f.base);
  await c.query("insert into phase2_month_plans(plan_id,household_id,target_month,created_by,updated_by) values($1,$2,'2026-11-01',$3,$3)",[planId,f.householdId,f.actor]);
  await c.query(`insert into phase2_month_plan_revisions(plan_revision_id,plan_id,household_id,target_month,revision_number,apply_request_id,baseline_digest,baseline_snapshot,semantic_state,semantic_state_digest,change_set,compiled_manifest,compiled_manifest_digest,projection_evidence,preview_digest,compiler_version,model_versions,created_by)
   values($1,$2,$3,'2026-11-01',1,$1,$4,'{}',$5,$4,'[]','{}',$4,'{}',$4,'SYNTHETIC_CONCURRENT_BASE','{}',$6)`,[revision,planId,f.householdId,digest,f.base,f.actor]);
  await c.query('update phase2_month_plans set active_revision_id=$1,active_revision_number=1 where plan_id=$2',[revision,planId]);
  const work=saveRootRelationDurableDraft(stale,packet(before));void work.catch(()=>{});
  await until("select pid,pg_blocking_pids(pid) blockers from pg_stat_activity where datname=current_database() and usename='composer_n1_server'",[],r=>r.some(x=>x.blockers.includes(c.processID)));
  await c.query('commit');await assert.rejects(()=>work,/N1_DRAFT_(CONFLICT|VERSION_CHANGED)/);
  assert.equal((await f.rows())[0].draft_version,before.draft_version);observations.push({test:'T7',effect:'CONCURRENT_PLAN_CHANGE_REFUSED'});
  await c.query('update phase2_month_plans set active_revision_id=null,active_revision_number=0 where plan_id=$1',[planId]);
 });
 await check('T8_LEGACY_SAVE_ARCHIVE_RESTORE_WAIT_AND_REFUSE_N1_WITHOUT_DEADLOCK',async()=>{
  for(const kind of ['SAVE','ARCHIVE','RESTORE']){
   const held=await heldSave(),c=await client(f.actor);const work=kind==='SAVE'?oldSave(c,f.householdId,'2026-11',f.base,held.before)
    :c.query(`select public.${kind.toLowerCase()}_phase2_composer_draft_v2($1,$2,$3,$4,$5)`,[f.householdId,'2026-11-01',f.draftId,held.before.draft_version,`f07b0000-0000-4000-8000-${String(++request).padStart(12,'0')}`]);void work.catch(()=>{});
   const blocked=await pendingFor(c.processID);held.release();await held.pending;await assert.rejects(()=>work,e=>e.code==='40001');observations.push({test:'T8',kind,effect:'WAIT_THEN_REFUSE_N1',blocked});
  }
 });
 await check('T9_SQL_TIMEOUTS_DO_NOT_BOUND_JS_IDLE_AUTHORITY_BASELINE',async()=>{
  const c=await client();await c.query("begin;set local lock_timeout='100ms';set local statement_timeout='150ms';lock table public.n1_unrelated in exclusive mode");
  await pause(260);const status=(await f.db.query('select state,extract(epoch from(clock_timestamp()-xact_start))*1000 duration_ms from pg_stat_activity where pid=$1',[c.processID])).rows[0];
  assert.equal(status.state,'idle in transaction');assert(Number(status.duration_ms)>150);await c.query('rollback');
  observations.push({test:'T9_BASELINE',effect:'STATEMENT_AND_LOCK_TIMEOUT_DO_NOT_BOUND_IDLE_TRANSACTION',status});
 });
 await check('T10_PRIVATE_SOURCE_PERMISSION_PRESET_PRESERVE_AND_EXISTING_REMOVAL_REFUSED',async()=>{
  const row=(await f.rows())[0],original=row.semantic_state,before=JSON.stringify(await f.rows());
  const attempts=[d=>d.contexts[0].fields.composerPresentation.presetKey='nightclub',d=>d.contexts[0].contextOccurrenceId='f07b0000-0000-4000-8000-000000000999'];
  for(const mutate of attempts){const p=packet(row),scope=await f.scope();p.command.semanticState=structuredClone(document);mutate(p.command.semanticState);
   await assert.rejects(async()=>{p.command.digest=rootRelationStateDigest(p.command.semanticState);return saveRootRelationDurableDraft(scope,p);});}assert.equal(JSON.stringify(await f.rows()),before);
  const protectedDoc=structuredClone(original);protectedDoc.preferences.flexibility[f.ids[0]]='PRESERVE';
  await f.db.query('update phase2_composer_drafts set semantic_state=$1,semantic_state_digest=$2 where draft_id=$3',[protectedDoc,rootRelationStateDigest(protectedDoc),f.draftId]);
  const p=packet((await f.rows())[0]);p.command.semanticState=rootRelationDocument({draft:f.base,relations:[]});p.command.digest=rootRelationStateDigest(p.command.semanticState);
  const protectedBefore=JSON.stringify(await f.rows()),scope=await f.scope();await assert.rejects(()=>saveRootRelationDurableDraft(scope,p),/N1_MEMBER_PRESERVED/);assert.equal(JSON.stringify(await f.rows()),protectedBefore);
  await f.db.query('update phase2_composer_drafts set semantic_state=$1,semantic_state_digest=$2 where draft_id=$3',[original,rootRelationStateDigest(original),f.draftId]);
 });
 await check('T11_NEW_TABLE_AFTER_ENUMERATION_IS_NOT_FROZEN',async()=>{
  const held=await heldSave(),c=await client();await c.query('create schema n1_external;create table n1_external.permission_fact(value int);insert into n1_external.permission_fact values(1)');
  await c.query('create table public.n1_added_after_enumeration(value int);insert into public.n1_added_after_enumeration values(1)');
  const missing=(await f.db.query("select count(*)::int n from pg_locks where pid=$1 and relation in('public.n1_added_after_enumeration'::regclass,'n1_external.permission_fact'::regclass) and granted",[held.holder])).rows[0].n;
  assert.equal(missing,0);held.release();await held.pending;observations.push({test:'T11',effect:'NEW_TABLE_AND_EXTERNAL_SCHEMA_CAN_CHANGE_OUTSIDE_FROZEN_INVENTORY'});
 });
 console.log(JSON.stringify({status:'PASS',interpretation:'GLOBAL_CONTENTION_IS_DEMONSTRATED_NOT_ACCEPTED_FOR_SHARED_DATABASE',checks,database:f.database,inventory,observations,authRlsRemote:'NOT_RUN'}));
 if(process.env.N1_CONTENTION_EVIDENCE)fs.writeFileSync(process.env.N1_CONTENTION_EVIDENCE,JSON.stringify({checks,database:f.database,inventory,observations},null,2));
}finally{for(const release of heldReleases)release();await Promise.allSettled(clients.map(c=>c.end()));await f.close();delete process.env.COMPOSER_ROOT_RELATIONS_ENABLED;delete process.env.COMPOSER_ROOT_RELATIONS_DURABLE_SAVE_ENABLED;}
