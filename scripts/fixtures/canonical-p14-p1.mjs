// Synthetic Canonical rows only. Exercises the production repository and parsers.
import assert from 'node:assert/strict';
export const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const context = { householdId:uuid(1), timezone:'Europe/Paris', personIds:[], persons:[], periods:[], asOf:'2026-10-13T10:00:00Z' };
export const components = ids => ids.map(id => ({ operation_id:id, cash_use_id:null, source_layer:'Operation_parent', component_id:id,
  canonical_economic_gross:'10.00', refund_applied:'0.00', canonical_economic_net:'10.00', canonical_economic_amount:'10.00',
  category_id:null, subcategory_id:null, moment_id:null, canonical_component_key:`operation:${id}`, source_kind:'Operation' }));
export function canonicalClient({ delayMs=0, failTable, unknown=false, partial=false, amount='10.00', household=context.householdId }={}) {
  const calls=[];
  return {calls, client:{from(table){
    let values=[],column,selection,filters=[];
    const q={select(s){selection=s;return q;},in(c,v){column=c;values=[...v];return q;},eq(c,v){filters.push([c,v]);return q;},
      order(){return q;},limit(){return q;},then(resolve,reject){return (async()=>{
        assert.ok(values.length<=120,'bounded physical read');
        if(delayMs)await new Promise(r=>setTimeout(r,delayMs));
        let rows=[];
        if(table==='canonical_household_scope_control')rows=[{household_count:1,household_id:household,status:'READY'}];
        else if(table==='financial_economic_cost_canonical')rows=components(values).map(r=>({...r,canonical_economic_gross:amount,canonical_economic_net:amount,canonical_economic_amount:amount}));
        else if(table==='operations')rows=values.map(id=>({operation_id:id,date_bancaire:'2026-01-15',mois_analytique_force:null,
          date_transaction_reelle:null,date_transaction_precision:null,merchant_id:null,importance:null,nature_fixe_variable:null,contexte_vie:null}));
        else if(table==='operation_place_canonical')rows=values.map(key=>({canonical_component_key:key,operation_id:key.slice(10),place_id:null,resolution_state:'unknown'}));
        else if(table==='financial_economic_timing_canonical')rows=unknown?[]:values.map(key=>({household_id:household,canonical_component_key:key,
          economic_segment_id:uuid(Number(key.slice(-12))+100000),timing_state:unknown?'Unknown':'Known',period_start:unknown?null:'2025-08-01',
          period_end:unknown?null:'2025-08-31',economic_month:unknown?null:'2025-08-01',economic_amount:amount,attribution_method:'fixture',method_version:'fixture@v1'}));
        else if(table==='financial_economic_timing_control')rows=values.map(key=>({canonical_component_key:key,canonical_economic_net:amount,
          segment_count:unknown?0:1,known_count:unknown?0:1,partial_count:0,unknown_count:0,household_count:unknown?0:1,household_mismatch_count:0,
          segment_amount_sum:unknown?null:amount,amount_delta:unknown?null:'0.00',status:unknown?'UNKNOWN':'RECONCILED'}));
        else if(table==='financial_canonical_reconciliation_control')rows=values.map(id=>({operation_id:id,economic_gross_delta:'0.00',economic_refund_resolution:'NONE',economic_status:'OK'}));
        else if(table==='financial_source_person_links'&&partial)rows=values.map(id=>({source_kind:'Operation',operation_id:id,allocation_id:null,item_id:null,
          cash_use_id:null,person_id:uuid(2),relation_type:'beneficiary_share',share_exact:'0.5'}));
        else assert.ok(['operation_allocations','operation_items','payment_components','cash_economic_uses','financial_source_person_links'].includes(table),table);
        calls.push({table,column,keys:values.length,selection,filters,rows:rows.length,bytes:Buffer.byteLength(JSON.stringify(rows))});
        return {data:failTable===table?null:rows,error:failTable===table?{code:'57014',message:'Synthetic statement timeout'}:null};
      })().then(resolve,reject);}};
    return q;
  }}};
}
