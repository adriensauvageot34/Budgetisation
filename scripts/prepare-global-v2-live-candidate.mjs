import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Module, { createRequire } from "node:module";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

import { createFixtureSupabaseClient, loadFixtureTables } from "./lib/fixture-supabase-client.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();
const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
Module._load = function loadGlobalProductionModule(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolveGlobalProductionModule(request, parent, isMain, options) {
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
const implementationIdentity = args.get("--implementation-sha");
const asOf = args.get("--as-of");
const fixtureDirectory = args.get("--fixture-dir");
const expectedDataRevision = args.get("--data-revision");
const currentAnalyticsRevision = args.get("--analytics-revision");
if (!/^[0-9a-f]{40}$/u.test(implementationIdentity ?? "") || !/^\d{4}-\d{2}-\d{2}T/u.test(asOf ?? "")) {
  throw new TypeError("Usage: --implementation-sha=<40 hex> --as-of=<Instant> [--fixture-dir=<private export>]");
}

const { GLOBAL_V2_LIVE_PROJECT, prepareGlobalV2LiveCandidate } = require(path.resolve(root, "src/server/analytics/global-v2-production-orchestrator.ts"));
let client;
let context;
if (fixtureDirectory !== undefined) {
  const fixturePath = path.resolve(fixtureDirectory);
  const tables = loadFixtureTables(fixturePath);
  const households = tables.get("households") ?? [];
  if (households.length !== 1) throw new TypeError("GLOBAL_FIXTURE_HOUSEHOLD_COUNT_INVALID");
  const household = households[0];
  const revision = (tables.get("household_revisions") ?? []).find((row) => row.household_id === household.household_id);
  if (revision === undefined) throw new TypeError("GLOBAL_FIXTURE_REVISION_MISSING");
  const persons = (tables.get("persons") ?? []).filter((row) => row.household_id === household.household_id).map((row) => ({ personId: row.person_id, householdId: row.household_id, displayName: row.display_name, status: row.status }));
  const periods = (tables.get("analysis_periods") ?? []).filter((row) => row.household_id === household.household_id).map((row) => ({ analysisPeriodId: row.analysis_period_id, householdId: row.household_id, month: row.month, financeStatus: row.finance_status, lifeStatus: row.life_status, locationStatus: row.location_status, calendarStatus: row.calendar_status, isClosed: row.is_closed, sourceRevision: String(row.source_revision) }));
  client = createFixtureSupabaseClient(fixturePath, { emptyTables: [
    "purchase_events", "purchase_event_memberships", "purchase_event_timing_assertions",
    "economic_component_classifications", "life_event_continuity_assertions",
  ] });
  if (expectedDataRevision !== undefined && String(revision.data_revision) !== expectedDataRevision) throw new TypeError("GLOBAL_FIXTURE_DATA_REVISION_MISMATCH");
  context = { userId: "global-v2-read-only-preparation", householdId: household.household_id, persons, personIds: persons.map(({ personId }) => personId), timezone: household.timezone, periods, dataRevision: String(revision.data_revision), analyticsRevision: currentAnalyticsRevision ?? String(revision.analytics_revision), contractVersion: "v2", asOf };
} else {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const householdId = args.get("--household-id");
  if (!url || !key || !householdId) throw new TypeError("Server-only Supabase credentials and --household-id are required for live read-only preparation.");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { createGlobalV2CandidateContext } = require(path.resolve(root, "src/server/analytics/global-v2-production-orchestrator.ts"));
  context = await createGlobalV2CandidateContext({ client, householdId, asOf });
}

const candidate = await prepareGlobalV2LiveCandidate({ project: GLOBAL_V2_LIVE_PROJECT, client, context, implementationIdentity });
const summary = Object.fromEntries([
  "project", "householdScope", "asOf", "dataRevision", "analyticsRevision", "implementationIdentity",
  "candidateId", "factsHash", "manifestHash", "requiredArtifactCount", "requiredSnapshotCount",
  "queryInstanceCount", "availableCapabilities", "gatedCapabilities", "requiredKeys",
].map((key) => [key, candidate[key]]));
summary.versions = {
  artifactContractVersions: [...new Set(candidate.versions.artifacts.map(({ contractVersion }) => contractVersion))].sort(),
  queryContractVersions: [...new Set(candidate.versions.queries.map(({ contractVersion }) => contractVersion))].sort(),
  methodSignatures: [...new Set(candidate.versions.queries.map(({ methodSignature }) => methodSignature))].sort(),
  policyVersions: [...new Set(candidate.versions.queries.flatMap(({ policyVersions }) => Object.entries(policyVersions).map(([key, value]) => `${key}=${value}`)))].sort(),
};
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
