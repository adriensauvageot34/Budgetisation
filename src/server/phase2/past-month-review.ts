import "server-only";
import Big from "big.js";
import { FORECAST_CATEGORY_KEYS } from "@/domain/phase2/month-decision-contract";
import { matchesForecastCategory, type MonthPredictionEvidence } from "./remaining-month-forecast";
import { forecastHorizon } from "./forecast-statistics";
import { referenceMobilityDays } from "./month-reference";
import type { ForecastCheckpoint } from "./forecast-memory";
import { requiredForecastSources } from "./forecast-opportunities";

/** Observed costs come exclusively from canonical facts. A missing earlier
 * prediction remains missing; prospective declarations never manufacture actuals. */
export function projectPastMonthReview(month: string, evidence: MonthPredictionEvidence, memory: readonly ForecastCheckpoint[]) {
  const rows = memory.filter(r => r.target_month.startsWith(month) && r.as_of_date.slice(0, 7) <= month)
    .sort((a, b) => a.computed_at.localeCompare(b.computed_at) || a.checkpoint_id.localeCompare(b.checkpoint_id));
  const checkpoints = ["START", "MID", "END"].map(horizon => ({ horizon, row: rows.find(r => forecastHorizon(r.as_of_date, month) === horizon) ?? null }));
  const complete = FORECAST_CATEGORY_KEYS.every(key => requiredForecastSources(key).every(source => evidence.completeMonthsBySource?.[source]?.includes(month)));
  const initial = checkpoints[0]!.row;
  const labels: Record<string, string> = { groceries: "Courses", "tobacco-vape": "Tabac & vape", "manon-work-mobility": "Trajets travail · Manon",
    "adrien-work-meals": "Repas travail · Adrien", "manon-work-meals": "Repas travail · Manon", "adrien-work-coffee": "Café travail · Adrien", "household-restaurants": "Restaurants du foyer" };
  const categories = FORECAST_CATEGORY_KEYS.map(key => {
    const observed = key === "manon-work-mobility" ? referenceMobilityDays(evidence.currentMobilityLegs).reduce((sum, day) => sum + day.commute + (day.detour ?? 0), 0)
      : evidence.currentEconomicEntries.filter(r => matchesForecastCategory(key, r)).reduce((sum, row) => sum + Number(row.amount), 0);
    const expected = initial?.payload.categories.find(c => c.key === key)?.projected.central ?? null;
    return { key, label: labels[key]!, observed: new Big(observed).toFixed(2), expected,
      difference: requiredForecastSources(key).every(source => evidence.completeMonthsBySource?.[source]?.includes(month)) && expected !== null ? new Big(observed).minus(expected).toFixed(2) : null };
  });
  return { complete, checkpoints, categories, actualSelectedCategories: categories.reduce((sum, c) => sum.plus(c.observed), new Big(0)).toFixed(2) };
}
