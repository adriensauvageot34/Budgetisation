import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import "./check-phase2-october-contract.mjs";
import { plannedExpenseMemoryClient } from "./lib/planned-expense-memory-client.mjs";
const require=createRequire(import.meta.url);
process.loadEnvFile(".env.local");
const {createCanonicalReadClient}=require("../src/server/canonical/client.ts");
const {readPlannedContextOptions,readPlannedRouteHistory}=require("../src/server/phase2/planned-context.ts");
const {SOCIAL_CONTACTS_V1}=require("../src/domain/phase2/planned-rules.ts");
const {derivePlannedPlaceRoles}=require("../src/domain/phase2/planned-place-rules.ts");
const {rankFamilyVisitContacts,rankVisitTransportModes}=require("../src/domain/phase2/planned-visits.ts");
const {estimatePlannedCar}=require("../src/server/phase2/planned-car-estimation.ts");
const {TomTomRouteProvider,FrenchOfficialFuelPriceProvider,HereTollProvider}=require("../src/server/phase2/planned-car-providers.ts");
const {applyCarResult,parseCarSnapshot,transportPresentation}=require("../src/domain/phase2/planned-car.ts");
const server=require("../src/server/phase2/planned-expenses.ts");
const client=createCanonicalReadClient();
const {data:vehicles,error}=await client.from("vehicles").select("household_id").eq("status","active").limit(1);assert.ifError(error);
const householdId=vehicles[0].household_id;
const people=await client.from("persons").select("person_id,display_name,status,household_id").eq("household_id",householdId).eq("status","active");assert.ifError(people.error);
const options=await readPlannedContextOptions(client,householdId,people.data.map(p=>({personId:p.person_id,displayName:p.display_name})));
const facts={places:options.places,vehicle:options.vehicle,history:await readPlannedRouteHistory(client,householdId)};
const home=options.places.find(p=>derivePlannedPlaceRoles(p).includes("OWN_HOME"));assert(home?.coordinates);
const tables=["mobility_legs","mobility_trips","operations","purchase_events","product_observations","fuel_price_observations","referentiel_lieu"];
async function fingerprint(){const result={};for(const table of tables){const rows=[];for(let offset=0;;offset+=1000){const page=await client.from(table).select("*").range(offset,offset+999);assert.ifError(page.error);rows.push(...page.data);if(page.data.length<1000)break;}
 const hashes=rows.map(r=>createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(r).sort()))).digest("hex")).sort();result[table]={count:rows.length,hash:createHash("sha256").update(hashes.join("")).digest("hex")};}return result;}
const before=await fingerprint();
const date="2026-10-17", timing={outbound:{date,time:null},return:{required:true,date:"2026-10-18",time:null}};
const route=new TomTomRouteProvider(), fuel=new FrenchOfficialFuelPriceProvider(), toll=new HereTollProvider(undefined,{onError:(issue)=>console.log("HERE status:",JSON.stringify(issue))});
const smokes=[];
for(const key of ["manon_mother","manon_father"]){
 const contact=SOCIAL_CONTACTS_V1.find(c=>c.key===key), destination=options.places.find(p=>p.placeId===contact.places.find(l=>l.relation==="HOME").placeId);assert(destination?.coordinates);
 const calls=[],tolls=[];
 const result=await estimatePlannedCar({plannedDate:date,tripTiming:timing,stops:[home,destination,home].map((p,i)=>({label:p.name,placeId:p.placeId,endpointSource:i===1?"ROOT_PLACE":"DIRECT_PLACE"}))},facts,
  {route:{geocode:route.geocode.bind(route),estimateCarRoute:async(input)=>{calls.push({date:input.plannedDate,time:input.plannedTime,preference:input.preference,points:input.coordinates.length});try{return await route.estimateCarRoute(input);}catch(error){console.log("Route provider status:", error.message, error.status);throw error;}}},fuel,
   toll:{estimateTolls:async(r)=>{const t=await toll.estimateTolls(r);tolls.push({geometryHash:r.geometryHash,status:t.status,amount:t.amount});return t;}}});
 console.log(JSON.stringify({contact:contact.label,status:result.status,fallbacks:result.snapshot?.fallbacks,directions:result.snapshot?.journey && [result.snapshot.journey.outbound.route.provider,result.snapshot.journey.return.route.provider],messages:result.messages}));
 assert.equal(result.status,"LIVE");assert(result.snapshot?.journey);parseCarSnapshot(result.snapshot);
 assert.equal(result.snapshot.fuelPrice.source,"FR_GOV_FUEL_INSTANT_V2");assert.equal(calls[0].date,timing.outbound.date);assert.equal(calls[1].date,timing.return.date);
 assert.equal(result.snapshot.journey.outbound.route.timeBasis,"UNKNOWN_TIME_MEDIAN_08_14_18");assert.equal(result.snapshot.journey.return.route.timeBasis,"UNKNOWN_TIME_MEDIAN_08_14_18");
 const draft=applyCarResult({familyKey:"visit_trip",subtypeKey:"family_visit",title:`Voir ${contact.label}`,plannedDate:date,costItems:[],context:{participantPersonIds:people.data.map(p=>p.person_id),personVisited:{kind:"CONTACT",contactKey:key},place:{kind:"KNOWN",placeId:destination.placeId},visitTiming:timing,transportMode:"CAR",route:{mode:"CAR",stops:result.stops}}},result,randomUUID);
 let parity="BLOCKED (unavailable provider fee; no amount invented)";
 if(result.snapshot.toll.amount!==null){
  const preview=await server.resolvePlannedExpenseDraft(client,householdId,"2026-10",draft,"PREVIEW");
  const memory=plannedExpenseMemoryClient([],people.data);
  const saved=await server.createPlannedExpense(memory,householdId,"2026-10",people.data[0].person_id,preview,randomUUID());
  const reload=await server.readPlannedExpenses(memory,householdId,"2026-10");assert.equal(reload.length,1);assert.deepEqual(saved.costItems,preview.costItems);assert.deepEqual(reload[0].context.visitTiming,timing);
  assert(memory.writes.every(w=>w.table==="phase2_planned_expenses"));parity="PASS (live reads/providers, prospective write in memory)";
 }else await assert.rejects(server.resolvePlannedExpenseDraft(client,householdId,"2026-10",draft,"PREVIEW"),/COST_INCOMPLETE/);
 const summarize=(leg)=>({date:leg.plannedDate,timeBasis:leg.route.timeBasis,distanceKm:leg.route.distanceKm,durationSeconds:leg.route.durationSeconds,liters:leg.route.liters,fuelCost:leg.fuelEconomicCost,toll:leg.toll.amount,tollProvider:leg.toll.provider,geometryHash:leg.route.geometryHash});
 smokes.push({contact:contact.label,commune:destination.commune,placeId:destination.placeId,visitDays:destination.visits12Months,carEvidence:rankVisitTransportModes(destination).evidence,
  calls,tolls,outbound:summarize(result.snapshot.journey.outbound),return:summarize(result.snapshot.journey.return),
  totals:{distanceKm:result.snapshot.route.distanceKm,liters:result.snapshot.route.liters,fuelCost:result.snapshot.fuelEconomicCost,toll:result.snapshot.toll.amount,...transportPresentation(draft).totals},
  variants:result.variants.map(v=>({preference:v.preference,distanceKm:v.route.distanceKm,fuelCost:v.fuelEconomicCost,toll:v.toll.amount})),previewSaveReload:parity});
}
const after=await fingerprint();assert.deepEqual(after,before);
const report={at:new Date().toISOString(),contactRanking:rankFamilyVisitContacts(options.places).map(r=>({key:r.contact.key,visitDays:r.visitDays,habitual:r.habitual})),smokes,zeroHistoricalWrite:before,remoteWrites:0};
if(process.env.FAMILY_VISIT_EVIDENCE_PATH)fs.writeFileSync(process.env.FAMILY_VISIT_EVIDENCE_PATH,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
