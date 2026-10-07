// Execute the production TSX with deterministic hooks, timers and deferred actions.
// This tests orchestration, not financial formulas. Live Chromium controls certify UI parity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { require } from './lib/phase2-ts-loader.mjs';
const source=fs.readFileSync('src/app/mois-a-venir/month-control-center.tsx','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const contract=require('@/domain/phase2/month-control-contract.ts');
const model={targetMonth:'2026-10',baseDigest:'facts-a',editable:true,defaultPurpose:{kind:'FREE_EXPLORATION'},reliability:{publicationId:'publication-a'},
 projectionSummary:{economic:{central:null},globalDelta:null},settings:{goal:null},categoryControls:[{key:'groceries',forecast:'300.00'}],savings:[]};
const result=m=>({model:m,baseDigest:m.baseDigest,scenario:{categoryControls:m.categoryControls,savings:m.savings},preview:null});
function harness(extra={},saved=[]){
 let props={model:structuredClone(model),initialSection:'choices',children:null,composerHref:'/mois-a-venir/composer?month=2026-10',...extra};
 let slots=[],cursor=0,dirty=true,mounted=true,tree,now=1000,timerId=0,postUnmountWrites=0;
 const timers=new Map(),effects=[],calls=[],routes=[],storage=new Map(saved),listeners=new Map();
 const equal=(a,b)=>!!a&&!!b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const react={createContext:()=>({Provider:'ControlProvider'}),useContext:()=>null,
  useRef:value=>{const i=cursor++;return slots[i]??= {current:value}},
  useState:initial=>{const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};const s=slots[i];return[s.value,value=>{if(!mounted)postUnmountWrites++;const next=typeof value==='function'?value(s.value):value;if(!Object.is(next,s.value)){s.value=next;dirty=true}}]},
  useCallback:(fn,deps)=>{const i=cursor++;if(!equal(slots[i]?.deps,deps))slots[i]={value:fn,deps};return slots[i].value},
  useEffect:(setup,deps)=>{const i=cursor++;if(!equal(slots[i]?.deps,deps)){effects.push({i,setup,deps})}},
  useTransition:()=>{cursor++;return[false,fn=>{void fn()}]}};
 const router={push:url=>routes.push(['push',url]),replace:url=>routes.push(['replace',url]),refresh:()=>routes.push(['refresh'])};
 const actions={previewMonthControlCenter:(...args)=>new Promise((resolve,reject)=>calls.push({args:JSON.parse(JSON.stringify(args)),resolve,reject})),applyMonthChoice:()=>assert.fail('WRITE_FORBIDDEN'),undoMonthChoice:()=>assert.fail('WRITE_FORBIDDEN'),updateMonthControlInputs:()=>assert.fail('WRITE_FORBIDDEN')};
 const jsx=(type,props)=>({type,props});
 const stubs=new Proxy({__esModule:true},{get:(o,k)=>k in o?o[k]:String(k)});
 const exports={};
 const location={href:'http://localhost/mois-a-venir?month='+props.model.targetMonth+'&control=center'+(props.initialFocus?'&focus='+props.initialFocus:'')};
 const context={exports,require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='next/navigation'?{useRouter:()=>router}:name==='./actions'?actions:
  name==='@/domain/phase2/month-control-contract'?contract:name==='@/domain/phase2/month-control-display'?{controlMoney:v=>v===null?'UNKNOWN':String(v)}:stubs,
  URL,Intl,Date:class extends Date{static now(){return now}},window:{location,history:{replaceState:(_a,_b,url)=>{location.href=new URL(String(url),location.href).href}},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name)}},
  document:{addEventListener(){},removeEventListener(){}},sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  setTimeout:(fn,delay=0)=>{const id=++timerId;timers.set(id,{fn,at:now+delay});return id},clearTimeout:id=>timers.delete(id),requestAnimationFrame:()=>0,cancelAnimationFrame(){}};
 vm.runInNewContext(code,context,{filename:'month-control-center.tsx'});
 function flush(){let n=0;while(dirty){assert.ok(++n<40,'No render loop');dirty=false;cursor=0;tree=exports.MonthControlCenter(props);
  for(const {i,setup,deps} of effects.splice(0)){slots[i]?.cleanup?.();slots[i]={setup,deps,cleanup:setup()}}}}
 const settle=async()=>{await Promise.resolve();await Promise.resolve();flush()};
 function find(type,node){if(arguments.length===1)node=tree;if(!node||typeof node!=='object')return;if(Array.isArray(node)){for(const child of node){const value=find(type,child);if(value)return value}return}if(node.type===type)return node;return find(type,node.props?.children)}
 const openEntity=entity=>{find('MonthLocalFocusProvider').props.value.openEntity(entity);flush()};
 const open=destination=>{tree.props.value.open(destination);flush()};
 async function tick(ms){const end=now+ms;for(;;){const entry=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;
  const[id,t]=entry;timers.delete(id);now=t.at;t.fn();await settle()}now=end;await settle()}
 function unmount(){for(const s of slots)s?.cleanup?.();mounted=false;dirty=false}
 function replayEffects(){for(const s of slots)s?.cleanup?.();for(const s of slots)if(s?.setup)s.cleanup=s.setup();flush()}
 flush();return{calls,routes,timers,storage,openEntity,open,tick,settle,find,unmount,replayEffects,
  close:()=>{find('OverlayFrame').props.closeAction.onAction();flush()},pop:()=>{listeners.get('popstate')?.();flush()},
  update:change=>{props={...props,...change};dirty=true;flush()},resolve:async(i,m=props.model)=>{calls[i].resolve(result(m));await settle()},
  reject:async i=>{calls[i].reject(new Error('READ_FAILED'));await settle()},get slots(){return slots},get postUnmountWrites(){return postUnmountWrites}};
}
let count=0;
const test=async(name,fn)=>{await fn();count++;console.log(name+' PASS')};
await test('LIFE-001 root preview scheduled briefly, not executed immediately',async()=>{const h=harness();assert.equal(h.calls.length,0);assert.equal(h.timers.size,1);await h.tick(500);assert.equal(h.calls.length,0);await h.tick(500);assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].args,['2026-10',model.defaultPurpose,[]])});
for(const delay of [100,500])await test(`LIFE-002 quick exit at ${delay}: zero action calls`,async()=>{const h=harness();await h.tick(delay);h.openEntity('pilot');await h.tick(2000);assert.equal(h.calls.length,0);assert.equal(h.timers.size,0);assert.equal(h.routes[0][0],'push')});
await test('LIFE-003 stays: unchanged action result retained',async()=>{const h=harness();await h.tick(1000);await h.resolve(0);assert.ok(h.slots.some(s=>s?.value?.baseDigest===model.baseDigest));await h.tick(2000);assert.equal(h.calls.length,1)});
await test('LIFE-004 non-root interaction flushes deferred preview',async()=>{const h=harness();await h.tick(100);h.openEntity('savings');await h.tick(0);assert.equal(h.calls.length,1);await h.tick(2000);assert.equal(h.calls.length,1)});
await test('LIFE-005 navigation before launch then return restarts once',async()=>{const h=harness();h.openEntity('pilot');h.open({section:'choices'});await h.tick(1000);assert.equal(h.calls.length,1)});
await test('LIFE-006 already started action: discard result after navigation',async()=>{const h=harness();await h.tick(1000);h.openEntity('pilot');await h.resolve(0);assert.ok(!h.slots.some(s=>s?.value?.baseDigest===model.baseDigest));assert.equal(h.calls.length,1)});
await test('LIFE-007 already started error after navigation is silent',async()=>{const h=harness();await h.tick(1000);h.openEntity('pilot');await h.reject(0);assert.ok(!h.slots.some(s=>typeof s?.value==='string'&&s.value.includes('calculé')))});
await test('LIFE-008 double navigation cancels pending work',async()=>{const h=harness();h.openEntity('pilot');h.openEntity('pilot');await h.tick(2000);assert.equal(h.calls.length,0)});
await test('LIFE-009 unmount before launch',async()=>{const h=harness();h.unmount();await h.tick(2000);assert.equal(h.calls.length,0);assert.equal(h.postUnmountWrites,0)});
await test('LIFE-010 unmount after start: no state writes',async()=>{const h=harness();await h.tick(1000);h.unmount();await h.resolve(0);assert.equal(h.postUnmountWrites,0)});
await test('LIFE-011 effect cleanup/setup replay schedules one action',async()=>{const h=harness();h.replayEffects();await h.tick(1000);assert.equal(h.calls.length,1)});
await test('LIFE-012 close and reopen reschedules once',async()=>{const h=harness();h.close();await h.tick(2000);assert.equal(h.calls.length,0);h.open({section:'choices'});await h.tick(1000);assert.equal(h.calls.length,1)});
await test('LIFE-013 legacy V2 without Composer remains immediate',async()=>{const h=harness({composerHref:undefined,initialFocus:'pilot'});await h.tick(0);assert.equal(h.calls.length,1);await h.resolve(0);assert.equal(h.find('MonthPilotIndex').props.trial.baseDigest,model.baseDigest)});
await test('LIFE-014 latest request wins over slower previous reply',async()=>{const h=harness({composerHref:undefined,initialFocus:'pilot'});await h.tick(0);h.find('MonthPilotIndex').props.remove(null);await h.tick(0);assert.equal(h.calls.length,2);await h.resolve(1);const latest=h.find('MonthPilotIndex').props.trial;h.calls[0].resolve({...result(model),sentinel:'stale'});await h.settle();assert.equal(h.find('MonthPilotIndex').props.trial,latest)});
await test('LIFE-015 current error and recovery',async()=>{const h=harness({composerHref:undefined,initialFocus:'pilot'});await h.tick(0);await h.reject(0);assert.ok(h.slots.some(s=>typeof s?.value==='string'&&s.value.includes('calculé')));h.find('MonthPilotIndex').props.remove(null);await h.tick(0);await h.resolve(1);assert.ok(!h.slots.some(s=>typeof s?.value==='string'&&s.value.includes('calculé')))});
await test('LIFE-016 authority changes before launch use new month/publication',async()=>{const h=harness();const next={...model,targetMonth:'2026-11',reliability:{publicationId:'publication-b'}};h.update({model:next});await h.tick(1000);assert.equal(h.calls.length,1);assert.equal(h.calls[0].args[0],'2026-11')});
await test('LIFE-017 old publication reply cannot populate same-digest model',async()=>{const h=harness({composerHref:undefined,initialFocus:'pilot'});await h.tick(0);const next={...model,reliability:{publicationId:'publication-b'}};h.update({model:next});await h.tick(0);await h.resolve(0);assert.equal(h.find('MonthPilotIndex').props.trial,null);await h.resolve(1,next);assert.equal(h.find('MonthPilotIndex').props.trial.model.reliability.publicationId,'publication-b')});
await test('LIFE-018 month keyed unmount/remount ignores old result',async()=>{const old=harness();await old.tick(1000);old.unmount();const next=harness({model:{...model,targetMonth:'2026-11'}});await next.tick(1000);await old.resolve(0);assert.equal(old.postUnmountWrites,0);assert.equal(next.calls[0].args[0],'2026-11')});
await test('LIFE-019 auth/authority refresh recomputes, stale facts refresh router',async()=>{const h=harness({composerHref:undefined,initialFocus:'pilot'});await h.tick(0);const next={...model,baseDigest:'fresh-facts'};await h.resolve(0,next);assert.equal(h.find('MonthPilotIndex').props.trial,null);assert.ok(h.routes.some(r=>r[0]==='refresh'));h.update({model:next});await h.tick(0);await h.resolve(1,next);assert.equal(h.find('MonthPilotIndex').props.trial.baseDigest,'fresh-facts')});
await test('LIFE-020 explicit draft edits retain existing 180ms debounce and payload',async()=>{const h=harness({composerHref:undefined,initialFocus:'pilot:category:groceries'});await h.tick(0);
 const op={kind:'CATEGORY',categoryKey:'groceries',strategy:'TEST_AMOUNT',amount:'280.00'};h.find('MonthPilotEditor').props.replaceDraft(op);await h.tick(0);await h.tick(179);assert.equal(h.calls.length,1);await h.tick(1);assert.equal(h.calls.length,2);assert.deepEqual(h.calls[1].args,['2026-10',{kind:'FREE_EXPLORATION'},[op]])});
await test('LIFE-021 navigation callback and focus redirect both cancel',async()=>{const h=harness();h.open({section:'choices',focus:'pilot'});await h.tick(2000);assert.equal(h.calls.length,0);const linked=harness({initialFocus:'pilot'});await linked.tick(2000);assert.equal(linked.calls.length,0);assert.equal(linked.routes[0][0],'replace')});
await test('LIFE-022 popstate return clears departure guard',async()=>{const h=harness();h.openEntity('pilot');h.pop();await h.tick(1000);assert.equal(h.calls.length,1)});
await test('LIFE-023 authority refresh during departure never revives preview',async()=>{const h=harness();h.openEntity('pilot');h.update({model:{...model,baseDigest:'new-publication'}});await h.tick(2000);assert.equal(h.calls.length,0)});
console.log(`CONTROL_CENTER_PREVIEW_LIFECYCLE ${count}/${count} PASS`);
