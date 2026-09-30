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
require.extensions[".tsx"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
const h = planningHarness(), { actions: a, service: s, client, householdId } = h;
const { projectPlannedExpenseCards, projectMonthCalendar, projectExpenseFunding } = require("../src/app/mois-a-venir/planned-expenses-projection.ts");
const { projectPlannedExpenseImpact } = require("../src/server/phase2/planned-impact.ts");
const { deriveMonthScenario } = require("../src/server/phase2/month-scenario.ts");
const presentation = require("../src/app/mois-a-venir/calendar-presentation.ts");
const { MonthCalendar, CalendarEventDetails } = require("../src/app/mois-a-venir/month-calendar.tsx");
const command = row => ({ id: row.id, expectedUpdatedAt: row.updatedAt });
const create = async raw => value(await a.savePlannedExpense("2026-10", raw, { id: randomUUID() })).expense;
const read = async () => {
  const rows = await s.readPlannedExpenses(client, householdId, "2026-10");
  const cards = projectPlannedExpenseCards(rows, "2026-10-20");
  const plan = deriveMonthScenario(h.forecast, h.inputs, null, "2026-10-20", rows).economicPlan;
  const calendar = projectMonthCalendar([], cards);
  assert.equal(new Set(cards.map(row => row.id)).size, rows.length);
  assert.equal(calendar.entries.length + calendar.undated.length, rows.length);
  for (const card of cards) {
    const occurrence = [...calendar.entries, ...calendar.undated].filter(row => row.key === card.id);
    assert.equal(occurrence.length, 1); assert.equal(occurrence[0].amount, card.grossCost);
  }
  assert.deepEqual(await s.readPlannedExpenses(client, householdId, "2026-10"), rows, "fresh reload is the sole projection source");
  return { rows, cards, plan, calendar };
};

// CAL-01..06, CAL-14..16, CAL-18..20. Oracle: STATIC_CONTRACT / USER_DECLARED_FIXTURE.
const certain = (key, amount, certainty = "DECLARED") => ({ key, label: key, amount, date: "2026-10-04", dateCertainty: certainty });
const busy = projectMonthCalendar([certain("Loyer", "255.74"), certain("EDF", "78.20", "HISTORICAL_ESTIMATE"),
  certain("Max", "13.99"), certain("Pacifica habitation", "8.98"), certain("Pacifica juridique", "8.92")], []);
assert.equal(busy.dailyTotals["2026-10-04"], "365.83", "independent arithmetic fixture");
const renderCalendar = data => renderToStaticMarkup(React.createElement(MonthCalendar, { targetMonth: "2026-10", ...data }));
const html = renderCalendar(busy);
assert.match(html, /365,83/); assert.match(html, /255,74/); assert.match(html, /13,99/); assert.match(html, /\+3 autres/);
assert.equal((html.match(/data-calendar-event=/gu) ?? []).length, 2, "CAL-10/11 top two, then +N");
assert.equal((html.match(/tabindex="0"/gu) ?? []).length, 1, "one keyboard entry point");
assert.match(html, /role="row"/); assert.match(html, /role="columnheader"/); assert.match(html, /role="gridcell"/);
assert.doesNotMatch(html, /line-through|<s>|<del>|CANCELLED|montants? prévus au total/iu);
assert.equal(presentation.calendarIcon(busy.entries.find(row => row.key === "EDF")).brandKey, "edf");
assert.equal(presentation.calendarIcon(busy.entries.find(row => row.key === "EDF")).semanticIconKey, "home");
assert.equal(presentation.calendarIcon({...busy.entries[0],label:"Max – Abonnement Max/WBD"}).semanticIconKey,"culture");

// CAL-07..09: one, two and three events all remain visible, with exact cents.
for (const count of [1, 2, 3]) {
  const data = projectMonthCalendar(Array.from({ length: count }, (_, i) => certain(`Certain ${i}`, "36.98")), []);
  const rendered = renderCalendar(data);
  assert.equal((rendered.match(/data-calendar-event=/gu) ?? []).length, count);
  assert.match(rendered, /36,98/); assert.doesNotMatch(rendered, /\+\d autres/);
}

// CAL-17 / keyboard law. Oracle: STATIC_CONTRACT, not snapshots or the tested helper.
for (const [day, key, expected] of [[4,"ArrowRight",5],[4,"ArrowDown",11],[11,"ArrowUp",4],
  [4,"ArrowLeft",3],[1,"ArrowLeft",1],[31,"ArrowDown",31],[8,"Home",5],[8,"End",11]])
  assert.equal(presentation.calendarKeyboardDay(day,key,31,3), expected);
assert.equal(presentation.calendarKeyboardDay(4,"Enter",31,3), null);

// CAL gross / META-20: funding 40 Swile +20 Bank and baseline absorption never change the cell 60.
const restaurant = { ...draft([{ ...item("60.00", "restaurant:main", ["restaurant"],
  [{ source: "SWILE", amount: "40.00" }, { source: "BANK", amount: "20.00" }]), baselineKey: "household-restaurants" }]),
  familyKey: "food", subtypeKey: "restaurant", title: "Restaurant synthétique" };
let root = await create(restaurant);
let state = await read();
const before = deriveMonthScenario(h.forecast, h.inputs, null, "2026-10-20", []).economicPlan;
const impact = projectPlannedExpenseImpact(before, state.plan, root);
assert.equal(impact.netAdditionalImpact.central, "0.00"); assert.equal(state.calendar.entries[0].amount, "60.00");
const card = { ...state.cards[0], detail: { additionalImpact: impact.netAdditionalImpact.central,
  includedBaseline: impact.absorbedByBaseline.central, fuelUsage: impact.fuelUsage,
  funding: projectExpenseFunding(state.cards[0]), childPlaceLabels: [] } };
const detailed = renderToStaticMarkup(React.createElement(CalendarEventDetails, { item: { ...state.calendar.entries[0], expense: card }, onAction: () => {} }));
assert.match(detailed, /S’ajoute au mois/); assert.match(detailed, /0,00/); assert.match(detailed, /60,00/);
assert.match(detailed, /40,00/); assert.match(detailed, /20,00/); assert.match(detailed, /Oui, ça a eu lieu/);
assert(state.cards[0].needsRealityConfirmation); assert.equal(root.status,"PLANNED", "CAL-21 past stays Planned");

// CAL-22,26 / sync CREATE, UPDATE amount/date, DECLARE, CORRECT, RESTORE, REPORT, DELETE.
root = value(await a.savePlannedExpense("2026-10", { ...expenseDraft(root), costItems: [item("65.00", "restaurant:main", ["restaurant"]) ] }, command(root))).expense;
state = await read(); assert.equal(state.calendar.entries[0].amount,"65.00");
root = value(await a.savePlannedExpense("2026-10", { ...expenseDraft(root), plannedDate:"2026-10-22" }, command(root))).expense;
assert.equal((await read()).calendar.entries[0].date,"2026-10-22");
root = value(await a.confirmPlannedExpenseReality("2026-10", expenseDraft(root), command(root))).expense;
state = await read(); assert.equal(state.calendar.entries[0].nature,"DECLARED_REALIZED");
const realizedHtml = renderCalendar(state.calendar);
assert.match(realizedHtml,/✓ Réalisée/); assert.match(realizedHtml,/bg-emerald-50/); assert.doesNotMatch(realizedHtml,/line-through|<del>/);
root = value(await a.confirmPlannedExpenseReality("2026-10", { ...expenseDraft(root), costItems:[item("67.00", "restaurant:main", ["restaurant"]) ] }, command(root), true)).expense;
state = await read(); assert.equal(state.calendar.entries[0].key,root.id); assert.equal(state.calendar.entries[0].amount,"67.00");
const beforeRestore = state.plan.scenarios;
root = value(await a.restorePlannedExpenseAction("2026-10", command(root))).expense;
assert.deepEqual((await read()).plan.scenarios,beforeRestore);
root = value(await a.reportPlannedExpenseAction("2026-10", command(root),"2026-10-28")).expense;
state = await read(); assert.equal(state.calendar.entries[0].key,root.id); assert.equal(state.calendar.entries[0].date,"2026-10-28");
assert.deepEqual(state.plan.scenarios,beforeRestore);
value(await a.removePlannedExpense("2026-10",command(root)));
state = await read(); assert.equal(state.cards.length,0); assert.equal(state.calendar.entries.length,0);
assert.equal(state.plan.plannedFunding.bankReserved,"0.00"); assert.equal(state.plan.plannedExpenses.grossCost,"0.00");

// CAL-13/27: certain, planned and declared undated in À dater, never in the day grid.
const unplanned = await create(draft([item("25.00")],null));
const unconfirmed = await create(draft([item("28.00")],null));
await a.confirmPlannedExpenseReality("2026-10",expenseDraft(unconfirmed),command(unconfirmed));
state = await read(); assert.equal(state.calendar.entries.length,0); assert.equal(state.calendar.undated.length,2);
assert.equal(state.plan.plannedExpenses.grossCost,"53.00");
const allUndated = projectMonthCalendar([{ ...certain("Certain à dater","13.99","UNKNOWN"),date:null }],state.cards);
assert.equal(allUndated.undated.length,3);
const undatedHtml = renderCalendar(allUndated);
assert.match(undatedHtml,/À dater/); assert.match(undatedHtml,/Réalisée/); assert.match(undatedHtml,/Prévue/);
assert.doesNotMatch(undatedHtml,/data-calendar-event=/);

// Sync child place and route edits: one root occurrence, children only in details.
let visit = await create({ familyKey:"visit_trip",subtypeKey:"friend_visit",title:"Visite synthétique",plannedDate:"2026-10-10",
  context:{personVisited:{kind:"TEXT",label:"Ami synthétique"},place:{kind:"TEXT",label:"Maison amie"},
    childLocalPlaceRefs:{restaurant:{kind:"TEXT",label:"Restaurant A"}}},
  costItems:[item("36.98","restaurant:main",["visit_friend","restaurant"])] });
visit = value(await a.savePlannedExpense("2026-10",{...expenseDraft(visit),context:{...visit.context,
  childLocalPlaceRefs:{restaurant:{kind:"TEXT",label:"Restaurant B"}}, route:{mode:"TRAIN",stops:[
    {label:"Maison",distanceToNextKm:"12.000"},{label:"Restaurant B",distanceToNextKm:null,endpointSource:"CHILD_LOCAL_PLACE",childModule:"restaurant"}]} }},command(visit))).expense;
state = await read(); assert.equal(state.calendar.entries.filter(row=>row.key===visit.id).length,1);
assert.equal(state.cards.find(row=>row.id===visit.id).context.childLocalPlaceRefs.restaurant.label,"Restaurant B");
assert.equal(state.calendar.entries.find(row=>row.key===visit.id).expense.context.route.stops[1].label,"Restaurant B");
assert.equal(state.plan.plannedExpenses.grossCost,"89.98");

// CAL-04/19 item-level estimated marker and truthful mixed-day ARIA.
const mixed = projectMonthCalendar([certain("EDF","78.20","HISTORICAL_ESTIMATE")],
  [{...state.cards[0],plannedDate:"2026-10-04"},{...state.cards[1],plannedDate:"2026-10-04"}]);
const description = presentation.calendarDayDescription("2026-10-04",mixed.entries,mixed.dailyTotals["2026-10-04"]);
assert.match(description,/Charge certaine/); assert.match(description,/Prévue/); assert.match(description,/Réalisée/);
assert.equal((description.match(/Date habituelle estimée/gu)??[]).length,1);
const sorted = presentation.orderCalendarItems(mixed.entries);
assert.equal(sorted[0].nature,"DECLARED_REALIZED"); assert.equal(sorted.at(-1).label,"EDF");
const source = fs.readFileSync("src/app/mois-a-venir/month-calendar.tsx","utf8");
assert.match(source,/node\.showModal\(\)/); assert.match(source,/node\.close\(\); opener\.current\?\.focus\(\)/);
assert.match(source,/onCancel=/); assert.match(source,/fixed inset-y-0/); assert.match(source,/focus-visible:outline-indigo/);
assert.match(source,/event\.key !== "Tab"/); assert.match(source,/event\.preventDefault\(\); \(event\.shiftKey \? last : first\)\?\.focus\(\)/);
assert.doesNotMatch(source,/line-through|role="region"|set.*Status|declarePlannedExpense/);
assert(client.writes.every(row=>row.table==="phase2_planned_expenses"));
console.log("PASS: C8 CAL-01..27, gross/baseline/funding truth, undated, keyboard law, item-level certainty, all projection sync, META-20");
