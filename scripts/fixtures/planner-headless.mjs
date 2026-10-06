import { fixture, state, uuid, householdId, selections, component, mobility, context, activity, night, stay, child, car, journey, home, destination } from './planner-mobility.mjs';
import { control, findSlot, rebuild } from './planner-simple-levers.mjs';
import { fixture as renewalFixture, restock } from './planner-renewals.mjs';
import { externalExpense } from './planner-kernel.mjs';
export { fixture, state, uuid, householdId, selections, component, mobility, context, activity, night, stay, child, car, journey, home, destination, control, findSlot, rebuild };
export function simpleMonth() {
  const world = fixture();
  return { world, semantic: state([control(findSlot(world, 'groceries').slotIdentityKey, { amount: '300.00' }, 1),
    control(findSlot(world, 'restaurants').slotIdentityKey, { count: '1' }, 2), control(`savings:${uuid(700)}`, { amount: '60.00' }, 3)]) };
}
export function nightMonth(mode = 'taxi') {
  const world = fixture(), amount = mode === 'taxi' ? '14.00' : '2.00';
  return { world, semantic: state([], [night(400, '20.00', { before: selections(component('before', '8.00')),
    outbound: selections(mobility(mode, mode === 'taxi' ? 'uber' : 'tram', { origin: home, destination,
      pricing: { fare: { kind: 'MANUAL', unitAmount: amount }, fundingAllocations: [{ source: 'BANK', amount }] } })) })]) };
}
export function weekendMonth(confirmed = false) {
  const world = fixture();
  const semantic = state([], [stay(300, '100.00', { groceries: selections(component('groceries', '20.00', 'groceries',
    confirmed ? { binding: { mode: 'CONFIRMED_CONSUMPTION' } } : {})),
    transport: selections(car()), activities: selections(child('activity', 200)), restaurants: selections(child('restaurant', 100)) }),
    activity(200, '10.00', 300),
    context(100, 'restaurant', { meal: selections(component('restaurant', '20.00')),
      transport: selections(car({ journey: journey('SHARES_JOURNEY', 300) })) }, {}, 300)]);
  semantic.contexts.find(c => c.contextOccurrenceId === uuid(200)).slotSelections.transport = selections(car({ journey: journey('SHARES_JOURNEY', 300) }));
  return { world, semantic };
}
export function renewalMonth() {
  const world = renewalFixture(); world.mobilityFacts = fixture().mobilityFacts;
  return { world, semantic: state([], [restock(world)]) };
}
export function externalMonth() {
  const world = fixture(), external = externalExpense(800);
  world.externalIntents = [external]; world.sources.plannedExpenses = [external]; rebuild(world);
  return { world, semantic: state([control(findSlot(world, 'restaurants').slotIdentityKey, { count: '2' }, 1)]) };
}
