import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fs,path,here,require,clone,fixture,parentId,parent,noneOperation,bareFixture,d1Fixture,editNightOut,plannerDigest } from './runtime.mjs';
import { Frames } from './frames.mjs';
import { createDatabase } from './database.mjs';
const {substituteNightOutCoverage}=require('@/domain/phase2/planner/night-out-edit');
const checks=[];
async function isolated(initial,run){const db=await createDatabase();try{await db.seed(initial);const f=new Frames(await db.read(),fixture());await f.operation(noneOperation(f.state));assert.equal((await f.save(db.scope())).ok,true);await run(f,db);}finally{await db.close();}}
async function saved(f,db){const expected=clone(f.state),r=await f.save(db.scope());assert.equal(r.ok,true,JSON.stringify(r));assert.deepEqual((await db.read()).semanticState,expected);return expected;}
async function cycle(f,db,operation){const before=clone(f.state);await f.operation(operation);const after=await saved(f,db);f.undo();assert.deepEqual(f.state,before);await saved(f,db);f.redo();assert.deepEqual(f.state,after);await saved(f,db);}
async function check(id,run){await run();checks.push({id,result:'PASS'});console.log(id+' PASS');}
function direct(state,amount){return{kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:parentId,fields:{},consumption:{mode:'DIRECT',expectedContextDigest:plannerDigest(parent(state)),amount,selectionId:randomUUID(),acceptLegacy:true}}};}
function global(state,mode,amount){return{kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:parentId,fields:{},globalConsumption:{version:'night-out-consumption@v2',mode,expectedStateDigest:plannerDigest(state),confirmed:true,selectionId:randomUUID(),...(amount===undefined?{}:{amount})}}};}
function initialV1(){const state=bareFixture();return editNightOut(state,direct(state,'20').edit);}
function initialV2(){const state=bareFixture();return editNightOut(state,global(state,'GLOBAL','40').edit);}
await check('I01_V1_AMOUNT_AND_MODE_EXACT_UNDO_SAVE_RELOAD_REDO',()=>isolated(initialV1(),async(f,db)=>{
 await cycle(f,db,direct(f.state,'30'));
 await cycle(f,db,{kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:parentId,fields:{},consumption:{mode:'DETAILED',expectedContextDigest:plannerDigest(parent(f.state))}}});
}));
await check('I02_V2_MODES_AND_AMOUNT_EXACT_UNDO_SAVE_RELOAD_REDO',()=>isolated(initialV2(),async(f,db)=>{
 await cycle(f,db,global(f.state,'DETAILED'));
 await cycle(f,db,global(f.state,'GLOBAL','65'));
}));
await check('I03_COVERAGE_REPLACEMENT_ORIGINAL_IDS_RESTORED_BY_OWNER',async()=>{
 const start=bareFixture(),item=clone(parent(d1Fixture()).slotSelections.extras.items[0]);
 const aggregate={...item,economicScope:{version:'component-economic-scope@v1',kind:'AGGREGATED_SUBSTITUTIVE_ESTIMATE',coveredSelectionIds:[item.selectionId]}};
 const initial=editNightOut(start,{contextOccurrenceId:parentId,fields:{},slots:{extras:[aggregate]}});
 await isolated(initial,async(f,db)=>{const replacement={...item,selectionId:randomUUID()};await cycle(f,db,{kind:'EDIT_NIGHT_OUT',edit:substituteNightOutCoverage(parent(f.state),aggregate.selectionId,replacement)});});
});
await check('I04_FIRST_MODE_ADOPTION_CANNOT_CLEAR_ABSENT_METADATA',async()=>{
 for(const operation of[direct,((s)=>global(s,'GLOBAL','40'))])await isolated(bareFixture(),async(f,db)=>{
  const prior=clone(f.state);await f.operation(operation(f.state,'20'));await saved(f,db);const row=await db.raw(),snapshot=await db.snapshot();
  f.undo();assert.deepEqual(f.state,prior);assert.throws(()=>f.request(),/HISTORY_OWNER_REQUIRED/);assert.deepEqual(await db.raw(),row);assert.equal(await db.snapshot(),snapshot);
  f.redo();await saved(f,db);
 });
});
await check('I05_V1_INACTIVE_PREIMAGE_NOT_SILENTLY_NORMALISED',async()=>{
 const directState=initialV1(),initial=editNightOut(directState,{contextOccurrenceId:parentId,fields:{},consumption:{mode:'DETAILED',expectedContextDigest:plannerDigest(parent(directState))}});
 await isolated(initial,async(f,db)=>{const prior=clone(f.state);await f.operation(direct(f.state,'99'));await saved(f,db);const snapshot=await db.snapshot();f.undo();assert.deepEqual(f.state,prior);assert.throws(()=>f.request(),/HISTORY_OWNER_REQUIRED/);assert.equal(await db.snapshot(),snapshot);});
});
fs.writeFileSync(path.join(here,'specialised-history-proof.json'),JSON.stringify({checks,allDatabasesClosed:true,level:'EXISTING_OWNERS_SAVE_RELOAD_EXACT_PREIMAGES',expectedOwnerRefusals:['I04','I05']},null,2));
console.log(JSON.stringify({result:'PASS',groups:checks.length}));
