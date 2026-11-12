import assert from 'node:assert/strict';
import { require } from './lib/phase2-ts-loader.mjs';
import { budgetImpactFixture, impactIds } from './fixtures/composer-budget-impact.mjs';
import { householdId, uuid } from './fixtures/planner-headless.mjs';

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { IntentBudgetImpact, BudgetPreviewStatus } = require('@/app/mois-a-venir/composer/intent-budget-impact');
const { ComposerProjectionDetails } = require('@/app/mois-a-venir/composer/composer-cockpit');
const { ComposerMonthRead } = require('@/app/mois-a-venir/composer/month-read');
const { readMonthComposer } = require('@/server/phase2/planner/read-model');
const { composerBudgetReading } = require('@/server/phase2/planner/composer-budget-reading');
const { visualDraftModel } = require('@/app/mois-a-venir/composer/local-draft');
const { ComposerPreviewScheduler } = require('@/app/mois-a-venir/composer/preview-scheduler');
const { semanticStateDigest } = require('@/domain/phase2/planner/semantic-state');
globalThis.fetch = async () => { throw Error('BUDGET_IMPACT_REMOTE_FORBIDDEN'); };

const impact = (model, name) => model.budgetReading.byContext[impactIds[name]];
const amounts = ({ gross, displaced, incremental }) => [gross, displaced, incremental];
const summary = (model, name, status = 'FRESH') => renderToStaticMarkup(React.createElement(BudgetPreviewStatus.Provider, { value: status },
  React.createElement(IntentBudgetImpact, { model, contextId: impactIds[name] })));
const monthReading = (model, stale = false) => renderToStaticMarkup(React.createElement(ComposerMonthRead,
  { model, stale, focused: null, focus: () => {}, decide: () => assert.fail('Unexpected mutation') }));

const fixture = await budgetImpactFixture();
const model = fixture.model;
assert.deepEqual(amounts(impact(model, 'groceries')), ['8.00', '8.00', '0.00']);
assert.match(summary(model, 'groceries'), /entièrement couvertes/);
assert.deepEqual(impact(model, 'groceries').plannedPosts, ['Enveloppe Courses']);
for (const [options, expected, coverage] of [
  [{ groceriesAmount: '5.00' }, ['8.00', '5.00', '3.00'], 'PARTIAL'],
  [{ groceriesAmount: '0.00' }, ['8.00', '0.00', '8.00'], 'EXHAUSTED'],
  [{ coverage: 'EXTRA_TO_SLOT' }, ['8.00', '0.00', '8.00'], 'EXTRA'],
  [{ coverage: 'AUTO' }, ['8.00', null, null], 'CONFIRM'],
  [{ envelope: false }, ['8.00', null, null], 'ABSENT'],
]) {
  const scenario = await budgetImpactFixture(options);
  assert.deepEqual(amounts(impact(scenario.model, 'groceries')), expected, JSON.stringify(options));
  assert.match(summary(scenario.model, 'groceries'), new RegExp(`data-groceries-coverage="${coverage}"`));
  assert.match(monthReading(scenario.model), new RegExp(`data-month-grocery-impact="${coverage}"`));
  assert.match(monthReading(scenario.model, true), /data-month-grocery-impact="PENDING"/);
  assert.deepEqual(scenario.writes, []);
}
const unknownPrice = await budgetImpactFixture();
const unpriced = await unknownPrice.line(impactIds.groceries, 27101, 'Pâtes', '2', '');
assert.equal(impact(unpriced, 'groceries').gross, null);
assert(monthReading(unpriced).includes('Coût du panier</dt><dd>À préciser</dd>'));
console.log('Courses 8 €, couverture totale, partielle, épuisée, en plus, à confirmer et absente : PASS');

assert.deepEqual(amounts(impact(model, 'amazon')), ['48.00', '0.00', '48.00']);
const withShipping = await fixture.basketEdit(impactIds.amazon, { kind: 'SET_DELIVERY', mode: 'DELIVERY', coverage: 'ADDITIONAL', selectionId: uuid(27204), price: '5' });
assert.deepEqual(amounts(impact(withShipping, 'amazon')), ['53.00', '0.00', '53.00']);
const withUpdatedLine = await fixture.line(impactIds.amazon, 27202, 'Shampoing', '2', '9');
assert.deepEqual(amounts(impact(withUpdatedLine, 'amazon')), ['55.00', '0.00', '55.00']);
assert.deepEqual(amounts(impact(model, 'restaurant')), ['40.00', '0.00', '40.00']);
assert.deepEqual(impact(model, 'restaurant').declaredFundingSources, ['BANK']);
assert.match(summary(model, 'restaurant'), /Source déclarée · Banque/);
assert.deepEqual(amounts(impact(model, 'cinema')), ['16.00', '0.00', '16.00']);
assert.deepEqual(amounts(impact(model, 'weekend')), ['208.00', '0.00', '208.00']);
assert.deepEqual(amounts(impact(model, 'mascara')), ['12.50', '0.00', '12.50']);
assert.deepEqual(amounts(impact(model, 'clothing')), [null, null, null]);
assert.doesNotMatch(summary(model, 'clothing'), /0,00/);
const confirmedZero = await fixture.line(impactIds.clothing, 27601, 'Vêtement chiffré à zéro', '1', '0');
assert.equal(impact(confirmedZero, 'clothing').gross, '0.00');
assert.match(summary(confirmedZero, 'clothing'), /0,00/);
const meal = model.semanticState.contexts.find(context => context.contextOccurrenceId === impactIds.restaurant).slotSelections.meal.items[0];
const restaurantWithExtra = await fixture.request({ kind: 'EDIT_RESTAURANT', edit: {
  contextOccurrenceId: impactIds.restaurant, slots: { extras: [{
    ...meal, optionKey: 'extra', selectionId: uuid(27303), label: 'Bière en supplément',
    cost: { kind: 'MANUAL', unitAmount: '6.00' }, fundingAllocations: [],
  }] },
} });
assert.deepEqual(amounts(impact(restaurantWithExtra, 'restaurant')), ['46.00', '0.00', '46.00']);
const lodging = model.semanticState.contexts.find(context => context.contextOccurrenceId === impactIds.weekend).slotSelections.lodging.items[0];
const perNight = await fixture.request({ kind: 'EDIT_SHORT_STAY', edit: {
  contextOccurrenceId: impactIds.weekend, fields: {}, slots: { lodging: [{
    ...lodging, quantity: '2', cost: { kind: 'MANUAL', unitAmount: '100.00' },
    lodgingPricing: { version: 'lodging-pricing@v1', basis: 'PER_NIGHT', nightCount: 2 },
  }] },
} });
assert.deepEqual(amounts(impact(perNight, 'weekend')), ['208.00', '0.00', '208.00']);
console.log('Les sept éditeurs, les montants Amazon, les détails inclus et les prix inconnus : PASS');

const blocked = await budgetImpactFixture({ monthlyDeclarations: false });
assert.equal(blocked.model.board.cockpit.projectionCompleteness, 'UNKNOWN');
assert.equal(blocked.model.board.cockpit.applyReadiness, 'BLOCKED');
assert.deepEqual(blocked.model.budgetReading.missingMonthlyDeclarations, ['Swile', 'Edenred']);
const absentView = monthReading(blocked.model);
for (const provider of ['SWILE', 'EDENRED']) {
  assert.match(absentView, new RegExp(`data-loading="${provider}" data-knowledge="ABSENT"`));
  assert.match(absentView, new RegExp(`month=2026-11&amp;control=center&amp;focus=update%3Aitem%3A${provider}%3Aloading`));
}
assert.match(monthReading(model), /data-loading="SWILE" data-knowledge="ZERO"/);
assert.match(monthReading(model), /data-loading="EDENRED" data-knowledge="ZERO"/);
assert.deepEqual(amounts(impact(blocked.model, 'groceries')), ['8.00', '8.00', '0.00']);
const finance = renderToStaticMarkup(React.createElement(ComposerProjectionDetails, { projection: blocked.model.board.cockpit,
  budgetReading: blocked.model.budgetReading }));
assert.match(finance, /Projection du mois indisponible/);
assert.match(finance, /Chargements mensuels[^<]+Swile et Edenred/);
assert.match(finance, /data-financial-apply-readiness="BLOCKED"/);
const partial = renderToStaticMarkup(React.createElement(ComposerProjectionDetails, { projection: confirmedZero.board.cockpit }));
assert.match(partial, /data-financial-completeness="PARTIAL"/);
assert.match(partial, /data-financial-apply-readiness="READY_WITH_WARNINGS"/);
assert.match(summary(model, 'amazon', 'FAILED'), /Calcul indisponible/);
assert.doesNotMatch(summary(model, 'amazon', 'FAILED'), /48,00/);
console.log('Simulation indisponible, complétude et avertissements distincts : PASS');

const read = await readMonthComposer(fixture.deps, householdId, '2026-11', model.semanticState);
const before = JSON.stringify(read.preview);
assert.deepEqual(composerBudgetReading(read, fixture.world.forecast), model.budgetReading);
const missingIncome = structuredClone(fixture.world.forecast.income);
missingIncome.components[0].central = null;
const missingSalary = composerBudgetReading(read, { ...fixture.world.forecast, income: missingIncome });
assert.deepEqual(missingSalary.missingSalaryForecasts, [missingIncome.components[0].label]);
const salaryView = monthReading({ ...model, budgetReading: missingSalary });
assert.match(salaryView, /Montant inconnu/);
assert.match(salaryView, /focus=info/);
assert.doesNotMatch(salaryView, /focus=update%3Aitem%3Aresource-income%3ADigital-Learning-Contest/);
const unpublished = composerBudgetReading(read, { ...fixture.world.forecast,
  income: { ...missingIncome, components: missingIncome.components.slice(1) } });
assert.match(monthReading({ ...model, budgetReading: unpublished }), /Source non publiée/);
const explicitZero = structuredClone(read);
explicitZero.preview.scenario.inputs.declaredResources = { 'benefit:swile': '0.00', 'benefit:edenred': '0.00' };
assert.deepEqual(composerBudgetReading(explicitZero, fixture.world.forecast).missingMonthlyDeclarations, []);
const positive = structuredClone(read);
positive.preview.scenario.inputs.declaredResources = { 'benefit:swile': '25.00', 'benefit:edenred': '15.00' };
const published = composerBudgetReading(positive, fixture.world.forecast);
assert.deepEqual(published.monthlyLoadings.map(row => row.amount), ['25.00', '15.00']);
assert.deepEqual(published.missingMonthlyDeclarations, []);
assert.match(monthReading({ ...model, budgetReading: published }), /data-loading="EDENRED" data-knowledge="DECLARED"/);
const noReference = composerBudgetReading(read, { ...fixture.world.forecast, referencePlan: null });
assert.match(monthReading({ ...model, budgetReading: noReference }), /Référence budgétaire non publiée/);
assert.equal(JSON.stringify(read.preview), before);
assert.equal(model.proof.expectedPreviewDigest, read.preview.previewDigest);
const visibleBefore = JSON.stringify(model);
assert.match(summary(model, 'amazon'), /48,00/);
assert.equal(JSON.stringify(model), visibleBefore);
const localOnly = visualDraftModel(model, withUpdatedLine.semanticState);
assert.notEqual(localOnly.board.draft.semanticStateDigest, model.board.draft.semanticStateDigest);
assert.doesNotMatch(summary(localOnly, 'amazon'), /48,00|55,00/);
assert.deepEqual(fixture.writes, []);
console.log('Digest inchangé en consultation, montants périmés masqués, aucune écriture : PASS');

const scheduler = new ComposerPreviewScheduler(), calls = [], states = [], completions = [];
const sameDraft = confirmedZero.semanticState, sameDigest = semanticStateDigest(sameDraft);
const authority = () => ({ draftDigest: sameDigest, targetMonth: sameDraft.targetMonth, worldVersion: 'synthetic-world' });
const transport = async request => {
  assert.equal(request.kind, 'READ');
  assert.equal(semanticStateDigest(request.draft), sameDigest);
  calls.push(request);
  return calls.length === 1 ? { ok: false, sequence: request.sequence, code: 'COMPOSER_UNAVAILABLE', message: 'Lecture indisponible' }
    : { ok: true, sequence: request.sequence, model: confirmedZero };
};
async function previewSameDraft() {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('SYNTHETIC_PREVIEW_TIMEOUT')), 3000);
    scheduler.schedule(sameDraft, 'synthetic-world', transport, authority, status => states.push(status),
      response => { clearTimeout(timeout); completions.push(response); resolve(); }, 0);
  });
}
await previewSameDraft();
assert.equal(states.at(-1), 'FAILED');
await previewSameDraft();
assert.equal(states.at(-1), 'FRESH');
assert.equal(calls.length, 2);
assert.equal(completions.length, 2);
assert.equal(semanticStateDigest(sameDraft), sameDigest);
scheduler.dispose();
assert.deepEqual(fixture.writes, []);
console.log('Réessai de lecture, même Draft et digest, sans mutation ni faux résultat : PASS');
