import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {performance} from 'node:perf_hooks';
import {require} from './lib/phase2-ts-loader.mjs';
import {fixture,state,uuid,control,findSlot} from './fixtures/planner-headless.mjs';
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const world=fixture(),target=findSlot(world,'groceries').slotIdentityKey;
const drafts=Array.from({length:10},(_,i)=>state([control(target,{amount:String(350+i)})]));
const model={semanticState:drafts[0],board:{draft:{semanticStateDigest:semanticStateDigest(drafts[0])},cockpit:{applyReadiness:'READY'}}};
const source=execFileSync('git',['show','a934f60f7f796b4522cbccfbb7b01edfab96dea5:src/app/mois-a-venir/composer/preview-scheduler.ts'],{encoding:'utf8'});
const legacy=new Module(process.cwd()+'/scripts/p2-old-scheduler.ts');legacy.filename=legacy.id;legacy.paths=require.resolve.paths('typescript');
legacy._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,legacy.filename);
const old=legacy.exports.ComposerPreviewScheduler,newer=require('@/app/mois-a-venir/composer/preview-scheduler').ComposerPreviewScheduler;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
function session(Type,delay=70){
  const scheduler=new Type(),trace=[],sent=[],accepted=[],statuses=[];let current=drafts[0],version='world-a';
  const authority=()=>({draftDigest:semanticStateDigest(current),targetMonth:current.targetMonth,worldVersion:version});
  const transport=async request=>{sent.push(request);trace.push({event:'sent',sequence:request.sequence,at:performance.now()});
    await sleep(delay);trace.push({event:'server-finished',sequence:request.sequence,at:performance.now()});
    return {ok:true,sequence:request.sequence,model:{...model,semanticState:request.draft,board:{...model.board,draft:{semanticStateDigest:semanticStateDigest(request.draft)}}}};};
  const schedule=(draft,wait=10)=>{current=draft;trace.push({event:'intent',digest:semanticStateDigest(draft),at:performance.now()});
    scheduler.schedule(draft,version,transport,authority,value=>statuses.push(value),response=>{accepted.push(response);trace.push({event:'accepted',sequence:response.sequence,at:performance.now()});},wait);};
  return {scheduler,trace,sent,accepted,statuses,schedule,changeVersion:()=>{version='world-b';},changeDraft:draft=>{current=draft;}};
}
const check=async(name,fn)=>{await fn();checks.push(name);console.log(name+' PASS');};
const comparisons=[];
await check('P2-IDENTICAL-PENDING-INTENT-ONE-DISPATCH',async()=>{
  for(const [label,Type]of [['P1',old],['P2',newer]]){
    const s=session(Type);s.schedule(drafts[0],0);await sleep(5);s.schedule(drafts[0],0);await sleep(5);s.schedule(drafts[0],0);await sleep(90);
    assert.equal(s.sent.length,label==='P1'?3:1);assert.equal(s.accepted.length,1);
    comparisons.push({variant:label,case:'identical-pending',requests:s.sent.length,alreadyStarted:s.sent.length,
      accepted:s.accepted.length,lastIntentToFreshMs:s.trace.at(-1).at-s.trace.filter(e=>e.event==='intent').at(-1).at,trace:s.trace});s.scheduler.dispose();
  }
});
await check('P2-TEN-EDITS-UNSENT-COALESCED-LAST-HAS-PRIORITY',async()=>{
  for(const [label,Type]of [['P1',old],['P2',newer]]){
    const s=session(Type);for(const draft of drafts)s.schedule(draft,20);await sleep(110);
    assert.equal(s.sent.length,1);assert.equal(s.accepted[0].model.board.draft.semanticStateDigest,semanticStateDigest(drafts.at(-1)));
    comparisons.push({variant:label,case:'ten-rapid-distinct',requests:1,unsentIntents:9,accepted:1,
      lastIntentToFreshMs:s.trace.at(-1).at-s.trace.filter(e=>e.event==='intent').at(-1).at,trace:s.trace});s.scheduler.dispose();
  }
});
await check('P2-DIFFERENT-INTENT-DOES-NOT-WAIT-FOR-OLD-SQL',async()=>{
  const s=session(newer,100);s.schedule(drafts[0],0);await sleep(5);s.schedule(drafts[1],0);await sleep(5);
  assert.equal(s.sent.length,2);assert.equal(s.accepted.length,0);await sleep(110);
  assert.equal(s.accepted.length,1);assert.equal(s.accepted[0].model.board.draft.semanticStateDigest,semanticStateDigest(drafts[1]));s.scheduler.dispose();
});
await check('P2-VERSION-CHANGE-UNDO-AND-DISPOSE-REJECT-OLD',async()=>{
  for(const action of ['version','undo','dispose']){
    const s=session(newer,20);s.schedule(drafts[0],0);await sleep(5);
    if(action==='version')s.changeVersion();else if(action==='undo'){s.changeDraft(drafts[1]);s.scheduler.cancel();}else s.scheduler.dispose();
    await sleep(35);assert.equal(s.accepted.length,0);s.scheduler.dispose();
  }
});
await check('P2-COMPLETED-READ-NOT-CACHED',async()=>{
  const s=session(newer,10);s.schedule(drafts[0],0);
  for(let n=0;s.accepted.length<1&&n<100;n++)await sleep(5);
  assert.equal(s.accepted.length,1);s.schedule(drafts[0],0);
  for(let n=0;s.accepted.length<2&&n<100;n++)await sleep(5);
  assert.equal(s.sent.length,2);assert.equal(s.accepted.length,2);s.scheduler.dispose();
});
const report={status:'PASS_SYNTHETIC_SCHEDULER_ONLY',checks,comparisons,
  pendingSqlCancellation:'NOT_IMPLEMENTED_NOT_CLAIMED',differentStatesStillDispatchImmediatelyAfterDebounce:true,
  queueStrategy:'single-flight for different states rejected: it waits for a previous read; latest intent is not delayed',remoteWrites:0};
if(process.env.P14_P2_SCHEDULER_REPORT)fs.writeFileSync(process.env.P14_P2_SCHEDULER_REPORT,JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
