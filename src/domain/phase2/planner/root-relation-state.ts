import { plannerDigest, plannerKeys, plannerMonth, plannerRecord, plannerUuid } from "./json";
import { PLAN_SEMANTIC_STATE_VERSION, parsePlanSemanticState, type PlanSemanticStateV1 } from "./semantic-state";
import { presetForContext } from "./composer-presets";
import { ROOT_RELATION_PLAN_VERSION, ROOT_RELATION_PRESETS, ROOT_RELATION_VERSION, RootRelationError,
  type RootContextRelationV1, type RootRelationPlanState } from "./root-relation-contract";

const baseKeys = ["version", "targetMonth", "controls", "contexts", "preferences"];
function denseArray(raw: unknown, code: "N1_MEMBERS_INVALID" | "N1_RELATIONS_INVALID"): readonly unknown[] {
  if (!Array.isArray(raw) || raw.length > 500 || Array.from({ length: raw.length }, (_, i) => i).some(i => !Object.hasOwn(raw, i)))
    throw new RootRelationError(code);
  return raw;
}
export function rootRelationMemberIds(raw: unknown): readonly string[] {
  const ids = denseArray(raw, "N1_MEMBERS_INVALID").map(plannerUuid);
  if (ids.length < 2) throw new RootRelationError("N1_MEMBERS_INVALID");
  if (new Set(ids).size !== ids.length) throw new RootRelationError("N1_MEMBER_DUPLICATE");
  return ids;
}
/** Read-only base projection, not a downgrade for Save/Apply. No caller writes it remotely. */
export function rootRelationBaseState(state: RootRelationPlanState): PlanSemanticStateV1 {
  return parsePlanSemanticState({ version: PLAN_SEMANTIC_STATE_VERSION, targetMonth: state.targetMonth,
    controls: state.controls, contexts: state.contexts, preferences: state.preferences });
}
export function assertRootRelationMember(base: PlanSemanticStateV1, id: string): void {
  const context = base.contexts.find(c => c.contextOccurrenceId === id);
  if (!context) throw new RootRelationError("N1_MEMBER_NOT_FOUND");
  if (context.parentContextOccurrenceId) throw new RootRelationError("N1_MEMBER_IS_CHILD");
  if (context.templateKey !== "night-out" || !ROOT_RELATION_PRESETS.includes(presetForContext(context)?.presetKey ?? ""))
    throw new RootRelationError("N1_MEMBER_NOT_ADMITTED");
  if (typeof context.fields.plannedDate === "string" && !context.fields.plannedDate.startsWith(`${base.targetMonth}-`))
    throw new RootRelationError("N1_SCOPE_MISMATCH");
}

/** Strict N1 reader. Structural admission never silently drops an orphan or changes member order. */
export function parseRootRelationPlanState(raw: unknown): RootRelationPlanState {
  const value = plannerRecord(raw);
  if (value.version !== ROOT_RELATION_PLAN_VERSION) throw new RootRelationError("N1_STATE_VERSION_UNSUPPORTED");
  plannerKeys(value, [...baseKeys, "rootRelations"]);
  const { rootRelations: rawRelations, ...baseValue } = value;
  const base = parsePlanSemanticState({ ...baseValue, version: PLAN_SEMANTIC_STATE_VERSION });
  const relationIds = new Set<string>(), membership = new Set<string>();
  const rootRelations = denseArray(rawRelations, "N1_RELATIONS_INVALID").map(rawRelation => {
    const relation = plannerRecord(rawRelation);
    if (relation.version !== ROOT_RELATION_VERSION) throw new RootRelationError("N1_RELATION_VERSION_UNSUPPORTED");
    plannerKeys(relation, ["version", "relationId", "targetMonth", "orderedContextIds", "provenance"]);
    const relationId = plannerUuid(relation.relationId), targetMonth = plannerMonth(relation.targetMonth);
    if (relationIds.has(relationId)) throw new RootRelationError("N1_RELATION_ID_DUPLICATE");
    if (base.contexts.some(c => c.contextOccurrenceId === relationId)) throw new RootRelationError("N1_RELATION_ID_COLLIDES_WITH_CONTEXT");
    relationIds.add(relationId);
    if (targetMonth !== base.targetMonth) throw new RootRelationError("N1_SCOPE_MISMATCH");
    if (relation.provenance !== "EXPLICIT_USER_DECISION") throw new RootRelationError("N1_PROVENANCE_INVALID");
    const orderedContextIds = rootRelationMemberIds(relation.orderedContextIds);
    for (const id of orderedContextIds) {
      assertRootRelationMember(base, id);
      if (membership.has(id)) throw new RootRelationError("N1_MEMBER_ALREADY_LINKED");
      membership.add(id);
    }
    return { version: ROOT_RELATION_VERSION, relationId, targetMonth, orderedContextIds,
      provenance: "EXPLICIT_USER_DECISION" } satisfies RootContextRelationV1;
  }).sort((a, b) => a.relationId.localeCompare(b.relationId));
  return { ...base, version: ROOT_RELATION_PLAN_VERSION, rootRelations };
}

/** Explicit, deterministic local conversion. The V1 reader/digest/transport remain unchanged. */
export function upgradePlanForRootRelations(raw: unknown): RootRelationPlanState {
  const base = parsePlanSemanticState(raw);
  return parseRootRelationPlanState({ ...base, version: ROOT_RELATION_PLAN_VERSION, rootRelations: [] });
}
/** Compatibility entry point for local N1 tools, never installed in existing durable transports. */
export function readRootRelationPlanState(raw: unknown): RootRelationPlanState {
  return plannerRecord(raw).version === PLAN_SEMANTIC_STATE_VERSION
    ? upgradePlanForRootRelations(raw) : parseRootRelationPlanState(raw);
}
export const serializeRootRelationPlanState = (state: RootRelationPlanState): string => JSON.stringify(parseRootRelationPlanState(state));
export const rootRelationStateDigest = (state: RootRelationPlanState): string => plannerDigest(parseRootRelationPlanState(state));
