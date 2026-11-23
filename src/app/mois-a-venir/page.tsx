import { mobilitySummaries } from "@/server/phase2/planner/mobility-presentation";
import { notFound, redirect } from "next/navigation";
import { withProductAuthentication } from "@/app/product-query";
import { addDays, parseLocalDate } from "@/core/time";
import { MonthForecastView } from "./month-forecast-view";
import { ArchivedMonthForecast } from "./archived-month-forecast";
import { appliedPlanRevisionControls } from "@/server/phase2/planner/applied-plan-read";
import { projectMonthControlCenter } from "@/server/phase2/month-control-center";
import { monthControlSection, monthControlDestination, type MonthControlSectionInput } from "@/domain/phase2/month-control-contract";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { isArchivedRealizedMonth, JULY_COMPOSER_HREF, JULY_COMPOSER_MONTH, realizedComposerHref } from "@/domain/phase2/planner/realized-month-entry";
import { monthEntry, showsArchivedForecast } from "./month-entry";
import { readPlanningMonthForecast } from "@/server/phase2/month-planning-read";
import { readMonthInputs } from "@/server/phase2/month-inputs";
import { deriveMonthScenario } from "@/server/phase2/month-scenario";
import { readPlannedExpenses, readPlannedCalendarCarryovers } from "@/server/phase2/planned-expenses";
import { readPlannedContextOptions } from "@/server/phase2/planned-context";
import { groceryBasketEstimate } from "@/domain/phase2/planned-price-estimates";
import { projectPlannedExpenseCards, projectExpenseFunding } from "./planned-expenses-projection";
import { projectPlannedExpenseImpact } from "@/server/phase2/planned-impact";
import { prospectivePersonIdentity, prospectivePersonLabel } from "@/domain/phase2/planned-product";
import { planningDate } from "@/server/phase2/planning-date";
import { readMonthPredictionEvidence } from "@/server/phase2/month-prediction-evidence";
import { readForecastMemory } from "@/server/phase2/forecast-memory";
import { projectPastMonthReview } from "@/server/phase2/past-month-review";
import { PastMonthView } from "./past-month-view";
import { restaurantSoloPerson } from "@/domain/phase2/planned-restaurant";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { resolveEffectiveMonthScenario } from "@/server/phase2/planner/effective-month-scenario";
import { effectiveChoiceContext, type EffectiveMonthSimulation } from "@/server/phase2/planner/effective-simulation";
import { plannerComposerEnabled, legacyPlanOwnership } from "@/server/phase2/planner/cutover";
import { composerDraftAutosaveEnabledFor } from "@/server/phase2/planner/composer-draft-cutover";
import { readActiveComposerDraft } from "@/server/phase2/planner/composer-draft-service";

export const metadata = { title: "Notre mois à venir" };
export const dynamic = "force-dynamic";

export default async function MonthForecastPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await withProductAuthentication(() => getBootstrapContext());
  if (context.household === null) notFound();
  const params = await searchParams;
  const today = planningDate(context.household.timezone);
  const entry = monthEntry(today, params.month, context.periods);
  const { currentMonth, targetMonth } = entry;
  if (targetMonth === JULY_COMPOSER_MONTH && targetMonth < currentMonth) {
    redirect(JULY_COMPOSER_HREF);
  }
  if (isArchivedRealizedMonth(targetMonth)) redirect(realizedComposerHref(targetMonth));
  const client = createCanonicalReadClient();
  const householdId = context.household.householdId;
  const archivedForecast = showsArchivedForecast(targetMonth, currentMonth, params.vue);
  async function readPastReview(referenceAvailable = true) {
    const [evidence, memory] = await Promise.all([
      readMonthPredictionEvidence(client, householdId, targetMonth, true),
      readForecastMemory(client, householdId, targetMonth),
    ]);
    return <PastMonthView targetMonth={targetMonth} entry={entry} review={projectPastMonthReview(targetMonth, evidence, memory)} referenceAvailable={referenceAvailable} />;
  }
  if (targetMonth < currentMonth && !archivedForecast) return readPastReview();

  let forecast:Awaited<ReturnType<typeof readPlanningMonthForecast>>;
  const cutoff = archivedForecast ? addDays(parseLocalDate(`${targetMonth}-01`), -1) : null;
  const openingEvidence = cutoff ? readMonthPredictionEvidence(client, householdId, targetMonth, true,
    { asOfDate: cutoff, timezone: context.household.timezone }) : undefined;
  try {
    if (openingEvidence) {
      [forecast] = await Promise.all([readPlanningMonthForecast(client, householdId, targetMonth, openingEvidence), openingEvidence]);
    } else {
      forecast = await readPlanningMonthForecast(client, householdId, targetMonth);
    }
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "FORECAST_TARGET_MONTH_NOT_FUTURE") throw error;
    if (archivedForecast) return readPastReview(false);
    return <section className="card mx-auto max-w-3xl p-8"><h1 className="text-2xl font-black">Ce mois ne fait pas partie des prévisions</h1><p className="mt-3">Choisissez un mois après la période historique de référence.</p><a className="mt-4 inline-block font-bold underline" href="/mois-a-venir">Revenir au mois à venir</a></section>;
  }
  const { supabase } = await getAuthenticatedBootstrapClient();
  if (cutoff) {
    const { inputs } = await readMonthInputs(supabase, householdId, targetMonth);
    const openingBalance = inputs.openingBalance && inputs.openingBalance.asOfDate <= cutoff ? inputs.openingBalance : null;
    const scenario = deriveMonthScenario({ ...forecast, forecastMemory: [] }, { ...inputs, openingBalance }, null, cutoff);
    return <ArchivedMonthForecast entry={entry} forecast={forecast} scenario={scenario} cutoff={cutoff} />;
  }
  const [storedRead, expensesRead, personsResult, calendarCarryovers] = await Promise.all([
    readMonthInputs(supabase, context.household.householdId, targetMonth),
    readPlannedExpenses(supabase, context.household.householdId, targetMonth),
    supabase.from("persons").select("person_id,display_name,status").eq("household_id", context.household.householdId).order("display_name"),
    readPlannedCalendarCarryovers(supabase, context.household.householdId, targetMonth),
  ]);
  if (personsResult.error) throw personsResult.error;
  const activePersons = (personsResult.data ?? []).filter((person) => person.status === "active")
    .map((person) => ({ personId: person.person_id, displayName: person.display_name }));
  const currentPersonId = restaurantSoloPerson(activePersons, {
    personId: typeof context.user.app_metadata?.person_id === "string" ? context.user.app_metadata.person_id : undefined,
    displayName: typeof context.user.user_metadata?.display_name === "string" ? context.user.user_metadata.display_name : undefined,
  });
  const persons = activePersons.map((person) => ({ ...person, isCurrentUser: person.personId === currentPersonId }));
  const options = await readPlannedContextOptions(client, context.household.householdId, persons);
  const planner = await authorizedPlanner();
  const composerEnabled = plannerComposerEnabled();
  let simulation:EffectiveMonthSimulation|undefined;
  const [effective, draft] = await Promise.all([
    resolveEffectiveMonthScenario({ ...planner.deps,
      captureSimulation: value => { simulation = value; },
      readDirectWorld: async () => ({ forecast, monthInputs: storedRead.inputs, externalIntents: expensesRead, asOfDate: today }) }, planner.householdId, targetMonth),
    composerEnabled && composerDraftAutosaveEnabledFor(planner.userId)
      ? readActiveComposerDraft(planner, targetMonth).catch(error => {
        console.warn("MONTH_COMPOSER_DRAFT_READ_UNAVAILABLE", error instanceof Error ? error.name : "unknown");
        return null;
      })
      : null,
  ]);
  if(simulation)forecast=simulation.forecast;
  const stored=simulation?{...storedRead,inputs:simulation.inputs}:storedRead;
  const plannedExpenses=simulation?.expenses??expensesRead;
  const scenario = effective.scenario;
  const ownership = await legacyPlanOwnership(planner.deps.repository, planner.householdId, targetMonth);
  const placeLabel = (ref: import("@/domain/phase2/planned-contract").ProspectivePlaceRef | undefined) =>
    ref?.kind === "TEXT" ? ref.label : ref?.kind === "KNOWN" ? options.places.find((place) => place.placeId === ref.placeId)?.name : undefined;
  const cards = projectPlannedExpenseCards(plannedExpenses, today, scenario.observationMatches).map((card) => {
    if (!scenario.economicPlan || effective.owner === "PLAN_V1") return card;
    const before = deriveMonthScenario(forecast, stored.inputs, null, today,
      plannedExpenses.filter((row) => row.id !== card.id)).economicPlan;
    if (!before) return card;
    const impact = projectPlannedExpenseImpact(before, scenario.economicPlan, card);
    if(impact.netAdditionalImpact.central===null||impact.absorbedByBaseline.central===null)return card;
    const participantRefs = [
      ...(card.context.participantPersonIds ?? []).map((personId) => ({ kind: "HOUSEHOLD_PERSON" as const, personId })),
      ...(card.context.participantRefs ?? []),
      ...(card.context.hostParticipates && card.context.host ? [card.context.host] : []),
      ...(card.context.visitedPersonParticipates && card.context.personVisited ? [card.context.personVisited] : []),
    ];
    const participantLabels = [...new Map(participantRefs.map((ref) => [prospectivePersonIdentity(ref),
      ref.kind === "HOUSEHOLD_PERSON" ? persons.find((person) => person.personId === ref.personId)?.displayName : prospectivePersonLabel(ref)])).values()]
      .filter((label): label is string => !!label);
    if (card.context.additionalGuestCount) participantLabels.push(`${card.context.additionalGuestCount} autre${card.context.additionalGuestCount > 1 ? "s" : ""} invité${card.context.additionalGuestCount > 1 ? "s" : ""}`);
    return { ...card, detail: { additionalImpact: impact.netAdditionalImpact.central,
      includedBaseline: impact.absorbedByBaseline.central, fuelUsage: impact.fuelUsage,
      funding: projectExpenseFunding(card), placeLabel: placeLabel(card.context.place), participantLabels,
      childPlaceLabels: Object.values(card.context.childLocalPlaceRefs ?? {}).map(placeLabel).filter((label): label is string => !!label) } };
  });
  const control = monthControlSection(params.control) === null ? null : monthControlDestination(params.control as MonthControlSectionInput, typeof params.focus === "string" ? params.focus : null);
  const appliedControls = effective.revision ? appliedPlanRevisionControls(effective.revision) : undefined;
  const historicalEvidence = effective.revision?.projectionEvidence.projection;
  const historicalPlan = historicalEvidence && typeof historicalEvidence === "object" && !Array.isArray(historicalEvidence)
    ? (historicalEvidence as Record<string, unknown>).plan : null;
  const historicalRemainder = historicalPlan && typeof historicalPlan === "object" && !Array.isArray(historicalPlan)
    && typeof (historicalPlan as Record<string, unknown>).economicMonthEndRemainder === "string"
    ? (historicalPlan as Record<string, string>).economicMonthEndRemainder : null;
  return <MonthForecastView forecast={forecast} scenario={scenario} stored={stored} entry={entry}
    controlModel={projectMonthControlCenter(simulation ? effectiveChoiceContext(simulation) : { forecast, inputs: stored.inputs, expenses: plannedExpenses, asOf: today }, effective.owner === "PLAN_V1" ? scenario : undefined, effective.projection ?? undefined)}
    appliedProjection={effective.projection ?? undefined} appliedComparison={effective.comparison ?? undefined} appliedSemanticState={effective.semanticState ?? undefined} appliedControls={appliedControls} appliedMobility={effective.preview ? mobilitySummaries(effective.preview.compiled.journeys, effective.preview.compiled.journeyPrices) : undefined} activeRevisionNumber={effective.revision?.revisionNumber}
    appliedEvidenceStatus={effective.evidenceStatus} historicalRemainder={historicalRemainder}
    composerEnabled={composerEnabled} planOwnership={ownership} activePlan={effective.owner === "PLAN_V1"} activeRevisionId={effective.revision?.planRevisionId}
    draftRootCount={draft?.semanticState.contexts.filter(context => !context.parentContextOccurrenceId).length}
    linkedPlanContextIds={effective.preview?.compiled.contexts.filter(context => context.externalIntentId).map(context => context.contextOccurrenceId)}
    initialSection={control?.section ?? null} initialFocus={control?.focus ?? null}
    plannedExpenses={cards} calendarCarryovers={projectPlannedExpenseCards(calendarCarryovers, today)} today={today}
    persons={persons} places={options.places} vehicle={options.vehicle} prices={[...options.prices, ...(() => { const estimate = groceryBasketEstimate(forecast.predictionEvidence?.history.economicEntries ?? []); return estimate ? [estimate] : []; })()]} wallets={options.wallets}
    inputError={params.inputError === "1"} />;
}
