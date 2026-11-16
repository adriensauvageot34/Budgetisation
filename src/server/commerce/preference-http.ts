import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { getCurrentHousehold } from "@/server/bootstrap/queries";
import { BootstrapAuthenticationRequiredError } from "@/server/bootstrap/errors";
import { ComposerPreferences } from "./composer-preferences";
import { plannerKeys, plannerRecord } from "@/domain/phase2/planner/json";
const headers={"Cache-Control":"private, no-store",Vary:"Cookie","X-Content-Type-Options":"nosniff"};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
async function owner(){
  const {supabase,user}=await getAuthenticatedBootstrapClient();
  if(!await getCurrentHousehold(supabase))throw new TypeError('PREFERENCE_DENIED');
  return {service:new ComposerPreferences(supabase,user.id),userId:user.id};
}
export async function preferenceRequest(request:Request,getOwner=owner) {
  try {
    if(request.headers.get("origin")!==new URL(request.url).origin)return reply({code:"PREFERENCE_DENIED"},403);
    if(request.headers.get("content-type")?.split(";")[0]!=="application/json")return reply({code:"PREFERENCE_INVALID"},415);
    const reader=request.body?.getReader();if(!reader)throw new TypeError("PREFERENCE_INVALID");
    const chunks:Uint8Array[]=[];let size=0;
    try {for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>4096){await reader.cancel();return reply({code:"PREFERENCE_INVALID"},413);}chunks.push(part.value);}}
    finally {reader.releaseLock();}
    const raw=plannerRecord(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const {service,userId}=await getOwner();
    if(raw.kind==="READ"){plannerKeys(raw,["kind"]);return reply({owner:userId,rows:await service.read()});}
    if(raw.kind==="SET"){plannerKeys(raw,["kind","preference"]);return reply({preference:await service.set(raw.preference)});}
    if(raw.kind==="REMOVE"){plannerKeys(raw,["kind","subjectKey","scope","version"]);return reply({removed:await service.remove(raw.subjectKey,raw.scope,raw.version)});}
    throw new TypeError("PREFERENCE_INVALID");
  }catch(error){
    if(error instanceof BootstrapAuthenticationRequiredError)return reply({code:"AUTH_REQUIRED"},401);
    const code=error instanceof TypeError?error.message:"";
    if(code==='PREFERENCE_DENIED')return reply({code},403);
    if(code==="PREFERENCE_CONFLICT")return reply({code},409);
    if(/^(PREFERENCE_INVALID|PLANNER_)/u.test(code)||error instanceof SyntaxError)return reply({code:"PREFERENCE_INVALID"},400);
    return reply({code:"PREFERENCE_UNAVAILABLE"},503);
  }
}
