import "server-only";
import { Temporal } from "@js-temporal/polyfill";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { readPlanningMonthForecast } from "../month-planning-read";
import type { MonthForecastSnapshot } from "../month-forecast-snapshot";
import { readMonthInputs } from "../month-inputs";
import { readPlannedExpenses } from "../planned-expenses";
import { buildSimplePlanningBaseline } from "./simple-baseline";
import { readPlanningBaselineSources } from "./baseline-adapters";
import { createPlanApplyRepository } from "./repository";
import type { EffectiveMonthDependencies } from "./effective-month-scenario";
import { plannerDigest } from "@/domain/phase2/planner/json";
import { jsonEnvelope } from "./compiler";
import { buildProspectiveMobilityFacts } from "./mobility-adapter";
import { preparePlanningMobility } from "./prospective-mobility-pricing";
import { readPlannedContextOptions } from "../planned-context";
import { expandComposableContexts } from "./context-compiler";
import { materializePlanSlots } from "./plan-slot-resolver";
import { resolveJourneyRequirements } from "./journey-resolver";

const commonForecastDigest = (snapshot: MonthForecastSnapshot) => {
  const { publicationMeta: _publication, resourceMeta: _resource, predictionEvidence: _evidence,
    forecastMemory: _memory, calibration: _calibration, meta, ...facts } = snapshot;
  const { computedAt: _clock, ...identity } = meta;
  return plannerDigest(jsonEnvelope({ ...facts, meta: identity }));
};

/** Canonical may use its trusted read client; Plan writes always use the authenticated
 * household client supplied separately by the authorized server entry point. */
export function createPlannerDependencies(canonical: CanonicalRepository, authenticatedClient: SupabaseClient,
  clock: () => string = () => new Date().toISOString()): EffectiveMonthDependencies {
  const scope = (householdId: string) => {
    if (householdId !== String(canonical.context.householdId)) throw new TypeError("PLANNER_AUTHORIZED_HOUSEHOLD_MISMATCH");
  };
  return { repository: createPlanApplyRepository(authenticatedClient), async readWorld(householdId, targetMonth) {
    scope(householdId);
    const cutoff = Temporal.Instant.from(clock()), asOfDate = cutoff.toZonedDateTimeISO(canonical.context.timezone).toPlainDate().toString();
    const [sources, forecast] = await Promise.all([readPlanningBaselineSources(canonical, targetMonth, cutoff.toString(), { simpleOccurrences: true }),
      readPlanningMonthForecast(canonical.client, householdId, targetMonth)]);
    if (commonForecastDigest(sources.forecast as MonthForecastSnapshot) !== commonForecastDigest(forecast))
      throw new TypeError("PLANNER_WORLD_AUTHORITIES_CHANGED_DURING_READ");
    // One admitted canonical evidence read for both C1 and financial calculation.
    return { baseline: buildSimplePlanningBaseline(sources), forecast: { ...forecast, predictionEvidence: sources.evidence },
      monthInputs: sources.monthInputs, externalIntents: sources.plannedExpenses, asOfDate, costQuotes: {},
      mobilityFacts: buildProspectiveMobilityFacts(sources),
      modelVersions: { financialOwner: "deriveMonthScenario@v2", forecast: forecast.resourceMeta.contractVersion } };
  }, async prepareWorld(world, state) {
    scope(world.baseline.householdId);
    const intents = expandComposableContexts(state, world, materializePlanSlots(world.baseline, state)).mobilityIntents;
    if (!intents.length) return world;
    const requirements = resolveJourneyRequirements(intents, world).journeys;
    if (!requirements.some(j => !j.externalExpenseId && !j.relationUnresolved && j.stops.length >= 2
      && (j.mode === "CAR" || j.stops.some(ref => ref.kind === "KNOWN")))) return preparePlanningMobility(world, state);
    const options = await readPlannedContextOptions(canonical.client, world.baseline.householdId, canonical.context.persons);
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
