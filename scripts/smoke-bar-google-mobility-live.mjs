/** Bounded public-point smoke. Never imports a Supabase client or reads a household.
 * Secrets: inherited server environment or an explicitly supplied ignored env file.
 * Evidence: status/aggregate facts/hashes only; no provider payload, URL, key or geometry.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {require} from './lib/phase2-ts-loader.mjs';
import {readLiveProviderKeys} from './lib/bar-live-provider-keys.mjs';
await readLiveProviderKeys();
if (process.env.BAR_LIVE_ENV_FILE) process.loadEnvFile(process.env.BAR_LIVE_ENV_FILE);
const {GoogleRestaurantPlaces}=require('@/server/places/google-places');
const {TomTomRouteProvider,FrenchOfficialFuelPriceProvider,HereTollProvider,decodeTomTomPolyline,hereImportTrace}=require('@/server/phase2/planned-car-providers');
const {estimatePlannedCar}=require('@/server/phase2/planned-car-estimation');
const {preparePlanningMobility,stableMobilityEvidence}=require('@/server/phase2/planner/prospective-mobility-pricing');
const {fuelEconomicCost}=require('@/domain/phase2/planned-car');
const {venueBinding}=require('@/domain/phase2/planner/night-out-venue');
const {barPlaceOperation}=require('@/app/mois-a-venir/composer/bar-living-operations');
const {editNightOut}=require('@/domain/phase2/planner/night-out-edit');
const {fixture,state,night,selections,car,uuid}=await import('./fixtures/planner-mobility.mjs');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const evidence={at:new Date().toISOString(),sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  boundary:'SERVER_SCRIPT_PUBLIC_POINTS_SYNTHETIC_WORLD_NO_SUPABASE',maxRequests:70,requests:[],checks:{}};
const hosts=new Set(['places.googleapis.com','api.tomtom.com','router.hereapi.com','www.data.economie.gouv.fr']);
const network=globalThis.fetch;
const bounded=async (url,init)=>{
  const u=new URL(url instanceof Request?url.url:url);
  if(!hosts.has(u.hostname)||u.protocol!=='https:')throw Error('UNAUTHORIZED_PROVIDER_HOST');
  if(evidence.requests.length>=evidence.maxRequests)throw Error('CALL_BUDGET_EXCEEDED');
  const record={host:u.hostname,ordinal:evidence.requests.length+1};evidence.requests.push(record);
  const at=performance.now();try {const r=await network(url,{...init,redirect:'error'});record.status=r.status;
    if(r.ok&&u.hostname==='router.hereapi.com'){
      const body=await r.clone().json();record.hereShape={keys:Object.keys(body),notices:(body.notices??[]).map(n=>({code:n.code,severity:n.severity})),
        routeCount:body.routes?.length,topHandle:typeof body.routeHandle==='string',routes:(body.routes??[]).map(x=>({keys:Object.keys(x),hasHandle:typeof x.routeHandle==='string',
          notices:(x.notices??[]).map(n=>({code:n.code,severity:n.severity})),sections:x.sections?.map(s=>({keys:Object.keys(s),tolls:s.tolls?.length}))}))};
    }
    return r;}
  catch {record.networkError=true;throw Error('PROVIDER_NETWORK_ERROR');}finally{record.ms=Math.round(performance.now()-at);}
};
globalThis.fetch=bounded;
const safeError=e=>({name:e?.name??'Error',code:typeof e?.code==='string'?e.code:undefined,status:e?.status,
  assertion:e?.code==='ERR_ASSERTION'?true:undefined,scriptLine:Number(e?.stack?.match(/smoke-bar-google-mobility-live\.mjs:(\d+):/u)?.[1])||undefined});
async function check(name,run){try {evidence.checks[name]={status:'PASS_REAL_PROVIDER',result:await run()};}
  catch(e){evidence.checks[name]={status:'FAIL',error:safeError(e)};}}
const config=Object.fromEntries(['GOOGLE_MAPS_API_KEY','TOMTOM_API_KEY','HERE_API_KEY'].map(k=>[k,!!process.env[k]]));evidence.configuration=config;
const blocked=name=>evidence.checks[name]={status:'BLOCKED_CREDENTIALS_OR_SCOPE'};
const google=new GoogleRestaurantPlaces({fetch:bounded});
const route=new TomTomRouteProvider(undefined,{fetcher:bounded});
const fuel=new FrenchOfficialFuelPriceProvider({fetcher:bounded});
const hereErrors=[];
const toll=new HereTollProvider(undefined,{fetcher:bounded,onError:issue=>hereErrors.push(issue)});
const origin={latitude:43.6083,longitude:3.8794,source:'USER_DECLARED'}; // Place de la Comédie, public.
let chosen,other,outbound,returning,reference;
const routeSummary=r=>({distanceKm:r.distanceKm,durationSeconds:r.durationSeconds,liters:r.liters,geometryHash:r.geometryHash,method:r.routeMethodRef,timeBasis:r.timeBasis,economicFuel:reference?fuelEconomicCost(r.liters,reference.pricePerLiter):null});
if(config.GOOGLE_MAPS_API_KEY)await check('REAL_GOOGLE',async()=>{
  const token=randomUUID();const candidates=await google.autocomplete('bar Montpellier',token,'Montpellier','BAR_APERO');
  assert(candidates.length);chosen=await google.details(candidates[0].placeId,token,'BAR_APERO');
  assert.equal(chosen.placeId,candidates[0].placeId);assert(chosen.formattedAddress);
  const elsewhere=await google.autocomplete('bar Bordeaux',randomUUID(),'','BAR_APERO');assert(elsewhere.length);
  other=await google.details(elsewhere[0].placeId,undefined,'BAR_APERO');assert.equal(other.placeId,elsewhere[0].placeId);
  assert.equal(other.city?.toLocaleLowerCase('fr'),'bordeaux');
  const searches=[];
  for(const [name,input,city] of [['PARTIAL_NAME',chosen.displayName.slice(0,Math.max(3,Math.ceil(chosen.displayName.length/2)))+' Montpellier','Montpellier'],
    ['MINOR_TYPO','bar Montpelier','Montpellier'],['NAME_WITHOUT_CITY',chosen.displayName,''],['EXPLICIT_OTHER_CITY_WITH_MONTPELLIER_BIAS','bar Toulouse','Montpellier'],
    ['HOMONYM_A','Le Central Montpellier',''],['HOMONYM_B','Le Central Bordeaux',''],['NO_RESULT','zzzxqvplm_9467821630','']]){
    const suggestions=await google.autocomplete(input,randomUUID(),city,'BAR_APERO');searches.push({name,count:suggestions.length,identityHashes:suggestions.map(s=>hash(s.placeId))});
    if(name==='NO_RESULT')assert.equal(suggestions.length,0);else assert(suggestions.length);
    if(name==='EXPLICIT_OTHER_CITY_WITH_MONTPELLIER_BIAS'){const d=await google.details(suggestions[0].placeId,undefined,'BAR_APERO');assert.equal(d.city?.toLocaleLowerCase('fr'),'toulouse');}
    if(name.startsWith('HOMONYM')){const d=await google.details(suggestions[0].placeId,undefined,'BAR_APERO');searches.at(-1).nameHash=hash(d.displayName.toLocaleLowerCase('fr'));searches.at(-1).exactIdVerified=d.placeId===suggestions[0].placeId;}
  }
  return {identityHash:hash(chosen.placeId),typesAdmitted:true,addressPresent:true,outsideMontpellier:true,searches};
});else blocked('REAL_GOOGLE');
await check('REAL_FUEL_OFFICIAL',async()=>{reference=await fuel.getReference(origin);assert(reference);assert.equal(reference.source,'FR_GOV_FUEL_INSTANT_V2');
  return reference;});
if(config.TOMTOM_API_KEY&&chosen)await check('REAL_TOMTOM',async()=>{
  const destination=await route.geocode(chosen.formattedAddress);assert.equal(destination.source,'TOMTOM_GEOCODE');
  const input={plannedDate:null,plannedTime:null,timeKind:'DEPARTURE',preference:'FASTEST'};
  outbound=await route.estimateCarRoute({...input,coordinates:[origin,destination]});
  returning=await route.estimateCarRoute({...input,coordinates:[destination,origin]});
  assert(outbound.geometryHash&&returning.geometryHash);assert(outbound.geometry.length&&returning.geometry.length);
  const summary=r=>({distanceKm:r.distanceKm,durationSeconds:r.durationSeconds,liters:r.liters,geometryHash:r.geometryHash,
    method:r.routeMethodRef,timeBasis:r.timeBasis,economicFuel:reference?fuelEconomicCost(r.liters,reference.pricePerLiter):null});
  return {outbound:summary(outbound),return:summary(returning),independentDirections:true};
});else blocked('REAL_TOMTOM');
if(config.HERE_API_KEY&&config.TOMTOM_API_KEY&&outbound)await check('REAL_HERE',async()=>{
  const urban=await toll.estimateTolls(outbound);
  if(process.env.BAR_HERE_TRACE_DIAGNOSTIC==='1'){
    evidence.urbanGeometry=[];
    for(const [direction,r] of [['OUTBOUND',outbound],['RETURN',returning]]){
      const vertices=[];for(const g of r.geometry){const p=decodeTomTomPolyline(g.encodedPolyline,g.precision);if(vertices.length&&p.length&&JSON.stringify(vertices.at(-1))===JSON.stringify(p[0]))p.shift();vertices.push(...p);}
      const rawErrors=[];
      const rawProvider=new HereTollProvider(undefined,{cache:false,onError:e=>rawErrors.push(e),fetcher:async(url,init)=>{
        const u=new URL(url);return bounded(url,u.pathname==='/v8/import'?{...init,body:JSON.stringify({trace:vertices})}:init);
      }});
      const normal=direction==='OUTBOUND'?urban:await toll.estimateTolls(r),raw=await rawProvider.estimateTolls(r);
      evidence.urbanGeometry.push({direction,legs:r.geometry.length,vertices:vertices.length,densified:hereImportTrace(r).length,
        maximumOriginalGapMeters:Math.round(Math.max(0,...vertices.slice(1).map((p,i)=>Math.hypot((p.lat-vertices[i].lat)*111320,(p.lng-vertices[i].lng)*111320*Math.cos(p.lat*Math.PI/180))))),
        normal,raw,rawErrors});
      assert.equal(raw.geometryHash,r.geometryHash);if(raw.status==='UNAVAILABLE')assert.equal(raw.amount,null);
    }
  }
  const motorwayInput={coordinates:[{latitude:43.67048,longitude:4.0129699,source:'USER_DECLARED'},{latitude:45.4761,longitude:4.8337799,source:'USER_DECLARED'}],plannedDate:null,plannedTime:null,timeKind:'DEPARTURE'};
  const motorway=await route.estimateCarRoute({...motorwayInput,preference:'FASTEST'}),paid=await toll.estimateTolls(motorway);
  const reverse=await route.estimateCarRoute({...motorwayInput,coordinates:[...motorwayInput.coordinates].reverse(),preference:'FASTEST'}),reverseToll=await toll.estimateTolls(reverse);
  const alternate=await route.estimateCarRoute({...motorwayInput,preference:'AVOID_TOLLS'}),alternativeToll=await toll.estimateTolls(alternate);
  evidence.hereCanaries={urban,motorway:paid,reverse:reverseToll,avoidTolls:alternativeToll,routes:{motorway:routeSummary(motorway),reverse:routeSummary(reverse),avoid:routeSummary(alternate)}};
  assert.equal(urban.geometryHash,outbound.geometryHash);
  if(urban.status!=='NONE'){assert.equal(urban.status,'UNAVAILABLE');assert.equal(urban.amount,null);assert(hereErrors.some(e=>e.code==='GEOMETRY_MISMATCH'));}
  assert.equal(reverseToll.geometryHash,reverse.geometryHash);assert(['KNOWN','NONE','UNAVAILABLE'].includes(reverseToll.status));
  assert.equal(paid.status,'KNOWN');assert(Number(paid.amount)>0);assert.equal(paid.geometryHash,motorway.geometryHash);
  assert.equal(alternativeToll.provider,'HERE');assert.equal(alternativeToll.geometryHash,alternate.geometryHash);
  return {...evidence.hereCanaries,urbanExactToll:urban.status==='NONE'?'CERTIFIED_NONE':'UNAVAILABLE_GEOMETRY_MISMATCH'};
});else blocked('REAL_HERE');
if(chosen&&outbound&&returning)await check('REAL_BAR_HANDOFF',async()=>{
  const world=fixture(),home={kind:'KNOWN',placeId:world.mobilityFacts.places[0].placeId};
  world.baseline.knowledgeCutoff=new Date().toISOString();world.mobilityFacts.places=[{...world.mobilityFacts.places[0],privatePlace:false,name:'Public departure',coordinates:origin}];
  // No canonical price fallback: only the real official provider may supply a price.
  world.mobilityFacts.vehicle={...world.mobilityFacts.vehicle,fuelPricePerLiter:'0',fuelPriceObservedAt:undefined,fuelPriceSource:undefined};
  const venue={version:'night-out-venue@v1',decisionId:uuid(99101),place:{kind:'TEXT',label:'Public bar selected for synthetic smoke'},google:{provider:'google_places',kind:'BAR_APERO',placeId:chosen.placeId},provenance:'EXPLICIT_USER_DECISION'};
  const makeLeg=reverse=>car({selectionId:reverse?'live-return':'live-outbound',origin:reverse?venue.place:home,destination:reverse?home:venue.place,returnRequired:false,venueEndpoints:{[reverse?'origin':'destination']:venueBinding(venue)}});
  const context={...night(99102,'0',{outbound:selections(makeLeg(false)),return:selections(makeLeg(true))}),fields:{label:'Public smoke',fieldSchemaVersion:'context-fields@v6',venueDecision:venue,placeRef:venue.place}};
  const semantic=state([],[context]),before=structuredClone(semantic),owners={route,fuel,toll,restaurant:google};
  const priced=await preparePlanningMobility(world,semantic,owners),prices=Object.values(priced.journeyPrices);assert.equal(prices.length,2);
  for(const price of prices){assert.equal(price.snapshot?.route.provider,'TOMTOM');assert(price.economicFuel!==null);assert.equal(price.snapshot?.fuelPrice.source,'FR_GOV_FUEL_INSTANT_V2');}
  const stops=[{label:'Public departure',placeId:home.placeId,endpointSource:'DIRECT_PLACE'},{label:venue.place.label,endpointSource:'ROOT_PLACE'}];
  const builder=await estimatePlannedCar({stops,plannedDate:null,plannedTime:null,preference:'FASTEST'},{...world.mobilityFacts,googleDestination:venue.google},owners);
  const outboundPrice=prices.find(p=>p.snapshot?.route.geometryHash===builder.snapshot?.route.geometryHash);assert(outboundPrice);
  assert.deepEqual(stableMobilityEvidence(builder.snapshot),outboundPrice.snapshot);assert.deepEqual(semantic,before);
  const changed={...venue,decisionId:uuid(99103),google:{...venue.google,placeId:venue.google.placeId+'_changed'},place:{kind:'TEXT',label:'Next explicit venue'}};
  const adapted=editNightOut(semantic,barPlaceOperation(context,changed.place,changed,true).edit);
  assert.equal(adapted.contexts[0].slotSelections.outbound.items[0].venueEndpoints.destination.venue.decisionId,changed.decisionId);
  const {mobility}=await import('./fixtures/planner-contexts.mjs');
  const mixedContext={...context,slotSelections:{...context.slotSelections,return:selections(mobility('taxi','taxi',{selectionId:'live-return-taxi',origin:venue.place,destination:home,returnRequired:false,pricing:{fare:{kind:'MANUAL',unitAmount:'17'}},venueEndpoints:{origin:venueBinding(venue)}}))}};
  const mixed=await preparePlanningMobility(world,state([],[mixedContext]),owners),mixedPrices=Object.values(mixed.journeyPrices);
  const taxiPrice=mixedPrices.find(p=>p.fare==='17.00');assert(taxiPrice);assert.equal(taxiPrice.economicFuel,'0.00');assert.equal(taxiPrice.cashTransport,'17.00');assert.equal(taxiPrice.snapshot,null);
  const changedVenue={...venue,decisionId:uuid(99104),google:{...venue.google,placeId:other.placeId},place:{kind:'TEXT',label:'Other explicitly selected public bar'}};
  const changedState=editNightOut(semantic,barPlaceOperation(context,changedVenue.place,changedVenue,true).edit);
  const repriced=await preparePlanningMobility(world,changedState,owners);assert(Object.values(repriced.journeyPrices).every(p=>!prices.some(old=>old.requestDigest===p.requestDigest)));
  const failedOwners={...owners,route:{geocode:async()=>{throw Error('INJECTED_OUTAGE');},estimateCarRoute:async()=>{throw Error('INJECTED_OUTAGE');}}};
  const outage=await preparePlanningMobility(world,semantic,failedOwners);assert(Object.values(outage.journeyPrices).every(p=>p.status==='UNKNOWN'&&p.economicFuel===null));assert.deepEqual(semantic,before);
  await assert.rejects(()=>route.geocode('maison'),e=>e.code==='GEOCODE_AMBIGUOUS');
  evidence.combined={simpleReal:prices.map(p=>({fuel:p.economicFuel,toll:p.toll,status:p.status})),mixedRealOutboundSyntheticTaxi:{fare:taxiPrice.fare,fuel:taxiPrice.economicFuel},changedRealVenue:Object.values(repriced.journeyPrices).map(p=>({digest:p.requestDigest,fuel:p.economicFuel,status:p.status})),injectedOutagePreservesSemantic:true,unresolvedDeicticNoRequest:true};
  return {sharedOwner:'estimatePlannedCar@planned-car-live-v2',directions:prices.map(p=>({fuel:p.economicFuel,cash:p.cashTransport,toll:p.toll,digest:p.requestDigest})),builderParity:true,semanticPreserved:true,changeInvalidatesBindings:true};
});else blocked('REAL_BAR_HANDOFF');
evidence.hereErrors=hereErrors;
evidence.checks.NO_SUPABASE_WRITES={status:'PASS',basis:'No Supabase client; fetch allowlist rejects every non-provider host. Synthetic world is in memory only.'};
const destination=process.env.BAR_LIVE_EVIDENCE_PATH??'outputs/bar-live/providers.json';
// Resolve relative output without placing any secret in the report.
import path from 'node:path';fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(evidence,null,2));
console.log(JSON.stringify({at:evidence.at,sha:evidence.sha,configuration:config,checks:Object.fromEntries(Object.entries(evidence.checks).map(([k,v])=>[k,v.status])),requestCount:evidence.requests.length,evidencePath:destination}));
process.exitCode=Object.values(evidence.checks).every(c=>c.status.startsWith('PASS'))?0:2;
