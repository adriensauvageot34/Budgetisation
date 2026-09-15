import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Module, { createRequire } from "node:module";
import ts from "typescript";
import Big from "big.js";

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
const client = createFixtureSupabaseClient(fixturePath, { emptyTables: ["purchase_events", "purchase_event_memberships", "purchase_event_timing_assertions", "economic_component_classifications", "life_event_continuity_assertions"] });
const { CanonicalRepository } = require(path.resolve("src/server/canonical/repository.ts"));
const { resolveGlobalM6MomentAuthority } = require(path.resolve("src/server/analytics/global-v2-moment-authority.ts"));
const { parseGlobalMomentCausalComponentTransport } = require(path.resolve("src/analytics/global-v2/moments.ts"));
const repository = new CanonicalRepository(client, context);
const eligiblePeriods = periods.filter((period) => period.isClosed && period.month <= asOf.slice(0, 10) && period.financeStatus !== "unknown" && period.lifeStatus !== "unknown" && period.calendarStatus !== "unknown").sort((left, right) => left.month.localeCompare(right.month));
const latest = eligiblePeriods.at(-1);
assert.ok(latest, "Le fixture ne contient aucune période certifiée.");
const month = latest.month.slice(0, 7);
const certifiedThrough = `${month}-${new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate().toString().padStart(2, "0")}`;
const result = await resolveGlobalM6MomentAuthority({ repository, scope: { subject: { kind: "household" }, time: { kind: "global_v2", asOf, certifiedThrough } } });

const transport = parseGlobalMomentCausalComponentTransport(JSON.parse(JSON.stringify(result)));
assert.equal(result.summaries.length, 37, "Le nombre de Moments du fixture a dérivé.");
assert.equal(transport.length, 37, "Tous les Moments doivent traverser le parser owner.");
assert.equal(transport.reduce((count, summary) => count + summary.causalComponents.length, 0), 154, "Le nombre de composants causaux du fixture a dérivé.");
const reconciled = result.summaries.filter((summary) => summary.causalCost.status === "KNOWN" || summary.causalCost.status === "PARTIAL");
assert.equal(reconciled.length, 37, "Tous les Moments du fixture doivent avoir un coût réconciliable.");
const total = reconciled.reduce((sum, summary) => sum.plus(summary.causalCost.value), new Big(0));
assert.equal(total.toFixed(2), "7758.83", "Le total causal du fixture a dérivé.");
const fckgIdentity = result.momentIdentities.find(({ canonicalName }) => canonicalName.status === "KNOWN" && canonicalName.value === "Soirée techno – FCKG Halloween");
assert.ok(fckgIdentity, "Le Moment FCKG Halloween est absent du fixture.");
const fckg = result.summaries.find(({ moment }) => moment.momentId === fckgIdentity.momentId);
assert.equal(fckg?.causalCost.status, "KNOWN");
assert.equal(fckg?.causalCost.value, "0");
assert.deepEqual(fckg?.causalComponents, []);

console.log(`D2 real fixture: 37/37 Moments, 154 causal components, EUR ${total.toFixed(2)}, FCKG known zero with 0 component — PASS (offline read-only fixture).`);
