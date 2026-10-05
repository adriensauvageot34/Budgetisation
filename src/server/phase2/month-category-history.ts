import "server-only";
import Big from "big.js";
import { matchesForecastCategory, type MonthPredictionEvidence } from "./remaining-month-forecast";
import { referenceQuantile, referenceMobilityDays } from "./month-reference";
import { requiredForecastSources } from "./forecast-opportunities";
import { FORECAST_POLICY } from "./forecast-statistics";
import { MONTH_CATEGORY_CAPABILITIES } from "@/domain/phase2/month-choice-contract";

/** Read-only observed history. Reuses canonical matching, coverage and quantile owners. */
export function projectCategoryObservedHistory(key: string, evidence: MonthPredictionEvidence | undefined, trainingMonths: readonly string[], asOf: string, targetMonth: string) {
  const candidates = !evidence || !MONTH_CATEGORY_CAPABILITIES[key] ? [] : [...new Set([...trainingMonths, ...(evidence.completeMonths ?? []), ...Object.values(evidence.completeMonthsBySource ?? {}).flat(), ...evidence.history.economicEntries.map(row => row.date.slice(0, 7)), ...evidence.history.mobilityLegs.map(row => row.date.slice(0, 7))])].sort();
  const diagnostic = candidates.map(month => {
    const reasons: string[] = [];
    if (month >= asOf.slice(0, 7) || month >= targetMonth) reasons.push("CURRENT_OR_FUTURE_MONTH");
    for (const source of requiredForecastSources(key)) if (!evidence?.completeMonthsBySource?.[source]?.includes(month)) reasons.push(`SOURCE_COVERAGE_UNCERTIFIED:${source}`);
    return { month, reasons };
  });
  const months = diagnostic.filter(row => !row.reasons.length).map(row => row.month);
  const reject = (month: string, reason: string) => { diagnostic.find(row => row.month === month)!.reasons.push(reason); return null; };
  const samples = months.map(month => {
    const rows = evidence!.history.economicEntries.filter(row => row.date.startsWith(month) && matchesForecastCategory(key, row));
    if (rows.some(row => row.amountStatus === "PARTIAL" || !Number.isFinite(Number(row.amount)))) return reject(month, "AMOUNT_PARTIAL_OR_INVALID");
    // Complete source imports do not resolve a missing meal participant. Reuse
    // the canonical matcher to recognize those meals rather than inventing zero.
    if (["manon-work-meals", "adrien-work-meals"].includes(key) && evidence!.history.economicEntries.some(row => row.date.startsWith(month)
      && row.person !== "Manon" && row.person !== "Adrien" && matchesForecastCategory("adrien-work-meals", { ...row, person: "Adrien" }))) return reject(month, "MEAL_PERSON_UNRESOLVED");
    if (key === "manon-work-mobility" && evidence!.history.mobilityLegs.some(row => row.date.startsWith(month)
      && (row.fuelCost === null || row.fuelCost === undefined || !Number.isFinite(Number(row.fuelCost))))) return reject(month, "FUEL_AMOUNT_UNKNOWN");
    const amount = key === "manon-work-mobility" ? referenceMobilityDays(evidence!.history.mobilityLegs.filter(row => row.date.startsWith(month))).reduce((sum, row) => sum + row.commute + (row.detour ?? 0), 0)
      : rows.reduce((sum, row) => sum.plus(row.amount), new Big(0)).toNumber();
    return { month, amount: new Big(amount).toFixed(2) };
  }).filter((row): row is { month: string; amount: string } => row !== null);
  const values = samples.map(row => Number(row.amount)), enough = samples.length >= FORECAST_POLICY.minimumMonths;
  return { status: enough ? "AVAILABLE" as const : "INSUFFICIENT" as const, count: samples.length, months: samples.map(row => row.month),
    diagnostic: { candidateMonths: candidates, acceptedMonths: samples.map(row => row.month), rejectedMonths: diagnostic.filter(row => row.reasons.length) },
    min: enough ? new Big(Math.min(...values)).toFixed(2) : null, median: enough ? new Big(referenceQuantile(values, .5)).toFixed(2) : null, max: enough ? new Big(Math.max(...values)).toFixed(2) : null };
}
