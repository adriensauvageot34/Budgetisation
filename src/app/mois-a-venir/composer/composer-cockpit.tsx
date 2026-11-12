import type { PlanProjectionV1 } from "@/domain/phase2/planner/projection-contract";
import type { ComposerBudgetReading } from "@/domain/phase2/planner/composer-contract";
import { useContext } from "react";
import { BudgetPreviewStatus } from "./intent-budget-impact";
import { ArrowUpRight } from "lucide-react";
import { money } from "./display";
import styles from "./composer.module.css";
const signedMoney = (value: string | null) => value === null ? "—" : `${Number(value) > 0 ? "+" : ""}${money(value)}`;
const tone = (value: string | null) => value === null ? "unknown" : value.startsWith("-") ? "attention" : "positive";
const hudMoney = (value: string | null) => value === null ? "Montant à préciser" : money(value);
const completenessLabel = { COMPLETE: "Complète", PARTIAL: "Partielle", UNKNOWN: "Indéterminée" };
const applyLabel = { READY: "Prête", READY_WITH_WARNINGS: "Prête avec avertissements", BLOCKED: "Bloquée" };
const simulationLabels = { FRESH: "Actualisée", BLOCKED: "Calcul bloqué", PENDING: "En cours", STALE: "À recalculer", FAILED: "Échec de lecture" };

export function MonthlySimulationStatus({ projection, stale = false }: { projection: PlanProjectionV1; stale?: boolean }) {
  const preview = useContext(BudgetPreviewStatus);
  const status = preview ?? (stale ? "STALE" : projection.applyReadiness === "BLOCKED" ? "BLOCKED" : "FRESH");
  const current = !stale && (status === "FRESH" || status === "BLOCKED");
  return <dl className={styles.breakdown} aria-label="État des finances">
    <div><dt>Simulation</dt><dd data-financial-preview={status}>{simulationLabels[status]}</dd></div>
    <div><dt>Complétude financière</dt><dd data-financial-completeness={current ? projection.projectionCompleteness : undefined}>
      {current ? completenessLabel[projection.projectionCompleteness] : "À vérifier"}</dd></div>
    <div><dt>Vérification avant de créer un Plan</dt><dd data-financial-apply-readiness={current ? projection.applyReadiness : undefined}>
      {current ? applyLabel[projection.applyReadiness] : "À vérifier"}</dd></div>
  </dl>;
}
const monthProjectionLabel = (projection: PlanProjectionV1) => projection.projectionCompleteness === "UNKNOWN"
  ? "Projection du mois indisponible" : "Projection du mois actualisée";
/** Only official C7 values. Separate indicators are never summed in React. */
export function ComposerCockpit({ projection, goalMargin, temporary, pending, stale = false, staleLabel, canonicalRemainder, interactionImpact, variant, details, retry }: { projection: PlanProjectionV1; goalMargin: string | null; temporary: boolean; pending?: boolean; stale?: boolean; staleLabel?: string; canonicalRemainder?: string | null; interactionImpact?: string | null; variant?: boolean; details?: () => void; retry?: () => void }) {
  const impact = temporary ? interactionImpact ?? null : projection.plan.impactOnMonthEnd;
  const hasImpact = temporary || impact !== null && Number(impact) !== 0;
  const hasSavings = projection.economic.savingsReservations !== null && Number(projection.economic.savingsReservations) !== 0;
  return <div className={styles.financialHud} data-cockpit data-temporary={temporary} data-calculating={pending} data-stale={stale} aria-label={stale ? staleLabel ?? "Projection en attente de simulation" : "Projection financière du mois"}>
    <button className={styles.hudMain} data-financial-details onClick={details} title="Reste prévisionnel, distinct du solde bancaire actuel. Voir les finances du mois.">
      <span>{temporary ? "Hypothèse · reste prévisionnel" : variant ? "Variante · reste prévisionnel" : "Reste prévisionnel du mois"}</span>
      <strong key={stale ? "stale" : projection.plan.economicMonthEndRemainder} data-remainder data-unknown={!stale && projection.plan.economicMonthEndRemainder === null}>{stale ? "—" : hudMoney(projection.plan.economicMonthEndRemainder)}</strong>
      {temporary && !stale && <small data-canonical-remainder>Scénario actuel {hudMoney(canonicalRemainder ?? null)}</small>}</button>
    {hasImpact && <div className={styles.hudMetric} data-gesture-impact={temporary || undefined} data-tone={stale ? "unknown" : tone(impact)} title={temporary ? "Impact de ce geste, calculé par le serveur" : "Impact consolidé par rapport à la référence"}><span>{temporary ? "Impact du geste" : "Impact de mes choix"}</span><b>{stale ? "—" : signedMoney(impact)}</b></div>}
    {hasSavings && <div className={styles.hudMetric} title="Somme réservée dans le scénario, pas un mouvement bancaire"><span>Cagnottes réservées</span><b>{stale ? "—" : money(projection.economic.savingsReservations)}</b></div>}
    {projection.goal.targetMonthEnd !== null && <div className={styles.hudMetric}><span>Objectif</span><b>{stale ? "—" : money(projection.goal.targetMonthEnd)}</b><small data-tone={stale ? "unknown" : tone(goalMargin)}>Marge sur l’objectif {stale ? "—" : signedMoney(goalMargin)}</small></div>}
    <div className={styles.hudEnd}><span className={styles.previewStatus} data-hud-status>{pending ? "Simulation en cours…" : stale ? staleLabel ?? "Projection à recalculer" : projection.projectionCompleteness === "PARTIAL" ? "Projection actualisée · données partielles" : monthProjectionLabel(projection)}</span>
      {retry && <button type="button" className={styles.financialLink} onClick={retry}>Réessayer la simulation</button>}
      <button className={styles.financialLink} data-open-finances onClick={details}>Les finances du mois <ArrowUpRight size={15} /></button></div>
  </div>;
}
/** Complete published breakdown; UNKNOWN is never replaced by zero. */
export function ComposerProjectionDetails({ projection, stale = false, budgetReading, showStatus = true }: {
  projection: PlanProjectionV1; stale?: boolean; budgetReading?: ComposerBudgetReading; showStatus?: boolean;
}) {
  const rows = [["Engagements certains", projection.economic.certainCommitments],
    ["Besoins & habitudes", projection.economic.needsAndHabits], ["Budgets discrétionnaires", projection.economic.discretionaryLife], ["Intentions ponctuelles", projection.economic.explicitContexts],
    ["Coût d’usage mobilité", projection.economic.mobilityUsageEconomicCost]];
  const display = (value: string | null) => stale ? "En attente" : money(value);
  const missingDeclarations = budgetReading?.missingMonthlyDeclarations ?? [];
  const missingSalaries = budgetReading?.missingSalaryForecasts ?? [];
  return <div className={styles.projectionDetails}>
    <section className={styles.financeSummary} aria-label="Projection du mois">
      <span>Reste prévisionnel du mois</span><strong data-finance-summary>{stale ? "En attente de simulation" : projection.plan.economicMonthEndRemainder === null ? "Projection incomplète" : money(projection.plan.economicMonthEndRemainder)}</strong>
      {stale && <p>Les résultats attendent une nouvelle simulation.</p>}
      {showStatus && <MonthlySimulationStatus projection={projection} stale={stale} />}
      {!stale && projection.projectionCompleteness === "UNKNOWN" && <p>Projection du mois indisponible. Les montants évalués par intention gardent leur portée.</p>}
      {!stale && projection.diagnostics.some(diagnostic => diagnostic.code === "FINANCIAL_SCENARIO_UNRESOLVED") && <>
        {missingDeclarations.length > 0 && <p>Chargements mensuels à renseigner dans le Centre de contrôle : {missingDeclarations.join(" et ")}. Ces déclarations établissent les ressources de titres-restaurant du mois.</p>}
        {missingSalaries.length > 0 && <p>Montant manquant dans la prévision des salaires : {missingSalaries.join(" et ")}. Ces revenus servent à établir les ressources du mois.</p>}
        {missingDeclarations.length === 0 && missingSalaries.length === 0 && <p>Les sources disponibles ne permettent pas d’établir les ressources du mois. Vérifiez les ressources dans le Centre de contrôle.</p>}
      </>}
    </section>
    <p className={styles.financeExplanation}>Une projection du mois, distincte du solde bancaire d’aujourd’hui.</p>
    <dl className={styles.financeResources}><div><dt>Ressources du mois</dt><dd>{display(projection.economic.resources)}</dd></div></dl>
    <section className={styles.financeSection}><h3>Ce que prévoit votre mois</h3>
      <dl className={styles.breakdown}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{display(value)}</dd></div>)}</dl>
    </section>
    <section className={styles.financeSection}><h3>Épargne réservée</h3><dl className={styles.breakdown}><div><dt>Cagnottes réservées</dt><dd>{display(projection.economic.savingsReservations)}</dd></div></dl>
      <p className={styles.financeExplanation}>Une réservation n’est ni une consommation ni un virement bancaire.</p></section>
    <details className={styles.cockpitDetails}><summary>Référence et impact de mes choix</summary>
      <dl className={styles.financeComparison}><div><dt>Situation de référence</dt><dd>{display(projection.baseline.economicMonthEndRemainder)}</dd></div><div><dt>Impact consolidé de mes choix</dt><dd>{stale ? "En attente" : signedMoney(projection.plan.impactOnMonthEnd)}</dd></div></dl>
      <p className={styles.financeExplanation}>Les rubriques sont publiées par le moteur. Elles ne forment pas un nouveau total à additionner.</p></details>
    <details className={styles.cockpitDetails}><summary>Trésorerie, financement & déplacements</summary><p>Financement : {stale ? "en attente" : projection.funding.status === "COMPLETE" ? "établi" : "à compléter"}</p>
      <p>Allocation à préciser : {stale ? "En attente" : money(projection.funding.unallocatedEconomicAmount)}</p><p>Financement à compléter : {stale ? "En attente" : money(projection.funding.fundingToComplete)}</p>
      <p>Point bas Banque : {display(projection.cash.lowPointAmount)}{!stale && projection.cash.lowPointDate ? ` · ${projection.cash.lowPointDate}` : " · date non établie"}</p>
      <p>Un coût d’usage estimé en voiture n’est pas un achat de carburant payé.</p><p>{projection.mobility.journeyCount} trajet(s) physique(s) · {projection.mobility.unresolvedJourneyCount} à préciser</p>
      <p>Montant économique non résolu : {display(projection.economic.unresolvedEconomicAmount)}</p></details>
    {projection.goal.targetMonthEnd !== null && <p className={styles.goal}>Objectif : {display(projection.goal.targetMonthEnd)} · Écart à combler : {display(projection.goal.gapToGoal)}</p>}
    {projection.diagnostics.length > 0 && <details className={styles.cockpitDetails} data-finance-diagnostics><summary>Diagnostics avancés ({projection.diagnostics.length})</summary><ul>{projection.diagnostics.map((d, i) => <li key={`${d.code}:${i}`}><code>{d.code}</code>{d.message && ` · ${d.message}`}</li>)}</ul></details>}
  </div>;
}
