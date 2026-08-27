import { createHash, timingSafeEqual } from "node:crypto";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import {
  backfillAnalyticsMaterialization,
  DEFAULT_ANALYTICS_BACKFILL_MONTHS,
} from "@/server/analytics/materialization/backfill";
import { normalizeQueryRequest, type AnyNormalizedQueryRequest } from "@/query-api";
import { parseYearMonth, type YearMonth } from "@/core/time";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const allowedMonths = new Set<YearMonth>(DEFAULT_ANALYTICS_BACKFILL_MONTHS);
const operationalTokenHash = "2ded5a1f2c4dd8d9a634cf57425c59d4ea5fa7a542024e36e6a095e866298206";

function hasValidOperationalToken(request: Request): boolean {
  const token = request.headers.get("x-analytics-backfill-token");
  if (token === null) return false;
  const received = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(operationalTokenHash);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function contractError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const hasUserSession = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(cookieHeader);
  const hasOperationalToken = hasValidOperationalToken(request);
  if (!hasUserSession && !hasOperationalToken) {
    return contractError("Une autorisation serveur est requise.", 401);
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return contractError("Origine cross-site refusée.", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return contractError("Le corps JSON est invalide.");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return contractError("Le corps du backfill doit être un objet.");
  }
  const record = body as Record<string, unknown>;
  let month: YearMonth;
  let expectedRequestCount: number;
  let requests: readonly AnyNormalizedQueryRequest[];
  try {
    month = parseYearMonth(record.month);
    if (!allowedMonths.has(month)) {
      throw new TypeError("Le mois demandé est hors de la fenêtre certifiée.");
    }
    if (!Number.isInteger(record.expectedRequestCount)
      || Number(record.expectedRequestCount) < 1
      || Number(record.expectedRequestCount) > 256) {
      throw new TypeError("Le nombre de Queries certifiées est invalide.");
    }
    expectedRequestCount = Number(record.expectedRequestCount);
    if (!Array.isArray(record.requests)) {
      throw new TypeError("Le lot certifié de Queries est absent.");
    }
    requests = record.requests.map(normalizeQueryRequest);
    if (requests.length !== expectedRequestCount) {
      throw new TypeError("Le lot certifié ne correspond pas au cardinal attendu.");
    }
    if (requests.some(({ scope }) =>
      scope.time.kind !== "month" || scope.time.month !== month)) {
      throw new TypeError("Le lot certifié contient une Query hors mois.");
    }
  } catch (error) {
    return contractError(error instanceof Error ? error.message : "Lot certifié invalide.");
  }

  try {
    const client = createCanonicalReadClient();
    let householdId: unknown;
    if (hasOperationalToken) {
      const { data, error } = await client
        .from("households")
        .select("household_id")
        .limit(2);
      if (error !== null) throw error;
      if (data?.length !== 1) {
        return contractError("Le foyer opérationnel n'est pas déterministe.", 503);
      }
      householdId = data[0]!.household_id;
    } else {
      const bootstrap = await getBootstrapContext();
      if (bootstrap.household === null) {
        return contractError("Aucun foyer autorisé n'est disponible.", 403);
      }
      householdId = bootstrap.household.householdId;
    }
    const result = await backfillAnalyticsMaterialization({
      client,
      householdId,
      months: [month],
      requestsByMonth: new Map([[month, requests]]),
      expectedRequestCountByMonth: new Map([[month, expectedRequestCount]]),
    });
    return Response.json({
      ok: true,
      month,
      requestCount: expectedRequestCount,
      result: result[0],
    });
  } catch (error) {
    console.error("monthly_analytics_backfill_failed", {
      month,
      error: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown failure",
    });
    return contractError(
      error instanceof Error ? error.message : "Le backfill mensuel a échoué.",
      503,
    );
  }
}
