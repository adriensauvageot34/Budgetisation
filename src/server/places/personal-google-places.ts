import 'server-only';
import type {PersonalGooglePlace,PersonalGooglePlaceCommand} from '@/domain/phase2/personal-google-place';
import {parsePersonalGooglePlaceCommand} from '@/domain/phase2/personal-google-place';
import {GoogleRestaurantPlaces} from './google-places';
import {projectPlaceTypeCompatible} from '@/domain/phase2/restaurant-places';
import {plannerUuid} from '@/domain/phase2/planner/json';

export type PersonalPlaceScope=Readonly<{userId:string;householdId:string}>;
export type PersonalPlaceResult={status:'SAVED'|'ARCHIVED';place:PersonalGooglePlace;replayed:boolean}
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
  async read(scope:PersonalPlaceScope){if(!await this.access(scope))throw new TypeError('PERSONAL_PLACE_DENIED');return this.store.read(scope);}
  async save(scope:PersonalPlaceScope,raw:unknown):Promise<PersonalPlaceResult> {
    const command=parsePersonalGooglePlaceCommand(raw);
    if(!await this.access(scope))return {status:'DENIED'};
    // Reconcile a lost response before any fresh provider call or mutation.
    try {const replay=await this.store.replay(scope,command);if(replay)return replay;}catch{return {status:'UNAVAILABLE'};}
    if(command.action==='SAVE'){
      try {const detail=await this.google.details(command.googlePlaceId,undefined,'BAR_APERO');
        if(detail.provider!=='google_places'||detail.placeId!==command.googlePlaceId||!projectPlaceTypeCompatible(detail.types,'BAR_APERO'))return {status:'INVALID'};
      }catch{return {status:'PROVIDER_UNAVAILABLE'};}
    }
    try {return await this.store.mutate(scope,command);}catch{
      // Do not send the mutation again after an indeterminate commit.
      try {return await this.store.replay(scope,command)??{status:'UNAVAILABLE'};}catch{return {status:'UNAVAILABLE'};}
    }
  }
}
