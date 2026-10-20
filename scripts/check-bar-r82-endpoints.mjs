/** Focused owner + SQL JSON compatibility. Synthetic providers, no live/Auth claim. */
import assert from 'node:assert/strict';import fs from 'node:fs';
import {require} from './lib/phase2-ts-loader.mjs';
import {fixture,state,night,selections,car,uuid,providers} from './fixtures/planner-mobility.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
const {parseRouteEndpointBindings}=require('@/domain/phase2/planner/route-endpoint');
const {normalizeRestaurantDetails,normalizeRestaurantSuggestions,projectPlaceTypeCompatible}=require('@/domain/phase2/restaurant-places');
const {GoogleRestaurantPlaces}=require('@/server/places/google-places');
const {barEndpoint,barReverseLeg,barSameModeReturn}=require('@/app/mois-a-venir/composer/bar-living-operations');
const {preparePlanningMobility}=require('@/server/phase2/planner/prospective-mobility-pricing');
const {validateContextGraph}=require('@/server/phase2/planner/context-selections');
const {parsePlanSemanticState,semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {stopForPlace}=require('@/domain/phase2/planned-routes');
const place=label=>({kind:'TEXT',label,provenance:'USER_DECLARED_PROSPECTIVE'});
const id=uuid(98200),sid=uuid(98201),origin=place('Point public homonyme'),destination=place('Autre point public');
const bind=(endpoint,point,placeId)=>({version:'route-endpoint@v1',decisionId:uuid(endpoint==='origin'?98202:98203),selectionId:sid,endpoint,place:point,google:{provider:'google_places',kind:'ROUTE_ENDPOINT',placeId},provenance:'EXPLICIT_USER_DECISION'});
const bindings={origin:bind('origin',origin,'ChIJ_r82_origin'),destination:bind('destination',destination,'ChIJ_r82_destination')};
const world=fixture();
const leg=car({selectionId:sid,origin,destination,returnRequired:false,routeEndpointBindings:bindings,pricing:{fare:{kind:'UNKNOWN'},parking:{kind:'UNKNOWN'},fundingAllocations:[],preference:'FASTEST'},route:{version:'composer-mobility-route@v1',vehicleRef:{vehicleId:world.mobilityFacts.vehicle.vehicleId,labelAtSelection:'Peugeot 207',provenance:'EXPLICIT_USER_DECISION'},stops:[stopForPlace(origin,origin.label,'DIRECT_PLACE'),stopForPlace(destination,destination.label,'ROOT_PLACE')]}});
const draft=state([],[night(98200,'20',{outbound:selections(leg)})]);
const raw=(placeId,extra={})=>({id:placeId,displayName:{text:'Point public homonyme'},formattedAddress:`Adresse publique ${placeId}, France`,addressComponents:[{shortText:'FR',longText:'France',types:['country']}],location:{latitude:43.6,longitude:3.9},types:[],...extra});
const checks=[];const test=async(name,run)=>{try{await run();checks.push({name,status:'PASS'});console.log(name+' PASS');}catch(e){checks.push({name,status:'FAIL',message:e.message});console.error(name+' FAIL '+e.stack);}};
await test('ENDPOINT_FR_EMPTY_TYPES_EXACT_ID_AND_ORIGINAL_FILTERS',async()=>{
 assert.equal(normalizeRestaurantDetails(raw('ChIJ_r82_origin'),'ROUTE_ENDPOINT').countryCode,'FR');
 for(const value of [raw('ChIJ_r82_origin',{addressComponents:[]}),raw('ChIJ_r82_origin',{addressComponents:[{shortText:'GB',types:['country']}]}),raw('ChIJ_r82_origin',{formattedAddress:''}),raw('ChIJ_r82_origin',{location:{latitude:NaN,longitude:3}})])assert.throws(()=>normalizeRestaurantDetails(value,'ROUTE_ENDPOINT'));
 assert.throws(()=>normalizeRestaurantDetails(raw('ChIJ_r82_origin'),'BAR_APERO'));assert.equal(projectPlaceTypeCompatible(['street_address'],'RESTAURANT'),false);
 const requests=[];const google=new GoogleRestaurantPlaces({key:'fixture-not-a-secret',fetch:async(url,init)=>{requests.push({url,body:init.body?JSON.parse(init.body):null});return Response.json(url.includes('autocomplete')?{suggestions:[{placePrediction:{placeId:'ChIJ_r82_origin',types:[],structuredFormat:{mainText:{text:'Rue publique'},secondaryText:{text:'France'}}}}]}:raw('ChIJ_wrong'));}});
 assert.equal((await google.autocomplete('Rue publique',uuid(98204),'','ROUTE_ENDPOINT')).length,1);assert.deepEqual(requests[0].body.includedRegionCodes,['fr']);await assert.rejects(()=>google.details('ChIJ_r82_origin',undefined,'ROUTE_ENDPOINT'));
 assert.equal(normalizeRestaurantSuggestions({suggestions:[{placePrediction:{placeId:'ChIJ_r82_origin',types:[],structuredFormat:{mainText:{text:'Rue'}}}}]},'BAR_APERO').length,0);
});
await test('DIRECTED_PARSER_STRICT_SCOPE_NO_PROVIDER_SNAPSHOT',()=>{
 assert.deepEqual(parseRouteEndpointBindings(bindings,leg),bindings);validateContextGraph(draft);
 for(const change of [{selectionId:uuid(98299)},{endpoint:'destination'},{google:{...bindings.origin.google,kind:'BAR_APERO'}},{coordinates:{latitude:43,longitude:3}},{place:place('Autre homonyme')},{version:'route-endpoint@v2'}])assert.throws(()=>parseRouteEndpointBindings({...bindings,origin:{...bindings.origin,...change}},leg));
 assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(draft))),draft);
});
await test('REVERSE_RETURN_TAXI_AND_FREE_DO_NOT_LEAK_BINDINGS_OR_COSTS',()=>{
 const reversed=barReverseLeg(leg);assert.equal(reversed.selectionId,sid);assert.equal(reversed.routeEndpointBindings.origin.google.placeId,bindings.destination.google.placeId);assert.equal(reversed.routeEndpointBindings.origin.endpoint,'origin');
 const op=barSameModeReturn(draft.contexts[0],uuid(98210)),returning=op.edit.slots.return[0];assert.equal(returning.routeEndpointBindings.origin.selectionId,returning.selectionId);assert.equal(returning.routeEndpointBindings.destination.google.placeId,bindings.origin.google.placeId);assert.equal(returning.pricing.fare.kind,'UNKNOWN');assert.deepEqual(returning.pricing.fundingAllocations,[]);
 const taxi={...returning,optionKey:'taxi'};delete taxi.route;validateContextGraph(state([],[{...draft.contexts[0],slotSelections:{outbound:selections(leg),return:selections(taxi)}}]));
 const free=barEndpoint(leg,'origin',place('Nom non vérifié'),'UNKNOWN');assert.equal(free.routeEndpointBindings.origin,undefined);assert.equal(free.routeEndpointBindings.destination.google.placeId,bindings.destination.google.placeId);assert.equal(leg.routeEndpointBindings.origin.google.placeId,bindings.origin.google.placeId);
 const priced={...leg,pricing:{...leg.pricing,fare:{kind:'MANUAL',unitAmount:'19'}}};assert.throws(()=>barEndpoint(priced,'origin',origin));assert.equal(barEndpoint(priced,'origin',origin,'UNKNOWN').pricing.fare.kind,'UNKNOWN');
 assert.throws(()=>barEndpoint({...leg,pricing:{...leg.pricing,fundingAllocations:[{source:'BANK',amount:'19'}]}},'origin',null,'UNKNOWN'));
});
function owners(invalid=false){const p=providers(),seen={details:[],geocodes:[]};p.value.restaurant={details:async(placeId,_token,kind)=>{seen.details.push({placeId,kind});return {...normalizeRestaurantDetails(raw(placeId),'ROUTE_ENDPOINT'),...(invalid?{placeId:'ChIJ_wrong'}:{})};}};p.value.route.geocode=async address=>{seen.geocodes.push(address);return {latitude:43.6+seen.geocodes.length/100,longitude:3.9,source:'TOMTOM'};};return {...p,seen};}
await test('SERVER_DETAILS_EACH_EXACT_STOP_TO_EXISTING_MOBILITY',async()=>{
 const p=owners();const prepared=await preparePlanningMobility(world,draft,p.value);
 assert.deepEqual(p.seen.details.map(x=>x.kind),['ROUTE_ENDPOINT','ROUTE_ENDPOINT']);assert.deepEqual(p.seen.geocodes,[raw(bindings.origin.google.placeId).formattedAddress,raw(bindings.destination.google.placeId).formattedAddress]);assert.equal(p.calls.routes.length,1);assert.ok(Object.values(prepared.journeyPrices).some(x=>x.economicFuel!==null));
 const mutated=structuredClone(draft);mutated.contexts[0].slotSelections.outbound.items[0].routeEndpointBindings.origin.google.placeId='ChIJ_other_homonym';const changed=await preparePlanningMobility(world,mutated,owners().value);
 assert.notDeepEqual(Object.values(changed.journeyPrices).map(x=>x.requestDigest),Object.values(prepared.journeyPrices).map(x=>x.requestDigest));
});
await test('FAILED_DETAILS_NEVER_REUSES_OLD_COORDINATES_OR_FARE',async()=>{
 const stale=structuredClone(draft);for(const stop of stale.contexts[0].slotSelections.outbound.items[0].route.stops)Object.assign(stop,{coordinates:{latitude:43,longitude:3,source:'USER_DECLARED'},distanceToNextKm:'10',distanceSource:'MANUAL'});
 const p=owners(true),prepared=await preparePlanningMobility(world,stale,p.value);assert.equal(p.calls.routes.length,0);assert.ok(Object.values(prepared.journeyPrices).every(x=>x.economicFuel===null&&x.status==='UNKNOWN'));
 const wrong=structuredClone(draft);wrong.contexts[0].slotSelections.outbound.items[0].routeEndpointBindings.origin.selectionId=uuid(98299);assert.throws(()=>validateContextGraph(wrong));
});
await test('C0_SQL_ROUNDTRIP_NEW_BINDINGS_AND_OLD_DRAFT_NO_MIGRATION',async()=>{
 const pg=await createKernelPostgres();try{await pg.db.exec("reset role; create table public.r82_json_fixture(value jsonb check(private.phase2_month_plan_state_valid_v1(value,'2026-11-01'::date)));");
 const old=state([],[night(98212)]);for(const semantic of [old,draft]){await pg.db.query('insert into public.r82_json_fixture values($1)',[JSON.stringify(semantic)]);}
 const rows=(await pg.db.query('select value from public.r82_json_fixture')).rows;assert.deepEqual(rows[0].value,old);assert.deepEqual(rows[1].value,draft);assert.equal(semanticStateDigest(rows[1].value),semanticStateDigest(draft));validateContextGraph(rows[1].value);await pg.verifyCanaries();
 }finally{await pg.close();}
});
fs.mkdirSync('outputs/bar-r82',{recursive:true});fs.writeFileSync('outputs/bar-r82/endpoint-results.json',JSON.stringify({level:'SYNTHETIC_OWNER_SQL_NOT_AUTH_OR_LIVE',checks,remoteWrites:0},null,2));if(checks.some(x=>x.status==='FAIL'))process.exitCode=1;
