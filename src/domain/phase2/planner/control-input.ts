import Big from "big.js";
import { decisionAmount } from "../month-decision-contract";
import type { ComposerCardView } from "./composer-contract";
import type { ControlDimension } from "./adjustment-contract";
import type { PlannerJsonObject } from "./json";

/** Input normalization only. Financial totals still come from the Compiler. */
export function normalizeControlInput(raw: string, integer = false): string {
  const text = raw.trim();
  if (!/^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[.,]\d{1,2})?$/u.test(text)) throw new TypeError("Saisissez un montant positif, avec deux décimales au maximum.");
  const canonical = text.replace(/[ \u00a0\u202f]/gu, "").replace(",", ".").replace(/^0+(?=\d)/u, "");
  const value = new Big(decisionAmount(canonical));
  if (integer && !value.round(0).eq(value)) throw new TypeError("Le nombre d’occurrences doit être entier.");
  return value.toFixed(integer ? 0 : 2);
}
/** SET_STATE is a complete replacement. Retain only the previous explicit price;
 * a historical unit price must not become a user decision when count changes. */
export function controlInputValue(card: ComposerCardView, dimension: ControlDimension, value: string): PlannerJsonObject {
  if (dimension === "amount") return { amount: value };
  const prior = card.value.decisionValue as PlannerJsonObject | null;
  if (dimension === "count") return { count: value, ...(typeof prior?.unitAmount === "string" ? { unitAmount: prior.unitAmount } : {}) };
  if (typeof card.value.count !== "string") throw new TypeError("Précisez d’abord le nombre d’occurrences.");
  return { count: card.value.count, unitAmount: value };
}

export function validateControlValue(card: ComposerCardView, value: PlannerJsonObject): void {
  if (card.capability?.flexibility === "LOCKED" || !card.capability?.actions.length) throw new TypeError("COMPOSER_CONTROL_LOCKED");
  const required = card.capability.actions.includes("SET_SLOT_OCCURRENCES") ? "count" : "amount";
  if (!Object.hasOwn(value, required)) throw new TypeError("COMPOSER_CONTROL_FIELD_REQUIRED");
  for (const [key, input] of Object.entries(value)) {
    const rule = card.capability.fields?.[key as ControlDimension], amount = new Big(decisionAmount(input));
    if (!rule || rule.status !== "EDITABLE" || amount.lt(rule.minimum) || amount.gt(rule.maximum) || rule.integer && !amount.round(0).eq(amount))
      throw new TypeError("COMPOSER_CONTROL_FIELD_NOT_ADMITTED");
  }
}

export function controlAccessLabel(card: ComposerCardView): string {
  if (card.capability?.flexibility === "LOCKED") return "Protégé par une règle du mois";
  if (!card.capability?.actions.length) return "Édition non publiée par la source";
  if (card.capability.rationaleCodes.includes("NEEDS_NEW_INPUT")) return "Informations à compléter · éditable";
  return "Choix de ce mois";
}
