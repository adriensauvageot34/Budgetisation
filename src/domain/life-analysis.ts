import type { LifeContext, LifeLayer, Operation, Recurrence } from "@/domain/budget";

export type EffectiveLifeContext = LifeContext | "À confirmer";

export function getEffectiveLifeContext(
  operation: Pick<Operation, "lifeContext" | "momentId" | "spendingContext" | "event" | "eventDetail" | "recurrence" | "category">,
): EffectiveLifeContext {
  if (operation.lifeContext) return operation.lifeContext;
  if (operation.momentId) return "Hors quotidien";
  if (operation.spendingContext === "Vie courante") return "Vie courante";
  if (operation.spendingContext === "Événement") return "Hors quotidien";
  if (operation.event || operation.eventDetail) return "Hors quotidien";
  if (operation.recurrence === "Fixe" || isStructuralCategory(operation.category)) {
    return "Vie courante";
  }
  return "À confirmer";
}

function isStructuralCategory(category: string) {
  return ["Logement", "Banque", "Assurances", "Télécom", "Impôts & taxes"].includes(category);
}

export function getLifeLayer(entry: {
  lifeContext: EffectiveLifeContext;
  momentId: string | null;
  status: string | null;
}): LifeLayer {
  if (entry.lifeContext === "Vie courante") return "Routine";
  if (entry.lifeContext === "À confirmer") return "À confirmer";
  if (entry.momentId) return "Moment";
  if (entry.status === "Exceptionnel") return "Imprévu";
  return "Ponctuel";
}

export function effectiveLifeContextFromParts(parts: {
  explicit: LifeContext | null;
  momentId: string | null;
  parent: Operation;
}): EffectiveLifeContext {
  if (parts.explicit) return parts.explicit;
  if (parts.momentId) return "Hors quotidien";
  return getEffectiveLifeContext(parts.parent);
}

export const lifeContextOptions: LifeContext[] = ["Vie courante", "Hors quotidien"];
export const recurrenceOptions: Recurrence[] = ["Fixe", "Variable"];
