import { Banknote, ChevronDown, House, Landmark, PiggyBank, ShieldCheck, Smartphone, Sparkles, Wallet, BookOpen } from "lucide-react";
import type { MonthEconomicPlan } from "@/server/phase2/month-scenario";
import type { StatisticalComponent } from "@/server/phase2/month-reference";
import { ResourceEditor } from "./resource-editor";
import { MonthCalendar } from "./month-calendar";
import { PlannedExpenseInteractions } from "./planned-expense-interactions";
import { PlannedExpensesControl } from "./planned-expenses-control";
import { projectMonthCalendar, type PlannedExpenseCard } from "./planned-expenses-projection";
import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import type { PlannedVehicleEstimate } from "@/server/phase2/planned-context";
import { RemainingForecastCard, ScenarioMilestone } from "./month-narrative-cards";

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
    <dl className="mt-3 grid grid-cols-3 gap-2">{([[tone === "necessary" ? "Bas plausible" : "Calme", part.low], [tone === "necessary" ? "Habituel" : "Probable", part.central], [tone === "necessary" ? "Haut plausible" : "Actif", part.high]] as const).map(([label, value], index) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className={`mt-1 tabular-nums ${index === 1 ? "text-2xl font-black" : "text-sm"}`}>{money(value)}</dd></div>)}</dl>
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

export function MonthStory({ plan, targetMonth, plannedExpenses, persons, places, vehicle, prices, today, dateEvidence, references }: { plan: MonthEconomicPlan | null; targetMonth: string;
  plannedExpenses: readonly PlannedExpenseCard[]; persons: readonly { personId: string; displayName: string }[];
  places: readonly PlannedPlaceOption[]; vehicle: PlannedVehicleEstimate | null;
  prices: readonly import("@/domain/phase2/planned-contract").PlannedPriceSuggestion[]; today: string;
  dateEvidence: Readonly<Record<string, { observationCount: number }>>;
  references: Readonly<Record<string, { freshnessDate: string | null; confidence: string }>> }) {
  if (!plan) return <section className="card p-6" role="status"><h2 className="text-xl font-black">Notre mois n’est pas encore prêt</h2><p className="mt-2 text-slate-600">Il manque encore des informations pour préparer ce mois.</p></section>;
  const groups = [...plan.certainOutflows.groups].sort((a, b) => groupOrder.indexOf(a.label) - groupOrder.indexOf(b.label));
  const calendar = projectMonthCalendar(plan.certainOutflows.items.map((item) => ({ ...item, ...references[item.key],
    dateEvidenceCount: item.dateCertainty === "HISTORICAL_ESTIMATE" ? dateEvidence[item.key]?.observationCount : undefined })), plannedExpenses);
  const narrative = plan.narrative, prediction = narrative.prediction;
  const importsMissing = prediction?.currentImportsMissing ?? false;

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

    <section className="overflow-hidden rounded-[1.7rem] bg-emerald-950 px-5 py-6 text-white sm:flex sm:items-end sm:justify-between sm:gap-5 sm:px-8 sm:py-7" aria-labelledby="after-title"><div><h2 id="after-title" className="text-xl font-bold">Après nos charges certaines</h2><p className="mt-1 text-sm text-emerald-100">Avant le quotidien et nos nouveaux projets</p><p className="mt-2 text-xs text-emerald-200">Inclut les titres-restaurants ; ce n’est pas notre solde bancaire.</p></div><p className="mt-4 whitespace-nowrap text-4xl font-black tracking-tight tabular-nums sm:mt-0 sm:text-5xl">{money(plan.afterCertainOutflows, true)}</p></section>

    <PlannedExpensesControl targetMonth={targetMonth} expenses={plannedExpenses} persons={persons} places={places} vehicle={vehicle} prices={prices} funding={plan.plannedFunding} />

    <section id="timeline-title" className="scroll-mt-6" aria-label="Calendrier du mois"><MonthCalendar key={targetMonth} targetMonth={targetMonth} today={today} entries={calendar.entries} undated={calendar.undated} dailyTotals={calendar.dailyTotals} /></section>

    <section aria-labelledby="after-projects-title" className="flex items-end justify-between gap-5 rounded-2xl border border-sky-100 bg-sky-50/70 p-6"><div>
      <h2 id="after-projects-title" className="text-xl font-bold">Après nos charges et nos projets</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">Le coût habituel reste compris dans le quotidien estimé. Ce jalon applique uniquement l’effet supplémentaire de nos choix, pas leur coût brut dans le calendrier.</p>
    </div><p className="whitespace-nowrap text-4xl font-black tabular-nums text-sky-950">{money(narrative.remainderAfterProjects, true)}</p></section>

    <section aria-labelledby="necessary-title"><h2 id="necessary-title" className="text-2xl font-black">Ce qu’il nous faut pour le quotidien</h2><p className="mt-1 text-sm text-slate-600">Ce qu’il reste à couvrir pour vivre normalement jusqu’à la fin du mois.</p><div className="mt-4 grid grid-cols-3 gap-3">{prediction ? prediction.essential.map(category => <RemainingForecastCard key={category.key} category={category} importsMissing={importsMissing} />) : plan.necessaryVariables.items.map(part => <StatisticalCard key={part.key} part={part} tone="necessary" />)}</div></section>

    <ScenarioMilestone title="Après l’essentiel du mois" values={narrative.remainderAfterEssential} labels={["Si le quotidien coûte peu", "Mois habituel", "Si le quotidien coûte plus"]} incomplete={importsMissing}
      description="Après les charges, l’effet de nos projets et le quotidien nécessaire. Les dépenses importées et la part habituelle déjà couverte sont comptées une seule fois ; les extras restent à part." />

    <section aria-labelledby="flexible-title"><h2 id="flexible-title" className="text-2xl font-black">Ce qui pourrait encore s’ajouter</h2><p className="mt-1 text-sm text-slate-600">Des achats facultatifs encore possibles, selon les occasions restantes. Un mois calme peut rester à 0 €.</p><div className="mt-4 grid grid-cols-2 gap-3">{prediction ? prediction.optional.map(category => <RemainingForecastCard key={category.key} category={category} optional importsMissing={importsMissing} />) : plan.flexibleVariables.items.map(part => <StatisticalCard key={part.key} part={part} tone="flexible" />)}</div></section>

    <ScenarioMilestone title="Projection de fin de mois" values={narrative.final} labels={["Mois calme", "Scénario habituel", "Mois plus coûteux"]} final incomplete={importsMissing}
      description="L’essentiel du mois, puis les dépenses facultatives encore possibles. Chaque scénario reste une estimation." />
  </div></PlannedExpenseInteractions>;
}
