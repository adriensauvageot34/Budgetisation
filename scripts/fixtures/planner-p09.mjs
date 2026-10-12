import { fixture, state, uuid } from './planner-headless.mjs';

/** Synthetic decisions only. Includes legacy and exploratory values that must survive unrelated edits. */
export function p09CompatibilityMonth() {
  const item = (number, optionKey, label, quantity, amount, extra = {}) => ({
    selectionId: uuid(number), optionKey, kind: 'COMPONENT', provenance: 'EXPLICIT_USER_DECISION',
    label, quantity, cost: { kind: 'MANUAL', unitAmount: amount }, fundingAllocations: [], ...extra,
  });
  const parent = uuid(9960), before = uuid(9961);
  return { world: fixture(), semantic: state([], [
    { contextOccurrenceId: parent, templateKey: 'night-out', status: 'ACTIVE', parentContextOccurrenceId: null,
      provenance: 'EXPLICIT_USER_DECISION', fields: { fieldSchemaVersion: 'context-fields@v2', label: 'Soirée compatibilité P09',
        plannedDate: null, endDate: null, placeRef: null, timingNote: null,
        participantRefs: [{ kind: 'TEXT', label: 'Moi fixture' }, { kind: 'TEXT', label: 'Compagne fixture' }] },
      slotSelections: { main: { items: [item(9962, 'main', 'Entrée gratuite', '1', '0')] },
        before: { items: [{ selectionId: uuid(9963), optionKey: 'activity', kind: 'CHILD_CONTEXT',
          childContextOccurrenceId: before, provenance: 'EXPLICIT_USER_DECISION' }] },
        extras: { items: [item(9964, 'extra', 'Verres antérieurs', '2', '5', { unitBasis: 'PERSON' }),
          item(9965, 'extra', 'Proposition historique non retenue', '1', '100', { provenance: 'PERSONAL_SUGGESTION' }),
          item(9966, 'extra', 'Vestiaire', '1', '3'), item(9972, 'extra', 'Bouteilles partagées antérieures', '2', '10', { unitBasis: 'SHARED' })] },
        return: { items: [{ selectionId: uuid(9967), optionKey: 'unknown', kind: 'MOBILITY_INTENT',
          provenance: 'EXPLICIT_USER_DECISION', origin: null, destination: null,
          pricing: { fare: { kind: 'UNKNOWN' }, fundingAllocations: [] } }] } } },
    { contextOccurrenceId: before, templateKey: 'activity', status: 'ACTIVE', parentContextOccurrenceId: parent,
      provenance: 'EXPLICIT_USER_DECISION', fields: { fieldSchemaVersion: 'context-fields@v2', label: 'Before', plannedDate: null },
      slotSelections: { main: { items: [item(9968, 'activity', 'Bouteille de vodka', '1', '20')] },
        extras: { items: [item(9969, 'extra', 'Diluant', '2', '3')] } } },
  ]) };
}

/** Reader verification seed; never presented as UI creation or authenticated data. */
export function p09ReadbackMonth() {
  const result = p09CompatibilityMonth(), parent = result.semantic.contexts.find(c => c.templateKey === 'night-out');
  parent.fields.label = 'Soirée relecture P09';
  const leg = (number, mode, from, to, fare) => ({ selectionId: uuid(number), optionKey: mode, kind: 'MOBILITY_INTENT',
    provenance: 'EXPLICIT_USER_DECISION', origin: {kind:'TEXT',label:from}, destination: {kind:'TEXT',label:to},
    returnRequired: false, pricing: {fare:{kind:'MANUAL',unitAmount:fare},fundingAllocations:[{source:'BANK',amount:fare}]} });
  parent.slotSelections.outbound = { items: [leg(9970, 'train', 'Maison fixture', 'Centre-ville fixture', '4')] };
  parent.slotSelections.return = { items: [leg(9971, 'bus', 'Centre-ville fixture', 'Maison fixture', '2')] };
  return result;
}
