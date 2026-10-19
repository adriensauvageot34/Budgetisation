/** Explicitly approved release smoke: public GET only; no Auth, financial or data mutation. */
import fs from 'node:fs';
const origin='https://budgetisation-tan.vercel.app';
const out=[];
for(const [path,init] of [
 ['/recette/bar-favoris',{}],
 ['/api/recette/bar-favoris',{}],
 ['/api/places/personal',{}],
 ['/connexion?bar-reception-otp=1',{}],
]){
 try{const r=await fetch(origin+path,{...init,redirect:'manual',signal:AbortSignal.timeout(12000)});const body=await r.text();
 const entry={path,status:r.status,...(path==='/api/places/personal'?{enabled:JSON.parse(body).enabled}:{}),...(path.startsWith('/connexion')?{recipeOtpExposed:body.includes('bar-reception-otp')||body.includes('Jeton de recette')}: {})};out.push(entry);console.log(JSON.stringify(entry));}
 catch(e){out.push({path,status:'NOT_RUN_TRANSPORT',error:e.name});console.log(JSON.stringify(out.at(-1)));}
}
fs.writeFileSync('docs/status/evidence/bar-google-production-release/http-guards.json',JSON.stringify(out,null,2)+'\n');
if(out.some(x=>x.status==='NOT_RUN_TRANSPORT'))process.exitCode=2;
