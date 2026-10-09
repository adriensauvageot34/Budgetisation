import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { fixture, state, uuid, householdId } from './fixtures/planner-headless.mjs';
import { providers } from './fixtures/planner-mobility.mjs';
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { preparePlanningMobility } = require('@/server/phase2/planner/prospective-mobility-pricing');
const { stageLocalDecision, visualDraftModel } = require('@/app/mois-a-venir/composer/local-draft');
const pg=await createKernelPostgres(),world=fixture(),owner=providers();let readWorldCalls=0,sequence=0;
const deps={repository:createPlanApplyRepository(pg.client),readWorld:async()=>{readWorldCalls++;return world;},
  prepareWorld:(value,semantic)=>preparePlanningMobility(value,semantic,owner.value)};
const read=async draft=>{const result=await handleComposerRequest(deps,householdId,{kind:'READ',sequence:++sequence,targetMonth:'2026-11',draft});
  assert.equal(result.ok,true,result.code);return result.model;};
const median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
const round=values=>Number(median(values).toFixed(2));
try{
  const model=await read(state());
  const gift=model.library.searchableAssets.find(a=>a.kind==='CONTEXT_ASSET'&&a.templateKey==='gift');assert.ok(gift);
  const groceries=model.board.baselineControls.concat(model.board.discretionaryControls).find(c=>/Courses/u.test(c.label));assert.ok(groceries);
  const addLocal=[],addPreview=[],amountLocal=[],amountPreview=[];let addReads=0,amountReads=0;
  for(let i=0;i<12;i++){
    const operation={kind:'DROP',assetKey:gift.assetKey,target:{kind:'BOARD_ZONE'},values:{},identity:uuid(2000+i),selectionId:uuid(2100+i)};
    let start=performance.now();const draft=stageLocalDecision(model,model.semanticState,operation);assert.ok(draft);
    const shown=visualDraftModel(model,draft);assert.ok(shown.board.contexts.some(c=>c.contextOccurrenceId===operation.identity));addLocal.push(performance.now()-start);
    const before=readWorldCalls;start=performance.now();await read(draft);addPreview.push(performance.now()-start);addReads+=readWorldCalls-before;
  }
  for(let i=0;i<12;i++){
    const operation={kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:groceries.targetRef,value:{amount:String(300+i)}}};
    let start=performance.now();const draft=stageLocalDecision(model,model.semanticState,operation);assert.ok(draft);
    const shown=visualDraftModel(model,draft);assert.equal(shown.board.cockpit,model.board.cockpit);amountLocal.push(performance.now()-start);
    const before=readWorldCalls;start=performance.now();await read(draft);amountPreview.push(performance.now()-start);amountReads+=readWorldCalls-before;
  }
  await pg.verifyCanaries();assert.deepEqual(await pg.counts(),{plans:0,revisions:0});
  console.log(JSON.stringify({kind:'P03_SYNTHETIC_NODE_FIXTURE_ONLY',samples:12,
    add:{localStageAndViewMedianMs:round(addLocal),previewReadMedianMs:round(addPreview),readWorldCalls:addReads},
    amount:{localStageAndViewMedianMs:round(amountLocal),previewReadMedianMs:round(amountPreview),readWorldCalls:amountReads},
    caveat:'Local JS work is not DOM paint or panel interactivity. Preview uses in-memory PGlite/World, no browser, auth, network or real data.',remoteWrites:0,dbWrites:0}));
}finally{await pg.close();}
