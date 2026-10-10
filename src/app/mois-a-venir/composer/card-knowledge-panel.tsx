"use client";

import type { CardKnowledgeRead, CardKnowledgeDimension } from "@/domain/phase2/planner/card-knowledge-contract";
import { money } from "./display";
import styles from "./composer.module.css";

const unitLabel: Record<CardKnowledgeDimension["unit"], string> = {
  EUR_PER_MONTH: "par mois", OCCURRENCES_PER_MONTH: "occurrences par mois",
  EUR_PER_OCCURRENCE: "par occurrence", EUR_PER_PRODUCT: "par produit",
};
const reasonLabel: Record<string, string> = {
  NO_COMPARABLE_HISTORY: "Aucun historique comparable publié.",
  INSUFFICIENT_COMPARABLE_MONTHS: "Moins de trois mois comparables : aucune médiane certifiée.",
  PARTIAL_COVERAGE: "Certains mois restent incomplets.",
  COVERED_COMPARABLE_MONTHS: "Mois clos et comparables selon l’owner.",
  PRICE_AND_FREQUENCY_SEPARATE: "Le prix unitaire et la fréquence ont des sources distinctes.",
  PRICE_COVERAGE_UNPUBLISHED: "L’effectif propre aux prix n’est pas publié ; aucune fourchette de prix n’est affirmée.",
  CONTEXT_IDENTITY_NOT_PROVEN: "Ce repère du foyer ne prouve pas le coût de cette intention.",
  GIFT_PRODUCT_IDENTITY_NOT_LINKED: "Aucun ancien achat n’est relié à ce cadeau précis.",
  ROUTE_DOES_NOT_PROVE_VISIT: "Un trajet observé ne prouve pas une visite familiale.",
  PRODUCT_IDENTITY_REQUIRED: "Choisissez d’abord un produit reconnu pour obtenir un prix comparable.",
  COMPONENT_PRICES_REQUIRED: "Les composants doivent être renseignés séparément.",
  NO_CARD_SPECIFIC_OWNER_REFERENCE: "Aucune référence propre à cette carte n’est publiée.",
  SLOT_NOT_PUBLISHED: "Le poste n’a pas de référence publiée.",
  FORECAST_NOT_DECISION: "Projection publiée pour le mois, distincte de votre décision et des observations historiques.",
  USER_VALIDATED_DECLARATION: "Déclaration personnelle validée ; ce n’est pas un paiement observé.",
  OWNER_NEEDS_NEW_INPUT: "L’owner demande une nouvelle saisie avant toute reprise de cette fréquence.",
};
const display = (dimension: CardKnowledgeDimension, value: string) =>
  dimension.unit === "OCCURRENCES_PER_MONTH" ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(value)) : money(value);

export function CardKnowledgePanel({ knowledge, onPrefill }: {
  knowledge?: CardKnowledgeRead; onPrefill?: (field: "amount" | "count", value: string) => void;
}) {
  if (!knowledge) return null;
  const available = knowledge.dimensions.filter(dimension => dimension.value !== null && dimension.suggestionPolicy !== "UNAVAILABLE");
  return <aside className={styles.coursesReference} data-card-knowledge={knowledge.cardKey}
    data-courses-reference={knowledge.cardKey === "control:HOUSEHOLD:household:groceries" ? true : undefined}>
    <strong>Repères de Budgetisation · propositions non retenues</strong>
    {available.length ? available.map(dimension => <div key={dimension.key}>
      <p>{dimension.evidenceState === "DECLARED" ? "Déclaration validée : " : dimension.key === "FORECAST_MONTH" ? "Projection du mois : " : dimension.key === "UNIT_PRICE" ? "Prix unitaire : " : "Repère historique : "}
        {display(dimension, dimension.value!)} {unitLabel[dimension.unit]}
        {dimension.nCoveredMonths !== null ? ` · ${dimension.nCoveredMonths} mois comparables` : ""}
        {dimension.coverageFrom && dimension.coverageTo ? ` · ${dimension.coverageFrom} à ${dimension.coverageTo}` : ""}</p>
      {dimension.suggestionPolicy === "OFFER_PREFILL" && onPrefill &&
        <button type="button" className={styles.secondary} onClick={() => onPrefill(dimension.key === "OCCURRENCE_COUNT" ? "count" : "amount", dimension.value!)}>
          Reprendre ce repère dans le formulaire</button>}
    </div>) : <p>{reasonLabel[knowledge.dimensions[0]?.reasonCodes[0] ?? ""] ?? "Référence chiffrée indisponible."}
      {knowledge.dimensions[0]?.nCoveredMonths ? ` ${knowledge.dimensions[0].nCoveredMonths} mois couverts.` : ""}</p>}
    <details><summary>Couverture et provenance</summary>{knowledge.dimensions.map(dimension => <div key={dimension.key}>
      <p>{unitLabel[dimension.unit]} · {dimension.suggestionPolicy === "OFFER_PREFILL" ? "reprise possible sur choix explicite" : dimension.suggestionPolicy === "REFERENCE_ONLY" ? "repère indicatif" : "indisponible"}.
        {dimension.p25 !== null && dimension.p75 !== null ? ` Fourchette publiée : ${display(dimension, dimension.p25)} à ${display(dimension, dimension.p75)}.` : ""}</p>
      <p>{dimension.reasonCodes.map(reason => reasonLabel[reason] ?? reason).join(" ")}</p>
      <p>Owner : {dimension.sourceAuthority}. Sources : {dimension.sourceRefs.join(", ") || "aucune source admissible"}.
        {dimension.sourceDigests.length ? ` Révisions : ${dimension.sourceDigests.join(", ")}.` : ""}</p>
    </div>)}</details>
    <p>Une référence affichée ne modifie ni le Draft ni la simulation. Validez le formulaire pour décider.</p>
  </aside>;
}
