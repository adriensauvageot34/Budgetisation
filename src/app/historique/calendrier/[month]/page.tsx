import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseLocalDate, parseYearMonth, yearMonthOf } from "@/core/time";
import { CalendarClientPage } from "@/features/calendar";

export const metadata: Metadata = { title: "Mois Calendar" };

export default async function CalendarMonthRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly month: string }>;
  readonly searchParams: Promise<{ readonly day?: string | string[] }>;
}) {
  try {
    const { month: rawMonth } = await params;
    const { day: rawDay } = await searchParams;
    const month = parseYearMonth(rawMonth);
    const day = typeof rawDay === "string" ? parseLocalDate(rawDay) : undefined;
    if (day !== undefined && yearMonthOf(day) !== month) notFound();
    return <CalendarClientPage kind="month" month={month} {...(day ? { day } : {})} />;
  } catch {
    notFound();
  }
}
