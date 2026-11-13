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
const {availableProjectStarters,evaluateProjectStarter}=require('@/app/mois-a-venir/composer/project-starters');
const {ProjectStarterPreview}=require('@/app/mois-a-venir/composer/project-starter-preview');
const {projectCompletionSuggestions,ProjectCompletion,ProjectCompletionPreference}=require('@/app/mois-a-venir/composer/project-completion');
const {RestaurantEditor}=require('@/app/mois-a-venir/composer/restaurant-editor');
const {isPurchaseBasket}=require('@/domain/phase2/planner/purchase-basket');

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
const badDate=result.model.board.contexts.find(row=>row.contextOccurrenceId===sibling.contextOccurrenceId);
assert.match(intentionNavigationEntries([{...badDate,fields:{...badDate.fields,plannedDate:'2026-11-31'}}])[0].label,/Date à préciser/);
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
 const suggestions=projectCompletionSuggestions(composed,projectId);
 if(index===0){
  assert.equal(suggestions[0]?.preset.presetKey,'restaurant-for-two');
  assert.match(suggestions[0].reason,/contient un cinéma/);
  const blocked={...composed,dropCapabilities:composed.dropCapabilities.filter(drop=>drop.target.contextOccurrenceId!==projectId)};
  assert.deepEqual(projectCompletionSuggestions(blocked,projectId),[]);
  const disabled=renderToStaticMarkup(React.createElement(ProjectCompletionPreference.Provider,
   {value:{enabled:false,toggle(){},dismissed:{},dismiss(){}}},
   React.createElement(ProjectCompletion,{model:composed,parentId:projectId,busy:false,decide(){assert.fail('render must not write');}})));
  assert.match(disabled,/Réactiver les suggestions de projet/);
  assert.doesNotMatch(disabled,/Préparer Restaurant/);
 }else assert.deepEqual(suggestions,[]);
}
const linkedMarkup=renderToStaticMarkup(React.createElement(BudgetPreviewStatus.Provider,{value:'FRESH'},
 React.createElement(LinkedIntentions,{model:composed,parentId:projectId,busy:false,open(){assert.fail('render must not open a child');}})));
assert.match(linkedMarkup,/Cinéma/);
assert.match(linkedMarkup,/Restaurant/);
assert.match(linkedMarkup,/total consolidé du projet n’est pas publié/);
assert.match(linkedMarkup,/En plus du budget/);
const staleLinked=renderToStaticMarkup(React.createElement(BudgetPreviewStatus.Provider,{value:'STALE'},
 React.createElement(LinkedIntentions,{model:composed,parentId:projectId,busy:false})));
assert.doesNotMatch(staleLinked,/En plus du budget/);
assert.match(staleLinked,/Coût à actualiser/);
const parentCard=composed.board.contexts.find(card=>card.contextOccurrenceId===projectId);
const reordered={...composed,board:{...composed.board,contexts:composed.board.contexts.map(card=>card===parentCard
 ? {...card,childContextOccurrenceIds:[impactIds.restaurant,impactIds.cinema,impactIds.restaurant]} : card)}};
const orderedMarkup=renderToStaticMarkup(React.createElement(LinkedIntentions,{model:reordered,parentId:projectId,busy:false}));
assert(orderedMarkup.indexOf('Restaurant')<orderedMarkup.indexOf('Cinéma'));
assert.equal((orderedMarkup.match(/Restaurant à deux/gu)??[]).length,1);
const newId=uuid(29104);
await compose({kind:'DROP',assetKey:'template:activity',presetKey:'cinema',target,identity:newId,selectionId:uuid(29105),values:{}});
const newCinema=composed.semanticState.contexts.find(row=>row.contextOccurrenceId===newId);
assert.equal(newCinema.parentContextOccurrenceId,projectId);
assert.deepEqual(newCinema.slotSelections,{});
console.log('UX-07 Composed outing attaches exact occurrences and preserves official child costs: PASS');
const starters=availableProjectStarters(model);
assert.equal(starters.length,8);
let starterId=29200, starterSequence=20;
const transport=command=>handleComposerRequest(fixture.deps,householdId,command);
for(const starter of starters){
 const added=await evaluateProjectStarter(starter,model,transport,()=>uuid(++starterId),()=>++starterSequence);
 const children=added.model.semanticState.contexts.filter(context=>context.parentContextOccurrenceId===added.parentId);
 assert.equal(children.length,starter.children.length);
 assert(children.every(child=>Object.keys(child.slotSelections).length===0&&!child.fields.plannedDate));
 if(starter.key==='games-basket'){
  const basket=added.model.semanticState.contexts.find(context=>context.contextOccurrenceId===added.parentId);
  assert(isPurchaseBasket(basket));
  assert.equal(basket.fields.budgetDomain,'games-digital');
  assert.deepEqual(basket.slotSelections,{});
  assert.equal(libraryOccurrences(added.model).find(row=>row.contextOccurrenceId===added.parentId)?.action,'EDIT');
 }
 if(starter.key==='visit-and-activity'){
  const visit=added.model.semanticState.contexts.find(context=>context.contextOccurrenceId===added.parentId);
  assert.equal(visit.templateKey,'friend-visit');
  assert.equal(visit.fields.personVisitedRef,undefined);
  assert.equal(visit.slotSelections.transport,undefined);
  assert.deepEqual(projectCompletionSuggestions(added.model,added.parentId),[]);
  assert.equal(libraryOccurrences(added.model).find(row=>row.contextOccurrenceId===added.parentId)?.action,'EDIT');
 }
 assert.equal(semanticStateDigest(model.semanticState),original);
}
const optional=starters.find(starter=>starter.key==='weekend-discovery');
const previewMarkup=renderToStaticMarkup(React.createElement(ProjectStarterPreview,{starter:optional,model,busy:false,
 create(){assert.fail('Preview must not admit');},close(){assert.fail('Preview must not close during render');}}));
assert.match(previewMarkup,/Compléments facultatifs/);
assert.match(previewMarkup,/3 intentions à créer/);
const customized=await evaluateProjectStarter(optional,model,transport,()=>uuid(++starterId),()=>++starterSequence,
 {label:'  Mon week-end  ',children:['hiking-nature'],plannedDate:'2026-11-20'});
const customizedParent=customized.model.semanticState.contexts.find(context=>context.contextOccurrenceId===customized.parentId);
assert.equal(customizedParent.fields.label,'Mon week-end');
assert.equal(customizedParent.fields.plannedDate,'2026-11-20');
const customizedChildren=customized.model.semanticState.contexts.filter(context=>context.parentContextOccurrenceId===customized.parentId);
assert.equal(customizedChildren.length,1);
assert.equal(customizedChildren[0].fields.plannedDate,undefined);
assert.equal(customizedChildren[0].fields.composerPresentation.presetKey,'hiking-nature');
for(const choices of [{label:'',children:[]},{label:'Test',children:['cinema']},{label:'Test',children:['hiking-nature','hiking-nature']}]){
 await assert.rejects(evaluateProjectStarter(optional,model,()=>assert.fail('Invalid proposal must not evaluate'),
  ()=>uuid(++starterId),()=>++starterSequence,choices),/Rouvrez son aperçu/);
}
for(const plannedDate of ['2026-11-31','2026-12-01'])await assert.rejects(evaluateProjectStarter(optional,model,()=>assert.fail('Invalid date must not evaluate'),
 ()=>uuid(++starterId),()=>++starterSequence,{label:'Test',children:[],plannedDate}),/date valide dans le mois/);
let attempted=0;
await assert.rejects(evaluateProjectStarter(starters[0],model,async command=>{
 if(++attempted===2)return {ok:false,sequence:command.sequence,code:'REFUSED',message:'Second step refused'};
 return transport(command);
},()=>uuid(++starterId),()=>++starterSequence),/Second step refused/);
assert.equal(attempted,2);
assert.equal(semanticStateDigest(model.semanticState),original);
await assert.rejects(evaluateProjectStarter(starters[0],model,async command=>{
 const answer=await transport(command);
 return answer.ok ? {...answer,model:{...answer.model,proof:{...answer.model.proof,expectedActiveRevisionNumber:1}}} : answer;
},()=>uuid(++starterId),()=>++starterSequence),/référence du mois a changé/);
console.log('UX-08 Project starters build unpriced intentions and abort cleanly if a step is refused: PASS');
assert.equal(projectCompletionSuggestions(model,impactIds.weekend)[0]?.preset.presetKey,'museum-exhibition');
const protectedProject={...model,semanticState:{...model.semanticState,preferences:{...model.semanticState.preferences,anchors:[impactIds.weekend]}}};
assert.deepEqual(projectCompletionSuggestions(protectedProject,impactIds.weekend),[]);
console.log('UX-09 S3 is contextual, capability-bound, reversible and suppresses adopted complements: PASS');
for(const [index,[presetKey,label]] of [['concert','Billet de concert'],['museum-exhibition','Entrée du musée'],['ropes-course','Entrée ou parcours'],
 ['spa-relax','Soin ou entrée au spa'],['fishing-day','Budget de la journée pêche'],['beach-day','Budget de la journée plage'],['hiking-nature','Budget de la randonnée']].entries()){
 const id=uuid(29300+index*10);
 await compose({kind:'DROP',assetKey:'template:activity',presetKey,target:{kind:'BOARD_ZONE'},identity:id,selectionId:uuid(29301+index*10),values:{}});
 const context=composed.semanticState.contexts.find(row=>row.contextOccurrenceId===id);
 const card=composed.board.contexts.find(row=>row.contextOccurrenceId===id);
 const markup=renderToStaticMarkup(React.createElement(RestaurantEditor,{context,card,model:composed,creating:false,busy:false,
  decide(){assert.fail('render must not adopt an activity');},close(){}}));
 assert(markup.includes(label));
 assert.equal(libraryOccurrences(composed).find(row=>row.contextOccurrenceId===id)?.action,'EDIT');
 assert.deepEqual(context.slotSelections,{});
 const component=buildComponentRow({...fresh(label),costMode:'MANUAL',amount:'12,50'},'activity');
 await compose({kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:id,slots:{main:[component]}}});
 assert.equal(composed.budgetReading.byContext[id].gross,'12.50');
 assert.equal(composed.semanticState.contexts.find(row=>row.contextOccurrenceId===id).slotSelections.main.items[0].selectionId,component.selectionId);
 if(presetKey==='beach-day'){
  const free={...component,cost:{kind:'MANUAL',unitAmount:'0.00'}};
  await compose({kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:id,slots:{main:[free]}}});
  assert.equal(composed.budgetReading.byContext[id].gross,'0.00');
  const unknown={...free,cost:{kind:'UNKNOWN'}};
  await compose({kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:id,slots:{main:[unknown]}}});
  assert.equal(composed.budgetReading.byContext[id].gross,null);
 }
}
console.log('UX-10 Seven activities use admitted slots, exact reopening and explicit zero distinct from unknown: PASS');
assert.equal(semanticStateDigest(model.semanticState),original);
assert.equal(JSON.stringify(fixture.world),world);
assert.deepEqual(fixture.writes,[]);
console.log(JSON.stringify({status:'PASS',checks:10,remoteWrites:0,apply:false,level:'SYNTHETIC_COMPILER_AND_RENDER'}));
