import assert from 'node:assert/strict';
import {require} from './lib/phase2-ts-loader.mjs';
import {rootRelationsFixture} from './fixtures/planner-root-relations.mjs';
import {uuid,activity} from './fixtures/planner-headless.mjs';
let remote=0;globalThis.fetch=async()=>{remote++;throw Error('N1_REMOTE_FORBIDDEN');};
const {admitRootRelationMutation:admit,publishRootRelationCapabilities:publish}=require('@/server/phase2/planner/semantic-mutations');
const {parseRootRelationPlanState:parse,readRootRelationPlanState:read,upgradePlanForRootRelations:upgrade,
  rootRelationBaseState:baseState,rootRelationStateDigest:digest,serializeRootRelationPlanState:serialize}=require('@/domain/phase2/planner/root-relation-state');
const {parsePlanSemanticState,semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {presetCreationFields}=require('@/domain/phase2/planner/composer-presets');
const f=await rootRelationsFixture(),worldBefore=JSON.stringify(f.world),base=upgrade(f.base),original=JSON.stringify(base);
const [a,b,c,d]=f.ids,g=f.groupId,h=f.otherGroupId;
const create=(id,members)=>({kind:'CREATE_ROOT_RELATION',relationId:id,orderedContextIds:members});
function command(state,mutation){return {targetMonth:state.targetMonth,expectedStateDigest:publish(state,f.access).stateDigest,mutation};}
function execute(state,mutation,authority=f.access){return admit(state,command(state,mutation),authority);}
function refused(code,fn,input){const before=input&&JSON.stringify(input);assert.throws(fn,error=>error.code===code,code);if(input)assert.equal(JSON.stringify(input),before,'Atomic refusal');}
function unchanged(state){assert.deepEqual(baseState(state),f.base);assert.equal(JSON.stringify(f.world),worldBefore);assert.deepEqual(f.writes,[]);assert.equal(remote,0);}
const checks=[];async function check(name,run){await run();checks.push(name);console.log(name+' PASS');}
let linked,reordered,expanded;
await check('N1-01-CREATE-WITH-REAL-CAPABILITIES',()=>{
  const cap=publish(base,f.access);assert.equal(cap.capabilities[0].status,'AVAILABLE');assert.deepEqual(cap.capabilities[0].eligibleContextIds,f.ids);
  linked=execute(base,create(g,[a,b]));assert.equal(linked.rootRelations.length,1);assert.deepEqual(linked.rootRelations[0].orderedContextIds,[a,b]);
  assert.equal(linked.rootRelations[0].relationId,g);assert.equal(linked.contexts.length,4);unchanged(linked);assert.equal(JSON.stringify(base),original);
});
await check('N1-02-REORDER-ADD-AND-DETERMINISM',()=>{
  reordered=execute(linked,{kind:'REORDER_ROOT_RELATION',relationId:g,orderedContextIds:[b,a]});
  assert.equal(reordered.rootRelations[0].relationId,g);assert.deepEqual(reordered.rootRelations[0].orderedContextIds,[b,a]);unchanged(reordered);
  assert.notEqual(digest(linked),digest(reordered));assert.deepEqual(execute(base,create(g,[a,b])),linked);
  expanded=execute(reordered,{kind:'ADD_ROOT_RELATION_MEMBER',relationId:g,contextOccurrenceId:c});
  assert.deepEqual(expanded.rootRelations[0].orderedContextIds,[b,a,c]);unchanged(expanded);
});
await check('N1-03-DETACH-AND-SINGLETON-DISSOLUTION',()=>{
  const detached=execute(expanded,{kind:'DETACH_ROOT_RELATION_MEMBER',relationId:g,contextOccurrenceId:b});
  assert.deepEqual(detached.rootRelations[0].orderedContextIds,[a,c]);unchanged(detached);
  const dissolved=execute(linked,{kind:'DETACH_ROOT_RELATION_MEMBER',relationId:g,contextOccurrenceId:b});
  assert.deepEqual(dissolved.rootRelations,[]);unchanged(dissolved);
});
await check('N1-04-REMOVE-ONLY-RELATION-AND-OTHER-RELATION-PRESERVED',()=>{
  const two=execute(linked,create(h,[c,d]));const removed=execute(two,{kind:'REMOVE_ROOT_RELATION',relationId:g});
  assert.equal(removed.rootRelations.length,1);assert.deepEqual(removed.rootRelations[0].orderedContextIds,[c,d]);unchanged(removed);
  assert.equal(publish(two,f.access).capabilities[0].status,'BLOCKED');
});
await check('N1-05-ADMISSION-REFUSALS-AND-ATOMICITY',async()=>{
  refused('N1_MEMBER_NOT_FOUND',()=>execute(base,create(g,[a,uuid(99990)])),base);
  refused('N1_MEMBER_DUPLICATE',()=>execute(base,create(g,[a,a])),base);
  refused('N1_RELATION_NOT_FOUND',()=>execute(base,{kind:'REMOVE_ROOT_RELATION',relationId:g}),base);
  refused('N1_RELATION_ID_DUPLICATE',()=>execute(linked,create(g,[c,d])),linked);
  refused('N1_RELATION_ID_COLLIDES_WITH_CONTEXT',()=>execute(base,create(a,[a,b])),base);
  refused('N1_MEMBER_ALREADY_LINKED',()=>execute(linked,create(h,[a,c])),linked);
  refused('N1_MEMBER_ALREADY_LINKED',()=>execute(linked,{kind:'ADD_ROOT_RELATION_MEMBER',relationId:g,contextOccurrenceId:a}),linked);
  refused('N1_ORDER_INVALID',()=>execute(linked,{kind:'REORDER_ROOT_RELATION',relationId:g,orderedContextIds:[a,c]}),linked);
  refused('N1_MEMBER_NOT_IN_RELATION',()=>execute(linked,{kind:'DETACH_ROOT_RELATION_MEMBER',relationId:g,contextOccurrenceId:c}),linked);
  const denied={...f.access,canManageRelations:false};assert(publish(base,denied).capabilities.every(c=>c.status==='BLOCKED'));
  refused('N1_PERMISSION_DENIED',()=>execute(base,create(g,[a,b]),denied),base);
  refused('N1_PERMISSION_DENIED',()=>execute(base,create(g,[a,b]),{...f.access,canManageRelations:undefined}),base);
  const noMemberPermission=structuredClone(f.access);noMemberPermission.model.board.contexts.find(x=>x.contextOccurrenceId===a).capabilityRefs=[];
  refused('N1_MEMBER_PERMISSION_DENIED',()=>execute(base,create(g,[a,b]),noMemberPermission),base);
  const protectedBase={...f.base,preferences:{...f.base.preferences,flexibility:{[a]:'PRESERVE'}}};
  const protectedAccess=await f.authority(protectedBase),protectedState=upgrade(protectedAccess.model.semanticState);
  refused('N1_MEMBER_PRESERVED',()=>admit(protectedState,{targetMonth:'2026-11',expectedStateDigest:digest(protectedState),mutation:create(g,[a,b])},protectedAccess),protectedState);
  const protectedLinked=parse({...linked,preferences:protectedState.preferences});
  refused('N1_MEMBER_PRESERVED',()=>admit(protectedLinked,{targetMonth:'2026-11',expectedStateDigest:digest(protectedLinked),mutation:{kind:'REMOVE_ROOT_RELATION',relationId:g}},protectedAccess),protectedLinked);
  refused('N1_SCOPE_MISMATCH',()=>admit(base,{...command(base,create(g,[a,b])),targetMonth:'2026-12'},f.access),base);
  refused('N1_STATE_STALE',()=>admit(linked,command(base,{kind:'REMOVE_ROOT_RELATION',relationId:g}),f.access),linked);
  const stale={...f.access,model:{...f.access.model,semanticState:{...f.base,preferences:{...f.base.preferences,anchors:[a]}}}};
  refused('N1_AUTHORITY_STALE',()=>execute(base,create(g,[a,b]),stale),base);
  const outsider={...f.base,contexts:f.base.contexts.map(x=>x.contextOccurrenceId!==c?x:{...x,fields:{...x.fields,...presetCreationFields('night-out','nightclub')}})};
  const outsiderAccess=await f.authority(outsider),outsiderState=upgrade(outsiderAccess.model.semanticState);
  refused('N1_MEMBER_NOT_ADMITTED',()=>admit(outsiderState,{targetMonth:'2026-11',expectedStateDigest:digest(outsiderState),mutation:create(g,[a,c])},outsiderAccess),outsiderState);
  const child=activity(98501,'4.00');child.parentContextOccurrenceId=a;
  const childBase={...f.base,contexts:[...f.base.contexts.map(x=>x.contextOccurrenceId!==a?x:{...x,slotSelections:{...x.slotSelections,before:{items:[{selectionId:uuid(98502),optionKey:'activity',kind:'CHILD_CONTEXT',childContextOccurrenceId:child.contextOccurrenceId,provenance:'EXPLICIT_USER_DECISION'}]}}}),child]};
  const childAccess=await f.authority(childBase),childState=upgrade(childAccess.model.semanticState);
  refused('N1_MEMBER_IS_CHILD',()=>admit(childState,{targetMonth:'2026-11',expectedStateDigest:digest(childState),mutation:create(g,[b,child.contextOccurrenceId])},childAccess),childState);
});
await check('N1-06-VERSIONED-ROUNDTRIP-AND-ORDER',()=>{
  assert.deepEqual(parse(JSON.parse(serialize(reordered))),reordered);assert.equal(digest(parse(JSON.parse(serialize(reordered)))),digest(reordered));
  assert.deepEqual(parse(reordered).rootRelations[0].orderedContextIds,[b,a]);
  assert.deepEqual(read(f.base),base);assert.deepEqual(baseState(upgrade(f.base)),f.base);
  refused('N1_STATE_VERSION_UNSUPPORTED',()=>read({...base,version:'month-plan-state@future'}));
  refused('N1_RELATION_VERSION_UNSUPPORTED',()=>parse({...linked,rootRelations:[{...linked.rootRelations[0],version:'root-context-relation@future'}]}));
  assert.throws(()=>parsePlanSemanticState(linked),/PLANNER_SEMANTIC_VERSION_UNSUPPORTED/,'Existing Save/Apply boundary stays closed');
  assert.throws(()=>parsePlanSemanticState({...f.base,rootRelations:[]}),/PLANNER_FIELDS_INVALID/,'V1 meaning unchanged');
});
await check('N1-07-FINANCIAL-AND-IDENTITY-NEUTRALITY',()=>{
  for(const state of [base,linked,reordered,expanded])unchanged(state);
  const components=state=>state.contexts.flatMap(c=>Object.values(c.slotSelections).flatMap(s=>s.items??[]));
  assert.deepEqual(components(linked),components(base));
  assert.equal(new Set(components(linked).map(i=>i.selectionId)).size,components(linked).length);
  assert.equal(semanticStateDigest(baseState(linked)),semanticStateDigest(f.base));
  // Existing snapshot history can restore the exact prior relation; no new Undo engine.
  assert.deepEqual(read(JSON.parse(serialize(linked))),linked);unchanged(read(JSON.parse(serialize(linked))));
});
await check('N1-08-LEGACY-AND-ORPHAN-REFUSAL',()=>{
  const old={...f.base,contexts:[...f.base.contexts,{contextOccurrenceId:uuid(98601),templateKey:'kernel.generic',status:'ACTIVE',parentContextOccurrenceId:null,
    fields:{opaqueLegacy:{label:'ancien',unknown:null}},slotSelections:{hidden:{legacySelection:{selectionId:'old-string',price:null}}},provenance:'EXPLICIT_USER_DECISION'}]};
  const normalized=parsePlanSemanticState(old),oldDigest=semanticStateDigest(old),upgraded=upgrade(old);
  assert.deepEqual(baseState(read(JSON.parse(serialize(upgraded)))),normalized);assert.equal(semanticStateDigest(baseState(upgraded)),oldDigest);
  const orphan={...linked,contexts:linked.contexts.filter(x=>x.contextOccurrenceId!==b)},snapshot=JSON.stringify(orphan);
  refused('N1_MEMBER_NOT_FOUND',()=>parse(orphan),orphan);assert.equal(JSON.stringify(orphan),snapshot);
  const wrongScope={...linked,rootRelations:[{...linked.rootRelations[0],targetMonth:'2026-12'}]};
  refused('N1_SCOPE_MISMATCH',()=>parse(wrongScope),wrongScope);
  const wrongMemberMonth={...linked,contexts:linked.contexts.map(x=>x.contextOccurrenceId!==a?x:{...x,fields:{...x.fields,plannedDate:'2026-12-12'}})};
  refused('N1_SCOPE_MISMATCH',()=>parse(wrongMemberMonth),wrongMemberMonth);
});
console.log(JSON.stringify({status:'PASS',checks,level:['CONTRACT_LOCAL','OWNER_ADMISSION_SYNTHETIC'],sql:0,writers:f.writes.length,remote,
  compiler:'NOT_RUN_V2_BOUNDARY_UNCHANGED',editor:false,saved:false,fresh:false,apply:false,authRls:false}));
