import {validGooglePlaceId} from './restaurant-places';
import {plannerInteger,plannerKeys,plannerRecord,plannerString,plannerUuid} from './planner/json';

/** A private user decision. Neither a Canonical place nor an observed visit. */
export type PersonalGooglePlaceCommand=Readonly<{version:'personal-google-place@v1';requestId:string;
  googlePlaceId:string;expectedVersion:number;action:'SAVE'|'ARCHIVE';userLabel:string}>;
export type PersonalGooglePlace=Readonly<{id:string;googlePlaceId:string;userLabel:string;version:number;
  status:'SAVED'|'ARCHIVED';kind:'PERSONAL_SAVED_PLACE';verifiedAt:string}>;
export function parsePersonalGooglePlace(raw:unknown):PersonalGooglePlace {
  const v=plannerRecord(raw);
  if(!validGooglePlaceId(v.googlePlaceId)||typeof v.userLabel!=='string'||!v.userLabel.trim()||v.userLabel.length>120
    ||v.kind!=='PERSONAL_SAVED_PLACE'||!['SAVED','ARCHIVED'].includes(String(v.status))||typeof v.verifiedAt!=='string'||!Number.isFinite(Date.parse(v.verifiedAt)))throw new TypeError('PERSONAL_PLACE_RESPONSE_INVALID');
  return {id:plannerUuid(v.id),googlePlaceId:v.googlePlaceId,userLabel:v.userLabel,version:plannerInteger(v.version,1),status:v.status as 'SAVED'|'ARCHIVED',kind:v.kind,verifiedAt:v.verifiedAt};
}
export function parsePersonalGooglePlaceCommand(raw:unknown):PersonalGooglePlaceCommand {
  const v=plannerRecord(raw);plannerKeys(v,['version','requestId','googlePlaceId','expectedVersion','action','userLabel']);
  if(v.version!=='personal-google-place@v1'||!validGooglePlaceId(v.googlePlaceId)||!['SAVE','ARCHIVE'].includes(String(v.action)))throw new TypeError('PERSONAL_PLACE_INVALID');
  const userLabel=plannerString(v.userLabel).trim();if(userLabel.length>120)throw new TypeError('PERSONAL_PLACE_LABEL_INVALID');
  return {version:v.version,requestId:plannerUuid(v.requestId),googlePlaceId:v.googlePlaceId,expectedVersion:plannerInteger(v.expectedVersion),action:v.action as 'SAVE'|'ARCHIVE',userLabel};
}

/** Only an official published projection may be supplied by the Canonical owner.
 * No place name, address, favourite, or provider response can establish this link.
 */
export type PublishedGooglePlaceMapping=Readonly<{provider:'google_places';googlePlaceId:string;canonicalPlaceId:string;
  householdId:string;sourceGeneration:string;mappingVersion:number;publicationStatus:'PUBLISHED';privatePlace:boolean}>;
export function matchPublishedGooglePlace(googlePlaceId:string,scope:{householdId:string;sourceGeneration:string},mappings:readonly PublishedGooglePlaceMapping[]) {
  if(!validGooglePlaceId(googlePlaceId))throw new TypeError('PERSONAL_PLACE_INVALID');
  const eligible=mappings.filter(m=>m.provider==='google_places'&&m.googlePlaceId===googlePlaceId&&m.householdId===scope.householdId
    &&m.sourceGeneration===scope.sourceGeneration&&m.publicationStatus==='PUBLISHED'&&!m.privatePlace&&Number.isSafeInteger(m.mappingVersion)&&m.mappingVersion>0);
  const ids=[...new Set(eligible.map(m=>plannerUuid(m.canonicalPlaceId)))];
  if(ids.length>1)return {status:'CONFLICT' as const};
  return ids.length?{status:'LINKED' as const,canonicalPlaceId:ids[0]}:{status:'PENDING' as const};
}
