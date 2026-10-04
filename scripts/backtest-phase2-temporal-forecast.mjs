import assert from "node:assert/strict";
import fs from "node:fs";
import {require} from "./lib/phase2-ts-loader.mjs";
import {fixtureCase,fixture,entries} from "./lib/phase2-temporal-fixture.mjs";
const {forecastRemainingMonth,matchesForecastCategory}=require("@/server/phase2/remaining-month-forecast.ts");
const {referenceMobilityDays,referenceQuantile}=require("@/server/phase2/month-reference.ts");
const checkpoints=[1,5,10,15,20,25],months=["2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07"];
const evaluated=["groceries","tobacco-vape","manon-work-mobility","adrien-work-meals","adrien-work-coffee","household-restaurants"],results=[];
for(const month of months)for(const day of checkpoints){
  const asOf=`${month}-${String(day).padStart(2,"0")}`,{reference,evidence}=fixtureCase(month,asOf);
  const result=forecastRemainingMonth(reference,evidence,asOf,[],{},{},"AS_OF_TEMPORAL");
  assert(result.trainingMonths.length<=5&&result.trainingMonths.every(m=>m<month));
  let temporal=0,benchmark=0;
  const categoryErrors=[];
  for(const category of [...result.essential,...result.optional].filter(c=>evaluated.includes(c.key))){
    const actual=category.key==="manon-work-mobility"?fixture.mobilityDays.filter(r=>r.date.startsWith(month)).reduce((n,r)=>n+Number(r.commute)+Number(r.detour??0),0):entries.filter(r=>r.date.startsWith(month)&&matchesForecastCategory(category.key,r)).reduce((n,r)=>n+Number(r.amount),0);
    const monthly=result.trainingMonths.map(m=>category.key==="manon-work-mobility"?referenceMobilityDays(evidence.history.mobilityLegs.filter(l=>l.date.startsWith(m))).reduce((n,r)=>n+r.commute+(r.detour??0),0):entries.filter(r=>r.date.startsWith(m)&&matchesForecastCategory(category.key,r)).reduce((n,r)=>n+Number(r.amount),0));
    const staticEstimate=referenceQuantile(monthly,.5),projected=Number(category.projectedMonth.central);
    temporal+=projected;benchmark+=staticEstimate;categoryErrors.push({key:category.key,temporalAbsoluteError:Math.abs(projected-actual),benchmarkAbsoluteError:Math.abs(staticEstimate-actual)});
  }
  const actual=evaluated.reduce((n,key)=>n+(key==="manon-work-mobility"?fixture.mobilityDays.filter(r=>r.date.startsWith(month)).reduce((s,r)=>s+Number(r.commute)+Number(r.detour??0),0):entries.filter(r=>r.date.startsWith(month)&&matchesForecastCategory(key,r)).reduce((s,r)=>s+Number(r.amount),0)),0);
  results.push({month,day,temporal,benchmark,actual,temporalAbsoluteError:Math.abs(temporal-actual),benchmarkAbsoluteError:Math.abs(benchmark-actual),categoryErrors});
}
const mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
const temporalMAE=mean(results.map(r=>r.temporalAbsoluteError)),benchmarkMAE=mean(results.map(r=>r.benchmarkAbsoluteError));
const horizons=Object.fromEntries(checkpoints.map(day=>[day,mean(results.filter(r=>r.day===day).map(r=>r.temporalAbsoluteError))]));
// Seven independent target months are too few to demand a strictly monotone sample
// mean. Define uncertainty from paired per-month error differences (95% Student t,
// df=6), with a 5€ rounding floor. Report the raw means and every regression as well.
// This is a gate tolerance, never a calibrated customer forecast interval.
const horizonComparisons=[[25,20],[20,15],[15,10]].map(([later,earlier])=>{
  const deltas=months.map(month=>results.find(r=>r.month===month&&r.day===later).temporalAbsoluteError-results.find(r=>r.month===month&&r.day===earlier).temporalAbsoluteError);
  const deltaMAE=mean(deltas),variance=deltas.reduce((n,d)=>n+(d-deltaMAE)**2,0)/(deltas.length-1);
  const toleranceEuros=Math.max(5,2.447*Math.sqrt(variance/deltas.length));
  return {later,earlier,deltaMAE,toleranceEuros,strictlyImproves:deltaMAE<0,withinSamplingTolerance:deltaMAE<toleranceEuros};
});
const report={forecastTemporalMode:"AS_OF_TEMPORAL",fixtureVersion:fixture.version,coverageMode:fixture.provenance.coverageMode,excludedFromCalibration:["manon-work-meals","SWILE funding","EDENRED funding","full bank cash"],
  runs:results.length,training:"five prior calendar months; cutoff observations only",temporalMAE,benchmarkMAE,gainPercent:100*(1-temporalMAE/benchmarkMAE),horizons,
  tolerancePolicy:"paired per-month MAE differences: max(5€, Student-t 95% standard error, df=6); not a product calibration",horizonComparisons,
  categories:Object.fromEntries(evaluated.map(key=>[key,{temporalMAE:mean(results.flatMap(r=>r.categoryErrors.filter(c=>c.key===key).map(c=>c.temporalAbsoluteError))),benchmarkMAE:mean(results.flatMap(r=>r.categoryErrors.filter(c=>c.key===key).map(c=>c.benchmarkAbsoluteError)))}])),results};
fs.mkdirSync("outputs",{recursive:true});fs.writeFileSync("outputs/phase2-temporal-backtest-report.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({...report,results:undefined},null,2));
assert(temporalMAE<benchmarkMAE,"Temporal global MAE must beat reconstructed static benchmark");
for(const comparison of horizonComparisons)assert(comparison.withinSamplingTolerance,`Horizon J${comparison.later} regresses beyond paired sampling tolerance against J${comparison.earlier}`);
console.log("PASS TEMPORAL_BACKTEST: 42 cutoff runs, no future training, global improvement; late horizons within reported paired sampling tolerance");
