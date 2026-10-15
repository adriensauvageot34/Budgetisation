// Synthetic C0 persistence + actual Apply/Compiler/V2/read. No live client or credentials.
import assert from 'node:assert/strict';
import { require } from '../lib/phase2-ts-loader.mjs';
import { fixture as kernel, control, seal } from './planner-kernel.mjs';
import { state, uuid, householdId, night, selections, component, weekendMonth } from './planner-headless.mjs';
import { visit, providers } from './planner-mobility.mjs';
import { createKernelPostgres } from '../lib/planner-kernel-postgres.mjs';
const { previewPlanScenario, applyPlanScenario } = require('@/server/phase2/planner/apply');
const { resolveEffectiveMonthScenario } = require('@/server/phase2/planner/effective-month-scenario');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { preparePlanningMobility } = require('@/server/phase2/planner/prospective-mobility-pricing');
const { appliedPlanRevisionControls } = require('@/server/phase2/planner/applied-plan-read');
const { mobilitySummaries } = require('@/server/phase2/planner/mobility-presentation');
const { plannerDigest } = require('@/domain/phase2/planner/json');

export const cases = ['A','B','C','D','E','F','G','CHANGED','UNAVAILABLE','INTERACTIONS','GIFT','LONG'];
export async function persistedCase(key) {
  const pg = await createKernelPostgres(), repository = createPlanApplyRepository(pg.client);
  let world = kernel(), semantic = state(), reads = 0, request = 94000;
  world.monthInputs.declaredOutflows[0].label = 'Projet voyage';
  world.baseline.structuralFacts.savingsReservations[0].label = 'Projet voyage';
  if (key === 'A' || key === 'G' || key === 'CHANGED' || key === 'UNAVAILABLE' || key === 'LONG') {
    world.baseline.slots.find(slot => slot.slotIdentityKey === 'groceries').baselineValue.amount = '350.00';
    const ref = world.forecast.referencePlan.necessary[0]; ref.low = ref.central = ref.high = '350.00';
    world.forecast.referencePlan.necessaryTotal = {low:'350.00',central:'350.00',high:'350.00'};
    world.forecast.income = {low:'1710.00',central:'1710.00',high:'1710.00',components:[
      {key:'income:Digital Learning Contest',label:'Revenu synthétique A',central:'1000.00'},
      {key:'income:Promotrans',label:'Revenu synthétique B',central:'710.00'}]};
    world.forecast.economicCost = {low:'960.00',central:'960.00',high:'960.00'};
    world.forecast.freeToSpend = {low:'750.00',central:'750.00',high:'750.00'};
    semantic = state([control('groceries',{amount:'320.00'})],[night(400,'100.00')]);
    if (key === 'LONG') {
      world.forecast.income.low=world.forecast.income.central=world.forecast.income.high='123457499.00';
      world.forecast.income.components[0].central='123456789.00';
    }
  } else if (key === 'B' || key === 'INTERACTIONS') {
    world.baseline.slots.find(slot => slot.slotIdentityKey === 'restaurants').baselineValue.unitAmount = '40.00';
    const ref = world.forecast.referencePlan.flexible[0]; ref.low = ref.central = ref.high = '120.00';
    const { restaurant } = await import('./planner-contexts.mjs');
    semantic = state([], [restaurant(100,'40.00'), ...(key === 'INTERACTIONS' ? [restaurant(101,'40.00'),restaurant(102,'40.00'),restaurant(103,'40.00')] : [])]);
  } else if (key === 'C' || key === 'E') {
    const f = weekendMonth(true); world = f.world;
    semantic = key === 'C' ? f.semantic : state([], [visit(500,{}, { fieldSchemaVersion:'context-fields@v4', label:'Visite familiale à Fontès', plannedDate:null, personVisitedRef:{kind:'TEXT',label:'Famille'}, participantRefs:[] })]);
  } else if (key === 'D') {
    world.monthInputs.declaredOutflows[0].adjustability = 'PROTECTED';
    world.monthInputs.declaredOutflows[0].label = 'Voyage — réservation protégée';
    world.baseline.structuralFacts.savingsReservations[0].adjustability = 'PROTECTED';
    world.baseline.structuralFacts.savingsReservations[0].label = 'Voyage — réservation protégée';
  } else if (key === 'F') {
    semantic = state([], [night(400,'100.00',{extras:selections(component('extra',null))})]);
    semantic.contexts[0].fields.plannedDate = null;
  } else if (key === 'GIFT') {
    const { context } = await import('./planner-contexts.mjs');
    semantic = state([], [context(600,'gift',{item:selections(component('gift','35.00'))}, {
      fieldSchemaVersion:'context-fields@v3',label:'Cadeau de Léa',recipientRef:{kind:'TEXT',label:'Léa'},occasion:'Anniversaire',objectLabel:'Un roman choisi',
      objectAssetRef:{catalogVersion:'planned-assets@v1',assetKey:'gift:book',labelAtSelection:'Livre',provenance:'EXPLICIT_USER_DECISION'},plannedDate:null })]);
  }
  for (const c of semantic.contexts) if (c.fields.label?.startsWith('Synthetic ')) delete c.fields.label;
  for (const slot of world.baseline.slots) if (['groceries','restaurants','clothing'].includes(slot.semanticKey) && !slot.simpleAuthority)
    slot.simpleAuthority = {domain:slot.semanticKey,optionalBudget:false,gate:'AVAILABLE',reason:null,hardFloor:null};
  seal(world);
  const deps = {repository,readWorld:async()=>{reads++; return world;},
    validateContextReferences: async (_h,refs)=>{ assert.ok(refs.placeIds.every(id=>world.mobilityFacts?.places.some(p=>p.placeId===id))); assert.equal(refs.personIds.length,0); },
    prepareWorld:(w,s)=>preparePlanningMobility(w,s,providers().value)};
  async function apply(s) {
    const p = await previewPlanScenario(deps,householdId,s);
    assert.notEqual(p.projection.applyReadiness,'BLOCKED',`${key}: blocked`);
    return applyPlanScenario(deps,householdId,s,{expectedActiveRevisionId:p.baseActiveRevisionId,expectedActiveRevisionNumber:p.baseRevisionNumber,
      expectedBaselineDigest:p.baselineDigest,expectedPreviewDigest:p.previewDigest,applyRequestId:uuid(request++)});
  }
  try {
    const applied = await apply(semantic), immutable = plannerDigest(applied.revision);
    if (key === 'CHANGED') {
      world.forecast.publicationMeta.revision++; world.forecast.meta.sourceRevision++; world.forecast.resourceMeta.resourceInputHash='synthetic-new-generation';
      world.forecast.income.components[0].central='1010.00';
      world.forecast.income.low=world.forecast.income.central=world.forecast.income.high='1720.00';
    }
    let result;
    if (key === 'G') {
      let once = false;
      result = await resolveEffectiveMonthScenario({...deps,readWorld:async()=>{
        if (!once) {once=true; await apply(state([control('groceries',{amount:'310.00'})]));} return world;
      }},householdId,'2026-11');
    } else result = await resolveEffectiveMonthScenario(key === 'UNAVAILABLE' ? {...deps,repository:{...repository,readActivePointer:async()=>{throw Error('Synthetic pointer unavailable');}}} : deps,householdId,'2026-11');
    assert.equal(plannerDigest(applied.revision),immutable);
    assert.strictEqual(result.comparison.projection,result.projection);
    const counts = await pg.counts(); await pg.verifyCanaries();
    return {key, props:{projection:result.projection,semanticState:result.semanticState,controls:appliedPlanRevisionControls(result.revision),
      plan:result.scenario.economicPlan,revision:result.revision.revisionNumber,comparison:result.comparison,evidenceStatus:result.evidenceStatus,
      historicalRemainder:applied.revision.projectionEvidence.projection?.plan?.economicMonthEndRemainder ?? null,today:world.asOfDate,
      composerHref:'/mois-a-venir/composer?month=2026-11', persons:[],places:world.mobilityFacts?.places ?? [],
      mobility:mobilitySummaries(result.preview.compiled.journeys,result.preview.compiled.journeyPrices)},
      proof:{counts,reads,revision:result.revision.planRevisionId,projectionDigest:result.preview.projectionDigest,semanticDigest:result.revision.semanticStateDigest,
        baseline:result.projection.baseline.economicMonthEndRemainder,remainder:result.projection.plan.economicMonthEndRemainder,
        impact:result.projection.plan.impactOnMonthEnd,freshness:result.comparison.freshness,financialCanaries:'PASS'}};
  } finally {await pg.close();}
}
