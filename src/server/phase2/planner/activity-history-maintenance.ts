import "server-only";
import { Temporal } from "@js-temporal/polyfill";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CanonicalRepository } from "@/server/canonical/repository";
import { createAuthorizedRuntimeContext } from "@/server/canonical/context";
import { getHouseholdPersons, getAnalysisPeriods, getHouseholdRevision } from "@/server/bootstrap/queries";
import { parseHouseholdId } from "@/core/identity";
import { parseHouseholdTimeZone, parseInstant } from "@/core/time";
import { plannerDigest, plannerRecord, plannerUuid } from "@/domain/phase2/planner/json";
import { createActivityHistoryStore } from "./activity-history-store";
import { activityHistoryScope, admittedActivityHistory, prepareActivityHistory, type ActivityHistoryStore } from "./activity-history-artifact";
import { activityHistoryPeriod } from "./activity-history-period";

/** Definite CAS rejection may retry once; ambiguous write ALWAYS re-inspects.
 * No retry after an unconfirmed commit and no financial writer is available. */
export async function prepareRegisteredActivityHistory(repository: CanonicalRepository, targetMonth: string, store: ActivityHistoryStore) {
  const started = performance.now();
  const { range, cutoffDate } = activityHistoryPeriod(repository.context, targetMonth, repository.context.asOf);
  const scope = activityHistoryScope(repository, range, cutoffDate), key = plannerDigest(scope);
  for (let attempt = 0; attempt < 2; attempt++) {
    let expected: { generation: number; digest: string } | undefined;
    const guarded: ActivityHistoryStore = { ...store, async publish(s, k, g, artifact) {
      expected = { generation: artifact.generation, digest: artifact.digest };
      return store.publish(s, k, g, artifact);
    } };
    let accepted: boolean;
    try { accepted = await prepareActivityHistory(repository, range, cutoffDate, guarded); }
    catch (error) {
      if (!expected) throw error;
      const current = await store.inspect(scope, key);
      if (current.generation !== expected.generation || plannerRecord(current.artifact).digest !== expected.digest) throw error;
      return { status: "RECOVERED_COMMIT" as const, generation: current.generation, digest: expected.digest, preparationMs: performance.now()-started };
    }
    if (accepted) {
      const current = await store.inspect(scope, key);
      if (current.generation !== expected?.generation || plannerRecord(current.artifact).digest !== expected.digest)
        throw new TypeError("SNAP_PUBLICATION_RELECTURE_UNCONFIRMED");
      return { status: "PUBLISHED" as const, generation: current.generation, digest: expected.digest, preparationMs: performance.now()-started };
    }
  }
  return { status: "STALE_REJECTED" as const, preparationMs: performance.now()-started };
}

/** Supabase secret client stays server-side. A separate service-only inspect
 * validates the registered actor's CURRENT membership, people, timezone and ban. */
export function trustedActivityHistoryStore(client: SupabaseClient): ActivityHistoryStore {
  const inspectClient = { rpc(name: string, args: unknown) {
    if (name !== "inspect_planner_activity_history_v1") throw new TypeError("SNAP_TRUSTED_RPC_INVALID");
    return client.rpc("inspect_planner_activity_history_trusted_v1", args as Record<string, unknown>);
  } } as unknown as SupabaseClient;
  return createActivityHistoryStore(inspectClient, client);
}

/** Platform maintenance, outside READ. Registered scopes are the registry;
 * no custom queue or persistent World. At most 64 scopes and two CAS attempts. */
export async function republishRegisteredActivityHistory(client: SupabaseClient) {
  const { data, error } = await client.rpc("registered_planner_activity_history_v1");
  if (error) throw error;
  if (!Array.isArray(data) || data.length > 64) throw new TypeError("SNAP_REGISTRY_INVALID");
  let published = 0, rejected = 0, alreadyFresh = 0;
  for (const value of data) {
    const prior = plannerRecord(value), householdId = parseHouseholdId(prior.householdId), userId = plannerUuid(prior.userId);
    const { data: household, error: householdError } = await client.from("households").select("household_id,timezone").eq("household_id", householdId).single();
    if (householdError) throw householdError;
    const [persons, periods, revision] = await Promise.all([getHouseholdPersons(client, householdId),getAnalysisPeriods(client, householdId),getHouseholdRevision(client, householdId)]);
    const asOf = parseInstant(new Date().toISOString()), timezone = parseHouseholdTimeZone(household.timezone);
    const today = Temporal.Instant.from(asOf).toZonedDateTimeISO(timezone).toPlainDate();
    const wasFuture = Temporal.PlainDate.from(String(prior.cutoffDate)).add({ days: 1 }).toString() === prior.endExclusive;
    const month = wasFuture ? today.toPlainYearMonth().add({ months: 1 }).toString() : String(prior.endExclusive).slice(0, 7);
    const context = createAuthorizedRuntimeContext({user:{id:userId},household:{householdId,timezone},persons,periods,revision},asOf);
    const repository = new CanonicalRepository(client, context), store = trustedActivityHistoryStore(client);
    const period = activityHistoryPeriod(context, month, asOf), scope = activityHistoryScope(repository, period.range, period.cutoffDate);
    if (admittedActivityHistory(scope, await store.inspect(scope,plannerDigest(scope)))) { alreadyFresh++; continue; }
    const result = await prepareRegisteredActivityHistory(repository,month,store);
    if (result.status === "STALE_REJECTED") rejected++; else published++;
  }
  return { registered: data.length, published, rejected, alreadyFresh };
}
