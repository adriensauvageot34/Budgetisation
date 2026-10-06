import { nightMonth, simpleMonth, component, selections, rebuild, activity, uuid } from './planner-headless.mjs';

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
export function richMonth() {
  const result = interactionMonth();
  result.semantic.contexts = Array.from({length:18},(_,i)=>{ const item=activity(5000+i,'10.00');item.fields.label=`Activité ${String(i+1).padStart(2,'0')} · fixture`;return item; });
  return result;
}
export function savingsMonth() {
  const result = interactionMonth(), original = result.world.sources.monthInputs.declaredOutflows[0];
  result.world.sources.monthInputs.declaredOutflows.push({...original,id:uuid(777),label:'Projet disponible',amount:'0.00',adjustability:'ADJUSTABLE'},
    {...original,id:uuid(778),label:'Projet protégé',amount:'40.00',adjustability:'PROTECTED'});
  rebuild(result.world);return result;
}
