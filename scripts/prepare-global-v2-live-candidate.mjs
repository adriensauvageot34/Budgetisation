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
const includePersonaProfile = args.has("--include-persona-profile");
const backgroundVisibility = args.get("--background-visibility") ?? "DEFAULT";
const candidateSourceRevision = args.get("--candidate-source-revision");
const compareActivePublication = args.get("--compare-active-publication");
const simulateFutureRevisions = args.has("--simulate-future-revisions");
if (!/^[0-9a-f]{40}$/u.test(implementationIdentity ?? "") || !/^\d{4}-\d{2}-\d{2}T/u.test(asOf ?? "")) {
  throw new TypeError("Usage: --implementation-sha=<40 hex> --as-of=<Instant> [--fixture-dir=<private export>]");
}
if (!["DEFAULT", "PURCHASE_AWARE_PILOT"].includes(backgroundVisibility)) throw new TypeError("Invalid background visibility");

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
  const secretKeyFetch = async (input, init) => {
    const request = new Request(input, init);
    const headers = new Headers(request.headers);
    headers.delete("Authorization");
    const withoutBearer = new Request(request, { headers });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(withoutBearer.clone());
      if (response.status !== 401 || !(await response.clone().text()).includes("JWT issued at future")) return response;
      if (attempt === 2) throw new TypeError(`SUPABASE_API_CLOCK_SKEW:${new URL(request.url).pathname}`);
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
    throw new TypeError("SUPABASE_API_RETRY_EXHAUSTED");
  };
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(key.startsWith("sb_secret_") ? { global: { fetch: secretKeyFetch } } : {}),
  });
  const { createGlobalV2CandidateContext } = require(path.resolve(root, "src/server/analytics/global-v2-production-orchestrator.ts"));
  context = await createGlobalV2CandidateContext({ client, householdId, asOf });
}
if (simulateFutureRevisions) {
  if (fixtureDirectory !== undefined || backgroundVisibility !== "DEFAULT" || candidateSourceRevision !== undefined) {
    throw new TypeError("GLOBAL_FUTURE_REVISION_SIMULATION_INVALID");
  }
  context = { ...context, dataRevision: String(Number(context.dataRevision) + 1),
    analyticsRevision: String(Number(context.analyticsRevision) + 1) };
}

const candidate = await prepareGlobalV2LiveCandidate({ project: GLOBAL_V2_LIVE_PROJECT, client, context,
  implementationIdentity, backgroundVisibility, candidateSourceRevision });
const summary = Object.fromEntries([
  "project", "householdScope", "asOf", "dataRevision", "analyticsRevision", "implementationIdentity",
  "candidateId", "factsHash", "manifestHash", "requiredArtifactCount", "requiredSnapshotCount",
  "queryInstanceCount", "availableCapabilities", "gatedCapabilities", "requiredKeys",
].map((key) => [key, candidate[key]]));
const backgroundAnnual = candidate.snapshots.find(({ resource }) => resource === "analysis_global_background_rhythms");
const backgroundDetails = candidate.snapshots.filter(({ resource }) => resource === "analysis_global_background_rhythm_month_detail");
if (backgroundAnnual === undefined) throw new TypeError("GLOBAL_BACKGROUND_RHYTHMS_ANNUAL_MISSING");
const { parseGlobalBackgroundRhythmsReadModel } = require(path.resolve(root, "src/query-api/global-v2/background-rhythms.ts"));
summary.candidateAnnualRuntime = parseGlobalBackgroundRhythmsReadModel(backgroundAnnual.payload).schemaVersion;
const serializedBytes = (value) => Buffer.byteLength(JSON.stringify(value), "utf8");
const june = backgroundAnnual.payload.carMobility.months.find(({ month }) => month.endsWith("-06"));
if (june === undefined) throw new TypeError("GLOBAL_BACKGROUND_RHYTHMS_JUNE_MISSING");
summary.backgroundRhythms = {
  annualPayloadBytes: serializedBytes(backgroundAnnual.payload),
  maximumMonthPayloadBytes: Math.max(0, ...backgroundDetails.map(({ payload }) => serializedBytes(payload))),
  featureTotalBytes: [backgroundAnnual, ...backgroundDetails].reduce((total, { payload }) => total + serializedBytes(payload), 0),
  snapshotCount: 1 + backgroundDetails.length,
  foodAnnualTotal: backgroundAnnual.payload.food.annual.total,
  foodAnnual: backgroundAnnual.payload.food.annual,
  foodMonths: backgroundAnnual.payload.food.months,
  benefitCoverage: backgroundAnnual.payload.food.benefitCoverage,
  monthlyBenefitFunding: backgroundAnnual.payload.food.monthlyBenefitFunding,
  carAnnual: backgroundAnnual.payload.carMobility.annual,
  june: { modeledUsage: june.modeledUsage, observedFuelPaid: june.observedFuelPaid },
};
summary.versions = {
  artifactContractVersions: [...new Set(candidate.versions.artifacts.map(({ contractVersion }) => contractVersion))].sort(),
  queryContractVersions: [...new Set(candidate.versions.queries.map(({ contractVersion }) => contractVersion))].sort(),
  methodSignatures: [...new Set(candidate.versions.queries.map(({ methodSignature }) => methodSignature))].sort(),
  policyVersions: [...new Set(candidate.versions.queries.flatMap(({ policyVersions }) => Object.entries(policyVersions).map(([key, value]) => `${key}=${value}`)))].sort(),
};
if (compareActivePublication !== undefined) {
  if (fixtureDirectory !== undefined) throw new TypeError("Active comparison requires live reads");
  const readPublicationRows = async (table, key) => {
    const rows = [];
    for (let from = 0; ; from += 100) {
      const { data, error } = await client.from(table).select(`${key},payload`)
        .eq("publication_id", compareActivePublication).order(key).range(from, from + 99);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 100) return rows;
    }
  };
  const metadataKeys = new Set(["publicationMeta", "resourceMeta", "publicationId", "sourcePublicationId",
    "sourceAnalyticsRevision", "analyticsRevision", "sourceRevision", "dataRevision", "generatedAt", "computedAt",
    "factsHash", "inputHash", "manifestHash", "resourceInputHash", "methodSignature", "instanceKey"]);
  const business = (value, ownerBoundary = false) => Array.isArray(value) ? value.map((entry) => business(entry, ownerBoundary))
    : value !== null && typeof value === "object"
      ? Object.fromEntries(Object.entries(value)
        .filter(([key]) => !metadataKeys.has(key) && !(ownerBoundary && (
          (key === "resolutionHash" && value.window !== undefined && value.certifiedUnitIds !== undefined)
          || (key === "executionHash" && value.boundary?.resolutionHash !== undefined))))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, key === "displayValue" && value.rowId === "007:method:revisions"
          && typeof entry === "string" && /^data \d+ · analytics \d+$/.test(entry)
          ? "data <revision> · analytics <revision>"
          : business(entry, ownerBoundary)]))
      : value;
  const firstDiff = (left, right, path = "$") => {
    if (JSON.stringify(left) === JSON.stringify(right)) return null;
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) return `${path}.length`;
      for (let index = 0; index < left.length; index += 1) {
        const diff = firstDiff(left[index], right[index], `${path}[${index}]`);
        if (diff !== null) return diff;
      }
    } else if (left && right && typeof left === "object" && typeof right === "object") {
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        const diff = firstDiff(left[key], right[key], `${path}.${key}`);
        if (diff !== null) return diff;
      }
    }
    return path;
  };
  const [activeQueries, activeArtifacts] = await Promise.all([
    readPublicationRows("analytics_query_snapshots", "query_key"),
    readPublicationRows("analytics_artifacts", "artifact_key"),
  ]);
  const activeQueryByKey = new Map(activeQueries.map((row) => [row.query_key, row]));
  const activeArtifactByKey = new Map(activeArtifacts.map((row) => [row.artifact_key, row]));
  const activeAnnual = activeQueryByKey.get(backgroundAnnual.key.replace(candidate.candidateId, compareActivePublication));
  if (activeAnnual === undefined) throw new TypeError("GLOBAL_ACTIVE_BACKGROUND_ANNUAL_MISSING");
  summary.activeAnnualCompatibility = parseGlobalBackgroundRhythmsReadModel(activeAnnual.payload).schemaVersion;
  summary.carAnnualEquality = firstDiff(business(activeAnnual.payload.carMobility), business(backgroundAnnual.payload.carMobility)) === null;
  const carMonthDeltas = backgroundDetails.flatMap(({ key, payload }) => {
    const active = activeQueryByKey.get(key.replace(candidate.candidateId, compareActivePublication));
    return active === undefined ? [{ key, path: "MISSING" }] :
      (firstDiff(business(active.payload), business(payload)) === null ? []
        : [{ key, path: firstDiff(business(active.payload), business(payload)) }]);
  });
  summary.carMonthDetailEquality = { equal: backgroundDetails.length - carMonthDeltas.length,
    total: backgroundDetails.length, deltas: carMonthDeltas };
  const queryDeltas = candidate.snapshots.filter(({ resource }) => !resource.startsWith("analysis_global_background_rhythm"))
    .flatMap(({ key, payload }) => {
      const active = activeQueryByKey.get(key.replace(candidate.candidateId, compareActivePublication));
      return active === undefined ? [{ key, path: "MISSING" }] :
        (firstDiff(business(active.payload), business(payload)) === null ? []
          : [{ key, path: firstDiff(business(active.payload), business(payload)) }]);
    });
  const artifactDeltas = candidate.artifacts.filter(({ version }) => version.family !== "global_background_rhythms")
    .flatMap(({ key, payload }) => {
      const active = activeArtifactByKey.get(key);
      return active === undefined ? [{ key, path: "MISSING" }] :
        (firstDiff(business(active.payload, true), business(payload, true)) === null ? []
          : [{ key, path: firstDiff(business(active.payload, true), business(payload, true)) }]);
    });
  summary.activeEquality = {
    activeQueryCount: activeQueries.length, activeArtifactCount: activeArtifacts.length,
    outOfScopeQueries: candidate.snapshots.length - backgroundDetails.length - 1,
    outOfScopeArtifacts: candidate.artifacts.length - 1,
    queryEqual: candidate.snapshots.length - backgroundDetails.length - 1 - queryDeltas.length,
    artifactEqual: candidate.artifacts.length - 1 - artifactDeltas.length,
    queryDeltas: queryDeltas.slice(0, 25), artifactDeltas: artifactDeltas.slice(0, 25),
  };
}
if (includePersonaProfile) {
  const personaSnapshot = candidate.snapshots.find(({ resource, payload }) => resource === "analysis_global_personas_expanded" && payload.sectionKey === "OVERVIEW");
  if (personaSnapshot?.payload.profile === undefined) throw new TypeError("GLOBAL_LIVE_PERSONA_PROFILE_MISSING");
  summary.personaReadModel = {
    payloadBytes: Buffer.byteLength(JSON.stringify(personaSnapshot.payload), "utf8"),
    compactPayloadBytes: Buffer.byteLength(JSON.stringify(candidate.snapshots.find(({ resource }) => resource === "analysis_global_personas")?.payload), "utf8"),
    legacyOverviewRows: personaSnapshot.payload.rows ?? [],
    profile: personaSnapshot.payload.profile,
  };
}
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
