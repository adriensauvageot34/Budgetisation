import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { forecast, inputs } from "./check-phase2-october-contract.mjs";
const require = createRequire(import.meta.url);
require.extensions[".css"] = module => { module.exports = {}; };
require.extensions[".tsx"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
const { deriveMonthScenario } = require("../src/server/phase2/month-scenario.ts");
const { projectPlannedExpenseImpact } = require("../src/server/phase2/planned-impact.ts");
const { parsePlannedExpenseDraft } = require("../src/server/phase2/planned-expenses.ts");
const { projectPlannedExpenseCards, projectMonthCalendar } = require("../src/app/mois-a-venir/planned-expenses-projection.ts");
const { PlannedImpactCard } = require("../src/app/mois-a-venir/planned-impact-card.tsx");
const line = (assetKey, amount, baselineKey = null, fundingAllocations) => ({ id: randomUUID(), label: "Élément", assetKey,
  quantity: "1", unitAmount: amount, baselineKey, modulePath: ["restaurant"], ...(fundingAllocations ? { fundingAllocations } : {}) });
const draft = (costItems) => ({ familyKey: "food", subtypeKey: "restaurant", title: "Restaurant", plannedDate: "2026-10-20", context: {}, costItems });
const expense = (draft, status = "PLANNED", id = randomUUID()) => ({ ...draft, id, status, householdId: randomUUID(), targetMonth: "2026-10" });
const plan = (expenses, currentInputs = inputs) => deriveMonthScenario(forecast, currentInputs, null, "2026-09-30", expenses).economicPlan;
const preview = (draft, others = []) => projectPlannedExpenseImpact(plan(others), plan([...others, expense(draft)]), draft);
const money = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n));
// FIN-01, META-03: funding is orthogonal, Swile/Edenred stay distinct, quantity × amount.
const bank = draft([line("restaurant:main", "30.00")]); bank.costItems[0].quantity = "2";
const wallet = draft([{ ...bank.costItems[0], fundingAllocations: [{ source: "SWILE", amount: "40.00" }, { source: "EDENRED", amount: "20.00" }] }]);
parsePlannedExpenseDraft(wallet, "2026-10");
assert.equal(preview(wallet).grossCost, "60.00"); assert.deepEqual(preview(bank).netAdditionalImpact, preview(wallet).netAdditionalImpact);
const walletPlan = plan([expense(wallet)]);
assert.equal(walletPlan.plannedFunding.bankAllocated, "0.00"); assert.equal(walletPlan.plannedFunding.swile.reserved, "40.00");
assert.equal(walletPlan.plannedFunding.edenred.reserved, "20.00");
// FIN-02/03/04, META-04: baseline changes scenario delta but neither gross nor payment.
const habitual = draft([line("restaurant:main", "60.00", "household-restaurants", [{ source: "SWILE", amount: "60.00" }])]);
const extra = draft([{ ...habitual.costItems[0], baselineKey: null }]);
const h = preview(habitual), e = preview(extra);
assert.equal(h.grossCost, e.grossCost); assert.deepEqual(h.funding, e.funding);
assert.deepEqual(h.netAdditionalImpact, { low: "10.00", central: "0.00", high: "0.00" });
assert.deepEqual(h.absorbedByBaseline, { low: "50.00", central: "60.00", high: "60.00" });
const another = expense(draft([line("restaurant:main", "50.00", "household-restaurants")]));
const marginal = preview(habitual, [another]);
assert.equal(marginal.netAdditionalImpact.central, "41.87"); assert.equal(marginal.absorbedByBaseline.central, "18.13");
for (const p of [h, e, marginal]) for (const [axis, scenario] of [["low", "lowConsumption"], ["central", "central"], ["high", "highConsumption"]])
  assert.equal((Number(p.before[scenario]) - Number(p.after[scenario])).toFixed(2), p.netAdditionalImpact[axis]);
// Editing excludes the edited row from before; its new total, not only the amount change, is explained.
const edited = draft([line("restaurant:main", "65.00")]);
assert.equal(preview(edited, [another]).grossCost, "65.00"); assert.equal(preview(edited, [another]).netAdditionalImpact.central, "65.00");
assert.match(fs.readFileSync("src/app/mois-a-venir/planned-expenses-actions.ts", "utf8"), /saved\.filter\(\(expense\) => expense\.id !== editedId\)/);
// FIN-05, META-09: lifecycle preserves economics and moves RESERVED to USED_DECLARED.
const planned = plan([expense(habitual)]), realized = plan([expense(habitual, "DECLARED_REALIZED")]);
assert.deepEqual(planned.scenarios, realized.scenarios);
assert.equal(planned.plannedFunding.swile.availableAfter, realized.plannedFunding.swile.availableAfter);
assert.equal(planned.plannedFunding.swile.reserved, "60.00");
assert.equal(realized.plannedFunding.swile.usedDeclared, "60.00");
assert.equal(realized.plannedFunding.swile.reserved, "0.00");
assert.equal(planned.monthlyLayers.stillPlanned, "60.00"); assert.equal(realized.monthlyLayers.declaredRealized, "60.00");
assert.equal(planned.monthlyLayers.remainingDailyLife, realized.monthlyLayers.remainingDailyLife);
for (const p of [planned, realized, plan([another, expense(extra)])])
  assert.equal((Number(p.monthlyLayers.afterSavingsAllocations) - Number(p.monthlyLayers.declaredRealized)
    - Number(p.monthlyLayers.stillPlanned) - Number(p.monthlyLayers.remainingDailyLife)).toFixed(2), p.monthlyLayers.projectedRemainder);
// FIN-06, META-05: fuel usage affects economics, not payments. Toll and parking remain payable.
const withFuel = draft([...extra.costItems, line("transport:fuel_usage", "10.00"), line("transport:toll", "5.00"), line("transport:parking", "3.00")]);
const f = preview(withFuel);
assert.equal(f.grossCost, "78.00"); assert.equal(f.payableGross, "68.00"); assert.equal(f.fuelUsage, "10.00");
assert.equal(f.funding.bankAllocated, "8.00"); assert.equal(f.funding.swile.reserved, "60.00");
// FIN-07/META-20: calendar retains gross even when marginal impact is zero.
const calendar = projectMonthCalendar([], projectPlannedExpenseCards([expense(habitual)]));
assert.equal(calendar.entries.length, 1); assert.equal(calendar.entries[0].amount, "60.00"); assert.equal(h.netAdditionalImpact.central, "0.00");
// FIN-08: resource reduction creates a shortage and never changes the user's allocations to BANK.
const reduced = plan([expense(habitual)], { ...inputs, resourceOverrides: { "benefit:swile": "40.00" } });
assert.equal(reduced.plannedFunding.swile.shortfall, "20.00"); assert.equal(reduced.plannedFunding.fundingToComplete, "20.00");
assert.equal(reduced.plannedFunding.bankAllocated, "0.00"); assert.equal(reduced.plannedFunding.swile.reserved, "60.00");
// Constructible invalid payment payloads are rejected by the shared server boundary.
for (const item of [line("restaurant:main", "30.00", null, [{ source: "SWILE", amount: "29.00" }]),
  line("restaurant:main", "30.00", null, [{ source: "SWILE", amount: "15.00" }, { source: "SWILE", amount: "15.00" }]),
  line("restaurant:wine_glass", "30.00", null, [{ source: "EDENRED", amount: "30.00" }])])
  assert.throws(() => parsePlannedExpenseDraft(draft([item]), "2026-10"), /FUNDING/);
// FIN-UI-01..04: render the human project/payment/effect order with honest central comparison.
const displayPreview = data => ({ ...data, explanation: "Scénarios du mois", unpricedComponents: [],
  bankCash: {currentRealBankBalance:{status:"UNKNOWN",amount:null},plannedAvailable:{status:"UNKNOWN",amount:null},endOfMonth:{low:null,central:null,high:null}},
  availableNow: { status: "UNAVAILABLE" }, plannedAvailable: data.after.central, estimatedEndOfMonth: data.after.central });
for (const data of [h, e, marginal, f]) {
  const html = renderToStaticMarkup(React.createElement(PlannedImpactCard, { preview: displayPreview(data), fundingIncomplete: false }));
  const labels = ["Coût économique du projet", "Paiements réellement prévus", "Disponible réel", "Disponible bancaire prévu", "Fin de mois bancaire", "Comprendre les montants"];
  const indexes = labels.map((label) => html.indexOf(label));
  assert(indexes.every((index) => index >= 0)); assert(indexes.every((index, i) => i === 0 || index > indexes[i - 1]));
  assert(html.includes(money(data.after.central))); assert(html.includes("À confirmer"));
  assert.doesNotMatch(html, /cash disponible|safe.to.spend|vous pouvez dépenser|argent libre|solde Swile|solde bancaire projeté|argent disponible/iu);
  assert.doesNotMatch(html, /Ressource restante projetée[^<]*solde/iu);
}
const pending = renderToStaticMarkup(React.createElement(PlannedImpactCard, { preview: displayPreview(h), fundingIncomplete: true }));
assert.match(pending, /Financement à compléter/i);
const incomplete = renderToStaticMarkup(React.createElement(PlannedImpactCard, { preview: { ...displayPreview(e), projectionIncomplete: true }, fundingIncomplete: false }));
assert.match(incomplete, /Projection partielle/); assert(incomplete.includes(money(e.after.central)), "Known numbers remain visible in a partial projection");
const unpriced = renderToStaticMarkup(React.createElement(PlannedImpactCard, { preview: { ...displayPreview(e), unpricedComponents: ["Hébergement"] }, fundingIncomplete: false }));
assert.match(unpriced, /≥/); assert.match(unpriced, /ne sont pas comptés comme gratuits/);
const story = fs.readFileSync("src/app/mois-a-venir/month-story.tsx", "utf8");
assert.doesNotMatch(story, /Total disponible pour le mois|sur nos comptes|safe.to.spend|vous pouvez dépenser|argent libre/iu);
console.log("PASS: C5 FIN-01..08, FIN-UI-01..04, META-03/04/05/09/20, baseline displacement, quantity, language and no BANK reallocation");
