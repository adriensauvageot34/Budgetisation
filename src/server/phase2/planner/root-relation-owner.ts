import "server-only";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { plannerDigestString, plannerKeys, plannerMonth, plannerRecord, plannerUuid } from "@/domain/phase2/planner/json";
import { semanticStateDigest } from "@/domain/phase2/planner/semantic-state";
import { ROOT_RELATION_CAPABILITIES_VERSION, ROOT_RELATION_VERSION, RootRelationError,
  type RootContextRelationV1, type RootRelationAction, type RootRelationCapabilities, type RootRelationCapability,
  type RootRelationCommand, type RootRelationErrorCode, type RootRelationPlanState } from "@/domain/phase2/planner/root-relation-contract";
import { assertRootRelationMember, parseRootRelationPlanState, rootRelationBaseState, rootRelationMemberIds,
  rootRelationStateDigest } from "@/domain/phase2/planner/root-relation-state";
import { validateContextGraph } from "./context-selections";

/** Trusted caller supplies a server-read model and an explicit N1 grant. Never trust UI JSON as this authority.
 * No HTTP/RLS integration is installed in N1-A; fixture grants are not authenticated permissions. */
export type RootRelationAuthority = Readonly<{ canManageRelations: boolean; model: ComposerUiModel }>;
const actions: readonly RootRelationAction[] = ["ADD_ROOT_RELATION_MEMBER", "REORDER_ROOT_RELATION", "DETACH_ROOT_RELATION_MEMBER", "REMOVE_ROOT_RELATION"];
function prepare(raw: RootRelationPlanState, authority: RootRelationAuthority) {
  const state = parseRootRelationPlanState(raw), base = rootRelationBaseState(state), model = authority.model;
  if (model.board.targetMonth !== base.targetMonth || model.semanticState.targetMonth !== base.targetMonth)
    throw new RootRelationError("N1_SCOPE_MISMATCH");
  if (semanticStateDigest(model.semanticState) !== semanticStateDigest(base)) throw new RootRelationError("N1_AUTHORITY_STALE");
  validateContextGraph(base);
  const memberRefusal = (id: string): RootRelationErrorCode | null => {
    try { assertRootRelationMember(base, id); } catch (error) {
      if (error instanceof RootRelationError) return error.code; throw error;
    }
    if (base.preferences.flexibility[id] === "PRESERVE" || base.preferences.anchors.includes(id)) return "N1_MEMBER_PRESERVED";
    if (!model.board.contexts.find(c => c.contextOccurrenceId === id)?.capabilityRefs.includes("PATCH_CONTEXT")) return "N1_MEMBER_PERMISSION_DENIED";
    return null;
  };
  const linked = new Set(state.rootRelations.flatMap(r => r.orderedContextIds));
  const eligible = base.contexts.filter(c => !linked.has(c.contextOccurrenceId) && !memberRefusal(c.contextOccurrenceId))
    .map(c => c.contextOccurrenceId);
  return { state, memberRefusal, linked, eligible };
}

/** One owner publishes capabilities and enforces the very same admission at execution. */
export function publishRootRelationCapabilities(raw: RootRelationPlanState, authority: RootRelationAuthority): RootRelationCapabilities {
  const { state, memberRefusal, eligible } = prepare(raw, authority);
  const capability = (action: RootRelationAction, relationId: string | null, refusal: RootRelationErrorCode | null): RootRelationCapability => {
    const reason = authority.canManageRelations === true ? refusal : "N1_PERMISSION_DENIED";
    return { action, relationId, status: reason ? "BLOCKED" : "AVAILABLE", reason, eligibleContextIds: authority.canManageRelations === true ? eligible : [] };
  };
  return { version: ROOT_RELATION_CAPABILITIES_VERSION, targetMonth: state.targetMonth, stateDigest: rootRelationStateDigest(state),
    capabilities: [capability("CREATE_ROOT_RELATION", null, eligible.length < 2 ? "N1_NO_ELIGIBLE_MEMBERS" : null),
      ...state.rootRelations.flatMap(relation => {
        const refusal = relation.orderedContextIds.map(memberRefusal).find(reason => reason !== null) ?? null;
        return actions.map(action => capability(action, relation.relationId,
          refusal ?? (action === "ADD_ROOT_RELATION_MEMBER" && !eligible.length ? "N1_NO_ELIGIBLE_MEMBERS" : null)));
      })] };
}

/** Pure, atomic relation mutations. Contexts, selections, preferences and prices are never rewritten.
 * Unique membership follows Master 7.3. Detach below two members dissolves only the relation. */
export function admitRootRelationMutation(raw: RootRelationPlanState, command: RootRelationCommand,
  authority: RootRelationAuthority): RootRelationPlanState {
  const { state, memberRefusal, linked } = prepare(raw, authority);
  const request = plannerRecord(command);
  plannerKeys(request, ["targetMonth", "expectedStateDigest", "mutation"]);
  if (plannerMonth(request.targetMonth) !== state.targetMonth) throw new RootRelationError("N1_SCOPE_MISMATCH");
  if (authority.canManageRelations !== true) throw new RootRelationError("N1_PERMISSION_DENIED");
  if (plannerDigestString(request.expectedStateDigest) !== rootRelationStateDigest(state)) throw new RootRelationError("N1_STATE_STALE");
  const mutation = plannerRecord(request.mutation), kind = mutation.kind;
  if (kind !== "CREATE_ROOT_RELATION" && !actions.includes(kind as RootRelationAction)) throw new RootRelationError("N1_OPERATION_UNSUPPORTED");
  const orderAction = kind === "CREATE_ROOT_RELATION" || kind === "REORDER_ROOT_RELATION";
  const memberAction = kind === "ADD_ROOT_RELATION_MEMBER" || kind === "DETACH_ROOT_RELATION_MEMBER";
  plannerKeys(mutation, ["kind", "relationId", ...(orderAction ? ["orderedContextIds"] : memberAction ? ["contextOccurrenceId"] : [])]);
  const relationId = plannerUuid(mutation.relationId), existing = state.rootRelations.find(r => r.relationId === relationId);
  if (kind === "CREATE_ROOT_RELATION" && existing) throw new RootRelationError("N1_RELATION_ID_DUPLICATE");
  if (kind !== "CREATE_ROOT_RELATION" && !existing) throw new RootRelationError("N1_RELATION_NOT_FOUND");
  const checkMember = (id: string) => { const reason = memberRefusal(id); if (reason) throw new RootRelationError(reason); };
  existing?.orderedContextIds.forEach(checkMember);
  let replacement: RootContextRelationV1 | null;
  if (kind === "CREATE_ROOT_RELATION") {
    const orderedContextIds = rootRelationMemberIds(mutation.orderedContextIds);
    for (const id of orderedContextIds) { checkMember(id); if (linked.has(id)) throw new RootRelationError("N1_MEMBER_ALREADY_LINKED"); }
    replacement = { version: ROOT_RELATION_VERSION, relationId, targetMonth: state.targetMonth, orderedContextIds, provenance: "EXPLICIT_USER_DECISION" };
  } else if (kind === "REORDER_ROOT_RELATION") {
    const orderedContextIds = rootRelationMemberIds(mutation.orderedContextIds);
    if (orderedContextIds.length !== existing!.orderedContextIds.length || orderedContextIds.some(id => !existing!.orderedContextIds.includes(id)))
      throw new RootRelationError("N1_ORDER_INVALID");
    replacement = { ...existing!, orderedContextIds };
  } else if (memberAction) {
    const id = plannerUuid(mutation.contextOccurrenceId);
    if (kind === "ADD_ROOT_RELATION_MEMBER") {
      checkMember(id);
      if (linked.has(id)) throw new RootRelationError("N1_MEMBER_ALREADY_LINKED");
      replacement = { ...existing!, orderedContextIds: [...existing!.orderedContextIds, id] };
    } else {
      if (!existing!.orderedContextIds.includes(id)) throw new RootRelationError("N1_MEMBER_NOT_IN_RELATION");
      const orderedContextIds = existing!.orderedContextIds.filter(member => member !== id);
      replacement = orderedContextIds.length < 2 ? null : { ...existing!, orderedContextIds };
    }
  } else replacement = null;
  return parseRootRelationPlanState({ ...state,
    rootRelations: [...state.rootRelations.filter(r => r.relationId !== relationId), ...(replacement ? [replacement] : [])] });
}
