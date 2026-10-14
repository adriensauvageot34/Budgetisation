import assert from 'node:assert/strict';
import Module from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';

let authenticated=true,enabled=true,authorizationCalls=0,saveCalls=0,lifecycleCalls=0;
const authError=class BootstrapAuthenticationRequiredError extends Error {};
const scope={supabase:{},userId:'author',householdId:'household'};
const active={draftId:'draft',version:1,digest:'digest',lifecycle:'ACTIVE'};
const snapshot={active,archives:[],activePlanRevisionId:null,activePlanRevisionNumber:0,baseStale:false};
const loaded=Module._load;
Module._load=function(request,parent,isMain){
  if(request==='@/server/bootstrap/errors')return {BootstrapAuthenticationRequiredError:authError};
  if(request==='@/server/phase2/planner/runtime')return {authorizedPlanner:async()=>{authorizationCalls++;if(!authenticated)throw new authError();return scope;}};
  if(request==='@/server/phase2/planner/composer-draft-cutover')return {composerDraftAutosaveEnabledFor:()=>enabled};
  if(request==='@/server/phase2/planner/composer-draft-service')return {
    readComposerDrafts:async()=>snapshot,
    saveComposerDraft:async(_scope,command)=>{saveCalls++;assert.deepEqual(_scope,scope);return {ok:true,draft:active,replayed:saveCalls>1,requestId:command.requestId};},
    changeComposerDraftLifecycle:async(_scope,kind)=>{lifecycleCalls++;return {ok:true,draft:active,replayed:false,kind};},
  };
  return loaded.call(this,request,parent,isMain);
};
const route=require('@/app/api/composer/drafts/route');
const {composerDraftHttpTransport}=require('@/app/mois-a-venir/composer/draft-http-transport');
Module._load=loaded;

const url='https://example.test/api/composer/drafts';
const post=(body,{origin='https://example.test',contentType='application/json',length}={})=>route.POST(new Request(url,{method:'POST',headers:{origin,'content-type':contentType,...(length?{'content-length':String(length)}:{})},body}));
const checks=[];
async function check(name,run){await run();checks.push(name);}
await check('same-origin and JSON required before authorization',async()=>{
  const before=authorizationCalls;
  assert.equal((await post('{}',{origin:'https://other.test'})).status,403);
  assert.equal((await post('{}',{contentType:'text/plain'})).status,415);
  assert.equal((await post('{}',{contentType:'application/jsonp'})).status,415);
  assert.equal((await post('{}',{length:1_200_001})).status,413);
  assert.equal((await post('{')).status,400);
  assert.equal(authorizationCalls,before);
});
await check('read requires valid month and server authorization',async()=>{
  assert.equal((await route.GET(new Request(url+'?month=no'))).status,400);
  authenticated=false;
  assert.equal((await route.GET(new Request(url+'?month=2026-10'))).status,401);
  authenticated=true;enabled=false;
  assert.equal((await route.GET(new Request(url+'?month=2026-10'))).status,403);
  enabled=true;
  const response=await route.GET(new Request(url+'?month=2026-10'));
  assert.equal(response.status,200,JSON.stringify(await response.clone().json()));assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(await response.json(),snapshot);
});
await check('only Draft service owns writes; route never applies a Plan',async()=>{
  const command={targetMonth:'2026-10',requestId:'same-request'};
  assert.equal((await post(JSON.stringify({kind:'APPLY',command}))).status,400);
  assert.equal(saveCalls,0);
  authenticated=false;
  assert.equal((await post(JSON.stringify({kind:'SAVE',command}))).status,401);
  authenticated=true;
  assert.equal(saveCalls,0);
  assert.equal((await post(JSON.stringify({kind:'SAVE',command}))).status,200);
  assert.equal(saveCalls,1);
  assert.equal((await post(JSON.stringify({kind:'ARCHIVE',command}))).status,200);
  assert.equal((await post(JSON.stringify({kind:'RESTORE',command}))).status,200);
  assert.equal(lifecycleCalls,2);
});
await check('stable HTTP path survives a lost response and a changed client build',async()=>{
  let lose=true;
  globalThis.fetch=async(input,init)=>{
    assert.equal(String(input).split('?')[0],'/api/composer/drafts');
    if(init?.method==='POST'){
      const response=await post(init.body);
      if(lose){lose=false;throw new Error('RESPONSE_LOST_AFTER_COMMIT');}
      return response;
    }
    return route.GET(new Request(url+String(input).slice('/api/composer/drafts'.length)));
  };
  const command={targetMonth:'2026-10',requestId:'stable-across-builds'};
  await assert.rejects(composerDraftHttpTransport.save(command),/RESPONSE_LOST_AFTER_COMMIT/);
  const recovered=await composerDraftHttpTransport.save(command);
  assert.equal(recovered.ok,true);assert.equal(recovered.replayed,true);
  assert.deepEqual(await composerDraftHttpTransport.read('2026-10'),snapshot);
  assert.equal(saveCalls,3);
  // Service owns CAS/idempotence; this test checks transport and route continuity.
});
console.log(JSON.stringify({status:'PASS_LOCAL_MOCKED_SERVICE_ONLY',checks,remoteWrites:0,financialWrites:0}));
