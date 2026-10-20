/** One focused dock -> existing Before scenario. Handler proof, not native input. */
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {fixture,state,householdId,uuid} from './fixtures/planner-headless.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
const rr=createRequire(new URL('../outputs/l4c-test-tools/package.json',import.meta.url));
const React=rr('react'),{create,act}=rr('react-test-renderer'),load=Module._load;
Module._load=function(name,...args){return name==='react'?React:load.call(this,name,...args);};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.ResizeObserver=class{observe(){}disconnect(){}};
const {ContextPalette}=require('@/app/mois-a-venir/composer/context-palette');
const {BarMomentRail}=require('@/app/mois-a-venir/composer/bar-moment-rail');
const {barDockDrag}=require('@/app/mois-a-venir/composer/bar-dock-drag');
const {preparedDrop,ComposerInteractionContext}=require('@/app/mois-a-venir/composer/interactions');
const {plannedAsset,PLANNED_ASSET_CATALOG_VERSION}=require('@/domain/phase2/planned-assets');
const {buildComponentRow,fresh}=require('@/app/mois-a-venir/composer/night-out-components');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const pg=await createKernelPostgres();let root;
try{
 const parent=uuid(97281),child=uuid(97282),beerId=uuid(97283);
 const chips={kind:'COMPONENT',selectionId:uuid(97284),optionKey:'activity',provenance:'EXPLICIT_USER_DECISION',label:'Chips',quantity:'1',unitBasis:'SHARED',cost:{kind:'UNKNOWN'}};
 const semantic=state([], [{contextOccurrenceId:parent,templateKey:'night-out',status:'ACTIVE',provenance:'EXPLICIT_USER_DECISION',fields:{fieldSchemaVersion:'context-fields@v2',label:'Bar'},slotSelections:{before:{items:[{kind:'CHILD_CONTEXT',selectionId:uuid(97285),optionKey:'activity',childContextOccurrenceId:child,provenance:'EXPLICIT_USER_DECISION'}]}}},{contextOccurrenceId:child,templateKey:'activity',parentContextOccurrenceId:parent,status:'ACTIVE',provenance:'EXPLICIT_USER_DECISION',fields:{fieldSchemaVersion:'context-fields@v2',label:'Before'},slotSelections:{main:{items:[chips]}}}]);
 const deps={readWorld:async()=>fixture(),repository:createPlanApplyRepository(pg.client),householdPersons:[]};
 const read=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:1,targetMonth:'2026-11',draft:semantic});assert.equal(read.ok,true,read.message);
 const model=read.model,target={kind:'CONTEXT_SOCKET',contextOccurrenceId:child,slotKey:'extras'},asset=plannedAsset('house_party:beer');
 const drag=barDockDrag(model,target,asset);assert.ok(drag,'published Before extra source');
 assert.equal(barDockDrag(model,{...target,slotKey:'main'},asset),undefined);
 assert.equal(barDockDrag({...model,board:{...model.board,contexts:model.board.contexts.map(c=>c.contextOccurrenceId===child?{...c,readOnly:true}:c)}},target,asset),undefined);
 let session=null,operation=null,clicks=0,ended=0,over=null;
 const interaction={grabbed:null,start(key,event,preset,initialValues){assert.equal(preset,undefined);event.dataTransfer.setData('application/x-planner-asset',key);session={...model.presentation.dragSources[key],initialValues};},end(){ended++;},over(t){over=t;},place(t){operation=preparedDrop(session,t,uuid(97286),beerId);},reject(){throw Error('unexpected rejection');}};
 const question={title:'Boissons',nature:'OBJECTS',choices:[{key:asset.assetKey,label:asset.label,iconKey:'night-out',drag,choose(){clicks++;}}]};
 const render=async({busy=false,nature='OBJECTS',blocked=false}={})=>act(async()=>{const el=React.createElement(ComposerInteractionContext.Provider,{value:{...interaction,grabbed:session}},React.createElement(React.Fragment,null,
   React.createElement(ContextPalette,{card:model.board.contexts.find(c=>c.contextOccurrenceId===parent),model,busy,appearance:'bar',question:{...question,nature},choose(){},close(){}}),
   React.createElement(BarMomentRail,{label:'Before',addLabel:'Ajouter Before',model,owner:child,slot:'extras',dropBlocked:blocked,add(){}})));
   if(root)root.update(el);else root=create(el);});
 await render();const button=()=>root.root.findAll(n=>n.type==='button'&&n.props['aria-label']===asset.label)[0];
 assert.equal(button().props.draggable,true);await act(async()=>button().props.onClick());assert.equal(clicks,1);
 const data=new Map(),event={stopPropagation(){},preventDefault(){},dataTransfer:{setData:(k,v)=>data.set(k,v),getData:k=>data.get(k),dropEffect:'none'}};
 await act(async()=>button().props.onDragStart(event));await render();
 const plus=()=>root.root.findAll(n=>n.type==='button'&&n.props['data-bar-moment-slot']!==undefined)[0];
 await act(async()=>{plus().props.onDragOver(event);plus().props.onDrop(event);});assert.deepEqual(over,target);assert.equal(operation.target.contextOccurrenceId,child);
 const dropped=await handleComposerRequest(deps,householdId,{...operation,sequence:2,targetMonth:'2026-11',draft:semantic});assert.equal(dropped.ok,true,dropped.message);
 const current=dropped.model.semanticState,added=current.contexts.find(c=>c.contextOccurrenceId===child).slotSelections.extras.items;
 assert.equal(added.length,1);assert.equal(added[0].selectionId,beerId);assert.equal(added[0].cost.kind,'UNKNOWN');
 const expected=buildComponentRow({...fresh(asset.label),id:beerId,unitBasis:'ITEM',assetRef:{catalogVersion:PLANNED_ASSET_CATALOG_VERSION,assetKey:asset.assetKey,labelAtSelection:asset.label,provenance:'EXPLICIT_USER_DECISION'}},'extra');
 assert.deepEqual(added[0],expected,'DROP equals click component, identity/provenance/unit/ref retained');
 assert.deepEqual(current.contexts.find(c=>c.contextOccurrenceId===parent),model.semanticState.contexts.find(c=>c.contextOccurrenceId===parent));
 assert.deepEqual(current.contexts.find(c=>c.contextOccurrenceId===child).slotSelections.main.items,[chips]);
 await render({busy:true});assert.equal(button().props.draggable,false);
 await render({nature:'FAMILIES'});assert.equal(button().props.draggable,false);
 await render({nature:'PEOPLE'});assert.equal(button().props.draggable,false);
 await render({blocked:true});let rejected=0; // RAW guard prevents the target even if a drag was already started.
 operation=null;await act(async()=>{try{plus().props.onDrop(event);}catch{rejected++;}});assert.equal(operation,null);assert.equal(rejected,1);
 const invalid=await handleComposerRequest(deps,householdId,{...preparedDrop(session,target,uuid(97287),uuid(97288)),values:{...drag.values,productAssetKey:'does-not-exist'},sequence:3,targetMonth:'2026-11',draft:semantic});assert.equal(invalid.ok,false);
 await pg.verifyCanaries();assert.deepEqual(await pg.counts(),{plans:0,revisions:0});
 console.log(JSON.stringify({status:'PASS',scenario:'PUBLISHED_DOCK_BEFORE_EXTRA_EQUALS_CLICK',level:'REACT_HANDLERS_AND_REAL_OWNER_PGLITE_NOT_NATIVE',parentUnchanged:true,unknown:true,click:true,guards:['LOCK','BUSY','RAW_TARGET','FAMILIES','PEOPLE','UNPUBLISHED_TARGET','INVALID_PRODUCT'],financialWrites:0}));
}finally{if(root)await act(async()=>root.unmount());await pg.close();}
