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
const { CanonicalRepository } = require(path.resolve("src/server/canonical/repository.ts"));
const { resolveGlobalM5PersonAuthority } = require(path.resolve("src/server/analytics/global-v2-relationship-authority.ts"));
const { buildGlobalCurrentRegime } = require(path.resolve("src/analytics/global-v2/temporal-lifecycle.ts"));
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const householdId = uuid(1), personId = uuid(2), typeId = uuid(3);
const months = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, "0")}`);
const tables = { canonical_household_scope_control: [{ household_count: 1, household_id: householdId, status: "READY" }], person_days: [], life_events: [], life_event_types: [{ life_event_type_id: typeId, type_key: "repas_restaurant", can_span_days: false, active: true }], life_event_participations: [] };
let ordinal = 10;
for (const month of months) {
  const count = new Date(`${month}-01T00:00:00Z`); count.setUTCMonth(count.getUTCMonth() + 1); count.setUTCDate(0);
  for (let d = 1; d <= count.getUTCDate(); d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`, personDayId = uuid(ordinal++);
    tables.person_days.push({ person_day_id: personDayId, person_id: personId, date, couverture_localisation: "Absente" });
    if ([0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())) {
      const eventId = uuid(ordinal++);
      tables.life_events.push({ life_event_id: eventId, life_event_type_id: typeId, life_event_series_id: null, parent_life_event_id: null, start_date: date, end_date: date, validation_status: "Confirmé" });
      tables.life_event_participations.push({ life_event_id: eventId, person_day_id: personDayId, person_id: personId, participation_status: "Confirmée" });
    }
  }
}
const reads = [];
const clientFor = (data) => ({ from(table) {
  assert.ok(Object.hasOwn(data, table), `Unplanned source ${table}`); reads.push(table);
  let rows = [...data[table]], selected;
  const query = {
    select(columns) { selected = columns.split(","); return query; },
    in(key, values) { rows = rows.filter((row) => values.includes(row[key])); return query; },
    eq(key, value) { rows = rows.filter((row) => row[key] === value); return query; },
    gte(key, value) { rows = rows.filter((row) => row[key] >= value); return query; },
    lte(key, value) { rows = rows.filter((row) => row[key] <= value); return query; },
    lt(key, value) { rows = rows.filter((row) => row[key] < value); return query; },
    order() { return query; }, limit(n) { rows = rows.slice(0, n); return query; },
    then(resolve, reject) { return Promise.resolve({ data: rows.map((row) => Object.fromEntries(selected.map((key) => [key, row[key]]))), error: null }).then(resolve, reject); },
  };
  return query;
} });
const context = { householdId, personIds: [personId], persons: [{ personId, householdId }], timezone: "Europe/Paris", dataRevision: "1", analyticsRevision: "79", asOf: "2026-01-01T00:00:00Z", periods: months.map((month, i) => ({ analysisPeriodId: uuid(10000 + i), householdId, month: `${month}-01`, financeStatus: "unknown", lifeStatus: "complete", locationStatus: "unknown", calendarStatus: "complete", isClosed: true, sourceRevision: "1" })) };
const scope = { subject: { kind: "person", personId }, time: { kind: "global_v2", asOf: context.asOf, certifiedThrough: "2025-12-31" } };
const regime = { personId, result: buildGlobalCurrentRegime({ points: months.map((month) => ({ month, status: "KNOWN", value: "1", complete: true, eligible: true, corpus: "CERTIFIED_HISTORY", dependencyRefs: [`fixture:${month}`] })), certifiedThroughMonth: "2025-12", regime: { kind: "DURABLE_CHANGE", status: "CONFIRMED_ONGOING", start: "2025-01", evidenceRefs: ["fixture:canonical-change"] } }) };
const run = (data = tables, extra = {}) => resolveGlobalM5PersonAuthority({ repository: new CanonicalRepository(clientFor(data), context), scope, regime, ...extra });
const result = await run();
let count = 0;
const check = (fn) => { fn(); count++; };
const restaurant = (output) => output.current.results.find((row) => row.relationshipId === "weekend-restaurant");
check(() => assert.equal(result.providerStatus.restaurant, "CANONICAL_FACTS_CONNECTED"));
check(() => assert.equal(result.resolution.certifiedUnitIds.length, 365));
check(() => assert.equal(restaurant(result).effect.absoluteEffect, 1));
check(() => assert.equal(restaurant(result).evidenceStatus, "PUBLISHED"));
check(() => assert.equal(result.relationships.find((row) => row.relationshipId === "weekend-restaurant").state, "STABLE_CURRENT_REGIME"));
check(() => assert.ok(result.current.fdr.exclusions.find((row) => row.id === "onsite-restaurant").exclusionReason.includes("AUTHORITY_GATED_DAY_CONTEXT")));
check(() => assert.deepEqual([...new Set(reads)].sort(), Object.keys(tables).sort()));
const noParticipation = await run({ ...tables, life_event_participations: [] });
check(() => assert.equal(noParticipation.current.fdr.eligibleTestCount, 0));
check(() => assert.notEqual(noParticipation.inputHash, result.inputHash));
const noRegime = await resolveGlobalM5PersonAuthority({ repository: new CanonicalRepository(clientFor(tables), context), scope });
check(() => assert.equal(noRegime.providerStatus.regime, "AUTHORITY_GATED"));
check(() => assert.equal(noRegime.current.fdr.eligibleTestCount, 0));
const partialContext = { ...context, periods: context.periods.map((p) => ({ ...p, lifeStatus: "partial" })) };
const partial = await run(tables, { repository: new CanonicalRepository(clientFor(tables), partialContext) });
check(() => assert.equal(partial.current.fdr.eligibleTestCount, 0));
await assert.rejects(() => run(tables, { scope: { ...scope, subject: { kind: "person", personId: uuid(999) } } }), /Household/); count++;
const reordered = await run(Object.fromEntries(Object.entries(tables).map(([key, rows]) => [key, [...rows].reverse()])));
check(() => assert.equal(reordered.inputHash, result.inputHash));
check(() => assert.equal(result.liveWrites, "NONE"));
const geoOnly = await run({ ...tables, person_days: tables.person_days.map((row) => ({ ...row, couverture_localisation: "Complète" })) });
check(() => assert.equal(geoOnly.inputHash, result.inputHash));
const financeOnly = await run(tables, { repository: new CanonicalRepository(clientFor(tables), { ...context, periods: context.periods.map((period) => ({ ...period, financeStatus: "complete" })) }) });
check(() => assert.equal(financeOnly.inputHash, result.inputHash));
const missingDay = await run({ ...tables, person_days: tables.person_days.slice(1) });
check(() => assert.ok(missingDay.resolution.window.gapDates.includes("2025-01-01")));
check(() => assert.notEqual(restaurant(missingDay).evidenceStatus, "PUBLISHED"));
const workLabels = await run({ ...tables, life_event_types: [{ ...tables.life_event_types[0], type_key: "travail_site" }] });
check(() => assert.ok(workLabels.current.fdr.exclusions.find((row) => row.id === "onsite-restaurant").exclusionReason.includes("AUTHORITY_GATED_DAY_CONTEXT")));
console.log(`P06 CanonicalRepository → FactSourceResolver → M5: PASS ${count}/${count} (synthetic canonical rows; no network/write method).`);
