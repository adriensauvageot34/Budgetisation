import "server-only";
import { Temporal } from "@js-temporal/polyfill";
import { parseLocalDate } from "@/core/time";
import { plannerMonth } from "@/domain/phase2/planner/json";
import type { AuthorizedRuntimeContext } from "@/server/canonical/context";

/** Exact period already used by Baseline. Shared with explicit preparation. */
export function activityHistoryPeriod(context: Pick<AuthorizedRuntimeContext, "timezone" | "periods">,
  targetMonth: string, knowledgeCutoff: string) {
  const month = plannerMonth(targetMonth), today = Temporal.Instant.from(knowledgeCutoff)
    .toZonedDateTimeISO(context.timezone).toPlainDate();
  const lastHistorical = Temporal.PlainDate.from(`${month}-01`).subtract({ days: 1 });
  const through = Temporal.PlainDate.compare(today, lastHistorical) < 0 ? today : lastHistorical;
  const firstMonth = context.periods.map(p => p.month.slice(0, 7)).sort()[0];
  if (!firstMonth || `${firstMonth}-01` > through.toString()) throw new TypeError("BASELINE_CANONICAL_PERIODS_UNAVAILABLE");
  return { range: { start: parseLocalDate(`${firstMonth}-01`), endExclusive: parseLocalDate(through.add({ days: 1 }).toString()) },
    today, through, cutoffDate: today.toString() };
}
