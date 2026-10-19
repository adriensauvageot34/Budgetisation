import {getAuthenticatedBootstrapClient} from '@/server/bootstrap/auth';
import {getCurrentHousehold} from '@/server/bootstrap/queries';
import {BootstrapAuthenticationRequiredError} from '@/server/bootstrap/errors';
import {PersonalGooglePlaces,type PersonalPlaceTrace} from '@/server/places/personal-google-places';
import {createPersonalPlaceStore} from '@/server/places/personal-google-place-store';
import {allowPlacesRequest} from '@/server/places/http';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store',Vary:'Cookie'};
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers});
const enabled=()=>process.env.BAR_PERSONAL_PLACES_ENABLED==='1';
async function owner(trace?:PersonalPlaceTrace,requestId?:string){
  // A private favourite needs Auth and an RLS-admitted household, not World/Global/Canonical.
  let identity;
  try{identity=await getAuthenticatedBootstrapClient();if(requestId)trace?.({requestId,stage:'AUTH',status:'ADMITTED'});}
  catch(error){if(requestId)trace?.({requestId,stage:'AUTH',status:'DENIED'});throw error;}
  const {user,supabase}=identity;
  const household=await getCurrentHousehold(supabase);
  if(!household)throw new TypeError('PERSONAL_PLACE_DENIED');
  const scope={userId:user.id,householdId:String(household.householdId)};
  return {scope,service:new PersonalGooglePlaces(createPersonalPlaceStore(),async candidate=>candidate.userId===scope.userId&&candidate.householdId===scope.householdId,undefined,trace)};
}
async function boundary(run:()=>Promise<Response>){try{return await run();}catch(e){
  if(e instanceof BootstrapAuthenticationRequiredError)return reply({status:'DENIED'},401);
  if(e instanceof TypeError&&e.message==='PERSONAL_PLACE_DENIED')return reply({status:'DENIED'},403);
  if(e instanceof TypeError&&/^(PERSONAL_PLACE_(INVALID|LABEL_INVALID)|PLANNER_)/u.test(e.message))return reply({status:'INVALID'},400);
  return reply({status:'UNAVAILABLE'},503);
}}
export const GET=()=>boundary(async()=>{
  if(!enabled())return reply({enabled:false,places:[]});
  const {scope,service}=await owner();return reply({enabled:true,places:await service.read(scope)});
});
export const POST=(request:Request)=>boundary(async()=>{
  if(!enabled())return reply({status:'DISABLED'},403);
  if(request.headers.get('origin')!==new URL(request.url).origin)return reply({status:'DENIED'},403);
  if(request.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')return reply({status:'INVALID'},415);
  if(Number(request.headers.get('content-length')??0)>4096)return reply({status:'INVALID'},413);
  const body=await request.text();if(Buffer.byteLength(body)>4096)return reply({status:'INVALID'},413);
  let raw:unknown;try{raw=JSON.parse(body);}catch{return reply({status:'INVALID'},400);}
  const requestId=typeof raw==='object'&&raw!==null&&'requestId' in raw&&typeof raw.requestId==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(raw.requestId)?raw.requestId:crypto.randomUUID();
  // Explicit test opt-in: no identity, label, query, token, payload or database error.
  const trace:PersonalPlaceTrace=event=>{if(process.env.BAR_PERSONAL_PLACES_TRACE==='1')console.info(JSON.stringify({component:'personal-google-place',...event}));};
  const {scope,service}=await owner(trace,requestId);
  if(!allowPlacesRequest(`personal:${scope.householdId}:${scope.userId}`,30)||!allowPlacesRequest('provider',200))return reply({status:'RATE_LIMITED'},429);
  const result=await service.save(scope,raw);
  const response=reply(result,result.status==='DENIED'?403:result.status==='CONFLICT'?409:result.status==='PROVIDER_UNAVAILABLE'||result.status==='UNAVAILABLE'?503:result.status==='INVALID'?422:200);
  response.headers.set('X-Place-Request-Id',requestId);return response;
});
