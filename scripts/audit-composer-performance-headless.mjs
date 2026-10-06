// Runs the actual read-only Planner owners. Auth token remains in memory.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const [runtime, endpoint, out, countText='5', month='2026-10']=process.argv.slice(2);
if(!runtime||!endpoint||!out)throw new Error('runtime browser-endpoint output count month required');
process.chdir(runtime);fs.mkdirSync(out,{recursive:true});
const fixedNow=process.env.COMPOSER_PERF_ASOF??new Date().toISOString();
// Freeze all source-owner date defaults, including legacy providers outside readWorld.
if(process.env.COMPOSER_PERF_FREEZE_CLOCK==='1'){
 const NativeDate=Date,now=NativeDate.parse(fixedNow);
 globalThis.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
}
const socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
const cookies=await new Promise((resolve,reject)=>{socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id===1)message.error?reject(new Error(message.error.message)):resolve(message.result.cookies);};socket.send(JSON.stringify({id:1,method:'Storage.getCookies'}));});socket.close();
const chunks=cookies.filter(c=>c.domain==='localhost'&&/^sb-.*-auth-token(?:\.\d+)?$/.test(c.name)).sort((a,b)=>a.name.localeCompare(b.name));
if(!chunks.length)throw new Error('AUTH_COOKIES_REQUIRED');
let raw=chunks.map(c=>c.value).join('');if(raw.startsWith('base64-'))raw=Buffer.from(raw.slice(7),'base64url').toString();
const session=JSON.parse(raw),token=Array.isArray(session)?session[0]:session.access_token;
if(!token)throw new Error('AUTH_TOKEN_REQUIRED');
const modules=await import(pathToFileURL(path.join(runtime,'scripts/lib/phase2-ts-loader.mjs')).href), require=modules.require;
const {createClient}=createRequire(path.join(runtime,'package.json'))('@supabase/supabase-js');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL??process.env.SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??process.env.SUPABASE_PUBLISHABLE_KEY;
const authenticated=createClient(url,key,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const {createCanonicalReadClient}=require('@/server/canonical/client');
const {CanonicalRepository}=require('@/server/canonical/repository');
const {createAuthorizedRuntimeContext}=require('@/server/canonical/context');
const {parseInstant}=require('@/core/time');
const queries=require('@/server/bootstrap/queries');
const {createPlannerDependencies}=require('@/server/phase2/planner/world-reader');
const {readMonthComposer}=require('@/server/phase2/planner/read-model');
const {composerUiModel}=require('@/server/phase2/planner/composer-service');
const rows=[];
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');}
for(let run=1;run<=Number(countText);run++){
 const start=performance.now(),cpuStart=process.cpuUsage();let result;
 try{globalThis.__auditZoneMemo=new Set();globalThis.__auditWorkCounts={};result=await globalThis.__composerPerf('audit:complete-read-owner',async()=>{
   const first=await authenticated.auth.getUser(token);if(first.error)throw first.error;
   // Mirrors the duplicate auth validation present in authorizedPlanner/getBootstrapContext.
   const second=await authenticated.auth.getUser(token);if(second.error||second.data.user.id!==first.data.user.id)throw new Error('SESSION_CHANGED');
   const household=await queries.getCurrentHousehold(authenticated);
   const [persons,periods,revision]=await Promise.all([queries.getHouseholdPersons(authenticated,household.householdId),queries.getAnalysisPeriods(authenticated,household.householdId),queries.getHouseholdRevision(authenticated,household.householdId)]);
   const context=createAuthorizedRuntimeContext({user:first.data.user,household,persons,periods,revision},parseInstant(fixedNow));
   const deps=createPlannerDependencies(new CanonicalRepository(createCanonicalReadClient(),context),authenticated,()=>fixedNow);
   let capturedWorld;
   if(process.env.COMPOSER_PERF_CAPTURE_WORLD==='1'){
     const readWorld=deps.readWorld;deps.readWorld=async(...args)=>{capturedWorld=await readWorld(...args);return capturedWorld;};
   }
   const model=await readMonthComposer(deps,String(context.householdId),month),ui=await composerUiModel(deps,String(context.householdId),model);
   if(capturedWorld)fs.writeFileSync(path.join(out,'private-world.json'),JSON.stringify({world:capturedWorld,state:ui.semanticState,base:{expectedActiveRevisionId:model.preview.baseActiveRevisionId,expectedActiveRevisionNumber:model.preview.baseRevisionNumber},expected:{manifest:model.preview.compiledManifestDigest,projection:model.preview.projectionDigest,semantic:model.preview.semanticStateDigest}}));
   // Hash outputs only; no personal financial rows are written to the artifact.
   return {semanticDigest:digest(ui.semanticState),baselineDigest:model.preview.baselineDigest,projectionDigest:digest(ui.board.cockpit),cardsDigest:digest(ui.board),capabilitiesDigest:digest(ui.dropCapabilities),
     manifestDigest:model.preview.compiled.manifestDigest,uiBytes:Buffer.byteLength(JSON.stringify(ui)),unknownDigest:digest(model.preview.projection?.diagnostics??ui.board.cockpit?.diagnostics),
     counts:{cards:ui.board.baselineControls.length+ui.board.discretionaryControls.length+ui.board.savings.length,contexts:ui.board.contexts.length,assets:ui.library.searchableAssets.length}};
 });}catch(error){result={error:String(error.code||error.name||'AUDIT_FAILURE'),message:String(error.message).slice(0,100)};}finally{delete globalThis.__auditZoneMemo;}
 const cpu=process.cpuUsage(cpuStart);
 const row={run,asOf:fixedNow,wallStart:performance.timeOrigin+start,duration:performance.now()-start,cpuMs:(cpu.user+cpu.system)/1000,work:globalThis.__auditWorkCounts,...result};rows.push(row);
 fs.writeFileSync(path.join(out,'owner-runs.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify(row));
}
