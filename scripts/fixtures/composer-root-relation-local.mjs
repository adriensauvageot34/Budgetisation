import { rootRelationsFixture } from './planner-root-relations.mjs';
import { uuid, householdId } from './planner-headless.mjs';
import { require } from '../lib/phase2-ts-loader.mjs';
const { readComposerDrafts } = require('@/server/phase2/planner/composer-draft-service');
const { semanticStateDigest } = require('@/domain/phase2/planner/semantic-state');
/** Synthetic auth scope and rows. Real Draft reader, C4 publisher and N1 owner; no RLS engine or network. */
export async function localRelationsFixture() {
  const f = await rootRelationsFixture(), userId = uuid(98901), draftId = uuid(98902), reads = [];
  const row = { draft_id: draftId, owner_user_id: userId, household_id: householdId, target_month: '2026-11-01',
    semantic_state: f.base, semantic_state_digest: semanticStateDigest(f.base), draft_version: 1, lifecycle: 'ACTIVE',
    base_plan_revision_id: null, base_plan_revision_number: 0, last_saved_at: '2026-11-03T09:00:00Z', archived_at: null,
    last_mutation_request_id: uuid(98903), last_mutation_expected_version: 0, last_mutation_kind: 'SAVE' };
  const supabase = { from(table) {
    const filters = []; const query = { select() { return query; }, eq(key, value) { filters.push([key,value]); return query; },
      order() { return query; }, abortSignal() { return query; }, maybeSingle() { return query.then(result => ({ ...result, data: result.data[0] ?? null })); },
      then(resolve, reject) { reads.push({ table, filters }); const rows = table === 'phase2_composer_drafts' ? [row] : table === 'phase2_month_plans' ? [] : null;
        if (!rows) throw Error('N1_UNEXPECTED_TABLE'); return Promise.resolve({ data: rows.filter(item => filters.every(([key,value]) => item[key] === value)), error: null }).then(resolve,reject); } };
    return query;
  } };
  const scope = (overrides = {}) => { const identity = { supabase, userId, householdId, ...overrides };
    return { ...identity, deps: f.deps, editorEnabled: true, readDrafts: month => readComposerDrafts(identity,month), ...overrides }; };
  return { ...f, userId, draftId, row, scope, draftReads: reads, drafts: await readComposerDrafts({supabase,userId,householdId},'2026-11'), frame: { draft: f.base, relations: [] }, binding: { draftId, version: 1 } };
}
