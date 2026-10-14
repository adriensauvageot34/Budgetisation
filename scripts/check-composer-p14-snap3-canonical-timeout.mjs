import assert from 'node:assert/strict';
import {require} from './lib/phase2-ts-loader.mjs';

const {CanonicalRepository}=require('@/server/canonical/repository');
const {completeBasisSourceClient}=require('@/server/phase2/planner/historical-basis');
const context={householdId:'00000000-0000-4000-8000-000000000001',userId:'00000000-0000-4000-8000-000000000002',
  personIds:[],timezone:'Europe/Paris',asOf:'2026-10-14',contractVersion:'v2'};
const key='economic:test';
const timingRows=Array.from({length:1005},(_,i)=>({household_id:context.householdId,
  canonical_component_key:key,economic_segment_id:`segment-${String(i).padStart(4,'0')}`,
  economic_month:'2026-09-01'}));

function sourceClient(tableRows, failSecondPage=false){
  const reads=[];
  return {reads,from(table){
    const state={table,selectOptions:null,filters:[],orders:[],range:null,limit:null};
    const builder={
      select(_columns,options){state.selectOptions=options??null;return builder;},
      eq(column,value){state.filters.push(row=>row[column]===value);return builder;},
      gte(column,value){state.filters.push(row=>row[column]>=value);return builder;},
      lt(column,value){state.filters.push(row=>row[column]<value);return builder;},
      in(column,values){state.filters.push(row=>values.includes(row[column]));return builder;},
      order(column){state.orders.push(column);return builder;},
      range(from,to){state.range=[from,to];return builder;},
      limit(n){state.limit=n;return builder;},
      then(resolve,reject){
        reads.push({...state,filters:undefined});
        if(failSecondPage&&state.table==='financial_economic_timing_canonical'&&state.range?.[0]===1000)
          return Promise.resolve({data:null,error:{code:'57014',message:'synthetic timeout'}}).then(resolve,reject);
        let rows=(tableRows[table]??[]).filter(row=>state.filters.every(filter=>filter(row)));
        rows=[...rows].sort((a,b)=>{for(const column of state.orders){const diff=String(a[column]??'').localeCompare(String(b[column]??''));if(diff)return diff;}return 0;});
        const count=state.selectOptions?.count==='exact'?rows.length:null;
        if(state.range)rows=rows.slice(state.range[0],state.range[1]+1);
        else if(state.limit!==null)rows=rows.slice(0,state.limit);
        else rows=rows.slice(0,1000); // PostgREST response ceiling in this fixture.
        return Promise.resolve({data:rows,error:null,count}).then(resolve,reject);
      }
    };
    return builder;
  }};
}

const places=sourceClient({operation_place_canonical:[{canonical_component_key:key,place_id:null}]});
const placeRows=await completeBasisSourceClient(places).from('operation_place_canonical')
  .select('canonical_component_key,place_id').in('canonical_component_key',[key]).order('canonical_component_key');
assert.equal(placeRows.data.length,1);
assert.equal(places.reads[0].selectOptions,null,'bounded place query must avoid exact count');
assert.equal(places.reads[0].range,null);
console.log('BOUNDED-PLACE-READ-NO-EXACT-COUNT PASS');

const unboundedPlace=sourceClient({operation_place_canonical:[]});
await assert.rejects(Promise.resolve(completeBasisSourceClient(unboundedPlace).from('operation_place_canonical')
  .select('canonical_component_key')),/BASIS_SOURCE_INCOMPLETE/);
console.log('UNBOUNDED-PLACE-READ-FAIL-CLOSED PASS');

const timing=sourceClient({financial_economic_timing_canonical:timingRows});
const repo=new CanonicalRepository(completeBasisSourceClient(timing),context,{shareEconomicReads:true});
const keyed=await repo.loadTimingRowsByKeys([key]);
assert.equal(keyed.length,1005);
assert.equal(keyed[0].economic_segment_id,'segment-0000');
assert.equal(keyed.at(-1).economic_segment_id,'segment-1004');
assert.deepEqual(timing.reads.map(read=>read.range),[[0,999],[1000,1999]]);
assert.ok(timing.reads.every(read=>read.selectOptions===null));
console.log('TIMING-KEYED-ALL-PAGES-LOSSLESS-NO-EXACT-COUNT PASS');

const timingRange=sourceClient({financial_economic_timing_canonical:timingRows});
const rangeRepo=new CanonicalRepository(completeBasisSourceClient(timingRange),context);
const range=await rangeRepo.loadTimingRowsForRange({start:'2026-09-01',endExclusive:'2026-10-01'});
assert.equal(range.length,1005);
assert.deepEqual(timingRange.reads.map(read=>read.range),[[0,999],[1000,1999]]);
console.log('TIMING-RANGE-ALL-PAGES-LOSSLESS PASS');

const failing=sourceClient({financial_economic_timing_canonical:timingRows},true);
const failingRepo=new CanonicalRepository(completeBasisSourceClient(failing),context);
await assert.rejects(failingRepo.loadTimingRowsByKeys([key]),error=>error.name==='CanonicalReadError'&&error.source==='timing');
console.log('TIMING-SECOND-PAGE-ERROR-NO-PARTIAL-SUCCESS PASS');

const other=sourceClient({operations:[{operation_id:'op-1'}]});
const otherRows=await completeBasisSourceClient(other).from('operations').select('operation_id');
assert.equal(otherRows.data.length,1);
assert.deepEqual(other.reads[0].selectOptions,{count:'exact'});
console.log('OTHER-UNBOUNDED-SOURCES-KEEP-EXACT-COUNT PASS');
