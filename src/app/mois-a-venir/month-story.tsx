import { Banknote, CalendarDays, ChevronDown, House, Landmark, PiggyBank, ShieldCheck, Smartphone, Sparkles, Wallet, BookOpen } from "lucide-react";
import type { MonthEconomicPlan } from "@/server/phase2/month-scenario";
import type { StatisticalComponent } from "@/server/phase2/month-reference";
import { ResourceEditor } from "./resource-editor";
import { MonthCalendar } from "./month-calendar";

const money = (value: string | null, exact = false) => value === null ? "À confirmer" : new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", maximumFractionDigits: exact ? 2 : 0, minimumFractionDigits: exact ? 2 : 0,
}).format(Number(value));
const monthLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));
const groupOrder = ["Maison", "Télécom", "Assurances", "Banque", "Abonnements", "Permis", "Épargne"];
const groupIcons = { Maison: House, Télécom: Smartphone, Assurances: ShieldCheck, Banque: Landmark,
  Abonnements: Sparkles, Permis: BookOpen, Épargne: PiggyBank };
const statisticalLabels: Record<string, string> = {
  groceries: "Courses", "tobacco-vape": "Tabac / vape", "manon-work-mobility": "Essence travail · Manon",
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
  return <article className={`min-w-0 rounded-2xl p-4 sm:p-5 ${tone === "necessary" ? "bg-white shadow-sm ring-1 ring-slate-100" : "bg-slate-50/80"}`}>
    <h3 className="text-sm font-bold text-slate-700">{statisticalLabels[part.key] ?? "Autre dépense"}</h3>
    <p className="mt-2 break-words text-2xl font-black tracking-tight tabular-nums sm:text-[1.7rem]">{money(part.low)} <span className="text-slate-400">–</span> {money(part.high)}</p>
    {part.key !== "manon-work-meals" && <p className="mt-1 text-xs text-slate-600">Habituellement ≈ {money(part.central)}</p>}
    {part.key === "manon-work-meals" && <p className="mt-1 text-xs text-slate-600">Selon les jours travaillés sur place</p>}
    <details className="mt-3 text-xs text-slate-600"><summary className="cursor-pointer font-bold text-emerald-900 focus-visible:outline-2 focus-visible:outline-emerald-700">Pourquoi cette fourchette ?</summary>
      <p className="mt-2">{methodLabels[part.method] ?? "Estimation issue des références publiées."}</p>
      <p className="mt-1">{part.observationCount} {part.key === "adrien-work-coffee" ? "journées actives" : "observations"} dans la référence.</p>
      <details className="mt-2"><summary className="cursor-pointer font-semibold">Sources et limites</summary><p className="mt-1 break-words">{part.provenance.join(" · ")}</p>{part.note && noteLabels[part.key] && <p className="mt-1">{noteLabels[part.key]}</p>}</details>
    </details>
  </article>;
}

export function MonthStory({ plan, targetMonth, plannedEvents }: { plan: MonthEconomicPlan | null; targetMonth: string;
  plannedEvents: readonly { id: string; label: string; plannedDate: string; plannedCost: string }[] }) {
  if (!plan) return <section className="card p-6" role="status"><h2 className="text-xl font-black">Plan économique indisponible</h2><p className="mt-2 text-slate-600">La prévision publiée de ce mois ne contient pas encore les références nécessaires.</p></section>;
  const groups = [...plan.certainOutflows.groups].sort((a, b) => groupOrder.indexOf(a.label) - groupOrder.indexOf(b.label));

  return <div className="space-y-6 sm:space-y-8">
    <header className="space-y-2"><p className="eyebrow">Préparer notre mois ensemble</p><h1 className="text-4xl font-black capitalize tracking-tight sm:text-5xl">{monthLabel(targetMonth)}</h1><p className="text-slate-600">Une vue claire de ce qui entre, de ce qui est déjà réservé et de la place pour le quotidien.</p></header>

    <section className="card p-4 sm:p-6" aria-labelledby="resources-title"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">01 · Ce qui entre</p><h2 id="resources-title" className="mt-1 text-2xl font-black">Nos ressources · {monthLabel(targetMonth)}</h2></div><div className="text-left sm:text-right"><p className="text-xs font-semibold text-slate-600">Capacité économique du mois</p><p className="text-3xl font-black tracking-tight tabular-nums text-emerald-950">{money(plan.economicResources, true)}</p></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{plan.resources.map((resource) => <ResourceEditor key={resource.key} resource={resource} targetMonth={targetMonth} />)}</div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600"><span><Banknote size={14} className="mr-1 inline" aria-hidden="true" />Salaires sur compte : <strong>{money(plan.salaryCash, true)}</strong></span><span><Wallet size={14} className="mr-1 inline" aria-hidden="true" />Cagnottes repas : <strong>{money(plan.mealBenefits, true)}</strong></span></div>
    </section>

    <section aria-labelledby="outflows-title"><div className="flex flex-wrap items-end justify-between gap-2"><div><p className="eyebrow">02 · Déjà engagé</p><h2 id="outflows-title" className="mt-1 text-2xl font-black">Ce qui part quoi qu’il arrive</h2></div><p className="text-2xl font-black tabular-nums">{money(plan.certainOutflows.total, true)}</p></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{groups.map((group) => {
        const Icon = groupIcons[group.label as keyof typeof groupIcons] ?? Wallet;
        const savings = group.label === "Épargne";
        return <details key={group.label} className={`group min-w-0 rounded-2xl ${savings ? "bg-amber-50" : "bg-white shadow-sm ring-1 ring-slate-100"}`}><summary className="flex min-h-17 cursor-pointer list-none items-center gap-3 p-4 focus-visible:outline-2 focus-visible:outline-emerald-700 [&::-webkit-details-marker]:hidden"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${savings ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}><Icon size={20} aria-hidden="true" /></span><span className="min-w-0 flex-1 font-bold">{savings ? "Épargne voyage" : group.label}<span className="block text-xs font-normal text-slate-600">{group.items.length} {savings ? "mise de côté" : group.items.length > 1 ? "éléments" : "élément"}</span></span><strong className="shrink-0 text-right text-lg tabular-nums">{money(group.total)}{savings && <span className="block text-[11px] font-medium text-amber-900">réservés</span>}</strong><ChevronDown className="size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
          <ul className="mx-4 border-t border-slate-200 pb-3 pt-2 text-sm">{group.items.map((item) => <li key={item.key} className="flex flex-wrap justify-between gap-x-3 py-1"><span className="min-w-0 break-words">{item.label}<span className="block text-xs text-slate-500">{item.dateCertainty === "DECLARED" ? "Date déclarée" : item.dateCertainty === "HISTORICAL_ESTIMATE" ? "Date habituelle estimée" : "Date à confirmer"}</span></span><strong className="shrink-0 tabular-nums">{money(item.amount, true)}</strong></li>)}</ul></details>;
      })}</div><p className="mt-3 text-xs text-slate-600">L’épargne est réservée pour votre projet ; elle reste incluse dans les sorties certaines.</p></section>

    <section id="timeline-title" className="card scroll-mt-6 p-4 sm:p-5" aria-labelledby="calendar-title"><details className="group"><summary className="flex cursor-pointer list-none items-center gap-3 focus-visible:outline-2 focus-visible:outline-emerald-700 [&::-webkit-details-marker]:hidden"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><CalendarDays size={19} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="eyebrow">03 · Le rythme du mois</span><span id="calendar-title" className="block text-lg font-black">Voir les sorties programmées</span></span><ChevronDown className="size-5 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" /></summary><MonthCalendar targetMonth={targetMonth} outflows={plan.certainOutflows.items} plannedEvents={plannedEvents} /></details></section>

    <section className="overflow-hidden rounded-[1.7rem] bg-emerald-950 px-5 py-6 text-white sm:flex sm:items-end sm:justify-between sm:gap-5 sm:px-8 sm:py-7" aria-labelledby="after-title"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">04 · Notre marge avant la vie courante</p><h2 id="after-title" className="mt-2 text-xl font-bold">Après nos charges certaines</h2><p className="mt-1 text-sm text-emerald-100">Avant les dépenses variables du mois · capacité économique, pas solde bancaire</p></div><p className="mt-4 whitespace-nowrap text-4xl font-black tracking-tight tabular-nums sm:mt-0 sm:text-5xl">{money(plan.afterCertainOutflows, true)}</p></section>

    <section aria-labelledby="necessary-title"><div className="flex flex-wrap items-end justify-between gap-2"><div><p className="eyebrow">05 · Les besoins courants</p><h2 id="necessary-title" className="mt-1 text-2xl font-black">Variable mais nécessaire</h2></div><p className="text-sm font-bold text-slate-600">{money(plan.necessaryVariables.total.low)} – {money(plan.necessaryVariables.total.high)}</p></div><div className="mt-4 grid gap-3 md:grid-cols-3">{plan.necessaryVariables.items.map((part) => <StatisticalCard key={part.key} part={part} tone="necessary" />)}</div></section>

    <section aria-labelledby="flexible-title"><div className="flex flex-wrap items-end justify-between gap-2"><div><p className="eyebrow">06 · Notre rythme de vie</p><h2 id="flexible-title" className="mt-1 text-2xl font-black">Habitudes flexibles</h2></div><p className="text-sm font-bold text-slate-600">{money(plan.flexibleVariables.total.low)} – {money(plan.flexibleVariables.total.high)}</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{plan.flexibleVariables.items.map((part) => <StatisticalCard key={part.key} part={part} tone="flexible" />)}</div></section>

    <section className="rounded-[1.7rem] bg-emerald-50/80 p-5 sm:p-6" aria-labelledby="scenarios-title"><p className="eyebrow">07 · Ce qui pourrait rester</p><h2 id="scenarios-title" className="mt-1 text-2xl font-black">Selon les dépenses du mois</h2><div className="mt-4 grid gap-2 sm:grid-cols-3">{([
      ["Dépenses basses", plan.scenarios.lowConsumption], ["Scénario central", plan.scenarios.central], ["Dépenses hautes", plan.scenarios.highConsumption],
    ] as const).map(([label, amount], index) => <div key={label} className={`rounded-xl p-4 ${index === 1 ? "bg-white shadow-sm" : "bg-white/60"}`}><p className="text-sm font-semibold text-slate-700">{label}</p><p className="mt-1 text-2xl font-black tabular-nums">{money(amount, true)}</p><p className="text-xs text-slate-600">restants</p></div>)}</div><p className="mt-3 text-xs text-slate-600">Ces scénarios décrivent des habitudes variables ; le montant central n’est pas une promesse.</p></section>
  </div>;
}
