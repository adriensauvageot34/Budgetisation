import assert from "node:assert/strict";
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
Module._load = function loadPersonaLiveModule(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolvePersonaLiveModule(request, parent, isMain, options) {
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
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const householdId = args.get("--household-id");
const asOf = args.get("--as-of");
if (!url || !key || !householdId || !/^\d{4}-\d{2}-\d{2}T/u.test(asOf ?? "")) {
  throw new TypeError("Server-only Supabase credentials, --household-id and --as-of are required.");
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const { createGlobalV2CandidateContext } = require(path.resolve(root, "src/server/analytics/global-v2-production-orchestrator.ts"));
const { CanonicalRepository } = require(path.resolve(root, "src/server/canonical/repository.ts"));
const { parseLocalDate } = require(path.resolve(root, "src/core/time/index.ts"));
const {
  buildGlobalV2PersonaSignals,
  resolveGlobalPersonaProductObservations,
} = require(path.resolve(root, "src/server/analytics/global-v2-persona-signals.ts"));

const context = await createGlobalV2CandidateContext({ client, householdId, asOf });
const eligiblePeriods = context.periods.filter((period) => period.isClosed
  && period.month <= context.asOf.slice(0, 10)
  && period.financeStatus !== "unknown"
  && period.lifeStatus !== "unknown"
  && period.calendarStatus !== "unknown").sort((left, right) => left.month.localeCompare(right.month));
const latest = eligiblePeriods.at(-1);
if (latest === undefined) throw new TypeError("GLOBAL_CERTIFIED_THROUGH_MISSING");
const certifiedThrough = `${latest.month.slice(0, 8)}${new Date(Date.UTC(Number(latest.month.slice(0, 4)), Number(latest.month.slice(5, 7)), 0)).getUTCDate().toString().padStart(2, "0")}`;
const repository = new CanonicalRepository(client, context);
const productObservations = await resolveGlobalPersonaProductObservations({ repository, certifiedThrough: parseLocalDate(certifiedThrough) });
const displayNamesByPersonId = Object.fromEntries(context.persons.map(({ personId, displayName }) => [String(personId), displayName]));
const persona = buildGlobalV2PersonaSignals({
  householdId: context.householdId,
  personIds: context.personIds,
  displayNamesByPersonId,
  m1: { recurrences: { series: [] } },
  m2: { result: { needs: { groups: [] } } },
  m4: { rhythms: [] },
  m6: { summaries: [] },
  m7: { mobility: { legs: [], routes: [] } },
  m8: { capabilities: { products: { state: "UNAVAILABLE", reasonCode: "DEFERRED_P10" } } },
  productObservations,
  m10: { units: [], universes: [] },
  differences: [],
  certifiedThrough: parseLocalDate(certifiedThrough),
});

const profiles = persona.profile.profiles;
const allTraits = profiles.flatMap(({ allTraits: traits }) => traits);
const featuredTraits = profiles.flatMap(({ featuredTraits: traits }) => traits);
const profileFor = (scope, personName) => profiles.find((profile) => profile.scope === scope && (personName === undefined || displayNamesByPersonId[String(profile.subject.personId)] === personName));
const trait = (semanticKey, scope) => allTraits.find((entry) => entry.semanticKey === semanticKey && (scope === undefined || entry.scope === scope));
const productSignal = (needKey) => persona.signals.find((signal) => signal.signalType === "PRODUCT_CYCLE" && signal.needKey === needKey);

const adrien = profileFor("PERSONAL", "Adrien");
const manon = profileFor("PERSONAL", "Manon");
const shared = profileFor("SHARED");
const household = profileFor("HOUSEHOLD");
assert.ok(adrien && manon && shared && household);
assert.ok(trait("mobility.work.adrien", "PERSONAL"));
assert.equal(trait("creative.photo.adrien", "PERSONAL")?.temporalStatus, "PROJECT");
const creativeSupport = trait("creative.projects.adrien", "PERSONAL");
assert.equal(creativeSupport?.temporalStatus, "UNKNOWN");
assert.deepEqual(creativeSupport?.qualifications, ["PHOTO", "MUSIC", "HOME_STUDIO"]);
assert.equal(creativeSupport?.metrics, undefined);
const creativeUniverse = trait("universe.creative_projects", "PERSONAL");
assert.deepEqual(creativeUniverse?.children?.map(({ semanticKey }) => semanticKey), ["creative.photo.adrien", "creative.projects.adrien"]);
assert.ok(["HOME_STUDIO", "MUSIC", "PHOTO"].every((example) => creativeUniverse?.qualifications?.includes(example)));
assert.ok(adrien.featuredTraits.some(({ traitId }) => traitId === creativeUniverse?.traitId));
const drivingLicence = trait("driving_license.adrien", "PERSONAL");
assert.equal(drivingLicence?.kind, "PROJECT");
assert.equal(drivingLicence?.family, "MOBILITY");
assert.equal(drivingLicence?.temporalStatus, "PROJECT");
assert.deepEqual(drivingLicence?.qualifications, ["IN_PROGRESS"]);
assert.equal(drivingLicence?.metrics, undefined);
assert.ok(trait("subscription.chatgpt.adrien", "PERSONAL"));
assert.ok(trait("mobility.work.manon", "PERSONAL"));
assert.ok(trait("gaming", "SHARED"));
assert.ok(trait("techno", "SHARED"));
assert.ok(trait("groceries.organization", "HOUSEHOLD"));
assert.ok(trait("vehicle.peugeot_207", "HOUSEHOLD"));

const mascara = productSignal("maquillage_manon_mascara");
const brows = productSignal("maquillage_manon_sourcils");
assert.equal(mascara?.metrics?.occurrenceCount, 6);
assert.equal(mascara?.metrics?.medianGapDays, 65);
assert.equal(mascara?.metrics?.typicalPrice, 32);
assert.equal(brows?.metrics?.occurrenceCount, 7);
assert.equal(brows?.metrics?.medianGapDays, 57);
assert.equal(brows?.metrics?.typicalPrice, 9.99);
const beauty = trait("universe.beauty_and_care", "PERSONAL");
const observedBeautySemanticKeys = persona.signals.filter((signal) => signal.signalType === "PRODUCT_CYCLE"
  && ["maquillage_manon_mascara", "maquillage_manon_sourcils", "skincare_manon_masque", "epilation_manon"].includes(signal.needKey ?? ""))
  .map(({ semanticKey }) => semanticKey).sort();
assert.deepEqual(beauty?.children?.map(({ semanticKey }) => semanticKey), observedBeautySemanticKeys);
assert.ok(observedBeautySemanticKeys.includes("product-need:maquillage_manon_mascara"));
assert.ok(observedBeautySemanticKeys.includes("product-need:maquillage_manon_sourcils"));
assert.ok(featuredTraits.some(({ traitId }) => traitId === beauty?.traitId));

const forbidden = {
  householdPet: allTraits.some(({ semanticKey, groupKey }) => /pet|animal/iu.test(semanticKey) || groupKey === "household.pet"),
  crocAuBainAsPet: allTraits.some(({ semanticKey }) => /croc_au_bain/iu.test(semanticKey)),
  gamingPersonal: allTraits.some(({ semanticKey, scope }) => semanticKey === "gaming" && scope === "PERSONAL"),
  restaurantSharedByDefault: allTraits.some(({ semanticKey, scope }) => /restaurant/iu.test(semanticKey) && scope === "SHARED"),
  cardAsPerson: allTraits.some(({ subject }) => subject.kind === "PERSON" && /X3366|X3879/iu.test(String(subject.personId))),
  householdFiftyFifty: allTraits.some(({ metrics }) => Object.keys(metrics ?? {}).some((key) => /share|50/iu.test(key))),
  peugeotOwnedByManon: allTraits.some(({ semanticKey, scope }) => semanticKey === "vehicle.peugeot_207" && scope === "PERSONAL"),
  allCarCostsAsWork: Object.keys(trait("mobility.work.manon", "PERSONAL")?.metrics ?? {}).some((key) => /fuel|annual|vehicle|car.*cost/iu.test(key)),
  photoHistoricalOnly: trait("creative.photo.adrien", "PERSONAL")?.temporalStatus === "HISTORICAL",
  licenceObtained: allTraits.some(({ semanticKey, qualifications }) => /driving_license|permis/iu.test(semanticKey) && qualifications?.includes("OBTAINED")),
  technoRewritesM10: trait("techno", "SHARED")?.sourceModules?.includes("M10") === true,
  inventedConsumableCadence: allTraits.some(({ semanticKey, metrics }) => /consumable/iu.test(semanticKey) && Object.keys(metrics ?? {}).some((key) => /cadence|annual/iu.test(key))),
};
assert.ok(Object.values(forbidden).every((value) => value === false));

const projectTrait = (entry) => ({
  semanticKey: entry.semanticKey,
  kind: entry.kind,
  family: entry.family,
  temporalStatus: entry.temporalStatus,
  knowledgeStatus: entry.knowledgeStatus,
  authority: entry.authority,
  authorities: entry.authorities,
  metrics: entry.metrics,
  evidenceRefs: entry.evidenceRefs,
  limitations: entry.limitations,
  qualifications: entry.qualifications,
  children: entry.children,
  selectionReasons: entry.selection?.reasonCodes,
});
const projectProfile = (profile) => ({
  allTraits: profile.allTraits.map(projectTrait),
  featuredTraits: profile.featuredTraits.map(projectTrait),
});
const report = {
  status: "PARTIAL",
  reason: "FULL_PRODUCTION_REPLAY_BLOCKED_BY_CANONICAL_TIMING_STATEMENT_TIMEOUT",
  readOnly: true,
  certifiedThrough,
  profilePayloadBytes: Buffer.byteLength(JSON.stringify(persona.profile), "utf8"),
  productCycleRuntime: persona.capabilities.productCycleRuntime,
  profiles: {
    ADRIEN: projectProfile(adrien),
    MANON: projectProfile(manon),
    SHARED: projectProfile(shared),
    HOUSEHOLD: projectProfile(household),
  },
  antiCases: Object.fromEntries(Object.entries(forbidden).map(([key, present]) => [key, present ? "FAIL" : "PASS"])),
  gaps: [
    { truth: "Ange / repas travail et travail hybride", classification: "UPSTREAM_CAPABILITY_GAP", reason: "M4 routinePatterns non publiés au runtime borné" },
    { truth: "Attributions financières personnelles", classification: "UPSTREAM_CAPABILITY_GAP", reason: "M1 ne publie pas de bénéficiaire personnel" },
    { truth: "Distances et carburant", classification: "UPSTREAM_CAPABILITY_GAP", reason: "M7 routes/distances/fuel indisponibles" },
    { truth: "Épilation Dermawax → Italwax", classification: "DATA_GAP", reason: "Aucune observation correspondante dans product_observations" },
    { truth: "M10 participations live", classification: "UPSTREAM_CAPABILITY_GAP", reason: "Replay production complet bloqué avant M10 par timeout timing" },
  ],
};
console.log(JSON.stringify(report, null, 2));
console.log("PERSONA_GOLDEN_LIVE=PARTIAL");
