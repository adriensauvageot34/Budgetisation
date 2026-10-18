/** Deterministic shared-owner fixtures. No live Google/TomTom/HERE or Auth claim. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {require} from './lib/phase2-ts-loader.mjs';
import {fixture,state,uuid,night,selections,car,home,providers} from './fixtures/planner-mobility.mjs';
const {parseNightOutVenue,venueBinding,parseVenueEndpoints}=require('@/domain/phase2/planner/night-out-venue');
const {barPlaceOperation,barVenueAdaptations,barEndpoint,barSameModeReturn}=require('@/app/mois-a-venir/composer/bar-living-operations');
const {editNightOut}=require('@/domain/phase2/planner/night-out-edit');
const {validateContextGraph}=require('@/server/phase2/planner/context-selections');
const {semanticStateDigest,parsePlanSemanticState}=require('@/domain/phase2/planner/semantic-state');
const {preparePlanningMobility}=require('@/server/phase2/planner/prospective-mobility-pricing');
const {estimatePlannedCar}=require('@/server/phase2/planned-car-estimation');
const {stopForPlace}=require('@/domain/phase2/planned-routes');
const {CANONICAL_PEUGEOT_207,canonicalVehiclePresentation}=require('@/server/canonical/vehicle-profile');
const venue=(n=1)=>parseNightOutVenue({version:'night-out-venue@v1',decisionId:uuid(98000+n),place:{kind:'TEXT',label:'Synthetic bar '+n},google:{provider:'google_places',kind:'BAR_APERO',placeId:'ChIJ_fixture_'+n},provenance:'EXPLICIT_USER_DECISION'});
const a=venue(),b=venue(2),world=fixture();
const detail={provider:'google_places',placeId:a.google.placeId,displayName:'Synthetic bar',formattedAddress:'12 synthetic road, Bordeaux, France',types:['bar']};
function owners(override={}){
 const owner=providers(),calls={details:[],addresses:[]};
 owner.value.restaurant={details:async(id,token,kind)=>{calls.details.push({id,kind});if(override.error)throw Error('MOCK_DETAILS_UNAVAILABLE');return {...detail,...override.detail};}};
 owner.value.route.geocode=async(address,bias)=>{calls.addresses.push({address,bias});return {latitude:44.84,longitude:-0.58,source:'TOMTOM'};};
 return {...owner,calls:{...owner.calls,...calls}};
}
const leg=(key='outbound')=>car({selectionId:'synthetic-'+key,origin:key==='outbound'?home:a.place,destination:key==='outbound'?a.place:home,returnRequired:false,venueEndpoints:{[key==='outbound'?'destination':'origin']:venueBinding(a)}});
const semantic=(slots={outbound:selections(leg())})=>state([],[{...night(98010,'60',slots),fields:{label:'Synthetic bar',fieldSchemaVersion:'context-fields@v6',venueDecision:a,placeRef:a.place}}]);
const checks=[];
async function test(id,run){try{await run();checks.push({id,status:'PASS'});console.log(id+' PASS');}catch(e){checks.push({id,status:'FAIL',message:e.message});console.error(id+' FAIL '+e.stack);}}
await test('GOOGLE_REF_STRICT_ROUND_TRIP',()=>{
 const s=semantic();validateContextGraph(s);assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(s))),s);
 for(const patch of [{google:{...a.google,placeId:'bad id'}},{google:{...a.google,kind:'RESTAURANT'}},{address:'not allowed'},{place:home}])assert.throws(()=>parseNightOutVenue({...a,...patch}));
 assert.throws(()=>parseVenueEndpoints({origin:venueBinding(a)},{origin:home}));
 assert.throws(()=>editNightOut(s,{contextOccurrenceId:s.contexts[0].contextOccurrenceId,fields:{occasion:'not admitted'}}));
});
await test('SHARED_OWNER_BUILDER_VS_DIRECTED_PLANNER',async()=>{
 const input={stops:[stopForPlace(home,'Home','DIRECT_PLACE'),stopForPlace(a.place,a.place.label,'ROOT_PLACE')],plannedDate:null,plannedTime:null,preference:'FASTEST'};
 const builder=owners(),planner=owners();
 const left=await estimatePlannedCar(input,{...world.mobilityFacts,googleDestination:{placeId:a.google.placeId,kind:'BAR_APERO'}},builder.value);
 const right=await estimatePlannedCar(input,{...world.mobilityFacts,googleEndpoints:[{stopIndex:1,placeId:a.google.placeId,kind:'BAR_APERO'}]},planner.value);
 assert.equal(left.status,'LIVE');assert.equal(right.status,'LIVE');assert.deepEqual(builder.calls.routes,planner.calls.routes);
 assert.equal(left.snapshot.fuelEconomicCost,right.snapshot.fuelEconomicCost);assert.equal(left.snapshot.toll.amount,right.snapshot.toll.amount);
 assert.deepEqual(planner.calls.addresses.map(c=>c.address),[detail.formattedAddress]);assert.equal(planner.calls.addresses[0].bias,undefined);
 assert.ok(!JSON.stringify(right.snapshot).includes(detail.formattedAddress));
});
await test('DIRECTED_OUTBOUND_RETURN_AND_CUSTOM_LEG',async()=>{
 const owner=owners();const s=semantic({outbound:selections(leg()),return:selections(leg('return'))});
 const result=await preparePlanningMobility(world,s,owner.value);assert.equal(owner.calls.routes.length,2);assert.equal(owner.calls.details.length,2);
 const directions=owner.calls.routes.map(r=>r.coordinates);assert.ok(directions.some(c=>JSON.stringify(c)===JSON.stringify([world.mobilityFacts.places[0].coordinates,{latitude:44.84,longitude:-0.58,source:'TOMTOM'}])));
 assert.ok(directions.some(c=>JSON.stringify(c)===JSON.stringify([{latitude:44.84,longitude:-0.58,source:'TOMTOM'},world.mobilityFacts.places[0].coordinates])));
 assert.ok(JSON.stringify(result).includes('estimatePlannedCar@planned-car-live-v2'));
 const taxi={...leg('return'),optionKey:'taxi',pricing:{fare:{kind:'MANUAL',unitAmount:'17'},parking:{kind:'UNKNOWN'},fundingAllocations:[],preference:'FASTEST'}};
 const mixed=owners();await preparePlanningMobility(world,semantic({outbound:selections(leg()),return:selections(taxi)}),mixed.value);assert.equal(mixed.calls.routes.length,1);
 const custom=owners();await preparePlanningMobility(world,semantic({outbound:selections(leg()),return:selections(car({selectionId:'custom'}))}),custom.value);assert.equal(custom.calls.details.length,1);assert.equal(custom.calls.routes.length,2);
});
await test('INVALID_DETAILS_PRESERVE_UNKNOWN_AND_INPUT',async()=>{
 for(const override of [{error:true},{detail:{placeId:'ChIJ_other'}},{detail:{types:['school']}},{detail:{formattedAddress:''}}]){
 const owner=owners(override),s=semantic(),before=structuredClone(s);const result=await preparePlanningMobility(world,s,owner.value);
 assert.equal(owner.calls.routes.length,0);assert.deepEqual(s,before);const price=Object.values(result.journeyPrices)[0];assert.equal(price.economicFuel,null);assert.equal(price.snapshot,null);assert.equal(price.status,'UNKNOWN');}
});
await test('VENUE_CHANGE_EXPLICIT_SCOPE_ATOMIC_AND_REVERSE',()=>{
 const s=semantic({outbound:selections(leg()),return:selections(car({selectionId:'independent',origin:a.place,destination:home,pricing:{fare:{kind:'MANUAL',unitAmount:'12'},parking:{kind:'UNKNOWN'},fundingAllocations:[],preference:'FASTEST'}}))}),context=s.contexts[0];
 assert.equal(barVenueAdaptations(context).length,1);
 const retained=editNightOut(s,barPlaceOperation(context,b.place,b,false).edit);assert.deepEqual(retained.contexts[0].slotSelections,context.slotSelections);
 const op=barPlaceOperation(context,b.place,b,true),adapted=editNightOut(s,op.edit);validateContextGraph(adapted);
 assert.deepEqual(adapted.contexts[0].slotSelections.return,context.slotSelections.return);
 assert.equal(adapted.contexts[0].slotSelections.outbound.items[0].venueEndpoints.destination.venue.decisionId,b.decisionId);
 assert.equal(adapted.contexts[0].slotSelections.outbound.items[0].selectionId,leg().selectionId);
 assert.notEqual(semanticStateDigest(s),semanticStateDigest(adapted));assert.deepEqual(s.contexts[0],context);
 const unlinked=barEndpoint(leg(),'destination',a.place);assert.equal(unlinked.venueEndpoints,undefined);
 const emptyReturn=semantic().contexts[0],reverse=barSameModeReturn(emptyReturn,'new-return').edit.slots.return[0];
 assert.equal(reverse.venueEndpoints.origin.venue.decisionId,a.decisionId);assert.equal(reverse.pricing.fare.kind,'UNKNOWN');
});
await test('STRUCTURED_VEHICLE_PRESENTATION_ONLY_OFFICIAL_DECLARATION',()=>{
 assert.equal(canonicalVehiclePresentation({label:CANONICAL_PEUGEOT_207.fullLabel,fuel_type:'SP95'}).displayName,'Peugeot 207');
 for(const row of [{label:'Peugeot 207 guessed',fuel_type:'SP95'},{label:CANONICAL_PEUGEOT_207.fullLabel,fuel_type:'DIESEL'},{label:'Other',fuel_type:'SP95'}])assert.equal(canonicalVehiclePresentation(row),undefined);
});
fs.mkdirSync('outputs/bar-350',{recursive:true});fs.writeFileSync('outputs/bar-350/residual16-google-route.json',JSON.stringify({proof:'LOCAL_SHARED_OWNER_MOCK_NOT_REAL_PROVIDER_NOT_AUTH',checks},null,2));
process.exitCode=checks.some(c=>c.status==='FAIL')?1:0;
