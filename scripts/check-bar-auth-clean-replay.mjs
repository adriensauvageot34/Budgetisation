/** Final clean-SHA replay: existing synthetic users; no new accounts or financial writers. */
import assert from 'node:assert/strict';import fs from 'node:fs';import {randomUUID} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {barTestKeys,BAR_TEST_PROJECT,BAR_TEST_URL} from './lib/bar-test-supabase.mjs';import {require} from './lib/phase2-ts-loader.mjs';
const {createClient}=require('@supabase/supabase-js'),{PersonalGooglePlaces}=require('@/server/places/personal-google-places'),{personalPlaceRpcStore}=require('@/server/places/personal-google-place-store');
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.equal(execFileSync('git',['diff','HEAD','--name-only'],{encoding:'utf8'}).trim(),'','TRACKED_WORKTREE_MUST_BE_CLEAN');
const proof=JSON.parse(fs.readFileSync('outputs/bar-production-readiness/auth-tests.json','utf8')),keys=barTestKeys(),config={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},admin=createClient(BAR_TEST_URL,keys.secret,config);
async function session(name){const user=await admin.auth.admin.getUserById(proof.accounts[name].id);assert.equal(user.error,null);const link=await admin.auth.admin.generateLink({type:'magiclink',email:user.data.user.email});assert.equal(link.error,null);const client=createClient(BAR_TEST_URL,keys.publishable,config);assert.equal((await client.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'email'})).error,null);return client;}
const a=await session('A'),a2=await session('A'),b=await session('B');
const scope={userId:proof.accounts.A.id,householdId:'ba190000-0000-4000-8000-000000000001'},base=personalPlaceRpcStore(admin);let writes=0,lost=false;
const store={...base,mutate:async(s,c)=>{writes++;const r=await base.mutate(s,c);if(lost){lost=false;throw Error('LOST_AFTER_COMMIT');}return r;}};
const google={details:async id=>({provider:'google_places',placeId:id,types:['bar']})};
const owner=client=>new PersonalGooglePlaces(store,async s=>{const u=await client.auth.getUser();const h=await client.from('households').select('household_id').eq('household_id',s.householdId);return !u.error&&u.data.user.id===s.userId&&!h.error&&h.data.length===1;},google);
const one=owner(a),two=owner(a2),checks=[];const test=async(id,fn)=>{await fn();checks.push({id,status:'PASS_REAL_AUTH'});console.log(id+' PASS');};
const id='ChIJ_clean_'+randomUUID().replaceAll('-',''),cmd=(patch={})=>({version:'personal-google-place@v1',requestId:randomUUID(),googlePlaceId:id,expectedVersion:0,userLabel:'Clean SHA synthetic marker',action:'SAVE',...patch});
await test('CLEAN_SHA_AUTH_RENAME_ARCHIVE_RESTORE_RELOAD',async()=>{for(const [v,action]of[[0,'SAVE'],[1,'SAVE'],[2,'ARCHIVE'],[3,'SAVE']])assert.equal((await one.save(scope,cmd({expectedVersion:v,action}))).place.version,v+1);assert.equal((await two.read(scope)).find(p=>p.googlePlaceId===id).version,4);});
await test('CONCURRENT_REAL_SESSIONS_CAS',async()=>{const r=await Promise.all([one.save(scope,cmd({expectedVersion:4})),two.save(scope,cmd({expectedVersion:4}))]);assert.deepEqual(r.map(x=>x.status).sort(),['CONFLICT','SAVED']);});
await test('LOST_RESPONSE_RECEIPT_NO_SECOND_WRITE',async()=>{lost=true;const c=cmd({expectedVersion:5}),before=writes;assert.equal((await one.save(scope,c)).replayed,true);assert.equal((await two.save(scope,c)).replayed,true);assert.equal(writes,before+1);});
await test('OTHER_REAL_USER_NO_ACCESS',async()=>{assert.equal((await owner(b).save(scope,cmd())).status,'DENIED');});
fs.writeFileSync('outputs/bar-production-readiness/auth-clean-replay.json',JSON.stringify({sha,project:BAR_TEST_PROJECT,level:'REAL_SUPABASE_AUTH_WITH_GOOGLE_STUB',checks,financialWrites:0},null,2));
