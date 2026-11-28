import type { MonthScenario } from "@/server/phase2/month-scenario";
import type { MonthForecastSnapshot } from "@/server/phase2/month-forecast-snapshot";
import type { StatisticalComponent } from "@/server/phase2/month-reference";
import type { ReactNode } from "react";
import { ResourceEditor } from "./resource-editor";
import { PlannedExpensesControl } from "./planned-expenses-control";
import type { PlannedExpenseCard } from "./planned-expenses-projection";
import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import type { PlannedVehicleEstimate } from "@/server/phase2/planned-context";
import { RemainingForecastCard } from "./month-narrative-cards";
import { parseMonthDecisionSettings, type MonthDecisionSettings } from "@/domain/phase2/month-decision-contract";
import { projectMonthDecision } from "@/server/phase2/month-decision-projection";
import type { ForecastCheckpoint } from "@/server/phase2/forecast-memory";
import { MonthSavingsSection } from "./month-savings-section";
import { BankStockCard } from "./bank-stock-card";
import { MonthControlLink } from "./month-control-center";
import { ForecastDashboard, ForecastFacts, ForecastLines, type ForecastModule, type ForecastRow } from "./forecast-dashboard";
import { plannedDayLabel } from "./composer/display";
import Link from "next/link";

const wholeEuros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const exactEuros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const money = (value: string | number | null, exact = false) => value === null ? "À confirmer" : (exact ? exactEuros : wholeEuros).format(Number(value));
const groupOrder = ["Maison", "Télécom", "Assurances", "Banque", "Abonnements", "Permis"];
export const statisticalLabels: Readonly<Record<string, string>> = {
  groceries: "Courses", "tobacco-vape": "Tabac & vape", "manon-work-mobility": "Trajets travail · Manon",
  "adrien-work-meals": "Repas travail · Adrien", "manon-work-meals": "Repas travail · Manon",
  "adrien-work-coffee": "Café travail · Adrien", "household-restaurants": "Restaurants du foyer",
};
const methodLabels: Record<string, string> = {
  MONTHLY_P25_MEDIAN_P75_12M: "Fourchette issue des 12 derniers mois (quartiles et médiane).",
  WORKDAY_SCENARIO_OBSERVED_UNIT_COST: "Estimation à partir du coût observé par repas et des jours travaillés.",
  CANONICAL_MOBILITY_WORKDAY_SCENARIO: "Trajets domicile–travail et détour déjeuner, avec cinq jours sur site par semaine.",
  DECLARED_ATTRIBUTION_ONSITE_DAYS_X_DAILY_DISTRIBUTION: "Estimation à partir des jours sur site et des dépenses quotidiennes observées.",
};
const noteLabels: Record<string, string> = {
  "manon-work-meals": "Le montant central est le milieu de la fourchette de scénarios.",
  "manon-work-mobility": "Le montant correspond à l’essence consommée par les trajets.",
  "adrien-work-coffee": "L’attribution à Adrien est déclarée.",
};
const approximate = (value: string | number | null) => value === null ? money(null) : "≈ " + money(value);

function statisticalRow(part: StatisticalComponent): ForecastRow {
  const hasBounds = part.low !== null && part.high !== null;
  return { id: part.key, label: statisticalLabels[part.key] ?? "Autre dépense",
    amount: part.central, value: approximate(part.central),
    note: hasBounds ? "Fourchette estimée · " + money(part.low) + " à " + money(part.high) : undefined,
    detail: <>
      {hasBounds && <ForecastFacts rows={[["Fourchette basse", money(part.low)], ["Repère central", money(part.central)], ["Fourchette haute", money(part.high)]]} />}
      <p>{methodLabels[part.method] ?? "Estimation issue des références publiées."} {part.observationCount} observations.</p>
      {part.note && noteLabels[part.key] && <p>{noteLabels[part.key]}</p>}
      {part.provenance.length > 0 && <p>{part.provenance.join(" · ")}</p>}
    </>,
  };
}

export function MonthStory({ scenario, reference, targetMonth, plannedExpenses, persons, places, vehicle, prices, wallets, today, settings: rawSettings, memory = [], applied, draft, readOnly = false, header }: {
  scenario: MonthScenario; reference: MonthForecastSnapshot["referencePlan"]; targetMonth: string;
  settings?: MonthDecisionSettings; memory?: readonly ForecastCheckpoint[]; applied?: ReactNode;
  draft?: { composerHref: string; rootCount: number };
  readOnly?: boolean; header?: ReactNode;
  plannedExpenses: readonly PlannedExpenseCard[]; persons: readonly { personId: string; displayName: string }[];
  places: readonly PlannedPlaceOption[]; vehicle: PlannedVehicleEstimate | null;
  prices: readonly import("@/domain/phase2/planned-contract").PlannedPriceSuggestion[]; today: string;
  wallets: readonly import("@/domain/phase2/planned-contract").PlannedWalletOption[];
}) {
  const plan = scenario.economicPlan;
  const { certainOutflows, resources, balance } = scenario.planningReference;
  const groups = [...certainOutflows.groups].sort((a, b) => groupOrder.indexOf(a.label) - groupOrder.indexOf(b.label));
  const narrative = plan?.narrative, prediction = readOnly ? null : narrative?.prediction;
  const decision = plan ? projectMonthDecision(plan, parseMonthDecisionSettings(rawSettings), targetMonth, today, plannedExpenses, memory) : null;
  const cash = plan?.bankCash;
  const cashRange = (range: { low: string | null; central: string | null; high: string | null }) =>
    ({ lowConsumption: cash?.calibrated ? range.low : null, central: range.central, highConsumption: cash?.calibrated ? range.high : null });
  const final = cash && narrative && decision ? cash.endOfMonth.central !== null ? cashRange(cash.endOfMonth) : narrative.final : null;
  const later = cash && narrative ? cash.afterEssential.central !== null ? cashRange(cash.afterEssential) : narrative.remainderAfterEssential : null;
  const categories = (optional: boolean): ForecastRow[] => prediction && decision
    ? (optional ? prediction.optional : prediction.essential).map(category => {
      const display = decision.visible.categoryDisplay[category.key]!;
      return { id: category.key, label: category.label, amount: display.remaining.central,
        value: approximate(display.remaining.central), note: "Reste estimé",
        detail: <RemainingForecastCard category={category} display={display}
          control={decision.categoryControls.find(candidate => candidate.key === category.key)}
          importsMissing={prediction.currentImportsMissing} /> };
    })
    : (optional ? reference?.flexible ?? [] : reference?.necessary ?? []).map(statisticalRow);

  const left: ForecastModule[] = [
    { id: "resources", anchor: applied ? undefined : "resources-title", title: "Nos ressources", icon: "overview",
      value: plan ? money(plan.economicResources, true) : undefined,
      note: !plan ? "Ressources du mois à compléter" : undefined,
      rows: [
        ...resources.map((resource): ForecastRow => ({ id: resource.key, label: resource.label, value: money(resource.amount, true),
          note: resource.pocket === "MEAL_BENEFIT" ? "Titres-restaurant" : undefined,
          detail: <ResourceEditor resource={resource} targetMonth={targetMonth} controls={false} readOnly={readOnly}
            walletObservation={resource.key === "benefit:swile" ? scenario.benefitWallets.SWILE.latestObservation : resource.key === "benefit:edenred" ? scenario.benefitWallets.EDENRED.latestObservation : null} /> })),
        { id: "bank", label: readOnly ? "Solde bancaire de départ" : "Disponible en banque", value: money(balance.status === "KNOWN" ? balance.amount : null, true),
          detail: <><BankStockCard balance={balance} readOnly={readOnly} /><p>Les titres-restaurants ne sont pas un solde bancaire. Ils figurent dans les ressources du mois.</p></> },
      ] },
    { id: "charges", anchor: "outflows-title", title: "Charges fixes du mois", icon: "expenses", value: money(certainOutflows.items.length ? certainOutflows.total : null, true),
      rows: [
        ...groups.map((group): ForecastRow => ({ id: group.label, label: group.label, amount: group.total, value: money(group.total, true),
          note: group.items.length > 1 ? group.items.length + " échéances" : undefined,
          detail: <ForecastLines rows={group.items.map(item => ({
            id: item.key, label: item.label, value: money(item.amount, true),
            note: (item.date ? plannedDayLabel(item.date) + " · " : "") + (item.state === "OBSERVED" ? "Déjà débité" : item.state === "OVERDUE_UNOBSERVED" ? "Échéance passée · montant réservé" : item.state === "PENDING_OBSERVATION" ? "Débit attendu · montant réservé" : "À venir")
              + " · " + (item.dateCertainty === "DECLARED" ? "Date déclarée" : item.dateCertainty === "HISTORICAL_ESTIMATE" ? "Date habituelle estimée" : "Date à confirmer"),
          }))} /> })),
      ] },
  ];

  const projects: ForecastModule | undefined = applied || !readOnly ? {
    id: "projects", anchor: "planned-expense-title", title: applied ? "Mon Plan appliqué" : "Projets et dépenses prévues", icon: "events",
    rows: [
      ...(draft ? [{ id: "draft", label: "Brouillon Composer", value: draft.rootCount + (draft.rootCount === 1 ? " carte enregistrée" : " cartes enregistrées"),
        detail: <><p>Appliquez le Plan depuis Composer pour intégrer les cartes à la projection.</p><Link href={draft.composerHref}>Reprendre le brouillon</Link></> }] : []),
      applied ? { id: "plan", label: "Décisions et dépenses du Plan", detail: applied } : {
        id: "planned", label: plannedExpenses.length ? "Cartes déjà prévues" : "Préparer une dépense",
        value: plannedExpenses.length ? String(plannedExpenses.length) : undefined,
        detail: <PlannedExpensesControl targetMonth={targetMonth} expenses={plannedExpenses} persons={persons} places={places} vehicle={vehicle} prices={prices} wallets={wallets} funding={plan?.plannedFunding} observationCandidates={plan?.observationCandidates} />,
      },
    ],
  } : undefined;

  left.push({ id: "projection", anchor: applied ? undefined : "final-projection", title: "Projection de fin de mois", icon: "overview", value: approximate(final?.central ?? null),
      note: final ? cash?.endOfMonth.central !== null ? "Solde bancaire estimé" : "Marge économique estimée" : "Ressources incomplètes",
      rows: [
        ...(plan ? [
          { id: "after-charges", label: "Après nos charges certaines", value: money(plan.afterCertainOutflows, true),
            detail: <p>Ressources économiques restantes après les charges certaines. Le solde bancaire figure dans Nos ressources.</p> },
          { id: "savings", label: "Après nos cagnottes", value: money(plan.afterSavingsAllocations, true),
            detail: <MonthSavingsSection savings={plan.savingsAllocations} targetMonth={targetMonth} controls={false} readOnly={readOnly} /> },
        ] : []),
        ...(later ? [{ id: "after-essentials", label: "Après l’essentiel du mois", value: approximate(later.central),
          detail: <ForecastFacts rows={scenarioFacts(later)} /> }] : []),
        { id: "scenarios", label: final ? "Scénarios de fin de mois" : "Projection à compléter",
          note: final && final.lowConsumption !== null && final.highConsumption !== null
            ? "Mois calme " + money(final.lowConsumption) + " · Mois plus coûteux " + money(final.highConsumption) : undefined,
          detail: final ? <><ForecastFacts rows={scenarioFacts(final)} />
            <p>{cash?.endOfMonth.central !== null ? "Projection bancaire fondée sur le solde actuel et les entrées et paiements restants." : decision?.jointExplanation}</p></>
            : readOnly ? <p>La projection reste incomplète avec les ressources conservées pour ce mois.</p>
              : <MonthControlLink section="update" className="font-bold underline">Compléter les ressources</MonthControlLink> },
      ] });

  const right: ForecastModule[] = [
    { id: "essentials", anchor: "necessary-title", title: "Dépenses du quotidien", icon: "groceries",
      value: approximate(prediction && decision ? decision.visible.essentialTotal : reference?.necessaryTotal.central ?? null),
      note: !prediction && reference ? "Repères pour le mois entier" : undefined,
      rows: categories(false) },
    { id: "extras", anchor: "flexible-title", title: "Dépenses variables et extras", icon: "categories",
      value: approximate(prediction && decision ? decision.visible.optionalTotal : reference?.flexibleTotal.central ?? null),
      rows: categories(true) },
    ...(projects ? [projects] : []),
  ];
  return <ForecastDashboard key={targetMonth} columns={[left, right]} header={header} plannedRow={projects ? (applied ? "plan" : "planned") : undefined} />;
}

function scenarioFacts(values: { lowConsumption: string | null; central: string | null; highConsumption: string | null }) {
  return [["Mois calme", approximate(values.lowConsumption)], ["Habituel", approximate(values.central)], ["Mois plus coûteux", approximate(values.highConsumption)]] as const;
}
