import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React from "react";
import { live, inputs, plan, base, category, render, props, row } from "./check-phase2-month-decision-engine.mjs";
import { item } from "./lib/planned-actions-harness.mjs";
const require = createRequire(import.meta.url);
const { deriveMonthScenario, defaultMonthInputs } = require("../src/server/phase2/month-scenario.ts");
const { defaultMonthDecisionSettings } = require("../src/domain/phase2/month-decision-contract.ts");
const { forecastTemporalPolicy } = require("../src/server/phase2/forecast-temporal-policy.ts");
const { projectMonthDecision } = require("../src/server/phase2/month-decision-projection.ts");
const { MonthForecastView } = require("../src/app/mois-a-venir/month-forecast-view.tsx");
const { MonthStory } = require("../src/app/mois-a-venir/month-story.tsx");
const { PlannedBuilderFrame } = require("../src/app/mois-a-venir/planned-wizard-visuals.tsx");
const settings = defaultMonthDecisionSettings();
const display = (p, expenses = [], asOf = "2026-10-01", memory = []) => projectMonthDecision(p, settings, "2026-10", asOf, expenses, memory);
const expense = (key, module, amount, extra = {}) => ({
  id: `fixture-${key}`, targetMonth: "2026-10", status: "PLANNED", familyKey: "food", subtypeKey: module,
  title: "Courses du mois", plannedDate: "2026-10-22", context: {},
  costItems: [{ ...item(amount, module === "groceries" ? "groceries:food" : "work_meal:bakery", [module]), baselineKey: key }],
  ...extra,
});
for (const [key, module, amount, context] of [
  ["groceries", "groceries", "50.00", {}],
  ["adrien-work-meals", "work_meal", "6.00", { participantPersonIds: ["adrien"] }],
  ["manon-work-meals", "work_meal", "5.00", { participantPersonIds: ["manon"] }],
]) {
  const planned = expense(key, module, amount, { context });
  const realized = { ...planned, status: "DECLARED_REALIZED" };
  const initial = plan("2026-10-01");
  const p = plan("2026-10-01", [planned]), r = plan("2026-10-01", [realized]);
  const dp = display(p, [planned]).visible.categoryDisplay[key], dr = display(r, [realized]).visible.categoryDisplay[key];
  if (key === "groceries") assert.equal(category(p, key).projectedMonth.central, category(initial, key).projectedMonth.central, "groceries: habitual absorption");
  else assert(Number(category(p, key).remaining.central) < Number(category(initial, key).remaining.central), "a dated work meal releases its estimated opportunity");
  assert.equal(category(r, key).projectedMonth.central, category(p, key).projectedMonth.central);
  assert.equal(p.narrative.final.central, r.narrative.final.central, "declaration cannot grow the projection");
  assert.equal(dp.planned, Number(amount)); assert.equal(dp.observed, 0);
  assert.equal(dr.planned, 0); assert.equal(dr.observed, 0); assert.equal(dr.declared, Number(amount));
  assert.equal(dp.remaining.central, dr.remaining.central);
  for (const d of [dp, dr]) assert.equal(d.observed + d.declared + d.planned + d.remaining.central, d.projectedCentral);
  assert.equal(category(r, key).alreadyRealized, "0.00", "declared does not mutate canonical observed facts");
}
// Fractional observations, explicit plans and exhausted estimates must remain nonnegative and sum visibly.
for (const amount of ["0.49", "50.49", "300.49", "500.99"]) {
  const p = expense("groceries", "groceries", amount);
  const facts = { ...live, predictionEvidence: { ...live.predictionEvidence,
    currentEconomicEntries: [{ operationId: "fraction", date: "2026-10-01", subcategory: "Courses alimentaires", amount: "0.49", person: null, preciseType: null, merchant: null }] } };
  const scenario = plan("2026-10-01", [p], settings, facts);
  const d = display(scenario, [p]).visible.categoryDisplay.groceries;
  assert.equal(d.observed + d.declared + d.planned + d.remaining.central, d.projectedCentral);
  assert(d.observed >= 0 && d.planned >= 0 && d.remaining.central >= 0);
}
const early = plan("2026-10-01");
assert.equal(early.narrative.prediction.currentImportsMissing, true);
assert(early.narrative.final.central !== null && Number.isFinite(Number(early.narrative.final.central)));
assert(!display(early).attention.some(a => a.key === "coverage"));
assert.equal(display(early).attention.length, 0);
assert.equal(display(early, [], undefined, [{ ...row, model_version: "obsolete" }]).change.sampleCount, 0);
// The imported temporal fixture is not comparable to FULL_MONTH_SAFE.
assert.equal(display(early, [], undefined, [row]).change.sampleCount, 0);
assert.equal(display(early, [], undefined, [{...row,model_version:forecastTemporalPolicy(early.narrative.prediction.forecastTemporalMode).modelVersion}]).change.sampleCount, 1);
for (const p of [early, base]) {
  const d = display(p).visible;
  for (const c of [...p.narrative.prediction.essential, ...p.narrative.prediction.optional]) {
    const terms = d.categoryDisplay[c.key];
    assert.equal(terms.observed + terms.declared + terms.planned + terms.remaining.central, terms.projectedCentral);
  }
  assert.equal(p.narrative.prediction.essential.reduce((n, c) => n + d.categoryDisplay[c.key].projectedCentral, 0), d.essentialTotal);
  assert.equal(p.narrative.prediction.optional.reduce((n, c) => n + d.categoryDisplay[c.key].projectedCentral, 0), d.optionalTotal);
}
assert.equal(defaultMonthInputs().safetyReserve, "0");
assert.equal(defaultMonthInputs().decision.goal, null);
const cashInputs = { ...inputs, openingBalance: { amount: "1000.00", asOfDate: "2026-10-01" } };
const cash = deriveMonthScenario(live, cashInputs, null, "2026-10-01");
const legacyBuffer = deriveMonthScenario(live, { ...cashInputs, safetyReserve: "200.00" }, null, "2026-10-01");
const goal = deriveMonthScenario(live, { ...cashInputs, decision: { ...settings, goal: "200.00" } }, null, "2026-10-01");
assert.equal(legacyBuffer.availableNow.value, "1000.00");
for (const candidate of [legacyBuffer, goal]) {
  assert.deepEqual(candidate.freeToSpend, cash.freeToSpend);
  assert.deepEqual(candidate.cashPrudent, cash.cashPrudent);
  assert.equal(candidate.economicPlan.narrative.final.central, cash.economicPlan.narrative.final.central);
}

const viewProps = { forecast: { ...live, meta: { ...live.meta, computedAt: "2026-10-01T00:00:00Z" },
  components: live.components.map(c => ({ provenance: [], limitations: [], ...c })) }, scenario: cash, stored: { inputs: cashInputs }, plannedExpenses: [], persons: [], places: [],
  vehicle: null, prices: [], wallets: [], today: "2026-10-01", inputError: false };
const html = render(React.createElement(MonthForecastView, viewProps));
assert.equal((html.match(/<h1 /g) ?? []).length, 1);
assert.match(html, /class="[^"]*\bsticky\b/); assert.match(html, /\+ Ajouter une dépense/);
assert.doesNotMatch(html, /id="planned-expense-title"|href="#planned-expense-title"|Ajouter quelque chose à notre mois|Aucun projet|Aucune prévision|Aucune dépense/);
// Unknown wallet stock must retain its uncertainty label even on a priced month.
assert.doesNotMatch(html, /Référence du quotidien nécessaire|Référence des dépenses facultatives|Total central du mois|imports partiels|Pourquoi \?|Tester une dépense|À regarder ensemble|Comment notre projection évolue|Marge de sécurité/);
// The existing V2 writer now lives in the lazy Centre; it is not inline at rest.
assert.match(html, /data-month-control-trigger/);
const story = html.slice(html.indexOf('id="necessary-title"'), html.indexOf('id="complete-month"'));
assert.doesNotMatch(story, /name="assumptionMode"/, "assumptions moved to settings");
assert.doesNotMatch(story, /name="assumptionAmount"/, "legacy inputs remain in the Centre writer");
const grocery = expense("groceries", "groceries", "50.00");
const card = { ...grocery, grossCost: "50.00", updatedAt: "2026-10-01T00:00:00Z", needsRealityConfirmation: false };
const withProject = render(React.createElement(MonthForecastView, { ...viewProps, plannedExpenses: [card],
  scenario: deriveMonthScenario(live, cashInputs, null, "2026-10-01", [grocery]) }));
assert.match(withProject, /id="planned-expense-title"/); assert.match(withProject, /href="#planned-expense-title"/);
assert.equal((withProject.match(/<h2[^>]*>Nos projets<\/h2>/g) ?? []).length, 1);
assert.doesNotMatch(withProject, /À venir \/ prévues|Réalisées ce mois-ci/);
const historic = render(React.createElement(MonthStory, { ...props, plan: early, today: "2026-10-01", settings,
  memory: [{...row,model_version:forecastTemporalPolicy(early.narrative.prediction.forecastTemporalMode).modelVersion}] }));
// History is now reached through the Centre; the pure read-model retains it.
assert.equal(display(early,[],undefined,[{...row,model_version:forecastTemporalPolicy(early.narrative.prediction.forecastTemporalMode).modelVersion}]).change.sampleCount,1);
assert.match(historic, /data-month-story/);
const shell = render(React.createElement(PlannedBuilderFrame, { immersive: true, onDismiss() {}, label: "Préparer une dépense" }, React.createElement("button", null, "Fermer")));
assert.match(shell, /role="dialog"/); assert.match(shell, /aria-modal="true"/);
console.log("PASS month simplification: category absorption/declaration/rounding, early estimates, conditional sections, one header, CTA/overlay markup, settings, goal and legacy buffer isolation, comparable memory; V5 modes and simulations rerun.");
