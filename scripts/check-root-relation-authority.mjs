import assert from 'node:assert/strict';import pg from 'pg';import{createHmac,randomUUID}from'node:crypto';
import{createRootNativeRecipe}from'./lib/root-relation-native-recipe.mjs';import{require}from'./lib/phase2-ts-loader.mjs';
const{saveRootRelationDurableDraft}=require('@/server/phase2/planner/root-relation-durable-service');
const{rootRelationDocument}=require('@/domain/phase2/planner/root-relation-local');
const{rootRelationStateDigest}=require('@/domain/phase2/planner/root-relation-state');
const{plannerDigest,canonicalPlannerJson}=require('@/domain/phase2/planner/json');
const{handleRootRelationRequest}=require('@/server/phase2/planner/root-relation-admission');
const{readRootRelationDurableDrafts}=require('@/server/phase2/planner/root-relation-durable-service');
const{rootRelationFinancialReadSnapshot}=require('@/domain/phase2/planner/root-relation-durable-contract');
process.env.COMPOSER_ROOT_RELATIONS_ENABLED='true';process.env.COMPOSER_ROOT_RELATIONS_DURABLE_SAVE_ENABLED='true';
const f=await createRootNativeRecipe(),checks=[];
const group={version:'root-context-relation@v1',relationId:f.groupId,targetMonth:'2026-11',orderedContextIds:f.ids.slice(0,2),provenance:'EXPLICIT_USER_DECISION'};
const document=rootRelationDocument({draft:f.base,relations:[group]});let n=550;
const packet=(row,doc=document)=>({contract:'composer-draft-http@2-root-relations',kind:'SAVE',command:{targetMonth:'2026-11',expectedDraftId:row.draft_id,
 expectedDraftVersion:row.draft_version,expectedDocumentVersion:row.semantic_state.version,expectedDraftDigest:row.semantic_state_digest,
 expectedBaseRevisionId:row.base_plan_revision_id,expectedBaseRevisionNumber:row.base_plan_revision_number,
 requestId:`f07b0000-0000-4000-8000-${String(++n).padStart(12,'0')}`,semanticState:doc,digest:rootRelationStateDigest(doc)}});
const check=async(name,fn)=>{await fn();checks.push(name);console.log(name+' PASS');};
// Negative tests may sign a synthetic session under the fixture OWNER, never expose the key.
async function openSigned(client){
 const key=(await f.db.query("select encode(signing_key,'hex') value from private.phase2_root_authority_key")).rows[0].value;
 const binding=(await client.query('select pg_current_xact_id()::text transaction_id,pg_backend_pid()::text backend_id')).rows[0];
 const proof={kind:'n1-session-scope@1',userId:f.actor,householdId:f.householdId,targetMonth:'2026-11',transactionId:binding.transaction_id,backendId:binding.backend_id,nonce:randomUUID()};
 const signature=createHmac('sha256',Buffer.from(key,'hex')).update(canonicalPlannerJson(proof)).digest('hex');
 return(await client.query('select private.begin_root_draft_authority_v1($1,$2,$3,$4,$5) value',[f.actor,f.householdId,'2026-11-01',proof,signature])).rows[0].value;
}
try{
 await check('SIGNED_FRESH_OWNER_WRITES_REAL_SQL_WITH_NON_OWNER_ROLE',async()=>{
  const row=(await f.rows())[0],p=packet(row),result=await saveRootRelationDurableDraft(await f.scope(),p);
  assert.equal(result.kind,'SAVE_RECEIPT');assert.equal(result.draft.version,2);assert.deepEqual(result.draft.semanticState,document);
  assert.equal((await f.rows())[0].last_mutation_request_id,p.command.requestId);assert(f.events.some(e=>e.phase==='FRESH_AUTHORITY'));
  assert.equal((await saveRootRelationDurableDraft(await f.scope(),p)).replayed,true);assert.equal((await f.rows())[0].draft_version,2);
 });
 await check('TWO_REAL_SERVER_SAVES_ONE_WINNER',async()=>{
  const before=(await f.rows())[0],a=packet(before),b=packet(before,rootRelationDocument({draft:f.base,relations:[{...group,orderedContextIds:[...group.orderedContextIds].reverse()}]}));
  const results=await Promise.allSettled([saveRootRelationDurableDraft(await f.scope(),a),saveRootRelationDurableDraft(await f.scope(),b)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.message==='N1_DRAFT_CONFLICT').length,1);
 });
 await check('INDEPENDENT_PERMISSION_REVOKED_AFTER_OLD_ADMISSION_IS_RECHECKED',async()=>{
  const staleScope=await f.scope(),before=JSON.stringify(await f.rows());assert(staleScope.admission.editorEnabled);
  const full=await readRootRelationDurableDrafts(staleScope,'2026-11'),financial=rootRelationFinancialReadSnapshot(full);
  const old=await handleRootRelationRequest({...staleScope.admission,readDrafts:async()=>financial},{kind:'READ',sequence:0,targetMonth:'2026-11',
   binding:{draftId:full.active.draftId,version:full.active.version},frame:{draft:financial.active.semanticState,relations:full.active.semanticState.rootRelations}});assert(old.ok,old.code);
  await f.db.query('update private.n1_recipe_facts set editor_enabled=false');
  await assert.rejects(()=>saveRootRelationDurableDraft(staleScope,packet(JSON.parse(before)[0])),/N1_PERMISSION_DENIED/);
  assert.equal(JSON.stringify(await f.rows()),before);await f.db.query('update private.n1_recipe_facts set editor_enabled=true');
 });
 await check('DIRECT_AUTHENTICATED_CALL_KNOWING_FULL_COMMAND_IS_DENIED',async()=>{
  const row=(await f.rows())[0],p=packet(row),before=JSON.stringify(await f.rows());
  await assert.rejects(()=>f.queryAs(f.actor,'select private.commit_root_draft_authority_v1($1,$2,$3,$4)',[p,{}, {},'0'.repeat(64)]),e=>e.code==='42501');
  await assert.rejects(()=>f.queryAs(f.actor,'select private.store_phase2_root_draft_v1($1,$2,$3,$4)',[f.actor,f.householdId,p,{}]),e=>e.code==='42501');
  assert.equal(JSON.stringify(await f.rows()),before);
 });
 await check('SERVER_DB_ROLE_ALONE_WITHOUT_SIGNER_CANNOT_FORGE_ADMISSION',async()=>{
  const client=new pg.Client({host:'127.0.0.1',port:55439,user:'composer_n1_server',database:f.database,ssl:false});await client.connect();
  try{await client.query('begin');
   await assert.rejects(()=>client.query('select private.begin_root_draft_authority_v1($1,$2,$3,$4,$5)',[f.actor,f.householdId,'2026-11-01',{},'0'.repeat(64)]),e=>e.code==='42501'&&e.message==='N1_SESSION_PROOF_INVALID');
   await client.query('rollback');await client.query('begin');const opened=await openSigned(client);
   const p=packet((await f.rows())[0]),admission={nonce:opened.nonce,transactionId:opened.transactionId,backendId:opened.backendId,userId:f.actor,householdId:f.householdId,targetMonth:'2026-11',packetDigest:plannerDigest(p),sourceDigest:plannerDigest(opened.source),authorityDigest:'0'.repeat(64),policy:'g-a-organizational-draft@1'};
   await assert.rejects(()=>client.query('select private.commit_root_draft_authority_v1($1,$2,$3,$4)',[p,opened.source,admission,'0'.repeat(64)]),e=>e.code==='42501'&&e.message==='N1_ADMISSION_INVALID');
  }finally{await client.query('rollback');await client.end();}
 });
 await check('FOREIGN_SCOPE_AND_CLOSED_SERVER_GATE_DO_NOT_WRITE',async()=>{
  const before=JSON.stringify(await f.rows()),p=packet(JSON.parse(before)[0]);
  const foreign=await f.scope(f.foreignActor,f.foreignHousehold);
  await assert.rejects(()=>saveRootRelationDurableDraft(foreign,p),/N1_DRAFT_ACCESS_DENIED/);
  const own=await f.scope();delete process.env.COMPOSER_ROOT_RELATIONS_DURABLE_SAVE_ENABLED;
  await assert.rejects(()=>saveRootRelationDurableDraft(own,p),/N1_DURABLE_DISABLED/);
  process.env.COMPOSER_ROOT_RELATIONS_DURABLE_SAVE_ENABLED='true';assert.equal(JSON.stringify(await f.rows()),before);
 });
 await check('VALID_SIGNATURE_FROM_A_DIFFERENT_TRANSACTION_IS_REFUSED',async()=>{
  const before=JSON.stringify(await f.rows()),client=new pg.Client({host:'127.0.0.1',port:55439,user:'composer_n1_server',database:f.database,ssl:false});await client.connect();
  // Negative test only: owner obtains the synthetic key; it is never printed or exposed by the fixture/server.
  const key=(await f.db.query("select encode(signing_key,'hex') value from private.phase2_root_authority_key")).rows[0].value;
  try{await client.query('begin');const opened=await openSigned(client);
   const p=packet(JSON.parse(before)[0]),admission={nonce:opened.nonce,transactionId:opened.transactionId,backendId:opened.backendId,userId:f.actor,householdId:f.householdId,targetMonth:'2026-11',packetDigest:plannerDigest(p),sourceDigest:plannerDigest(opened.source),authorityDigest:'0'.repeat(64),policy:'g-a-organizational-draft@1'};
   const signature=createHmac('sha256',Buffer.from(key,'hex')).update(canonicalPlannerJson(admission)).digest('hex');
   await client.query('rollback');await client.query('begin');await openSigned(client);
   await assert.rejects(()=>client.query('select private.commit_root_draft_authority_v1($1,$2,$3,$4)',[p,opened.source,admission,signature]),e=>e.code==='42501'&&e.message==='N1_ADMISSION_INVALID');
  }finally{await client.query('rollback');await client.end();}assert.equal(JSON.stringify(await f.rows()),before);
 });
 await check('REVOCATION_COMMITTED_WHILE_SAVE_WAITS_FOR_AUTHORITY_LOCK_PREVENTS_WRITE',async()=>{
  const stale=await f.scope(),before=JSON.stringify(await f.rows());await f.db.query('begin');await f.db.query('update private.n1_recipe_facts set editor_enabled=false');
  const pending=saveRootRelationDurableDraft(stale,packet(JSON.parse(before)[0]));void pending.catch(()=>{});
  // The relevant committed revocation wins before the Save can acquire its authority lock.
  await f.db.query('commit');await assert.rejects(()=>pending,/N1_PERMISSION_DENIED/);assert.equal(JSON.stringify(await f.rows()),before);
  await f.db.query('update private.n1_recipe_facts set editor_enabled=true');
 });
 await check('REVOKE_DURING_PROTECTED_PUBLICATION_SERIALIZES_AFTER_COMMIT',async()=>{
  const before=(await f.rows())[0],scope=await f.scope();let revoke,started=false;
  const refresh=scope.refresh;scope.refresh=async()=>{const fresh=await refresh();started=true;
   revoke=f.db.query('update private.n1_recipe_facts set editor_enabled=false');
   return fresh;};
  const receipt=await saveRootRelationDurableDraft(scope,packet(before));assert(started);assert.equal(receipt.draft.version,before.draft_version+1);
  await revoke;const after=JSON.stringify(await f.rows()),revokedScope=await f.scope();await assert.rejects(()=>saveRootRelationDurableDraft(revokedScope,packet(JSON.parse(after)[0])),/N1_PERMISSION_DENIED/);
  await f.db.query('update private.n1_recipe_facts set editor_enabled=true');
 });
 await check('BASE_PLAN_CHANGED_AFTER_OLD_SCOPE_PREVENTS_SAVE',async()=>{
  const scope=await f.scope(),before=JSON.stringify(await f.rows()),id='f07b0000-0000-4000-8000-000000009901',revision='f07b0000-0000-4000-8000-000000009902',digest=plannerDigest(f.base);
  await f.db.query("insert into phase2_month_plans(plan_id,household_id,target_month,created_by,updated_by) values($1,$2,'2026-11-01',$3,$3)",[id,f.householdId,f.actor]);
  await f.db.query(`insert into phase2_month_plan_revisions(plan_revision_id,plan_id,household_id,target_month,revision_number,apply_request_id,baseline_digest,baseline_snapshot,semantic_state,semantic_state_digest,change_set,compiled_manifest,compiled_manifest_digest,projection_evidence,preview_digest,compiler_version,model_versions,created_by)
   values($1,$2,$3,'2026-11-01',1,$1,$4,'{}',$5,$4,'[]','{}',$4,'{}',$4,'SYNTHETIC_BASE_FIXTURE','{}',$6)`,[revision,id,f.householdId,digest,f.base,f.actor]);
  await f.db.query('update phase2_month_plans set active_revision_id=$1,active_revision_number=1 where plan_id=$2',[revision,id]);
  await assert.rejects(()=>saveRootRelationDurableDraft(scope,packet(JSON.parse(before)[0])),/N1_DRAFT_VERSION_CHANGED/);assert.equal(JSON.stringify(await f.rows()),before);
 });
 console.log(JSON.stringify({status:'PASS',checks,database:f.database,level:'REAL_NON_OWNER_SIGNED_TRANSACTION_FRESH_OWNER_LOCAL_SYNTHETIC_SESSION',authRlsRemote:'NOT_RUN',apply:'NOT_RUN'}));
}finally{await f.close();delete process.env.COMPOSER_ROOT_RELATIONS_ENABLED;delete process.env.COMPOSER_ROOT_RELATIONS_DURABLE_SAVE_ENABLED;}
