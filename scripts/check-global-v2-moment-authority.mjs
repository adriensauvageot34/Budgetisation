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
    for (const candidate of [`${target}.ts`, path.join(target, "index.ts")]) try { return originalResolve.call(this, candidate, parent, isMain, options); } catch {}
    throw error;
  }
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename }).outputText, filename);

const { resolveGlobalM6MomentAuthority } = require(path.resolve("src/server/analytics/global-v2-moment-authority.ts"));
const { parseMoney } = require(path.resolve("src/core/money/index.ts"));
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const householdId = uuid(1), personId = uuid(2);
const economic = (id, momentId, date, amount) => ({
  fact: "fct_economic_component", householdId, householdTimeZone: "Europe/Paris", canonicalComponentKey: `operation:${uuid(id)}`,
  sourceOperation: { kind: "resolved", id: uuid(id) }, gross: parseMoney(String(amount)), refundApplied: parseMoney("0"), net: parseMoney(String(amount)), bankDate: { kind: "known", date },
  economicTiming: { kind: "known", segments: [{ segmentKey: uuid(8000 + id), timingState: "known", periodStart: date, periodEnd: date, economicMonth: `${date.slice(0, 7)}-01`, amount: parseMoney(String(amount)) }] },
  person: { kind: "unknown" }, category: { kind: "undetermined" }, subcategory: { kind: "unknown" }, activity: { kind: "unknown" }, merchant: { kind: "unknown" },
  moment: momentId === undefined ? { kind: "unknown" } : { kind: "resolved", id: momentId }, canonicalPlace: { kind: "unknown" }, necessity: { kind: "unknown" }, behavior: { kind: "unknown" }, lifeScope: { kind: "unknown" },
});
const momentIds = Array.from({ length: 6 }, (_, i) => uuid(100 + i));
const moments = momentIds.map((momentId, i) => ({ moment_id: momentId, household_id: householdId, type: "Week-end / escapade", name: `M${i}`, start_date: `2026-01-${String(2 + i * 3).padStart(2, "0")}`, end_date: `2026-01-${String(4 + i * 3).padStart(2, "0")}`, lodging_mode: "PAID_LODGING" }));
const lifeEvents = momentIds.map((momentId, i) => ({ moment_id: momentId, life_event_id: uuid(200 + i), relation_type: i === 0 ? "Préparation" : "Composant", validation_status: "Confirmé" }));
const participations = lifeEvents.map((link, i) => ({ life_event_id: link.life_event_id, person_day_id: uuid(300 + i), person_id: personId, participation_status: "Confirmée" }));
const financialRows = lifeEvents.map((link, i) => ({ financial_link_id: uuid(400 + i), life_event_id: link.life_event_id, source_kind: "Operation", operation_id: uuid(500 + i), allocation_id: null, item_id: null, cash_use_id: null, relation_type: i === 0 ? "Preparation" : "Cause_par_evenement", economic_amount_linked: String(100 + i * 10), validation_status: "Confirmé" }));
const causalFacts = momentIds.map((momentId, i) => economic(500 + i, momentId, moments[i].start_date, 100 + i * 10));
const duringNonCausal = economic(700, undefined, "2026-01-03", 25);
const context = { householdId, personIds: [personId], persons: [{ personId, householdId, displayName: "Person" }], timezone: "Europe/Paris", dataRevision: "1", analyticsRevision: "79", asOf: "2026-02-01T00:00:00Z", periods: [] };
const calls = [];
const repository = {
  context,
  async loadEntityRows(table) { calls.push(table); return moments; },
  async loadMomentLifeEventRowsByMomentIds() { calls.push("moment_life_events"); return lifeEvents; },
  async loadLifeEventParticipationRows() { calls.push("life_event_participations"); return participations; },
  async loadActivityCausalFinancialLinkRows() { calls.push("life_event_financial_links"); return financialRows; },
  async loadEconomicFacts() { calls.push("economic-range"); return [...causalFacts, duringNonCausal]; },
  async loadEconomicFactsByMomentIds() { calls.push("economic-moment"); return causalFacts; },
};
const scope = { subject: { kind: "household" }, time: { kind: "global_v2", asOf: context.asOf, certifiedThrough: "2026-01-31" } };
const result = await resolveGlobalM6MomentAuthority({ repository, scope });
let count = 0; const check = (fn) => { fn(); count++; };
check(() => assert.equal(result.summaries.length, 6));
check(() => assert.equal(result.summaries.find(({ moment }) => moment.momentId === momentIds[0]).causalCost.value, "100"));
check(() => assert.equal(result.summaries.find(({ moment }) => moment.momentId === momentIds[0]).causalCost.coverage.effective, 1));
check(() => assert.deepEqual(result.summaries.find(({ moment }) => moment.momentId === momentIds[0]).moment.expectedCausalComponentKeys, [`operation:${uuid(500)}`]));
check(() => assert.equal(result.summaries.find(({ moment }) => moment.momentId === momentIds[0]).spentDuring.value, "125"));
check(() => assert.equal(result.summaries.find(({ moment }) => moment.momentId === momentIds[0]).causalRoles[0].role, "PREPARATION"));
check(() => assert.equal(result.boundary.certifiedUnitIds.length, 6));
check(() => assert.equal(result.providerStatus.canonicalMoments, "CONNECTED"));
check(() => assert.equal(result.providerStatus.causalEconomics, "CONNECTED"));
check(() => assert.equal(result.providerStatus.momentPlaceFacets, "PARTIAL"));
check(() => assert.equal(result.dependencyDeclaration.naturalGrain, "MOMENT"));
check(() => assert.ok(result.dependencyClosure.some(({ ref }) => ref === `economic-component:${duringNonCausal.canonicalComponentKey}`)));
check(() => assert.ok(calls.includes("moment_life_events") && calls.includes("economic-moment") && calls.includes("economic-range")));
check(() => assert.equal(result.liveWrites, "NONE"));
check(() => assert.equal(result.crossModuleSignals.replayOwner, "P08"));
check(() => assert.equal(result.crossModuleSignals.replayExecuted, false));
await assert.rejects(() => resolveGlobalM6MomentAuthority({ repository, scope: { ...scope, subject: { kind: "person", personId: uuid(999) } } }), /Household/); count++;
console.log(`P07 Canonical moments → Economic Facts → M6: PASS ${count}/${count} (synthetic canonical rows; no network/write method).`);
