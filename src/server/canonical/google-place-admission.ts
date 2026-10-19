import 'server-only';
import {plannerInteger,plannerKeys,plannerRecord,plannerUuid} from '@/domain/phase2/planner/json';
import {validGooglePlaceId,projectPlaceTypeCompatible} from '@/domain/phase2/restaurant-places';
import {GoogleRestaurantPlaces} from '@/server/places/google-places';
import {matchPublishedGooglePlace,type PublishedGooglePlaceMapping} from '@/domain/phase2/personal-google-place';
import {derivePlannedPlaceRoles,type PlannedPlaceFacts} from '@/domain/phase2/planned-place-rules';

/** Proposed Canonical owner contract. No HTTP entry point or enabled live adapter.
 * The publisher is explicitly assigned by governance; a membership is not that grant.
 * Only maps an existing classified public Canonical place. Never creates a visit/place.
 */
export type GooglePlaceAdmission=Readonly<{version:'canonical-google-admission@v1';requestId:string;googlePlaceId:string;
 kind:'BAR_APERO';intendedScope:string;canonicalPlaceId:string;expectedSourceGeneration:number;expectedMappingVersion:number}>;
export function parseGooglePlaceAdmission(raw:unknown):GooglePlaceAdmission {
 const c=plannerRecord(raw);plannerKeys(c,['version','requestId','googlePlaceId','kind','intendedScope','canonicalPlaceId','expectedSourceGeneration','expectedMappingVersion']);
 if(c.version!=='canonical-google-admission@v1'||c.kind!=='BAR_APERO'||!validGooglePlaceId(c.googlePlaceId))throw new TypeError('CANONICAL_GOOGLE_ADMISSION_INVALID');
 return {version:c.version,kind:c.kind,googlePlaceId:c.googlePlaceId,requestId:plannerUuid(c.requestId),intendedScope:plannerUuid(c.intendedScope),canonicalPlaceId:plannerUuid(c.canonicalPlaceId),
  expectedSourceGeneration:plannerInteger(c.expectedSourceGeneration),expectedMappingVersion:plannerInteger(c.expectedMappingVersion)};
}
export type CanonicalGooglePublication=Readonly<{generation:number;mappings:readonly PublishedGooglePlaceMapping[]}>;
export type CanonicalGoogleReceipt=Readonly<{status:'PUBLISHED';requestId:string;generation:number;mappingVersion:number;canonicalPlaceId:string;replayed:boolean}>
 |Readonly<{status:'DENIED'|'CONFLICT'|'PENDING_GOVERNANCE'|'UNAVAILABLE'|'PROVIDER_UNAVAILABLE'}>;
export interface CanonicalGoogleAdmissionStore {
 authorizedPublisher(actorId:string,scopeId:string):Promise<boolean>;
 readCanonicalPlace(scopeId:string,canonicalPlaceId:string):Promise<PlannedPlaceFacts|null>;
 publish(actorId:string,command:GooglePlaceAdmission):Promise<CanonicalGoogleReceipt>;
 receipt(actorId:string,command:GooglePlaceAdmission):Promise<CanonicalGoogleReceipt|null>;
 readPublished(scopeId:string):Promise<CanonicalGooglePublication>;
}
export async function admitGooglePlace(actorId:string,raw:unknown,store?:CanonicalGoogleAdmissionStore,google:Pick<GoogleRestaurantPlaces,'details'>=new GoogleRestaurantPlaces()):Promise<CanonicalGoogleReceipt>{
 plannerUuid(actorId);const command=parseGooglePlaceAdmission(raw);
 if(!store)return {status:'PENDING_GOVERNANCE'};
 if(!await store.authorizedPublisher(actorId,command.intendedScope))return {status:'DENIED'};
 // The existing classification owner, never a Google/name inference, decides
 // whether this public Canonical identity is admissible for the Bar pilot.
 const candidate=await store.readCanonicalPlace(command.intendedScope,command.canonicalPlaceId);
 if(!candidate||candidate.privatePlace||!derivePlannedPlaceRoles(candidate).includes('BAR'))return {status:'DENIED'};
 const verify=async(receipt:CanonicalGoogleReceipt):Promise<CanonicalGoogleReceipt>=>{
  if(receipt.status!=='PUBLISHED')return receipt;
  const p=await store.readPublished(command.intendedScope);
  const linked=matchPublishedGooglePlace(command.googlePlaceId,{householdId:command.intendedScope,sourceGeneration:`canonical-google-publication@v1:${p.generation}`},p.mappings);
  // A historical receipt alone never establishes current KNOWN.
  if(p.generation<receipt.generation||linked.status!=='LINKED'||linked.canonicalPlaceId!==receipt.canonicalPlaceId)return {status:'UNAVAILABLE'};
  return receipt;
 };
 try {const previous=await store.receipt(actorId,command);if(previous)return await verify(previous);}catch{return {status:'UNAVAILABLE'};}
 try {const detail=await google.details(command.googlePlaceId,undefined,'BAR_APERO');
  if(detail.provider!=='google_places'||detail.placeId!==command.googlePlaceId||!projectPlaceTypeCompatible(detail.types,'BAR_APERO'))return {status:'DENIED'};
 }catch{return {status:'PROVIDER_UNAVAILABLE'};}
 try {return await verify(await store.publish(actorId,command));}catch{
  // Indeterminate commit: one read, never repeat the write blindly.
  try {const receipt=await store.receipt(actorId,command);return receipt?await verify(receipt):{status:'UNAVAILABLE'};}catch{return {status:'UNAVAILABLE'};}
 }
}
