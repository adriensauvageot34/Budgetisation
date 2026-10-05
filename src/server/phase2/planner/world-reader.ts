import "server-only";
import { Temporal } from "@js-temporal/polyfill";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { readPlanningMonthForecast } from "../month-planning-read";
import type { MonthForecastSnapshot } from "../month-forecast-snapshot";
import { readMonthInputs } from "../month-inputs";
import { readPlannedExpenses } from "../planned-expenses";
import { buildPlanningBaseline } from "./baseline";
import { readPlanningBaselineSources } from "./baseline-adapters";
import { createPlanApplyRepository } from "./repository";
import type { EffectiveMonthDependencies } from "./effective-month-scenario";
import { plannerDigest } from "@/domain/phase2/planner/json";
import { jsonEnvelope } from "./compiler";

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
    const [sources, forecast] = await Promise.all([readPlanningBaselineSources(canonical, targetMonth, cutoff.toString()),
      readPlanningMonthForecast(canonical.client, householdId, targetMonth)]);
    if (commonForecastDigest(sources.forecast as MonthForecastSnapshot) !== commonForecastDigest(forecast))
      throw new TypeError("PLANNER_WORLD_AUTHORITIES_CHANGED_DURING_READ");
    // One admitted canonical evidence read for both C1 and financial calculation.
    return { baseline: buildPlanningBaseline(sources), forecast: { ...forecast, predictionEvidence: sources.evidence },
      monthInputs: sources.monthInputs, externalIntents: sources.plannedExpenses, asOfDate, costQuotes: {},
      modelVersions: { financialOwner: "deriveMonthScenario@v2", forecast: forecast.resourceMeta.contractVersion } };
  }, async readDirectWorld(householdId, targetMonth) {
    scope(householdId);
    const [forecast, inputs, externalIntents] = await Promise.all([readPlanningMonthForecast(canonical.client, householdId, targetMonth),
      readMonthInputs(canonical.client, householdId, targetMonth), readPlannedExpenses(canonical.client, householdId, targetMonth)]);
    return { forecast, monthInputs: inputs.inputs, externalIntents,
      asOfDate: Temporal.Instant.from(clock()).toZonedDateTimeISO(canonical.context.timezone).toPlainDate().toString() };
  } };
}
