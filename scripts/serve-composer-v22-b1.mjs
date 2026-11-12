import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { readMonthFixture } from './fixtures/composer-v22-b1.mjs';
import { budgetImpactFixture } from './fixtures/composer-budget-impact.mjs';
import { householdId } from './fixtures/planner-headless.mjs';
import { require } from './lib/phase2-ts-loader.mjs';
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
globalThis.fetch = async () => { throw Error('B1_REMOTE_NETWORK_FORBIDDEN'); };
const output = path.resolve(process.env.B1_BROWSER_OUTPUT ?? '../b1-browser');
fs.mkdirSync(output, { recursive: true });
const { build } = await import(process.env.PLANNER_BROWSER_TOOLS
  ? pathToFileURL(path.join(process.env.PLANNER_BROWSER_TOOLS, 'node_modules/esbuild/lib/main.js')).href : 'esbuild');
const mocks = {
  'next/link': 'import React from "react";export default function Link({children,...props}){return React.createElement("a",props,children);}',
  'next/navigation': 'export const usePathname=()=>"/mois-a-venir/composer";',
  '@/components/runtime': 'import {useRef} from "react";export function useProductRuntime(){return{backgroundRootRef:useRef(null)}}',
  '@/features/auth/sign-out-button': 'export const SignOutButton=()=>null;',
};
if(process.env.B1_PREBUILT!=='1')await build({ entryPoints:['scripts/lib/composer-v22-b1-browser-entry.tsx'],outdir:output,entryNames:'app',chunkNames:'chunks/[name]-[hash]',
  bundle:true,splitting:true,format:'esm',target:'chrome120',jsx:'automatic',loader:{'.css':'local-css'},
  define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_COMPOSER_P14_P2_INTERACTIONS':'"1"',
    'process.env.NEXT_PUBLIC_COMPOSER_P14_P4A_PAGES':'"neighbors"'},external:['/planned-visuals/*'],plugins:[{name:'synthetic-host',setup(builder){
    builder.onResolve({filter:/^(next\/link|next\/navigation|@\/components\/runtime|@\/features\/auth\/sign-out-button)$/},args=>({path:args.path,namespace:'b1-host'}));
    builder.onLoad({filter:/.*/,namespace:'b1-host'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));
  }}] });
if (!process.env.B1_GLOBAL_CSS) throw Error('B1_GLOBAL_CSS_REQUIRED: use an existing compiled application stylesheet; no live app build.');
fs.copyFileSync(process.env.B1_GLOBAL_CSS,path.join(output,'global.css'));
if(process.env.B1_BUILD_ONLY==='1')process.exit(0);
const cache = new Map(), evidence = { reads:0,rejectedMutations:0,sqlCalls:0,writers:0,remoteCalls:0 };
const impactCache = new Map();
function impactFor(url) {
  const scenario = url.searchParams.get('impact');
  if (!['covered', 'partial', 'blocked', 'retry'].includes(scenario)) return null;
  if (!impactCache.has(scenario)) impactCache.set(scenario, budgetImpactFixture({
    groceriesAmount: scenario === 'partial' ? '5.00' : null, monthlyDeclarations: scenario !== 'blocked',
  }));
  return impactCache.get(scenario);
}
async function modelFor(url) {
  const impact = impactFor(url);
  if (impact) return (await impact).model;
  const month=url.searchParams.get('month')==='2026-10'?'2026-10':'2026-11',dense=url.searchParams.get('dense')==='1',unknown=url.searchParams.get('unknown')==='1';
  const key=JSON.stringify({month,dense,unknown});
  if(!cache.has(key))cache.set(key,readMonthFixture(month,dense,unknown));
  const fixture=await cache.get(key); if(fixture.writes.length)throw Error('B1_UNEXPECTED_WRITE');
  return fixture.model;
}
const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>B1 · Composer synthétique</title><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>';
const server=http.createServer(async(request,response)=>{
  response.setHeader('Cache-Control','no-store');
  response.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; object-src 'none'");
  try{
    const url=new URL(request.url,'http://127.0.0.1');
    if(request.method==='POST'){
      let text='';for await(const chunk of request){text+=chunk;if(text.length>1000000)throw Error('B1_REQUEST_TOO_LARGE');}
      const command=JSON.parse(text);
      const from = new URL(request.headers.referer ?? url);
      const impact = impactFor(from);
      if (url.pathname === '/read' && command.kind === 'READ' && impact) {
        const fixture = await impact;
        evidence.reads++;
        response.setHeader('Content-Type','application/json');
        if (from.searchParams.get('impact') === 'retry' && !evidence.previewFailures) {
          evidence.previewFailures = 1;
          response.end(JSON.stringify({ ok: false, sequence: command.sequence, code: 'COMPOSER_UNAVAILABLE', message: 'Simulation temporairement indisponible.' }));
          return;
        }
        const result = await handleComposerRequest(fixture.deps, householdId, command);
        if (fixture.writes.length) throw Error('B1_UNEXPECTED_WRITE');
        response.end(JSON.stringify(result));
        return;
      }
      evidence.rejectedMutations++;
      response.setHeader('Content-Type','application/json');response.end(JSON.stringify({ok:false,sequence:command.sequence,code:'B1_READ_ONLY_FIXTURE',message:'Fixture de consultation : aucune mutation ou sauvegarde admise.'}));return;
    }
    if(url.pathname==='/model'){evidence.reads++;response.setHeader('Content-Type','application/json');response.end(JSON.stringify(await modelFor(url)));return;}
    if(url.pathname==='/evidence'){response.setHeader('Content-Type','application/json');response.end(JSON.stringify(evidence));return;}
    if(['/app.js','/app.css','/global.css'].includes(url.pathname)||/^\/chunks\/[a-zA-Z0-9_-]+\.(js|css)$/.test(url.pathname)){
      response.setHeader('Content-Type',url.pathname.endsWith('.css')?'text/css':'application/javascript');response.end(fs.readFileSync(path.join(output,url.pathname.slice(1))));return;
    }
    if(url.pathname.startsWith('/planned-visuals/')){
      const file=path.resolve('public',`.${url.pathname}`),allowed=path.resolve('public','planned-visuals')+path.sep;
      if(!file.startsWith(allowed)||!file.endsWith('.webp')){response.writeHead(404);response.end();return;}
      if(fs.existsSync(file)){response.setHeader('Content-Type','image/webp');response.end(fs.readFileSync(file));return;}
      response.writeHead(404);response.end();return;
    }
    response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html);
  }catch(error){response.writeHead(500);response.end('Synthetic fixture failed');console.error(error.message);}
});
server.listen(Number(process.env.PORT??3118),'127.0.0.1',()=>console.log(`B1 synthetic read-only Composer: http://127.0.0.1:${server.address().port}/mois-a-venir/composer · SQL=0 writers=0 remote=0`));
process.on('SIGINT',()=>server.close(()=>process.exit()));
