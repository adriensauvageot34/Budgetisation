import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId} from './fixtures/planner-headless.mjs';
const {discoveryActions}=require('@/app/mois-a-venir/composer/catalog-discovery');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {isPurchaseBasket,purchaseComponents}=require('@/domain/phase2/planner/purchase-basket');
const {filterLibraryIntentions,libraryOccurrences}=require('@/domain/phase2/planner/composer-library-index');
const {plannerDigest}=require('@/domain/phase2/planner/json');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {componentId}=require('@/domain/phase2/planner/identity');
const {entries}=JSON.parse(fs.readFileSync('public/planned-visuals/builder/clay/v22/collection.json','utf8'));
globalThis.fetch=async()=>{throw Error('CATALOG_PURCHASE_START_REMOTE_FORBIDDEN');};
const f=await readMonthFixture(),world=JSON.stringify(f.world),initial=semanticStateDigest(f.model.semanticState);let identity=31600;
const request=async(model,operation)=>{
 const response=await handleComposerRequest(f.deps,householdId,{sequence:0,targetMonth:'2026-11',draft:model.semanticState,...operation});
 assert(response.ok,response.code+': '+response.message);return response.model;
};
for(const [assetKey,presetKey] of [['beauty:mascara','beauty-purchase'],['clothing:tshirt','clothing-shopping'],['household:laundry','laundry-detergent'],
 ['tech:charger',undefined],['home:plant',undefined],['automotive:tires',undefined],['tech:video_game','video-game-purchase']]){
 const entry=entries.find(entry=>entry.discovery.sourceRow&&entry.assetKeys.includes(assetKey));assert(entry,'Existing catalog binding '+assetKey);
 const actions=discoveryActions(entry,f.model,{}),action=actions.find(action=>action.concept?.id===entry.visualConceptId);assert(action,assetKey);
 assert.equal(action.presetKey,presetKey);assert.equal(action.asset.assetKey,'template:purchase');
 assert.equal(action.kind,presetKey?'PRESET':'CHOOSE');if(!presetKey)assert.deepEqual(action.target,{kind:'BOARD_ZONE'});
 assert.deepEqual(action.concept,{id:entry.visualConceptId,label:entry.label});
 const contextId=uuid(++identity);
 let model=await request(f.model,{kind:'DROP',assetKey:action.asset.assetKey,target:{kind:'BOARD_ZONE'},identity:contextId,selectionId:uuid(++identity),values:{},purchaseBasket:true,
  ...(presetKey?{presetKey}: {})});
 let context=model.semanticState.contexts.find(context=>context.contextOccurrenceId===contextId);
 assert(isPurchaseBasket(context));assert.deepEqual(context.slotSelections,{});
 assert.equal(libraryOccurrences(model).find(row=>row.contextOccurrenceId===contextId)?.action,'EDIT');
 if(!presetKey){assert.equal(context.fields.composerPresentation,undefined);assert.notEqual(context.fields.budgetDomain,'games-digital');assert.notEqual(context.fields.budgetDomain,'clothing');}
 model=await request(model,{kind:'EDIT_PURCHASE_BASKET',edit:{contextOccurrenceId:contextId,expectedContextDigest:plannerDigest(context),
  change:{kind:'SAVE_ITEM',selectionId:uuid(++identity),label:entry.label,quantity:'1',unit:'UNIT',price:'',concept:action.concept}}});
 context=model.semanticState.contexts.find(context=>context.contextOccurrenceId===contextId);
 assert.equal(purchaseComponents(context,'item')[0].cost.kind,'UNKNOWN');
 assert(discoveryActions(entry,model,{}).some(action=>action.kind==='OPEN'&&action.contextId===contextId));
 const denied={...model,dropCapabilities:model.dropCapabilities.filter(drop=>drop.target.kind!=='BOARD_ZONE')};
 assert(!discoveryActions(entry,denied,{}).some(action=>action.concept));
 assert(!discoveryActions(entry,model,{controlRef:'HOUSEHOLD:household:groceries'}).some(action=>action.concept));
 if(!presetKey){
  const future=structuredClone(model.semanticState);future.contexts.find(context=>context.contextOccurrenceId===contextId).fields.composerPresentation={version:'composer-context-presentation@v1',presetKey:'future-unknown-purchase'};
  const unknown=await request({...model,semanticState:future},{kind:'READ'});
  assert(!libraryOccurrences(unknown).some(row=>row.contextOccurrenceId===contextId));
 }
}
assert.equal(semanticStateDigest(f.model.semanticState),initial);assert.equal(JSON.stringify(f.world),world);assert.deepEqual(f.writes,[]);
const testRequire=createRequire(path.resolve(process.env.PLANNER_REACT_TEST_TOOLS||'outputs/p21-react-tools','package.json'));
const React=testRequire('react'),jsx=testRequire('react/jsx-runtime'),{create,act}=testRequire('react-test-renderer');
const originalLoad=Module._load,originalFetch=globalThis.fetch;let root,chosen=[];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
class Element{focus(){}}
globalThis.HTMLElement=Element;globalThis.document={body:{},activeElement:new Element()};
globalThis.fetch=async url=>{assert.equal(url,'/planned-visuals/builder/clay/v22/collection.json','Only local collection fixture may load');return {ok:true,json:async()=>({schema:'clay-v22-collection@2',entries})};};
Module._load=function(name,parent,...args){if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;if(name==='react-dom')return {createPortal:children=>children};
 if(name==='./context-palette'&&parent?.filename.endsWith('purchase-basket-editor.tsx'))return {ContextPalette:()=>null};
 return originalLoad.call(this,name,parent,...args);};
const {CatalogDiscoveryProvider,CatalogOpenButton}=require('@/app/mois-a-venir/composer/catalog-discovery-provider');
const charger=entries.find(entry=>entry.discovery.sourceRow&&entry.assetKeys.includes('tech:charger'));
const text=node=>typeof node==='string'?node:(node.children??[]).map(text).join('');
try{
 await act(async()=>{root=create(React.createElement(CatalogDiscoveryProvider,{model:f.model,busy:false,
  openContext(){assert.fail('An empty catalog start must not open another intention');},revealControl(){assert.fail();},choosePreset(){assert.fail('Charger uses the generic basket');},choose:(...args)=>chosen.push(args)},
  React.createElement(CatalogOpenButton,{target:{entryId:charger.visualConceptId,query:charger.label,scope:'purchase'}},'Ouvrir le catalogue')),
  {createNodeMock:()=>({open:false,showModal(){this.open=true;},close(){this.open=false;}})});});
 await act(async()=>root.root.findByProps({'data-catalog-open':true}).props.onClick());assert.equal(chosen.length,0);
 const start=root.root.findAllByType('button').find(button=>text(button)===`Préparer un panier pour ${charger.label}`);assert(start);
 await act(async()=>start.props.onClick());assert.equal(chosen.length,1);
 assert.equal(chosen[0][0].assetKey,'template:purchase');assert.deepEqual(chosen[0][1],{kind:'BOARD_ZONE'});
 assert.deepEqual(chosen[0][4],{id:charger.visualConceptId,label:charger.label});
 assert.equal(semanticStateDigest(f.model.semanticState),initial);assert.deepEqual(f.writes,[]);
 await act(async()=>root.unmount());root=null;
 const coursesCatalog=model=>React.createElement(CatalogDiscoveryProvider,{model,busy:false,openContext(){assert.fail();},
  revealControl(){assert.fail();},choose(){assert.fail();},choosePreset(...args){chosen.push(args);}},
  React.createElement(CatalogOpenButton,{target:{scope:'courses'}},'Produits pour Courses'));
 await act(async()=>{root=create(coursesCatalog(f.model),{createNodeMock:()=>({open:false,showModal(){this.open=true;},close(){this.open=false;}})});});
 await act(async()=>root.root.findByProps({'data-catalog-open':true}).props.onClick());
 const prepareCourses=()=>root.root.findAllByType('button').find(button=>text(button)==='Préparer mes courses');
 assert.equal(prepareCourses().props.disabled,false);
 const newer={...f.model,board:{...f.model.board,draft:{...f.model.board.draft,semanticStateDigest:'newer-digest'}}};
 await act(async()=>root.update(coursesCatalog(newer)));
 assert.equal(prepareCourses().props.disabled,true);assert.equal(chosen.length,1);
 await act(async()=>root.unmount());root=null;
 const {PurchaseBasketEditor}=require('@/app/mois-a-venir/composer/purchase-basket-editor');
 const {BudgetPreviewStatus}=require('@/app/mois-a-venir/composer/intent-budget-impact');
 const {InlineEditContext,InlineEditRegistry}=require('@/app/mois-a-venir/composer/inline-edit-registry');
 const contextId=uuid(31800),firstId=uuid(31801),secondId=uuid(31802);
 let basket=await request(f.model,{kind:'DROP',assetKey:'template:purchase',target:{kind:'BOARD_ZONE'},identity:contextId,selectionId:uuid(31803),values:{},purchaseBasket:true});
 for(const [selectionId,price] of [[firstId,'12'],[secondId,'20']]){
  const context=basket.semanticState.contexts.find(context=>context.contextOccurrenceId===contextId);
  basket=await request(basket,{kind:'EDIT_PURCHASE_BASKET',edit:{contextOccurrenceId:contextId,expectedContextDigest:plannerDigest(context),
   change:{kind:'SAVE_ITEM',selectionId,label:charger.label,quantity:'1',unit:'UNIT',price,concept:{id:charger.visualConceptId,label:charger.label}}}});
 }
 const context=basket.semanticState.contexts.find(context=>context.contextOccurrenceId===contextId),beforeDigest=semanticStateDigest(basket.semanticState);
 const openActions=discoveryActions(charger,basket,{}).filter(action=>action.kind==='OPEN');assert.equal(openActions.length,2);
 assert.deepEqual(openActions.map(action=>action.focus),['basket-item:'+firstId,'basket-item:'+secondId]);
 const catalogChoice={kind:'socket',asset:basket.library.searchableAssets.find(asset=>asset.assetKey==='option:purchase:item:item'),
  target:{kind:'CONTEXT_SOCKET',contextOccurrenceId:contextId,slotKey:'item'},selection:purchaseComponents(context,'item')[1]};
 const registry=new InlineEditRegistry(),operations=[];
 const render=(model,choice,status='FRESH')=>React.createElement(InlineEditContext.Provider,{value:registry},React.createElement(BudgetPreviewStatus.Provider,{value:status},React.createElement(PurchaseBasketEditor,{
  model,context:model.semanticState.contexts.find(context=>context.contextOccurrenceId===contextId),card:model.board.contexts.find(card=>card.contextOccurrenceId===contextId),
  busy:false,catalogChoice:choice,close(){},decide:operation=>{operations.push(operation);return true;}})));
 await act(async()=>{root=create(render(basket,catalogChoice));});assert.equal(operations.length,0);
 const price=root.root.findAllByType('label').find(label=>text(label).startsWith('Prix par')).findByType('input');assert.equal(price.props.value,purchaseComponents(context,'item')[1].cost.unitAmount);
 await act(async()=>price.props.onChange({target:{value:'21,00'}}));assert.equal(registry.count(),1);assert.equal(operations.length,0);
 assert.equal(semanticStateDigest(basket.semanticState),beforeDigest);
 await act(async()=>root.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(operations.length,1);
 assert.equal(operations[0].edit.change.selectionId,secondId);
 const updated=await request(basket,operations[0]);
 const updatedContext=updated.semanticState.contexts.find(context=>context.contextOccurrenceId===contextId);
 assert.deepEqual(purchaseComponents(updatedContext,'item')[0],purchaseComponents(context,'item')[0]);
 assert.equal(purchaseComponents(updatedContext,'item')[1].selectionId,secondId);assert.equal(purchaseComponents(updatedContext,'item')[1].cost.unitAmount,'21.00');
 assert.equal(updated.board.contexts.find(card=>card.contextOccurrenceId===contextId).purchaseSummary.knownAmount,'33.00');
 const protectedState=structuredClone(updated.semanticState);protectedState.preferences.anchors.push(componentId(contextId,'item',secondId));
 const protectedModel=await request({...updated,semanticState:protectedState},{kind:'READ'});
 const protectedActions=discoveryActions(charger,protectedModel,{}).filter(action=>action.kind==='OPEN');
 assert(protectedActions.some(action=>action.contextId===contextId));assert(protectedActions.every(action=>!action.focus));
 await act(async()=>root.unmount());root=null;operations.length=0;
 await act(async()=>{root=create(render(updated,{...catalogChoice}));});assert.equal(root.root.findAllByType('form').length,0);
 assert(root.root.findAllByProps({role:'alert'}).some(node=>text(node).includes('article ou ses droits ont changé')));assert.equal(operations.length,0);
 await act(async()=>root.unmount());root=null;
 let mixed=await request(updated,{kind:'EDIT_PURCHASE_BASKET',edit:{contextOccurrenceId:contextId,expectedContextDigest:plannerDigest(updatedContext),
  change:{kind:'SET_DETAILS',merchant:'Boutique de recette',date:'',coverage:'AUTO'}}});
 for(const [selectionId,price] of [[firstId,'0'],[secondId,'']]){
  const current=mixed.semanticState.contexts.find(context=>context.contextOccurrenceId===contextId);
  mixed=await request(mixed,{kind:'EDIT_PURCHASE_BASKET',edit:{contextOccurrenceId:contextId,expectedContextDigest:plannerDigest(current),
   change:{kind:'SAVE_ITEM',selectionId,label:'Accessoire de voyage',quantity:'1',unit:'UNIT',price,concept:{id:charger.visualConceptId,label:charger.label}}}});
 }
 const mixedDigest=semanticStateDigest(mixed.semanticState);
 const found=filterLibraryIntentions(libraryOccurrences(mixed),'boutique '+charger.label);
 assert.deepEqual(found.map(row=>row.contextOccurrenceId),[contextId]);assert.equal(found[0].action,'EDIT');
 await act(async()=>{root=create(render(mixed));});
 const lines=()=>root.root.findAllByType('li').filter(line=>line.props['data-basket-line']);
 assert.deepEqual(lines().map(line=>line.props['data-basket-line']),[firstId,secondId]);
 assert.match(text(lines()[0]),/Total/);assert.match(text(root.root),/2 articles · 1 prix à préciser/);
 await act(async()=>root.root.findByProps({type:'search'}).props.onChange({target:{value:'introuvable'}}));
 assert.equal(lines().length,0);
 await act(async()=>root.root.findByProps({type:'search'}).props.onChange({target:{value:charger.label}}));
 await act(async()=>root.root.findByProps({type:'checkbox'}).props.onChange({target:{checked:true}}));
 assert.deepEqual(lines().map(line=>line.props['data-basket-line']),[secondId]);assert.match(text(lines()[0]),/Ligne 2/);
 await act(async()=>root.root.findByProps({type:'checkbox'}).props.onChange({target:{checked:false}}));
 await act(async()=>root.update(render(mixed,undefined,'STALE')));
 assert.doesNotMatch(text(lines()[0]),/Total/);assert.equal(semanticStateDigest(mixed.semanticState),mixedDigest);assert.equal(operations.length,0);
 assert.deepEqual(f.writes,[]);
}finally{if(root)await act(async()=>root.unmount());Module._load=originalLoad;globalThis.fetch=originalFetch;}
console.log(JSON.stringify({status:'PASS',products:7,families:6,uiDispatch:true,exactLineEdit:true,staleRefused:true,staleCoursesDisabled:true,articleFilters:true,remoteWrites:0,apply:false,level:'EXISTING_CATALOG_AND_PURCHASE_OWNER'}));
