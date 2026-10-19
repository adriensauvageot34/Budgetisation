/** Normal Auth one-time-link delivery, strictly existing fictional users.
 * No password extraction, JWT injection, fake roles or Production identity.
 */
import http from 'node:http';import fs from 'node:fs';
import {barTestKeys,BAR_TEST_URL} from './lib/bar-test-supabase.mjs';import {createClient} from '@supabase/supabase-js';
const preview=new URL(process.env.BAR_TEST_PREVIEW_URL??'');
if(preview.protocol!=='https:'||!/^budgetisation-[a-z0-9]+-adriensauvageot34-6137s-projects\.vercel\.app$/.test(preview.hostname))throw Error('EXACT_TEST_PREVIEW_REQUIRED');
const proof=JSON.parse(fs.readFileSync('outputs/bar-production-readiness/auth-tests.json','utf8')),admin=createClient(BAR_TEST_URL,barTestKeys().secret,{auth:{persistSession:false,autoRefreshToken:false}});
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
 if(req.headers.host!=='127.0.0.1:3260'||req.method!=='GET'){res.writeHead(403);res.end();return;}
 const name=new URL(req.url,'http://127.0.0.1').searchParams.get('account')??'A';if(!['A','B','C'].includes(name)){res.writeHead(403);res.end();return;}
 try{const u=await admin.auth.admin.getUserById(proof.accounts[name].id);if(u.error||u.data.user.app_metadata.bar_google_test!=='closure-20261019'||u.data.user.banned_until&&Date.parse(u.data.user.banned_until)>Date.now())throw Error();
  const r=await admin.auth.admin.generateLink({type:'magiclink',email:u.data.user.email});if(r.error)throw Error();
  const target=new URL('/connexion?bar-reception-otp=1',preview);target.hash=new URLSearchParams({token_hash:r.data.properties.hashed_token}).toString();
  res.setHeader('Content-Type','text/html;charset=utf-8');res.end(`<h1>Session fictive ${name} — Bar-Test</h1><a href="${target.href}">Ouvrir la session fictive ${name} sur la Preview</a><p>Lien Supabase Auth à usage unique. Aucun compte réel.</p>`);
 }catch{res.writeHead(503);res.end('Connexion de test indisponible.');}
});
server.listen(3260,'127.0.0.1',()=>console.log('TEST_OTP_BRIDGE_READY_NO_TOKEN_LOGGED'));process.on('SIGINT',()=>server.close(()=>process.exit(0)));
