import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import ts from "typescript";

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
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  fileName: filename,
}).outputText, filename);

class Query {
  constructor(rows) { this.rows = rows; this.filters = []; this.sortKey = ""; this.from = 0; this.to = 999; }
  select() { return this; }
  eq(key, value) { this.filters.push((row) => row[key] === value); return this; }
  in(key, values) { this.filters.push((row) => values.includes(row[key])); return this; }
  gte(key, value) { this.filters.push((row) => String(row[key] ?? "") >= value); return this; }
  lte(key, value) { this.filters.push((row) => String(row[key] ?? "") <= value); return this; }
  order(key) { this.sortKey = key; return this; }
  range(from, to) { this.from = from; this.to = to; return this; }
  then(resolve, reject) {
    return Promise.resolve({ data: this.rows.filter((row) => this.filters.every((filter) => filter(row)))
      .sort((a, b) => String(a[this.sortKey] ?? "").localeCompare(String(b[this.sortKey] ?? ""))).slice(this.from, this.to + 1), error: null }).then(resolve, reject);
  }
}
const tables = {
  life_event_types: [{ life_event_type_id: "work", type_key: "travail_site" }, { life_event_type_id: "out", type_key: "sortie_soiree" }],
  life_events: [{ life_event_id: "w1", life_event_type_id: "work", start_date: "2026-01-02", validation_status: "Confirmé" }, { life_event_id: "o1", life_event_type_id: "out", title: "Bar à jeux", start_date: "2026-01-03", validation_status: "Confirmé" }],
  life_event_participations: [{ participation_id: "p1", life_event_id: "w1", person_id: "a", participation_status: "Confirmée" }, { participation_id: "p2", life_event_id: "o1", person_id: "a", participation_status: "Confirmée" }],
  person_place_roles: [{ person_place_role_id: "r1", person_id: "m", place_id: "fontes", role: "FATHER_HOME" }],
  referentiel_lieu: [{ place_id: "fontes", nom_canonique: "Fontès" }],
  person_days: [{ person_day_id: "d1", person_id: "m", date: "2026-01-04" }],
  location_occurrences: [{ localization_id: "l1", person_day_id: "d1", person_id: "m", place_id: "fontes" }, { localization_id: "l2", person_day_id: "d1", person_id: "m", place_id: "fontes" }],
  needs: [{ need_id: "vape", need_key: "vape_manon", person_id: "m" }],
  tags: [{ tag_id: "photo", tag_key: "Contexte:projet_photo" }],
  operation_tags: [{ operation_tag_id: "t1", operation_id: "buy", tag_id: "photo" }, { operation_tag_id: "t2", operation_id: "refund", tag_id: "photo" }],
  operations: [{ operation_id: "buy", montant: "-64.28", date_transaction_reelle: "2026-01-05" }, { operation_id: "refund", montant: "27", date_transaction_reelle: "2026-01-06", rembourse_operation_id: "buy" }, { operation_id: "vape-direct", need_id: "vape", montant: "-23.80", date_transaction_reelle: "2026-01-07" }, { operation_id: "vape-parent", montant: "-64.50", date_transaction_reelle: "2026-01-08" }],
  product_observations: [], recurrence_series: [], operation_place_canonical: [], life_event_financial_links: [], operation_allocations: [{ allocation_id: "va1", operation_id: "vape-parent", need_id: "vape", montant: "64.50" }],
  vehicles: [{ vehicle_id: "car", household_id: "h", owner_person_id: null, label: "Peugeot 207", status: "active" }],
};
const client = { from(table) { assert.ok(table in tables, `unexpected table ${table}`); return new Query(tables[table]); } };
const { resolveGlobalPersonaEditorial } = require(path.resolve(root, "src/server/analytics/global-v2-persona-editorial.ts"));
const model = await resolveGlobalPersonaEditorial({ client, householdId: "h", personIdsByName: { Adrien: "a", Manon: "m" }, firstDay: "2026-01-01", certifiedThrough: "2026-01-31", m1Series: [], m2NeedGroups: [{ dimension: { id: "vape" }, annualAmount: "88.30", historicalSeries: [{ month: "2026-01", amount: "88.30" }] }], mobilitySummaries: [] });
assert.equal(model.schemaVersion, "persona-editorial@v1");
assert.equal(model.persons[0].work.onsiteDays, 1);
assert.equal(model.persons[0].socialLife.outingsWithoutPartnerParticipation.length, 1);
assert.equal(model.persons[0].personalUniverses.photo.grossCost, "64.28");
assert.equal(model.persons[0].personalUniverses.photo.netCost, "37.28");
assert.equal(model.persons[1].socialLife.fatherHome[0].presenceDays, 1);
assert.equal(model.persons[0].recurringHabits.hairdresser.personalAnnualCost, null);
assert.equal(model.persons[1].work.commute.strictOwnerSummary, null);
assert.equal(model.vehicleHouseholdCost.vehicle.label, "Peugeot 207");
assert.equal(model.persons[1].recurringHabits.vape.allocatedObservedCost, "64.50");
assert.equal(model.persons[1].recurringHabits.vape.reconciledToM2, true);
console.log("PERSONA_EDITORIAL_FOUNDATION=PASS");
