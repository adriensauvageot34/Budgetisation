import type { PlanProjectionV1 } from "@/domain/phase2/planner/projection-contract";
import { money } from "./display";
import styles from "./composer.module.css";
const signedMoney = (value: string | null) => value === null ? "À préciser" : `${Number(value) > 0 ? "+" : ""}${money(value)}`;
const tone = (value: string | null) => value === null ? "unknown" : value.startsWith("-") ? "negative" : "positive";
/** The former permanent cockpit is now a header HUD, using the same C7 fields. */
export function ComposerCockpit({ projection, goalMargin, temporary, pending, canonicalRemainder, interactionImpact, variant }: { projection: PlanProjectionV1; goalMargin: string | null; temporary: boolean; pending?: boolean; canonicalRemainder?: string | null; interactionImpact?: string | null; variant?: boolean }) {
  return <div className={styles.financialHud} data-cockpit data-temporary={temporary} data-calculating={pending} aria-label="Projection financière du mois">
    <div className={styles.hudMain}><span>{variant ? "Variante" : "Fin de mois"}{pending && <i className={styles.calculating}>Calcul…</i>}</span><strong data-remainder>{temporary && <small data-canonical-remainder>{money(canonicalRemainder ?? null)} → </small>}{money(projection.plan.economicMonthEndRemainder)}</strong>
      <span className={styles.hudImpact} data-gesture-impact={temporary || undefined} data-tone={tone(temporary ? interactionImpact ?? null : projection.plan.impactOnMonthEnd)}>{signedMoney(temporary ? interactionImpact ?? null : projection.plan.impactOnMonthEnd)} <small>{temporary ? "impact de ce geste" : "vs sans changements"}</small></span></div>
    <div className={styles.hudSecondary}><span>Objectif <b>{money(projection.goal.targetMonthEnd)}</b></span><span data-tone={tone(goalMargin)}>Marge <b>{signedMoney(goalMargin)}</b></span>
      <span className={styles.hudKnowledge}>{projection.projectionCompleteness === "COMPLETE" ? "Projection complète" : "Projection à compléter"}</span></div>
  </div>;
}
/** All original financing, timing and diagnostic information remains reachable. */
export function ComposerProjectionDetails({ projection }: { projection: PlanProjectionV1 }) {
  const rows = [["Sans changements", projection.baseline.economicMonthEndRemainder], ["Ressources", projection.economic.resources], ["Engagements certains", projection.economic.certainCommitments],
    ["Besoins & habitudes", projection.economic.needsAndHabits], ["Vie discrétionnaire", projection.economic.discretionaryLife], ["Contexts explicites", projection.economic.explicitContexts],
    ["Usage mobilité", projection.economic.mobilityUsageEconomicCost], ["Cagnottes réservées", projection.economic.savingsReservations]];
  return <div className={styles.projectionDetails}><dl className={styles.breakdown}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl>
    <details className={styles.cockpitDetails}><summary>Financement & timing</summary><p>Financement : {projection.funding.status === "COMPLETE" ? "établi" : "à compléter"}</p>
      <p>Allocation à préciser : {money(projection.funding.unallocatedEconomicAmount)}</p><p>Financement à compléter : {money(projection.funding.fundingToComplete)}</p>
      <p>Point bas Banque : {money(projection.cash.lowPointAmount)}{projection.cash.lowPointDate ? ` · ${projection.cash.lowPointDate}` : " · date non établie"}</p>
      <p>Un trajet en voiture peut représenter un usage économique de carburant sans débit Banque supplémentaire.</p><p>{projection.mobility.journeyCount} trajet(s) physique(s) · {projection.mobility.unresolvedJourneyCount} à préciser</p>
      <p>Montant non résolu : {money(projection.economic.unresolvedEconomicAmount)}</p></details>
    {projection.goal.targetMonthEnd !== null && <p className={styles.goal}>Objectif : {money(projection.goal.targetMonthEnd)} · Écart à combler : {money(projection.goal.gapToGoal)}</p>}
    {projection.diagnostics.length > 0 && <details className={styles.cockpitDetails}><summary>{projection.diagnostics.length} information(s) & contraintes</summary><ul>{projection.diagnostics.map((d, i) => <li key={`${d.code}:${i}`}>{d.message ?? d.code}</li>)}</ul></details>}
  </div>;
}
