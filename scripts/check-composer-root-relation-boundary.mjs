/** F01 regression: real admission/owners, synthetic private rows and Auth only. Never a live RLS certificate. */
import assert from 'node:assert/strict';
import {require} from './lib/phase2-ts-loader.mjs';
import {localRelationsFixture} from './fixtures/composer-root-relation-local.mjs';
import {uuid} from './fixtures/planner-headless.mjs';
const {rootRelationPost}=require('@/server/phase2/planner/root-relation-http');
const {ROOT_RELATION_HTTP_CONTRACT:contract}=require('@/domain/phase2/planner/root-relation-ui-contract');
const {composerLocalFrameDigest:digest}=require('@/domain/phase2/planner/root-relation-local');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {presetCreationFields}=require('@/domain/phase2/planner/composer-presets');
const {stageLocalDecision}=require('@/app/mois-a-venir/composer/local-draft');
const {BootstrapAuthenticationRequiredError}=require('@/server/bootstrap/errors');
let remote=0;globalThis.fetch=async()=>{remote++;throw Error('F01_REMOTE_FORBIDDEN');};
const f=await localRelationsFixture(),[a,b,c]=f.ids,g=f.groupId,world=JSON.stringify(f.world);let sequence=0;
const checks=[];async function check(name,fn){await fn();checks.push(name);console.log(name+' PASS');}
async function call(frame,kind='READ',extra={},scope=f.scope()){
 const body={kind,sequence:++sequence,targetMonth:'2026-11',binding:{draftId:f.draftId,version:f.row.draft_version},frame,...extra};
 const r=await rootRelationPost(new Request('http://fixture.test/api/composer/root-relations',{method:'POST',headers:{origin:'http://fixture.test','Content-Type':'application/json','X-Composer-Root-Relation-Contract':contract},body:JSON.stringify(body)}),async()=>{if(scope instanceof Error)throw scope;return scope;});
 return {status:r.status,body:await r.json()};
}
const create={kind:'CREATE_ROOT_RELATION',relationId:g,orderedContextIds:[a,b]};
async function mutate(frame,mutation=create,token){const read=token?null:await call(frame);assert(read===null||read.body.ok,JSON.stringify(read));return call(frame,'MUTATE',{authorityToken:token??read.body.authorityToken,expectedStateDigest:digest(frame),mutation});}
const stored=state=>{f.row.semantic_state=state;f.row.semantic_state_digest=semanticStateDigest(state);};
await check('F01_A_PRESERVE_CANNOT_BE_CLEARED_BY_CLIENT',async()=>{
 const protectedState={...f.base,preferences:{...f.base.preferences,flexibility:{[a]:'PRESERVE'}}};stored(protectedState);
 const normal={draft:protectedState,relations:[]},read=await call(normal);assert(read.body.ok);
 assert.equal((await mutate(normal,create,read.body.authorityToken)).body.code,'N1_MEMBER_PRESERVED');
 const altered={draft:f.base,relations:[]},before=JSON.stringify(f.row);
 assert.equal((await call(altered)).body.code,'N1_DRAFT_AUTHORITY_MISMATCH');
 assert.equal((await mutate(altered,create,read.body.authorityToken)).body.code,'N1_DRAFT_AUTHORITY_MISMATCH');assert.equal(JSON.stringify(f.row),before);
});
await check('F01_B_SAVED_PRESET_AND_IDENTITY_CANNOT_BE_RECLASSIFIED',async()=>{
 const off={...f.base,contexts:f.base.contexts.map(x=>x.contextOccurrenceId===a?{...x,fields:{...x.fields,...presetCreationFields('night-out','nightclub')}}:x)};stored(off);
 const normal={draft:off,relations:[]},read=await call(normal);assert(read.body.ok);assert.equal((await mutate(normal,create,read.body.authorityToken)).body.code,'N1_MEMBER_NOT_ADMITTED');
 assert.equal((await call({draft:f.base,relations:[]})).body.code,'N1_DRAFT_AUTHORITY_MISMATCH');stored(f.base);
 for(const patch of [x=>({...x,contextOccurrenceId:uuid(99981)}),x=>({...x,templateKey:'activity'}),x=>({...x,parentContextOccurrenceId:c})]){
  const frame={draft:{...f.base,contexts:f.base.contexts.map(x=>x.contextOccurrenceId===a?patch(x):x)},relations:[]};assert.equal((await call(frame)).body.ok,false);
 }
 for(const key of ['status','provenance']){const frame={draft:{...f.base,contexts:f.base.contexts.map(x=>x.contextOccurrenceId===a?{...x,[key]:'FORGED'}:x)},relations:[]};assert.equal((await call(frame)).body.ok,false);}
 const anchor={...f.base,preferences:{...f.base.preferences,anchors:[a]}};stored(anchor);assert.equal((await call({draft:f.base,relations:[]})).body.code,'N1_DRAFT_AUTHORITY_MISMATCH');stored(f.base);
 const otherMonth={...f.base,contexts:f.base.contexts.map(x=>x.contextOccurrenceId===a?{...x,fields:{...x.fields,plannedDate:'2026-12-12'}}:x)};stored(otherMonth);assert.equal((await call({draft:f.base,relations:[]})).body.code,'N1_DRAFT_AUTHORITY_MISMATCH');stored(f.base);
});
let dirty,linked,reordered;
await check('F01_C_REAL_STAGING_FINANCIAL_DELTA_AND_FIVE_OWNER_COMMANDS',async()=>{
 const card=[...f.access.model.board.baselineControls,...f.access.model.board.discretionaryControls].find(x=>x.label==='Courses');
 dirty=stageLocalDecision(f.access.model,f.base,{kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:card.targetRef,value:{amount:'350.00'}}});assert(dirty);assert.notEqual(semanticStateDigest(dirty),semanticStateDigest(f.base));
 dirty={...dirty,contexts:dirty.contexts.map(x=>x.contextOccurrenceId===a?{...x,fields:{...x.fields,plannedDate:'2026-11-15'}}:x),preferences:{...dirty.preferences,flexibility:{[a]:'WILLING_TO_ADJUST'}}};
 let frame={draft:dirty,relations:[]};const run=async mutation=>{const r=await mutate(frame,mutation);assert(r.body.ok,JSON.stringify(r));frame=r.body.frame;assert.deepEqual(frame.draft,dirty);return structuredClone(frame);};
 linked=await run(create);reordered=await run({kind:'REORDER_ROOT_RELATION',relationId:g,orderedContextIds:[b,a]});assert.equal(reordered.relations[0].relationId,g);
 await run({kind:'ADD_ROOT_RELATION_MEMBER',relationId:g,contextOccurrenceId:c});await run({kind:'DETACH_ROOT_RELATION_MEMBER',relationId:g,contextOccurrenceId:c});
 await run({kind:'REMOVE_ROOT_RELATION',relationId:g});assert.equal(frame.relations.length,0);
 const detached=await mutate(linked,{kind:'DETACH_ROOT_RELATION_MEMBER',relationId:g,contextOccurrenceId:b});assert(detached.body.ok);assert.equal(detached.body.frame.relations.length,0);assert.deepEqual(detached.body.frame.draft,dirty);
});
await check('F01_D_RESTORE_REVALIDATES_SENSITIVE_PROPERTIES_AND_HISTORY',async()=>{
 const read=await call(reordered);const restore=proposed=>call(reordered,'RESTORE',{authorityToken:read.body.authorityToken,expectedStateDigest:digest(reordered),proposed});
 const valid=await restore(linked);assert(valid.body.ok);assert.deepEqual(valid.body.frame,linked);
 const before=JSON.stringify(reordered);
 for(const proposed of [
  {...linked,draft:{...dirty,preferences:{...dirty.preferences,anchors:[a]}}},
  {...linked,draft:{...dirty,preferences:{...dirty.preferences,flexibility:{[a]:'PRESERVE'}}}},
  {draft:{...dirty,contexts:dirty.contexts.map(x=>x.contextOccurrenceId===a?{...x,fields:{...x.fields,...presetCreationFields('night-out','nightclub')}}:x)},relations:[]},
  {draft:{...dirty,contexts:dirty.contexts.filter(x=>x.contextOccurrenceId!==a)},relations:[]},
 ])assert.equal((await restore(proposed)).body.code,'N1_DRAFT_AUTHORITY_MISMATCH');
 assert.equal(JSON.stringify(reordered),before);
 const undoFinancial=await restore({draft:f.base,relations:[]});assert(undoFinancial.body.ok);assert.deepEqual(undoFinancial.body.frame,{draft:f.base,relations:[]});
});
await check('F01_E_SCOPE_VERSION_GRANT_AND_DIGEST',async()=>{
 const frame={draft:f.base,relations:[]};const read=await call(frame);assert(read.body.ok);
 for(const scope of [new BootstrapAuthenticationRequiredError(),f.scope({householdId:uuid(99881)}),f.scope({userId:uuid(99882)}),f.scope({editorEnabled:false})])assert.equal((await call(frame,'READ',{},scope)).body.ok,false);
 for(const extra of [{targetMonth:'2026-12'},{binding:{...f.binding,version:2}},{binding:{draftId:uuid(99883),version:1}},{canManageRelations:true},{model:{fake:true}},{userId:f.userId},{householdId:uuid(99884)}])assert.equal((await call(frame,'READ',extra)).body.ok,false);
 assert.equal((await call(frame,'MUTATE',{authorityToken:read.body.authorityToken,expectedStateDigest:'0'.repeat(64),mutation:create})).body.code,'N1_STATE_STALE');
 assert.equal((await mutate(frame,create,'stale')).body.code,'N1_AUTHORITY_STALE');
});
await check('F01_TRUSTED_C4_CAPABILITY_CANNOT_BE_REPLACED_BY_PROPOSED_C4',async()=>{
 const publisher=require('@/server/phase2/planner/composer-service'),original=publisher.handleComposerRequest;
 publisher.handleComposerRequest=async(...args)=>{const r=await original(...args);if(r.ok&&semanticStateDigest(args[2].draft)===semanticStateDigest(f.base))r.model.board.contexts.find(x=>x.contextOccurrenceId===a).capabilityRefs=[];return r;};
 try{const r=await mutate({draft:dirty,relations:[]});assert.equal(r.body.code,'N1_MEMBER_PERMISSION_DENIED');
  const restore=await call(linked,'RESTORE',{authorityToken:'not-an-authority',expectedStateDigest:digest(linked),proposed:linked});assert.equal(restore.body.code,'N1_MEMBER_PERMISSION_DENIED');
 }finally{publisher.handleComposerRequest=original;}
});
await check('F01_NEW_LOCAL_CONTEXT_KEPT_BUT_NOT_ELIGIBLE_UNTIL_SAVED',async()=>{
 const id=uuid(99885),newContext={...f.base.contexts[0],contextOccurrenceId:id},frame={draft:{...f.base,contexts:[...f.base.contexts,newContext]},relations:[]},before=JSON.stringify(frame);
 const read=await call(frame);assert(read.body.ok);assert(!read.body.capabilities.capabilities[0].eligibleContextIds.includes(id));
 const mutation={...create,orderedContextIds:[a,id]};assert.equal((await mutate(frame,mutation,read.body.authorityToken)).body.code,'N1_MEMBER_REQUIRES_SAVED_CONTEXT');assert.equal(JSON.stringify(frame),before);
 // Simulate an authoritative saved row/version, not a real Save or a persistence certificate.
 stored(frame.draft);f.row.draft_version=2;const after=await mutate(frame,mutation);assert(after.body.ok);assert.deepEqual(after.body.frame.draft,frame.draft);stored(f.base);f.row.draft_version=1;
});
assert.equal(JSON.stringify(f.world),world);assert.equal(f.writes.length,0);assert.equal(remote,0);
console.log(JSON.stringify({status:'PASS',checks,level:'SYNTHETIC_AUTH_REAL_HTTP_READ_C4_N1_OWNER',realWriters:0,sql:0,remote,authRls:'NOT_RUN',saved:'NOT_RUN',apply:'NOT_RUN'}));
