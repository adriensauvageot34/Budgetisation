import type { PlanProjectionV1 } from "@/domain/phase2/planner/projection-contract";
import { ArrowUpRight } from "lucide-react";
import { money } from "./display";
import styles from "./composer.module.css";
const signedMoney = (value: string | null) => value === null ? "—" : `${Number(value) > 0 ? "+" : ""}${money(value)}`;
const tone = (value: string | null) => value === null ? "unknown" : value.startsWith("-") ? "attention" : "positive";
const hudMoney = (value: string | null) => value === null ? "À préciser" : money(value);
/** Only official C7 values. Separate indicators are never summed in React. */
export function ComposerCockpit({ projection, goalMargin, temporary, pending, stale = false, staleLabel, canonicalRemainder, interactionImpact, variant, details }: { projection: PlanProjectionV1; goalMargin: string | null; temporary: boolean; pending?: boolean; stale?: boolean; staleLabel?: string; canonicalRemainder?: string | null; interactionImpact?: string | null; variant?: boolean; details?: () => void }) {
  const impact = temporary ? interactionImpact ?? null : projection.plan.impactOnMonthEnd;
  const hasImpact = temporary || impact !== null && Number(impact) !== 0;
  const hasSavings = projection.economic.savingsReservations !== null && Number(projection.economic.savingsReservations) !== 0;
  return <div className={styles.financialHud} data-cockpit data-temporary={temporary} data-calculating={pending} data-stale={stale} aria-label={stale ? staleLabel ?? "Projection en attente de simulation" : "Projection financière du mois"}>
    <button className={styles.hudMain} data-financial-details onClick={details} title="Reste prévisionnel, distinct du solde bancaire actuel. Voir les finances du mois.">
      <span>{temporary ? "Hypothèse · reste prévisionnel" : variant ? "Variante · reste prévisionnel" : "Reste prévisionnel du mois"}</span>
      <strong key={stale ? "stale" : projection.plan.economicMonthEndRemainder} data-remainder>{stale ? "—" : hudMoney(projection.plan.economicMonthEndRemainder)}</strong>
      {temporary && !stale && <small data-canonical-remainder>Scénario actuel {hudMoney(canonicalRemainder ?? null)}</small>}</button>
    {hasImpact && <div className={styles.hudMetric} data-gesture-impact={temporary || undefined} data-tone={stale ? "unknown" : tone(impact)} title={temporary ? "Impact de ce geste, calculé par le serveur" : "Impact consolidé par rapport à la référence"}><span>{temporary ? "Impact du geste" : "Impact de mes choix"}</span><b>{stale ? "—" : signedMoney(impact)}</b></div>}
    {hasSavings && <div className={styles.hudMetric} title="Somme réservée dans le scénario, pas un mouvement bancaire"><span>Cagnottes réservées</span><b>{stale ? "—" : money(projection.economic.savingsReservations)}</b></div>}
    {projection.goal.targetMonthEnd !== null && <div className={styles.hudMetric}><span>Objectif</span><b>{stale ? "—" : money(projection.goal.targetMonthEnd)}</b><small data-tone={stale ? "unknown" : tone(goalMargin)}>Marge sur l’objectif {stale ? "—" : signedMoney(goalMargin)}</small></div>}
    <div className={styles.hudEnd}><span className={styles.previewStatus} data-hud-status>{pending ? "Simulation en cours…" : stale ? staleLabel ?? "Projection à recalculer" : projection.projectionCompleteness === "COMPLETE" ? "Projection à jour" : "Projection à compléter"}</span>
      <button className={styles.financialLink} data-open-finances onClick={details}>Les finances du mois <ArrowUpRight size={15} /></button></div>
  </div>;
}
/** Complete published breakdown; UNKNOWN is never replaced by zero. */
export function ComposerProjectionDetails({ projection, stale = false }: { projection: PlanProjectionV1; stale?: boolean }) {
  const rows = [["Ressources du mois", projection.economic.resources], ["Engagements certains", projection.economic.certainCommitments],
    ["Besoins & habitudes", projection.economic.needsAndHabits], ["Budgets discrétionnaires", projection.economic.discretionaryLife], ["Intentions ponctuelles", projection.economic.explicitContexts],
    ["Coût d’usage mobilité", projection.economic.mobilityUsageEconomicCost], ["Cagnottes réservées", projection.economic.savingsReservations]];
  const display = (value: string | null) => stale ? "En attente" : money(value);
  return <div className={styles.projectionDetails}>
    <p className={styles.financeExplanation}>Ce que prévoient vos choix pour le mois, distinct du solde bancaire d’aujourd’hui.</p>
    {stale && <p role="status" className={styles.financeNotice}>Vos choix ont changé. Les chiffres attendent une simulation à jour ; le brouillon reste conservé.</p>}
    {projection.projectionCompleteness !== "COMPLETE" && !stale && <p className={styles.financeNotice}>Certaines informations restent à préciser. Une valeur connue ne rend pas l’ensemble certain.</p>}
    <dl className={styles.breakdown}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{display(value)}</dd></div>)}</dl>
    <dl className={styles.financeComparison}><div><dt>Situation de référence</dt><dd>{display(projection.baseline.economicMonthEndRemainder)}</dd></div><div><dt>Impact consolidé de mes choix</dt><dd>{stale ? "En attente" : signedMoney(projection.plan.impactOnMonthEnd)}</dd></div><div><dt>Reste prévisionnel</dt><dd>{display(projection.plan.economicMonthEndRemainder)}</dd></div></dl>
    <p className={styles.financeExplanation}>Ces rubriques décrivent les résultats publiés ; elles ne forment pas un nouveau total à additionner. Une réservation n’est pas un virement.</p>
    <details className={styles.cockpitDetails}><summary>Trésorerie, financement & déplacements</summary><p>Financement : {stale ? "en attente" : projection.funding.status === "COMPLETE" ? "établi" : "à compléter"}</p>
      <p>Allocation à préciser : {stale ? "En attente" : money(projection.funding.unallocatedEconomicAmount)}</p><p>Financement à compléter : {stale ? "En attente" : money(projection.funding.fundingToComplete)}</p>
      <p>Point bas Banque : {display(projection.cash.lowPointAmount)}{!stale && projection.cash.lowPointDate ? ` · ${projection.cash.lowPointDate}` : " · date non établie"}</p>
      <p>Un coût d’usage estimé en voiture n’est pas un achat de carburant payé.</p><p>{projection.mobility.journeyCount} trajet(s) physique(s) · {projection.mobility.unresolvedJourneyCount} à préciser</p>
      <p>Montant économique non résolu : {display(projection.economic.unresolvedEconomicAmount)}</p></details>
    {projection.goal.targetMonthEnd !== null && <p className={styles.goal}>Objectif : {display(projection.goal.targetMonthEnd)} · Écart à combler : {display(projection.goal.gapToGoal)}</p>}
    {projection.diagnostics.length > 0 && <details className={styles.cockpitDetails} data-finance-diagnostics><summary>Diagnostics avancés ({projection.diagnostics.length})</summary><ul>{projection.diagnostics.map((d, i) => <li key={`${d.code}:${i}`}><code>{d.code}</code>{d.message && ` · ${d.message}`}</li>)}</ul></details>}
  </div>;
}
