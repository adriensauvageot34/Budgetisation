import "server-only";

import Big from "big.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonalMobilitySummary } from "@/analytics/global-v2/personal-mobility";

export const PERSONA_EDITORIAL_SCHEMA_VERSION = "persona-editorial@v1" as const;

// Explicit contract-to-household-vehicle association confirmed for this
// editorial portrait. Amounts, periods and lifecycle remain owner-derived.
const carInsuranceSeriesKeys = {
  historical: "ornikar-assurances-assurances-assurance-automobile",
  current: "pacifica-assurances-assurance-automobile-contrat-140394759",
  refundedIsolated: "pacifica-assurances-auto-contrat-140804629",
} as const;

type Row = Record<string, unknown>;
type Query = PromiseLike<{ data: unknown; error: { message: string } | null }>;

const str = (row: Row, key: string): string => row[key] == null ? "" : String(row[key]);
const num = (row: Row, key: string): Big => new Big(str(row, key) || "0");
const money = (value: Big): string => value.round(2).toFixed(2);
const sum = (values: readonly Big[]): Big => values.reduce((total, value) => total.plus(value), new Big(0));
const spent = (rows: readonly Row[]): Big => sum(rows.map((row) => num(row, "montant")).filter((value) => value.lt(0)).map((value) => value.abs()));
const date = (row: Row): string => str(row, "date_transaction_reelle") || str(row, "date_bancaire");
const sortedDates = (values: readonly string[]): readonly string[] => [...values].filter(Boolean).sort();
const period = (values: readonly string[]) => { const dates = sortedDates(values); return dates.length ? { first: dates[0]!, last: dates.at(-1)! } : null; };
const countDays = (values: readonly string[]): number => new Set(values.filter(Boolean)).size;
const monthCounts = (values: readonly string[]) => Object.fromEntries([...new Set(values.map((value) => value.slice(0, 7)))].sort().map((month) => [month, values.filter((value) => value.startsWith(month)).length]));
const monthCosts = (rows: readonly Row[]) => Object.fromEntries([...new Set(rows.map((row) => date(row).slice(0, 7)))].sort().map((key) => [key, money(spent(rows.filter((row) => date(row).startsWith(key))))]));
const monthSpan = (first: string, last: string): number => {
  const start = new Date(`${first.slice(0, 7)}-01T00:00:00Z`);
  const end = new Date(`${last.slice(0, 7)}-01T00:00:00Z`);
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + 1;
};
const monthSegments = (values: readonly string[]) => {
  const unique = [...new Set(values.filter(Boolean))];
  const keys = [...new Set(unique.map((value) => value.slice(0, 7)))].sort();
  return Object.fromEntries(keys.map((key) => [key, [0, 1, 2, 3].map((index) => unique.some((value) => value.startsWith(key) && Math.min(3, Math.floor((Number(value.slice(8, 10)) - 1) / 7)) === index))]));
};
const median = (values: readonly Big[]): string | null => {
  const sorted = [...values].sort((a, b) => a.cmp(b));
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return money(sorted.length % 2 ? sorted[middle]! : sorted[middle - 1]!.plus(sorted[middle]!).div(2));
};
const medianGapDays = (values: readonly string[]): number | null => {
  const dates = sortedDates(values);
  if (dates.length < 2) return null;
  const gaps = dates.slice(1).map((value, index) => Math.round((Date.parse(`${value}T00:00:00Z`) - Date.parse(`${dates[index]}T00:00:00Z`)) / 86_400_000)).sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);
  return gaps.length % 2 ? gaps[middle]! : Math.round((gaps[middle - 1]! + gaps[middle]!) / 2);
};
const visitEpisodeStarts = (dates: readonly string[]): readonly string[] => {
  const days = sortedDates([...new Set(dates)]);
  return days.filter((day, index) => index === 0 || Date.parse(`${day}T00:00:00Z`) - Date.parse(`${days[index - 1]}T00:00:00Z`) > 86_400_000);
};

async function pages(makeQuery: (from: number, to: number) => Query): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await makeQuery(from, from + 499);
    if (error) throw new TypeError(`PERSONA_EDITORIAL_SOURCE_ERROR:${error.message}`);
    if (!Array.isArray(data)) throw new TypeError("PERSONA_EDITORIAL_SOURCE_INVALID");
    rows.push(...data as Row[]);
    if (data.length < 500) return rows;
  }
}

async function byIds(client: SupabaseClient, table: string, column: string, ids: readonly string[]): Promise<Row[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  const batches = [];
  for (let index = 0; index < unique.length; index += 100) batches.push(unique.slice(index, index + 100));
  const orderColumn: Readonly<Record<string, string>> = { location_occurrences: "localization_id", operations: "operation_id", operation_tags: "operation_tag_id", operation_place_canonical: "canonical_component_key", life_event_financial_links: "financial_link_id", operation_allocations: "allocation_id", financial_economic_cost_canonical: "canonical_component_key", financial_source_person_links: "financial_source_person_link_id" };
  const result = await Promise.all(batches.map((batch) => pages((from, to) => client.from(table).select("*").in(column, batch).order(orderColumn[table] ?? column).range(from, to))));
  return result.flat();
}

function recurrenceFacts(series: readonly Row[], operations: readonly Row[], seriesId: string) {
  const owner = series.find((row) => str(row, "recurrenceId") === seriesId);
  const matching = operations.filter((row) => str(row, "recurrence_series_id") === seriesId && num(row, "montant").lt(0));
  const canonical = matching.length ? period(matching.map(date)) : null;
  return {
    recurrenceRef: `recurrence:${seriesId}`,
    firstObservedAt: owner ? str(owner, "firstObservedAt") || canonical?.first || null : canonical?.first || null,
    lastObservedAt: owner ? str(owner, "lastObservedAt") || canonical?.last || null : canonical?.last || null,
    observedPaymentCount: matching.length,
    observedCumulativeCost: money(spent(matching)),
    typicalPayment: owner && typeof owner.typicalOccurrenceCost === "object" && owner.typicalOccurrenceCost !== null
      ? str(owner.typicalOccurrenceCost as Row, "value") || median(matching.map((row) => num(row, "montant").abs()))
      : median(matching.map((row) => num(row, "montant").abs())),
  };
}

export async function resolveGlobalPersonaEditorial(input: {
  readonly client: SupabaseClient;
  readonly householdId: string;
  readonly personIdsByName: Readonly<Record<string, string>>;
  readonly firstDay: string;
  readonly certifiedThrough: string;
  readonly m1Series: readonly Row[];
  readonly m2NeedGroups: readonly Row[];
  readonly mobilitySummaries: readonly PersonalMobilitySummary[];
}) {
  const adrien = input.personIdsByName.Adrien;
  const manon = input.personIdsByName.Manon;
  if (!adrien || !manon) throw new TypeError("PERSONA_EDITORIAL_PERSONS_MISSING");
  const [eventTypes, events, participations, roles, places, personDays, needs, tags, products, recurrences, vehicles, insuranceSeries, habitAssertions, profileAssertions, mobilityLegs] = await Promise.all([
    pages((from, to) => input.client.from("life_event_types").select("life_event_type_id,type_key").order("life_event_type_id").range(from, to)),
    pages((from, to) => input.client.from("life_events").select("life_event_id,life_event_type_id,title,start_date,end_date,primary_place_id,validation_status").gte("start_date", input.firstDay).lte("start_date", input.certifiedThrough).order("life_event_id").range(from, to)),
    pages((from, to) => input.client.from("life_event_participations").select("life_event_id,person_id,participation_status").in("person_id", [adrien, manon]).order("participation_id").range(from, to)),
    pages((from, to) => input.client.from("person_place_roles").select("person_id,place_id,role,valid_from,valid_to,source").in("person_id", [adrien, manon]).order("person_place_role_id").range(from, to)),
    pages((from, to) => input.client.from("referentiel_lieu").select("place_id,nom_canonique,place_key").order("place_id").range(from, to)),
    pages((from, to) => input.client.from("person_days").select("person_day_id,person_id,date").in("person_id", [adrien, manon]).gte("date", input.firstDay).lte("date", input.certifiedThrough).order("person_day_id").range(from, to)),
    pages((from, to) => input.client.from("needs").select("need_id,need_key,person_id").in("need_key", ["repas_travail_adrien", "repas_travail_manon", "vape_manon", "coiffeur_foyer", "tabac_foyer"]).order("need_id").range(from, to)),
    pages((from, to) => input.client.from("tags").select("tag_id,tag_key").in("tag_key", ["Contexte:permis_de_conduire", "Contexte:projet_photo", "Contexte:projet_seance_photo", "Contexte:voiture", "Facteur:reparation_voiture", "Facteur:controle_technique", "Contexte:univers_musique_adrien", "Contexte:projet_suno_manon"]).order("tag_id").range(from, to)),
    pages((from, to) => input.client.from("product_observations").select("observation_id,person_id,need_key,product_key,nom,date_achat,montant_paye").in("person_id", [adrien, manon]).lte("date_achat", input.certifiedThrough).order("observation_id").range(from, to)),
    pages((from, to) => input.client.from("recurrence_series").select("recurrence_series_id,cadence_estimee,statut_serie").in("recurrence_series_id", ["67657950-b736-5f73-89bc-456d207b965c", "b2abae46-3378-5f09-897c-7c44eed28073", "6ceae158-ebba-5208-9d41-85eac3bd4dde", "24c0cb89-34bf-5e2a-881d-4d4f9f7b694a", "24cefd44-463b-59fa-b232-376b5404461c"]).order("recurrence_series_id").range(from, to)),
    pages((from, to) => input.client.from("vehicles").select("vehicle_id,owner_person_id,label,status,valid_from,valid_to").eq("household_id", input.householdId).order("vehicle_id").range(from, to)),
    pages((from, to) => input.client.from("recurrence_series").select("recurrence_series_id,series_key,name,marchand_normalise,statut_serie").in("series_key", Object.values(carInsuranceSeriesKeys)).order("recurrence_series_id").range(from, to)),
    pages((from, to) => input.client.from("person_habit_assertions").select("person_habit_assertion_id,person_id,habit_key,monthly_visit_estimate,typical_visit_price,price_basis,authority").eq("household_id", input.householdId).order("person_habit_assertion_id").range(from, to)),
    pages((from, to) => input.client.from("persona_profile_assertions").select("assertion_id,person_id,assertion_key,numeric_value,authority").eq("household_id", input.householdId).order("assertion_id").range(from, to)),
    pages((from, to) => input.client.from("mobility_legs").select("mobility_leg_id,travel_date,origin_place_id,destination_place_id,estimated_fuel_cost").eq("household_id", input.householdId).gte("travel_date", input.firstDay).lte("travel_date", input.certifiedThrough).order("mobility_leg_id").range(from, to)),
  ]);
  const eventTypeById = new Map(eventTypes.map((row) => [str(row, "life_event_type_id"), str(row, "type_key")]));
  const placeById = new Map(places.map((row) => [str(row, "place_id"), row]));
  const dayById = new Map(personDays.map((row) => [str(row, "person_day_id"), str(row, "date")]));
  const participationByEvent = new Map<string, Row[]>();
  for (const row of participations) {
    const key = str(row, "life_event_id");
    const list = participationByEvent.get(key) ?? [];
    list.push(row);
    participationByEvent.set(key, list);
  }
  const active = (row: Row): boolean => ["Confirmée", "Déduite"].includes(str(row, "participation_status"));
  const attended = (event: Row, personId: string): boolean => (participationByEvent.get(str(event, "life_event_id")) ?? []).some((row) => str(row, "person_id") === personId && active(row));
  const personEvents = (personId: string, kind: string) => events.filter((row) => str(row, "validation_status") !== "À valider" && eventTypeById.get(str(row, "life_event_type_id")) === kind && attended(row, personId));
  const placeRoles = roles.filter((row) => str(row, "place_id") && placeById.has(str(row, "place_id")));
  const locations = await byIds(input.client, "location_occurrences", "place_id", placeRoles.map((row) => str(row, "place_id")));
  const visits = (personId: string, role: string) => placeRoles.filter((row) => str(row, "person_id") === personId && str(row, "role") === role).map((row) => {
    const placeId = str(row, "place_id");
    const dates = locations.filter((item) => str(item, "person_id") === personId && str(item, "place_id") === placeId)
      .map((item) => dayById.get(str(item, "person_day_id")) ?? "")
      .filter((day) => day >= input.firstDay && day <= input.certifiedThrough && (!row.valid_from || day >= str(row, "valid_from")) && (!row.valid_to || day <= str(row, "valid_to")));
    const episodes = visitEpisodeStarts(dates);
    return { placeRef: `place:${placeId}`, label: str(placeById.get(placeId)!, "nom_canonique"), presenceDays: countDays(dates), visitCount: episodes.length, monthlyPresenceDays: Object.fromEntries(Object.entries(monthCounts([...new Set(dates)])).sort()), monthlyPresenceSegments: monthSegments(episodes), period: period(dates), evidence: "CANONICAL_LOCATION_PRESENCE" as const };
  });
  const needId = (key: string): string => str(needs.find((row) => str(row, "need_key") === key) ?? {}, "need_id");
  const tagIds = tags.map((row) => str(row, "tag_id"));
  const [needOps, taggedLinks, recurrenceOps, vapeItems] = await Promise.all([
    byIds(input.client, "operations", "need_id", needs.map((row) => str(row, "need_id"))),
    byIds(input.client, "operation_tags", "tag_id", tagIds),
    byIds(input.client, "operations", "recurrence_series_id", ["67657950-b736-5f73-89bc-456d207b965c", "b2abae46-3378-5f09-897c-7c44eed28073", "6ceae158-ebba-5208-9d41-85eac3bd4dde", "24c0cb89-34bf-5e2a-881d-4d4f9f7b694a", "24cefd44-463b-59fa-b232-376b5404461c"]),
    pages((from, to) => input.client.from("operation_items").select("item_id,operation_id,need_key,nom,montant_economique,uncertain").eq("need_key", "vape_manon").order("item_id").range(from, to)),
  ]);
  const taggedOps = await byIds(input.client, "operations", "operation_id", taggedLinks.map((row) => str(row, "operation_id")));
  const allOps = [...new Map([...needOps, ...taggedOps, ...recurrenceOps].map((row) => [str(row, "operation_id"), row])).values()].filter((row) => date(row) >= input.firstDay && date(row) <= input.certifiedThrough);
  const tagKeyById = new Map(tags.map((row) => [str(row, "tag_id"), str(row, "tag_key")]));
  const tagsByOperation = new Map<string, Set<string>>();
  for (const link of taggedLinks) {
    const id = str(link, "operation_id");
    const set = tagsByOperation.get(id) ?? new Set<string>();
    set.add(tagKeyById.get(str(link, "tag_id")) ?? "");
    tagsByOperation.set(id, set);
  }
  const tagged = (prefixes: readonly string[]) => allOps.filter((row) => prefixes.some((key) => tagsByOperation.get(str(row, "operation_id"))?.has(key)));
  const opPlaceRows = await byIds(input.client, "operation_place_canonical", "operation_id", needOps.map((row) => str(row, "operation_id")));
  const placeByOperation = new Map(opPlaceRows.filter((row) => str(row, "resolution_state") === "known").map((row) => [str(row, "operation_id"), str(row, "place_id")]));
  const needSummary = (key: string) => input.m2NeedGroups.find((row) => str(row.dimension as Row ?? {}, "id") === needId(key));
  const meal = (personId: string, key: string, merchant: string) => {
    const ops = needOps.filter((row) => str(row, "need_id") === needId(key) && date(row) >= input.firstDay && date(row) <= input.certifiedThrough && num(row, "montant").lt(0));
    const anchor = placeRoles.find((row) => str(row, "person_id") === personId && str(row, "role") === "WORK_MEAL_ANCHOR");
    const anchorOps = ops.filter((row) => placeByOperation.get(str(row, "operation_id")) === str(anchor ?? {}, "place_id"));
    const merchantOps = ops.filter((row) => str(row, "marchand").normalize("NFKC").toLocaleLowerCase("fr-FR") === merchant.toLocaleLowerCase("fr-FR"));
    const merchantCost = spent(merchantOps);
    const totalCost = spent(ops);
    const months = monthSpan(input.firstDay, input.certifiedThrough);
    const owner = needSummary(key);
    const merchants = [...new Set(ops.map((row) => str(row, "marchand")).filter(Boolean))]
      .map((name) => ({ name, count: ops.filter((row) => str(row, "marchand") === name).length }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 3).map(({ name }) => name);
    return { needRef: `need:${needId(key)}`, directPurchaseCount: ops.length, directPurchaseDays: countDays(ops.map(date)), directObservedCost: money(spent(ops)), m2AnnualCost: owner ? str(owner, "annualAmount") || null : null, anchorPurchaseCount: anchorOps.length, anchorTypicalPurchase: median(anchorOps.map((row) => num(row, "montant").abs())), anchorPresence: visits(personId, "WORK_MEAL_ANCHOR")[0] ?? null, presenceIsNotPurchase: true,
      allPurchaseHabitSummary: { purchaseCount: ops.length, period: period(ops.map(date)), typicalPurchase: median(ops.map((row) => num(row, "montant").abs())), monthlyObservedCost: months > 0 ? money(totalCost.div(months)) : null, monthlyPurchaseRate: months > 0 ? Number(new Big(ops.length).div(months).round(1).toString()) : null, annualObservedCost: months === 12 ? money(totalCost) : null, merchants, monetaryBasis: "DIRECT_OBSERVED_PURCHASES_NO_PAYER_INFERENCE" as const },
      merchantHabitSummary: { merchant, purchaseCount: merchantOps.length, period: period(merchantOps.map(date)), typicalPurchase: median(merchantOps.map((row) => num(row, "montant").abs())), observedCost: money(merchantCost), monthlyObservedCost: months > 0 ? money(merchantCost.div(months)) : null, monthlyPurchaseRate: months > 0 ? Number(new Big(merchantOps.length).div(months).round(1).toString()) : null, annualObservedCost: months === 12 ? money(merchantCost) : null, monetaryBasis: "DIRECT_OBSERVED_PURCHASES_NO_PAYER_INFERENCE" as const } };
  };
  const project = (tagKeys: readonly string[]) => {
    const ops = tagged(tagKeys);
    const purchases = ops.filter((row) => num(row, "montant").lt(0));
    const refunds = ops.filter((row) => num(row, "montant").gt(0) && purchases.some((purchase) => str(row, "rembourse_operation_id") === str(purchase, "operation_id")));
    const gross = spent(purchases), linkedRefund = sum(refunds.map((row) => num(row, "montant")));
    return { purchaseCount: purchases.length, period: period(ops.map(date)), grossCost: money(gross), linkedRefund: money(linkedRefund), netCost: money(gross.minus(linkedRefund)), netCertifiedByRefundLink: refunds.length === ops.filter((row) => num(row, "montant").gt(0)).length };
  };
  const carEvents = events.filter((row) => str(row, "validation_status") !== "À valider" && eventTypeById.get(str(row, "life_event_type_id")) === "entretien_voiture");
  const carLinks = await byIds(input.client, "life_event_financial_links", "life_event_id", carEvents.map((row) => str(row, "life_event_id")));
  const linkedCarOps = await byIds(input.client, "operations", "operation_id", carLinks.map((row) => str(row, "operation_id")));
  const carTags = ["Contexte:voiture", "Facteur:reparation_voiture", "Facteur:controle_technique"];
  const vehicleOps = [...new Map([...tagged(carTags), ...linkedCarOps].filter((row) => num(row, "montant").lt(0) && date(row) >= input.firstDay && date(row) <= input.certifiedThrough).map((row) => [str(row, "operation_id"), row])).values()];
  const insuranceOps = (await byIds(input.client, "operations", "recurrence_series_id", insuranceSeries.map((row) => str(row, "recurrence_series_id"))))
    .filter((row) => num(row, "montant").lt(0) && date(row) >= input.firstDay && date(row) <= input.certifiedThrough);
  const primarySeriesKeys = new Set<string>([carInsuranceSeriesKeys.historical, carInsuranceSeriesKeys.current]);
  const primarySeries = insuranceSeries.filter((row) => primarySeriesKeys.has(str(row, "series_key")));
  const primarySeriesComplete = primarySeries.length === 2;
  const insuranceMainIds = new Set(primarySeries.map((row) => str(row, "recurrence_series_id")));
  const insuranceMainOps = insuranceOps.filter((row) => insuranceMainIds.has(str(row, "recurrence_series_id")));
  const [economicCosts, payerLinks] = await Promise.all([
    byIds(input.client, "financial_economic_cost_canonical", "operation_id", [...insuranceOps, ...vehicleOps].map((row) => str(row, "operation_id"))),
    byIds(input.client, "financial_source_person_links", "operation_id", insuranceMainOps.map((row) => str(row, "operation_id"))),
  ]);
  const economicByOperation = new Map<string, { gross: Big; refund: Big; net: Big }>();
  for (const row of economicCosts) {
    const id = str(row, "operation_id");
    const previous = economicByOperation.get(id) ?? { gross: new Big(0), refund: new Big(0), net: new Big(0) };
    economicByOperation.set(id, {
      gross: previous.gross.plus(num(row, "canonical_economic_gross")),
      refund: previous.refund.plus(num(row, "refund_applied")),
      net: previous.net.plus(num(row, "canonical_economic_net")),
    });
  }
  const costsCertified = (ops: readonly Row[]) => ops.length > 0 && ops.every((row) => {
    const cost = economicByOperation.get(str(row, "operation_id"));
    return cost !== undefined && cost.gross.minus(cost.refund).eq(cost.net) && cost.net.gte(0);
  });
  const insuranceCostsCertified = primarySeriesComplete && insuranceMainOps.length > 0 && primarySeries.every((row) => {
    const ops = insuranceMainOps.filter((operation) => str(operation, "recurrence_series_id") === str(row, "recurrence_series_id"));
    return ops.length === 0 || costsCertified(ops);
  });
  const insuranceCost = insuranceCostsCertified ? sum(insuranceMainOps.map((row) => economicByOperation.get(str(row, "operation_id"))!.net)) : null;
  const payerCertified = insuranceMainOps.length > 0 && insuranceMainOps.every((row) => {
    const links = payerLinks.filter((link) => str(link, "operation_id") === str(row, "operation_id") && str(link, "relation_type") === "payer");
    return links.length === 1 && str(links[0]!, "person_id") === manon
      && str(links[0]!, "validated_by").startsWith("USER_VALIDATED") && Boolean(str(links[0]!, "validated_at"));
  });
  const insuranceSeriesSummaries = insuranceSeries
    .filter((row) => insuranceMainIds.has(str(row, "recurrence_series_id")))
    .map((row) => {
      const id = str(row, "recurrence_series_id");
      const ops = insuranceMainOps.filter((operation) => str(operation, "recurrence_series_id") === id);
      const m1 = input.m1Series.find((series) => str(series, "recurrenceId") === id);
      const typical = m1?.typicalOccurrenceCost as Row | undefined;
      return {
        seriesRef: `recurrence:${id}`,
        provider: str(row, "marchand_normalise") || str(row, "name"),
        lifecycle: str(row, "statut_serie"),
        period: period(ops.map(date)),
        occurrenceCount: ops.length,
        monthlyCost: str(typical ?? {}, "status") === "KNOWN" ? str(typical!, "value") : null,
        periodCost: costsCertified(ops) ? money(sum(ops.map((operation) => economicByOperation.get(str(operation, "operation_id"))!.net))) : null,
      };
    }).filter((series) => series.occurrenceCount > 0)
    .sort((a, b) => (a.period?.first ?? "").localeCompare(b.period?.first ?? ""));
  const currentInsurance = insuranceSeriesSummaries.filter((series) => series.lifecycle === "Active");
  const isolatedSeriesId = str(insuranceSeries.find((row) => str(row, "series_key") === carInsuranceSeriesKeys.refundedIsolated) ?? {}, "recurrence_series_id");
  const isolatedOps = insuranceOps.filter((row) => str(row, "recurrence_series_id") === isolatedSeriesId);
  const isolatedRefundResolved = (isolatedOps.length === 0 || costsCertified(isolatedOps)) && isolatedOps.every((row) => {
    const cost = economicByOperation.get(str(row, "operation_id"))!;
    return cost.net.eq(0) && cost.gross.eq(cost.refund);
  });
  const codeEvents = personEvents(adrien, "examen_permis");
  const codeLinks = await byIds(input.client, "life_event_financial_links", "life_event_id", codeEvents.map((row) => str(row, "life_event_id")));
  const codeOps = await byIds(input.client, "operations", "operation_id", codeLinks.map((row) => str(row, "operation_id")));
  const permitOps = [...new Map([...tagged(["Contexte:permis_de_conduire"]), ...codeOps].filter((row) => num(row, "montant").lt(0) && date(row) >= input.firstDay && date(row) <= input.certifiedThrough).map((row) => [str(row, "operation_id"), row])).values()];
  const lessons = personEvents(adrien, "lecon_conduite");
  const socialOutings = (personId: string, otherId: string) => personEvents(personId, "sortie_soiree").filter((event) => !(participationByEvent.get(str(event, "life_event_id")) ?? []).some((row) => str(row, "person_id") === otherId)).map((event) => ({ date: str(event, "start_date"), title: str(event, "title"), place: str(placeById.get(str(event, "primary_place_id")) ?? {}, "nom_canonique") || null, eventRef: `life-event:${str(event, "life_event_id")}` }));
  const productCycles = products.filter((row) => str(row, "person_id") === manon).reduce((groups, row) => {
    const key = str(row, "product_key");
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
    return groups;
  }, new Map<string, Row[]>());
  const personalProducts = [...productCycles.entries()].map(([productKey, rows]) => ({ productKey, label: str([...rows].sort((a, b) => str(a, "date_achat").localeCompare(str(b, "date_achat"))).at(-1)!, "nom"), needKey: str(rows[0]!, "need_key"), purchaseCount: rows.length, typicalPrice: median(rows.map((row) => num(row, "montant_paye"))), medianGapDays: medianGapDays(rows.map((row) => str(row, "date_achat"))), period: period(rows.map((row) => str(row, "date_achat"))) })).sort((a, b) => a.productKey.localeCompare(b.productKey));
  const vapeOps = needOps.filter((row) => str(row, "need_id") === needId("vape_manon") && num(row, "montant").lt(0) && date(row) >= input.firstDay && date(row) <= input.certifiedThrough);
  const vapeAllocationRows = await byIds(input.client, "operation_allocations", "need_id", [needId("vape_manon")]);
  const vapeAllocationParents = await byIds(input.client, "operations", "operation_id", vapeAllocationRows.map((row) => str(row, "operation_id")));
  const vapeParentById = new Map(vapeAllocationParents.map((row) => [str(row, "operation_id"), row]));
  const vapeAllocations = vapeAllocationRows.filter((row) => {
    const parent = vapeParentById.get(str(row, "operation_id"));
    return parent !== undefined && date(parent) >= input.firstDay && date(parent) <= input.certifiedThrough;
  });
  const vapeAllocatedCost = sum(vapeAllocations.map((row) => num(row, "montant").abs()));
  const vapeOwner = needSummary("vape_manon");
  const vapeFirstActiveMonth = Array.isArray(vapeOwner?.historicalSeries) ? (vapeOwner.historicalSeries as Row[]).find((row) => num(row, "amount").gt(0))?.month ?? null : null;
  const vapeOwnerAnnualCost = str(vapeOwner ?? {}, "annualAmount") || null;
  const vapeReconciled = vapeOwnerAnnualCost === null ? null : new Big(vapeOwnerAnnualCost).eq(spent(vapeOps).plus(vapeAllocatedCost));
  const equipmentItems = vapeItems.filter((row) => /vaporesso|cartouche|bobine|protection.*[ée]cran/iu.test(str(row, "nom")) && !/fiole|liquide|ar[oô]me/iu.test(str(row, "nom")) && row.uncertain !== true);
  const vapeEquipmentCost = equipmentItems.length > 0 ? money(sum(equipmentItems.map((row) => num(row, "montant_economique")))) : null;
  const mobility = (personId: string, contextKind: string, presence = "ANY") => input.mobilitySummaries.find((row) => row.personId === personId && row.contextKind === contextKind && row.couplePresenceFilter.state === presence);
  const compactMobility = (summary: PersonalMobilitySummary | undefined) => summary ? { period: { first: summary.firstObservedDate, last: summary.lastObservedDate }, distinctDayCount: summary.distinctDayCount, eventCount: summary.eventCount, distanceKm: summary.distanceKm, estimatedFuelCost: summary.estimatedFuelCost, estimatedFuelCostPerDay: summary.distinctDayCount ? money(new Big(summary.estimatedFuelCost).div(summary.distinctDayCount)) : null, monetaryBasis: "ESTIMATED_FUEL_USAGE_NOT_PAID_AMOUNT" as const, support: summary.support.status, presenceFilter: summary.couplePresenceFilter.state } : null;
  const subscription = (id: string) => ({ ...recurrenceFacts(input.m1Series, allOps, id), cadence: str(recurrences.find((row) => str(row, "recurrence_series_id") === id) ?? {}, "cadence_estimee") || null, lifecycle: str(recurrences.find((row) => str(row, "recurrence_series_id") === id) ?? {}, "statut_serie") || null, usageDoesNotEstablishPayer: true });
  const netflix = subscription("6ceae158-ebba-5208-9d41-85eac3bd4dde");
  const max = subscription("24c0cb89-34bf-5e2a-881d-4d4f9f7b694a");
  const videoObservedCost = money(new Big(netflix.observedCumulativeCost).plus(max.observedCumulativeCost));
  const adrienOutings = socialOutings(adrien, manon), manonOutings = socialOutings(manon, adrien);
  const workEvent = (personId: string, type: string) => countDays(personEvents(personId, type).map((row) => str(row, "start_date")));
  const pro = personEvents(manon, "deplacement_pro");
  const hairPlaces = visits(adrien, "PERSONAL_CARE_ANCHOR");
  const hairAssertions = habitAssertions.filter((row) => str(row, "person_id") === adrien && str(row, "habit_key") === "hairdresser" && str(row, "authority") === "USER_VALIDATED" && str(row, "price_basis") === "INDICATIVE_PRICE_NOT_PAYMENT");
  if (hairAssertions.length > 1) throw new TypeError("PERSONA_HAIRDRESSER_ASSERTION_AMBIGUOUS");
  const hairAssertion = hairAssertions[0];
  const hairMonthlyFrequency = hairAssertion ? num(hairAssertion, "monthly_visit_estimate") : null;
  const hairTypicalPrice = hairAssertion ? num(hairAssertion, "typical_visit_price") : null;
  const assertion = (personId: string, key: string) => profileAssertions.find((row) => str(row, "person_id") === personId && str(row, "assertion_key") === key && str(row, "authority") === "USER_VALIDATED");
  const cigaretteAssertion = assertion(manon, "daily_cigarettes");
  const cigarettesPerDay = cigaretteAssertion?.numeric_value == null ? null : str(cigaretteAssertion, "numeric_value");
  const tobaccoOwner = needSummary("tabac_foyer");
  const tobaccoAnnualBudget = assertion(adrien, "approximate_household_tobacco_budget") && tobaccoOwner ? str(tobaccoOwner, "annualAmount") || null : null;
  const tobaccoMonthlyEstimate = tobaccoAnnualBudget === null ? null : money(new Big(tobaccoAnnualBudget).div(12));
  const householdVehicle = vehicles.find((row) => str(row, "status") === "active" && !row.owner_person_id && (!row.valid_from || str(row, "valid_from") <= input.certifiedThrough) && (!row.valid_to || str(row, "valid_to") >= input.firstDay));
  const vehicle = householdVehicle ? { vehicleRef: `vehicle:${str(householdVehicle, "vehicle_id")}`, label: str(householdVehicle, "label"), scope: "HOUSEHOLD" as const } : null;
  const maintenance = { scope: "HOUSEHOLD" as const, vehicle, period: period(vehicleOps.map(date)), operationCount: vehicleOps.length, totalIdentifiedCost: money(spent(vehicleOps)), fuelUsageExcluded: true };
  const maintenanceCertified = (vehicleOps.length === 0 || costsCertified(vehicleOps)) && money(sum(vehicleOps.map((row) => economicByOperation.get(str(row, "operation_id"))!.net))) === maintenance.totalIdentifiedCost;
  const distinctCosts = !insuranceOps.some((row) => vehicleOps.some((vehicleRow) => str(vehicleRow, "operation_id") === str(row, "operation_id")));
  const nonFuelTotalReady = insuranceCost !== null && maintenanceCertified && distinctCosts && isolatedRefundResolved;
  const workUsageSummary = compactMobility(mobility(manon, "WORK_COMMUTE"));
  const homePlace = places.find((row) => str(row, "place_key") === "domicile_adrien_manon");
  const familyRouteCost = (targetRef: string | undefined): string | null => {
    const targetId = targetRef?.replace(/^place:/u, "");
    const homeId = homePlace === undefined ? "" : str(homePlace, "place_id");
    if (!targetId || !homeId) return null;
    const outgoing = mobilityLegs.filter((row) => str(row, "origin_place_id") === homeId && str(row, "destination_place_id") === targetId).map((row) => num(row, "estimated_fuel_cost"));
    const returning = mobilityLegs.filter((row) => str(row, "origin_place_id") === targetId && str(row, "destination_place_id") === homeId).map((row) => num(row, "estimated_fuel_cost"));
    const outward = median(outgoing), inward = median(returning);
    return outward === null || inward === null ? null : money(new Big(outward).plus(inward));
  };
  const fatherVisits = visits(manon, "FATHER_HOME");
  const motherVisits = visits(manon, "MATERNAL_FAMILY_HOME");
  const friendEvents = personEvents(manon, "visite_ami").filter((row) => str(row, "primary_place_id"));
  const friendPlaceIds = [...new Set(friendEvents.map((row) => str(row, "primary_place_id")))];
  const friendVisits = friendPlaceIds.map((placeId) => {
    const matching = friendEvents.filter((row) => str(row, "primary_place_id") === placeId);
    const starts = visitEpisodeStarts(matching.map((row) => str(row, "start_date")));
    return { placeRef: `place:${placeId}`, label: str(placeById.get(placeId) ?? {}, "nom_canonique"), visitCount: starts.length, monthlyVisitSegments: monthSegments(starts) };
  }).filter((row) => row.label && row.visitCount).sort((a, b) => b.visitCount - a.visitCount || a.label.localeCompare(b.label));
  const familyVisitTotal = [...fatherVisits, ...motherVisits].reduce((total, item) => total + item.visitCount, 0);
  const insuranceSummary = {
    scope: "HOUSEHOLD_VEHICLE_WITH_PERSONAL_PAYER" as const,
    series: insuranceSeriesSummaries,
    currentProvider: currentInsurance.length === 1 ? currentInsurance[0]!.provider : null,
    currentMonthlyCost: currentInsurance.length === 1 ? currentInsurance[0]!.monthlyCost : null,
    period: period(insuranceMainOps.map(date)),
    periodCost: insuranceCost === null ? null : money(insuranceCost),
    payerPersonId: payerCertified ? manon : null,
    payerAuthority: payerCertified ? "USER_VALIDATED" as const : "UNKNOWN" as const,
    beneficiaryNotInferred: true,
    ownershipNotInferred: true,
    isolatedRefundResolved,
  };
  return {
    schemaVersion: PERSONA_EDITORIAL_SCHEMA_VERSION,
    period: { first: input.firstDay, certifiedThrough: input.certifiedThrough },
    vehicleHouseholdCost: maintenance,
    vehicle: { householdVehicle: vehicle, workUsageSummary, insuranceSummary, maintenanceSummary: maintenance, maintenanceResponsibilityPersonId: assertion(manon, "vehicle_maintenance_responsibility") ? manon : null, nonFuelCostTotal: nonFuelTotalReady ? money(insuranceCost!.plus(spent(vehicleOps))) : null, nonFuelCostTotalReady: nonFuelTotalReady, fuelUsageSeparate: true },
    persons: [
{ personId: adrien, work: { onsiteDays: workEvent(adrien, "travail_site"), remoteDays: workEvent(adrien, "teletravail"), commute: { mode: "PUBLIC_TRANSIT", directCost: "0.00", authority: "USER_VALIDATED" }, workMeals: meal(adrien, "repas_travail_adrien", "Boulangerie Ange") }, personalUniverses: { permit: { scope: "PROJECT", status: "IN_PROGRESS", period: period([...permitOps.map(date), ...lessons.map((row) => str(row, "start_date"))]), cost: money(spent(permitOps)), monthlyCost: monthCosts(permitOps), lessonsByMonth: monthCounts(lessons.map((row) => str(row, "start_date"))), codeDates: codeEvents.map((row) => str(row, "start_date")) }, photo: project(["Contexte:projet_photo", "Contexte:projet_seance_photo"]), musicHeadphones: project(["Contexte:univers_musique_adrien"]), googleAiPro: subscription("67657950-b736-5f73-89bc-456d207b965c") }, recurringHabits: { chatGptUsage: "USER_VALIDATED", qobuz: subscription("b2abae46-3378-5f09-897c-7c44eed28073"), hairdresser: { authority: "USER_VALIDATED_ROUTINE_WITH_OBSERVED_PLACE_PRESENCE", places: hairPlaces, observedPresenceDays: hairPlaces.reduce((total, place) => total + place.presenceDays, 0), personalAnnualCost: null, typicalPersonalCost: null, monthlyVisitEstimate: hairMonthlyFrequency?.toString() ?? null, typicalVisitPrice: hairTypicalPrice === null ? null : money(hairTypicalPrice), illustrativeAnnualCost: hairMonthlyFrequency === null || hairTypicalPrice === null ? null : money(hairMonthlyFrequency.times(12).times(hairTypicalPrice)), priceBasis: hairAssertion ? "INDICATIVE_PRICE_NOT_PAYMENT" as const : null }, stylingWax: { label: "Cire coiffante", repurchase: "USER_VALIDATED", price: null, observedCadenceDays: null }, tobacco: { approximateMonthlyBudget: tobaccoMonthlyEstimate, sourceAnnualBudget: tobaccoAnnualBudget, authority: tobaccoAnnualBudget === null ? "UNAVAILABLE" as const : "USER_VALIDATED_APPROXIMATE_ATTRIBUTION" as const } }, socialLife: { outingsWithoutPartnerParticipation: adrienOutings, wording: "DE_SON_COTE" } },
      {
        personId: manon,
        work: {
          onsiteDays: workEvent(manon, "travail_site"),
          primaryWorkPlaces: visits(manon, "PRIMARY_WORK"),
          workMeals: meal(manon, "repas_travail_manon", "Marie Blachère"),
          professionalInterventions: {
            eventCount: pro.length,
            byMonth: monthCounts(pro.map((row) => str(row, "start_date"))),
            contexts: pro.map((row) => ({ date: str(row, "start_date"), title: str(row, "title"), place: str(placeById.get(str(row, "primary_place_id")) ?? {}, "nom_canonique") || null })),
          },
          commute: { vehicle, strictOwnerSummary: workUsageSummary, annualRawLegEstimateNotCertified: true },
        },
        personalUniverses: { sunoFatherSong: { scope: "PROJECT", description: "Une chanson pour son père", ...project(["Contexte:projet_suno_manon"]), recurrence: subscription("24cefd44-463b-59fa-b232-376b5404461c"), novemberPaymentExcluded: true }, products: personalProducts },
        recurringHabits: { netflix, max, videoObservedCost, cigarettesPerDay, vape: { m2FirstActiveMonth: vapeFirstActiveMonth, firstDirectPurchaseAt: period(vapeOps.map(date))?.first ?? null, directPurchases: vapeOps.map((row) => ({ date: date(row), amount: money(num(row, "montant").abs()) })).sort((a, b) => a.date.localeCompare(b.date)), directObservedCost: money(spent(vapeOps)), allocatedObservedCost: money(vapeAllocatedCost), allocationCount: vapeAllocations.length, m2AnnualCost: vapeOwnerAnnualCost, reconciledToM2: vapeReconciled, equipmentCost: vapeEquipmentCost, equipmentItemCount: equipmentItems.length } },
        socialLife: { fatherHome: fatherVisits, maternalFamilyHome: motherVisits, amandine: visits(manon, "SOCIAL_ANCHOR"), friendVisits, familyVisitTotal, familyVisitsPerQuarter: Number(new Big(familyVisitTotal).div(4).round(1).toString()), fatherRoundTripFuelCost: familyRouteCost(fatherVisits[0]?.placeRef), motherRoundTripFuelCost: familyRouteCost(motherVisits[0]?.placeRef), familyMobility: compactMobility(mobility(manon, "FAMILY_VISIT")), friendMobility: compactMobility(mobility(manon, "FRIEND_VISIT")), familyMobilityWithoutPartner: compactMobility(mobility(manon, "FAMILY_VISIT", "OTHER_ELSEWHERE_CONFIRMED")), friendMobilityWithoutPartner: compactMobility(mobility(manon, "FRIEND_VISIT", "OTHER_ELSEWHERE_CONFIRMED")), outingsWithoutPartnerParticipation: manonOutings, wording: "DE_SON_COTE", presenceIsNotTrip: true },
      },
    ],
  };
}
