import assert from 'node:assert/strict';
import {require} from './lib/phase2-ts-loader.mjs';
import {budgetImpactFixture, impactIds} from './fixtures/composer-budget-impact.mjs';
import {uuid, householdId} from './fixtures/planner-headless.mjs';

const React=require('react'), {renderToStaticMarkup}=require('react-dom/server');
const {libraryOccurrences, librarySearchAction, composerLibraryIndex, filterLibraryIntentions}=require('@/domain/phase2/planner/composer-library-index');
const {intentionNavigationEntries, WorkshopNavigationContext, WorkshopNavigation}=require('@/app/mois-a-venir/composer/workshop-navigation');
const {ComposerSaveStatus}=require('@/app/mois-a-venir/composer/composer-save-status');
const {editorOccurrenceId}=require('@/app/mois-a-venir/composer/asset-editor-routing');
const {restoreDraftNavigation}=require('@/app/mois-a-venir/composer/draft-navigation-memory');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {workshopErrorMessage}=require('@/app/mois-a-venir/composer/workshop-error');
const {fresh,buildComponentRow}=require('@/app/mois-a-venir/composer/night-out-components');
const {LinkedIntentions}=require('@/app/mois-a-venir/composer/linked-intentions');
const {BudgetPreviewStatus}=require('@/app/mois-a-venir/composer/intent-budget-impact');

globalThis.fetch=async()=>{throw Error('JOURNEY_UX_REMOTE_FORBIDDEN');};
const fixture=await budgetImpactFixture(), model=fixture.model;
const original=semanticStateDigest(model.semanticState), world=JSON.stringify(fixture.world);
const names=['cinema','restaurant','weekend','amazon','clothing','mascara','groceries'];
const occurrences=libraryOccurrences(model);
for(const name of names){
 const rows=occurrences.filter(row=>row.contextOccurrenceId===impactIds[name]);
 assert.equal(rows.length,1,name+' existing occurrence must be findable');
 const index=composerLibraryIndex(model), query=rows[0].label;
 const found=filterLibraryIntentions(index.occurrences,query);
 assert(found.some(row=>row.contextOccurrenceId===impactIds[name]),name+' search must find existing intention');
 if(found.length===1)assert.deepEqual(librarySearchAction(index.intentions,found,query),{kind:'OPEN',contextOccurrenceId:impactIds[name]});
}
console.log('UX-01 Seven existing intentions can be found without creating another: PASS');

const cinema=model.semanticState.contexts.find(row=>row.contextOccurrenceId===impactIds.cinema);
const sibling={...structuredClone(cinema),contextOccurrenceId:uuid(28001),slotSelections:{}};
const result=await handleComposerRequest(fixture.deps,householdId,{kind:'READ',sequence:1,targetMonth:'2026-11',
 draft:{...model.semanticState,contexts:[...model.semanticState.contexts,sibling]}});
assert(result.ok,result.code);
const entries=intentionNavigationEntries(result.model.board.contexts.filter(row=>row.label===cinema.fields.label));
assert.equal(entries.length,2);assert.notEqual(entries[0].label,entries[1].label);
assert.deepEqual(new Set(entries.map(row=>row.id)),new Set([impactIds.cinema,sibling.contextOccurrenceId]));
const html=renderToStaticMarkup(React.createElement(WorkshopNavigationContext.Provider,{value:{entries,busy:false,open(){throw Error('RENDER_MUTATED');},back(){throw Error('RENDER_MUTATED');}}},
 React.createElement(WorkshopNavigation,{contextId:sibling.contextOccurrenceId})));
assert.match(html,/Changer d’intention/);assert(html.includes('value="'+sibling.contextOccurrenceId+'" selected=""'));
const both=libraryOccurrences(result.model).filter(row=>row.presetKey==='cinema');
assert.deepEqual(librarySearchAction([],both,'Cinéma'),{kind:'FOCUS'});
console.log('UX-02 Homonyms remain distinct and exact selection is rendered without mutation: PASS');

for(const name of names){
 const id=impactIds[name];
 const protectedModel={...model,semanticState:{...model.semanticState,preferences:{...model.semanticState.preferences,anchors:[id]}}};
 assert.equal(libraryOccurrences(protectedModel).find(row=>row.contextOccurrenceId===id)?.action,'VIEW',name+' anchor');
}
assert.deepEqual(libraryOccurrences({...model,board:{...model.board,targetMonth:'2026-10'}}),[]);
console.log('UX-03 Existing occurrence permissions and displayed month remain authoritative: PASS');

for(const key of ['restaurantContextId','stayContextId','familyContextId','nightContextId','giftContextId','catalogContextId']){
 assert.equal(editorOccurrenceId({[key]:cinema.contextOccurrenceId}),cinema.contextOccurrenceId);
}
assert.equal(editorOccurrenceId({equipment:{target:{contextOccurrenceId:impactIds.mascara}}}),impactIds.mascara);
assert.equal(editorOccurrenceId(null),null);

const renderStatus=(status,durable,raw=false,suspended=false)=>renderToStaticMarkup(React.createElement(ComposerSaveStatus,{status,durable,raw,suspended}));
for(const status of ['CLEAN','DIRTY','SAVING','ERROR','CONFLICT','OFFLINE']){
 const statusHtml=renderStatus(status,true);
 assert(!statusHtml.includes('>Sauvegardé<'),status+' cannot claim persistence');
 assert(statusHtml.includes('data-state="'+status+'"'));
}
assert.match(renderStatus('SAVED',true),/>Sauvegardé</);
assert.match(renderStatus('SAVED',false),/Brouillon en mémoire/);
assert.doesNotMatch(renderStatus('SAVED',false),/>Sauvegardé</);
assert.match(renderStatus('SAVED',true,true),/Saisie non validée/);
assert.match(renderStatus('SAVED',true,false,true),/Organisation locale non sauvegardée/);
assert.doesNotMatch(renderStatus('SAVED',true,false,true),/>Sauvegardé</);
console.log('UX-04 Save confirmation, memory, RAW and suspended work stay distinct: PASS');
try{buildComponentRow({...fresh('Billet'),costMode:'MANUAL',amount:'12,'},'activity');assert.fail('Partial amount must be refused');}
catch(error){assert.match(workshopErrorMessage(error),/deux décimales/);assert.match(workshopErrorMessage(error),/saisie est conservée/);}
assert.match(workshopErrorMessage(new Error('La cible a changé. Rouvrez ce poste.')),/La cible a changé/);
assert.doesNotMatch(workshopErrorMessage(new Error('UNEXPECTED_INTERNAL_CODE')),/UNEXPECTED_INTERNAL_CODE/);
console.log('UX-05 Partial amount is still refused with an actionable message: PASS');
const savedNavigation={draftId:uuid(29000),digest:original,contextId:sibling.contextOccurrenceId};
const savedEntry=JSON.stringify(savedNavigation);
const ids=new Set(entries.map(row=>row.id));
assert.equal(restoreDraftNavigation(savedEntry,savedNavigation,ids),sibling.contextOccurrenceId);
assert.equal(restoreDraftNavigation(savedEntry,{...savedNavigation,draftId:uuid(29001)},ids),null);
assert.equal(restoreDraftNavigation(savedEntry,{...savedNavigation,digest:'stale'},ids),null);
assert.equal(restoreDraftNavigation(savedEntry,savedNavigation,new Set([impactIds.cinema])),null);
assert.equal(restoreDraftNavigation('{',savedNavigation,ids),null);
console.log('UX-06 Reload navigation keeps the exact admitted occurrence of the confirmed Draft: PASS');
let composed=model;
const compose=async operation=>{
 const response=await handleComposerRequest(fixture.deps,householdId,{sequence:10,targetMonth:'2026-11',draft:composed.semanticState,...operation});
 assert(response.ok,response.code+': '+response.message);
 composed=response.model;
};
const projectId=uuid(29100);
await compose({kind:'DROP',assetKey:'template:other-context',presetKey:'composed-outing',
 target:{kind:'BOARD_ZONE'},identity:projectId,selectionId:uuid(29101),values:{}});
const target={kind:'CONTEXT_SOCKET',contextOccurrenceId:projectId,slotKey:'children'};
for(const [index,id] of [impactIds.cinema,impactIds.restaurant].entries()){
 const before=composed.semanticState.contexts.find(row=>row.contextOccurrenceId===id);
 const expected=composed.budgetReading.byContext[id].gross;
 await compose({kind:'DROP',assetKey:'context-occurrence:'+id,target,identity:id,selectionId:uuid(29102+index),values:{}});
 const linked=composed.semanticState.contexts.find(row=>row.contextOccurrenceId===id);
 assert.equal(linked.parentContextOccurrenceId,projectId);
 assert.deepEqual(linked.slotSelections,before.slotSelections);
 assert.equal(composed.budgetReading.byContext[id].gross,expected);
}
const linkedMarkup=renderToStaticMarkup(React.createElement(BudgetPreviewStatus.Provider,{value:'FRESH'},
 React.createElement(LinkedIntentions,{model:composed,parentId:projectId,busy:false,open(){assert.fail('render must not open a child');}})));
assert.match(linkedMarkup,/Cinéma/);
assert.match(linkedMarkup,/Restaurant/);
assert.match(linkedMarkup,/total consolidé du projet n’est pas publié/);
const newId=uuid(29104);
await compose({kind:'DROP',assetKey:'template:activity',presetKey:'cinema',target,identity:newId,selectionId:uuid(29105),values:{}});
const newCinema=composed.semanticState.contexts.find(row=>row.contextOccurrenceId===newId);
assert.equal(newCinema.parentContextOccurrenceId,projectId);
assert.deepEqual(newCinema.slotSelections,{});
console.log('UX-07 Composed outing attaches exact occurrences and preserves official child costs: PASS');
assert.equal(semanticStateDigest(model.semanticState),original);
assert.equal(JSON.stringify(fixture.world),world);
assert.deepEqual(fixture.writes,[]);
console.log(JSON.stringify({status:'PASS',checks:7,remoteWrites:0,apply:false,level:'SYNTHETIC_COMPILER_AND_RENDER'}));
