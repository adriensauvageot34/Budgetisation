import { fixture, state, control, uuid, householdId, findSlot, rebuild } from './planner-simple-levers.mjs';
export { fixture, state, control, uuid, householdId, findSlot, rebuild };
export const selections = (...items) => ({ items });
export const component = (optionKey, amount, selectionId = optionKey, options = {}) => ({
  selectionId, optionKey, kind: 'COMPONENT', provenance: 'EXPLICIT_USER_DECISION', label: `Synthetic ${optionKey}`,
  quantity: '1', cost: amount === null ? { kind: 'UNKNOWN' } : { kind: 'MANUAL', unitAmount: amount }, ...options
});
export const child = (templateKey, n, selectionId = `child-${n}`, provenance = 'EXPLICIT_USER_DECISION') => ({
  selectionId, optionKey: templateKey, kind: 'CHILD_CONTEXT', childContextOccurrenceId: uuid(n), provenance
});
export const mobility = (optionKey, selectionId = 'movement', options = {}) => ({
  selectionId, optionKey, kind: 'MOBILITY_INTENT', provenance: 'EXPLICIT_USER_DECISION', ...options
});
export const context = (n, templateKey, slotSelections = {}, fields = {}, parent = null) => ({
  contextOccurrenceId: uuid(n), templateKey, status: 'ACTIVE', parentContextOccurrenceId: parent === null ? null : uuid(parent),
  fields: { label: `Synthetic ${templateKey}`, plannedDate: '2026-11-12', ...fields }, slotSelections, provenance: 'EXPLICIT_USER_DECISION'
});
export const restaurant = (n = 100, amount = '20.00', parent = null) => context(n, 'restaurant', { meal: selections(component('restaurant', amount)) }, {}, parent);
export const activity = (n = 200, amount = '10.00', parent = null) => context(n, 'activity', { main: selections(component('activity', amount)) }, {}, parent);
export const stay = (n = 300, amount = '100.00', slots = {}) => context(n, 'short-stay', { lodging: selections(component('lodging', amount)), ...slots });
export const night = (n = 400, amount = '20.00', slots = {}) => context(n, 'night-out', { main: selections(component('main', amount)), ...slots });
