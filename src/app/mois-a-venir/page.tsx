import { notFound } from "next/navigation";
import { withProductAuthentication } from "@/app/product-query";
import { MonthForecastView } from "./month-forecast-view";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { MONTH_FORECAST_RESOURCE, queryMonthForecast, resolvePlanningMonthForecast } from "@/server/phase2/month-forecast-snapshot";
import { readMonthInputs } from "@/server/phase2/month-inputs";
import { deriveMonthScenario } from "@/server/phase2/month-scenario";
import { readPlannedExpenses } from "@/server/phase2/planned-expenses";
import { readPlannedContextOptions } from "@/server/phase2/planned-context";
import { projectPlannedExpenseCards, projectExpenseFunding } from "./planned-expenses-projection";
import { projectPlannedExpenseImpact } from "@/server/phase2/planned-impact";
import { prospectivePersonIdentity, prospectivePersonLabel } from "@/domain/phase2/planned-product";
import { planningDate } from "@/server/phase2/planning-date";
import { readMonthPredictionEvidence } from "@/server/phase2/month-prediction-evidence";
import { readForecastMemory } from "@/server/phase2/forecast-memory";
import { projectPastMonthReview } from "@/server/phase2/past-month-review";
import { PastMonthView } from "./past-month-view";

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
  const params = await searchParams;
  const activeMonth = String(latest.period_month).slice(0, 7);
  const requestedMonth = typeof params.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/u.test(params.month) ? params.month : activeMonth;
  const targetMonth = requestedMonth;
  const today = planningDate(context.household.timezone);
  if (targetMonth < today.slice(0, 7)) {
    const [evidence, memory] = await Promise.all([
      readMonthPredictionEvidence(client, context.household.householdId, targetMonth, true),
      readForecastMemory(client, context.household.householdId, targetMonth),
    ]);
    return <PastMonthView targetMonth={targetMonth} review={projectPastMonthReview(targetMonth, evidence, memory)} />;
  }
  let forecast;
  try {
    forecast = targetMonth === activeMonth ? await queryMonthForecast(client, context.household.householdId, targetMonth)
      : await resolvePlanningMonthForecast(client, context.household.householdId, targetMonth);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "FORECAST_TARGET_MONTH_NOT_FUTURE") throw error;
    return <section className="card mx-auto max-w-3xl p-8"><h1 className="text-2xl font-black">Ce mois ne fait pas partie des prévisions</h1><p className="mt-3">Choisissez un mois après la période historique de référence.</p><a className="mt-4 inline-block font-bold underline" href="/mois-a-venir">Revenir au mois à venir</a></section>;
  }
  const { supabase } = await getAuthenticatedBootstrapClient();
  const [stored, plannedExpenses, personsResult] = await Promise.all([
    readMonthInputs(supabase, context.household.householdId, targetMonth),
    readPlannedExpenses(supabase, context.household.householdId, targetMonth),
    supabase.from("persons").select("person_id,display_name,status").eq("household_id", context.household.householdId).order("display_name"),
  ]);
  if (personsResult.error) throw personsResult.error;
  const persons = (personsResult.data ?? []).filter((person) => person.status === "active")
    .map((person) => ({ personId: person.person_id, displayName: person.display_name }));
  const options = await readPlannedContextOptions(client, context.household.householdId, persons);
  const scenario = deriveMonthScenario(forecast, stored.inputs, null, today, plannedExpenses);
  const placeLabel = (ref: import("@/domain/phase2/planned-contract").ProspectivePlaceRef | undefined) =>
    ref?.kind === "TEXT" ? ref.label : ref?.kind === "KNOWN" ? options.places.find((place) => place.placeId === ref.placeId)?.name : undefined;
  const cards = projectPlannedExpenseCards(plannedExpenses, today).map((card) => {
    if (!scenario.economicPlan) return card;
    const before = deriveMonthScenario(forecast, stored.inputs, null, today,
      plannedExpenses.filter((row) => row.id !== card.id)).economicPlan;
    if (!before) return card;
    const impact = projectPlannedExpenseImpact(before, scenario.economicPlan, card);
    const participantRefs = [
      ...(card.context.participantPersonIds ?? []).map((personId) => ({ kind: "HOUSEHOLD_PERSON" as const, personId })),
      ...(card.context.participantRefs ?? []),
      ...(card.context.hostParticipates && card.context.host ? [card.context.host] : []),
      ...(card.context.visitedPersonParticipates && card.context.personVisited ? [card.context.personVisited] : []),
    ];
    const participantLabels = [...new Map(participantRefs.map((ref) => [prospectivePersonIdentity(ref),
      ref.kind === "HOUSEHOLD_PERSON" ? persons.find((person) => person.personId === ref.personId)?.displayName : prospectivePersonLabel(ref)])).values()]
      .filter((label): label is string => !!label);
    if (card.context.additionalGuestCount) participantLabels.push(`${card.context.additionalGuestCount} autre${card.context.additionalGuestCount > 1 ? "s" : ""} invité${card.context.additionalGuestCount > 1 ? "s" : ""}`);
    return { ...card, detail: { additionalImpact: impact.netAdditionalImpact.central,
      includedBaseline: impact.absorbedByBaseline.central, fuelUsage: impact.fuelUsage,
      funding: projectExpenseFunding(card), placeLabel: placeLabel(card.context.place), participantLabels,
      childPlaceLabels: Object.values(card.context.childLocalPlaceRefs ?? {}).map(placeLabel).filter((label): label is string => !!label) } };
  });
  return <MonthForecastView forecast={forecast} scenario={scenario} stored={stored}
    plannedExpenses={cards} today={today}
    persons={persons} places={options.places} vehicle={options.vehicle} prices={options.prices}
    inputError={params.inputError === "1"} />;
}
