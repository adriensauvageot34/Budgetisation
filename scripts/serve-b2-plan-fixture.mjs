// Local, read-only browser host. All Plan writes are confined to in-memory PGlite.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {persistedCase,cases} from './fixtures/b2-plan.mjs';
globalThis.fetch=async()=>{throw Error('B2_FIXTURE_NETWORK_FORBIDDEN');};
const require=createRequire(import.meta.url), out=path.resolve('outputs/b2-plan-browser'); fs.mkdirSync(out,{recursive:true});
const {build}=await import(process.env.PLANNER_BROWSER_TOOLS ? pathToFileURL(path.join(process.env.PLANNER_BROWSER_TOOLS,'node_modules/esbuild/lib/main.js')).href : 'esbuild');
await build({entryPoints:['scripts/lib/b2-plan-browser-entry.tsx'],bundle:true,format:'esm',target:'chrome120',jsx:'automatic',minify:true,
  define:{'process.env.NODE_ENV':'"production"'},banner:{js:'const process={env:{}};'},outfile:path.join(out,'app.js'),loader:{'.css':'local-css'},external:['/planned-visuals/*'],
  plugins:[{name:'fixture-boundaries',setup(b){
    b.onResolve({filter:/^\.\/month-control-center$/},()=>({path:'month-control-link',namespace:'fixture'}));
    b.onLoad({filter:/^month-control-link$/,namespace:'fixture'},()=>({contents:'import React from "react";import material from "@/app/mois-a-venir/month-material.module.css";import styles from "@/app/mois-a-venir/month-control-center.module.css";export function MonthControlLink({children,className}){return React.createElement("button",{className:(className??material.clayButton+" px-4 py-2 text-sm font-bold")+(children===undefined?" "+styles.controlTrigger:""),disabled:true,title:"Propriétaire externe : testé séparément en Preview authentifiée"},children??"Centre de contrôle")} ',loader:'js',resolveDir:process.cwd()}));
    b.onResolve({filter:/^(next\/navigation|next\/link)$|^\.\/(actions|planned-expenses-actions)$/},a=>({path:a.path,namespace:'fixture'}));
    b.onLoad({filter:/^(next|\.\/)/,namespace:'fixture'},a=>({contents:a.path==='next/link'?'import React from "react"; export default function Link(p){return React.createElement("a",p)}':a.path==='next/navigation'?'export const useRouter=()=>({refresh(){},push(){throw Error("FIXTURE_NAVIGATION_ONLY")}});export const usePathname=()=>"/mois-a-venir";export const useSearchParams=()=>new URLSearchParams();':'export const previewMonthChoice=deny,updateMonthInputs=deny,confirmPlannedExpenseReality=deny,restorePlannedExpenseAction=deny,reportPlannedExpenseAction=deny,estimatePlannedRoute=deny,previewMonthControlCenter=deny,applyMonthChoice=deny,undoMonthChoice=deny,updateMonthControlInputs=deny,previewPlannedExpense=deny,removePlannedExpense=deny,savePlannedExpense=deny;function deny(){throw Error("FIXTURE_WRITES_DISABLED")}',loader:'js',resolveDir:process.cwd()}));
  }}]});
const postcss=require('postcss'),tw=require('@tailwindcss/postcss');
const css=await postcss([tw()]).process(fs.readFileSync('src/app/globals.css','utf8'),{from:path.resolve('src/app/globals.css')});
fs.writeFileSync(path.join(out,'global.css'),css.css);
const data=new Map();
async function get(key){if(!data.has(key))data.set(key, persistedCase(key));return data.get(key);}
const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1'),key=cases.includes(url.searchParams.get('case'))?url.searchParams.get('case'):'A';
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  if(url.pathname.startsWith('/planned-visuals/') && /^[a-zA-Z0-9_.-]+$/.test(path.basename(url.pathname))){res.end(fs.readFileSync(path.join('public/planned-visuals',path.basename(url.pathname))));return;}
  if(['/app.js','/app.css','/global.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(out,path.basename(url.pathname))));return;}
  const value=await get(key);res.setHeader('Cache-Control','no-store');
  if(url.pathname==='/proof'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value.proof));return;}
  res.setHeader('Content-Type','text/html;charset=utf-8');
  res.end(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>B2 · Mon Plan · Fixture isolée</title><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/app.css"><style>body{margin:0;background:#f5f3f8}main{max-width:1360px;margin:auto;padding:20px}h1{text-align:center}svg{max-width:100%}</style></head><body><div id="root"></div><script id="fixture" type="application/json">${JSON.stringify(value).replaceAll('<','\\u003c')}</script><script type="module" src="/app.js"></script></body></html>`);
}catch(e){console.error(e);res.writeHead(500);res.end('Fixture failed: '+e.message);}});
server.listen(3192,'127.0.0.1',()=>console.log('B2 isolated Plan browser: http://127.0.0.1:3192/?case=A'));
