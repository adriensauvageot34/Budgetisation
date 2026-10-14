import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {require} from './lib/phase2-ts-loader.mjs';
import {isolatedStore} from './lib/snap1-isolated-store.mjs';
import {history,uuid} from './fixtures/canonical-p14-p3.mjs';
import {fixture,state,householdId,nightMonth,weekendMonth,externalMonth} from './fixtures/planner-headless.mjs';
const {CanonicalRepository}=require('@/server/canonical/repository');
const {readActivityHistory,readDirectActivityHistory,prepareActivityHistory,activityHistoryScope,ACTIVITY_HISTORY_COVERAGE}=require('@/server/phase2/planner/activity-history-artifact');
const {plannerDigest}=require('@/domain/phase2/planner/json');
const {ACTIVITY_EVENT_COLUMNS,PARTICIPATION_FACT_COLUMNS}=require('@/server/canonical/historical-request-rows');
const replacedReads=metrics=>metrics.calls.filter(c=>c.table==='life_event_types'||c.table==='life_event_financial_links'
  ||c.table==='life_events'&&c.selection===ACTIVITY_EVENT_COLUMNS
  ||c.table==='life_event_participations'&&c.selection===PARTICIPATION_FACT_COLUMNS).length;
globalThis.fetch=async()=>{throw Error('SNAP1_REMOTE_NETWORK_FORBIDDEN');};
process.env.COMPOSER_P14_P3_HISTORICAL_REUSE='0';
const out=path.resolve(process.env.P14_SNAP1_OUTPUT??'outputs/p14-snap1');fs.mkdirSync(out,{recursive:true});
const dbDirectory=path.join(out,'artifact-db'),metaPath=path.join(out,'synthetic-scope.json');
if(process.argv.includes('--independent-request')){
  const {context,range,cutoff,expected}=JSON.parse(fs.readFileSync(metaPath,'utf8'));
  const isolated=await isolatedStore(dbDirectory);try{
    process.env.COMPOSER_P14_SNAP1_ACTIVITY_HISTORY='1';const events=[];
    const facts=await readActivityHistory(new CanonicalRepository(isolated.client,context),range,cutoff,isolated.store,event=>events.push(event));
    assert.equal(plannerDigest(facts),expected);assert.equal(events[0].status,'HIT');assert.equal(isolated.metrics.sourceReads,0);
    const proof={pid:process.pid,status:'PASS_PERSISTENT_STORAGE_NEW_PROCESS',events,metrics:isolated.metrics,factsDigest:expected};
    fs.writeFileSync(path.join(out,'independent-process.json'),JSON.stringify(proof,null,2));
  }finally{await isolated.close();}process.exit(0);
}
// Re-running uses a new explicitly named directory; never recursively deletes a database.
const worldOnly=process.argv.includes('--world-only');
if(!worldOnly)assert.equal(fs.existsSync(dbDirectory),false,'Use P14_SNAP1_OUTPUT pointing to a NEW isolated output directory.');
const data=history({household:householdId,unknown:true});
Object.assign(data.context,{userId:uuid(900),contractVersion:'v2',dataRevision:1,analyticsRevision:1,asOf:'2026-10-05T10:00:00Z'});
const range={start:data.broad.start,endExclusive:'2026-10-06'},cutoff='2026-10-05';
const eventId=data.tables.life_events[0].life_event_id;
data.tables.life_event_financial_links=[null,'12.00'].map((economic_amount_linked,i)=>({financial_link_id:uuid(950+i),life_event_id:eventId,source_kind:'Operation',operation_id:uuid(960+i),
  allocation_id:null,item_id:null,cash_use_id:null,relation_type:'Preparation',economic_amount_linked,validation_status:'Confirmé'}));
let isolated=await isolatedStore(dbDirectory,{initialize:!worldOnly,data});
const checks=[],preparations=[],benchmarks=[],worldBenchmarks=[];
const repo=(context=data.context,client=isolated.client)=>new CanonicalRepository(client,context);
const traceRead=async({enabled=true,context=data.context,selectedRange=range,store=isolated.store}={})=>{
  process.env.COMPOSER_P14_SNAP1_ACTIVITY_HISTORY=enabled?'1':'0';isolated.reset();const events=[],at=performance.now();
  const facts=await readActivityHistory(repo(context),selectedRange,cutoff,store,event=>events.push(event));
  return {facts,events,ms:performance.now()-at,metrics:structuredClone(isolated.metrics),digest:plannerDigest(facts)};
};
const prepare=async(selectedRange=range,store=isolated.store)=>{
  isolated.reset();const events=[],at=performance.now();const ok=await prepareActivityHistory(repo(),selectedRange,cutoff,store,e=>events.push(e));
  preparations.push({ok,ms:performance.now()-at,events,metrics:structuredClone(isolated.metrics)});return ok;
};
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'});console.log(name+' PASS');};
const scope=()=>activityHistoryScope(repo(),range,cutoff);
const readStored=async()=>isolated.store.inspect(scope(),plannerDigest(scope()));
const patchEvent=async(id,patch)=>isolated.pg.query(`UPDATE snap1_isolated.life_events SET payload=payload || $2::jsonb WHERE payload->>'life_event_id'=$1`,[id,JSON.stringify(patch)]);
const resetSources=async()=>{for(const table of ['life_events','life_event_types','life_event_participations','life_event_financial_links'])
  await isolated.pg.query(`INSERT INTO snap1_isolated.${table}(row_key,payload)
    SELECT (ordinality-1)::text,payload FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY t(payload,ordinality)
    ON CONFLICT(row_key) DO UPDATE SET payload=excluded.payload`,[JSON.stringify(data.tables[table])]);};
try{
  if(worldOnly){await worldTests();console.log('WORLD-ONLY PASS');}else{
  await check('01-V0-EXACT-HIT-INDEPENDENT-REQUESTS',async()=>{
    const a=await traceRead({enabled:false});assert.equal(await prepare(),true);const b=await traceRead(),c=await traceRead();
    assert.deepEqual(b.facts,a.facts);assert.deepEqual(c.facts,a.facts);assert.equal(b.events[0].status,'HIT');assert.equal(c.metrics.sourceReads,0);
    assert.equal(b.facts.links[0].economicAmountLinked,null);assert.ok(b.facts.occurrences.some(f=>f.parentLifeEventId!==null));
    assert.ok(b.facts.occurrences.some(f=>f.validationStatus==='Déduit'));
    fs.writeFileSync(metaPath,JSON.stringify({context:data.context,range,cutoff,expected:b.digest}));
    await isolated.close();
    const result=spawnSync(process.execPath,[process.argv[1],'--independent-request'],{env:{...process.env,P14_SNAP1_OUTPUT:out},encoding:'utf8',timeout:60000});
    if(result.error)throw result.error;assert.equal(result.status,0,result.stderr);isolated=await isolatedStore(dbDirectory);
    const independent=JSON.parse(fs.readFileSync(path.join(out,'independent-process.json'),'utf8'));assert.notEqual(independent.pid,process.pid);
  });
  await check('02-UPDATED-FACT-INVALIDATES',async()=>{
    await patchEvent(eventId,{validation_status:'À valider'});const b=await traceRead();assert.equal(b.events[0].reason,'SOURCE_VERSION_CHANGED');
    assert.ok(!b.facts.occurrences.some(f=>f.lifeEventId===eventId));await resetSources();assert.equal(await prepare(),true);
  });
  await check('03-DELETE-INVALIDATES',async()=>{
    await isolated.pg.query(`DELETE FROM snap1_isolated.life_events WHERE payload->>'life_event_id'=$1`,[eventId]);
    const b=await traceRead();assert.equal(b.events[0].status,'MISS');assert.ok(!b.facts.occurrences.some(f=>f.lifeEventId===eventId));await resetSources();await prepare();
  });
  await check('04-RETROACTIVE-WRITE-AND-REPLICA-ADMIN-COVERAGE',async()=>{
    await isolated.pg.exec("SET session_replication_role=replica");await patchEvent(eventId,{start_date:'2024-06-01',end_date:'2024-06-01'});
    await isolated.pg.exec("SET session_replication_role=origin");const b=await traceRead();assert.equal(b.events[0].status,'MISS');
    assert.ok(!b.facts.occurrences.some(f=>f.lifeEventId===eventId));await resetSources();await prepare();
  });
  await check('05-MOVE-BETWEEN-PERIODS-INVALIDATES-BOTH',async()=>{
    const old={start:'2024-07-01',endExclusive:'2024-08-01'},next={start:'2024-08-01',endExclusive:'2024-09-01'};
    await prepare(old);await prepare(next);await patchEvent(eventId,{start_date:'2024-08-01',end_date:'2024-08-01'});
    const a=await traceRead({selectedRange:old}),b=await traceRead({selectedRange:next});assert.equal(a.events[0].status,'MISS');assert.equal(b.events[0].status,'MISS');
    assert.ok(!a.facts.occurrences.some(f=>f.lifeEventId===eventId));assert.ok(b.facts.occurrences.some(f=>f.lifeEventId===eventId));await resetSources();await prepare();
  });
  await check('06-CONTRACT-METHOD-CUTOFF-INCOMPATIBLE',async()=>{
    const b=await traceRead({context:{...data.context,contractVersion:'v3'}});assert.equal(b.events[0].status,'MISS');
    const saved=await readStored(),old=structuredClone(saved.artifact);old.scope.method='old-owner@v0';const{digest,...body}=old;old.digest=plannerDigest(body);
    await isolated.pg.query('UPDATE snap1_isolated.artifacts SET artifact=$2 WHERE scope_key=$1',[plannerDigest(scope()),JSON.stringify(old)]);
    await assert.rejects(()=>traceRead(),/CORRUPT_OR_INCOMPATIBLE/);await prepare();
    const events=[];await readActivityHistory(repo(),range,'2026-10-06',isolated.store,e=>events.push(e));assert.equal(events[0].status,'MISS');
  });
  await check('07-WRITE-DURING-PREPARATION-NO-STALE-PUBLICATION',async()=>{
    let once=false;isolated.options={beforeSource:async table=>{if(table==='life_events'&&!once){once=true;await patchEvent(eventId,{validation_status:'Déduit'});}}};
    const previous=(await readStored()).generation;assert.equal(await prepare(),false);assert.equal((await readStored()).generation,previous);
    isolated.options={beforeSource:undefined};await resetSources();await prepare();
  });
  await check('08-CONCURRENT-OLD-NEW-PUBLICATION-CAS',async()=>{
    const originalStore=isolated.store;let newGeneration;
    const racing={...originalStore,async publish(s,k,g,a){await patchEvent(eventId,{validation_status:'Déduit'});assert.equal(await prepare(range,originalStore),true);
      newGeneration=(await readStored()).generation;return originalStore.publish(s,k,g,a);}};
    assert.equal(await prepare(range,racing),false);assert.equal((await readStored()).generation,newGeneration);
    // Even unchanged source versions cannot overwrite a newer published generation.
    const current=await readStored();assert.equal(await originalStore.publish(scope(),plannerDigest(scope()),current.generation-1,current.artifact),false);
    await resetSources();await prepare();
  });
  await check('09-EXACT-1000-VS-TRUNCATED-1001',async()=>{
    const saved=data.tables.life_events;const large=Array.from({length:1001},(_,n)=>({...saved[0],life_event_id:uuid(100000+n),parent_life_event_id:null}));
    await isolated.pg.exec('TRUNCATE snap1_isolated.life_events');
    await isolated.pg.query('INSERT INTO snap1_isolated.life_events SELECT ordinality::text,payload FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY t(payload,ordinality)',[JSON.stringify(large.slice(0,1000))]);
    assert.equal(await prepare(),true);const exact=await traceRead();assert.equal(exact.facts.occurrences.length,1000);assert.equal(exact.events[0].status,'HIT');
    await isolated.pg.query('INSERT INTO snap1_isolated.life_events VALUES($1,$2)',['1001',JSON.stringify(large[1000])]);
    const generation=(await readStored()).generation;await assert.rejects(()=>prepare(),/INCOMPLETE_SOURCE/);assert.equal((await readStored()).generation,generation);
    await isolated.pg.exec('TRUNCATE snap1_isolated.life_events');await resetSources();await prepare();
    isolated.options={cap:100};await assert.rejects(()=>prepare(),/INCOMPLETE_SOURCE/);isolated.options={cap:1000};
  });
  await check('10-FRESH-PERMISSIONS-HOUSEHOLD-PERSON-ISOLATION',async()=>{
    for(const context of [{...data.context,userId:uuid(999)},{...data.context,householdId:uuid(998)},{...data.context,personIds:[uuid(997)]}])
      await assert.rejects(()=>traceRead({context}),/PERMISSION_DENIED/);
    await isolated.pg.query('UPDATE snap1_isolated.memberships SET active=false WHERE user_id=$1',[data.context.userId]);
    await assert.rejects(()=>traceRead(),/PERMISSION_DENIED/);
    await isolated.pg.query('UPDATE snap1_isolated.memberships SET active=true WHERE user_id=$1',[data.context.userId]);await prepare();
  });
  await check('11-MISSING-DEPENDENCY-NETWORK-CORRUPTION-NO-FALSE-HIT',async()=>{
    isolated.options={noCoverage:true};assert.equal((await traceRead()).events[0].status,'MISS');await assert.rejects(()=>prepare(),/WRITERS_NOT_COVERED/);isolated.options={noCoverage:false};
    await isolated.pg.query("DELETE FROM snap1_isolated.versions WHERE dependency='life_event_types'");assert.equal((await traceRead()).events[0].status,'MISS');
    await isolated.pg.query("INSERT INTO snap1_isolated.versions VALUES('life_event_types',9999)");await prepare();
    isolated.options={networkFailure:true};await assert.rejects(()=>traceRead(),/NETWORK_UNAVAILABLE/);isolated.options={networkFailure:false};
    const saved=await readStored();await isolated.pg.query(`UPDATE snap1_isolated.artifacts SET artifact=jsonb_set(artifact,'{payload,occurrences}', '[]') WHERE scope_key=$1`,[plannerDigest(scope())]);
    await assert.rejects(()=>traceRead(),/CORRUPT_OR_INCOMPATIBLE/);await prepare();
    assert.equal(saved.artifact.payload.links[0].economicAmountLinked,null);
  });
  await check('12-UNRELATED-LIVE-DATA-WORLD-COMPILER-FINANCE-PARITY',async()=>{
    await worldTests();
  });
  await check('13-TYPE-PARTICIPATION-LINK-AND-TRUNCATE-WRITERS-COVERED',async()=>{
    for(const table of ['life_event_types','life_event_participations','life_event_financial_links']){
      await isolated.pg.query(`UPDATE snap1_isolated.${table} SET payload=payload || '{"synthetic_unselected":true}'::jsonb WHERE row_key='0'`);
      assert.equal((await traceRead()).events[0].status,'MISS');await prepare();
    }
    await isolated.pg.exec('TRUNCATE snap1_isolated.life_event_financial_links');assert.equal((await traceRead()).events[0].status,'MISS');
    await resetSources();await prepare();
  });
  await check('14-OFF-NO-STORAGE-DEPENDENCY',async()=>{
    isolated.options={networkFailure:true};const a=await traceRead({enabled:false});assert.equal(a.events[0].status,'OFF');assert.equal(a.metrics.inspectReads,0);isolated.options={networkFailure:false};
  });
  await check('15-DDL-DISABLED-TRIGGER-NOT-ADMISSIBLE-REENABLE-INVALIDATES',async()=>{
    await isolated.pg.exec('ALTER TABLE snap1_isolated.life_events DISABLE TRIGGER snap1_version');
    await patchEvent(eventId,{validation_status:'À valider'});const a=await traceRead();assert.equal(a.events[0].status,'MISS');
    assert.equal(a.events[0].reason,'DEPENDENCY_COVERAGE_UNAVAILABLE');await assert.rejects(()=>prepare(),/WRITERS_NOT_COVERED/);
    await isolated.pg.exec('ALTER TABLE snap1_isolated.life_events ENABLE ALWAYS TRIGGER snap1_version');
    assert.equal((await traceRead()).events[0].status,'MISS');await resetSources();await prepare();
  });
  await check('16-EMPTY-HISTORY-AND-TIMEZONE',async()=>{
    await isolated.pg.exec('TRUNCATE snap1_isolated.life_events');await prepare();const empty=await traceRead();
    assert.equal(empty.events[0].status,'HIT');assert.deepEqual(empty.facts,{occurrences:[],links:[]});
    assert.deepEqual(empty.facts,(await traceRead({enabled:false})).facts);await resetSources();await prepare();
    await isolated.pg.query('UPDATE snap1_isolated.households SET timezone=$2 WHERE id=$1',[householdId,'America/New_York']);
    await assert.rejects(()=>traceRead(),/PERMISSION_DENIED/);
    const changed=await traceRead({context:{...data.context,timezone:'America/New_York'}});assert.equal(changed.events[0].status,'MISS');
    assert.equal(changed.facts.occurrences[0].householdTimeZone,'America/New_York');
    await isolated.pg.query('UPDATE snap1_isolated.households SET timezone=$2 WHERE id=$1',[householdId,data.context.timezone]);await prepare();
  });
  process.env.COMPOSER_P14_SNAP1_ACTIVITY_HISTORY='1';await prepare();
  for(let i=0;i<40;i++){
    const pair={};for(const side of i%2?['snapshot','direct']:['direct','snapshot'])pair[side]=await traceRead({enabled:side==='snapshot'});
    assert.deepEqual(pair.snapshot.facts,pair.direct.facts);delete pair.direct.facts;delete pair.snapshot.facts;benchmarks.push(pair);
  }
  const percentile=(items,p)=>items.toSorted((a,b)=>a-b)[Math.ceil(items.length*p)-1];
  const summarize=side=>({n:benchmarks.length,p50:percentile(benchmarks.map(p=>p[side].ms),.5),p95:percentile(benchmarks.map(p=>p[side].ms),.95),
    min:Math.min(...benchmarks.map(p=>p[side].ms)),max:Math.max(...benchmarks.map(p=>p[side].ms)),metrics:benchmarks[0][side].metrics});
  const report={status:'EXECUTED_PASS_ISOLATED_PERSISTENT_PROTOTYPE',base:'6ae0b54633403481be872f40b0c5b25d070c7d7c',checks,preparations,benchmarks,
    segment:{direct:summarize('direct'),snapshot:summarize('snapshot')},worldBenchmarks,independentProcess:JSON.parse(fs.readFileSync(path.join(out,'independent-process.json'),'utf8')),
    P3:'0',snap1Default:'OFF',productionAdapter:'NONE',coverage:ACTIVITY_HISTORY_COVERAGE,authenticated:'NOT_RUN',browserFresh:'NOT_RUN',remoteWrites:0};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:checks.length,segment:{direct:report.segment.direct.p50,snapshot:report.segment.snapshot.p50}}));
  }
}catch(error){
  const failure={name:error.name,message:error.message,issues:error.issues,stack:error.stack,checks};
  fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify(failure,null,2));console.error(JSON.stringify({name:failure.name,message:failure.message}));process.exitCode=1;
}finally{await isolated.close();}

async function worldTests(){
  // Keep real World -> baseline adapters -> Canonical projection -> Baseline -> Compiler -> Finance.
  // Only unrelated owners return their existing synthetic fixtures; each READ fetches live inputs.
  const world=fixture(),sources=world.sources;let live=structuredClone(world.monthInputs),livePlanned=[];
  // The legacy Baseline fixture supplied only bank identities. World/Finance also
  // requires the original bank date, amount and direction (not snapshot data).
  sources.evidence.bankObservations=sources.evidence.bankObservations.map(o=>{
    const entry=sources.evidence.history.economicEntries.find(e=>e.operationId===o.id);
    return {...o,date:entry.date,amount:entry.amount,direction:'OUT',merchant:entry.merchant};
  });
  require('@/server/phase2/live-month-forecast').loadMonthForecastAuthorities=async()=>({publication:{publication_id:world.forecast.meta.sourcePublicationId,
    source_revision:world.forecast.meta.sourceRevision,published_analytics_revision:world.forecast.meta.analyticsRevision},background:{food:sources.food}});
  require('@/server/phase2/month-planning-read').readPlanningMonthForecast=async()=>structuredClone(world.forecast);
  require('@/server/phase2/month-prediction-evidence').readMonthPredictionEvidence=async()=>sources.evidence;
  require('@/server/phase2/month-inputs').readMonthInputs=async()=>({inputs:structuredClone(live)});
  require('@/server/phase2/planned-expenses').readPlannedExpenses=async()=>structuredClone(livePlanned);
  require('@/server/phase2/planned-context').readPlannedContextOptions=async()=>({places:world.mobilityFacts.places,vehicle:world.mobilityFacts.vehicle});
  require('@/server/analytics/global-v2-persona-signals').resolveGlobalPersonaProductObservations=async()=>[];
  const {createPlannerDependencies}=require('@/server/phase2/planner/world-reader');
  const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
  const {readComposerOpening}=require('@/server/phase2/planner/composer-opening');
  const fakeEmpty=()=>{const q={select:()=>q,eq:()=>q,lte:()=>q,order:()=>q,range:()=>q,in:()=>q,then:(yes,no)=>Promise.resolve({data:[],error:null}).then(yes,no)};return q;};
  const deps=()=>{
    const client={from:table=>['needs','person_habit_assertions'].includes(table)?fakeEmpty():isolated.client.from(table)};
    const repository=repo(data.context,client);repository.loadMobilityLegFacts=async()=>[];repository.loadPurchaseAwareCanonical=async()=>({status:'PASS',facts:[]});
    // M7's real projection and detailed event/participation reads stay active.
    // Only out-of-segment physical leg / place / localization / presence owners are empty fixtures.
    repository.loadPlaceVisits=async()=>[];repository.loadPersonDays=async()=>[];repository.loadLifeEventLocalizationRows=async()=>[];
    const value=createPlannerDependencies(repository,client,()=>data.context.asOf,isolated.store);
    value.repository={readActivePlan:async()=>null,readAppliedRequest:async()=>null,applyRevision:async()=>{throw Error('SNAP1_UNEXPECTED_APPLY_WRITER');}};
    return value;
  };
  const request=async(enabled,draft=state(),kind='READ')=>{
    process.env.COMPOSER_P14_SNAP1_ACTIVITY_HISTORY=enabled?'1':'0';isolated.reset();const at=performance.now();
    const result=await handleComposerRequest(deps(),householdId,{kind,targetMonth:'2026-11',draft,sequence:0});
    if(!result.ok)await require('@/server/phase2/planner/read-model').readMonthComposer(deps(),householdId,'2026-11',draft);
    assert.equal(result.ok,true,result.code);return {result,ms:performance.now()-at,replacedSourceReads:replacedReads(isolated.metrics),metrics:structuredClone(isolated.metrics),digest:plannerDigest(JSON.parse(JSON.stringify(result)))};
  };
  process.env.COMPOSER_P14_SNAP1_ACTIVITY_HISTORY='1';
  assert.deepEqual(await deps().readComposerWorld(householdId,'2026-11'),await deps().readWorld(householdId,'2026-11'));
  const {readMonthComposer}=require('@/server/phase2/planner/read-model');
  const {composerUiModel}=require('@/server/phase2/planner/composer-service');
  await composerUiModel(deps(),householdId,await readMonthComposer(deps(),householdId,'2026-11',state()));
  for(const draft of [state(),nightMonth().semantic,weekendMonth(false).semantic,weekendMonth(true).semantic]){
    const a=await request(false,draft),b=await request(true,draft);assert.deepEqual(b.result,a.result);assert.equal(b.replacedSourceReads,0);assert.ok(a.replacedSourceReads>0);assert.equal(b.metrics.inspectReads,1);
  }
  const a=await request(true);const generation=(await readStored()).generation;live.safetyReserve='71.00';const b=await request(true),direct=await request(false);
  assert.notEqual(a.digest,b.digest);assert.deepEqual(b.result,direct.result);assert.equal((await readStored()).generation,generation);assert.equal(b.replacedSourceReads,0);
  // Saving a new Forecast generation / mutable Wallet input remains visible outside artifact.
  live.declaredResources['benefit:swile']='17.00';world.forecast.meta.analyticsRevision+=1;
  const changed=await request(true),changedDirect=await request(false);assert.deepEqual(changed.result,changedDirect.result);assert.notEqual(b.digest,changed.digest);
  const snapshots=await deps().readComposerWorld(householdId,'2026-11'),slot=snapshots.baseline.slots.find(s=>s.simpleAuthority?.domain==='groceries');assert.ok(slot);
  const edited=state([{decisionId:uuid(9800),decisionSlotKey:slot.slotIdentityKey,kind:'SET_STATE',value:{amount:'350.00'},provenance:'EXPLICIT_USER_DECISION'}]);
  const editedA=await request(false,edited),editedB=await request(true,edited);assert.deepEqual(editedB.result,editedA.result);
  assert.notEqual(editedB.digest,changed.digest);assert.equal(editedB.replacedSourceReads,0);
  assert.deepEqual((await request(true,edited,'SUGGESTIONS')).result,(await request(false,edited,'SUGGESTIONS')).result);
  livePlanned=externalMonth().world.externalIntents;
  const externalA=await request(false),externalB=await request(true);assert.deepEqual(externalB.result,externalA.result);
  assert.notEqual(externalB.digest,changed.digest);assert.equal(externalB.replacedSourceReads,0);livePlanned=[];
  isolated.options={networkFailure:true};
  const unavailable=await handleComposerRequest(deps(),householdId,{kind:'READ',targetMonth:'2026-11',draft:state(),sequence:0});
  assert.equal(unavailable.ok,false);assert.equal(unavailable.model,undefined);isolated.options={networkFailure:false};
  process.env.COMPOSER_P14_SNAP1_ACTIVITY_HISTORY='1';isolated.reset();
  const opening=await readComposerOpening(deps(),householdId,'2026-11',async()=>null);assert.deepEqual(opening.model,changed.result.model);assert.equal(replacedReads(isolated.metrics),0);
  const proof={...changed.result.model.proof,expectedBaselineDigest:'0'.repeat(64),applyRequestId:uuid(9900)};isolated.reset();
  const apply=await handleComposerRequest(deps(),householdId,{kind:'APPLY',targetMonth:'2026-11',draft:state(),command:proof,sequence:0});
  assert.equal(apply.ok,false);assert.equal(apply.code,'PLANNER_PREVIEW_STALE');assert.ok(isolated.metrics.sourceReads>0);assert.equal(isolated.metrics.inspectReads,0);
  isolated.reset();const recovery=await handleComposerRequest(deps(),householdId,{kind:'CHECK_APPLY',targetMonth:'2026-11',draft:state(),command:proof,sequence:0});
  assert.equal(recovery.ok,false);assert.equal(recovery.code,'COMPOSER_APPLY_UNCONFIRMED');assert.equal(isolated.metrics.inspectReads,0);
  for(let i=0;i<12;i++){
    const pair={};for(const side of i%2?['snapshot','direct']:['direct','snapshot'])pair[side]=await request(side==='snapshot');
    assert.equal(pair.snapshot.digest,pair.direct.digest);delete pair.snapshot.result;delete pair.direct.result;worldBenchmarks.push(pair);
  }
}
