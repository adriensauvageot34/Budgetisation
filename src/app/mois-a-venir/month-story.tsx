import { ChevronDown, House, Landmark, ShieldCheck, Smartphone, Sparkles, Wallet, BookOpen } from "lucide-react";
import type { MonthScenario } from "@/server/phase2/month-scenario";
import type { MonthForecastSnapshot } from "@/server/phase2/month-forecast-snapshot";
import type { StatisticalComponent } from "@/server/phase2/month-reference";
import type { ReactNode } from "react";
import { ResourceEditor } from "./resource-editor";
import { PlannedExpensesControl } from "./planned-expenses-control";
import type { PlannedExpenseCard } from "./planned-expenses-projection";
import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import type { PlannedVehicleEstimate } from "@/server/phase2/planned-context";
import { RemainingForecastCard, ScenarioMilestone, ForecastInfo } from "./month-narrative-cards";
import { parseMonthDecisionSettings, type MonthDecisionSettings } from "@/domain/phase2/month-decision-contract";
import { projectMonthDecision } from "@/server/phase2/month-decision-projection";
import type { ForecastCheckpoint } from "@/server/phase2/forecast-memory";
import { AnimatedMoney } from "./animated-money";
import { MonthSavingsSection } from "./month-savings-section";
import { BankStockCard } from "./bank-stock-card";
import { MonthControlLink } from "./month-control-center";
import { ForecastGroup } from "./forecast-overview";
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
    <p className={`${material.data} mt-3 text-2xl font-black`}>{tone === "flexible" && <span className="mr-2 text-sm font-medium text-slate-500">Habituel</span>}<AnimatedMoney value={money(part.central)} /></p>
    {part.low !== null && part.high !== null && <p className="mt-2 text-sm text-slate-600">Fourchette estimée · {money(part.low)} à {money(part.high)}</p>}
  </article>;
}

export function MonthStory({ scenario, reference, targetMonth, plannedExpenses, persons, places, vehicle, prices, wallets, today, settings: rawSettings, memory = [], applied, draft, readOnly = false }: {
  scenario: MonthScenario; reference: MonthForecastSnapshot["referencePlan"]; targetMonth: string;
  settings?: MonthDecisionSettings; memory?: readonly ForecastCheckpoint[]; applied?: ReactNode;
  draft?: { composerHref: string; rootCount: number };
  readOnly?: boolean;
  plannedExpenses: readonly PlannedExpenseCard[]; persons: readonly { personId: string; displayName: string }[];
  places: readonly PlannedPlaceOption[]; vehicle: PlannedVehicleEstimate | null;
  prices: readonly import("@/domain/phase2/planned-contract").PlannedPriceSuggestion[]; today: string;
  wallets: readonly import("@/domain/phase2/planned-contract").PlannedWalletOption[] }) {
  const plan = scenario.economicPlan;
  const { certainOutflows, resources, balance } = scenario.planningReference;
  const groups = [...certainOutflows.groups].sort((a, b) => groupOrder.indexOf(a.label) - groupOrder.indexOf(b.label));
  const narrative = plan?.narrative, prediction = readOnly ? null : narrative?.prediction;
  const importsMissing = prediction?.currentImportsMissing ?? false;
  const settings = parseMonthDecisionSettings(rawSettings);
  const decision = plan ? projectMonthDecision(plan, settings, targetMonth, today, plannedExpenses, memory) : null;
  const cash = plan?.bankCash;
  const cashRange = (range: { low: string | null; central: string | null; high: string | null }) => ({ lowConsumption: cash?.calibrated ? range.low : null, central: range.central, highConsumption: cash?.calibrated ? range.high : null });
  const essentialTotal = prediction && decision ? String(decision.visible.essentialTotal) : reference?.necessaryTotal.central ?? null;
  const flexibleTotal = prediction && decision ? String(decision.visible.optionalTotal) : reference?.flexibleTotal.central ?? null;

  return <div data-month-story className="grid gap-1.5">

    <ForecastGroup label="Nos ressources" summary={plan ? money(plan.economicResources, true) : undefined}>
    <section className={`${material.glassPremium} ${material.glassHero} p-6`} aria-labelledby="resources-title"><h2 id="resources-title" className="scroll-mt-24 text-2xl font-black">Nos ressources</h2>
      <h3 className="mt-4 text-sm font-bold">{readOnly ? "Solde bancaire de départ" : "Disponible aujourd’hui"}</h3>
      <BankStockCard balance={balance} readOnly={readOnly} />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Ressources du mois</h3><p className={`${material.data} text-2xl font-black tracking-tight`}><AnimatedMoney value={plan ? money(plan.economicResources, true) : "À compléter"} /></p></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{resources.map((resource) => <ResourceEditor key={resource.key} resource={resource} targetMonth={targetMonth} controls={false} readOnly={readOnly} walletObservation={resource.key === "benefit:swile" ? scenario.benefitWallets.SWILE.latestObservation : resource.key === "benefit:edenred" ? scenario.benefitWallets.EDENRED.latestObservation : null} />)}</div>
      <p className="mt-4 text-sm text-slate-600">Le solde bancaire est un stock distinct des ressources économiques du mois. Les titres-restaurants ne sont pas un solde bancaire.</p>
    </section>
    </ForecastGroup>

    <ForecastGroup label="Charges fixes du mois" summary={money(certainOutflows.items.length ? certainOutflows.total : null, true)}>
    <section aria-labelledby="outflows-title"><div className="flex flex-wrap items-end justify-between gap-2"><h2 id="outflows-title" className="scroll-mt-24 text-2xl font-black">Charges fixes du mois</h2><p className={`${material.data} text-2xl font-black`}><AnimatedMoney value={money(certainOutflows.items.length ? certainOutflows.total : null, true)} /></p></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{groups.map((group, groupIndex) => {
        const Icon = groupIcons[group.label as keyof typeof groupIcons] ?? Wallet;
        return <details key={group.label} className={`${material.glassSecondary} ${material.chargeRow} ${material.disclosure} group min-w-0`}><summary data-month-motion-item="charge" data-motion-order={groupIndex} className="flex min-h-17 cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden"><span className={material.roundBadge}><Icon size={20} aria-hidden="true" /></span><span className="min-w-0 flex-1 font-bold">{group.label}<span className="block text-xs font-normal text-slate-600">{`${group.items.length} ${group.items.length > 1 ? "éléments" : "élément"}`}</span></span><strong className={`${material.data} shrink-0 text-right text-lg`}><AnimatedMoney value={money(group.total, true)} /></strong><ChevronDown className="size-4 shrink-0 text-slate-500 transition-transform motion-reduce:transition-none group-open:rotate-180" aria-hidden="true" /></summary>
          <ul className="mx-4 border-t border-slate-200 pb-3 pt-2 text-sm">{group.items.map((item) => <li key={item.key} className="flex flex-wrap justify-between gap-x-3 py-1"><span className="min-w-0 break-words">{item.label}<span className="block text-xs text-slate-500">{item.state === "OBSERVED" ? "Déjà débité" : item.state === "OVERDUE_UNOBSERVED" ? "Échéance passée, débit non observé · montant réservé" : item.state === "PENDING_OBSERVATION" ? "En attente du débit · montant réservé" : "À venir"} · {item.dateCertainty === "DECLARED" ? "Date déclarée" : item.dateCertainty === "HISTORICAL_ESTIMATE" ? "Date habituelle estimée" : "Date à confirmer"}</span></span><strong className="shrink-0 tabular-nums">{money(item.amount, true)}</strong></li>)}</ul></details>;
      })}</div></section>
    </ForecastGroup>

    {draft && <section className={`${material.glassSecondary} flex flex-wrap items-center justify-between gap-3 p-5`} aria-labelledby="composer-draft-title">
      <div><h2 id="composer-draft-title" className="text-lg font-black">Brouillon Composer</h2>
        <p className="mt-1 text-sm text-slate-600">{draft.rootCount} {draft.rootCount === 1 ? "carte enregistrée" : "cartes enregistrées"}. Appliquez le Plan depuis Composer pour intégrer vos choix à la projection.</p></div>
      <a href={draft.composerHref} className={`${material.clayButton} px-4 py-2 text-sm font-bold`}>Reprendre le brouillon</a>
    </section>}

    {applied && <ForecastGroup label="Mon Plan appliqué">{applied}</ForecastGroup>}
    {!applied && plan && <ForecastGroup label="Charges, réservations et marge" summary={money(plan.afterSavingsAllocations, true)}>
    <section className={`${material.glassPremium} ${material.glassQuiet} flex items-center justify-between gap-5 px-6 py-5`} aria-labelledby="after-title"><div><h2 id="after-title" className="text-xl font-bold">Après nos charges certaines</h2><p className="mt-1 text-xs text-slate-600">Ressources économiques après les charges certaines · distinctes du solde bancaire</p></div><p className={`${material.data} whitespace-nowrap text-3xl font-black`}><AnimatedMoney value={money(plan.afterCertainOutflows, true)} /></p></section>
    <MonthSavingsSection savings={plan.savingsAllocations} targetMonth={targetMonth} controls={false} readOnly={readOnly} />
    <section className={`${material.glassPremium} ${material.glassQuiet} flex items-center justify-between gap-5 px-6 py-5`} aria-labelledby="after-savings-title"><div><h2 id="after-savings-title" className="text-xl font-bold">Après nos cagnottes</h2><p className="mt-1 text-xs text-slate-600">Ce qu’il reste pour vivre le mois après les charges et l’argent volontairement mis de côté.</p></div><p className={`${material.data} whitespace-nowrap text-3xl font-black`}><AnimatedMoney value={money(plan.afterSavingsAllocations, true)} /></p></section>
    </ForecastGroup>}
    {!applied && !readOnly && <ForecastGroup label="Projets et dépenses prévues" summary={plannedExpenses.length ? `${plannedExpenses.length} au planning` : undefined}><div className={material.projectList}><PlannedExpensesControl targetMonth={targetMonth} expenses={plannedExpenses} persons={persons} places={places} vehicle={vehicle} prices={prices} wallets={wallets} funding={plan?.plannedFunding} observationCandidates={plan?.observationCandidates} /></div></ForecastGroup>}

    <ForecastGroup label="Dépenses du quotidien" summary={essentialTotal === null ? undefined : `≈ ${money(essentialTotal)}`}>
    <section aria-labelledby="necessary-title" className={`${material.glassSoft} ${material.dataSection} scroll-mt-24 p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="necessary-title" className="scroll-mt-24 text-2xl font-black">Dépenses du quotidien</h2><strong className={`${material.data} text-2xl`}>{essentialTotal !== null && "≈ "}<AnimatedMoney value={money(essentialTotal)} /></strong></div>
      {!prediction && reference && <p className="mt-1 text-sm text-slate-600">Repères habituels pour le mois entier</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{prediction && decision ? prediction.essential.map(category => <RemainingForecastCard key={category.key} category={category} display={decision.visible.categoryDisplay[category.key]!} control={decision.categoryControls.find(row => row.key === category.key)} targetMonth={targetMonth} importsMissing={importsMissing} />) : (reference?.necessary ?? []).map(part => <StatisticalCard key={part.key} part={part} tone="necessary" />)}</div>
    </section>
    {!applied && cash && narrative && <ScenarioMilestone title="Après l’essentiel du mois" values={cash.afterEssential.central !== null ? cashRange(cash.afterEssential) : narrative.remainderAfterEssential}
      description={cash.afterEssential.central !== null ? "Projection bancaire après les paiements des projets et le financement bancaire du quotidien restant. Fourchette affichée seulement après calibration suffisante." : "Projection économique du mois avec un financement bancaire encore partiellement connu."} />}
    </ForecastGroup>
    <ForecastGroup label="Dépenses variables et extras" summary={flexibleTotal === null ? undefined : `≈ ${money(flexibleTotal)}`}>
    <section aria-labelledby="flexible-title" className={`${material.glassSoft} ${material.dataSection} scroll-mt-24 p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="flexible-title" className="scroll-mt-24 text-2xl font-black">Dépenses variables et extras</h2><strong className={`${material.data} text-2xl`}>{flexibleTotal !== null && "≈ "}<AnimatedMoney value={money(flexibleTotal)} /></strong></div>
      {!prediction && reference && <p className="mt-1 text-sm text-slate-600">Repères habituels pour le mois entier</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{prediction && decision ? prediction.optional.map(category => <RemainingForecastCard key={category.key} category={category} display={decision.visible.categoryDisplay[category.key]!} control={decision.categoryControls.find(row => row.key === category.key)} targetMonth={targetMonth} optional importsMissing={importsMissing} />) : (reference?.flexible ?? []).map(part => <StatisticalCard key={part.key} part={part} tone="flexible" />)}</div>
    </section>
    </ForecastGroup>
    {!applied && <ForecastGroup label="Scénarios de fin de mois">{cash && narrative && decision ? <ScenarioMilestone title="Projection de fin de mois" values={cash.endOfMonth.central !== null ? cashRange(cash.endOfMonth) : narrative.final} final description={cash.endOfMonth.central !== null ? "Projection bancaire depuis le solde actuel, les revenus non reçus et les paiements restants. Les bornes ne sont affichées que si calibrées." : `${decision.jointExplanation} Projection économique partielle, distincte d’un solde bancaire.`} />
      : <section id="final-projection" className={`${material.glassPremium} scroll-mt-24 p-6`}>
        <h2 className="text-2xl font-black">Projection de fin de mois</h2>
        <p className="mt-2 text-sm text-slate-600">{readOnly ? "La projection reste incomplète avec les ressources conservées pour ce mois." : "Les ressources manquantes restent à renseigner pour établir le reste prévisionnel du mois."}</p>
        {!readOnly && <MonthControlLink section="update" className="mt-3 text-sm font-bold underline">Compléter les ressources</MonthControlLink>}
      </section>}</ForecastGroup>}

  </div>;
}
