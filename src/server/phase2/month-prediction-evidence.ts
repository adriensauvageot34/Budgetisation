import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCanonicalHouseholdScope } from "@/analytics/facts";
import { REFERENCE_SUBCATEGORIES, type EconomicReferenceEntry, type MobilityReferenceLeg } from "./month-reference";
import type { MonthPredictionEvidence } from "./remaining-month-forecast";

/** Read-only canonical facts, attached after parsing the published snapshot.
 * Legacy operations have no household_id: the existing singleton scope control
 * must pass before reading them. Never use a client filter as authorization. */
export async function readMonthPredictionEvidence(client: SupabaseClient, householdId: string,
  targetMonth: string): Promise<MonthPredictionEvidence> {
  const scope = await client.from("canonical_household_scope_control").select("household_count,household_id,status").limit(2);
  if (scope.error) throw scope.error;
  if (scope.data?.length !== 1 || parseCanonicalHouseholdScope(scope.data[0]) !== householdId)
    throw new TypeError("MONTH_PREDICTION_CANONICAL_SCOPE_INVALID");
  const latest = await client.from("operations").select("date_bancaire").lt("date_bancaire", `${targetMonth}-01`)
    .order("date_bancaire", { ascending: false }).limit(1).maybeSingle();
  if (latest.error) throw latest.error;
  const endMonth = latest.data?.date_bancaire?.slice(0, 7);
  if (!endMonth) throw new TypeError("MONTH_PREDICTION_HISTORY_MISSING");
  const first = new Date(`${endMonth}-01T12:00:00Z`); first.setUTCMonth(first.getUTCMonth() - 11);
  const end = new Date(`${targetMonth}-01T12:00:00Z`); end.setUTCMonth(end.getUTCMonth() + 1);
  const startDate = first.toISOString().slice(0, 10), endExclusive = end.toISOString().slice(0, 10);
  const [subcategory, people] = await Promise.all([
    client.from("subcategories").select("subcategory_id,nom_canonique").in("nom_canonique", [...REFERENCE_SUBCATEGORIES]),
    client.from("persons").select("person_id,display_name").eq("household_id", householdId),
  ]);
  if (subcategory.error) throw subcategory.error;
  if (people.error) throw people.error;
  const names = new Map((subcategory.data ?? []).map(r => [r.subcategory_id, r.nom_canonique]));
  const operations: { operation_id: string; date_bancaire: string; personne_concernee: string | null;
    type_precis: string | null; marchand: string | null }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await client.from("operations").select("operation_id,date_bancaire,personne_concernee,type_precis,marchand")
      .gte("date_bancaire", startDate).lt("date_bancaire", endExclusive).order("operation_id").range(offset, offset + 999);
    if (result.error) throw result.error;
    operations.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 1000) break;
  }
  const byId = new Map(operations.map(r => [r.operation_id, r]));
  const rows: EconomicReferenceEntry[] = [];
  // The singleton canonical scope authorizes this view. Page relevant components
  // once, then retain only operations in the authorized observation window.
  // Avoid one remote request per small operation-ID batch on every Preview.
  for (let offset = 0; ; offset += 1000) {
    const result = await client.from("financial_economic_cost_canonical")
      .select("operation_id,subcategory_id,canonical_economic_net,canonical_component_key")
      .in("subcategory_id", [...names.keys()])
      .order("canonical_component_key").range(offset, offset + 999);
    if (result.error) throw result.error;
    for (const cost of result.data ?? []) {
      const operation = byId.get(cost.operation_id), name = names.get(cost.subcategory_id);
      if (operation && name && Number(cost.canonical_economic_net) >= 0) rows.push({ operationId: cost.operation_id,
        date: operation.date_bancaire, amount: String(cost.canonical_economic_net), subcategory: name,
        person: operation.personne_concernee, preciseType: operation.type_precis, merchant: operation.marchand });
    }
    if ((result.data?.length ?? 0) < 1000) break;
  }
  const legs: MobilityReferenceLeg[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await client.from("mobility_legs").select("travel_date,origin_source_label,destination_source_label,estimated_fuel_cost,mobility_leg_id")
      .eq("household_id", householdId).eq("status", "CERTIFIED_SOURCE")
      .gte("travel_date", startDate).lt("travel_date", endExclusive).order("mobility_leg_id").range(offset, offset + 999);
    if (result.error) throw result.error;
    for (const leg of result.data ?? []) if (leg.estimated_fuel_cost !== null) legs.push({ date: leg.travel_date,
      origin: leg.origin_source_label, destination: leg.destination_source_label, fuelCost: String(leg.estimated_fuel_cost) });
    if ((result.data?.length ?? 0) < 1000) break;
  }
  const isHistory = (date: string) => date.slice(0, 7) <= endMonth;
  return { history: { startMonth: startDate.slice(0, 7), endMonth,
    economicEntries: rows.filter(r => isHistory(r.date)), mobilityLegs: legs.filter(l => isHistory(l.date)) },
    currentEconomicEntries: rows.filter(r => r.date.startsWith(targetMonth)),
    currentMobilityLegs: legs.filter(r => r.date.startsWith(targetMonth)),
    observedThrough: operations.map(r => r.date_bancaire).sort().at(-1) ?? null,
    personNamesById: Object.fromEntries((people.data ?? []).map(p => [p.person_id, p.display_name])) };
}
