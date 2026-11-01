import { fixture, state, uuid, householdId, rebuild, activity } from './planner-headless.mjs';
import { require } from '../lib/phase2-ts-loader.mjs';
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');

/** Synthetic sources only. No SQL engine, credentials, Supabase or durable writer. */
export function monthFixture(month = '2026-11', dense = false, unknown = false) {
  if (!['2026-10', '2026-11'].includes(month)) throw Error('B1_FIXTURE_MONTH_INVALID');
  const world = fixture();
  world.asOfDate = '2026-11-02';
  world.sources.targetMonth = month;
  world.sources.knowledgeCutoff = '2026-11-02T10:00:00Z';
  world.forecast.meta.targetMonth = month;
  world.forecast.referencePlan.targetMonth = month;
  world.forecast.components.find(part => part.key === 'obligation:rent').label = 'Loyer de démonstration';
  world.forecast.income.components.forEach((part, index) => { part.label = `Ressource de démonstration ${index + 1}`; });
  world.monthInputs.safetyReserve = '25.00';
  world.monthInputs.fixedAmountOverrides = month === '2026-10' ? { 'obligation:rent': { amount: '450.00', dueDate: '2026-10-12', reason: 'MONTH_EXCEPTION' } } : {};
  world.monthInputs.declaredOutflows = [
    { id: uuid(700), label: 'Projet de démonstration', kind: 'SAVINGS', amount: '100.00', dueDate: `${month}-15`, adjustability: 'ADJUSTABLE', source: 'MONTH_INPUT', annualGoalRef: null },
    { id: uuid(778), label: 'Épargne protégée', kind: 'SAVINGS', amount: '40.00', dueDate: null, adjustability: 'PROTECTED', source: 'ANNUAL_PLAN', annualGoalRef: 'synthetic-goal' },
    { id: uuid(777), label: 'Réservation à zéro', kind: 'SAVINGS', amount: '0.00', dueDate: null, adjustability: 'ADJUSTABLE', source: 'MONTH_INPUT', annualGoalRef: null },
  ];
  world.sources.forecast = world.forecast;
  world.sources.monthInputs = world.monthInputs;
  if (unknown) world.sources.evidence.completeMonthsBySource.BANK = [];
  rebuild(world);
  const semantic = { ...state(), targetMonth: month, contexts: dense ? Array.from({ length: 18 }, (_, i) => {
    const context = activity(5000 + i, '10.00'); context.fields.label = `Activité de démonstration ${i + 1}`; context.fields.plannedDate = `${month}-12`; return context;
  }) : [] };
  const reads = [], writes = [];
  const repository = new Proxy({ readActivePlan: async (...args) => { reads.push(args); return null; } }, {
    get(target, key) { return key in target ? target[key] : () => { writes.push(String(key)); throw Error('B1_WRITER_FORBIDDEN'); }; },
  });
  const deps = { repository, readWorld: async (household, target) => {
    if (household !== householdId || target !== month) throw Error('B1_FIXTURE_SCOPE_INVALID');
    return world;
  }, householdPersons: [] };
  return { world, semantic, deps, reads, writes };
}

export async function readMonthFixture(month = '2026-11', dense = false, unknown = false) {
  const fixture = monthFixture(month, dense, unknown);
  const result = await handleComposerRequest(fixture.deps, householdId, { kind: 'READ', sequence: 0, targetMonth: month, draft: fixture.semantic });
  if (!result.ok) throw Error(`${result.code}: ${result.message}`);
  return { ...fixture, model: result.model };
}
