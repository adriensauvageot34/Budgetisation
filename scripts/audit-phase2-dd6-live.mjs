// C9 LIVE_CURRENT: independent directed medians from paginated canonical rows.
// Read only; no real row payload, UUID or credential is included in evidence.
import assert from "node:assert/strict";
import Big from "big.js";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import "./check-phase2-october-contract.mjs";
const require=createRequire(import.meta.url);
const {readPlannedContextOptions}=require("../src/server/phase2/planned-context.ts");
const {resolvePlannedRoute}=require("../src/domain/phase2/planned-routes.ts");
const {SOCIAL_CONTACTS_V1}=require("../src/domain/phase2/planned-rules.ts");
const {derivePlannedPlaceRoles}=require("../src/domain/phase2/planned-place-rules.ts");
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:household,error}=await client.from("households").select("household_id").limit(1).single(); if(error) throw error;
const id=household.household_id;
const {data:people,error:personError}=await client.from("persons").select("person_id,display_name").eq("household_id",id).eq("status","active"); if(personError)throw personError;
const options=await readPlannedContextOptions(client,id,people.map(row=>({personId:row.person_id,displayName:row.display_name})));
assert(options.vehicle);
const {data:vehicles,error:vehicleError}=await client.from("vehicles").select("vehicle_id").eq("household_id",id).eq("status","active").order("valid_from",{ascending:false}).limit(1); if(vehicleError)throw vehicleError;
const legs=[];
for(let offset=0;;offset+=500){
  const {data,error}=await client.from("mobility_legs").select("origin_place_id,destination_place_id,distance_km,estimated_fuel_liters,route_method_ref,travel_date")
    .eq("household_id",id).eq("vehicle_id",vehicles[0].vehicle_id).order("mobility_leg_id").range(offset,offset+499);
  if(error)throw error; legs.push(...data); if(data.length<500)break;
}
const history=legs.filter(row=>row.origin_place_id&&row.destination_place_id&&row.estimated_fuel_liters!==null)
  .map(row=>({originPlaceId:row.origin_place_id,destinationPlaceId:row.destination_place_id,distanceKm:String(row.distance_km),
    fuelLiters:String(row.estimated_fuel_liters),method:row.route_method_ref,date:row.travel_date}));
const median=values=>{const sorted=values.map(Number).sort((a,b)=>a-b), middle=Math.floor(sorted.length/2);
  return sorted.length%2?new Big(sorted[middle]):new Big(sorted[middle-1]).plus(sorted[middle]).div(2);};
const home=options.places.find(place=>derivePlannedPlaceRoles(place).includes("OWN_HOME")); assert(home);
const oracles=[];
for(const key of ["manon_father","lucas","cedric"]){
  const destination=SOCIAL_CONTACTS_V1.find(contact=>contact.key===key).places.find(link=>link.placeId).placeId;
  const pairs=[[home.placeId,destination],[destination,home.placeId]];
  const expected=pairs.map(([from,to])=>{
    const candidates=legs.filter(row=>row.origin_place_id===from&&row.destination_place_id===to&&row.estimated_fuel_liters!==null);
    if(!candidates.length)return null;
    const latest=[...candidates].sort((a,b)=>b.travel_date.localeCompare(a.travel_date)||a.route_method_ref.localeCompare(b.route_method_ref))[0];
    const methodRows=candidates.filter(row=>row.route_method_ref===latest.route_method_ref);
    return {distance:median(methodRows.map(row=>row.distance_km)).toFixed(3),liters:median(methodRows.map(row=>row.estimated_fuel_liters)).toFixed(6),count:methodRows.length};
  });
  const actual=resolvePlannedRoute([{label:"Origine",placeId:home.placeId},{label:"Destination",placeId:destination},{label:"Retour",placeId:home.placeId}],history,options.vehicle);
  assert.deepEqual(actual.stops.slice(0,-1).map(row=>row.distanceToNextKm),expected.map(row=>row?.distance??null));
  assert.equal(actual.status,expected.every(Boolean)?"KNOWN":"PARTIAL");
  const fuel=expected.every(Boolean)?expected.reduce((sum,row)=>sum.plus(row.liters),new Big(0)).times(options.vehicle.fuelPricePerLiter).toFixed(2):null;
  assert.equal(actual.fuelEstimate?.cost??null,fuel);
  oracles.push({contactKey:key,oracle:"LIVE_CURRENT",directedDistances:expected.map(row=>row?.distance??null),
    observationCounts:expected.map(row=>row?.count??0),fuelCost:fuel,status:actual.status});
}
const {count,error:countError}=await client.from("phase2_planned_expenses").select("*",{head:true,count:"exact"}).eq("household_id",id); if(countError)throw countError;
console.log("PASS: DD6 live route oracles derived independently from current canonical observations; no writes");
console.log("DD6_LIVE="+JSON.stringify({checkedAt:new Date().toISOString(),plannedRows:count,oracle:"LIVE_CURRENT",routeOracles:oracles,
  fuelObservedAt:options.vehicle.fuelPriceObservedAt,protectedAuthorities:["operations","life_events","moments","mobility_legs","mobility_trips","persons",
    "referentiel_lieu","person_place_roles","fuel_price_observations","benefit_wallets","benefit_wallet_ledger_entries","analytics_query_snapshots","analytics_artifacts","analytics_publications"],writes:0}));
