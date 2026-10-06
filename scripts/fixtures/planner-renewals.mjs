import { require } from '../lib/phase2-ts-loader.mjs';
import { fixture as contextFixture, state, control, uuid, householdId, context, component, selections } from './planner-contexts.mjs';
import { adrien, manon } from './planner-baseline.mjs';
const { Temporal } = require('@js-temporal/polyfill');
const { buildRenewalPlanningBaseline } = require('@/server/phase2/planner/renewal-baseline');
export { state, control, uuid, householdId, context, component, selections, adrien, manon };
export const keys = { mascara: 'maquillage_manon_mascara', brows: 'maquillage_manon_sourcils', eyeliner: 'maquillage_manon_eyeliner', wax: 'cire_adrien' };
export function observations(needKey, gaps, lastDate = '2026-09-25', price = '32.00', person = manon) {
  const dates = [Temporal.PlainDate.from(lastDate)];
  for (const gap of [...gaps].reverse()) dates.unshift(dates[0].subtract({ days: gap }));
  return dates.map((date, i) => ({ observationId: `synthetic:${needKey}:${i}`, subject: { kind: 'PERSON', personId: person },
    needKey, productKey: `synthetic-product:${needKey}`, observedAt: date.toString(), price,
    evidenceRefs: [`product-observation:synthetic:${needKey}:${i}`, `need:synthetic:${needKey}`] }));
}
export const rebuild = world => { world.baseline = buildRenewalPlanningBaseline(world.sources); return world; };
export function fixture() {
  const world = contextFixture(), s = world.sources;
  s.knowledgeCutoff = '2026-11-01T00:00:00Z'; world.asOfDate = '2026-11-01';
  const months = Array.from({ length: 10 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
  s.periods = months.map(month => ({ ...s.periods[0], analysisPeriodId: `period:${month}`, month: `${month}-01` }));
  for (const source of ['BANK', 'SWILE', 'EDENRED', 'MOBILITY']) s.evidence.completeMonthsBySource[source] = [...months];
  s.evidence.history.endMonth = '2026-10';
  s.productObservations = [...observations(keys.mascara, [40, 50, 40, 50, 45]), ...observations(keys.brows, [31, 29, 30, 32, 30, 29], '2026-09-25', '9.99')];
  s.needSubjects = Object.fromEntries(Object.entries(keys).map(([name, needKey]) => [`synthetic-need:${name}`, { needKey, personId: name === 'wax' ? adrien : manon }]));
  return rebuild(world);
}
export const need = (world, name) => world.baseline.renewals.needOccurrences.find(n => n.needKey === keys[name]);
export const profile = (world, name) => world.baseline.renewals.replenishmentProfiles.find(n => n.needKey === keys[name]);
export const needSlot = (world, name) => world.baseline.slots.find(n => n.renewalAuthority?.needOccurrenceId === need(world, name).needOccurrenceId);
export const restock = (world, names = ['mascara', 'brows'], n = 500, options = {}) => context(n, 'beauty-restock', { products: selections(...names.map(name =>
  component('product', profile(world, name).referenceUnitAmount, name, { needOccurrenceId: need(world, name).needOccurrenceId, ...options }))) });
