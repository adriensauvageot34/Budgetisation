import "server-only";
import Big from "big.js";
import { matchesForecastCategory, type MonthPredictionEvidence } from "./remaining-month-forecast";
import { isReferenceWorkMobilityLeg, referenceQuantile, referenceMobilityDays } from "./month-reference";
import { FORECAST_POLICY } from "./forecast-statistics";
import { MONTH_CATEGORY_CAPABILITIES } from "@/domain/phase2/month-choice-contract";

/** Local observed costs, independent of forecast coverage, funding and training.
 * A known canonical zero is an observation; absence never certifies a zero.
 * History V2 currently has no live frozen category publication proving absence.
 */
export function projectCategoryObservedHistory(key: string, evidence: MonthPredictionEvidence | undefined, asOf: string, targetMonth: string) {
  const corpus = evidence?.history;
  const candidates = !corpus || !MONTH_CATEGORY_CAPABILITIES[key] ? [] : [...new Set([
    ...corpus.economicEntries.map(row => row.date.slice(0, 7)),
    ...corpus.mobilityLegs.map(row => row.date.slice(0, 7)),
    ...(corpus.incompleteMobilityLegs ?? []).map(row => row.date.slice(0, 7)),
  ])].filter(month => month >= corpus.startMonth && month <= corpus.endMonth).sort();
  const diagnostic = candidates.map(month => ({ month, reasons: [] as string[] }));
  const samples: { month: string; amount: string }[] = [];
  for (const { month, reasons } of diagnostic) {
    if (month === asOf.slice(0, 7)) reasons.push("CURRENT_MONTH_NOT_CLOSED");
    else if (month > asOf.slice(0, 7) || month >= targetMonth) reasons.push("FUTURE_MONTH");
    if (reasons.length) continue;
    const monthly = corpus!.economicEntries.filter(row => row.date.startsWith(month));
    const rows = monthly.filter(row => matchesForecastCategory(key, row));
    if (["manon-work-meals", "adrien-work-meals"].includes(key) && monthly.some(row =>
      row.person !== "Manon" && row.person !== "Adrien" && matchesForecastCategory("adrien-work-meals", { ...row, person: "Adrien" }))) reasons.push("AMBIGUOUS_PERSON");
    if (rows.some(row => row.amountStatus === "PARTIAL")) reasons.push("PARTIAL_AMOUNT");
    if (rows.some(row => !row.amount.trim() || !Number.isFinite(Number(row.amount)))) reasons.push("NON_FINITE_AMOUNT");
    let amount = new Big(0);
    if (key === "manon-work-mobility") {
      const legs = corpus!.mobilityLegs.filter(row => row.date.startsWith(month) && isReferenceWorkMobilityLeg(row));
      if (legs.some(row => !row.fuelCost?.trim() || !Number.isFinite(Number(row.fuelCost)))
        || corpus!.incompleteMobilityLegs?.some(row => row.date.startsWith(month) && isReferenceWorkMobilityLeg(row))) reasons.push("MOBILITY_COST_UNKNOWN");
      if (!reasons.length) {
        const days = referenceMobilityDays(legs);
        // The daily owner omits unmatched halves. They cannot certify a monthly total.
        const dates = new Set(legs.map(row => row.date));
        if (days.length !== dates.size || days.some(day => day.detour === null && legs.some(leg => leg.date === day.date && ["lunchOut", "lunchIn"].includes(String(isReferenceWorkMobilityLeg(leg)))))) reasons.push("MOBILITY_COST_UNKNOWN");
        if (!days.length && !legs.length) reasons.push("ZERO_NOT_CERTIFIED");
        amount = days.reduce((sum, day) => sum.plus(day.commute).plus(day.detour ?? 0), amount);
      }
    } else {
      if (!rows.length && !reasons.length) reasons.push("ZERO_NOT_CERTIFIED");
      if (!reasons.length) amount = rows.reduce((sum, row) => sum.plus(row.amount), amount);
    }
    if (!reasons.length) samples.push({ month, amount: amount.toFixed(2) });
  }
  const values = samples.map(row => Number(row.amount)), enough = samples.length >= FORECAST_POLICY.minimumMonths;
  const min = enough ? new Big(Math.min(...values)).toFixed(2) : null;
  const max = enough ? new Big(Math.max(...values)).toFixed(2) : null;
  return { status: enough ? "AVAILABLE" as const : "INSUFFICIENT" as const, count: samples.length, months: samples.map(row => row.month), samples,
    diagnostic: { candidateMonths: candidates, acceptedMonths: samples.map(row => row.month), rejectedMonths: diagnostic.filter(row => row.reasons.length) },
    min, minMonth: min === null ? null : samples.find(row => row.amount === min)!.month,
    median: enough ? new Big(referenceQuantile(values, .5)).toFixed(2) : null,
    max, maxMonth: max === null ? null : samples.find(row => row.amount === max)!.month };
}
