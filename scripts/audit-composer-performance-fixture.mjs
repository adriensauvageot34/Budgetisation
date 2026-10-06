// Production React fixture and visual counterfactual in the disposable copy only.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const [runtime,out,variant='baseline',port='3118']=process.argv.slice(2),repo=process.cwd();
if(!runtime||!out||path.resolve(runtime)===repo||!fs.existsSync(path.join(runtime,'audit-instrumentation.json')))throw new Error('ISOLATED_RUNTIME_REQUIRED');
if(!['baseline','clay-neutral'].includes(variant))throw new Error('INVALID_FIXTURE_VARIANT');
const frame=path.normalize('src/app/mois-a-venir/composer/planner-icons/clay-frame.tsx');
fs.copyFileSync(path.join(repo,frame),path.join(runtime,frame));
if(variant==='clay-neutral')fs.writeFileSync(path.join(runtime,frame),'import type {ReactNode} from "react"; export type ClayIconProps={size?:number;className?:string}; export function ClayFrame({size=52,className}:ClayIconProps & {children:ReactNode}) {return <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true" data-clay-icon><circle cx="32" cy="32" r="22" fill="#ded8ec"/></svg>;}');
const ts=createRequire(import.meta.url)('typescript'),renderFiles=[];
function instrument(directory){for(const entry of fs.readdirSync(path.join(repo,directory),{withFileTypes:true})){
 const file=path.join(directory,entry.name);if(entry.isDirectory()){instrument(file);continue;}if(!file.endsWith('.tsx'))continue;
 if(file!==frame)fs.copyFileSync(path.join(repo,file),path.join(runtime,file));
 let source=fs.readFileSync(path.join(runtime,file),'utf8');const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),edits=[];
 function visit(n){if(ts.isFunctionDeclaration(n)&&n.body&&n.name&&/^[A-Z]/.test(n.name.text))edits.push({at:n.body.getStart(sf)+1,text:`const auditRoot=(globalThis as unknown as {__composerAuditRenders?:Record<string,number>});const auditRenders=auditRoot.__composerAuditRenders??={};auditRenders[${JSON.stringify(n.name.text)}]=(auditRenders[${JSON.stringify(n.name.text)}]??0)+1;`});ts.forEachChild(n,visit);}visit(sf);
 if(edits.length){for(const edit of edits.sort((a,b)=>b.at-a.at))source=source.slice(0,edit.at)+edit.text+source.slice(edit.at);fs.writeFileSync(path.join(runtime,file),source);renderFiles.push(file);}
}}
instrument('src/app/mois-a-venir/composer');
const browserEntry='scripts/lib/planner-composer-browser-entry.tsx';
fs.writeFileSync(path.join(runtime,browserEntry),fs.readFileSync(path.join(repo,browserEntry),'utf8').replace('createRoot(document', '(window as unknown as {__composerAuditDataReady:number}).__composerAuditDataReady=performance.now();\ncreateRoot(document'));
let host=fs.readFileSync(path.join(repo,'scripts/serve-phase2-planner-composer-fixture.mjs'),'utf8');
host=host.replace("outfile: path.join(out, 'app.js'), loader:","define: {'process.env.NODE_ENV': '\"production\"'}, outfile: path.join(out, 'app.js'), loader:");
host=host.replace("fs.readdirSync('.next/static/chunks')",'fs.readdirSync('+JSON.stringify(path.join(repo,'.next/static/chunks'))+')')
 .replace("fs.readFileSync(`.next/static/chunks/${n}`,'utf8')",'fs.readFileSync('+JSON.stringify(path.join(repo,'.next/static/chunks'))+"+'/'+n,'utf8')");
const filename=path.join(runtime,'scripts/audit-private-fixture-host.mjs');fs.writeFileSync(filename,host);
if(variant==='clay-neutral'&&fs.readFileSync(path.join(runtime,frame),'utf8').includes('matte-sculpture'))throw new Error('CLAY_COUNTERFACTUAL_NOT_APPLIED');
const child=spawn(process.execPath,[filename],{cwd:runtime,windowsHide:true,stdio:'inherit',env:{...process.env,PORT:port,PLANNER_C8_BROWSER_OUTPUT:out,PLANNER_BROWSER_TOOLS:'C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/work/browser-tools'}});
function restore(){for(const file of [...renderFiles,frame,browserEntry])fs.copyFileSync(path.join(repo,file),path.join(runtime,file));}
process.on('SIGINT',()=>child.kill('SIGINT'));process.on('SIGTERM',()=>child.kill());
child.on('exit',code=>{restore();process.exitCode=code??1;});
