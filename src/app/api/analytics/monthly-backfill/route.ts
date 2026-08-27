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
const allowedResources = new Set([
  "analysis_month_initial",
  "analysis_month_breakdown",
  "analysis_month_evolution",
  "analysis_month_structure",
  "analysis_month_lived",
  "analysis_month_moments",
  "analysis_month_contexts",
  "analysis_target",
  "history_calendar_month",
  "history_calendar_month_summary",
  "history_day_detail",
]);

function contractError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

function parseCertifiedRequests(
  month: YearMonth,
  value: unknown,
): readonly AnyNormalizedQueryRequest[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 256) {
    throw new TypeError("Le lot certifié doit contenir entre 1 et 256 Queries.");
  }
  const requests = value.map((candidate) => normalizeQueryRequest(candidate));
  const signatures = new Set<string>();
  for (const request of requests) {
    if (!allowedResources.has(request.resource)) {
      throw new TypeError(`La ressource ${request.resource} n'est pas éligible au backfill mensuel.`);
    }
    if (request.scope.time.kind !== "month" || request.scope.time.month !== month) {
      throw new TypeError("Toutes les Queries doivent appartenir exactement au mois demandé.");
    }
    const signature = JSON.stringify(request);
    if (signatures.has(signature)) {
      throw new TypeError("Le lot certifié contient une Query dupliquée.");
    }
    signatures.add(signature);
  }
  return requests;
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
  let requests: readonly AnyNormalizedQueryRequest[];
  try {
    month = parseYearMonth(record.month);
    if (!allowedMonths.has(month)) {
      throw new TypeError("Le mois demandé est hors de la fenêtre certifiée.");
    }
    requests = parseCertifiedRequests(month, record.requests);
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
      requestsByMonth: new Map([[month, requests]]),
    });
    return Response.json({
      ok: true,
      month,
      requestCount: requests.length,
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
