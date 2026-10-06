// Counterfactual patches ONLY the disposable runtime; reset before each variant.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const [runtime,variant='baseline']=process.argv.slice(2),repo=process.cwd();
if(!runtime||path.resolve(runtime)===repo||!fs.existsSync(path.join(runtime,'audit-instrumentation.json')))throw new Error('ISOLATED_RUNTIME_REQUIRED');
const valid=new Set(['baseline','instant-memo','zone-memo','combined','recompile-empty']);if(!valid.has(variant))throw new Error('UNKNOWN_EXPERIMENT');
const ts=createRequire(import.meta.url)('typescript');
for(const file of ['src/analytics/global-v2/mobility-context.ts','src/core/time/values.ts'])fs.copyFileSync(path.join(repo,file),path.join(runtime,file));
function modify(file,transform){const target=path.join(runtime,file);fs.writeFileSync(target,transform(fs.readFileSync(target,'utf8')));}
function replaceBody(code,name,transform){const sf=ts.createSourceFile('audit.ts',code,ts.ScriptTarget.Latest,true);const node=sf.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);if(!node?.body)throw new Error('AUDIT_FUNCTION_MISSING:'+name);const start=node.body.getStart(sf),end=node.body.end;return code.slice(0,start)+transform(code.slice(start+1,end-1))+code.slice(end);}
if(variant==='instant-memo'||variant==='combined')modify('src/analytics/global-v2/mobility-context.ts',code=>{
 code=replaceBody(code,'instant',()=>`{const found=__auditInstantMemo?.get(value);if(found)return found;const parserCounts=(globalThis as any).__auditWorkCounts;if(parserCounts)parserCounts.instantParses=(parserCounts.instantParses??0)+1;const result=Temporal.Instant.from(value);__auditInstantMemo?.set(value,result);return result;}`);
 code=replaceBody(code,'buildGlobalM7MobilityContextAuthority',body=>`{const prior=__auditInstantMemo;__auditInstantMemo=new Map();try {${body}}finally{__auditInstantMemo=prior;}}`);
 return code+'\nlet __auditInstantMemo: Map<string,Temporal.Instant>|null=null;\n';
});
if(variant==='zone-memo'||variant==='combined')modify('src/core/time/values.ts',code=>replaceBody(code,'parseHouseholdTimeZone',body=>`{const cache=(globalThis as unknown as {__auditZoneMemo?:Set<unknown>}).__auditZoneMemo;if(cache?.has(value))return value as HouseholdTimeZone;${body.replace('return value as HouseholdTimeZone;','cache?.add(value);return value as HouseholdTimeZone;')}}`));
if(variant==='recompile-empty')modify('src/server/phase2/planner/preview.ts',code=>code.replace('const baselineCompiled = compileSemanticPlan(', 'const baselineCompiled = state.controls.length===0 && state.contexts.length===0 ? compiled : compileSemanticPlan(')
 .replace('baselineScenario = deriveCompiledMonthScenario(world, baselineCompiled);','baselineScenario = baselineCompiled === compiled ? scenario : deriveCompiledMonthScenario(world, baselineCompiled);'));
if(variant==='baseline'){
 // Restore experimental copies, retaining only the probes selected by the runtime creator.
 fs.copyFileSync(path.join(repo,'src/server/phase2/planner/preview.ts'),path.join(runtime,'src/server/phase2/planner/preview.ts'));
}
modify('src/analytics/global-v2/mobility-context.ts',code=>{
 code=replaceBody(code,'instant',body=>`{const c=(globalThis as any).__auditWorkCounts;if(c)c.instantCalls=(c.instantCalls??0)+1;${body}}`);
 code=replaceBody(code,'overlaps',body=>`{const c=(globalThis as any).__auditWorkCounts;if(c)c.overlapCalls=(c.overlapCalls??0)+1;${body}}`);
 code=replaceBody(code,'buildGlobalM7MobilityContextAuthority',body=>`{const run=()=>{${body}};const hook=(globalThis as any).__composerPerf;return hook?hook('audit:mobility-context-builder',run):run();}`);
 return code;
});
modify('src/core/time/values.ts',code=>replaceBody(code,'parseHouseholdTimeZone',body=>`{const c=(globalThis as any).__auditWorkCounts;if(c)c.zoneCalls=(c.zoneCalls??0)+1;${body.replace('new Intl.DateTimeFormat(', 'if(c)c.zoneValidations=(c.zoneValidations??0)+1;new Intl.DateTimeFormat(')}}`));
for(const file of ['src/analytics/global-v2/mobility-context.ts','src/core/time/values.ts','src/server/phase2/planner/preview.ts'])new vm.Script(ts.transpileModule(fs.readFileSync(path.join(runtime,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{filename:file});
console.log(JSON.stringify({variant,runtime,productChanged:false}));
