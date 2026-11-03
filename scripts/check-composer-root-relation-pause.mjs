/** Hook/registry regression, synthetic timers and transport. NOT a browser or durable Save certificate. */
import assert from 'node:assert/strict';import Module,{createRequire}from'node:module';
import {require}from'./lib/phase2-ts-loader.mjs';import{localRelationsFixture}from'./fixtures/composer-root-relation-local.mjs';
const f=await localRelationsFixture();
const rr=createRequire(process.env.COMPOSER_REACT_TEST_TOOLS??new URL('../outputs/l4c-test-tools/package.json',import.meta.url));
const React=rr('react'),{create,act}=rr('react-test-renderer'),load=Module._load;
Module._load=function(name,...args){return name==='react'?React:load.call(this,name,...args);};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const listeners=new Map();globalThis.window={addEventListener:(name,fn)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},removeEventListener:(name,fn)=>listeners.get(name)?.delete(fn)};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
const nativeSet=setTimeout,nativeClear=clearTimeout;let tick=0;const timers=new Map();globalThis.setTimeout=fn=>{timers.set(++tick,fn);return tick;};globalThis.clearTimeout=id=>timers.delete(id);
const{useDurableDraft}=require('@/app/mois-a-venir/composer/durable-draft');const{InlineEditRegistry}=require('@/app/mois-a-venir/composer/inline-edit-registry');
let durable,reads=0,saves=0,lifecycle=0,resolveSave;const transport={read:async()=>{reads++;return f.drafts;},save:async()=>{saves++;return new Promise(resolve=>{resolveSave=resolve;});},archive:async()=>{lifecycle++;throw Error('FORBIDDEN');},restore:async()=>{lifecycle++;throw Error('FORBIDDEN');}};
function Harness({state,suspended=false}){durable=useDurableDraft(transport,f.drafts,'2026-11',state,suspended);return null;}
const dirty={...f.base,preferences:{...f.base.preferences,anchors:[f.ids[3]]}};let root;
try{
await act(async()=>{root=create(React.createElement(Harness,{state:f.base}));});
await act(async()=>{root.update(React.createElement(Harness,{state:dirty}));});assert(timers.size>0);const staleFlush=[...timers.values()].at(-1);
assert.equal(durable.suspendNow(),true);
await act(async()=>{root.update(React.createElement(Harness,{state:dirty,suspended:true}));await staleFlush();for(const fn of listeners.get('online')??[])fn();durable.retry();await durable.refresh();assert.equal(await durable.lifecycle('ARCHIVE',f.drafts.active),false);});
assert.equal(saves,0,'old timer, online, retry and manual paths must remain suspended');assert.equal(reads,0);assert.equal(lifecycle,0);
await act(async()=>{root.update(React.createElement(Harness,{state:dirty,suspended:false}));});
await act(async()=>{durable.retry();});assert.equal(saves,1);assert.equal(durable.suspendNow(),false,'never open local mode during an in-flight Save');
await act(async()=>{resolveSave({ok:false,code:'UNAVAILABLE',message:'Synthetic response',latest:null});});
const registry=new InlineEditRegistry();let continued=0,discarded=0,accept;
registry.requestConfirmation=(_message,run)=>{accept=run;};registry.set('bar:raw',{kind:'RAW',targetRef:'bar',dimension:'field',discard:()=>discarded++,flush:()=>{}});
assert.equal(registry.guard(()=>continued++,undefined,false,new Set(['root-relation-command'])),false);assert.equal(continued,0);assert.equal(discarded,0);accept();assert.equal(continued,1);assert.equal(discarded,1);
console.log(JSON.stringify({status:'PASS',tests:['T7_PAUSE_STALE_TIMER_ONLINE_MANUAL','T7_INFLIGHT_ENTRY_REFUSED','T8_EXISTING_RAW_GUARD'],fakeSaveCalls:saves,realWriters:0,saved:'NOT_RUN',authRls:'NOT_RUN'}));
}finally{await act(async()=>root?.unmount());globalThis.setTimeout=nativeSet;globalThis.clearTimeout=nativeClear;}
