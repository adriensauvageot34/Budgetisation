// Certify Apply/reload evidence against pre-P2-A synthetic goldens. PGlite only.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { require } from './lib/phase2-ts-loader.mjs';
import { householdId,uuid,simpleMonth,nightMonth,weekendMonth,renewalMonth,externalMonth } from './fixtures/planner-headless.mjs';
import { providers } from './fixtures/planner-mobility.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
const { previewPlanScenario,applyPlanScenario }=require('@/server/phase2/planner/apply');
const { resolveEffectiveMonthScenario }=require('@/server/phase2/planner/effective-month-scenario');
const { createPlanApplyRepository }=require('@/server/phase2/planner/repository');
const { preparePlanningMobility }=require('@/server/phase2/planner/prospective-mobility-pricing');
const golden=JSON.parse(fs.readFileSync(new URL('./fixtures/planner-performance-parity.json',import.meta.url),'utf8')).results;
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const evidence=(semantic,manifest,projection)=>({semantic,manifest,projection});
const cases=[['simple-month',simpleMonth],['night-out-uber',()=>nightMonth()],['night-out-tram',()=>nightMonth('train')],
 ['short-stay-unresolved',()=>weekendMonth()],['short-stay-confirmed-consumption',()=>weekendMonth(true)],['needs-two-in-one-purchase',renewalMonth],['external-intent',externalMonth]];
const rows=[],NativeDate=Date;globalThis.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:['2026-10-06T21:00:00Z']))}static now(){return NativeDate.parse('2026-10-06T21:00:00Z')}};
globalThis.fetch=async()=>{throw new Error('ROUNDTRIP_NETWORK_FORBIDDEN')};
try{for(const[name,build]of cases){const f=build(),pg=await createKernelPostgres(),owner=providers();try{
 const deps={repository:createPlanApplyRepository(pg.client),readWorld:async()=>structuredClone(f.world),
  prepareWorld:(w,s)=>preparePlanningMobility(w,s,owner.value),readDirectWorld:async()=>{throw new Error('UNEXPECTED_DIRECT_V2')}};
 const preview=await previewPlanScenario(deps,householdId,f.semantic),old=golden[name];
 assert.equal(preview.previewDigest,old.preview);assert.equal(preview.compiledManifestDigest,old.manifest);assert.equal(preview.projectionDigest,old.projection);
 const applied=await applyPlanScenario(deps,householdId,f.semantic,{expectedActiveRevisionId:preview.baseActiveRevisionId,expectedActiveRevisionNumber:preview.baseRevisionNumber,
  expectedBaselineDigest:preview.baselineDigest,expectedPreviewDigest:preview.previewDigest,applyRequestId:uuid(9901)});
 const reload=await resolveEffectiveMonthScenario(deps,householdId,'2026-11');
 assert.deepEqual(reload.scenario,preview.scenario);assert.deepEqual(reload.projection,preview.projection);assert.deepEqual(reload.semanticState,applied.revision.semanticState);
 assert.equal(reload.evidenceStatus,'EXACT');await pg.verifyCanaries();
 const beforeHash=hash(evidence(old.semantic,old.manifest,old.projection));
 const applyHash=hash(evidence(applied.revision.semanticStateDigest,applied.revision.compiledManifestDigest,applied.projectionEvidence.projectionDigest));
 const reloadHash=hash(evidence(reload.preview.semanticStateDigest,reload.preview.compiledManifestDigest,reload.preview.projectionDigest));
 assert.equal(applyHash,beforeHash);assert.equal(reloadHash,beforeHash);
 rows.push({name,beforeHash,applyHash,reloadHash,previewBefore:old.preview,previewAfter:preview.previewDigest,virtualRpcCalls:pg.rpcCalls});
 console.log(JSON.stringify({name,parity:'PASS'}));
 }finally{await pg.close()}}}finally{globalThis.Date=NativeDate}
const result={rows,remoteWrites:0,historicalCanaryWrites:0,environment:'PGLITE_SYNTHETIC_ONLY',
 evidenceHashContract:'SHA256({semantic,manifest,projection}) using immutable pre-P2-A goldens vs real Apply evidence/reload, plus full scenario/projection/semantic deep equality.'};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({roundTrips:rows.length,remoteWrites:0,parity:'PASS'}));
