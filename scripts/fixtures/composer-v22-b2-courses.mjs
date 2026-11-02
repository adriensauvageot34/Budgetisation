import {monthFixture} from './composer-v22-b1.mjs';
import {rebuild,findSlot,control} from './planner-headless.mjs';
import {require} from '../lib/phase2-ts-loader.mjs';
const {planningBaselineDigest}=require('@/server/phase2/planner/baseline');

/** Synthetic in-memory Courses; all capabilities/floors are built by the owner. */
export function coursesFixture(month='2026-11',mode='normal'){
 const f=monthFixture(),w=f.world;
 w.asOfDate=`${month}-02`;w.sources.targetMonth=month;w.sources.knowledgeCutoff=`${month}-02T10:00:00Z`;
 w.forecast.meta.targetMonth=month;w.forecast.referencePlan.targetMonth=month;
 w.monthInputs.declaredOutflows=w.monthInputs.declaredOutflows.map(row=>({...row,dueDate:row.dueDate?`${month}-${row.dueDate.slice(8)}`:null}));
 w.sources.evidence.currentEconomicEntries=[{operationId:`synthetic-courses-${month}`,date:`${month}-01`,amount:'230.00',subcategory:'Courses alimentaires',person:null,preciseType:null,merchant:null}];
 w.sources.forecast=w.forecast;rebuild(w);
 const slot=findSlot(w,'groceries');
 if(mode==='no-capability'){slot.capabilities=[];w.baseline.digest=planningBaselineDigest(w.baseline);}
 const semantic={...f.semantic,targetMonth:month,controls:[control(slot.slotIdentityKey,{amount:'250.00'},99001)]};
 // The no-capability model starts without an inadmissible existing control.
 if(mode==='no-capability')semantic.controls=[];
 const deps={...f.deps,readWorld:async(h,target)=>{
  if(target!==month)throw new TypeError('B2_FIXTURE_MONTH_INVALID');return w;
 }};
 return {...f,world:w,semantic,deps,targetRef:slot.slotIdentityKey};
}
