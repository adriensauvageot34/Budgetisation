import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {require} from './lib/phase2-ts-loader.mjs';
const {PersonalGooglePlaces}=require('@/server/places/personal-google-places');
const {personalPlaceRpcStore}=require('@/server/places/personal-google-place-store');
const {parsePersonalGooglePlaceCommand,matchPublishedGooglePlace}=require('@/domain/phase2/personal-google-place');
const db=new PGlite(),checks=[];
const A='f07b0000-0000-4000-8000-0000000000a1',B='f07b0000-0000-4000-8000-0000000000b1',H1='f07b0000-0000-4000-8000-000000000001',H2='f07b0000-0000-4000-8000-000000000002';
const scope={userId:A,householdId:H1};
const command=(patch={})=>({version:'personal-google-place@v1',requestId:randomUUID(),googlePlaceId:'ChIJ_synthetic_public_bar',userLabel:'My declared label',action:'SAVE',expectedVersion:0,...patch});
async function test(id,run){try{await run();checks.push({id,status:'PASS_LOCAL_DOMAIN'});console.log(id+' PASS');}catch(e){checks.push({id,status:'FAIL',error:e.message});console.error(id+' FAIL '+e.stack);}}
await db.exec(`create schema auth;create schema private;create role anon;create role authenticated;create role service_role;
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
await db.close();fs.mkdirSync('outputs/bar-live',{recursive:true});fs.writeFileSync('outputs/bar-live/personal-tests.json',JSON.stringify({level:'PGLITE_SYNTHETIC_NOT_SUPABASE_AUTH_NOT_MULTI_CONNECTION',checks},null,2));
process.exitCode=checks.some(c=>c.status==='FAIL')?1:0;
