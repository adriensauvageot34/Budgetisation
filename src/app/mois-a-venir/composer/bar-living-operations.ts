import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import {stopForPlace} from "@/domain/phase2/planned-routes";

export type BarTarget = "place" | "date" | "people" | "drinks" | "outbound" | "return" | "summary" | `component:${string}:${string}`;
export type BarLeg = Extract<ComponentSelectionV1, {kind:"MOBILITY_INTENT"}>;
export const barItems = (context: PlannedContextState, slot: string) =>
  (context.slotSelections[slot]?.items ?? []) as readonly ComponentSelectionV1[];
export const barLeg = (context: PlannedContextState, slot: "outbound" | "return") =>
  barItems(context, slot).find((item): item is BarLeg => item.kind === "MOBILITY_INTENT");
const samePlace = (a: ProspectivePlaceRef | null | undefined, b: ProspectivePlaceRef | null | undefined) =>
  a?.kind === "KNOWN" && b?.kind === "KNOWN" ? a.placeId === b.placeId
    : a?.kind === "TEXT" && b?.kind === "TEXT" ? a.label === b.label : a == null && b == null;

/** An endpoint change invalidates route-dependent evidence. No price is inferred here.
 * Drop route evidence rather than persisting stale coordinates/tolls; the owner may
 * resolve the retained canonical endpoints again on the next Preview. */
export function barEndpoint(leg: BarLeg, key: "origin" | "destination", place: ProspectivePlaceRef | null): BarLeg {
  if (samePlace(leg[key], place)) return leg;
  const affected = new Set(leg.route?.stops.flatMap((stop,index) => key === "origin" ? index===0?[index]:[]
    : leg.returnRequired ? stop.endpointSource==="ROOT_PLACE"?[index]:[] : index===leg.route!.stops.length-1?[index]:[]) ?? []);
  const route=leg.route&&{...leg.route,toll:{kind:"UNKNOWN" as const},stops:leg.route.stops.map((stop,index)=>{
    if(affected.has(index))return place?stopForPlace(place,place.kind==="TEXT"?place.label:"Lieu enregistré",stop.endpointSource??"DIRECT_PLACE",stop.childModule):{label:"",endpointSource:stop.endpointSource};
    if(affected.has(index+1)){const {distanceToNextKm:_d,distanceSource:_s,estimatedFuelLiters:_l,evidence:_e,...intent}=stop;return intent;}
    return stop;
  })};
  return {...leg, [key]: place, ...(route?{route}:{}), pricing: {fare:{kind:"UNKNOWN"}, parking:{kind:"UNKNOWN"},
    fundingAllocations:[], preference:leg.pricing?.preference ?? "FASTEST"},
    ...(leg.journey && leg.journey.relation !== "OWNS_JOURNEY" && leg.journey.relation !== "NO_ADDITIONAL_MOBILITY"
      ? {journey:{...leg.journey, certainty:"POSSIBLE", choice:null}} : {})};
}
/** The central venue owns the outbound destination and return origin only.
 * No other semantic field or selection is reconstructed. */
export function barPlaceOperation(context: PlannedContextState, place: ProspectivePlaceRef): ComposerOperation {
  const slots = Object.fromEntries((["outbound","return"] as const).flatMap(slot => {
    const previous = barItems(context, slot);
    return previous.length ? [[slot, previous.map(item => item.kind === "MOBILITY_INTENT"
      ? barEndpoint(item, slot === "outbound" ? "destination" : "origin", place) : item)]] : [];
  }));
  return {kind:"EDIT_NIGHT_OUT", edit:{contextOccurrenceId:context.contextOccurrenceId, fields:{placeRef:place}, slots}};
}
/** Explicit user action only. A new independent leg never inherits a fare,
 * parking, funding or quote. Existing returns require a separate replacement choice. */
export function barSameModeReturn(context: PlannedContextState, selectionId: string): ComposerOperation {
  const outbound = barLeg(context,"outbound");
  if (!outbound || barItems(context,"return").length) throw Error("Le retour existe déjà ou l’aller reste à préciser.");
  if (outbound.returnRequired) throw Error("Cet aller couvre déjà un aller-retour. Rééditez-le avant de créer un retour indépendant.");
  return {kind:"EDIT_NIGHT_OUT", edit:{contextOccurrenceId:context.contextOccurrenceId, fields:{}, slots:{return:[{
    kind:"MOBILITY_INTENT", selectionId, optionKey:outbound.optionKey, provenance:"EXPLICIT_USER_DECISION",
    origin:outbound.destination ?? null, destination:outbound.origin ?? null, returnRequired:false,
    journey:{relation:"OWNS_JOURNEY",certainty:"CERTAIN",targetIntentId:null,externalExpenseId:null,
      externalCostLineIds:[],choice:null,stopIndex:null,accessLegIndex:null},
    pricing:{fare:{kind:"UNKNOWN"},parking:{kind:"UNKNOWN"},fundingAllocations:[],preference:"FASTEST"},
    ...(outbound.route?{route:{version:"composer-mobility-route@v1",vehicleRef:outbound.route.vehicleRef,
      ...(outbound.route.manualFuelPrice?{manualFuelPrice:outbound.route.manualFuelPrice}:{}),
      stops:outbound.destination&&outbound.origin?[stopForPlace(outbound.destination,"Départ du retour","DIRECT_PLACE"),stopForPlace(outbound.origin,"Arrivée du retour","ROOT_PLACE")]:[]}}:{}),
  }]}}};
}
