import { Temporal } from "@js-temporal/polyfill";
import { notFound, redirect } from "next/navigation";
import { addDays, parseYearMonth, type LocalDate, type YearMonth } from "@/core/time";
import { parseCalendarWeekRef } from "@/navigation";
import { listCivilMonthDates } from "@/query-api";

export default async function LegacyCalendarWeekAlias({
  params,
}: {
  readonly params: Promise<{ readonly month: string; readonly week: string }>;
}) {
  const { month: rawMonth, week: rawWeek } = await params;
  let month: YearMonth;
  let weekStart: LocalDate;
  try {
    month = parseYearMonth(rawMonth);
    const week = parseCalendarWeekRef(rawWeek);
    const weekNumber = Number(week.slice("semaine-".length));
    const anchor = listCivilMonthDates(month).find(
      (date) => Temporal.PlainDate.from(date).weekOfYear === weekNumber,
    );
    if (anchor === undefined) notFound();
    weekStart = addDays(anchor, -(Temporal.PlainDate.from(anchor).dayOfWeek - 1));
  } catch {
    notFound();
  }
  redirect(`/historique/${month}?${new URLSearchParams({ view: "calendar", week: weekStart }).toString()}`);
}
