/** Native PostgreSQL recipe, NEVER a remote Supabase connection. SQL roles/Auth functions are synthetic. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import pg from 'pg';
import {require} from './lib/phase2-ts-loader.mjs';import {rootRelationsFixture} from './fixtures/planner-root-relations.mjs';
const {upgradePlanForRootRelations,parseRootRelationPlanState,rootRelationStateDigest}=require('@/domain/phase2/planner/root-relation-state');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {validateRootRelationDraftSaveReceipt}=require('@/domain/phase2/planner/root-relation-draft-boundary');
const {readRootRelationDraftRow}=require('@/domain/phase2/planner/root-relation-draft-codec');
const candidate='supabase/candidates/20261103183114_n1_c_b_durable_candidate.sql';
const config={host:'127.0.0.1',port:55439,user:'postgres',database:'postgres',ssl:false,
 password:()=>{throw Error('N1_RECIPE_MUST_NOT_REQUEST_SECRET');}};
const expectedDirectory=path.resolve('../p-grp-n1-c-b/pg-isolated').replaceAll('\\','/').toLowerCase();
const admin=new pg.Client(config);await admin.connect();
const dir=(await admin.query("select current_setting('data_directory') dir")).rows[0].dir.replaceAll('\\','/').toLowerCase();
assert.equal(dir,expectedDirectory,'must use the newly created cluster; never reuse a shared database');
const database='n1cb_recipe_'+Date.now();await admin.query(`create database ${database}`);await admin.end();
pg.types.setTypeParser(1082,v=>v);
const clients=[];async function connect(role='postgres',actor=null){const c=new pg.Client({...config,database});await c.connect();clients.push(c);
 if(role!=='postgres')await c.query('set role '+role);if(actor)await c.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);return c;}
const c=await connect();const checks=[];async function check(name,fn){await fn();checks.push(name);console.log(name+' PASS');}
const actor='f07b0000-0000-4000-8000-000000000101',other='f07b0000-0000-4000-8000-000000000102',household='f07b0000-0000-4000-8000-000000000001';
const uuid=n=>`f07b0000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let request=300, rpcCalls=0;
const fixture=await rootRelationsFixture();
const base=fixture.base, full=parseRootRelationPlanState({...upgradePlanForRootRelations(base),rootRelations:[{
 version:'root-context-relation@v1',relationId:fixture.groupId,targetMonth:'2026-11',orderedContextIds:fixture.ids.slice(0,2),provenance:'EXPLICIT_USER_DECISION'}]});
const packet=(record=null,document=full,requestId=uuid(++request))=>({contract:'composer-draft-http@2-root-relations',kind:'SAVE',command:{
 targetMonth:'2026-11',expectedDraftId:record?.draft_id??null,expectedDraftVersion:record?.draft_version??0,
 expectedDocumentVersion:record?.semantic_state.version??null,expectedDraftDigest:record?.semantic_state_digest??null,
 expectedBaseRevisionId:record?.base_plan_revision_id??null,expectedBaseRevisionNumber:record?.base_plan_revision_number??0,
 requestId,semanticState:document,digest:rootRelationStateDigest(document)}});
const row=async(client=c)=>(await client.query('select * from public.phase2_composer_drafts where owner_user_id=$1 order by created_at desc',[actor])).rows;
const identity=async record=>(await c.query('select private.phase2_root_draft_identity_v1(d) value from public.phase2_composer_drafts d where draft_id=$1',[record.draft_id])).rows[0].value;
const store=async(client,p,source)=>{rpcCalls++;return(await client.query('select private.store_phase2_root_draft_v1($1,$2,$3,$4) result',[actor,household,p,source])).rows[0].result;};
const wireRow=r=>({...r,last_saved_at:r.last_saved_at instanceof Date?r.last_saved_at.toISOString():r.last_saved_at,
 archived_at:r.archived_at instanceof Date?r.archived_at.toISOString():r.archived_at}); // Native pg Date -> JSON transport representation.
async function refused(fn,code){await assert.rejects(fn,error=>{assert.equal(error.code,code);return true;});}
async function legacyRefused(fn){await assert.rejects(fn,error=>error.code==='40001'&&error.message==='COMPOSER_DRAFT_N1_LEGACY_REFUSED');}
const oldArgs=(record,requestId=uuid(++request))=>[household,'2026-11-01',record?.draft_id??null,record?.draft_version??0,requestId,null,null,0,base,semanticStateDigest(base)];
const oldSave=(client,version,record,requestId)=>client.query(`select public.save_phase2_composer_draft_v${version}(${Array.from({length:10},(_,i)=>'$'+(i+1)).join(',')}) result`,oldArgs(record,requestId));
let nativeVersion;
try{
 nativeVersion=(await c.query('select version() value')).rows[0].value;
 await c.query(`do $$begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;end$$;
 create schema private;create schema auth;create table auth.users(id uuid primary key,raw_app_meta_data jsonb not null default '{}');
 create table public.households(household_id uuid primary key);
 create table private.household_memberships(user_id uuid,household_id uuid);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function private.user_has_household_access(h uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.household_memberships where user_id=auth.uid() and household_id=h)$$;
 grant usage on schema public,private,auth to anon,authenticated,service_role;
 grant execute on function private.user_has_household_access(uuid),auth.uid() to authenticated;`);
 for(const name of ['20261005202346_phase2_month_plan_foundation.sql','20261011130256_p07b_m0_phase2_composer_drafts_fixture_gate.sql','20261011150830_p07_composer_draft_access_v2.sql'])
  await c.query('begin;'+fs.readFileSync('supabase/migrations/'+name,'utf8')+'commit;');
 await c.query("insert into auth.users values($1,'{\"composer_draft_test\":\"p07b-20261010\"}'),($2,'{}')",[actor,other]);
 await c.query('insert into public.households values($1),($2)',[household,uuid(2)]);
 await c.query('insert into private.household_memberships values($1,$2)',[actor,household]);
 await c.query('update private.phase2_composer_draft_access set enabled_for_all=true');
 await c.query('begin;'+fs.readFileSync(candidate,'utf8')+'commit;');
 await c.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
 const user=await connect('authenticated',actor),foreign=await connect('authenticated',other),service=await connect('service_role',actor);
 await check('SQL_CANDIDATE_APPLIES_ATOMICALLY_AND_WRITER_IS_PRIVATE',async()=>{
  assert.equal((await c.query("select has_function_privilege('authenticated','private.store_phase2_root_draft_v1(uuid,uuid,jsonb,jsonb)','execute') a,has_function_privilege('service_role','private.store_phase2_root_draft_v1(uuid,uuid,jsonb,jsonb)','execute') s")).rows[0].a,false);
  await refused(()=>store(user,packet(),null),'42501');await refused(()=>store(service,packet(),null),'42501');
  await refused(()=>store(c,packet(),null),'42501');assert.equal((await row()).length,0);
 });
 await check('V1_SAVE_REPLAY_ARCHIVE_RESTORE_REMAIN_FUNCTIONAL',async()=>{
  for(const v of [1,2]){
   const requestId=uuid(++request),saved=(await oldSave(user,v,null,requestId)).rows[0].result.draft;
   assert.equal((await oldSave(user,v,null,requestId)).rows[0].result.replayed,true);
   const archive=(await user.query(`select public.archive_phase2_composer_draft_v${v}($1,$2,$3,$4,$5) result`,[household,'2026-11-01',saved.draft_id,1,uuid(++request)])).rows[0].result.draft;
   const restore=(await user.query(`select public.restore_phase2_composer_draft_v${v}($1,$2,$3,$4,$5) result`,[household,'2026-11-01',saved.draft_id,archive.draft_version,uuid(++request)])).rows[0].result.draft;
   assert.equal(restore.semantic_state_digest,semanticStateDigest(base));await c.query('delete from public.phase2_composer_drafts');
  }
 });
 await check('FULL_DOCUMENT_VALIDATION_PARITY_AND_REFUSALS',async()=>{
  const valid=async s=>(await c.query('select private.phase2_root_plan_state_valid_v1($1,$2) value',[s,'2026-11-01'])).rows[0].value;
  assert(await valid(full));assert(await valid(base));
  const mutations=[s=>s.version='unknown',s=>s.rootRelations.push(s.rootRelations[0]),s=>s.rootRelations[0].orderedContextIds.push(s.rootRelations[0].orderedContextIds[0]),
   s=>s.rootRelations[0].orderedContextIds[0]=uuid(888),s=>s.rootRelations[0].targetMonth='2026-12',s=>s.rootRelations[0].provenance='INFERRED',
   s=>s.contexts[0].parentContextOccurrenceId=s.contexts[1].contextOccurrenceId,s=>s.contexts[0].fields.composerPresentation.presetKey='nightclub'];
  for(const mutate of mutations){const s=structuredClone(full);mutate(s);assert.equal(await valid(s),false);assert.throws(()=>parseRootRelationPlanState(s));}
  const{canonicalPlannerJson}=require('@/domain/phase2/planner/json');
  for(const json of [full,{'😀':1,'\uE000':2,a:'é\n"\\',n:[1e-7,1e-6,1e20,1e21,-0,0.00000123,42.25,
   1.2345678901234567e-7,0.30000000000000004,1000000000000000100,Number.MIN_VALUE,Number.MAX_VALUE,1.2345678901234567e30]}]){
   assert.equal((await c.query('select private.phase2_n1_canonical_json_v1($1) value',[json])).rows[0].value,canonicalPlannerJson(json));
  }
 });
 // A synthetic N1 row is installed by the database OWNER to challenge the legacy guards.
 // This is not an admitted user Save and must not be labelled SAVED_LOCAL_ISOLATED.
 const old=(await oldSave(user,2,null)).rows[0].result.draft;
 await c.query('update public.phase2_composer_drafts set semantic_state=$1,semantic_state_digest=$2 where draft_id=$3',[full,rootRelationStateDigest(full),old.draft_id]);
 await check('ALL_OLD_RPCS_REFUSE_N1_BEFORE_REPLAY_WITHOUT_MUTATION',async()=>{
  const before=JSON.stringify(await row());
  const current=(await row())[0];
  for(const v of [1,2]){
   await legacyRefused(()=>oldSave(user,v,current));await legacyRefused(()=>oldSave(user,v,null,current.last_mutation_request_id));
   for(const action of ['archive','restore'])await legacyRefused(()=>user.query(`select public.${action}_phase2_composer_draft_v${v}($1,$2,$3,$4,$5)`,[household,'2026-11-01',current.draft_id,current.draft_version,current.last_mutation_request_id]));
  }
  assert.equal(JSON.stringify(await row()),before);
 });
 await check('ABANDONED_N1_RESTORE_AND_LIFECYCLE_REPLAY_REFUSED_EXPLICITLY',async()=>{
  const current=(await row())[0];
  for(const v of [1,2]){
   await c.query("update public.phase2_composer_drafts set lifecycle='ABANDONED',archived_at=now(),draft_version=2,last_mutation_kind='ARCHIVE',last_mutation_expected_version=1 where draft_id=$1",[current.draft_id]);
   const snapshot=JSON.stringify(await row());
   await legacyRefused(()=>user.query(`select public.restore_phase2_composer_draft_v${v}($1,$2,$3,$4,$5)`,[household,'2026-11-01',current.draft_id,2,uuid(++request)]));
   await legacyRefused(()=>user.query(`select public.archive_phase2_composer_draft_v${v}($1,$2,$3,$4,$5)`,[household,'2026-11-01',current.draft_id,1,current.last_mutation_request_id]));
   assert.equal(JSON.stringify(await row()),snapshot);
  }
  await c.query("update public.phase2_composer_drafts set lifecycle='ACTIVE',archived_at=null,last_mutation_kind='SAVE' where draft_id=$1",[current.draft_id]);
 });
 await check('COUNTERFACTUAL_OLD_SQL_ARCHIVES_N1_NEW_GUARD_PREVENTS_IT',async()=>{
  const current=(await row())[0],before=JSON.stringify(await row());await c.query('begin');
  try{
   const raw=fs.readFileSync('supabase/migrations/20261011150830_p07_composer_draft_access_v2.sql','utf8');
   const fn=raw.match(/create function private\.archive_phase2_composer_draft_v2\([\s\S]*?\$fn\$;/)[0];
   await c.query(fn.replace('create function','create or replace function'));
   const result=(await c.query('select public.archive_phase2_composer_draft_v2($1,$2,$3,$4,$5) result',[household,'2026-11-01',current.draft_id,current.draft_version,uuid(++request)])).rows[0].result;
   assert.equal(result.draft.lifecycle,'ABANDONED','historical SQL really accepts N1 without a guard');
  }finally{await c.query('rollback');}
  assert.equal(JSON.stringify(await row()),before);
  await legacyRefused(()=>oldSave(user,2,current));
 });
 await check('SQL_PRIVATE_STORAGE_ROUNDTRIP_REPLAY_AND_F_CA_01',async()=>{
  await c.query('update private.phase2_root_durable_gate set enabled=true'); // Disposable local SQL recipe only.
  const current=(await row())[0],source=await identity(current),P=packet(current);
  const result=await store(c,P,source),saved=result.draft;
  assert.equal(saved.draft_version,current.draft_version+1);assert.deepEqual(saved.semantic_state,full);
  const wire=readRootRelationDraftRow(saved,{userId:actor,householdId:household,targetMonth:'2026-11'});
  const known=readRootRelationDraftRow(wireRow(current),{userId:actor,householdId:household,targetMonth:'2026-11'});
  assert.equal(validateRootRelationDraftSaveReceipt(P,{contract:P.contract,kind:'SAVE_RECEIPT',draft:wire,replayed:false},known,full).kind,'VALIDATED_RECEIPT_ONLY');
  assert.equal((await store(c,P,source)).replayed,true);
  const altered=parseRootRelationPlanState({...full,rootRelations:[]});
  await refused(()=>store(c,{...P,command:{...P.command,semanticState:altered,digest:rootRelationStateDigest(altered)}},source),'40001');
  const before=JSON.stringify(await row());
  const contradictedSource={...await identity(saved),last_mutation_request_id:uuid(999)};
  await refused(()=>store(c,packet(saved),contradictedSource),'40001');
  assert.equal(JSON.stringify(await row()),before);
  const badDigest=packet(saved),savedIdentity=await identity(saved);badDigest.command.digest='0'.repeat(64);
  await refused(()=>store(c,badDigest,savedIdentity),'22023');
 });
 await check('CONCURRENT_SQL_SAVES_HAVE_EXACTLY_ONE_WINNER',async()=>{
  const current=(await row())[0],source=await identity(current),a=await connect('postgres',actor),b=await connect('postgres',actor);
  const results=await Promise.allSettled([store(a,packet(current),source),store(b,packet(current,parseRootRelationPlanState({...full,rootRelations:[{...full.rootRelations[0],orderedContextIds:[...full.rootRelations[0].orderedContextIds].reverse()}]})),source)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='40001').length,1);
 });
 await check('LOCK_WAIT_RECHECKS_SOURCE_AND_LEGACY_CLIENT_AFTER_N1_COMMIT',async()=>{
  const current=(await row())[0],source=await identity(current),locker=await connect('postgres',actor),waiter=await connect('postgres',actor);
  await locker.query('begin');await locker.query('select 1 from public.phase2_composer_drafts where draft_id=$1 for update',[current.draft_id]);
  const waiting=store(waiter,packet(current),source);void waiting.catch(()=>{});
  await locker.query('update public.phase2_composer_drafts set draft_version=draft_version+1 where draft_id=$1',[current.draft_id]);await locker.query('commit');
  await refused(()=>waiting,'40001');
  const refreshed=(await row())[0];await refused(()=>oldSave(user,2,refreshed),'40001');
 });
 await check('SQL_ROLE_SCOPE_ISOLATION_AND_OVERSIZE_ARE_NOT_USER_AUTH_CERTIFICATION',async()=>{
  assert.equal((await foreign.query('select count(*)::int n from public.phase2_composer_drafts')).rows[0].n,0);
  const current=(await row())[0],before=JSON.stringify(await row()),source=await identity(current);
  await c.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);await refused(()=>store(c,packet(current),source),'42501');
  await c.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
  const tooBig=structuredClone(full);tooBig.contexts[0].fields.recipePayload='x'.repeat(1048577);
  const tooBigPacket=packet(current);tooBigPacket.command.semanticState=tooBig;
  await refused(()=>store(c,tooBigPacket,source),'22023');assert.equal(JSON.stringify(await row()),before);
 });
 await check('COMMIT_RESPONSE_LOST_RECONCILES_FULL_RECEIPT_WITHOUT_SECOND_WRITE',async()=>{
  const before=(await row())[0],source=await identity(before),P=packet(before);
  await assert.rejects(async()=>{await store(c,P,source);throw Error('INJECTED_RESPONSE_LOST_AFTER_REAL_COMMIT');},/INJECTED/);
  const after=(await row())[0];assert.equal(after.draft_version,before.draft_version+1);
  assert.equal((await store(c,P,source)).replayed,true);assert.equal((await row())[0].draft_version,after.draft_version);
  const known=readRootRelationDraftRow(wireRow(after),{userId:actor,householdId:household,targetMonth:'2026-11'});
  assert.equal(validateRootRelationDraftSaveReceipt(P,{contract:P.contract,kind:'SAVE_RECEIPT',draft:known,replayed:true},known,full).replayed,true);
  const changed=parseRootRelationPlanState({...full,rootRelations:[{...full.rootRelations[0],orderedContextIds:[...full.rootRelations[0].orderedContextIds].reverse()}]});
  assert.throws(()=>validateRootRelationDraftSaveReceipt(P,{contract:P.contract,kind:'SAVE_RECEIPT',draft:known,replayed:true},known,changed),error=>error.code==='N1_DRAFT_LOCAL_CHANGED');
 });
 await check('LEGACY_SAVE_AND_RESTORE_WAIT_THEN_REFUSE_COMMITTED_N1',async()=>{
  const before=(await row())[0],locker=await connect('postgres',actor),oldClient=await connect('authenticated',actor);
  await locker.query('begin');await locker.query('select 1 from public.phase2_composer_drafts where draft_id=$1 for update',[before.draft_id]);
  const waiting=oldSave(oldClient,2,before);void waiting.catch(()=>{});
  await locker.query('update public.phase2_composer_drafts set draft_version=draft_version+1 where draft_id=$1',[before.draft_id]);await locker.query('commit');
  await refused(()=>waiting,'40001');const after=(await row())[0];assert.equal(after.draft_version,before.draft_version+1);
  await locker.query('begin');await locker.query('select 1 from public.phase2_composer_drafts where draft_id=$1 for update',[after.draft_id]);
  const restoring=oldClient.query('select public.restore_phase2_composer_draft_v2($1,$2,$3,$4,$5)',[household,'2026-11-01',after.draft_id,after.draft_version,uuid(++request)]);void restoring.catch(()=>{});
  await locker.query('commit');await refused(()=>restoring,'40001');assert.deepEqual((await row())[0],after);
 });
 await check('TWO_SQL_CREATIONS_HAVE_ONE_WINNER_AND_EXACT_REPLAY',async()=>{
  await c.query('delete from public.phase2_composer_drafts');const a=await connect('postgres',actor),b=await connect('postgres',actor),P=packet();
  const second=packet(null,parseRootRelationPlanState({...full,rootRelations:[{...full.rootRelations[0],orderedContextIds:[...full.rootRelations[0].orderedContextIds].reverse()}]}));
  const outcomes=await Promise.allSettled([store(a,P,null),store(b,second,null)]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1,JSON.stringify(outcomes.map(r=>r.status==='rejected'?{code:r.reason.code,message:r.reason.message}:r.status)));assert.equal((await row()).length,1);
  const won=outcomes[0].status==='fulfilled'?P:second;assert.equal((await store(c,won,null)).replayed,true);
 });
 await check('SQL_GATE_CLOSED_AFTER_STORAGE_PREVENTS_FURTHER_WRITES',async()=>{
  const before=JSON.stringify(await row()),current=(await row())[0];await c.query('update private.phase2_root_durable_gate set enabled=false');
  await refused(()=>store(c,packet(current),null),'42501');assert.equal(JSON.stringify(await row()),before);
 });
 console.log(JSON.stringify({status:'PASS',checks,database,nativeVersion,clusterDirectory:dir,sqlCalls:rpcCalls,
  level:'NATIVE_SQL_STORAGE_AND_ROLES_LOCAL_ONLY',syntheticAuth:true,productionAuthRls:'NOT_RUN',
  shellToSql:'NOT_RUN_G_A_AND_TRANSACTION_AUTHORITY_NOT_RECEIVED',savedLocalIsolated:'NOT_ATTESTED',remoteConnections:0}));
}finally{await Promise.allSettled(clients.map(client=>client.end()));}
