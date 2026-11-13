import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId} from './fixtures/planner-headless.mjs';
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {projectStarters,evaluateProjectStarter}=require('@/app/mois-a-venir/composer/project-starters');
const {projectCompletionSuggestions}=require('@/app/mois-a-venir/composer/project-completion');
const {ProspectiveContextEditor}=require('@/app/mois-a-venir/composer/family-visit-editor');
const {CatalogContextEditor}=require('@/app/mois-a-venir/composer/catalog-context-editor');
const {HOME_PROJECT_PRESET,presetIllustrationPath}=require('@/domain/phase2/planner/composer-presets');
const {IntentBudgetImpact,BudgetPreviewStatus}=require('@/app/mois-a-venir/composer/intent-budget-impact');
const {libraryOccurrences}=require('@/domain/phase2/planner/composer-library-index');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
globalThis.fetch=async()=>{throw Error('PROJECT_FAMILIES_REMOTE_FORBIDDEN');};
const f=await readMonthFixture(),world=JSON.stringify(f.world),original=semanticStateDigest(f.model.semanticState);let id=30200;
const transport=operation=>handleComposerRequest(f.deps,householdId,operation);
for(const [key,lodgingKind] of [['hotel-and-culture','HOTEL'],['relatives-and-nature','RELATIVE']]){
 const starter=projectStarters.find(starter=>starter.key===key);
 const result=await evaluateProjectStarter(starter,f.model,transport,()=>uuid(++id),()=>++id);
 const parent=result.model.semanticState.contexts.find(context=>context.contextOccurrenceId===result.parentId);
 assert.equal(parent.fields.lodgingKind,lodgingKind);
 assert.deepEqual(parent.slotSelections.lodging?.items??[],[]);
 assert.equal(parent.fields.nightCount,undefined);assert.equal(parent.fields.plannedDate,undefined);
 assert.equal(libraryOccurrences(result.model).find(row=>row.contextOccurrenceId===parent.contextOccurrenceId)?.action,'EDIT');
 const children=result.model.semanticState.contexts.filter(context=>context.parentContextOccurrenceId===result.parentId);
 assert.equal(children.length,1);assert.equal(result.model.budgetReading.byContext[children[0].contextOccurrenceId].gross,null);
 const markup=renderToStaticMarkup(React.createElement(BudgetPreviewStatus.Provider,{value:'FRESH'},
  React.createElement(IntentBudgetImpact,{model:result.model,contextId:children[0].contextOccurrenceId})));
 assert(markup.includes(`data-budget-parent="${parent.contextOccurrenceId}"`));
 assert.match(markup,/Les montants ci-dessous concernent cette intention/);
}
console.log('PF-01 Hotel and relatives models preserve unknown lodging, dates and child costs: PASS');
let model=f.model;
const request=async operation=>{
 const response=await transport({sequence:++id,targetMonth:'2026-11',draft:model.semanticState,...operation});
 assert(response.ok,response.code);model=response.model;
};
const parentId=uuid(++id);
await request({kind:'DROP',assetKey:'template:family-visit',presetKey:'fontes-family-visit',target:{kind:'BOARD_ZONE'},identity:parentId,selectionId:uuid(++id),values:{}});
const candidate=projectCompletionSuggestions(model,parentId)[0];assert.equal(candidate.preset.presetKey,'museum-exhibition');
const childId=uuid(++id);
await request({kind:'DROP',assetKey:candidate.assetKey,presetKey:candidate.preset.presetKey,target:candidate.target,identity:childId,selectionId:uuid(++id),values:{}});
assert.deepEqual(projectCompletionSuggestions(model,parentId),[]);
const parent=model.semanticState.contexts.find(context=>context.contextOccurrenceId===parentId),before=semanticStateDigest(model.semanticState);
const markup=renderToStaticMarkup(React.createElement(ProspectiveContextEditor,{context:parent,targetMonth:'2026-11',householdPersons:[],fresh:false,busy:false,model,
 choose(){assert.fail('Render must not choose');},onSave(){assert.fail('Render must not write');},onOpenChild(){assert.fail('Render must not navigate');},onCancel(){}}));
assert.match(markup,/Intentions liées/);assert.match(markup,/Musée/);
assert.equal(semanticStateDigest(model.semanticState),before);
assert.equal(semanticStateDigest(f.model.semanticState),original);assert.equal(JSON.stringify(f.world),world);assert.deepEqual(f.writes,[]);
console.log('PF-02 Family visits expose exact linked activities without assigning a relative, place or price: PASS');
const homeId=uuid(++id),purchaseId=uuid(++id);
assert(existsSync('public'+presetIllustrationPath(HOME_PROJECT_PRESET)));
await request({kind:'DROP',assetKey:'template:home-project',presetKey:HOME_PROJECT_PRESET.presetKey,target:{kind:'BOARD_ZONE'},
 identity:homeId,selectionId:uuid(++id),values:{}});
const home=model.semanticState.contexts.find(context=>context.contextOccurrenceId===homeId);
assert.deepEqual(home.slotSelections,{});
assert.equal(libraryOccurrences(model).find(row=>row.contextOccurrenceId===homeId)?.action,'EDIT');
await request({kind:'DROP',assetKey:'template:purchase',target:{kind:'BOARD_ZONE'},identity:purchaseId,selectionId:uuid(++id),
 values:{label:'Panier pour la pièce'},purchaseBasket:true});
const renderHome=()=>renderToStaticMarkup(React.createElement(CatalogContextEditor,{context:model.semanticState.contexts.find(context=>context.contextOccurrenceId===homeId),
 editor:model.editors.find(editor=>editor.assetKey==='template:home-project'),targetMonth:'2026-11',householdPersons:[],busy:false,model,
 choose(){assert.fail();},onSave(){assert.fail();},onCancel(){},onOpenChild(){assert.fail();}}));
assert.match(renderHome(),/Rattacher Panier pour la pièce/);
assert.match(renderHome(),/Ajouter Acheter pour la maison/);
await request({kind:'DROP',assetKey:'context-occurrence:'+purchaseId,target:{kind:'CONTEXT_SOCKET',contextOccurrenceId:homeId,slotKey:'purchases'},
 identity:purchaseId,selectionId:uuid(++id),values:{}});
assert.match(renderHome(),/Intentions liées/);
assert.match(renderHome(),/Panier pour la pièce/);
assert.equal(model.semanticState.contexts.find(context=>context.contextOccurrenceId===purchaseId).parentContextOccurrenceId,homeId);
assert.equal(model.budgetReading.byContext[purchaseId].gross,null);
assert.equal(JSON.stringify(f.world),world);assert.deepEqual(f.writes,[]);
console.log('PF-03 The home project admits an existing basket without assigning costs: PASS');
console.log(JSON.stringify({status:'PASS',checks:3,remoteWrites:0,apply:false,level:'LOCAL_OWNER_AND_RENDER'}));
