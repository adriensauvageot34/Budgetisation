/** N1 gate receipt: real route/page/Shell/owners; synthetic Auth, rows, DOM and transport. No remote writes. */
import assert from 'node:assert/strict';import path from 'node:path';import Module,{createRequire}from'node:module';
import {require}from'./lib/phase2-ts-loader.mjs';import{localRelationsFixture}from'./fixtures/composer-root-relation-local.mjs';
const f=await localRelationsFixture();
process.env.COMPOSER_ROOT_RELATIONS_ENABLED='true'; // Synthetic process only.
const rr=createRequire(process.env.COMPOSER_REACT_TEST_TOOLS??new URL('../outputs/l4c-test-tools/package.json',import.meta.url));
const React=rr('react'),{create,act}=rr('react-test-renderer');globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let board,commands,confirmation,registry;
const leaves={
 './composer-board':{ComposerBoard:props=>{board=props;registry=React.useContext(InlineEditContext);return null;}},
 './composer-library':{ComposerLibrary:()=>null},'./composer-cockpit':{ComposerCockpit:()=>null},
 './root-relation-commands':{ROOT_COMMAND_BUFFER:'root-relation-command',RootRelationCommands:props=>{commands=props;return null;}},
 './atomic-popover':{AtomicPopover:props=>props.children(()=>{})},
 './workshop-confirmation':{WorkshopConfirmationProvider:props=>{props.requestRef.current=c=>{confirmation=c;};return props.children;}},
 './workshop-choices':{WorkshopChoicesProvider:props=>props.children},'./month-reuse':{MonthReuse:()=>null},
 './context-palette':{ContextPalette:()=>null},'./composer-financial-inspector':{ComposerFinancialInspector:()=>null},
 './balance-layer':{BalanceLayer:()=>null},'./card-knowledge-panel':{CardKnowledgePanel:()=>null},'./equipment-component-editor':{EquipmentComponentEditor:()=>null},
};
const load=Module._load;Module._load=function(name,parent,...rest){if(name==='react')return React;if(name==='react-dom')return{createPortal:n=>n};if(parent?.filename.endsWith('composer-shell.tsx')&&leaves[name])return leaves[name];return load.call(this,name,parent,...rest);};
const{InlineEditContext}=require('@/app/mois-a-venir/composer/inline-edit-registry');
const winEvents=new Map(),docEvents=new Map(),add=(m,k,fn)=>{if(!m.has(k))m.set(k,new Set());m.get(k).add(fn);};
class Element{closest(){return null;}focus(){}matches(){return false;}}globalThis.Element=Element;globalThis.HTMLElement=Element;
const body=new Element();globalThis.document={body,activeElement:body,addEventListener:(k,fn)=>add(docEvents,k,fn),removeEventListener:(k,fn)=>docEvents.get(k)?.delete(fn),querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null};
let navigated=null;globalThis.window={addEventListener:(k,fn)=>add(winEvents,k,fn),removeEventListener:(k,fn)=>winEvents.get(k)?.delete(fn),location:{href:'http://fixture.test/composer',search:'',assign:url=>{navigated=url;}},history:{}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});globalThis.requestAnimationFrame=fn=>{fn();return 0;};globalThis.cancelAnimationFrame=()=>{};
let remote=0;globalThis.fetch=async()=>{remote++;throw Error('F02_REMOTE_FORBIDDEN');};
const nativeSet=setTimeout,nativeClear=clearTimeout;let counter=0;const timers=new Map();globalThis.setTimeout=fn=>{timers.set(++counter,{fn,source:new Error().stack});return counter;};globalThis.clearTimeout=id=>timers.delete(id);
const{ComposerShell}=require('@/app/mois-a-venir/composer/composer-shell');
const{readRootWorkspace,discardRootWorkspace}=require('@/app/mois-a-venir/composer/root-relation-workspace');
const{handleRootRelationRequest}=require('@/server/phase2/planner/root-relation-admission');const{semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const course=[...f.access.model.board.baselineControls,...f.access.model.board.discretionaryControls].find(x=>x.label==='Courses');
const initialDigest=semanticStateDigest(f.base),checks=[];let root,key,props,saves,resolveSave;
async function check(name,fn){await fn();checks.push(name);console.log(name+' PASS');}
const element=()=>root.root.findByProps({'data-composer':true});
const clickLink=async()=>{confirmation=null;const link=new Element();link.href='http://fixture.test/mois-a-venir?month=2026-12';link.download='';link.target='';link.closest=()=>link;let intercepted=false;await act(async()=>{for(const fn of docEvents.get('click')??[])fn({target:link,preventDefault(){intercepted=true;},stopPropagation(){}});});assert(intercepted,'the actual exit guard must handle this link');};
const warns=()=>{let warned=false;for(const fn of winEvents.get('beforeunload')??[])fn({preventDefault(){warned=true;}});return warned;};
async function mount(same=false){if(!same){key='f02-synthetic-'+(++counter);saves=[];navigated=null;confirmation=null;props={initialModel:f.access.model,initialDrafts:f.drafts,
 draftTransport:{read:async()=>f.drafts,save:async command=>{saves.push(command);return new Promise(resolve=>{resolveSave=resolve;});},archive:async()=>{throw Error('FORBIDDEN');},restore:async()=>{throw Error('FORBIDDEN');}},
 transport:async()=>{throw Error('PREVIEW_TIMER_NOT_EXECUTED');},rootRelationAccess:{scopeKey:key,enabled:true},rootRelationTransport:r=>handleRootRelationRequest(f.scope(),r)};}
 await act(async()=>{root=create(React.createElement(ComposerShell,props),{createNodeMock:()=>({open:false,close(){this.open=false;},showModal(){this.open=true;},querySelector(){return null;},contains(){return false;},focus(){}})});});}
async function unmount(clear=true){await act(async()=>root?.unmount());if(clear)discardRootWorkspace(key);}
async function changeFinance(){await act(async()=>{assert(board.request({kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:course.targetRef,value:{amount:'350.00'}}}));});assert.notEqual(element().props['data-digest'],initialDigest);}
async function open(){await act(async()=>root.root.findByProps({'data-root-organize':true}).props.onClick());}
async function link(){await act(async()=>{assert(await commands.command({kind:'CREATE_ROOT_RELATION',relationId:f.groupId,orderedContextIds:f.ids.slice(0,2)}));});}
async function abandon(){await act(async()=>commands.abandon());assert(confirmation.message.includes('financières seront conservées'));await act(async()=>confirmation.accept());}
async function startSave(){const timer=[...timers.entries()].find(([,t])=>t.source.includes('durable-draft.ts'));assert(timer,'existing autosave must be scheduled');timers.delete(timer[0]);await act(async()=>{timer[1].fn();});assert(saves.length);}
async function receipt(){const command=saves.at(-1);await act(async()=>resolveSave({ok:true,replayed:false,draft:{...f.drafts.active,semanticState:command.semanticState,digest:command.digest,version:command.expectedDraftVersion+1,lastMutationRequestId:command.requestId}}));}

// Exercise the actual page and POST exports; only external Auth/opening/observation are substituted.
let authorizations=0;
const previousLoad=Module._load;
Module._load=function(name,parent,...rest){
 const file=parent?.filename.replaceAll('\\','/')??'';
 if(file.endsWith('/api/composer/root-relations/route.ts')||file.endsWith('/composer/page.tsx')){
  if(name==='@/server/phase2/planner/runtime')return{authorizedPlanner:async()=>{authorizations++;return f.scope();}};
  if(name==='@/app/product-query')return{withProductAuthentication:fn=>fn()};
  if(name==='@/server/phase2/planner/composer-opening')return{readComposerOpening:async()=>({model:f.access.model,drafts:f.drafts})};
  if(name==='@/server/phase2/planner/snapshot-observation')return{observeSnapshot:async fn=>({value:await fn()})};
  if(name==='next/navigation')return{notFound(){throw Error('PAGE_NOT_FOUND');}};
 }
 return previousLoad.call(this,name,parent,...rest);
};
const {POST}=require('@/app/api/composer/root-relations/route');
const Page=require('@/app/mois-a-venir/composer/page').default;
const {composerRootRelationsEnabled:enabled}=require('@/server/phase2/planner/root-relation-cutover');
const {rootRelationPost}=require('@/server/phase2/planner/root-relation-http');
const {composerDraftAutosaveEnabledFor}=require('@/server/phase2/planner/composer-draft-cutover');
const {ROOT_RELATION_HTTP_CONTRACT}=require('@/domain/phase2/planner/root-relation-ui-contract');
process.env.COMPOSER_DRAFT_AUTOSAVE_ENABLED='true';delete process.env.COMPOSER_DRAFT_AUTOSAVE_CANARY_USER_ID;
process.env.PLANNER_COMPOSER_ENABLED='true';
const request=body=>new Request('http://fixture.test/api/composer/root-relations',{method:'POST',headers:{origin:'http://fixture.test','content-type':'application/json','X-Composer-Root-Relation-Contract':ROOT_RELATION_HTTP_CONTRACT},body:JSON.stringify(body)});
const post=async body=>{const r=await POST(request(body));return{status:r.status,body:await r.json()};};
const pageAccess=async()=>{const page=await Page({searchParams:Promise.resolve({month:'2026-11'})});return page.props.children[0].props.rootRelationAccess;};
const setGate=value=>{if(value===undefined)delete process.env.COMPOSER_ROOT_RELATIONS_ENABLED;else process.env.COMPOSER_ROOT_RELATIONS_ENABLED=value;};
const frameRequest=(kind='READ')=>({kind,sequence:1,targetMonth:'2026-11',binding:f.binding,frame:f.frame});
const ui=props=>React.createElement(ComposerShell,props);
async function gateMount(access){await mount();await unmount();props={...props,rootRelationAccess:access===null?null:{...access,scopeKey:key},rootRelationTransport:async body=>(await post(body)).body};await act(async()=>{root=create(ui(props),{createNodeMock:()=>({open:false,close(){this.open=false;},showModal(){this.open=true;},querySelector(){return null;},contains(){return false;},focus(){}})});});}
const absent=name=>root.root.findAllByProps({[name]:true}).length===0;
async function disabledReceipt(value){
 setGate(value);assert.equal(enabled(),false);const access=await pageAccess();assert.equal(access.enabled,false);assert(composerDraftAutosaveEnabledFor(f.userId));
 const reads=f.draftReads.length,auth=authorizations;
 for(const kind of ['READ','MUTATE','RESTORE'])for(const force of [false,true]){
  const response=await post({...frameRequest(kind),...(force?{canManageRelations:true,enabled:true,model:{fake:true}}:{})});
  assert.equal(response.status,404);assert.deepEqual(response.body,{ok:false,sequence:0,code:'N1_DISABLED'});
 }
 assert.equal(authorizations,auth);assert.equal(f.draftReads.length,reads);
 await assert.rejects(()=>handleRootRelationRequest(f.scope(),frameRequest()),/N1_DISABLED/);
 await gateMount(access);assert(absent('data-root-organize'));assert(absent('data-root-local-notice'));assert(absent('data-root-revoked-notice'));assert(absent('data-root-financial-pending'));
 assert.equal(element().props['data-root-session'],false);assert.equal(element().props['data-root-count'],0);
 await unmount();
}
try{
 await check('T1_ABSENT_GATE_PAGE_SHELL_AND_DIRECT_ROUTE_CLOSED',()=>disabledReceipt(undefined));
 await check('T2_OFF_AND_INVALID_CONFIGURATION_FAIL_CLOSED',async()=>{for(const value of ['false','0','1','TRUE',' true','true ','on',''])await disabledReceipt(value);});
 await check('T2_CONFIGURATION_READ_ERROR_FAILS_CLOSED',async()=>{
  const env=process.env;process.env=new Proxy(env,{get(target,key){if(key==='COMPOSER_ROOT_RELATIONS_ENABLED')throw Error('SYNTHETIC_CONFIG_UNAVAILABLE');return Reflect.get(target,key);}});
  try{assert.equal(enabled(),false);assert.equal((await post(frameRequest())).status,404);}finally{process.env=env;}
 });
 await check('T8_NO_CLIENT_OVERRIDE_NO_PRIVATE_READ_OR_AUTH_WHEN_OFF',async()=>{
  setGate(undefined);let authorization=0;
  const r=await rootRelationPost(new Request('http://fixture.test/api/composer/root-relations',{method:'POST',body:'not-json'}),async()=>{authorization++;throw Error('MUST_NOT_RUN');});
  assert.equal(r.status,404);assert.equal(authorization,0);assert.deepEqual(await r.json(),{ok:false,sequence:0,code:'N1_DISABLED'});
 });
 await check('T5_OFF_FINANCE_NORMAL_AUTOSAVE_NOT_SUSPENDED',async()=>{
  setGate(undefined);await gateMount(await pageAccess());
  await changeFinance();assert.equal(element().props['data-root-session'],false);assert.notEqual(element().props['data-save-state'],'MEMORY');
  const offApply=root.root.findByProps({'data-apply':true}).props.disabled;
  assert(absent('data-root-organize'));assert(absent('data-root-local-notice'));
  await startSave();assert.equal(element().props['data-save-state'],'SAVING');assert(!('rootRelations'in saves.at(-1).semanticState));await receipt();await unmount();
  await gateMount(null);await changeFinance();const plainApply=root.root.findByProps({'data-apply':true}).props.disabled;assert.equal(plainApply,offApply);await unmount();
 });
 await check('T3_ON_SYNTHETIC_PAGE_AND_SHELL_OWNER_COMMANDS_HISTORY',async()=>{
  setGate('true');const access=await pageAccess();assert.equal(access.enabled,true);await gateMount(access);await open();await link();assert.equal(element().props['data-root-count'],1);
  await act(async()=>{assert(await commands.command({kind:'REORDER_ROOT_RELATION',relationId:f.groupId,orderedContextIds:[f.ids[1],f.ids[0]]}));});
  await act(async()=>{assert(await commands.command({kind:'DETACH_ROOT_RELATION_MEMBER',relationId:f.groupId,contextOccurrenceId:f.ids[0]}));});assert.equal(element().props['data-root-count'],0);
  await act(async()=>commands.undo());assert.equal(element().props['data-root-count'],1);await act(async()=>commands.redo());assert.equal(element().props['data-root-count'],0);assert.equal(saves.length,0);await unmount();
 });
 await check('T7_SERVER_REVOCATION_KEEPS_FINANCE_RELATIONS_AND_EXPLICIT_ABANDON',async()=>{
  setGate('true');await gateMount(await pageAccess());await changeFinance();await open();await link();const digest=element().props['data-digest'];
  setGate('false');const response=await post(frameRequest('RESTORE'));assert.equal(response.status,404);
  await act(async()=>{assert.equal(await commands.command({kind:'REORDER_ROOT_RELATION',relationId:f.groupId,orderedContextIds:[f.ids[1],f.ids[0]]}),false);});
  assert.equal(element().props['data-digest'],digest);assert.equal(element().props['data-root-count'],1);assert.equal(element().props['data-root-session'],true);assert.equal(saves.length,0);
  assert(absent('data-root-organize'));assert(absent('data-root-local-notice'));const notice=root.root.findByProps({'data-root-revoked-notice':true});
  await act(async()=>notice.findByType('button').props.onClick());assert(confirmation.message.includes('financières seront conservées'));await act(async()=>confirmation.accept());
  assert.equal(element().props['data-digest'],digest);assert.equal(element().props['data-root-count'],0);assert.equal(element().props['data-root-session'],false);
  assert(readRootWorkspace(key).past.every(frame=>!frame.relations.length));await startSave();assert(!('rootRelations'in saves.at(-1).semanticState));await receipt();await unmount();
 });
 await check('T7_OFF_REMOUNT_RECOVERS_ONLY_SAME_SCOPE_WITH_VISIBLE_ABANDON',async()=>{
  setGate('true');await gateMount(await pageAccess());await changeFinance();await open();await link();const digest=element().props['data-digest'];await unmount(false);
  setGate('false');props={...props,rootRelationAccess:{scopeKey:key,enabled:false}};await mount(true);
  assert.equal(element().props['data-digest'],digest);assert.equal(element().props['data-root-count'],1);assert.equal(saves.length,0);assert(absent('data-root-organize'));assert(absent('data-root-local-notice'));assert(readRootWorkspace(key));
  assert.equal(readRootWorkspace(key+'other-identity'),undefined);const notice=root.root.findByProps({'data-root-revoked-notice':true});
  await act(async()=>notice.findByType('button').props.onClick());await act(async()=>confirmation.accept());assert.equal(element().props['data-root-session'],false);assert.equal(element().props['data-digest'],digest);await unmount();
 });
 assert.equal(remote,0);assert.equal(f.writes.length,0);console.log(JSON.stringify({status:'PASS',checks,level:'REAL_POST_PAGE_SHELL_OWNERS_SYNTHETIC_AUTH_DOM_RECEIPTS',realWriters:0,sql:0,remote,authRls:'NOT_RUN',savedRelation:'NOT_RUN',apply:'NOT_RUN'}));
}finally{await act(async()=>root?.unmount());if(key)discardRootWorkspace(key);delete process.env.COMPOSER_ROOT_RELATIONS_ENABLED;globalThis.setTimeout=nativeSet;globalThis.clearTimeout=nativeClear;}
