import { Banknote, CalendarDays, ChevronDown, House, Landmark, PiggyBank, ShieldCheck, Smartphone, Sparkles, Wallet, BookOpen } from "lucide-react";
import type { MonthEconomicPlan } from "@/server/phase2/month-scenario";
import type { StatisticalComponent } from "@/server/phase2/month-reference";
import { ResourceEditor } from "./resource-editor";
import { MonthCalendar } from "./month-calendar";
import { PlannedExpenseInteractions } from "./planned-expense-interactions";
import { PlannedExpensesControl } from "./planned-expenses-control";
import { projectMonthCalendar, type PlannedExpenseCard } from "./planned-expenses-projection";
import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import type { PlannedVehicleEstimate } from "@/server/phase2/planned-context";

const money = (value: string | null, exact = false) => value === null ? "À confirmer" : new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", maximumFractionDigits: exact ? 2 : 0, minimumFractionDigits: exact ? 2 : 0,
}).format(Number(value));
const monthLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));
const groupOrder = ["Maison", "Télécom", "Assurances", "Banque", "Abonnements", "Permis", "Épargne"];
const groupIcons = { Maison: House, Télécom: Smartphone, Assurances: ShieldCheck, Banque: Landmark,
  Abonnements: Sparkles, Permis: BookOpen, Épargne: PiggyBank };
const statisticalLabels: Record<string, string> = {
  groceries: "Courses", "tobacco-vape": "Tabac & vape", "manon-work-mobility": "Trajets travail · Manon",
  "adrien-work-meals": "Repas travail · Adrien", "manon-work-meals": "Repas travail · Manon",
  "adrien-work-coffee": "Café travail · Adrien", "household-restaurants": "Restaurants du foyer",
};
const methodLabels: Record<string, string> = {
  MONTHLY_P25_MEDIAN_P75_12M: "Fourchette issue des 12 derniers mois : quartile bas, médiane et quartile haut.",
  WORKDAY_SCENARIO_OBSERVED_UNIT_COST: "Scénario fondé sur le coût observé par repas et les jours de travail du mois. La valeur centrale est un milieu de scénario.",
  CANONICAL_MOBILITY_WORKDAY_SCENARIO: "Scénario de trajets domicile–travail et détour déjeuner, issu des trajets canoniques ; cinq jours sur site par semaine sont supposés.",
  DECLARED_ATTRIBUTION_ONSITE_DAYS_X_DAILY_DISTRIBUTION: "Fourchette fondée sur les jours sur site et les dépenses quotidiennes observées. L’attribution à Adrien est déclarée.",
};
const noteLabels: Record<string, string> = {
  "manon-work-meals": "La valeur centrale est un milieu de scénario, pas une médiane mensuelle observée.",
  "manon-work-mobility": "Il s’agit d’essence consommée par les trajets, et non des pleins payés.",
  "adrien-work-coffee": "L’attribution à Adrien est déclarée : les opérations ne portent pas de personne.",
};

function StatisticalCard({ part, tone }: { part: StatisticalComponent; tone: "necessary" | "flexible" }) {
  return <article className={`min-w-0 rounded-2xl ${tone === "necessary" ? "bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6" : "bg-slate-50/80 p-4 sm:p-5"}`}>
    <h3 className="text-sm font-bold text-slate-700">{statisticalLabels[part.key] ?? "Autre dépense"}</h3>
    <p className={`mt-2 break-words font-black tracking-tight tabular-nums ${tone === "necessary" ? "text-[1.7rem] sm:text-[1.9rem]" : "text-2xl"}`}>{money(part.low)} <span className="text-slate-400">–</span> {money(part.high)}</p>
    {part.key !== "manon-work-meals" && part.key !== "manon-work-mobility" && <p className="mt-1 text-xs text-slate-600">Autour de <strong>{money(part.central)}</strong> sur un mois habituel</p>}
    {part.key === "manon-work-meals" && <p className="mt-1 text-xs text-slate-600">Selon les jours travaillés sur place</p>}
    {part.key === "manon-work-mobility" && <p className="mt-1 text-xs text-slate-600">5 jours sur site par semaine</p>}
    <details className="mt-3 text-xs text-slate-600"><summary className="cursor-pointer font-bold text-emerald-900 focus-visible:outline-2 focus-visible:outline-emerald-700">Détails</summary>
      <p className="mt-2">{methodLabels[part.method] ?? "Estimation issue des références publiées."}</p>
      <p className="mt-1">{part.observationCount} {part.key === "adrien-work-coffee" ? "journées actives" : "observations"} dans la référence.</p>
      <details className="mt-2"><summary className="cursor-pointer font-semibold">Sources et limites</summary><p className="mt-1 break-words">{part.provenance.join(" · ")}</p>{part.note && noteLabels[part.key] && <p className="mt-1">{noteLabels[part.key]}</p>}</details>
    </details>
  </article>;
}

export function MonthStory({ plan, targetMonth, plannedExpenses, persons, places, vehicle, prices }: { plan: MonthEconomicPlan | null; targetMonth: string;
  plannedExpenses: readonly PlannedExpenseCard[]; persons: readonly { personId: string; displayName: string }[];
  places: readonly PlannedPlaceOption[]; vehicle: PlannedVehicleEstimate | null;
  prices: readonly import("@/domain/phase2/planned-contract").PlannedPriceSuggestion[] }) {
  if (!plan) return <section className="card p-6" role="status"><h2 className="text-xl font-black">Notre mois n’est pas encore prêt</h2><p className="mt-2 text-slate-600">Il manque encore des informations pour préparer ce mois.</p></section>;
  const groups = [...plan.certainOutflows.groups].sort((a, b) => groupOrder.indexOf(a.label) - groupOrder.indexOf(b.label));
  const calendar = projectMonthCalendar(plan.certainOutflows.items, plannedExpenses);

  return <PlannedExpenseInteractions><div className="space-y-7 sm:space-y-9">
    <header className="space-y-2"><p className="eyebrow">Préparons notre mois ensemble</p><h1 className="text-4xl font-black capitalize tracking-tight sm:text-5xl">{monthLabel(targetMonth)}</h1><p className="text-slate-600">Voyons ce qui entre, ce qui est déjà réservé et ce qu’on peut encore prévoir.</p><p className="text-xs text-slate-600">Les dépenses de travail restent estimées selon les rythmes déclarés : cinq jours sur site par semaine pour Manon, deux à trois pour Adrien, avec les jours ouvrés de ce mois.</p></header>

    <section className="card p-4 sm:p-6" aria-labelledby="resources-title"><div className="flex flex-wrap items-end justify-between gap-3"><h2 id="resources-title" className="text-2xl font-black">Nos ressources</h2><div className="text-left sm:text-right"><p className="text-xs font-semibold text-slate-600">Ressources prévues du mois</p><p className="text-3xl font-black tracking-tight tabular-nums text-emerald-950">{money(plan.economicResources, true)}</p></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{plan.resources.map((resource) => <ResourceEditor key={resource.key} resource={resource} targetMonth={targetMonth} />)}</div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600"><span><Banknote size={14} className="mr-1 inline" aria-hidden="true" /><strong>{money(plan.salaryCash, true)}</strong> de salaires prévus</span><span><Wallet size={14} className="mr-1 inline" aria-hidden="true" /><strong>{money(plan.mealBenefits, true)}</strong> en titres-restaurants</span></div>
    </section>

    <section aria-labelledby="outflows-title"><div className="flex flex-wrap items-end justify-between gap-2"><h2 id="outflows-title" className="text-2xl font-black">Ce qui part quoi qu’il arrive</h2><p className="text-2xl font-black tabular-nums">{money(plan.certainOutflows.total, true)}</p></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{groups.map((group) => {
        const Icon = groupIcons[group.label as keyof typeof groupIcons] ?? Wallet;
        const savings = group.label === "Épargne";
        return <details key={group.label} className={`group min-w-0 rounded-2xl ${savings ? "bg-amber-50" : "bg-white shadow-sm ring-1 ring-slate-100"}`}><summary className="flex min-h-17 cursor-pointer list-none items-center gap-3 p-4 focus-visible:outline-2 focus-visible:outline-emerald-700 [&::-webkit-details-marker]:hidden"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${savings ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}><Icon size={20} aria-hidden="true" /></span><span className="min-w-0 flex-1 font-bold">{savings ? "Épargne voyage" : group.label}<span className="block text-xs font-normal text-slate-600">{savings ? "Objectif du mois" : `${group.items.length} ${group.items.length > 1 ? "éléments" : "élément"}`}</span></span><strong className="shrink-0 text-right text-lg tabular-nums">{money(group.total)}{savings && <span className="block text-[11px] font-medium text-amber-900">réservés pour le voyage</span>}</strong><ChevronDown className="size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
          <ul className="mx-4 border-t border-slate-200 pb-3 pt-2 text-sm">{group.items.map((item) => <li key={item.key} className="flex flex-wrap justify-between gap-x-3 py-1"><span className="min-w-0 break-words">{item.label}<span className="block text-xs text-slate-500">{item.dateCertainty === "DECLARED" ? "Date déclarée" : item.dateCertainty === "HISTORICAL_ESTIMATE" ? "Date habituelle estimée" : "Date à confirmer"}</span></span><strong className="shrink-0 tabular-nums">{money(item.amount, true)}</strong></li>)}</ul></details>;
      })}</div></section>

    <section id="timeline-title" className="card scroll-mt-6 p-4 sm:p-6" aria-labelledby="calendar-title"><div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><CalendarDays size={19} aria-hidden="true" /></span><div><h2 id="calendar-title" className="text-xl font-black">Notre mois en un coup d’œil</h2><p className="text-xs text-slate-600">Les dates déclarées et nos dates habituelles</p></div></div><MonthCalendar key={targetMonth} targetMonth={targetMonth} entries={calendar.entries} undated={calendar.undated} dailyTotals={calendar.dailyTotals} /></section>

    <section className="overflow-hidden rounded-[1.7rem] bg-emerald-950 px-5 py-6 text-white sm:flex sm:items-end sm:justify-between sm:gap-5 sm:px-8 sm:py-7" aria-labelledby="after-title"><div><h2 id="after-title" className="text-xl font-bold">Après nos charges certaines</h2><p className="mt-1 text-sm text-emerald-100">Avant les dépenses du quotidien</p><p className="mt-2 text-xs text-emerald-200">Inclut les titres-restaurants ; ce n’est pas notre solde bancaire.</p></div><p className="mt-4 whitespace-nowrap text-4xl font-black tracking-tight tabular-nums sm:mt-0 sm:text-5xl">{money(plan.afterCertainOutflows, true)}</p></section>

    <PlannedExpensesControl targetMonth={targetMonth} expenses={plannedExpenses} persons={persons} places={places} vehicle={vehicle} prices={prices} funding={plan.plannedFunding} />

    <section className="card p-5" aria-label="Construction du reste projeté"><h2 className="text-xl font-black">Comment se construit notre mois</h2><dl className="mt-3 grid grid-cols-5 gap-3">{([
      ["Après dépenses certaines", plan.monthlyLayers.afterCertainOutflows], ["Déjà réalisé", plan.monthlyLayers.declaredRealized],
      ["Encore prévu", plan.monthlyLayers.stillPlanned], ["Vie courante restante estimée", plan.monthlyLayers.remainingDailyLife],
      ["Reste projeté", plan.monthlyLayers.projectedRemainder],
    ] as const).map(([label, amount]) => <div key={label}><dt className="text-xs font-semibold text-slate-600">{label}</dt><dd className="mt-1 text-lg font-black">{money(amount, true)}</dd></div>)}</dl><p className="mt-3 text-xs text-slate-600">« Déjà réalisé » désigne ici vos projets marqués comme réalisés. Leur changement d’état conserve le coût du mois.</p></section>

    <section aria-labelledby="necessary-title"><h2 id="necessary-title" className="text-2xl font-black">Ce qu’il nous faut pour le quotidien</h2><p className="mt-1 text-sm text-slate-600">Des dépenses qui varient, mais qu’on aura normalement ce mois-ci.</p><div className="mt-4 grid gap-3 md:grid-cols-3">{plan.necessaryVariables.items.map((part) => <StatisticalCard key={part.key} part={part} tone="necessary" />)}</div></section>

    <section aria-labelledby="flexible-title"><h2 id="flexible-title" className="text-2xl font-black">Ce qu’on dépense parfois en plus</h2><p className="mt-1 text-sm text-slate-600">Cela dépend de nos journées au travail et de nos envies du mois.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{plan.flexibleVariables.items.map((part) => <StatisticalCard key={part.key} part={part} tone="flexible" />)}</div></section>

    <section className="rounded-[1.7rem] bg-emerald-50/80 p-5 sm:p-6" aria-labelledby="scenarios-title"><h2 id="scenarios-title" className="text-2xl font-black">Reste projeté en fin de mois</h2><p className="mt-4 text-4xl font-black tabular-nums">{money(plan.scenarios.central, true)}</p><p className="mt-1 text-sm text-slate-600">Estimation centrale, autour de notre rythme habituel</p><details className="mt-3 text-sm"><summary className="cursor-pointer font-bold">Voir la fourchette</summary><div className="mt-3 grid grid-cols-2 gap-3"><p>Si on dépense plutôt peu : <strong>{money(plan.scenarios.lowConsumption, true)}</strong></p><p>Si le mois coûte plus cher : <strong>{money(plan.scenarios.highConsumption, true)}</strong></p></div></details><p className="mt-3 text-xs text-slate-600">Ces montants sont des repères, pas une promesse. Notre marge de sécurité, réglable plus bas, n’est pas encore retirée ici.</p></section>
  </div></PlannedExpenseInteractions>;
}
