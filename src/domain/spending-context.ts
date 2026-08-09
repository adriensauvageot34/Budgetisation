import type { Operation, SpendingContext } from "@/domain/budget";
import { isConsumptionExpense } from "@/domain/calculations";

export type EffectiveSpendingContext =
  | SpendingContext
  | "À confirmer"
  | "Non applicable";

const structuralTerms = [
  "loyer",
  "logement",
  "assurance",
  "abonnement",
  "télécom",
  "telecom",
  "internet",
  "électricité",
  "electricite",
  "gaz",
  "eau",
  "mutuelle",
  "banque",
  "impôt",
  "impot",
];

const contextSensitiveTerms = [
  "course",
  "aliment",
  "restaurant",
  "restauration",
  "loisir",
  "activité",
  "activite",
  "hôtel",
  "hotel",
  "transport",
  "parking",
  "cadeau",
  "achat personnel",
  "voyage",
  "sortie",
  "bar",
];

function normalized(operation: Operation) {
  return [
    operation.category,
    operation.subcategory,
    operation.preciseType,
    operation.normalizedMerchant,
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR");
}

function includesTerm(value: string, terms: string[]) {
  return terms.some((term) =>
    value.includes(
      term
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("fr-FR"),
    ),
  );
}

export function getSpendingContext(
  operation: Operation,
): EffectiveSpendingContext {
  if (!isConsumptionExpense(operation)) return "Non applicable";
  if (operation.lifeContext === "Vie courante") return "Vie courante";
  if (operation.lifeContext === "Hors quotidien" || operation.momentId) return "Événement";
  if (operation.event || operation.eventDetail) return "Événement";
  if (operation.spendingContext === "Événement") return "Événement";
  if (operation.spendingContext === "Vie courante") return "Vie courante";

  const classification = normalized(operation);
  if (operation.recurrence === "Fixe") return "Vie courante";
  if (includesTerm(classification, structuralTerms)) return "Vie courante";
  if (includesTerm(classification, contextSensitiveTerms)) return "À confirmer";
  if (operation.status === "Habituel") return "Vie courante";
  return "À confirmer";
}
