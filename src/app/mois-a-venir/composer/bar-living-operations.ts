import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import {stopForPlace} from "@/domain/phase2/planned-routes";
import {parseNightOutVenue,venueBinding,sameVenuePlace,type NightOutVenueDecision} from "@/domain/phase2/planner/night-out-venue";

export type BarTarget = "place" | "date" | "people" | "drinks" | "before" | "outbound" | "return" | "summary" | "quick" | `component:${string}:${string}` | `route:${"outbound"|"return"}:${"origin"|"destination"|"fare"|"vehicle"}`;
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
export function barEndpoint(leg: BarLeg, key: "origin" | "destination", place: ProspectivePlaceRef | null,
  priceChoice?: "UNKNOWN" | "RETAIN_MANUAL"): BarLeg {
  const {venueEndpoints,...independent}=leg;
  const retained={...venueEndpoints};delete retained[key];
  const unbound:BarLeg=venueEndpoints?{...independent,...(Object.keys(retained).length?{venueEndpoints:retained}:{})}:leg;
  if (samePlace(leg[key], place)) {if(unbound!==leg)assertBarRouteEditable(leg);return unbound;}
  assertBarRouteEditable(leg);
  const boundary = key === "origin" ? leg.route?.stops[0] : leg.route?.stops.at(-1);
  if (boundary && (!leg[key] || !samePlace(leg[key], boundary.placeId
    ? {kind:"KNOWN",placeId:boundary.placeId} : {kind:"TEXT",label:boundary.label})))
    throw Error("Le point du trajet et son arrêt détaillé ne correspondent pas. Rééditez les arrêts dans les options détaillées ; aucun arrêt n’est remplacé.");
  if (leg.pricing?.fundingAllocations.length)
    throw Error("Ce trajet possède un financement. Rééditez ce financement et son périmètre dans les options détaillées avant de changer le point ; il est conservé.");
  const affectedCosts = barEndpointCosts(leg, key);
  if (affectedCosts.length && !priceChoice)
    throw Error(`Ce changement affecte ${affectedCosts.join(", ")}. Choisissez explicitement les prix à préciser avant de modifier le trajet.`);
  if (priceChoice === "RETAIN_MANUAL" && (leg.pricing?.fare.kind !== "MANUAL" || affectedCosts.length !== 1))
    throw Error("Ce prix ne peut pas être repris seul. Les autres coûts nécessitent une décision dans les options détaillées.");
  if (!place && (leg.returnRequired || (leg.route?.stops.length ?? 0)>2))
    throw Error("Ce trajet contient un aller-retour ou des arrêts intermédiaires. Choisissez un lieu de remplacement ou rééditez le trajet détaillé ; ses arrêts sont conservés.");
  const affected = new Set(leg.route?.stops.flatMap((stop,index) => key === "origin" ? index===0 || leg.returnRequired && index===leg.route!.stops.length-1?[index]:[]
    : leg.returnRequired ? stop.endpointSource==="ROOT_PLACE"?[index]:[] : index===leg.route!.stops.length-1?[index]:[]) ?? []);
  const route=leg.route&&{...leg.route,...(leg.route.toll?{toll:{kind:"UNKNOWN" as const}}:{}),stops:!place?[]:leg.route.stops.map((stop,index)=>{
    if(affected.has(index))return place?stopForPlace(place,place.kind==="TEXT"?place.label:"Lieu enregistré",stop.endpointSource??"DIRECT_PLACE",stop.childModule):{label:"",endpointSource:stop.endpointSource};
    if(affected.has(index+1)){const {distanceToNextKm:_d,distanceSource:_s,estimatedFuelLiters:_l,evidence:_e,...intent}=stop;return intent;}
    return stop;
  })};
  return {...unbound, [key]: place, ...(route?{route}:{}), ...(leg.pricing?{pricing:{...leg.pricing,
    fare:priceChoice==="RETAIN_MANUAL"?leg.pricing.fare:{kind:"UNKNOWN" as const},
    // Parking at the unchanged destination does not depend on a new origin.
    parking:key==="origin"?leg.pricing.parking:{kind:"UNKNOWN" as const}}}:{})};
}
/** Only an admitted explicit decision establishes this relationship. Equal
 * labels or Canonical IDs alone never authorize an endpoint replacement. */
export function barVenueAdaptations(context:PlannedContextState){
  const current=context.fields.venueDecision?parseNightOutVenue(context.fields.venueDecision):null;
  return (["outbound","return"] as const).flatMap(slot=>barItems(context,slot).flatMap(item=>item.kind!=="MOBILITY_INTENT"?[]:(["origin","destination"] as const).flatMap(key=>{
    const binding=item.venueEndpoints?.[key];return current&&binding?.venue.decisionId===current.decisionId&&sameVenuePlace(binding.venue.place,item[key])?[{slot,key,leg:item}]:[];
  })));
}
export function barPlaceOperation(context: PlannedContextState, place: ProspectivePlaceRef,decision?:NightOutVenueDecision,adapt=false): ComposerOperation {
  const venue=decision?parseNightOutVenue(decision):null;if(venue&&!sameVenuePlace(place,venue.place))throw new TypeError("NIGHT_OUT_VENUE_CONTEXT_INVALID");
  const slots:Partial<Record<"outbound"|"return",readonly ComponentSelectionV1[]>>={};
  if(adapt){if(!venue)throw new TypeError("NIGHT_OUT_VENUE_REQUIRED");for(const change of barVenueAdaptations(context)){
    const items=slots[change.slot]??barItems(context,change.slot);
    slots[change.slot]=items.map(item=>{if(item.kind!=="MOBILITY_INTENT"||item.selectionId!==change.leg.selectionId)return item;
      const updated=barEndpoint(item,change.key,place,"UNKNOWN");return {...updated,venueEndpoints:{...updated.venueEndpoints,[change.key]:venueBinding(venue)}};});}}
  return {kind:"EDIT_NIGHT_OUT", edit:{contextOccurrenceId:context.contextOccurrenceId, fields:{placeRef:place,...(venue?{venueDecision:venue}:{})},...(adapt?{slots}:{})}};
}
export function assertBarRouteEditable(leg: BarLeg) {
  if (leg.journey && (leg.journey.relation !== "OWNS_JOURNEY" || leg.journey.targetIntentId
    || leg.journey.externalExpenseId || leg.journey.externalCostLineIds.length))
    throw Error("Ce trajet est lié à un propriétaire externe ou à une relation spécifique. Utilisez la relation détaillée ; aucun trajet payant local ne sera créé.");
  if (leg.returnRequired)
    throw Error("Cet ancien trajet couvre un aller-retour. Utilisez son édition détaillée ; tous ses arrêts et prix sont conservés.");
}
export function barEndpointCosts(leg: BarLeg, key: "origin" | "destination"): string[] {
  return [leg.pricing?.fare && leg.pricing.fare.kind!=="UNKNOWN" ? "le tarif du billet ou de la course" : null,
    key==="destination" && leg.pricing?.parking && leg.pricing.parking.kind!=="UNKNOWN" ? "le stationnement à l’arrivée" : null,
    leg.route?.toll && leg.route.toll.kind!=="UNKNOWN" ? "le péage de cet itinéraire" : null].filter((value):value is string=>value!==null);
}
/** Explicit reversal of one simple leg; independent return and identity are untouched. */
export function barReverseLeg(leg:BarLeg):BarLeg {
  assertBarRouteEditable(leg);
  if(!leg.origin||!leg.destination||(leg.route?.stops.length??0)>2)
    throw Error("Précisez les deux points ; les trajets à étapes se rééditent dans leurs options détaillées.");
  const reversed=barEndpoint(barEndpoint(leg,"origin",leg.destination,"UNKNOWN"),"destination",leg.origin,"UNKNOWN");
  return {...reversed,...(leg.venueEndpoints?{venueEndpoints:{...(leg.venueEndpoints.destination?{origin:leg.venueEndpoints.destination}:{}),...(leg.venueEndpoints.origin?{destination:leg.venueEndpoints.origin}:{})}}:{})};
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
    ...(outbound.venueEndpoints?{venueEndpoints:{...(outbound.venueEndpoints.destination?{origin:outbound.venueEndpoints.destination}:{}),...(outbound.venueEndpoints.origin?{destination:outbound.venueEndpoints.origin}:{})}}:{}),
    journey:{relation:"OWNS_JOURNEY",certainty:"CERTAIN",targetIntentId:null,externalExpenseId:null,
      externalCostLineIds:[],choice:null,stopIndex:null,accessLegIndex:null},
    pricing:{fare:{kind:"UNKNOWN"},parking:{kind:"UNKNOWN"},fundingAllocations:[],preference:"FASTEST"},
    ...(outbound.route?{route:{version:"composer-mobility-route@v1",vehicleRef:outbound.route.vehicleRef,
      ...(outbound.route.manualFuelPrice?{manualFuelPrice:outbound.route.manualFuelPrice}:{}),
      stops:outbound.destination&&outbound.origin?[stopForPlace(outbound.destination,"Départ du retour","DIRECT_PLACE"),stopForPlace(outbound.origin,"Arrivée du retour","ROOT_PLACE")]:[]}}:{}),
  }]}}};
}
