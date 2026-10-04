import { ChevronDown, House, Landmark, ShieldCheck, Smartphone, Sparkles, Wallet, BookOpen } from "lucide-react";
import type { MonthEconomicPlan } from "@/server/phase2/month-scenario";
import type { StatisticalComponent } from "@/server/phase2/month-reference";
import { ResourceEditor } from "./resource-editor";
import { MonthCalendar } from "./month-calendar";
import { PlannedExpensesControl } from "./planned-expenses-control";
import { projectMonthCalendar, type PlannedExpenseCard } from "./planned-expenses-projection";
import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import type { PlannedVehicleEstimate } from "@/server/phase2/planned-context";
import { RemainingForecastCard, ScenarioMilestone, ForecastInfo } from "./month-narrative-cards";
import { parseMonthDecisionSettings, type MonthDecisionSettings } from "@/domain/phase2/month-decision-contract";
import { projectMonthDecision } from "@/server/phase2/month-decision-projection";
import { comparableForecastCheckpoints, type ForecastCheckpoint } from "@/server/phase2/forecast-memory";
import { MonthDecisionTools } from "./month-decision-tools";
import { AnimatedMoney } from "./animated-money";
import { MonthSavingsSection } from "./month-savings-section";
import material from "./month-material.module.css";

const money = (value: string | null, exact = false) => value === null ? "À confirmer" : new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", maximumFractionDigits: exact ? 2 : 0, minimumFractionDigits: exact ? 2 : 0,
}).format(Number(value));
const groupOrder = ["Maison", "Télécom", "Assurances", "Banque", "Abonnements", "Permis"];
const groupIcons = { Maison: House, Télécom: Smartphone, Assurances: ShieldCheck, Banque: Landmark,
  Abonnements: Sparkles, Permis: BookOpen };
export const statisticalLabels: Readonly<Record<string, string>> = {
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
  return <article data-month-motion-item className={`${material.dataCard} p-5`}>
    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-700">{statisticalLabels[part.key] ?? "Autre dépense"}</h3>
      <ForecastInfo label={`Comprendre : ${statisticalLabels[part.key] ?? "Autre dépense"}`}><p>{methodLabels[part.method] ?? "Estimation issue des références publiées."}</p><p>{part.observationCount} observations.</p>
        <p>{part.provenance.join(" · ")}</p>{part.note && noteLabels[part.key] && <p>{noteLabels[part.key]}</p>}</ForecastInfo></div>
    <p className={`${material.data} mt-3 text-3xl font-black`}>{tone === "flexible" && <span className="mr-2 text-sm font-medium text-slate-500">Probable</span>}<AnimatedMoney value={money(part.central)} /></p>
  </article>;
}

export function MonthStory({ plan, targetMonth, plannedExpenses, calendarCarryovers = [], persons, places, vehicle, prices, wallets, today, dateEvidence, references, settings: rawSettings, memory = [], calibrated = false }: { plan: MonthEconomicPlan | null; targetMonth: string;
  settings?: MonthDecisionSettings; memory?: readonly ForecastCheckpoint[]; calibrated?: boolean;
  plannedExpenses: readonly PlannedExpenseCard[]; calendarCarryovers?: readonly PlannedExpenseCard[]; persons: readonly { personId: string; displayName: string }[];
  places: readonly PlannedPlaceOption[]; vehicle: PlannedVehicleEstimate | null;
  prices: readonly import("@/domain/phase2/planned-contract").PlannedPriceSuggestion[]; today: string;
  wallets: readonly import("@/domain/phase2/planned-contract").PlannedWalletOption[];
  dateEvidence: Readonly<Record<string, { observationCount: number }>>;
  references: Readonly<Record<string, { freshnessDate: string | null; confidence: string }>> }) {
  if (!plan) return <section className="card p-6" role="status"><h2 className="text-xl font-black">Notre mois n’est pas encore prêt</h2><p className="mt-2 text-slate-600">Il manque encore des informations pour préparer ce mois.</p></section>;
  const groups = [...plan.certainOutflows.groups].sort((a, b) => groupOrder.indexOf(a.label) - groupOrder.indexOf(b.label));
  const calendar = projectMonthCalendar(plan.certainOutflows.items.map((item) => ({ ...item, ...references[item.key],
    dateEvidenceCount: item.dateCertainty === "HISTORICAL_ESTIMATE" ? dateEvidence[item.key]?.observationCount : undefined })), [...plannedExpenses, ...calendarCarryovers]);
  const narrative = plan.narrative, prediction = narrative.prediction;
  const importsMissing = prediction?.currentImportsMissing ?? false;
  const settings = parseMonthDecisionSettings(rawSettings);
  const decision = projectMonthDecision(plan, settings, targetMonth, today, plannedExpenses, memory);
  const comparable = comparableForecastCheckpoints(memory, targetMonth);
  const cash = plan.bankCash;
  const cashRange = (range: typeof cash.endOfMonth) => ({ lowConsumption: cash.calibrated ? range.low : null, central: range.central, highConsumption: cash.calibrated ? range.high : null });

  return <div data-month-story className="space-y-7 sm:space-y-9">

    <section className={`${material.glassPremium} ${material.glassHero} p-4 sm:p-6`} aria-labelledby="resources-title"><div className="flex flex-wrap items-end justify-between gap-3"><h2 id="resources-title" className="scroll-mt-24 text-2xl font-black">Nos ressources</h2><div className="text-left sm:text-right"><p className={`${material.data} text-3xl font-black tracking-tight`}><AnimatedMoney value={money(plan.economicResources, true)} /></p></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{plan.resources.map((resource) => <ResourceEditor key={resource.key} resource={resource} targetMonth={targetMonth} />)}</div>
      <p className="mt-4 text-sm text-slate-600">Ressources économiques du mois · Disponible réel aujourd’hui : <strong>{money(cash.currentRealBankBalance.amount, true)}</strong>. Les titres-restaurants ne sont pas un solde bancaire.</p>
    </section>

    <section aria-labelledby="outflows-title"><div className="flex flex-wrap items-end justify-between gap-2"><h2 id="outflows-title" className="scroll-mt-24 text-2xl font-black">Ce qui part quoi qu’il arrive</h2><p className={`${material.data} text-2xl font-black`}><AnimatedMoney value={money(plan.certainOutflows.total, true)} /></p></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{groups.map((group, groupIndex) => {
        const Icon = groupIcons[group.label as keyof typeof groupIcons] ?? Wallet;
        return <details key={group.label} className={`${material.glassSecondary} ${material.chargeRow} ${material.disclosure} group min-w-0`}><summary data-month-motion-item="charge" data-motion-order={groupIndex} className="flex min-h-17 cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden"><span className={material.roundBadge}><Icon size={20} aria-hidden="true" /></span><span className="min-w-0 flex-1 font-bold">{group.label}<span className="block text-xs font-normal text-slate-600">{`${group.items.length} ${group.items.length > 1 ? "éléments" : "élément"}`}</span></span><strong className={`${material.data} shrink-0 text-right text-lg`}><AnimatedMoney value={money(group.total, true)} /></strong><ChevronDown className="size-4 shrink-0 text-slate-500 transition-transform motion-reduce:transition-none group-open:rotate-180" aria-hidden="true" /></summary>
          <ul className="mx-4 border-t border-slate-200 pb-3 pt-2 text-sm">{group.items.map((item) => <li key={item.key} className="flex flex-wrap justify-between gap-x-3 py-1"><span className="min-w-0 break-words">{item.label}<span className="block text-xs text-slate-500">{item.state === "OBSERVED" ? "Déjà débité" : item.state === "OVERDUE_UNOBSERVED" ? "Échéance passée, débit non observé · montant réservé" : item.state === "PENDING_OBSERVATION" ? "En attente du débit · montant réservé" : "À venir"} · {item.dateCertainty === "DECLARED" ? "Date déclarée" : item.dateCertainty === "HISTORICAL_ESTIMATE" ? "Date habituelle estimée" : "Date à confirmer"}</span></span><strong className="shrink-0 tabular-nums">{money(item.amount, true)}</strong></li>)}</ul></details>;
      })}</div></section>

    <section className={`${material.glassPremium} ${material.glassQuiet} flex items-center justify-between gap-5 px-6 py-5`} aria-labelledby="after-title"><div><h2 id="after-title" className="text-xl font-bold">Après nos charges certaines</h2><p className="mt-1 text-xs text-slate-600">Ressources économiques après les charges certaines · distinctes du solde bancaire</p></div><p className={`${material.data} whitespace-nowrap text-3xl font-black`}><AnimatedMoney value={money(plan.afterCertainOutflows, true)} /></p></section>
    <MonthSavingsSection savings={plan.savingsAllocations} targetMonth={targetMonth} />
    <section className={`${material.glassPremium} ${material.glassQuiet} flex items-center justify-between gap-5 px-6 py-5`} aria-labelledby="after-savings-title"><div><h2 id="after-savings-title" className="text-xl font-bold">Après nos cagnottes</h2><p className="mt-1 text-xs text-slate-600">Ce qu’il reste pour vivre le mois après les charges et l’argent volontairement mis de côté.</p></div><p className={`${material.data} whitespace-nowrap text-3xl font-black`}><AnimatedMoney value={money(plan.afterSavingsAllocations, true)} /></p></section>
    <div className={material.projectList}><PlannedExpensesControl targetMonth={targetMonth} expenses={plannedExpenses} persons={persons} places={places} vehicle={vehicle} prices={prices} wallets={wallets} funding={plan.plannedFunding} observationCandidates={plan.observationCandidates} /></div>

    <section id="timeline-title" className="scroll-mt-24" aria-label="Calendrier du mois"><MonthCalendar key={targetMonth} targetMonth={targetMonth} today={today} entries={calendar.entries} undated={calendar.undated} dailyTotals={calendar.dailyTotals} /></section>

    <section aria-labelledby="necessary-title" className={`${material.glassSoft} ${material.dataSection} scroll-mt-24 p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-3"><h2 id="necessary-title" className="scroll-mt-24 text-2xl font-black">Ce qu’il nous faut pour le quotidien</h2><strong className={`${material.data} text-2xl`}>≈ <AnimatedMoney value={money(String(decision.visible.essentialTotal))} /></strong></div>
      <div className="mt-4 grid grid-cols-3 gap-3">{prediction ? prediction.essential.map(category => <RemainingForecastCard key={category.key} category={category} display={decision.visible.categoryDisplay[category.key]!} importsMissing={importsMissing} />) : plan.necessaryVariables.items.map(part => <StatisticalCard key={part.key} part={part} tone="necessary" />)}</div>
    </section>
    <ScenarioMilestone title="Après l’essentiel du mois" values={cash.afterEssential.central !== null ? cashRange(cash.afterEssential) : narrative.remainderAfterEssential}
      description={cash.afterEssential.central !== null ? "Projection bancaire après les paiements des projets et le financement bancaire du quotidien restant. Fourchette affichée seulement après calibration suffisante." : "Projection économique du mois. Le financement bancaire restant est encore partiellement inconnu ; ce repère ne représente pas un solde disponible."} />
    <section aria-labelledby="flexible-title" className={`${material.glassSoft} ${material.dataSection} scroll-mt-24 p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-3"><h2 id="flexible-title" className="scroll-mt-24 text-2xl font-black">Ce qui pourrait encore s’ajouter</h2><strong className={`${material.data} text-2xl`}>≈ <AnimatedMoney value={money(String(decision.visible.optionalTotal))} /></strong></div>
      <div className="mt-4 grid grid-cols-2 gap-3">{prediction ? prediction.optional.map(category => <RemainingForecastCard key={category.key} category={category} display={decision.visible.categoryDisplay[category.key]!} optional importsMissing={importsMissing} />) : plan.flexibleVariables.items.map(part => <StatisticalCard key={part.key} part={part} tone="flexible" />)}</div>
    </section>
    <ScenarioMilestone title="Projection de fin de mois" values={cash.endOfMonth.central !== null ? cashRange(cash.endOfMonth) : narrative.final} final description={cash.endOfMonth.central !== null ? "Projection bancaire depuis le solde actuel, les revenus non reçus et les paiements restants. Les bornes ne sont affichées que si calibrées." : `${decision.jointExplanation} Projection économique partielle, distincte d’un solde bancaire.`} />
    <details className={`${material.glassSecondary} ${material.disclosure} p-5`}><summary className="cursor-pointer text-sm font-bold">Disponible prévu et paiements restants</summary><dl className="mt-3 space-y-2 text-sm">{([
      ["Argent réservé aux cagnottes (budget)", cash.savingsBudgetReservation.amount], ["Disponible bancaire après cagnottes", cash.afterSavings.amount],
      ["Revenus bancaires non reçus", cash.futureKnownBankIncome.amount], ["Charges restant à débiter", cash.remainingCertainBankOutflows.amount],
      ["Achats ou réalisations déclarées, débit non observé", cash.pendingBankOutflows.amount], ["Paiements bancaires des projets", cash.plannedBankCashRemaining.amount],
      ["Disponible prévu après les projets", cash.plannedAvailable.amount], ["Quotidien restant financé par banque", cash.remainingEssentialBankCash.central],
      ["Possibilités restantes financées par banque", cash.remainingOptionalBankCash.central], ["Fin de mois bancaire", cash.endOfMonth.central],
    ] as const).map(([label, amount]) => <div className="flex justify-between gap-4" key={label}><dt>{label}</dt><dd className="font-semibold">{money(amount, true)}</dd></div>)}</dl>
      {cash.limitations.includes("BANK_BALANCE_SAVINGS_SCOPE_UNRESOLVED") && <p className="mt-3 text-xs text-slate-600">Le budget réservé aux cagnottes est connu. Le périmètre du solde bancaire observé ne précise pas si l’argent mis de côté est déjà exclu : le disponible bancaire après cagnottes reste à confirmer, sans retirer cet argent une deuxième fois.</p>}
      {cash.limitations.length > 0 && <p className="mt-3 text-xs text-slate-600">Projection partielle : un solde, une date de revenu ou un financement restent à confirmer. Les montants connus restent visibles.</p>}
      <ul className="mt-3 space-y-1 text-xs text-slate-600">{cash.incomeOccurrences.map(income => <li key={income.key}>{plan.resources.find(resource => resource.key === income.key)?.label ?? "Revenu"} : {money(income.amount, true)} · {income.state === "RECEIVED" ? "déjà reçu, inclus dans le solde" : income.state === "EXPECTED" ? "encore attendu" : income.state === "CANCELLED" ? "annulé" : "date ou réception à confirmer"}.</li>)}</ul>
      {prediction?.reconciliation.map(match => <p key={match.plannedExpenseId} className="mt-2 text-xs">Projet rapproché de l’observation : prévu {money(match.plannedEconomic, true)}, observé {money(match.observedEconomic, true)}, écart {money(match.variance, true)}{match.declared ? " · Réalisation déclarée conservée comme provenance" : ""}.</p>)}</details>
    {decision.mealFundingVisible && <details id="meal-funding" className={`${material.glassSecondary} ${material.disclosure} scroll-mt-24 p-5`}><summary className="cursor-pointer text-sm font-bold">Titres-restaurants affectés aux projets</summary><p className="mt-1 text-xs text-slate-600">Les affectations explicites aux projets sont comptées ici. Les futurs repas estimés ne réservent pas automatiquement de titres-restaurants.</p><div className="mt-3 grid grid-cols-2 gap-4">{([["Swile", plan.plannedFunding.swile], ["Edenred", plan.plannedFunding.edenred]] as const).map(([label, pocket]) => <dl className="space-y-1 text-sm" key={label}><dt className="font-bold">{label}</dt><dd>Ressource : {money(pocket.resource, true)}</dd><dd>Réservé aux projets : {money(pocket.reserved, true)}</dd><dd>Usage déclaré : {money(pocket.usedDeclared, true)}</dd><dd>Disponible après affectations : {money(pocket.availableAfter, true)}</dd>{Number(pocket.shortfall) > 0 && <dd className="text-amber-900">À financer autrement : {money(pocket.shortfall, true)}</dd>}</dl>)}</div></details>}
    {decision.attention.length > 0 && <section aria-labelledby="attention-title" className={`${material.alertPanel} ${material.sectionEnter} p-5`}><h2 id="attention-title" className="text-lg font-bold">À regarder ensemble</h2><ul className="mt-3 space-y-2 text-sm">{decision.attention.map(item => <li key={item.key}><a className="underline underline-offset-2" href={item.href}>{item.message}</a></li>)}</ul></section>}
    {decision.change.sampleCount > 0 && <details id="forecast-history" className={`${material.glassSecondary} ${material.disclosure} scroll-mt-24 p-5`}>
      <summary className="cursor-pointer font-bold">Comment notre projection évolue</summary>
      <p className="mt-3 text-sm">Depuis l’estimation du {comparable.at(-1)!.as_of_date} : <strong>{money(comparable.at(-1)!.payload.final.central)} → {money(narrative.final.central)}</strong></p>
      {decision.change.visibleChanges.length > 0 && <ul className="mt-3 space-y-1 text-sm">{decision.change.visibleChanges.map(item => <li key={item.key} className="flex justify-between gap-4"><span>{item.label}</span><strong>{item.visible > 0 ? "+" : ""}{money(String(item.visible))}</strong></li>)}</ul>}
      <details className="mt-3 text-xs text-slate-600"><summary className="cursor-pointer">Repères et méthode</summary><p className="mt-2">{decision.change.stability}</p>
        <p className="mt-2">{calibrated ? "Les erreurs des mois terminés suffisamment documentés ajustent les estimations." : "Les références historiques restent utilisées, sans calibration personnelle suffisante."}</p>
        <ul className="mt-2 space-y-1">{comparable.map(r => <li key={r.checkpoint_id}>{r.as_of_date} · {money(r.payload.final.central)}</li>)}</ul>
      </details>
    </details>}
    <MonthDecisionTools key={`${targetMonth}:${plan.narrative.final.central}:${JSON.stringify(settings)}`} targetMonth={targetMonth} settings={settings} decision={decision} />
  </div>;
}
