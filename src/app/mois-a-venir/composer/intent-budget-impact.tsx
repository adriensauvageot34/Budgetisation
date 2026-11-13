import { createContext, useContext } from "react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { PreviewStatus } from "./preview-scheduler";
import { money } from "./display";
import { intentionNavigationEntries } from "./workshop-navigation";
import { intentDiagnostics } from "./intent-diagnostics";
import styles from "./intent-budget-impact.module.css";

export const BudgetPreviewStatus = createContext<PreviewStatus | null>(null);
export const OpenMonthlyFinances = createContext<(() => void) | null>(null);

export function budgetAmountsCurrent(model: ComposerUiModel, status: PreviewStatus | null) {
  return status !== "PENDING" && status !== "STALE" && status !== "FAILED"
    && (!model.budgetReading || model.budgetReading.semanticStateDigest === model.board.draft.semanticStateDigest);
}

const coverageText = {
  ABSENT: "Aucune enveloppe Courses chiffrée n’est disponible pour ce mois.",
  UNRESOLVED: "La part couverte par l’enveloppe Courses reste à établir.",
  CONFIRM: "Précisez si les courses utilisent l’enveloppe du mois ou s’y ajoutent dans « Nom, vendeur et date ».",
  COVERED: "Les lignes rattachées sont entièrement couvertes par l’enveloppe Courses.",
  PARTIAL: "L’enveloppe Courses ne couvre qu’une partie des lignes rattachées.",
  EXHAUSTED: "L’enveloppe Courses ne couvre plus les lignes rattachées.",
  EXTRA: "Ce panier a été déclaré en plus de l’enveloppe Courses.",
};
const fundingLabels = { BANK: "Banque", SWILE: "Swile", EDENRED: "Edenred" };

export function IntentBudgetImpact({ model, contextId }: { model: ComposerUiModel; contextId: string }) {
  const status = useContext(BudgetPreviewStatus);
  const openFinances = useContext(OpenMonthlyFinances);
  const reading = model.budgetReading;
  if (!reading) return null;
  const current = budgetAmountsCurrent(model, status);
  const impact = current ? reading.byContext[contextId] : undefined;
  const parentId = model.board.contexts.find(context => context.contextOccurrenceId === contextId)?.parentContextOccurrenceId;
  const parent = parentId ? intentionNavigationEntries(model.board.contexts).find(entry => entry.id === parentId) : undefined;
  const diagnostics = current ? intentDiagnostics(model, contextId) : [];
  return <section className={styles.impact} aria-label="Impact sur le budget" data-intent-budget-impact>
    <h3>Impact sur le budget</h3>
    {parent && <p data-budget-parent={parent.id}>Rattachée à {parent.label}. Les montants ci-dessous concernent cette intention ; le projet présente séparément ses intentions liées.</p>}
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
        {openFinances && status === "BLOCKED" && <p><button type="button" onClick={openFinances}>Voir les informations du mois à compléter</button></p>}
        <details><summary>Financement</summary>
          {impact.plannedPosts.length > 0 && <p>Poste prévu mobilisé · {impact.plannedPosts.join(", ")}</p>}
          <p>Source déclarée · {impact.declaredFundingSources.length
            ? impact.declaredFundingSources.map(source => fundingLabels[source]).join(", ") : "À préciser"}</p>
          {impact.declaredFundingSources.length > 0 && <p>La capacité de cette source reste à vérifier dans les finances du mois.</p>}
          {openFinances && status !== "BLOCKED" && <p><button type="button" onClick={openFinances}>Consulter les sources de ce mois</button></p>}
          <p>Reste à financer · non ventilé par intention dans la projection actuelle.</p>
        </details>
      </>}
    {diagnostics.length > 0 && <details data-intent-diagnostics><summary>Informations à préciser · {diagnostics.length}</summary>
      <ul className={styles.diagnosticList}>{diagnostics.map(diagnostic => <li key={JSON.stringify([diagnostic.code, diagnostic.targetRef, diagnostic.message])}>
        <strong>{diagnostic.severity === "BLOCK" ? "À résoudre" : "À vérifier"}</strong> · {diagnostic.message}
      </li>)}</ul>
      <p>Ces repères viennent de la simulation. Son statut et les conditions d’application restent indiqués séparément.</p>
    </details>}
  </section>;
}
