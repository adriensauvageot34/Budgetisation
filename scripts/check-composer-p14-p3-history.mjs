import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import Module from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {require} from './lib/phase2-ts-loader.mjs';
import {history,historyClient,uuid} from './fixtures/canonical-p14-p3.mjs';
const {CanonicalRepository}=require('@/server/canonical/repository');
const legacy=new Module(process.cwd()+'/src/server/canonical/p3-previous-repository.ts');legacy.filename=legacy.id;legacy.paths=require.resolve.paths('typescript');
legacy._compile(ts.transpileModule(execFileSync('git',['show','37055156f0a9bf59700405e349fee0c55c0363b0:src/server/canonical/repository.ts'],{encoding:'utf8'}),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,legacy.filename);
const {resolveGlobalM7MobilityContextAuthority}=require('@/server/analytics/global-v2-mobility-context-authority');
const {fixture:baselineFixture}=await import('./fixtures/planner-baseline.mjs');
const {buildRenewalPlanningBaseline:buildPlanningBaseline}=require('@/server/phase2/planner/renewal-baseline');
const {fixture:worldFixture,state}=await import('./fixtures/planner-headless.mjs');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {createKernelPostgres}=await import('./lib/planner-kernel-postgres.mjs');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const {HistoricalRequestRows}=require('@/server/canonical/historical-request-rows');
const pg=await createKernelPostgres(),checks=[],pairs=[],financialProofs=[];
globalThis.fetch=async()=>{throw Error('P3_REMOTE_NETWORK_FORBIDDEN');};
function setup(variant,data=history(),options={}){const c=historyClient(data,options),Type=variant==='P2'?legacy.exports.CanonicalRepository:CanonicalRepository,repo=new Type(c.client,data.context,{shareEconomicReads:true,...(variant==='P2'?{}:{historicalReads:variant==='A'?'keys':'projected'})}),logical={};
  for(const name of ['loadPlaceVisits','loadActivityOccurrences','loadLifeEventParticipationRows','loadLifeEventLocalizationRows','loadLifeEventRecords','loadLifeEventRecord','loadActivityOccurrenceById']){const original=repo[name].bind(repo);repo[name]=(...args)=>{logical[name]=(logical[name]??0)+1;return original(...args);};}
  // Unchanged owners outside the three targeted historical tables are empty in
  // this scoped transport fixture; Mobility's actual context builder is invoked.
  repo.loadMobilityLegFacts=async()=>[];return{...c,repo,data,logical};}
async function traversal(s){const {repo,data}=s,at=performance.now(),cpu=process.cpuUsage(),heap=process.memoryUsage().heapUsed;
  const [visits,activities]=await Promise.all([repo.loadPlaceVisits(data.broad),repo.loadActivityOccurrences(data.broad)]);
  const ids=activities.map(e=>e.lifeEventId),subset=ids.slice(80,220);
  const [records,participants,locations]=await Promise.all([repo.loadLifeEventRecords(ids),repo.loadLifeEventParticipationRows(ids),repo.loadLifeEventLocalizationRows(ids)]);
  const parts=[];for(const month of data.calendar.slice(-6)){const range={start:month+'-01',endExclusive:new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString().slice(0,10)};
    parts.push(await repo.loadPlaceVisits(range),await repo.loadActivityOccurrences(range));}
  const subsetResults=await Promise.all([repo.loadLifeEventRecords(subset),repo.loadLifeEventParticipationRows(subset),repo.loadLifeEventLocalizationRows(subset)]);
  const singles=[];for(const id of ids.slice(0,5))singles.push(await repo.loadActivityOccurrenceById(id));
  const mobility=await resolveGlobalM7MobilityContextAuthority({repository:repo,certifiedThrough:'2026-06-30'});
  const links=await repo.loadActivityCausalFinancialLinkRows(ids);
  const elapsed=performance.now()-at,usage=process.cpuUsage(cpu),heapDeltaBytes=process.memoryUsage().heapUsed-heap;
  // Serialized payload of additional P3 row maps/ranges, not V8 retained heap.
  const h=repo.historicalRows,identityPayload=h?[...h.identities.values()].flatMap(rows=>[...rows.values()]):[];
  const rangePayload=h?await Promise.all([...h.eventRanges.values()].map(range=>range.rows)):[];
  const historicalPayloadBytes=Buffer.byteLength(JSON.stringify({identities:identityPayload,ranges:rangePayload}));
  return{facts:{visits,activities,records,participants,locations,parts,subsetResults,singles,mobility,links},measure:{...s.metrics(),wallMs:elapsed,cpuMs:(usage.user+usage.system)/1000,heapDeltaBytes,historicalPayloadBytes,
    historicalRows:repo.historicalRows?.metrics()??{identityEntries:0,ranges:0,identityHits:0,rangeHits:0},logicalTargetCalls:Object.values(s.logical).reduce((n,x)=>n+x,0),logicalMethods:s.logical}};
}
const check=async(name,fn)=>{await fn();checks.push(name);console.log(name+' PASS');};
try{
  const reference=await traversal(setup('P2'));
  for(const variant of ['A','B'])await check('P3-FULL-FACTS-RELATIONS-PROJECTIONS-'+variant,async()=>{const r=await traversal(setup(variant));assert.deepEqual(r.facts,reference.facts);pairs.push({variant,...r.measure});});
  await check('P3-BASELINE-COMPOSER-FINANCIAL-DIGEST-PARITY',async()=>{let previous;
    for(const variant of ['P2','A','B']){const sources=baselineFixture(),s=setup(variant,history({household:sources.householdId})),r=await traversal(s);sources.targetMonth='2026-11';sources.forecast.meta.targetMonth=sources.targetMonth;
      sources.monthInputs.declaredOutflows.forEach(o=>{o.dueDate='2026-11-15';});
      sources.plannedExpenses.forEach(e=>{e.householdId=sources.householdId;e.targetMonth=sources.targetMonth;e.plannedDate='2026-11-10';});
      sources.evidence.personNamesById[uuid(2)]='Synthetic person 0';sources.evidence.personNamesById[uuid(3)]='Synthetic person 1';
      sources.simpleOccurrences={occurrences:r.facts.activities,links:[]};
      const baseline=buildPlanningBaseline(sources),world={...worldFixture(),baseline};
      const response=await handleComposerRequest({repository:createPlanApplyRepository(pg.client),readWorld:async()=>world},sources.householdId,{kind:'READ',sequence:1,targetMonth:'2026-11',draft:state()});
      assert.equal(response.ok,true,response.code);const result={baseline,response};if(previous)assert.deepEqual(result,previous);previous=result;
      financialProofs.push({variant,baselineAndFullModelSha256:createHash('sha256').update(JSON.stringify(result)).digest('hex')});}
  });
  await check('P3-UNKNOWN-PARTIAL-MULTIPERSON-PARENT-CHILD',async()=>{const d=history({unknown:true});const a=await traversal(setup('P2',d)),b=await traversal(setup('B',d));assert.deepEqual(b.facts,a.facts);assert.ok(b.facts.activities.some(e=>e.parentLifeEventId));assert.ok(b.facts.visits.some(v=>v.interval.kind==='unknown'));});
  await check('P3-OUTSIDE-PERIOD-ABSENT-IDENTITIES-AND-TRANSIT',async()=>{const d=history(),outside={...d.tables.life_events[0],life_event_id:uuid(99901),start_date:'2022-01-01',end_date:'2022-01-01'};d.tables.life_events.push(outside);
    const loc={...d.tables.location_occurrences[0],localization_id:uuid(99902),occurrence_type:'Transit'};d.tables.location_occurrences.push(loc);d.tables.life_event_localizations.push({life_event_id:d.tables.life_events[0].life_event_id,localization_id:loc.localization_id});
    const results=[];for(const variant of ['P2','B']){const s=setup(variant,d);await s.repo.loadPlaceVisits(d.broad);await s.repo.loadActivityOccurrences(d.broad);results.push({outside:await s.repo.loadActivityOccurrenceById(outside.life_event_id),absent:await s.repo.loadActivityOccurrenceById(uuid(99999)),locs:await s.repo.loadLifeEventLocalizationRows([d.tables.life_events[0].life_event_id])});}
    assert.deepEqual(results[1],results[0]);assert.ok(results[1].outside);assert.equal(results[1].absent,null);
  });
  await check('P3-OVERLAPPING-KEYS-EMPTY-AND-CONCURRENT-READS',async()=>{const d=history(),results=[];for(const variant of ['P2','B']){const s=setup(variant,d,{delayMs:2}),ids=d.tables.life_events.map(e=>e.life_event_id);results.push(await Promise.all([s.repo.loadLifeEventParticipationRows(ids.slice(0,120)),s.repo.loadLifeEventParticipationRows(ids.slice(60,180)),s.repo.loadLifeEventParticipationRows([uuid(99999)])]));}assert.deepEqual(results[1],results[0]);});
  await check('P3-CAPPED-GROUP-AND-RANGE-FALLBACK-NO-FALSE-ABSENCE',async()=>{const d=history({eventsPerMonth:50});
    for(const variant of ['P2','B']){const s=setup(variant,d);const large=await s.repo.loadActivityOccurrences(d.broad);assert.equal(large.length,1000);const id=d.tables.life_events.at(-1).life_event_id;assert.ok(await s.repo.loadActivityOccurrenceById(id));assert.ok(s.calls.some(c=>c.table==='life_events'&&c.keys===0&&c.selection.includes('start_date')));}
    // 1,000 rows for one relation key: retain its legacy first response, then
    // refetch the original subset rather than treating a partial group as complete.
    const d2=history(),id=d2.tables.life_events[0].life_event_id;d2.tables.life_event_participations=Array.from({length:1200},(_,i)=>({...d2.tables.life_event_participations[0],life_event_id:id,person_day_id:uuid(70000+i)}));
    const s=setup('B',d2);await s.repo.loadLifeEventParticipationRows([id,uuid(99999)]);await s.repo.loadLifeEventParticipationRows([id]);assert.equal(s.calls.filter(c=>c.table==='life_event_participations').length,2);
  });
  await check('P3-ERROR-ATOMIC-AND-DUPLICATE-CONFLICT',async()=>{const d=history(),ids=d.tables.life_events.map(e=>e.life_event_id),s=setup('B',d,{failTable:'life_event_participations'});
    await assert.rejects(()=>s.repo.loadLifeEventParticipationRows(ids));await assert.rejects(()=>s.repo.loadLifeEventParticipationRows(ids.slice(0,5)));
    const h=new HistoricalRequestRows();h.observe('test','id','id,v',[{id:'one',v:1}]);assert.throws(()=>h.observe('test','id','id,v',[{id:'two',v:2},{id:'one',v:3}]));assert.equal(h.known('test',['two']),undefined);
  });
  await check('P3-PERMISSION-AND-NETWORK-FAIL-CLOSED',async()=>{for(const failCode of ['42501','NETWORK'])for(const variant of ['P2','B']){
    const d=history(),s=setup(variant,d,{failTable:'life_event_participations',failCode}),ids=d.tables.life_events.map(e=>e.life_event_id);
    await assert.rejects(()=>s.repo.loadLifeEventParticipationRows(ids));await assert.rejects(()=>s.repo.loadLifeEventParticipationRows(ids.slice(0,5)));
  }});
  await check('P3-REPOSITORIES-HOUSEHOLDS-RETROACTIVE-CHANGES',async()=>{const first=history(),second=structuredClone(first);second.tables.life_event_participations[0].participation_status='Inconnue';
    const a=setup('B',first),b=setup('B',second);const id=first.tables.life_events[0].life_event_id;assert.notDeepEqual(await a.repo.loadLifeEventParticipationRows([id]),await b.repo.loadLifeEventParticipationRows([id]));
    const other=history({household:uuid(11)});const f=await setup('B',other).repo.loadPlaceVisits(other.broad);assert.ok(f.every(row=>row.householdId===uuid(11)));
  });
  await check('P3-RECORD-SINGLE-UNIQUENESS-NOT-BYPASSED',async()=>{const d=history();
    for(const variant of ['P2','B']){const s=setup(variant,d,{duplicate:true}),id=d.tables.life_events[0].life_event_id;
      await s.repo.loadLifeEventRecords([id]);await assert.rejects(()=>s.repo.loadLifeEventRecord(id),/unique/);
      assert.equal(s.calls.filter(c=>c.table==='life_events').length,2);}
  });
  await check('P3-PAGINATION-ALL-PAGES-AND-SECOND-PAGE-FAIL-CLOSED',async()=>{const d=history({eventsPerMonth:50});
    for(const variant of ['P2','B']){const s=setup(variant,d),rows=await s.repo.readRowsPaginated('fixture-paged','life_events',(from,to)=>s.client.from('life_events').select('life_event_id').order('life_event_id').range(from,to));
      assert.equal(rows.length,1200);assert.equal(s.calls.filter(c=>c.table==='life_events').length,2);}
    const s=setup('B',d,{failTable:'life_events',failCall:2});await assert.rejects(()=>s.repo.readRowsPaginated('fixture-paged-error','life_events',(from,to)=>s.client.from('life_events').select('life_event_id').order('life_event_id').range(from,to)));
  });
  await check('P3-TEMPORAL-BOUNDARIES-PROJECTION-AND-PUBLICATION',async()=>{const d=history();d.tables.life_events[0].start_date='2024-06-30';d.tables.life_events[0].end_date='2024-07-01';
    const results=[];for(const variant of ['P2','B']){const s=setup(variant,d);await s.repo.loadActivityOccurrences(d.broad);const july=await s.repo.loadActivityOccurrences({start:'2024-07-01',endExclusive:'2024-08-01'});
      const full=await s.repo.loadLifeEventRecords(july.map(e=>e.lifeEventId));results.push({july,full});assert.ok(full.some(e=>e.extra_unselected!==undefined),'partial facts cannot supply wildcard fields');}
    assert.deepEqual(results[1],results[0]);assert.ok(results[1].july.some(e=>e.startDate==='2024-06-30'));
    const {admitPlanningForecast}=require('@/server/phase2/planner/baseline-adapters');const pub={publication_id:'synthetic-a',source_revision:1,published_analytics_revision:1};
    const forecast={meta:{targetMonth:'2026-11',sourcePublicationId:'synthetic-b',sourceRevision:1,analyticsRevision:1}};
    assert.throws(()=>admitPlanningForecast(pub,'2026-11',forecast),/AUTHORITIES_CHANGED/);
  });
  await check('P3-CACHED-RANGE-NOT-PROOF-OF-LIVE-SOURCE-REVISION',async()=>{const d=history(),s=setup('B',d),first=await s.repo.loadActivityOccurrences(d.broad);
    d.tables.life_events[0].validation_status='À valider';const admitted=await s.repo.loadActivityOccurrences({start:d.broad.start,endExclusive:'2024-08-01'});
    assert.ok(admitted.some(e=>e.lifeEventId===first[0].lifeEventId));const fresh=await setup('B',d).repo.loadActivityOccurrences(d.broad);
    assert.ok(!fresh.some(e=>e.lifeEventId===first[0].lifeEventId));
  });
  const samples=[];if(process.env.P14_P3_SKIP_BENCH!=='1')for(const latency of [0,15,75])for(let n=0;n<3;n++)for(const variant of n%2?['B','A','P2']:['P2','A','B']){const r=await traversal(setup(variant,history(),{delayMs:latency}));assert.deepEqual(r.facts,reference.facts);samples.push({variant,latency,...r.measure});console.log(`P3 sample variant=${variant} latency=${latency} reads=${r.measure.physicalReads}`);}
  await pg.verifyCanaries();const report={status:'EXECUTED_PASS_TARGETED_HISTORY_FIXTURE_ONLY',checks,reference:reference.measure,variants:pairs,samples,financialProofs,realWorld:'NOT_MEASURED',realSupabase:'NOT_RUN',remoteWrites:0};
  if(process.env.P14_P3_REPORT)fs.writeFileSync(process.env.P14_P3_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:checks.length,reference:reference.measure,variants:pairs}));
}finally{await pg.close();}
