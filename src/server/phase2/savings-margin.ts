import "server-only";
import Big from "big.js";
import { cacheForServerRender } from "@/lib/server-render-cache";
import { plannerDigest } from "@/domain/phase2/planner/json";
import type { SavingsMargin } from "@/domain/phase2/savings-schedule";
import { authorizedPlanner } from "./planner/runtime";
import { composerDraftAutosaveEnabledFor } from "./planner/composer-draft-cutover";
import { readActiveComposerDraft, readActiveComposerDraftRevision } from "./planner/composer-draft-service";
import { readDraftEconomicMargin } from "./planner/draft-reader";
import { resolveEffectiveMonthScenario } from "./planner/effective-month-scenario";
import { MONTH_FORECAST_RESOURCE } from "./month-forecast-snapshot";
import { projectSavingsReservations, readSavingsMonthEntries } from "./savings-goals";
import { planningDate } from "./planning-date";

type AuthorizedPlanner = Awaited<ReturnType<typeof authorizedPlanner>>;

/** The canonical proof covers imports and supported corrections. These month-scoped
 * inputs can change independently, including while a new result is being built. */
async function readMarginRevision(planner: AuthorizedPlanner, month: string, draftsEnabled: boolean) {
  const { supabase, canonicalClient, userId, householdId, deps } = planner;
  const firstDay = `${month}-01`;
  const firstCheckpoint = new Date(firstDay);
  firstCheckpoint.setUTCMonth(firstCheckpoint.getUTCMonth() - 12);
  const [plan, draft, inputs, expenses, checkpoints, forecasts, publication, reservations] = await Promise.all([
    deps.repository.readActivePointer!(householdId, month),
    draftsEnabled ? readActiveComposerDraftRevision(planner, month) : null,
    supabase.from("phase2_month_inputs").select("updated_at").eq("household_id", householdId)
      .eq("target_month", firstDay).maybeSingle(),
    supabase.from("phase2_planned_expenses").select("planned_expense_id,updated_at", { count: "exact" })
      .eq("household_id", householdId).eq("target_month", firstDay).order("planned_expense_id"),
    canonicalClient.from("phase2_forecast_checkpoints").select("checkpoint_id,input_digest", { count: "exact" })
      .eq("household_id", householdId).gte("target_month", firstCheckpoint.toISOString().slice(0, 10))
      .lte("target_month", firstDay).order("checkpoint_id"),
    canonicalClient.from("analytics_query_snapshots").select("query_key,generation_key,computed_at", { count: "exact" })
      .eq("household_id", householdId).eq("period_month", firstDay).eq("resource", MONTH_FORECAST_RESOURCE)
      .eq("is_active", true).is("invalidated_at", null).order("query_key").order("generation_key"),
    canonicalClient.from("analytics_publications").select("publication_id,source_revision,published_analytics_revision")
      .eq("household_id", householdId).eq("scope_kind", "global").eq("status", "published")
      .order("published_analytics_revision", { ascending: false }).limit(1).maybeSingle(),
    month >= "2026-08" ? readSavingsMonthEntries(supabase, householdId, month) : [],
  ]);
  if (inputs.error || publication.error || [expenses, checkpoints, forecasts].some(result =>
    result.error || result.count !== result.data?.length)) return null;
  return plannerDigest({ month, userId, day: planningDate(planner.canonical.context.timezone), plan, draft,
    inputs: inputs.data, expenses: expenses.data, checkpoints: checkpoints.data, forecasts: forecasts.data, publication: publication.data,
    reservations: projectSavingsReservations(reservations) });
}

async function calculateSavingsMargin(planner: AuthorizedPlanner, month: string, draftsEnabled: boolean): Promise<SavingsMargin> {
  const { deps, householdId } = planner;
  const draft = draftsEnabled ? await readActiveComposerDraft(planner, month) : null;
  const drafted = draft ? await readDraftEconomicMargin(deps, householdId, month, draft.semanticState) : null;
  const effective = drafted ? null : await resolveEffectiveMonthScenario(deps, householdId, month);
  const scenario = drafted?.scenario ?? effective!.scenario;
  const reference = scenario.planningReference;
  const limits: string[] = [];
  if (reference.resources.some(item => item.amount === null)) limits.push("Revenus à compléter");
  if (scenario.fixedExpenseTotal === null || drafted?.forecast.components.some(item => item.nature === "CONTRACTUAL_EXPECTED"
    && item.additiveGroup === "obligations" && item.central === null && !reference.certainOutflows.excludedKeys.includes(item.key))) {
    limits.push("Charges fixes à compléter");
  }
  if (limits.length) return { month, cents: null, limits };
  const amount = drafted ? drafted.amount : effective!.projection ? effective!.projection.plan.economicMonthEndRemainder
    : scenario.economicPlan?.scenarios.central ?? null;
  return amount === null ? { month, cents: null, limits: ["Prévisions du mois à compléter"] }
    : { month, cents: new Big(amount).times(100).round().toNumber(), limits: [] };
}

export const readSavingsMargin = cacheForServerRender(async (month: string): Promise<SavingsMargin> => {
  try {
    const planner = await authorizedPlanner({ readCacheMonth: month });
    const draftsEnabled = composerDraftAutosaveEnabledFor(planner.userId);
    const live = () => calculateSavingsMargin(planner, month, draftsEnabled);
    return planner.monthSourceCache
      ? await planner.monthSourceCache.read("savings-margin", live, () => readMarginRevision(planner, month, draftsEnabled))
      : await live();
  } catch {
    return { month, cents: null, limits: ["Prévisions du mois indisponibles"] };
  }
});

export async function readSavingsMargins(months: readonly string[]) {
  const results: SavingsMargin[] = [];
  for (let index = 0; index < months.length; index += 3) {
    results.push(...await Promise.all(months.slice(index, index + 3).map(readSavingsMargin)));
  }
  return results;
}
