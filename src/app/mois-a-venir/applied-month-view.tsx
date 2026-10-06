import type { PlanProjectionV1 } from "@/domain/phase2/planner/projection-contract";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { MonthEconomicPlan } from "@/server/phase2/month-scenario";
import type { ComponentProps } from "react";
import { BankStockCard } from "./bank-stock-card";
import { ResourceEditor } from "./resource-editor";
import { PlannedExpensesControl } from "./planned-expenses-control";
import { MonthCalendar } from "./month-calendar";
import { projectMonthCalendar, type PlannedExpenseCard } from "./planned-expenses-projection";
import { money } from "./composer/display";
import material from "./month-material.module.css";

/** Applied financial values come directly from C7, including unknowns. Existing
 * independent resource and external-intent editors retain their owners. */
export function AppliedMonthView({ projection, semanticState, plan, external, revision, composerHref, today, calendarCarryovers = [] }: {
  projection: PlanProjectionV1; semanticState: PlanSemanticStateV1; plan: MonthEconomicPlan | null;
  external?: ComponentProps<typeof PlannedExpensesControl>; revision: number; composerHref?: string; today: string;
  calendarCarryovers?: readonly PlannedExpenseCard[];
}) {
  const rows = [["Ressources", projection.economic.resources], ["Engagements certains", projection.economic.certainCommitments],
    ["Besoins & habitudes", projection.economic.needsAndHabits], ["Vie & envies", projection.economic.discretionaryLife],
    ["Contexts explicites", projection.economic.explicitContexts], ["Usage mobilité", projection.economic.mobilityUsageEconomicCost],
    ["Cagnottes réservées", projection.economic.savingsReservations]];
  return <div data-applied-month className="space-y-7">
    <section className={`${material.glassPremium} p-6`}><p className="text-sm text-slate-600">Plan appliqué · Revision {revision}</p>
      <h2 id="final-projection" className="mt-2 text-2xl font-black">Projection de fin de mois</h2>
      <p data-applied-remainder className="mt-3 text-4xl font-black">{money(projection.plan.economicMonthEndRemainder)}</p>
      <p className="mt-2 text-sm text-slate-600">Reste économique · impact vs socle : {money(projection.plan.impactOnMonthEnd)}</p>
      <p className="mt-2 text-sm">{projection.projectionCompleteness === "COMPLETE" ? "Projection complète" : "Des informations restent à préciser dans Composer."}</p>
      {composerHref && <a className="mt-4 inline-block font-bold underline" href={composerHref}>Modifier dans Composer mon mois</a>}
    </section>
    <section className={`${material.glassSecondary} p-6`}><h2 className="text-xl font-black">Les postes du même scénario</h2>
      <dl className="mt-4 grid grid-cols-2 gap-4">{rows.map(([label, amount]) => <div key={label}><dt className="text-sm text-slate-600">{label}</dt><dd className="text-xl font-bold">{money(amount)}</dd></div>)}</dl>
      <p className="mt-4 text-sm text-slate-600">Ces vues expliquent le scénario. Le montant de fin de mois est celui calculé par le Planner.</p>
    </section>
    <section className={`${material.glassSecondary} p-6`}><h2 id="resources-title" className="text-xl font-black">Banque & ressources</h2>
      {plan ? <><div className="mt-4"><BankStockCard balance={plan.bankCash.currentRealBankBalance} /></div>
      <div className="mt-4 grid grid-cols-2 gap-3">{plan.resources.map(resource => <ResourceEditor key={resource.key} resource={resource} targetMonth={projection.targetMonth} controls={false}
        walletObservation={resource.key === "benefit:swile" ? plan.benefitWallets.SWILE.latestObservation : resource.key === "benefit:edenred" ? plan.benefitWallets.EDENRED.latestObservation : null} />)}</div>
      </> : <p className="mt-3 text-sm">Complétez les ressources dans le Centre de contrôle.</p>}
    </section>
    <section className={`${material.glassSecondary} p-6`}><h2 id="plan-contexts" className="text-xl font-black">Moments du Plan</h2>
      <ul className="mt-4 space-y-3">{semanticState.contexts.map(context => <li key={context.contextOccurrenceId}>
        <strong>{typeof context.fields.label === "string" ? context.fields.label : context.templateKey}</strong>
        <span className="ml-3 text-sm text-slate-600">{typeof context.fields.plannedDate === "string" ? context.fields.plannedDate : "Date à préciser"}</span>
      </li>)}</ul>
      {!semanticState.contexts.length && <p className="mt-3 text-sm text-slate-600">Aucun Context explicite dans cette Revision.</p>}
    </section>
    {external && <div className={material.projectList}><PlannedExpensesControl {...external} /></div>}
    <section id="timeline-title">{plan && external ? <MonthCalendar targetMonth={projection.targetMonth} today={today}
      {...projectMonthCalendar(plan.certainOutflows.items, [...external.expenses, ...calendarCarryovers])} /> : <p className="text-sm">Calendrier disponible après renseignement des ressources.</p>}</section>
    <details id="plan-evidence" className={`${material.glassSecondary} p-6`}><summary className="font-bold">Financement, timing & informations</summary>
      <p className="mt-3 text-sm">Financement : {projection.funding.status === "COMPLETE" ? "établi" : "à compléter"} · montant à préciser : {money(projection.funding.unallocatedEconomicAmount)}</p>
      <p className="mt-2 text-sm">Point bas Banque : {money(projection.cash.lowPointAmount)} · {projection.cash.lowPointDate ?? "Date non établie"}</p>
      <ul className="mt-3 space-y-2 text-sm">{projection.diagnostics.map((d, i) => <li key={`${d.code}:${i}`}>{d.message ?? d.code}</li>)}</ul>
    </details>
  </div>;
}
