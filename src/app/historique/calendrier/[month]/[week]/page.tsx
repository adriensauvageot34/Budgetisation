import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseYearMonth } from "@/core/time";
import { parseCalendarWeekRef } from "@/navigation";
import { CalendarClientPage } from "@/features/calendar";

export const metadata: Metadata = { title: "Semaine Calendar" };

export default async function CalendarWeekRoute({
  params,
}: {
  readonly params: Promise<{ readonly month: string; readonly week: string }>;
}) {
  try {
    const { month: rawMonth, week: rawWeek } = await params;
    return (
      <CalendarClientPage
        kind="week"
        month={parseYearMonth(rawMonth)}
        week={parseCalendarWeekRef(rawWeek)}
      />
    );
  } catch {
    notFound();
  }
}
