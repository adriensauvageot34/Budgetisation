import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {AsyncLocalStorage} from 'node:async_hooks';
import {performance} from 'node:perf_hooks';
import ts from 'typescript';
import {require} from './phase2-ts-loader.mjs';
export const p2Measuring=process.env.PLANNER_P14_P2_MEASURE==='1';
const context=new AsyncLocalStorage();
export async function p2World(read){const c=context.getStore();if(c){c.worldReads++;c.events.push({event:'world-start',at:performance.now()});}
  const delay=p2Measuring?Number(process.env.PLANNER_P14_P2_WORLD_DELAY??120):0;
  if(delay)await new Promise(r=>setTimeout(r,Math.min(delay,1000)));
  try{return await read();}finally{if(c)c.events.push({event:'world-end',at:performance.now()});}
}
if(p2Measuring){
  for(const [file,name,label]of [['preview','evaluatePlanScenario','evaluations'],['financial-adapter','deriveCompiledMonthScenario','financeCalls']]){
    const module=require('@/server/phase2/planner/'+file),original=module[name];
    module[name]=(...args)=>{const c=context.getStore(),start=performance.now();if(c)c[label]++;
      try{const result=original(...args);if(c&&label==='evaluations')c.digests.push({preview:result.previewDigest,projection:result.projectionDigest,manifest:result.compiledManifestDigest});return result;}
      finally{if(c)c[label+'Ms']+=performance.now()-start;}};
  }
}
export async function p2Interaction(command,run){
  if(!p2Measuring)return run();
  const c={kind:command.kind,sequence:command.sequence,started:performance.now(),worldReads:0,evaluations:0,financeCalls:0,evaluationsMs:0,financeCallsMs:0,events:[],digests:[]};
  const result=await context.run(c,run);
  return {...result,fixturePerformance:{...c,ms:performance.now()-c.started,simulatedGets:c.worldReads*20}};
}
const base='a934f60f7f796b4522cbccfbb7b01edfab96dea5';
export function p2FixturePlugin(){return {name:'p14-p2-identical-fixture-probes',setup(builder){
  if(!p2Measuring)return;
  builder.onLoad({filter:/\.(?:ts|tsx)$/},args=>{
    const relative=path.relative(process.cwd(),args.path).replaceAll('\\','/');
    const old=process.env.PLANNER_P14_P2_VARIANT==='P1';
    const originals=['composer-shell.tsx','preview-scheduler.ts','local-draft.ts','durable-draft.ts'];
    let source=old&&originals.some(name=>relative.endsWith('/'+name))?
      execFileSync('git',['show',base+':'+relative],{encoding:'utf8'}):fs.readFileSync(args.path,'utf8');
    const names=relative.endsWith('/semantic-state.ts')?['semanticStateDigest']:
      relative.endsWith('/local-draft.ts')?['stageLocalDecision','visualDraftModel']:
      relative.endsWith('/composer-shell.tsx')?['stage']:[];
    if(!names.length&&!relative.endsWith('/composer-shell.tsx'))return old&&originals.some(name=>relative.endsWith('/'+name))?
      {contents:source,loader:relative.endsWith('.tsx')?'tsx':'ts'}:undefined;
    const ast=ts.createSourceFile(args.path,source,ts.ScriptTarget.Latest,true),edits=[];
    const visit=node=>{if(ts.isFunctionDeclaration(node)&&node.name&&node.body&&names.includes(node.name.getText(ast))){
      edits.push([node.body.getStart(ast)+1,node.body.getEnd()-1,`const p2End=clientSpan(${JSON.stringify(node.name.getText(ast))});try {${source.slice(node.body.getStart(ast)+1,node.body.getEnd()-1)}}finally{p2End();}`]);return;}
      ts.forEachChild(node,visit);};visit(ast);
    for(const [start,end,text]of edits.sort((a,b)=>b[0]-a[0]))source=source.slice(0,start)+text+source.slice(end);
    if(relative.endsWith('/composer-shell.tsx')){
      const hook=String.raw`  useEffect(()=>{const handle=(event:Event)=>{const detail=(event as CustomEvent).detail;
        let operation=detail.operation;const at=performance.now(),phase=probe.phase;probe.lastIntent=at;
        if(detail.mode==='asset'){const asset=current.current.library.searchableAssets.find(a=>a.optionKind==='COMPONENT'&&a.assetKey.startsWith('option:night-out:'+detail.slot+':'));
          operation={kind:'DROP',assetKey:asset.assetKey,target:{kind:'CONTEXT_SOCKET',contextOccurrenceId:detail.contextId,slotKey:detail.slot},identity:detail.contextId,selectionId:detail.selectionId,values:{amount:'12',quantity:detail.quantity??'1'}};}
        if(detail.mode==='amount'||detail.mode==='same-amount'){const card=current.current.board.baselineControls.find(c=>/Courses/u.test(c.label));
          const prior=localDraft.current.controls.find(c=>c.decisionSlotKey===card!.targetRef)?.value.amount;
          operation={kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:card!.targetRef,value:{amount:detail.mode==='same-amount'?String(prior):detail.amount}}};}
        if(detail.mode==='hover'){const card=current.current.board.baselineControls.find(c=>/Courses/u.test(c.label));
          previewGesture({kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:card!.targetRef,value:{amount:'400'}}});return;}
        if(detail.mode==='clear-hover'){clearHover();return;}
        const history=detail.mode==='undo'?'undo':detail.mode==='redo'?'redo':'push';
        const restored=history==='undo'?past.at(-1):history==='redo'?future.at(-1):undefined;
        const accepted=stage(operation??{kind:'READ'},history,restored);
        const cpuMs=performance.now()-at;
        requestAnimationFrame(()=>{const node=document.querySelector('[data-composer]');probe.stages.push({phase,at,kind:operation?.kind??history,cpuMs,paintMs:performance.now()-at,accepted,
          cards:localDraft.current.contexts.length,status:node?.getAttribute('data-preview-state')});publish();});};
      window.addEventListener('p2-fixture-command',handle);return()=>window.removeEventListener('p2-fixture-command',handle);},[model,draftState,previewStatus,past,future,editor,projectionOpen]);
    useEffect(()=>{commit(shown.board.draft.semanticStateDigest,model.proof.expectedPreviewDigest,previewStatus,durable.status,draftState.contexts.length);},[model,draftState,previewStatus,durable.status]);
`;
      source=source.replace('  return <ComposerInteractionContext.Provider',hook+'  return <ComposerInteractionContext.Provider');
    }
    source=`import {clientSpan,probe,publish,commit} from ${JSON.stringify(path.resolve('scripts/lib/planner-p14-p2-probe.ts'))};\n`+source;
    return {contents:source,loader:relative.endsWith('.tsx')?'tsx':'ts'};
  });
}};}
