import assert from 'node:assert/strict';
import Module from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';

const {emptyPlanSemanticState,semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {COMPOSER_DRAFT_HTTP_CONTRACT}=require('@/domain/phase2/planner/composer-draft-contract');
const month='2026-10', state=emptyPlanSemanticState(month), digest=semanticStateDigest(state);
const draftId='11111111-1111-4111-8111-111111111111';
const firstRequest='22222222-2222-4222-8222-222222222222';
let authenticated=true,enabled=true,authorizationCalls=0,saveCalls=0,lifecycleCalls=0;
let active={draftId,version:1,digest,lifecycle:'ACTIVE',semanticState:state,baseRevisionId:null,
  baseRevisionNumber:0,lastSavedAt:'2026-10-15T00:00:00Z',archivedAt:null,
  lastMutationRequestId:firstRequest,lastMutationExpectedVersion:0,lastMutationKind:'SAVE'};
let snapshot={active,archives:[],activePlanRevisionId:null,activePlanRevisionNumber:0,baseStale:false};
const authError=class BootstrapAuthenticationRequiredError extends Error {};
const scope={supabase:{},userId:'author',householdId:'household'};
const loaded=Module._load;
Module._load=function(request,parent,isMain){
  if(request==='@/server/bootstrap/errors')return {BootstrapAuthenticationRequiredError:authError};
  if(request==='@/server/phase2/planner/runtime')return {authorizedPlanner:async()=>{authorizationCalls++;if(!authenticated)throw new authError();return scope;}};
  if(request==='@/server/phase2/planner/composer-draft-cutover')return {composerDraftAutosaveEnabledFor:()=>enabled};
  if(request==='@/server/phase2/planner/composer-draft-service')return {
    readComposerDrafts:async()=>snapshot,
    saveComposerDraft:async(_scope,command)=>{
      saveCalls++;assert.deepEqual(_scope,scope);
      const replayed=active.lastMutationRequestId===command.requestId;
      if(!replayed){active={...active,version:active.version+1,digest:command.digest,semanticState:command.semanticState,
        lastMutationRequestId:command.requestId,lastMutationExpectedVersion:command.expectedDraftVersion};
        snapshot={...snapshot,active};}
      return {ok:true,draft:active,replayed};
    },
    changeComposerDraftLifecycle:async(_scope,kind,command)=>{
      lifecycleCalls++;
      active={...active,version:active.version+1,lifecycle:kind==='ARCHIVE'?'ABANDONED':'ACTIVE',
        lastMutationRequestId:command.requestId,lastMutationExpectedVersion:command.expectedDraftVersion,lastMutationKind:kind};
      snapshot={...snapshot,active:kind==='ARCHIVE'?null:active,archives:kind==='ARCHIVE'?[active]:[]};
      return {ok:true,draft:active,replayed:false};
    },
  };
  return loaded.call(this,request,parent,isMain);
};
const route=require('@/app/api/composer/drafts/route');
const {composerDraftHttpTransport}=require('@/app/mois-a-venir/composer/draft-http-transport');
Module._load=loaded;

const url='https://example.test/api/composer/drafts';
const header='X-Composer-Draft-Contract';
const post=(body,{origin='https://example.test',contentType='application/json',length,contract=COMPOSER_DRAFT_HTTP_CONTRACT}={})=>route.POST(new Request(url,{method:'POST',headers:{origin,'content-type':contentType,[header]:contract,...(length?{'content-length':String(length)}:{})},body}));
const get=(contract=COMPOSER_DRAFT_HTTP_CONTRACT)=>route.GET(new Request(url+'?month='+month,{headers:{[header]:contract}}));
const checks=[];
async function check(name,run){await run();checks.push(name);}
await check('same-origin, version and JSON required before authorization',async()=>{
  const before=authorizationCalls;
  assert.equal((await post('{}',{origin:'https://other.test'})).status,403);
  assert.equal((await post('{}',{contract:'composer-draft-http@2'})).status,409);
  assert.equal((await get('composer-draft-http@2')).status,409);
  assert.equal((await post('{}',{contentType:'text/plain'})).status,415);
  assert.equal((await post('{}',{contentType:'application/jsonp'})).status,415);
  assert.equal((await post('{}',{length:1_200_001})).status,413);
  assert.equal((await post('{')).status,400);
  assert.equal(authorizationCalls,before);
});
await check('read requires valid month and server authorization',async()=>{
  assert.equal((await route.GET(new Request(url+'?month=no',{headers:{[header]:COMPOSER_DRAFT_HTTP_CONTRACT}}))).status,400);
  authenticated=false;assert.equal((await get()).status,401);
  authenticated=true;enabled=false;assert.equal((await get()).status,403);
  enabled=true;
  const response=await get();
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(response.headers.get(header),COMPOSER_DRAFT_HTTP_CONTRACT);
  assert.deepEqual(await response.json(),snapshot);
});
await check('only Draft service owns writes; route never applies a Plan',async()=>{
  const command={targetMonth:month,expectedDraftVersion:1,requestId:firstRequest,digest,semanticState:state};
  assert.equal((await post(JSON.stringify({kind:'APPLY',command}))).status,400);
  assert.equal(saveCalls,0);
  authenticated=false;assert.equal((await post(JSON.stringify({kind:'SAVE',command}))).status,401);
  authenticated=true;assert.equal(saveCalls,0);
  assert.equal((await post(JSON.stringify({kind:'SAVE',command}))).status,200);
  assert.equal(saveCalls,1);
});
await check('old client on a new compatible build recovers a lost response',async()=>{
  let lose=true;
  globalThis.fetch=async(input,init)=>{
    assert.equal(String(input).split('?')[0],'/api/composer/drafts');
    if(init?.method==='POST'){
      const response=await post(init.body,{contract:init.headers[header]});
      if(lose){lose=false;throw new Error('RESPONSE_LOST_AFTER_COMMIT');}
      return response;
    }
    return get(init?.headers[header]);
  };
  const command={targetMonth:month,expectedDraftVersion:1,requestId:'33333333-3333-4333-8333-333333333333',digest,semanticState:state};
  await assert.rejects(composerDraftHttpTransport.save(command),/RESPONSE_LOST_AFTER_COMMIT/);
  const recovered=await composerDraftHttpTransport.save(command);
  assert.equal(recovered.ok,true);assert.equal(recovered.replayed,true);
  assert.equal(recovered.draft.lastMutationRequestId,command.requestId);
  assert.deepEqual(await composerDraftHttpTransport.read(month),snapshot);
  assert.equal(saveCalls,3);
});
await check('incompatible and malformed responses never confirm a save',async()=>{
  const command={targetMonth:month,expectedDraftVersion:active.version,requestId:'44444444-4444-4444-8444-444444444444',digest,semanticState:state};
  globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,draft:active,replayed:false}),
    {headers:{[header]:'composer-draft-http@2'}});
  const wrongVersion=await composerDraftHttpTransport.save(command);
  assert.equal(wrongVersion.ok,false);assert.match(wrongVersion.message,/incompatible/i);
  globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,draft:{...active,digest:'wrong'},replayed:false}),
    {headers:{[header]:COMPOSER_DRAFT_HTTP_CONTRACT}});
  const wrongDigest=await composerDraftHttpTransport.save(command);
  assert.equal(wrongDigest.ok,false);assert.match(wrongDigest.message,/incompatible/i);
  await assert.rejects(composerDraftHttpTransport.read(month),/DRAFT_CONTRACT_INCOMPATIBLE/);
  assert.equal(saveCalls,3);
});
console.log(JSON.stringify({status:'PASS_LOCAL_MOCKED_SERVICE_ONLY',checks,remoteWrites:0,financialWrites:0}));
