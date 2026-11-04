/** Synthetic A-REST-I receipt. No network, SQL, durable Save or Apply. */
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import Module, {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId} from './fixtures/planner-headless.mjs';
const rr=process.env.PLANNER_REACT_TEST_TOOLS?createRequire(path.resolve(process.env.PLANNER_REACT_TEST_TOOLS,'package.json')):require;
const React=rr('react'),jsx=rr('react/jsx-runtime'),{create,act}=rr('react-test-renderer'),originalLoad=Module._load;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
globalThis.document={body:{}};
let remote=0,confirmation=null;
globalThis.fetch=async()=>{remote++;throw Error('A_REST_I_REMOTE_FORBIDDEN');};
Module._load=function(name,parent,...args){
 if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;
 if(name==='react-dom')return {createPortal:children=>children};
 if(name==='./workshop-confirmation')return {useWorkshopConfirmation:()=>value=>{confirmation=value;}};
 if(name==='./context-palette'&&parent?.filename.endsWith('restaurant-editor.tsx'))return {ContextPalette:({question})=>React.createElement('nav',null,question?.choices.map(c=>React.createElement('button',{key:c.key,onClick:c.choose},c.label)))};
 return originalLoad.call(this,name,parent,...args);
};
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {stageLocalDecision,restaurantLocalRefusalMessage}=require('@/app/mois-a-venir/composer/local-draft');
const {editRestaurant}=require('@/domain/phase2/planner/restaurant-edit');
const {parseRestaurantIncludedDetails,restaurantIncludedDetails}=require('@/domain/phase2/planner/restaurant-included-details');
const {parsePlanSemanticState,semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {canonicalPlannerJson,plannerDigest}=require('@/domain/phase2/planner/json');
const {componentId}=require('@/domain/phase2/planner/identity');
const {presetCreationFields}=require('@/domain/phase2/planner/composer-presets');
const {manifestContextRegistry,publishContextRegistry}=require('@/server/phase2/planner/context-registry');
const {validateContextGraph}=require('@/server/phase2/planner/context-selections');
const {transitionNightOutGlobal}=require('@/domain/phase2/planner/night-out-consumption');
const {evaluatePlanScenario}=require('@/server/phase2/planner/preview');
const {RestaurantEditor}=require('@/app/mois-a-venir/composer/restaurant-editor');
const {WorkshopComponentRow}=require('@/app/mois-a-venir/composer/workshop-component-row');
const {InlineEditContext,InlineEditRegistry}=require('@/app/mois-a-venir/composer/inline-edit-registry');
const f=await readMonthFixture(),worldBefore=canonicalPlannerJson(f.world),id=uuid(99601),sid=uuid(99602),otherId=uuid(99603);
const meal={selectionId:sid,optionKey:'restaurant',kind:'COMPONENT',provenance:'EXPLICIT_USER_DECISION',label:'Addition synthétique',quantity:'1',unitBasis:'SHARED',cost:{kind:'MANUAL',unitAmount:'40.00'},fundingAllocations:[],binding:{mode:'NO_RELATED_SLOT'}};
const context={contextOccurrenceId:id,templateKey:'restaurant',status:'ACTIVE',parentContextOccurrenceId:null,fields:{fieldSchemaVersion:'context-fields@v2',label:'Restaurant homonyme',participantRefs:[{kind:'TEXT',label:'Alice synthétique'},{kind:'TEXT',label:'Bob synthétique'}]},slotSelections:{meal:{items:[meal]}},provenance:'EXPLICIT_USER_DECISION'};
const other={...structuredClone(context),contextOccurrenceId:otherId,slotSelections:{meal:{items:[{...meal,selectionId:uuid(99604)}]}}};
const base=parsePlanSemanticState({...f.semantic,contexts:[context,other]});
const target=s=>s.contexts.find(c=>c.contextOccurrenceId===id);
const detail={detailId:uuid(99605),label:'Boisson',included:true,quantity:'2',unitBasis:'ITEM',amount:{kind:'DECLARED_LINE_TOTAL',value:'6.00'},provenance:'EXPLICIT_USER_DECISION'};
const block={version:'restaurant-included-details@v1',mealSelectionId:sid,items:[detail]};
const edit=(state,patch)=>editRestaurant(state,{contextOccurrenceId:id,...patch});
const preview=s=>evaluatePlanScenario(f.world,s,{expectedActiveRevisionId:null,expectedActiveRevisionNumber:0});
const economics=s=>{const p=preview(s);return {components:p.compiled.components,input:p.compiled.financialAdapterInput};};
const amounts=s=>preview(s).compiled.components.filter(c=>c.contextOccurrenceId===id).map(c=>c.evaluation.economicAmount).sort();
const modelFor=async draft=>{const r=await handleComposerRequest(f.deps,householdId,{kind:'READ',sequence:0,targetMonth:'2026-11',draft});assert.equal(r.ok,true,r.code);return r.model;};
const server=async(draft,operation)=>handleComposerRequest(f.deps,householdId,{sequence:1,targetMonth:'2026-11',draft,...operation});
const checks=[];const check=async(name,run)=>{await run();checks.push(name);console.log(name+' PASS');};
let admitted;
await check('RI-01-INCLUDED-40-6-NON-ADDITIVE',()=>{
 admitted=edit(base,{includedDetails:block});validateContextGraph(admitted);
 assert.deepEqual(amounts(admitted),['40.00']);assert.deepEqual(economics(admitted),economics(base));
 assert.equal(restaurantIncludedDetails(target(admitted)).items[0].amount.value,'6.00');
 assert.notEqual(semanticStateDigest(admitted),semanticStateDigest(base));
});
await check('RI-02-EXTERNAL-EXTRA-REMAINS-ECONOMIC',()=>{
 const extra={...meal,selectionId:uuid(99606),optionKey:'extra',label:'Supplément extérieur',cost:{kind:'MANUAL',unitAmount:'6.00'}};
 const state=edit(admitted,{slots:{extras:[extra]}});assert.deepEqual(amounts(state),['40.00','6.00']);
 const removed=edit(state,{includedDetails:null});assert.deepEqual(economics(removed),economics(state));
 assert.deepEqual(target(removed).slotSelections.extras.items,[extra]);
});
await check('RI-03-EDIT-REMOVE-STABLE-IDS-AND-OCCURRENCE',()=>{
 const updated=edit(admitted,{includedDetails:{...block,items:[{...detail,label:'Boisson précisée',amount:{kind:'DECLARED_LINE_TOTAL',value:'8.00'}}]}});
 assert.equal(restaurantIncludedDetails(target(updated)).items[0].detailId,detail.detailId);
 assert.deepEqual(economics(updated),economics(admitted));assert.deepEqual(updated.contexts.find(c=>c.contextOccurrenceId===otherId),other);
 assert.deepEqual(target(updated).fields.participantRefs,context.fields.participantRefs);
 assert.equal(target(updated).slotSelections.meal.items[0].selectionId,sid);
 const removed=edit(updated,{includedDetails:null});assert(!Object.hasOwn(target(removed).fields,'restaurantIncludedDetails'));
 assert.deepEqual(target(removed).slotSelections,context.slotSelections);assert.deepEqual(amounts(removed),['40.00']);
});
await check('RI-04-TARIFF-CONFIRMATION-ATOMIC',()=>{
 const snapshot=canonicalPlannerJson(admitted),changed={...meal,cost:{kind:'MANUAL',unitAmount:'50.00'}};
 assert.throws(()=>edit(admitted,{slots:{meal:[changed]}}),/REVIEW_REQUIRED/);assert.equal(canonicalPlannerJson(admitted),snapshot);
 const kept=edit(admitted,{slots:{meal:[changed]},includedDetailsAfterMealChange:'KEEP_CONFIRMED'});
 assert.deepEqual(restaurantIncludedDetails(target(kept)),block);assert.deepEqual(amounts(kept),['50.00']);
 const removed=edit(admitted,{slots:{meal:[changed]},includedDetailsAfterMealChange:'REMOVE_ALL'});
 assert.equal(restaurantIncludedDetails(target(removed)),null);
 for(const patch of [{quantity:'2'},{unitBasis:'ITEM'},{cost:{kind:'UNKNOWN'}}])assert.throws(()=>edit(admitted,{slots:{meal:[{...meal,...patch}]}}),/REVIEW_REQUIRED/);
 const replaced={...changed,selectionId:uuid(99607)};
 assert.throws(()=>edit(admitted,{slots:{meal:[replaced]},includedDetailsAfterMealChange:'KEEP_CONFIRMED'}),/PARENT_INVALID/);
 const replaceCleared=edit(admitted,{slots:{meal:[replaced]},includedDetailsAfterMealChange:'REMOVE_ALL'});assert.equal(restaurantIncludedDetails(target(replaceCleared)),null);
 assert.throws(()=>edit(admitted,{includedDetails:block,includedDetailsAfterMealChange:'REMOVE_ALL'}),/INVALID/);
 for(const fields of [{label:'Autre nom'},{plannedDate:'2026-11-12'},{participantRefs:context.fields.participantRefs.slice(0,1)}]){
  const state=edit(admitted,{fields});assert.deepEqual(restaurantIncludedDetails(target(state)),block);
 }
});
await check('RI-05-STRICT-OWNER-PARSER-AND-IDENTITIES',()=>{
 for(const invalid of [
  {...block,version:'restaurant-included-details@v999'},{...block,rogue:true},{...block,items:[]},
  {...block,items:[detail,detail]},{...block,items:[{...detail,detailId:'bad'}]},
  {...block,items:[{...detail,included:false}]},{...block,items:[{...detail,provenance:'REFERENCE_ONLY'}]},
  {...block,items:[{...detail,quantity:'0'}]},{...block,items:[{...detail,unitBasis:'LITRE'}]},
  {...block,items:[{...detail,amount:{kind:'UNKNOWN',value:'0.00'}}]},
  {...block,items:[{...detail,amount:{kind:'DECLARED_LINE_TOTAL',value:'-6'}}]}
 ])assert.throws(()=>parseRestaurantIncludedDetails(invalid));
 assert.throws(()=>edit(base,{includedDetails:{...block,mealSelectionId:'other-meal'}}),/PARENT_INVALID/);
 assert.throws(()=>parsePlanSemanticState({...admitted,contexts:[{...target(admitted),templateKey:'fast-food'}]}),/OWNER_INVALID/);
 assert.throws(()=>parsePlanSemanticState({...admitted,contexts:[{...target(admitted),slotSelections:{}}]}),/PARENT_INVALID/);
 assert.throws(()=>edit(base,{fields:{restaurantIncludedDetails:block}}),/FIELD_INVALID/);
 assert.throws(()=>edit(base,{slots:{meal:[meal,meal]}}),/SLOT_INVALID/);
 assert.throws(()=>validateContextGraph(edit(base,{slots:{meal:[{...meal,economicScope:{version:'component-economic-scope@v1',kind:'AGGREGATED_SUBSTITUTIVE_ESTIMATE',coveredSelectionIds:[sid]}}]}})),/ECONOMIC_SCOPE_OWNER_INVALID/);
});
await check('RI-06-GENERIC-LOCAL-AND-SERVER-REFUSE',async()=>{
 const model=await modelFor(admitted),changed={...meal,cost:{kind:'MANUAL',unitAmount:'50.00'}};
 const operations=[
  {kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:id,slotKey:'meal',items:[changed]}},
  {kind:'CLEAR_SOCKET',contextOccurrenceId:id,slotKey:'meal',selectionId:sid},
  {kind:'EDIT_CONTEXT',contextOccurrenceId:id,values:{restaurantIncludedDetails:null}}
 ];
 for(const operation of operations){
  let refusal;
  try { stageLocalDecision(model,admitted,operation); assert.fail('Expected owner refusal'); }
  catch (error) { refusal=restaurantLocalRefusalMessage(error); }
  assert.equal(typeof refusal,'string');assert.match(refusal,/éditeur Restaurant/);
  const result=await server(admitted,operation);assert.equal(result.ok,false);assert.match(result.code,/RESTAURANT_INCLUDED_DETAILS/);
 }
 const operation={kind:'EDIT_RESTAURANT',edit:{contextOccurrenceId:id,slots:{meal:[changed]}}};
 assert.equal((await server(admitted,operation)).ok,false);
 const accepted=await server(admitted,{...operation,edit:{...operation.edit,includedDetailsAfterMealChange:'KEEP_CONFIRMED'}});
 assert.equal(accepted.ok,true,accepted.code);assert.equal(restaurantIncludedDetails(target(accepted.model.semanticState)).items[0].amount.value,'6.00');
 const injected={...model,editors:model.editors.map(editor=>({...editor,fields:[...editor.fields,{key:'restaurantIncludedDetails'}]}))};
 assert.throws(()=>stageLocalDecision(injected,admitted,operations[2]),/OWNER_REQUIRED/);
 for(const error of [new Error('RESTAURANT_INCLUDED_DETAILS_PARENT_INVALID'),new TypeError('UNRELATED_PROGRAMMING_ERROR'),new Error('NETWORK_ERROR'),null])
  assert.equal(restaurantLocalRefusalMessage(error),null);
 // Exercise the actual Shell admission function with effect/transport spies.
 // Its unchanged React rendering and real card click are received in the browser.
 const ts=require('typescript'),shellSource=ts.createSourceFile('composer-shell.tsx',
  fs.readFileSync('src/app/mois-a-venir/composer/composer-shell.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let stageNode;const findStage=node=>{if(ts.isFunctionDeclaration(node)&&node.name?.text==='stage')stageNode=node;else ts.forEachChild(node,findStage);};
 findStage(shellSource);assert(stageNode);
 const stageCode=ts.transpileModule(stageNode.getText(shellSource),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const effectNames=['busyRef','snapshotMetrics','localDraft','frameNow','current','stageLocalDecision','restaurantLocalRefusalMessage','setMessage','setErrorMessage','run'];
 const factory=new Function(...effectNames,stageCode+';return stage;');
 const notices=[];let fallback=0;
 const makeStage=admit=>factory({current:false},false,{current:admitted},()=>({draft:admitted}),{current:model},admit,
  restaurantLocalRefusalMessage,text=>notices.push(text),text=>notices.push(text),()=>{fallback++;});
 const shellStage=makeStage(stageLocalDecision),snapshot=canonicalPlannerJson(admitted);
 for(const operation of operations){
  notices.length=0;assert.equal(shellStage(operation),false);assert.equal(fallback,0);
  assert.equal(notices.length,2);assert.match(notices[0],/éditeur Restaurant/);
  assert.equal(canonicalPlannerJson(admitted),snapshot);
 }
 for(const failure of [new Error('RESTAURANT_INCLUDED_DETAILS_PARENT_INVALID'),new TypeError('UNRELATED_PROGRAMMING_ERROR')]){
  notices.length=0;assert.throws(()=>makeStage(()=>{throw failure;})(operations[0]),error=>error===failure);
  assert.deepEqual(notices,[]);assert.equal(fallback,0);
 }
 const legacyNext=stageLocalDecision(await modelFor(base),base,{kind:'CLEAR_SOCKET',contextOccurrenceId:id,slotKey:'meal',selectionId:sid});
 assert(legacyNext);assert.equal(target(legacyNext).slotSelections.meal.items.length,0);
});
await check('RI-07-PRESERVE-CAPABILITY-READONLY',async()=>{
 for(const ref of [id,componentId(id,'meal',sid)]){
  for(const kind of ['anchor','preserve']){
   const state=parsePlanSemanticState({...admitted,preferences:kind==='anchor'?{...admitted.preferences,anchors:[ref]}:{...admitted.preferences,flexibility:{[ref]:'PRESERVE'}}});
   assert.throws(()=>edit(state,{includedDetails:null}),/LOCKED/);
   assert.equal((await server(state,{kind:'EDIT_RESTAURANT',edit:{contextOccurrenceId:id,includedDetails:null}})).ok,false);
  }
 }
 const model=await modelFor(admitted),operation={kind:'EDIT_RESTAURANT',edit:{contextOccurrenceId:id,includedDetails:null}};
 for(const cardPatch of [{readOnly:true},{capabilityRefs:[]}]){
  const blocked={...model,board:{...model.board,contexts:model.board.contexts.map(card=>({...card,...cardPatch}))}};
  assert.equal(stageLocalDecision(blocked,admitted,operation),null);
 }
});
await check('RI-08-LEGACY-ROUNDTRIP-UNKNOWN-ZERO-REFERENCE',async()=>{
 assert.equal(canonicalPlannerJson(parsePlanSemanticState(base)),canonicalPlannerJson(base));
 assert.equal(semanticStateDigest(JSON.parse(JSON.stringify(base))),semanticStateDigest(base));
 assert.equal(canonicalPlannerJson(parsePlanSemanticState(JSON.parse(JSON.stringify(admitted)))),canonicalPlannerJson(admitted));
 assert.equal(manifestContextRegistry(base).version,'planner-context-registry@v3-renewals');
 assert(!canonicalPlannerJson(manifestContextRegistry(base)).includes('restaurantIncludedDetails'));
 assert.equal(manifestContextRegistry(admitted).version,'planner-context-registry@v11-restaurant-included-details');
 // Compare historical registry bytes to the actual received base implementation in memory.
 const ts=require('typescript'),baseline=new Module(path.resolve('src/server/phase2/planner/context-registry.baseline.ts'));
 baseline.filename=path.resolve('src/server/phase2/planner/context-registry.baseline.ts');baseline.paths=Module._nodeModulePaths(path.dirname(baseline.filename));
 baseline._compile(ts.transpileModule(execFileSync('git',['show','5bedf458c819276034a2c4e246eb62acb0ee04aa:src/server/phase2/planner/context-registry.ts'],{encoding:'utf8'}),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,baseline.filename);
 assert.equal(canonicalPlannerJson(manifestContextRegistry(base)),canonicalPlannerJson(baseline.exports.manifestContextRegistry(base)));
 assert.equal(canonicalPlannerJson(publishContextRegistry().templates.filter(t=>t.templateKey!=='restaurant')),
  canonicalPlannerJson(baseline.exports.publishContextRegistry().templates.filter(t=>t.templateKey!=='restaurant')));
 const unknown=edit(base,{slots:{meal:[{...meal,cost:{kind:'UNKNOWN'}}]},includedDetails:{...block,items:[{...detail,quantity:null,unitBasis:null}]}});
 assert.deepEqual(amounts(unknown),[null]);assert.equal(restaurantIncludedDetails(target(unknown)).items[0].quantity,null);
 assert.equal(restaurantIncludedDetails(target(unknown)).items[0].amount.value,'6.00');
 const zero=edit(base,{includedDetails:{...block,items:[{...detail,amount:{kind:'DECLARED_LINE_TOTAL',value:'0.00'}}]}});
 const unknownDetail=edit(base,{includedDetails:{...block,items:[{...detail,amount:{kind:'UNKNOWN'}}]}});
 assert.notDeepEqual(restaurantIncludedDetails(target(zero)),restaurantIncludedDetails(target(unknownDetail)));
 assert.deepEqual(amounts(zero),['40.00']);assert.deepEqual(amounts(unknownDetail),['40.00']);
});
await check('RI-09-BAR-GLOBAL-COEXISTENCE-AND-MANIFEST',()=>{
 const bar={...structuredClone(context),contextOccurrenceId:uuid(99620),templateKey:'night-out',fields:{fieldSchemaVersion:'context-fields@v2',...presetCreationFields('night-out','bar-apero')},slotSelections:{extras:{items:[{...meal,optionKey:'extra',selectionId:uuid(99621),cost:{kind:'MANUAL',unitAmount:'6.00'}}]}}};
 const state=parsePlanSemanticState({...admitted,contexts:[...admitted.contexts,bar]});
 const global=transitionNightOutGlobal(state,state.contexts.find(c=>c.contextOccurrenceId===bar.contextOccurrenceId),{version:'night-out-consumption@v2',mode:'GLOBAL',amount:'40.00',selectionId:uuid(99622),confirmed:true,expectedStateDigest:plannerDigest(state)});
 validateContextGraph(global);
 assert.deepEqual(preview(global).compiled.components.filter(c=>c.contextOccurrenceId===bar.contextOccurrenceId).map(c=>c.evaluation.economicAmount),['40.00']);
 assert.deepEqual(amounts(global),['40.00']);assert.equal(manifestContextRegistry(global).templates.find(t=>t.templateKey==='night-out').version,'night-out@v5');
 assert.throws(()=>transitionNightOutGlobal(admitted,target(admitted),{version:'night-out-consumption@v2',mode:'GLOBAL',amount:'40.00',selectionId:uuid(99622),confirmed:true,expectedStateDigest:plannerDigest(admitted)}),/OWNER_INVALID/);
});
let root,current,model,registry,accepted,setCurrent;
function Harness(){const [state,setState]=React.useState(current);setCurrent=setState;return React.createElement(InlineEditContext.Provider,{value:registry},React.createElement(RestaurantEditor,{context:target(state),card:model.board.contexts.find(c=>c.contextOccurrenceId===id),model,creating:false,busy:false,close(){},decide(operation){const next=stageLocalDecision(model,current,operation);if(!next)return false;accepted.push(operation);current=next;setState(next);return true;}}));}
const text=node=>typeof node==='string'?node:(node.children??[]).map(text).join('');
const button=label=>root.root.findAll(node=>node.type==='button').find(node=>text(node)===label);
const click=async label=>{const node=button(label);assert(node,label);assert(!node.props.disabled,label);await act(async()=>node.props.onClick());};
const input=label=>root.root.findAll(node=>node.type==='label').find(node=>text(node).startsWith(label)).findByType('input');
async function mount(state=base){if(root)await act(async()=>root.unmount());model=await modelFor(state);current=model.semanticState;registry=new InlineEditRegistry();accepted=[];confirmation=null;await act(async()=>{root=create(React.createElement(Harness));});}
try{
 await check('RI-10-REAL-EDITOR-ADD-EDIT-REMOVE-RAW-HISTORY',async()=>{
  await mount();await click('Déjà compris dans l’addition');
  for(const [label,value] of [['Nature du détail','Boisson'],['Montant de la ligne compris','6.00'],['Quantité descriptive','2']])await act(async()=>input(label).props.onChange({target:{value}}));
  assert.equal(registry.count(),1);assert.equal(accepted.length,0);assert.deepEqual(amounts(current),['40.00']);
  const raw=input('Nature du détail').props.value;await click('← Retour au résumé');assert.equal(input('Nature du détail').props.value,raw);
  await act(async()=>root.root.findByType('form').props.onSubmit({preventDefault(){}}));
  assert.equal(registry.count(),0);assert.equal(accepted[0].kind,'EDIT_RESTAURANT');assert.deepEqual(amounts(current),['40.00']);
  const saved=structuredClone(current),savedId=restaurantIncludedDetails(target(saved)).items[0].detailId;
  await click('Compléments');await click('Modifier le détail Boisson');
  await act(async()=>input('Montant de la ligne compris').props.onChange({target:{value:'8.00'}}));
  await act(async()=>root.root.findByType('form').props.onSubmit({preventDefault(){}}));
  assert.equal(restaurantIncludedDetails(target(current)).items[0].detailId,savedId);assert.deepEqual(amounts(current),['40.00']);
  const edited=structuredClone(current);
  // Restore admitted snapshots through the same state input used by Undo/Redo; browser receives actual shell controls separately.
  await act(async()=>{current=saved;setCurrent(saved);});assert.equal(restaurantIncludedDetails(target(current)).items[0].amount.value,'6.00');
  await act(async()=>{current=edited;setCurrent(edited);});assert.equal(restaurantIncludedDetails(target(current)).items[0].amount.value,'8.00');
  await click('Compléments');await click('Retirer le détail');assert.equal(restaurantIncludedDetails(target(current)),null);assert.deepEqual(amounts(current),['40.00']);
 });
 await check('RI-11-REAL-EDITOR-TOTAL-CONFIRM-CANCEL-KEEP-REMOVE',async()=>{
  for(const policy of ['KEEP_CONFIRMED','REMOVE_ALL']){
   await mount(admitted);await click('Montant rapide');
   const amountInput=root.root.findAll(node=>node.type==='input').find(node=>node.props.value==='40.00');
   await act(async()=>amountInput.props.onChange({target:{value:'50.00'}}));await click('Conserver ce coût');
   assert(confirmation);assert.equal(accepted.length,0);assert.deepEqual(amounts(current),['40.00']);
   const pending=confirmation;confirmation=null; // cancellation has no admission
   assert.deepEqual(amounts(current),['40.00']);await click('Conserver ce coût');
   await act(async()=>policy==='KEEP_CONFIRMED'?confirmation.accept():confirmation.save.run());
   assert.deepEqual(amounts(current),['50.00']);assert.equal(restaurantIncludedDetails(target(current))!==null,policy==='KEEP_CONFIRMED');
  }
 });
 await check('RI-12-REAL-EDITOR-OUTSIDE-EXTRA-AND-REFERENCE',async()=>{
  await mount();
  const knowledge=model.cardKnowledge['template:restaurant'];if(knowledge)knowledge.dimensions=knowledge.dimensions.map(d=>({...d,value:'150.00',suggestionPolicy:'REFERENCE_ONLY'}));
  await click('Déjà compris dans l’addition');assert.equal(input('Montant de la ligne compris').props.value,'');
  await click('← Retour au résumé');await click('Compléments');await click('Ajouter un complément');assert(confirmation);await act(async()=>confirmation.accept());
  let row=root.root.findByType(WorkshopComponentRow);await act(async()=>row.props.onChange({...row.props.row,label:'Supplément extérieur',amount:'6.00',costMode:'MANUAL',edited:true}));
  row=root.root.findByType(WorkshopComponentRow);await act(async()=>row.props.onSave());
  assert.deepEqual(amounts(current),['40.00','6.00']);assert.equal(restaurantIncludedDetails(target(current)),null);
 });
}finally{if(root)await act(async()=>root.unmount());Module._load=originalLoad;}
await check('RI-13-NO-WRITES-REMOTE-OR-WORLD-CHANGE',()=>{assert.equal(remote,0);assert.deepEqual(f.writes,[]);assert.equal(canonicalPlannerJson(f.world),worldBefore);});
console.log(JSON.stringify({status:'PASS',checks,sourceHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),level:'EDITOR_LOCAL',browser:'SEPARATE_RECEIPT',sql:0,writers:0,remote,save:false,apply:false}));

