import "server-only";
import { Temporal } from "@js-temporal/polyfill";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { readPlanningMonthForecast } from "../month-planning-read";
import { readMonthPredictionEvidence } from "../month-prediction-evidence";
import { planningDate } from "../planning-date";
import { readMonthInputs } from "../month-inputs";
import { readPlannedExpenses } from "../planned-expenses";
import { buildRenewalPlanningBaseline } from "./renewal-baseline";
import { readPlanningBaselineSources } from "./baseline-adapters";
import { createPlanApplyRepository } from "./repository";
import type { EffectiveMonthDependencies } from "./effective-month-scenario";
import { buildProspectiveMobilityFacts } from "./mobility-adapter";
import { preparePlanningMobility } from "./prospective-mobility-pricing";
import { readPlannedContextOptions } from "../planned-context";
import { expandComposableContexts } from "./context-compiler";
import { materializePlanSlots } from "./plan-slot-resolver";
import { resolveJourneyRequirements } from "./journey-resolver";
import type { ActivityHistoryStore } from "./activity-history-artifact";

/** Canonical may use its trusted read client; Plan writes always use the authenticated
 * household client supplied separately by the authorized server entry point. */
export function createPlannerDependencies(canonical: CanonicalRepository, authenticatedClient: SupabaseClient,
  clock: () => string = () => new Date().toISOString(), activityHistory?: ActivityHistoryStore): EffectiveMonthDependencies {
  const scope = (householdId: string) => {
    if (householdId !== String(canonical.context.householdId)) throw new TypeError("PLANNER_AUTHORIZED_HOUSEHOLD_MISMATCH");
  };
  // One owner read within this server request, shared by validation, pricing and editor options. No persistent cache.
  let optionsPromise: ReturnType<typeof readPlannedContextOptions> | undefined;
  const mobilityOptions = (householdId: string) => { scope(householdId); return optionsPromise ??=
    readPlannedContextOptions(canonical.client, householdId, canonical.context.persons); };
  const loadWorldWithStore = async (householdId: string, targetMonth: string, history?: ActivityHistoryStore) => {
    scope(householdId);
    const cutoff = Temporal.Instant.from(clock()), asOfDate = cutoff.toZonedDateTimeISO(canonical.context.timezone).toPlainDate().toString();
    // Forecast requires history; Baseline permits empty history. When the two readers
    // use the same household day, a successful strict read satisfies both contracts.
    // A clock crossing the calendar boundary keeps the original independent reads.
    const predictionEvidence = asOfDate === planningDate(canonical.context.timezone)
      ? readMonthPredictionEvidence(canonical.client, householdId, targetMonth, false,
        { asOfDate, timezone: canonical.context.timezone }) : undefined;
    predictionEvidence?.catch(() => undefined);
    const forecastPromise = readPlanningMonthForecast(canonical.client, householdId, targetMonth, predictionEvidence);
    const sourcesPromise = readPlanningBaselineSources(canonical, targetMonth, cutoff.toString(),
      { simpleOccurrences: true, renewals: true, forecast: forecastPromise, ...(history ? { activityHistory: history } : {}),
        ...(predictionEvidence ? { predictionEvidence } : {}) });
    // Observe early source rejection while retaining the original Forecast-first
    // failure boundary. Await the original Promise below; no error is replaced.
    sourcesPromise.catch(() => undefined);
    const forecast = await forecastPromise;
    const sources = await sourcesPromise;
    // One admitted canonical evidence read for both C1 and financial calculation.
    return { baseline: buildRenewalPlanningBaseline(sources), forecast: { ...forecast, predictionEvidence: sources.evidence },
      monthInputs: sources.monthInputs, externalIntents: sources.plannedExpenses, asOfDate, costQuotes: {},
      mobilityFacts: buildProspectiveMobilityFacts(sources),
      modelVersions: { financialOwner: "deriveMonthScenario@v2", forecast: forecast.resourceMeta.contractVersion } };
  };
  return { repository: createPlanApplyRepository(authenticatedClient), householdPersons: (canonical.context.persons ?? []).map(person =>
    ({ personId: String(person.personId), displayName: person.displayName })), readMobilityOptions: mobilityOptions,
    readWorld: (householdId, targetMonth) => loadWorldWithStore(householdId, targetMonth),
    ...(activityHistory ? { readComposerWorld: (householdId: string, targetMonth: string) =>
      loadWorldWithStore(householdId, targetMonth, activityHistory) } : {}),
    async validateContextReferences(householdId, refs) {
      scope(householdId);
      const persons = new Set(canonical.context.persons.map(person => String(person.personId)));
      if (refs.personIds.some(id => !persons.has(id))) throw new TypeError("CONTEXT_PERSON_NOT_IN_HOUSEHOLD");
      if (refs.placeIds.length) {
        const options = await mobilityOptions(householdId), places = new Set(options.places.map(place => place.placeId));
        if (refs.placeIds.some(id => !places.has(id))) throw new TypeError("CONTEXT_PLACE_NOT_ADMITTED");
      }
    }, async prepareWorld(world, state) {
    scope(world.baseline.householdId);
    const intents = expandComposableContexts(state, world, materializePlanSlots(world.baseline, state)).mobilityIntents;
    if (!intents.length) return world;
    const requirements = resolveJourneyRequirements(intents, world).journeys;
    if (!requirements.some(j => !j.externalExpenseId && !j.relationUnresolved && j.stops.length >= 2
      && (j.mode === "CAR" || j.stops.some(ref => ref.kind === "KNOWN")))) return preparePlanningMobility(world, state);
    const options = await mobilityOptions(world.baseline.householdId);
    if (!world.mobilityFacts) throw new TypeError("MOBILITY_AUTHORITY_MISSING");
    const vehicle = options.vehicle;
    return preparePlanningMobility({ ...world, mobilityFacts: { ...world.mobilityFacts, places: options.places, vehicle,
      history: vehicle?.vehicleId ? world.mobilityFacts.vehicleHistory?.[vehicle.vehicleId] ?? [] : [] } }, state);
  }, async readDirectWorld(householdId, targetMonth) {
    scope(householdId);
    const [forecast, inputs, externalIntents] = await Promise.all([readPlanningMonthForecast(canonical.client, householdId, targetMonth),
      readMonthInputs(canonical.client, householdId, targetMonth), readPlannedExpenses(canonical.client, householdId, targetMonth)]);
    return { forecast, monthInputs: inputs.inputs, externalIntents,
      asOfDate: Temporal.Instant.from(clock()).toZonedDateTimeISO(canonical.context.timezone).toPlainDate().toString() };
  } };
}
