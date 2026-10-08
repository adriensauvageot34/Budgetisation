import assert from 'node:assert/strict';
import fs from 'node:fs';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { nightMonth, weekendMonth, state, householdId, uuid } from './fixtures/planner-headless.mjs';
import { atomicMonth } from './fixtures/planner-atomic-ui.mjs';
import { providers } from './fixtures/planner-mobility.mjs';
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { readMonthComposer } = require('@/server/phase2/planner/read-model');
const { composerPresentation } = require('@/server/phase2/planner/composer-presentation');
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { preparePlanningMobility } = require('@/server/phase2/planner/prospective-mobility-pricing');
const { ComposerBoard } = require('@/app/mois-a-venir/composer/composer-board');
const { ContextCard } = require('@/app/mois-a-venir/composer/context-card');
const pg = await createKernelPostgres(), owner = providers(), passed = [];
let fixture = atomicMonth(), sequence = 0;
const deps = { repository: createPlanApplyRepository(pg.client), readWorld: async () => fixture.world,
  prepareWorld: (world, semantic) => preparePlanningMobility(world, semantic, owner.value) };
const read = async () => { const response = await handleComposerRequest(deps, householdId, { kind: 'READ', sequence: ++sequence, targetMonth: '2026-11', draft: fixture.semantic });
  assert.equal(response.ok, true, response.code); return response.model; };
const noop = () => {}, props = { busy: false, selected: null, focused: null, focus: noop, edit: noop, editContext: noop, choose: noop,
  drag: noop, drop: noop, request: noop, hover: noop, add: noop, preview: noop, balance: noop, details: noop };
const html = (model, focused = null) => renderToStaticMarkup(React.createElement(ComposerBoard, { ...props, model, focused }));
const check = async (id, fn) => { await fn(); passed.push(id); console.log(`${id} PASS`); };
try {
  const model = await read(), id = model.board.contexts[0].contextOccurrenceId, socket = key => model.presentation.sockets[`${id}:${key}`];
  await check('R2-001', () => { const output = html(model);
    for (const s of model.board.contexts[0].sockets) for (const item of s.currentItems) assert.ok(output.includes(`data-selection="${item.selectionId}"`));
    assert.match(output, /data-context-equipment-row/); assert.ok(!output.includes('data-orbit='));
    assert.equal(socket('before').orbit, 'NORTH'); assert.equal(socket('main').orbit, 'WEST');
  });
  await check('R2-002', () => { for (const card of model.board.contexts) for (const s of card.sockets) {
    const view = model.presentation.sockets[`${card.contextOccurrenceId}:${s.slotKey}`];
    if (view.canAdd) assert.ok(view.options.length && view.options.every(option => model.dropCapabilities.some(d => d.sourceAssetKey === option.assetKey && d.target.contextOccurrenceId === card.contextOccurrenceId && d.target.slotKey === s.slotKey && d.resolution !== 'BLOCKED')));
  } assert.ok(!Object.keys(model.presentation.sockets).some(key => key.endsWith(':imaginary'))); });
  await check('R2-003', () => { const suggestion = socket('before').satellites[0]; assert.equal(suggestion.state, 'SUGGESTED');
    assert.equal(suggestion.economicAmount, null); assert.equal(suggestion.canAccept, true); assert.match(html(model), /data-state="SUGGESTED"/);
  });
  await check('R2-004', async () => { const source = await readMonthComposer(deps, householdId, '2026-11', fixture.semantic);
    // A derived, read-only DTO with actual compiled selections; no permission is invented.
    const derived = { ...source, board: { ...source.board, contexts: source.board.contexts.map(card => ({ ...card, readOnly: true, capabilityRefs: [] })) },
      dropCapabilities: source.dropCapabilities.map(d => ({ ...d, resolution: 'BLOCKED' })) };
    const p = composerPresentation(derived), s = p.sockets[`${id}:main`].satellites[0];
    assert.equal(s.state, 'DERIVED'); assert.equal(s.editableAssetKey, null); assert.equal(s.canRemove, false); assert.equal(s.canAccept, false);
    const output = renderToStaticMarkup(React.createElement(ContextCard, { ...props, card: derived.board.contexts[0], model: { ...model, ...derived, presentation: p } }));
    assert.match(output, /data-state="DERIVED"/); assert.ok(!output.includes('>Modifier</button>')); assert.ok(!output.includes('Retirer de ce moment'));
  });
  await check('R2-005', () => { const unknown = socket('food').satellites[0]; assert.equal(unknown.state, 'UNRESOLVED'); assert.equal(unknown.economicAmount, null);
    assert.match(html(model), /data-state="UNRESOLVED"/); assert.match(fs.readFileSync('src/app/mois-a-venir/composer/context-satellite.tsx','utf8'),/Montant non disponible/); });
  await check('R2-006', () => { const source = ['context-socket.tsx', 'context-satellite.tsx'].map(name => fs.readFileSync(`src/app/mois-a-venir/composer/${name}`, 'utf8')).join('\n');
    assert.ok(!/new Big|parseFloat|\.reduce\(|\.plus\(|\.minus\(/u.test(source)); assert.match(source, /money\(satellite\.economicAmount\)/); });
  await check('R2-007', () => { const output = html(model, id); assert.match(output, new RegExp(`data-context-palette="${id}"`)); assert.match(output, /Équiper · Soirée/); assert.match(output, /data-focused="true"/); });
  await check('R2-008', () => assert.ok(!html(model).includes('data-context-palette')));
  await check('R2-009', () => { assert.ok(socket('outbound').options.some(o => o.state === 'ALTERNATIVE'));
    assert.equal(socket('outbound').options.filter(o => o.state === 'EQUIPPED').length, 1); assert.match(html(model, id), /data-option-state="ALTERNATIVE"/); });
  await check('R2-010', () => { const source = ['context-socket.tsx','context-palette.tsx','context-card.tsx'].map(name => fs.readFileSync(`src/app/mois-a-venir/composer/${name}`, 'utf8')).join('\n');
    assert.ok(!/allowedChildTemplates|bindingPolicy|resolveContextTemplate|REPLACE_ONE_OF|choiceAssetKeys/u.test(source));
    for (const card of model.board.contexts) for (const s of card.sockets) for (const o of model.presentation.sockets[`${card.contextOccurrenceId}:${s.slotKey}`].options) assert.ok(s.choiceAssetKeys.includes(o.assetKey)); });
  await check('R2-011', () => { assert.ok(!/\p{Extended_Pictographic}/u.test(html(model, id))); assert.match(html(model), /data-icon-scale="SATELLITE"/); });
  await check('R2-012', () => { const output = html(model); assert.match(output, /aria-haspopup="dialog"/); assert.match(output, /popover="auto"/);
    const source = fs.readFileSync('src/app/mois-a-venir/composer/atomic-popover.tsx', 'utf8'); assert.match(source, /trigger\.current\?\.focus\(\)/); assert.match(source, /hidePopover\(\)/); });
  await check('R2-013', async () => { assert.ok(!('presentation' in model.semanticState));
    const bad = await handleComposerRequest(deps, householdId, { kind: 'READ', sequence: ++sequence, targetMonth: '2026-11', draft: { ...fixture.semantic, x: 1, y: 2 } });
    assert.equal(bad.ok, false); assert.equal(bad.code, 'PLANNER_FIELDS_INVALID'); assert.equal(pg.rpcCalls, 0);
  });
  await check('R2-MANIFEST-CONSUMPTION', async () => { fixture = weekendMonth(); const m = await read();
    const card = m.board.discretionaryControls.find(c => c.label === 'Restaurants'), stack = m.presentation.objects[card.targetRef].occurrenceStack;
    assert.ok(stack.links.length > 0); assert.ok(stack.bubbles.includes('LINKED'));
    const source = await readMonthComposer(deps, householdId, '2026-11', fixture.semantic);
    assert.deepEqual(stack.links.map(({componentId,count})=>({componentId,count})), source.preview.compiled.financialAdapterInput.adapterManifest.baselineConsumptions.filter(c => c.planSlotId === card.cardId && c.count !== null).map(c => ({ componentId:c.componentId,count:c.count })));
    for (const socket of Object.values(m.presentation.sockets)) for (const satellite of socket.satellites) if (satellite.childContextOccurrenceId) {
      assert.equal(satellite.canRemove, false, 'Child context removal retains its own TRASH owner');
      assert.equal(satellite.editableAssetKey, null, 'Child context cannot become a component through its parent editor');
    }
  });
  await pg.verifyCanaries(); console.log(`R2 atomic UI checks passed (${passed.length}); browser keyboard/focus verification required.`);
} finally { await pg.close(); }
