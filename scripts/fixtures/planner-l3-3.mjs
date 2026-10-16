import {require} from '../lib/phase2-ts-loader.mjs';
import {fixture,state,uuid} from './planner-headless.mjs';
const {planningBaselineDigest}=require('@/server/phase2/planner/baseline');
export function l33Month(dense=false){
 const world=fixture(),semantic=state();
 const coffee=world.baseline.slots.find(s=>s.semanticKey==='adrien-work-coffee');
 coffee.baselineValue={...coffee.baselineValue,count:'12',unitAmount:'1.80'};
 const hair=world.baseline.slots.find(s=>s.semanticKey==='hairdresser');
 if(hair)hair.baselineValue={...hair.baselineValue,count:'1',unitAmount:null};
 world.baseline.digest=planningBaselineDigest(world.baseline);
 if(dense)semantic.contexts=Array.from({length:24},(_,i)=>({contextOccurrenceId:uuid(33001+i),templateKey:'purchase',status:'ACTIVE',parentContextOccurrenceId:null,
  provenance:'EXPLICIT_USER_DECISION',fields:{fieldSchemaVersion:'context-fields@v2',label:`Achat synthétique ${i+1}`},slotSelections:{}}));
 return {world,semantic};
}
