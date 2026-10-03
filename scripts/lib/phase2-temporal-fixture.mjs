import fs from "node:fs";
import {require} from "./phase2-ts-loader.mjs";
const {makeAsOfContext,sourceCoverage,FORECAST_SOURCES}=require("@/server/phase2/forecast-opportunities.ts");
export const fixture=JSON.parse(fs.readFileSync("scripts/fixtures/phase2-temporal-backtest-v1.json","utf8"));
const labels={groceries:"Courses alimentaires","adrien-work-meals":"Boulangerie","manon-work-meals":"Boulangerie","adrien-work-coffee":"Café au travail","household-restaurants":"Restaurant"};
export const entries=fixture.daily.map((r,i)=>({operationId:`fixture:${i}`,date:r.date,amount:r.amount,
  subcategory:r.categoryKey==="tobacco-vape"?({tobacco:"Bureau de tabac / presse",cannabis:"Cannabis",vape:"Vape / cigarette électronique"}[r.series]):labels[r.categoryKey],
  person:r.categoryKey.startsWith("adrien-")?"Adrien":r.categoryKey.startsWith("manon-")?"Manon":null,
  preciseType:r.categoryKey.endsWith("work-meals")?"Repas du midi au travail":null,merchant:null,
  amountStatus:r.amountStatus,funding:r.funding,fundingComplete:r.amountStatus==="KNOWN",occurrenceCount:r.occurrences}));
export const legs=fixture.mobilityDays.flatMap((r,i)=>[
  {id:`mob:${i}:out`,date:r.date,origin:"Domicile Adrien & Manon",destination:"Promotrans – Montpellier",fuelCost:(Number(r.commute)/2).toFixed(4)},
  {id:`mob:${i}:in`,date:r.date,origin:"Promotrans – Montpellier",destination:"Domicile Adrien & Manon",fuelCost:(Number(r.commute)/2).toFixed(4)},
  ...(r.detour===null?[]:[{id:`mob:${i}:lunch`,date:r.date,origin:"Promotrans – Montpellier",destination:"Marie Blachère – Montpellier sud",fuelCost:(Number(r.detour)/2).toFixed(4)},
    {id:`mob:${i}:return`,date:r.date,origin:"Marie Blachère – Montpellier sud",destination:"Promotrans – Montpellier",fuelCost:(Number(r.detour)/2).toFixed(4)}])]);
export const previousMonth=month=>{const d=new Date(`${month}-01T12:00:00Z`);d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7);};
export function fixtureCase(month,asOf){
  const closed=entries.filter(r=>r.date<`${month}-01`),historyLegs=legs.filter(r=>r.date<`${month}-01`);
  const history={startMonth:fixture.period.startMonth,endMonth:previousMonth(month),economicEntries:closed,mobilityLegs:historyLegs};
  const completeMonths=[];for(let d=new Date(`${history.startMonth}-01T12:00:00Z`);d.toISOString().slice(0,7)<month;d.setUTCMonth(d.getUTCMonth()+1))completeMonths.push(d.toISOString().slice(0,7));
  // Counterfactual cutoff proof for evaluating temporal economic error, explicitly labelled in fixture.
  // It is never used by the live reader, memory calibration or cash certification.
  const coverageBySource=Object.fromEntries(FORECAST_SOURCES.map(source=>[source,sourceCoverage(source,`${month}-01`,asOf,[{start:`${month}-01`,end:asOf}],"FULL",asOf)]));
  const evidence={history,currentEconomicEntries:entries.filter(r=>r.date.startsWith(month)&&r.date<=asOf),currentMobilityLegs:legs.filter(r=>r.date.startsWith(month)&&r.date<=asOf),
    observedThrough:asOf,latestObservedBookingDate:asOf,coverageBySource,completeMonthsBySource:{BANK:completeMonths,SWILE:[],EDENRED:[],MOBILITY:completeMonths},personNamesById:{},timezone:"Europe/Paris"};
  // Shape only: the published reference requires twelve months. Padding with future or
  // duplicate months would leak. Every model learns its values inside the real owner.
  const component=key=>({key,method:"BACKTEST_SHAPE_ONLY",low:"0.00",central:"0.00",high:"0.00",observationCount:0,provenance:[],note:null});
  const reference={targetMonth:month,necessary:["groceries","tobacco-vape","manon-work-mobility"].map(component),
    flexible:["adrien-work-meals","manon-work-meals","adrien-work-coffee","household-restaurants"].map(component),
    necessaryTotal:{low:"0.00",central:"0.00",high:"0.00"},flexibleTotal:{low:"0.00",central:"0.00",high:"0.00"},restaurantCorpus:[],excludedRestaurantSubcategories:[],estimatedDays:{}};
  return {reference,evidence,context:makeAsOfContext(month,asOf,"Europe/Paris",coverageBySource)};
}
