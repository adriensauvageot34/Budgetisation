import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Module, { createRequire } from "node:module";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const root = process.cwd();
const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
Module._load = function load(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolve(request, parent, isMain, options) {
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
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
}).outputText, filename);

const args = new Map(process.argv.slice(2).map((entry) => {
  const separator = entry.indexOf("=");
  return separator < 0 ? [entry, ""] : [entry.slice(0, separator), entry.slice(separator + 1)];
}));
const householdId = args.get("--household-id");
const implementationIdentity = args.get("--implementation-sha");
const asOf = args.get("--as-of");
const dryRun = args.has("--dry-run");
const stageOnly = args.has("--stage-only");
const backgroundVisibility = args.get("--background-visibility") ?? "DEFAULT";
const candidateSourceRevision = args.get("--candidate-source-revision");
const expectedActivePublication = args.get("--expected-active-publication");
if (!/^[0-9a-f]{40}$/u.test(implementationIdentity ?? "") || !/^\d{4}-\d{2}-\d{2}T/u.test(asOf ?? "") || !/^[0-9a-f-]{36}$/u.test(householdId ?? "")) {
  throw new TypeError("Usage: --household-id=<uuid> --implementation-sha=<40 hex> --as-of=<Instant> [--dry-run]");
}
if (stageOnly && (backgroundVisibility !== "PURCHASE_AWARE_PILOT" || !/^\d+$/u.test(candidateSourceRevision ?? "")
  || !/^[0-9a-f-]{36}$/u.test(expectedActivePublication ?? ""))) {
  throw new TypeError("C6_STAGE_ONLY_GUARDS_REQUIRED");
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new TypeError("Server-only Supabase credentials required");
// New sb_secret keys are API keys, not JWTs. The Data API accepts them in
// apikey; stripping the SDK's Bearer header avoids JWT validation of the key.
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
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  ...(key.startsWith("sb_secret_") ? { global: { fetch: secretKeyFetch } } : {}),
});
const { GLOBAL_V2_LIVE_PROJECT, createGlobalV2CandidateContext, prepareGlobalV2LiveCandidate } = require(path.resolve(root, "src/server/analytics/global-v2-production-orchestrator.ts"));
const { serializeGlobalV2PublicationManifest } = require(path.resolve(root, "src/server/analytics/materialization/global-v2.ts"));
const { canonicalSerializeQueryParams } = require(path.resolve(root, "src/query-api/request/cache-key.ts"));
const context = await createGlobalV2CandidateContext({ client, householdId, asOf });
const candidate = await prepareGlobalV2LiveCandidate({ project: GLOBAL_V2_LIVE_PROJECT, client, context,
  implementationIdentity, backgroundVisibility, candidateSourceRevision });
const manifestWire = serializeGlobalV2PublicationManifest(candidate.manifest);
const editorial = candidate.artifacts.find((entry) => entry.payload.editorial?.schemaVersion === "persona-editorial@v1")?.payload.editorial;
if (!editorial || editorial.persons.length !== 2) throw new TypeError("GLOBAL_PERSONA_EDITORIAL_NOT_READY");
const editorialBytes = Buffer.byteLength(JSON.stringify(editorial), "utf8");
if (editorialBytes > 48 * 1024) throw new TypeError(`GLOBAL_PERSONA_EDITORIAL_NOT_COMPACT:${editorialBytes}`);
const manifestBytes = Buffer.byteLength(JSON.stringify(manifestWire), "utf8");
if (manifestBytes > 2_000_000) throw new TypeError(`GLOBAL_MANIFEST_NOT_COMPACT:${manifestBytes}`);
const digest = (value) => createHash("sha256").update(canonicalSerializeQueryParams(value)).digest("hex");
const asOfMonth = `${asOf.slice(0, 7)}-01`;
const sourceRevision = Number(candidate.dataRevision);
const baseRevision = Number(candidate.analyticsRevision);
const publicationId = candidate.candidateId;
const backgroundAnnual = candidate.snapshots.find(({ resource }) => resource === "analysis_global_background_rhythms");
const backgroundDetails = candidate.snapshots.filter(({ resource }) => resource === "analysis_global_background_rhythm_month_detail");
if (backgroundAnnual === undefined) throw new TypeError("GLOBAL_BACKGROUND_RHYTHMS_ANNUAL_MISSING");
const serializedBytes = (value) => Buffer.byteLength(JSON.stringify(value), "utf8");
if (stageOnly) {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const { parseGlobalBackgroundRhythmsReadModel } = require(path.resolve(root, "src/query-api/global-v2/background-rhythms.ts"));
  if (head !== implementationIdentity || candidate.artifacts.length !== 17 || candidate.snapshots.length !== 759
    || backgroundDetails.length !== 12
    || parseGlobalBackgroundRhythmsReadModel(backgroundAnnual.payload).schemaVersion !== "global-background-rhythms@v2"
    || serializedBytes(backgroundAnnual.payload) > 47104
    || [backgroundAnnual, ...backgroundDetails].reduce((total, { payload }) => total + serializedBytes(payload), 0) > 153600) {
    throw new TypeError("C6_STAGE_CANDIDATE_PREFLIGHT_FAILED");
  }
}
const june = backgroundAnnual.payload.carMobility.months.find(({ month }) => month.endsWith("-06"));
if (june === undefined) throw new TypeError("GLOBAL_BACKGROUND_RHYTHMS_JUNE_MISSING");
const summary = {
  publicationId, sourceRevision, baseRevision, nextRevision: baseRevision + 1,
  artifactCount: candidate.artifacts.length, snapshotCount: candidate.snapshots.length,
  editorialBytes, manifestBytes,
  backgroundRhythms: {
    annualPayloadBytes: serializedBytes(backgroundAnnual.payload),
    maximumMonthPayloadBytes: Math.max(0, ...backgroundDetails.map(({ payload }) => serializedBytes(payload))),
    featureTotalBytes: [backgroundAnnual, ...backgroundDetails].reduce((total, { payload }) => total + serializedBytes(payload), 0),
    snapshotCount: 1 + backgroundDetails.length,
    foodAnnualTotal: backgroundAnnual.payload.food.annual.total,
    carAnnual: backgroundAnnual.payload.carMobility.annual,
    june: { modeledUsage: june.modeledUsage, observedFuelPaid: june.observedFuelPaid },
  },
  vehicleCost: editorial.vehicleHouseholdCost.totalIdentifiedCost,
  carInsurance: {
    currentProvider: editorial.vehicle?.insuranceSummary?.currentProvider ?? null,
    currentMonthlyCost: editorial.vehicle?.insuranceSummary?.currentMonthlyCost ?? null,
    periodCost: editorial.vehicle?.insuranceSummary?.periodCost ?? null,
    payerAuthority: editorial.vehicle?.insuranceSummary?.payerAuthority ?? null,
    isolatedRefundResolved: editorial.vehicle?.insuranceSummary?.isolatedRefundResolved ?? null,
    nonFuelCostTotal: editorial.vehicle?.nonFuelCostTotal ?? null,
    nonFuelCostTotalReady: editorial.vehicle?.nonFuelCostTotalReady ?? null,
  },
  permitCost: editorial.persons[0].personalUniverses.permit.cost,
  photoNetCost: editorial.persons[0].personalUniverses.photo.netCost,
  workMobility: editorial.persons[1].work.commute.strictOwnerSummary,
  adrienWork: { onsiteDays: editorial.persons[0].work.onsiteDays, remoteDays: editorial.persons[0].work.remoteDays, mealsCost: editorial.persons[0].work.workMeals.m2AnnualCost ?? editorial.persons[0].work.workMeals.directObservedCost, anchorPresenceDays: editorial.persons[0].work.workMeals.anchorPresence?.presenceDays ?? null },
  manonWork: { onsiteDays: editorial.persons[1].work.onsiteDays, interventions: editorial.persons[1].work.professionalInterventions.eventCount, mealsCost: editorial.persons[1].work.workMeals.m2AnnualCost ?? editorial.persons[1].work.workMeals.directObservedCost, anchorPresenceDays: editorial.persons[1].work.workMeals.anchorPresence?.presenceDays ?? null },
  familyPresence: { fatherDays: editorial.persons[1].socialLife.fatherHome[0]?.presenceDays ?? null, maternalDays: editorial.persons[1].socialLife.maternalFamilyHome[0]?.presenceDays ?? null },
  socialOutings: { adrien: editorial.persons[0].socialLife.outingsWithoutPartnerParticipation.length, manon: editorial.persons[1].socialLife.outingsWithoutPartnerParticipation.length },
  sunoProjectCost: editorial.persons[1].personalUniverses.sunoFatherSong.netCost,
  vape: editorial.persons[1].recurringHabits.vape,
  profileFirst: {
    adrienMeals: editorial.persons[0].work.workMeals.allPurchaseHabitSummary,
    manonMeals: editorial.persons[1].work.workMeals.allPurchaseHabitSummary,
    adrienTobacco: editorial.persons[0].recurringHabits.tobacco,
    manonCigarettesPerDay: editorial.persons[1].recurringHabits.cigarettesPerDay,
    videoObservedCost: editorial.persons[1].recurringHabits.videoObservedCost,
    familyVisitTotal: editorial.persons[1].socialLife.familyVisitTotal,
    fatherVisits: editorial.persons[1].socialLife.fatherHome[0]?.visitCount ?? null,
    motherVisits: editorial.persons[1].socialLife.maternalFamilyHome[0]?.visitCount ?? null,
    fatherRoundTripFuelCost: editorial.persons[1].socialLife.fatherRoundTripFuelCost,
    motherRoundTripFuelCost: editorial.persons[1].socialLife.motherRoundTripFuelCost,
    familyFuelCost: editorial.persons[1].socialLife.familyMobility?.estimatedFuelCost ?? null,
    friendVisits: editorial.persons[1].socialLife.friendVisits.map((friend) => ({ label: friend.label, visitCount: friend.visitCount })),
  },
};
if (dryRun) { process.stdout.write(`${JSON.stringify({ ...summary, dryRun: true }, null, 2)}\n`); process.exit(0); }

if (stageOnly) {
  const { data: active, error: activeError } = await client.from("analytics_publications")
    .select("publication_id,published_analytics_revision").eq("household_id", householdId)
    .eq("scope_kind", "global").eq("status", "published");
  if (activeError || active?.length !== 1 || active[0]?.publication_id !== expectedActivePublication
    || Number(active[0]?.published_analytics_revision) !== baseRevision - 1
    || sourceRevision !== Number(context.dataRevision) + 1) throw new TypeError("C6_STAGE_BASELINE_CHANGED");
}

// Stage a complete draft; only the official sealed-publication RPC activates it.
const { data: existingDraft, error: draftReadError } = await client.from("analytics_publications")
  .select("status,source_revision,base_analytics_revision,global_manifest")
  .eq("publication_id", publicationId).maybeSingle();
if (draftReadError) throw draftReadError;
if (existingDraft === null) {
  const { error: beginError } = await client.from("analytics_publications").insert({
    publication_id: publicationId, household_id: householdId, scope_kind: "global", as_of_month: asOfMonth,
    source_revision: sourceRevision, base_analytics_revision: baseRevision,
    required_artifact_keys: candidate.requiredKeys.artifacts, required_query_keys: candidate.requiredKeys.queries,
    status: "draft",
  });
  if (beginError) throw beginError;
} else if (existingDraft.status !== "draft" || existingDraft.global_manifest !== null
  || Number(existingDraft.source_revision) !== sourceRevision || Number(existingDraft.base_analytics_revision) !== baseRevision) {
  throw new TypeError("GLOBAL_DRAFT_RESUME_MISMATCH");
}

const artifactRows = candidate.artifacts.map((entry) => ({
  artifact_key: entry.key, generation_key: publicationId, household_id: householdId,
  subject_kind: "household", period_kind: "global", as_of_month: asOfMonth,
  artifact_family: entry.version.family, metric_id: entry.key, scope_hash: candidate.scopeHash,
  filter_signature: digest({ filters: {} }), method_version: entry.version.methodSignature,
  contract_version: entry.version.contractVersion, source_revision: sourceRevision,
  analytics_revision: baseRevision, payload: entry.payload, computed_at: asOf,
  publication_id: publicationId, is_active: false,
}));
const queryRows = candidate.snapshots.map((entry) => ({
  query_key: entry.key, generation_key: publicationId, household_id: householdId,
  resource: entry.resource, scope_hash: candidate.scopeHash,
  normalized_param_signature: digest({ params: entry.params }),
  subject_kind: "household", period_kind: "global", as_of_month: asOfMonth,
  source_revision: sourceRevision, analytics_revision: baseRevision,
  contract_version: entry.payload.resourceMeta.contractVersion,
  method_signature: entry.methodSignature, payload: entry.payload, computed_at: asOf,
  publication_id: publicationId, is_active: false,
}));
for (const [table, rows, keyColumn, batchSize] of [["analytics_artifacts", artifactRows, "artifact_key", 1], ["analytics_query_snapshots", queryRows, "query_key", 6]]) {
  const { data: staged, error: stagedReadError } = await client.from(table).select(keyColumn).eq("publication_id", publicationId);
  if (stagedReadError) throw stagedReadError;
  const stagedKeys = new Set((staged ?? []).map((row) => row[keyColumn]));
  const missingRows = rows.filter((row) => !stagedKeys.has(row[keyColumn]));
  for (let index = 0; index < missingRows.length; index += batchSize) {
    const { error } = await client.from(table).insert(missingRows.slice(index, index + batchSize));
    if (error) throw new TypeError(`GLOBAL_STAGE_${table}:${index}:${error.message}`);
    if (index % 60 === 0 || index + batchSize >= missingRows.length) process.stderr.write(`GLOBAL_STAGE_PROGRESS ${table} ${Math.min(index + batchSize, missingRows.length)}/${missingRows.length}\n`);
  }
}
const { error: sealError } = await client.rpc("attach_global_v2_manifest", { p_publication_id: publicationId, p_household_id: householdId, p_manifest: manifestWire });
if (sealError) throw sealError;
if (stageOnly) {
  const { data: sealed, error: sealedError } = await client.from("analytics_publications")
    .select("status,source_revision,base_analytics_revision,global_manifest")
    .eq("publication_id", publicationId).single();
  if (sealedError || sealed?.status !== "draft" || sealed.global_manifest === null
    || Number(sealed.source_revision) !== sourceRevision || Number(sealed.base_analytics_revision) !== baseRevision) {
    throw new TypeError("C6_SEAL_READBACK_FAILED");
  }
  process.stdout.write(`${JSON.stringify({ ...summary, sealed: true, activePublication: expectedActivePublication }, null, 2)}\n`);
  process.exit(0);
}
const { data: published, error: publishError } = await client.rpc("publish_global_v2_materialization", { p_publication_id: publicationId, p_expected_analytics_revision: baseRevision });
if (publishError) throw publishError;
assert.equal(Number(published?.[0]?.analytics_revision), baseRevision + 1);
const { data: active, error: activeError } = await client.from("analytics_publications").select("publication_id,published_analytics_revision").eq("publication_id", publicationId).single();
if (activeError) throw activeError;
assert.equal(active?.published_analytics_revision, baseRevision + 1);
process.stdout.write(`${JSON.stringify({ ...summary, published: true }, null, 2)}\n`);
