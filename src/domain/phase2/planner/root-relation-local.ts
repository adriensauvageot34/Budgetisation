import { parsePlanSemanticState, semanticStateDigest, type PlanSemanticStateV1 } from "./semantic-state";
import { parseRootRelationPlanState, upgradePlanForRootRelations, rootRelationStateDigest } from "./root-relation-state";
import { RootRelationError, type RootContextRelationV1 } from "./root-relation-contract";
import { presetForContext } from "./composer-presets";
import { canonicalPlannerJson, plannerKeys, plannerRecord } from "./json";

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

/** Conservative N1-B pilot. Amounts/controls may differ; saved identities and protections cannot be self-attested.
 * Extra local Contexts remain in the financial Draft, but are not N1 members until saved. No state is rewritten. */
export function assertRootRelationDraftAuthority(trusted: PlanSemanticStateV1, proposed: PlanSemanticStateV1): void {
  if (trusted.targetMonth !== proposed.targetMonth) throw new RootRelationError("N1_SCOPE_MISMATCH");
  const properties = (state: PlanSemanticStateV1, context: PlanSemanticStateV1["contexts"][number]) => canonicalPlannerJson({
    template: context.templateKey, preset: presetForContext(context)?.presetKey ?? null,
    status: context.status, provenance: context.provenance, parent: context.parentContextOccurrenceId ?? null,
    plannedMonth: typeof context.fields.plannedDate === "string" ? context.fields.plannedDate.slice(0, 7) : null,
    preserved: state.preferences.flexibility[context.contextOccurrenceId] === "PRESERVE",
    anchored: state.preferences.anchors.includes(context.contextOccurrenceId),
  });
  for (const context of trusted.contexts) {
    const candidate = proposed.contexts.find(item => item.contextOccurrenceId === context.contextOccurrenceId);
    if (!candidate || properties(trusted, context) !== properties(proposed, candidate))
      throw new RootRelationError("N1_DRAFT_AUTHORITY_MISMATCH");
  }
}

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
