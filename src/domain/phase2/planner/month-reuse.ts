import type { ComposerUiModel } from "./composer-ui-contract";
import type { CardKnowledgeDimension } from "./card-knowledge-contract";
import type { SemanticMutation } from "./adjustment-contract";
import { controlInputValue, normalizeControlInput, validateControlValue } from "./control-input";

/** Proposal from already admitted owners. No query, statistics, preference owner,
 * or implicit adoption. Existing decisions and protections are never replaced. */
export function monthReuseProposals(model: ComposerUiModel): readonly Readonly<{
  targetRef: string; label: string; reference: CardKnowledgeDimension; mutation: Extract<SemanticMutation, { kind: "SET_STATE" }>;
}>[] {
  return [...model.board.baselineControls, ...model.board.discretionaryControls].flatMap(card => {
    if (model.semanticState.controls.some(c => c.decisionSlotKey === card.targetRef)
      || card.capability?.flexibility === "LOCKED" || !card.capability?.actions.length) return [];
    const dimension = card.capability.fields?.amount?.status === "EDITABLE" ? "amount" : "count";
    const reference = model.cardKnowledge[`control:${card.targetRef}`]?.dimensions.find(d => d.key === (dimension === "amount" ? "MONTH_AMOUNT" : "OCCURRENCE_COUNT")
      && d.suggestionPolicy === "OFFER_PREFILL" && d.value !== null);
    if (!reference) return [];
    try {
      const value = normalizeControlInput(reference.value!, dimension === "count"), rule = card.capability.fields?.[dimension];
      if (!rule || rule.status !== "EDITABLE" || dimension === "count" && value !== "0" && card.value.unitAmount === null) return [];
      validateControlValue(card, controlInputValue(card, dimension, value));
      return [{ targetRef: card.targetRef, label: card.label, reference,
        mutation: { kind: "SET_STATE" as const, targetRef: card.targetRef, value: controlInputValue(card, dimension, value) } }];
    } catch { return []; }
  });
}
