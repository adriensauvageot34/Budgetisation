import type { PlanProjectionV1 } from "@/domain/phase2/planner/projection-contract";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { AppliedPlanControl } from "@/server/phase2/planner/applied-plan-read";
import type { MonthEconomicPlan } from "@/server/phase2/month-scenario";
import type { ComponentProps } from "react";
import { BankStockCard } from "./bank-stock-card";
import { ResourceEditor } from "./resource-editor";
import { PlannedExpensesControl } from "./planned-expenses-control";
import { MonthCalendar } from "./month-calendar";
import { projectMonthCalendar, type PlannedExpenseCard } from "./planned-expenses-projection";
import { money } from "./composer/display";
import { SOCIAL_CONTACTS_V1 } from "@/domain/phase2/planned-rules";
import { plannedAsset } from "@/domain/phase2/planned-assets";
import material from "./month-material.module.css";

const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const componentItems = (context: PlanSemanticStateV1["contexts"][number], slot: string) => {
  const raw = context.slotSelections[slot]?.items;
  return Array.isArray(raw) ? raw.map(record).filter((item): item is Record<string, unknown> => item !== null && item.kind === "COMPONENT") : [];
};
const selectionItems = (context: PlanSemanticStateV1["contexts"][number], slot: string): Record<string, unknown>[] => {
  const raw = context.slotSelections[slot]?.items;
  return Array.isArray(raw) ? raw.map(record).filter((item): item is Record<string, unknown> => item !== null) : [];
};
const personLabel = (value: unknown, persons: readonly { personId: string; displayName: string }[]) => {
  const ref = record(value);
  return ref?.kind === "HOUSEHOLD_PERSON" ? persons.find(person => person.personId === ref.personId)?.displayName ?? "Personne du foyer à identifier"
    : ref?.kind === "CONTACT" ? SOCIAL_CONTACTS_V1.find(contact => contact.key === ref.contactKey)?.label ?? "Contact à identifier"
    : ref?.kind === "TEXT" && typeof ref.label === "string" ? ref.label : "Destinataire à préciser";
};
const costLabel = (value: unknown) => {
  const cost = record(value);
  return cost?.kind === "MANUAL" && typeof cost.unitAmount === "string" ? `${money(cost.unitAmount)} par unité · montant déclaré`
    : cost?.kind === "QUOTE" ? "Prix issu d’un devis conservé" : "Prix inconnu";
};
const fundingLabel = (value: unknown) => {
  const parts = Array.isArray(value) ? value.map(record).filter((part): part is Record<string, unknown> => part !== null) : [];
  return parts.length ? parts.map(part => `${part.source === "BANK" ? "Banque" : String(part.source)} ${typeof part.amount === "string" ? money(part.amount) : "montant inconnu"}`).join(" · ") : "financement à préciser";
};
const journeyLabels: Readonly<Record<string, string>> = { car: "Voiture", train: "Train / tram", bus: "Bus", taxi: "Taxi / Uber", free: "À pied / gratuit", other: "Autre transport", unknown: "Transport à préciser" };
const giftAssetLabel = (value: unknown) => {
  const ref = record(value);
  if (!ref || typeof ref.assetKey !== "string") return "Non classé";
  const asset = plannedAsset(ref.assetKey);
  const label = typeof ref.labelAtSelection === "string" ? ref.labelAtSelection : ref.assetKey;
  return asset?.module === "gift" ? `Achat · Cadeau · ${label}` : `Référence de catalogue indisponible · ${label} (${ref.assetKey})`;
};

/** Applied financial values come directly from C7, including unknowns. Existing
 * independent resource and external-intent editors retain their owners. */
export function AppliedMonthView({ projection, semanticState, controls = [], plan, external, revision, composerHref, today, calendarCarryovers = [], persons = [] }: {
  projection: PlanProjectionV1; semanticState: PlanSemanticStateV1; controls?: readonly AppliedPlanControl[]; plan: MonthEconomicPlan | null;
  external?: ComponentProps<typeof PlannedExpensesControl>; revision: number; composerHref?: string; today: string;
  calendarCarryovers?: readonly PlannedExpenseCard[]; persons?: readonly { personId: string; displayName: string }[];
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
    <section className={`${material.glassSecondary} p-6`} aria-labelledby="my-plan-title" data-my-plan>
      <h2 id="my-plan-title" className="text-xl font-black">Mon Plan</h2>
      <p className="mt-2 text-sm text-slate-600">Décisions de la révision appliquée · les repères historiques ne sont pas des choix validés.</p>
      {controls.length ? <ul className="mt-4 space-y-3">{controls.map(control => <li key={control.planSlotId} data-plan-control={control.slotIdentityKey}>
        <strong>{control.label}</strong>
        <span className="ml-3">{control.amount !== null ? money(control.amount) : control.count !== null ? `${control.count} occurrence(s)${control.unitAmount !== null ? ` · ${money(control.unitAmount)} par occurrence` : " · montant unitaire non décidé"}` : "Valeur inconnue"}</span>
        <small className="ml-3 text-slate-600">Décision explicite</small>
        {control.savings && <p className="mt-1 text-sm text-slate-600" data-plan-saving={control.savings.reservationId}>
          Réservation {control.savings.adjustability === "PROTECTED" ? "protégée" : "ajustable"} · montant déclaré {money(control.savings.declaredAmount)} ·
          {control.savings.source === "ANNUAL_PLAN" ? " objectif annuel" : " déclaration du mois"} · aucun mouvement bancaire créé
        </p>}
      </li>)}</ul> : <p className="mt-3 text-sm text-slate-600">Aucun ajustement mensuel explicite dans cette révision.</p>}
      {semanticState.contexts.filter(context => context.templateKey === "gift").map(context => {
        const gift = componentItems(context, "item")[0], extras = componentItems(context, "extras");
        const funding = Array.isArray(gift?.fundingAllocations) ? gift.fundingAllocations.map(record).filter((item): item is Record<string, unknown> => item !== null) : [];
        return <article key={context.contextOccurrenceId} data-plan-gift={context.contextOccurrenceId} className="mt-4 rounded-xl border border-slate-200 p-4">
          <h3 className="font-bold">Cadeau · {personLabel(context.fields.recipientRef, persons)}</h3>
          <dl className="mt-2 grid gap-1 text-sm"><div><dt className="inline font-semibold">Occasion : </dt><dd className="inline">{typeof context.fields.occasion === "string" ? context.fields.occasion : "À préciser"}</dd></div>
            <div><dt className="inline font-semibold">Type d’objet : </dt><dd className="inline">{giftAssetLabel(context.fields.objectAssetRef)}</dd></div>
            <div><dt className="inline font-semibold">Objet : </dt><dd className="inline">{typeof context.fields.objectLabel === "string" ? context.fields.objectLabel : typeof gift?.label === "string" ? gift.label : "À préciser"}</dd></div>
            <div><dt className="inline font-semibold">Date : </dt><dd className="inline">{typeof context.fields.plannedDate === "string" ? context.fields.plannedDate : "Non fixée"}</dd></div>
            <div><dt className="inline font-semibold">Budget : </dt><dd className="inline">{gift ? `${costLabel(gift.cost)} · quantité ${String(gift.quantity)} · ${gift.unitBasis === "PERSON" ? "par personne" : gift.unitBasis === "SHARED" ? "montant commun" : "par objet"}` : "À préciser"}</dd></div>
            <div><dt className="inline font-semibold">Financement : </dt><dd className="inline">{funding.length ? funding.map(part => `${part.source === "BANK" ? "Banque" : String(part.source)} ${typeof part.amount === "string" ? money(part.amount) : "montant inconnu"}`).join(" · ") : "À préciser"}</dd></div></dl>
          {extras.length > 0 && <div className="mt-3 text-sm"><strong>Compléments</strong><ul className="mt-1 list-inside list-disc">{extras.map(extra => <li key={String(extra.selectionId)} data-plan-gift-extra={String(extra.selectionId)}>{String(extra.label)} · {costLabel(extra.cost)} · quantité {String(extra.quantity)}</li>)}</ul></div>}
        </article>;
      })}
      {semanticState.contexts.filter(context => context.templateKey === "night-out").map(context => {
        const refs = Array.isArray(context.fields.participantRefs) ? context.fields.participantRefs : [];
        const place = record(context.fields.placeRef);
        const slots = [["before", "Before"], ["main", "Entrée ou activité"], ["food", "Repas"],
          ["extras", "Boissons et extras"], ["outbound", "Aller"], ["return", "Retour"]] as const;
        const renderItem = (item: Record<string, unknown>, key: string) => {
          if (item.provenance === "PERSONAL_SUGGESTION") return <li key={key} data-plan-night-suggestion={String(item.selectionId)}>
            {typeof item.label === "string" ? item.label : "Suggestion"} · proposition exploratoire non retenue</li>;
          if (item.kind === "UNRESOLVED") return <li key={key}>Choix à préciser</li>;
          if (item.kind === "CHILD_CONTEXT") {
            const child = semanticState.contexts.find(candidate => candidate.contextOccurrenceId === item.childContextOccurrenceId);
            return <li key={key} data-plan-night-child={String(item.childContextOccurrenceId)}>
              {typeof child?.fields.label === "string" ? child.fields.label : child?.templateKey ?? "Contexte enfant indisponible"}
              {child && <ul className="ml-5 list-inside list-disc">{["main", "extras", "meal", "transport"].flatMap(slot => selectionItems(child, slot).map((nested, index) => renderItem(nested, `${slot}:${index}`)))}</ul>}
            </li>;
          }
          if (item.kind === "MOBILITY_INTENT") {
            const origin = record(item.origin), destination = record(item.destination), pricing = record(item.pricing);
            const shared = record(item.journey)?.relation === "SHARES_JOURNEY";
            return <li key={key} data-plan-night-journey={String(item.selectionId)}>{journeyLabels[String(item.optionKey)] ?? "Transport"} ·
              {origin?.kind === "TEXT" ? ` de ${String(origin.label)}` : origin?.kind === "KNOWN" ? " départ lié" : " origine à préciser"} ·
              {destination?.kind === "TEXT" ? ` vers ${String(destination.label)}` : destination?.kind === "KNOWN" ? " destination liée" : " destination à préciser"} ·
              {shared ? "prix et financement portés par le trajet lié" : `${pricing ? costLabel(pricing.fare) : "Prix inconnu"} · ${fundingLabel(pricing?.fundingAllocations)}`}
              {typeof item.plannedTime === "string" ? ` · départ ${item.plannedTime}` : ""}
              {item.returnRequired === true ? " · aller-retour demandé" : ""}
              {typeof item.returnTime === "string" ? ` · retour ${item.returnTime}` : ""}</li>;
          }
          const cost = record(item.cost), product = record(item.productAssetRef);
          return <li key={key} data-plan-night-component={String(item.selectionId)}>{String(item.label ?? item.optionKey)} ·
            {product ? ` type ${String(product.labelAtSelection)}${typeof product.assetKey === "string" && !plannedAsset(product.assetKey) ? " · référence indisponible" : ""} ·` : ""}
            {item.quantityPerPerson !== undefined ? ` ${String(item.quantityPerPerson)} par personne × ${String(item.pricedParticipantCount)} personnes · ${String(item.quantity)} unités au total`
              : ` quantité ${String(item.quantity ?? "à préciser")}${item.unitBasis === "SHARED" ? " · budget partagé" : ""}`} ·
            {costLabel(cost)} · {fundingLabel(item.fundingAllocations)}
            {record(item.binding)?.mode === "CONFIRMED_CONSUMPTION" ? " · consomme une enveloppe" : record(item.binding)?.mode === "EXTRA_TO_SLOT" ? " · supplément à l’enveloppe" : ""}
          </li>;
        };
        return <article key={context.contextOccurrenceId} data-plan-night-out={context.contextOccurrenceId} className="mt-4 rounded-xl border border-slate-200 p-4">
          <h3 className="font-bold">Soirée · {typeof context.fields.label === "string" ? context.fields.label : "sans nom"}</h3>
          <p className="mt-1 text-sm text-slate-600">Participants : {refs.length ? refs.map(ref => personLabel(ref, persons)).join(", ") : "à préciser"} ·
            Lieu : {place?.kind === "TEXT" ? String(place.label) : place?.kind === "KNOWN" ? "lieu lié" : "à préciser"} ·
            Date : {typeof context.fields.plannedDate === "string" ? context.fields.plannedDate : "non fixée"}
            {typeof context.fields.endDate === "string" ? ` · fin ${context.fields.endDate}` : ""}
            {typeof context.fields.timingNote === "string" ? ` · ${context.fields.timingNote}` : ""}</p>
          <p className="mt-1 text-xs text-slate-500">Le conteneur Soirée n’ajoute aucun coût propre. Les prix viennent des composants conservés.</p>
          <dl className="mt-3 grid gap-2 text-sm">{slots.map(([slot, label]) => <div key={slot}><dt className="font-semibold">{label}</dt><dd>
            {selectionItems(context, slot).length ? <ul className="ml-4 list-inside list-disc">{selectionItems(context, slot).map((item, index) => renderItem(item, `${slot}:${index}`))}</ul>
              : <span className="text-slate-500">À préciser</span>}
          </dd></div>)}</dl>
        </article>;
      })}
      {composerHref && <a className="mt-4 inline-block font-bold underline" href={composerHref}>Rééditer mon Plan</a>}
    </section>
    <section className={`${material.glassSecondary} p-6`}><h2 id="resources-title" className="text-xl font-black">Banque & ressources</h2>
      {plan ? <><div className="mt-4"><BankStockCard balance={plan.bankCash.currentRealBankBalance} /></div>
      <div className="mt-4 grid grid-cols-2 gap-3">{plan.resources.map(resource => <ResourceEditor key={resource.key} resource={resource} targetMonth={projection.targetMonth} controls={false}
        walletObservation={resource.key === "benefit:swile" ? plan.benefitWallets.SWILE.latestObservation : resource.key === "benefit:edenred" ? plan.benefitWallets.EDENRED.latestObservation : null} />)}</div>
      </> : <p className="mt-3 text-sm">Complétez les ressources dans le Centre de contrôle.</p>}
    </section>
    <section className={`${material.glassSecondary} p-6`}><h2 id="plan-contexts" className="text-xl font-black">Moments du Plan</h2>
      <ul className="mt-4 space-y-3">{semanticState.contexts.map(context => <li key={context.contextOccurrenceId}>
        <strong>{typeof context.fields.label === "string" ? context.fields.label : context.templateKey === "gift" ? `Cadeau pour ${personLabel(context.fields.recipientRef, persons)}` : context.templateKey}</strong>
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
