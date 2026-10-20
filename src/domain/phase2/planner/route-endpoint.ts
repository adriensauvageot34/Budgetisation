import type {ProspectivePlaceRef} from "../planned-contract";
import {validGooglePlaceId} from "../restaurant-places";
import {plannerKeys,plannerRecord,plannerString,plannerUuid} from "./json";

export type RouteEndpointKey="origin"|"destination";
/** Explicit directed intent only. No Google address, coordinates or route cache. */
export type RouteEndpointBinding=Readonly<{version:"route-endpoint@v1";decisionId:string;selectionId:string;endpoint:RouteEndpointKey;
  place:Extract<ProspectivePlaceRef,{kind:"TEXT"}>;google:Readonly<{provider:"google_places";kind:"ROUTE_ENDPOINT";placeId:string}>;provenance:"EXPLICIT_USER_DECISION"}>;
export type RouteEndpointBindings=Readonly<Partial<Record<RouteEndpointKey,RouteEndpointBinding>>>;
export function parseRouteEndpointBindings(raw:unknown,leg:{selectionId:string;origin?:ProspectivePlaceRef|null;destination?:ProspectivePlaceRef|null}):RouteEndpointBindings|undefined{
  if(raw===undefined)return undefined;
  const value=plannerRecord(raw);plannerKeys(value,["origin","destination"],[]);
  const result:Partial<Record<RouteEndpointKey,RouteEndpointBinding>>={};
  for(const endpoint of ["origin","destination"] as const)if(value[endpoint]!==undefined){
    const b=plannerRecord(value[endpoint]);plannerKeys(b,["version","decisionId","selectionId","endpoint","place","google","provenance"]);
    const p=plannerRecord(b.place);plannerKeys(p,["kind","label","provenance"]);
    const g=plannerRecord(b.google);plannerKeys(g,["provider","kind","placeId"]);
    const label=plannerString(p.label),selectionId=plannerUuid(b.selectionId);
    if(b.version!=="route-endpoint@v1"||b.provenance!=="EXPLICIT_USER_DECISION"||selectionId!==leg.selectionId||b.endpoint!==endpoint
      ||p.kind!=="TEXT"||p.provenance!=="USER_DECLARED_PROSPECTIVE"||label.length>120||leg[endpoint]?.kind!=="TEXT"||leg[endpoint]?.label!==label
      ||g.provider!=="google_places"||g.kind!=="ROUTE_ENDPOINT"||!validGooglePlaceId(g.placeId))throw new TypeError("ROUTE_ENDPOINT_BINDING_INVALID");
    result[endpoint]={version:"route-endpoint@v1",decisionId:plannerUuid(b.decisionId),selectionId,endpoint,place:{kind:"TEXT",label,provenance:"USER_DECLARED_PROSPECTIVE"},google:{provider:"google_places",kind:"ROUTE_ENDPOINT",placeId:g.placeId},provenance:"EXPLICIT_USER_DECISION"};
  }
  return result;
}
export function reverseRouteEndpointBindings(bindings:RouteEndpointBindings|undefined,selectionId:string):RouteEndpointBindings|undefined{
  return bindings?Object.fromEntries((["origin","destination"] as const).flatMap(endpoint=>{
    const source=bindings[endpoint==="origin"?"destination":"origin"];
    return source?[[endpoint,{...source,selectionId,endpoint}]]:[];
  })):undefined;
}
