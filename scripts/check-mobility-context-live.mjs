import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Module, { createRequire } from "node:module";
import ts from "typescript";
import pg from "pg";

const require = createRequire(import.meta.url);
const root = process.cwd();
const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
Module._load = function loadMobilityContextModule(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolveMobilityContextModule(request, parent, isMain, options) {
  const target = request.startsWith("@/") ? path.resolve(root, "src", request.slice(2)) : request;
  try { return originalResolve.call(this, target, parent, isMain, options); } catch (error) {
    if (path.extname(target)) throw error;
    for (const candidate of [`${target}.ts`, path.join(target, "index.ts")]) {
      try { return originalResolve.call(this, candidate, parent, isMain, options); } catch { /* next */ }
    }
    throw error;
  }
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  fileName: filename,
}).outputText, filename);

const args = new Map(process.argv.slice(2).map((entry) => {
  const separator = entry.indexOf("=");
  return separator < 0 ? [entry, ""] : [entry.slice(0, separator), entry.slice(separator + 1)];
}));
const connectionString = process.env.DATABASE_URL;
const householdId = args.get("--household-id");
const periodStart = args.get("--period-start");
const certifiedThrough = args.get("--certified-through");
if (!connectionString || !householdId || !/^\d{4}-\d{2}-\d{2}$/u.test(periodStart ?? "") || !/^\d{4}-\d{2}-\d{2}$/u.test(certifiedThrough ?? "")) {
  throw new TypeError("DATABASE_URL, --household-id, --period-start and --certified-through are required.");
}

const { Client } = pg;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query("begin transaction read only");
try {
  const householdResult = await client.query("select timezone from households where household_id = $1", [householdId]);
  assert.equal(householdResult.rowCount, 1);
  const householdTimeZone = householdResult.rows[0].timezone;
  const personResult = await client.query("select person_id::text as person_id from persons where household_id = $1 order by person_id", [householdId]);
  const householdPersonIds = personResult.rows.map(({ person_id }) => person_id);
  const mobilityResult = await client.query(`
    select mobility_leg_id::text, source_leg_id, dataset_id::text, household_id::text, vehicle_id::text,
      travel_date::text, origin_place_id::text, destination_place_id::text, origin_source_label,
      destination_source_label, origin_resolution_state, destination_resolution_state,
      distance_km::text as distance_km_text, duration_seconds::text as duration_seconds_text,
      duration_no_traffic_seconds::text as duration_no_traffic_seconds_text,
      estimated_fuel_liters::text as estimated_fuel_liters_text,
      estimated_fuel_cost::text as estimated_fuel_cost_text, fuel_type,
      fuel_price_per_liter::text as fuel_price_per_liter_text, fuel_price_period::text,
      fuel_price_geo_scope, fuel_price_source, fuel_price_quality, fuel_price_observation_id::text,
      consumption_model_ref, route_method_ref, observed_time::text, time_authority, time_type,
      route_time_basis, route_proxy_times, source_group, source_reconstruction, source_sheet,
      source_quality, status, confidence, method_version, source_row_hash, evidence_refs
    from mobility_legs
    where household_id = $1 and travel_date between $2 and $3
    order by travel_date, mobility_leg_id`, [householdId, periodStart, certifiedThrough]);
  const { projectMobilityLegFactFromCanonicalRow } = require(path.resolve(root, "src/server/canonical/mobility.ts"));
  const mobilityLegs = mobilityResult.rows.map(projectMobilityLegFactFromCanonicalRow);

  const dayResult = await client.query(`
    select pd.person_day_id::text, pd.person_id::text, pd.date::text, pd.couverture_localisation
    from person_days pd join persons p using(person_id)
    where p.household_id = $1 and pd.date between $2 and $3
    order by pd.date, pd.person_id`, [householdId, periodStart, certifiedThrough]);
  const observability = { "Complète": "observable", "Partielle": "partial", "Absente": "unknown" };
  const personDays = dayResult.rows.map((row) => ({
    fact: "fct_person_day", householdId, householdTimeZone, personDayId: row.person_day_id,
    personId: row.person_id, localDate: row.date, locationObservability: observability[row.couverture_localisation],
  }));
  const visitResult = await client.query(`
    select lo.localization_id::text, lo.person_day_id::text, lo.person_id::text, lo.place_id::text,
      lo.start_at, lo.end_at, lo.time_precision, lo.sequence_index::int, pd.date::text
    from location_occurrences lo join person_days pd using(person_day_id) join persons p on p.person_id = lo.person_id
    where p.household_id = $1 and pd.date between $2 and $3 and lo.occurrence_type = 'Présence'
    order by pd.date, lo.person_id, lo.sequence_index, lo.localization_id`, [householdId, periodStart, certifiedThrough]);
  const precision = { Exact: "exact", Approximatif: "approximate", "Plage horaire": "time_range", Inconnu: "unknown" };
  const placeVisits = visitResult.rows.map((row) => ({
    fact: "fct_place_visit", householdId, householdTimeZone, visitKey: row.localization_id,
    personDayId: row.person_day_id, personId: row.person_id, placeId: row.place_id, localDate: row.date,
    interval: row.start_at && row.end_at
      ? { kind: "known", startedAt: row.start_at.toISOString(), endedAt: row.end_at.toISOString() }
      : row.start_at || row.end_at
        ? { kind: "partial", startedAt: row.start_at?.toISOString() ?? null, endedAt: row.end_at?.toISOString() ?? null }
        : { kind: "unknown" },
    timePrecision: precision[row.time_precision], sequenceIndex: row.sequence_index,
  }));

  const eventResult = await client.query(`
    select le.life_event_id::text, let.type_key, le.start_date::text, le.end_date::text,
      le.validation_status, le.primary_place_id::text
    from life_events le join life_event_types let using(life_event_type_id)
    where le.start_date <= $2 and le.end_date >= $1 and le.validation_status in ('Confirmé', 'Déduit')
    order by le.life_event_id`, [periodStart, certifiedThrough]);
  const eventIds = eventResult.rows.map(({ life_event_id }) => life_event_id);
  const participationResult = eventIds.length === 0 ? { rows: [] } : await client.query(`
    select life_event_id::text, person_day_id::text, person_id::text, start_at, end_at,
      time_precision, participation_status
    from life_event_participations where life_event_id = any($1::uuid[])
    order by life_event_id, person_id, person_day_id`, [eventIds]);
  const localizationResult = eventIds.length === 0 ? { rows: [] } : await client.query(`
    select lel.life_event_id::text, lo.place_id::text
    from life_event_localizations lel join location_occurrences lo using(localization_id)
    where lel.life_event_id = any($1::uuid[])
    order by lel.life_event_id, lo.place_id`, [eventIds]);
  const grouped = (rows, key) => rows.reduce((map, row) => map.set(row[key], [...(map.get(row[key]) ?? []), row]), new Map());
  const participationsByEvent = grouped(participationResult.rows, "life_event_id");
  const localizationsByEvent = grouped(localizationResult.rows, "life_event_id");
  const status = { "Confirmée": "CONFIRMED", "Déduite": "DERIVED", "Inconnue": "UNKNOWN" };
  const eventPrecision = { Exact: "EXACT", Approximatif: "APPROXIMATE", "Plage horaire": "TIME_RANGE", Inconnu: "UNKNOWN" };
  const lifeEventContexts = eventResult.rows.map((row) => ({
    lifeEventId: row.life_event_id,
    typeKey: row.type_key,
    startDate: row.start_date,
    endDate: row.end_date,
    validationStatus: row.validation_status === "Confirmé" ? "CONFIRMED" : "DERIVED",
    placeIds: [...new Set([...(row.primary_place_id ? [row.primary_place_id] : []), ...(localizationsByEvent.get(row.life_event_id) ?? []).map(({ place_id }) => place_id)])].sort(),
    participations: (participationsByEvent.get(row.life_event_id) ?? []).map((entry) => ({
      personId: entry.person_id,
      status: status[entry.participation_status] ?? "UNKNOWN",
      startAt: entry.start_at?.toISOString() ?? null,
      endAt: entry.end_at?.toISOString() ?? null,
      timePrecision: eventPrecision[entry.time_precision] ?? "UNKNOWN",
      evidenceRef: `life-event-participation:${entry.life_event_id}:${entry.person_day_id}:${entry.person_id}`,
    })),
    evidenceRefs: [`fct_activity_occurrence:${row.life_event_id}`, `life-event-type:${row.type_key}`],
  }));
  const { buildGlobalM7MobilityContextAuthority } = require(path.resolve(root, "src/analytics/global-v2/mobility-context.ts"));
  const result = buildGlobalM7MobilityContextAuthority({ householdId, householdTimeZone, householdPersonIds, mobilityLegs, lifeEventContexts, placeVisits, personDays });
  const { buildGlobalM7PersonalMobilityAuthority } = require(path.resolve(root, "src/analytics/global-v2/personal-mobility.ts"));
  const personalMobility = buildGlobalM7PersonalMobilityAuthority({
    mobilityLegs,
    contextLinks: result.contextLinks,
    presenceResolutions: result.presenceResolutions,
  });
  assert.equal(result.sourceLegCount, result.physicalTotals.physicalLegCount);
  assert.equal(new Set(result.contextLinks.map(({ contextResolutionId }) => contextResolutionId)).size, result.contextLinks.length);
  assert.equal(result.contextLinks.some((link) => "estimatedFuelCost" in link || "distanceKm" in link || "estimatedFuelLiters" in link), false);
  assert.equal(result.liveWrites, "NONE");
  assert.deepEqual(personalMobility.physicalTotals, result.physicalTotals);
  assert.equal(personalMobility.costMetricId, "mobility_usage_estimated_fuel_cost");
  assert.equal(personalMobility.workMiddaySummaryReady, false);
  assert.equal(personalMobility.afterWorkPatternReady, false);
  assert.equal(personalMobility.liveWrites, "NONE");
  const counts = (values) => Object.fromEntries([...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map())].sort(([left], [right]) => left.localeCompare(right)));
  const confirmedWithoutPartner = (contextKind) => personalMobility.summaries.filter((summary) =>
    summary.contextKind === contextKind && summary.couplePresenceFilter.state === "OTHER_ELSEWHERE_CONFIRMED");
  console.log(JSON.stringify({
    sourceLegCount: result.sourceLegCount,
    physicalTotals: result.physicalTotals,
    contextLinkStates: counts(result.contextLinks.map(({ linkState }) => linkState)),
    linkedPurposes: counts(result.contextLinks.filter(({ linkState }) => linkState === "LINKED").map(({ purpose }) => purpose)),
    pairwisePresenceStates: counts(result.presenceResolutions.map(({ state }) => state)),
    personalMobility: {
      summaryCount: personalMobility.summaries.length,
      summaryContexts: counts(personalMobility.summaries.map(({ contextKind }) => contextKind)),
      workSummaryCount: personalMobility.summaries.filter(({ contextKind }) => contextKind === "WORK_COMMUTE").length,
      familyWithoutPartnerEventCount: confirmedWithoutPartner("FAMILY_VISIT").reduce((total, { eventCount }) => total + eventCount, 0),
      friendWithoutPartnerEventCount: confirmedWithoutPartner("FRIEND_VISIT").reduce((total, { eventCount }) => total + eventCount, 0),
      physicalTotals: personalMobility.physicalTotals,
      workMiddaySummaryReady: personalMobility.workMiddaySummaryReady,
      afterWorkPatternReady: personalMobility.afterWorkPatternReady,
      costMetricId: personalMobility.costMetricId,
    },
    liveWrites: result.liveWrites,
  }, null, 2));
} finally {
  await client.query("rollback");
  await client.end();
}
