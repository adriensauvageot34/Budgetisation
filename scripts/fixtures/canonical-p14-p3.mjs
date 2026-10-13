// Synthetic history exercising the real Canonical repository, projections and
// Global Mobility context consumer. Never reads a user or a remote database.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
export const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export function history({months=24,eventsPerMonth=12,household=uuid(1),unknown=false}={}){
  const persons=[uuid(2),uuid(3)],calendar=Array.from({length:months},(_,i)=>{const d=new Date(Date.UTC(2024,6+i,1));return d.toISOString().slice(0,7);});
  const periods=calendar.map(month=>({analysisPeriodId:uuid(500+Number(month.replace('-',''))),householdId:household,month:month+'-01',financeStatus:'complete',lifeStatus:'complete',locationStatus:'complete',calendarStatus:'complete',isClosed:true,sourceRevision:1}));
  const context={householdId:household,timezone:'Europe/Paris',personIds:persons,persons:persons.map((personId,i)=>({personId,householdId:household,displayName:'Synthetic person '+i})),periods,asOf:'2026-07-03T10:00:00Z'};
  const days=calendar.flatMap((month,m)=>Array.from({length:20},(_,d)=>persons.map((person_id,p)=>({person_day_id:uuid(10000+m*100+d*2+p),person_id,date:month+'-'+String(d+1).padStart(2,'0'),couverture_localisation:unknown?'Partielle':'Complète'}))).flat());
  const locations=days.map((day,i)=>({localization_id:uuid(20000+i),person_day_id:day.person_day_id,person_id:day.person_id,place_id:uuid(90+i%2),start_at:unknown?null:day.date+'T08:00:00Z',end_at:unknown?null:day.date+'T09:00:00Z',time_precision:unknown?'Inconnu':'Exact',sequence_index:1,occurrence_type:'Présence'}));
  const events=calendar.flatMap((month,m)=>Array.from({length:eventsPerMonth},(_,e)=>({life_event_id:uuid(30000+m*eventsPerMonth+e),life_event_type_id:uuid(50),life_event_series_id:e%3?null:uuid(60),parent_life_event_id:e%2?uuid(30000+m*eventsPerMonth+e-1):null,start_date:month+'-'+String(e%20+1).padStart(2,'0'),end_date:month+'-'+String(e%20+1).padStart(2,'0'),validation_status:e%3?'Confirmé':'Déduit',primary_place_id:uuid(90),title:'Synthetic event',extra_unselected:'unselected-'+e} )));
  const parts=events.flatMap(event=>persons.map((person_id,p)=>({life_event_id:event.life_event_id,person_day_id:days.find(day=>day.person_id===person_id&&day.date===event.start_date).person_day_id,person_id,start_at:unknown?null:event.start_date+'T08:00:00Z',end_at:unknown?null:event.end_date+'T09:00:00Z',time_precision:unknown?'Inconnu':'Exact',participation_role:'Participant',participation_status:unknown&&p===1?'Inconnue':p?'Déduite':'Confirmée'})));
  const links=parts.map(part=>({life_event_id:part.life_event_id,localization_id:locations.find(loc=>loc.person_day_id===part.person_day_id).localization_id}));
  const tables={canonical_household_scope_control:[{household_count:1,household_id:household,status:'READY'}],person_days:days,location_occurrences:locations,life_events:events,
    life_event_participations:parts,life_event_localizations:links,life_event_types:[{life_event_type_id:uuid(50),type_key:'family_visit',can_span_days:true,active:true}],life_event_continuity_assertions:[],life_event_financial_links:[]};
  return{context,tables,calendar,broad:{start:calendar[0]+'-01',endExclusive:new Date(Date.UTC(2024,6+months,1)).toISOString().slice(0,10)}};
}
export function historyClient(data,{delayMs=0,cap=1000,failTable,failCall,failCode='57014',duplicate=false}={}){
  const calls=[];let active=0,peak=0,cpuMs=0;
  const client={from(table){let selection='*',filters=[],order=[],limit=Infinity,offset=0;const query={
    select:s=>(selection=s,query),in:(c,v)=>{assert.ok(v.length<=120,'bounded physical IN');filters.push([c,'in',v]);return query;},
    eq:(c,v)=>(filters.push([c,'eq',v]),query),gte:(c,v)=>(filters.push([c,'gte',v]),query),lte:(c,v)=>(filters.push([c,'lte',v]),query),lt:(c,v)=>(filters.push([c,'lt',v]),query),
    order:(c,o)=>(order.push([c,o?.ascending!==false]),query),limit:n=>(limit=n,query),range:(from,to)=>(offset=from,limit=to-from+1,query),
    then(resolve,reject){return(async()=>{const row={table,selection,keys:filters.find(f=>f[1]==='in')?.[2].length??0,offset,at:performance.now()};calls.push(row);active++;peak=Math.max(peak,active);
      try{if(delayMs)await new Promise(r=>setTimeout(r,delayMs));const started=performance.now();
        if((table===failTable)&&(failCall===undefined||calls.filter(c=>c.table===table).length===failCall)){
          if(failCode==='NETWORK')throw Error('Synthetic network failure');
          return{data:null,error:{code:failCode,message:'Synthetic read failure'}};}
        assert.ok(Object.hasOwn(data.tables,table),'unexpected table '+table);
        let rows=data.tables[table].filter(item=>filters.every(([c,op,v])=>op==='in'?v.includes(item[c]):op==='eq'?item[c]===v:item[c]!==null&&item[c]!==undefined&&(op==='gte'?item[c]>=v:op==='lte'?item[c]<=v:item[c]<v)));
        rows=rows.toSorted((a,b)=>{for(const[c,asc]of order){const n=String(a[c]??'').localeCompare(String(b[c]??''));if(n)return asc?n:-n;}return 0;});
        rows=rows.slice(offset,offset+Math.min(limit,typeof cap==='object'?(cap[table]??1000):cap));
        if(duplicate&&table==='life_events'&&rows.length)rows=[...rows,rows[0]];
        if(selection!=='*')rows=rows.map(item=>Object.fromEntries(selection.split(',').filter(c=>Object.hasOwn(item,c)).map(c=>[c,item[c]])));
        row.rows=rows.length;row.bytes=Buffer.byteLength(JSON.stringify(rows));cpuMs+=performance.now()-started;row.ms=performance.now()-row.at;
        return{data:structuredClone(rows),error:null};
      }finally{active--;}})().then(resolve,reject);}
  };return query;}};
  return{client,calls,metrics:()=>({physicalReads:calls.length,rows:calls.reduce((n,c)=>n+(c.rows??0),0),bytes:calls.reduce((n,c)=>n+(c.bytes??0),0),transportCpuMs:cpuMs,peakPhysicalConcurrency:peak,
    byTable:Object.fromEntries([...new Set(calls.map(c=>c.table))].map(table=>[table,{gets:calls.filter(c=>c.table===table).length,rows:calls.filter(c=>c.table===table).reduce((n,c)=>n+(c.rows??0),0),bytes:calls.filter(c=>c.table===table).reduce((n,c)=>n+(c.bytes??0),0)}]))})};
}
