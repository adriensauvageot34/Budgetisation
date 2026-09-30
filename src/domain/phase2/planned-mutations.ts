import type { PlannedExpenseDraft } from "./planned-contract";

/** Commands and local UI state, never fields of the prospective row. */
export type PlannedWriteCommand = { id: string; expectedUpdatedAt?: string };
export type PlannedIssue = { code: string; path: string; message: string;
  repairTarget: "context" | "cost" | "route" | "funding" | "reload" | "date" | "month" };
export type PlannedResult<T> = { ok: true; value: T } | { ok: false; issue: PlannedIssue };
export type RealityConfirmationDraft = { expenseId: string; expectedUpdatedAt: string;
  finalDraft: PlannedExpenseDraft };

export function plannedMutationIssue(error: unknown): PlannedIssue {
  const raw = error instanceof Error ? error.message : "";
  const code = /^(?:PLANNED_|REALITY_)[A-Z0-9_:]+$/u.test(raw) ? raw : "PLANNED_EXPENSE_REQUEST_FAILED";
  if (code === "PLANNED_EXPENSE_MONTH_RESOURCES_REQUIRED") return { code, path: "month.declaredResources", repairTarget: "month",
    message: "Renseignez les ressources Swile et Edenred du mois choisi avant d’y reporter ce projet. Votre prévision reste dans son mois actuel." };
  if (/STALE|VERSION|IDEMPOTENCY|STATUS_TRANSITION|EDIT_TARGET|NOT_FOUND/u.test(code))
    return { code, path: "updatedAt", repairTarget: "reload",
      message: "Cette dépense a changé. Rechargez sa version actuelle avant de poursuivre ; votre brouillon reste ouvert." };
  if (/FUNDING|BANK_ONLY/u.test(code)) return { code, path: "costItems.fundingAllocations", repairTarget: "funding",
    message: "Confirmez le financement de chaque ligne : la répartition doit correspondre au coût final." };
  if (/ROUTE|FUEL|VEHICLE/u.test(code)) return { code, path: "context.route", repairTarget: "route",
    message: "Le trajet ne peut plus être estimé. Vérifiez les étapes et les kilomètres, puis recalculez." };
  if (/DATE|MONTH/u.test(code)) return { code, path: "plannedDate", repairTarget: "date",
    message: "Choisissez une date valide dans le mois du projet." };
  if (/PLACE|PERSON|CONTACT|PROVIDER|CONTEXT|SUBTYPE|FAMILY/u.test(code)) return { code, path: "context", repairTarget: "context",
    message: "Vérifiez les personnes, les lieux et le contexte : une référence n’est plus compatible ou disponible." };
  return { code, path: "costItems", repairTarget: "cost",
    message: code === "PLANNED_EXPENSE_REQUEST_FAILED" ? "La demande n’a pas abouti. Votre brouillon est conservé ; vous pouvez réessayer."
      : "Vérifiez les éléments et leurs montants avant de réessayer." };
}

export function needsRealityConfirmation(expense: { status: string; plannedDate: string | null }, today: string): boolean {
  return expense.status === "PLANNED" && expense.plannedDate !== null && expense.plannedDate < today;
}

/** Only an explicit bank allocation follows a changed line gross automatically.
 * Meal/mixed allocations stay visible and require user reconfirmation. */
export function fundingAfterGrossChange(item: PlannedExpenseDraft["costItems"][number], total: string) {
  return item.fundingAllocations?.length === 1 && item.fundingAllocations[0]!.source === "BANK"
    ? [{ source: "BANK" as const, amount: total }] : item.fundingAllocations;
}

export const canCollapseRealityCosts = (items: PlannedExpenseDraft["costItems"]): boolean => items.length <= 1;
