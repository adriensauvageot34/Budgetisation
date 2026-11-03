/** N1-C-A: pure candidate contract + real historical V1 service over synthetic rows. No durable writer. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {require} from './lib/phase2-ts-loader.mjs';
import {localRelationsFixture} from './fixtures/composer-root-relation-local.mjs';
import {uuid} from './fixtures/planner-headless.mjs';
const codec=require('@/domain/phase2/planner/root-relation-draft-codec');
const boundary=require('@/domain/phase2/planner/root-relation-draft-boundary');
const contract=require('@/domain/phase2/planner/root-relation-draft-contract');
const state=require('@/domain/phase2/planner/root-relation-state');
const {parsePlanSemanticState,semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {COMPOSER_DRAFT_HTTP_CONTRACT:V1_HTTP}=require('@/domain/phase2/planner/composer-draft-contract');
const {admitRootRelationMutation}=require('@/server/phase2/planner/root-relation-owner');
const {readComposerDrafts,saveComposerDraft}=require('@/server/phase2/planner/composer-draft-service');
let network=0,rpc=0;globalThis.fetch=async()=>{network++;throw Error('N1CA_NETWORK_FORBIDDEN');};
const f=await localRelationsFixture(),[a,b,c]=f.ids,world=JSON.stringify(f.world);
f.scope().supabase.rpc=()=>{rpc++;throw Error('N1CA_RPC_FORBIDDEN');};
const scoped={userId:f.userId,householdId:f.scope().householdId,targetMonth:'2026-11'},base={revisionId:null,revisionNumber:0};
const v1=parsePlanSemanticState({...f.base,contexts:[...f.base.contexts,{contextOccurrenceId:uuid(98711),templateKey:'kernel.generic',status:'ACTIVE',parentContextOccurrenceId:null,
 fields:{opaqueLegacy:{nested:[null,'ancien',false],price:null,legacyFinance:{participants:[{personId:uuid(98712),weight:'1'}],payers:[{personId:uuid(98713),amount:'13.45'}],allocations:[{ownerId:uuid(98714),amount:null}]}}},slotSelections:{hidden:{legacySelection:{selectionId:'legacy-selection-string',value:null}}},provenance:'EXPLICIT_USER_DECISION'}],
 preferences:{anchors:[f.ids[3]],flexibility:{[f.ids[3]]:'PRESERVE'}}});
const initial=state.upgradePlanForRootRelations(f.base);
const admitted=admitRootRelationMutation(initial,{targetMonth:'2026-11',expectedStateDigest:state.rootRelationStateDigest(initial),mutation:{kind:'CREATE_ROOT_RELATION',relationId:f.groupId,orderedContextIds:[a,b]}},f.access);
const document=state.parseRootRelationPlanState({...v1,version:admitted.version,rootRelations:admitted.rootRelations});
const record=(semanticState,version=7,extra={})=>({...f.drafts.active,semanticState,digest:codec.rootRelationDraftDocumentDigest(semanticState),version,...extra});
const oldRecord=record(v1),current=record(document);
const packet=(semanticState=document,previous=current,requestId=uuid(98720))=>({contract:contract.ROOT_RELATION_DRAFT_HTTP_CONTRACT,kind:'SAVE',command:{
 targetMonth:'2026-11',expectedDraftId:previous?.draftId??null,expectedDraftVersion:previous?.version??0,
 expectedDocumentVersion:previous?.semanticState.version??null,expectedDraftDigest:previous?.digest??null,
 expectedBaseRevisionId:null,expectedBaseRevisionNumber:0,requestId,semanticState,digest:codec.rootRelationDraftDocumentDigest(semanticState)}});
const receipt=p=>({contract:contract.ROOT_RELATION_DRAFT_HTTP_CONTRACT,kind:'SAVE_RECEIPT',replayed:false,
 draft:record(p.command.semanticState,p.command.expectedDraftVersion+1,{draftId:p.command.expectedDraftId??uuid(98799),lastMutationRequestId:p.command.requestId,lastMutationExpectedVersion:p.command.expectedDraftVersion,lastMutationKind:'SAVE'})});
const known=r=>({draftId:r.draftId,version:r.version,digest:r.digest});
const reject=(code,fn)=>assert.throws(fn,error=>error.message===code||error.code===code,code);
const checks=[];async function check(name,run){await run();checks.push(name);console.log(name+' PASS');}
await check('T1_FULL_RECORD_ROUNDTRIP_AND_EXPLICIT_ORDER',()=>{
 const serialized=codec.serializeRootRelationDraftRecord(current),reloaded=codec.parseRootRelationDraftRecord(JSON.parse(serialized));
 assert.deepEqual(reloaded,current);assert.equal(reloaded.semanticState.rootRelations[0].relationId,f.groupId);
 assert.deepEqual(reloaded.semanticState.rootRelations[0].orderedContextIds,[a,b]);assert.equal(reloaded.version,7);assert.equal(reloaded.draftId,current.draftId);
 assert.equal(codec.serializeRootRelationDraftRecord(reloaded),serialized);
 const reversed=state.parseRootRelationPlanState({...document,contexts:[...document.contexts].reverse(),rootRelations:[{...document.rootRelations[0],orderedContextIds:[b,a]}]});
 const again=codec.parseRootRelationDraftRecord(JSON.parse(codec.serializeRootRelationDraftRecord(record(reversed))));
 assert.deepEqual(again.semanticState.rootRelations[0].orderedContextIds,[b,a]);assert.notEqual(again.digest,current.digest);
});
await check('T2_V1_LEGACY_NULL_SLOTS_AND_HISTORICAL_DIGEST_UNCHANGED',()=>{
 const before=JSON.stringify(oldRecord),digest=semanticStateDigest(v1);
 assert.deepEqual(codec.parseRootRelationDraftRecord(JSON.parse(codec.serializeRootRelationDraftRecord(oldRecord))),oldRecord);
 assert.equal(codec.rootRelationDraftDocumentDigest(v1),digest);assert.equal(codec.readRootRelationDraftDocument(v1).version,'month-plan-state@v1');
 const upgraded=state.upgradePlanForRootRelations(v1);assert.deepEqual(upgraded.rootRelations,[]);assert.deepEqual(state.rootRelationBaseState(upgraded),v1);
 const projected=codec.readRootRelationDraftRow({...f.row,semantic_state:v1,semantic_state_digest:digest,draft_version:7},scoped);assert.deepEqual(projected,oldRecord);
 assert.equal(JSON.stringify(oldRecord),before);assert.equal(projected.semanticState.contexts.find(x=>x.templateKey==='kernel.generic').fields.opaqueLegacy.price,null);
});
await check('T3_NO_V1_TRANSPORT_OR_WRITER_DOWNGRADE',async()=>{
 reject('N1_DRAFT_TRANSPORT_UNSUPPORTED',()=>codec.parseRootRelationDraftSavePacket({...packet(),contract:V1_HTTP}));
 reject('N1_DRAFT_OLD_CLIENT',()=>codec.assertRootRelationDraftClient(V1_HTTP,document));
 reject('N1_DRAFT_OLD_CLIENT',()=>codec.assertRootRelationDraftClient(V1_HTTP,v1,document));
 reject('PLANNER_SEMANTIC_VERSION_UNSUPPORTED',()=>parsePlanSemanticState(document));
 reject('PLANNER_FIELDS_INVALID',()=>parsePlanSemanticState({...v1,rootRelations:[]}));
 const p=packet();const result=await saveComposerDraft(f.scope(),p.command);assert.equal(result.ok,false);assert.equal(rpc,0);
 const prepared=boundary.prepareRootRelationDraftSave(packet(document,oldRecord),oldRecord,base);assert.equal(prepared.storage.semantic_state.version,document.version);
 assert.deepEqual(prepared.storage.semantic_state.rootRelations,document.rootRelations);assert.equal(prepared.writable,false);
 for(const name of ['root-relation-draft-codec.ts','root-relation-draft-boundary.ts'])assert(!fs.readFileSync('src/domain/phase2/planner/'+name,'utf8').includes('rootRelationBaseState'));
});
await check('T4_UNKNOWN_VERSIONS_FIELDS_AND_DIGEST_REFUSED',()=>{
 reject('N1_DRAFT_RECORD_UNSUPPORTED',()=>codec.parseRootRelationDraftRecord({version:'future',draft:current}));
 reject('N1_DRAFT_DOCUMENT_UNSUPPORTED',()=>codec.readRootRelationDraftDocument({...document,version:'future'}));
 reject('N1_RELATION_VERSION_UNSUPPORTED',()=>codec.readRootRelationDraftDocument({...document,rootRelations:[{...document.rootRelations[0],version:'future'}]}));
 reject('N1_DRAFT_TRANSPORT_UNSUPPORTED',()=>codec.parseRootRelationDraftSavePacket({...packet(),contract:'composer-draft-http@future'}));
 reject('N1_DRAFT_DIGEST_MISMATCH',()=>codec.parseCompatibleRootRelationDraft({...current,digest:'0'.repeat(64)}));
 reject('N1_DRAFT_DIGEST_MISMATCH',()=>codec.parseRootRelationDraftSavePacket({...packet(),command:{...packet().command,digest:'0'.repeat(64)}}));
 reject('PLANNER_FIELDS_INVALID',()=>codec.parseRootRelationDraftSavePacket({...packet(),canManageRelations:true}));
 reject('N1_DRAFT_DOCUMENT_UNSUPPORTED',()=>codec.parseRootRelationDraftSavePacket({...packet(),command:{...packet().command,expectedDocumentVersion:'future'}}));
});
await check('T5_CAS_CONCURRENT_REORDERS_STALE_READ_AND_LATE_RESPONSE',()=>{
 const expanded=state.parseRootRelationPlanState({...document,rootRelations:[{...document.rootRelations[0],orderedContextIds:[a,b,c]}]});const source=record(expanded);let remoteRow=source;
 const first=state.parseRootRelationPlanState({...expanded,rootRelations:[{...expanded.rootRelations[0],orderedContextIds:[b,a,c]}]});
 const second=state.parseRootRelationPlanState({...expanded,rootRelations:[{...expanded.rootRelations[0],orderedContextIds:[c,b,a]}]});
 const A=packet(first,remoteRow,uuid(98721)),B=packet(second,remoteRow,uuid(98722)),before=JSON.stringify(remoteRow);
 assert.equal(boundary.prepareRootRelationDraftSave(A,remoteRow,base).kind,'PREPARED_LOCAL_ONLY');assert.equal(JSON.stringify(remoteRow),before);
 // Explicit in-memory model of a future atomic CAS commit. No existing writer is invoked.
 remoteRow=receipt(A).draft;reject('N1_DRAFT_CONFLICT',()=>boundary.prepareRootRelationDraftSave(B,remoteRow,base));
 assert.deepEqual(remoteRow.semanticState.rootRelations[0].orderedContextIds,[b,a,c]);
 assert.equal(boundary.validateRootRelationDraftSaveReceipt(A,receipt(A),source,first).kind,'VALIDATED_RECEIPT_ONLY');
 reject('N1_DRAFT_CONFLICT',()=>boundary.validateRootRelationDraftSaveReceipt(A,receipt(A),current,first));
 reject('N1_DRAFT_STALE_RESPONSE',()=>boundary.validateRootRelationDraftSaveReceipt(A,receipt(A),record(second,9),first));
 reject('N1_DRAFT_LOCAL_CHANGED',()=>boundary.validateRootRelationDraftSaveReceipt(A,receipt(A),source,second));
 reject('N1_DRAFT_REQUEST_ID_REUSED',()=>boundary.prepareRootRelationDraftSave(A,remoteRow,base));
 reject('N1_DRAFT_STALE_RESPONSE',()=>boundary.validateRootRelationDraftReload(first,known(remoteRow),record(expanded,7)));
 reject('N1_DRAFT_CONFLICT',()=>boundary.validateRootRelationDraftReload(first,known(remoteRow),record(second,8)));
 reject('N1_DRAFT_DIRTY_RELOAD',()=>boundary.validateRootRelationDraftReload(second,known(remoteRow),record(second,9)));
 reject('N1_DRAFT_DOWNGRADE_REFUSED',()=>boundary.validateRootRelationDraftReload(document,known(current),record(v1,8)));
 assert.deepEqual(boundary.validateRootRelationDraftReload(first,known(remoteRow),record(second,9)).semanticState,second);
 reject('N1_DRAFT_BASE_STALE',()=>boundary.prepareRootRelationDraftSave(packet(),current,{revisionId:uuid(98760),revisionNumber:1}));
 reject('N1_DRAFT_CONFLICT',()=>boundary.prepareRootRelationDraftSave({...packet(),command:{...packet().command,expectedDraftDigest:'0'.repeat(64)}},current,base));
 reject('N1_DRAFT_CONFLICT',()=>boundary.prepareRootRelationDraftSave({...packet(),command:{...packet().command,expectedDocumentVersion:v1.version}},current,base));
 const create=packet(document,null);assert.equal(boundary.prepareRootRelationDraftSave(create,null,base).packet.command.expectedDraftVersion,0);
 assert.equal(boundary.validateRootRelationDraftSaveReceipt(create,receipt(create),null,document).draft.version,1);
 reject('N1_DRAFT_RECEIPT_INVALID',()=>boundary.validateRootRelationDraftSaveReceipt(A,{...receipt(A),draft:{...receipt(A).draft,version:10}},source,first));
 reject('N1_DRAFT_BINDING_INVALID',()=>codec.parseRootRelationDraftSavePacket({...create,command:{...create.command,expectedDraftVersion:1}}));
});
await check('T6_IDENTITIES_FINANCE_AND_LOCAL_ONLY_SAVE_POLICY',()=>{
 assert.deepEqual(state.rootRelationBaseState(document),v1);assert.deepEqual(document.contexts,v1.contexts);assert.deepEqual(document.controls,v1.controls);assert.deepEqual(document.preferences,v1.preferences);
 assert.equal(document.contexts.length,v1.contexts.length);const prepared=boundary.prepareRootRelationDraftSave(packet(),current,base);
 assert.equal(prepared.writable,false);assert.equal(prepared.readiness.organization,'STRUCTURALLY_VALID');assert.equal(prepared.readiness.mobility,'NOT_EVALUATED');
 assert.equal(prepared.readiness.save,'BLOCKED');assert.equal(prepared.readiness.apply,'NOT_EVALUATED');assert(prepared.readiness.blockers.includes('G_A_SAVE_POLICY_UNDECIDED'));
 reject('PLANNER_FIELDS_INVALID',()=>boundary.prepareRootRelationDraftSave({...packet(),command:{...packet().command,gAApproved:true}},current,base));
 assert.equal(JSON.stringify(f.world),world);assert.equal(f.writes.length,0);
});
await check('T7_RELATIONAL_VALIDATION_AND_SCOPE_ATOMICITY',()=>{
 const G=document.rootRelations[0];
 for(const [code,bad] of [
 ['N1_MEMBER_DUPLICATE',{...document,rootRelations:[{...G,orderedContextIds:[a,a]}]}],
 ['N1_RELATION_ID_DUPLICATE',{...document,rootRelations:[G,G]}],
 ['N1_MEMBER_NOT_FOUND',{...document,rootRelations:[{...G,orderedContextIds:[a,uuid(99990)]}]}],
 ['N1_MEMBER_IS_CHILD',{...document,contexts:document.contexts.map(x=>x.contextOccurrenceId===b?{...x,parentContextOccurrenceId:c}:x)}],
 ['N1_SCOPE_MISMATCH',{...document,rootRelations:[{...G,targetMonth:'2026-12'}]}],
 ['PLANNER_ID_INVALID',{...document,rootRelations:[{...G,relationId:'invalid'}]}],
 ]){const before=JSON.stringify(bad);reject(code,()=>codec.serializeRootRelationDraftRecord(record(bad)));assert.equal(JSON.stringify(bad),before);}
 reject('N1_DRAFT_SCOPE_MISMATCH',()=>codec.readRootRelationDraftRow(f.row,{...scoped,householdId:uuid(98780)}));
});
await check('T8_OLD_APPLICATION_REFUSES_N1_ROW_SQL_GUARD_DEFERRED',async()=>{
 const before=JSON.stringify(f.row);f.row.semantic_state=document;f.row.semantic_state_digest=state.rootRelationStateDigest(document);
 await assert.rejects(()=>readComposerDrafts(f.scope(),'2026-11'),/PLANNER_SEMANTIC_VERSION_UNSUPPORTED/);
 const old={...packet().command,semanticState:v1,digest:semanticStateDigest(v1)};assert.equal((await saveComposerDraft(f.scope(),old)).ok,false);assert.equal(rpc,0);
 Object.assign(f.row,JSON.parse(before));codec.assertRootRelationDraftClient(V1_HTTP,v1);
});
assert.equal(network,0);assert.equal(rpc,0);assert.deepEqual(f.writes,[]);
console.log(JSON.stringify({status:'PASS',checks,level:'PURE_CONTRACT_REAL_V1_SERVICE_SYNTHETIC_ROWS_AND_CAS_MODEL',sql:0,rpc,network,realWriters:0,durableSave:'NOT_RUN',durableReload:'NOT_RUN',sqlOldClientGuard:'NOT_RUN',authRls:'NOT_RUN',apply:'NOT_RUN'}));
