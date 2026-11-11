/** One NEW database in the dedicated native local cluster; never accepts a remote URL or secret. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import pg from 'pg';
import {require}from'./phase2-ts-loader.mjs';import{rootRelationsFixture}from'../fixtures/planner-root-relations.mjs';
import{uuid,householdId}from'../fixtures/planner-headless.mjs';
const{createRootRelationWriter}=require('@/server/phase2/planner/root-relation-durable-writer');
const{readRootRelationDurableDrafts}=require('@/server/phase2/planner/root-relation-durable-service');
const{rootRelationFinancialReadSnapshot}=require('@/domain/phase2/planner/root-relation-durable-contract');
const{createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const{handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const{semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
export async function createRootNativeRecipe(){
 const config={host:'127.0.0.1',port:55439,user:'postgres',database:'postgres',ssl:false,password:()=>{throw Error('NO_REMOTE_SECRET');}};
 const admin=new pg.Client(config);await admin.connect();
 const directory=(await admin.query("select current_setting('data_directory') value")).rows[0].value.replaceAll('\\','/').toLowerCase();
 assert.equal(directory,path.resolve('../p-grp-n1-c-b/pg-isolated').replaceAll('\\','/').toLowerCase());
 const database='n1cb_vertical_'+Date.now()+'_'+crypto.randomBytes(2).toString('hex');await admin.query(`create database ${database}`);await admin.end();
 const db=new pg.Client({...config,database});await db.connect();
 const actor=uuid(98901),foreignActor=uuid(98911),foreignHousehold=uuid(98912),draftId=uuid(98902),f=await rootRelationsFixture();
 await db.query(`do $$begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;end$$;
 create schema auth;create schema private;
 create table auth.users(id uuid primary key,raw_app_meta_data jsonb not null default '{}',banned_until timestamptz,deleted_at timestamptz);
 create table households(household_id uuid primary key);
 create table private.household_memberships(user_id uuid,household_id uuid);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function private.user_has_household_access(h uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.household_memberships where user_id=auth.uid() and household_id=h)$$;
 grant usage on schema public,auth,private to authenticated,anon,service_role;
 grant execute on function private.user_has_household_access(uuid),auth.uid() to authenticated;`);
 for(const file of ['20261005202346_phase2_month_plan_foundation.sql','20261011130256_p07b_m0_phase2_composer_drafts_fixture_gate.sql','20261011150830_p07_composer_draft_access_v2.sql'])
  await db.query('begin;'+fs.readFileSync('supabase/migrations/'+file,'utf8')+'commit;');
 await db.query('begin;'+fs.readFileSync('supabase/candidates/20261103183114_n1_c_b_durable_candidate.sql','utf8')+'commit;');
 await db.query('insert into auth.users(id) values($1),($2);',[actor,foreignActor]);
 await db.query('insert into households values($1),($2)',[householdId,foreignHousehold]);
 await db.query('insert into private.household_memberships values($1,$2),($3,$4)',[actor,householdId,foreignActor,foreignHousehold]);
 await db.query('update private.phase2_composer_draft_access set enabled_for_all=true');
 await db.query('update private.phase2_root_durable_gate set enabled=true');
 const key=crypto.randomBytes(32).toString('hex'); // Local synthetic signing key: never returned, logged or committed.
 await db.query("update private.phase2_root_authority_key set signing_key=decode($1,'hex')",[key]);
 await db.query('alter role composer_n1_server login'); // Only this isolated cluster; candidate itself creates NOLOGIN.
 await db.query(`create table private.n1_recipe_facts(household_id uuid primary key,world jsonb not null,editor_enabled boolean not null default true);
 alter table private.n1_recipe_facts enable row level security;
 grant select on private.n1_recipe_facts to authenticated;
 create policy recipe_read on private.n1_recipe_facts for select to authenticated using(private.user_has_household_access(household_id));`);
 await db.query('insert into private.n1_recipe_facts(household_id,world) values($1,$2)',[householdId,JSON.stringify(f.world)]);
 await db.query(`insert into phase2_composer_drafts(draft_id,owner_user_id,household_id,target_month,semantic_state,semantic_state_digest,
 last_mutation_request_id,last_mutation_expected_version,last_mutation_kind,retention_review_at)
 values($1,$2,$3,'2026-11-01',$4,$5,$6,0,'SAVE',now()+interval '365 days')`,[draftId,actor,householdId,f.base,semanticStateDigest(f.base),uuid(98903)]);
 const reads=new pg.Pool({...config,database,max:12});const writer=createRootRelationWriter({...config,database,user:'composer_n1_server'},key),events=[];
 async function queryAs(user,sql,args=[]){const c=await reads.connect();try{await c.query('set role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);return await c.query(sql,args);}finally{await c.query('reset role');c.release();}}
 const tables=new Set(['phase2_composer_drafts','phase2_month_plans','phase2_month_plan_revisions']);
 function clientFor(user){return{from(table){if(!tables.has(table))throw Error('RECIPE_TABLE_FORBIDDEN');let columns='*',filters=[],order='';
  const query={select(value){assert.match(value,/^[a-z_,*]+$/);columns=value;return query;},eq(k,v){assert.match(k,/^[a-z_]+$/);filters.push([k,v]);return query;},
   order(k,{ascending}){assert.equal(k,'created_at');order=' order by created_at '+(ascending?'asc':'desc');return query;},abortSignal(){return query;},
   maybeSingle(){return query.then(r=>({...r,data:r.data[0]??null}));},then(resolve,reject){return queryAs(user,`select to_jsonb(t) row from(select ${columns} from public.${table}${filters.length?' where '+filters.map(([k],i)=>k+'=$'+(i+1)).join(' and '):''}${order})t`,filters.map(([,v])=>v)).then(r=>({data:r.rows.map(x=>x.row),error:null})).catch(error=>({data:null,error})).then(resolve,reject);}};return query;},
  rpc(name,args){if(!/^(save|archive|restore)_phase2_composer_draft_v[12]$/.test(name))throw Error('RECIPE_APPLY_OR_RPC_FORBIDDEN');
   const keys=name.startsWith('save')?['household_id','target_month','expected_draft_id','expected_draft_version','save_request_id','base_plan_id','base_plan_revision_id','base_plan_revision_number','semantic_state','semantic_state_digest']
    :['household_id','target_month','draft_id','expected_draft_version',name.startsWith('archive')?'archive_request_id':'restore_request_id'];
   const q={abortSignal(){return q;},then(resolve,reject){return queryAs(user,`select public.${name}(${keys.map((_,i)=>'$'+(i+1)).join(',')}) value`,keys.map(k=>args['p_'+k])).then(r=>({data:r.rows[0].value,error:null})).catch(error=>({data:null,error})).then(resolve,reject);}};return q;
  }};}
 async function scope(user=actor,household=householdId){
  const facts=(await queryAs(user,'select world,editor_enabled from private.n1_recipe_facts where household_id=$1',[household])).rows[0];
  const supabase=clientFor(user),deps={...f.deps,repository:createPlanApplyRepository(supabase),readWorld:async(h,m)=>{
   if(h!==household||m!=='2026-11')throw Error('RECIPE_SCOPE');
   const row=(await queryAs(user,'select world from private.n1_recipe_facts where household_id=$1',[household])).rows[0];
   if(!row)throw TypeError('N1_DRAFT_ACCESS_DENIED');return row.world;
  }};
  return{userId:user,householdId:household,supabase,admission:{userId:user,householdId:household,deps,editorEnabled:!!facts?.editor_enabled},writer,
   refresh:async()=>{events.push({phase:'FRESH_AUTHORITY',userId:user});return scope(user,household);}};
 }
 async function opening(){const s=await scope(),rootDrafts=await readRootRelationDurableDrafts(s,'2026-11'),drafts=rootRelationFinancialReadSnapshot(rootDrafts);
  const result=await handleComposerRequest(s.admission.deps,householdId,{kind:'READ',sequence:0,targetMonth:'2026-11',draft:drafts.active.semanticState});
  assert(result.ok,result.code);return{model:result.model,drafts,rootDrafts,rootRelationAccess:{scopeKey:database,enabled:true,durable:true}};}
 return{...f,actor,foreignActor,householdId,foreignHousehold,draftId,database,db,writer,scope,opening,events,queryAs,clientFor,
  async rows(){return(await db.query('select to_jsonb(d) row from phase2_composer_drafts d order by created_at')).rows.map(r=>r.row);},
  async close(){await writer.close();await reads.end();await db.end();}};
}
