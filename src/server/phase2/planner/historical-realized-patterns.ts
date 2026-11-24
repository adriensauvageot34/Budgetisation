import "server-only";
import Big from "big.js";
import type { MobilityLegFact } from "@/analytics/facts";
import { realizedPlaceKey, type RealizedPlace } from "./realized-places";
import type { JulyParticipant } from "./july-realized-decisions";

const carCosts = new Set(["carburant", "pieces_entretien_automobile", "reparation_entretien_voiture", "controle_technique", "assurance_automobile"]);
const manonMerchants = new Set(["netflix", "max", "disney", "disney_plus", "sephora", "cercle_de_la_vap"]);
const adrienMerchants = new Set(["qobuz", "openai", "chatgpt", "dbha_coiff", "coiffeur_paiement_en_especes"]);
const sharedMerchants = new Set(["sfr", "google_one", "edf", "pacifica"]);
export const historicalProjectTags = [
  "Contexte:projet_photo", "Contexte:projet_seance_photo", "Contexte:univers_musique_adrien", "Contexte:projet_suno_manon",
] as const;

export function historicalPaymentParticipant(input: {
  merchant: string; bankLabel: string; subcategory: string; fixed: boolean;
  flow: string; preciseType?: string; tags?: readonly string[];
}): JulyParticipant | undefined {
  const { merchant, subcategory, fixed, bankLabel, flow, tags } = input;
  const suffix = subcategory.split("__").at(-1) ?? "";
  if (flow === "income" && suffix === "salaire_revenu_professionnel") {
    return merchant === "promotrans" ? "Manon" : merchant === "digital_learning_contest" ? "Adrien" : undefined;
  }
  if (flow === "transfer" && ["avance_personnelle", "avance_recue", "remboursement_d_avance", "pret"].includes(suffix)) return "Couple";
  if (flow !== "expense") return undefined;
  if (tags?.includes("Contexte:projet_suno_manon")) return "Manon";
  if (tags?.some(tag => tag === "Contexte:projet_photo" || tag === "Contexte:projet_seance_photo" || tag === "Contexte:univers_musique_adrien")) return "Adrien";
  const descriptor = realizedPlaceKey(bankLabel);
  if (suffix === "titres_restaurant") return /\bswile\b/u.test(descriptor) ? "Adrien"
    : /\bedenred\b/u.test(descriptor) ? "Manon" : undefined;
  if (suffix === "stockage_cloud_service_ia" && merchant === "google_one" || /\bgoogle ai pro\b/u.test(descriptor)) return "Adrien";
  if (subcategory.startsWith("permis_de_conduire__") || suffix === "alertes_sms" || adrienMerchants.has(merchant)) return "Adrien";
  if (carCosts.has(suffix) || manonMerchants.has(merchant) || ["epilation", "vape", "cigarette_electronique"].includes(suffix)) return "Manon";
  const product = realizedPlaceKey(input.preciseType ?? "");
  if (/\b(?:cire coiffante|cire cheveux)\b/u.test(product)) return "Adrien";
  if (/\b(?:benefit badgal bang|sephora.*chocolate brown)\b/u.test(product)) return "Manon";
  if (merchant === "uber_eats" || fixed || sharedMerchants.has(merchant) || subcategory === "voyages__hebergement"
    || ["courses_alimentaires", "bureau_de_tabac_presse"].includes(suffix)) return "Couple";
}

export function groceryShopper(place: RealizedPlace | undefined, purchaseType: string, bankLabel: string) {
  const branch = realizedPlaceKey([place?.label, place?.address, place?.town].filter(Boolean).join(" "));
  const statement = realizedPlaceKey(bankLabel);
  const type = realizedPlaceKey(purchaseType);
  if (/\bgrand frais\b/u.test(branch) || /\bgrand frais\b/u.test(statement)) {
    if (/\b(?:321.*georges freche|castelnau le lez|rives du lez)\b/u.test(branch)) return "Adrien";
    if (/\b(?:3056.*etienne mehul|montpellier sud)\b/u.test(branch)) return "Manon";
  }
  if (/\b(?:petites? courses?|depannage)\b/u.test(type)) return "Adrien";
  if (/\b(?:grosses? courses?|grand panier)\b/u.test(type)) return "Manon";
}

export function historicalMealPerson(place: RealizedPlace | undefined) {
  if (!place || place.certainty === "town") return undefined;
  const key = realizedPlaceKey([place.label, place.town, place.address].filter(Boolean).join(" "));
  if (/\b(?:boulangerie ange|marie blachere)\b.*\bcastelnau le lez\b/u.test(key)) return "Adrien";
  if (/\bmarie blachere\b.*\b(?:montpellier sud|etienne mehul)\b/u.test(key)) return "Manon";
}

export function isUberRide(merchant: string, subcategory: string) {
  return merchant === "uber" && subcategory === "transport_voiture__vtc_taxi";
}

export function groceryDetour(day: string, place: RealizedPlace, legs: readonly MobilityLegFact[]) {
  const ordered = legs.filter(leg => leg.date === day && leg.time.observedTime)
    .sort((a, b) => a.time.observedTime!.localeCompare(b.time.observedTime!));
  const stops = ordered.flatMap((inbound, index) => {
    const outbound = ordered[index + 1];
    if (!outbound || inbound.destination.placeId !== place.key || outbound.origin.placeId !== place.key
      || inbound.vehicleId !== outbound.vehicleId || !inbound.origin.placeId || !outbound.destination.placeId
      || inbound.origin.placeId === outbound.destination.placeId || inbound.routeMethodRef !== outbound.routeMethodRef) return [];
    const minutes = (Date.parse(`${outbound.time.observedTime}Z`) - Date.parse(`${inbound.time.observedTime}Z`)) / 60_000;
    if (!(minutes > 0 && minutes <= 180)) return [];
    return [{ inbound, outbound }];
  });
  if (stops.length !== 1) return undefined;
  const { inbound, outbound } = stops[0]!;
  const direct = legs.filter(leg => leg.vehicleId === inbound.vehicleId && leg.routeMethodRef === inbound.routeMethodRef
    && leg.origin.placeId === inbound.origin.placeId && leg.destination.placeId === outbound.destination.placeId)
    .map(leg => new Big(leg.distanceKm)).sort((a, b) => a.cmp(b));
  if (!direct.length) return undefined;
  const middle = Math.floor(direct.length / 2);
  const baseline = direct.length % 2 ? direct[middle]! : direct[middle - 1]!.plus(direct[middle]!).div(2);
  const via = new Big(inbound.distanceKm).plus(outbound.distanceKm);
  const extra = via.minus(baseline);
  if (extra.lte(0)) return undefined;
  return { distance: extra.toFixed(2), fuel: new Big(inbound.estimatedFuelCost).plus(outbound.estimatedFuelCost).times(extra).div(via).toFixed(2) };
}
