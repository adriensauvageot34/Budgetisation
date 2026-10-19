import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {require} from './lib/phase2-ts-loader.mjs';
const {PersonalGooglePlaces}=require('@/server/places/personal-google-places');
const {personalPlaceRpcStore}=require('@/server/places/personal-google-place-store');
const {parsePersonalGooglePlaceCommand,matchPublishedGooglePlace}=require('@/domain/phase2/personal-google-place');
let db,pgConfig;const checks=[];
if(process.env.BAR_SQL_ENGINE==='pg17'){
 const {Client}=require('pg'),admin=new Client({host:'127.0.0.1',port:55437,user:'postgres',database:'postgres'});await admin.connect();
 const name='bar_places_'+Date.now();await admin.query('create database '+name);await admin.end();
 pgConfig={host:'127.0.0.1',port:55437,user:'postgres',database:name};const client=new Client(pgConfig);await client.connect();
 db={query:(...args)=>client.query(...args),exec:sql=>client.query(sql),close:()=>client.end()};
}else db=new PGlite();
const A='f07b0000-0000-4000-8000-0000000000a1',B='f07b0000-0000-4000-8000-0000000000b1',H1='f07b0000-0000-4000-8000-000000000001',H2='f07b0000-0000-4000-8000-000000000002';
const scope={userId:A,householdId:H1};
const command=(patch={})=>({version:'personal-google-place@v1',requestId:randomUUID(),googlePlaceId:'ChIJ_synthetic_public_bar',userLabel:'My declared label',action:'SAVE',expectedVersion:0,...patch});
async function test(id,run){try{await run();checks.push({id,status:'PASS_LOCAL_DOMAIN'});console.log(id+' PASS');}catch(e){checks.push({id,status:'FAIL',error:e.message});console.error(id+' FAIL '+e.stack);}}
await db.exec(`create schema auth;create schema private;
 do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;end$$;
 create table auth.users(id uuid primary key,banned_until timestamptz);create table public.households(household_id uuid primary key);
 create table private.household_memberships(user_id uuid,household_id uuid);
 insert into auth.users values('${A}',null),('${B}',null);insert into public.households values('${H1}'),('${H2}');
 insert into private.household_memberships values('${A}','${H1}'),('${B}','${H1}');`);
const sql=fs.readFileSync('supabase/candidates/BAR_PERSONAL_GOOGLE_PLACES_REVIEW_DO_NOT_EXECUTE.sql','utf8');await db.exec(sql);
const rpc=async(s,c,mode)=>(await db.query('select public.personal_google_place_v1($1,$2,$3::jsonb,$4) r',[s.userId,s.householdId,c===null?null:JSON.stringify(c),mode])).rows[0].r;
let providerCalls=0,providerFail=false,providerInvalid=null,loseResponse=false,mutations=0;
const store=personalPlaceRpcStore({rpc:async(_name,args)=>{
 const result=await rpc({userId:args.p_actor,householdId:args.p_household},args.p_command,args.p_mode);
 if(args.p_mode==='MUTATE'){mutations++;if(loseResponse){loseResponse=false;throw Error('lost response');}}
 return {data:result,error:null};}});
const google={details:async(id,_token,kind)=>{providerCalls++;assert.equal(kind,'BAR_APERO');if(providerFail)throw Error('unavailable');return {provider:'google_places',placeId:providerInvalid==='ID'?'ChIJ_other_id':id,types:providerInvalid==='TYPE'?['school']:['bar'],formattedAddress:'not persisted',displayName:'Not copied'};}};
const service=new PersonalGooglePlaces(store,async s=>s.userId===A&&s.householdId===H1,google);
let saved,original;
await test('SQL_EXACT_CANDIDATE_CREATE_SAVE_READ',async()=>{
 original=command();saved=await service.save(scope,original);assert.equal(saved.status,'SAVED');assert.equal(saved.place.version,1);
 assert.equal((await service.read(scope)).length,1);assert.equal(saved.place.kind,'PERSONAL_SAVED_PLACE');
 assert(!JSON.stringify(saved).includes('not persisted'));assert(!JSON.stringify(saved).includes('Not copied'));
});
await test('EXACT_ID_DUPLICATE_CAS_REPLAY_DIFFERENT_PAYLOAD',async()=>{
 const calls=providerCalls;assert.equal((await service.save(scope,original)).replayed,true);assert.equal(providerCalls,calls);
 assert.equal((await service.save(scope,{...original,userLabel:'another'})).status,'CONFLICT');
 assert.equal((await service.save(scope,command())).status,'CONFLICT');
 assert.equal((await rpc(scope,command({expectedVersion:1}), 'MUTATE')).place.version,2);
 assert.equal((await rpc(scope,command({expectedVersion:1}), 'MUTATE')).status,'CONFLICT');
 const old=await service.save(scope,original);assert.equal(old.replayed,true);assert.equal(old.superseded,true);assert.equal(old.place.version,1);assert.equal(old.currentPlace.version,2);
});
await test('LOST_RESPONSE_RECONCILES_WITHOUT_SECOND_MUTATION',async()=>{
 loseResponse=true;const before=mutations;const c=command({expectedVersion:2});const r=await service.save(scope,c);
 assert.equal(r.status,'SAVED');assert.equal(r.replayed,true);assert.equal(r.place.version,3);assert.equal(mutations,before+1);
 assert.equal((await service.save(scope,c)).replayed,true);assert.equal(mutations,before+1);
});
await test('ARCHIVE_RECOVERY_NO_VISITS_NO_CANONICAL',async()=>{
 const c=command({action:'ARCHIVE',expectedVersion:3});const calls=providerCalls;const r=await service.save(scope,c);
 assert.equal(r.status,'ARCHIVED');assert.equal(providerCalls,calls);const reread=await service.read(scope);
 assert.equal(reread.filter(p=>p.status==='SAVED').length,0);assert.equal(reread[0].version,4);
 const restored=await service.save(scope,command({expectedVersion:4}));assert.equal(restored.place.id,saved.place.id);assert.equal(restored.place.version,5);
 const count=(await db.query('select count(*)::int n from private.personal_google_places')).rows[0].n;assert.equal(count,1);
});
await test('HOMONYMS_NOT_MERGED_AND_PROVIDER_ERRORS_NO_MUTATION',async()=>{
 const r=await service.save(scope,command({googlePlaceId:'ChIJ_other_same_name'}));assert.equal(r.status,'SAVED');assert.notEqual(r.place.id,saved.place.id);
 providerFail=true;const n=mutations;assert.equal((await service.save(scope,command({googlePlaceId:'ChIJ_unavailable'}))).status,'PROVIDER_UNAVAILABLE');assert.equal(mutations,n);providerFail=false;
 for(const kind of ['ID','TYPE']){providerInvalid=kind;assert.equal((await service.save(scope,command({googlePlaceId:'ChIJ_invalid_'+kind}))).status,'INVALID');assert.equal(mutations,n);}providerInvalid=null;
 for(const patch of [{userId:A},{formattedAddress:'forbidden'},{expectedVersion:-1},{googlePlaceId:'bad id'},{action:null}])assert.throws(()=>parsePersonalGooglePlaceCommand(command(patch)));
 for(const patch of [{action:null},{googlePlaceId:12345},{requestId:null},{expectedVersion:null}])assert.equal((await rpc(scope,command(patch),'MUTATE')).status,'INVALID');
});
await test('ISOLATION_ACCESS_REVOKED_AND_BANNED',async()=>{
 assert.equal((await service.save({userId:A,householdId:H2},command())).status,'DENIED');
 assert.equal((await rpc({userId:A,householdId:H2},command(),'MUTATE')).status,'DENIED');
 assert.deepEqual(await rpc({userId:B,householdId:H1},null,'READ'),[]);
 await db.exec(`delete from private.household_memberships where user_id='${A}'`);
 assert.equal((await rpc(scope,null,'READ')).status,'DENIED');assert.equal((await rpc(scope,original,'REPLAY')).status,'DENIED');
 await db.exec(`insert into private.household_memberships values('${A}','${H1}');update auth.users set banned_until=now()+interval '1 day' where id='${A}'`);
 assert.equal((await rpc(scope,null,'READ')).status,'DENIED');await db.exec(`update auth.users set banned_until=null where id='${A}'`);
});
await test('RPC_PRIVILEGES_NO_ORDINARY_DML',async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  for(const statement of ["select public.personal_google_place_v1(null,null,null,'READ')","select * from private.personal_google_places","insert into private.personal_google_places default values","update private.personal_google_places set user_label='bad'","delete from private.personal_google_places"])
   await assert.rejects(()=>db.exec(statement));
  await db.exec('reset role');
 }
 await db.exec('set role service_role');assert.equal((await rpc(scope,null,'READ')).length,2);await assert.rejects(()=>db.exec('delete from private.personal_google_places'));await db.exec('reset role');
});
await test('TRANSACTION_FAILURE_ROLLS_BACK_PLACE_AND_REQUEST',async()=>{
 await db.exec("create function private.synthetic_fail() returns trigger language plpgsql as $$begin raise exception 'synthetic request journal failure';end$$;create trigger test_fail before insert on private.personal_google_place_requests for each row execute function private.synthetic_fail();");
 const c=command({googlePlaceId:'ChIJ_transaction_failure'});await assert.rejects(()=>rpc(scope,c,'MUTATE'));
 assert.equal((await db.query("select count(*)::int n from private.personal_google_places where external_id='ChIJ_transaction_failure'")).rows[0].n,0);
 await db.exec('drop trigger test_fail on private.personal_google_place_requests;');
 assert.equal((await rpc(scope,c,'MUTATE')).status,'SAVED');
});
await test('PUBLISHED_MAPPING_EXACT_SCOPE_GENERATION_PRIVACY_CONFLICT',()=>{
 const m={provider:'google_places',googlePlaceId:original.googlePlaceId,canonicalPlaceId:randomUUID(),householdId:H1,sourceGeneration:'g1',mappingVersion:1,publicationStatus:'PUBLISHED',privatePlace:false},s={householdId:H1,sourceGeneration:'g1'};
 assert.equal(matchPublishedGooglePlace(m.googlePlaceId,s,[m]).status,'LINKED');
 for(const patch of [{googlePlaceId:'ChIJ_other'},{householdId:H2},{sourceGeneration:'g2'},{privatePlace:true},{publicationStatus:'PENDING'}])assert.equal(matchPublishedGooglePlace(m.googlePlaceId,s,[{...m,...patch}]).status,'PENDING');
 assert.equal(matchPublishedGooglePlace(m.googlePlaceId,s,[m,{...m,canonicalPlaceId:randomUUID()}]).status,'CONFLICT');
});
await test('RENAME_OFFLINE_PRESERVES_VERIFICATION_AND_JOURNAL_REVIEW',async()=>{
 const originalPlace=(await service.read(scope)).find(p=>p.googlePlaceId===original.googlePlaceId);providerFail=true;const before=providerCalls;
 const renamed=await service.save(scope,command({expectedVersion:originalPlace.version,userLabel:'A personal rename'}));
 assert.equal(renamed.status,'SAVED');assert.equal(providerCalls,before);assert.equal(Date.parse(renamed.place.verifiedAt),Date.parse(originalPlace.verifiedAt));providerFail=false;
 const review=(await db.query("select count(*)::int n from private.personal_google_place_requests where review_after>=created_at+interval '365 days'")).rows[0].n;assert(review>0);
});
await test('ACCOUNT_DELETION_ONLY_REMOVES_OWN_PRIVATE_PLACES',async()=>{
 const who='f07b0000-0000-4000-8000-0000000000d1';await db.query('insert into auth.users values($1,null)',[who]);await db.query('insert into private.household_memberships values($1,$2)',[who,H1]);
 const n=(await rpc(scope,null,'READ')).length;assert.equal((await rpc({userId:who,householdId:H1},command(),'MUTATE')).status,'SAVED');
 await db.query('delete from auth.users where id=$1',[who]);assert.equal((await db.query('select count(*)::int n from private.personal_google_places where owner_user_id=$1',[who])).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from private.personal_google_place_requests where owner_user_id=$1',[who])).rows[0].n,0);assert.equal((await rpc(scope,null,'READ')).length,n);
});
await test('SQL_CATALOG_OWNERS_SEARCH_PATH_PRIVILEGES_AND_RLS',async()=>{
 const f=(await db.query("select n.nspname,p.prosecdef,pg_get_userbyid(p.proowner) owner,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='personal_google_place_v1' order by n.nspname")).rows;
 assert.equal(f.length,2);assert(f.every(x=>x.owner==='postgres'));assert.equal(f.find(x=>x.nspname==='private').prosecdef,true);assert.equal(f.find(x=>x.nspname==='public').prosecdef,false);
 assert(f.every(x=>x.proconfig.some(v=>v==='search_path=""')));
 const tables=(await db.query("select relrowsecurity from pg_class where oid in ('private.personal_google_places'::regclass,'private.personal_google_place_requests'::regclass)")).rows;assert.equal(tables.length,2);assert(tables.every(x=>x.relrowsecurity));
 const fk=(await db.query("select confdeltype from pg_constraint where contype='f' and conrelid in ('private.personal_google_places'::regclass,'private.personal_google_place_requests'::regclass)")).rows;assert.equal(fk.length,4);assert(fk.every(x=>x.confdeltype==='c'));
});
if(pgConfig)await test('PG17_TWO_CONNECTIONS_CAS_AND_IDEMPOTENCE_REOPEN',async()=>{
 const {Client}=require('pg'),a=new Client(pgConfig),b=new Client(pgConfig);await a.connect();await b.connect();
 try {const p=(await rpc(scope,null,'READ')).find(p=>p.googlePlaceId===original.googlePlaceId);
 const call=(client,c)=>client.query('select public.personal_google_place_v1($1,$2,$3::jsonb,$4) r',[A,H1,JSON.stringify(c),'MUTATE']).then(r=>r.rows[0].r);
 await a.query('set role service_role');await b.query('set role service_role');
 const results=await Promise.all([call(a,command({expectedVersion:p.version,userLabel:'Concurrent one'})),call(b,command({expectedVersion:p.version,userLabel:'Concurrent two'}))]);
 assert.deepEqual(results.map(r=>r.status).sort(),['CONFLICT','SAVED']);
 const request=command({expectedVersion:p.version+1});const replay=await Promise.all([call(a,request),call(b,request)]);assert(replay.every(r=>r.status==='SAVED'));assert.deepEqual(replay.map(r=>r.replayed).sort(),[false,true]);
 const read=(await b.query('select public.personal_google_place_v1($1,$2,null,$3) r',[A,H1,'READ'])).rows[0].r;assert.equal(read.find(x=>x.id===p.id).version,p.version+2);
 }finally{await a.end();await b.end();}
});
const serverVersion=(await db.query('show server_version')).rows[0].server_version;
await db.close();const proofDir=process.env.BAR_SQL_ENGINE==='pg17'?'outputs/bar-live-final':'outputs/bar-live';fs.mkdirSync(proofDir,{recursive:true});fs.writeFileSync(proofDir+'/personal-tests.json',JSON.stringify({at:new Date().toISOString(),serverVersion,candidateSha256:createHash('sha256').update(sql).digest('hex'),level:pgConfig?'POSTGRESQL_17_REAL_MULTI_CONNECTION_SYNTHETIC_NOT_SUPABASE_AUTH':'PGLITE_SYNTHETIC_NOT_SUPABASE_AUTH_NOT_MULTI_CONNECTION',checks},null,2));
process.exitCode=checks.some(c=>c.status==='FAIL')?1:0;
