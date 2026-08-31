import { redirect } from "next/navigation";

export default async function HistoryV2MonthAlias({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly month: string }>;
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}) {
  const { month } = await params;
  const rawSearch = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearch)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  redirect(`/historique/${month}${query.size === 0 ? "" : `?${query.toString()}`}`);
}
