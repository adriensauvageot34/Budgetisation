import 'server-only';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {assertSameSupabaseProject} from '@/server/runtime-environment';
import type {PersonalPlaceStore,PersonalPlaceScope,PersonalPlaceResult} from './personal-google-places';
import type {PersonalGooglePlace,PersonalGooglePlaceCommand} from '@/domain/phase2/personal-google-place';
import {parsePersonalGooglePlace as place} from '@/domain/phase2/personal-google-place';
import {plannerRecord} from '@/domain/phase2/planner/json';
function result(raw:unknown):PersonalPlaceResult|null {
  if(raw===null)return null;const v=plannerRecord(raw);
  if(['DENIED','CONFLICT','INVALID'].includes(String(v.status)))return {status:v.status as 'DENIED'|'CONFLICT'|'INVALID'};
  if(!['SAVED','ARCHIVED'].includes(String(v.status))||typeof v.replayed!=='boolean')throw new TypeError('PERSONAL_PLACE_RESPONSE_INVALID');
  const saved=place(v.place);if(saved.status!==v.status)throw new TypeError('PERSONAL_PLACE_RESPONSE_INVALID');
  return {status:saved.status,place:saved,replayed:v.replayed};
}
export function personalPlaceRpcStore(client:Pick<SupabaseClient,'rpc'>):PersonalPlaceStore {
  const rpc=async(scope:PersonalPlaceScope,command:PersonalGooglePlaceCommand|null,mode:string)=>{
    const {data,error}=await client.rpc('personal_google_place_v1',{p_actor:scope.userId,p_household:scope.householdId,p_command:command,p_mode:mode});
    if(error)throw new TypeError('PERSONAL_PLACE_STORAGE_UNAVAILABLE');
    if(mode==='READ'&&data?.status==='DENIED')throw new TypeError('PERSONAL_PLACE_DENIED');return data;
  };
  return {async read(scope){const raw=await rpc(scope,null,'READ');if(!Array.isArray(raw))throw new TypeError('PERSONAL_PLACE_RESPONSE_INVALID');return raw.map(place);},
    async replay(scope,command){return result(await rpc(scope,command,'REPLAY'));},
    async mutate(scope,command){const r=result(await rpc(scope,command,'MUTATE'));if(!r)throw new TypeError('PERSONAL_PLACE_RESPONSE_INVALID');return r;}};
}
/** Narrow server writer; never reuse the CanonicalReadClient as a DML owner. */
export function createPersonalPlaceStore():PersonalPlaceStore {
  assertSameSupabaseProject();const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new TypeError('PERSONAL_PLACE_CONFIGURATION');
  return personalPlaceRpcStore(createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
}
