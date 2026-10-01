import type { ForecastComponent } from "@/server/phase2/month-forecast";
import type { MonthForecastSnapshot } from "@/server/phase2/month-forecast-snapshot";
import type { StoredMonthInputs } from "@/server/phase2/month-inputs";
import type { MonthScenario } from "@/server/phase2/month-scenario";
import { updateMonthInputs } from "@/app/mois-a-venir/actions";
import { MonthStory, statisticalLabels } from "./month-story";
import type { PlannedExpenseCard } from "./planned-expenses-projection";
import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import type { PlannedVehicleEstimate } from "@/server/phase2/planned-context";
import { calibrateForecast } from "@/server/phase2/forecast-memory";
import { MonthAssumptionEditor } from "./month-decision-tools";
import { parseMonthDecisionSettings } from "@/domain/phase2/month-decision-contract";
import { PlannedExpenseInteractions } from "./planned-expense-interactions";
import { MonthSectionNav } from "./month-section-nav";
import material from "./month-material.module.css";

const money = (value: string | null, exact = false) => value === null ? "À confirmer" : new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", maximumFractionDigits: exact ? 2 : 0, minimumFractionDigits: exact ? 2 : 0,
}).format(Number(value));
const monthLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));
const dateLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
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
    <button className={`${material.clayPrimary} min-h-11 px-4 py-2 font-bold`} type="submit">{label}</button></form>;
}

function Field({ label, name, type = "text", value, min, max, required = false }: { label: string; name: string; type?: string; value?: string; min?: string; max?: string; required?: boolean }) {
  return <label className="grid gap-1 text-sm font-semibold text-slate-800">{label}<input className={`${material.field} min-h-11 w-full px-3 text-base`} name={name} type={type} min={min} max={max} step={type === "number" ? "0.01" : undefined} defaultValue={value} required={required} /></label>;
}

type Props = { forecast: MonthForecastSnapshot; scenario: MonthScenario; stored: StoredMonthInputs;
  plannedExpenses: readonly PlannedExpenseCard[]; persons: readonly { personId: string; displayName: string }[];
  places: readonly PlannedPlaceOption[]; vehicle: PlannedVehicleEstimate | null;
    prices: readonly import("@/domain/phase2/planned-contract").PlannedPriceSuggestion[]; wallets: readonly import("@/domain/phase2/planned-contract").PlannedWalletOption[]; inputError: boolean; today: string };

export function MonthForecastView({ forecast, scenario, stored, plannedExpenses, persons, places, vehicle, prices, wallets, inputError, today }: Props) {
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
  const assumptions = scenario.economicPlan?.narrative.prediction;
  const editableCategories = assumptions ? [...assumptions.essential, ...assumptions.optional]
    : [...(scenario.economicPlan?.necessaryVariables.items ?? []), ...(scenario.economicPlan?.flexibleVariables.items ?? [])]
      .map(category => ({ key: category.key, label: statisticalLabels[category.key] ?? "Autre dépense" }));

  return <PlannedExpenseInteractions><main className={`${material.page} mx-auto max-w-[1280px] space-y-7 pb-20`}>
    <nav aria-label="Mois préparé" className={`${material.monthHeader} flex items-center justify-between gap-6 text-sm font-bold`}><a className={`${material.monthLink} px-3 py-2 text-slate-600`} href={`/mois-a-venir?month=${new Date(Date.UTC(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7)}`}>‹ Mois précédent</a><h1 className="text-center text-4xl font-black uppercase tracking-tight">{monthLabel(targetMonth)}</h1><a className={`${material.monthLink} px-3 py-2 text-slate-600`} href={`/mois-a-venir?month=${new Date(Date.UTC(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5, 7)), 1)).toISOString().slice(0, 7)}`}>Mois suivant ›</a></nav>
    {(!stored.inputs.declaredResources["benefit:swile"] || !stored.inputs.declaredResources["benefit:edenred"])
      && <section className={`${material.glassPrimary} p-5`}><h2 className="text-xl font-black">Préparer les ressources de {monthLabel(targetMonth)}</h2><p className="mt-2 text-sm">Renseignez vos titres-restaurants prévus pour ce mois, y compris 0 € si vous n’en prévoyez aucun. Les ressources et les exceptions d’un autre mois ne sont pas copiées.</p><ActionForm targetMonth={targetMonth} intent="declare-monthly-benefits" label="Enregistrer les ressources de ce mois"><Field label="Ressource Swile du mois (€)" name="swileResource" type="number" min="0" required value={stored.inputs.declaredResources["benefit:swile"]} /><Field label="Ressource Edenred du mois (€)" name="edenredResource" type="number" min="0" required value={stored.inputs.declaredResources["benefit:edenred"]} /></ActionForm></section>}
    {scenario.economicPlan && <MonthSectionNav hasProjects={plannedExpenses.length > 0} />}
    <MonthStory plan={scenario.economicPlan} targetMonth={targetMonth} plannedExpenses={plannedExpenses} persons={persons} places={places} vehicle={vehicle} prices={prices} wallets={wallets} today={today} dateEvidence={forecast.referencePlan?.estimatedDays ?? {}}
      settings={stored.inputs.decision} memory={forecast.forecastMemory} calibrated={forecast.predictionEvidence ? Object.keys(calibrateForecast(forecast.forecastMemory ?? [], forecast.predictionEvidence, today)).length > 0 : false}
      references={Object.fromEntries(forecast.components.map((part) => [part.key, { freshnessDate: part.freshnessDate, confidence: part.confidence }]))} />

    <details id="complete-month" className={`${material.glassPrimary} ${material.disclosure} p-5`} open={!hasBank || !hasSwile || inputError}>
      <summary id="complete-title" className="cursor-pointer text-lg font-bold">Améliorer la précision du mois</summary>
      {inputError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">Impossible d’enregistrer : vérifiez les montants, les dates et la part déjà prévue.</p>}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <details id="bank-balance" className={`${material.precisionAction} ${material.disclosure} scroll-mt-24`}><summary className="cursor-pointer font-bold">Solde actuel <span className="ml-2 text-xs font-normal text-slate-500">{hasBank ? "Mettre à jour" : "À renseigner"}</span></summary><ActionForm targetMonth={targetMonth} intent="save-bank-balance" label="Enregistrer le solde"><Field label="Solde bancaire (€)" name="openingAmount" type="number" value={stored.inputs.openingBalance?.amount} /><Field label="Date du solde" name="openingDate" type="date" value={stored.inputs.openingBalance?.asOfDate} /><p className="text-xs text-slate-600">Le disponible aujourd’hui n’est calculable qu’avec un solde daté d’aujourd’hui.</p></ActionForm></details>
        <details id="swile-balance" className={`${material.precisionAction} ${material.disclosure} scroll-mt-24`}><summary className="cursor-pointer font-bold">Titres-resto <span className="ml-2 text-xs font-normal text-slate-500">{hasSwile ? "Mettre à jour Swile" : "À renseigner · Swile"}</span></summary><ActionForm targetMonth={targetMonth} intent="save-benefit" label="Enregistrer Swile"><Field label="Solde Swile actuel (€)" name="benefitBalance" type="number" min="0" value={stored.inputs.benefit.currentBalance?.amount} /><Field label="Date du solde" name="benefitDate" type="date" value={stored.inputs.benefit.currentBalance?.asOfDate} /><Field label="Chargement attendu (€), si connu" name="benefitLoading" type="number" min="0" value={stored.inputs.benefit.expectedLoading?.amount} /><Field label="Date prévue du chargement" name="loadingDate" value={stored.inputs.benefit.expectedLoading?.expectedDate} type="date" /></ActionForm></details>
        <details id="month-settings" className={`${material.precisionAction} ${material.disclosure} scroll-mt-24 lg:col-span-2`}>
          <summary className="cursor-pointer font-bold">Réglages du mois{pending.length > 0 ? ` · ${pending.length} échéance${pending.length > 1 ? "s" : ""} à préciser` : ""}</summary>
          <div className="mt-4 grid gap-3">
            <div><h3 className="text-sm font-bold">Nos hypothèses</h3>{editableCategories.map(category => <MonthAssumptionEditor key={category.key} categoryKey={category.key} label={category.label} targetMonth={targetMonth} settings={parseMonthDecisionSettings(stored.inputs.decision)} />)}</div>
      <details id="pending-obligations" className="mt-4 rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer font-bold text-emerald-900">Gérer les charges et échéances du mois</summary>
        <ul className="mt-2 divide-y divide-slate-200">{pending.map((part) => <UndatedRow key={part.key} part={part} kind="Dépense possible" targetMonth={targetMonth} />)}{declined.map((part) => <UndatedRow key={part.key} part={part} kind="Dépense possible" targetMonth={targetMonth} declined />)}{otherObligations.map((part) => <UndatedRow key={part.key} part={part} kind="Dépense possible" targetMonth={targetMonth} />)}{excludedFixed.map((part) => <UndatedRow key={part.key} part={part} kind="Charge fixe" targetMonth={targetMonth} excluded />)}</ul>
        {stored.inputs.confirmedObligations.length > 0 && <div className="mt-3 border-t border-slate-200 pt-3"><h3 className="text-sm font-bold">Échéances confirmées par vous</h3><ul className="mt-1 divide-y divide-slate-100">{stored.inputs.confirmedObligations.map((item) => <li key={item.componentKey} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span><strong>{obligations.find((part) => part.key === item.componentKey)?.label ?? "Échéance confirmée"}</strong> · {dateLabel(item.dueDate)} · {money(item.amount, true)}</span><span className="flex flex-wrap gap-1"><DecisionForm targetMonth={targetMonth} intent="decline-conditional" componentKey={item.componentKey} label="Non" /><DecisionForm targetMonth={targetMonth} intent="unknown-conditional" componentKey={item.componentKey} label="Je ne sais pas" /></span></li>)}</ul></div>}
        {includedFixed.length > 0 && <details className="mt-3 border-t border-slate-200 pt-3"><summary className="cursor-pointer text-sm font-bold">Gérer les {includedFixed.length} charges fixes incluses</summary><ul className="mt-2 divide-y divide-slate-100">{includedFixed.map((part) => <li key={part.key} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span><strong>{part.label}</strong> · {money(part.central, true)}</span><details className="text-xs"><summary className="cursor-pointer font-bold text-emerald-900">Retirer ce mois</summary><p className="mt-2 text-slate-600">Retirer uniquement de {monthLabel(targetMonth)} ?</p><DecisionForm targetMonth={targetMonth} intent="exclude-fixed" componentKey={part.key} label="Confirmer le retrait" /></details></li>)}</ul></details>}
      </details>
      <details className="mt-4 text-xs text-slate-600"><summary className="cursor-pointer font-semibold">Fraîcheur des données et détails de la prévision</summary><p className="mt-2">Prévision calculée le {dateLabel(forecast.meta.computedAt.slice(0, 10))}. Les méthodes et sources sont accessibles dans les « Détails » de chaque poste. Certaines habitudes récentes peuvent manquer.</p><p className="mt-1 break-all">Publication {forecast.meta.sourcePublicationId} · Révision {forecast.meta.analyticsRevision}</p></details>

          </div>
        </details>
      </div>
    </details>

  </main></PlannedExpenseInteractions>;
}
