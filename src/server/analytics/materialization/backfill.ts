import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseHouseholdId, type CategoryId, type HouseholdId } from "@/core/identity";
import {
  normalizeAnalysisScope,
  type AnalysisSubject,
  type AnalysisTargetSubject,
} from "@/core/scope";
import {
  parseHouseholdTimeZone,
  parseInstant,
  parseLocalDate,
  parseYearMonth,
  type YearMonth,
} from "@/core/time";
import {
  normalizeQueryRequest,
  type AnalysisMonthStructureReadModel,
  type AnyNormalizedQueryRequest,
} from "@/query-api";
import { executeQuery } from "@/query-api/server";
import {
  getAnalysisPeriods,
  getHouseholdPersons,
  getHouseholdRevision,
} from "@/server/bootstrap/queries";
import {
  createAuthorizedRuntimeContext,
  type AuthorizedRuntimeContext,
} from "@/server/canonical/context";
import { CanonicalRepository } from "@/server/canonical/repository";
import {
  createQueryServicesForContext,
  createReadOnlyQueryServicesForContext,
} from "@/server/query/runtime";
import { SupabaseAnalyticsMaterializationStore } from "./store";

export const DEFAULT_ANALYTICS_BACKFILL_MONTHS = Object.freeze([
  "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01",
  "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07",
].map(parseYearMonth));

export function hotMonthQueryRequests(month: YearMonth): readonly AnyNormalizedQueryRequest[] {
  const scope = normalizeAnalysisScope({
    subject: { kind: "household" },
    time: { kind: "month", month },
  });
  return [
    { resource: "analysis_month_initial", scope, params: {} },
    { resource: "analysis_month_evolution", scope, params: {} },
    {
      resource: "analysis_month_structure",
      scope,
      params: { view: "destination", dimension: "category", measure: "amount" },
    },
    { resource: "analysis_month_lived", scope, params: {} },
    { resource: "analysis_month_moments", scope, params: {} },
  ].map(normalizeQueryRequest);
}

const structureRequests = Object.freeze([
  { view: "destination", dimension: "category", measure: "amount" },
  { view: "destination", dimension: "activity", measure: "occurrences" },
  { view: "destination", dimension: "merchant", measure: "amount" },
  { view: "destination", dimension: "place", measure: "amount" },
  { view: "destination", dimension: "place", measure: "occurrences" },
  { view: "nature", dimension: "fixed_variable", measure: "amount" },
  { view: "life_context", dimension: "life_context", measure: "amount" },
]);
const breakdownRequests = Object.freeze([
  { dimension: "category", measure: "category_amount", limit: 50 },
  { dimension: "activity", measure: "activity_frequency", limit: 50 },
  { dimension: "merchant", measure: "merchant_net_amount", limit: 50 },
  { dimension: "place", measure: "localized_spend", limit: 50 },
  { dimension: "place", measure: "place_visit_count", limit: 50 },
  { dimension: "place", measure: "distinct_visit_days", limit: 50 },
  { dimension: "life_scope", measure: "life_scope_amount", limit: 50 },
]);
const personStructureRequests = structureRequests.filter(({ dimension, measure }) =>
  (dimension === "activity" && measure === "occurrences")
  || (dimension === "place" && measure === "occurrences"));
const personBreakdownRequests = breakdownRequests.filter(({ measure }) =>
  ["activity_frequency", "place_visit_count", "distinct_visit_days"].includes(measure));
const certifiedCategoryIdsByRevision = new Map<string, Promise<readonly CategoryId[]>>();

function datesInMonth(month: YearMonth): readonly string[] {
  const [year, number] = month.split("-").map(Number);
  return Array.from(
    { length: new Date(Date.UTC(year!, number!, 0)).getUTCDate() },
    (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`,
  );
}

function monthRequest(
  month: YearMonth,
  resource: string,
  subject: AnalysisSubject,
  params: unknown = {},
  filters?: unknown,
): AnyNormalizedQueryRequest {
  return normalizeQueryRequest({
    resource,
    scope: {
      subject,
      time: { kind: "month", month },
      ...(filters === undefined ? {} : { filters }),
    },
    params,
  });
}

async function certifiedCategoryIds(
  client: SupabaseClient,
  context: AuthorizedRuntimeContext,
): Promise<readonly CategoryId[]> {
  const key = `${context.householdId}:${context.dataRevision}`;
  let pending = certifiedCategoryIdsByRevision.get(key);
  if (pending === undefined) {
    pending = (async () => {
      const facts = await new CanonicalRepository(client, context).loadEconomicFacts({
        start: parseLocalDate("2025-08-01"),
        endExclusive: parseLocalDate("2026-08-01"),
      });
      return [...new Set(facts.flatMap(({ category }) =>
        category.kind === "resolved" ? [category.id] : []))].sort();
    })();
    certifiedCategoryIdsByRevision.set(key, pending);
  }
  try {
    return await pending;
  } catch (error) {
    certifiedCategoryIdsByRevision.delete(key);
    throw error;
  }
}

async function readStructureForBackfill(
  month: YearMonth,
  params: unknown,
  services: ReturnType<typeof createReadOnlyQueryServicesForContext>,
): Promise<AnalysisMonthStructureReadModel> {
  const request = monthRequest(month, "analysis_month_structure", { kind: "household" }, params);
  const execution = await executeQuery({ requestId: randomUUID(), request }, services);
  if (!execution.ok) {
    throw new Error(`Découverte ${month}/analysis_month_structure refusée: ${execution.error.code}.`);
  }
  return execution.response.data as AnalysisMonthStructureReadModel;
}

async function certifiedMonthQueryRequests(
  client: SupabaseClient,
  context: AuthorizedRuntimeContext,
  month: YearMonth,
): Promise<readonly AnyNormalizedQueryRequest[]> {
  const household = { kind: "household" } as const;
  const persons = context.personIds.map((personId) => ({ kind: "person" as const, personId }));
  const base = [
    monthRequest(month, "analysis_month_initial", household),
    monthRequest(month, "analysis_month_evolution", household),
    ...structureRequests.map((params) => monthRequest(month, "analysis_month_structure", household, params)),
    ...breakdownRequests.map((params) => monthRequest(month, "analysis_month_breakdown", household, params)),
    monthRequest(month, "analysis_month_contexts", household),
    monthRequest(month, "analysis_month_lived", household),
    monthRequest(month, "analysis_month_moments", household),
    ...persons.flatMap((subject) => [
      monthRequest(month, "analysis_month_initial", subject),
      monthRequest(month, "analysis_month_evolution", subject),
      ...personStructureRequests.map((params) => monthRequest(month, "analysis_month_structure", subject, params)),
      ...personBreakdownRequests.map((params) => monthRequest(month, "analysis_month_breakdown", subject, params)),
      monthRequest(month, "analysis_month_contexts", subject),
      monthRequest(month, "analysis_month_lived", subject),
      monthRequest(month, "analysis_month_moments", subject),
    ]),
    monthRequest(month, "history_calendar_month", household),
    monthRequest(month, "history_calendar_month_summary", household),
    ...datesInMonth(month).map((date) =>
      monthRequest(month, "history_day_detail", household, { date })),
  ];

  const discoveryServices = createReadOnlyQueryServicesForContext({
    context,
    client,
    onTrace: () => {},
  });
  const [categoryIds, categoryStructure, activityStructure, lifeStructure] = await Promise.all([
    certifiedCategoryIds(client, context),
    readStructureForBackfill(month, structureRequests[0], discoveryServices),
    readStructureForBackfill(month, structureRequests[1], discoveryServices),
    readStructureForBackfill(month, structureRequests[6], discoveryServices),
  ]);
  const targets = [categoryStructure, activityStructure, lifeStructure]
    .flatMap(({ rows }) => rows.flatMap(({ destination }) =>
      destination?.kind === "target" ? [destination.target] : []));
  const uniqueTargets = new Map<string, AnalysisTargetSubject>();
  for (const target of targets) uniqueTargets.set(JSON.stringify(target), target);

  return [
    ...base,
    ...categoryIds.map((categoryId) =>
      monthRequest(month, "analysis_month_initial", household, {}, { categoryIds: [categoryId] })),
    ...[...uniqueTargets.values()].map((target) =>
      monthRequest(month, "analysis_target", household, { target })),
  ];
}

async function runtimeContext(
  client: SupabaseClient,
  householdId: HouseholdId,
) {
  const [{ data: household, error }, persons, periods, revision] = await Promise.all([
    client
      .from("households")
      .select("household_id,timezone")
      .eq("household_id", householdId)
      .single(),
    getHouseholdPersons(client, householdId),
    getAnalysisPeriods(client, householdId),
    getHouseholdRevision(client, householdId),
  ]);
  if (error !== null) throw error;
  if (revision === null) throw new TypeError("Household revision absente pour le backfill.");
  return createAuthorizedRuntimeContext({
    user: { id: "analytics-materialization-backfill" },
    household: {
      householdId: parseHouseholdId(household.household_id),
      timezone: parseHouseholdTimeZone(household.timezone),
    },
    persons,
    periods,
    revision,
  }, parseInstant(new Date().toISOString()));
}

export type AnalyticsBackfillResult = {
  readonly month: YearMonth;
  readonly status: "published" | "already_fresh";
};

export async function backfillAnalyticsMaterialization(input: {
  readonly client: SupabaseClient;
  readonly householdId: unknown;
  readonly months?: readonly YearMonth[];
  readonly requestsByMonth?: ReadonlyMap<YearMonth, readonly AnyNormalizedQueryRequest[]>;
  readonly requestProfile?: "hot" | "certified";
  readonly expectedRequestCountByMonth?: ReadonlyMap<YearMonth, number>;
  readonly force?: boolean;
  readonly onProgress?: (result: AnalyticsBackfillResult) => void;
}): Promise<readonly AnalyticsBackfillResult[]> {
  const householdId = parseHouseholdId(input.householdId);
  const months = input.months ?? DEFAULT_ANALYTICS_BACKFILL_MONTHS;
  const results: AnalyticsBackfillResult[] = [];
  for (const month of months) {
    const context = await runtimeContext(input.client, householdId);
    const period = context.periods.find(({ month: candidate }) =>
      candidate.slice(0, 7) === month);
    if (period === undefined || !period.isClosed || period.financeStatus !== "complete") {
      throw new TypeError(`Le mois ${month} n'est pas un mois Finance fermé complet.`);
    }
    const requests = input.requestsByMonth?.get(month)
      ?? (input.requestProfile === "certified"
        ? await certifiedMonthQueryRequests(input.client, context, month)
        : hotMonthQueryRequests(month));
    if (requests.length === 0) {
      throw new TypeError(`Le mois ${month} ne contient aucune Query à matérialiser.`);
    }
    const expectedRequestCount = input.expectedRequestCountByMonth?.get(month);
    if (expectedRequestCount !== undefined && requests.length !== expectedRequestCount) {
      throw new TypeError(
        `Le lot ${month} contient ${requests.length} Queries au lieu de ${expectedRequestCount}.`,
      );
    }
    const readStore = new SupabaseAnalyticsMaterializationStore(input.client, context);
    const hits = await Promise.all(requests.map((request) => readStore.readQuery(request)));
    if (input.force !== true && hits.every((hit) => hit !== null)) {
      const result = { month, status: "already_fresh" as const };
      results.push(result);
      input.onProgress?.(result);
      continue;
    }

    const publicationId = await readStore.beginMonthPublication(month, requests);
    try {
      const publicationStore = new SupabaseAnalyticsMaterializationStore(
        input.client,
        context,
        { publicationId, readMode: "bypass" },
      );
      const services = createQueryServicesForContext({
        context,
        client: input.client,
        materialization: publicationStore,
      });
      for (const request of requests) {
        const execution = await executeQuery(
          { requestId: randomUUID(), request },
          services,
        );
        if (!execution.ok) {
          throw new Error(
            `Backfill ${month}/${request.resource} refusé: ${execution.error.code}.`,
          );
        }
      }
      await publicationStore.publishPrepared(publicationId);
      const result = { month, status: "published" as const };
      results.push(result);
      input.onProgress?.(result);
    } catch (error) {
      await input.client
        .from("analytics_publications")
        .update({ status: "failed" })
        .eq("publication_id", publicationId)
        .eq("status", "draft");
      throw error;
    }
  }
  return results;
}
