import { renewalMonth, nightMonth, weekendMonth, context, component, selections, simpleMonth } from './planner-headless.mjs';
import { fixture as kernelFixture, emptyState, seal } from './planner-kernel.mjs';
import { atomicMonth } from './planner-atomic-ui.mjs';
import { rebuild as rebuildRenewals } from './planner-renewals.mjs';

// Entirely synthetic authorities. The production library and compiler remain in use.
export function visualMonth() {
  const result = renewalMonth(), night = nightMonth(), weekend = weekendMonth();
  night.semantic.contexts[0].fields.label = 'Soirée';
  night.semantic.contexts[0].slotSelections.before.items[0].provenance = 'PERSONAL_SUGGESTION';
  weekend.semantic.contexts[0].fields.label = 'Week-end';
  result.semantic.contexts.push(...night.semantic.contexts, ...weekend.semantic.contexts,
    context(6100, 'gift', { item: selections(component('gift', '25.00')) }, {label:'Cadeau'}),
    context(6101, 'family-visit', {}, {label:'Visite famille'}),
    context(6102, 'activity', { main: selections(component('activity', '18.00')) }, {label:'Bowling'}));
  result.semantic.controls = simpleMonth().semantic.controls;
  return result;
}
/** Three Beauty roots so removing the context exercises the UI-only 3→2 dissolution. */
export function visualThreeBeautyMonth() {
  const result = visualMonth();
  result.world.sources.needSubjects = Object.fromEntries(Object.entries(result.world.sources.needSubjects)
    .filter(([, subject]) => !['cire_adrien', 'maquillage_manon_eyeliner'].includes(subject.needKey)));
  rebuildRenewals(result.world);
  return result;
}
export function sparseMonth() {
  const world = kernelFixture();
  world.monthInputs.declaredOutflows = [];
  world.baseline.structuralFacts.savingsReservations = [];
  seal(world);
  return { world, semantic: emptyState() };
}
export function unreadyMonth() { const result = atomicMonth(); result.semantic.contexts = []; return result; }
