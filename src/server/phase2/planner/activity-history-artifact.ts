import "server-only";
import { performance } from "node:perf_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseActivityOccurrenceFact, parseActivityCausalFinancialLinks } from "@/analytics/facts";
import type { CanonicalDateRange } from "@/server/canonical/repository";
import { CanonicalRepository } from "@/server/canonical/repository";
import { parseLocalDate, createHouseholdTimeZoneValidationScope } from "@/core/time";
import { plannerDigest, plannerKeys, plannerRecord, plannerUuid } from "@/domain/phase2/planner/json";
import type { PlanningBaselineSources } from "./baseline-sources";

export const ACTIVITY_HISTORY_METHOD = "canonical-activity-projection@snap1-v1";
export const ACTIVITY_HISTORY_DEPENDENCIES = ["life_events", "life_event_types", "life_event_participations", "life_event_financial_links", "authorization_scope"] as const;
// This attestation is deliberately restricted to the isolated implementation.
// Generic household_revisions / record_analytics_mutation do not prove writer coverage.
export const ACTIVITY_HISTORY_COVERAGE = "snap1-isolated-always-triggers@v1";
export const ACTIVITY_HISTORY_DURABLE_COVERAGE = "canonical-activity-transactional-triggers@v2";
export type ActivityHistory = NonNullable<PlanningBaselineSources["simpleOccurrences"]>;
export type ActivityHistoryScope = Readonly<{ userId: string; householdId: string; personIds: readonly string[];
  timezone: string; start: string; endExclusive: string; cutoffDate: string; contract: string; method: string; schema: 1 }>;
export type ActivityHistoryProof = Readonly<{ coverage: string; revisions: Readonly<Record<string, string>> }>;
export type ActivityHistoryArtifact = Readonly<{ scope: ActivityHistoryScope; proof: ActivityHistoryProof;
  generation: number; status: "READY"; coverage: "COMPLETE_SOURCE_ROWS"; provenance: readonly string[];
  payload: ActivityHistory; digest: string }>;
/** Trusted server adapter only. inspect must freshly authorize user/household/persons
 * and atomically read dependency versions + artifact in one database snapshot.
 * publish must lock the same version rows as all source writers, freshly authorize,
 * and compare BOTH versions and expected artifact generation before publishing.
 * No production adapter is supplied until writer coverage is certified. */
export interface ActivityHistoryStore {
  trace?: ActivityHistoryTrace;
  inspect(scope: ActivityHistoryScope, key: string): Promise<Readonly<{ proof: ActivityHistoryProof | null;
    generation: number; artifact: unknown | null }>>;
  publish(scope: ActivityHistoryScope, key: string, expectedGeneration: number, artifact: ActivityHistoryArtifact): Promise<boolean>;
}
export type ActivityHistoryTrace = (event: Readonly<{ status: "HIT" | "MISS" | "OFF" | "PUBLISHED" | "PUBLICATION_REJECTED";
  validationMs?: number; decodeMs?: number; directMs?: number; preparationMs?: number; reason?: string }>) => void;

export function activityHistoryScope(repository: CanonicalRepository, range: CanonicalDateRange, cutoffDate: string,
  method = ACTIVITY_HISTORY_METHOD): ActivityHistoryScope {
  return { userId: plannerUuid(repository.context.userId), householdId: plannerUuid(repository.context.householdId),
    personIds: repository.context.personIds.map(plannerUuid).sort(), timezone: repository.context.timezone,
    start: parseLocalDate(range.start), endExclusive: parseLocalDate(range.endExclusive), cutoffDate: parseLocalDate(cutoffDate),
    contract: String(repository.context.contractVersion), method, schema: 1 };
}
const keyOf = (scope: ActivityHistoryScope) => plannerDigest(scope);
function covered(proof: unknown): proof is ActivityHistoryProof {
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) return false;
  const value = proof as ActivityHistoryProof;
  return [ACTIVITY_HISTORY_COVERAGE, ACTIVITY_HISTORY_DURABLE_COVERAGE].includes(value.coverage) && !!value.revisions && typeof value.revisions === "object"
    && Object.keys(value).length === 2 && Object.keys(value.revisions).length === ACTIVITY_HISTORY_DEPENDENCIES.length
    && ACTIVITY_HISTORY_DEPENDENCIES.every(name => typeof value.revisions[name] === "string" && /^(0|[1-9]\d*)$/u.test(value.revisions[name]));
}
export async function readDirectActivityHistory(repository: CanonicalRepository, range: CanonicalDateRange): Promise<ActivityHistory> {
  const occurrences = await repository.loadActivityOccurrences(range);
  return { occurrences, links: parseActivityCausalFinancialLinks(
    await repository.loadActivityCausalFinancialLinkRows(occurrences.map(fact => fact.lifeEventId))) };
}
export function decodeActivityHistoryPayload(value: unknown, scope: ActivityHistoryScope): ActivityHistory {
  const payload = plannerRecord(value); plannerKeys(payload, ["occurrences", "links"]);
  if (!Array.isArray(payload.occurrences) || !Array.isArray(payload.links)) throw new TypeError("ACTIVITY_ARTIFACT_PAYLOAD_INVALID");
  const timeZoneValidation = createHouseholdTimeZoneValidationScope(scope.householdId);
  const occurrences = payload.occurrences.map(value => parseActivityOccurrenceFact(value, timeZoneValidation));
  const ids = new Set(occurrences.map(f => f.lifeEventId));
  if (ids.size !== occurrences.length || occurrences.some(f => f.householdId !== scope.householdId
    || f.householdTimeZone !== scope.timezone || f.startDate >= scope.endExclusive || f.endDate < scope.start
    || f.participantIds.some(id => !scope.personIds.includes(id)))) throw new TypeError("ACTIVITY_ARTIFACT_SCOPE_INVALID");
  // Decode via the owner's original parser; do not invent a second cost model.
  const links = payload.links.map(value => {
    const link = plannerRecord(value); plannerKeys(link, ["financialLinkId", "lifeEventId", "canonicalComponentKey", "relationType", "economicAmountLinked"]);
    if (typeof link.canonicalComponentKey !== "string") throw new TypeError("ACTIVITY_ARTIFACT_LINK_INVALID");
    const split = link.canonicalComponentKey.indexOf(":"), kind = link.canonicalComponentKey.slice(0, split), id = link.canonicalComponentKey.slice(split + 1);
    const parsed = parseActivityCausalFinancialLinks([{ financial_link_id: link.financialLinkId, life_event_id: link.lifeEventId,
      source_kind: ({ operation: "Operation", allocation: "Allocation", item: "Item", cash_use: "Cash_use" } as Record<string, string>)[kind] ?? "",
      operation_id: kind === "operation" ? id : null, allocation_id: kind === "allocation" ? id : null,
      item_id: kind === "item" ? id : null, cash_use_id: kind === "cash_use" ? id : null,
      relation_type: link.relationType, economic_amount_linked: link.economicAmountLinked, validation_status: "Confirmé" }]);
    if (parsed.length !== 1 || !ids.has(parsed[0].lifeEventId) || plannerDigest(parsed[0]) !== plannerDigest(link))
      throw new TypeError("ACTIVITY_ARTIFACT_LINK_INVALID");
    return parsed[0];
  });
  return { occurrences, links };
}

export async function readActivityHistory(repository: CanonicalRepository, range: CanonicalDateRange, cutoffDate: string,
  store?: ActivityHistoryStore, trace?: ActivityHistoryTrace): Promise<ActivityHistory> {
  trace ??= store?.trace;
  if (process.env.COMPOSER_P14_SNAP1_ACTIVITY_HISTORY !== "1" || !store) {
    trace?.({ status: "OFF" }); return readDirectActivityHistory(repository, range);
  }
  const scope = activityHistoryScope(repository, range, cutoffDate), start = performance.now();
  const current = await store.inspect(scope, keyOf(scope)); // errors/denials propagate; never a successful fallback
  const validationMs = performance.now() - start;
  let reason = !covered(current.proof) ? "DEPENDENCY_COVERAGE_UNAVAILABLE" : "ABSENT";
  if (covered(current.proof) && current.artifact !== null) {
    const at = performance.now(), payload = admittedActivityHistory(scope, current);
    if (payload) {
      trace?.({ status: "HIT", validationMs, decodeMs: performance.now() - at }); return payload;
    }
    reason = "SOURCE_VERSION_CHANGED";
  }
  const direct = performance.now(), result = await readDirectActivityHistory(repository, range);
  trace?.({ status: "MISS", reason, validationMs, directMs: performance.now() - direct }); return result;
}

/** Same strict admission for status/maintenance and the financial reader. */
export function admittedActivityHistory(scope: ActivityHistoryScope, current: Readonly<{
  proof: ActivityHistoryProof | null; generation: number; artifact: unknown | null }>): ActivityHistory | null {
  if (covered(current.proof) && current.artifact !== null) {
    const artifact = plannerRecord(current.artifact);
    plannerKeys(artifact, ["scope", "proof", "generation", "status", "coverage", "provenance", "payload", "digest"]);
    const { digest, ...body } = artifact;
    if (digest !== plannerDigest(body) || !covered(artifact.proof) || artifact.status !== "READY" || artifact.coverage !== "COMPLETE_SOURCE_ROWS"
      || artifact.generation !== current.generation || !Number.isSafeInteger(artifact.generation) || Number(artifact.generation) < 1
      || plannerDigest(artifact.scope) !== plannerDigest(scope)
      || plannerDigest(artifact.provenance) !== plannerDigest(ACTIVITY_HISTORY_DEPENDENCIES.slice(0, 4)))
      throw new TypeError("ACTIVITY_ARTIFACT_CORRUPT_OR_INCOMPATIBLE");
    if (plannerDigest(artifact.proof) === plannerDigest(current.proof)) {
      return decodeActivityHistoryPayload(artifact.payload, scope);
    }
  }
  return null;
}

/** Preparation deliberately uses a FRESH repository and exact source counts.
 * These owner reads are unpaged; count != rows returned (even exactly 1000)
 * prevents publication. Counts run only at preparation, never on a HIT. */
function completeSourceClient(client: SupabaseClient): SupabaseClient {
  return new Proxy(client, { get(target, property) {
    if (property !== "from") return Reflect.get(target, property);
    return (table: string) => {
      const query = target.from(table);
      if (!(ACTIVITY_HISTORY_DEPENDENCIES as readonly string[]).slice(0, 4).includes(table)) return query;
      const wrap = (builder: unknown): unknown => new Proxy(builder as object, { get(object, name) {
        const member = Reflect.get(object, name);
        if (name === "then") return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve(object).then(result => {
            const response = result as { error: unknown; data: unknown[] | null; count: number | null };
            if (!response.error && (!Number.isSafeInteger(response.count) || response.count !== response.data?.length))
              throw new TypeError("ACTIVITY_ARTIFACT_INCOMPLETE_SOURCE");
            return result;
          }).then(resolve, reject);
        if (typeof member !== "function") return member;
        return (...args: unknown[]) => wrap(Reflect.apply(member, object,
          name === "select" ? [args[0], { count: "exact" }] : args));
      } });
      return wrap(query);
    };
  } });
}
export async function prepareActivityHistory(repository: CanonicalRepository, range: CanonicalDateRange, cutoffDate: string,
  store: ActivityHistoryStore, trace?: ActivityHistoryTrace): Promise<boolean> {
  const start = performance.now(), scope = activityHistoryScope(repository, range, cutoffDate), key = keyOf(scope);
  const before = await store.inspect(scope, key);
  if (!covered(before.proof)) throw new TypeError("ACTIVITY_ARTIFACT_WRITERS_NOT_COVERED");
  const strictRepository = new CanonicalRepository(completeSourceClient(repository.client), repository.context);
  const payload = decodeActivityHistoryPayload(await readDirectActivityHistory(strictRepository, range), scope);
  const body = { scope, proof: before.proof, generation: before.generation + 1, status: "READY" as const,
    coverage: "COMPLETE_SOURCE_ROWS" as const, provenance: ACTIVITY_HISTORY_DEPENDENCIES.slice(0, 4), payload };
  const accepted = await store.publish(scope, key, before.generation, { ...body, digest: plannerDigest(body) });
  trace?.({ status: accepted ? "PUBLISHED" : "PUBLICATION_REJECTED", preparationMs: performance.now() - start });
  return accepted;
}
