/** Supplemental real Shell/hook + loopback HTTP + non-owner writer + native PostgreSQL.
 * Leaf rendering/DOM are simulated here; the native browser recipe exercises actual leaves too. */
import assert from 'node:assert/strict';import Module,{createRequire}from'node:module';
import{require}from'./lib/phase2-ts-loader.mjs';import{startRootRelationNativeHost}from'./lib/root-relation-native-host.mjs';
const rr=createRequire(process.env.COMPOSER_REACT_TEST_TOOLS??new URL('../outputs/l4c-test-tools/package.json',import.meta.url));
const React=rr('react'),{create,act}=rr('react-test-renderer');globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let board,commands,confirmation,registry;
const leaves={
 './composer-board':{ComposerBoard:p=>{board=p;registry=React.useContext(InlineEditContext);return null;}},
 './composer-library':{ComposerLibrary:()=>null},'./composer-cockpit':{ComposerCockpit:()=>null},
 './root-relation-commands':{ROOT_COMMAND_BUFFER:'root-relation-command',RootRelationCommands:p=>{commands=p;return null;}},
 './atomic-popover':{AtomicPopover:p=>p.children(()=>{})},
 './workshop-confirmation':{WorkshopConfirmationProvider:p=>{p.requestRef.current=c=>{confirmation=c;};return p.children;}},
 './workshop-choices':{WorkshopChoicesProvider:p=>p.children},'./month-reuse':{MonthReuse:()=>null},
 './context-palette':{ContextPalette:()=>null},'./composer-financial-inspector':{ComposerFinancialInspector:()=>null},
 './balance-layer':{BalanceLayer:()=>null},'./card-knowledge-panel':{CardKnowledgePanel:()=>null},'./equipment-component-editor':{EquipmentComponentEditor:()=>null},
};
const load=Module._load;Module._load=function(name,parent,...rest){if(name==='react')return React;if(name==='react-dom')return{createPortal:n=>n};if(parent?.filename.endsWith('composer-shell.tsx')&&leaves[name])return leaves[name];return load.call(this,name,parent,...rest);};
const{InlineEditContext}=require('@/app/mois-a-venir/composer/inline-edit-registry');
const winEvents=new Map(),docEvents=new Map(),add=(m,k,fn)=>{if(!m.has(k))m.set(k,new Set());m.get(k).add(fn);};
class Element{closest(){return null;}focus(){}matches(){return false;}}globalThis.Element=Element;globalThis.HTMLElement=Element;
const body=new Element();globalThis.document={body,activeElement:body,addEventListener:(k,fn)=>add(docEvents,k,fn),removeEventListener:(k,fn)=>docEvents.get(k)?.delete(fn),querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null};
let navigated=null,reloads=0;globalThis.window={addEventListener:(k,fn)=>add(winEvents,k,fn),removeEventListener:(k,fn)=>winEvents.get(k)?.delete(fn),location:{href:'http://fixture.test/composer',search:'',assign:url=>{navigated=url;},reload:()=>{reloads++;}},history:{}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});globalThis.requestAnimationFrame=fn=>{fn();return 0;};globalThis.cancelAnimationFrame=()=>{};
const nativeSet=setTimeout,nativeClear=clearTimeout;let counter=0;const timers=new Map();
globalThis.setTimeout=(fn,ms,...args)=>{const source=new Error().stack;if(/durable-draft.ts|preview-scheduler.ts|composer-shell.tsx/.test(source)){timers.set(++counter,{fn,source});return -counter;}return nativeSet(fn,ms,...args);};
globalThis.clearTimeout=id=>id<0?timers.delete(-id):nativeClear(id);
const host=await startRootRelationNativeHost(),f=host.fixture,nativeFetch=globalThis.fetch;
const cookie='n1_recipe_session='+host.newSession(),calls=[];
globalThis.fetch=async(url,options={})=>{const headers=new Headers(options.headers);headers.set('cookie',cookie);if(options.method==='POST')headers.set('origin',host.origin);
 const response=await nativeFetch(new URL(url,host.origin),{...options,headers});calls.push({url:String(url),method:options.method??'GET',status:response.status});return response;};
const{ComposerShell}=require('@/app/mois-a-venir/composer/composer-shell');
const{rootRelationDurableTransport}=require('@/app/mois-a-venir/composer/root-relation-durable-transport');
const{rootRelationFinancialReadSnapshot}=require('@/domain/phase2/planner/root-relation-durable-contract');
const{rootRelationDocument}=require('@/domain/phase2/planner/root-relation-local');
const{rootRelationStateDigest,rootRelationBaseState}=require('@/domain/phase2/planner/root-relation-state');
const{readRootWorkspace,discardRootWorkspace}=require('@/app/mois-a-venir/composer/root-relation-workspace');
const checks=[];let root,key,frozenRow,legacySaves=0;
const check=async(name,fn)=>{await fn();checks.push(name);console.log(name+' PASS');};
const element=()=>root.root.findByProps({'data-composer':true});
const state=()=>element().props['data-save-state'];
const cached=()=>readRootWorkspace(key);
async function opening(){const rootDrafts=await rootRelationDurableTransport.read('2026-11'),drafts=rootRelationFinancialReadSnapshot(rootDrafts);
 const response=await fetch('/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'READ',sequence:0,targetMonth:'2026-11',draft:drafts.active.semanticState})});
 const result=await response.json();assert(result.ok,result.code);return{initialModel:result.model,initialDrafts:drafts,initialRootDrafts:rootDrafts};}
async function mount(){key='native-shell-'+(++counter);const initial=await opening();
 await act(async()=>{root=create(React.createElement(ComposerShell,{...initial,rootRelationAccess:{scopeKey:key,enabled:true,durable:true},
  transport:async request=>(await fetch('/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)})).json(),
  draftTransport:{read:async()=>{throw Error('V1_READER_NOT_EXPECTED');},save:async()=>{legacySaves++;throw Error('V1_SAVE_FORBIDDEN');},archive:async()=>{throw Error('ARCHIVE_FORBIDDEN');},restore:async()=>{throw Error('RESTORE_FORBIDDEN');}}}),
  {createNodeMock:()=>({open:false,close(){this.open=false;},showModal(){this.open=true;},querySelector(){return null;},contains(){return false;},focus(){}})});});}
async function unmount(){await act(async()=>root.unmount());discardRootWorkspace(key);root=null;}
async function idle(){await act(async()=>{for(let i=0;i<250&&element().props['aria-busy'];i++)await new Promise(resolve=>nativeSet(resolve,10));});assert.equal(element().props['aria-busy'],false);}
async function open(){await act(async()=>root.root.findByProps({'data-root-organize':true}).props.onClick());await idle();}
async function command(mutation){await act(async()=>assert(await commands.command(mutation)));}
async function finance(amount){const course=[...board.model.board.baselineControls,...board.model.board.discretionaryControls].find(x=>x.label==='Courses');
 await act(async()=>assert(board.request({kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:course.targetRef,value:{amount}}})));}
async function save(){await act(async()=>root.root.findByProps({'data-root-save':true}).props.onClick());}
async function clickLink(){navigated=null;confirmation=null;const link=new Element();link.href='http://fixture.test/next-month';link.download='';link.target='';link.closest=()=>link;
 await act(async()=>{for(const fn of docEvents.get('click')??[])fn({target:link,preventDefault(){},stopPropagation(){}});});}
const warns=()=>{let result=false;for(const fn of winEvents.get('beforeunload')??[])fn({preventDefault(){result=true;}});return result;};
// Shell handlers intentionally return void; wait for actual transport completion without arbitrary sleeps.
async function settled(){await act(async()=>{for(let i=0;i<250&&state()==='SAVING';i++)await new Promise(resolve=>nativeSet(resolve,10));});assert.notEqual(state(),'SAVING');}
try{
 await check('V1_REAL_SHELL_HTTP_SQL_RECEIPT_READER_REMOUNT',async()=>{
  await mount();await open();await command({kind:'CREATE_ROOT_RELATION',relationId:f.groupId,orderedContextIds:f.ids.slice(0,2)});
  await command({kind:'ADD_ROOT_RELATION_MEMBER',relationId:f.groupId,contextOccurrenceId:f.ids[2]});
  await command({kind:'REORDER_ROOT_RELATION',relationId:f.groupId,orderedContextIds:[f.ids[2],f.ids[0],f.ids[1]]});
  await finance('350.00');assert.equal(state(),'DIRTY');
  await act(async()=>commands.abandon());const oldAbandon=confirmation;host.fault.delayMs=120;
  await save();assert.equal(state(),'SAVING');await act(async()=>oldAbandon.accept());assert.equal(element().props['data-root-session'],true);assert.equal(element().props['data-root-count'],1);
  await settled();assert.equal(state(),'SAVED');assert.equal(cached(),undefined);
  const row=(await f.rows())[0];frozenRow=row;assert.equal(row.draft_version,2);assert.equal(row.semantic_state.rootRelations[0].relationId,f.groupId);
  assert.deepEqual(row.semantic_state.rootRelations[0].orderedContextIds,[f.ids[2],f.ids[0],f.ids[1]]);assert(JSON.stringify(row.semantic_state).includes('350.00'));
  assert(host.events.some(e=>e.phase==='SQL_COMMITTED_RECEIPT'));assert(f.events.some(e=>e.phase==='FRESH_AUTHORITY'));
  const expected=element().props['data-root-digest'];await unmount();await mount();assert.equal(state(),'SAVED');assert.equal(element().props['data-root-digest'],expected);
  assert.equal(element().props['data-root-count'],1);assert.equal(element().props['data-root-session'],true);assert.equal(legacySaves,0);
 });
 await check('V5_N1_ABANDON_UNDO_REDO_PRESERVES_DIRTY_FINANCE_AND_STORED_LINKS',async()=>{
  await open();await command({kind:'REORDER_ROOT_RELATION',relationId:f.groupId,orderedContextIds:f.ids.slice(0,3)});await finance('355.00');
  const financeDigest=element().props['data-digest'];await act(async()=>commands.abandon());assert(confirmation.message.includes('financières seront conservées'));
  await act(async()=>confirmation.accept());assert.equal(element().props['data-root-session'],true);assert.equal(element().props['data-digest'],financeDigest);assert.equal(state(),'DIRTY');
  for(const frame of cached().past)assert.deepEqual(frame.relations,frozenRow.semantic_state.rootRelations);
  await clickLink();assert.equal(navigated,null);assert.equal(confirmation,null);assert(warns());assert.equal(legacySaves,0);
  await open();await act(async()=>commands.undo());await idle();assert.notEqual(element().props['data-digest'],financeDigest);await act(async()=>commands.redo());await idle();assert.equal(element().props['data-digest'],financeDigest);
  await save();await settled();assert.equal(state(),'SAVED');assert.equal(legacySaves,0);
 });
 await check('V5_RAW_BLOCKS_SAVE_RELOAD_AND_RELEASES_NO_CACHE',async()=>{
  let discarded=0;await act(async()=>registry.set('synthetic-raw',{kind:'RAW',targetRef:'synthetic-raw',dimension:'field',discard:()=>discarded++,flush(){}}));
  const version=(await f.rows())[0].draft_version;await save();assert(confirmation);assert.equal(discarded,0);assert.equal((await f.rows())[0].draft_version,version);
  await act(async()=>root.root.findByProps({'data-root-reload':true}).props.onClick());assert.equal(reloads,0);assert.equal(registry.count(),1);
  await act(async()=>registry.set('synthetic-raw',null));
 });
 await check('LATE_REAL_HTTP_RECEIPT_DOES_NOT_OVERWRITE_NEWER_LOCAL_DECISION',async()=>{
  await finance('360.00');host.fault.delayMs=180;await save();assert.equal(state(),'SAVING');await finance('365.00');const newer=element().props['data-digest'];
  await settled();assert.equal(state(),'DIRTY');assert.equal(element().props['data-digest'],newer);assert(cached());assert(JSON.stringify((await f.rows())[0].semantic_state).includes('360.00'));
  await save();await settled();assert.equal(state(),'SAVED');assert(JSON.stringify((await f.rows())[0].semantic_state).includes('365.00'));
 });
 await check('LOST_HTTP_RESPONSE_RETRY_RECONCILES_REAL_COMMIT_EXACTLY_ONCE',async()=>{
  await finance('370.00');const version=(await f.rows())[0].draft_version;host.fault.loseNext=true;await save();await settled();assert.equal(state(),'ERROR');assert(cached());
  assert.equal((await f.rows())[0].draft_version,version+1);await save();await settled();assert.equal(state(),'SAVED');assert.equal((await f.rows())[0].draft_version,version+1);
  assert(host.events.some(e=>e.phase==='SQL_COMMITTED_RECEIPT'&&e.replayed));
 });
 await check('UNCERTAIN_COMMIT_THEN_NEW_DECISION_IS_RECONCILED_BEFORE_NEW_SAVE',async()=>{
  await finance('375.00');const version=(await f.rows())[0].draft_version;host.fault.loseNext=true;await save();await settled();assert.equal(state(),'ERROR');
  await finance('380.00');await save();await settled();assert.equal(state(),'SAVED');assert.equal((await f.rows())[0].draft_version,version+2);assert.equal(legacySaves,0);
 });
 await check('ACTUAL_RELOAD_BUTTON_USES_HTTP_READER_BEFORE_RELOAD',async()=>{
  const before=calls.length;await act(async()=>root.root.findByProps({'data-root-reload':true}).props.onClick());await settled();assert.equal(reloads,1);
  assert(calls.slice(before).some(c=>c.url.startsWith('/api/composer/root-relation-drafts?')&&c.method==='GET'));await unmount();await mount();assert.equal(state(),'SAVED');assert.equal(legacySaves,0);
 });
 await check('DELAYED_RELOAD_REFUSES_TO_REPLACE_NEW_LOCAL_FINANCE',async()=>{
  const before=reloads;host.fault.readDelayMs=180;await act(async()=>root.root.findByProps({'data-root-reload':true}).props.onClick());assert.equal(state(),'SAVING');
  await finance('385.00');const digest=element().props['data-digest'];await settled();assert.equal(reloads,before);assert.equal(element().props['data-digest'],digest);assert(cached());
  await save();await settled();assert.equal(state(),'SAVED');
 });
 await check('SAME_VERSION_DIGEST_WITH_DIFFERENT_MUTATION_METADATA_REFUSES_RELOAD',async()=>{
  const row=(await f.rows())[0],before=reloads;
  await f.db.query("update phase2_composer_drafts set last_mutation_request_id='f07b0000-0000-4000-8000-000000009999' where draft_id=$1",[row.draft_id]);
  await act(async()=>root.root.findByProps({'data-root-reload':true}).props.onClick());await settled();assert.equal(reloads,before);assert.equal(state(),'CONFLICT');
  await f.db.query('update phase2_composer_drafts set last_mutation_request_id=$1 where draft_id=$2',[row.last_mutation_request_id,row.draft_id]);
  await unmount();await mount();assert.equal(state(),'SAVED');
 });
 await check('V2_SECOND_HTTP_SESSION_WINS_LOCAL_STALE_SAVE_CONFLICT_PRESERVES_FRAME',async()=>{
  await finance('390.00');const localDigest=element().props['data-digest'],latest=(await rootRelationDurableTransport.read('2026-11')).active;
  const doc=rootRelationDocument({...cached().frame,draft:rootRelationBaseState(latest.semanticState),relations:latest.semanticState.rootRelations.map(r=>({...r,orderedContextIds:[...r.orderedContextIds].reverse()}))});
  const packet={contract:'composer-draft-http@2-root-relations',kind:'SAVE',command:{targetMonth:'2026-11',expectedDraftId:latest.draftId,expectedDraftVersion:latest.version,
   expectedDocumentVersion:latest.semanticState.version,expectedDraftDigest:latest.digest,expectedBaseRevisionId:latest.baseRevisionId,expectedBaseRevisionNumber:latest.baseRevisionNumber,
   requestId:crypto.randomUUID(),semanticState:doc,digest:rootRelationStateDigest(doc)}};
  const response=await nativeFetch(host.origin+'/api/composer/root-relation-drafts',{method:'POST',headers:{cookie:'n1_recipe_session='+host.newSession(),origin:host.origin,'Content-Type':'application/json','X-Composer-Draft-Contract':packet.contract},body:JSON.stringify(packet)});
  assert.equal(response.status,200);const received=await response.json();assert.equal(received.draft.version,latest.version+1);
  await save();await settled();assert.equal(state(),'CONFLICT');assert.equal(element().props['data-digest'],localDigest);assert(cached());assert(warns());assert.equal(legacySaves,0);
 });
 console.log(JSON.stringify({status:'PASS',checks,database:f.database,level:'REAL_SHELL_HOOK_HTTP_NON_OWNER_SQL_READER_REMOUNT_SIMULATED_LEAVES',legacySaves,remoteAuthRls:'NOT_RUN',apply:'NOT_RUN',rows:(await f.rows()).map(r=>({id:r.draft_id,version:r.draft_version,digest:r.semantic_state_digest})),http:calls}));
}finally{if(root)await unmount();globalThis.fetch=nativeFetch;globalThis.setTimeout=nativeSet;globalThis.clearTimeout=nativeClear;await host.close();}
