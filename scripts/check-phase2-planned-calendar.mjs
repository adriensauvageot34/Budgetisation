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
// Match the existing narrative harness: CSS modules have no financial behavior in the SSR oracle.
require.extensions[".css"] = module => { module.exports = new Proxy({}, { get: (_, key) => key === "__esModule" ? undefined : String(key) }); };
require.extensions[".tsx"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
const h = planningHarness(), { actions: a, service: s, client, householdId } = h;
const { projectPlannedExpenseCards, projectMonthCalendar, projectExpenseFunding } = require("../src/app/mois-a-venir/planned-expenses-projection.ts");
const { projectPlannedExpenseImpact } = require("../src/server/phase2/planned-impact.ts");
const { deriveMonthScenario } = require("../src/server/phase2/month-scenario.ts");
const presentation = require("../src/app/mois-a-venir/calendar-presentation.ts");
const { calendarMetadata } = require("../src/app/mois-a-venir/calendar-metadata.ts");
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
assert.equal((html.match(/data-calendar-day="\d+"[^>]*tabindex="0"/gu) ?? []).length, 1, "one grid keyboard entry point");
assert.match(html, /role="row"/); assert.match(html, /role="columnheader"/); assert.match(html, /role="gridcell"/);
assert.doesNotMatch(html, /line-through|<s>|<del>|CANCELLED|montants? prévus au total/iu);
assert.equal(presentation.calendarIcon(busy.entries.find(row => row.key === "EDF")).brandKey, "edf");
assert.equal(presentation.calendarIcon(busy.entries.find(row => row.key === "EDF")).semanticIconKey, "home");
assert.equal(presentation.calendarIcon({...busy.entries[0],...calendarMetadata("Max – Abonnement Max/WBD"),label:"Max – Abonnement Max/WBD"}).semanticIconKey,"culture");

// Revised compact contract: one/two visible; three and above use top two +N.
for (const count of [1, 2, 3]) {
  const data = projectMonthCalendar(Array.from({ length: count }, (_, i) => certain(`Certain ${i}`, "36.98")), []);
  const rendered = renderCalendar(data);
  assert.equal((rendered.match(/data-calendar-event=/gu) ?? []).length, Math.min(count, 2));
  assert.match(rendered, /36,98/);
  assert.equal((rendered.match(/data-calendar-day-total=/gu) ?? []).length, count > 1 ? 1 : 0, "single event amount is not repeated as a daily total");
  assert.match(rendered, /grid-cols-\[40px_minmax\(0,1fr\)_max-content\]/);
  assert.match(rendered, /grid-cols-subgrid/);
  assert.match(rendered, /\[&amp;_button\]:text-xs!/);
  assert.match(rendered, /whitespace-nowrap font-semibold tabular-nums/);
  if (count > 2) assert.match(rendered, /\+1 autre/); else assert.doesNotMatch(rendered, /\+\d autre/);
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
const detailed = renderToStaticMarkup(React.createElement(CalendarEventDetails, { item: { ...state.calendar.entries[0], expense: card }, onAction: () => {}, expanded: true }));
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
assert.match(realizedHtml,/✓ Réalisée/); assert.match(realizedHtml,/text-emerald-800/); assert.match(realizedHtml,/data-calendar-state="DECLARED_REALIZED"[^>]*>✓/); assert.doesNotMatch(realizedHtml,/bg-emerald-50|line-through|<del>/);
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
assert.match(undatedHtml,/À placer dans le calendrier/); assert.match(undatedHtml,/Sans jour précis/); assert.match(undatedHtml,/Réalisée/); assert.match(undatedHtml,/Prévue/);
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
assert.match(description,/3 éléments/); assert.match(description,/Total/); assert.doesNotMatch(description,/date précise|estimée|EDF/);
const sorted = presentation.orderCalendarItems(mixed.entries);
assert.equal(sorted[0].nature,"PLANNED_EXPENSE"); assert.equal(sorted.at(-1).label,"EDF");

// Calendar redesign: independent totals, date certainty, visual salience and lifecycle actions.
assert.deepEqual(presentation.calendarDaySummary(busy.entries), { grossTotal:"365.83", exactDateTotal:"287.63", estimatedDateTotal:"78.20", exactCount:4, estimatedCount:1 });
assert.doesNotMatch(html,/≈|◌|Comment lire ce calendrier|Nos échéances et projets|à date précise|à date estimée|<dialog|backdrop:/);
assert.doesNotMatch(html,/text-\[9px\]|text-\[10px\]|h-32/);
assert.equal(presentation.calendarInitialDay("2026-10","2026-10-20",busy.entries),20);
assert.equal(presentation.calendarInitialDay("2026-10","2026-09-30",busy.entries),4);
assert.equal(presentation.calendarInitialDay("2026-10","2026-09-30",[]),1);
assert.match(renderCalendar({...busy,today:"2026-10-04"}),/aria-current="date"/);
assert.doesNotMatch(renderCalendar({...busy,today:"2026-09-30"}),/aria-current="date"/);
assert.equal(calendarMetadata("Pacifica · Habitation").calendarLabel,"Habitation");
assert.equal(calendarMetadata("Pacifica · Juridique").calendarLabel,"Juridique");
assert.equal(presentation.calendarEventLabel({...busy.entries[0],...calendarMetadata("Pacifica · Habitation")}),"Habitation");
assert.equal(presentation.calendarEventLabel({...busy.entries[0],...calendarMetadata("Pacifica · Juridique")}),"Juridique");
assert.equal(calendarMetadata("SFR · Contrat 1234").calendarLabel,"Abonnement");
assert.equal(calendarMetadata("SFR · Contrat 5678").calendarLabel,"Abonnement");
assert.notEqual(calendarMetadata("SFR · Contrat 1234").fullLabel,calendarMetadata("SFR · Contrat 5678").fullLabel);
assert.doesNotMatch(calendarMetadata("SFR · Contrat 1234").calendarLabel,/Adrien|Manon|Mobile|Internet/);
const future = {...card,needsRealityConfirmation:false};
assert.deepEqual(presentation.calendarExpenseActions(future).map(row=>row.action),["EDIT","REPORT","DELETE"]);
assert.deepEqual(presentation.calendarExpenseActions({...card,needsRealityConfirmation:true}).map(row=>row.action),["DECLARE","REPORT","EDIT","DELETE"]);
assert.deepEqual(presentation.calendarExpenseActions({...card,status:"DECLARED_REALIZED"}).map(row=>row.action),["CORRECT","RESTORE","DELETE"]);
const important = {...mixed.entries[0],key:"past",amount:"1.00",nature:"PLANNED_EXPENSE",expense:{...card,needsRealityConfirmation:true}};
assert.equal(presentation.visibleCalendarItems([...busy.entries,important])[0].key,"past","past project wins over large routine charges");
const futureItem = {...important,key:"future",expense:future};
assert.equal(presentation.visibleCalendarItems([...busy.entries,futureItem])[0].key,"future","explicit future project remains visible");
const estimatedDetails = renderToStaticMarkup(React.createElement(CalendarEventDetails,{item:{...busy.entries[1],dateEvidenceCount:12},expanded:true}));
assert.match(estimatedDetails,/Basée sur 12 prélèvements observés/);
assert.match(estimatedDetails,/Date estimée autour du/);
assert.match(estimatedDetails,/aria-expanded="true"/);
assert.doesNotMatch(estimatedDetails,/<summary>Détails<\/summary>/);
assert.doesNotMatch(renderToStaticMarkup(React.createElement(CalendarEventDetails,{item:{...busy.entries[1],dateEvidenceCount:12}})),/12 prélèvements/);
const sixWeeks = renderToStaticMarkup(React.createElement(MonthCalendar,{targetMonth:"2026-08",entries:[],undated:[],dailyTotals:{},today:"2026-08-12"}));
assert.equal((sixWeeks.match(/role="row"/gu)??[]).length,7); assert.match(sixWeeks,/h-\[66px\]/);
assert.equal((sixWeeks.match(/data-outside-month="true"/gu)??[]).length,11);
assert.doesNotMatch(sixWeeks, /data-outside-month="true"[^>]*>\s*<button/);
const source = fs.readFileSync("src/app/mois-a-venir/month-calendar.tsx","utf8");
assert.match(source,/node\.showPopover\(\)/); assert.match(source,/popover="auto"/);
assert.match(source,/node\.hidePopover\(\)/); assert.match(source,/opener\.current\?\.focus\(/);
assert.match(source,/event\.key === "Escape"/); assert.match(source,/aria-modal="false"/); assert.match(source,/focus-visible:outline-indigo/);
assert.doesNotMatch(source,/showModal|<dialog|backdrop:|h-dvh|calendar-drawer|Comment lire ce calendrier/);
assert.deepEqual(presentation.calendarPopoverPosition({left:100,right:260,top:120,bottom:206},{width:1280,height:900},{width:420,height:300}),{left:100,top:214});
assert.deepEqual(presentation.calendarPopoverPosition({left:1150,right:1280,top:750,bottom:836},{width:1280,height:900},{width:420,height:300}),{left:848,top:442});
assert.deepEqual(presentation.calendarPopoverPosition({left:0,right:150,top:10,bottom:96},{width:500,height:400},{width:420,height:360}),{left:12,top:12});
for (const [label, expected] of [["SFR – SFR – Internet", "Internet"],["SFR – Mobile Adrien", "Mobile Adrien"],
  ["Crédit Agricole – Cotisation Alertes SMS", "Alertes SMS"],["Crédit Agricole – Tenue de compte", "Tenue de compte"],
  ["Pacifica – Assurance auto", "Assurance auto"]]) assert.equal(calendarMetadata(label).calendarLabel,expected);
const opaque = "SFR – SFR – contrat NCNTE202200123456";
assert.equal(calendarMetadata(opaque).calendarLabel,"Abonnement"); assert.equal(calendarMetadata(opaque).fullLabel,opaque);
assert.doesNotMatch(calendarMetadata(opaque).calendarLabel,/Internet|Mobile|Adrien|Manon|NCNTE/);
const opaqueItem = {...certain(opaque,"36.98","HISTORICAL_ESTIMATE"),key:"opaque-fixture",...calendarMetadata(opaque),dateEvidenceCount:12};
assert.doesNotMatch(renderCalendar(projectMonthCalendar([opaqueItem],[])),/123456|NCNTE|…/);
assert.doesNotMatch(renderToStaticMarkup(React.createElement(CalendarEventDetails,{item:opaqueItem})),/123456|NCNTE/);
assert.match(renderToStaticMarkup(React.createElement(CalendarEventDetails,{item:opaqueItem,expanded:true})),/NCNTE202200123456/);
assert.match(renderCalendar(projectMonthCalendar([certain("Eau","23.00")],[])),/lucide-droplets/);
const realizedSmall = {...futureItem,key:"realized",nature:"DECLARED_REALIZED",amount:"999.00",expense:{...future,status:"DECLARED_REALIZED"}};
assert.deepEqual(presentation.orderCalendarItems([realizedSmall,futureItem,important,...busy.entries]).slice(0,3).map(row=>row.key),["past","future","realized"]);
const savings = renderCalendar(projectMonthCalendar([{...certain("Épargne voyage","1200.00","UNKNOWN"),date:null,kind:"SAVINGS",group:"Épargne"}],[]));
assert.match(savings,/Sans jour précis \(1\)/); assert.match(savings,/Objectif du mois/); assert.doesNotMatch(savings,/bg-amber|role="alert"|data-calendar-event/);
assert.doesNotMatch(source,/line-through|role="region"|set.*Status|declarePlannedExpense/);
assert(client.writes.every(row=>row.table==="phase2_planned_expenses"));
console.log("PASS: calendar redesign, compact 2/+N, independent day totals, exact/estimated, labels, salience, today/focus, 6 weeks, lifecycle actions, C8 projection sync and META-20");
