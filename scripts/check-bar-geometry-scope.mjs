import assert from 'node:assert/strict';
import Module from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
const saved={...process.env};
const original=Module._load;let email='author@example.invalid',householdReads=0,authReads=0;
globalThis.fetch=()=>{throw Error('NO_REMOTE_NETWORK_IN_CONTRACT_TEST');};
Module._load=function(name,...args){if(name==='@/server/bootstrap/auth')return {getAuthenticatedBootstrapClient:async()=>{authReads++;return {user:{id:'test-author',email,app_metadata:{}},supabase:{}};}};if(name==='@/server/bootstrap/queries')return {getCurrentHousehold:async()=>{householdReads++;throw Error('PERSONAL_HOUSEHOLD_MUST_NOT_BE_READ');}};return original.call(this,name,...args);};
Object.assign(process.env,{VERCEL_ENV:'preview',BAR_GEOMETRY_RECEPTION:'1',BAR_GEOMETRY_AUTHOR:'author@example.invalid',SUPABASE_URL:'https://ipuuhxrblxormwgoaqnz.supabase.co',NEXT_PUBLIC_SUPABASE_URL:'https://ipuuhxrblxormwgoaqnz.supabase.co'});
const {barReceptionScope,barReceptionEnabled}=require('@/server/recette/bar-favorites');
assert.equal(barReceptionEnabled(),true);const s=await barReceptionScope();assert.equal(householdReads,0);assert.equal(authReads,1);assert.equal(s.householdId,'ba190000-0000-4000-8000-000000000001');assert.equal(await s.deps.repository.readActivePlan(),null);await assert.rejects(()=>s.deps.repository.applyRevision(),/APPLY_FORBIDDEN/);assert.equal((await s.deps.readWorld(s.householdId,'2026-11')).baseline.householdId,s.householdId);await assert.rejects(()=>s.deps.readWorld('real-household','2026-11'),/SCOPE_INVALID/);email='other@example.invalid';await assert.rejects(()=>barReceptionScope(),/DENIED/);process.env.VERCEL_ENV='production';assert.equal(barReceptionEnabled(),false);process.env.VERCEL_ENV='preview';delete process.env.BAR_GEOMETRY_AUTHOR;assert.equal(barReceptionEnabled(),false);assert.equal(householdReads,0);console.log('PREVIEW_GEOMETRY_SCOPE PASS: author-bound, production denied, no household read, no Plan writer, synthetic world only.');

