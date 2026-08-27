import { getBootstrapContext } from "@/server/bootstrap/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import {
  backfillAnalyticsMaterialization,
  DEFAULT_ANALYTICS_BACKFILL_MONTHS,
} from "@/server/analytics/materialization/backfill";
import { parseYearMonth, type YearMonth } from "@/core/time";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const allowedMonths = new Set<YearMonth>(DEFAULT_ANALYTICS_BACKFILL_MONTHS);

function contractError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (!/(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(cookieHeader)) {
    return contractError("Une session authentifiée est requise.", 401);
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
  } catch (error) {
    return contractError(error instanceof Error ? error.message : "Lot certifié invalide.");
  }

  try {
    const bootstrap = await getBootstrapContext();
    if (bootstrap.household === null) {
      return contractError("Aucun foyer autorisé n'est disponible.", 403);
    }
    const result = await backfillAnalyticsMaterialization({
      client: createCanonicalReadClient(),
      householdId: bootstrap.household.householdId,
      months: [month],
      requestProfile: "certified",
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
    });
    return contractError("Le backfill mensuel a échoué.", 503);
  }
}
