import { nightMonth, simpleMonth, component, selections, rebuild } from './planner-headless.mjs';

// Synthetic evidence only. The actual compiler prices/excludes every selection.
export function atomicMonth() {
  const result = nightMonth();
  result.world.sources.monthInputs.declaredOutflows[0].adjustability = 'PROTECTED';
  rebuild(result.world);
  const night = result.semantic.contexts[0];
  night.fields.label = 'Soirée · fixture synthétique';
  night.slotSelections.before.items[0].provenance = 'PERSONAL_SUGGESTION';
  night.slotSelections.food = selections(component('fast-food', null, 'unknown-food'));
  return result;
}
export function interactionMonth() {
  const result = simpleMonth();
  result.world.monthInputs.decision = { ...result.world.monthInputs.decision, goal: '1000.00' };
  rebuild(result.world);
  return result;
}
