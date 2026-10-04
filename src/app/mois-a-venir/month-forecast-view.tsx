import type { MonthForecastSnapshot } from "@/server/phase2/month-forecast-snapshot";
import type { StoredMonthInputs } from "@/server/phase2/month-inputs";
import type { MonthScenario } from "@/server/phase2/month-scenario";
import { projectMonthControlCenter, type MonthControlCenterModel } from "@/server/phase2/month-control-center";
import type { MonthControlSection } from "@/domain/phase2/month-control-contract";
import { MonthStory } from "./month-story";
import type { PlannedExpenseCard } from "./planned-expenses-projection";
import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import type { PlannedVehicleEstimate } from "@/server/phase2/planned-context";
import { PlannedExpenseInteractions } from "./planned-expense-interactions";
import { MonthSectionNav } from "./month-section-nav";
import { MonthControlCenter, MonthControlLink } from "./month-control-center";
import { MonthResourcesPanel, MonthSettingsPanel, MonthReliabilityPanel } from "./month-control-panels";
import material from "./month-material.module.css";

const money = (value: string | null) => value === null ? "À confirmer" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
const monthLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));

type Props = { forecast: MonthForecastSnapshot; scenario: MonthScenario; stored: StoredMonthInputs;
  controlModel?: MonthControlCenterModel; initialSection?: MonthControlSection | null; initialFocus?: string | null;
  plannedExpenses: readonly PlannedExpenseCard[]; calendarCarryovers?: readonly PlannedExpenseCard[]; persons: readonly { personId: string; displayName: string }[];
  places: readonly PlannedPlaceOption[]; vehicle: PlannedVehicleEstimate | null;
    prices: readonly import("@/domain/phase2/planned-contract").PlannedPriceSuggestion[]; wallets: readonly import("@/domain/phase2/planned-contract").PlannedWalletOption[]; inputError: boolean; today: string };

export function MonthForecastView({ forecast, scenario, stored, plannedExpenses, calendarCarryovers, persons, places, vehicle, prices, wallets, inputError, today, controlModel, initialSection, initialFocus }: Props) {
  const targetMonth = forecast.meta.targetMonth;
  const model = controlModel ?? projectMonthControlCenter({ forecast, inputs: stored.inputs, expenses: plannedExpenses, asOf: today });
  return <PlannedExpenseInteractions><MonthControlCenter key={targetMonth} model={model} initialSection={initialSection} initialFocus={initialFocus} inputError={inputError}
    resources={<MonthResourcesPanel forecast={forecast} scenario={scenario} model={model} today={today} />}
    settings={<MonthSettingsPanel forecast={forecast} scenario={scenario} model={model} />}
    reliability={<MonthReliabilityPanel model={model} />}>
    <main data-planned-page className={`${material.page} mx-auto max-w-[1280px] space-y-7 pb-20`}>
    <nav aria-label="Mois préparé" className={`${material.monthHeader} flex items-center justify-between gap-6 text-sm font-bold`}><a className={`${material.monthLink} px-3 py-2 text-slate-600`} href={`/mois-a-venir?month=${new Date(Date.UTC(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7)}`}>‹ Mois précédent</a><h1 className="text-center text-4xl font-black uppercase tracking-tight">{monthLabel(targetMonth)}</h1><a className={`${material.monthLink} px-3 py-2 text-slate-600`} href={`/mois-a-venir?month=${new Date(Date.UTC(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5, 7)), 1)).toISOString().slice(0, 7)}`}>Mois suivant ›</a></nav>
    <MonthSectionNav hasProjects={plannedExpenses.length > 0} actionableCount={model.actionableCount} />
    {!scenario.economicPlan && <section className={`${material.glassSecondary} p-5`} role="status"><h2 className="font-bold">Compléter les ressources du mois</h2>
      <p className="mt-2 text-sm">Il manque des informations pour préparer ce mois. Le solde bancaire daté reste indépendant des ressources à compléter.</p>
      <p className="mt-2 text-xl font-black">Disponible réel Banque : {money(scenario.availableNow.value)}</p>
      <MonthControlLink section="resources" focus="income" className="mt-3 text-sm font-bold underline">Renseigner les ressources</MonthControlLink></section>}
    <MonthStory plan={scenario.economicPlan} targetMonth={targetMonth} plannedExpenses={plannedExpenses} calendarCarryovers={calendarCarryovers} persons={persons} places={places} vehicle={vehicle} prices={prices} wallets={wallets} today={today} dateEvidence={forecast.referencePlan?.estimatedDays ?? {}}
      settings={stored.inputs.decision} memory={forecast.forecastMemory}
      references={Object.fromEntries(forecast.components.map(part => [part.key, { freshnessDate: part.freshnessDate, confidence: part.confidence }]))} />
    </main>
  </MonthControlCenter></PlannedExpenseInteractions>;
}
