import {barReceptionEnabled,barReceptionScope} from '@/server/recette/bar-favorites';
import {BootstrapAuthenticationRequiredError} from '@/server/bootstrap/errors';
import {handleComposerRequest} from '@/server/phase2/planner/composer-service';
import type {ComposerRequest} from '@/domain/phase2/planner/composer-ui-contract';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
async function boundary(run:()=>Promise<Response>){if(!barReceptionEnabled())return reply({},404);try{return await run();}catch(e){return reply({code:e instanceof BootstrapAuthenticationRequiredError?'AUTH_REQUIRED':'RECEPTION_UNAVAILABLE'},e instanceof BootstrapAuthenticationRequiredError?401:503);}}
export const POST=(r:Request)=>boundary(async()=>{
  if(r.headers.get('origin')!==new URL(r.url).origin)return reply({},403);
  if(r.headers.get('content-type')?.split(';')[0]!=='application/json'||Number(r.headers.get('content-length')??0)>1200000)return reply({},413);
  const text=await r.text();if(Buffer.byteLength(text)>1200000)return reply({},413);
  const {kind,payload}=JSON.parse(text),scope=await barReceptionScope();
  if(kind==='INTERACTION'){
    if(!payload||payload.targetMonth!=='2026-11'||['APPLY','CHECK_APPLY'].includes(payload.kind))return reply({code:'RECEPTION_APPLY_FORBIDDEN'},403);
    return reply(await handleComposerRequest(scope.deps,scope.householdId,payload as ComposerRequest));
  }
  return reply({},400);
});
