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
import { AppliedMonthView } from "./applied-month-view";
import type { PlanProjectionV1 } from "@/domain/phase2/planner/projection-contract";
import type { OfficialPlanComparisonV1 } from "@/domain/phase2/planner/official-comparison-contract";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { ComposerMobilitySummary } from "@/domain/phase2/planner/composer-ui-contract";
import type { AppliedPlanControl } from "@/server/phase2/planner/applied-plan-read";
import { MonthDataStatus } from "./month-data-status";
import { MonthNavigation } from "./month-navigation";
import { isImportedRealizedMonth } from "@/domain/phase2/planner/realized-month-entry";
import { composerCalendarHref, type MonthEntry } from "./month-entry";
import { ForecastOverview } from "./forecast-overview";
import styles from "./forecast-dashboard.module.css";
import material from "./month-material.module.css";

type Props = { forecast: MonthForecastSnapshot; scenario: MonthScenario; stored: StoredMonthInputs; entry?: MonthEntry;
  composerEnabled?: boolean; activePlan?: boolean; activeRevisionId?:string; planOwnership?: { categoryKeys: string[]; savingsIds: string[] };
  appliedProjection?: PlanProjectionV1; appliedSemanticState?: PlanSemanticStateV1; appliedControls?: readonly AppliedPlanControl[]; appliedMobility?: readonly ComposerMobilitySummary[]; activeRevisionNumber?: number;
  draftRootCount?: number;
  appliedEvidenceStatus?: "EXACT" | "CHANGED_AUTHORITIES" | "NOT_APPLICABLE"; historicalRemainder?: string | null; appliedComparison?: OfficialPlanComparisonV1;
  controlModel?: MonthControlCenterModel; initialSection?: MonthControlSection | null; initialFocus?: string | null;
  plannedExpenses: readonly PlannedExpenseCard[]; persons: readonly { personId: string; displayName: string }[];
  places: readonly PlannedPlaceOption[]; vehicle: PlannedVehicleEstimate | null;
    prices: readonly import("@/domain/phase2/planned-contract").PlannedPriceSuggestion[]; wallets: readonly import("@/domain/phase2/planned-contract").PlannedWalletOption[]; inputError: boolean; today: string };

export function MonthForecastView({ forecast, scenario, stored, entry, plannedExpenses, persons, places, vehicle, prices, wallets, inputError, today, controlModel, initialSection, initialFocus, composerEnabled, activePlan, activeRevisionId, planOwnership, appliedProjection, appliedSemanticState, appliedControls, appliedMobility, activeRevisionNumber, appliedEvidenceStatus, historicalRemainder, appliedComparison, draftRootCount }: Props) {
  const targetMonth = forecast.meta.targetMonth;
  const model = controlModel ?? projectMonthControlCenter({ forecast, inputs: stored.inputs, expenses: plannedExpenses, asOf: today });
  const composerHref = composerEnabled ? `/mois-a-venir/composer?month=${targetMonth}${isImportedRealizedMonth(targetMonth) ? "&view=edition" : ""}` : undefined;
  const plan = scenario.economicPlan;
  const bankEnd = plan?.bankCash.endOfMonth.central ?? null;
  const deadline = scenario.planningReference.certainOutflows.items
    .filter(item => item.state !== "OBSERVED" && item.date !== null && item.date >= today)
    .toSorted((a, b) => a.date!.localeCompare(b.date!))[0];
  const applied = appliedProjection && appliedSemanticState ? <AppliedMonthView embedded projection={appliedProjection} semanticState={appliedSemanticState} controls={appliedControls ?? []} mobility={appliedMobility} places={places} persons={persons} plan={scenario.economicPlan}
    comparison={appliedComparison} revision={activeRevisionNumber ?? 0} evidenceStatus={appliedEvidenceStatus} historicalRemainder={historicalRemainder} today={today} composerHref={composerHref}
    external={{ targetMonth, expectedPlanRevisionId: activeRevisionId, expenses: plannedExpenses, persons, places, vehicle, prices, wallets,
      funding: scenario.economicPlan?.plannedFunding, observationCandidates: scenario.economicPlan?.observationCandidates }} /> : undefined;
  return <PlannedExpenseInteractions><MonthControlCenter key={targetMonth} model={model} initialSection={initialSection} initialFocus={initialFocus} inputError={inputError}
    composerHref={composerHref} planOwnership={planOwnership}>
    <div data-planned-page data-effective-owner={activePlan ? "PLAN_V1" : "DIRECT_V2"} className={`${material.page} ${styles.workspace}`}>
      <MonthNavigation targetMonth={targetMonth} />
      <MonthStory scenario={scenario} reference={forecast.referencePlan} targetMonth={targetMonth} plannedExpenses={plannedExpenses} persons={persons} places={places} vehicle={vehicle} prices={prices} wallets={wallets} today={today}
        settings={scenario.inputs.decision} memory={forecast.forecastMemory}
        applied={applied} draft={composerHref && draftRootCount !== undefined ? { composerHref, rootCount: draftRootCount } : undefined}
        header={<>
      <ForecastOverview amount={bankEnd ?? plan?.narrative.final.central ?? null}
        heading={bankEnd !== null ? "Solde bancaire prévu en fin de mois" : undefined}
        basis={bankEnd !== null ? "Projection du solde bancaire" : plan ? "Projection économique · situation bancaire à confirmer" : "Ressources à compléter"}
        deadline={deadline ? { ...deadline, date: deadline.date!, estimated: deadline.dateCertainty === "HISTORICAL_ESTIMATE" } : undefined}
        calendarHref={composerCalendarHref(targetMonth)}
        decisions={model.actionableCount ? `${model.actionableCount} choix à examiner` : "Aucun arbitrage signalé"}
        decisionAction={model.actionableCount > 0 ? <MonthControlLink section="choices" /> : undefined} />
      <div className={styles.controls}>
        {entry && <MonthDataStatus entry={entry} compact />}
        <MonthSectionNav compact hasProjects={plannedExpenses.length > 0} actionableCount={model.actionableCount} appliedPlan={activePlan} builderAvailable={!!scenario.economicPlan} composerHref={composerHref} />
      </div>
      </>} />
    </div>
  </MonthControlCenter></PlannedExpenseInteractions>;
}
