import { notFound } from "next/navigation";
import { withProductAuthentication } from "@/app/product-query";
import { MonthForecastView } from "./month-forecast-view";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { MONTH_FORECAST_RESOURCE, queryMonthForecast } from "@/server/phase2/month-forecast-snapshot";
import { readMonthInputs } from "@/server/phase2/month-inputs";
import { deriveMonthScenario, type WhatIfPurchase } from "@/server/phase2/month-scenario";
import { readPlannedExpenses } from "@/server/phase2/planned-expenses";

export const metadata = { title: "Notre mois à venir" };
export const dynamic = "force-dynamic";

export default async function MonthForecastPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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
  const { supabase } = await getAuthenticatedBootstrapClient();
  const [stored, plannedExpenses] = await Promise.all([
    readMonthInputs(supabase, context.household.householdId, targetMonth),
    readPlannedExpenses(supabase, context.household.householdId, targetMonth),
  ]);
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const purchase: WhatIfPurchase | null = value("purchase") === "" ? null : {
    amount: value("purchase"), parentEnvelope: value("parent") || null,
    amountAlreadyCoveredByParentEnvelope: value("covered") || "0",
  };
  const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: context.household.timezone,
    year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const datePart = (part: string) => dateParts.find((item) => item.type === part)?.value ?? "";
  const today = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
  const baseScenario = deriveMonthScenario(forecast, stored.inputs, null, today, plannedExpenses);
  let scenario;
  let whatIfError = false;
  try {
    scenario = deriveMonthScenario(forecast, stored.inputs, purchase, today, plannedExpenses);
  } catch (error) {
    if (!(error instanceof TypeError) || purchase === null) throw error;
    scenario = baseScenario;
    whatIfError = true;
  }
  return <MonthForecastView forecast={forecast} scenario={scenario} baseScenario={baseScenario} stored={stored}
    eventImpacts={{}} today={today} purchaseName={value("purchaseName").slice(0, 120)}
    whatIfError={whatIfError} inputError={value("inputError") === "1"} />;
}
