import { createContext, useContext } from "react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { PreviewStatus } from "./preview-scheduler";
import { money } from "./display";
import styles from "./intent-budget-impact.module.css";

export const BudgetPreviewStatus = createContext<PreviewStatus | null>(null);

const coverageText = {
  ABSENT: "Aucune enveloppe Courses chiffrée n’est disponible pour ce mois.",
  UNRESOLVED: "La part couverte par l’enveloppe Courses reste à établir.",
  CONFIRM: "Précisez si les courses utilisent l’enveloppe du mois ou s’y ajoutent dans « Vendeur, date et budget ».",
  COVERED: "Les lignes rattachées sont entièrement couvertes par l’enveloppe Courses.",
  PARTIAL: "L’enveloppe Courses ne couvre qu’une partie des lignes rattachées.",
  EXHAUSTED: "L’enveloppe Courses ne couvre plus les lignes rattachées.",
  EXTRA: "Ce panier a été déclaré en plus de l’enveloppe Courses.",
};
const fundingLabels = { BANK: "Banque", SWILE: "Swile", EDENRED: "Edenred" };

export function IntentBudgetImpact({ model, contextId }: { model: ComposerUiModel; contextId: string }) {
  const status = useContext(BudgetPreviewStatus);
  const reading = model.budgetReading;
  if (!reading) return null;
  const current = reading.semanticStateDigest === model.board.draft.semanticStateDigest
    && status !== "PENDING" && status !== "STALE" && status !== "FAILED";
  const impact = current ? reading.byContext[contextId] : undefined;
  return <section className={styles.impact} aria-label="Impact sur le budget" data-intent-budget-impact>
    <h3>Impact sur le budget</h3>
    {!impact ? <p>{status === "FAILED" ? "Calcul indisponible. Réessayez la simulation depuis le bandeau."
      : current ? "Aucun impact évalué pour cette intention." : "Les montants se mettent à jour avec vos choix."}</p>
      : <>
        <dl>
          <div><dt>Coût total</dt><dd>{impact.gross === null && impact.knownSubtotal !== null
            ? <>{money(impact.knownSubtotal)} connus <small>Total à préciser</small></> : money(impact.gross)}</dd></div>
          <div><dt>{impact.incremental?.startsWith("-") ? "Poste prévu remplacé" : "Déjà prévu"}</dt><dd>{money(impact.displaced)}</dd></div>
          <div><dt>{impact.incremental?.startsWith("-") ? "Écart au prévu" : "En plus du budget"}</dt><dd>{money(impact.incremental)}</dd></div>
        </dl>
        {impact.groceriesCoverage && <p data-groceries-coverage={impact.groceriesCoverage}>{coverageText[impact.groceriesCoverage]}</p>}
        {impact.hasChildren && <p>Les intentions rattachées gardent leur propre impact.</p>}
        <details><summary>Financement</summary>
          {impact.plannedPosts.length > 0 && <p>Poste prévu mobilisé · {impact.plannedPosts.join(", ")}</p>}
          <p>Source déclarée · {impact.declaredFundingSources.length
            ? impact.declaredFundingSources.map(source => fundingLabels[source]).join(", ") : "À préciser"}</p>
          {impact.declaredFundingSources.length > 0 && <p>La capacité de cette source reste à vérifier dans les finances du mois.</p>}
          <p>Reste à financer · non ventilé par intention dans la projection actuelle.</p>
        </details>
      </>}
  </section>;
}
