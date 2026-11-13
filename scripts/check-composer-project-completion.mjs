import assert from 'node:assert/strict';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId} from './fixtures/planner-headless.mjs';
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
let root,setModel,accepted=[],summaryFocus=0;
function Harness(){
 const [shown,update]=React.useState(model);setModel=update;
 const [enabled,toggle]=React.useState(true),[priority,prioritize]=React.useState('BALANCED'),[dismissed,setDismissed]=React.useState({});
 return React.createElement(ProjectCompletionPreference.Provider,{value:{enabled,toggle:()=>toggle(value=>!value),priority,prioritize,dismissed,
  dismiss:(id,key)=>setDismissed(previous=>({...previous,[id]:key===null?[]:[...(previous[id]??[]),key]}))}},
  React.createElement(ProjectCompletion,{model:shown,parentId,busy:false,decide(operation){accepted.push(operation);return true;}}));
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
 await act(async()=>root.unmount());root=null;accepted=[];
 const editorModel=current=>React.createElement(CatalogContextEditor,{
  context:current.semanticState.contexts.find(context=>context.contextOccurrenceId===furnishingId),
  editor:current.editors.find(editor=>editor.assetKey==='template:home-project'),targetMonth:'2026-11',
  householdPersons:[],busy:false,model:current,choose(){assert.fail();},onCancel(){},
  onSave(operation){accepted.push(operation);return true;},
 });
 await act(async()=>{root=create(editorModel(furnishing));});
 await click('Ajouter Acheter pour la maison');
 const noPurchase={...furnishing,dropCapabilities:furnishing.dropCapabilities.filter(drop=>drop.target.contextOccurrenceId!==furnishingId)};
 await act(async()=>root.update(editorModel(noPurchase)));
 await act(async()=>confirmation.accept());assert.equal(accepted.length,0);
 assert(root.root.findAllByProps({role:'alert'}).some(node=>text(node).includes('droits de rattachement ont changé')));
 await act(async()=>root.update(editorModel(furnishing)));
 await click('Ajouter Acheter pour la maison');
 await act(async()=>confirmation.accept());assert.equal(accepted[0].purchaseBasket,true);
 assert.equal(JSON.stringify(f.world),world);assert.deepEqual(f.writes,[]);
 console.log('S3-04 Weekend complements follow the actual children without repeating an existing activity: PASS');
 console.log('S3-05 Two leisure activities offer one meal, suppressed when any meal is already linked: PASS');
 console.log('S3-06 A rental can suggest an empty groceries basket and suppresses an existing groceries decision: PASS');
 console.log('S3-07 A home furnishing project suggests one empty equipment basket until a purchase or item is present: PASS');
 console.log('S3-08 A generic activity or a snack provides a truthful, capability-gated reason for its complement: PASS');
 console.log('The home project attachment editor refuses stale confirmation: PASS');
 console.log(JSON.stringify({status:'PASS',checks:8,remoteWrites:0,apply:false,level:'LOCAL_REACT_AND_OWNER_FIXTURE'}));
}finally{if(root)await act(async()=>root.unmount());Module._load=originalLoad;}
