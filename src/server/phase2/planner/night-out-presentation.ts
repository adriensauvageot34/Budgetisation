import "server-only";
import Big from "big.js";
import type { MonthComposerReadModel } from "@/domain/phase2/planner/composer-contract";

/** Presentation of the Compiler's existing evaluations, with one physical journey per owner.
 * No pricing, source read, participant conversion, binding or financial projection occurs here. */
export function nightOutSummaries(model: MonthComposerReadModel) {
  const compiled = model.preview.compiled;
  return model.semanticState.contexts.filter(context => context.templateKey === "night-out").map(context => {
    const ids = new Set([context.contextOccurrenceId]);
    for (let size = -1; size !== ids.size;) { size = ids.size;
      for (const child of model.semanticState.contexts) if (child.parentContextOccurrenceId && ids.has(child.parentContextOccurrenceId)) ids.add(child.contextOccurrenceId);
    }
    const journeys = compiled.journeys.filter(journey => ids.has(journey.ownerContextOccurrenceId) && !journey.externalExpenseId);
    const journeyIds = new Set(journeys.map(journey => journey.physicalJourneyRequirementId));
    const amounts = compiled.components.filter(component => component.selectionProvenance !== "PERSONAL_SUGGESTION"
      && (component.contextOccurrenceId !== null && ids.has(component.contextOccurrenceId)
        || !!component.physicalJourneyRequirementId && journeyIds.has(component.physicalJourneyRequirementId)))
      .map(component => component.evaluation.economicAmount);
    let incomplete = model.board.contexts.some(card => ids.has(card.contextOccurrenceId) && card.knowledge !== "KNOWN");
    for (const journey of journeys) {
      const price = compiled.journeyPrices.find(price => price.journeyId === journey.physicalJourneyRequirementId);
      if (!price || price.status !== "RESOLVED") incomplete = true;
    }
    const known = amounts.filter((amount): amount is string => amount !== null);
    return {contextOccurrenceId:context.contextOccurrenceId,semanticStateDigest:model.preview.semanticStateDigest,knownAmount:known.length ? known.reduce((total,amount)=>total.plus(amount),new Big(0)).toFixed(2) : null,
      incomplete:incomplete || amounts.some(amount=>amount===null)};
  });
}
