import "server-only";
import Big from "big.js";
import { planningDate } from "./planning-date";
import type { CostRange } from "./remaining-month-forecast";

export type EvidenceSource = "BANK" | "SWILE" | "EDENRED" | "MOBILITY";
export type CoverageStatus = "FULL" | "PARTIAL" | "UNKNOWN" | "ABSENT";
export type SourceCoverage = Readonly<{ source: EvidenceSource; latestObserved: string | null;
  coverageThrough: string | null; safeThrough: string | null; continuousFrom: string | null;
  coverageStatus: CoverageStatus; limitationCodes: readonly string[] }>;
export type CoverageInterval = Readonly<{ start: string; end: string }>;
export const DEFAULT_BANK_GRACE_DAYS = 3;
export const FORECAST_SOURCES: readonly EvidenceSource[] = ["BANK", "SWILE", "EDENRED", "MOBILITY"];
export const addCalendarDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
/** A gap ends proof of continuity. MAX(date) is never proof of coverage. */
export function continuousCoverage(intervals: readonly CoverageInterval[], requiredStart: string): string | null {
  let through: string | null = null;
  for (const interval of [...intervals].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))) {
    if (interval.end < requiredStart || interval.end < interval.start) continue;
    if (interval.start > (through === null ? requiredStart : addCalendarDays(through, 1))) break;
    if (through === null || interval.end > through) through = interval.end;
  }
  return through;
}
export function sourceCoverage(source: EvidenceSource, requiredStart: string, asOf: string,
  intervals: readonly CoverageInterval[], status: CoverageStatus, latestObserved: string | null): SourceCoverage {
  const through = continuousCoverage(intervals, requiredStart);
  const clipped = through === null ? null : through < asOf ? through : asOf;
  return { source, latestObserved: latestObserved && latestObserved <= asOf ? latestObserved : null,
    coverageThrough: clipped, safeThrough: status !== "FULL" || clipped === null ? null : addCalendarDays(clipped, source === "BANK" ? -DEFAULT_BANK_GRACE_DAYS : 0),
    continuousFrom: clipped === null ? null : requiredStart, coverageStatus: status,
    limitationCodes: status !== "FULL" || clipped === null ? [`${source}_${status === "FULL" ? "COVERAGE_GAP" : status}`] : [] };
}
export function requiredForecastSources(key: string): readonly EvidenceSource[] {
  if (key === "manon-work-mobility") return ["MOBILITY"];
  if (key === "manon-work-meals") return ["BANK", "EDENRED"];
  if (key === "adrien-work-meals" || key === "adrien-work-coffee") return ["BANK", "SWILE"];
  if (key === "groceries" || key === "household-restaurants") return ["BANK", "SWILE", "EDENRED"];
  return ["BANK"];
}
export type AsOfContext = Readonly<{ asOfDate: string; today: string; timezone: string; targetMonth: string;
  monthStart: string; monthEnd: string; temporalMode: "FUTURE_MONTH" | "CURRENT_MONTH" | "PAST_MONTH";
  daysElapsed: number; daysRemaining: number; coverageBySource: Readonly<Record<EvidenceSource, SourceCoverage>> }>;
export function makeAsOfContext(targetMonth: string, asOfDate: string, timezone = "Europe/Paris",
  coverage: Partial<Record<EvidenceSource, SourceCoverage>> = {}): AsOfContext {
  const [year, month] = targetMonth.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(year!, month!, 0)).toISOString().slice(0, 10);
  const monthStart = `${targetMonth}-01`, count = Number(monthEnd.slice(8));
  const temporalMode = targetMonth > asOfDate.slice(0, 7) ? "FUTURE_MONTH" : targetMonth < asOfDate.slice(0, 7) ? "PAST_MONTH" : "CURRENT_MONTH";
  const daysElapsed = temporalMode === "FUTURE_MONTH" ? 0 : temporalMode === "PAST_MONTH" ? count : Number(asOfDate.slice(8)) - 1;
  return { targetMonth, asOfDate, today: asOfDate, timezone, monthStart, monthEnd, temporalMode,
    daysElapsed, daysRemaining: count - daysElapsed,
    coverageBySource: Object.fromEntries(FORECAST_SOURCES.map(source => {
      const input = coverage[source] ?? sourceCoverage(source, monthStart, asOfDate, [], "ABSENT", null);
      const through = input.coverageThrough === null ? null : input.coverageThrough < asOfDate ? input.coverageThrough : asOfDate;
      const safeLimit = through === null ? null : addCalendarDays(through, source === "BANK" ? -DEFAULT_BANK_GRACE_DAYS : 0);
      return [source, { ...input, coverageThrough: through,
        latestObserved: input.latestObserved !== null && input.latestObserved <= asOfDate ? input.latestObserved : null,
        safeThrough: input.coverageStatus !== "FULL" || input.safeThrough === null || safeLimit === null ? null
          : input.safeThrough < safeLimit ? input.safeThrough : safeLimit }];
    })) as Record<EvidenceSource, SourceCoverage> };
}
export const currentAsOfContext = (month: string, timezone: string, now = new Date()) => makeAsOfContext(month, planningDate(timezone, now), timezone);
export function safeToExpire(date: string, context: AsOfContext, sources: readonly EvidenceSource[]): boolean {
  return date < context.today && sources.every(source => {
    const c = context.coverageBySource[source];
    return c.coverageStatus === "FULL" && c.continuousFrom !== null && c.continuousFrom <= date && c.safeThrough !== null && c.safeThrough >= date;
  });
}
export type OpportunityState = "FUTURE" | "PLANNED" | "PENDING_OBSERVATION" | "OBSERVED" | "EXPIRED" | "CANCELLED" | "UNRESOLVED";
export type ObservationRef = Readonly<{ kind: "OPERATION" | "PURCHASE_EVENT" | "MOBILITY"; id: string }>;
export type ForecastOpportunity = Readonly<{ id: string; categoryKey: string; date: string | null; state: OpportunityState;
  probability: number; expectedEconomic: CostRange; expectedFunding: Readonly<Partial<Record<"BANK" | "SWILE" | "EDENRED", { low: string | null; central: string | null; high: string | null }>>>;
  requiredSources: readonly EvidenceSource[]; observedEconomic: string; plannedEconomic: string;
  pendingExpectedEconomic: string; futureExpectedEconomic: string; observedRef?: ObservationRef; plannedExpenseId?: string;
  confidence: "LOW" | "MEDIUM" | "HIGH"; limitationCodes: readonly string[] }>;
export function opportunityState(input: { date: string | null; observed?: boolean; planned?: boolean; cancelled?: boolean },
  context: AsOfContext, sources: readonly EvidenceSource[], allowExpiration = true): OpportunityState {
  if (input.observed) return "OBSERVED";
  if (input.planned) return "PLANNED";
  if (input.cancelled) return "CANCELLED";
  if (input.date !== null && input.date >= context.today) return "FUTURE";
  if (allowExpiration && input.date !== null && safeToExpire(input.date, context, sources)) return "EXPIRED";
  return context.temporalMode === "PAST_MONTH" ? "UNRESOLVED" : "PENDING_OBSERVATION";
}
export const emptyCostRange = (): CostRange => ({ low: "0.00", central: "0.00", high: "0.00" });
export const sumCostRanges = (ranges: readonly CostRange[]): CostRange => Object.fromEntries((["low", "central", "high"] as const)
  .map(key => [key, ranges.reduce((sum, row) => sum.plus(row[key]), new Big(0)).toFixed(2)])) as CostRange;
