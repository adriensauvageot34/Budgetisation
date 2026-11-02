import assert from 'node:assert/strict';
import { require } from './lib/phase2-ts-loader.mjs';
import { readMonthFixture, monthFixture } from './fixtures/composer-v22-b1.mjs';
import { householdId, uuid, selections, component, context, rebuild } from './fixtures/planner-headless.mjs';
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { ComposerMonthRead, monthReadTargets, monthControlReading } = require('@/app/mois-a-venir/composer/month-read');
const { ComposerFinancialInspector } = require('@/app/mois-a-venir/composer/composer-financial-inspector');
const { handleComposerRequest, composerUiModel } = require('@/server/phase2/planner/composer-service');
const { readMonthComposer } = require('@/server/phase2/planner/read-model');
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
  // Group containers changed from sections to native disclosures; keep the same negative scoped to Tabac.
  const tobacco = view.slice(view.indexOf('data-month-group="tobacco"'), view.indexOf('data-month-group="savings"'));
  assert.match(tobacco, /À définir|À préciser/); assert.doesNotMatch(tobacco, /0,00/);
  const partial = structuredClone(november.model);
  const groceries = partial.board.baselineControls.find(card => partial.monthRead.controlDomains[card.targetRef] === 'groceries');
  partial.cardKnowledge[`control:${groceries.targetRef}`].dimensions[0].evidenceState = 'PARTIAL';
  assert.match(html(partial), /À compléter/); assert.match(html(partial), /325,00/);
  const stale = html(november.model, true);
  assert.match(stale, /Actualisation en attente/); assert.match(stale, /Dernière référence connue/);
  assert.match(stale, /325,00/); assert.match(stale, /500,00/);
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
await check('B1-UX-10-STALE-KEEPS-OWNER-REFERENCES-NOT-OPTIMISTIC-VALUES', () => {
  const pending=structuredClone(november.model);
  const groceries=pending.board.baselineControls.find(card=>pending.monthRead.controlDomains[card.targetRef]==='groceries');
  Object.assign(groceries.value,{amount:'9999.00',decisionValue:{amount:'9999.00'},projectionPending:true});
  const saving=pending.board.savings.find(card=>card.targetRef===`savings:${uuid(700)}`);
  Object.assign(saving.value,{amount:'8888.00',decisionValue:{amount:'8888.00'},projectionPending:true});
  const before=JSON.stringify(pending), view=html(pending,true), reading=monthControlReading(pending,groceries,true);
  assert.match(reading.value,/325,00/);assert.equal(reading.origin,'HISTORICAL');
  assert.match(view,/100,00/);assert.doesNotMatch(view,/9999|9.?999|8888|8.?888/);
  assert.match(view,/Dernière valeur connue · actualisation en attente/);
  assert.equal(JSON.stringify(pending),before);
  assert.match(html(november.model),/Référence historique · non choisie/);
});
await check('B1-UX-11-STALE-UNKNOWN-OLD-DTO-AND-SUGGESTION-ZERO-STAY-HONEST', () => {
  const legacy=structuredClone(november.model);delete legacy.monthRead;
  const saving=legacy.board.savings.find(card=>card.targetRef===`savings:${uuid(700)}`);
  saving.value.amount='7777.00';saving.value.decisionValue={amount:'7777.00'};delete saving.value.referenceValue;
  const reading=monthControlReading(legacy,saving,true);
  assert.equal(reading.origin,'UNKNOWN');assert.equal(reading.value,'Projection à recalculer');
  assert.doesNotMatch(html(legacy,true),/7777|7.?777/);
  const optional=legacy.board.discretionaryControls.find(card=>card.value.inclusion==='SUGGESTION_ONLY');
  optional.value.amount='2222.00';optional.value.decisionValue={amount:'2222.00'};
  const noReference=monthControlReading(legacy,optional,true);
  assert.equal(noReference.origin,'UNKNOWN');assert.equal(noReference.value,'Projection à recalculer');
  const current=structuredClone(november.model);
  const groceries=current.board.baselineControls.find(card=>current.monthRead.controlDomains[card.targetRef]==='groceries');
  const history=current.cardKnowledge[`control:${groceries.targetRef}`].dimensions.find(d=>d.key==='MONTH_AMOUNT');
  history.value='0.00';history.evidenceState='KNOWN';
  assert.match(monthControlReading(current,groceries,true).value,/0,00/);
  assert.equal(monthControlReading(current,groceries,true).origin,'HISTORICAL');
});
await check('B1-UX-12-INACTIVE-RESERVATION-HAS-NO-FALSE-BOARD-LINK', () => {
  const inactive=`savings:${uuid(777)}`,protectedRef=`savings:${uuid(778)}`,view=html(november.model);
  assert(november.model.presentation.availableReservationRefs.includes(inactive));
  assert(!view.includes(`data-month-target="${inactive}"`));
  assert(view.includes(`data-month-target="${protectedRef}"`));
  assert.match(view,/Réservation à zéro/);assert.match(view,/0,00/);
  assert.match(view,/Réservation publiée sans carte active sur le Board/);
});
await check('B1-MIN-13-SERIALIZED-MONTH-READ-IS-AN-ALLOWLIST', async () => {
  const f=monthFixture(), read=structuredClone(await readMonthComposer(f.deps,householdId,'2026-11',f.semantic));
  const resource=read.preview.baseline.structuralFacts.resources[0];
  // Future owner fields must not cross the UI boundary merely because they exist.
  resource.metadata.extra='SYNTHETIC_OMIT_METADATA';resource.value.extra='SYNTHETIC_OMIT_RANGE';
  read.preview.baseline.structuralFacts.savingsReservations[0].extra='SYNTHETIC_OMIT_RESERVATION';
  read.preview.baseline.sourceRefs.push({sourceKey:'synthetic:unused',owner:'SYNTHETIC_OMIT_OWNER',digest:'synthetic',evidenceRefs:[]});
  const before=JSON.stringify(read), model=await composerUiModel(f.deps,householdId,read);
  const serialized=JSON.stringify(model.monthRead), dto=JSON.parse(serialized);
  assert.deepEqual(Object.keys(dto).sort(),['controlDomains','knowledgeCutoff','resources','savingsReservations','sourceOwners','targetMonth']);
  for(const row of dto.resources){
    assert.deepEqual(Object.keys(row).sort(),['dueDate','factKey','knowledge','label','role','sourceRefs','value']);
    assert.deepEqual(Object.keys(row.value).sort(),['central','high','low']);
    const owner=read.preview.baseline.structuralFacts.resources.find(fact=>fact.factKey===row.factKey);
    assert.deepEqual(row.value,{low:owner.value.low,central:owner.value.central,high:owner.value.high});
    assert.equal(row.knowledge,owner.knowledge);assert.equal(row.dueDate,owner.dueDate);
    assert.deepEqual(row.sourceRefs,owner.sourceRefs);
  }
  for(const row of dto.savingsReservations){
    assert.deepEqual(Object.keys(row).sort(),['adjustability','amount','dueDate','label','reservationId','source','sourceRefs']);
    const owner=read.preview.baseline.structuralFacts.savingsReservations.find(r=>r.reservationId===row.reservationId);
    assert.equal(row.amount,owner.amount);assert.equal(row.adjustability,owner.adjustability);assert.equal(row.source,owner.source);
  }
  assert.deepEqual(Object.values(dto.controlDomains).sort(),['groceries','tobacco-vape']);
  assert(Object.keys(dto.controlDomains).every(ref=>model.board.baselineControls.some(card=>card.targetRef===ref)));
  assert(!Object.hasOwn(dto.sourceOwners,'synthetic:unused'));assert.doesNotMatch(serialized,/SYNTHETIC_OMIT/);
  assert.equal(JSON.stringify(read),before);assert.equal(f.writes.length,0);
});
await check('B1-MIN-14-STOCK-ROLE-DATE-ZERO-AND-SIX-GROUPS-PRESERVED', async () => {
  const f=monthFixture();f.world.monthInputs.openingBalance={amount:'0.00',asOfDate:'2026-11-01'};rebuild(f.world);
  const result=await handleComposerRequest(f.deps,householdId,{kind:'READ',sequence:0,targetMonth:'2026-11',draft:f.semantic});
  assert.equal(result.ok,true);
  const dto=JSON.parse(JSON.stringify(result.model.monthRead)), stock=dto.resources.find(r=>r.factKey==='bank:observed-stock');
  assert.equal(stock.role,'STOCK_NOT_INCOME');assert.equal(stock.value.central,'0.00');assert.equal(stock.dueDate,'2026-11-01');
  assert(!Object.hasOwn(stock,'metadata'));assert.equal(dto.sourceOwners[stock.sourceRefs[0]],'phase2_month_inputs');
  const view=html(result.model), start=view.indexOf('data-month-row="bank:observed-stock"');assert(start>=0);
  const row=view.slice(start,view.indexOf('</details>',start));
  assert.match(row,/Solde bancaire déclaré/);assert.match(row,/Stock déclaré · pas un revenu/);
  assert.match(row,/0,00/);assert.match(row,/Observation déclarée : 1 nov\. 2026/);assert.match(row,/Informations saisies pour ce mois/);
  for(const group of ['charges','resources','groceries','tobacco','savings','envelopes'])assert(view.includes(`data-month-group="${group}"`));
  assert.equal(f.writes.length,0);
});
await check('B1-MIN-15-ONLY-CONSUMED-SOURCES-INCLUDING-PENDING-ENVELOPES', async () => {
  const f=monthFixture(), read=structuredClone(await readMonthComposer(f.deps,householdId,'2026-11',f.semantic));
  const envelope=read.board.discretionaryControls.find(card=>card.value.inclusion==='SUGGESTION_ONLY');assert(envelope);
  envelope.value.sourceRefs=['synthetic:pending-envelope'];
  const other=read.board.baselineControls.find(card=>!['groceries','tobacco-vape'].includes(
    read.preview.compiled.planSlots.find(slot=>slot.baseline.slotIdentityKey===card.targetRef).baseline.semanticKey));assert(other);
  other.value.sourceRefs=['synthetic:other-card'];
  read.preview.baseline.sourceRefs.push(
    {sourceKey:'synthetic:pending-envelope',owner:'CanonicalEconomicHistory',digest:'synthetic',evidenceRefs:[]},
    {sourceKey:'synthetic:other-card',owner:'UNUSED_OTHER_OWNER',digest:'synthetic',evidenceRefs:[]});
  const model=await composerUiModel(f.deps,householdId,read);
  assert.equal(model.monthRead.sourceOwners['synthetic:pending-envelope'],'CanonicalEconomicHistory');
  assert(!Object.hasOwn(model.monthRead.sourceOwners,'synthetic:other-card'));
  assert(!Object.hasOwn(model.monthRead.controlDomains,other.targetRef));
  const pending=structuredClone(model), card=pending.board.discretionaryControls.find(c=>c.targetRef===envelope.targetRef);
  Object.assign(card.value,{amount:'12.00',decisionValue:{amount:'12.00'},projectionPending:true});
  const view=html(pending,true), start=view.indexOf(`data-month-row="${card.targetRef}"`);assert(start>=0);
  const row=view.slice(start,view.indexOf('</details>',start));
  assert.match(row,/Historique économique/);assert.match(row,/Projection à recalculer/);
  assert.doesNotMatch(row,/Source non détaillée|12,00/);assert.equal(f.writes.length,0);
});
console.log(`B1 + UX-R1 + MIN ${checks}/${checks} PASS · synthetic memory only · SQL=0 remote=0 writers=0`);
