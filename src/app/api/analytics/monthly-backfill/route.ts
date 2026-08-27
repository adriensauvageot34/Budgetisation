import { createHash, timingSafeEqual } from "node:crypto";
import { normalizeQueryRequest, type AnyNormalizedQueryRequest } from "@/query-api";
import { parseYearMonth, type YearMonth } from "@/core/time";
import {
  backfillAnalyticsMaterialization,
  certifiedPayloadSha256,
  DEFAULT_ANALYTICS_BACKFILL_MONTHS,
  executeReadOnlyBackfillQuery,
} from "@/server/analytics/materialization/backfill";
import { createCanonicalReadClient } from "@/server/canonical/client";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

const allowedMonths = new Set<YearMonth>(DEFAULT_ANALYTICS_BACKFILL_MONTHS);
const operationalTokenHash = "47651591a74632aec28c473e7fe5a03c7bafa121f16315cae92814556581a279";

function authorized(request: Request): boolean {
  const token = request.headers.get("x-analytics-backfill-token");
  if (token === null) return false;
  const received = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(operationalTokenHash);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function failure(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  if (!authorized(request)) return failure("Autorisation serveur requise.", 401);
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return failure("Origine cross-site refusée.", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("Corps JSON invalide.");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return failure("Lot certifié invalide.");
  }

  const record = body as Record<string, unknown>;
  let operation: "read_only" | "publish";
  let month: YearMonth;
  let requests: readonly AnyNormalizedQueryRequest[];
  let hashes: readonly string[];
  try {
    operation = record.operation === "read_only" ? "read_only"
      : record.operation === "publish" ? "publish"
        : (() => { throw new TypeError("Opération inconnue."); })();
    month = parseYearMonth(record.month);
    if (!allowedMonths.has(month)) throw new TypeError("Mois hors fenêtre certifiée.");
    if (!Array.isArray(record.requests) || record.requests.length < 1 || record.requests.length > 256) {
      throw new TypeError("Queries certifiées absentes.");
    }
    requests = record.requests.map(normalizeQueryRequest);
    if (requests.some(({ scope }) => scope.time.kind !== "month" || scope.time.month !== month)) {
      throw new TypeError("Query hors mois certifié.");
    }
    if (!Array.isArray(record.hashes)
      || record.hashes.length !== requests.length
      || record.hashes.some((hash) => typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash))) {
      throw new TypeError("Hashes certifiés invalides.");
    }
    hashes = record.hashes as readonly string[];
    if (operation === "read_only" && (
      requests.length !== 1
      || requests[0]!.resource !== "analysis_month_initial"
      || requests[0]!.scope.subject.kind !== "household"
    )) {
      throw new TypeError("Le probe read-only doit cibler Analysis Month Initial household.");
    }
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Lot certifié invalide.");
  }

  try {
    const client = createCanonicalReadClient();
    const { data, error } = await client.from("households").select("household_id").limit(2);
    if (error !== null) throw error;
    if (data?.length !== 1) throw new TypeError("Foyer opérationnel non déterministe.");
    const householdId = data[0]!.household_id;

    if (operation === "read_only") {
      const execution = await executeReadOnlyBackfillQuery({
        client,
        householdId,
        request: requests[0]!,
      });
      if (!execution.ok) {
        throw new Error(`READ_ONLY:${execution.error.code}:${execution.error.message}`);
      }
      const actualHash = certifiedPayloadSha256(execution.response.data);
      if (actualHash !== hashes[0]) throw new TypeError("READ_ONLY:HASH_MISMATCH");
      const dataModel = execution.response.data as {
        readonly actual?: { readonly envelope?: { readonly value?: unknown } };
      };
      return Response.json({
        ok: true,
        operation,
        month,
        hashMatch: true,
        actual: dataModel.actual?.envelope?.value ?? null,
      });
    }

    const result = await backfillAnalyticsMaterialization({
      client,
      householdId,
      months: [month],
      requestsByMonth: new Map([[month, requests]]),
      expectedRequestCountByMonth: new Map([[month, requests.length]]),
      expectedPayloadHashesByMonth: new Map([[month, hashes]]),
      force: true,
    });
    return Response.json({ ok: true, operation, month, result: result[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown failure";
    console.error("certified_monthly_backfill_failed", { month, operation, message });
    return failure(message, 503);
  }
}
