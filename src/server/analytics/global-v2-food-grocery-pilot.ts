import "server-only";

import { buildGlobalActivityCostProfile } from "@/analytics/global-v2";
import type { GlobalM2MonthlyComponent } from "@/analytics/global-v2";
import { projectPurchaseAwareGroceryCausalCosts } from "@/analytics/global-v2/purchase-aware-grocery-cost";
import type { ActivityOccurrenceCostFact, ActivityOccurrenceFact } from "@/analytics/facts";
import { addMonths, parseLocalDate, type YearMonth } from "@/core/time";
import type { CanonicalMinimalPlanningBundle, CanonicalRepository } from "@/server/canonical/repository";
import type { CanonicalRecord } from "@/server/canonical/record";
import { resolveGlobalBackgroundRhythmsProduction, projectGlobalFoodEconomicComponents } from "./global-v2-background-rhythms-production";
import { buildGlobalBackgroundBenefitContext } from "./global-v2-background-benefit-context";
import { resolveGlobalGroceryCandidateAdapter } from "./global-v2-candidate-adapters";

async function readPilotRows(
  repository: CanonicalRepository,
  table: string,
  columns: string,
  eventIds: readonly string[],
): Promise<readonly CanonicalRecord[]> {
  const rows: CanonicalRecord[] = [];
  for (let offset = 0; offset < eventIds.length; offset += 100) {
    const { data, error } = await repository.client.from(table).select(columns)
      .eq("household_id", repository.context.householdId)
      .in("purchase_event_id", eventIds.slice(offset, offset + 100));
    if (error !== null || !Array.isArray(data)) throw new TypeError(`FOOD_PILOT_${table.toUpperCase()}_READ_FAILED`);
    rows.push(...data as unknown as CanonicalRecord[]);
  }
  return rows;
}

/** Explicit C4 pilot boundary. The DEFAULT Global orchestrator never calls this function. */
export async function resolveGlobalFoodGroceryPurchaseAwarePilot(input: {
  readonly repository: CanonicalRepository;
  readonly months: readonly YearMonth[];
  readonly minimalBundle: CanonicalMinimalPlanningBundle;
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly activityCosts: readonly ActivityOccurrenceCostFact[];
  readonly m2MonthlyComponents: readonly GlobalM2MonthlyComponent[];
  readonly subcategoryRows: readonly CanonicalRecord[];
}) {
  if (input.months.length !== 12) throw new TypeError("FOOD_PILOT_PERIOD_MONTH_COUNT");
  const first = input.months[0]!;
  const last = input.months.at(-1)!;
  const canonical = await input.repository.loadPurchaseAwareCanonical({
    start: parseLocalDate(`${first}-01`), endExclusive: parseLocalDate(`${addMonths(last, 1)}-01`),
  }, "PURCHASE_AWARE_PILOT");
  const economicComponents = projectGlobalFoodEconomicComponents({ canonical, bundle: input.minimalBundle,
    subcategoryRows: input.subcategoryRows });
  const correctedCosts = projectPurchaseAwareGroceryCausalCosts({
    costs: input.activityCosts,
    purchaseFacts: canonical.facts.filter((fact) => fact.fact === "fct_purchase_aware_economic_component"),
  });
  const activityCostProfiles = [...new Set(input.occurrences.map(({ activityId }) => String(activityId)))].sort()
    .map((activityId) => buildGlobalActivityCostProfile({ activityId, occurrences: input.occurrences, activityCosts: correctedCosts }));
  const grocery = resolveGlobalGroceryCandidateAdapter({
    months: input.months, occurrences: input.occurrences, activityCostProfiles,
    m2MonthlyComponents: input.m2MonthlyComponents, subcategoryRows: input.subcategoryRows,
    foodEconomicComponents: economicComponents,
  });
  const background = await resolveGlobalBackgroundRhythmsProduction({
    client: input.repository.client, repository: input.repository, months: input.months, grocery,
    subcategoryRows: input.subcategoryRows, minimalBundle: input.minimalBundle,
    occurrences: input.occurrences, activityCosts: correctedCosts,
    foodEconomicComponents: economicComponents,
  });
  const eventIds = canonical.facts.flatMap((fact) => fact.fact === "fct_purchase_aware_economic_component"
    ? [String(fact.purchaseEventId)] : []);
  const [fundingRows, purchaseRows, channelRows] = await Promise.all([
    readPilotRows(input.repository, "purchase_funding_components", "purchase_event_id,funding_kind,amount_status,amount", eventIds),
    readPilotRows(input.repository, "purchase_events", "purchase_event_id,merchant_id", eventIds),
    readPilotRows(input.repository, "purchase_event_channel_assertions", "purchase_event_id,channel,is_active", eventIds),
  ]);
  if (purchaseRows.length !== eventIds.length) throw new TypeError("FOOD_PILOT_PURCHASE_PRESENTATION_INCOMPLETE");
  const merchantIds = [...new Set(purchaseRows.map((row) => String(row.merchant_id)))];
  const merchantRows = await input.repository.loadEntityRows("merchants", "merchant_id", merchantIds);
  const merchantLabels = new Map(merchantRows.map((row) => [String(row.merchant_id), String(row.nom_canonique)]));
  const channels = new Map(channelRows.filter((row) => row.is_active === true)
    .map((row) => [String(row.purchase_event_id), String(row.channel)]));
  if (channels.size !== eventIds.length) throw new TypeError("FOOD_PILOT_CHANNEL_INCOMPLETE");
  const presentations = purchaseRows.map((row) => {
    const merchantLabel = merchantLabels.get(String(row.merchant_id));
    const channel = channels.get(String(row.purchase_event_id));
    if (merchantLabel === undefined || (channel !== "DIRECT_OR_IN_PERSON" && channel !== "UBER_EATS" && channel !== "UNKNOWN")) {
      throw new TypeError("FOOD_PILOT_PRESENTATION_REFERENCE_INVALID");
    }
    return { purchaseEventId: String(row.purchase_event_id), merchantLabel,
      channel: channel as "DIRECT_OR_IN_PERSON" | "UBER_EATS" | "UNKNOWN" };
  });
  const { data: wallets, error: walletError } = await input.repository.client.from("benefit_wallets")
    .select("coverage_start,coverage_end,import_batch_id").eq("household_id", input.repository.context.householdId);
  if (walletError !== null || wallets?.length !== 1) throw new TypeError("FOOD_PILOT_WALLET_COVERAGE_INVALID");
  const wallet = wallets[0]!;
  const { data: batch, error: batchError } = await input.repository.client.from("import_batches")
    .select("coverage_status").eq("import_batch_id", wallet.import_batch_id).single();
  if (batchError !== null || batch?.coverage_status !== "PARTIAL") throw new TypeError("FOOD_PILOT_BATCH_COVERAGE_INVALID");
  const coverageMonths = input.months.map((month, index) => [index,
    String(wallet.coverage_start).slice(0, 7) <= month && month <= String(wallet.coverage_end).slice(0, 7)
      ? "IN_COVERAGE" : "OUT_OF_COVERAGE"] as const);
  const benefitContext = buildGlobalBackgroundBenefitContext({
    canonical, food: background.food,
    coverage: { status: "PARTIAL", startMonth: input.months[0]!, endMonth: input.months.at(-1)!, exceptions: coverageMonths },
    months: input.months,
    fundingComponents: fundingRows as unknown as Parameters<typeof buildGlobalBackgroundBenefitContext>[0]["fundingComponents"],
    presentations,
  });
  return { canonical, economicComponents, correctedCosts, grocery, ...background, ...benefitContext };
}
