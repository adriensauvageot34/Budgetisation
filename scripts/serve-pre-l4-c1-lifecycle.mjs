import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
const out=path.resolve('outputs/pre-l4-c1-lifecycle');fs.mkdirSync(out,{recursive:true});
const {build}=await import(pathToFileURL(path.resolve(process.env.PLANNER_BROWSER_TOOLS,'node_modules/esbuild/lib/main.js')).href);
await build({entryPoints:['scripts/lib/pre-l4-c1-inline-lifecycle-entry.tsx'],bundle:true,format:'esm',target:'chrome120',jsx:'automatic',
 define:{'process.env.NODE_ENV':'"production"'},minify:true,loader:{'.css':'local-css'},outfile:path.join(out,'app.js'),sourcemap:true});
const host='<!doctype html><html lang="fr"><meta charset="utf-8"><title>C1 lifecycle · synthetic only</title><link rel="stylesheet" href="/app.css"><div id="root"></div><script type="module" src="/app.js"></script></html>';
http.createServer((req,res)=>{const file=new URL(req.url,'http://127.0.0.1').pathname;
 if(file==='/'){res.setHeader('Content-Type','text/html');res.end(host);return;}
 if(!['/app.js','/app.css','/app.js.map'].includes(file)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'application/json');res.end(fs.readFileSync(path.join(out,file.slice(1))));
}).listen(3217,'127.0.0.1',()=>console.log('C1 lifecycle fixture ready http://127.0.0.1:3217 (no network/storage)'));
