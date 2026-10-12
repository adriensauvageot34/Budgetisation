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
import type { ComposerMobilitySummary } from "@/domain/phase2/planner/composer-ui-contract";
import { MobilityEstimateSummary } from "./composer/mobility-estimate-summary";

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
const contextLabels: Readonly<Record<string, string>> = { activity: "Activité", restaurant: "Restaurant", "fast-food": "Restauration rapide", delivery: "Livraison", purchase: "Achat", gift: "Cadeau", "short-stay": "Week-end / séjour", "family-visit": "Visite famille", "friend-visit": "Visite amis", "night-out": "Soirée", "beauty-restock": "Réapprovisionnement beauté", "home-project": "Projet maison", "other-context": "Autre intention" };
const contextLabel = (context: PlanSemanticStateV1["contexts"][number]) => String(context.fields.label ?? contextLabels[context.templateKey] ?? "Moment du Plan");
const genericFieldLabels: Readonly<Record<string, string>> = { plannedDate: "Date", endDate: "Fin", participantRefs: "Personnes concernées",
  personVisitedRef: "Personne visitée", placeRef: "Lieu", destinationRef: "Destination", budgetDomain: "Enveloppe",
  productLabel: "Produit", merchantLabel: "Commerce", timingNote: "Repère de temps", nightCount: "Nuits", lodgingKind: "Hébergement" };
const genericSlotLabels: Readonly<Record<string, string>> = { meal: "Repas", extras: "Compléments", transport: "Transport", main: "Moment principal",
  hospitality: "Contribution", activities: "Activités", item: "Achat", before: "Avant la soirée", food: "Repas", outbound: "Aller",
  return: "Retour", lodging: "Hébergement", groceries: "Courses du séjour", restaurants: "Restaurants", purchases: "Achats",
  products: "Produits et besoins", items: "Équipements", services: "Services", components: "Contributions", children: "Autres moments" };
const genericChoiceLabels: Readonly<Record<string, string>> = { clothing: "Vêtements", "home-small": "Maison petit", "games-digital": "Jeux et numérique", other: "Autre" };
const genericFieldLabel = (key: string) => genericFieldLabels[key] ?? key;
const genericFieldValue = (key: string, value: unknown, persons: readonly { personId: string; displayName: string }[],
  places: readonly import("@/domain/phase2/planned-places").PlannedPlaceOption[]) => {
  if (value === null || value === undefined || value === "") return "À préciser";
  if (key === "participantRefs" && Array.isArray(value)) return value.length ? value.map(ref => personLabel(ref, persons)).join(", ") : "À préciser";
  if (key === "personVisitedRef" || key === "recipientRef") return personLabel(value, persons);
  const ref = record(value);
  if (ref?.kind === "TEXT" && typeof ref.label === "string") return ref.label;
  if (ref?.kind === "KNOWN") return places.find(place => place.placeId === ref.placeId)?.name ?? "Lieu lié indisponible";
  return typeof value === "string" || typeof value === "number" ? genericChoiceLabels[String(value)] ?? String(value) : "À préciser";
};
const genericSelectionLabel = (item: Record<string, unknown>, contexts: PlanSemanticStateV1["contexts"]) => {
  if (item.kind === "CHILD_CONTEXT") {
    const child = contexts.find(context => context.contextOccurrenceId === item.childContextOccurrenceId);
    return child ? `Moment lié : ${contextLabel(child)}` : "Moment lié indisponible";
  }
  if (item.kind === "UNRESOLVED") return "Choix à préciser";
  if (item.kind === "MOBILITY_INTENT") return "Déplacement";
  return typeof item.label === "string" ? item.label : String(item.optionKey ?? "Choix");
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
export function AppliedMonthView({ projection, semanticState, controls = [], plan, external, revision, evidenceStatus = "EXACT", historicalRemainder = null, composerHref, today, calendarCarryovers = [], persons = [], mobility = [], places = [] }: {
  projection: PlanProjectionV1; semanticState: PlanSemanticStateV1; controls?: readonly AppliedPlanControl[]; plan: MonthEconomicPlan | null;
  external?: ComponentProps<typeof PlannedExpensesControl>; revision: number; evidenceStatus?: "EXACT" | "CHANGED_AUTHORITIES" | "NOT_APPLICABLE";
  historicalRemainder?: string | null; composerHref?: string; today: string;
  calendarCarryovers?: readonly PlannedExpenseCard[]; persons?: readonly { personId: string; displayName: string }[];
  mobility?: readonly ComposerMobilitySummary[]; places?: readonly import("@/domain/phase2/planned-places").PlannedPlaceOption[];
}) {
  const rows = [["Ressources", projection.economic.resources], ["Engagements certains", projection.economic.certainCommitments],
    ["Besoins & habitudes", projection.economic.needsAndHabits], ["Vie & envies", projection.economic.discretionaryLife],
    ["Contexts explicites", projection.economic.explicitContexts], ["Usage mobilité", projection.economic.mobilityUsageEconomicCost],
    ["Cagnottes réservées", projection.economic.savingsReservations]];
  return <div data-applied-month className="space-y-7">
    <section className={`${material.glassPremium} p-6`}><p className="text-sm text-slate-600">Plan appliqué · Révision {revision}</p>
      <h2 id="final-projection" className="mt-2 text-2xl font-black">{evidenceStatus === "CHANGED_AUTHORITIES" ? "Projection actuelle de fin de mois" : "Projection de fin de mois"}</h2>
      <p data-applied-remainder className="mt-3 text-4xl font-black">{money(projection.plan.economicMonthEndRemainder)}</p>
      {evidenceStatus === "CHANGED_AUTHORITIES" && <p data-applied-authorities-changed className="mt-2 text-sm text-amber-800">
        Les sources financières ont changé depuis l’application. Le montant affiché est recalculé ; le reste estimé enregistré avec la révision était {money(historicalRemainder)}. Les décisions ci-dessous restent celles de la révision.
      </p>}
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
              {typeof child?.fields.label === "string" ? child.fields.label : child ? contextLabel(child) : "Contexte enfant indisponible"}
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
      {semanticState.contexts.filter(c => ["family-visit", "short-stay"].includes(c.templateKey)).map(context => {
        const transport = selectionItems(context, "transport")[0], route = record(transport?.route);
        const stops = Array.isArray(route?.stops) ? route.stops.map(record).filter((s): s is Record<string, unknown> => !!s) : [];
        const stay = context.templateKey === "short-stay", destination = record(context.fields[stay ? "destinationRef" : "placeRef"]), participants = Array.isArray(context.fields.participantRefs) ? context.fields.participantRefs : [];
        const snapshot = mobility.find(s => s.contextOccurrenceId === context.contextOccurrenceId);
        const renderParts = (owner: PlanSemanticStateV1["contexts"][number], depth = 0): React.ReactNode => depth > 10 ? null
          : Object.keys(owner.slotSelections).filter(slot => owner.contextOccurrenceId !== context.contextOccurrenceId || slot !== "transport").flatMap(slot => selectionItems(owner, slot).map(item => {
            const child = semanticState.contexts.find(c => c.contextOccurrenceId === item.childContextOccurrenceId);
            return <li key={`${slot}:${String(item.selectionId)}`}>
              {item.provenance === "PERSONAL_SUGGESTION" ? "Proposition exploratoire non retenue" : child ? <>{contextLabel(child)}<ul className="ml-4 list-disc">{renderParts(child, depth + 1)}</ul></>
                : item.kind === "COMPONENT" ? `${String(item.label)} · ${record(item.lodgingPricing)?.basis === "PER_NIGHT" ? `tarif par nuit · ${record(item.lodgingPricing)?.nightCount ?? "nombre de nuits inconnu, total inconnu"}` : record(item.lodgingPricing)?.basis === "TOTAL" ? "budget total" : `quantité ${String(item.quantity)}`} · ${costLabel(item.cost)} · ${record(item.lodgingPricing)?.basis === "PER_NIGHT" && record(item.lodgingPricing)?.nightCount === null ? `financement conservé, non appliqué tant que la durée est inconnue (${fundingLabel(item.fundingAllocations)})` : fundingLabel(item.fundingAllocations)}` : item.kind === "MOBILITY_INTENT" ? <>{journeyLabels[String(item.optionKey)] ?? "Transport"} · {record(item.journey)?.relation === "SHARES_JOURNEY" ? "trajet partagé, prix porté par le propriétaire" : "trajet propre"}<MobilityEstimateSummary summary={mobility.find(s => s.contextOccurrenceId === owner.contextOccurrenceId)} /></> : "À préciser"}
            </li>;
          }));
        return <article key={context.contextOccurrenceId} data-plan-family-visit={!stay ? context.contextOccurrenceId : undefined} data-plan-short-stay={stay ? context.contextOccurrenceId : undefined} className="mt-4 rounded-xl border border-slate-200 p-4">
          <h3 className="font-bold">{stay ? "Week-end / séjour" : "Visite famille"} · {String(context.fields.label ?? "sans nom")}</h3>
          {!stay && <p>Proche visité : {context.fields.personVisitedRef ? personLabel(context.fields.personVisitedRef, persons) : "à préciser"}</p>}
          {stay && <p>Hébergement : {({ RELATIVE: "chez un proche", HOTEL: "hôtel", HOSTEL: "auberge", RENTAL: "location", OTHER: "autre", LATER: "à préciser" } as Record<string, string>)[String(context.fields.lodgingKind)] ?? "à préciser"} · nuits : {String(context.fields.nightCount ?? "inconnues")}</p>}
          <p>Personnes concernées : {participants.length ? participants.map(ref => personLabel(ref, persons)).join(", ") : "à préciser"}</p>
          <p>Destination : {destination?.kind === "TEXT" ? String(destination.label) : destination?.kind === "KNOWN"
            ? String(stops.find(stop => stop.endpointSource === "ROOT_PLACE")?.label ?? places.find(p => p.placeId === destination.placeId)?.name ?? "lieu lié indisponible") : "à préciser"}</p>
          <p>Départ : {String(context.fields.plannedDate ?? "date non fixée")} · Retour : {String(context.fields.endDate ?? "date non fixée")}
            {context.fields.timingNote ? ` · ${String(context.fields.timingNote)}` : ""}</p>
          <p>Transport : {transport?.provenance === "PERSONAL_SUGGESTION" ? "proposition non retenue" : journeyLabels[String(transport?.optionKey)] ?? "à préciser"}
            {transport?.returnRequired === true ? " · aller-retour" : ""}</p>
          {!!stops.length && <ol className="ml-4 list-decimal">{stops.map((stop, i) => <li key={i}>{String(stop.label)}{stop.endpointSource === "ROOT_PLACE" ? (stay ? " · destination du séjour" : " · destination de la visite") : ""}</li>)}</ol>}
          <p>Financement des frais : {fundingLabel(record(transport?.pricing)?.fundingAllocations)}</p>
          <p className="text-xs text-slate-500">Estimation conservée lors de l’application de cette révision. Le conteneur n’ajoute aucun coût propre.</p>
          {transport?.optionKey === "free" && transport.provenance !== "PERSONAL_SUGGESTION" ? <p>Déplacement déclaré gratuit. Aucun coût de trajet ajouté.</p>
            : <MobilityEstimateSummary summary={snapshot} />}
          <ul className="ml-4 list-disc">{renderParts(context)}</ul>
        </article>;
      })}
      {semanticState.contexts.filter(context => !["gift", "night-out", "family-visit", "short-stay"].includes(context.templateKey)).map(context =>
        <article key={context.contextOccurrenceId} data-plan-catalog-context={context.contextOccurrenceId} className="mt-4 rounded-xl border border-slate-200 p-4">
          <h3 className="font-bold">{contextLabel(context)}</h3>
          <p className="mt-1 text-xs text-slate-500">{contextLabels[context.templateKey] ?? context.templateKey} · décision conservée dans la révision · le conteneur n’ajoute aucun coût propre.</p>
          <dl className="mt-2 grid gap-1 text-sm">{Object.entries(context.fields).filter(([key]) => !["fieldSchemaVersion", "label"].includes(key)).map(([key, value]) =>
            <div key={key}><dt className="inline font-semibold">{genericFieldLabel(key)} : </dt><dd className="inline">{genericFieldValue(key, value, persons, places)}</dd></div>)}</dl>
          {Object.entries(context.slotSelections).map(([slot, raw]) => <div key={slot} className="mt-2 text-sm"><strong>{genericSlotLabels[slot] ?? slot}</strong>
            <ul className="ml-4 list-disc">{(Array.isArray(raw.items) ? raw.items.map(record).filter((item): item is Record<string, unknown> => item !== null) : []).map((item, index) => {
              const exploratory = item.provenance === "PERSONAL_SUGGESTION", pricing = record(item.pricing);
              return <li key={String(item.selectionId ?? index)} data-plan-catalog-selection={String(item.selectionId ?? index)}>
                {genericSelectionLabel(item, semanticState.contexts)} · {exploratory ? "proposition exploratoire non retenue"
                  : item.kind === "COMPONENT" ? <>{costLabel(item.cost)} · {item.quantityPerPerson !== undefined
                    ? `${String(item.quantityPerPerson)} par personne × ${String(item.pricedParticipantCount)} personnes`
                    : `quantité ${String(item.quantity ?? "à préciser")}`} · {fundingLabel(item.fundingAllocations)}</>
                    : item.kind === "MOBILITY_INTENT" ? <>{journeyLabels[String(item.optionKey)] ?? "Transport"} ·
                      {record(item.journey)?.relation === "SHARES_JOURNEY" ? "prix porté par le trajet lié" : `${costLabel(pricing?.fare)} · ${fundingLabel(pricing?.fundingAllocations)}`}</>
                      : item.kind === "CHILD_CONTEXT" ? "identité et détails conservés dans ce Plan" : "information à préciser"}</li>;
            })}</ul></div>)}
        </article>)}
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
        <strong>{typeof context.fields.label === "string" ? context.fields.label : context.templateKey === "gift" ? `Cadeau pour ${personLabel(context.fields.recipientRef, persons)}` : contextLabels[context.templateKey] ?? "Moment du Plan"}</strong>
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
