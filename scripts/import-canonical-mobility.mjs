import fs from "node:fs/promises";
import process from "node:process";
import { registerHooks } from "node:module";
import Big from "big.js";
import pg from "pg";

pg.types.setTypeParser(1082, (value) => value);
pg.types.setTypeParser(1114, (value) => value);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
    try { return nextResolve(specifier, context); } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const { buildCanonicalMobilityImportPlan } = await import("../src/server/canonical/mobility-import.ts");

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function databaseConfig() {
  const connectionString = argument("--database-url") ?? process.env.MOBILITY_DATABASE_URL;
  if (connectionString) return { connectionString, ssl: { rejectUnauthorized: false } };
  const host = process.env.MOBILITY_DB_HOST;
  const password = process.env.MOBILITY_DB_PASSWORD;
  if (!host || !password) {
    throw new Error("MOBILITY_DATABASE_URL ou MOBILITY_DB_HOST + MOBILITY_DB_PASSWORD est requis pour --apply.");
  }
  return {
    host,
    port: Number(process.env.MOBILITY_DB_PORT ?? "5432"),
    database: process.env.MOBILITY_DB_NAME ?? "postgres",
    user: process.env.MOBILITY_DB_USER ?? "postgres",
    password,
    ssl: { rejectUnauthorized: false },
  };
}

function quoteIdentifier(value) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error(`Identifiant SQL refusé: ${value}`);
  return `"${value}"`;
}

async function insertRows(client, table, rows, conflictColumn) {
  if (rows.length === 0) return 0;
  const columns = Object.keys(rows[0]);
  const values = [];
  const tuples = rows.map((row) => `(${columns.map((column) => {
    const value = row[column];
    values.push(jsonColumns.has(column) && value !== null && typeof value === "object" ? JSON.stringify(value) : value);
    return `$${values.length}`;
  }).join(", ")})`);
  const result = await client.query(
    `insert into public.${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(", ")}) values ${tuples.join(", ")} on conflict (${quoteIdentifier(conflictColumn)}) do nothing returning ${quoteIdentifier(conflictColumn)}`,
    values,
  );
  return result.rowCount ?? 0;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonical(child)]));
  }
  return value;
}

const numericColumns = new Set([
  "distance_km", "duration_seconds", "duration_no_traffic_seconds", "estimated_fuel_liters",
  "estimated_fuel_cost", "fuel_price_per_liter", "origin_source_latitude", "origin_source_longitude",
  "destination_source_latitude", "destination_source_longitude", "price_per_liter", "consumption_l_100km",
]);
const jsonColumns = new Set(["route_proxy_times", "provenance", "evidence_refs"]);

function valuesEqual(column, expected, actual) {
  if (expected === null || actual === null) return expected === actual;
  if (numericColumns.has(column)) return new Big(String(expected)).eq(String(actual));
  if (jsonColumns.has(column)) return JSON.stringify(canonical(expected)) === JSON.stringify(canonical(actual));
  if (column === "observed_at") return new Date(expected).toISOString() === new Date(actual).toISOString();
  if (column === "observed_time") return String(expected).replace(" ", "T") === String(actual).replace(" ", "T");
  return String(expected) === String(actual);
}

function assertRowsMatch(table, keyColumn, expectedRows, actualRows) {
  const actualById = new Map(actualRows.map((row) => [String(row[keyColumn]), row]));
  for (const expected of expectedRows) {
    const key = String(expected[keyColumn]);
    const actual = actualById.get(key);
    if (!actual) throw new Error(`${table}: ligne attendue absente (${key}).`);
    for (const [column, value] of Object.entries(expected)) {
      if (!valuesEqual(column, value, actual[column])) {
        throw new Error(`${table}: conflit sémantique ${key}.${column}.`);
      }
    }
  }
}

async function loadLivePlaceAuthorities(client) {
  const { rows } = await client.query(`
    select place_id::text as "placeId", nom_canonique as "sourceLabel",
           latitude_canonique::text as latitude, longitude_canonique::text as longitude
    from public.referentiel_lieu
    where nom_canonique is not null
      and latitude_canonique is not null
      and longitude_canonique is not null
    order by place_id
  `);
  return rows;
}

async function certifyLiveDataset(client, plan) {
  const summary = await client.query(`
    select count(*)::integer as legs,
           count(*) filter (where source_group = 'NAV')::integer as nav,
           count(*) filter (where source_group = 'JOUR')::integer as jour,
           count(*) filter (where source_group = 'AUT')::integer as aut,
           sum(distance_km)::text as distance_km,
           sum(estimated_fuel_liters)::text as estimated_fuel_liters,
           sum(estimated_fuel_cost)::text as estimated_fuel_cost,
           min(travel_date)::text as period_start,
           max(travel_date)::text as period_end,
           count(*) filter (where fuel_price_quality = 'P3_LOCAL_DEPARTMENT')::integer as p3_usage,
           count(*) filter (where fuel_price_quality = 'P4_NATIONAL_FALLBACK')::integer as p4_usage,
           count(*) filter (where fuel_price_observation_id is null)::integer as missing_fuel_price_links
    from public.mobility_legs where dataset_id = $1
  `, [plan.dataset.dataset_id]);
  const duplicates = await client.query(`
    select
      (select count(*)::integer from (select source_leg_id from public.mobility_legs where dataset_id = $1 group by source_leg_id having count(*) > 1) d) as duplicate_source_leg_ids,
      (select count(*)::integer from (select mobility_leg_id from public.mobility_legs where dataset_id = $1 group by mobility_leg_id having count(*) > 1) d) as duplicate_canonical_leg_ids,
      (select count(*)::integer from public.mobility_datasets where household_id = $2 and source_hash = $3 and import_method_version = $4) as matching_datasets
  `, [plan.dataset.dataset_id, plan.dataset.household_id, plan.dataset.source_hash, plan.dataset.import_method_version]);
  const places = await client.query(`
    with endpoints as (
      select origin_source_label as label, origin_source_latitude as latitude, origin_source_longitude as longitude, origin_resolution_state as state
      from public.mobility_legs where dataset_id = $1
      union
      select destination_source_label, destination_source_latitude, destination_source_longitude, destination_resolution_state
      from public.mobility_legs where dataset_id = $1
    )
    select count(*) filter (where state = 'EXPLICIT_MAPPING')::integer as resolved,
           count(*) filter (where state = 'UNRESOLVED')::integer as unresolved
    from endpoints
  `, [plan.dataset.dataset_id]);
  return { ...summary.rows[0], ...duplicates.rows[0], ...places.rows[0] };
}

async function applyPlan({ filePath, householdId, vehicleId }) {
  const client = new pg.Client(databaseConfig());
  await client.connect();
  try {
    const initialPlan = await buildCanonicalMobilityImportPlan({ filePath, householdId, ...(vehicleId === undefined ? {} : { vehicleId }) });
    await client.query("begin isolation level serializable");
    await client.query("set local timezone = 'UTC'");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [`canonical-mobility:${initialPlan.dataset.dataset_id}`]);
    const schema = await client.query("select to_regclass('public.mobility_datasets')::text as datasets, to_regclass('public.mobility_legs')::text as legs");
    if (!schema.rows[0].datasets || !schema.rows[0].legs) throw new Error("La migration Canonical Mobility P4.5-A n'est pas appliquée.");

    const placeAuthorities = await loadLivePlaceAuthorities(client);
    const plan = await buildCanonicalMobilityImportPlan({
      filePath, householdId, ...(vehicleId === undefined ? {} : { vehicleId }), placeAuthorities,
    });
    if (plan.report.resolvedPlaceIdentities !== 80 || plan.report.unresolvedPlaceIdentities !== 12) {
      throw new Error(`PLACE_RESOLUTION_MISMATCH:${plan.report.resolvedPlaceIdentities}/${plan.report.unresolvedPlaceIdentities}`);
    }

    const importTimestamp = new Date().toISOString();
    const vehicleInsert = {
      ...plan.vehicleCandidate,
      valid_from: null,
      valid_to: null,
      created_at: importTimestamp,
      updated_at: importTimestamp,
    };
    const newVehicles = await insertRows(client, "vehicles", [vehicleInsert], "vehicle_id");
    const newFuelPrices = await insertRows(client, "fuel_price_observations", plan.fuelPriceObservations, "fuel_price_observation_id");
    const newDatasets = await insertRows(client, "mobility_datasets", [plan.dataset], "dataset_id");
    const newLegs = await insertRows(client, "mobility_legs", plan.legs, "mobility_leg_id");

    const datasetRows = (await client.query("select dataset_id::text, household_id::text, source_name, period_start, period_end, source_hash, import_method_version, source_leg_count from public.mobility_datasets where dataset_id = $1", [plan.dataset.dataset_id])).rows;
    assertRowsMatch("mobility_datasets", "dataset_id", [plan.dataset], datasetRows);
    const expectedVehicle = { ...plan.vehicleCandidate, valid_from: null, valid_to: null };
    const vehicleRows = (await client.query("select vehicle_id::text, household_id::text, owner_person_id::text, label, fuel_type, consumption_l_100km, valid_from, valid_to, status from public.vehicles where vehicle_id = $1", [plan.vehicleCandidate.vehicle_id])).rows;
    assertRowsMatch("vehicles", "vehicle_id", [expectedVehicle], vehicleRows);
    const fuelRows = (await client.query("select fuel_price_observation_id::text, fuel_type, price_per_liter, observed_at, geographic_scope, source, quality, provenance from public.fuel_price_observations where fuel_price_observation_id = any($1::uuid[])", [plan.fuelPriceObservations.map((row) => row.fuel_price_observation_id)])).rows;
    assertRowsMatch("fuel_price_observations", "fuel_price_observation_id", plan.fuelPriceObservations, fuelRows);
    const legColumns = Object.keys(plan.legs[0]);
    const legRows = (await client.query(`select ${legColumns.map(quoteIdentifier).join(", ")} from public.mobility_legs where dataset_id = $1 order by source_leg_id`, [plan.dataset.dataset_id])).rows;
    assertRowsMatch("mobility_legs", "mobility_leg_id", plan.legs, legRows);

    const certification = await certifyLiveDataset(client, plan);
    if (certification.legs !== 684 || certification.nav !== 390 || certification.jour !== 77 || certification.aut !== 217
      || !new Big(certification.distance_km).eq("7370.132")
      || !new Big(certification.estimated_fuel_liters).eq("647.270344")
      || !new Big(certification.estimated_fuel_cost).eq("1188.481549222")
      || certification.period_start !== "2025-08-01" || certification.period_end !== "2026-07-31"
      || certification.p3_usage !== 262 || certification.p4_usage !== 422
      || certification.missing_fuel_price_links !== 0
      || certification.duplicate_source_leg_ids !== 0 || certification.duplicate_canonical_leg_ids !== 0
      || certification.matching_datasets !== 1 || certification.resolved !== 80 || certification.unresolved !== 12) {
      throw new Error(`LIVE_CERTIFICATION_FAILED:${JSON.stringify(certification)}`);
    }

    await client.query("commit");
    return {
      status: "PASS",
      datasetId: plan.dataset.dataset_id,
      datasetHash: plan.dataset.source_hash,
      vehicleId: plan.vehicleCandidate.vehicle_id,
      fuelPriceObservationCount: plan.fuelPriceObservations.length,
      newDatasets,
      newVehicles,
      newFuelPrices,
      newLegs,
      semanticallyChangedLegs: 0,
      certification,
    };
  } catch (error) {
    try { await client.query("rollback"); } catch { /* connection may already be closed */ }
    throw error;
  } finally {
    await client.end();
  }
}

const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run");
if (apply === dryRun) throw new Error("Choisir exactement un mode: --dry-run ou --apply.");
const filePath = argument("--file") ?? process.env.MOBILITY_SOURCE_XLSX;
const householdId = argument("--household-id") ?? process.env.MOBILITY_HOUSEHOLD_ID;
const vehicleId = argument("--vehicle-id") ?? process.env.MOBILITY_VEHICLE_ID;
if (!filePath) throw new Error("MOBILITY_SOURCE_XLSX ou --file est requis.");
if (!householdId) throw new Error("MOBILITY_HOUSEHOLD_ID ou --household-id est requis.");

if (apply) {
  process.stdout.write(`${JSON.stringify(await applyPlan({ filePath, householdId, vehicleId }), null, 2)}\n`);
} else {
  const placeAuthorityPath = argument("--place-authority");
  const existingPath = argument("--existing-identities");
  const placeAuthorityStdin = process.argv.includes("--place-authority-stdin");
  if (placeAuthorityPath !== undefined && placeAuthorityStdin) {
    throw new Error("Choisir --place-authority ou --place-authority-stdin, pas les deux.");
  }
  const stdinChunks = [];
  if (placeAuthorityStdin) {
    for await (const chunk of process.stdin) stdinChunks.push(chunk);
  }
  const placeAuthorities = placeAuthorityStdin
    ? JSON.parse(Buffer.concat(stdinChunks).toString("utf8"))
    : placeAuthorityPath === undefined
      ? []
      : JSON.parse(await fs.readFile(placeAuthorityPath, "utf8"));
  const existing = existingPath === undefined
    ? undefined
    : JSON.parse(await fs.readFile(existingPath, "utf8"));
  const plan = await buildCanonicalMobilityImportPlan({
    filePath,
    householdId,
    ...(vehicleId === undefined ? {} : { vehicleId }),
    placeAuthorities,
    ...(existing === undefined ? {} : { existing }),
  });
  process.stdout.write(`${JSON.stringify(plan.report, null, 2)}\n`);
}
