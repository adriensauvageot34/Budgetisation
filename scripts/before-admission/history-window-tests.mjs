import assert from'node:assert/strict';import{fs,path,here,fixture,bareFixture,noneOperation,child,plannerDigest}from'./runtime.mjs';import{Frames}from'./frames.mjs';import{createDatabase}from'./database.mjs';
const db=await createDatabase(),scope=db.scope(),checks=[];
try{
 await db.seed(bareFixture());const f=new Frames(await db.read(),fixture());const oldest=f.state;await f.operation(noneOperation(f.state));assert.equal((await f.save(scope)).ok,true);
 // The 64-step transport bound is per unsaved trace, not a lifetime limit on useful recent Undo.
 for(let i=1;i<=65;i++){await f.operation(noneOperation(f.state,{placeRef:{kind:'TEXT',label:'Choix '+i}}));if(i%5===0)assert.equal((await f.save(scope)).ok,true);}
 f.undo();assert.equal(child(f.state).fields.placeRef.label,'Choix 64');const result=await f.save(scope);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(child((await db.read()).semanticState).fields.placeRef.label,'Choix 64');
 const before=await db.snapshot();f.history.select(oldest);assert.throws(()=>f.history.envelope(oldest),/UNKNOWN_BASE/);assert.equal(await db.snapshot(),before);
 checks.push({id:'H05_RECENT_UNDO_AFTER_65_SAVED_GESTURES',result:'PASS'});console.log(checks[0].id+' PASS');
}finally{await db.close();fs.writeFileSync(path.join(here,'history-window-proof.json'),JSON.stringify({checks,databaseClosed:true,olderFrames:'EXPLICIT_REFUSAL_NOT_RETARGETED',level:'ACTUAL_OWNERS_SAVE_SQL_RECENT_HISTORY'},null,2));}
