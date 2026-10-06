// Creates a disposable COPY, never edits the product checkout. No optimizations.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const repo=process.cwd(), target=path.resolve(process.argv[2]??'');
const inside=(parent,child)=>{const relative=path.relative(parent,child);return !relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));};
if(inside(repo,target)||inside(target,repo))throw new Error('Runtime must be outside the product checkout');
if(process.argv[3]==='--refresh-probes'&&(!fs.existsSync(path.join(target,'audit-instrumentation.json'))||fs.existsSync(path.join(target,'.git'))))throw new Error('Refresh requires a marked disposable runtime without Git');
if(!process.argv[2] || fs.existsSync(target)&&process.argv[3]!=='--refresh-probes') throw new Error('Fresh absolute runtime directory required');
if(!fs.existsSync(target)) {
fs.mkdirSync(target,{recursive:true});
const excluded=new Set(['.git','.next','node_modules','outputs','.vercel']);
for(const entry of fs.readdirSync(repo,{withFileTypes:true})) {
  if(excluded.has(entry.name)||entry.name.startsWith('.env')) continue;
  fs.cpSync(path.join(repo,entry.name),path.join(target,entry.name),{recursive:true});
}
fs.symlinkSync(path.join(repo,'node_modules'),path.join(target,'node_modules'),'junction');
// Local env stays outside Git and is used only by this private runtime.
if(fs.existsSync(path.join(repo,'.env.local'))) fs.copyFileSync(path.join(repo,'.env.local'),path.join(target,'.env.local'));
}
const ts=createRequire(import.meta.url)('typescript');
const selected=/^src\/server\/(phase2\/|bootstrap\/|canonical\/repository|analytics\/.*(persona|mobility))|^src\/analytics\/global-v2\/mobility-context\.ts$|^src\/app\/mois-a-venir\/composer\/(page|runtime)\.tsx?$|^src\/lib\/supabase\/proxy/;
const files=execFileSync('git',['ls-files','src'],{cwd:repo,encoding:'utf8'}).trim().split(/\r?\n/).filter(f=>selected.test(f));
const summary=[];
for(const file of files){
  if(!/\.tsx?$/.test(file))continue;
  const filename=path.join(target,file), code=fs.readFileSync(path.join(repo,file),'utf8'), source=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true), edits=[];
  function visit(node){
    if((ts.isFunctionDeclaration(node)||ts.isMethodDeclaration(node))&&node.body&&!node.asteriskToken&&node.name){
      const name=node.name.getText(source), length=node.body.end-node.body.pos;
      const worth=(ts.isMethodDeclaration(node)||/^(read|load|resolve|build|derive|compile|evaluate|publish|query|authorized|get|preview|handle|assemble|prepare|materialize|createPlanner|composerUiModel|marginal)/.test(name))
        &&(length>450||/^(queryRows|cached|readRows|authorizedPlanner|Page|readActivePlan|readWorld|prepareWorld)$/.test(name));
      if(worth&&name!=='constructor'){
        const async=!!node.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword), start=node.body.getStart(source);
        edits.push({at:start+1,text:` return __composerAuditSpan(${JSON.stringify(file+':'+name)}, ${async?'async ':''}()=>{`},{at:node.body.end-1,text:' }); '});
        summary.push({file,name,async});
      }
    }
    ts.forEachChild(node,visit);
  }visit(source);
  if(edits.length){
    let instrumented=code;
    for(const edit of edits.sort((a,b)=>b.at-a.at))instrumented=instrumented.slice(0,edit.at)+edit.text+instrumented.slice(edit.at);
    instrumented+='\nfunction __composerAuditSpan<T>(name:string, run:()=>T):T { return (globalThis as unknown as {__composerPerf?:(name:string,run:()=>T)=>T}).__composerPerf?.(name,run) ?? run(); }\n';
    // Nullish result fallback would repeat null-returning functions: use explicit presence.
    instrumented=instrumented.replace('return (globalThis as unknown as {__composerPerf?:(name:string,run:()=>T)=>T}).__composerPerf?.(name,run) ?? run();','const hook=(globalThis as unknown as {__composerPerf?:(name:string,run:()=>T)=>T}).__composerPerf; return hook ? hook(name,run) : run();');
    fs.writeFileSync(filename,instrumented);
  }
}
fs.writeFileSync(path.join(target,'audit-instrumentation.json'),JSON.stringify({baseSha:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),summary},null,2));
console.log(JSON.stringify({target,functions:summary.length,files:new Set(summary.map(s=>s.file)).size}));
