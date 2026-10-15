import type { PlanProjectionV1 } from "@/domain/phase2/planner/projection-contract";
import type { OfficialPlanComparisonV1, OfficialDecisionImpact } from "@/domain/phase2/planner/official-comparison-contract";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { AppliedPlanControl } from "@/server/phase2/planner/applied-plan-read";
import type { MonthEconomicPlan } from "@/server/phase2/month-scenario";
import type { ComposerMobilitySummary } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComponentProps, ReactNode } from "react";
import { ArrowUpRight, ChevronDown, LockKeyhole, Route, Sparkles, Wallet, SlidersHorizontal } from "lucide-react";
import { BankStockCard } from "./bank-stock-card";
import { ResourceEditor } from "./resource-editor";
import { PlannedExpensesControl } from "./planned-expenses-control";
import { MonthControlLink } from "./month-control-center";
import { MonthCalendar } from "./month-calendar";
import { projectMonthCalendar, type PlannedExpenseCard } from "./planned-expenses-projection";
import { MobilityEstimateSummary } from "./composer/mobility-estimate-summary";
import { money, quantityLabel } from "./composer/display";
import { AppliedPlanDetail, contextLabel, contextLabels, coverageLabel } from "./applied-plan-detail";
import styles from "./applied-month.module.css";

const signedMoney = (amount: string | null) => amount === null ? "À préciser" : `${Number(amount) > 0 ? "+" : ""}${money(amount)}`;
function MarginalDetail({ decision }: { decision?: OfficialDecisionImpact }) {
  if (!decision) return null;
  return <details className={styles.advanced}><summary>Comprendre l’effet de cette décision</summary>
    <p>{decision.marginalImpactOnMonthEnd === null ? "L’effet isolé ne peut pas être établi avec les informations actuelles."
      : <>Comparaison avec le même Plan sans cette décision : <strong>{signedMoney(decision.marginalImpactOnMonthEnd)}</strong> sur le reste prévisionnel.</>}</p>
    <p>Cette comparaison dépend des autres choix. Elle ne s’ajoute pas aux autres effets pour former le total du mois.</p>
    {!!decision.interactingDecisionIds.length && <p>Cette décision partage une capacité, un moment ou un trajet avec d’autres choix du Plan.</p>}
  </details>;
}
function DecisionGroup({ title, count, icon, children }: { title: string; count: number; icon: ReactNode; children: ReactNode }) {
  if (!count) return null;
  return <details className={styles.decisionGroup} open={count <= 6}><summary>{icon}<span>{title}</span><small>{count}</small><ChevronDown size={17} aria-hidden="true" /></summary>
    <div className={styles.decisionGrid}>{children}</div>
  </details>;
}

/** Display only: all money comes from B1/V2. Marginals and overlapping lenses are never summed. */
export function AppliedMonthView({ projection, semanticState, controls = [], plan, external, revision, evidenceStatus = "EXACT", historicalRemainder = null, composerHref, today, calendarCarryovers = [], persons = [], mobility = [], places = [], comparison }: {
  projection: PlanProjectionV1; semanticState: PlanSemanticStateV1; controls?: readonly AppliedPlanControl[]; plan: MonthEconomicPlan | null;
  external?: ComponentProps<typeof PlannedExpensesControl>; revision: number; evidenceStatus?: "EXACT" | "CHANGED_AUTHORITIES" | "NOT_APPLICABLE";
  historicalRemainder?: string | null; composerHref?: string; today: string; comparison?: OfficialPlanComparisonV1;
  calendarCarryovers?: readonly PlannedExpenseCard[]; persons?: readonly { personId: string; displayName: string }[];
  mobility?: readonly ComposerMobilitySummary[]; places?: readonly import("@/domain/phase2/planned-places").PlannedPlaceOption[];
}) {
  const budgets = controls.filter(control => !control.savings), savingsControls = controls.filter(control => control.savings);
  const unchangedSavings = plan?.savingsAllocations.items.filter(item => !savingsControls.some(control => control.savings?.reservationId === item.id)) ?? [];
  const roots = semanticState.contexts.filter(context => !context.parentContextOccurrenceId);
  const journeys = [...new Map(mobility.map(summary => [summary.journeyId, summary])).values()];
  const journeyContextLabel = (id: string) => {
    const context = semanticState.contexts.find(context => context.contextOccurrenceId === id);
    return context ? contextLabel(context) : "Moment du Plan";
  };
  const status = comparison?.freshness.activeRevision;
  const rows = [["Ressources", projection.economic.resources], ["Engagements certains", projection.economic.certainCommitments],
    ["Besoins et habitudes", projection.economic.needsAndHabits], ["Vie et envies", projection.economic.discretionaryLife],
    ["Épargne réservée", projection.economic.savingsReservations], ["Usage mobilité", projection.economic.mobilityUsageEconomicCost]];
  const currentHref = `/mois-a-venir?month=${projection.targetMonth}`;
  return <div data-applied-month data-official-comparison={comparison?.version} data-active-revision-status={status} className={styles.appliedMonth}>
    <section id="final-projection" className={styles.hero} aria-labelledby="plan-summary-title">
      <div className={styles.heroHeading}><span>MON PLAN · RÉVISION {revision}</span><span>Projection économique</span></div>
      <div className={styles.heroGrid}><div><h2 id="plan-summary-title">Votre mois, avec Mon Plan</h2><p className={styles.amountLabel}>Reste prévisionnel du mois</p>
        <p data-applied-remainder className={styles.mainAmount}>{money(projection.plan.economicMonthEndRemainder)}</p></div>
        <dl className={styles.comparison}><div><dt>Sans les modifications du Plan</dt><dd data-plan-reference>{money(projection.baseline.economicMonthEndRemainder)}</dd></div>
          <div><dt>Impact du Plan sur le reste</dt><dd data-plan-net-impact data-direction={projection.plan.impactOnMonthEnd === null ? "unknown" : Number(projection.plan.impactOnMonthEnd) > 0 ? "positive" : "neutral"}>{signedMoney(projection.plan.impactOnMonthEnd)}</dd></div></dl></div>
      <div className={styles.heroFoot}><p>Une estimation de fin de mois, distincte de l’argent actuellement en banque.</p><div className={styles.actions}>
        <a href="#my-plan-title" className={styles.secondaryAction}>Voir les décisions</a>{composerHref && <a href={composerHref} className={styles.primaryAction}>Modifier dans Composer <ArrowUpRight size={15} aria-hidden="true" /></a>}</div></div>
      {status === "SUPERSEDED" && <div role="status" className={styles.notice}><strong>Une version plus récente de votre Plan existe.</strong><p>Les montants affichés restent attachés à la révision {revision}.</p><a href={currentHref}>Consulter la dernière version</a></div>}
      {status === "UNAVAILABLE" && <div role="status" className={styles.notice}><strong>La dernière version n’a pas pu être vérifiée.</strong><p>Les informations connues de la révision {revision} restent affichées.</p><a href={currentHref}>Vérifier à nouveau</a></div>}
      {evidenceStatus === "CHANGED_AUTHORITIES" && <div data-applied-authorities-changed role="status" className={styles.notice}><strong>Prévision actualisée depuis la validation de votre Plan.</strong><p>Les décisions sont conservées ; les montants utilisent les données financières actuelles.</p></div>}
      {projection.plan.economicMonthEndRemainder === null && <p className={styles.uncertainty}>Certaines informations manquent pour établir le reste du mois. Les montants déjà connus restent disponibles ci-dessous.</p>}
    </section>

    <section data-my-plan aria-labelledby="my-plan-title" className={styles.decisions}>
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>VOS DÉCISIONS OFFICIELLES</p><h2 id="my-plan-title">Ce qui change avec Mon Plan</h2></div><p>Ouvrez une décision pour comprendre son coût et sa couverture.</p></div>
      <DecisionGroup title="Budgets et habitudes modifiés" count={budgets.length} icon={<SlidersHorizontal size={18} aria-hidden="true" />}>
        {budgets.map(control => {
          const slot = comparison?.slots.find(row => row.planSlotId === control.planSlotId), decision = comparison?.decisions.find(row => row.decisionId === control.decisionId);
          return <details key={control.decisionId} className={styles.decisionCard} data-plan-control={control.slotIdentityKey}><summary>
            <span className={styles.cardHeading}><strong>{control.label}</strong><ChevronDown size={15} aria-hidden="true" /></span>
            <span className={styles.cardValue}>{control.amount !== null ? <>{slot?.baselineValue.amount !== undefined && <span className={styles.referenceValue}>{money(slot.baselineValue.amount)} {evidenceStatus === "CHANGED_AUTHORITIES" ? "de référence actuelle" : "prévus"} → </span>}{money(control.amount)} décidés</>
              : <>{quantityLabel(control.count)} occurrence(s){control.unitAmount !== null ? ` · ${money(control.unitAmount)} par occurrence décidé` : ""}</>}</span>
            <span className={styles.cardNote}>Remplace la capacité correspondante{decision?.interactingDecisionIds.length ? " · lié à d’autres choix" : ""}</span>
          </summary><div className={styles.cardBody}><p>Décision explicite conservée dans la révision {revision}.</p><MarginalDetail decision={decision} /></div></details>;
        })}
      </DecisionGroup>
      <DecisionGroup title="Événements et dépenses ponctuelles" count={roots.length} icon={<Sparkles size={18} aria-hidden="true" />}>
        {roots.map(context => {
          const parts = comparison?.components.filter(row => row.contextOccurrenceId === context.contextOccurrenceId && !row.physicalJourneyRequirementId) ?? [];
          const decision = comparison?.decisions.find(row => row.decisionId === context.contextOccurrenceId);
          return <details key={context.contextOccurrenceId} className={styles.decisionCard} data-plan-context={context.contextOccurrenceId} data-plan-gift={context.templateKey === "gift" ? context.contextOccurrenceId : undefined} data-plan-night-out={context.templateKey === "night-out" ? context.contextOccurrenceId : undefined} data-plan-short-stay={context.templateKey === "short-stay" ? context.contextOccurrenceId : undefined} data-plan-family-visit={context.templateKey === "family-visit" ? context.contextOccurrenceId : undefined}>
            <summary><span className={styles.cardHeading}><strong>{contextLabel(context)}</strong><ChevronDown size={15} aria-hidden="true" /></span>
              <span className={styles.cardValue}>{parts.length === 1 ? money(parts[0].effect.grossAmount) : parts.length > 1 ? <>Postes distincts : {parts.slice(0, 2).map(part => money(part.effect.grossAmount)).join(" · ")}{parts.length > 2 ? " · voir le détail" : ""}</> : contextLabels[context.templateKey] ?? "Moment du Plan"}</span>
              <span className={styles.cardNote}>{parts.length === 1 ? coverageLabel(parts[0].effect) : context.templateKey === "short-stay" ? "Hébergement, moments et trajet liés" : "Détails et informations à préciser"}</span>
              <span className={styles.cardMeta}>{typeof context.fields.plannedDate === "string" ? context.fields.plannedDate : "Date non fixée"}</span>
            </summary><div className={styles.cardBody}><AppliedPlanDetail context={context} state={semanticState} comparison={comparison} persons={persons} places={places} /><MarginalDetail decision={decision} /></div>
          </details>;
        })}
      </DecisionGroup>
      <DecisionGroup title="Épargne et réservations" count={savingsControls.length + unchangedSavings.length} icon={<Wallet size={18} aria-hidden="true" />}>
        {savingsControls.map(control => <details className={styles.decisionCard} key={control.decisionId} data-plan-control={control.slotIdentityKey} data-plan-saving={control.savings!.reservationId}><summary><span className={styles.cardHeading}><strong>{control.label}</strong><LockKeyhole size={15} aria-hidden="true" /></span><span className={styles.cardValue}>{money(control.amount)} réservés</span><span className={styles.cardNote}>{control.savings!.adjustability === "PROTECTED" ? "Réservation protégée" : "Réservation ajustable"} · aucun mouvement bancaire créé</span></summary><div className={styles.cardBody}><p>Montant déclaré à l’application : {money(control.savings!.declaredAmount)}. Cette réservation n’est pas une consommation.</p><MarginalDetail decision={comparison?.decisions.find(row => row.decisionId === control.decisionId)} /></div></details>)}
        {unchangedSavings.map(item => <details className={styles.decisionCard} key={item.id} data-plan-saving={item.id}><summary><span className={styles.cardHeading}><strong>{item.label}</strong><LockKeyhole size={15} aria-hidden="true" /></span><span className={styles.cardValue}>{money(item.amount)} réservés</span><span className={styles.cardNote}>{item.adjustability === "PROTECTED" ? "Protégée des ajustements automatiques" : "Réservation ajustable"} · déjà prévue</span></summary><div className={styles.cardBody}><p>L’argent reste dans le patrimoine du foyer. Aucun virement n’est créé par cette lecture.</p><MonthControlLink section="choices" focus={`savings:${item.id}`}>Consulter dans le Centre de contrôle</MonthControlLink></div></details>)}
      </DecisionGroup>
      <DecisionGroup title="Déplacements" count={journeys.length} icon={<Route size={18} aria-hidden="true" />}>
        {journeys.map(summary => <details key={summary.journeyId} className={styles.decisionCard} data-plan-journey={summary.journeyId}><summary><span className={styles.cardHeading}><strong>{summary.vehicleLabel ?? "Déplacement du Plan"}</strong><ChevronDown size={15} aria-hidden="true" /></span><span className={styles.cardValue}>{summary.economicFuel !== null ? `${money(summary.economicFuel)} de coût d’usage estimé` : summary.fare !== null ? `${money(summary.fare)} pour le billet ou la course` : "Coût à préciser"}</span><span className={styles.cardNote}>Un trajet physique · {journeyContextLabel(summary.contextOccurrenceId)}</span></summary><div className={styles.cardBody}><MobilityEstimateSummary summary={summary} /><p>Le coût d’usage n’est pas un plein de carburant payé. Un trajet partagé n’ajoute pas un autre trajet payant.</p></div></details>)}
      </DecisionGroup>
      {!budgets.length && !roots.length && !savingsControls.length && !unchangedSavings.length && !journeys.length && <p className={styles.empty}>Aucune modification explicite dans cette révision. La projection reste celle du scénario officiel.</p>}
    </section>

    <details id="plan-understand" className={styles.projectionDetail}><summary><span><strong>Comprendre ma projection</strong><small>Ressources, dépenses, épargne et limites de l’estimation</small></span><ChevronDown size={19} aria-hidden="true" /></summary>
      <div className={styles.projectionBody}><dl className={styles.lenses}>{rows.map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{money(amount)}</dd></div>)}</dl>
        <p>Ces postes viennent du même scénario financier. Les moments du Plan et leurs composants y sont déjà représentés : ils ne s’ajoutent pas une deuxième fois.</p>
        <p>Financement : {projection.funding.status === "COMPLETE" ? "renseigné" : "à compléter"}. Montant sans financement établi : {money(projection.funding.unallocatedEconomicAmount)}.</p>
        <p>Le financement et l’épargne réservée ne sont pas des dépenses économiques supplémentaires.</p>
        {evidenceStatus === "CHANGED_AUTHORITIES" && <p>Estimation enregistrée lors de l’application : {money(historicalRemainder)}. Le résumé utilise la prévision actuelle.</p>}
        <details id="plan-evidence" className={styles.advanced}><summary>Sources et informations techniques</summary><p>Révision {revision} · {comparison?.authorities.knowledgeCutoff ?? "date de connaissance non disponible"}</p>
          <p>Point bas bancaire : {money(projection.cash.lowPointAmount)} · {projection.cash.lowPointDate ?? "date non établie"}.</p>
          <ul>{projection.diagnostics.map((diagnostic, index) => <li key={`${diagnostic.code}:${index}`}>{diagnostic.message ?? diagnostic.code}</li>)}</ul>
          {comparison && <pre>{JSON.stringify({ revision: comparison.revision, freshness: comparison.freshness, authorities: comparison.authorities }, null, 2)}</pre>}
        </details></div>
    </details>
    <div className={styles.practicalGrid}>
      <details id="resources-title" className={styles.practical}><summary>Banque et ressources</summary><div className={styles.practicalBody}>{plan ? <><BankStockCard balance={plan.bankCash.currentRealBankBalance} /><div className={styles.resourceGrid}>{plan.resources.map(resource => <ResourceEditor key={resource.key} resource={resource} targetMonth={projection.targetMonth} controls={false} walletObservation={resource.key === "benefit:swile" ? plan.benefitWallets.SWILE.latestObservation : resource.key === "benefit:edenred" ? plan.benefitWallets.EDENRED.latestObservation : null} />)}</div></> : <p>Les ressources restent accessibles dans le Centre de contrôle.</p>}</div></details>
      <details id="timeline-title" className={styles.practical}><summary>Calendrier du mois</summary><div className={styles.practicalBody}>{plan && external ? <MonthCalendar targetMonth={projection.targetMonth} today={today} {...projectMonthCalendar(plan.certainOutflows.items, [...external.expenses, ...calendarCarryovers])} /> : <p>Calendrier disponible après renseignement des ressources.</p>}</div></details>
    </div>
    {external && (external.expenses.length > 0
      ? <details id="plan-external" className={styles.practical}><summary>Dépenses planifiées indépendantes · {external.expenses.length}</summary><div className={styles.practicalBody}><PlannedExpensesControl {...external} /></div></details>
      : <PlannedExpensesControl {...external} />)}
  </div>;
}
