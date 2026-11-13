import assert from 'node:assert/strict';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId,component} from './fixtures/planner-headless.mjs';
const testRequire=createRequire(path.resolve(process.env.PLANNER_REACT_TEST_TOOLS||'outputs/p21-react-tools','package.json'));
const React=testRequire('react'),jsx=testRequire('react/jsx-runtime'),{create,act}=testRequire('react-test-renderer');
const originalLoad=Module._load;let confirmation;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.fetch=async()=>{throw Error('PROJECT_COMPLETION_REMOTE_FORBIDDEN');};
Module._load=function(name,parent,...args){
 if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;
 if(name==='./workshop-confirmation')return {useWorkshopConfirmation:()=>next=>{confirmation=next;}};
 return originalLoad.call(this,name,parent,...args);
};
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {projectCompletionSuggestions,ProjectCompletion,ProjectCompletionPreference}=require('@/app/mois-a-venir/composer/project-completion');
const {CatalogContextEditor}=require('@/app/mois-a-venir/composer/catalog-context-editor');
const {CatalogOpenButton}=require('@/app/mois-a-venir/composer/catalog-discovery-provider');
const {ShortStayEditor}=require('@/app/mois-a-venir/composer/short-stay-editor');
const {ProspectiveContextEditor}=require('@/app/mois-a-venir/composer/family-visit-editor');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const f=await readMonthFixture(),world=JSON.stringify(f.world),parentId=uuid(29900);let counter=29900;
const request=async(draft,operation)=>{
 const response=await handleComposerRequest(f.deps,householdId,{sequence:++counter,targetMonth:'2026-11',draft,...operation});
 assert(response.ok,response.code+': '+response.message);return response.model;
};
const {composerPreset}=require('@/domain/phase2/planner/composer-presets');
const add=async(model,key,parent=null,slot='children')=>request(model.semanticState,{kind:'DROP',assetKey:`template:${composerPreset(key).templateKey}`,
 presetKey:key,target:parent?{kind:'CONTEXT_SOCKET',contextOccurrenceId:parent,slotKey:slot}:{kind:'BOARD_ZONE'},identity:uuid(++counter),selectionId:uuid(++counter),values:{}});
let model=await request(f.semantic,{kind:'DROP',assetKey:'template:other-context',presetKey:'composed-outing',target:{kind:'BOARD_ZONE'},identity:parentId,selectionId:uuid(++counter),values:{}});
const start=semanticStateDigest(model.semanticState);
assert.deepEqual(projectCompletionSuggestions(model,parentId).map(candidate=>candidate.category),['ACTIVITIES','MEALS']);
assert.deepEqual(projectCompletionSuggestions(model,parentId,'MEALS').map(candidate=>candidate.category),['MEALS','ACTIVITIES']);
const protectedModel={...model,semanticState:{...model.semanticState,preferences:{...model.semanticState.preferences,anchors:[parentId]}}};
assert.deepEqual(projectCompletionSuggestions(protectedModel,parentId),[]);
assert.deepEqual(projectCompletionSuggestions({...model,dropCapabilities:[]},parentId),[]);
let root,setModel,accepted=[],summaryFocus=0,rejectNext=false;
function Harness(){
 const [shown,update]=React.useState(model);setModel=update;
 const [enabled,toggle]=React.useState(true),[priority,prioritize]=React.useState('BALANCED'),[dismissed,setDismissed]=React.useState({});
 return React.createElement(ProjectCompletionPreference.Provider,{value:{enabled,toggle:()=>toggle(value=>!value),priority,prioritize,dismissed,
  dismiss:(id,key)=>setDismissed(previous=>({...previous,[id]:key===null?[]:[...(previous[id]??[]),key]}))}},
  React.createElement(ProjectCompletion,{model:shown,parentId,busy:false,decide(operation){
   if(rejectNext){rejectNext=false;return false;}accepted.push(operation);return true;}}));
}
const text=node=>typeof node==='string'?node:(node.children??[]).map(text).join('');
const buttons=()=>root.root.findAllByType('button');
const click=async label=>{const button=buttons().find(node=>text(node)===label);assert(button,label);await act(async()=>button.props.onClick());};
try{
 await act(async()=>{root=create(React.createElement(Harness),{createNodeMock:element=>element.type==='summary'?{focus(){summaryFocus++;}}:null});});
 await act(async()=>root.root.findByType('select').props.onChange({target:{value:'MEALS'}}));
 assert.equal(text(buttons().find(node=>text(node).startsWith('Préparer '))),'Préparer Restaurant à deux');
 await click('Masquer Restaurant à deux');assert(!buttons().some(node=>text(node)==='Préparer Restaurant à deux'));
 await click('Désactiver pour cette session');assert(!buttons().some(node=>text(node).startsWith('Préparer ')));
 await click('Réactiver les suggestions de projet');await click('Réafficher les suggestions masquées');
 assert.equal(summaryFocus,2);
 assert.equal(accepted.length,0);assert.equal(semanticStateDigest(model.semanticState),start);
 console.log('S3-01 Deterministic priority, permission filtering and reversible session controls without mutation: PASS');
 await click('Préparer Restaurant à deux');assert(confirmation);assert.equal(accepted.length,0);
 model=await add(model,'restaurant-for-two',parentId);
 await act(async()=>setModel(model));await act(async()=>confirmation.accept());assert.equal(accepted.length,0);
 assert(root.root.findAllByProps({role:'alert'}).some(node=>text(node).includes('Le projet a changé')));
 console.log('S3-02 A previously adopted complement invalidates an open confirmation: PASS');
 rejectNext=true;
 await click('Préparer Cinéma');await act(async()=>confirmation.accept());assert.equal(accepted.length,0);
 assert(root.root.findAllByProps({role:'alert'}).some(node=>text(node).includes('n’a pas été ajoutée')));
 await click('Préparer Cinéma');await act(async()=>confirmation.accept());assert.equal(accepted.length,1);
 assert.equal(root.root.findAllByProps({role:'alert'}).length,0);
 assert.equal(accepted[0].target.contextOccurrenceId,parentId);
 model=await request(model.semanticState,accepted[0]);
 assert.deepEqual(projectCompletionSuggestions(model,parentId),[]);
 console.log('S3-03 Explicit adoption uses the existing owner and suppresses the realized suggestion: PASS');
 const weekend=await add(model,'weekend-gite');
 const stayId=weekend.semanticState.contexts.find(context=>context.templateKey==='short-stay').contextOccurrenceId;
 assert.equal(projectCompletionSuggestions(weekend,stayId).length,2);
 const culture=await add(weekend,'museum-exhibition',stayId,'activities');
 assert.deepEqual(projectCompletionSuggestions(culture,stayId).map(candidate=>candidate.preset.presetKey),['hiking-nature','restaurant-for-two']);
 const complete=await add(culture,'hiking-nature',stayId,'activities');
 const stayMeal=projectCompletionSuggestions(complete,stayId);
 assert.deepEqual(stayMeal.map(candidate=>[candidate.preset.presetKey,candidate.target.slotKey]),[['restaurant-for-two','restaurants']]);
 const noMealDrop={...complete,dropCapabilities:complete.dropCapabilities.filter(drop=>drop.target.slotKey!=='restaurants')};
 assert.deepEqual(projectCompletionSuggestions(noMealDrop,stayId),[]);
 const stayedWithMeal=await add(complete,'restaurant-for-two',stayId,'restaurants');
 assert.deepEqual(projectCompletionSuggestions(stayedWithMeal,stayId),[]);
 const directMeal={...complete,board:{...complete.board,contexts:complete.board.contexts.map(card=>card.contextOccurrenceId===stayId
  ? {...card,sockets:card.sockets.map(socket=>socket.slotKey==='restaurants'?{...socket,currentItems:[{kind:'COMPONENT'}]}:socket)}:card)}};
 assert.deepEqual(projectCompletionSuggestions(directMeal,stayId),[]);
 const rental=await request(stayedWithMeal.semanticState,{kind:'EDIT_SHORT_STAY',edit:{contextOccurrenceId:stayId,fields:{lodgingKind:'RENTAL'}}});
 const grocerySuggestion=projectCompletionSuggestions(rental,stayId).find(candidate=>candidate.preset.presetKey==='groceries-purchase');
 assert(grocerySuggestion);assert.equal(grocerySuggestion.target.slotKey,'purchases');
 assert.match(grocerySuggestion.reason,/choisi une location/);
 const withBasket=await add(rental,'groceries-purchase',stayId,'purchases');
 const basket=withBasket.semanticState.contexts.find(context=>context.fields.composerPresentation?.presetKey==='groceries-purchase');
 assert.equal(basket.fields.budgetDomain,'groceries');assert.deepEqual(basket.slotSelections,{});
 assert.equal(basket.fields.basketCoverage,undefined);
 assert.deepEqual(projectCompletionSuggestions(withBasket,stayId),[]);
 const directGroceries={...rental,board:{...rental.board,contexts:rental.board.contexts.map(card=>card.contextOccurrenceId===stayId
  ? {...card,sockets:card.sockets.map(socket=>socket.slotKey==='groceries'?{...socket,currentItems:[{kind:'COMPONENT'}]}:socket)}:card)}};
 assert.deepEqual(projectCompletionSuggestions(directGroceries,stayId),[]);
 const outing=await add(complete,'composed-outing');
 const leisureId=outing.semanticState.contexts.filter(context=>context.templateKey==='other-context').at(-1).contextOccurrenceId;
 const bowling=await add(outing,'bowling',leisureId);
 const leisure=await add(bowling,'escape-game',leisureId);
 const leisureDigest=semanticStateDigest(leisure.semanticState);
 const offers=projectCompletionSuggestions(leisure,leisureId);
 assert.deepEqual(offers.map(offer=>offer.preset.presetKey),['restaurant-for-two']);
 assert.match(offers[0].reason,/Bowling|Escape game/);
 assert.equal(semanticStateDigest(leisure.semanticState),leisureDigest);
 const takeaway=await add(leisure,'chicken-snack',leisureId);
 assert.deepEqual(projectCompletionSuggestions(takeaway,leisureId),[]);
 const dining=await add(leisure,'restaurant-for-two',leisureId);
 assert.deepEqual(projectCompletionSuggestions(dining,leisureId),[]);
 const freeActivity=await request(outing.semanticState,{kind:'DROP',assetKey:'template:activity',
  target:{kind:'CONTEXT_SOCKET',contextOccurrenceId:leisureId,slotKey:'children'},
  identity:uuid(++counter),selectionId:uuid(++counter),values:{label:'Découverte libre'}});
 const freeOffers=projectCompletionSuggestions(freeActivity,leisureId);
 assert.deepEqual(freeOffers.map(offer=>offer.preset.presetKey),['restaurant-for-two']);
 assert.match(freeOffers[0].reason,/Découverte libre/);
 const snackOnly=await add(outing,'chicken-snack',leisureId);
 assert.deepEqual(projectCompletionSuggestions(snackOnly,leisureId).map(offer=>offer.preset.presetKey),['cinema']);
 assert.deepEqual(projectCompletionSuggestions({...freeActivity,dropCapabilities:freeActivity.dropCapabilities.filter(
  drop=>drop.sourceAssetKey!=='template:restaurant')},leisureId),[]);
 const furnishing=await add(dining,'furnish-room');
 const furnishingId=furnishing.semanticState.contexts.find(context=>context.templateKey==='home-project').contextOccurrenceId;
 const furnishingOffer=projectCompletionSuggestions(furnishing,furnishingId)[0];
 assert.equal(furnishingOffer.preset.presetKey,'home-equipment-basket');assert.equal(furnishingOffer.target.slotKey,'purchases');
 const withEquipment=await request(furnishing.semanticState,{kind:'DROP',assetKey:furnishingOffer.assetKey,presetKey:furnishingOffer.preset.presetKey,
  target:furnishingOffer.target,identity:uuid(++counter),selectionId:uuid(++counter),values:{},purchaseBasket:true});
 assert.deepEqual(projectCompletionSuggestions(withEquipment,furnishingId),[]);
 const directEquipment={...furnishing,board:{...furnishing.board,contexts:furnishing.board.contexts.map(card=>card.contextOccurrenceId===furnishingId
  ? {...card,sockets:card.sockets.map(socket=>socket.slotKey==='items'?{...socket,currentItems:[{kind:'COMPONENT'}]}:socket)}:card)}};
 assert.deepEqual(projectCompletionSuggestions(directEquipment,furnishingId),[]);
 for(const [template,expected] of [['home-project',['home-equipment-basket']],['friend-visit',['museum-exhibition']],
  ['short-stay',['museum-exhibition','hiking-nature']]]){
  const genericId=uuid(++counter);
  const generic=await request(f.semantic,{kind:'DROP',assetKey:'template:'+template,target:{kind:'BOARD_ZONE'},
   identity:genericId,selectionId:uuid(++counter),values:{label:'Projet personnalisé'}});
  const before=semanticStateDigest(generic.semanticState);
  const suggestions=projectCompletionSuggestions(generic,genericId);
  assert.deepEqual(suggestions.map(candidate=>candidate.preset.presetKey),expected);
  assert(!suggestions.some(candidate=>candidate.reason.includes('cette pièce')));
  assert.equal(semanticStateDigest(generic.semanticState),before);
  assert.deepEqual(projectCompletionSuggestions({...generic,dropCapabilities:[]},genericId),[]);
  const future=structuredClone(generic);
  future.board.contexts.find(card=>card.contextOccurrenceId===genericId).fields.composerPresentation={version:'composer-context-presentation@v1',presetKey:'future-project'};
  assert.deepEqual(projectCompletionSuggestions(future,genericId),[]);
 }
 await act(async()=>root.unmount());root=null;accepted=[];
 const openedChildren=[];
 const editorModel=(current,owner=furnishingId)=>React.createElement(CatalogContextEditor,{
  context:current.semanticState.contexts.find(context=>context.contextOccurrenceId===owner),
  editor:current.editors.find(editor=>editor.assetKey==='template:'+current.semanticState.contexts.find(context=>context.contextOccurrenceId===owner).templateKey),targetMonth:'2026-11',
  householdPersons:[],busy:false,model:current,choose(){assert.fail();},onCancel(){},
  onOpenChild:id=>openedChildren.push(id),
  onSave(operation){if(rejectNext){rejectNext=false;return false;}accepted.push(operation);return true;},
 });
 await act(async()=>{root=create(editorModel(furnishing));});
 await click('Ajouter Acheter pour la maison');
 const noPurchase={...furnishing,dropCapabilities:furnishing.dropCapabilities.filter(drop=>drop.target.contextOccurrenceId!==furnishingId)};
 await act(async()=>root.update(editorModel(noPurchase)));
 await act(async()=>confirmation.accept());assert.equal(accepted.length,0);
 assert(root.root.findAllByProps({role:'alert'}).some(node=>text(node).includes('droits de rattachement ont changé')));
 await act(async()=>root.update(editorModel(furnishing)));
 rejectNext=true;
 await click('Ajouter Acheter pour la maison');
 await act(async()=>confirmation.accept());assert.equal(accepted.length,0);
 assert(root.root.findAllByProps({role:'alert'}).some(node=>text(node).includes('n’a pas été associée')));
 await click('Ajouter Acheter pour la maison');
 await act(async()=>confirmation.accept());assert.equal(accepted[0].purchaseBasket,true);
 await act(async()=>root.unmount());root=null;accepted=[];
 await act(async()=>{root=create(editorModel(leisure,leisureId));});
 const catalog=root.root.findAllByType(CatalogOpenButton).find(button=>button.props.target?.scope==='activity');
 assert(catalog);
 const commandsFor=key=>catalog.props.target.resolveCommands({visualConceptId:composerPreset(key).visualConceptId,presetKey:key});
 const bowlingId=leisure.board.contexts.find(child=>child.parentContextOccurrenceId===leisureId&&child.fields.composerPresentation?.presetKey==='bowling').contextOccurrenceId;
 const existingActivity=commandsFor('bowling');assert.equal(existingActivity.length,1);assert.equal(existingActivity[0].editsExisting,true);
 await act(async()=>existingActivity[0].run());assert.deepEqual(openedChildren,[bowlingId]);assert.equal(accepted.length,0);
 const laser=commandsFor('laser-game');assert.equal(laser.length,1);assert(!laser[0].editsExisting);
 await act(async()=>laser[0].run());assert.equal(accepted.length,0);
 await act(async()=>confirmation.accept());assert.equal(accepted.length,1);
 assert.equal(accepted[0].presetKey,'laser-game');assert.equal(accepted[0].target.contextOccurrenceId,leisureId);
 const withLaser=await request(leisure.semanticState,accepted[0]);
 assert.equal(withLaser.semanticState.contexts.find(child=>child.contextOccurrenceId===accepted[0].identity).parentContextOccurrenceId,leisureId);
 const familyId=uuid(++counter);
 const family=await request(f.semantic,{kind:'DROP',assetKey:'template:family-visit',target:{kind:'BOARD_ZONE'},
  identity:familyId,selectionId:uuid(++counter),values:{label:'Visite familiale'}});
 for(const [Editor,source,owner] of [[ShortStayEditor,rental,stayId],[ProspectiveContextEditor,family,familyId]]){
  await act(async()=>root.unmount());root=null;accepted=[];
  const renderProject=current=>React.createElement(Editor,{context:current.semanticState.contexts.find(context=>context.contextOccurrenceId===owner),
   model:current,semanticState:current.semanticState,targetMonth:'2026-11',householdPersons:[],fresh:true,busy:false,
   choose(){assert.fail();},onCancel(){},onOpenChild:id=>openedChildren.push(id),
   onSave:operation=>{accepted.push(operation);return true;}});
  await act(async()=>{root=create(renderProject(source));});
  const activityCatalog=()=>root.root.findAllByType(CatalogOpenButton).find(button=>button.props.target?.scope==='activity');
  const laserCommand=()=>activityCatalog().props.target.resolveCommands({visualConceptId:composerPreset('laser-game').visualConceptId});
  assert.equal(laserCommand().length,1);
  await act(async()=>laserCommand()[0].run());assert.equal(accepted.length,0);
  const denied={...source,dropCapabilities:source.dropCapabilities.filter(drop=>drop.sourceAssetKey!=='template:activity')};
  await act(async()=>root.update(renderProject(denied)));
  await act(async()=>confirmation.accept());assert.equal(accepted.length,0);
  assert(root.root.findAllByProps({role:'alert'}).some(node=>text(node).includes('droits ont changé')));
  await act(async()=>root.update(renderProject(source)));
  await act(async()=>laserCommand()[0].run());await act(async()=>confirmation.accept());
  assert.equal(accepted.length,1);assert.equal(accepted[0].target.slotKey,'activities');
  const updated=await request(source.semanticState,accepted[0]);
  assert.equal(updated.semanticState.contexts.find(child=>child.contextOccurrenceId===accepted[0].identity).parentContextOccurrenceId,owner);
 }
 let reusable=leisure;
 const rootIds=[uuid(++counter),uuid(++counter)];
 for(const [index,id] of rootIds.entries()){
  reusable=await request(reusable.semanticState,{kind:'DROP',assetKey:'template:activity',presetKey:'laser-game',
   target:{kind:'BOARD_ZONE'},identity:id,selectionId:uuid(++counter),values:{}});
  reusable=await request(reusable.semanticState,{kind:'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:id,
   slots:{main:[component('activity',index?'21.00':'14.00',uuid(++counter))]}}});
 }
 const priorRoots=rootIds.map(id=>reusable.semanticState.contexts.find(context=>context.contextOccurrenceId===id));
 await act(async()=>root.unmount());root=null;accepted=[];
 const reuseOnly={...reusable,dropCapabilities:reusable.dropCapabilities.filter(drop=>drop.sourceAssetKey!=='template:activity')};
 await act(async()=>{root=create(editorModel(reuseOnly,leisureId));});
 const rootCatalog=root.root.findAllByType(CatalogOpenButton).find(button=>button.props.target?.scope==='activity');
 const reuseCommands=rootCatalog.props.target.resolveCommands({visualConceptId:composerPreset('laser-game').visualConceptId});
 assert.deepEqual(reuseCommands.map(command=>command.key),rootIds);
 assert(reuseCommands.every(command=>command.label.startsWith('Rattacher Laser game')));
 await act(async()=>reuseCommands[1].run());assert.equal(accepted.length,0);
 await act(async()=>confirmation.accept());assert.equal(accepted.length,1);
 assert.equal(accepted[0].assetKey,'context-occurrence:'+rootIds[1]);assert.equal(accepted[0].identity,rootIds[1]);
 const reattached=await request(reusable.semanticState,accepted[0]);
 assert.equal(reattached.semanticState.contexts.length,reusable.semanticState.contexts.length);
 assert.deepEqual(reattached.semanticState.contexts.find(context=>context.contextOccurrenceId===rootIds[0]),priorRoots[0]);
 const moved=reattached.semanticState.contexts.find(context=>context.contextOccurrenceId===rootIds[1]);
 assert.equal(moved.parentContextOccurrenceId,leisureId);assert.deepEqual(moved.slotSelections,priorRoots[1].slotSelections);
 assert.equal(JSON.stringify(f.world),world);assert.deepEqual(f.writes,[]);
 console.log('S3-04 Weekend complements follow the actual children without repeating an existing activity: PASS');
 console.log('S3-05 Two leisure activities offer one meal, suppressed when any meal is already linked: PASS');
 console.log('S3-06 A rental can suggest an empty groceries basket and suppresses an existing groceries decision: PASS');
 console.log('S3-07 A home furnishing project suggests one empty equipment basket until a purchase or item is present: PASS');
 console.log('S3-08 A generic activity or a snack provides a truthful, capability-gated reason for its complement: PASS');
 console.log('The home project attachment editor refuses stale confirmation: PASS');
 console.log('S3-09 Generic stays, visits and home projects reuse admitted complements without mutation: PASS');
 console.log('S3-10 The project catalog reopens an exact linked activity or confirms a new child through the existing owner: PASS');
 console.log('S3-11 Stay and family visit editors confirm catalog activities and reject lost capability before adoption: PASS');
 console.log('S3-12 Catalog attachment selects the exact existing homonym and preserves both activities and their official posts: PASS');
 console.log(JSON.stringify({status:'PASS',checks:12,remoteWrites:0,apply:false,level:'LOCAL_REACT_AND_OWNER_FIXTURE'}));
}finally{if(root)await act(async()=>root.unmount());Module._load=originalLoad;}
