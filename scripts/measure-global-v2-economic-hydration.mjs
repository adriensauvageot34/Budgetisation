import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";
import Module, { createRequire } from "node:module";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const root = process.cwd();
const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
Module._load = function loadEconomicHydrationModule(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolveEconomicHydrationModule(request, parent, isMain, options) {
  const target = request.startsWith("@/") ? path.resolve(root, "src", request.slice(2)) : request;
  try { return originalResolve.call(this, target, parent, isMain, options); } catch (error) {
    if (path.extname(target)) throw error;
    for (const candidate of [`${target}.ts`, path.join(target, "index.ts")]) {
      try { return originalResolve.call(this, candidate, parent, isMain, options); } catch { /* next */ }
    }
    throw error;
  }
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, "utf8"),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  },
).outputText, filename);

const args = new Map(process.argv.slice(2).map((entry) => {
  const separator = entry.indexOf("=");
  return separator < 0 ? [entry, ""] : [entry.slice(0, separator), entry.slice(separator + 1)];
}));
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const asOf = args.get("--as-of");
if (!url || !key || !/^\d{4}-\d{2}-\d{2}T/u.test(asOf ?? "")) {
  throw new TypeError("Usage: --as-of=<Instant> with server-only Supabase credentials.");
}

const counters = { queryCount: 0, rowsFetched: 0, queriesByTable: {}, rowsByTable: {} };
const nativeFetch = globalThis.fetch;
const instrumentedFetch = async (input, init) => {
  const response = await nativeFetch(input, init);
  const requestUrl = typeof input === "string" ? input : input.url;
  if (requestUrl.includes("/rest/v1/")) {
    const table = new URL(requestUrl).pathname.split("/rest/v1/")[1]?.split("/")[0] ?? "unknown";
    counters.queryCount += 1;
    counters.queriesByTable[table] = (counters.queriesByTable[table] ?? 0) + 1;
    try {
      const body = await response.clone().json();
      const rows = Array.isArray(body) ? body.length : body === null ? 0 : 1;
      counters.rowsFetched += rows;
      counters.rowsByTable[table] = (counters.rowsByTable[table] ?? 0) + rows;
    } catch {
      // Empty/error response bodies count as a query but carry no returned rows.
    }
  }
  return response;
};
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: instrumentedFetch },
});

let householdId = args.get("--household-id");
if (householdId === undefined) {
  const { data, error } = await client
    .from("canonical_household_scope_control")
    .select("household_id,status")
    .eq("status", "READY")
    .limit(2);
  if (error !== null || data?.length !== 1) throw new TypeError("GLOBAL_HOUSEHOLD_SCOPE_NOT_UNIQUE");
  householdId = data[0].household_id;
}

const { createGlobalV2CandidateContext } = require(path.resolve(root, "src/server/analytics/global-v2-production-orchestrator.ts"));
const { CanonicalRepository } = require(path.resolve(root, "src/server/canonical/repository.ts"));
const { FactSourceResolver } = require(path.resolve(root, "src/server/analytics/fact-source-resolver.ts"));
const { resolveGlobalM1HouseholdAuthority } = require(path.resolve(root, "src/server/analytics/global-v2-economic-authority.ts"));
const { resolveGlobalM2HouseholdAuthority } = require(path.resolve(root, "src/server/analytics/global-v2-category-needs-authority.ts"));

const context = await createGlobalV2CandidateContext({ client, householdId, asOf });
const eligiblePeriods = context.periods.filter((period) =>
  period.isClosed
  && period.month <= context.asOf.slice(0, 10)
  && period.financeStatus !== "unknown"
  && period.lifeStatus !== "unknown"
  && period.calendarStatus !== "unknown")
  .sort((left, right) => left.month.localeCompare(right.month));
const targetMonth = eligiblePeriods.at(-1)?.month.slice(0, 7);
if (targetMonth === undefined) throw new TypeError("GLOBAL_CERTIFIED_THROUGH_MISSING");

counters.queryCount = 0;
counters.rowsFetched = 0;
counters.queriesByTable = {};
counters.rowsByTable = {};
const repository = new CanonicalRepository(client, context);
const resolver = new FactSourceResolver(repository);
const m1Started = performance.now();
await resolveGlobalM1HouseholdAuthority({ repository, resolver, targetMonth });
const m1BuildMs = performance.now() - m1Started;
const m1 = {
  queryCount: counters.queryCount,
  rowsFetched: counters.rowsFetched,
  buildMs: m1BuildMs,
  queriesByTable: { ...counters.queriesByTable },
  rowsByTable: { ...counters.rowsByTable },
};

const m2StartedAtQueries = counters.queryCount;
const m2StartedAtRows = counters.rowsFetched;
const m2Started = performance.now();
await resolveGlobalM2HouseholdAuthority({ repository, resolver, targetMonth });
const m2BuildMs = performance.now() - m2Started;
const m2Incremental = {
  queryCount: counters.queryCount - m2StartedAtQueries,
  rowsFetched: counters.rowsFetched - m2StartedAtRows,
  buildMs: m2BuildMs,
};

process.stdout.write(`${JSON.stringify({
  targetMonth,
  closureScope: {
    start: `${context.periods.filter(({ month }) => month.slice(0, 7) <= targetMonth).sort((a, b) => a.month.localeCompare(b.month))[0]?.month.slice(0, 7) ?? targetMonth}-01`,
    endExclusive: `${Number(targetMonth.slice(5, 7)) === 12 ? Number(targetMonth.slice(0, 4)) + 1 : targetMonth.slice(0, 4)}-${String(Number(targetMonth.slice(5, 7)) % 12 + 1).padStart(2, "0")}-01`,
  },
  m1,
  m2IncrementalSharedClosure: m2Incremental,
  m1M2Total: { queryCount: counters.queryCount, rowsFetched: counters.rowsFetched, buildMs: m1BuildMs + m2BuildMs },
}, null, 2)}\n`);
