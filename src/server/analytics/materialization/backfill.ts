import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseHouseholdId, type HouseholdId } from "@/core/identity";
import { normalizeAnalysisScope } from "@/core/scope";
import {
  parseHouseholdTimeZone,
  parseInstant,
  parseYearMonth,
  type YearMonth,
} from "@/core/time";
import { normalizeQueryRequest, type AnyNormalizedQueryRequest } from "@/query-api";
import { executeQuery } from "@/query-api/server";
import {
  getAnalysisPeriods,
  getHouseholdPersons,
  getHouseholdRevision,
} from "@/server/bootstrap/queries";
import { createAuthorizedRuntimeContext } from "@/server/canonical/context";
import { createQueryServicesForContext } from "@/server/query/runtime";
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
    const requests = hotMonthQueryRequests(month);
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
