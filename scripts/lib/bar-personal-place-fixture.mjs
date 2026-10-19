/** Local browser harness: real candidate SQL + real service, synthetic Auth/Google.
 * No Supabase connection. Never import from the application or deploy this helper.
 */
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {require} from './phase2-ts-loader.mjs';
const {PersonalGooglePlaces}=require('@/server/places/personal-google-places');
const {personalPlaceRpcStore}=require('@/server/places/personal-google-place-store');
export async function personalPlaceFixture(googleOwner){
 let db;
 if(process.env.BAR_SQL_ENGINE==='pg17'){
  const {Client}=require('pg'),config={host:'127.0.0.1',port:55437,user:'postgres'};
  const admin=new Client({...config,database:'postgres'});await admin.connect();const name='bar_ui_'+Date.now();await admin.query('create database '+name);await admin.end();
  const client=new Client({...config,database:name});await client.connect();db={exec:s=>client.query(s),query:(...args)=>client.query(...args),close:()=>client.end()};
 }else db=new PGlite();
 const scope={userId:'f07b0000-0000-4000-8000-0000000000a1',householdId:'f07b0000-0000-4000-8000-000000000001'};
 await db.exec(`create schema auth;create schema private;
 do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;end$$;
 create table auth.users(id uuid primary key,banned_until timestamptz);create table public.households(household_id uuid primary key);
 create table private.household_memberships(user_id uuid,household_id uuid);insert into auth.users values('${scope.userId}',null);
 insert into public.households values('${scope.householdId}');insert into private.household_memberships values('${scope.userId}','${scope.householdId}');`);
 await db.exec(fs.readFileSync('supabase/candidates/BAR_PERSONAL_GOOGLE_PLACES_REVIEW_DO_NOT_EXECUTE.sql','utf8'));
 const store=personalPlaceRpcStore({rpc:async(_name,args)=>({error:null,data:(await db.query('select public.personal_google_place_v1($1,$2,$3::jsonb,$4) r',[args.p_actor,args.p_household,JSON.stringify(args.p_command),args.p_mode])).rows[0].r})});
 const google=googleOwner??{details:async id=>({provider:'google_places',placeId:id,types:['bar']})};
 const service=new PersonalGooglePlaces(store,async s=>s.userId===scope.userId&&s.householdId===scope.householdId,google);
 return {read:async()=>({enabled:true,places:await service.read(scope)}),save:raw=>service.save(scope,raw),close:()=>db.close()};
}
