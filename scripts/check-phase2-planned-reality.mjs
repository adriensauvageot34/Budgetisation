import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { planningHarness, value, item, draft } from "./lib/planned-actions-harness.mjs";
import { expenseDraft } from "./lib/planned-expense-memory-client.mjs";
const require = createRequire(import.meta.url);
const h = planningHarness(), { actions: a, service: s, client, householdId, facts, userId } = h;
const { deriveMonthScenario } = require("../src/server/phase2/month-scenario.ts");
const { projectPlannedExpenseCards, projectMonthCalendar } = require("../src/app/mois-a-venir/planned-expenses-projection.ts");
const { canCollapseRealityCosts, fundingAfterGrossChange, needsRealityConfirmation } = require("../src/domain/phase2/planned-mutations.ts");
const { createBuilderState, editBuilderDraft, deriveBuilderReadiness } = require("../src/domain/phase2/planned-builder.ts");
const command = expense => ({ id: expense.id, expectedUpdatedAt: expense.updatedAt });
const create = async raw => value(await a.savePlannedExpense("2026-10", raw, { id: randomUUID() })).expense;
const today = new Date().toISOString().slice(0, 10);
const state = async (month = "2026-10") => {
  const rows = await s.readPlannedExpenses(client, householdId, month);
  const forecast = month === "2026-10" ? h.forecast : h.forecastFor(month);
  return { rows, cards: projectPlannedExpenseCards(rows, "2026-10-20"),
    plan: deriveMonthScenario(forecast, facts.inputs[month] ?? require("../src/server/phase2/month-scenario.ts").defaultMonthInputs(), null, today, rows).economicPlan };
};

// REAL-01: past date is a derived question, never an automatic lifecycle write.
let root = await create(draft());
const writes = client.writes.length;
assert.equal(needsRealityConfirmation(root, "2026-10-20"), true);
assert.equal((await state()).cards[0].needsRealityConfirmation, true);
assert.equal(root.status, "PLANNED"); assert.equal(client.writes.length, writes);
assert.equal(needsRealityConfirmation({ ...root, plannedDate: null }, "2026-10-20"), false);

// REAL-02/03: local final draft, atomic correction 25 -> 28, same root, one cost set.
const final = { ...expenseDraft(root), costItems: root.costItems.map(row => ({ ...row, unitAmount: "28.00" })) };
const prior = await state();
let preflightSawPlanned = false;
const before = client.writes.length;
const declared = await s.declarePlannedExpense(client, householdId, root.id, userId, final, root.updatedAt,
  async (resolved, current) => {
    assert.equal(client.rows.find(row => row.planned_expense_id === root.id).status, "PLANNED");
    assert.equal(current.id, root.id); assert.equal(resolved.costItems[0].unitAmount, "28.00");
    await s.preparePlannedExpenseSimulation(client, householdId, h.forecast, facts.inputs["2026-10"], prior.rows, resolved, today, root.id);
    preflightSawPlanned = true;
  });
assert(preflightSawPlanned); assert.equal(client.writes.length, before + 1);
const mutation = client.writes.at(-1);
assert.equal(mutation.payload.status, "DECLARED_REALIZED"); assert.equal(mutation.payload.cost_items[0].unitAmount, "28.00");
assert(mutation.filters.some(([key]) => key === "updated_at"));
assert.equal(declared.id, root.id); assert.equal(declared.costItems[0].id, root.costItems[0].id);
let after = await state(); assert.equal(after.rows.length, 1); assert.equal(after.plan.plannedExpenses.grossCost, "28.00");
assert.equal(after.plan.scenarios.central, "887.83", "only 28, never 25 + 28");
assert.equal(after.plan.plannedFunding.bankReserved, "0.00"); assert.equal(after.plan.plannedFunding.bankUsedDeclared, "28.00");

// IDEMP-REAL-01: sequential network replay and two concurrent final confirmations.
value(await a.confirmPlannedExpenseReality("2026-10", final, command(root)));
assert.equal(client.writes.length, before + 1);
const restaurant = { ...draft([item("60.00", "restaurant:main", ["restaurant"], [{ source: "SWILE", amount: "60.00" }])]),
  familyKey: "food", subtypeKey: "restaurant" };
restaurant.costItems[0].baselineKey = "household-restaurants";
root = await create(restaurant);
const neutralBefore = await state(), updates = client.writes.length;
const [first, second] = await Promise.all([
  a.confirmPlannedExpenseReality("2026-10", expenseDraft(root), command(root)),
  a.confirmPlannedExpenseReality("2026-10", expenseDraft(root), command(root)),
]);
const realized = value(first).expense; assert.equal(value(second).expense.id, root.id);
assert.equal(client.writes.length, updates + 1); assert.equal(realized.id, root.id);
after = await state(); assert.equal(after.rows.filter(row => row.id === root.id).length, 1);
assert.deepEqual(after.plan.scenarios, neutralBefore.plan.scenarios, "REAL-04: neutral declaration");
assert.deepEqual(after.plan.plannedExpenses.absorbedByBaseline, neutralBefore.plan.plannedExpenses.absorbedByBaseline);
assert.equal(neutralBefore.plan.plannedFunding.swile.reserved, "60.00");
assert.equal(after.plan.plannedFunding.swile.reserved, "0.00"); assert.equal(after.plan.plannedFunding.swile.usedDeclared, "60.00");
assert.equal(after.plan.plannedFunding.swile.availableAfter, neutralBefore.plan.plannedFunding.swile.availableAfter);
assert.equal(after.cards.find(row => row.id === root.id).needsRealityConfirmation, false);
assert.equal(projectMonthCalendar([], after.cards).entries.find(row => row.key === root.id).nature, "DECLARED_REALIZED");

// REAL-05: final meal funding requires explicit reconfirmation. No bank fallback.
const corrected = { ...expenseDraft(realized), costItems: realized.costItems.map(row => ({ ...row, unitAmount: "67.00" })) };
let n = client.writes.length;
const badFunding = await a.confirmPlannedExpenseReality("2026-10", corrected, command(realized), true);
assert.equal(badFunding.ok, false); assert.equal(badFunding.issue.repairTarget, "funding"); assert.equal(client.writes.length, n);
const funding = fundingAfterGrossChange(realized.costItems[0], "67.00");
assert.equal(funding[0].amount, "60.00", "MEAL untouched until user confirms");
assert.deepEqual(fundingAfterGrossChange({ ...item(), fundingAllocations: [{ source: "BANK", amount: "25.00" }] }, "28.00"),
  [{ source: "BANK", amount: "28.00" }]);
assert.deepEqual(fundingAfterGrossChange({ ...item(), fundingAllocations: [{ source: "BANK", amount: "10.00" }, { source: "SWILE", amount: "15.00" }] }, "28.00"),
  [{ source: "BANK", amount: "10.00" }, { source: "SWILE", amount: "15.00" }]);
corrected.costItems[0].fundingAllocations = [{ source: "SWILE", amount: "67.00" }];
const changed = value(await a.confirmPlannedExpenseReality("2026-10", corrected, command(realized), true)).expense;
assert.equal(changed.id, root.id); assert.equal((await state()).plan.plannedFunding.swile.usedDeclared, "67.00");
assert.equal((await state()).plan.plannedExpenses.grossCost, "95.00", "28 + 67, no previous contribution");

// STALE-REAL-01: correction of an old declared version fails before a write.
n = client.writes.length;
const stale = await a.confirmPlannedExpenseReality("2026-10", expenseDraft(realized), command(realized), true);
assert.equal(stale.issue.code, "REALITY_DRAFT_STALE"); assert.equal(stale.issue.repairTarget, "reload"); assert.equal(client.writes.length, n);
// A planned reality draft also cannot overwrite a newer planned edit.
const pending = await create(draft()), newDraft = { ...expenseDraft(pending), title: "Nouvelle intention" };
const newer = value(await a.savePlannedExpense("2026-10", newDraft, command(pending))).expense;
n = client.writes.length;
const oldReality = await a.confirmPlannedExpenseReality("2026-10", expenseDraft(pending), command(pending));
assert.equal(oldReality.issue.code, "REALITY_DRAFT_STALE"); assert.equal(client.writes.length, n);
// Atomicity if final preflight fails: content and status both remain untouched.
await assert.rejects(s.declarePlannedExpense(client, householdId, newer.id, userId, expenseDraft(newer), newer.updatedAt,
  async () => { throw new TypeError("PLANNED_EXPENSE_BASELINE_MISSING"); }), /BASELINE_MISSING/);
assert.equal(client.writes.length, n); assert.equal((await state()).rows.find(row => row.id === newer.id).status, "PLANNED");

// REAL-06: restore is dedicated and economically neutral, USED_DECLARED -> RESERVED.
const beforeRestore = await state();
const restored = value(await a.restorePlannedExpenseAction("2026-10", command(changed))).expense;
assert.equal(restored.status, "PLANNED"); assert.equal(restored.id, changed.id); assert.deepEqual(restored.costItems, changed.costItems);
const restoredState = await state(); assert.deepEqual(restoredState.plan.scenarios, beforeRestore.plan.scenarios);
assert.equal(restoredState.plan.plannedFunding.swile.usedDeclared, "0.00"); assert.equal(restoredState.plan.plannedFunding.swile.reserved, "67.00");
assert.equal((await a.restorePlannedExpenseAction("2026-10", command(restored))).issue.code, "PLANNED_EXPENSE_STATUS_TRANSITION_INVALID");
assert.equal((await a.confirmPlannedExpenseReality("2026-10", expenseDraft(restored), command(restored), true)).issue.code,
  "PLANNED_EXPENSE_STATUS_TRANSITION_INVALID");
assert.equal((await a.savePlannedExpense("2026-10", expenseDraft(declared), command(declared))).ok, false);

// REPORT-01/02: same root and same-month economy; destination uses its own monthly facts.
const beforeReport = await state();
let moved = value(await a.reportPlannedExpenseAction("2026-10", command(restored), "2026-10-25")).expense;
assert.equal(moved.id, restored.id); assert.equal(moved.status, "PLANNED"); assert.equal(moved.plannedDate, "2026-10-25");
assert.deepEqual((await state()).plan.scenarios, beforeReport.plan.scenarios);
n = client.writes.length;
const missingMonth = await a.reportPlannedExpenseAction("2026-10", command(moved), "2026-11-05");
assert.equal(missingMonth.issue.code, "PLANNED_EXPENSE_MONTH_RESOURCES_REQUIRED"); assert.equal(client.writes.length, n);
assert((await state()).rows.some(row => row.id === moved.id), "no partial report if destination facts are missing");
// The real monthly setup action accepts explicit zero, validates the scenario,
// and targets November rather than modifying October's resources.
const monthlyInputs = require("../src/server/phase2/month-inputs.ts");
const { monthInputsSchema } = require("../src/server/phase2/month-scenario.ts");
let resourceWrites = 0;
monthlyInputs.saveMonthInputs = async (_client, household, month, user, next) => {
  assert.equal(household, householdId); assert.equal(user, userId); assert.equal(month, "2026-11");
  facts.inputs[month] = monthInputsSchema.parse(next); resourceWrites++;
};
const { updateMonthInputs } = require("../src/app/mois-a-venir/actions.ts");
const setup = new FormData();
for (const [key, value] of Object.entries({ targetMonth: "2026-11", intent: "declare-monthly-benefits",
  swileResource: "20.00", edenredResource: "0.00" })) setup.set(key, value);
const octoberResources = structuredClone(facts.inputs["2026-10"].declaredResources);
await updateMonthInputs(setup);
assert.equal(resourceWrites, 1);
assert.deepEqual(facts.inputs["2026-10"].declaredResources, octoberResources);
assert.deepEqual(facts.inputs["2026-11"].declaredResources, { "benefit:swile": "20.00", "benefit:edenred": "0.00" });
setup.set("edenredResource", "");
await assert.rejects(updateMonthInputs(setup));
assert.equal(resourceWrites, 1, "invalid resources never persist");
const monthShift = value(await a.reportPlannedExpenseAction("2026-10", command(moved), "2026-11-05"));
moved = monthShift.expense;
assert.equal(moved.id, restored.id); assert.equal(moved.targetMonth, "2026-11");
assert(facts.monthReads.includes("2026-11"), "destination forecast re-resolved from its own month");
assert(!(await state()).rows.some(row => row.id === moved.id));
assert.equal((await state("2026-11")).rows.length, 1); assert.equal(monthShift.scenario.economicPlan.plannedFunding.swile.resource, "20.00");
assert.equal(monthShift.scenario.economicPlan.plannedFunding.swile.shortfall, "47.00");
assert.equal(projectMonthCalendar([], (await state("2026-11")).cards).entries[0].date, "2026-11-05");
assert.equal((await state()).plan.plannedFunding.swile.reserved, "0.00");
assert.notDeepEqual(h.forecastFor("2026-11").referencePlan.flexibleTotal, h.forecast.referencePlan.flexibleTotal,
  "workday-dependent baseline is computed for November rather than copied from October");
const declaredBank = (await state()).rows.find(row => row.status === "DECLARED_REALIZED");
assert.equal((await a.reportPlannedExpenseAction("2026-10", command(declaredBank), "2026-11-05")).issue.code,
  "PLANNED_EXPENSE_STATUS_TRANSITION_INVALID");

// REAL-07/META-09..13/19: hard delete frees projections/funding, either lifecycle status.
value(await a.removePlannedExpense("2026-11", command(moved)));
const removed = await state("2026-11"); assert.equal(removed.rows.length, 0); assert.equal(removed.plan.plannedFunding.swile.reserved, "0.00");
assert.equal(projectMonthCalendar([], removed.cards).entries.length, 0);
value(await a.removePlannedExpense("2026-10", command(declaredBank)));
assert(!(await state()).rows.some(row => row.id === declaredBank.id));
assert(!(await state()).cards.some(row => row.status === "DECLARED_REALIZED"));
// Itemized 36 + 14 + 10 stays itemized; no second total field/spread of a global +7.
const lines = draft([item("36.00"), item("14.00"), item("10.00")]);
const builder = createBuilderState(lines);
const local = editBuilderDraft(builder, { ...lines, title: "Détail corrigé" });
assert.deepEqual(local.draft.costItems.map(row => row.unitAmount), ["36.00", "14.00", "10.00"]);
assert(deriveBuilderReadiness(local).saveReady);
assert.equal(canCollapseRealityCosts(local.draft.costItems), false);
assert.equal(canCollapseRealityCosts([item()]), true);
assert.equal((await a.savePlannedExpense("2026-10", { ...lines, declaredAmount: "67.00" }, { id: randomUUID() })).ok, false);
// No arbitrary lifecycle, historical entities or observed wallet authority.
for (const status of ["CANCELLED", "OBSERVED", "anything"]) assert.throws(() => s.parsePlannedExpenseDraft({ ...lines, status }, "2026-10"), /DRAFT_FIELDS_INVALID/);
const persistedColumns = new Set(client.writes.flatMap(write => Object.keys(write.payload ?? {})));
for (const key of ["declared_amount", "declared_funding", "realized_date", "realityConfirmationDraft", "scenario", "undo", "PREVIEW_READY", "SAVE_READY"])
  assert(!persistedColumns.has(key));
assert(client.writes.every(write => write.table === "phase2_planned_expenses"));
const ui = fs.readFileSync("src/app/mois-a-venir/planned-expenses-control.tsx", "utf8");
const lifecycleLabels = fs.readFileSync("src/app/mois-a-venir/calendar-presentation.ts", "utf8");
for (const label of ["Oui, ça a eu lieu", "Reporter", "Ça n’a pas eu lieu", "Corriger", "Remettre en prévu", "Confirmer la suppression"])
  assert((ui + lifecycleLabels).includes(label));
assert.doesNotMatch(ui, /changePlannedExpenseStatus|markPlannedExpenseRealized/u, "no split update + mark workflow");
// Render the real production cards for both statuses and the derived past question.
require.extensions[".css"] = module => { module.exports = {}; };
require.extensions[".tsx"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
const navigation = require.resolve("next/navigation");
const navigationExports = require("next/navigation");
require.cache[navigation].exports = { ...navigationExports, useRouter: () => ({ refresh() {}, push() {} }) };
const { PlannedExpensesControl } = require("../src/app/mois-a-venir/planned-expenses-control.tsx");
const cards = projectPlannedExpenseCards([newer, { ...changed, status: "DECLARED_REALIZED" }], "2026-10-20");
const html = renderToStaticMarkup(React.createElement(PlannedExpensesControl, {
  targetMonth: "2026-10", expenses: cards, persons: [], places: [], vehicle: null, prices: [], funding: (await state()).plan.plannedFunding,
}));
for (const label of ["À confirmer", "Oui, ça a eu lieu", "Reporter", "Ça n’a pas eu lieu", "Corriger", "Remettre en prévu", "Supprimer"])
  assert(html.includes(label), `production card: ${label}`);
console.log("PASS: C7 REAL-01..07, atomic final costs, RESERVED/USED_DECLARED, IDEMP-REAL-01, STALE-REAL-01, REPORT-01/02, delete/restore/status, META-09..13/19, historical zero-write");
