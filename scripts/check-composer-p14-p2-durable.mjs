import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {require} from './lib/phase2-ts-loader.mjs';
import {state,control,fixture,findSlot} from './fixtures/planner-headless.mjs';
const semantic=require('@/domain/phase2/planner/semantic-state');
const target=findSlot(fixture(),'groceries').slotIdentityKey;
const draft=n=>state([control(target,{amount:String(n)})]);
const empty={active:null,archives:[],activePlanRevisionId:null,activePlanRevisionNumber:0,baseStale:false};
const checks=[];
// Deterministic lifecycle harness, executing the actual hook. This is not React DOM,
// navigator connectivity, Supabase Auth/RLS, or production certification.
function hook(source,transport,initial=empty){
  const slots=[],timers=new Map(),listeners=new Map();let cursor=0,clock=0,id=0,dirty=true,effects=[],value;
  let input=draft(325),online=true,digestCalls=0,request=0;
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
  const React={
    useState(initial){const n=cursor++;if(!slots[n])slots[n]={v:typeof initial==='function'?initial():initial};return[slots[n].v,v=>{const next=typeof v==='function'?v(slots[n].v):v;if(!Object.is(next,slots[n].v)){slots[n].v=next;dirty=true;}}];},
    useRef(initial){const n=cursor++;return slots[n]??=( {current:initial});},
    useMemo(fn,deps){const n=cursor++;if(!slots[n]||!same(slots[n].deps,deps))slots[n]={v:fn(),deps};return slots[n].v;},
    useCallback(fn,deps){return React.useMemo(()=>fn,deps);},
    useEffect(fn,deps){const n=cursor++;if(!slots[n]||!same(slots[n].deps,deps)){effects.push(()=>{slots[n]?.cleanup?.();slots[n]={deps,cleanup:fn()};});}},
    useSyncExternalStore(subscribe,snapshot){React.useEffect(()=>subscribe(()=>{dirty=true;}),[subscribe]);return snapshot();}
  };
  const module={exports:{}};
  const navigator={get onLine(){return online;}};
  class Clock extends Date{static now(){return clock;}}
  const sandbox={module,exports:module.exports,require:name=>name==='react'?React:name.includes('semantic-state')?{...semantic,semanticStateDigest:s=>{digestCalls++;return semantic.semanticStateDigest(s);}}:require(name),
    navigator,Date:Clock,crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++request).padStart(12,'0')}`},
    window:{addEventListener:(e,fn)=>{const set=listeners.get(e)??new Set();set.add(fn);listeners.set(e,set);},removeEventListener:(e,fn)=>listeners.get(e)?.delete(fn)},
    setTimeout:(fn,ms)=>{const n=++id;timers.set(n,{fn,at:clock+ms});return n;},clearTimeout:n=>timers.delete(n)};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,sandbox);
  function render(){for(let n=0;dirty&&n<30;n++){dirty=false;cursor=0;effects=[];value=module.exports.useDurableDraft(transport,initial,'2026-11',input,false);for(const effect of effects)effect();}assert.equal(dirty,false);return value;}
  async function settle(){for(let i=0;i<8;i++){await Promise.resolve();render();}}
  async function advance(ms){const end=clock+ms;for(let n=0;n<100;n++){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;clock=next[1].at;timers.delete(next[0]);next[1].fn();await settle();}clock=end;await settle();}
  render();
  return {get value(){return value;},get input(){return input;},get digestCalls(){return digestCalls;},set:s=>{input=s;dirty=true;render();},render:()=>{dirty=true;return render();},advance,settle,
    connection:isOnline=>{online=isOnline;for(const fn of listeners.get(isOnline?'online':'offline')??[])fn();render();},
    dispose:()=>{for(const slot of slots)slot?.cleanup?.();timers.clear();}};
}
const source=fs.readFileSync('src/app/mois-a-venir/composer/durable-draft.ts','utf8');
function store(){
  let snapshot=structuredClone(empty),lose=false,reject=false,slow=null;const calls=[];
  const row=(c,kind,old)=>({...old,draftId:old?.draftId??'00000000-0000-4000-8000-000000000099',version:(old?.version??0)+1,lifecycle:kind==='ARCHIVE'?'ABANDONED':'ACTIVE',
    semanticState:c.semanticState??old.semanticState,digest:c.digest??old.digest,baseRevisionId:null,baseRevisionNumber:0,lastSavedAt:'2026-10-13T00:00:00Z',archivedAt:kind==='ARCHIVE'?'2026-10-13T00:00:00Z':null,lastMutationRequestId:c.requestId,lastMutationExpectedVersion:c.expectedDraftVersion,lastMutationKind:kind});
  const transport={read:async()=>structuredClone(snapshot),save:async c=>{
    calls.push(c);if(snapshot.active?.lastMutationRequestId===c.requestId&&snapshot.active.digest===c.digest)return{ok:true,draft:snapshot.active,replayed:true};
    if(reject||(snapshot.active?.version??0)!==c.expectedDraftVersion)return{ok:false,code:'CONFLICT',message:'fixture CAS conflict',latest:structuredClone(snapshot)};
    const saved=row(c,'SAVE',snapshot.active);snapshot.active=saved;if(lose){lose=false;throw Error('fixture lost after commit');}
    if(slow)await slow;return{ok:true,draft:saved,replayed:false};},
    archive:async c=>{const archived=row(c,'ARCHIVE',snapshot.active);snapshot={...snapshot,active:null,archives:[archived]};if(lose){lose=false;throw Error('fixture lost archive response');}return{ok:true,draft:archived};},
    restore:async c=>{const restored=row(c,'RESTORE',snapshot.archives[0]);snapshot={...snapshot,active:restored,archives:[]};if(lose){lose=false;throw Error('fixture lost restore response');}return{ok:true,draft:restored};}};
  return {transport,calls,get snapshot(){return snapshot;},lose:()=>{lose=true;},reject:()=>{reject=true;},delay:p=>{slow=p;}};
}
async function check(name,fn){await fn();checks.push(name);console.log(name+' PASS');}
await check('P2-DRAFT-SEMANTIC-DEBOUNCE-NO-SAVE-ON-STATUS-RENDER',async()=>{const s=store(),h=hook(source,s.transport);h.set(draft(350));for(let i=0;i<20;i++)h.render();await h.advance(999);assert.equal(s.calls.length,0);await h.advance(1);assert.equal(s.calls.length,1);assert.equal(h.value.status,'SAVED');assert.equal(s.snapshot.active.digest,semantic.semanticStateDigest(h.input));h.dispose();});
await check('P2-DRAFT-SLOW-SAVE-KEEPS-NEXT-DIRTY-AND-CAS',async()=>{const s=store();let resolve;const delay=new Promise(r=>{resolve=r;});s.delay(delay);const h=hook(source,s.transport);h.set(draft(350));await h.advance(1000);assert.equal(h.value.status,'SAVING');h.set(draft(360));resolve();await h.settle();assert.equal(h.value.status,'DIRTY');await h.advance(1000);assert.equal(s.calls.length,2);assert.equal(s.calls[1].expectedDraftVersion,1);assert.equal(h.value.status,'SAVED');assert.equal(s.snapshot.active.digest,semantic.semanticStateDigest(h.input));h.dispose();});
await check('P2-DRAFT-LOST-RESPONSE-REUSES-ID-NO-DOUBLE-COMMIT',async()=>{const s=store(),h=hook(source,s.transport);s.lose();h.set(draft(350));await h.advance(1000);assert.equal(h.value.status,'ERROR');assert.equal(h.value.unsaved,true);h.value.retry();await h.settle();assert.equal(h.value.status,'SAVED');assert.equal(s.calls[0].requestId,s.calls[1].requestId);assert.equal(s.snapshot.active.version,1);h.dispose();});
await check('P2-DRAFT-TWO-SESSIONS-CONFLICT-PRESERVES-LOCAL-STATE',async()=>{const s=store(),a=hook(source,s.transport),b=hook(source,s.transport);a.set(draft(350));await a.advance(1000);b.set(draft(360));await b.advance(1000);assert.equal(b.value.status,'CONFLICT');assert.equal(b.value.unsaved,true);assert.equal(b.input.controls[0].value.amount,'360');assert.equal(s.snapshot.active.version,1);await b.advance(5000);assert.equal(s.calls.length,2);a.dispose();b.dispose();});
await check('P2-DRAFT-OFFLINE-NO-WRITE-ONLINE-SAVES-LATEST',async()=>{const s=store(),h=hook(source,s.transport);h.connection(false);h.set(draft(350));await h.advance(5000);assert.equal(h.value.status,'OFFLINE');assert.equal(s.calls.length,0);h.connection(true);await h.settle();assert.equal(s.calls.length,1);assert.equal(h.value.status,'SAVED');h.dispose();});
await check('P2-DRAFT-ARCHIVE-RESTORE-LOST-COMMIT-READ-RECOVERY',async()=>{const s=store(),h=hook(source,s.transport);h.set(draft(350));await h.advance(1000);s.lose();assert.equal(await h.value.lifecycle('ARCHIVE',h.value.snapshot.active),true);await h.settle();assert.equal(s.snapshot.archives.length,1);const archive=s.snapshot.archives[0];s.lose();assert.equal(await h.value.lifecycle('RESTORE',archive),true);await h.settle();assert.equal(h.value.status,'SAVED');assert.equal(s.snapshot.active.version,3);assert.equal(s.snapshot.active.digest,semantic.semanticStateDigest(h.input));h.dispose();});
await check('P2-DRAFT-DIGEST-MEMO-IDENTICAL-STATE-REFERENCE',async()=>{const old=execFileSync('git',['show','a934f60f7f796b4522cbccfbb7b01edfab96dea5:src/app/mois-a-venir/composer/durable-draft.ts'],{encoding:'utf8'});const a=hook(old,null),b=hook(source,null);for(let i=0;i<20;i++){a.render();b.render();}assert.ok(a.digestCalls>b.digestCalls);assert.equal(b.digestCalls,1);console.log(JSON.stringify({unchangedStateRenders:21,P1DigestCalls:a.digestCalls,P2DigestCalls:b.digestCalls}));a.dispose();b.dispose();});
const result={status:'EXECUTED_PASS_DETERMINISTIC_HOOK_HARNESS',checks,authenticated:false,browserConnectivity:false,remoteWrites:0};
if(process.env.P14_P2_DURABLE_REPORT)fs.writeFileSync(process.env.P14_P2_DURABLE_REPORT,JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
