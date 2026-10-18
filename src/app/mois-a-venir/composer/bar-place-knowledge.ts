import type { PlannedPlaceOption, PlannedPlaceKnowledge } from "@/domain/phase2/planned-places";
import { derivePlannedPlaceRoles } from "@/domain/phase2/planned-place-rules";
import {barSearchText} from "./bar-search";
import type {ProspectivePlaceRef} from "@/domain/phase2/planned-contract";

/** Presentation ranking of owner observations, never a prediction or decision. */
export function barPlaces(places: readonly PlannedPlaceOption[], query = "") {
  const needle = barSearchText(query);
  return places.filter(place => !place.privatePlace && (derivePlannedPlaceRoles(place).includes("BAR") || !!needle)
    && barSearchText(`${place.name} ${place.commune ?? ""} ${place.address ?? ""}`).includes(needle))
    .sort((a, b) => (b.visits12Months ?? 0) - (a.visits12Months ?? 0)
      || (b.lastVisitDate ?? "").localeCompare(a.lastVisitDate ?? "")
      || a.name.localeCompare(b.name, "fr") || a.placeId.localeCompare(b.placeId));
}
export function barPlaceHint(place: PlannedPlaceOption, knowledge?: PlannedPlaceKnowledge) {
  const location = [place.commune, place.address].filter(Boolean).join(" · ") || `Réf. ${place.placeId.slice(-6)}`;
  return knowledge && (place.visits12Months ?? 0) > 0
    ? `${location} · ${place.visits12Months} jour(s) enregistré(s) · dernier ${place.lastVisitDate ?? "à préciser"}`
    : `${location} · historique non établi`;
}
export function barHomePlaces(places: readonly PlannedPlaceOption[]) {
  return places.filter(place => derivePlannedPlaceRoles({...place, relationships: []}).includes("OWN_HOME")
    || place.currentRelationships?.some(link => ["PRIMARY_HOME", "HOUSEHOLD_HOME"].includes(link.role)));
}
export function barEndpointPlaces(places: readonly PlannedPlaceOption[], persons: readonly {personId: string; displayName: string}[]) {
  return places.flatMap(place => {
    if (barHomePlaces([place]).length) return [{place, hint: "Maison enregistrée · choix explicite"}];
    const work = place.currentRelationships?.find(link => link.role === "PRIMARY_WORK" && persons.some(p => p.personId === link.personId));
    if (work) return [{place, hint: `Travail de ${persons.find(p => p.personId === work.personId)!.displayName} · lien actuel`}];
    const contact = place.currentRelationships?.find(link => ["FATHER_HOME", "MATERNAL_FAMILY_HOME", "SOCIAL_ANCHOR"].includes(link.role)
      && persons.some(p => p.personId === link.personId));
    if (contact) return [{place, hint: `Lieu lié à ${persons.find(p => p.personId === contact.personId)!.displayName} · choix explicite`}];
    if (!place.privatePlace) return [{place, hint: [place.commune, place.address ?? `Réf. ${place.placeId.slice(-6)}`].filter(Boolean).join(" · ")}];
    return [];
  }).sort((a, b) => Number(b.hint.startsWith("Maison")) - Number(a.hint.startsWith("Maison"))
    || Number(b.hint.startsWith("Travail")) - Number(a.hint.startsWith("Travail"))
    || a.place.name.localeCompare(b.place.name, "fr") || a.place.placeId.localeCompare(b.place.placeId));
}

/** Role-aware suggestions only. Search exposes every admissible candidate; no choice is admitted here. */
export function barEndpointSuggestions(places:readonly PlannedPlaceOption[],persons:readonly {personId:string;displayName:string}[],
  direction:"outbound"|"return",endpoint:"origin"|"destination",other:ProspectivePlaceRef|null|undefined,venue:ProspectivePlaceRef|undefined,query="",all=false){
  const needle=barSearchText(query),towardVenue=direction==="outbound"?endpoint==="destination":endpoint==="origin";
  return barEndpointPlaces(places,persons).filter(({place})=>other?.kind!=="KNOWN"||place.placeId!==other.placeId)
    .filter(({place,hint})=>needle?barSearchText(`${place.name} ${place.commune??""} ${place.address??""}`).includes(needle)
      :all||towardVenue&&venue?.kind==="KNOWN"&&place.placeId===venue.placeId||/^(Maison|Travail|Lieu lié)/u.test(hint))
    .filter(({place})=>!!needle||all||towardVenue||venue?.kind!=="KNOWN"||place.placeId!==venue.placeId)
    .sort((a,b)=>Number(towardVenue&&venue?.kind==="KNOWN"&&b.place.placeId===venue.placeId)-Number(towardVenue&&venue?.kind==="KNOWN"&&a.place.placeId===venue.placeId));
}
