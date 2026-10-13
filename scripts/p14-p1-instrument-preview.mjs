// Temporary identical probes for the two protected, read-only P1 Previews.
// No credential, URL parameter, row, ID or financial payload is collected.
// Run `node scripts/p14-p1-instrument-preview.mjs apply|restore`.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
const root=process.cwd(), backup=path.join(root,'.vercel/p14-p1-probe-originals.json');
const helper='src/server/phase2/planner/p14-p1-probe.ts';
const actions='src/app/mois-a-venir/composer/p14-p1-readonly-actions.ts';
const helperSource=String.raw`import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
type Sample={label:string;ms:number};
type FetchSample={table:string;method:string;ms:number;bytes:number;status:number;timeout:boolean};
type Context={start:number;spans:Sample[];requests:FetchSample[];pending:Promise<void>[];fingerprint?:string;blockedWrites:number};
const key=Symbol.for("budgetisation.p14.p1.probe");
type ProbeGlobal=typeof globalThis & {[key]?:{als:AsyncLocalStorage<Context>}};
const shared=(globalThis as ProbeGlobal)[key] ??= {als:new AsyncLocalStorage<Context>()};
if (!(globalThis.fetch as typeof fetch & {p14p1?:boolean}).p14p1) {
  const original=globalThis.fetch;
  const wrapped:typeof fetch=async(input,init)=>{
    const ctx=shared.als.getStore();
    if (!ctx) return original(input,init);
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    const isRest=url.pathname.startsWith('/rest/v1/');
    const method=(init?.method ?? (input instanceof Request?input.method:'GET')).toUpperCase();
    if (isRest && method!=='GET' && method!=='HEAD') {ctx.blockedWrites++;throw new Error('P14_P1_READ_ONLY_MUTATION_REFUSED');}
    const table=isRest ? url.pathname.slice(9).split('/')[0].replace(/[^a-zA-Z0-9_]/g,'') : url.pathname.startsWith('/auth/')?'auth':'other';
    const start=performance.now();
    try {
      const response=await original(input,init);
      const row:FetchSample={table,method,ms:performance.now()-start,bytes:0,status:response.status,timeout:false};
      ctx.requests.push(row);
      const pending=response.clone().arrayBuffer().then(buffer=>{
        row.bytes=buffer.byteLength;
        if (!response.ok) {try {row.timeout=JSON.parse(new TextDecoder().decode(buffer)).code==='57014';}catch{}}
      },()=>{});
      ctx.pending.push(pending);
      return response;
    } catch(error) {ctx.requests.push({table,method,ms:performance.now()-start,bytes:0,status:0,timeout:false});throw error;}
  };
  (wrapped as typeof fetch & {p14p1?:boolean}).p14p1=true;
  globalThis.fetch=wrapped;
}
export function p14Start(label:string) {
  const ctx=shared.als.getStore(),start=performance.now();
  return ()=>{if(ctx)ctx.spans.push({label,ms:performance.now()-start});};
}
export function p14Model(model:{proof:unknown;board:{draft:{semanticStateDigest:string}}}) {
  const ctx=shared.als.getStore();
  if(ctx)ctx.fingerprint=createHash('sha256').update(JSON.stringify([model.proof,model.board.draft.semanticStateDigest])).digest('hex');
}
export async function p14Probe<T>(run:()=>Promise<T>) {
  const ctx:Context={start:performance.now(),spans:[],requests:[],pending:[],blockedWrites:0};
  return shared.als.run(ctx,async()=>{
    let value:T;
    try {value=await run();}catch(error){
      await Promise.allSettled(ctx.pending);
      console.info('P14_P1_PROBE_ERROR',JSON.stringify(summary(ctx)));
      throw error;
    }
    const renderMs=performance.now()-ctx.start;
    await Promise.allSettled(ctx.pending);
    return {value,metrics:{...summary(ctx),renderMs}};
  });
}
function summary(ctx:Context) {
  const byTable:Record<string,{count:number;ms:number;bytes:number;errors:number;timeouts:number}>={};
  for(const r of ctx.requests){const t=byTable[r.table]??={count:0,ms:0,bytes:0,errors:0,timeouts:0};t.count++;t.ms+=r.ms;t.bytes+=r.bytes;t.errors+=r.status===0||r.status>=400?1:0;t.timeouts+=r.timeout?1:0;}
  return {version:'p14-p1-probe@1',variant:process.env.COMPOSER_P14_P1_READ_REUSE==='0'?'A':'B',region:process.env.VERCEL_REGION??'unknown',totalMs:performance.now()-ctx.start,
    spans:ctx.spans,byTable,blockedWrites:ctx.blockedWrites,fingerprint:ctx.fingerprint??null};
}
`;
const targets=[
 ['src/server/phase2/planner/runtime.ts',{authorizedPlanner:'authorization'}],
 ['src/server/phase2/planner/world-reader.ts',{readWorld:'world',prepareWorld:'prepare-world'}],
 ['src/server/phase2/planner/baseline-adapters.ts',{readPlanningBaselineSources:'baseline-sources'}],
 ['src/server/phase2/month-planning-read.ts',{readPlanningMonthForecast:'forecast'}],
 ['src/server/phase2/live-month-forecast.ts',{loadMonthForecastAuthorities:'forecast-authorities'}],
 ['src/server/phase2/month-prediction-evidence.ts',{readMonthPredictionEvidence:'prediction-evidence'}],
 ['src/server/canonical/repository.ts',{queryRows:'canonical-query'}],
 ['src/server/phase2/planner/preview.ts',{evaluatePlanScenario:'compiler-finance-v2'}],
 ['src/server/phase2/planner/composer-service.ts',{composerUiModel:'ui-model'}],
 ['src/server/phase2/planner/composer-draft-service.ts',{readComposerDrafts:'draft-read'}],
 ['src/server/phase2/planner/baseline.ts',{buildPlanningBaseline:'baseline-build'}],
 ['src/server/phase2/planner/renewal-baseline.ts',{buildRenewalPlanningBaseline:'renewal-baseline-build'}],
];
const page='src/app/mois-a-venir/composer/page.tsx',shell='src/app/mois-a-venir/composer/composer-shell.tsx';
if(process.argv[2]==='restore') {
  const originals=JSON.parse(fs.readFileSync(backup,'utf8'));
  for(const [file,bytes]of Object.entries(originals.files))fs.writeFileSync(path.join(root,file),Buffer.from(bytes,'base64'));
  for(const file of originals.created)fs.unlinkSync(path.join(root,file));
  fs.unlinkSync(backup);console.log('P14_P1_PROBES_RESTORED');
} else if(process.argv[2]==='apply') {
  if(fs.existsSync(backup)||fs.existsSync(helper)||fs.existsSync(actions))throw Error('P14_P1_PROBES_ALREADY_PRESENT');
  const originals={files:{},created:[helper,actions]}, changed=[];
  for(const file of [...targets.map(t=>t[0]),page,shell])originals.files[file]=fs.readFileSync(path.join(root,file)).toString('base64');
  fs.writeFileSync(backup,JSON.stringify(originals));
  try {
    fs.writeFileSync(helper,helperSource);
    fs.writeFileSync(actions,'"use server";\nexport async function p14ReadOnlyTransport(): Promise<never> { throw new Error("P14_P1_PREVIEW_READ_ONLY"); }\n');
    for(const [file,names]of targets){
      const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),edits=[],found=[];
      const visit=node=>{
        if((ts.isFunctionDeclaration(node)||ts.isMethodDeclaration(node))&&node.body&&node.name&&names[node.name.getText(ast)]) {
          const label=names[node.name.getText(ast)];found.push(node.name.getText(ast));
          edits.push([node.body.getStart(ast)+1,node.body.getEnd()-1,`\nconst p14End=p14Start(${JSON.stringify(label)});\ntry {${source.slice(node.body.getStart(ast)+1,node.body.getEnd()-1)}\n} finally {p14End();}\n`]);return;
        }
        ts.forEachChild(node,visit);
      };visit(ast);
      for(const name of Object.keys(names))if(!found.includes(name))throw Error('PROBE_FUNCTION_MISSING:'+file+':'+name);
      let result=source;for(const [start,end,text]of edits.sort((a,b)=>b[0]-a[0]))result=result.slice(0,start)+text+result.slice(end);
      result='import { p14Start } from "@/server/phase2/planner/p14-p1-probe";\n'+result;
      fs.writeFileSync(file,result);changed.push(file);
    }
    let source=fs.readFileSync(page,'utf8');
    source=source.replace('export default async function ComposerPage','async function ComposerPageMeasured');
    source=source.replace('return <ComposerShell initialModel={model}', 'p14Model(model);\n  return <ComposerShell initialModel={model}');
    source=source.replace('transport={composerInteraction}','transport={p14ReadOnlyTransport}');
    source=source.replace(/draftTransport=\{drafts \? \{[\s\S]*?: null\}/u,'draftTransport={null}');
    source='import { p14Probe, p14Model } from "@/server/phase2/planner/p14-p1-probe";\nimport { p14ReadOnlyTransport } from "./p14-p1-readonly-actions";\n'+source;
    source+='\nexport default async function ComposerPage(props:Parameters<typeof ComposerPageMeasured>[0]) {\n  const {value,metrics}=await p14Probe(()=>ComposerPageMeasured(props));\n  return <>{value}<span hidden data-p14-p1={JSON.stringify(metrics)} /></>;\n}\n';
    fs.writeFileSync(page,source);
    source=fs.readFileSync(shell,'utf8');
const mark=String.raw`  useEffect(()=>{let frame=requestAnimationFrame(()=>{if(!performance.getEntriesByName('p14-board-usable').length)performance.mark('p14-board-usable');
      if(previewStatus==='FRESH'&&!performance.getEntriesByName('p14-preview-fresh').length)performance.mark('p14-preview-fresh');
      const board=document.querySelector('[data-composer]'),nav=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined;
      if(board)board.setAttribute('data-p14-browser',JSON.stringify({boardMs:performance.getEntriesByName('p14-board-usable')[0]?.startTime,
        freshMs:performance.getEntriesByName('p14-preview-fresh')[0]?.startTime,
        navigation:nav?{type:nav.type,requestStart:nav.requestStart,responseStart:nav.responseStart,responseEnd:nav.responseEnd,domInteractive:nav.domInteractive,
          transferSize:nav.transferSize,encodedBodySize:nav.encodedBodySize}:null}));
      });return()=>cancelAnimationFrame(frame);},[previewStatus]);
`;
    source=source.replace('  return <ComposerInteractionContext.Provider',mark+'  return <ComposerInteractionContext.Provider');
    fs.writeFileSync(shell,source);
    const hashes=Object.fromEntries([...targets.map(t=>t[0]),helper,actions,page,shell].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
    console.log(JSON.stringify({status:'PROBES_APPLIED_READ_ONLY',files:hashes}));
  }catch(error){
    for(const [file,bytes]of Object.entries(originals.files))fs.writeFileSync(file,Buffer.from(bytes,'base64'));
    for(const file of originals.created)if(fs.existsSync(file))fs.unlinkSync(file);
    fs.unlinkSync(backup);throw error;
  }
} else throw Error('Usage: apply|restore');
