import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Module, { createRequire } from "node:module";
import ts from "typescript";

import { createFixtureSupabaseClient, loadFixtureTables } from "./lib/fixture-supabase-client.mjs";

const args = new Map(process.argv.slice(2).map((entry) => {
  const separator = entry.indexOf("=");
  return separator < 0 ? [entry, ""] : [entry.slice(0, separator), entry.slice(separator + 1)];
}));
const fixtureDirectory = args.get("--fixture-dir");
const asOf = args.get("--as-of");
if (fixtureDirectory === undefined || !/^\d{4}-\d{2}-\d{2}T/u.test(asOf ?? "")) {
  throw new TypeError("Usage: --fixture-dir=<private read-only export> --as-of=<Instant>");
}

const require = createRequire(import.meta.url);
const root = process.cwd();
const originalLoad = Module._load, originalResolve = Module._resolveFilename;
Module._load = function(request, parent, isMain) { return request === "server-only" ? {} : originalLoad.call(this, request, parent, isMain); };
Module._resolveFilename = function(request, parent, isMain, options) {
  const target = request.startsWith("@/") ? path.resolve(root, "src", request.slice(2)) : request;
  try { return originalResolve.call(this, target, parent, isMain, options); } catch (error) {
    if (path.extname(target)) throw error;
    for (const candidate of [`${target}.ts`, path.join(target, "index.ts")]) try { return originalResolve.call(this, candidate, parent, isMain, options); } catch { /* next */ }
    throw error;
  }
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
}).outputText, filename);

const fixturePath = path.resolve(fixtureDirectory);
const tables = loadFixtureTables(fixturePath);
const households = tables.get("households") ?? [];
assert.equal(households.length, 1, "Le fixture doit contenir exactement un Household.");
const household = households[0];
const revision = (tables.get("household_revisions") ?? []).find((row) => row.household_id === household.household_id);
assert.ok(revision, "La révision Household du fixture est requise.");
const persons = (tables.get("persons") ?? []).filter((row) => row.household_id === household.household_id).map((row) => ({ personId: row.person_id, householdId: row.household_id, displayName: row.display_name, status: row.status }));
const periods = (tables.get("analysis_periods") ?? []).filter((row) => row.household_id === household.household_id).map((row) => ({ analysisPeriodId: row.analysis_period_id, householdId: row.household_id, month: row.month, financeStatus: row.finance_status, lifeStatus: row.life_status, locationStatus: row.location_status, calendarStatus: row.calendar_status, isClosed: row.is_closed, sourceRevision: String(row.source_revision) }));
const context = { userId: "global-v2-read-only-fixture", householdId: household.household_id, persons, personIds: persons.map(({ personId }) => personId), timezone: household.timezone, periods, dataRevision: String(revision.data_revision), analyticsRevision: String(revision.analytics_revision), contractVersion: "v2", asOf };
const servianFontesLifeEventId = "152b3ea2-7161-5aca-8969-0dfa9cd11949";
const servianFamilyPlaceId = "45b9c4a9-4da2-5768-9aa0-4f8d32549fbb";
const fontesFatherPlaceId = "9c6b6a7a-3301-5a8c-ad5c-64446f6cbb12";
const lifeEventsByIdForFixture = new Map((tables.get("life_events") ?? []).map((row) => [row.life_event_id, row]));
const momentLinksForFixture = tables.get("moment_life_events") ?? [];
const linkedPrimaryPlacesByMoment = new Map();
for (const link of momentLinksForFixture) {
  const primaryPlaceId = lifeEventsByIdForFixture.get(link.life_event_id)?.primary_place_id;
  if (primaryPlaceId === null || primaryPlaceId === undefined) continue;
  const values = linkedPrimaryPlacesByMoment.get(link.moment_id) ?? new Set();
  values.add(primaryPlaceId);
  linkedPrimaryPlacesByMoment.set(link.moment_id, values);
}
const duplicatePrimaryLink = momentLinksForFixture.find((link) => linkedPrimaryPlacesByMoment.get(link.moment_id)?.size === 1 && lifeEventsByIdForFixture.get(link.life_event_id)?.primary_place_id);
const duplicatePrimaryEvent = duplicatePrimaryLink === undefined ? undefined : lifeEventsByIdForFixture.get(duplicatePrimaryLink.life_event_id);
assert.ok(duplicatePrimaryEvent, "Un LifeEvent à primary place est requis pour le test de déduplication.");
const client = createFixtureSupabaseClient(fixturePath, {
  emptyTables: ["purchase_events", "purchase_event_memberships", "purchase_event_timing_assertions", "economic_component_classifications", "life_event_continuity_assertions"],
  tableRows: {
    life_event_localizations: [
      { life_event_id: servianFontesLifeEventId, place_id: servianFamilyPlaceId, localization_role: "confirmed_context" },
      { life_event_id: servianFontesLifeEventId, place_id: fontesFatherPlaceId, localization_role: "confirmed_context" },
      { life_event_id: duplicatePrimaryEvent.life_event_id, place_id: duplicatePrimaryEvent.primary_place_id, localization_role: "confirmed_context" },
    ],
  },
});

const { CanonicalRepository } = require(path.resolve("src/server/canonical/repository.ts"));
const { FactSourceResolver } = require(path.resolve("src/server/analytics/fact-source-resolver.ts"));
const { resolveGlobalM2HouseholdAuthority } = require(path.resolve("src/server/analytics/global-v2-category-needs-authority.ts"));
const { resolveGlobalM6MomentAuthority } = require(path.resolve("src/server/analytics/global-v2-moment-authority.ts"));
const { resolveGlobalTimelineCandidateAdapter, resolveGlobalGroceryCandidateAdapter } = require(path.resolve("src/server/analytics/global-v2-candidate-adapters.ts"));
const { resolveGlobalV2ProductionOwnerOutputs } = require(path.resolve("src/server/analytics/global-v2-production-orchestrator.ts"));
const { buildGlobalV2CandidateFromOwnerOutputs } = require(path.resolve("src/server/analytics/global-v2-candidate.ts"));
const { buildGlobalActivityCostProfile } = require(path.resolve("src/analytics/global-v2/routines.ts"));
const { buildGlobalTimelineCandidateBundle } = require(path.resolve("src/analytics/global-v2/candidate-adapters.ts"));

const syntheticQuality = { knowledgeState: "KNOWN", limitationCodes: [], evidenceRefs: ["fixture:synthetic"] };
const syntheticLifeEvent = (lifeEventId, overrides = {}) => ({
  lifeEventId,
  canonicalTitle: `Titre ${lifeEventId}`,
  startDate: "2026-01-01",
  endDate: "2026-01-01",
  typeKey: "synthetic",
  typeLabel: "Synthétique",
  familyKey: "TEST",
  participantRefs: [],
  places: [],
  role: "Dominant",
  closed: true,
  template: false,
  ownedByCertifiedMoment: false,
  quality: syntheticQuality,
  ...overrides,
});
const syntheticTimeline = buildGlobalTimelineCandidateBundle({
  moments: [{
    momentId: "m-zero", canonicalName: "Zéro", startDate: "2026-01-01", endDate: "2026-01-01",
    typeKey: "zero", typeLabel: "Zéro", familyKey: "TEST", participantRefs: [], places: [],
    causalCost: { status: "KNOWN", value: "0" }, componentCount: 0, linkedLifeEventRefs: [], quality: syntheticQuality,
  }],
  lifeEvents: [
    syntheticLifeEvent("included"),
    syntheticLifeEvent("linked", { ownedByCertifiedMoment: true }),
    syntheticLifeEvent("child", { parentLifeEventRef: "life-event:parent" }),
    syntheticLifeEvent("series", { seriesRef: "life-event-series:s" }),
    syntheticLifeEvent("template", { template: true }),
    syntheticLifeEvent("secondary", { role: "Secondaire" }),
    syntheticLifeEvent("generic", { canonicalTitle: "" }),
    syntheticLifeEvent("open", { closed: false }),
  ],
});
assert.deepEqual(syntheticTimeline.events.map(({ eventRef }) => eventRef), ["life-event:included", "moment:m-zero"]);
assert.deepEqual(syntheticTimeline.deferred.map(({ reason }) => reason).sort(), ["GENERIC_TITLE", "NOT_CLOSED"]);
assert.deepEqual(syntheticTimeline.excluded.map(({ reason }) => reason).sort(), ["CHILD", "NON_DOMINANT", "OWNED_BY_CERTIFIED_MOMENT", "SERIES", "TEMPLATE"]);
assert.equal(syntheticTimeline.events.find(({ eventRef }) => eventRef === "moment:m-zero")?.causalCost.value, "0");

const repository = new CanonicalRepository(client, context);
const resolver = new FactSourceResolver(repository);
const eligiblePeriods = periods.filter((period) => period.isClosed && period.month <= asOf.slice(0, 10) && period.financeStatus !== "unknown" && period.lifeStatus !== "unknown" && period.calendarStatus !== "unknown").sort((left, right) => left.month.localeCompare(right.month));
const latest = eligiblePeriods.at(-1);
assert.ok(latest, "Le fixture ne contient aucune période certifiée.");
const targetMonth = latest.month.slice(0, 7);
const certifiedThrough = `${targetMonth}-${new Date(Date.UTC(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5, 7)), 0)).getUTCDate().toString().padStart(2, "0")}`;
const scope = { subject: { kind: "household" }, time: { kind: "global_v2", asOf, certifiedThrough } };
const months = eligiblePeriods.map(({ month }) => month.slice(0, 7));
const [m2, m6, occurrenceBatches, costBatches, taxonomy] = await Promise.all([
  resolveGlobalM2HouseholdAuthority({ repository, resolver, targetMonth }),
  resolveGlobalM6MomentAuthority({ repository, scope }),
  Promise.all(months.map((month) => resolver.loadActivityOccurrences({ subject: { kind: "household" }, time: { kind: "month", month } }))),
  Promise.all(months.map((month) => resolver.loadActivityOccurrenceCosts({ subject: { kind: "household" }, time: { kind: "month", month } }))),
  repository.loadCalendarEconomicTaxonomy(),
]);
const occurrences = occurrenceBatches.flat();
const costs = costBatches.flat();
const activityIds = [...new Set(occurrences.map(({ activityId }) => String(activityId)))].sort();
const activityCostProfiles = activityIds.map((activityId) => buildGlobalActivityCostProfile({ activityId, occurrences, activityCosts: costs }));
const timeline = await resolveGlobalTimelineCandidateAdapter({ repository, certifiedThrough, occurrences, m6 });
const grocery = resolveGlobalGroceryCandidateAdapter({ months, occurrences, activityCostProfiles, m2MonthlyComponents: m2.transformationMonthlyComponents, subcategoryRows: taxonomy.subcategories });

assert.equal(timeline.events.length, 47, "Le nombre dynamique d'événements Timeline du fixture a dérivé.");
assert.equal(timeline.events.filter(({ sourceKind }) => sourceKind === "MOMENT").length, 37, "Tous les Moments M6 certifiés doivent être inclus.");
assert.equal(timeline.events.filter(({ sourceKind }) => sourceKind === "LIFE_EVENT").length, 10, "Le nombre de LifeEvents autonomes du fixture a dérivé.");
assert.equal(new Set(timeline.events.map(({ eventRef }) => eventRef)).size, timeline.events.length, "Les eventRefs doivent être uniques.");
assert.deepEqual([...timeline.events].sort((left, right) => left.startDate.localeCompare(right.startDate) || left.eventRef.localeCompare(right.eventRef)), timeline.events, "Le bundle doit préserver le contrat de tri.");
const autonomousRefs = new Set(timeline.events.filter(({ sourceKind }) => sourceKind === "LIFE_EVENT").map(({ eventRef }) => eventRef));
const linkedRefs = new Set((tables.get("moment_life_events") ?? []).map(({ life_event_id }) => `life-event:${life_event_id}`));
assert.equal([...autonomousRefs].some((eventRef) => linkedRefs.has(eventRef)), false, "Aucun LifeEvent lié ne doit remonter top-level.");
assert.equal(timeline.excluded.some(({ eventRef, reason }) => reason === "OWNED_BY_CERTIFIED_MOMENT" && autonomousRefs.has(eventRef)), false, "Un LifeEvent possédé ne doit pas remonter top-level.");
assert.equal(timeline.excluded.some(({ eventRef, reason }) => reason === "CHILD" && autonomousRefs.has(eventRef)), false, "Un LifeEvent enfant ne doit pas remonter top-level.");
assert.equal(timeline.events.filter(({ sourceKind }) => sourceKind === "LIFE_EVENT").every(({ causalCost }) => causalCost.status === "UNKNOWN" && !("value" in causalCost)), true, "Un LifeEvent autonome ne reçoit aucun faux coût.");
const fckgIdentity = m6.momentIdentities.find(({ canonicalName }) => canonicalName.status === "KNOWN" && canonicalName.value === "Soirée techno – FCKG Halloween");
assert.ok(fckgIdentity, "Le Moment FCKG Halloween est absent.");
const fckg = timeline.events.find(({ eventRef }) => eventRef === `moment:${fckgIdentity.momentId}`);
assert.equal(fckg?.causalCost.status, "KNOWN");
assert.equal(fckg?.causalCost.value, "0");
assert.equal(timeline.events.every((event) => event.primaryPlaceRef === undefined || event.places.some(({ placeRef }) => placeRef === event.primaryPlaceRef)), true, "Un primary place doit toujours provenir des places transportées.");
const servianFontes = timeline.events.find(({ eventRef }) => eventRef === "moment:31b4cb42-8ac0-5987-8564-372d41c2621c");
assert.ok(servianFontes, "Le Moment réel Visite famille Servian / Fontès est absent.");
assert.deepEqual(servianFontes.places.map(({ placeRef }) => placeRef), [`place:${servianFamilyPlaceId}`, `place:${fontesFatherPlaceId}`], "Les deux localisations Canonical confirmées Servian / Fontès doivent être transportées.");
assert.equal(servianFontes.places.every(({ authority }) => authority === "LIFE_EVENT_LOCALIZATION"), true, "Servian / Fontès doit provenir uniquement des localisations explicitement reliées.");
assert.equal("primaryPlaceRef" in servianFontes, false, "Le cas multi-lieu Servian / Fontès ne doit pas fabriquer de primary place.");
assert.equal(timeline.events.every(({ places }) => new Set(places.map(({ placeRef }) => placeRef)).size === places.length), true, "Les place refs Timeline doivent être dédupliquées.");
const duplicatePrimaryMoment = timeline.events.find(({ eventRef }) => eventRef === `moment:${duplicatePrimaryLink.moment_id}`);
assert.ok(duplicatePrimaryMoment, "Le Moment de déduplication primary/localization est absent.");
assert.equal(duplicatePrimaryMoment.places.filter(({ placeRef }) => placeRef === `place:${duplicatePrimaryEvent.primary_place_id}`).length, 1, "Une même place primary/localization doit être transportée une seule fois.");
assert.equal(duplicatePrimaryMoment.primaryPlaceRef, `place:${duplicatePrimaryEvent.primary_place_id}`, "Le primary place Canonical doit rester distinct même quand des localisations existent.");
assert.equal(timeline.inputHash.length, 64);
assert.equal(new Set(timeline.dependencyClosure.map(({ ref }) => ref)).size, timeline.dependencyClosure.length);

assert.equal(grocery.thresholds.p25, "18.29", "Le P25 Courses du fixture a dérivé.");
assert.equal(grocery.thresholds.p75, "51.99", "Le P75 Courses du fixture a dérivé.");
assert.equal(grocery.eligibleMonthCount, 9, "Le nombre de mois Courses éligibles a dérivé.");
assert.equal(grocery.months.length, 12, "Le grain Household-month doit couvrir les 12 mois certifiés.");
assert.equal(grocery.historicalComparisonGate, "AVAILABLE");
assert.equal(grocery.months.filter(({ coverage }) => coverage < 0.7).every(({ basketStructure }) => basketStructure.status === "GATED"), true, "Sous 70 %, la structure de paniers doit rester gated.");
assert.equal(grocery.months.filter(({ coverage }) => coverage < 0.7).every(({ monthlyGrocerySpend }) => monthlyGrocerySpend.status === "KNOWN"), true, "La dépense M2 reste disponible sous le gate M4.");
assert.equal(grocery.months.filter(({ basketStructure }) => basketStructure.status === "KNOWN").every(({ basketStructure, knownCostOccurrenceCount }) => basketStructure.small + basketStructure.intermediate + basketStructure.large === knownCostOccurrenceCount), true, "La structure doit réconcilier les occurrences à coût connu.");
assert.equal(grocery.inputHash.length, 64);
assert.equal(new Set(grocery.dependencyClosure.map(({ ref }) => ref)).size, grocery.dependencyClosure.length);
const integrated = await resolveGlobalV2ProductionOwnerOutputs(repository);
assert.equal(integrated.candidateAdapters.timeline.inputHash, timeline.inputHash, "Le wiring production doit exposer le même bundle Timeline.");
assert.equal(integrated.candidateAdapters.grocery.inputHash, grocery.inputHash, "Le wiring production doit exposer le même bundle Courses.");
assert.equal(integrated.ownerOutputs.length, 10, "D3 ne doit créer aucun nouvel owner.");

const candidate = buildGlobalV2CandidateFromOwnerOutputs({
  project: "ipuuhxrblxormwgoaqnz", householdId: household.household_id, householdTimeZone: household.timezone,
  personIds: persons.map(({ personId }) => personId), asOf, certifiedThrough, dataRevision: String(revision.data_revision), analyticsRevision: String(revision.analytics_revision),
  implementationIdentity: "6af8ae20d08c2906fdb45cf59d3c12c79ae1700b", ownerOutputs: integrated.ownerOutputs,
  presentationLabels: integrated.presentationLabels, candidateAdapters: integrated.candidateAdapters, momentComponentPresentation: integrated.momentComponentPresentation,
});
const timelineSnapshot = candidate.snapshots.find(({ resource }) => resource === "analysis_global_life_timeline");
assert.ok(timelineSnapshot, "Le snapshot Timeline doit être requis par le candidat.");
assert.equal(timelineSnapshot.payload.events.length, 47);
assert.deepEqual(timelineSnapshot.payload.chapterOverlays, [], "M3 EVALUATED_EMPTY ne doit pas être forcé.");
assert.deepEqual(timelineSnapshot.payload.contextSignals, [], "M5 AUTHORITY_GATED ne doit pas être forcé.");
assert.ok(Buffer.byteLength(JSON.stringify(timelineSnapshot.payload)) < 96 * 1024, "Le payload Timeline doit rester sous 96 KiB.");
const momentEvents = timelineSnapshot.payload.events.filter(({ sourceKind }) => sourceKind === "MOMENT");
const autonomousEvents = timelineSnapshot.payload.events.filter(({ sourceKind }) => sourceKind === "LIFE_EVENT");
assert.equal(momentEvents.length, 37);
assert.equal(autonomousEvents.length, 10);
assert.equal(autonomousEvents.every(({ causalCost }) => causalCost.status === "UNKNOWN" && !("value" in causalCost)), true, "UNKNOWN ne doit jamais devenir zéro.");
const details = candidate.snapshots.filter(({ resource }) => resource === "analysis_global_moment_experience_detail");
assert.equal(details.length, momentEvents.length, "Chaque Moment Timeline doit avoir un détail same-generation.");
assert.equal(momentEvents.every(({ eventRef }) => details.some(({ params }) => params.entityRef === eventRef)), true);
const detailKeys = new Set(details.map(({ key }) => key));
const peerObservations = details.flatMap(({ payload }) => payload.peerObservations ?? []);
assert.equal(peerObservations.length, 94, "Les 94 peer observations de la fixture doivent être résolues.");
assert.equal(peerObservations.every(({ detailRef }) => detailKeys.has(detailRef)), true, "Chaque peer detailRef doit viser la même génération.");
const componentRows = details.flatMap(({ payload }) => payload.momentComponentRows ?? []);
assert.equal(componentRows.length, 154, "Les 154 composants causaux doivent être conservés.");
assert.equal(componentRows.every(({ primaryLabel }) => primaryLabel.length > 0), true, "Aucun composant ne doit être supprimé faute de label.");
assert.deepEqual(Object.fromEntries([...new Set(componentRows.map(({ labelSource }) => labelSource))].sort().map((source) => [source, componentRows.filter(({ labelSource }) => labelSource === source).length])), { CANONICAL_MERCHANT: 98, ITEM: 7, PRECISE_DESCRIPTION: 14, PRECISE_TYPE: 35 }, "Le fallback TL-04 doit conserver la distribution réelle, dont les 7 joins Allocation -> exact item_id.");
for (const detail of details) {
  const causal = detail.payload.metrics.find(({ metricId }) => metricId.endsWith(":causal-cost"))?.typedMeasure?.value;
  assert.ok(causal !== undefined, `Coût causal absent pour ${detail.params.entityRef}`);
  const rowTotal = (detail.payload.momentComponentRows ?? []).reduce((sum, row) => sum + Number(row.amount.value), 0);
  const groupTotal = (detail.payload.componentGroups ?? []).reduce((sum, group) => sum + Number(group.amount.value), 0);
  assert.ok(Math.abs(rowTotal - Number(causal)) < 1e-8, `Réconciliation rows invalide pour ${detail.params.entityRef}`);
  assert.ok(Math.abs(groupTotal - Number(causal)) < 1e-8, `Réconciliation groups invalide pour ${detail.params.entityRef}`);
  assert.ok(Buffer.byteLength(JSON.stringify(detail.payload)) < 96 * 1024, `Payload détail >96 KiB pour ${detail.params.entityRef}`);
}
const detailByName = (name) => details.find(({ payload }) => payload.rows[0]?.labelKey === name)?.payload;
assert.equal(detailByName("Aménagement du salon 2025")?.metrics.find(({ metricId }) => metricId.endsWith(":causal-cost"))?.typedMeasure?.value, "2298.96");
assert.equal(detailByName("Voyage à Minorque 2025")?.momentComponentRows.length, 38);
assert.equal(detailByName("Concert Orelsan – Sud de France Arena")?.metrics.find(({ metricId }) => metricId.endsWith(":causal-cost"))?.typedMeasure?.value, "159.4");
const fckgDetail = detailByName("Soirée techno – FCKG Halloween");
assert.equal(fckgDetail?.metrics.find(({ metricId }) => metricId.endsWith(":causal-cost"))?.typedMeasure?.value, "0");
assert.equal(fckgDetail?.momentComponentRows.length, 0);
const groceryDetail = candidate.snapshots.find(({ resource, params }) => resource === "analysis_global_routine_detail" && params.entityRef === "household-activity:courses_alimentaires")?.payload;
assert.ok(groceryDetail?.groceryRhythm, "L'adapter Courses doit être exposé dans le détail routine.");
assert.equal(groceryDetail.groceryRhythm.thresholds.p25.value, "18.29");
assert.equal(groceryDetail.groceryRhythm.thresholds.p75.value, "51.99");
assert.equal(groceryDetail.groceryRhythm.eligibleMonthCount, 9);
assert.equal(groceryDetail.groceryRhythm.months.filter(({ coverage }) => coverage < 0.7).every(({ basketStructure }) => basketStructure.status === "GATED"), true);

console.log(`D4 real fixture: timeline ${timeline.events.length}, details ${details.length}, peers ${peerObservations.length}, components ${componentRows.length}, grocery ${grocery.eligibleMonthCount}/12 eligible — PASS (offline read-only fixture).`);
