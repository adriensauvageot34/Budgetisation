import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {performance} from 'node:perf_hooks';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {fixture,state,control,findSlot,nightMonth,weekendMonth,uuid} from './fixtures/planner-headless.mjs';
import {fixture as mobilityFixture,visit,providers} from './fixtures/planner-mobility.mjs';
const base='6ad801a71b6f612032e403b7bc10793954de2fbd';
const changed=['composer-service','read-model','balance-assistant'];
const originals=new Map(changed.map(name=>{
  const file=require.resolve('@/server/phase2/planner/'+name),relative=path.relative(process.cwd(),file).replaceAll('\\','/');
  return [file,execFileSync('git',['show',`${base}:${relative}`],{encoding:'utf8'})];
}));
const normal=require.extensions['.ts'];
let variant='P4D',metrics=null;
require.extensions['.ts']=(module,file)=>{
  if(variant!=='P4B'||!originals.has(file))return normal(module,file);
  module._compile(ts.transpileModule(originals.get(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},fileName:file}).outputText,file);
};
globalThis.fetch=async()=>{throw Error('P4D_SYNTHETIC_NETWORK_FORBIDDEN');};
const span=(label,run)=>{const start=performance.now();try{return run();}finally{
  if(metrics)metrics.spans.push({label,start:start-metrics.start,ms:performance.now()-start});
}};
for(const [file,name,label]of [['compiler','compileSemanticPlan','compiler'],['financial-adapter','deriveCompiledMonthScenario','finance-v2'],['preview','evaluatePlanScenario','evaluation']]){
  const module=require('@/server/phase2/planner/'+file),original=module[name];
  module[name]=(...args)=>span(label,()=>original(...args));
}
function handler(side){
  variant=side;
  for(const file of originals.keys())delete require.cache[file];
  return require('@/server/phase2/planner/composer-service').handleComposerRequest;
}
const pg=await createKernelPostgres(),repository=require('@/server/phase2/planner/repository').createPlanApplyRepository(pg.client);
const prepare=require('@/server/phase2/planner/prospective-mobility-pricing').preparePlanningMobility;
const checks=[],records=[];
const check=async(name,fn)=>{await fn();checks.push(name);console.log(name+' PASS');};
async function run(side,world,draft,command={kind:'SUGGESTIONS'},{delay=0,afterFirst,fail=false}={}){
  const handle=handler(side),owner=providers();let reads=0;
  const m={variant:side,start:performance.now(),worldReads:0,activeReads:0,prepareCalls:0,spans:[]};metrics=m;
  const deps={repository:{...repository,readActivePlan:async(...args)=>{
    m.activeReads++;const at=performance.now();try{return await repository.readActivePlan(...args);}finally{m.spans.push({label:'active-plan',start:at-m.start,ms:performance.now()-at});}}},
    householdPersons:[{personId:uuid(1),displayName:'Synthetic person'}],
    readWorld:async()=>{m.worldReads++;const at=performance.now();try{
      if(delay)await new Promise(r=>setTimeout(r,delay));if(fail)throw TypeError('SYNTHETIC_HISTORY_UNAVAILABLE');
      return ++reads>1&&afterFirst?afterFirst():world;
    }finally{m.spans.push({label:'world',start:at-m.start,ms:performance.now()-at});}},
    prepareWorld:async(w,s)=>{m.prepareCalls++;const at=performance.now();try{return await prepare(w,s,owner.value);}
      finally{m.spans.push({label:'prepare-world-mobility',start:at-m.start,ms:performance.now()-at});}},
    readMobilityOptions:async()=>({places:world.mobilityFacts?.places??[],vehicle:world.mobilityFacts?.vehicle??null}),
    validateContextReferences:async(_h,refs)=>{if(refs.personIds.some(id=>id!==uuid(1)))throw TypeError('CONTEXT_PERSON_NOT_IN_HOUSEHOLD');}};
  const response=await handle(deps,world.baseline.householdId,{...command,draft,targetMonth:draft.targetMonth,sequence:3});
  m.serverMs=performance.now()-m.start;
  const at=performance.now(),bytes=Buffer.byteLength(JSON.stringify(response));m.serializationMs=performance.now()-at;m.responseBytes=bytes;
  m.evaluations=m.spans.filter(s=>s.label==='evaluation').length;m.financeCalls=m.spans.filter(s=>s.label==='finance-v2').length;
  m.compilerCalls=m.spans.filter(s=>s.label==='compiler').length;
  m.fingerprint=crypto.createHash('sha256').update(JSON.stringify(response)).digest('hex');m.ok=response.ok;
  delete m.start;metrics=null;return {response,metrics:m};
}
try{
  const basic=fixture(),slot=findSlot(basic,'groceries').slotIdentityKey,night=nightMonth(),stay=weekendMonth(false),mobility=mobilityFixture();
  const cases=[['empty',basic,state()],['amount',basic,state([control(slot,{amount:'350'})])],
    ['night-unknown',night.world,night.semantic],['short-stay-unresolved',stay.world,stay.semantic],
    ['car-return',mobility,state([], [visit(100)])]];
  for(const[name,world,draft]of cases)await check('P4D-SUGGESTIONS-PARITY-'+name,async()=>{
    const saved=structuredClone({world,draft}),a=await run('P4B',world,draft),b=await run('P4D',world,draft);
    assert.equal(a.response.ok,true,a.response.code);assert.deepEqual(b.response,a.response);
    assert.equal(a.metrics.worldReads,2);assert.equal(b.metrics.worldReads,1);
    // composerUiModel keeps its own authoritative active-Plan read.
    assert.equal(a.metrics.activeReads,3);assert.equal(b.metrics.activeReads,2);
    assert.equal(a.metrics.evaluations,b.metrics.evaluations+1);assert.equal(a.metrics.prepareCalls,b.metrics.prepareCalls+1);
    assert.deepEqual({world,draft},saved);records.push({case:name,P4B:a.metrics,P4D:b.metrics});
  });
  await check('P4D-ONE-ADMITTED-SNAPSHOT-NEXT-REQUEST-SEES-CHANGE',async()=>{
    const changed=structuredClone(basic);changed.monthInputs.safetyReserve='91';
    const first=await run('P4D',basic,state(),undefined,{afterFirst:()=>changed});
    const direct=await run('P4D',basic,state());assert.deepEqual(first.response,direct.response);
    const next=await run('P4D',changed,state());assert.notEqual(next.metrics.fingerprint,first.metrics.fingerprint);
    const legacy=await run('P4B',basic,state(),undefined,{afterFirst:()=>changed});
    assert.notEqual(legacy.response.suggestions.basePreviewDigest,legacy.response.model.proof.expectedPreviewDigest);
    assert.equal(first.response.suggestions.basePreviewDigest,first.response.model.proof.expectedPreviewDigest);
  });
  await check('P4D-PRESERVE-AND-UNKNOWN-PARITY',async()=>{
    const draft=structuredClone(night.semantic);draft.preferences.anchors=[uuid(400)];
    const a=await run('P4B',night.world,draft),b=await run('P4D',night.world,draft);
    assert.deepEqual(b.response,a.response);assert.equal(b.response.suggestions.capabilities.find(c=>c.targetRef===uuid(400)).flexibility,'LOCKED');
  });
  await check('P4D-ERROR-AND-MONTH-BOUNDARY-PARITY',async()=>{
    for(const options of [{fail:true}]){
      const a=await run('P4B',basic,state(),undefined,options),b=await run('P4D',basic,state(),undefined,options);
      assert.equal(a.response.ok,false);assert.deepEqual(b.response,a.response);
    }
    const draft={...state(),targetMonth:'2026-12'};
    const a=await run('P4B',basic,draft),b=await run('P4D',basic,draft);
    assert.equal(a.response.ok,false);assert.deepEqual(b.response,a.response);
  });
  await check('P4D-STALE-CANDIDATE-ACCEPT-STILL-REREADS',async()=>{
    const read=await run('P4D',basic,state()),candidate=read.response.suggestions.candidates[0];assert.ok(candidate);
    const op={kind:'ACCEPT',candidateSetDigest:read.response.suggestions.candidateSetDigest,candidateId:candidate.candidateId};
    const a=await run('P4B',basic,state(),op),b=await run('P4D',basic,state(),op);assert.deepEqual(b.response,a.response);
    assert.equal(a.metrics.worldReads,b.metrics.worldReads);
    const changed=structuredClone(basic);changed.monthInputs.safetyReserve='83';
    const stale=await run('P4D',changed,state(),op);assert.equal(stale.response.ok,false);assert.equal(stale.response.code,'PLANNER_CANDIDATES_STALE');
  });
  await check('P4D-APPLY-AUTHORITATIVE-READ-UNCHANGED',async()=>{
    const read=await run('P4D',basic,state(),{kind:'READ'}),changed=structuredClone(basic);changed.monthInputs.safetyReserve='72';
    const op={kind:'APPLY',command:{...read.response.model.proof,applyRequestId:uuid(99001)}};
    const a=await run('P4B',changed,state(),op),b=await run('P4D',changed,state(),op);
    assert.deepEqual(b.response,a.response);assert.equal(b.response.ok,false);assert.equal(b.response.code,'PLANNER_PREVIEW_STALE');assert.equal(pg.rpcCalls,0);
  });
  const pairs=[];
  for(let i=0;i<40;i++){
    const pair={};for(const side of i%2?['P4D','P4B']:['P4B','P4D']){
      const result=await run(side,basic,state(),undefined,{delay:60});assert.equal(result.response.ok,true);pair[side]=result.metrics;
    }assert.equal(pair.P4B.fingerprint,pair.P4D.fingerprint);pairs.push(pair);
  }
  await pg.verifyCanaries();assert.deepEqual(await pg.counts(),{plans:0,revisions:0});
  const percentile=(side,p)=>pairs.map(pair=>pair[side].serverMs).toSorted((a,b)=>a-b)[Math.ceil(pairs.length*p)-1];
  const report={status:'EXECUTED_PASS_SYNTHETIC_ONLY',base,checks,records,pairs,n:pairs.length,
    simulatedWorldDelayMs:60,comparisonOrder:'alternating',P3:'0',
    P4B:{p50:percentile('P4B',.5),p95:percentile('P4B',.95)},P4D:{p50:percentile('P4D',.5),p95:percentile('P4D',.95)},
    realPostgrestGets:'NOT_MEASURED',authReal:'NOT_RUN',remoteWrites:0,applyRpcCalls:pg.rpcCalls};
  const out=process.env.P14_P4D_SUGGESTIONS_REPORT;if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));}
  console.log(JSON.stringify({status:report.status,checks:checks.length,n:report.n,P4B:report.P4B,P4D:report.P4D}));
}finally{require.extensions['.ts']=normal;await pg.close();}
