// Test-only production React probes. No URL query, ID, amount or secret is exported.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {AsyncLocalStorage} from 'node:async_hooks';
import {performance} from 'node:perf_hooks';
import {require} from './phase2-ts-loader.mjs';
export const p4dMeasuring=process.env.PLANNER_P14_P4D_MEASURE==='1';
const context=new AsyncLocalStorage(),handlers=new Map(),base='6ad801a71b6f612032e403b7bc10793954de2fbd';
const changes=['composer-service','read-model','balance-assistant'];
async function asyncSpan(label,run){const m=context.getStore(),at=performance.now();try{return await run();}
  finally{if(m)m.spans.push({label,start:at-m.start,ms:performance.now()-at});}}
if(p4dMeasuring){
  for(const[file,name,label]of [['compiler','compileSemanticPlan','compiler'],['financial-adapter','deriveCompiledMonthScenario','finance-v2'],['preview','evaluatePlanScenario','evaluation']]){
    const module=require('@/server/phase2/planner/'+file),original=module[name];
    module[name]=(...args)=>{const m=context.getStore(),at=performance.now();try{return original(...args);}
      finally{if(m)m.spans.push({label,start:at-m.start,ms:performance.now()-at});}};
  }
  const normal=require.extensions['.ts'];
  for(const side of ['P4B','P4D']){
    require.extensions['.ts']=(module,file)=>{
      const rel=path.relative(process.cwd(),file).replaceAll('\\','/');
      if(side!=='P4B'||!changes.some(name=>rel===`src/server/phase2/planner/${name}.ts`))return normal(module,file);
      const source=execFileSync('git',['show',`${base}:${rel}`],{encoding:'utf8'});
      module._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},fileName:file}).outputText,file);
    };
    try{
      for(const name of changes)delete require.cache[require.resolve('@/server/phase2/planner/'+name)];
      const service=require('@/server/phase2/planner/composer-service'),original=service.composerUiModel;
      service.composerUiModel=(...args)=>asyncSpan('composer-ui',()=>original(...args));
      handlers.set(side,service.handleComposerRequest);
    }finally{require.extensions['.ts']=normal;}
  }
}
export async function p4dInteraction(command,side,deps,household,otherwise){
  if(!p4dMeasuring)return otherwise();
  if(['APPLY','CHECK_APPLY'].includes(command.kind))throw Error('P4D_FIXTURE_APPLY_FORBIDDEN');
  if(!handlers.has(side))throw Error('P4D_VARIANT_INVALID');
  const m={variant:side,start:performance.now(),worldReads:0,activeReads:0,prepareCalls:0,spans:[]};
  return context.run(m,async()=>{
    const scoped={...deps,readWorld:(...args)=>{m.worldReads++;return asyncSpan('world',async()=>{
      const delay=Math.min(1000,Math.max(0,Number(process.env.PLANNER_P14_P4D_WORLD_DELAY??60)));
      if(delay)await new Promise(r=>setTimeout(r,delay));return deps.readWorld(...args);
    });},
      repository:{...deps.repository,readActivePlan:(...args)=>{m.activeReads++;return asyncSpan('active-plan',()=>deps.repository.readActivePlan(...args));}},
      prepareWorld:deps.prepareWorld?(...args)=>{m.prepareCalls++;return asyncSpan('prepare-world-mobility',()=>deps.prepareWorld(...args));}:undefined};
    const result=await handlers.get(side)(scoped,household,command);
    m.serverMs=performance.now()-m.start;const at=performance.now();m.responseBytes=Buffer.byteLength(JSON.stringify(result));m.serializationMs=performance.now()-at;
    m.evaluations=m.spans.filter(s=>s.label==='evaluation').length;m.financeCalls=m.spans.filter(s=>s.label==='finance-v2').length;
    delete m.start;return {...result,p4dPerformance:m};
  });
}
export function p4dFixturePlugin(){return{name:'p4d-financial-timeline',setup(b){if(!p4dMeasuring)return;
  b.onLoad({filter:/composer-shell\.tsx$/},args=>{
    let source=fs.readFileSync(args.path,'utf8');
    const probe=JSON.stringify(path.resolve('scripts/lib/planner-p14-p4d-probe.ts'));
    source=`import {p4dStage,p4dScheduled,p4dAdmitted,p4dCommit,p4dIntent} from ${probe};\n`+source;
    source=source.replace('  function schedulePreview(draft: PlanSemanticStateV1) {','  function schedulePreview(draft: PlanSemanticStateV1) {\n    p4dScheduled(semanticStateDigest(draft));');
    source=source.replace('    schedulePreview(next);','    p4dStage(nextDigest); schedulePreview(next);');
    source=source.replace('      install(response.model); setErrorMessage(null);','      p4dAdmitted(response.model.board.draft.semanticStateDigest); install(response.model); setErrorMessage(null);');
    const hook=String.raw`  useEffect(()=>{const handle=(event:Event)=>{const detail=(event as CustomEvent).detail;
      p4dIntent(detail.label??detail.mode,false);
      if(detail.mode==='suggestions'){void run({kind:'SUGGESTIONS'});return;}
      const card=current.current.board.baselineControls.find(c=>c.label==='Courses');
      let operation:ComposerOperation=detail.operation??{kind:'READ'};
      if(detail.mode==='amount')operation={kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:card!.targetRef,value:{amount:detail.amount}}};
      const history=detail.mode==='undo'?'undo':detail.mode==='redo'?'redo':'push';
      stage(operation,history,history==='undo'?past.at(-1):history==='redo'?future.at(-1):undefined);
    };window.addEventListener('p4d-fixture-command',handle);return()=>window.removeEventListener('p4d-fixture-command',handle);},[past,future,model,draftState,previewStatus]);
  p4dCommit(shown.board.draft.semanticStateDigest,model.board.draft.semanticStateDigest,previewStatus);
`;
    source=source.replace('  return <ComposerInteractionContext.Provider',hook+'  return <ComposerInteractionContext.Provider');
    return{contents:source,loader:'tsx'};
  });
}};}
