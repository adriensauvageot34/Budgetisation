// Diagnostic copies only. A differs from B only by the pinned pre-index M7 source.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
const [target,variant]=process.argv.slice(2);
if(!target||!['a','b'].includes(variant))throw new Error('FRESH_RUNTIME_AND_A_OR_B_REQUIRED');
execFileSync(process.execPath,['scripts/audit-composer-performance-runtime.mjs',target],{stdio:'inherit',windowsHide:true});
function wrap(file,names){const full=path.join(target,file),code=fs.readFileSync(full,'utf8'),source=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true),edits=[];
 for(const node of source.statements)if(ts.isFunctionDeclaration(node)&&names.includes(node.name?.text)&&node.body){
  if(node.body.getText(source).includes('return __composerAuditSpan('))continue;
  const async=!!node.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword);
  edits.push([node.body.getStart(source)+1,`return __navigationAudit(${JSON.stringify(file+':'+node.name.text)},${async?'async ':''}()=>{`],[node.body.end-1,'});']);
 }
 let result=code;for(const[at,text]of edits.sort((a,b)=>b[0]-a[0]))result=result.slice(0,at)+text+result.slice(at);
 if(edits.length)result+='\nfunction __navigationAudit<T>(name:string,run:()=>T):T {const hook=(globalThis as unknown as {__composerPerf?:(name:string,run:()=>T)=>T}).__composerPerf;return hook?hook(name,run):run();}\n';
 fs.writeFileSync(full,result);
}
if(variant==='a'){
 const old=JSON.parse(fs.readFileSync('scripts/fixtures/m7-presence-bruteforce-source.json','utf8'));
 if(old.gitRef!=='47a59e0fda43f39e2107bbcde33091a27fb3ebdd'||crypto.createHash('sha256').update(old.source).digest('hex')!==old.sha256)throw new Error('PINNED_P2A_SOURCE_HASH_REQUIRED');
 fs.writeFileSync(path.join(target,'src/analytics/global-v2/mobility-context.ts'),old.source);
 wrap('src/analytics/global-v2/mobility-context.ts',['buildGlobalM7MobilityContextAuthority','resolvePairwisePresence']);
}
wrap('src/app/mois-a-venir/actions.ts',['previewMonthControlCenter']);
wrap('src/app/mois-a-venir/page.tsx',['MonthForecastPage']);
// Junction dependency resolves outside the disposable copy. Same bundler in A/B.
fs.writeFileSync(path.join(target,'next.config.mjs'),`export default {turbopack:{root:${JSON.stringify(path.resolve(process.cwd(),'../../../..'))}}};\n`);
fs.writeFileSync(path.join(target,'navigation-audit.json'),JSON.stringify({variant,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),oldM7:variant==='a',businessWrites:false},null,2));
console.log(JSON.stringify({variant,target,productCheckoutChanged:false}));
