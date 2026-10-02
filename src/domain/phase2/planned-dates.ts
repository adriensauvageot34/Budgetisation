import type { PlannedExpenseContext } from "./planned-contract";

type DatedProject = { plannedDate: string | null; context: PlannedExpenseContext; familyKey?: string };
export type PlannedExpenseDateRange = Readonly<{ startDate: string | null; endDate: string | null;
  startTime?: string; endTime?: string; startBucket?: string; endBucket?: string; isRange: boolean; hasReturn: boolean }>;

/** Durable intent first. Legacy directed journeys remain readable without migrating rows. */
export function getPlannedExpenseDateRange(expense: DatedProject): PlannedExpenseDateRange {
  const c = expense.context, journey = c.route?.liveEstimate?.journey;
  const startDate = c.visitTiming?.outbound.date ?? expense.plannedDate ?? journey?.outbound.plannedDate ?? null;
  const endDate = c.visitTiming?.return.date ?? c.endDate ?? journey?.return.plannedDate ?? startDate;
  return { startDate, endDate,
    startTime: c.visitTiming?.outbound.time ?? c.project?.exactTime ?? c.restaurant?.plannedTime ?? journey?.outbound.plannedTime ?? undefined,
    endTime: c.visitTiming?.return.time ?? c.project?.returnExactTime ?? journey?.return.plannedTime ?? undefined,
    startBucket: c.project?.moment ?? c.restaurant?.timeBucket,
    endBucket: c.project?.returnMoment,
    isRange: !!startDate && !!endDate && endDate > startDate,
    hasReturn: !!c.visitTiming || !!journey || !!c.endDate && (expense.familyKey === "visit_trip" || c.project?.returnMoment !== undefined) };
}
export const projectMomentLabel = (bucket?: string, time?: string) => time ??
  ({ MORNING: "matin", LUNCH: "midi", EVENING: "soir", NONE: "sans heure précise" } as Record<string, string>)[bucket ?? ""] ?? "sans heure précise";
const day = (date: string, weekday = false) => new Intl.DateTimeFormat("fr-FR", {
  ...(weekday ? { weekday: "short" as const } : {}), day: "numeric", month: "long", timeZone: "UTC",
}).format(new Date(`${date}T12:00:00Z`));
export function plannedExpenseTemporalSummary(expense: DatedProject): string[] {
  const r = getPlannedExpenseDateRange(expense);
  if (!r.startDate) return ["Sans date précise"];
  return [r.isRange ? `Du ${day(r.startDate)} au ${day(r.endDate!)}` : day(r.startDate),
    ...(r.isRange ? [`Départ ${day(r.startDate, true)} · ${projectMomentLabel(r.startBucket, r.startTime)}`]
      : r.startTime || r.startBucket && r.startBucket !== "NONE" ? [projectMomentLabel(r.startBucket, r.startTime)] : []),
    ...(r.hasReturn && r.endDate ? [`Retour ${day(r.endDate, true)} · ${projectMomentLabel(r.endBucket, r.endTime)}`] : [])];
}
/** One canonical human title; renderers never turn a route into a project name. */
export function getPlannedExpenseCalendarLabel(expense: { title: string; context: PlannedExpenseContext; detail?: { placeLabel?: string } }): string {
  const place = expense.detail?.placeLabel ?? expense.context.project?.entity?.city;
  return place && !expense.title.toLocaleLowerCase("fr").includes(place.toLocaleLowerCase("fr"))
    ? `${expense.title} · ${place}` : expense.title;
}
