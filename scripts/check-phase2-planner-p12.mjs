import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { fixture, state, uuid, householdId } from './fixtures/planner-headless.mjs';

const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { publishContextRegistry } = require('@/server/phase2/planner/context-registry');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { stageLocalDecision } = require('@/app/mois-a-venir/composer/local-draft');
const { AppliedMonthView } = require('@/app/mois-a-venir/applied-month-view');
const { CatalogContextEditor } = require('@/app/mois-a-venir/composer/catalog-context-editor');
const { parsePlanSemanticState } = require('@/domain/phase2/planner/semantic-state');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const pg = await createKernelPostgres(), world = fixture(), original = structuredClone(world);
globalThis.fetch = async () => { throw Error('P12_REMOTE_NETWORK_FORBIDDEN'); };
const deps = { repository: createPlanApplyRepository(pg.client), readWorld: async () => world,
  readDirectWorld: async () => ({ forecast: world.forecast, monthInputs: world.monthInputs,
    externalIntents: world.externalIntents, asOfDate: world.asOfDate }),
  householdPersons: [{ personId: uuid(900), displayName: 'Personne fixture' }],
  validateContextReferences: async (_household, refs) => {
    if (refs.personIds.some(id => id !== uuid(900)) || refs.placeIds.length) throw TypeError('CONTEXT_REFERENCE_NOT_ADMITTED');
  } };
let sequence = 0, identity = 12000;
const request = (operation, draft) => handleComposerRequest(deps, householdId,
  { sequence: ++sequence, targetMonth: '2026-11', draft, ...operation });
const ok = result => { assert.equal(result.ok, true, `${result.code}: ${result.message}`); return result.model; };
const drop = (assetKey, target, values = {}) => ({ kind: 'DROP', assetKey, target,
  identity: uuid(identity++), selectionId: uuid(identity++), values });
const pass = name => console.log(`${name} PASS`);

try {
  const registry = publishContextRegistry(), initial = ok(await request({ kind: 'READ' }, state()));
  const options = registry.templates.flatMap(template => template.componentSlots.flatMap(slot => slot.options.map(option =>
    ({ template: template.templateKey, slot: slot.slotKey, option: option.optionKey, kind: option.kind }))));
  assert.equal(registry.templates.length, 13);
  assert.equal(new Set(registry.templates.map(template => template.family)).size, 9);
  assert.equal(options.length, 114); // 113 historical options plus the P11 stay extra.
  assert.equal(initial.library.searchableAssets.filter(asset => asset.kind === 'CONTEXT_ASSET').length, 13);
  assert.equal(initial.library.searchableAssets.filter(asset => asset.kind === 'SLOT_OPTION_ASSET').length, 114);
  const controls = [...initial.board.baselineControls, ...initial.board.discretionaryControls, ...initial.board.savings];
  const simpleDomains = ['groceries', 'tobacco-vape', 'adrien-work-meals', 'manon-work-meals',
    'restaurants', 'fast-food', 'delivery', 'clothing', 'home-small', 'games-digital'];
  for (const domain of simpleDomains) assert.ok(controls.some(card =>
    card.slotIdentityKey?.includes(domain) || card.targetRef?.includes(domain)), domain);
  pass('P12-INVENTORY-13-9-114-10');

  const optionResults = [];
  for (const template of registry.templates) {
    const contextId = uuid(identity), created = ok(await request(drop(`template:${template.templateKey}`, { kind: 'BOARD_ZONE' }), state()));
    assert.equal(created.semanticState.contexts[0].contextOccurrenceId, contextId);
    assert.equal(created.board.contexts[0].templateKey, template.templateKey);
    const editor = created.editors.find(item => item.assetKey === `template:${template.templateKey}`);
    assert.ok(editor, template.templateKey);
    for (const field of template.fields.filter(field => !['fieldSchemaVersion', 'PLANNED_ASSET_REF'].includes(field.fieldKey)
      && field.kind !== 'PLANNED_ASSET_REF')) assert.ok(editor.fields.some(item => item.key === field.fieldKey), `${template.templateKey}:${field.fieldKey}`);
    assert.deepEqual(stageLocalDecision(initial, state(), { kind: 'DROP', assetKey: `template:${template.templateKey}`,
      target: { kind: 'BOARD_ZONE' }, identity: contextId, selectionId: uuid(identity - 1), values: {} }), created.semanticState);
    const configured = ok(await request({ kind: 'EDIT_CONTEXT', contextOccurrenceId: contextId,
      values: { label: `Moment P12 ${template.templateKey}` } }, created.semanticState));
    assert.equal(configured.semanticState.contexts[0].fields.label, `Moment P12 ${template.templateKey}`);
    assert.equal(configured.semanticState.contexts[0].contextOccurrenceId, contextId);
    for (const slot of template.componentSlots) for (const option of slot.options) {
      const assetKey = `option:${template.templateKey}:${slot.slotKey}:${option.optionKey}`;
      assert.ok(created.library.searchableAssets.some(asset => asset.assetKey === assetKey), assetKey);
      const operation = drop(assetKey, { kind: 'CONTEXT_SOCKET', contextOccurrenceId: contextId, slotKey: slot.slotKey },
        option.kind === 'COMPONENT' ? { quantity: '1', amount: '1' } : {});
      const result = await request(operation, configured.semanticState);
      assert.equal(result.ok, true, `${assetKey}: ${result.code}: ${result.message}`);
      const selected = result.model.semanticState.contexts[0].slotSelections[slot.slotKey].items[0];
      assert.equal(selected.optionKey, option.optionKey);
      assert.equal(selected.kind, option.kind);
      assert.equal(selected.provenance, 'EXPLICIT_USER_DECISION');
      assert.equal(result.model.semanticState.contexts[0].fields.label, `Moment P12 ${template.templateKey}`);
      assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(result.model.semanticState))), result.model.semanticState);
      const updated = await request({ ...operation, values: option.kind === 'COMPONENT'
        ? { label: `Édition ${option.optionKey}`, quantity: '2', amount: '2' } : { returnRequired: 'true' } }, result.model.semanticState);
      assert.equal(updated.ok, true, `${assetKey} edit: ${updated.code}: ${updated.message}`);
      const edited = updated.model.semanticState.contexts[0].slotSelections[slot.slotKey].items[0];
      assert.equal(edited.selectionId, operation.selectionId);
      assert.equal(edited.optionKey, option.optionKey);
      if (option.kind === 'COMPONENT') { assert.equal(edited.label, `Édition ${option.optionKey}`); assert.equal(edited.cost.unitAmount, '2'); }
      else assert.equal(edited.returnRequired, true);
      assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(updated.model.semanticState))), updated.model.semanticState);
      optionResults.push(assetKey);
    }
  }
  assert.equal(optionResults.length, options.length);
  pass('P12-ALL-PUBLISHED-OPTIONS-DROP-PREVIEW-ROUNDTRIP');

  const activity = ok(await request(drop('template:activity', { kind: 'BOARD_ZONE' }), state()));
  const activityId = activity.semanticState.contexts[0].contextOccurrenceId;
  const target = { kind: 'CONTEXT_SOCKET', contextOccurrenceId: activityId, slotKey: 'main' };
  const itemOperation = drop('option:activity:main:activity', target,
    { label: 'Activité fixture', amount: '12', quantity: '1', unitBasis: 'ITEM', funding: 'BANK', fundingAmount: '12' });
  const equipped = ok(await request(itemOperation, activity.semanticState));
  const changed = ok(await request({ ...itemOperation, values: { amount: '15', quantity: '1' } }, equipped.semanticState));
  const item = changed.semanticState.contexts[0].slotSelections.main.items[0];
  assert.equal(item.label, 'Activité fixture'); assert.equal(item.selectionId, itemOperation.selectionId);
  assert.equal(item.cost.unitAmount, '15'); assert.equal(item.fundingAllocations[0].amount, '12');
  assert.equal(item.unitBasis, 'ITEM');
  assert.equal((await request({ ...itemOperation, values: { amount: '15', quantity: '1', funding: 'SWILE', fundingAmount: '15' } },
    equipped.semanticState)).ok, false);
  const perPerson = ok(await request({ ...itemOperation, values: { amount: '5', unitBasis: 'PERSON', quantity: '2', personCount: '3' } },
    equipped.semanticState));
  const counted = perPerson.semanticState.contexts[0].slotSelections.main.items[0];
  assert.equal(counted.quantity, '6'); assert.equal(counted.quantityPerPerson, '2'); assert.equal(counted.pricedParticipantCount, 3);
  pass('P12-PARTIAL-COMPONENT-EDIT-QUANTITY-FUNDING-GATE');

  const transport = { kind: 'CONTEXT_SOCKET', contextOccurrenceId: activityId, slotKey: 'transport' };
  const taxiOperation = drop('option:activity:transport:taxi', transport,
    { amount: '20', funding: 'BANK', fundingAmount: '20', origin: 'Départ fixture', destination: 'Arrivée fixture' });
  const taxi = ok(await request(taxiOperation, changed.semanticState));
  const train = ok(await request({ ...taxiOperation, assetKey: 'option:activity:transport:train', values: {} }, taxi.semanticState));
  const journey = train.semanticState.contexts[0].slotSelections.transport.items[0];
  assert.equal(journey.optionKey, 'train'); assert.equal(journey.pricing.fare.kind, 'UNKNOWN');
  assert.deepEqual(journey.pricing.fundingAllocations, []); assert.equal(journey.route, undefined);
  assert.equal(journey.origin.label, 'Départ fixture'); assert.equal(journey.destination.label, 'Arrivée fixture');
  pass('P12-TRANSPORT-REPLACEMENT-DROPS-OLD-PRICE');

  const base = ok(await request(drop('template:friend-visit', { kind: 'BOARD_ZONE' }), state()));
  const contextId = base.semanticState.contexts[0].contextOccurrenceId;
  const enriched = ok(await request({ kind: 'EDIT_CONTEXT', contextOccurrenceId: contextId,
    values: { label: 'Visite amie', personVisitedRef: { kind: 'TEXT', label: 'Amie fixture' },
      participantRefs: [{ kind: 'HOUSEHOLD_PERSON', personId: uuid(900) }], placeRef: { kind: 'TEXT', label: 'Village fixture' },
      timingNote: 'Quand possible', plannedDate: null } }, base.semanticState));
  const edit = ok(await request({ kind: 'EDIT_CONTEXT', contextOccurrenceId: contextId,
    values: { timingNote: 'Après-midi' } }, enriched.semanticState));
  const visited = edit.semanticState.contexts[0];
  assert.equal(visited.fields.personVisitedRef.label, 'Amie fixture');
  assert.equal(visited.fields.participantRefs[0].personId, uuid(900));
  assert.equal(visited.fields.placeRef.label, 'Village fixture');
  assert.equal(visited.fields.plannedDate, null);
  assert.equal(visited.fields.timingNote, 'Après-midi');
  const editorHtml = renderToStaticMarkup(React.createElement(CatalogContextEditor, { context: visited,
    editor: edit.editors.find(candidate => candidate.assetKey === 'template:friend-visit'), targetMonth: '2026-11',
    householdPersons: deps.householdPersons, knowledge: edit.cardKnowledge['template:friend-visit'],
    busy: false, onSave: () => {}, onCancel: () => {} }));
  // V5 starts on a summary. Structured values are retained above; their inputs
  // are intentionally rendered only when their focused question is opened.
  for (const expected of ['data-catalog-context-editor', 'data-catalog-summary', 'Visite amie', 'Choisissez uniquement'])
    assert.ok(editorHtml.includes(expected), expected);
  const locallyEdited = stageLocalDecision(enriched, enriched.semanticState, { kind: 'EDIT_CONTEXT',
    contextOccurrenceId: contextId, values: { timingNote: 'Après-midi' } });
  assert.deepEqual(locallyEdited, edit.semanticState);
  assert.deepEqual(parsePlanSemanticState(JSON.parse(JSON.stringify(enriched.semanticState))), enriched.semanticState);
  assert.equal((await request({ kind: 'EDIT_CONTEXT', contextOccurrenceId: contextId,
    values: { placeRef: { kind: 'KNOWN', placeId: uuid(999) } } }, edit.semanticState)).ok, false);
  pass('P12-STRUCTURED-PARTIAL-PATCH-UNKNOWN-REFERENCE');

  const applied = ok(await request({ kind: 'APPLY', command: { ...edit.proof, applyRequestId: uuid(identity++) } }, edit.semanticState));
  assert.equal(applied.activeRevisionNumber, 1);
  const stored = await deps.repository.readActivePlan(householdId, '2026-11');
  assert.deepEqual(stored.activeRevision.semanticState, edit.semanticState);
  const reloaded = ok(await request({ kind: 'READ' }));
  assert.deepEqual(reloaded.semanticState, edit.semanticState);
  const html = renderToStaticMarkup(React.createElement(AppliedMonthView, { projection: applied.board.cockpit,
    semanticState: reloaded.semanticState, revision: 1, plan: null, today: world.asOfDate, persons: deps.householdPersons }));
  // B2 unified the persisted Context reader under data-plan-context.
  for (const expected of ['data-plan-context', 'Visite amie', 'Amie fixture', 'Personne fixture', 'Village fixture', 'Après-midi'])
    assert.ok(html.includes(expected), expected);
  pass('P12-APPLY-RELOAD-MON-PLAN-PGLITE');
  assert.deepEqual(world, original); await pg.verifyCanaries();
  pass('P12-NO-OTHER-OWNER-WRITES');
  if (process.env.P12_CATALOG_INVENTORY) writeFileSync(process.env.P12_CATALOG_INVENTORY, JSON.stringify({
    sourceRegistry: registry.version, limitation: 'PGLite synthetic contract tests; no authenticated or browser run',
    templates: registry.templates.map(template => ({ identity: `template:${template.templateKey}`, owner: 'Composer semantic Draft / PlanRevision',
      family: template.family, fields: template.fields.map(field => ({ name: field.fieldKey, kind: field.kind })),
      slots: template.componentSlots.map(slot => ({ name: slot.slotKey, cardinality: slot.cardinality, children: slot.allowedChildTemplates })),
      creation: 'TESTED', edition: 'TESTED_CONTRACT', capabilities: 'PUBLISHED', preview: 'TESTED_PGLITE',
      applyReload: template.templateKey === 'friend-visit' ? 'TESTED_PGLITE' : 'UNIFORM_CONTRACT_NOT_RUN_PER_TEMPLATE',
      monPlan: 'RENDERED_BY_APPLIED_MONTH_VIEW', status: 'PARTIAL' })),
    options: options.map(option => ({ identity: `option:${option.template}:${option.slot}:${option.option}`,
      owner: 'Composer semantic Draft / PlanRevision', family: registry.templates.find(template => template.templateKey === option.template).family,
      kind: option.kind, creation: 'TESTED', edition: 'TESTED', capabilities: 'PUBLISHED', preview: 'TESTED_PGLITE',
      serialization: 'TESTED', applyReload: 'NOT_RUN_PER_OPTION', monPlan: 'RENDERED_BY_APPLIED_MONTH_VIEW', status: 'PARTIAL' })),
    controls: controls.map(card => {
      return { identity: card.targetRef, label: card.label, owner: 'Finance V2 plan slot',
        kind: card.kind, creation: 'PUBLISHED_BY_OWNER', edition: card.capability?.actions.length ? 'PUBLISHED' : 'LOCKED_OR_STRUCTURAL',
        preview: 'FINANCE_V2', applyReload: 'UNIFORM_CONTRACT', monPlan: 'APPLIED_CONTROL',
        status: card.capability?.actions.length ? 'PARTIAL' : 'READ_ONLY' }; }),
  }, null, 2));
  console.log(JSON.stringify({ status: 'EXECUTED_PASS_PGLITE_SYNTHETIC_ONLY', templates: registry.templates.length,
    families: 9, publishedOptions: optionResults.length, simpleDomains: simpleDomains.length,
    applyRpcCalls: pg.rpcCalls, authenticated: 'NOT_RUN', browser: 'NOT_RUN', externalProviders: 'NOT_RUN' }));
} finally { await pg.close(); }
