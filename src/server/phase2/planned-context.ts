import "server-only";

import Big from "big.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import { SOCIAL_CONTACTS_V1 } from "@/domain/phase2/planned-rules";
import { derivePlannedPlaceRoles } from "@/domain/phase2/planned-place-rules";
import type { PlannedPriceSuggestion, PlannedVehicleEstimate } from "@/domain/phase2/planned-contract";
import { calculateRouteFuel, type HistoricalRouteLeg } from "@/domain/phase2/planned-routes";
export type { PlannedVehicleEstimate };

async function readVehicleLegs(client: SupabaseClient, householdId: string, vehicleId: string) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("mobility_legs")
      .select("origin_place_id,destination_place_id,distance_km,estimated_fuel_liters,route_method_ref,travel_date")
      .eq("household_id", householdId).eq("vehicle_id", vehicleId).gt("distance_km", 0)
      .order("mobility_leg_id").range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data ?? []);
    if ((data?.length ?? 0) < 1000) break;
  }
  return rows;
}

export async function readPlannedContextOptions(client: SupabaseClient, householdId: string,
  persons: readonly { personId: string; displayName: string }[]): Promise<{
    places: PlannedPlaceOption[]; vehicle: PlannedVehicleEstimate | null; prices: PlannedPriceSuggestion[] }> {
  const { data: vehicles, error: vehicleError } = await client.from("vehicles")
    .select("vehicle_id,label,fuel_type,consumption_l_100km")
    .eq("household_id", householdId).eq("status", "active").order("valid_from", { ascending: false }).limit(5);
  if (vehicleError) throw vehicleError;
  const vehicle = vehicles?.[0];
  const [placesResult, rolesResult, legsResult, pricesResult, productResult] = await Promise.all([
    client.from("referentiel_lieu").select("place_id,nom_canonique,commune,nature_lieu,usage_principal,sous_type,private_place")
      .order("nom_canonique").limit(500),
    persons.length ? client.from("person_place_roles").select("person_id,place_id,role")
      .in("person_id", persons.map((person) => person.personId)) : Promise.resolve({ data: [], error: null }),
    vehicle ? readVehicleLegs(client, householdId, vehicle.vehicle_id).then((data) => ({ data, error: null }))
      : Promise.resolve({ data: [], error: null }),
    vehicle ? client.from("fuel_price_observations")
      .select("price_per_liter,observed_at,quality").eq("fuel_type", vehicle.fuel_type)
      .order("observed_at", { ascending: false }).limit(1) : Promise.resolve({ data: [], error: null }),
    persons.length ? client.from("product_observations")
      .select("need_key,date_achat,montant_paye")
      .in("person_id", persons.map((person) => person.personId))
      .in("need_key", ["maquillage_manon_mascara", "maquillage_manon_sourcils"])
      .lte("date_achat", new Date().toISOString().slice(0, 10))
      .order("date_achat", { ascending: false }).limit(20) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [placesResult, rolesResult, legsResult, pricesResult, productResult]) if (result.error) throw result.error;
  const roles = rolesResult.data ?? [];
  const places: PlannedPlaceOption[] = (placesResult.data ?? []).map((place) => ({
    placeId: place.place_id, name: place.nom_canonique, commune: place.commune,
    nature: place.nature_lieu, usage: place.usage_principal, subtype: place.sous_type,
    privatePlace: place.private_place,
    relationships: roles.filter((role) => role.place_id === place.place_id).flatMap((role) => {
      const person = persons.find((candidate) => candidate.personId === role.person_id);
      return person ? [{ personName: person.displayName, role: role.role }] : [];
    }),
  })).filter((place) => !place.privatePlace || derivePlannedPlaceRoles(place).includes("OWN_HOME") || place.relationships.length > 0
    || SOCIAL_CONTACTS_V1.some((contact) => contact.places.some((link) => link.placeId === place.placeId)));
  let estimatedVehicle: PlannedVehicleEstimate | null = null;
  if (vehicle && pricesResult.data?.[0]) {
    const legs = legsResult.data ?? [];
    const distance = legs.reduce((sum, leg) => sum.plus(leg.distance_km ?? 0), new Big(0));
    const liters = legs.reduce((sum, leg) => sum.plus(leg.estimated_fuel_liters ?? 0), new Big(0));
    const consumption = vehicle.consumption_l_100km ? new Big(vehicle.consumption_l_100km)
      : distance.gt(0) ? liters.times(100).div(distance) : null;
    if (consumption && consumption.gt(0)) {
      const price = pricesResult.data[0];
      estimatedVehicle = { label: vehicle.label, consumptionL100Km: consumption.round(3).toFixed(3),
        fuelPricePerLiter: new Big(price.price_per_liter).toFixed(3),
        fuelPriceObservedAt: price.observed_at, fuelPriceQuality: price.quality,
        fuelPriceSource: `Estimation · dernier prix ${new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(price.observed_at))}` };
    }
  }
  const assetByNeed: Record<string, string> = {
    maquillage_manon_mascara: "beauty:mascara", maquillage_manon_sourcils: "beauty:eyebrow_pencil",
  };
  const known = new Set<string>();
  const prices: PlannedPriceSuggestion[] = (productResult.data ?? []).flatMap((row) => {
    const assetKey = assetByNeed[row.need_key];
    if (!assetKey || known.has(assetKey) || !row.montant_paye || new Big(row.montant_paye).lte(0)) return [];
    known.add(assetKey);
    return [{ assetKey, unitAmount: new Big(row.montant_paye).toFixed(2),
      sourceLabel: `Dernier achat observé · ${new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${row.date_achat}T12:00:00Z`))}` }];
  });
  return { places, vehicle: estimatedVehicle, prices };
}

export async function readPlannedRouteHistory(client: SupabaseClient, householdId: string): Promise<HistoricalRouteLeg[]> {
  const { data: vehicles, error } = await client.from("vehicles").select("vehicle_id")
    .eq("household_id", householdId).eq("status", "active").order("valid_from", { ascending: false }).limit(1);
  if (error) throw error;
  if (!vehicles?.[0]) return [];
  // Full paginated history: a recent slice is not the authority for a directed median.
  return (await readVehicleLegs(client, householdId, vehicles[0].vehicle_id)).flatMap((leg): HistoricalRouteLeg[] =>
    leg.origin_place_id && leg.destination_place_id && leg.estimated_fuel_liters !== null
      ? [{ originPlaceId: leg.origin_place_id, destinationPlaceId: leg.destination_place_id,
        distanceKm: String(leg.distance_km), fuelLiters: String(leg.estimated_fuel_liters),
        method: leg.route_method_ref, date: leg.travel_date }] : []);
}

export function estimatePlannedCarRoute(stops: readonly { label?: string; distanceToNextKm?: string | null }[],
  vehicle: PlannedVehicleEstimate) {
  return calculateRouteFuel(stops.map((stop, index) => ({ ...stop, label: stop.label ?? `Étape ${index + 1}` })), vehicle);
}
