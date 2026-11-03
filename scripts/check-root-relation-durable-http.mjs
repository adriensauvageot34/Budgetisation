/** Real HTTP/client transport/service/owner; auth and row source synthetic. No durable writer or remote I/O. */
import assert from 'node:assert/strict';import http from 'node:http';
import {require}from'./lib/phase2-ts-loader.mjs';import{localRelationsFixture}from'./fixtures/composer-root-relation-local.mjs';
const f=await localRelationsFixture();
const {rootRelationDurableHttp}=require('@/server/phase2/planner/root-relation-durable-http');
const {rootRelationDurableTransport}=require('@/app/mois-a-venir/composer/root-relation-durable-transport');
const {rootRelationDocument}=require('@/domain/phase2/planner/root-relation-local');
const {rootRelationStateDigest}=require('@/domain/phase2/planner/root-relation-state');
const {BootstrapAuthenticationRequiredError}=require('@/server/bootstrap/errors');
const source=f.scope();let authorizations=0,authenticated=true;
const scope={...source,admission:source};
const server=http.createServer(async(req,res)=>{
 try{const body=[];for await(const chunk of req)body.push(chunk);
 const request=new Request(`http://127.0.0.1:${server.address().port}${req.url}`,{method:req.method,headers:req.headers,...req.method==='POST'?{body:Buffer.concat(body)}:{}});
 const response=await rootRelationDurableHttp(request,async()=>{authorizations++;if(!authenticated)throw new BootstrapAuthenticationRequiredError();return scope;});
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
 }catch{res.writeHead(500);res.end('unexpected fixture failure');}
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;const nativeFetch=globalThis.fetch;let network=0;
globalThis.fetch=(url,options={})=>{network++;const target=new URL(url,origin);assert.equal(target.origin,origin,'local HTTP only');
 return nativeFetch(target,{...options,headers:{...options.headers,Origin:origin}});};
const document=rootRelationDocument({draft:f.base,relations:[{version:'root-context-relation@v1',relationId:f.groupId,targetMonth:'2026-11',orderedContextIds:f.ids.slice(0,2),provenance:'EXPLICIT_USER_DECISION'}]});
const packet={contract:'composer-draft-http@2-root-relations',kind:'SAVE',command:{targetMonth:'2026-11',expectedDraftId:f.draftId,expectedDraftVersion:1,
 expectedDocumentVersion:'month-plan-state@v1',expectedDraftDigest:f.row.semantic_state_digest,expectedBaseRevisionId:null,expectedBaseRevisionNumber:0,
 requestId:'f07b0000-0000-4000-8000-000000000333',semanticState:document,digest:rootRelationStateDigest(document)}};
const checks=[];const check=async(name,fn)=>{await fn();checks.push(name);console.log(name+' PASS');};
const reject=async(code,packetOverride=packet)=>{const before=JSON.stringify(f.row);await assert.rejects(()=>rootRelationDurableTransport.save(packetOverride),e=>e.message===code);assert.equal(JSON.stringify(f.row),before);};
try{
 await check('GATES_OFF_REJECT_BEFORE_AUTH_AND_READ',async()=>{delete process.env.COMPOSER_ROOT_RELATIONS_ENABLED;delete process.env.COMPOSER_ROOT_RELATIONS_DURABLE_SAVE_ENABLED;
 await reject('N1_DURABLE_DISABLED');assert.equal(authorizations,0);assert.equal(f.draftReads.length,2);});
 process.env.COMPOSER_ROOT_RELATIONS_ENABLED='true';
 await check('DURABLE_GATE_INDEPENDENT_OF_LOCAL_EDITOR',async()=>{await reject('N1_DURABLE_DISABLED');assert.equal(authorizations,0);});
 process.env.COMPOSER_ROOT_RELATIONS_DURABLE_SAVE_ENABLED='true';
 await check('REAL_HTTP_TRANSPORT_READER_PRESERVES_V1',async()=>{const read=await rootRelationDurableTransport.read('2026-11');assert.equal(read.active.digest,f.row.semantic_state_digest);assert.deepEqual(read.active.semanticState,f.base);});
 await check('N1_HTTP_RELOAD_IS_COMPLETE_AND_OLD_V1_READER_REFUSES',async()=>{
  const original=f.row.semantic_state,digest=f.row.semantic_state_digest;f.row.semantic_state=document;f.row.semantic_state_digest=rootRelationStateDigest(document);
  const read=await rootRelationDurableTransport.read('2026-11');assert.deepEqual(read.active.semanticState,document);
  assert.deepEqual(read.active.semanticState.contexts,f.base.contexts);assert.equal(read.active.draftId,f.draftId);
  const{readComposerDrafts}=require('@/server/phase2/planner/composer-draft-service');await assert.rejects(()=>readComposerDrafts(scope,'2026-11'),/PLANNER_SEMANTIC_VERSION_UNSUPPORTED/);
  f.row.semantic_state=original;f.row.semantic_state_digest=digest;
 });
 await check('G_A_OPTION_A_DOES_NOT_BYPASS_MISSING_TRANSACTION_AUTHORITY',async()=>{await reject('N1_SQL_AUTHORITY_NOT_RECEIVED');});
 await check('STALE_SOURCE_IS_AN_EXPLICIT_CONFLICT_BEFORE_POLICY',async()=>{await reject('N1_DRAFT_CONFLICT',{...packet,command:{...packet.command,expectedDraftVersion:2}});});
 await check('CLIENT_GRANT_AND_FOREIGN_HOUSEHOLD_ARE_NOT_AUTHORITY',async()=>{await reject('PLANNER_FIELDS_INVALID',{...packet,canManageRelations:true});
 await reject('PLANNER_FIELDS_INVALID',{...packet,command:{...packet.command,householdId:'f07b0000-0000-4000-8000-000000000002'}});});
 await check('PRIVATE_PRESERVE_CANNOT_BE_REMOVED_BY_PROPOSAL',async()=>{const original=f.row.semantic_state;
 f.row.semantic_state={...f.base,preferences:{...f.base.preferences,flexibility:{...f.base.preferences.flexibility,[f.ids[0]]:'PRESERVE'}}};
 const{semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');const old=f.row.semantic_state_digest;f.row.semantic_state_digest=semanticStateDigest(f.row.semantic_state);
 await reject('N1_DRAFT_AUTHORITY_MISMATCH');f.row.semantic_state=original;f.row.semantic_state_digest=old;});
 await check('SESSION_LOSS_HAS_NO_WRITER_OR_MUTATION',async()=>{authenticated=false;await reject('AUTHENTICATION_REQUIRED');authenticated=true;});
 console.log(JSON.stringify({status:'PASS',checks,level:'REAL_LOCAL_HTTP_TRANSPORT_SERVICE_OWNER_SYNTHETIC_AUTH_ROWS',requests:network,realSqlWriters:0,
  shellToSql:'NOT_EXERCISED_BY_THIS_SYNTHETIC_HTTP_ONLY_SUITE',saved:'SEE_SEPARATE_VERTICAL_RECIPE',authRls:'NOT_RUN',remoteConnections:0}));
}finally{globalThis.fetch=nativeFetch;delete process.env.COMPOSER_ROOT_RELATIONS_ENABLED;delete process.env.COMPOSER_ROOT_RELATIONS_DURABLE_SAVE_ENABLED;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
