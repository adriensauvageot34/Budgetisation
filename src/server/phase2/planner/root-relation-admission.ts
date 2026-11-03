import "server-only";
import { plannerInteger, plannerKeys, plannerMonth, plannerRecord, plannerString, plannerUuid } from "@/domain/phase2/planner/json";
import type { ComposerDraftSnapshot } from "@/domain/phase2/planner/composer-draft-contract";
import { assertRootRelationDraftAuthority, composerLocalFrameDigest, financialAuthorityToken, guardRootMemberTransition, parseComposerLocalFrame,
  rootRelationDocument, type ComposerLocalFrame } from "@/domain/phase2/planner/root-relation-local";
import type { RootRelationResponse } from "@/domain/phase2/planner/root-relation-ui-contract";
import type { RootRelationMutation } from "@/domain/phase2/planner/root-relation-contract";
import { RootRelationError } from "@/domain/phase2/planner/root-relation-contract";
import { rootRelationMemberIds } from "@/domain/phase2/planner/root-relation-state";
import { semanticStateDigest } from "@/domain/phase2/planner/semantic-state";
import type { PlannerDependencies } from "./apply";
import { handleComposerRequest } from "./composer-service";
import { admitRootRelationMutation, publishRootRelationCapabilities } from "./root-relation-owner";
import { composerRootRelationsEnabled } from "./root-relation-cutover";

/** Supplied ONLY by authenticated server scope. No client user/household/model/grant accepted. */
export type RootRelationServerScope = Readonly<{ userId: string; householdId: string; editorEnabled: boolean;
  deps: PlannerDependencies; readDrafts(month: string): Promise<ComposerDraftSnapshot> }>;

export async function handleRootRelationRequest(scope: RootRelationServerScope, raw: unknown): Promise<RootRelationResponse> {
  if (!composerRootRelationsEnabled()) throw new TypeError("N1_DISABLED");
  const request = plannerRecord(raw), kind = request.kind;
  if (!["READ", "MUTATE", "RESTORE"].includes(String(kind))) throw new TypeError("N1_OPERATION_UNSUPPORTED");
  plannerKeys(request, ["kind", "sequence", "targetMonth", "binding", "frame", ...(kind === "READ" ? []
    : ["authorityToken", "expectedStateDigest", kind === "MUTATE" ? "mutation" : "proposed"])]);
  const sequence = plannerInteger(request.sequence), month = plannerMonth(request.targetMonth), binding = plannerRecord(request.binding);
  plannerKeys(binding, ["draftId", "version"]);
  const draftId = plannerUuid(binding.draftId), version = plannerInteger(binding.version, 1);
  plannerUuid(scope.userId); plannerUuid(scope.householdId);
  if (!scope.editorEnabled) throw new TypeError("N1_PERMISSION_DENIED");
  // Existing private Draft read is scoped by user, household, month and RLS. An absent row grants nothing.
  const drafts = await scope.readDrafts(month);
  if (!drafts.active || drafts.active.draftId !== draftId) throw new TypeError("N1_DRAFT_ACCESS_DENIED");
  if (drafts.active.version !== version || drafts.baseStale) throw new TypeError("N1_DRAFT_VERSION_CHANGED");
  const frame = parseComposerLocalFrame(request.frame);
  if (frame.draft.targetMonth !== month) throw new TypeError("N1_SCOPE_MISMATCH");
  const trusted = drafts.active.semanticState;
  const savedIds = new Set(trusted.contexts.map(context => context.contextOccurrenceId));
  const assertSavedMembers = (ids: readonly string[]) => {
    if (ids.some(id => !savedIds.has(id))) throw new RootRelationError("N1_MEMBER_REQUIRES_SAVED_CONTEXT");
  };
  assertRootRelationDraftAuthority(trusted, frame.draft);
  assertSavedMembers(frame.relations.flatMap(relation => relation.orderedContextIds));
  const sourceDigest = composerLocalFrameDigest(frame);
  const trustedResponse = await handleComposerRequest(scope.deps, scope.householdId,
    { kind: "READ", sequence, targetMonth: month, draft: trusted });
  if (!trustedResponse.ok) throw new TypeError(trustedResponse.code);
  const trustedToken = financialAuthorityToken(trustedResponse.model);
  const writableSavedIds = new Set(trustedResponse.model.board.contexts
    .filter(context => savedIds.has(context.contextOccurrenceId) && context.capabilityRefs.includes("PATCH_CONTEXT"))
    .map(context => context.contextOccurrenceId));
  const authorityFor = async (candidate: ComposerLocalFrame) => {
    assertRootRelationDraftAuthority(trusted, candidate.draft);
    assertSavedMembers(candidate.relations.flatMap(relation => relation.orderedContextIds));
    const response = semanticStateDigest(candidate.draft) === semanticStateDigest(trusted) ? trustedResponse : await handleComposerRequest(scope.deps, scope.householdId,
      { kind: "READ", sequence, targetMonth: month, draft: candidate.draft });
    if (!response.ok) throw new TypeError(response.code);
    if (financialAuthorityToken(response.model) !== trustedToken) throw new RootRelationError("N1_AUTHORITY_STALE");
    // Narrow C4 rights to their intersection with the fresh, privately scoped saved publication.
    // Never manufacture PATCH_CONTEXT from the proposed frame, nor publish this projection as a financial model.
    const model = { ...response.model, board: { ...response.model.board, contexts: response.model.board.contexts.map(context => ({ ...context,
      capabilityRefs: context.capabilityRefs.filter(action => action !== "PATCH_CONTEXT" || writableSavedIds.has(context.contextOccurrenceId)),
    })) } };
    const authority = { canManageRelations: true, model } as const;
    // RESTORE must not bypass current member rights by labelling a relation "unchanged".
    const blocked = publishRootRelationCapabilities(rootRelationDocument(candidate), authority).capabilities
      .find(capability => capability.action === "REMOVE_ROOT_RELATION" && capability.status === "BLOCKED");
    if (blocked) throw new RootRelationError(blocked.reason ?? "N1_MEMBER_PERMISSION_DENIED");
    return authority;
  };
  const authority = await authorityFor(frame), token = financialAuthorityToken(authority.model);
  let resultAuthority = authority;
  let admitted = rootRelationDocument(frame), draft = frame.draft;
  if (kind !== "READ") {
    if (plannerString(request.authorityToken) !== token) throw new TypeError("N1_AUTHORITY_STALE");
    if (request.expectedStateDigest !== sourceDigest) throw new TypeError("N1_STATE_STALE");
    if (kind === "MUTATE") {
      const mutation = plannerRecord(request.mutation);
      if (mutation.kind === "CREATE_ROOT_RELATION") assertSavedMembers(rootRelationMemberIds(mutation.orderedContextIds));
      if (mutation.kind === "ADD_ROOT_RELATION_MEMBER") assertSavedMembers([plannerUuid(mutation.contextOccurrenceId)]);
      admitted = admitRootRelationMutation(admitted, { targetMonth: month, expectedStateDigest: sourceDigest,
        mutation: request.mutation as RootRelationMutation }, authority);
    } else {
      // Snapshot history uses only the existing owner operations. No alternate list writer.
      const proposed = parseComposerLocalFrame(request.proposed);
      if (proposed.draft.targetMonth !== month) throw new TypeError("N1_SCOPE_MISMATCH");
      assertRootRelationDraftAuthority(trusted, proposed.draft);
      assertSavedMembers(proposed.relations.flatMap(relation => relation.orderedContextIds));
      const unchanged = new Set(frame.relations.filter(old => proposed.relations.some(next =>
        next.relationId === old.relationId && JSON.stringify(next) === JSON.stringify(old))).map(relation => relation.relationId));
      for (const relation of frame.relations.filter(relation => !unchanged.has(relation.relationId))) {
        admitted = admitRootRelationMutation(admitted, { targetMonth: month,
          expectedStateDigest: publishRootRelationCapabilities(admitted, authority).stateDigest,
          mutation: { kind: "REMOVE_ROOT_RELATION", relationId: relation.relationId } }, authority);
      }
      guardRootMemberTransition(frame.draft, proposed.draft, admitted.rootRelations);
      const nextAuthority = await authorityFor(proposed);
      if (financialAuthorityToken(nextAuthority.model) !== token) throw new TypeError("N1_AUTHORITY_STALE");
      resultAuthority = nextAuthority;
      admitted = rootRelationDocument({ draft: proposed.draft, relations: admitted.rootRelations });
      for (const relation of proposed.relations.filter(relation => !unchanged.has(relation.relationId))) {
        admitted = admitRootRelationMutation(admitted, { targetMonth: month,
          expectedStateDigest: publishRootRelationCapabilities(admitted, nextAuthority).stateDigest,
          mutation: { kind: "CREATE_ROOT_RELATION", relationId: relation.relationId, orderedContextIds: relation.orderedContextIds } }, nextAuthority);
      }
      draft = proposed.draft;
    }
  }
  // Relation-only commands keep the exact financial state read above. Reuse that publication in this request.
  const result = { draft, relations: admitted.rootRelations };
  return { ok: true, sequence, sourceDigest, frame: result, capabilities: publishRootRelationCapabilities(admitted, resultAuthority), authorityToken: token };
}
