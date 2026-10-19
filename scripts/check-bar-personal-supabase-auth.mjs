/** Genuine Auth/Admin/PostgREST in the separately approved empty test project.
 * No key/password/JWT is written. Never targets Budgetisation Production.
 */
import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import {randomUUID,randomBytes} from 'node:crypto';import {createInterface} from 'node:readline';
import {barTestKeys,BAR_TEST_PROJECT,BAR_TEST_URL} from './lib/bar-test-supabase.mjs';
import {require} from './lib/phase2-ts-loader.mjs';
const {createClient}=require('@supabase/supabase-js');
const {PersonalGooglePlaces}=require('@/server/places/personal-google-places');
const {personalPlaceRpcStore}=require('@/server/places/personal-google-place-store');
const keys=barTestKeys(),options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(BAR_TEST_URL,keys.secret,options),anon=createClient(BAR_TEST_URL,keys.publishable,options);
const scopeIds={H1:'ba190000-0000-4000-8000-000000000001',H2:'ba190000-0000-4000-8000-000000000002'};
const at=new Date().toISOString(),runId=Date.now(),users={},sessions={};
const evidence={at,project:BAR_TEST_PROJECT,level:'REAL_SUPABASE_AUTH_JWT_POSTGREST_TEST_PROJECT',accounts:{},checks:[],trace:[],financialWrites:0};
const destination='outputs/bar-production-readiness/auth-tests.json';
const record=()=>fs.writeFileSync(destination,JSON.stringify(evidence,null,2));fs.mkdirSync('outputs/bar-production-readiness',{recursive:true});
for(const name of ['A','B','C']){
 const email=`bar-${name.toLowerCase()}-${runId}@example.invalid`,password=randomBytes(24).toString('base64url')+'aA1!';
 const r=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{bar_google_test:'closure-20261019'}});
 if(r.error||!r.data.user)throw Error('TEST_AUTH_ADMIN_CREATION_FAILED_'+name);
 users[name]={id:r.data.user.id,email,password};evidence.accounts[name]={id:r.data.user.id};
 const client=createClient(BAR_TEST_URL,keys.publishable,options),login=await client.auth.signInWithPassword({email,password});
 if(login.error||!login.data.session)throw Error('TEST_AUTH_LOGIN_FAILED_'+name);sessions[name]=client;
}
sessions.A2=createClient(BAR_TEST_URL,keys.publishable,options);assert.equal((await sessions.A2.auth.signInWithPassword({email:users.A.email,password:users.A.password})).error,null);
console.log(JSON.stringify({state:'WAIT_PROVISION',project:BAR_TEST_PROJECT,users:Object.fromEntries(Object.entries(users).map(([n,u])=>[n,u.id])),...scopeIds}));record();
// A short-lived local display for normal browser sign-in. Only synthetic login
// credentials, never API keys. Values stay masked; no CORS, no URL tokens, no logs.
const server=http.createServer((req,res)=>{if(req.headers.host!=='127.0.0.1:3258'||req.method!=='GET'){res.writeHead(403);res.end();return;}
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
 const name=new URL(req.url,'http://127.0.0.1').searchParams.get('account')??'A',u=users[name];if(!u){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type','text/html;charset=utf-8');res.end(`<h1>Compte fictif ${name} — projet Bar-Test</h1><label>E-mail de test<input value="${u.email}" readonly></label><label>Mot de passe temporaire de test<input type="password" value="${u.password}" readonly></label><p>Uniquement pour la Preview isolée. Aucun identifiant personnel ou clé administrateur.</p>`);});
server.listen(3258,'127.0.0.1');
const lines=createInterface({input:process.stdin,terminal:false});const queue=[];let waiting;lines.on('line',s=>{if(waiting){const w=waiting;waiting=null;w(s.trim());}else queue.push(s.trim());});
const wait=expected=>new Promise((resolve,reject)=>{const receive=s=>s===expected?resolve():reject(Error('TEST_CONTROL_UNEXPECTED'));if(queue.length)receive(queue.shift());else waiting=receive;});
const test=async(id,run)=>{try{await run();evidence.checks.push({id,status:'PASS_REAL_AUTH'});console.log(id+' PASS');}catch(e){evidence.checks.push({id,status:'FAIL',code:e.code??e.name});console.log(id+' FAIL');}record();};
await wait('PROVISIONED');
const scope=name=>({userId:users[name].id,householdId:name==='C'?scopeIds.H2:scopeIds.H1});
async function authorized(name,candidate){const r=await sessions[name].auth.getUser();if(r.error||r.data.user?.id!==candidate.userId)return false;
 const houses=await sessions[name].from('households').select('household_id').eq('household_id',candidate.householdId);return !houses.error&&houses.data.length===1;}
const events=e=>evidence.trace.push(e);
const rpcStore=personalPlaceRpcStore(admin);
let lost=false,writes=0;
const storage={...rpcStore,mutate:async(s,c)=>{writes++;const result=await rpcStore.mutate(s,c);if(lost){lost=false;throw Error('INJECTED_LOST_HTTP_RESPONSE_AFTER_REAL_COMMIT');}return result;}};
// Contract verification (identity/type) uses a stub here to isolate Auth/RLS/CAS.
// Google itself was already certified live and is separately used by the Preview.
const google={details:async id=>({provider:'google_places',placeId:id,types:['bar']})};
const owner=name=>new PersonalGooglePlaces(storage,s=>authorized(name,s),google,events);
const c=(patch={})=>({version:'personal-google-place@v1',requestId:randomUUID(),googlePlaceId:'ChIJ_auth_test_A',expectedVersion:0,action:'SAVE',userLabel:'Repère synthétique homonyme',...patch});
let command=c(),saved;
await test('AUTH_REAL_4_SESSIONS_AND_ANONYMOUS',async()=>{for(const n of ['A','A2','B','C'])assert.equal((await sessions[n].auth.getUser()).error,null);assert((await anon.auth.getUser()).error);});
await test('SAVE_READ_RENAME_ARCHIVE_RECOVER_RELOAD',async()=>{
 saved=await owner('A').save(scope('A'),command);assert.equal(saved.status,'SAVED');assert.equal(saved.place.version,1);
 for(const [action,version,label]of[['SAVE',1,'Mon nom personnel'],['ARCHIVE',2,'Mon nom personnel'],['SAVE',3,'Mon nom personnel']]){const r=await owner('A').save(scope('A'),c({action,expectedVersion:version,userLabel:label}));assert.equal(r.place.version,version+1);assert.equal(r.place.id,saved.place.id);}
 assert.equal((await owner('A').read(scope('A')))[0].version,4);
 assert.equal((await new PersonalGooglePlaces(rpcStore,s=>authorized('A2',s),google).read(scope('A')))[0].version,4);
});
await test('HOMONYMS_DUPLICATE_ID_AND_STALE_VERSION',async()=>{
 const other=await owner('A').save(scope('A'),c({googlePlaceId:'ChIJ_auth_homonym_B'}));assert.equal(other.status,'SAVED');assert.notEqual(other.place.id,saved.place.id);
 assert.equal((await owner('A').save(scope('A'),c())).status,'CONFLICT');assert.equal((await owner('A').save(scope('A'),c({expectedVersion:3}))).status,'CONFLICT');
});
await test('AUTH_SCOPE_B_SAME_HOUSEHOLD_C_OTHER_HOUSEHOLD',async()=>{
 assert.deepEqual(await owner('B').read(scope('B')),[]);
 assert.equal((await owner('B').save(scope('A'),c())).status,'DENIED');
 assert.equal((await owner('C').save({...scope('C'),householdId:scopeIds.H1},c())).status,'DENIED');
 assert.equal((await owner('A').save({...scope('A'),householdId:scopeIds.H2},c())).status,'DENIED');
});
await test('REAL_JWT_ROLES_RPC_AND_DIRECT_DML_DENIED',async()=>{
 for(const client of [anon,sessions.A,sessions.B,sessions.C]){
  assert((await client.rpc('personal_google_place_v1',{p_actor:users.A.id,p_household:scopeIds.H1,p_command:command,p_mode:'MUTATE'})).error);
  for(const action of ['select','insert','update','delete']){
   const q=client.schema('private').from('personal_google_places');const r=await(action==='select'?q.select('*'):action==='insert'?q.insert({}):action==='update'?q.update({user_label:'bad'}).eq('owner_user_id',users.A.id):q.delete().eq('owner_user_id',users.A.id));assert(r.error);
  }
 }
});
await test('CONCURRENT_TWO_AUTH_SESSIONS_CAS_REPLAY',async()=>{
 const a=owner('A'),b=new PersonalGooglePlaces(storage,s=>authorized('A2',s),google,events);
 const r=await Promise.all([a.save(scope('A'),c({expectedVersion:4,userLabel:'Concurrent one'})),b.save(scope('A'),c({expectedVersion:4,userLabel:'Concurrent two'}))]);assert.deepEqual(r.map(x=>x.status).sort(),['CONFLICT','SAVED']);
 command=c({expectedVersion:5});const replay=await Promise.all([a.save(scope('A'),command),b.save(scope('A'),command)]);assert(replay.every(x=>x.status==='SAVED'));assert.deepEqual(replay.map(x=>x.replayed).sort(),[false,true]);
 assert.equal((await a.save(scope('A'),{...command,userLabel:'different payload'})).status,'CONFLICT');
});
await test('LOST_RESPONSE_REAL_COMMIT_RECONCILES_WITHOUT_SECOND_WRITE',async()=>{
 const before=writes;lost=true;command=c({expectedVersion:6});const r=await owner('A').save(scope('A'),command);assert.equal(r.status,'SAVED');assert.equal(r.replayed,true);assert.equal(r.place.version,7);assert.equal(writes,before+1);
 assert.equal((await owner('A').save(scope('A'),command)).replayed,true);assert.equal(writes,before+1);
});
console.log('WAIT_REVOKE_MEMBERSHIP');await wait('REVOKED');
await test('MEMBERSHIP_REVOKED_OLD_REAL_JWT_DENIED',async()=>{assert.equal((await owner('A').save(scope('A'),c({expectedVersion:7}))).status,'DENIED');await assert.rejects(()=>owner('A').read(scope('A')));assert.equal((await admin.rpc('personal_google_place_v1',{p_actor:users.A.id,p_household:scopeIds.H1,p_command:command,p_mode:'REPLAY'})).data.status,'DENIED');});
console.log('WAIT_RESTORE_AND_TRANSACTION_FAULT');await wait('RESTORED');
await test('REAL_AUTH_TRANSACTION_FAILURE_NO_PARTIAL_PLACE',async()=>{const r=await owner('A').save(scope('A'),c({googlePlaceId:'ChIJ_auth_transaction_failure',userLabel:'TX_FAIL_TEST'}));assert.equal(r.status,'UNAVAILABLE');assert(!(await owner('A').read(scope('A'))).some(p=>p.googlePlaceId==='ChIJ_auth_transaction_failure'));});
console.log('AUTH_TESTS_DONE_BRIDGE_READY http://127.0.0.1:3258/');record();
await wait('BAN_AND_STOP');
for(const n of ['A','B','C']){const r=await admin.auth.admin.updateUserById(users[n].id,{ban_duration:'8760h',app_metadata:{bar_google_test:null}});assert.equal(r.error,null);}
await test('BANNED_ACCOUNT_OLD_JWT_RPC_DENIED',async()=>{const r=await admin.rpc('personal_google_place_v1',{p_actor:users.A.id,p_household:scopeIds.H1,p_command:null,p_mode:'READ'});assert.equal(r.data.status,'DENIED');});
evidence.accountsDisabled=true;record();server.close();lines.close();process.stdin.pause();console.log('TEST_IDENTITIES_DISABLED_NO_DELETE');process.exit(evidence.checks.some(c=>c.status==='FAIL')?1:0);
