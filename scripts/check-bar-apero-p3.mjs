/** In-process React interaction tests. This is deliberately NOT a browser/auth certificate. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module, {createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {fixture,state,uuid,householdId} from './fixtures/planner-headless.mjs';
const rendererRequire=createRequire(new URL('../outputs/l4c-test-tools/package.json',import.meta.url));
const React=rendererRequire('react'),{create,act}=rendererRequire('react-test-renderer');
const load=Module._load;
Module._load=function(name,...args){if(name==='react')return React;if(name==='react-dom')return {createPortal:node=>node};return load.call(this,name,...args);};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame=callback=>{callback();return 0;};
globalThis.cancelAnimationFrame=()=>{};
globalThis.HTMLElement=class {};
globalThis.document={addEventListener(){},removeEventListener(){},activeElement:null,body:{}};
globalThis.ResizeObserver=class{observe(){} disconnect(){}};
const {InlineEditRegistry,InlineEditContext}=require('@/app/mois-a-venir/composer/inline-edit-registry');
const {WorkshopConfirmationProvider}=require('@/app/mois-a-venir/composer/workshop-confirmation');
const {WorkshopChoicesProvider}=require('@/app/mois-a-venir/composer/workshop-choices');
const {BarLivingEditor}=require('@/app/mois-a-venir/composer/bar-living-editor');
const {barPlaceOperation,barSameModeReturn,barEndpoint}=require('@/app/mois-a-venir/composer/bar-living-operations');
const {stageLocalDecision,visualDraftModel}=require('@/app/mois-a-venir/composer/local-draft');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
globalThis.fetch=async()=>{throw Error('P3_REMOTE_NETWORK_FORBIDDEN');};
const pg=await createKernelPostgres();
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const repository=createPlanApplyRepository(pg.client);
const checks=[];
const check=async(name,run)=>{try{await run();checks.push({name,status:'PASS'});console.log(name+' PASS');}catch(e){checks.push({name,status:'FAIL',message:e.message});console.log(name+' FAIL: '+e.message);}};
const text=node=>typeof node==='string'?node:node?.type==='small'||String(node?.props?.['aria-hidden'])==='true'?'':node?.children?.map(text).join('')??'';
let root,registry,requestRef,pendingOps,model,kind,id,steps,rejectNext=false;
let overrides={};
const controls=predicate=>root.root.findAll(n=>typeof n.type==='string'&&predicate(n));
const button=(label)=>{const all=controls(n=>n.type==='button'&&(text(n).trim()===label.trim()||label==='Date'&&n.props['aria-label']==='Modifier la date'||label==='Lieu'&&n.props['aria-label']==='Modifier le lieu'));assert.ok(all.length,'Missing button '+label);return all[0];};
const click=async label=>{
  const matches=()=>controls(n=>n.type==='button'&&(text(n).trim()===label.trim()||label==='Date'&&n.props['aria-label']==='Modifier la date'||label==='Lieu'&&n.props['aria-label']==='Modifier le lieu'));
  for(let i=0;i<12&&!matches().length;i++){
    const next=controls(n=>n.type==='button'&&n.props['aria-label']==='Pages du dock · suivante'&&!n.props.disabled)[0];
    if(next){await act(async()=>next.props.onClick());steps++;continue;}
    const back=controls(n=>n.type==='button'&&text(n)==='← Ma sortie')[0];
    if(back&&['Montant direct','Autre'].includes(label)){await act(async()=>back.props.onClick());steps++;continue;}const all=controls(n=>n.type==='button'&&text(n)==='Tous les lieux')[0];if(all){await act(async()=>all.props.onClick());continue;}const reveal=controls(n=>n.type==='button'&&['Autres consommations','Autres objets du Before'].includes(text(n)))[0];if(reveal){await act(async()=>reveal.props.onClick());continue;}break;
  }
  await act(async()=>button(label).props.onClick());steps++;
};
const input=label=>{const field=controls(n=>n.type==='label'&&text(n).startsWith(label))[0];assert.ok(field,'Missing field '+label+'; labels='+controls(n=>n.type==='label').map(text).join(' | ')+'; buttons='+controls(n=>n.type==='button').map(text).join(' | '));return field.findByType('input');};
const change=async(label,value)=>{await act(async()=>{const node=input(label);for(let p=node.parent;p;p=p.parent)p.props.onChangeCapture?.({target:{value}});node.props.onChange({target:{value}});});steps++;};
const props=()=>({context:model.semanticState.contexts.find(c=>c.contextOccurrenceId===id),model,card:model.board.contexts.find(c=>c.contextOccurrenceId===id),semanticState:model.semanticState,targetMonth:'2026-11',householdPersons:[],options:model.mobilityOptions,busy:false,fresh:true,dockHost:{},host:{},choose:()=>{},close:()=>{},onCancel:()=>{},onSave:admit,decide:admit,saveStatus:'MEMORY',editor:model.editors.find(e=>e.assetKey==='template:'+model.semanticState.contexts.find(c=>c.contextOccurrenceId===id).templateKey),...overrides});
const admit=operation=>{if(rejectNext){rejectNext=false;return false;}const semantic=stageLocalDecision(model,model.semanticState,operation);if(!semantic)return false;pendingOps.push(operation);model=visualDraftModel(model,semantic);root?.update(render());return true;};
const render=()=>React.createElement(WorkshopConfirmationProvider,{requestRef},React.createElement(WorkshopChoicesProvider,null,React.createElement(InlineEditContext.Provider,{value:registry},React.createElement(kind,props()))));
const sync=async()=>{await act(async()=>root.update(render()));};
const init=async(template,preset,component)=>{if(root)await act(async()=>root.unmount());overrides={};registry=new InlineEditRegistry();requestRef={current:()=>{}};registry.requestConfirmation=(message,accept,save)=>requestRef.current({message,accept,save,acceptLabel:'Abandonner cette saisie'});pendingOps=[];steps=0;id=crypto.randomUUID();kind=component;const r=await handleComposerRequest({repository,readWorld:async()=>fixture(),householdPersons:[]},householdId,{sequence:1,targetMonth:'2026-11',draft:state(),kind:'DROP',assetKey:'template:'+template,presetKey:preset,target:{kind:'BOARD_ZONE'},values:{},identity:id,selectionId:crypto.randomUUID()});assert.equal(r.ok,true,JSON.stringify(r));model=r.model;await act(async()=>{root=create(render(),{createNodeMock:element=>element.type==='dialog'?{open:false,showModal(){this.open=true;},close(){this.open=false;},querySelector(){return{focus(){}};},contains(){return false;}}:null});});};
const current=()=>model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
const save=async()=>{await click('Terminé');await sync();};
const shortInput=label=>input(label);
const tile=label=>controls(n=>n.type==='button'&&n.findAll(c=>c.type==='strong'&&(text(c)===label||text(c).startsWith(label+' ×'))).length)[0];
const openTile=async label=>{if(!tile(label))await click('← Ma sortie');await act(async()=>tile(label).props.onClick());};
const navigateRoute=async dir=>{let nodes=controls(n=>n.props['data-bar-route']===dir||n.props['data-bar-add-route']===dir);if(!nodes.length){await click('← Ma sortie');nodes=controls(n=>n.props['data-bar-route']===dir||n.props['data-bar-add-route']===dir);}assert.ok(nodes.length,'Route '+dir);await act(async()=>nodes[0].props.onClick());};


const {BarLivingCard}=require('@/app/mois-a-venir/composer/bar-living-card');
const {inventoryItems,inventoryLayoutPages}=require('@/app/mois-a-venir/composer/inventory-layout');
const step=()=>controls(n=>n.props['data-bar-living-editor']!==undefined)[0].props['data-bar-step'];
const snapshot=name=>{fs.mkdirSync('outputs/bar-p2/react-structure',{recursive:true});fs.writeFileSync('outputs/bar-p2/react-structure/'+name+'.json',JSON.stringify({proof:'REACT_RENDERED_STRUCTURE_NOT_SCREENSHOT_NOT_BROWSER',tree:root.toJSON()},null,2));};
const dock=()=>controls(n=>n.props['data-question-dock']!==undefined)[0];
const labels=()=>dock().findAll(n=>n.type==='button'&&n.findAll(c=>c.type==='strong').length).map(n=>text(n).trim());
const onRoute=navigateRoute;
const {barPlaces,barPlaceHint,barHomePlaces,barEndpointPlaces}=require('@/app/mois-a-venir/composer/bar-place-knowledge');
const place=(n,name,extra={})=>({placeId:uuid(n),name,commune:'Ville fixture',nature:'Commerce',usage:'Bar',subtype:null,privatePlace:false,relationships:[],...extra});
const knowledge={source:'RECORDED_PERSON_DAYS',fromDate:'2025-10-17',throughDate:'2026-10-17',coverage:'AVAILABLE_RECORDS',placeLimit:500,placesTruncated:false};
const a=place(99101,'Bar jumeau',{visits12Months:3,lastVisitDate:'2026-10-10',address:'Place A fixture'}),b=place(99102,'Bar jumeau',{visits12Months:1,lastVisitDate:'2026-10-11',address:'Place B fixture'}),c=place(99103,'Bar sans historique');
const home=place(99104,'Maison fixture',{nature:'Domicile privé',usage:'Domicile',subtype:'Domicile principal',privatePlace:true});
const person={personId:uuid(1),displayName:'Alice fixture'};
const vehicle={...fixture().mobilityFacts.vehicle};
async function seed(places=[c,b,a,home],unique=true){await init('night-out','bar-apero',BarLivingEditor);model={...model,householdPersons:[person],mobilityOptions:{places,vehicle,vehicleIsUnique:unique,placeKnowledge:knowledge}};await sync();}
try {
await check('P3_01_05_PUBLIC_RANKING_HOMONYMS_AND_HONEST_COVERAGE',async()=>{
 assert.deepEqual(barPlaces([c,b,a,home]).map(p=>p.placeId),[a,b,c].map(p=>p.placeId));assert.equal(barPlaces([home]).length,0);
 assert.deepEqual(barPlaces([b,{...a,visits12Months:1,lastVisitDate:b.lastVisitDate}]).map(p=>p.placeId),[a.placeId,b.placeId]);
 assert.ok(barPlaceHint(a,knowledge).includes('3 jour(s)'));assert.ok(!barPlaceHint(c,knowledge).includes('jamais'));assert.ok(barPlaceHint(a).includes('non établi'));
 await seed();assert.equal(pendingOps.length,0);await click('Lieu');assert.equal(pendingOps.length,0);assert.ok(!labels().some(s=>s.includes('Maison fixture')));assert.ok(controls(n=>n.props['data-bar-knowledge']!==undefined).map(text).join('').includes('couverture non exhaustive'));
 const matches=dock().findAll(n=>n.type==='button'&&n.findAll(c=>c.type==='strong'&&text(c)==='Bar jumeau').length);assert.equal(matches.length,2);await act(async()=>matches[1].props.onClick());assert.equal(current().fields.placeRef.placeId,b.placeId);
});
await check('P3_11_EXPLICIT_HOME_CAR_ATOMIC_NO_PRICE_OR_RETURN',async()=>{
 await seed();await click('Lieu');await act(async()=>dock().findAll(n=>n.type==='button'&&n.findAll(c=>c.type==='strong'&&text(c)==='Bar jumeau').length)[0].props.onClick());const n=pendingOps.length;await onRoute('outbound');assert.equal(pendingOps.length,n);
 const shortcuts=controls(n=>n.type==='button'&&text(n).startsWith('Maison →'));assert.equal(shortcuts.length,1);await act(async()=>shortcuts[0].props.onClick());
 const outbound=current().slotSelections.outbound.items[0];assert.equal(outbound.origin.placeId,home.placeId);assert.equal(outbound.destination.placeId,a.placeId);assert.equal(outbound.route.vehicleRef.vehicleId,vehicle.vehicleId);assert.equal(outbound.route.stops.length,2);assert.equal(outbound.pricing.fare.kind,'UNKNOWN');assert.equal(current().slotSelections.return?.items.length??0,0);assert.equal(pendingOps.length,n+1);
});
await check('P3_12_AMBIGUOUS_HOME_OR_VEHICLE_NO_SHORTCUT',async()=>{
 for(const [places,unique] of [[[a,home,{...home,placeId:uuid(99105)}],true],[[a,home],false]]){await seed(places,unique);await act(async()=>admit(barPlaceOperation(current(),{kind:'KNOWN',placeId:a.placeId})));await onRoute('outbound');assert.equal(controls(n=>n.type==='button'&&text(n).startsWith('Maison →')).length,0);assert.equal(current().slotSelections.outbound?.items.length??0,0);}
});
await check('P3_13_14_CURRENT_WORK_IDENTITY_NOT_MEAL_OR_NAME',async()=>{
 const work=place(99106,'Travail fixture',{privatePlace:true,currentRelationships:[{personId:person.personId,role:'PRIMARY_WORK'}]});
 const meal=place(99107,'Repas fixture',{privatePlace:true,currentRelationships:[{personId:person.personId,role:'WORK_MEAL_ANCHOR'}]});
 const other=place(99108,'Autre travail',{privatePlace:true,currentRelationships:[{personId:uuid(2),role:'PRIMARY_WORK'}],relationships:[{personName:person.displayName,role:'PRIMARY_WORK'}]});
 assert.deepEqual(barEndpointPlaces([work,meal,other],[person]).map(p=>p.place.placeId),[work.placeId]);assert.ok(barEndpointPlaces([work],[person])[0].hint.includes(person.displayName));assert.deepEqual(barHomePlaces([{...meal,relationships:[{personName:'Alice',role:'PRIMARY_HOME'}]}]),[]);
 await seed([a,home,work,meal,other]);await onRoute('outbound');await click('Taxi / Uber');await click('Départ · À préciser');assert.ok(labels().some(l=>l.includes('Travail fixture')));assert.ok(!labels().some(l=>l.includes('Repas fixture')));await click('Travail fixture');assert.equal(current().slotSelections.outbound.items[0].origin.placeId,work.placeId);assert.deepEqual(current().fields.participantRefs??[],[]);
});
await check('P3_15_17_DIRECTED_RETURN_AND_PLACE_ONLY_MUTATION',async()=>{
 await seed();await act(async()=>admit(barPlaceOperation(current(),{kind:'KNOWN',placeId:a.placeId})));await onRoute('outbound');await click('Taxi / Uber');await click('Départ · À préciser');await click('Maison fixture');await onRoute('return');await click('Reprendre le trajet inverse');const before=structuredClone(current());const back=before.slotSelections.return.items[0];assert.notEqual(back.selectionId,before.slotSelections.outbound.items[0].selectionId);assert.equal(back.origin.placeId,a.placeId);assert.equal(back.destination.placeId,home.placeId);assert.equal(back.pricing.fare.kind,'UNKNOWN');
 await act(async()=>admit(barPlaceOperation(current(),{kind:'KNOWN',placeId:b.placeId})));assert.deepEqual(current().slotSelections,before.slotSelections);assert.equal(current().fields.placeRef.placeId,b.placeId);
});
await check('P3_19_RAW_BEFORE_PLACE_CANCEL_AND_SAVE',async()=>{
 await seed();await click('Bière');await change('Prix unitaire (€)','8');await click('Lieu');assert.equal(step(),'row');await click('Continuer à modifier');assert.equal(input('Prix unitaire (€)').props.value,'8');await click('Lieu');await act(async()=>controls(n=>n.props['data-save-workshop']!==undefined)[0].props.onClick());assert.equal(step(),'place');assert.equal(current().slotSelections.extras.items[0].cost.unitAmount,'8');
 const before=structuredClone(current());await click('Bar sans historique');assert.deepEqual(current().slotSelections,before.slotSelections);assert.equal(current().fields.placeRef.placeId,c.placeId);
});
await check('P3_18_22_TEXT_FALLBACK_NO_COORDINATE_AND_LATER',async()=>{
 await seed();await click('Lieu');await click('Nom libre');await change('Nom ou adresse libre','Bar libre fixture');await click('Retenir ce repère');assert.deepEqual(current().fields.placeRef,{kind:'TEXT',label:'Bar libre fixture',provenance:'USER_DECLARED_PROSPECTIVE'});await onRoute('outbound');await click('Taxi / Uber');assert.equal(current().slotSelections.outbound.items[0].destination.kind,'TEXT');assert.equal(current().slotSelections.outbound.items[0].pricing.fare.kind,'UNKNOWN');
});
await check('P3_ENDPOINT_RAW_FREE_POINT_GUARD_AND_REJECTION',async()=>{
 await seed();await onRoute('outbound');await click('Taxi / Uber');await click('Départ · À préciser');await change('Autre point du trajet','Départ saisi fixture');await click('Maison fixture');await click('Continuer à modifier');assert.equal(input('Autre point du trajet').props.value,'Départ saisi fixture');assert.equal(current().slotSelections.outbound.items[0].origin,null);
 rejectNext=true;await click('Retenir ce point libre');assert.equal(input('Autre point du trajet').props.value,'Départ saisi fixture');assert.equal(registry.count(),1);await click('Retenir ce point libre');assert.equal(current().slotSelections.outbound.items[0].origin.kind,'TEXT');assert.equal(current().slotSelections.outbound.items[0].origin.label,'Départ saisi fixture');assert.equal(registry.count(),0);
});
await check('P3_20_OWNER_SCOPE_ROLE_DATES_PERSON_FILTER_AND_COMPLETE_PAGINATION',async()=>{
 const {readPlannedContextOptions}=require('@/server/phase2/planned-context');const calls=[];const today=new Date().toISOString().slice(0,10);
 let scope={household_count:1,household_id:householdId,status:'READY'};
 const rows={referentiel_lieu:[{place_id:a.placeId,nom_canonique:a.name,commune:a.commune,nature_lieu:'Commerce',usage_principal:'Bar',private_place:false}],
 person_place_roles:[{person_id:person.personId,place_id:a.placeId,role:'PRIMARY_WORK',valid_from:today,valid_to:null},{person_id:person.personId,place_id:a.placeId,role:'WORK_MEAL_ANCHOR',valid_from:'2020-01-01',valid_to:today},{person_id:uuid(2),place_id:a.placeId,role:'PRIMARY_WORK',valid_from:'2020-01-01',valid_to:null},{person_id:person.personId,place_id:a.placeId,role:'PRIMARY_WORK',valid_from:'2099-01-01',valid_to:null}]};
 const client={from(table){const filters=[],q={};for(const name of ['select','eq','in','gte','lte','gt','order','limit','range'])q[name]=(...args)=>{filters.push([name,...args]);return q;};q.then=(resolve,reject)=>{calls.push({table,filters});let data=table==='canonical_household_scope_control'?[scope]:table==='location_occurrences'?Array.from({length:filters.find(f=>f[0]==='range')[1]===0?1000:1},(_,i)=>({place_id:a.placeId,person_days:{date:'2026-01-'+String((i%3)+1).padStart(2,'0')}})):rows[table]??[];return Promise.resolve({data,error:null}).then(resolve,reject);};return q;}};
 const result=await readPlannedContextOptions(client,householdId,[person],true);assert.deepEqual(result.places[0].currentRelationships,[{personId:person.personId,role:'PRIMARY_WORK'}]);assert.equal(result.places[0].visits12Months,3);assert.equal(result.placeKnowledge.coverage,'AVAILABLE_RECORDS');assert.equal(result.vehicleIsUnique,false);assert.equal(calls.filter(c=>c.table==='location_occurrences').length,2);assert.ok(calls.find(c=>c.table==='location_occurrences').filters.some(f=>f[0]==='in'&&f[1]==='person_id'&&f[2][0]===person.personId));
 scope={...scope,household_id:uuid(999)};const n=calls.length;await assert.rejects(()=>readPlannedContextOptions(client,householdId,[person],true));assert.equal(calls.length,n+1);scope={household_count:2,household_id:null,status:'AMBIGUOUS'};await assert.rejects(()=>readPlannedContextOptions(client,householdId,[person],true));
});
await check('P3_DTO_KNOWLEDGE_ADMITTED_NO_PRIVATE_ADDRESS_COORDINATES_OR_FAKE_GOOGLE',async()=>{
 const places=[a,{...home,address:'Adresse privée fixture',coordinates:{latitude:43,longitude:3,source:'CANONICAL'},googlePlaceId:'not_a_published_owner'}];const r=await handleComposerRequest({repository,readWorld:async()=>fixture(),readMobilityOptions:async()=>({places,vehicle,vehicleIsUnique:true,placeKnowledge:knowledge})},householdId,{kind:'READ',sequence:401,targetMonth:'2026-11',draft:model.semanticState});assert.equal(r.ok,true,r.code);assert.equal(r.model.mobilityOptions.placeKnowledge.source,'RECORDED_PERSON_DAYS');const privatePlace=r.model.mobilityOptions.places.find(p=>p.placeId===home.placeId);assert.equal(privatePlace.address,undefined);assert.equal(privatePlace.coordinates,undefined);assert.equal(privatePlace.googlePlaceId,undefined);assert.equal(r.model.mobilityOptions.places[0].visits12Months,3);
});
await check('P3_PREVIEW_APPLY_RELOAD_KNOWN_IDS_PARTIAL_EDIT_AND_NO_OWNER_WRITES',async()=>{
 await seed();await act(async()=>admit(barPlaceOperation(current(),{kind:'KNOWN',placeId:b.placeId})));await onRoute('outbound');await click('Taxi / Uber');await click('Départ · À préciser');await click('Maison fixture');await click('Préciser le prix du trajet');await change('Coût prévu du billet ou de la course (€)','12');await click('Retenir le coût du trajet');const expected=structuredClone(model.semanticState);
 const world=fixture();world.mobilityFacts.places.push(a,b,c,home);const before=JSON.stringify(world);const {providers}=await import('./fixtures/planner-mobility.mjs');const provider=providers();const {preparePlanningMobility}=require('@/server/phase2/planner/prospective-mobility-pricing');
 const deps={repository,readWorld:async()=>world,prepareWorld:(w,s)=>preparePlanningMobility(w,s,provider.value),readMobilityOptions:async()=>({places:[a,b,c,home],vehicle,placeKnowledge:knowledge}),validateContextReferences:async(h,refs)=>{assert.equal(h,householdId);assert.ok(refs.placeIds.every(id=>[a,b,c,home].some(p=>p.placeId===id)));}};
 let r=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:501,targetMonth:'2026-11',draft:JSON.parse(JSON.stringify(expected))});assert.equal(r.ok,true,r.code);assert.equal(r.model.mobilitySummaries.length,1);assert.equal(r.model.mobilitySummaries[0].cashTransport,'12.00');const calls=pg.rpcCalls;
 r=await handleComposerRequest(deps,householdId,{kind:'APPLY',sequence:502,targetMonth:'2026-11',draft:expected,command:{...r.model.proof,applyRequestId:crypto.randomUUID()}});assert.equal(r.ok,true,r.code+': '+r.message);assert.equal(pg.rpcCalls,calls+1);
 r=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:503,targetMonth:'2026-11'});assert.equal(r.ok,true,r.code);assert.deepEqual(r.model.semanticState,expected);const saved=await repository.readActivePlan(householdId,'2026-11');assert.equal(saved.activeRevision.semanticState.contexts.find(c=>c.contextOccurrenceId===id).fields.placeRef.placeId,b.placeId);assert.equal(JSON.stringify(world),before);await pg.verifyCanaries();
});
await check('P3_06_10_GOOGLE_EXACT_AMBIGUOUS_RETRY_TEXT_STALE_NO_AUTO_CHOICE',async()=>{
 if(root)await act(async()=>root.unmount());const {BarPlaceSearch}=require('@/app/mois-a-venir/composer/bar-place-search');const previous=globalThis.fetch,calls=[],pending=[],adopted=[];
 globalThis.fetch=async(path,options)=>{calls.push({path,body:JSON.parse(options.body)});return await new Promise(resolve=>pending.push({resolve,signal:options.signal}));};
 const mount=places=>React.createElement(BarPlaceSearch,{places,onKnown:id=>adopted.push({kind:'KNOWN',id}),onText:label=>adopted.push({kind:'TEXT',label}),initialCity:'Ville fixture'});
 const wait=()=>act(async()=>new Promise(r=>setTimeout(r,330)));const answer=async(index,payload,ok=true,status=200)=>act(async()=>(()=>{assert.ok(pending[index],"Missing provider request "+index+"; calls="+JSON.stringify(calls));return pending[index];})().resolve({ok,status,json:async()=>{if(payload instanceof Error)throw payload;return payload;}}));
 const suggestion=(id='google_exact_123')=>({source:'google_places',placeId:id,primaryText:'Bar Google fixture',secondaryText:'Ville fixture'});const detail=(id='google_exact_123')=>({place:{provider:'google_places',placeId:id,displayName:'Bar Google fixture',formattedAddress:'Adresse publique fixture',lat:43,lng:3,types:['bar']}});
 try{
  await act(async()=>{root=create(mount([{...a,googlePlaceId:'google_exact_123'},{...b,googlePlaceId:'google_exact_123'}]));});await wait();assert.equal(calls.length,0);
  await change('Chercher un bar','Alpha');await wait();await answer(0,{},false,429);await click('Réessayer la recherche');await wait();await answer(1,{suggestions:[null,suggestion()]});await click('Bar Google fixture · Ville fixture');await answer(2,detail('different_google_123'));assert.equal(adopted.length,0);await click('Réessayer ce lieu');await answer(3,detail());assert.equal(controls(n=>n.type==='button'&&text(n)==='Retenir ce lieu enregistré').length,0);
  const picks=controls(n=>n.type==='button'&&text(n).startsWith('Retenir Bar jumeau'));assert.equal(picks.length,2);await act(async()=>picks[1].props.onClick());assert.deepEqual(adopted,[{kind:'KNOWN',id:b.placeId}]);
  await click('Reprendre cette recherche'); await change('Chercher un bar','Beta');await wait();await answer(4,new SyntaxError('invalid json'));assert.ok(controls(n=>n.props.role==='status'&&text(n).includes('indisponible')).length);await click('Réessayer la recherche');await wait();await answer(5,{suggestions:[suggestion('new_google_123')]});await click('Bar Google fixture · Ville fixture');await answer(6,detail('new_google_123'));await click('Retenir comme nom libre');assert.deepEqual(adopted[1],{kind:'TEXT',label:'Bar Google fixture'});
  await click('Reprendre cette recherche'); await change('Chercher un bar','Old');await wait();await change('Chercher un bar','Current');assert.equal(pending[7].signal.aborted,true);await wait();await answer(8,{suggestions:[]});await answer(7,{suggestions:[suggestion()]});assert.equal(controls(n=>n.type==='button'&&text(n).startsWith('Bar Google fixture')).length,0);
  await change('Chercher un bar','Late');await wait();await answer(9,{suggestions:[suggestion()]});await click('Bar Google fixture · Ville fixture');await change('Chercher un bar','New');await wait();await answer(11,{suggestions:[]});await answer(10,detail());assert.equal(controls(n=>n.type==='button'&&text(n)==='Retenir ce lieu enregistré').length,0);assert.equal(adopted.length,2);
  await act(async()=>root.unmount());root=null;
  await act(async()=>{root=create(mount([{...a,googlePlaceId:'google_exact_123'},{...home,googlePlaceId:'google_exact_123'}]));});await change('Chercher un bar','Unique');await wait();await answer(12,{suggestions:[suggestion()]});await click('Bar Google fixture · Ville fixture');await answer(13,detail());await click('Retenir ce lieu enregistré');assert.deepEqual(adopted[2],{kind:'KNOWN',id:a.placeId});
  await click('Reprendre cette recherche'); await change('Chercher un bar','Unmount');await wait();await act(async()=>root.unmount());root=null;await answer(14,{suggestions:[suggestion()]});assert.equal(adopted.length,3);
 }finally{globalThis.fetch=previous;}
});
await check('P3_GOOGLE_FICHE_RESUMES_TRANSIENTLY_WITHOUT_ADOPTION_OR_STALE_RESPONSE',async()=>{
 if(root)await act(async()=>root.unmount());root=null;
 const {BarPlaceSearch}=require('@/app/mois-a-venir/composer/bar-place-search');const previous=globalThis.fetch,calls=[];let remembered,selected=0;
 globalThis.fetch=async()=>{calls.push('provider');return {ok:true,json:async()=>({suggestions:[]})};};
 const recent={query:'Bar mémoire',city:'Ville fixture',resultPage:1,detail:{provider:'google_places',placeId:'google_exact_123',displayName:'Bar mémoire',formattedAddress:'Adresse publique fixture',lat:43,lng:3,types:['bar']},detailReadAt:Date.now()};
 const mount=initialSearch=>React.createElement(BarPlaceSearch,{places:[],onKnown:()=>selected++,onText:()=>selected++,initialSearch,onSearchChange:value=>{remembered=value;}});
 try{
  await act(async()=>{root=create(mount(recent));});await act(async()=>new Promise(r=>setTimeout(r,330)));
  assert.equal(calls.length,0);assert.equal(selected,0);assert.equal(controls(n=>n.props['data-bar-place-detail']!==undefined).length,1);assert.equal(remembered.detail.placeId,recent.detail.placeId);
  await act(async()=>root.unmount());root=null;await act(async()=>{root=create(mount(remembered));});assert.equal(controls(n=>n.props['data-bar-place-detail']!==undefined).length,1);assert.equal(selected,0);
  await click('Reprendre cette recherche');await act(async()=>new Promise(r=>setTimeout(r,330)));assert.equal(calls.length,1);assert.equal(remembered.detail,undefined);
  await act(async()=>root.unmount());root=null;await act(async()=>{root=create(mount({...recent,detailReadAt:Date.now()-300_001}));});assert.equal(controls(n=>n.props['data-bar-place-detail']!==undefined).length,0);await act(async()=>new Promise(r=>setTimeout(r,330)));assert.equal(calls.length,2);assert.equal(selected,0);
 }finally{if(root)await act(async()=>root.unmount());root=null;globalThis.fetch=previous;}
});
fs.mkdirSync('outputs/bar-p3',{recursive:true});fs.writeFileSync('outputs/bar-p3/p3-results.json',JSON.stringify({method:'SYNTHETIC_REACT_OWNER_CLIENT_NOT_AUTHENTICATED_NOT_BROWSER',checks},null,2));if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
}finally{if(root)await act(async()=>root.unmount());await pg.close();}
