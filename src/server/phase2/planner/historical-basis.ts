import "server-only";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CanonicalRepository, type CanonicalDateRange } from "@/server/canonical/repository";
import type { PurchaseAwareEconomicFact } from "@/analytics/facts/purchase-aware";
import { plannerDigest, plannerInteger, plannerKeys, plannerRecord, canonicalPlannerJson } from "@/domain/phase2/planner/json";
import { activityHistoryScope, type ActivityHistoryScope } from "./activity-history-artifact";
import { activityHistoryPeriod } from "./activity-history-period";
import { snapshotHistoryTrace, snapshotWork } from "./snapshot-observation";

export const HISTORICAL_BASIS_METHOD = "composer-canonical-basis@v1";
export const HISTORICAL_BASIS_COVERAGE = "composer-canonical-writers@v1";
export type BasisPayload = Readonly<{ purchaseFacts: readonly PurchaseAwareEconomicFact[] }>;
export type BasisProof = Readonly<{ coverage: string; revision: string; schemaEpoch: string }>;
export type BasisArtifact = Readonly<{ scope: ActivityHistoryScope; proof: BasisProof; generation: number;
  status: "READY"; codec: "deflate-raw-json@1"; payload: string; payloadBytes: number; payloadDigest: string; digest: string }>;
export interface HistoricalBasisStore {
  inspect(scope: ActivityHistoryScope, key: string): Promise<{ proof: BasisProof | null; generation: number; artifact: unknown | null }>;
  publish(scope: ActivityHistoryScope, key: string, expected: number, artifact: BasisArtifact): Promise<boolean>;
}
export function createHistoricalBasisStore(reader: SupabaseClient, publisher?: SupabaseClient): HistoricalBasisStore {
  return { async inspect(scope, key) {
    const { data, error } = await reader.rpc("inspect_composer_historical_basis_v1", { p_scope: scope, p_key: key });
    if (error) throw error;
    const row = plannerRecord(data); plannerKeys(row, ["proof", "generation", "artifact"]);
    return { proof: row.proof as BasisProof | null, generation: plannerInteger(row.generation), artifact: row.artifact };
  }, async publish(scope, key, expected, artifact) {
    if (!publisher) throw new TypeError("BASIS_TRUSTED_PUBLISHER_REQUIRED");
    const { data, error } = await publisher.rpc("publish_composer_historical_basis_v1", {
      p_scope: scope, p_key: key, p_expected_generation: expected, p_artifact: artifact });
    if (error) throw error;
    if (typeof data !== "boolean") throw new TypeError("BASIS_RPC_INVALID");
    return data;
  } };
}
export function historicalBasisScope(repository: CanonicalRepository, range: CanonicalDateRange) {
  // The owner uses this exact historical range, not today's Draft or current day.
  // A closed range remains reusable tomorrow; any retroactive writer fences it.
  return activityHistoryScope(repository, range, range.endExclusive, HISTORICAL_BASIS_METHOD);
}
function validProof(value: unknown): value is BasisProof {
  if (!value || typeof value !== "object") return false;
  const p = value as BasisProof;
  return Object.keys(p).length === 3 && p.coverage === HISTORICAL_BASIS_COVERAGE
    && /^\d+$/u.test(p.revision) && /^\d+$/u.test(p.schemaEpoch);
}
function payload(value: unknown, scope: ActivityHistoryScope): BasisPayload {
  const p = plannerRecord(value); plannerKeys(p, ["purchaseFacts"]);
  if (!Array.isArray(p.purchaseFacts)) throw new TypeError("BASIS_PAYLOAD_INVALID");
  const keys = new Set<string>();
  for (const raw of p.purchaseFacts) {
    const fact = plannerRecord(raw);
    if (fact.fact !== "fct_purchase_aware_economic_component" || fact.householdId !== scope.householdId
      || typeof fact.canonicalComponentKey !== "string" || keys.has(fact.canonicalComponentKey)) throw new TypeError("BASIS_FACT_SCOPE_INVALID");
    keys.add(fact.canonicalComponentKey);
  }
  // This is an exact serialized owner output. Only the service publisher can
  // produce it; no client payload is accepted and no financial rule is rebuilt.
  return p as unknown as BasisPayload;
}
export function admittedHistoricalBasis(scope: ActivityHistoryScope, current: Awaited<ReturnType<HistoricalBasisStore["inspect"]>>): BasisPayload | null {
  if (!validProof(current.proof) || !current.artifact) return null;
  const a = plannerRecord(current.artifact);
  plannerKeys(a, ["scope", "proof", "generation", "status", "codec", "payload", "payloadBytes", "payloadDigest", "digest"]);
  const { digest, ...body } = a;
  if (digest !== plannerDigest(body) || plannerDigest(a.scope) !== plannerDigest(scope) || a.generation !== current.generation
    || a.status !== "READY" || a.codec !== "deflate-raw-json@1" || !validProof(a.proof)
    || typeof a.payload !== "string" || !Number.isSafeInteger(a.payloadBytes) || Number(a.payloadBytes) < 0
    || Number(a.payloadBytes) > 8 * 1024 * 1024) throw new TypeError("BASIS_ARTIFACT_INVALID");
  if (plannerDigest(a.proof) !== plannerDigest(current.proof)) return null;
  const decoded = inflateRawSync(Buffer.from(a.payload, "base64"), { maxOutputLength: 8 * 1024 * 1024 });
  if (decoded.byteLength !== a.payloadBytes) throw new TypeError("BASIS_PAYLOAD_SIZE_INVALID");
  const parsed = JSON.parse(decoded.toString("utf8"));
  if (plannerDigest(parsed) !== a.payloadDigest) throw new TypeError("BASIS_PAYLOAD_DIGEST_INVALID");
  return payload(parsed, scope);
}
export async function directCanonicalBasis(repository: CanonicalRepository, range: CanonicalDateRange): Promise<BasisPayload> {
  const canonical = await repository.loadPurchaseAwareCanonical(range, "PURCHASE_AWARE_PILOT");
  if (canonical.status !== "PASS") throw new TypeError("BASELINE_PURCHASE_OWNER_BLOCKED");
  return { purchaseFacts: canonical.facts.filter((f): f is PurchaseAwareEconomicFact => f.fact === "fct_purchase_aware_economic_component") };
}
/** Preparation alone proves completeness of non-paginated owner queries. Explicit
 * pagination and schema probes retain their original semantics. No HIT counts. */
export function completeBasisSourceClient(client: SupabaseClient): SupabaseClient {
  return new Proxy(client, { get(target, property) {
    if (property !== "from") return Reflect.get(target, property);
    return (table: string) => {
      let paged = false, limited = false;
      const wrap = (builder: object): object => new Proxy(builder, { get(object, name) {
        const member = Reflect.get(object, name);
        if (name === "then") return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(object).then(result => {
          const r = result as { error: unknown; data: unknown[] | null; count: number | null };
          if (!r.error && !paged && !limited && (!Number.isSafeInteger(r.count) || r.count !== r.data?.length))
            throw new TypeError("BASIS_SOURCE_INCOMPLETE");
          return result;
        }).then(resolve, reject);
        if (typeof member !== "function") return member;
        return (...args: unknown[]) => {
          if (name === "range") paged = true;
          if (name === "limit") limited = true;
          return wrap(Reflect.apply(member, object, name === "select" ? [args[0], { count: "exact" }] : args));
        };
      } });
      return wrap(target.from(table));
    };
  } });
}
export async function readHistoricalBasis(repository: CanonicalRepository, range: CanonicalDateRange, store?: HistoricalBasisStore): Promise<BasisPayload> {
  if (!store) return snapshotWork("Canonical_PurchaseAware", () => directCanonicalBasis(repository, range));
  const scope = historicalBasisScope(repository, range), at = performance.now();
  const current = await snapshotWork("HistoricalBasis_Admission", () => store.inspect(scope, plannerDigest(scope)));
  const validationMs = performance.now() - at, decodeAt = performance.now();
  const admitted = admittedHistoricalBasis(scope, current);
  if (admitted) {
    snapshotHistoryTrace({ status: "HIT", reason: "SNAP3_CANONICAL", validationMs, decodeMs: performance.now() - decodeAt });
    return admitted;
  }
  const directAt = performance.now(), result = await snapshotWork("Canonical_PurchaseAware", () => directCanonicalBasis(repository, range));
  snapshotHistoryTrace({ status: "MISS", reason: "SNAP3_ABSENT_OR_STALE", validationMs, directMs: performance.now() - directAt });
  return result;
}
export async function prepareHistoricalBasis(repository: CanonicalRepository, month: string, store: HistoricalBasisStore) {
  const at = performance.now(), { range } = activityHistoryPeriod(repository.context, month, repository.context.asOf);
  const scope = historicalBasisScope(repository, range), key = plannerDigest(scope), before = await store.inspect(scope, key);
  if (!validProof(before.proof)) throw new TypeError("BASIS_WRITERS_NOT_COVERED");
  // A fresh repository avoids reusing an earlier request result after inspection.
  const prepared = payload(await directCanonicalBasis(new CanonicalRepository(completeBasisSourceClient(repository.client), repository.context, { shareEconomicReads: true }), range), scope);
  const encoded = canonicalPlannerJson(prepared), bytes = Buffer.byteLength(encoded);
  if (bytes > 8 * 1024 * 1024) throw new TypeError("BASIS_PAYLOAD_TOO_LARGE");
  const body = { scope, proof: before.proof, generation: before.generation + 1, status: "READY" as const,
    codec: "deflate-raw-json@1" as const, payload: deflateRawSync(encoded).toString("base64"), payloadBytes: bytes, payloadDigest: plannerDigest(prepared) };
  const artifact = { ...body, digest: plannerDigest(body) };
  let recovered = false, accepted: boolean;
  try { accepted = await store.publish(scope, key, before.generation, artifact); }
  catch (error) {
    const check = await store.inspect(scope, key);
    if (check.generation !== artifact.generation || plannerRecord(check.artifact).digest !== artifact.digest) throw error;
    accepted = recovered = true; // recognize a lost response, never blindly republish
  }
  if (!accepted) return { status: "STALE_REJECTED", preparationMs: performance.now() - at };
  const current = await store.inspect(scope, key);
  if (!admittedHistoricalBasis(scope, current) || plannerRecord(current.artifact).digest !== artifact.digest)
    throw new TypeError("BASIS_COMMIT_RELECTURE_UNCONFIRMED");
  return { status: recovered ? "RECOVERED_COMMIT" : "PUBLISHED", generation: artifact.generation, digest: artifact.digest,
    preparationMs: performance.now() - at, payloadBytes: bytes, transferBytes: Buffer.byteLength(JSON.stringify(artifact)), facts: prepared.purchaseFacts.length };
}
