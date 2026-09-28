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
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
}).outputText, filename);

const { defaultMonthInputs, deriveMonthScenario, monthInputsSchema } = require(path.resolve(root, "src/server/phase2/month-scenario.ts"));
const fixed = { key: "obligation:fixed", label: "Loyer", nature: "CONTRACTUAL_EXPECTED", additiveGroup: "obligations",
  knowledgeState: "PROBABLE", low: "62.00", central: "62.00", high: "62.00" };
const conditional = { key: "obligation:conditional", label: "Ornikar / Alma", nature: "CONDITIONAL_UNKNOWN",
  additiveGroup: null, knowledgeState: "CONDITIONAL_UNKNOWN", low: null, central: null, high: null };
const forecast = { meta: { targetMonth: "2026-10", sourcePublicationId: "test" }, components: [fixed, conditional],
  obligations: { low: "62.00", central: "62.00", high: "62.00" }, economicCost: { low: "100.00", central: "100.00", high: "100.00" },
  income: { low: "200.00", central: "200.00", high: "200.00" }, freeToSpend: { low: "80.00", central: "80.00", high: "80.00" },
  cash: { grossBeforeUnconfirmedFunding: { low: "100.00", central: "100.00", high: "100.00" } }, reserve: { amount: "20.00" } };
const oldPayload = { ...defaultMonthInputs(), safetyReserve: "20.00" };
delete oldPayload.excludedFixedObligations;
delete oldPayload.declinedConditionalObligations;
const inputs = monthInputsSchema.parse(oldPayload);
assert.deepEqual(inputs.excludedFixedObligations, []);
assert.deepEqual(inputs.declinedConditionalObligations, []);
const derive = (next) => deriveMonthScenario(forecast, next, null, "2026-09-28");
const base = derive(inputs);
assert.equal(base.freeToSpend.central, "80.00");
assert.equal(base.fixedExpenseTotal, "62.00");
const excluded = derive({ ...inputs, excludedFixedObligations: [fixed.key] });
assert.equal(excluded.freeToSpend.central, "142.00");
assert.equal(excluded.economicCost.central, "38.00");
assert.equal(excluded.fixedExpenseTotal, "0.00");
assert.equal(excluded.cashPrudent.central, "142.00");
assert.equal(derive(inputs).freeToSpend.central, base.freeToSpend.central, "undo restores the original result");
assert.equal(derive({ ...inputs, declinedConditionalObligations: [conditional.key] }).freeToSpend.central, base.freeToSpend.central);
assert.equal(conditional.central, null, "a No decision does not manufacture a zero amount");
const confirmed = derive({ ...inputs, confirmedObligations: [{ componentKey: conditional.key, amount: "12.00", dueDate: "2026-10-15" }] });
assert.equal(confirmed.freeToSpend.central, "68.00");
assert.throws(() => derive({ ...inputs, declinedConditionalObligations: [conditional.key],
  confirmedObligations: [{ componentKey: conditional.key, amount: "12.00", dueDate: "2026-10-15" }] }), /CONDITIONAL_DECISION_CONFLICT/);
assert.throws(() => derive({ ...inputs, excludedFixedObligations: [conditional.key] }), /FIXED_EXCLUSION_TARGET_INVALID/);
assert.equal(deriveMonthScenario({ ...forecast, components: [conditional], obligations: { low: "0.00", central: "0.00", high: "0.00" } },
  { ...inputs, excludedFixedObligations: [fixed.key] }, null, "2026-09-28").excludedFixedTotal, "0.00",
"a stale decision does not break a newer publication");
assert.equal(forecast.obligations.central, "62.00", "published forecast stays unchanged");
console.log("PASS: legacy JSON, fixed exclusion and undo, conditional Yes/No/Unknown, published forecast unchanged");
