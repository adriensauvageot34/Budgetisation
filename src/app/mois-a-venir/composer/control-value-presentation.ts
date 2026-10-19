import type { ComposerCardView } from "@/domain/phase2/planner/composer-contract";
import type { ControlDimension } from "@/domain/phase2/planner/adjustment-contract";
import type { PlannerJsonObject } from "@/domain/phase2/planner/json";
import { money, quantityLabel } from "./display";

/** Presentation of published evidence only; never derives an economic amount.
 * Capability is permission to edit, not evidence of an adopted decision. */
export function controlValuePresentation(card: ComposerCardView, dimension: ControlDimension = controlMainDimension(card)) {
  const decision = card.value.decisionValue;
  const explicit = decision !== null && typeof decision === "object" && !Array.isArray(decision)
    && typeof (decision as PlannerJsonObject)[dimension] === "string";
  const value = typeof card.value[dimension] === "string" ? card.value[dimension] as string : null;
  const absentEnvelope = dimension === "amount" && !explicit && card.value.inclusion === "SUGGESTION_ONLY";
  const kind = explicit ? "DECISION" : value !== null && !absentEnvelope ? "REFERENCE" : "UNKNOWN";
  const label = dimension === "unitAmount" ? kind === "DECISION" ? "Prix choisi" : kind === "REFERENCE" ? "Prix de référence" : "Prix à préciser"
    : kind === "DECISION" ? "Choix de ce mois" : kind === "REFERENCE" ? "Référence du mois · pas une décision" : "À prévoir";
  return { kind, label, value: absentEnvelope ? null : value } as const;
}
export function controlMainDimension(card: ComposerCardView): "count" | "amount" {
  return card.capability?.fields?.count || typeof card.value.count === "string" ? "count" : "amount";
}
export function controlValueSummary(card: ComposerCardView): string {
  const dimension = controlMainDimension(card), main = controlValuePresentation(card, dimension);
  if (dimension === "amount") return main.value === null ? "À définir" : money(main.value);
  const price = controlValuePresentation(card, "unitAmount");
  return `${main.value === null ? "Occurrences à définir" : `${quantityLabel(main.value)} occurrence(s)`} · ${price.label.toLocaleLowerCase("fr-FR")}${price.value === null ? "" : ` : ${money(price.value)}`}`;
}
