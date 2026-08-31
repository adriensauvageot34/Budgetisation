import { notFound, redirect } from "next/navigation";
import { parseLocalDate, parseYearMonth, yearMonthOf, type LocalDate, type YearMonth } from "@/core/time";

export default async function LegacyCalendarMonthAlias({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly month: string }>;
  readonly searchParams: Promise<{ readonly day?: string | string[] }>;
}) {
  const { month: rawMonth } = await params;
  const { day: rawDay } = await searchParams;
  let month: YearMonth;
  let day: LocalDate | undefined;
  try {
    month = parseYearMonth(rawMonth);
    day = typeof rawDay === "string" ? parseLocalDate(rawDay) : undefined;
  } catch {
    notFound();
  }
  if (day !== undefined && yearMonthOf(day) !== month) notFound();
  const query = new URLSearchParams({ view: "calendar" });
  if (day !== undefined) query.set("journal", day);
  redirect(`/historique/${month}?${query.toString()}`);
}
