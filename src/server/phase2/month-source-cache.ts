import "server-only";

import { gunzipSync, gzipSync } from "node:zlib";
import { getCache } from "@vercel/functions";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonths, parseInstant, parseLocalDate, parseYearMonth } from "@/core/time";
import { plannerDigest } from "@/domain/phase2/planner/json";
import { createAuthorizedRuntimeContext } from "@/server/canonical/context";
import { activityHistoryScope } from "./planner/activity-history-artifact";
import { createHistoricalBasisStore, HISTORICAL_BASIS_METHOD, HISTORICAL_BASIS_SHARED_COVERAGE, validBasisProof } from "./planner/historical-basis";

export type MonthSourceCache = {
  read<T>(source: string, readLive: () => Promise<T>, readAdditionalRevision?: () => Promise<string | null>): Promise<T>;
};

class SkipCacheWrite extends Error {
  #value: unknown;
  constructor(value: unknown) {
    super("MONTH_SOURCE_NOT_CACHEABLE");
    this.#value = value;
  }
  get value() { return this.#value; }
}

async function readSharedProjection<T>(key: string, readLive: () => Promise<T>, isCurrent: () => Promise<boolean>) {
  // The page and route handler must use the same key across independently compiled functions.
  const cache = getCache({ namespace: "budgetisation:composer-month-projection:v1", keyHashFunction: digest => digest });
  try {
    const packed = await cache.get(key);
    if (typeof packed === "string") {
      return JSON.parse(gunzipSync(Buffer.from(packed, "base64")).toString("utf8")) as T;
    }
  } catch { /* A cache failure falls back to the live projection. */ }

  const value = await readLive();
  if (await isCurrent()) {
    const packed = gzipSync(JSON.stringify(value)).toString("base64");
    if (packed.length <= 1_500_000) {
      await cache.set(key, packed, { ttl: 1800, name: "Composer monthly projection" }).catch(() => {});
    }
  }
  return value;
}

export function createMonthSourceCache(sessionClient: SupabaseClient, bootstrap: Parameters<typeof createAuthorizedRuntimeContext>[0],
  month: string): MonthSourceCache {
  if (!bootstrap.household || !bootstrap.revision) return { read: (_source, readLive) => readLive() };
  const context = createAuthorizedRuntimeContext(bootstrap, parseInstant(new Date().toISOString()));
  const targetMonth = parseYearMonth(month);
  const range = { start: parseLocalDate(`${targetMonth}-01`), endExclusive: parseLocalDate(`${addMonths(targetMonth, 1)}-01`) };
  const scope = activityHistoryScope({ context }, range, range.endExclusive, HISTORICAL_BASIS_METHOD);
  const scopeKey = plannerDigest(scope);
  const store = createHistoricalBasisStore(sessionClient);

  async function readRevision() {
    try {
      // This authenticated RPC checks membership, the person scope and canonical writer coverage.
      const { proof } = await store.inspect(scope, scopeKey);
      return validBasisProof(proof) && proof.coverage === HISTORICAL_BASIS_SHARED_COVERAGE ? plannerDigest(proof) : null;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error
        && ["42501", "PGRST301", "PGRST302"].includes(String(error.code))) throw error;
      // Keep the live read available when the cache's version proof is unavailable.
      return null;
    }
  }

  let admission: ReturnType<typeof readRevision> | undefined;
  return {
    async read<T>(source: string, readLive: () => Promise<T>, readAdditionalRevision?: () => Promise<string | null>): Promise<T> {
      const proof = async (basis: Promise<string | null>) => {
        if (!readAdditionalRevision) return basis;
        const [revision, extra] = await Promise.all([basis, readAdditionalRevision().catch(() => null)]);
        return revision && extra ? plannerDigest({ revision, extra }) : null;
      };
      const revision = await proof(admission ??= readRevision());
      if (!revision) return readLive();
      const key = plannerDigest({ source, scopeKey, revision, data: context.dataRevision, analytics: context.analyticsRevision,
        deploy: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
        project: process.env.SUPABASE_URL ?? "" });
      if (readAdditionalRevision) return readSharedProjection(key, readLive, async () => await proof(readRevision()) === revision);
      try {
        return await unstable_cache(async () => {
          const value = await readLive();
          // An import or correction committed during the read must never populate an older cache key.
          if (await proof(readRevision()) !== revision || Buffer.byteLength(JSON.stringify(value)) > 1_500_000) {
            throw new SkipCacheWrite(value);
          }
          return value;
        }, ["composer-month-sources-v1", key], { revalidate: 1800 })();
      } catch (error) {
        if (error instanceof SkipCacheWrite) return error.value as T;
        throw error;
      }
    },
  };
}
