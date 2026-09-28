import type { ForecastComponent } from "@/server/phase2/month-forecast";
import type { MonthForecastSnapshot } from "@/server/phase2/month-forecast-snapshot";
import type { StoredMonthInputs } from "@/server/phase2/month-inputs";
import { REPLACEABLE_ENVELOPES, type MonthScenario } from "@/server/phase2/month-scenario";
import { updateMonthInputs } from "@/app/mois-a-venir/actions";
import { MonthStory } from "./month-story";

const money = (value: string | null, exact = false) => value === null ? "À confirmer" : new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", maximumFractionDigits: exact ? 2 : 0, minimumFractionDigits: exact ? 2 : 0,
}).format(Number(value));
const monthLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));
const dateLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
const eventKinds = ["Soirée", "Restaurant", "Famille", "Voyage / déplacement", "Achat", "Autre"] as const;
const labelFor = (part: ForecastComponent) => part.key === "food" ? "Alimentation & sorties" : part.key === "mobility-usage" ? "Voiture & essence" : part.label;
const confidence = (part: ForecastComponent) => part.confidence === "LOW" ? "Estimation à affiner" : part.nature === "CONTRACTUAL_EXPECTED" ? "Engagé ou très probable" : "Estimation habituelle";

function Details({ part }: { part: ForecastComponent }) {
  return <details className="text-xs text-slate-600"><summary className="cursor-pointer rounded-md font-semibold text-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-700">Détails</summary>
    <div className="mt-2 space-y-1"><p>Prévision : {money(part.central, true)}. Intervalle : {money(part.low, true)} à {money(part.high, true)}.</p>
      <p>{confidence(part)}. Références disponibles jusqu’au {part.freshnessDate ? dateLabel(part.freshnessDate) : "date non précisée"}.</p>
      <details className="pt-1 text-xs"><summary className="cursor-pointer font-semibold">Voir les détails techniques</summary><p className="mt-1 break-all">Référence : {part.referenceMode} · Sources : {part.provenance.join(" · ") || "non précisées"} · Limites : {part.limitations.join(" · ") || "aucune"}</p></details>
    </div>
  </details>;
}

function DecisionForm({ targetMonth, intent, componentKey, label }: { targetMonth: string; intent: string; componentKey: string; label: string }) {
  return <form action={updateMonthInputs}><input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value={intent} /><input type="hidden" name="componentKey" value={componentKey} /><button type="submit" className="min-h-9 rounded-lg px-2 text-xs font-bold text-emerald-900 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-700">{label}</button></form>;
}

function UndatedRow({ part, kind, targetMonth, excluded = false, declined = false }: { part: ForecastComponent; kind: "Revenu attendu" | "Charge fixe" | "Dépense possible"; targetMonth: string; excluded?: boolean; declined?: boolean }) {
  const isIncome = kind === "Revenu attendu";
  const isFixed = kind === "Charge fixe";
  const status = excluded ? `Retiré de ${monthLabel(targetMonth)}` : declined ? `Non prévu en ${monthLabel(targetMonth)}` : part.central === null ? "À confirmer" : "Date à confirmer";
  return <li className="border-b border-slate-200 py-2.5 last:border-0"><div className="flex items-start gap-3"><span className="w-14 shrink-0 pt-1 text-center text-[11px] font-extrabold uppercase leading-tight text-slate-500">Date<br />à confirmer</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-bold">{part.label}</p><p className="text-xs text-slate-600">{isIncome ? "＋ Revenu attendu" : isFixed ? "− Charge fixe" : "? Dépense possible"} · {status}</p></div><strong className="shrink-0 whitespace-nowrap text-sm">{excluded || declined ? "Hors prévision" : part.central === null ? "À confirmer" : `${isIncome ? "+" : "−"} ${money(part.central)}`}</strong></div>
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"><Details part={part} />{isFixed && (excluded
      ? <DecisionForm targetMonth={targetMonth} intent="restore-fixed" componentKey={part.key} label="Réintégrer ce mois" />
      : <details className="text-xs"><summary className="cursor-pointer font-bold text-emerald-800">Retirer ce mois</summary><p className="mt-2 max-w-md text-slate-600">Ne plus compter {part.label} ({money(part.central)}) en {monthLabel(targetMonth)} ? Votre historique et les autres mois ne changent pas.</p><DecisionForm targetMonth={targetMonth} intent="exclude-fixed" componentKey={part.key} label={`Confirmer le retrait de ${monthLabel(targetMonth)}`} /></details>)}
      {!isIncome && !isFixed && part.knowledgeState === "CONDITIONAL_UNKNOWN" && /Ornikar|Alma/iu.test(part.label) && <div className="flex flex-wrap items-center gap-1"><details className="text-xs"><summary className="cursor-pointer font-bold text-emerald-800">Oui, prévu</summary><ActionForm targetMonth={targetMonth} intent="confirm-obligation" label="Inclure cette dépense"><input type="hidden" name="componentKey" value={part.key} /><Field label="Date prévue" name="obligationDate" type="date" min={`${targetMonth}-01`} max={new Date(Date.UTC(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5, 7)), 0)).toISOString().slice(0, 10)} required /><Field label="Montant confirmé (€)" name="obligationAmount" type="number" min="0" required /></ActionForm></details><DecisionForm targetMonth={targetMonth} intent="decline-conditional" componentKey={part.key} label="Non" /><DecisionForm targetMonth={targetMonth} intent="unknown-conditional" componentKey={part.key} label="Je ne sais pas" /></div>}</div></div></div></li>;
}

function ActionForm({ targetMonth, intent, children, label }: { targetMonth: string; intent: string; children: React.ReactNode; label: string }) {
  return <form action={updateMonthInputs} className="mt-3 grid gap-3"><input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value={intent} />{children}
    <button className="min-h-11 rounded-xl bg-emerald-800 px-4 py-2 font-bold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800" type="submit">{label}</button></form>;
}

function Field({ label, name, type = "text", value, min, max, required = false }: { label: string; name: string; type?: string; value?: string; min?: string; max?: string; required?: boolean }) {
  return <label className="grid gap-1 text-sm font-semibold text-slate-800">{label}<input className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-emerald-700" name={name} type={type} min={min} max={max} step={type === "number" ? "0.01" : undefined} defaultValue={value} required={required} /></label>;
}

type Props = { forecast: MonthForecastSnapshot; scenario: MonthScenario; baseScenario: MonthScenario; stored: StoredMonthInputs;
  eventImpacts: Record<string, string | null>; today: string; purchaseName: string; whatIfError: boolean; inputError: boolean };

export function MonthForecastView({ forecast, scenario, baseScenario, stored, eventImpacts, purchaseName, whatIfError, inputError }: Props) {
  const targetMonth = forecast.meta.targetMonth;
  const obligations = forecast.components.filter((part) => part.key.startsWith("obligation:"));
  const conditional = obligations.filter((part) => part.knowledgeState === "CONDITIONAL_UNKNOWN" && /Ornikar|Alma/iu.test(part.label));
  const pending = conditional.filter((part) => !stored.inputs.confirmedObligations.some((item) => item.componentKey === part.key)
    && !stored.inputs.declinedConditionalObligations.includes(part.key));
  const fixed = obligations.filter((part) => part.nature === "CONTRACTUAL_EXPECTED" && part.additiveGroup === "obligations" && part.central !== null);
  const includedFixed = fixed.filter((part) => !stored.inputs.excludedFixedObligations.includes(part.key));
  const excludedFixed = fixed.filter((part) => stored.inputs.excludedFixedObligations.includes(part.key));
  const declined = conditional.filter((part) => stored.inputs.declinedConditionalObligations.includes(part.key));
  const otherObligations = obligations.filter((part) => !fixed.some((item) => item.key === part.key)
    && !conditional.some((item) => item.key === part.key));
  const hasBank = stored.inputs.openingBalance !== null;
  const hasSwile = stored.inputs.benefit.currentBalance !== null;
  const monthEnd = new Date(Date.UTC(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const summary = baseScenario.freeToSpend.central;

  return <main className="mx-auto max-w-5xl space-y-7 pb-20 text-slate-900">
    <MonthStory plan={baseScenario.economicPlan} targetMonth={targetMonth} plannedEvents={stored.inputs.plannedEvents} eventImpacts={eventImpacts} />

    <section id="complete-month" className="card p-5 sm:p-7" aria-labelledby="complete-title">
      <h2 id="complete-title" className="text-2xl font-black">À compléter pour {monthLabel(targetMonth)}</h2>
      <p className="mt-1 text-sm text-slate-600">Quelques précisions utiles, seulement si vous les connaissez.</p>
      {inputError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">Impossible d’enregistrer : vérifiez les montants, les dates et la part déjà prévue.</p>}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <details id="bank-balance" className="scroll-mt-6 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer font-bold">Ajouter ou mettre à jour notre solde actuel · {hasBank ? "renseigné" : "à renseigner"}</summary><ActionForm targetMonth={targetMonth} intent="save-bank-balance" label="Enregistrer le solde"><Field label="Solde bancaire (€)" name="openingAmount" type="number" value={stored.inputs.openingBalance?.amount} /><Field label="Date du solde" name="openingDate" type="date" value={stored.inputs.openingBalance?.asOfDate} /><p className="text-xs text-slate-600">Le disponible aujourd’hui n’est calculable qu’avec un solde daté d’aujourd’hui.</p></ActionForm></details>
        <details id="swile-balance" className="scroll-mt-6 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer font-bold">Mettre à jour nos titres-restaurants · {hasSwile ? "renseigné" : "à renseigner"}</summary><ActionForm targetMonth={targetMonth} intent="save-benefit" label="Enregistrer Swile"><Field label="Solde Swile actuel (€)" name="benefitBalance" type="number" min="0" value={stored.inputs.benefit.currentBalance?.amount} /><Field label="Date du solde" name="benefitDate" type="date" value={stored.inputs.benefit.currentBalance?.asOfDate} /><Field label="Chargement attendu (€), si connu" name="benefitLoading" type="number" min="0" value={stored.inputs.benefit.expectedLoading?.amount} /><Field label="Date prévue du chargement" name="loadingDate" type="date" value={stored.inputs.benefit.expectedLoading?.expectedDate} /></ActionForm></details>
        <details id="month-settings" className="scroll-mt-6 rounded-2xl border border-slate-200 p-4 lg:col-span-2">
          <summary className="cursor-pointer font-bold">Réglages du mois{pending.length > 0 ? ` · ${pending.length} échéance${pending.length > 1 ? "s" : ""} à préciser` : ""}</summary>
          <div className="mt-4 grid gap-3">
            <details id="reserve" className="scroll-mt-6 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer font-bold">Marge de sécurité · {money(stored.inputs.safetyReserve)}</summary><ActionForm targetMonth={targetMonth} intent="save-reserve" label="Enregistrer la réserve"><Field label="Montant à garder en sécurité (€)" name="safetyReserve" type="number" min="0" value={stored.inputs.safetyReserve} required /><p className="mt-2 text-xs text-slate-600">Elle réduit le disponible calculé avec un solde actuel et la simulation d’achat. Elle n’est pas retranchée des montants du parcours ci-dessus.</p></ActionForm></details>
      <details id="pending-obligations" className="mt-4 rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer font-bold text-emerald-900">Gérer les charges et échéances du mois</summary>
        <ul className="mt-2 divide-y divide-slate-200">{pending.map((part) => <UndatedRow key={part.key} part={part} kind="Dépense possible" targetMonth={targetMonth} />)}{declined.map((part) => <UndatedRow key={part.key} part={part} kind="Dépense possible" targetMonth={targetMonth} declined />)}{otherObligations.map((part) => <UndatedRow key={part.key} part={part} kind="Dépense possible" targetMonth={targetMonth} />)}{excludedFixed.map((part) => <UndatedRow key={part.key} part={part} kind="Charge fixe" targetMonth={targetMonth} excluded />)}</ul>
        {stored.inputs.confirmedObligations.length > 0 && <div className="mt-3 border-t border-slate-200 pt-3"><h3 className="text-sm font-bold">Échéances confirmées par vous</h3><ul className="mt-1 divide-y divide-slate-100">{stored.inputs.confirmedObligations.map((item) => <li key={item.componentKey} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span><strong>{obligations.find((part) => part.key === item.componentKey)?.label ?? "Échéance confirmée"}</strong> · {dateLabel(item.dueDate)} · {money(item.amount, true)}</span><span className="flex flex-wrap gap-1"><DecisionForm targetMonth={targetMonth} intent="decline-conditional" componentKey={item.componentKey} label="Non" /><DecisionForm targetMonth={targetMonth} intent="unknown-conditional" componentKey={item.componentKey} label="Je ne sais pas" /></span></li>)}</ul></div>}
        {includedFixed.length > 0 && <details className="mt-3 border-t border-slate-200 pt-3"><summary className="cursor-pointer text-sm font-bold">Gérer les {includedFixed.length} charges fixes incluses</summary><ul className="mt-2 divide-y divide-slate-100">{includedFixed.map((part) => <li key={part.key} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span><strong>{part.label}</strong> · {money(part.central, true)}</span><details className="text-xs"><summary className="cursor-pointer font-bold text-emerald-900">Retirer ce mois</summary><p className="mt-2 text-slate-600">Retirer uniquement de {monthLabel(targetMonth)} ?</p><DecisionForm targetMonth={targetMonth} intent="exclude-fixed" componentKey={part.key} label="Confirmer le retrait" /></details></li>)}</ul></details>}
      </details>
      <details className="mt-4 text-xs text-slate-600"><summary className="cursor-pointer font-semibold">Fraîcheur des données et détails de la prévision</summary><p className="mt-2">Prévision calculée le {dateLabel(forecast.meta.computedAt.slice(0, 10))}. Les méthodes et sources sont accessibles dans les « Détails » de chaque poste. Certaines habitudes récentes peuvent manquer.</p><p className="mt-1 break-all">Publication {forecast.meta.sourcePublicationId} · Révision {forecast.meta.analyticsRevision}</p></details>

          </div>
        </details>
      </div>
    </section>

    <section id="add-event" className="scroll-mt-6 rounded-[1.7rem] bg-emerald-50 p-5 sm:p-7" aria-labelledby="add-event-title">
      <h2 id="add-event-title" className="text-xl font-black">Ajouter quelque chose au mois</h2>
      <p className="mt-1 text-sm text-slate-600">Une sortie, un voyage ou un achat que nous avons décidé.</p>
        <ActionForm targetMonth={targetMonth} intent="add-event" label="Ajouter à notre mois"><label className="grid gap-1 text-sm font-semibold">De quoi s’agit-il ?<select name="eventKind" className="min-h-11 rounded-xl border border-slate-300 bg-white px-3">{eventKinds.map((kind) => <option key={kind}>{kind}</option>)}</select></label><Field label="Nom ou précision (facultatif)" name="eventLabel" /><div className="grid gap-3 sm:grid-cols-2"><Field label="Date prévue" name="eventDate" type="date" min={`${targetMonth}-01`} max={monthEnd} required /><Field label="Coût prévu (€)" name="eventCost" type="number" min="0" required /></div>
          <details className="rounded-xl border border-emerald-200 bg-white p-3 text-sm"><summary className="cursor-pointer font-semibold">Cela remplace-t-il une dépense déjà prévue dans votre mois habituel ?</summary><p className="mt-2 text-slate-600">Si vous connaissez la part déjà prévue, indiquez-la. Sinon, laissez vide : le coût entier sera ajouté.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Part déjà prévue (€)" name="baselineDisplaced" type="number" min="0" value="0" /><label className="grid gap-1 font-semibold">Dans quel poste ?<select name="eventParent" className="min-h-11 rounded-xl border border-slate-300 bg-white px-3"><option value="">Aucun / je ne sais pas</option>{forecast.components.filter((part) => REPLACEABLE_ENVELOPES.some((key) => key === part.key)).map((part) => <option key={part.key} value={part.key}>{labelFor(part)}</option>)}</select></label></div></details>
        </ActionForm>
    </section>

    <section className="rounded-[2rem] border border-emerald-300 bg-emerald-50 p-5 sm:p-7" aria-labelledby="whatif-title"><h2 id="whatif-title" className="text-2xl font-black">Vous pensez acheter quelque chose ?</h2><p className="mt-1 text-sm text-slate-600">Testez l’impact avant de décider. La simulation ne change pas votre mois enregistré.</p>
      {whatIfError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">Simulation impossible : vérifiez le prix et la part déjà prévue.</p>}
      <form method="get" className="mt-4 grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Quoi ?" name="purchaseName" value={purchaseName} required /><Field label="Prix (€)" name="purchase" type="number" min="0" value={scenario.whatIf?.amount} required /></div>
        <details className="rounded-xl border border-emerald-200 bg-white p-3 text-sm"><summary className="cursor-pointer font-semibold">Une partie est-elle déjà prévue dans votre mois habituel ?</summary><p className="mt-2 text-slate-600">Laissez zéro si vous ne savez pas. Le prix entier sera alors testé.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Part déjà prévue (€)" name="covered" type="number" min="0" value={scenario.whatIf?.covered ?? "0"} /><label className="grid gap-1 font-semibold">Poste concerné<select name="parent" className="min-h-11 rounded-xl border border-slate-300 bg-white px-3" defaultValue={scenario.whatIf?.parentEnvelope ?? ""}><option value="">Aucun / je ne sais pas</option>{forecast.components.filter((part) => REPLACEABLE_ENVELOPES.some((key) => key === part.key)).map((part) => <option key={part.key} value={part.key}>{labelFor(part)}</option>)}</select></label></div></details>
        <button className="min-h-11 rounded-xl bg-emerald-800 px-4 py-2 font-bold text-white" type="submit">Voir l’impact</button></form>
      {scenario.whatIf && <div className="mt-5 rounded-2xl bg-white p-5" role="status"><h3 className="text-lg font-black">Si vous achetez {purchaseName || "cela"}</h3><p className="mt-2 text-2xl font-black">{money(summary)} → {money(scenario.freeToSpend.central)}</p><p className="mt-1 font-bold text-emerald-900">Impact supplémentaire : − {money(scenario.whatIf.additiveImpact)}</p><p className="mt-2 text-sm text-slate-600">Scénario où le mois coûte plus : {money(scenario.freeToSpend.low)}. Votre réserve de {money(stored.inputs.safetyReserve)} est déjà déduite.</p>{Number(scenario.whatIf.covered) > 0 && <p className="text-sm text-slate-600">Part déjà prévue : {money(scenario.whatIf.covered)}.</p>}
        <ActionForm targetMonth={targetMonth} intent="add-event" label="Ajouter réellement à notre mois"><input type="hidden" name="eventKind" value="Achat" /><input type="hidden" name="eventLabel" value={purchaseName || "Achat"} /><input type="hidden" name="eventCost" value={scenario.whatIf.amount} /><input type="hidden" name="baselineDisplaced" value={scenario.whatIf.covered} /><input type="hidden" name="eventParent" value={scenario.whatIf.parentEnvelope ?? ""} /><Field label="Date prévue pour cet achat" name="eventDate" type="date" min={`${targetMonth}-01`} max={monthEnd} required /></ActionForm>
        <a href="/mois-a-venir" className="mt-3 inline-block text-sm font-bold text-emerald-800 underline">Fermer la simulation</a></div>}
    </section>
  </main>;
}
