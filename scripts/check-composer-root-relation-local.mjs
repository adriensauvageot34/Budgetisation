import assert from 'node:assert/strict';
import fs from 'node:fs';
import { localRelationsFixture } from './fixtures/composer-root-relation-local.mjs';
import { uuid } from './fixtures/planner-headless.mjs';
import { require } from './lib/phase2-ts-loader.mjs';
const {rootRelationPost} = require('@/server/phase2/planner/root-relation-http');
const {BootstrapAuthenticationRequiredError} = require('@/server/bootstrap/errors');
const {ROOT_RELATION_HTTP_CONTRACT:contract} = require('@/domain/phase2/planner/root-relation-ui-contract');
const {composerLocalFrameDigest:digest,guardRootMemberTransition:guard,rootRelationDocument} = require('@/domain/phase2/planner/root-relation-local');
const {parsePlanSemanticState} = require('@/domain/phase2/planner/semantic-state');
const {presetCreationFields} = require('@/domain/phase2/planner/composer-presets');
let remote=0;globalThis.fetch=async()=>{remote++;throw Error('N1B_REMOTE_FORBIDDEN');};
const f=await localRelationsFixture(), world=JSON.stringify(f.world), base=JSON.stringify(f.base), checks=[];
let sequence=0,token='',frame=f.frame; const [a,b,c]=f.ids,g=f.groupId;
const common=()=>({sequence:++sequence,targetMonth:'2026-11',binding:f.binding,frame});
async function call(raw,scope=f.scope(),headers={}) {
  const request=new Request('http://127.0.0.1/api/composer/root-relations',{method:'POST',headers:{origin:'http://127.0.0.1','Content-Type':'application/json','X-Composer-Root-Relation-Contract':contract,...headers},body:JSON.stringify(raw)});
  const response=await rootRelationPost(request,async()=>{if(scope instanceof Error)throw scope;return scope;});
  assert.equal(response.headers.get('cache-control'),'private, no-store');return {status:response.status,body:await response.json()};
}
async function check(name,fn){await fn();checks.push(name);console.log(name+' PASS');}
async function execute(mutation){const source=digest(frame),r=await call({...common(),kind:'MUTATE',authorityToken:token,expectedStateDigest:source,mutation});assert.equal(r.body.ok,true,JSON.stringify(r.body));assert.equal(r.body.sourceDigest,source);frame=r.body.frame;token=r.body.authorityToken;return structuredClone(frame);}
async function restore(proposed){const r=await call({...common(),kind:'RESTORE',authorityToken:token,expectedStateDigest:digest(frame),proposed});assert.equal(r.body.ok,true,JSON.stringify(r.body));frame=r.body.frame;assert.equal(digest(frame),digest(proposed));}
const create={kind:'CREATE_ROOT_RELATION',relationId:g,orderedContextIds:[a,b]};let linked,reordered,detached;
await check('T5_HTTP_READ_AND_PRIVATE_DRAFT_SCOPE',async()=>{const r=await call({...common(),kind:'READ'});assert.equal(r.body.ok,true,JSON.stringify(r.body));token=r.body.authorityToken;assert.equal(r.body.capabilities.capabilities[0].status,'AVAILABLE');assert(f.draftReads.some(r=>r.filters.some(([k,v])=>k==='owner_user_id'&&v===f.userId)));});
await check('T1_T2_T3_HTTP_OWNER_ADMISSION',async()=>{linked=await execute(create);assert.deepEqual(linked.relations[0].orderedContextIds,[a,b]);reordered=await execute({kind:'REORDER_ROOT_RELATION',relationId:g,orderedContextIds:[b,a]});assert.equal(reordered.relations[0].relationId,g);detached=await execute({kind:'DETACH_ROOT_RELATION_MEMBER',relationId:g,contextOccurrenceId:b});assert.equal(detached.relations.length,0);for(const s of [linked,reordered,detached])assert.deepEqual(s.draft,f.base);});
await check('T4_RESTORE_THROUGH_OWNER',async()=>{await restore(reordered);await restore(linked);await restore(f.frame);await restore(linked);await restore(reordered);await restore(detached);});
await check('ADD_REMOVE_AND_HISTORY',async()=>{await restore(linked);const expanded=await execute({kind:'ADD_ROOT_RELATION_MEMBER',relationId:g,contextOccurrenceId:c});assert.deepEqual(expanded.relations[0].orderedContextIds,[a,b,c]);const removed=await execute({kind:'REMOVE_ROOT_RELATION',relationId:g});assert.equal(removed.relations.length,0);await restore(expanded);await restore(removed);});
await check('T5_HTTP_REFUSALS',async()=>{
  const read={...common(),kind:'READ'}, request={...common(),kind:'MUTATE',authorityToken:token,expectedStateDigest:digest(frame),mutation:create};
  for(const [name,raw,scope,code] of [
    ['session',read,new BootstrapAuthenticationRequiredError(),'AUTHENTICATION_REQUIRED'],
    ['household',read,f.scope({householdId:uuid(98990)}),'N1_DRAFT_ACCESS_DENIED'],
    ['user',read,f.scope({userId:uuid(98991)}),'N1_DRAFT_ACCESS_DENIED'],
    ['month',{...read,targetMonth:'2026-12'},f.scope(),'N1_DRAFT_ACCESS_DENIED'],
    ['grant',read,f.scope({editorEnabled:false}),'N1_PERMISSION_DENIED'],
    ['fabricated grant',{...request,canManageRelations:true},f.scope(),'PLANNER_FIELDS_INVALID'],
    ['client model',{...request,model:{forged:true}},f.scope(),'PLANNER_FIELDS_INVALID'],
    ['model stale',{...request,authorityToken:'stale'},f.scope(),'N1_AUTHORITY_STALE'],
    ['digest stale',{...request,expectedStateDigest:'0'.repeat(64)},f.scope(),'N1_STATE_STALE'],
    ['draft CAS',{...request,binding:{...f.binding,version:2}},f.scope(),'N1_DRAFT_VERSION_CHANGED'],
  ]){const r=await call(raw,scope);assert.equal(r.body.ok,false,name);assert.equal(r.body.code,code,name);}
  assert.equal((await call(read,f.scope(),{origin:'https://other.invalid'})).status,403);
  // Negative fault injection at the SERVER publisher boundary, never a client authority or a positive auth proof.
  const publisher=require('@/server/phase2/planner/composer-service'),original=publisher.handleComposerRequest;
  publisher.handleComposerRequest=async(...args)=>{const result=await original(...args);if(result.ok)result.model.board.contexts.find(x=>x.contextOccurrenceId===a).capabilityRefs=[];return result;};
  try { const r=await call(request);assert.equal(r.body.code,'N1_MEMBER_PERMISSION_DENIED',JSON.stringify(r.body)); }
  finally { publisher.handleComposerRequest=original; }
});
await check('T6_COMPLETE_TRANSITION_GUARD_AND_ATOMICITY',()=>{
  for(const [kind,change] of [['remove',d=>d.contexts.filter(x=>x.contextOccurrenceId!==a)],['reparent',d=>d.contexts.map(x=>x.contextOccurrenceId===a?{...x,parentContextOccurrenceId:c}:x)],['status',d=>d.contexts.map(x=>x.contextOccurrenceId===a?{...x,status:'CANCELLED'}:x)],['template',d=>d.contexts.map(x=>x.contextOccurrenceId===a?{...x,templateKey:'activity'}:x)],['preset',d=>d.contexts.map(x=>x.contextOccurrenceId===a?{...x,fields:{...x.fields,...presetCreationFields('night-out','nightclub')}}:x)]]) {
    const before=JSON.stringify(linked);const next={...linked.draft,contexts:change(linked.draft)};assert.throws(()=>guard(linked.draft,next,linked.relations),undefined,kind);assert.equal(JSON.stringify(linked),before);
  }
  assert.throws(()=>guard(linked.draft,{...linked.draft,targetMonth:'2026-12'},linked.relations));
});
await check('T7_VERSION_BOUNDARY_AND_NO_DOWNGRADE',()=>{assert.throws(()=>parsePlanSemanticState(rootRelationDocument(linked)));for(const file of ['src/app/mois-a-venir/composer/composer-shell.tsx','src/server/phase2/planner/root-relation-admission.ts'])assert(!fs.readFileSync(file,'utf8').includes('rootRelationBaseState'));});
await check('T9_NEUTRALITY',()=>{assert.equal(JSON.stringify(f.world),world);assert.equal(JSON.stringify(f.base),base);assert.deepEqual(f.writes,[]);assert.equal(remote,0);});
console.log(JSON.stringify({status:'PASS',checks,level:'HTTP_SYNTHETIC_SCOPE_REAL_OWNERS',sql:0,writers:f.writes.length,remote,authRls:'NOT_RUN',saved:'NOT_RUN',fresh:'NOT_RUN',apply:'NOT_RUN'}));
