import "server-only";
import { snapshotWork, snapshotSpan } from "./planner/snapshot-observation";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  globalV2AcceptedQueryMethodSignatures,
  globalV2QueryRegistry,
  parseGlobalBackgroundRhythmsReadModel,
  parseGlobalExpandedReadModel,
  type GlobalV2QueryResourceName,
} from "@/query-api/global-v2";
import { assembleMonthForecast, type ForecastAuthorities, type ForecastOperation, type ForecastRecurrence, type MonthForecast } from "./month-forecast";
import { REFERENCE_SUBCATEGORIES, type EconomicReferenceEntry, type MobilityReferenceLeg } from "./month-reference";

const RESOURCES = [
  "analysis_global_background_rhythms", "analysis_global_economic_recurrence_detail",
  "analysis_global_category_need_detail", "analysis_global_routine_detail", "analysis_global_transformations",
] as const;

async function activeGlobalPublication(client: SupabaseClient, householdId: string): Promise<ForecastAuthorities["publication"]> {
  const { data: publication, error: publicationError } = await snapshotWork("Global_PublicationIdentity", () => client.from("analytics_publications")
    .select("publication_id,household_id,source_revision,published_analytics_revision")
    .eq("household_id", householdId).eq("scope_kind", "global").eq("status", "published")
    .order("published_analytics_revision", { ascending: false }).limit(1).maybeSingle());
  if (publicationError) throw publicationError;
  if (!publication) throw new TypeError("FORECAST_ACTIVE_GLOBAL_PUBLICATION_MISSING");
  return publication;
}

/** Baseline already receives the admitted monthly Forecast in World. In that path it
 * only needs the active publication identity and the existing FOOD publication. */
export async function loadPlanningBaselineGlobalContext(client: SupabaseClient, householdId: string):
  Promise<Pick<ForecastAuthorities, "publication" | "background">> {
  const publication = await activeGlobalPublication(client, householdId);
  const { data: rows, error } = await snapshotWork("Global_PublishedSnapshots", () => client.from("analytics_query_snapshots")
    .select("resource,method_signature,contract_version,payload,publication_id,is_active,invalidated_at")
    .eq("publication_id", publication.publication_id).eq("is_active", true).is("invalidated_at", null)
    .eq("resource", "analysis_global_background_rhythms").range(0, 1));
  if (error) throw error;
  if (rows?.length !== 1) throw new TypeError("FORECAST_AUTHORITY_CARDINALITY:analysis_global_background_rhythms");
  const snapshot = rows[0]!;
  const resource = snapshot.resource as GlobalV2QueryResourceName;
  const registry = globalV2QueryRegistry[resource];
  if (!registry || snapshot.contract_version !== registry.contractVersion
    || !globalV2AcceptedQueryMethodSignatures(resource).includes(snapshot.method_signature))
    throw new TypeError(`FORECAST_QUERY_REGISTRY_MISMATCH:${resource}`);
  if (snapshot.payload?.publicationMeta?.publicationId !== publication.publication_id)
    throw new TypeError(`FORECAST_SNAPSHOT_PUBLICATION_MISMATCH:${resource}`);
  const background = parseGlobalBackgroundRhythmsReadModel(snapshot.payload);
  if (background.food.methodVersion !== "global_food_rhythm@v2-purchase-aware") throw new TypeError("FORECAST_FOOD_PURCHASE_AWARE_REQUIRED");
  return { publication, background };
}

export async function loadMonthForecastAuthorities(client: SupabaseClient, householdId: string): Promise<ForecastAuthorities> {
  const publication = await activeGlobalPublication(client, householdId);

  const { data: snapshots, error: snapshotError } = await snapshotWork("Global_PublishedSnapshots", () => client.from("analytics_query_snapshots")
    .select("resource,method_signature,contract_version,payload,publication_id,is_active,invalidated_at")
    .eq("publication_id", publication.publication_id).eq("is_active", true).is("invalidated_at", null)
    .in("resource", [...RESOURCES]).order("resource").range(0, 199));
  if (snapshotError) throw snapshotError;
  if (!snapshots || snapshots.length === 0) throw new TypeError("FORECAST_GLOBAL_SNAPSHOTS_MISSING");
  const endValidation = snapshotSpan("Global_ValidatePublishedPayloads");
  for (const snapshot of snapshots) {
    const resource = snapshot.resource as GlobalV2QueryResourceName;
    const registry = globalV2QueryRegistry[resource];
    if (!registry || snapshot.contract_version !== registry.contractVersion
      || !globalV2AcceptedQueryMethodSignatures(resource).includes(snapshot.method_signature)) {
      throw new TypeError(`FORECAST_QUERY_REGISTRY_MISMATCH:${resource}`);
    }
    if (snapshot.payload?.publicationMeta?.publicationId !== publication.publication_id) {
      throw new TypeError(`FORECAST_SNAPSHOT_PUBLICATION_MISMATCH:${resource}`);
    }
  }
  const one = (resource: string) => {
    const rows = snapshots.filter((row) => row.resource === resource);
    if (rows.length !== 1) throw new TypeError(`FORECAST_AUTHORITY_CARDINALITY:${resource}`);
    return rows[0]!.payload;
  };
  const background = parseGlobalBackgroundRhythmsReadModel(one("analysis_global_background_rhythms"));
  if (background.food.methodVersion !== "global_food_rhythm@v2-purchase-aware") throw new TypeError("FORECAST_FOOD_PURCHASE_AWARE_REQUIRED");
  const expanded = (resource: string) => snapshots.filter((row) => row.resource === resource).map((row) => parseGlobalExpandedReadModel(row.payload));
  const recurrenceDetails = expanded("analysis_global_economic_recurrence_detail");
  const categoryNeedDetails = expanded("analysis_global_category_need_detail");
  const routineDetails = expanded("analysis_global_routine_detail");
  const recurrenceIds = recurrenceDetails.flatMap((detail) => {
    const ref = detail.rows.find((row) => row.entityRef)?.entityRef;
    return ref?.startsWith("recurrence:") ? [ref.slice(11)] : [];
  });
  if (recurrenceIds.length === 0) throw new TypeError("FORECAST_M1_RECURRENCE_DETAILS_MISSING");
  const start = `${background.period.startMonth}-01`;
  const end = new Date(`${background.period.endMonth}-01T00:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const endExclusive = end.toISOString().slice(0, 10);
  endValidation();
  const [seriesResult, recurrenceOperationsResult, incomeOperationsResult, categoriesResult, needsResult] = await snapshotWork("Global_RecurrenceReads", () => Promise.all([
    client.from("recurrence_series").select("recurrence_series_id,name,cadence_estimee,mode_prevision,actif_prevision")
      .in("recurrence_series_id", recurrenceIds),
    client.from("operations").select("operation_id,recurrence_series_id,date_bancaire,montant,flux,statut,marchand")
      .in("recurrence_series_id", recurrenceIds).gte("date_bancaire", start).lt("date_bancaire", endExclusive).range(0, 999),
    client.from("operations").select("operation_id,recurrence_series_id,date_bancaire,montant,flux,statut,marchand")
      .eq("flux", "Revenu").eq("statut", "Habituel").gte("date_bancaire", start).lt("date_bancaire", endExclusive).range(0, 999),
    client.from("categories").select("category_id,nom_canonique"),
    client.from("needs").select("need_id,name"),
  ]));
  for (const result of [seriesResult, recurrenceOperationsResult, incomeOperationsResult, categoriesResult, needsResult]) {
    if (result.error) throw result.error;
  }
  if ((recurrenceOperationsResult.data?.length ?? 0) === 1000 || (incomeOperationsResult.data?.length ?? 0) === 1000) {
    throw new TypeError("FORECAST_OPERATION_PAGE_LIMIT_REACHED");
  }
  const subcategoryResult = await snapshotWork("Global_ReferenceSubcategories", () => client.from("subcategories").select("subcategory_id,nom_canonique")
    .in("nom_canonique", [...REFERENCE_SUBCATEGORIES]));
  if (subcategoryResult.error) throw subcategoryResult.error;
  const names = new Map((subcategoryResult.data ?? []).map((row) => [row.subcategory_id, row.nom_canonique]));
  if (new Set(names.values()).size !== REFERENCE_SUBCATEGORIES.length) throw new TypeError("FORECAST_REFERENCE_SUBCATEGORY_MISSING");
  const costResult = await snapshotWork("Global_ReferenceCosts", () => client.from("financial_economic_cost_canonical")
    .select("operation_id,subcategory_id,canonical_economic_net").in("subcategory_id", [...names.keys()]).range(0, 999));
  if (costResult.error) throw costResult.error;
  if ((costResult.data?.length ?? 0) === 1000) throw new TypeError("FORECAST_REFERENCE_COST_PAGE_LIMIT_REACHED");
  const operationRows: { operation_id: string; date_bancaire: string; personne_concernee: string | null;
    type_precis: string | null; marchand: string | null }[] = [];
  await snapshotWork("Global_ReferenceOperations", async () => {
  for (let offset = 0; ; offset += 1000) {
    const result = await client.from("operations")
      .select("operation_id,date_bancaire,personne_concernee,type_precis,marchand")
      .gte("date_bancaire", start).lt("date_bancaire", endExclusive)
      .order("operation_id").range(offset, offset + 999);
    if (result.error) throw result.error;
    operationRows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 1000) break;
  }
  });
  const operationsById = new Map(operationRows.map((row) => [row.operation_id, row]));
  const economicEntries: EconomicReferenceEntry[] = (costResult.data ?? []).flatMap((row) => {
    const operation = operationsById.get(row.operation_id);
    const subcategory = names.get(row.subcategory_id);
    return operation && subcategory ? [{ operationId: row.operation_id, date: operation.date_bancaire,
      amount: String(row.canonical_economic_net), subcategory, person: operation.personne_concernee,
      preciseType: operation.type_precis, merchant: operation.marchand }] : [];
  });
  if (economicEntries.length < 500) throw new TypeError("FORECAST_REFERENCE_ECONOMIC_COVERAGE_INSUFFICIENT");
  const mobilityResult = await snapshotWork("Global_ReferenceMobility", () => client.from("mobility_legs")
    .select("travel_date,origin_source_label,destination_source_label,estimated_fuel_cost")
    .eq("household_id", householdId).gte("travel_date", start).lt("travel_date", endExclusive)
    .eq("status", "CERTIFIED_SOURCE").range(0, 999));
  if (mobilityResult.error) throw mobilityResult.error;
  if ((mobilityResult.data?.length ?? 0) === 1000) throw new TypeError("FORECAST_REFERENCE_MOBILITY_PAGE_LIMIT_REACHED");
  const mobilityLegs: MobilityReferenceLeg[] = (mobilityResult.data ?? []).filter((row) => row.estimated_fuel_cost !== null)
    .map((row) => ({ date: row.travel_date, origin: row.origin_source_label, destination: row.destination_source_label,
      fuelCost: String(row.estimated_fuel_cost) }));
  const referenceStart = new Date(`${background.period.endMonth}-01T12:00:00Z`);
  referenceStart.setUTCMonth(referenceStart.getUTCMonth() - 11);
  return {
    publication, background, recurrenceDetails, categoryNeedDetails, routineDetails,
    transformation: { visibility: (one("analysis_global_transformations") as { visibility: string }).visibility },
    recurrences: (seriesResult.data ?? []) as ForecastRecurrence[],
    recurrenceOperations: (recurrenceOperationsResult.data ?? []) as ForecastOperation[],
    incomeOperations: (incomeOperationsResult.data ?? []) as ForecastOperation[],
    categories: categoriesResult.data ?? [], needs: needsResult.data ?? [],
    referenceEvidence: { startMonth: referenceStart.toISOString().slice(0, 7), endMonth: background.period.endMonth,
      economicEntries, mobilityLegs },
  };
}

/** Builds a prospective month in memory from the current Global publication. */
export async function loadMonthForecast(client: SupabaseClient, householdId: string, targetMonth: string): Promise<MonthForecast> {
  return assembleMonthForecast(await loadMonthForecastAuthorities(client, householdId), targetMonth);
}
