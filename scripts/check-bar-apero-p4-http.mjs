/** Real HTTP against the existing loopback fixture; no Supabase or Auth claim. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {require} from './lib/phase2-ts-loader.mjs';
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const base=process.env.BAR_P4_FIXTURE_ORIGIN??'http://127.0.0.1:3221';
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const scenario='P4_HTTP_'+crypto.randomUUID(),url=path=>base+path+'?scenario='+scenario;
const post=async(path,body,extra='')=>{const r=await fetch(url(path)+extra,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const text=await r.text();let value;try{value=JSON.parse(text);}catch{assert.equal(r.status,503,'Only the deliberately lost response may be non-JSON');value={code:'SIMULATED_LOST_RESPONSE'};}return {status:r.status,value};};
let sequence=0,model;
const request=async op=>{const r=await post('/interaction',{sequence:++sequence,targetMonth:'2026-11',draft:model?.semanticState,...op});assert.equal(r.value.ok,true,r.value.code);model=r.value.model;};
await request({kind:'READ'});
const parentId=crypto.randomUUID(),childId=crypto.randomUUID(),linkId=crypto.randomUUID();
await request({kind:'DROP',assetKey:'template:night-out',presetKey:'bar-apero',target:{kind:'BOARD_ZONE'},identity:parentId,selectionId:crypto.randomUUID(),values:{}});
const component=(label,amount,unitBasis='ITEM')=>({kind:'COMPONENT',selectionId:crypto.randomUUID(),optionKey:'extra',provenance:'EXPLICIT_USER_DECISION',label,quantity:'1',unitBasis,cost:amount===null?{kind:'UNKNOWN'}:{kind:'MANUAL',unitAmount:amount},fundingAllocations:[],binding:{mode:'AUTO'}});
const bottle={...component('Bouteille Before synthétique','25','SHARED'),optionKey:'activity'};
const mixer=component('Diluant synthétique','4'),snack=component('Snack synthétique',null),beer=component('Bière au bar synthétique','8');
await request({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:parentId,fields:{plannedDate:null},before:{childContextOccurrenceId:childId,selectionId:linkId,bottle,extras:[mixer,snack]},slots:{extras:[beer]}}});
const original=structuredClone(model.semanticState);
const snapshot=await (await fetch(url('/draft'))).json();
const command={targetMonth:'2026-11',expectedDraftId:snapshot.active?.draftId??null,expectedDraftVersion:snapshot.active?.version??0,requestId:crypto.randomUUID(),semanticState:original,digest:semanticStateDigest(original)};
const lost=await post('/draft',{kind:'SAVE',command},'&draftLoseAfterCommit=1');assert.equal(lost.status,503);
let durable=(await (await fetch(url('/draft'))).json()).active;assert.deepEqual(durable.semanticState,original);assert.equal(durable.digest,command.digest);assert.equal(durable.version,command.expectedDraftVersion+1);
const replay=await post('/draft',{kind:'SAVE',command});assert.equal(replay.value.replayed,true);assert.equal(replay.value.draft.version,durable.version);
const edited=structuredClone(original);edited.contexts.find(c=>c.contextOccurrenceId===childId).slotSelections.main.items[0].cost.unitAmount='26';
const second={...command,expectedDraftId:durable.draftId,expectedDraftVersion:durable.version,requestId:crypto.randomUUID(),semanticState:edited,digest:semanticStateDigest(edited)};
const delayed=post('/draft',{kind:'SAVE',command:second},'&draftDelay=350');await new Promise(r=>setTimeout(r,100));
const conflict=await post('/draft',{kind:'SAVE',command:{...command,expectedDraftId:durable.draftId,expectedDraftVersion:durable.version,requestId:crypto.randomUUID()}});assert.equal(conflict.value.code,'CONFLICT');assert.equal((await delayed).value.ok,true);
durable=(await (await fetch(url('/draft'))).json()).active;assert.deepEqual(durable.semanticState,edited);assert.equal(durable.version,command.expectedDraftVersion+2);
// Undo and Redo states are serialized through the same CAS endpoint. Shell keyboard is a separate browser proof.
for(const state of [original,edited]){const r=await post('/draft',{kind:'SAVE',command:{...command,expectedDraftId:durable.draftId,expectedDraftVersion:durable.version,requestId:crypto.randomUUID(),semanticState:state,digest:semanticStateDigest(state)}});assert.equal(r.value.ok,true);durable=(await (await fetch(url('/draft'))).json()).active;assert.deepEqual(durable.semanticState,state);}
await request({kind:'READ',draft:durable.semanticState});const summary=model.nightOutSummaries.find(s=>s.contextOccurrenceId===parentId);assert.equal(summary.knownAmount,'38.00');assert.equal(summary.incomplete,true);
assert.deepEqual(durable.semanticState.contexts.find(c=>c.contextOccurrenceId===parentId),original.contexts.find(c=>c.contextOccurrenceId===parentId));
assert.deepEqual(durable.semanticState.contexts.find(c=>c.contextOccurrenceId===childId).slotSelections.extras.items,[mixer,snack]);
const evidence=await (await fetch(url('/evidence'))).json();assert.equal(evidence.remoteWrites,0);assert.equal(evidence.historicalCanaryWrites,0);assert.equal(evidence.log.some(x=>x.kind==='APPLY'),false);assert.equal(evidence.drafts.events.filter(x=>x.kind==='SAVE').length,4);
const result={status:'EXECUTED_PASS_LOOPBACK_HTTP_SYNTHETIC_ONLY',auth:'NOT_RUN_AUTH_P4',scenario,parentId,childId,linkId,selectionIds:[bottle,mixer,snack,beer].map(x=>x.selectionId),checks:['rich Before with UNKNOWN and absent date round-trip','lost response read before idempotent replay; no extra version','two sessions same version: one write and one conflict','Undo and Redo serialized under CAS','only child bottle amount changed; other fields and IDs exact','official Compiler known 38.00 plus incomplete; no parent double count','zero Apply/remote/financial writes'],successfulSaves:4,finalVersion:durable.version,digest:durable.digest,summary,evidence};
fs.mkdirSync('outputs/bar-p4',{recursive:true});fs.writeFileSync('outputs/bar-p4/http-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,evidence:undefined}));
