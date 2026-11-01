import assert from 'node:assert/strict';
import { require } from './lib/phase2-ts-loader.mjs';
import { readMonthFixture, monthFixture } from './fixtures/composer-v22-b1.mjs';
import { householdId, uuid, selections, component, context } from './fixtures/planner-headless.mjs';
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { ComposerMonthRead, monthReadTargets } = require('@/app/mois-a-venir/composer/month-read');
const { ComposerFinancialInspector } = require('@/app/mois-a-venir/composer/composer-financial-inspector');
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { editRestaurant } = require('@/domain/phase2/planner/restaurant-edit');
const { evaluatePlanScenario } = require('@/server/phase2/planner/preview');
globalThis.fetch = async () => { throw Error('B1_REMOTE_NETWORK_FORBIDDEN'); };
let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log(`${name} PASS`); };
const html = (model, stale = false) => renderToStaticMarkup(React.createElement(ComposerMonthRead, { model, stale, focused: null, focus() { throw Error('SSR_MUST_NOT_NAVIGATE'); } }));
const november = await readMonthFixture(), october = await readMonthFixture('2026-10');

await check('B1-01-MONTH-EXCEPTION-DOES-NOT-LEAK', () => {
  const rent = model => model.board.structuralObligations.find(fact => fact.factKey === 'obligation:rent');
  assert.equal(rent(october.model).value.central, '450.00'); assert.equal(rent(october.model).dueDate, '2026-10-12');
  assert.equal(rent(november.model).value.central, '500.00'); assert.equal(rent(november.model).dueDate, null);
  assert.match(html(october.model), /octobre 2026/); assert.match(html(november.model), /novembre 2026/);
  assert.doesNotMatch(html(november.model), /12 oct/);
});
await check('B1-02-FIVE-GROUPS-AND-PUBLISHED-RESOURCES', () => {
  const view = html(november.model);
  for (const group of ['charges','resources','groceries','tobacco','savings']) assert.match(view, new RegExp(`data-month-group="${group}"`));
  assert.match(view, /Ressource de démonstration 1/); assert.match(view, /encaissement non attesté/); assert.match(view, /paiement non attesté/);
  assert.match(view, /Informations saisies pour ce mois/); assert.match(view, /Historique économique/);
});
await check('B1-03-UNKNOWN-PARTIAL-ZERO-AND-STALE-DISTINCT', async () => {
  const unknown = await readMonthFixture('2026-11', false, true), view = html(unknown.model);
  const tobacco = /data-month-group="tobacco"[\s\S]*?(?=<section|$)/u.exec(view)?.[0];
  assert.match(tobacco, /À définir|À préciser/); assert.doesNotMatch(tobacco, /0,00/);
  const partial = structuredClone(november.model);
  const groceries = partial.board.baselineControls.find(card => partial.monthRead.controlDomains[card.targetRef] === 'groceries');
  partial.cardKnowledge[`control:${groceries.targetRef}`].dimensions[0].evidenceState = 'PARTIAL';
  assert.match(html(partial), /À compléter/); assert.match(html(partial), /325,00/);
  const stale = html(november.model, true);
  assert.match(stale, /Actualisation en attente/); assert.match(stale, /À recalculer/); assert.match(stale, /500,00/);
  assert.match(view, /Réservation à zéro/); assert.match(view, /0,00/);
});
await check('B1-04-PROTECTED-SAVINGS-AND-SAFETY-RESERVE-VISIBLE', () => {
  const view = html(november.model);
  assert.match(view, /Épargne protégée/); assert.match(view, /Réserve de sécurité/); assert.match(view, /data-protected="true"/);
  assert.match(view, /Réservation · pas un virement/); assert.doesNotMatch(view, /<input|<form|Modifier|Ajuster/u);
  assert.match(view, /Plan annuel · réservation du mois/);
});
await check('B1-05-NO-WRITE-NO-DUPLICATE-NO-NEW-FINANCIAL-STATE', () => {
  const before = JSON.stringify(november.model);
  const view = renderToStaticMarkup(React.createElement(ComposerFinancialInspector, { model: november.model, mode: 'FINANCE', stale: false, focused: null, focus() {}, close() {} }));
  for (const target of monthReadTargets(november.model)) assert(!view.includes(`data-inspector-target="${target}"`));
  assert.equal(JSON.stringify(november.model), before); assert.equal(november.writes.length, 0); assert.equal(october.writes.length, 0);
  assert(november.reads.length > 0); assert(!('preview' in november.model));
});
await check('B1-06-OLDER-MODEL-AND-WRONG-MONTH-HONEST-FALLBACK', () => {
  const legacy = structuredClone(november.model); delete legacy.monthRead;
  const view = html(legacy); assert.match(view, /Détail des ressources non publié/); assert.match(view, /Épargne protégée/);
  const wrong = structuredClone(november.model); wrong.monthRead.targetMonth = '2026-10';
  assert.doesNotMatch(html(wrong), /Ressource de démonstration 1/);
});
await check('B1-07-HOUSEHOLD-AND-MONTH-REJECTED-BY-EXISTING-READER', async () => {
  const f = monthFixture();
  for (const [household, month] of [[uuid(99),'2026-11'],[householdId,'2026-10']]) {
    const response = await handleComposerRequest(f.deps, household, { kind:'READ',sequence:1,targetMonth:month });
    assert.equal(response.ok,false);
  }
  assert.equal(f.writes.length,0);
});
await check('B1-08-DENSE-BOARD-AND-UNRESOLVED-NAVIGATION-PRESERVED', async () => {
  const dense = await readMonthFixture('2026-11', true);
  assert.equal(dense.model.board.contexts.length,18);
  const view = renderToStaticMarkup(React.createElement(ComposerFinancialInspector, { model:dense.model, mode:'FINANCE', stale:false, focused:null, focus(){}, close(){} }));
  assert.match(view,/Activité de démonstration 18/);
  const unresolved = renderToStaticMarkup(React.createElement(ComposerFinancialInspector, { model:dense.model, mode:'UNRESOLVED', stale:false, focused:null, focus(){}, close(){} }));
  assert(!unresolved.includes('data-month-read')); assert.match(unresolved,/Les éléments à préciser/);
});
await check('B1-09-RESTAURANT-IDENTITY-AND-COMPILER-REGRESSION', () => {
  const f = monthFixture(), id=uuid(9000), selectionId=uuid(9001);
  const semantic = {...f.semantic, contexts:[context(9000,'restaurant',{meal:selections({...component('restaurant','40.00',selectionId),selectionId,binding:{mode:'EXTRA_TO_SLOT'}})})]};
  const next = editRestaurant(semantic,{contextOccurrenceId:id,fields:{label:'Restaurant de démonstration'}});
  assert.equal(next.contexts[0].slotSelections.meal.items[0].selectionId,selectionId);
  const preview=evaluatePlanScenario(f.world,next,{expectedActiveRevisionId:null,expectedActiveRevisionNumber:0});
  assert.equal(preview.compiled.components.find(item=>item.contextOccurrenceId===id).evaluation.economicAmount,'40.00');
  const protectedState={...next,preferences:{...next.preferences,anchors:[id]}};
  assert.throws(()=>editRestaurant(protectedState,{contextOccurrenceId:id,fields:{label:'Refus'}}),/LOCKED/);
});
console.log(`B1 ${checks}/${checks} PASS · synthetic memory only · SQL=0 remote=0 writers=0`);
