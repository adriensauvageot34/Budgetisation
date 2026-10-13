import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {fixture,state,control,findSlot,nightMonth,component,selections,uuid} from './fixtures/planner-headless.mjs';
import {fixture as mobilityFixture,visit,providers} from './fixtures/planner-mobility.mjs';
process.env.PLANNER_P14_P4D_MEASURE='1';process.env.COMPOSER_P14_P3_HISTORICAL_REUSE='0';
const {p4dInteraction}=await import('./lib/planner-p14-p4d-fixture-tools.mjs');
const prepare=require('@/server/phase2/planner/prospective-mobility-pricing').preparePlanningMobility;
const pg=await createKernelPostgres(),repository=require('@/server/phase2/planner/repository').createPlanApplyRepository(pg.client);
globalThis.fetch=async()=>{throw Error('P4D_SYNTHETIC_NETWORK_FORBIDDEN');};
const base=fixture(),slot=findSlot(base,'groceries').slotIdentityKey,night=nightMonth();
const richer=structuredClone(night.semantic);richer.contexts[0].slotSelections.extras=selections(component('extra','5','extra'));
const cases=[['simple',base,state([control(slot,{amount:'350'})])],['night-configured',night.world,night.semantic],
  ['asset-configured',night.world,richer],['undo',base,state()],['car-return',mobilityFixture(),state([], [visit(100)])],
  ['car-provider-failure',mobilityFixture(),state([], [visit(100)])]];
const records=[];
try{
  for(const[name,world,draft]of cases){const pairs=[];
    for(let i=0;i<4;i++){const pair={};for(const side of i%2?['P4D','P4B']:['P4B','P4D']){
      const owner=providers();if(name==='car-provider-failure')owner.settings.routeUnavailable=true;
      const deps={repository,readWorld:async()=>world,householdPersons:[{personId:uuid(1),displayName:'Synthetic person'}],
        prepareWorld:(w,s)=>prepare(w,s,owner.value),readMobilityOptions:async()=>({places:world.mobilityFacts?.places??[],vehicle:world.mobilityFacts?.vehicle??null})};
      const response=await p4dInteraction({kind:'READ',sequence:4,targetMonth:draft.targetMonth,draft},side,deps,world.baseline.householdId);
      const {p4dPerformance:metrics,...value}=response;assert.equal(value.ok,true,value.code);
      pair[side]={...metrics,fingerprint:crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'),
        providerCalls:{routes:owner.calls.routes.length,fuel:owner.calls.fuel,toll:owner.calls.toll}};
    }assert.equal(pair.P4B.fingerprint,pair.P4D.fingerprint);pairs.push(pair);}
    records.push({case:name,n:4,pairs,status:'PARITY_PASS_SYNTHETIC_LATENCY_NOT_CERTIFIED'});console.log(name+' PASS');
  }
  for(const kind of ['APPLY','CHECK_APPLY'])await assert.rejects(()=>p4dInteraction({kind},'P4D',{},'',()=>{}),/APPLY_FORBIDDEN/);
  await pg.verifyCanaries();assert.deepEqual(await pg.counts(),{plans:0,revisions:0});
  fs.writeFileSync('outputs/p14-p4d/scenarios.json',JSON.stringify({records,remoteWrites:0,applyRpcCalls:pg.rpcCalls,
    realSupabase:'NOT_RUN',realMobilityProviders:'NOT_RUN',P3:'0'},null,2));
}finally{await pg.close();}
