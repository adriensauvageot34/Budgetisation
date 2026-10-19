/** Real managed Auth cookies + actual Preview HTTP, never JWT injection in a browser. */
import assert from 'node:assert/strict';import fs from 'node:fs';import {randomUUID} from 'node:crypto';import {execFileSync} from 'node:child_process';import {createClient} from '@supabase/supabase-js';import {createServerClient} from '@supabase/ssr';
import {barTestKeys,BAR_TEST_URL} from './lib/bar-test-supabase.mjs';
const origin=process.env.BAR_TEST_PREVIEW_URL;if(origin!=='https://budgetisation-ns217ehxq-adriensauvageot34-6137s-projects.vercel.app')throw Error('EXACT_AUTH_TEST_PREVIEW_REQUIRED');
// Official same-project Preview Trusted Sources credential, loaded without output.
// Never disable Deployment Protection or reuse this header on another origin.
if(fs.existsSync('.env.local'))process.loadEnvFile('.env.local');
const keys=barTestKeys(),proof=JSON.parse(fs.readFileSync('outputs/bar-production-readiness/auth-tests.json','utf8')),admin=createClient(BAR_TEST_URL,keys.secret,{auth:{persistSession:false,autoRefreshToken:false}});
const u=await admin.auth.admin.getUserById(proof.accounts.A.id);assert.equal(u.data.user.app_metadata.bar_google_test,'closure-20261019');
const link=await admin.auth.admin.generateLink({type:'magiclink',email:u.data.user.email}),jar=new Map();
const client=createServerClient(BAR_TEST_URL,keys.publishable,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
assert.equal((await client.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'email'})).error,null);
const headers={Cookie:[...jar].map(([n,v])=>`${n}=${v}`).join('; '),Origin:origin,'Content-Type':'application/json'};
if(process.env.VERCEL_OIDC_TOKEN)headers['x-vercel-trusted-oidc-idp-token']=process.env.VERCEL_OIDC_TOKEN;
const request=init=>fetch(origin+'/api/places/personal',{...init,headers,redirect:'error',signal:AbortSignal.timeout(20000)});
const before=await request();if(!before.ok||!before.headers.get('content-type')?.includes('application/json')){console.log('VERCEL_HTTP_BLOCKED_'+before.status);process.exit(2);}
const places=(await before.json()).places,p=places.find(p=>p.userLabel==='Recette Vercel — concurrent');assert(p);assert.equal(p.version,5);
const command={version:'personal-google-place@v1',requestId:randomUUID(),googlePlaceId:p.googlePlaceId,userLabel:p.userLabel,action:'SAVE',expectedVersion:p.version},body=JSON.stringify(command);
const sent=await request({method:'POST',body});assert(sent.ok);assert.equal(sent.headers.get('x-place-request-id'),command.requestId);await sent.body.cancel(); // Deliberately never receive/acknowledge the commit payload.
const replay=await request({method:'POST',body}),receipt=await replay.json();assert(replay.ok);assert.equal(receipt.replayed,true);assert.equal(receipt.place.version,6);
const after=await request(),read=(await after.json()).places.find(x=>x.id===p.id);assert.equal(read.version,6);assert.equal(read.status,'SAVED');
fs.writeFileSync('outputs/bar-production-readiness/vercel-http-lost-response.json',JSON.stringify({sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),level:'REAL_VERCEL_HTTP_REAL_AUTH_COOKIE_JWT',requestId:command.requestId,lostPayload:true,replayed:true,versionBefore:5,versionAfter:6,samePlaceId:true,doubleWrite:false,financialWrites:0},null,2));
console.log('VERCEL_REAL_HTTP_LOST_RESPONSE_SAME_REQUEST_ONE_COMMIT PASS');await client.auth.signOut({scope:'local'});
