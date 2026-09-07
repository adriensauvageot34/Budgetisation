import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const originalLoad = Module._load, originalResolve = Module._resolveFilename;
Module._load = function(request, parent, isMain) { return request === "server-only" ? {} : originalLoad.call(this, request, parent, isMain); };
Module._resolveFilename = function(request, parent, isMain, options) {
  const target = request.startsWith("@/") ? path.resolve("src", request.slice(2)) : request;
  try { return originalResolve.call(this, target, parent, isMain, options); } catch (error) {
    if (path.extname(target)) throw error;
    for (const candidate of [`${target}.ts`, path.join(target, "index.ts")]) try { return originalResolve.call(this, candidate, parent, isMain, options); } catch { /* next */ }
    throw error;
  }
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename }).outputText, filename);

const { resolveGlobalM7PlaceAuthority } = require(path.resolve("src/server/analytics/global-v2-place-authority.ts"));
const { parseMoney } = require(path.resolve("src/core/money/index.ts"));
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const householdId = uuid(1), personId = uuid(2), secondPersonId = uuid(3), cityId = uuid(10), venueId = uuid(11);
const visits = [{ fact: "fct_place_visit", householdId, householdTimeZone: "Europe/Paris", visitKey: "visit:1", personDayId: "day:1", personId, placeId: venueId, localDate: "2026-06-10", interval: { kind: "known", startedAt: "2026-06-10T08:00:00Z", endedAt: "2026-06-10T09:00:00Z" }, timePrecision: "exact", sequenceIndex: 1 }];
const days = [
  { fact: "fct_person_day", householdId, householdTimeZone: "Europe/Paris", personDayId: "day:1", personId, localDate: "2026-06-10", locationObservability: "observable" },
  { fact: "fct_person_day", householdId, householdTimeZone: "Europe/Paris", personDayId: "day:2", personId: secondPersonId, localDate: "2026-06-10", locationObservability: "observable" },
];
const economics = [{ fact: "fct_economic_component", householdId, householdTimeZone: "Europe/Paris", canonicalComponentKey: "component:1", sourceOperation: { kind: "resolved", id: uuid(20) }, gross: parseMoney("25"), refundApplied: parseMoney("0"), net: parseMoney("25"), bankDate: { kind: "known", date: "2026-06-10" }, economicTiming: { kind: "known", segments: [{ segmentKey: "segment:1", timingState: "known", periodStart: "2026-06-10", periodEnd: "2026-06-10", economicMonth: "2026-06", amount: parseMoney("25") }] }, person: { kind: "unknown" }, category: { kind: "undetermined" }, subcategory: { kind: "unknown" }, activity: { kind: "unknown" }, merchant: { kind: "unknown" }, moment: { kind: "unknown" }, canonicalPlace: { kind: "resolved", placeId: venueId, resolution: "operation_place_canonical" }, necessity: { kind: "unknown" }, behavior: { kind: "unknown" }, lifeScope: { kind: "unknown" } }];
const purchases = [{ fact: "fct_purchase_event", householdId, householdTimeZone: "Europe/Paris", purchaseEventId: "purchase:1", sources: [{ membershipKind: "CONSUMPTION_COMPONENT", kind: "operation", sourceId: uuid(20), canonicalComponentKey: "component:1", evidenceRefs: ["operation:20"], provenance: "STRUCTURED_CANONICAL_SOURCE" }], economicAmount: parseMoney("25"), timing: { status: "KNOWN", precision: "DAY", economicDate: "2026-06-10", economicMonth: "2026-06", authority: "EXPLICIT_CONSUMPTION_SOURCE", evidenceRefs: ["operation:20"] }, provenance: "STRUCTURED_CANONICAL_SOURCE" }];
const context = { householdId, personIds: [personId, secondPersonId], persons: [], timezone: "Europe/Paris", dataRevision: "1", analyticsRevision: "79", asOf: "2026-07-01T00:00:00Z", periods: [{ month: "2026-01" }] };
const calls = [];
const repository = {
  context,
  async loadEntityRows(table) { calls.push(`read:${table}`); return [{ place_id: cityId, resolution_level: "MUNICIPALITY" }, { place_id: venueId, parent_place_id: cityId, resolution_level: "VENUE" }]; },
  async loadPlaceVisits() { calls.push("read:visits"); return visits; },
  async loadPersonDays() { calls.push("read:person-days"); return days; },
  async loadEconomicFacts() { calls.push("read:economics"); return economics; },
  async loadPurchaseEvents() { calls.push("read:purchases"); return purchases; },
};
const scope = { subject: { kind: "household" }, time: { kind: "global_v2", asOf: context.asOf, certifiedThrough: "2026-06-30" } };
const result = await resolveGlobalM7PlaceAuthority({ repository, scope });
let checks = 0; const check = (fn) => { fn(); checks += 1; };
check(() => assert.equal(result.visits.length, 1));
check(() => assert.equal(result.places.find(({ placeId }) => placeId === venueId).visitCount, 1));
check(() => assert.equal(result.finance.attributions.length, 1));
check(() => assert.equal(result.finance.rankingMode, "GLOBAL"));
check(() => assert.equal(result.boundary.certifiedUnitIds.length, 1));
check(() => assert.equal(result.boundary.window.naturalGrain, "VISIT"));
check(() => assert.equal(result.dependencyDeclaration.naturalGrain, "VISIT"));
check(() => assert.equal(result.providerStatus.canonicalPlaces, "CONNECTED"));
check(() => assert.equal(result.providerStatus.canonicalVisits, "CONNECTED"));
check(() => assert.equal(result.providerStatus.placeRoles, "AUTHORITY_GATED"));
check(() => assert.equal(result.providerStatus.mobility, "AUTHORITY_GATED"));
check(() => assert.equal(result.liveWrites, "NONE"));
check(() => assert.deepEqual(calls.sort(), ["read:economics", "read:person-days", "read:places", "read:purchases", "read:visits"]));
check(() => assert.equal(calls.some((call) => /gps|route|write|insert|update/i.test(call)), false));
check(() => assert.ok(result.dependencyClosure.some(({ ref }) => ref === "economic-component:component:1")));
check(() => assert.ok(result.sourceHash.length === 64 && result.executionHash.length === 64));

const personal = await resolveGlobalM7PlaceAuthority({ repository, scope: { ...scope, subject: { kind: "person", personId } } });
check(() => assert.equal(personal.visits.length, 1));
check(() => assert.equal(personal.economicFacts, undefined));
check(() => assert.equal(personal.finance.attributions.length, 0));
check(() => assert.equal(personal.providerStatus.localizedFinance, "AUTHORITY_GATED_PERSON_COMPONENT_SPLIT"));

await assert.rejects(() => resolveGlobalM7PlaceAuthority({ repository, scope: { ...scope, filters: { placeIds: [venueId] } } }), /FILTER_PROVIDER_NOT_RESOLVED/); checks += 1;
await assert.rejects(() => resolveGlobalM7PlaceAuthority({ repository, scope: { ...scope, time: { ...scope.time, asOf: "2026-07-02T00:00:00Z" } } }), /ASOF_MISMATCH/); checks += 1;

console.log(`P08 Canonical → Facts → M7 authority: PASS ${checks}/${checks} (synthetic repository; no network/write method).`);
