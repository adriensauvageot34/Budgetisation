import type {ProspectivePlaceRef} from "../planned-contract";
import {validGooglePlaceId} from "../restaurant-places";
import {plannerDigest,plannerKeys,plannerRecord,plannerString,plannerUuid} from "./json";

/** User decisions, not a Canonical identity or a cached provider response. */
export type BarGoogleRef = Readonly<{provider:"google_places";kind:"BAR_APERO";placeId:string}>;
export type NightOutVenueDecision = Readonly<{version:"night-out-venue@v1";decisionId:string;
  place:ProspectivePlaceRef;google?:BarGoogleRef;provenance:"EXPLICIT_USER_DECISION"}>;
export type VenueEndpointBinding = Readonly<{version:"night-out-venue-endpoint@v1";venue:NightOutVenueDecision}>;
export type VenueEndpoints = Readonly<Partial<Record<"origin"|"destination",VenueEndpointBinding>>>;

export function parseNightOutVenue(raw:unknown):NightOutVenueDecision {
  const v=plannerRecord(raw);plannerKeys(v,["version","decisionId","place","google","provenance"],["version","decisionId","place","provenance"]);
  if(v.version!=="night-out-venue@v1"||v.provenance!=="EXPLICIT_USER_DECISION")throw new TypeError("NIGHT_OUT_VENUE_VERSION_INVALID");
  const p=plannerRecord(v.place);let place:ProspectivePlaceRef;
  if(p.kind==="KNOWN"){plannerKeys(p,["kind","placeId"]);place={kind:"KNOWN",placeId:plannerUuid(p.placeId)};}
  else {plannerKeys(p,["kind","label","provenance"],["kind","label"]);if(p.kind!=="TEXT"||p.provenance!==undefined&&p.provenance!=="USER_DECLARED_PROSPECTIVE")throw new TypeError("NIGHT_OUT_VENUE_PLACE_INVALID");
    const label=plannerString(p.label);if(label.length>120)throw new TypeError("NIGHT_OUT_VENUE_PLACE_INVALID");place={kind:"TEXT",label,provenance:"USER_DECLARED_PROSPECTIVE"};}
  let google:BarGoogleRef|undefined;
  if(v.google!==undefined){const g=plannerRecord(v.google);plannerKeys(g,["provider","kind","placeId"]);
    if(place.kind!=="TEXT"||g.provider!=="google_places"||g.kind!=="BAR_APERO"||!validGooglePlaceId(g.placeId))throw new TypeError("NIGHT_OUT_GOOGLE_REF_INVALID");
    google={provider:"google_places",kind:"BAR_APERO",placeId:g.placeId};}
  return {version:"night-out-venue@v1",decisionId:plannerUuid(v.decisionId),place,...(google?{google}:{}),provenance:"EXPLICIT_USER_DECISION"};
}
export const sameVenuePlace=(a:ProspectivePlaceRef|null|undefined,b:ProspectivePlaceRef|null|undefined)=>
  a?.kind==="KNOWN"&&b?.kind==="KNOWN"?a.placeId===b.placeId:a?.kind==="TEXT"&&b?.kind==="TEXT"?a.label===b.label:a==null&&b==null;
export function parseVenueEndpoints(raw:unknown,places:{origin?:ProspectivePlaceRef|null;destination?:ProspectivePlaceRef|null}):VenueEndpoints|undefined {
  if(raw===undefined)return undefined;const v=plannerRecord(raw);plannerKeys(v,["origin","destination"],[]);
  const next:Partial<Record<"origin"|"destination",VenueEndpointBinding>>={};
  for(const key of ["origin","destination"] as const)if(v[key]!==undefined){const binding=plannerRecord(v[key]);plannerKeys(binding,["version","venue"]);
    const venue=parseNightOutVenue(binding.venue);if(binding.version!=="night-out-venue-endpoint@v1"||!sameVenuePlace(venue.place,places[key]))throw new TypeError("NIGHT_OUT_ENDPOINT_BINDING_INVALID");
    next[key]={version:"night-out-venue-endpoint@v1",venue};}
  return next;
}
export const venueBinding=(venue:NightOutVenueDecision):VenueEndpointBinding=>({version:"night-out-venue-endpoint@v1",venue:parseNightOutVenue(venue)});
export const venueDecisionIdentity=(raw:unknown)=>plannerDigest(parseNightOutVenue(raw));
