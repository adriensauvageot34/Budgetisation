import { createHash, timingSafeEqual } from "node:crypto";
import { normalizeQueryRequest, type AnyNormalizedQueryRequest } from "@/query-api";
import { parseYearMonth, type YearMonth } from "@/core/time";
import {
  backfillAnalyticsMaterialization,
  beginAnalyticsBackfillPublication,
  certifiedPayloadSha256,
  compareActiveBackfillSnapshots,
  DEFAULT_ANALYTICS_BACKFILL_MONTHS,
  executeReadOnlyBackfillDiagnostics,
  executeReadOnlyBackfillQuery,
  failAnalyticsBackfillPublication,
  finalizeAnalyticsBackfillPublication,
  stageAnalyticsBackfillPublication,
} from "@/server/analytics/materialization/backfill";
import { createCanonicalReadClient } from "@/server/canonical/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const allowedMonths = new Set<YearMonth>(DEFAULT_ANALYTICS_BACKFILL_MONTHS);
const operationalTokenHash = "20ae3cb03f9d4c58b84cd0222948d54aa989fd9aa491dec71d4a6aadecd5bfb6";

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
  let operation: "read_only" | "compare" | "publish" | "begin" | "stage" | "finalize";
  let month: YearMonth;
  let requests: readonly AnyNormalizedQueryRequest[] = [];
  let hashes: readonly string[] = [];
  let publicationId: string | undefined;
  try {
    operation = record.operation === "read_only" ? "read_only"
      : record.operation === "compare" ? "compare"
      : record.operation === "publish" ? "publish"
        : record.operation === "begin" ? "begin"
          : record.operation === "stage" ? "stage"
            : record.operation === "finalize" ? "finalize"
              : (() => { throw new TypeError("Opération inconnue."); })();
    month = parseYearMonth(record.month);
    if (!allowedMonths.has(month)) throw new TypeError("Mois hors fenêtre certifiée.");
    if (operation !== "finalize") {
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
    }
    if (operation === "stage" || operation === "finalize") {
      if (typeof record.publicationId !== "string"
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.publicationId)) {
        throw new TypeError("Publication draft invalide.");
      }
      publicationId = record.publicationId;
    }
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

    if (operation === "begin") {
      const createdPublicationId = await beginAnalyticsBackfillPublication({
        client,
        householdId,
        month,
        requests,
      });
      return Response.json({ ok: true, operation, month, publicationId: createdPublicationId });
    }

    if (operation === "stage") {
      try {
        const hashMatches = await stageAnalyticsBackfillPublication({
          client,
          householdId,
          publicationId: publicationId!,
          requests,
          expectedPayloadHashes: hashes,
        });
        return Response.json({ ok: true, operation, month, hashMatches });
      } catch (error) {
        await failAnalyticsBackfillPublication({ client, publicationId: publicationId! });
        throw error;
      }
    }

    if (operation === "finalize") {
      const result = await finalizeAnalyticsBackfillPublication({
        client,
        householdId,
        publicationId: publicationId!,
      });
      return Response.json({ ok: true, operation, month, result });
    }

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
      const diagnostics = await executeReadOnlyBackfillDiagnostics({
        client,
        householdId,
        request: requests[0]!,
      });
      const dataModel = execution.response.data as {
        readonly actual?: { readonly envelope?: { readonly value?: unknown; readonly support?: { readonly n?: unknown } } };
        readonly typical?: { readonly envelope?: { readonly value?: unknown } };
        readonly minimal?: { readonly envelope?: { readonly value?: unknown } };
      };
      return Response.json({
        ok: actualHash === hashes[0],
        operation,
        month,
        hashMatch: actualHash === hashes[0],
        expectedHash: hashes[0],
        actualHash,
        actual: dataModel.actual?.envelope?.value ?? null,
        actualSupportN: dataModel.actual?.envelope?.support?.n ?? null,
        typical: dataModel.typical?.envelope?.value ?? null,
        minimal: dataModel.minimal?.envelope?.value ?? null,
        diagnostics,
      });
    }

    if (operation === "compare") {
      const result = await compareActiveBackfillSnapshots({
        client,
        householdId,
        requests,
        expectedPayloadHashes: hashes,
      });
      return Response.json({ ok: result.mismatches.length === 0, operation, month, result });
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
