import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { forecast, inputs } from "./check-phase2-october-contract.mjs";
import { planningHarness, value, item } from "./lib/planned-actions-harness.mjs";
// Preserve every temporal assertion and action parity under the explicit temporal mode.
process.env.PHASE2_FORECAST_TEMPORAL_MODE = "AS_OF_TEMPORAL";
const require = createRequire(import.meta.url);
require.extensions[".css"] = module => { module.exports = new Proxy({}, { get: (_, key) => key === "__esModule" ? undefined : String(key) }); };
require.extensions[".tsx"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
const { deriveMonthScenario, simulatePlannedExpenseScenario } = require("../src/server/phase2/month-scenario.ts");
const { forecastRemainingMonth } = require("../src/server/phase2/remaining-month-forecast.ts");
const { sourceCoverage, FORECAST_SOURCES } = require("../src/server/phase2/forecast-opportunities.ts");
const { projectPlannedExpenseImpact } = require("../src/server/phase2/planned-impact.ts");
const { projectMonthCalendar, projectPlannedExpenseCards } = require("../src/app/mois-a-venir/planned-expenses-projection.ts");
const months = Array.from({length:12},(_,i)=>new Date(Date.UTC(2025,9+i,1)).toISOString().slice(0,7));
const rows = [], legs = [];
const add = (month, day, subcategory, amount, person=null, preciseType=null) => rows.push({
  operationId:randomUUID(),date:`${month}-${String(day).padStart(2,"0")}`,subcategory,amount,person,preciseType,merchant:null });
for (const month of months) {
  for (const day of [2,6,10,16,22,27]) add(month,day,"Courses alimentaires","50.00");
  for (const day of [5,12,19,26]) add(month,day,"Bureau de tabac / presse","30.00");
  for (const day of [8,24]) add(month,day,"Restaurant","30.00");
  const weekdays = Array.from({length:28},(_,i)=>i+1).filter(d=>![0,6].includes(new Date(`${month}-${String(d).padStart(2,"0")}T12:00:00Z`).getUTCDay()));
  for (const day of weekdays.slice(0,5)) {
    add(month,day,"Boulangerie","6.00","Adrien","Repas du midi au travail");
    add(month,day,"Boulangerie","5.00","Manon","Repas du midi au travail");
    add(month,day,"Café au travail","2.00");
  }
  for (const day of weekdays) {
    const date=`${month}-${String(day).padStart(2,"0")}`;
    legs.push({date,origin:"Domicile Adrien & Manon",destination:"Promotrans – Montpellier",fuelCost:"1.00"},
      {date,origin:"Promotrans – Montpellier",destination:"Domicile Adrien & Manon",fuelCost:"1.00"});
  }
}
add("2026-09",30,"Courses alimentaires","6000.00"); // Atypical month is not the high scenario.
const evidence = { history:{startMonth:"2025-10",endMonth:"2026-09",economicEntries:rows,mobilityLegs:legs},
  currentEconomicEntries:[],currentMobilityLegs:[],observedThrough:"2026-10-20",personNamesById:{adrien:"Adrien"} };
const live = {...forecast,predictionEvidence:evidence};
// Decay is certifiable only with source proof. Uncovered past is tested separately.
const plan = (date="2026-10-01",projects=[],f=live) => deriveMonthScenario({...f,predictionEvidence:{...f.predictionEvidence,
  coverageBySource:Object.fromEntries(FORECAST_SOURCES.map(source=>[source,sourceCoverage(source,"2026-10-01",date,[{start:"2026-10-01",end:date}],"FULL",date)]))}},inputs,null,date,projects).economicPlan;
const category = (p,key) => [...p.narrative.prediction.essential,...p.narrative.prediction.optional].find(c=>c.key===key);
const first=plan(), twentieth=plan("2026-10-20");
assert.equal(first.economicResources,"3928.99"); assert.equal(first.certainOutflows.total,"847.23");
assert.equal(first.afterCertainOutflows,"3081.76");
assert.equal(first.afterSavingsAllocations,"1881.76");
assert(Number(category(first,"groceries").remaining.high)<1000,"outlier is not a raw max bound");
assert(Number(category(first,"groceries").remaining.central)<1000,"robust central survives atypical month");
assert(Number(category(twentieth,"groceries").remaining.central)<Number(category(first,"groceries").remaining.central));
assert(Number(category(twentieth,"tobacco-vape").remaining.central)<Number(category(first,"tobacco-vape").remaining.central));
assert(Number(category(twentieth,"manon-work-mobility").remaining.central)<Number(category(first,"manon-work-mobility").remaining.central));
assert(first.narrative.prediction.essential.every(c=>!["household-restaurants","adrien-work-meals","manon-work-meals","adrien-work-coffee"].includes(c.key)));
assert(first.narrative.prediction.optional.every(c=>c.remaining.low==="0.00"));
assert.equal(category(first,"household-restaurants").conditionalMedianAmount,"30.00");
const restaurantInitial=Number(category(first,"household-restaurants").remaining.central);
assert(Math.abs(restaurantInitial-60)<5,"weekday exposure adjusts the two-session baseline within this synthetic fixture");
const observed = {...evidence,currentEconomicEntries:[{operationId:randomUUID(),date:"2026-10-10",amount:"150.00",subcategory:"Courses alimentaires",person:null,preciseType:null,merchant:null},
  {operationId:randomUUID(),date:"2026-10-29",amount:"999.00",subcategory:"Courses alimentaires",person:null,preciseType:null,merchant:null}]};
const current=plan("2026-10-20",[],{...live,predictionEvidence:observed});
assert.equal(category(current,"groceries").alreadyRealized,"150.00","future observed rows cannot leak into realized facts");
assert(Number(category(current,"groceries").remaining.central)<=Number(category(twentieth,"groceries").remaining.central),"a bounded late nowcast may condition the historical tail");
assert.equal((Number(category(current,"groceries").projectedMonth.central)-Number(category(current,"groceries").remaining.central)).toFixed(2),"150.00");
const project = (amount,baselineKey="household-restaurants",plannedDate="2026-10-22") => ({id:randomUUID(),targetMonth:"2026-10",status:"PLANNED",
  familyKey:"food",subtypeKey:"restaurant",title:"Sortie synthétique",plannedDate,context:{},
  costItems:[{...item(amount,"restaurant:main",["restaurant"]),baselineKey}]});
const habitual=project("60.00"), withHabit=plan("2026-10-01",[habitual]);
assert(Math.abs(Number(category(withHabit,"household-restaurants").remaining.central)-(restaurantInitial-30))<.02);
assert(category(withHabit,"household-restaurants").expectedOccurrences.central<=1);
assert.equal(withHabit.plannedExpenses.netImpact.central,"30.00","60 gross displaces one 30 habitual occurrence");
assert.equal(withHabit.narrative.remainderAfterProjects,"1821.76","the project milestone deducts its full gross; remaining categories already lose their absorbed baseline");
const fullyCovered=plan("2026-10-01",[project("30.00")]);
assert.equal(fullyCovered.plannedExpenses.netImpact.central,"0.00");
assert.equal(fullyCovered.narrative.remainderAfterProjects,"1851.76");
const cheaper=project("25.00"), cheaperPlan=plan("2026-10-01",[cheaper]);
assert.equal(cheaperPlan.plannedExpenses.netImpact.central,"-5.00");
assert.equal(projectPlannedExpenseImpact(first,cheaperPlan,cheaper).absorbedByBaseline.central,"25.00");
assert.equal(cheaperPlan.plannedExpenses.absorbedByBaseline.central,"25.00");
const two=plan("2026-10-01",[project("25.00"),project("45.00")]);
assert.equal(two.plannedExpenses.netImpact.central,"10.00");
assert.equal(two.narrative.remainderAfterProjects,"1811.76");
assert.equal(category(two,"household-restaurants").remaining.central,"0.00");
const additional=project("60.00",null), withExtra=plan("2026-10-01",[additional]);
assert.equal(Number(category(withExtra,"household-restaurants").remaining.central),restaurantInitial);
assert.equal(withExtra.plannedExpenses.netImpact.central,"60.00");
const meal={...project("18.00","adrien-work-meals"),subtypeKey:"work_meal",context:{participantPersonIds:["adrien"]},
  costItems:[{...item("18.00","work_meal:bakery",["work_meal"]),baselineKey:"adrien-work-meals"}]};
const beforeMeal=plan("2026-10-20"), afterMeal=plan("2026-10-20",[meal]);
const replacedDay=category(beforeMeal,"adrien-work-meals").opportunities.find(o=>o.date===meal.plannedDate);
assert(Math.abs(category(afterMeal,"adrien-work-meals").remainingOpportunities-(category(beforeMeal,"adrien-work-meals").remainingOpportunities-replacedDay.probability))<1e-8);
assert(Number(category(afterMeal,"adrien-work-meals").remaining.central)<Number(category(beforeMeal,"adrien-work-meals").remaining.central));
assert.equal(category(afterMeal,"manon-work-meals").remaining.central,category(beforeMeal,"manon-work-meals").remaining.central);
const split={...habitual,costItems:[{...habitual.costItems[0],unitAmount:"45.00"},{...habitual.costItems[0],id:randomUUID(),unitAmount:"15.00",assetKey:"restaurant:alcohol_total"}]};
assert.equal(category(plan("2026-10-01",[split]),"household-restaurants").plannedOccurrencesAbsorbingHabit,1,"a split is still one root/module occurrence");
const declared=plan("2026-10-01",[{...habitual,status:"DECLARED_REALIZED"}]);
const financialNarrative = p => {
  const result = structuredClone(p.narrative);
  for (const c of [...result.prediction.essential, ...result.prediction.optional]) {
    delete c.habitualPlannedGross; delete c.habitualDeclaredGross;
    delete c.plannedEconomic; delete c.declaredRealizedEconomic;
  }
  return result;
};
assert.deepEqual(financialNarrative(declared), financialNarrative(withHabit), "lifecycle is economically neutral; only presentation buckets move");
assert.equal(category(declared,"household-restaurants").habitualDeclaredGross, "60.00");
assert.equal(category(declared,"household-restaurants").habitualPlannedGross, "0.00");
assert.deepEqual(declared.scenarios,withHabit.scenarios);
assert.equal(projectMonthCalendar([],projectPlannedExpenseCards([{...habitual,createdAt:"2026-09-30",updatedAt:"2026-09-30"}],"2026-10-01")).entries[0].amount,"60.00");
assert.deepEqual(simulatePlannedExpenseScenario(live,inputs,[],habitual,"2026-10-01").economicPlan.scenarios,withHabit.scenarios);
assert.equal(projectPlannedExpenseImpact(first,withHabit,habitual).netAdditionalImpact.central,"30.00");
for (const p of [first,twentieth,current,withHabit,two,withExtra,afterMeal]) {
  assert(Number(p.scenarios.lowConsumption)>=Number(p.scenarios.central));
  assert(Number(p.scenarios.central)>=Number(p.scenarios.highConsumption));
  for (const [r,k] of [["lowConsumption","low"],["central","central"],["highConsumption","high"]])
    assert(Math.abs(Number(p.narrative.remainderAfterEssential[r])-Number(p.narrative.optionalCost[k])-Number(p.narrative.final[r]))<.011);
}
const sparse={...evidence,history:{...evidence.history,economicEntries:rows.filter(r=>r.subcategory!=="Restaurant").concat(rows.find(r=>r.subcategory==="Restaurant"))}};
const sparseCategory=category(plan("2026-10-01",[],{...live,predictionEvidence:sparse}),"household-restaurants");
assert.equal(sparseCategory.confidence,"LOW"); assert.equal(sparseCategory.expectedOccurrences,null); assert.equal(sparseCategory.probability,null);
const uncovered=deriveMonthScenario(live,inputs,null,"2026-10-20",[]).economicPlan;
assert(uncovered.narrative.prediction.currentImportsMissing);
assert(Number(category(uncovered,"groceries").pendingExpectedEconomic.central)>0,"latest booking cannot expire uncovered past expectations");
const original=JSON.stringify(live); forecastRemainingMonth(live.referencePlan,evidence,"2026-10-20",[habitual]); assert.equal(JSON.stringify(live),original);
const {planningDate}=require("../src/server/phase2/planning-date.ts");
assert.equal(planningDate("Europe/Paris",new Date("2026-09-30T22:30:00Z")),"2026-10-01");
// Exercise canonical scope and both pagination boundaries without live writes.
const {readMonthPredictionEvidence}=require("../src/server/phase2/month-prediction-evidence.ts");
const household=randomUUID(), operationRows=Array.from({length:1001},(_,i)=>({operation_id:String(i).padStart(4,"0"),
  date_bancaire:"2026-09-30",personne_concernee:null,type_precis:null,marchand:null}));
const tables={canonical_household_scope_control:[{household_count:1,household_id:household,status:"READY"}],
  operations:operationRows,subcategories:[{subcategory_id:"food",nom_canonique:"Courses alimentaires"}],persons:[],mobility_legs:[],import_batches:[],
  financial_economic_cost_canonical:operationRows.map((r,i)=>({operation_id:r.operation_id,subcategory_id:"food",canonical_economic_net:"1.00",canonical_component_key:String(i).padStart(4,"0")}))};
const reads=[];
const client={from(table){reads.push(table);let values=[...(tables[table]??[])];const q={select(){return q;},
  eq(k,v){values=values.filter(r=>r[k]===v);return q;},in(k,v){values=values.filter(r=>v.includes(r[k]));return q;},
  gte(k,v){values=values.filter(r=>r[k]>=v);return q;},lt(k,v){values=values.filter(r=>r[k]<v);return q;},
  lte(k,v){values=values.filter(r=>r[k]<=v);return q;},
  order(k,options){values.sort((a,b)=>(a[k]<b[k]?-1:a[k]>b[k]?1:0)*(options?.ascending===false?-1:1));return q;},
  limit(n){values=values.slice(0,n);return q;},range(a,b){values=values.slice(a,b+1);return q;},
  maybeSingle(){return Promise.resolve({data:values[0]??null,error:null});},
  then(resolve,reject){return Promise.resolve({data:values,error:null}).then(resolve,reject);}};return q;}};
await assert.rejects(readMonthPredictionEvidence(client,randomUUID(),"2026-10"),/SCOPE_INVALID/);
assert.deepEqual(reads,["canonical_household_scope_control"]);
reads.length=0;
const canonicalEvidence=await readMonthPredictionEvidence(client,household,"2026-10");
assert.equal(canonicalEvidence.history.economicEntries.length,1001);
assert.equal(reads.filter(t=>t==="financial_economic_cost_canonical").length,2);
assert.equal(canonicalEvidence.observedThrough,"2026-09-30");
assert.equal(canonicalEvidence.currentEconomicEntries.length,0);
// Real Preview/Save/reload paths reuse exactly the same enriched forecast.
const h=planningHarness(), snapshots=require("../src/server/phase2/month-forecast-snapshot.ts");
snapshots.queryMonthForecast=async()=>live;
const draft={familyKey:"food",subtypeKey:"restaurant",title:"Restaurant synthétique",plannedDate:"2026-10-22",context:{},costItems:habitual.costItems};
const preview=value(await h.actions.previewPlannedExpense("2026-10",draft));
const saved=value(await h.actions.savePlannedExpense("2026-10",draft,{id:randomUUID()}));
assert.deepEqual(saved.scenario.economicPlan.scenarios,preview.after);
const reloaded=await h.service.readPlannedExpenses(h.client,h.householdId,"2026-10");
assert.deepEqual(deriveMonthScenario(live,inputs,null,planningDate("Europe/Paris"),reloaded).economicPlan.narrative,saved.scenario.economicPlan.narrative);
assert(h.client.writes.every(row=>row.table==="phase2_planned_expenses"));
const {MonthStory}=require("../src/app/mois-a-venir/month-story.tsx");
const {AppRouterContext}=require("next/dist/shared/lib/app-router-context.shared-runtime");
const router={refresh(){},push(){},replace(){},back(){},forward(){},prefetch(){}};
const html=renderToStaticMarkup(React.createElement(AppRouterContext.Provider,{value:router},React.createElement(MonthStory,{plan:first,targetMonth:"2026-10",plannedExpenses:[],persons:[],places:[],vehicle:null,prices:[],today:"2026-10-01",dateEvidence:{},references:{}})));
const titles=["Nos ressources","Ce qui part quoi qu’il arrive","Après nos charges certaines","Calendrier du mois","Ce qu’il nous faut pour le quotidien","Après l’essentiel du mois","Ce qui pourrait encore s’ajouter","Projection de fin de mois"];
let previous=-1;for(const title of titles){const index=html.indexOf(title);assert(index>previous,title);previous=index;}
assert.doesNotMatch(html,/Comment se construit notre mois|Ce qu’on dépense parfois en plus|Reste projeté en fin de mois/);
assert.match(html,/Déjà observé/);assert.match(html,/Encore possible/);assert.match(html,/Mois plus coûteux/);
// Precision controls now belong to the existing OverlayFrame, outside the narrative.
assert(!fs.readFileSync("src/app/mois-a-venir/month-forecast-view.tsx","utf8").includes("Améliorer la précision du mois"));
assert(fs.readFileSync("src/app/mois-a-venir/month-control-update.tsx","utf8").includes("save-bank-balance"));
assert(fs.readFileSync("src/app/mois-a-venir/month-control-center.tsx","utf8").includes("<OverlayFrame"));
console.log("PASS: V4 narrative order, robust recent quantiles, remaining days/workdays, imported vs future, optional zero/frequency/price, root/slot anti-double-count, marginal impact, lifecycle neutrality, Preview/Save/reload and historical zero-write");
