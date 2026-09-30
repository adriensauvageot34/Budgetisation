import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { planningHarness, value, draft, item } from "./lib/planned-actions-harness.mjs";
import { expenseDraft } from "./lib/planned-expense-memory-client.mjs";
const require = createRequire(import.meta.url);
const h = planningHarness(), { client, actions: a, service: s, householdId, facts } = h;
const { createBuilderState, changeBuilderContext, undoBuilderChange, materializeBuilderDraft } = require("../src/domain/phase2/planned-builder.ts");
const { defaultMonthInputs } = require("../src/server/phase2/month-scenario.ts");
const { resolvePlannedRoute } = require("../src/domain/phase2/planned-routes.ts");
const command = row => ({ id: row.id, expectedUpdatedAt: row.updatedAt });
const traces = [];
async function probe(operation, work, writeCount, id) {
  const offset = client.writes.length;
  const result = await work();
  const writes = client.writes.slice(offset);
  assert.equal(writes.length,writeCount,operation);
  for (const write of writes) {
    assert.equal(write.table,"phase2_planned_expenses",`${operation}: historical authority mutation`);
    if (id) assert.equal(write.payload.planned_expense_id ?? write.filters?.find(([key])=>key==="planned_expense_id")?.[1],id,
      `${operation}: targeted root predicate`);
  }
  traces.push({operation,prospectiveWrites:writes.length,historicalWrites:0,targetedRoot:true});
  return result;
}

// ZERO-WRITE: per-operation targeted boundary traces, not a global row-count proxy.
const intent = draft(), request={id:randomUUID()};
await probe("Preview",async()=>value(await a.previewPlannedExpense("2026-10",intent)),0);
let root = (await probe("Create",async()=>value(await a.savePlannedExpense("2026-10",intent,request)),1,request.id)).expense;
root = (await probe("Update",async()=>value(await a.savePlannedExpense("2026-10",{...expenseDraft(root),title:"Mise à jour synthétique"},command(root))),1,root.id)).expense;
root = (await probe("Declare",async()=>value(await a.confirmPlannedExpenseReality("2026-10",expenseDraft(root),command(root))),1,root.id)).expense;
root = (await probe("Restore",async()=>value(await a.restorePlannedExpenseAction("2026-10",command(root))),1,root.id)).expense;
facts.inputs["2026-11"]={...defaultMonthInputs(),declaredResources:{"benefit:swile":"20.00","benefit:edenred":"0.00"}};
root = (await probe("Report",async()=>value(await a.reportPlannedExpenseAction("2026-10",command(root),"2026-11-05")),1,root.id)).expense;
await probe("Delete",async()=>value(await a.removePlannedExpense("2026-11",command(root))),1,root.id);

const visit={familyKey:"visit_trip",subtypeKey:"friend_visit",title:"DD6 contact et lieu déclarés",plannedDate:null,
  context:{personVisited:{kind:"TEXT",label:"Contact synthétique"},place:{kind:"TEXT",label:"Lieu synthétique"}},
  costItems:[item("25.00","visit_friend:coffee",["visit_friend"])]};
root=(await probe("contact TEXT + user-declared place",async()=>value(await a.savePlannedExpense("2026-10",visit,{id:randomUUID()})),1)).expense;
assert.equal(root.context.personVisited.kind,"TEXT"); assert.equal(root.context.place.kind,"TEXT");
root=(await probe("child local place",async()=>value(await a.savePlannedExpense("2026-10",{...expenseDraft(root),
  context:{...root.context,childLocalPlaceRefs:{restaurant:{kind:"TEXT",label:"Restaurant synthétique",provenance:"USER_DECLARED_PROSPECTIVE"}}},
  costItems:[...root.costItems,item("36.00","restaurant:main",["visit_friend","restaurant"])]},command(root))),1,root.id)).expense;

facts.vehicle={label:"Véhicule synthétique",consumptionL100Km:"8.000",fuelPricePerLiter:"2.000",
  fuelPriceSource:"PRICE_OBSERVATION",fuelPriceObservedAt:"2026-09-30",fuelPriceQuality:"P1"};
const stops=[{label:"Maison synthétique",distanceToNextKm:"10.000",distanceSource:"MANUAL"},
  {label:"Lieu synthétique",distanceToNextKm:null,endpointSource:"ROOT_PLACE"}];
const route=resolvePlannedRoute(stops,[],facts.vehicle);
const car={...expenseDraft(root),context:{...root.context,route:{mode:"CAR",stops:route.stops,fuelEstimate:route.fuelEstimate}},
  costItems:[...root.costItems,{...item("1.60","transport:fuel_usage",["visit_friend"]),priceSource:"CALCULATED"}]};
await probe("route/fuel Preview",async()=>value(await a.previewPlannedExpense("2026-10",car,root.id)),0);
root=(await probe("route/fuel Save",async()=>value(await a.savePlannedExpense("2026-10",car,command(root))),1,root.id)).expense;
root=(await probe("Declared route",async()=>value(await a.confirmPlannedExpenseReality("2026-10",expenseDraft(root),command(root))),1,root.id)).expense;

await probe("draft context change + local Undo",async()=>{
  const current=createBuilderState(visit);
  const changed=changeBuilderContext(current,{...current.draft.context,socialOccasion:"BIRTHDAY"});
  assert.deepEqual(undoBuilderChange(changed).draft,current.draft);
  assert.equal(materializeBuilderDraft(changed).context.personVisited.kind,"TEXT");
},0);

// RLS server supplement: two household scopes plus live person/place reference boundary.
const foreign=randomUUID();
client.rows.push({...structuredClone(client.rows[0]),household_id:foreign,planned_expense_id:randomUUID()});
const visible=await s.readPlannedExpenses(client,householdId,"2026-10");
assert(visible.every(row=>row.householdId===householdId),"foreign read excluded by household scope");
const missingPerson={...visit,context:{personVisited:{kind:"HOUSEHOLD_PERSON",personId:randomUUID()}}};
const missingPlace={...visit,context:{...visit.context,place:{kind:"KNOWN",placeId:randomUUID()}}};
for(const raw of [missingPerson,missingPlace]) await probe("foreign refs",async()=>{
  const response=await a.savePlannedExpense("2026-10",raw,{id:randomUUID()}); assert.equal(response.ok,false);
  assert.match(response.issue.code,/PERSON_NOT_IN_HOUSEHOLD|PLACE_CONTEXT_INVALID/);
},0);

// MEM-V1-01..07 / GATE-20: no memory persistence/learning/repeat/promotion pathway.
const paths=["src/domain/phase2/planned-builder.ts","src/domain/phase2/planned-rules.ts",
  "src/domain/phase2/planned-places.ts","src/server/phase2/planned-expenses.ts",
  "src/app/mois-a-venir/planned-expenses-control.tsx","src/app/mois-a-venir/planned-expenses-actions.ts"];
const sources=paths.map(path=>fs.readFileSync(path,"utf8"));
// C10: the differential place shim is retired after direct resolver/browser proof.
assert.doesNotMatch(sources[2], /export function placesForPlannedContext/u);
for (const source of sources) assert.doesNotMatch(source,/planning_memory|autoLearn|learnPreference|savePreset|applyPreset|repeatExpense|lastTimeExpense/u);
for (const key of ["memory","preset","template","repeat","declaredAmount","calendarRow","forecastRow","undoBuffer"])
  assert.throws(()=>s.parsePlannedExpenseDraft({...visit,[key]:{}},"2026-10"),/DRAFT_FIELDS_INVALID/);
const parsed=s.parsePlannedExpenseDraft(visit,"2026-10");
assert.deepEqual(parsed.context,visit.context,"TEXT remains intention, not canonical identity");
assert.doesNotMatch(sources[0]+sources[1]+sources[2],/from\s*\(.*supabase|createClient|\.insert\(|\.upsert\(/iu);
const service=sources[3];
const writeTables=[...service.matchAll(/\.from\("([^"]+)"\)\.(?:insert|update|delete|upsert)\(/gu)].map(match=>match[1]);
assert.deepEqual(new Set(writeTables),new Set(["phase2_planned_expenses"]));
assert.match(sources[5],/preparePlannedExpenseSimulation/); assert.match(service,/resolvePlannedExpenseDraft/);
assert.doesNotMatch(sources[4],/function\s+(?:deriveMonthScenario|deriveEconomicPlan|calculateRouteFuel)|localStorage|sessionStorage/u);
console.log("PASS: C9 targeted zero-write per operation, foreign references, MEM-V1-01..07, no duplicate authority");
console.log("DD6_ZERO_WRITE="+JSON.stringify(traces));
