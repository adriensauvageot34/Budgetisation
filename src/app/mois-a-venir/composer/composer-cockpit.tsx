import type { PlanProjectionV1 } from "@/domain/phase2/planner/projection-contract";
import { money } from "./display";
import styles from "./composer.module.css";
const signedMoney = (value: string | null) => value === null ? "—" : `${Number(value) > 0 ? "+" : ""}${money(value)}`;
const tone = (value: string | null) => value === null ? "unknown" : value.startsWith("-") ? "attention" : "positive";
const hudMoney = (value: string | null) => value === null ? "—" : money(value);
const unknownHint = "Disponible lorsque les éléments nécessaires sont renseignés.";
/** The former permanent cockpit is now a header HUD, using the same C7 fields. */
export function ComposerCockpit({ projection, goalMargin, temporary, pending, canonicalRemainder, interactionImpact, variant, details }: { projection: PlanProjectionV1; goalMargin: string | null; temporary: boolean; pending?: boolean; canonicalRemainder?: string | null; interactionImpact?: string | null; variant?: boolean; details?: () => void }) {
  return <div className={styles.financialHud} data-cockpit data-temporary={temporary} data-calculating={pending} aria-label="Projection financière du mois">
    <button className={styles.hudMain} data-financial-details onClick={details} title={projection.plan.economicMonthEndRemainder === null ? unknownHint : "Voir le détail financier"}>
      <span>{variant ? "Variante" : "Fin de mois"}{pending && <i className={styles.calculating}>Calcul…</i>}</span>
      <strong key={projection.plan.economicMonthEndRemainder} data-remainder>{hudMoney(projection.plan.economicMonthEndRemainder)}</strong>
      {temporary && <small data-canonical-remainder>Actuel {hudMoney(canonicalRemainder ?? null)}</small>}</button>
    <div className={styles.hudMetric} title={projection.baseline.economicMonthEndRemainder === null ? unknownHint : undefined}><span>Sans changements</span><b>{hudMoney(projection.baseline.economicMonthEndRemainder)}</b></div>
    <div className={styles.hudMetric} data-gesture-impact={temporary || undefined} data-tone={tone(temporary ? interactionImpact ?? null : projection.plan.impactOnMonthEnd)} title={temporary ? "Impact de ce geste, calculé par le serveur" : "Impact par rapport au mois sans changements"}><span>Impact</span><b>{signedMoney(temporary ? interactionImpact ?? null : projection.plan.impactOnMonthEnd)}</b></div>
    <div className={styles.hudMetric} title={projection.goal.targetMonthEnd === null ? unknownHint : undefined}><span>Objectif</span><b>{hudMoney(projection.goal.targetMonthEnd)}</b></div>
    <div className={styles.hudMetric} data-tone={tone(goalMargin)} title={goalMargin === null ? unknownHint : undefined}><span>Marge</span><b>{signedMoney(goalMargin)}</b></div>
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
