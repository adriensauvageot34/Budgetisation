import assert from 'node:assert/strict';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId} from './fixtures/planner-headless.mjs';
import {providers} from './fixtures/planner-mobility.mjs';

const testRequire=createRequire(path.resolve(process.env.PLANNER_REACT_TEST_TOOLS||'outputs/p21-react-tools','package.json'));
const React=testRequire('react'),jsx=testRequire('react/jsx-runtime'),{create,act}=testRequire('react-test-renderer');
const originalLoad=Module._load;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
globalThis.document={body:{}};
globalThis.fetch=async()=>{throw Error('MOBILITY_FIELDS_REMOTE_FORBIDDEN');};
Module._load=function(name,parent,...args){
 if(name==='react')return React;
 if(name==='react/jsx-runtime')return jsx;
 if(name==='react-dom')return {createPortal:children=>children};
 return originalLoad.call(this,name,parent,...args);
};
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {RestaurantEditor}=require('@/app/mois-a-venir/composer/restaurant-editor');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {preparePlanningMobility}=require('@/server/phase2/planner/prospective-mobility-pricing');
const {mobilityFieldGroups,MobilityFields}=require('@/app/mois-a-venir/composer/mobility-fields');
const {InlineEditContext,InlineEditRegistry}=require('@/app/mois-a-venir/composer/inline-edit-registry');
const f=await readMonthFixture(),world=JSON.stringify(f.world),contextId=uuid(29800),selectionId=uuid(29801);
const mobility=providers(),pricedDeps={...f.deps,prepareWorld:(world,state)=>preparePlanningMobility(world,state,mobility.value)};
const request=async(draft,operation,deps=f.deps)=>{
 const response=await handleComposerRequest(deps,householdId,{sequence:0,targetMonth:'2026-11',draft,...operation});
 assert(response.ok,response.code+': '+response.message);return response.model;
};
let model=await request(f.semantic,{kind:'DROP',assetKey:'template:activity',presetKey:'cinema',target:{kind:'BOARD_ZONE'},identity:contextId,selectionId:uuid(29802),values:{}});
const target={kind:'CONTEXT_SOCKET',contextOccurrenceId:contextId,slotKey:'transport'};
model=await request(model.semanticState,{kind:'DROP',assetKey:'option:activity:transport:car',target,identity:uuid(29803),selectionId,
 values:{parkingMode:'UNKNOWN',returnRequired:'false'}});
const initial=model.semanticState,initialDigest=semanticStateDigest(initial),registry=new InlineEditRegistry();
let current=initial,accepted=[],root,setCurrent;
const selected=()=>current.contexts.find(context=>context.contextOccurrenceId===contextId).slotSelections.transport.items[0];
const asset=model.library.searchableAssets.find(asset=>asset.assetKey==='option:activity:transport:car');
const choice={kind:'socket',asset,target,selection:selected()};
function Harness(){
 const [state,setState]=React.useState(current);setCurrent=setState;
 return React.createElement(InlineEditContext.Provider,{value:registry},React.createElement(RestaurantEditor,{
  context:state.contexts.find(context=>context.contextOccurrenceId===contextId),card:model.board.contexts.find(card=>card.contextOccurrenceId===contextId),
  model,creating:false,busy:false,catalogChoice:choice,close(){},decide(operation){accepted.push(operation);return true;}
 }));
}
const text=node=>typeof node==='string'?node:(node.children??[]).map(text).join('');
const click=async label=>{const button=root.root.findAllByType('button').find(node=>text(node)===label);assert(button,label);await act(async()=>button.props.onClick());};
try{
 await act(async()=>{root=create(React.createElement(Harness));});
 assert.equal(accepted.length,0);
 const fields=model.editors.find(editor=>editor.assetKey===asset.assetKey).fields;
 assert.deepEqual(mobilityFieldGroups(fields).flatMap(group=>group.fields).map(field=>field.key).sort(),fields.map(field=>field.key).sort());
 await click('Frais');
 await act(async()=>root.root.findByProps({name:'parkingMode'}).props.onChange({target:{value:'YES'}}));
 await act(async()=>root.root.findByProps({name:'parkingAmount'}).props.onChange({target:{value:'5,00'}}));
 assert.equal(registry.count(),1);assert.equal(accepted.length,0);
 await click('Trajet');await click('Frais');
 assert.equal(root.root.findByProps({name:'parkingAmount'}).props.value,'5,00');
 await act(async()=>root.root.findByType('form').props.onSubmit({preventDefault(){}}));
 assert.equal(accepted.length,1);
 const saved=await request(current,accepted[0]);
 const savedSelection=saved.semanticState.contexts.find(context=>context.contextOccurrenceId===contextId).slotSelections.transport.items[0];
 assert.equal(savedSelection.selectionId,selectionId);
 assert.deepEqual(savedSelection.pricing.parking,{kind:'MANUAL',unitAmount:'5.00'});
 assert.deepEqual(savedSelection.pricing.fare,{kind:'UNKNOWN'});
 assert.equal(savedSelection.returnRequired,false);
 console.log('MF-01 Published fields, RAW retention, explicit adoption and official parking owner: PASS');
 await act(async()=>root.unmount());root=null;accepted=[];current=initial;
 await act(async()=>{root=create(React.createElement(Harness));});
 await click('Frais');
 await act(async()=>root.root.findByProps({name:'parkingAmount'}).props.onChange({target:{value:'7,'}}));
 current=structuredClone(current);selected().returnRequired=true;
 await act(async()=>setCurrent(current));
 await act(async()=>root.root.findByType('form').props.onSubmit({preventDefault(){}}));
 assert.equal(accepted.length,0);
 assert.equal(root.root.findByProps({name:'parkingAmount'}).props.value,'7,');
 assert(root.root.findAllByProps({role:'alert'}).some(node=>text(node).includes('trajet a changé')));
 assert.equal(semanticStateDigest(initial),initialDigest);
 assert.equal(JSON.stringify(f.world),world);assert.deepEqual(f.writes,[]);
 console.log('MF-02 Stale transport refuses overwrite and preserves the partial input: PASS');
 const incompleteTrain=await request(initial,{kind:'DROP',assetKey:'option:activity:transport:train',target,identity:uuid(29820),selectionId,
  values:{amount:'10',returnRequired:'true'}},pricedDeps);
 assert.equal(incompleteTrain.mobilitySummaries.find(summary=>summary.contextOccurrenceId===contextId).fare,null);
 const train=await request(incompleteTrain.semanticState,{kind:'DROP',assetKey:'option:activity:transport:train',target,identity:uuid(29821),selectionId,
  values:{amount:'10',returnRequired:'true',origin:'Gare synthétique A',destination:'Gare synthétique B'}},pricedDeps);
 const summary=train.mobilitySummaries.find(summary=>summary.contextOccurrenceId===contextId);
 assert.equal(summary.fare,'10.00');assert.equal(summary.cashTransport,'10.00');
 const oneWay=await request(train.semanticState,{kind:'DROP',assetKey:'option:activity:transport:train',target,identity:uuid(29821),selectionId,
  values:{amount:'10',returnRequired:'false'}},pricedDeps);
 assert.equal(oneWay.mobilitySummaries.find(summary=>summary.contextOccurrenceId===contextId).fare,'10.00');
 await act(async()=>root.unmount());root=null;
 await act(async()=>{root=create(React.createElement(MobilityFields,{fields,values:{targetIntentId:'synthetic-shared-owner'},preserved:{},busy:false,
  change(){assert.fail('Reading shared costs must not change values');}}));});
 await click('Frais');assert.equal(root.root.findByType('fieldset').props.disabled,true);
 await click('Financement');assert.equal(root.root.findByType('fieldset').props.disabled,true);
 await act(async()=>root.unmount());root=null;
 const freeFields=model.editors.find(editor=>editor.assetKey==='option:activity:transport:free').fields;
 await act(async()=>{root=create(React.createElement(MobilityFields,{fields:freeFields,values:{},preserved:{},busy:false,mode:'free',change(){assert.fail('Free mode has no fare to adopt');}}));});
 await click('Frais');assert.equal(root.root.findByType('fieldset').props.disabled,true);
 assert.equal(semanticStateDigest(initial),initialDigest);assert.equal(JSON.stringify(f.world),world);assert.deepEqual(f.writes,[]);
 assert.deepEqual(mobility.calls,{routes:[],fuel:0,toll:0});
 console.log('MF-03 Train return is not a doubled fare; shared-journey costs remain on their owner: PASS');
 console.log(JSON.stringify({status:'PASS',checks:3,remoteWrites:0,apply:false,level:'LOCAL_REACT_AND_OWNER_FIXTURE'}));
}finally{if(root)await act(async()=>root.unmount());Module._load=originalLoad;}
