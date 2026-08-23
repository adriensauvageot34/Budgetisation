import { NextResponse } from "next/server";
import { createApiError } from "@/core/api";
import { BootstrapAuthenticationRequiredError } from "@/server/bootstrap/errors";
import { executeAuthenticatedQuery } from "@/server/query/runtime";

export const dynamic = "force-dynamic";

function unauthenticatedResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: createApiError({
        code: "PERMISSION_DENIED",
        message: "Une session authentifiée est requise.",
        retryable: false,
        requestId: crypto.randomUUID(),
      }),
    },
    { status: 401 },
  );
}

export async function POST(request: Request) {
  // L'application s'authentifie par cookies Supabase. Ce garde évite tout
  // accès aux dépendances de données pour une requête manifestement anonyme.
  const cookieHeader = request.headers.get("cookie") ?? "";
  const hasSupabaseSessionCookie = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(cookieHeader);
  if (!hasSupabaseSessionCookie) return unauthenticatedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "CONTRACT_MISMATCH",
          message: "Le corps JSON de la Query est invalide.",
          retryable: false,
          requestId: crypto.randomUUID(),
        },
      },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await executeAuthenticatedQuery(body);
  } catch (error) {
    const requestId = crypto.randomUUID();
    const authenticationRequired = error instanceof BootstrapAuthenticationRequiredError;
    return NextResponse.json(
      {
        ok: false,
        error: createApiError({
          code: authenticationRequired ? "PERMISSION_DENIED" : "TEMPORARY_UNAVAILABLE",
          message: authenticationRequired
            ? "Une session authentifiée est requise."
            : "Le contexte Query est temporairement indisponible.",
          retryable: !authenticationRequired,
          requestId,
        }),
      },
      { status: authenticationRequired ? 401 : 503 },
    );
  }
  const status = result.ok
    ? 200
    : result.error.code === "PERMISSION_DENIED"
      ? 403
      : result.error.code === "NOT_FOUND"
        ? 404
        : result.error.code === "INVALID_SCOPE" ||
            result.error.code === "CONTRACT_MISMATCH"
          ? 400
          : 503;
  return NextResponse.json(result, { status });
}
