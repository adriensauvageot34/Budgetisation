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
import { MonthControlCenter } from "./month-control-center";
import { AppliedMonthView } from "./applied-month-view";
import type { PlanProjectionV1 } from "@/domain/phase2/planner/projection-contract";
import type { OfficialPlanComparisonV1 } from "@/domain/phase2/planner/official-comparison-contract";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { ComposerMobilitySummary } from "@/domain/phase2/planner/composer-ui-contract";
import type { AppliedPlanControl } from "@/server/phase2/planner/applied-plan-read";
import { MonthDataStatus } from "./month-data-status";
import { contextLabel } from "./applied-plan-detail";
import type { MonthEntry } from "./month-entry";
import material from "./month-material.module.css";

const monthLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));

type Props = { forecast: MonthForecastSnapshot; scenario: MonthScenario; stored: StoredMonthInputs; entry?: MonthEntry;
  composerEnabled?: boolean; activePlan?: boolean; activeRevisionId?:string; planOwnership?: { categoryKeys: string[]; savingsIds: string[] };
  appliedProjection?: PlanProjectionV1; appliedSemanticState?: PlanSemanticStateV1; appliedControls?: readonly AppliedPlanControl[]; appliedMobility?: readonly ComposerMobilitySummary[]; activeRevisionNumber?: number;
  draftRootCount?: number; linkedPlanContextIds?: readonly string[];
  appliedEvidenceStatus?: "EXACT" | "CHANGED_AUTHORITIES" | "NOT_APPLICABLE"; historicalRemainder?: string | null; appliedComparison?: OfficialPlanComparisonV1;
  controlModel?: MonthControlCenterModel; initialSection?: MonthControlSection | null; initialFocus?: string | null;
  plannedExpenses: readonly PlannedExpenseCard[]; calendarCarryovers?: readonly PlannedExpenseCard[]; persons: readonly { personId: string; displayName: string }[];
  places: readonly PlannedPlaceOption[]; vehicle: PlannedVehicleEstimate | null;
    prices: readonly import("@/domain/phase2/planned-contract").PlannedPriceSuggestion[]; wallets: readonly import("@/domain/phase2/planned-contract").PlannedWalletOption[]; inputError: boolean; today: string };

export function MonthForecastView({ forecast, scenario, stored, entry, plannedExpenses, calendarCarryovers, persons, places, vehicle, prices, wallets, inputError, today, controlModel, initialSection, initialFocus, composerEnabled, activePlan, activeRevisionId, planOwnership, appliedProjection, appliedSemanticState, appliedControls, appliedMobility, activeRevisionNumber, appliedEvidenceStatus, historicalRemainder, appliedComparison, draftRootCount, linkedPlanContextIds = [] }: Props) {
  const targetMonth = forecast.meta.targetMonth;
  const model = controlModel ?? projectMonthControlCenter({ forecast, inputs: stored.inputs, expenses: plannedExpenses, asOf: today });
  const composerHref = composerEnabled ? `/mois-a-venir/composer?month=${targetMonth}` : undefined;
  const applied = appliedProjection && appliedSemanticState ? <AppliedMonthView embedded projection={appliedProjection} semanticState={appliedSemanticState} controls={appliedControls ?? []} mobility={appliedMobility} places={places} persons={persons} plan={scenario.economicPlan}
    comparison={appliedComparison} revision={activeRevisionNumber ?? 0} evidenceStatus={appliedEvidenceStatus} historicalRemainder={historicalRemainder} today={today} composerHref={composerHref}
    external={{ targetMonth, expectedPlanRevisionId: activeRevisionId, expenses: plannedExpenses, persons, places, vehicle, prices, wallets,
      funding: scenario.economicPlan?.plannedFunding, observationCandidates: scenario.economicPlan?.observationCandidates }} /> : undefined;
  const planMoments = appliedProjection ? (appliedSemanticState?.contexts ?? []).filter(context =>
    !context.parentContextOccurrenceId && !linkedPlanContextIds.includes(context.contextOccurrenceId)).map(context => ({
      id: context.contextOccurrenceId, label: contextLabel(context),
      date: typeof context.fields.plannedDate === "string" && context.fields.plannedDate.startsWith(`${targetMonth}-`) ? context.fields.plannedDate : null,
    })) : [];
  return <PlannedExpenseInteractions><MonthControlCenter key={targetMonth} model={model} initialSection={initialSection} initialFocus={initialFocus} inputError={inputError}
    composerHref={composerHref} planOwnership={planOwnership}>
    <main data-planned-page data-effective-owner={activePlan ? "PLAN_V1" : "DIRECT_V2"} className={`${material.page} mx-auto max-w-[1280px] space-y-7 pb-20`}>
    <nav aria-label="Mois préparé" className={`${material.monthHeader} flex items-center justify-between gap-6 text-sm font-bold`}><a className={`${material.monthLink} px-3 py-2 text-slate-600`} href={`/mois-a-venir?month=${new Date(Date.UTC(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7)}`}>‹ Mois précédent</a><h1 className="text-center text-4xl font-black uppercase tracking-tight">{monthLabel(targetMonth)}</h1><a className={`${material.monthLink} px-3 py-2 text-slate-600`} href={`/mois-a-venir?month=${new Date(Date.UTC(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5, 7)), 1)).toISOString().slice(0, 7)}`}>Mois suivant ›</a></nav>
    <MonthSectionNav hasProjects={plannedExpenses.length > 0} actionableCount={model.actionableCount} appliedPlan={activePlan} builderAvailable={!!scenario.economicPlan} composerHref={composerHref} />
    {entry && <MonthDataStatus entry={entry} />}
    {!activePlan && composerHref && draftRootCount === undefined && <p className={material.composerInvitation}>Préparez vos cartes dans <a href={composerHref}>Composer</a>, puis appliquez le Plan pour intégrer vos choix à la projection.</p>}
    <MonthStory scenario={scenario} reference={forecast.referencePlan} targetMonth={targetMonth} plannedExpenses={plannedExpenses} calendarCarryovers={calendarCarryovers} persons={persons} places={places} vehicle={vehicle} prices={prices} wallets={wallets} today={today}
      settings={scenario.inputs.decision} memory={forecast.forecastMemory}
      references={Object.fromEntries(forecast.components.map(part => [part.key, { freshnessDate: part.freshnessDate, confidence: part.confidence }]))}
      applied={applied} planMoments={planMoments} draft={composerHref && draftRootCount !== undefined ? { composerHref, rootCount: draftRootCount } : undefined} />
    </main>
  </MonthControlCenter></PlannedExpenseInteractions>;
}
