/** Actual loopback HTTP requests; existing synthetic fixture only, never Supabase/Auth. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {require} from './lib/phase2-ts-loader.mjs';
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {barPlaceOperation,barEndpoint}=require('@/app/mois-a-venir/composer/bar-living-operations');
const base=process.env.BAR_P1_FIXTURE_ORIGIN??'http://127.0.0.1:3216';
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const scenario='P1_HTTP_'+crypto.randomUUID();
const url=path=>base+path+'?scenario='+scenario;
const post=async(path,body,extra='')=>{
  const response=await fetch(url(path)+extra,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal(response.status,200);return response.json();
};
let sequence=0,model;
const request=async(op)=>{const result=await post('/interaction',{sequence:++sequence,targetMonth:'2026-11',draft:model?.semanticState,...op});assert.equal(result.ok,true,result.code);model=result.model;};
await request({kind:'READ'});
const id=crypto.randomUUID(),beerId=crypto.randomUUID(),outId=crypto.randomUUID(),backId=crypto.randomUUID();
await request({kind:'DROP',assetKey:'template:night-out',presetKey:'bar-apero',target:{kind:'BOARD_ZONE'},identity:id,selectionId:crypto.randomUUID(),values:{}});
const place=label=>({kind:'TEXT',label,provenance:'USER_DECLARED_PROSPECTIVE'});
const home=place('Départ synthétique'),bar=place('Bar synthétique');
const leg=(selectionId,optionKey,origin,destination,fare)=>({kind:'MOBILITY_INTENT',selectionId,optionKey,origin,destination,returnRequired:false,provenance:'EXPLICIT_USER_DECISION',
  pricing:{fare,parking:{kind:'UNKNOWN'},fundingAllocations:[],preference:'FASTEST'}});
const beer={kind:'COMPONENT',selectionId:beerId,optionKey:'extra',provenance:'EXPLICIT_USER_DECISION',label:'Bière fixture',quantity:'2',unitBasis:'ITEM',cost:{kind:'MANUAL',unitAmount:'6.50'},fundingAllocations:[],binding:{mode:'AUTO'}};
await request({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:id,fields:{placeRef:bar,plannedDate:null,participantRefs:[{kind:'TEXT',label:'Participant synthétique'}]},slots:{extras:[beer],outbound:[leg(outId,'car',home,bar,{kind:'UNKNOWN'})],return:[leg(backId,'taxi',bar,home,{kind:'MANUAL',unitAmount:'12'})]}}});
const current=()=>model.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
const routes=structuredClone(current().slotSelections);
await request(barPlaceOperation(current(),place('Autre bar synthétique')));
assert.deepEqual(current().slotSelections,routes);
const snapshot=await (await fetch(url('/draft'))).json();
const command={targetMonth:'2026-11',expectedDraftId:snapshot.active?.draftId??null,expectedDraftVersion:snapshot.active?.version??0,requestId:crypto.randomUUID(),semanticState:model.semanticState,digest:semanticStateDigest(model.semanticState)};
// A committed write whose HTTP response is lost: read before resolving/replaying.
const lost=await fetch(url('/draft')+'&draftLoseAfterCommit=1',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'SAVE',command})});
assert.equal(lost.status,503);
const loaded=await (await fetch(url('/draft'))).json();assert.equal(loaded.active.digest,command.digest);assert.equal(loaded.active.version,command.expectedDraftVersion+1);
assert.deepEqual(loaded.active.semanticState,command.semanticState);
const replay=await post('/draft',{kind:'SAVE',command});assert.equal(replay.replayed,true);assert.equal(replay.draft.version,loaded.active.version);
const reloaded=loaded.active.semanticState.contexts.find(c=>c.contextOccurrenceId===id);
assert.deepEqual(reloaded,current());assert.equal(reloaded.fields.plannedDate,null);
// Two writes based on the same version, newer response arrives first.
const nextState=structuredClone(loaded.active.semanticState),next=nextState.contexts.find(c=>c.contextOccurrenceId===id);
next.slotSelections.return.items[0]=barEndpoint(next.slotSelections.return.items[0],'origin',place('Départ retour explicite'),'UNKNOWN');
const saveBody={kind:'SAVE',command:{...command,expectedDraftId:loaded.active.draftId,expectedDraftVersion:loaded.active.version,requestId:crypto.randomUUID(),semanticState:nextState,digest:semanticStateDigest(nextState)}};
const first=post('/draft',saveBody,'&draftDelay=350');
await new Promise(resolve=>setTimeout(resolve,100));
const conflict=await post('/draft',{kind:'SAVE',command:{...command,requestId:crypto.randomUUID(),expectedDraftId:loaded.active.draftId,expectedDraftVersion:loaded.active.version}});
assert.equal(conflict.code,'CONFLICT');const committed=await first;assert.equal(committed.ok,true);
const final=await (await fetch(url('/draft'))).json();assert.equal(final.active.version,loaded.active.version+1);assert.equal(final.active.digest,saveBody.command.digest);
assert.deepEqual(final.active.semanticState.contexts.find(c=>c.contextOccurrenceId===id).slotSelections.outbound,routes.outbound);
assert.deepEqual(final.active.semanticState.contexts.find(c=>c.contextOccurrenceId===id).slotSelections.extras,routes.extras);
const evidence=await (await fetch(url('/evidence'))).json();assert.equal(evidence.remoteWrites,0);assert.equal(evidence.historicalCanaryWrites,0);assert.equal(evidence.log.some(x=>x.kind==='APPLY'),false);
assert.equal(evidence.drafts.events.filter(x=>x.kind==='SAVE').length,2);
const result={status:'EXECUTED_PASS_LOOPBACK_HTTP_SYNTHETIC_ONLY',auth:'NOT_RUN_AUTH',checks:['Bar+two directed legs+beer+absent date round-trip','central venue preserves independent legs','lost response resolved by read; idempotent replay without extra version','two concurrent CAS writes; one accepted, one conflict','independent outbound and beer retained after return edit','zero Apply and zero remote/financial canary writes'],successfulSaves:2,remoteWrites:0};
fs.mkdirSync('outputs/bar-p1',{recursive:true});fs.writeFileSync('outputs/bar-p1/http-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
