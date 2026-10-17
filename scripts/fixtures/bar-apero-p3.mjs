import {fixture,state,uuid} from './planner-headless.mjs';
export const barP3Knowledge={source:'RECORDED_PERSON_DAYS',fromDate:'2025-10-17',throughDate:'2026-10-17',coverage:'AVAILABLE_RECORDS',placeLimit:500,placesTruncated:false};
export function barP3Month(){
 const world=fixture();const base={commune:'Ville fixture',nature:'Commerce',usage:'Bar',subtype:null,privatePlace:false,relationships:[]};
 world.mobilityFacts.places=[...world.mobilityFacts.places.slice(0,1),
  {...base,placeId:uuid(99201),name:'Bar des Trois Jours',visits12Months:3,lastVisitDate:'2026-10-10',address:'Place des Fictions'},
  {...base,placeId:uuid(99202),name:'Bar du Canal',visits12Months:1,lastVisitDate:'2026-10-12',address:'Quai A fictif'},
  {...base,placeId:uuid(99203),name:'Bar du Canal',visits12Months:0,lastVisitDate:null,address:'Quai B fictif'},
  {...base,placeId:uuid(99204),name:'Atelier fixture',usage:'Travail',privatePlace:true,currentRelationships:[{personId:uuid(1),role:'PRIMARY_WORK'}]}];
 return {world,semantic:state()};
}
