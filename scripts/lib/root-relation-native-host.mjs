import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import crypto from 'node:crypto';import {pathToFileURL}from'node:url';
import{require}from'./phase2-ts-loader.mjs';import{createRootNativeRecipe}from'./root-relation-native-recipe.mjs';
const{rootRelationDurableHttp}=require('@/server/phase2/planner/root-relation-durable-http');
const{rootRelationPost}=require('@/server/phase2/planner/root-relation-http');
const{readRootRelationDurableDrafts}=require('@/server/phase2/planner/root-relation-durable-service');
const{rootRelationFinancialReadSnapshot}=require('@/domain/phase2/planner/root-relation-durable-contract');
const{handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const{readComposerDrafts,saveComposerDraft,changeComposerDraftLifecycle}=require('@/server/phase2/planner/composer-draft-service');
const{BootstrapAuthenticationRequiredError}=require('@/server/bootstrap/errors');
export async function startRootRelationNativeHost({port=0,build=false}={}){
 process.env.COMPOSER_ROOT_RELATIONS_ENABLED='true';process.env.COMPOSER_ROOT_RELATIONS_DURABLE_SAVE_ENABLED='true';
 const fixture=await createRootNativeRecipe(),events=[],sessions=new Map(),fault={loseNext:false,delayMs:0,readDelayMs:0};
 const output=path.resolve('../p-grp-n1-c-b-final/browser');fs.mkdirSync(output,{recursive:true});
 if(build){
  const{build:bundle}=await import(process.env.PLANNER_BROWSER_TOOLS?pathToFileURL(path.join(process.env.PLANNER_BROWSER_TOOLS,'node_modules/esbuild/lib/main.js')).href:'esbuild');
  const mocks={'next/link':'import React from "react";export default function Link({children,...props}){return React.createElement("a",props,children);}',
   'next/navigation':'export const usePathname=()=>"/mois-a-venir/composer";',
   '@/components/runtime':'import{useRef}from"react";export function useProductRuntime(){return{backgroundRootRef:useRef(null)}}',
   '@/features/auth/sign-out-button':'export const SignOutButton=()=>null;'};
  await bundle({entryPoints:['scripts/lib/root-relation-browser-entry.tsx'],outdir:output,entryNames:'app',chunkNames:'chunks/[name]-[hash]',
   bundle:true,splitting:true,format:'esm',target:'chrome120',jsx:'automatic',loader:{'.css':'local-css'},
   define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_COMPOSER_P14_P2_INTERACTIONS':'"1"','process.env.NEXT_PUBLIC_COMPOSER_P14_P4A_PAGES':'"neighbors"'},
   external:['/planned-visuals/*'],plugins:[{name:'synthetic-navigation-only',setup(builder){
    builder.onResolve({filter:/^(next\/link|next\/navigation|@\/components\/runtime|@\/features\/auth\/sign-out-button)$/},args=>({path:args.path,namespace:'n1-host'}));
    builder.onLoad({filter:/.*/,namespace:'n1-host'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));}}]});
  if(!process.env.N1_RECIPE_GLOBAL_CSS)throw Error('N1_RECIPE_GLOBAL_CSS_REQUIRED');
  fs.copyFileSync(process.env.N1_RECIPE_GLOBAL_CSS,path.join(output,'global.css'));
 }
 const newSession=(user=fixture.actor,household=fixture.householdId)=>{const token=crypto.randomBytes(24).toString('hex');sessions.set(token,{user,household});return token;};
 const authorize=async(request)=>{const token=request.headers.get('cookie')?.match(/(?:^|;\s*)n1_recipe_session=([a-f0-9]+)/)?.[1],session=sessions.get(token);
  if(!session)throw new BootstrapAuthenticationRequiredError();return fixture.scope(session.user,session.household);};
 const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>N1-C-B · Recette synthétique locale</title><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>';
 const server=http.createServer(async(req,res)=>{
  try{
   const origin=`http://127.0.0.1:${server.address().port}`,url=new URL(req.url,origin),chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>1_200_000)throw Error('RECIPE_TOO_LARGE');chunks.push(chunk);}
   const request=new Request(url,{method:req.method,headers:req.headers,...req.method==='POST'?{body:Buffer.concat(chunks)}:{}});
   let response;
   if(url.pathname==='/api/composer/root-relation-drafts')response=await rootRelationDurableHttp(request,()=>authorize(request));
   else if(url.pathname==='/api/composer/root-relations')response=await rootRelationPost(request,async()=>{
    const scope=await authorize(request);return{...scope.admission,readDrafts:async month=>rootRelationFinancialReadSnapshot(await readRootRelationDurableDrafts(scope,month))};
   });
   else if(url.pathname==='/read'){
    const scope=await authorize(request),command=JSON.parse(await request.text());
    if(['APPLY','CHECK_APPLY','RECONCILE_APPLY'].includes(command.kind))throw Error('RECIPE_APPLY_FORBIDDEN');
    response=Response.json(await handleComposerRequest(scope.admission.deps,scope.householdId,command));
   }else if(url.pathname==='/api/composer/drafts'){
    const scope=await authorize(request);let result;
    if(request.method==='GET')result=await readComposerDrafts(scope,url.searchParams.get('month'));
    else{const body=JSON.parse(await request.text());result=body.kind==='SAVE'?await saveComposerDraft(scope,body.command):await changeComposerDraftLifecycle(scope,body.kind,body.command);}
    response=Response.json(result,{headers:{'X-Composer-Draft-Contract':'composer-draft-http@1'}});
   }else if(url.pathname==='/evidence'){
    await authorize(request);response=Response.json({database:fixture.database,events,rows:await fixture.rows()});
   }else if(/^\/(app\.(js|css)|global\.css|chunks\/[a-zA-Z0-9_-]+\.(js|css))$/.test(url.pathname)){
    response=new Response(fs.readFileSync(path.join(output,url.pathname.slice(1))),{headers:{'Content-Type':url.pathname.endsWith('.css')?'text/css':'application/javascript'}});
   }else if(url.pathname.startsWith('/planned-visuals/')){
    const file=path.resolve('public','.'+url.pathname),allowed=path.resolve('public/planned-visuals')+path.sep;
    response=file.startsWith(allowed)&&file.endsWith('.webp')&&fs.existsSync(file)?new Response(fs.readFileSync(file),{headers:{'Content-Type':'image/webp'}}):new Response(null,{status:404});
   }else{
    const token=newSession();response=new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Set-Cookie':`n1_recipe_session=${token}; HttpOnly; SameSite=Strict; Path=/`}});
   }
   const bytes=Buffer.from(await response.arrayBuffer()),isSave=url.pathname==='/api/composer/root-relation-drafts'&&req.method==='POST';
   let receipt;try{if(response.headers.get('content-type')?.includes('application/json'))receipt=JSON.parse(bytes.toString('utf8'));}catch{}
   events.push({path:url.pathname,method:req.method,status:response.status,code:receipt?.code,
    ...(isSave&&response.status===200?{phase:'SQL_COMMITTED_RECEIPT',draftId:receipt.draft.draftId,version:receipt.draft.version,digest:receipt.draft.digest,replayed:receipt.replayed}:{})});
   if(events.length>500)events.shift();
   if(isSave&&response.status===200&&fault.loseNext){fault.loseNext=false;res.destroy();return;}
   if(isSave&&response.status===200&&fault.delayMs){const wait=fault.delayMs;fault.delayMs=0;await new Promise(resolve=>setTimeout(resolve,wait));}
   if(url.pathname==='/api/composer/root-relation-drafts'&&req.method==='GET'&&fault.readDelayMs){const wait=fault.readDelayMs;fault.readDelayMs=0;await new Promise(resolve=>setTimeout(resolve,wait));}
   res.writeHead(response.status,{...Object.fromEntries(response.headers),'Cache-Control':'no-store'});res.end(bytes);
  }catch(error){res.writeHead(error instanceof BootstrapAuthenticationRequiredError?401:400,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,code:error instanceof BootstrapAuthenticationRequiredError?'AUTHENTICATION_REQUIRED':'RECIPE_REQUEST_REFUSED'}));}
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 return{fixture,server,origin:`http://127.0.0.1:${server.address().port}`,events,fault,newSession,
  async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await fixture.close();}};
}
