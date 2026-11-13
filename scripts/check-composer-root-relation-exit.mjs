/** F02 regression: actual Shell/staging/durable hook; leaf rendering and browser APIs simulated. No real writes. */
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
let navigated=null;const storage=new Map();globalThis.window={addEventListener:(k,fn)=>add(winEvents,k,fn),removeEventListener:(k,fn)=>winEvents.get(k)?.delete(fn),location:{href:'http://fixture.test/composer',search:'',assign:url=>{navigated=url;}},history:{},
 sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});globalThis.requestAnimationFrame=fn=>{fn();return 0;};globalThis.cancelAnimationFrame=()=>{};
let remote=0;globalThis.fetch=async()=>{remote++;throw Error('F02_REMOTE_FORBIDDEN');};
const nativeSet=setTimeout,nativeClear=clearTimeout;let counter=0;const timers=new Map();globalThis.setTimeout=fn=>{timers.set(++counter,{fn,source:new Error().stack});return counter;};globalThis.clearTimeout=id=>timers.delete(id);
const{ComposerShell}=require('@/app/mois-a-venir/composer/composer-shell');
const{rememberDraftNavigation}=require('@/app/mois-a-venir/composer/draft-navigation-memory');
const{budgetImpactFixture,impactIds}=await import('./fixtures/composer-budget-impact.mjs');
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
try{
 await check('F02_A_DIRTY_EXIT_PRESERVES_FRAME_HISTORY_AND_RAW',async()=>{
  await mount();await changeFinance();await open();await link();const before=JSON.stringify(readRootWorkspace(key));let discarded=0;
  await act(async()=>registry.set('fixture-raw',{kind:'RAW',targetRef:'fixture-raw',dimension:'field',discard:()=>discarded++,flush(){}}));
  await clickLink();assert.equal(confirmation,null);assert.equal(navigated,null);assert.equal(JSON.stringify(readRootWorkspace(key)),before);assert.equal(registry.count(),1);assert.equal(discarded,0);assert.equal(saves.length,0);assert(warns());
  await act(async()=>registry.set('fixture-raw',null));
  await act(async()=>commands.close());assert.equal(element().props['data-root-session'],true);assert.equal(element().props['data-root-count'],1);
 });
 await check('F02_B_ABANDON_RETAINS_FINANCE_AND_PROTECTS_PENDING_SPA_RECOVERY',async()=>{
  await open();const digest=element().props['data-digest'];await abandon();assert.equal(element().props['data-root-session'],false);assert.equal(element().props['data-digest'],digest);
  assert.equal(readRootWorkspace(key).relationSession,false);assert.equal(readRootWorkspace(key).frame.relations.length,0);assert(readRootWorkspace(key).past.every(frame=>!frame.relations.length));
  await clickLink();assert.equal(navigated,null);assert.equal(confirmation,null);assert(warns());
  await unmount(false);assert(readRootWorkspace(key));assert.equal(readRootWorkspace(key+'other-month'),undefined);
  await mount(true);assert.equal(element().props['data-root-session'],false);assert.equal(element().props['data-digest'],digest);assert.equal(element().props['data-root-count'],0);
  assert.notEqual(element().props['data-save-state'],'SAVED');await clickLink();assert.equal(navigated,null);
 });
 await check('F02_D_PENDING_FAILED_RETRY_KEEP_CAS_AND_EXIT_GUARD_UNTIL_RECEIPT',async()=>{
  await startSave();assert.equal(element().props['data-save-state'],'SAVING');await open();assert.equal(element().props['data-root-session'],false);await clickLink();assert.equal(navigated,null);assert(warns());
  const first=saves[0];assert.equal(first.expectedDraftVersion,1);assert.equal(first.expectedDraftId,f.draftId);assert.equal(first.semanticState.version,'month-plan-state@v1');assert(!('rootRelations'in first.semanticState));
  await act(async()=>resolveSave({ok:false,code:'UNAVAILABLE',latest:null,message:'Synthetic unavailable'}));assert.equal(element().props['data-save-state'],'ERROR');await clickLink();assert.equal(navigated,null);assert(readRootWorkspace(key));
  await act(async()=>root.root.findByProps({'data-save-retry':true}).props.onClick());assert.equal(saves.length,2);assert.equal(saves[1].expectedDraftVersion,first.expectedDraftVersion);assert.equal(saves[1].requestId,first.requestId);
  await receipt();assert.equal(element().props['data-save-state'],'SAVED');assert.equal(readRootWorkspace(key),undefined);await unmount();
 });
 await check('F02_C_CLEAN_FINANCE_CAN_LEAVE_WITH_RELATION_ONLY_CONSENT',async()=>{
  await mount();await open();await link();await act(async()=>{assert(await commands.command({kind:'REORDER_ROOT_RELATION',relationId:f.groupId,orderedContextIds:[f.ids[1],f.ids[0]]}));});
  await clickLink();assert(confirmation);assert(confirmation.message.includes('financier est sauvegardé'));assert(confirmation.message.includes('uniquement l’organisation'));assert.equal(saves.length,0);
  await act(async()=>confirmation.accept());assert(navigated);assert.equal(readRootWorkspace(key),undefined);assert.equal(warns(),false);
  // Even if the document navigation is cancelled, discarded relations must not reappear from history.
  await open();const length=readRootWorkspace(key).past.length;assert(length>0);await act(async()=>commands.undo());
  assert.equal(element().props['data-root-count'],0);assert.equal(readRootWorkspace(key).past.length,length-1);await unmount();
 });
 await check('F02_E_CONFIRMATION_RECHECKS_LATEST_FINANCIAL_STATE',async()=>{
  await mount();await open();await link();await clickLink();const pending=confirmation;assert(pending);
  await changeFinance();const before=JSON.stringify(readRootWorkspace(key));await act(async()=>pending.accept());assert.equal(navigated,null);assert.equal(JSON.stringify(readRootWorkspace(key)),before);assert(warns());await unmount();
 });
 await check('F02_D_CAS_CONFLICT_NEVER_RELEASES_EXIT_OR_REPLACES_LOCAL_FRAME',async()=>{
  await mount();await changeFinance();await open();await link();await abandon();const digest=element().props['data-digest'];await startSave();
  await act(async()=>resolveSave({ok:false,code:'CONFLICT',message:'Synthetic CAS conflict',latest:{...f.drafts,active:{...f.drafts.active,version:2}}}));
  assert.equal(element().props['data-save-state'],'CONFLICT');assert.equal(element().props['data-digest'],digest);assert(readRootWorkspace(key));await clickLink();assert.equal(navigated,null);assert.equal(confirmation,null);assert(warns());await unmount();
 });
 await check('P21_CONFIRMED_NAVIGATION_RELOAD_OPENS_EXACT_DRAFT_OCCURRENCE',async()=>{
  const saved=await budgetImpactFixture(), expected=saved.model.board.draft.semanticStateDigest;
  await mount();await unmount();
  const active={...f.drafts.active,semanticState:saved.model.semanticState,digest:expected};
  props={...props,initialModel:saved.model,initialDrafts:{...f.drafts,active}};
  rememberDraftNavigation(key,{draftId:active.draftId,digest:expected,contextId:impactIds.amazon});
  await mount(true);
  assert.equal(board.focused,impactIds.amazon);
  assert.equal(element().props['data-digest'],expected);
  assert.equal(element().props['data-save-state'],'SAVED');
  assert.equal(saves.length,0);
  await unmount();
  rememberDraftNavigation(key,{draftId:active.draftId,digest:'obsolete',contextId:impactIds.amazon});
  await mount(true);
  assert.equal(board.focused,null);
  assert.equal(saves.length,0);
  await unmount();
 });
 assert.equal(remote,0);assert.equal(f.writes.length,0);console.log(JSON.stringify({status:'PASS',checks,level:'REAL_SHELL_HOOK_SYNTHETIC_PRESENTATION_AND_SAVE_RECEIPTS',realWriters:0,sql:0,remote,authRls:'NOT_RUN',savedRelation:'NOT_RUN',apply:'NOT_RUN'}));
}finally{await act(async()=>root?.unmount());if(key)discardRootWorkspace(key);globalThis.setTimeout=nativeSet;globalThis.clearTimeout=nativeClear;}
