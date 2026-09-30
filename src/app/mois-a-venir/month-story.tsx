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
import { RemainingForecastCard, ScenarioMilestone, ForecastTransition } from "./month-narrative-cards";
import { parseMonthDecisionSettings, type MonthDecisionSettings } from "@/domain/phase2/month-decision-contract";
import { projectMonthDecision } from "@/server/phase2/month-decision-projection";
import type { ForecastCheckpoint } from "@/server/phase2/forecast-memory";
import { MonthDecisionTools } from "./month-decision-tools";
import { MonthSectionNav } from "./month-section-nav";

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

export function MonthStory({ plan, targetMonth, plannedExpenses, persons, places, vehicle, prices, today, dateEvidence, references, settings: rawSettings, memory = [], calibrated = false }: { plan: MonthEconomicPlan | null; targetMonth: string;
  settings?: MonthDecisionSettings; memory?: readonly ForecastCheckpoint[]; calibrated?: boolean;
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
  const settings = parseMonthDecisionSettings(rawSettings);
  const decision = projectMonthDecision(plan, settings, targetMonth, today, plannedExpenses, memory);
  const current = decision.mode === "CURRENT_MONTH";

  return <PlannedExpenseInteractions><div className="space-y-7 sm:space-y-9">
    <header className="space-y-2"><p className="eyebrow">{current ? "Notre mois en cours" : "Préparons notre mois ensemble"}</p><h1 className="text-4xl font-black capitalize tracking-tight">{monthLabel(targetMonth)}</h1><p className="text-slate-600">{current ? "Ce qu’on connaît déjà, puis ce qu’il reste à prévoir." : "Voyons ce qui entre, ce qui est réservé et ce qu’on peut prévoir."}</p><p className="text-xs text-slate-500">Estimation au {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${today}T12:00:00Z`))}</p></header>
    <MonthSectionNav />

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

    <section className="flex items-center justify-between gap-5 rounded-2xl border border-emerald-100 bg-emerald-50/50 px-6 py-5" aria-labelledby="after-title"><div><h2 id="after-title" className="text-xl font-bold">Après nos charges certaines</h2><p className="mt-1 text-xs text-slate-600">Avant le quotidien et nos projets · titres-restaurants compris</p><p className="mt-1 text-xs text-slate-500">Repère arrondi pour la suite : {money(String(decision.visible.afterCertain))}</p></div><p className="whitespace-nowrap text-3xl font-black tabular-nums text-emerald-950">{money(plan.afterCertainOutflows, true)}</p></section>
    <PlannedExpensesControl targetMonth={targetMonth} expenses={plannedExpenses} persons={persons} places={places} vehicle={vehicle} prices={prices} funding={plan.plannedFunding} />

    <section id="timeline-title" className="scroll-mt-24" aria-label="Calendrier du mois"><MonthCalendar key={targetMonth} targetMonth={targetMonth} today={today} entries={calendar.entries} undated={calendar.undated} dailyTotals={calendar.dailyTotals} /></section>

    {decision.showProjectMilestone ? <><ForecastTransition label="Effet supplémentaire de nos projets" amount={decision.visible.projectDelta} /><section aria-labelledby="after-projects-title" className="flex items-center justify-between gap-5 rounded-2xl bg-sky-50/70 px-6 py-4"><div><h2 id="after-projects-title" className="text-lg font-bold">Après nos charges et nos projets</h2><p className="mt-1 text-xs text-slate-600">Le coût habituel déjà compris dans le quotidien est déduit de l’effet des projets.</p></div><p className="text-3xl font-black tabular-nums text-sky-950">{money(String(decision.visible.afterProjects))}</p></section></> : <p className="text-sm text-slate-500">{plannedExpenses.length ? "Nos projets restent dans les habitudes déjà prévues : aucun effet supplémentaire sur ce jalon." : "Aucun projet ajouté : poursuivons avec le quotidien."}</p>}
    <section aria-labelledby="necessary-title" className="scroll-mt-24"><h2 id="necessary-title" className="text-2xl font-black">Ce qu’il nous faut pour le quotidien</h2><p className="mt-1 text-sm text-slate-600">Ce qu’il reste à couvrir pour vivre normalement jusqu’à la fin du mois.</p><div className="mt-4 grid grid-cols-3 gap-3">{prediction ? prediction.essential.map(category => <RemainingForecastCard key={category.key} category={category} display={decision.visible.categoryDisplay[category.key]} importsMissing={importsMissing} current={current} targetMonth={targetMonth} settings={settings} />) : plan.necessaryVariables.items.map(part => <StatisticalCard key={part.key} part={part} tone="necessary" />)}</div></section>

    <ForecastTransition label="Référence du quotidien nécessaire" amount={decision.visible.essentialDelta} parts={decision.visible.essential} />
    <ScenarioMilestone title="Après l’essentiel du mois" values={narrative.remainderAfterEssential} labels={["Si le quotidien coûte peu", "Mois habituel", "Si le quotidien coûte plus"]} incomplete={importsMissing}
      description="Après les charges, l’effet de nos projets et le quotidien nécessaire. Les dépenses importées et la part habituelle déjà couverte sont comptées une seule fois ; les extras restent à part." />

    <section aria-labelledby="flexible-title" className="scroll-mt-24"><h2 id="flexible-title" className="text-2xl font-black">Ce qui pourrait encore s’ajouter</h2><p className="mt-1 text-sm text-slate-600">Des achats facultatifs encore possibles, selon les occasions restantes. Un mois calme peut rester à 0 €.</p><div className="mt-4 grid grid-cols-2 gap-3">{prediction ? prediction.optional.map(category => <RemainingForecastCard key={category.key} category={category} display={decision.visible.categoryDisplay[category.key]} optional importsMissing={importsMissing} current={current} targetMonth={targetMonth} settings={settings} />) : plan.flexibleVariables.items.map(part => <StatisticalCard key={part.key} part={part} tone="flexible" />)}</div></section>

    <ForecastTransition label="Référence des dépenses facultatives" amount={decision.visible.optionalDelta} parts={decision.visible.optional} />
    <ScenarioMilestone title="Projection de fin de mois" values={narrative.final} labels={["Mois calme", "Scénario habituel", "Mois plus coûteux"]} final incomplete={importsMissing}
      description={decision.jointExplanation} />
    {decision.mealFundingVisible && <section id="meal-funding" className="scroll-mt-24 rounded-2xl border border-slate-200 p-5"><h2 className="text-lg font-bold">Nos ressources repas affectées</h2><p className="mt-1 text-xs text-slate-600">Les affectations explicites aux projets sont comptées ici. Les futurs repas estimés ne réservent pas automatiquement de titres-restaurants.</p><div className="mt-3 grid grid-cols-2 gap-4">{([["Swile", plan.plannedFunding.swile], ["Edenred", plan.plannedFunding.edenred]] as const).map(([label, pocket]) => <dl className="space-y-1 text-sm" key={label}><dt className="font-bold">{label}</dt><dd>Ressource : {money(pocket.resource, true)}</dd><dd>Réservé aux projets : {money(pocket.reserved, true)}</dd><dd>Usage déclaré : {money(pocket.usedDeclared, true)}</dd><dd>Disponible après affectations : {money(pocket.availableAfter, true)}</dd>{Number(pocket.shortfall) > 0 && <dd className="text-amber-900">À financer autrement : {money(pocket.shortfall, true)}</dd>}</dl>)}</div></section>}
    {decision.attention.length > 0 && <section aria-labelledby="attention-title" className="rounded-2xl bg-amber-50 p-5"><h2 id="attention-title" className="text-lg font-bold">À regarder ensemble</h2><ul className="mt-3 space-y-2 text-sm">{decision.attention.map(item => <li key={item.key}><a className="underline underline-offset-2" href={item.href}>{item.message}</a></li>)}</ul></section>}
    <details id="forecast-history" className="scroll-mt-24 rounded-2xl border border-slate-200 p-5"><summary className="cursor-pointer font-bold">Comment notre projection évolue</summary><p className="mt-3 text-sm text-slate-600">{decision.change.stability}</p><p className="mt-2 text-xs text-slate-600">{calibrated ? "Les erreurs de mois terminés avec imports complets corrigent le biais et la largeur de certains intervalles." : "Calibration personnelle : recul insuffisant. Il faut quatre mois terminés, avec imports complets et prévisions réellement conservées, au même horizon."}</p>
      {decision.change.sampleCount > 0 && <><p className="mt-3 text-sm">Depuis la dernière estimation : <strong>{money(String(decision.change.visibleDelta))}</strong> sur la projection arrondie.</p><ul className="mt-2 space-y-1 text-sm">{decision.change.visibleChanges.map(item => <li key={item.key} className="flex justify-between gap-4"><span>{item.label}</span><strong>{money(String(item.visible))}</strong></li>)}</ul><p className="mt-2 text-xs">Écart exact avant arrondi : {money(decision.change.delta, true)}.</p></>}
      <details className="mt-4 text-xs"><summary className="cursor-pointer font-semibold">Estimations conservées</summary>{memory.filter(r => r.target_month.startsWith(targetMonth)).length ? <ul className="mt-2 space-y-1">{memory.filter(r => r.target_month.startsWith(targetMonth)).map(r => <li key={r.checkpoint_id}>{r.as_of_date} · {money(r.payload.final.central)} · <span className="text-slate-500">{r.model_version}</span></li>)}</ul> : <p className="mt-2">Aucune estimation conservée. Les prévisions passées ne sont jamais recréées après coup.</p>}</details>
    </details>
    <MonthDecisionTools key={`${targetMonth}:${plan.narrative.final.central}:${JSON.stringify(settings)}`} targetMonth={targetMonth} settings={settings} decision={decision} />
  </div></PlannedExpenseInteractions>;
}
