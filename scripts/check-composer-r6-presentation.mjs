import assert from 'node:assert/strict';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { visualMonth, sparseMonth } from './fixtures/planner-visual-fidelity.mjs';
import { householdId } from './fixtures/planner-headless.mjs';
import { providers } from './fixtures/planner-mobility.mjs';

const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { preparePlanningMobility } = require('@/server/phase2/planner/prospective-mobility-pricing');
const { composePresentationNodes } = require('@/app/mois-a-venir/composer/presentation/adapter');
const { inventoryPages, inventoryPageFor } = require('@/app/mois-a-venir/composer/inventory-layout');
const { resolveVisualIcon } = require('@/app/mois-a-venir/composer/planner-icons/icon-registry');
const pg = await createKernelPostgres();
globalThis.fetch = async () => { throw new Error('R6_REMOTE_NETWORK_FORBIDDEN'); };
let fixture = visualMonth(), sequence = 0;
const owner = providers();
const deps = { repository: createPlanApplyRepository(pg.client), readWorld: async () => fixture.world,
  prepareWorld: (world, state) => preparePlanningMobility(world, state, owner.value) };
const read = async () => { const response = await handleComposerRequest(deps, householdId, {
  kind: 'READ', sequence: ++sequence, targetMonth: '2026-11', draft: fixture.semantic,
}); assert.equal(response.ok, true, response.code); return response.model; };

try {
  assert.equal(resolveVisualIcon('meal', 'PERSON:fixture:adrien-work-coffee').name, 'CoffeeIcon');
  assert.equal(resolveVisualIcon('meal', 'PERSON:fixture:adrien-work-meals').name, 'MealIcon');
  assert.equal(resolveVisualIcon('activity', 'PERSON:fixture:mobility:WORK').name, 'MobilityIcon');
  const model = await read(), before = JSON.stringify(model), nodes = composePresentationNodes(model);
  const roots = [...model.board.contexts.filter(c => !c.parentContextOccurrenceId).map(c => c.contextOccurrenceId),
    ...[...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings]
      .filter(c => !model.presentation.availableReservationRefs.includes(c.targetRef)).map(c => c.targetRef)];
  const projected = nodes.flatMap(n => n.kind === 'CLUSTER' ? n.children.map(c => c.id) : [n.id]);
  assert.deepEqual(projected.toSorted(), roots.toSorted(), 'each source object appears exactly once');
  assert.equal(new Set(projected).size, projected.length, 'no source object is duplicated');
  assert.equal(JSON.stringify(model), before, 'projection leaves source and DTO unchanged');
  assert.deepEqual(composePresentationNodes(model), nodes, 'projection is deterministic');
  for (const cluster of nodes.filter(n => n.kind === 'CLUSTER')) {
    assert.ok(['BEAUTY', 'FOOD'].includes(cluster.family));
    assert.ok(cluster.children.length >= 3);
    assert.equal(cluster.amount, null, 'no client-side financial total');
    const pages = inventoryPages(nodes, 1300, 710);
    for (const child of cluster.children) assert.equal(inventoryPageFor(pages, child.id, model), inventoryPageFor(pages, cluster.id, model));
  }
  assert.ok(nodes.some(n => n.kind === 'CLUSTER' && n.family === 'BEAUTY'), 'fixture should exercise Beauty');
  assert.ok(nodes.some(n => n.kind === 'CLUSTER' && n.family === 'FOOD'), 'fixture should exercise Food');
  fixture = sparseMonth();
  const sparse = composePresentationNodes(await read());
  assert.ok(sparse.every(n => n.kind !== 'CLUSTER'), 'small groups stay as original cards');
  await pg.verifyCanaries();
  assert.deepEqual(await pg.counts(), { plans: 0, revisions: 0 });
  assert.equal(pg.rpcCalls, 0);
  console.log(JSON.stringify({ status: 'PASS', clusters: nodes.filter(n => n.kind === 'CLUSTER').map(n => ({ family: n.family, children: n.children.map(c => c.id) })), roots: roots.length, projected: projected.length }));
} finally { await pg.close(); }
