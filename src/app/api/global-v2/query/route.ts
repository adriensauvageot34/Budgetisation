import { NextResponse } from "next/server";
import { createGlobalV2ProductionRuntime, readGlobalV2ProductionSnapshot } from "@/server/query/global-v2-production-loader";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { readonly request?: { readonly resource?: unknown; readonly params?: unknown }; readonly expectedGeneration?: { readonly publicationId?: unknown; readonly analyticsRevision?: unknown } };
    const runtime = await createGlobalV2ProductionRuntime();
    if (body.expectedGeneration?.publicationId !== runtime.generation.publicationId || body.expectedGeneration.analyticsRevision !== runtime.generation.analyticsRevision) {
      return NextResponse.json({ errorCode: "GENERATION_MISMATCH" }, { status: 409 });
    }
    const result = await readGlobalV2ProductionSnapshot({ runtime, resource: body.request?.resource as never, params: body.request?.params as never });
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "GLOBAL_SNAPSHOT_READ_FAILED";
    return NextResponse.json({ errorCode }, { status: errorCode.includes("INVALID") ? 400 : 503 });
  }
}
