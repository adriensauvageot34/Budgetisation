import { parsePlanSemanticState, semanticStateDigest, type PlanSemanticStateV1 } from "./semantic-state";
import { parseRootRelationPlanState, upgradePlanForRootRelations, rootRelationStateDigest } from "./root-relation-state";
import { RootRelationError, type RootContextRelationV1 } from "./root-relation-contract";
import { presetForContext } from "./composer-presets";
import { plannerKeys, plannerRecord } from "./json";

/** One Composer history frame. Financial V1 is never extracted by discarding an N1 document. */
export type ComposerLocalFrame = Readonly<{ draft: PlanSemanticStateV1; relations: readonly RootContextRelationV1[] }>;
export function rootRelationDocument(frame: ComposerLocalFrame) {
  return parseRootRelationPlanState({ ...upgradePlanForRootRelations(frame.draft), rootRelations: frame.relations });
}
export function parseComposerLocalFrame(raw: unknown): ComposerLocalFrame {
  const value = plannerRecord(raw); plannerKeys(value, ["draft", "relations"]);
  const draft = parsePlanSemanticState(value.draft);
  const document = parseRootRelationPlanState({ ...upgradePlanForRootRelations(draft), rootRelations: value.relations });
  return { draft, relations: document.rootRelations };
}
export const composerLocalFrameDigest = (frame: ComposerLocalFrame) => rootRelationStateDigest(rootRelationDocument(frame));
export const financialAuthorityToken = (model: { proof: { expectedBaselineDigest: string; expectedActiveRevisionId: string | null; expectedActiveRevisionNumber: number } }) =>
  `${model.proof.expectedBaselineDigest}:${model.proof.expectedActiveRevisionId}:${model.proof.expectedActiveRevisionNumber}`;

/** Shared transition guard, not a second relation mutation owner. No orphan repair or Context rewrite. */
export function guardRootMemberTransition(before: PlanSemanticStateV1, after: PlanSemanticStateV1,
  relations: readonly RootContextRelationV1[]): void {
  if (before.targetMonth !== after.targetMonth) throw new RootRelationError("N1_SCOPE_MISMATCH");
  for (const id of relations.flatMap(relation => relation.orderedContextIds)) {
    const previous = before.contexts.find(context => context.contextOccurrenceId === id);
    const next = after.contexts.find(context => context.contextOccurrenceId === id);
    if (!previous || !next) throw new RootRelationError("N1_MEMBER_NOT_FOUND");
    if (next.parentContextOccurrenceId) throw new RootRelationError("N1_MEMBER_IS_CHILD");
    if (previous.templateKey !== next.templateKey || previous.provenance !== next.provenance
      || previous.status !== next.status || presetForContext(previous)?.presetKey !== presetForContext(next)?.presetKey)
      throw new RootRelationError("N1_MEMBER_IDENTITY_CHANGED");
  }
  rootRelationDocument({ draft: after, relations });
}
export function sameFinancialFrame(a: ComposerLocalFrame, b: ComposerLocalFrame) {
  return semanticStateDigest(a.draft) === semanticStateDigest(b.draft);
}
