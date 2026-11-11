import type { ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";

/** These labels describe the existing main and extra slots. They never admit a new operation. */
export function guidedAssetLabels(templateKey: string, presetKey?: ComposerPresetKey) {
  if (templateKey === "purchase") return {
    amount: "Coût de l’achat", detail: "Quantité et prix de l’article",
    extras: "Frais ou compléments distincts", examples: ["Autre frais"],
  };
  if (templateKey === "delivery") return {
    amount: "Commande complète", detail: "Quantité et prix du repas",
    extras: "Frais non inclus", examples: ["Livraison", "Service", "Autre frais"],
  };
  if (templateKey === "activity") {
    const outdoor = presetKey === "hiking-nature" || presetKey === "beach-day" || presetKey === "fishing-day";
    return {
      amount: outdoor ? "Budget de la sortie" : presetKey === "concert" || presetKey === "museum-exhibition" ? "Entrée ou coût global" : "Coût de l’activité",
      detail: outdoor ? "Préciser un tarif" : "Tarif et quantité",
      extras: "Frais facultatifs de la sortie", examples: outdoor ? ["Parking", "Autre coût"] : ["Parking", "Repas", "Autre coût"],
    };
  }
  return {
    amount: "Montant rapide", detail: "Détailler le repas",
    extras: templateKey === "restaurant" ? "Détails de l’addition" : "Compléments au repas", examples: ["Boisson", "Dessert", "Autre complément"],
  };
}
