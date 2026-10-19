import 'server-only';
import type {PersonalGooglePlace,PersonalGooglePlaceCommand} from '@/domain/phase2/personal-google-place';
import {parsePersonalGooglePlaceCommand} from '@/domain/phase2/personal-google-place';
import {GoogleRestaurantPlaces} from './google-places';
import {projectPlaceTypeCompatible} from '@/domain/phase2/restaurant-places';
import {plannerUuid} from '@/domain/phase2/planner/json';

export type PersonalPlaceScope=Readonly<{userId:string;householdId:string}>;
export type PersonalPlaceResult={status:'SAVED'|'ARCHIVED';place:PersonalGooglePlace;replayed:boolean;currentPlace?:PersonalGooglePlace;superseded?:boolean}
  |{status:'CONFLICT'|'DENIED'|'PROVIDER_UNAVAILABLE'|'UNAVAILABLE'|'INVALID'};
/** Storage is an explicit owner boundary. The only live adapter uses the
 * reviewed RPC; never direct client DML. It is not enabled before SQL approval.
 */
export interface PersonalPlaceStore {
  read(scope:PersonalPlaceScope):Promise<readonly PersonalGooglePlace[]>;
  replay(scope:PersonalPlaceScope,command:PersonalGooglePlaceCommand):Promise<PersonalPlaceResult|null>;
  mutate(scope:PersonalPlaceScope,command:PersonalGooglePlaceCommand):Promise<PersonalPlaceResult>;
}
export class PersonalGooglePlaces {
  constructor(private readonly store:PersonalPlaceStore,private readonly authorized:(scope:PersonalPlaceScope)=>Promise<boolean>,
    private readonly google:Pick<GoogleRestaurantPlaces,'details'>=new GoogleRestaurantPlaces()){}
  private async access(scope:PersonalPlaceScope){plannerUuid(scope.userId);plannerUuid(scope.householdId);return this.authorized(scope);}
  private async reconcile(scope:PersonalPlaceScope,result:PersonalPlaceResult):Promise<PersonalPlaceResult>{
    if(!('place' in result))return result;
    const current=(await this.store.read(scope)).find(p=>p.id===result.place.id);
    if(!current||current.version<result.place.version)return {status:'UNAVAILABLE'};
    return {...result,currentPlace:current,superseded:current.version>result.place.version};
  }
  async read(scope:PersonalPlaceScope){if(!await this.access(scope))throw new TypeError('PERSONAL_PLACE_DENIED');return this.store.read(scope);}
  async save(scope:PersonalPlaceScope,raw:unknown):Promise<PersonalPlaceResult> {
    const command=parsePersonalGooglePlaceCommand(raw);
    if(!await this.access(scope))return {status:'DENIED'};
    // Reconcile a lost response before any fresh provider call or mutation.
    try {const replay=await this.store.replay(scope,command);if(replay)return await this.reconcile(scope,replay);}catch{return {status:'UNAVAILABLE'};}
    let alreadyVerified=false;
    if(command.action==='SAVE'){
      try {const existing=(await this.store.read(scope)).find(p=>p.googlePlaceId===command.googlePlaceId);
        alreadyVerified=existing?.status==='SAVED'&&existing.version===command.expectedVersion;
      }catch{return {status:'UNAVAILABLE'};}
    }
    // Renaming a verified private favourite is a user label edit, not a Google refresh.
    if(command.action==='SAVE'&&!alreadyVerified){
      try {const detail=await this.google.details(command.googlePlaceId,undefined,'BAR_APERO');
        if(detail.provider!=='google_places'||detail.placeId!==command.googlePlaceId||!projectPlaceTypeCompatible(detail.types,'BAR_APERO'))return {status:'INVALID'};
      }catch{return {status:'PROVIDER_UNAVAILABLE'};}
    }
    try {return await this.store.mutate(scope,command);}catch{
      // Do not send the mutation again after an indeterminate commit.
      try {const replay=await this.store.replay(scope,command);return replay?await this.reconcile(scope,replay):{status:'UNAVAILABLE'};}catch{return {status:'UNAVAILABLE'};}
    }
  }
}
