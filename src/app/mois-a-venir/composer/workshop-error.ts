/** Presentation only. Parsing and admission stay with the existing owners. */
export function workshopErrorMessage(failure: unknown) {
  const message = failure instanceof Error ? failure.message : "";
  if (message === "MONTH_DECISION_AMOUNT_INVALID") return "Indiquez un montant positif ou nul, avec deux décimales au maximum. Votre saisie est conservée.";
  if (message === "PLANNER_QUANTITY_INVALID") return "Indiquez une quantité supérieure à zéro et au plus égale à 9 999. Votre saisie est conservée.";
  if (message === "CONTEXT_PERSON_QUANTITY_INVALID") return "Vérifiez la quantité et le nombre de personnes concernées. Votre saisie est conservée.";
  return message && !/^[A-Z][A-Z0-9_]+(?::.*)?$/.test(message) ? message
    : "Ce choix n’a pas été conservé. Vérifiez les champs ou rouvrez ce poste ; votre saisie reste disponible.";
}
