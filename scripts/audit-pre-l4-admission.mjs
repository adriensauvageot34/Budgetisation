import fs from 'node:fs';
import {require} from './lib/phase2-ts-loader.mjs';
import {fixture,state,control,householdId} from './fixtures/planner-headless.mjs';
const {materializePlanSlots}=require('@/server/phase2/planner/plan-slot-resolver');
const {controlFields}=require('@/server/phase2/planner/control-fields');
const {validateControlValue}=require('@/domain/phase2/planner/control-input');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const world=fixture(),slot=world.baseline.slots.find(s=>s.semanticKey==='restaurants');
const card={capability:{flexibility:'SAFE_FLEX',actions:['SET_SLOT_OCCURRENCES'],fields:controlFields(slot,false)}};
const value={count:'10000'};let mutationRefused=false,compilerAccepted=false,error=null;
try{validateControlValue(card,value);}catch{mutationRefused=true;}
try{compilerAccepted=materializePlanSlots(world.baseline,state([control(slot.slotIdentityKey,value,450)])).find(s=>s.baseline.slotIdentityKey===slot.slotIdentityKey).effectiveCount==='10000';}catch(e){error=e.message;}
globalThis.fetch=async()=>{throw Error('A0_REMOTE_FORBIDDEN');};
const deps={readWorld:async()=>world,repository:{readActivePlan:async()=>null,applyRevision:async()=>{throw Error('A0_WRITER_FORBIDDEN');}},householdPersons:[]};
const read=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:1,targetMonth:'2026-11',draft:state([control(slot.slotIdentityKey,value,450)])});
const wholeDraftRead={ok:read.ok,code:read.ok?null:read.code,count:read.ok?[...read.model.board.baselineControls,...read.model.board.discretionaryControls].find(c=>c.targetRef===slot.slotIdentityKey)?.value.count:null};
const proof={environment:'REAL_OWNER_MODULES_AND_READ_SERVICE_SYNTHETIC_NO_SQL',targetRef:slot.slotIdentityKey,publishedMaximum:card.capability.fields.count.maximum,probeValue:value,mutationRefused,compilerAccepted,wholeDraftRead,error,classification:mutationRefused&&compilerAccepted?'CONFIRMED_ADMISSION_INCONSISTENCY':'NO_INCONSISTENCY_PROVEN',limit:'No Apply issued; this is not proof of bypassing Savings or financial floors',remoteCalls:0};
fs.writeFileSync('docs/status/evidence/pre-l4-audit/admission-boundary.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
