import { Gauge, ArrowUpRight, CircleHelp } from "lucide-react";
import type { PlanProjectionV1 } from "@/domain/phase2/planner/projection-contract";
import { money } from "./display";
import styles from "./composer.module.css";
export function ComposerCockpit({ projection, temporary, busy, dirty, preview, apply, balance, revision }: { projection: PlanProjectionV1; temporary: boolean; busy: boolean; dirty: boolean;
  preview: () => void; apply: () => void; balance: () => void; revision: number }) {
  const rows = [["Ressources", projection.economic.resources], ["Engagements certains", projection.economic.certainCommitments], ["Besoins & habitudes", projection.economic.needsAndHabits],
    ["Vie discrétionnaire", projection.economic.discretionaryLife], ["Contexts explicites", projection.economic.explicitContexts], ["Usage mobilité", projection.economic.mobilityUsageEconomicCost], ["Cagnottes réservées", projection.economic.savingsReservations]];
  return <aside className={styles.cockpit} aria-label="Cockpit du mois"><header className={styles.panelHeader}><Gauge size={19} /><h2>Cap du mois</h2></header>
    <div className={styles.cockpitScroll}><div className={styles.remainder} data-cockpit data-temporary={temporary}><span>{temporary ? "Aperçu temporaire" : "Reste économique projeté"}</span><strong data-remainder>{money(projection.plan.economicMonthEndRemainder)}</strong><p><ArrowUpRight size={14} /> {money(projection.plan.impactOnMonthEnd)} vs socle</p><small>Socle : {money(projection.baseline.economicMonthEndRemainder)}</small></div>
      <div className={styles.projectionState}>{projection.projectionCompleteness === "COMPLETE" ? "Projection complète" : projection.projectionCompleteness === "PARTIAL" ? "Projection à compléter" : "Des inconnues restent à résoudre"}</div>
      <dl className={styles.breakdown}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl>
      <p className={styles.helper}><CircleHelp size={14} /> Ces postes sont les vues du même scénario ; ils ne sont pas additionnés ici.</p>
      <details className={styles.cockpitDetails}><summary>Financement & timing</summary><p>Financement : {projection.funding.status === "COMPLETE" ? "établi" : "à compléter"}</p><p>Allocation à préciser : {money(projection.funding.unallocatedEconomicAmount)}</p><p>Financement à compléter : {money(projection.funding.fundingToComplete)}</p><p>Point bas Banque : {money(projection.cash.lowPointAmount)}{projection.cash.lowPointDate ? ` · ${projection.cash.lowPointDate}` : " · date non établie"}</p><p>Un trajet en voiture peut représenter un usage économique de carburant sans débit Banque supplémentaire.</p><p>{projection.mobility.journeyCount} trajet(s) physique(s) · {projection.mobility.unresolvedJourneyCount} à préciser</p><p>Montant non résolu : {money(projection.economic.unresolvedEconomicAmount)}</p></details>
      {projection.goal.targetMonthEnd !== null && <p className={styles.goal}>Objectif : {money(projection.goal.targetMonthEnd)}<br />Écart à combler : {money(projection.goal.gapToGoal)}</p>}
      {projection.diagnostics.length > 0 && <details className={styles.cockpitDetails}><summary>{projection.diagnostics.length} information(s) & contraintes</summary><ul>{projection.diagnostics.map((d, i) => <li key={`${d.code}:${i}`}>{d.message ?? d.code}</li>)}</ul></details>}
    </div>
    <footer className={styles.cockpitFooter}><button data-balance className={styles.secondary} disabled={busy} onClick={balance}>Explorer les ajustements</button><button data-preview className={styles.secondary} disabled={busy} onClick={preview}>Prévisualiser le mois</button>
      <button className={styles.primary} data-apply disabled={busy || temporary || !dirty || projection.applyReadiness === "BLOCKED"} onClick={apply}>{busy ? "Validation en cours…" : "Appliquer le mois"}</button>
      <small>{projection.applyReadiness === "BLOCKED" ? "Complétez les informations bloquantes." : revision ? `Revision ${revision} appliquée · nouveau brouillon libre` : "Rien n’est enregistré avant Appliquer."}</small></footer>
  </aside>;
}
