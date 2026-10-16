import { require } from '../lib/phase2-ts-loader.mjs';
import { fixture, state, uuid } from './planner-headless.mjs';
const { presetCreationFields } = require('@/domain/phase2/planner/composer-presets');

/** Deterministic UI-only workload: real Compiler, synthetic owners, no remote IO. */
export function l31Month(dense = false) {
  const world = fixture(), semantic = state();
  semantic.contexts = Array.from({ length: dense ? 24 : 1 }, (_, i) => ({
    contextOccurrenceId: uuid(31001 + i), templateKey: 'purchase', status: 'ACTIVE',
    parentContextOccurrenceId: null, provenance: 'EXPLICIT_USER_DECISION',
    fields: { fieldSchemaVersion: 'context-fields@v2', ...presetCreationFields('purchase', 'amazon-purchase'),
      productLabel: `Article de test L3.1 ${i + 1}` }, slotSelections: {},
  }));
  return { world, semantic };
}
