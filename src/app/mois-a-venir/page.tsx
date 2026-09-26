import { notFound } from "next/navigation";
import { withProductAuthentication } from "@/app/product-query";
import { MonthForecastView } from "@/features/phase2/month-forecast-view";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { MONTH_FORECAST_RESOURCE, queryMonthForecast } from "@/server/phase2/month-forecast-snapshot";

export const metadata = { title: "Notre mois à venir" };
export const dynamic = "force-dynamic";

export default async function MonthForecastPage() {
  const context = await withProductAuthentication(() => getBootstrapContext());
  if (context.household === null) notFound();
  const client = createCanonicalReadClient();
  const { data: latest, error } = await client.from("analytics_query_snapshots")
    .select("period_month").eq("household_id", context.household.householdId)
    .eq("resource", MONTH_FORECAST_RESOURCE).eq("is_active", true).is("invalidated_at", null)
    .order("period_month", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!latest?.period_month) return <section className="card mx-auto max-w-3xl p-8" role="status"><p className="eyebrow">Notre mois à venir</p><h1 className="mt-2 text-3xl font-black">Prévision indisponible</h1><p className="mt-3 text-slate-600">Aucun mois prospectif publié pour ce foyer.</p></section>;
  const targetMonth = String(latest.period_month).slice(0, 7);
  const forecast = await queryMonthForecast(client, context.household.householdId, targetMonth);
  return <MonthForecastView forecast={forecast} />;
}
