import { NextResponse } from "next/server";
import { createGlobalV2ProductionRuntime, readGlobalV2ProductionSnapshot, readGlobalV2PersonaPanel } from "@/server/query/global-v2-production-loader";
import { globalV2PersonaPanelResource } from "@/query-api/global-v2/persona-panel";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { readonly request?: { readonly resource?: unknown; readonly params?: unknown }; readonly expectedGeneration?: { readonly publicationId?: unknown; readonly analyticsRevision?: unknown } };
    const runtime = await createGlobalV2ProductionRuntime();
    if (body.expectedGeneration?.publicationId !== runtime.generation.publicationId || body.expectedGeneration.analyticsRevision !== runtime.generation.analyticsRevision) {
      return NextResponse.json({ errorCode: "GENERATION_MISMATCH" }, { status: 409 });
    }
    const resource = body.request?.resource;
    const params = body.request?.params;
    if (resource === globalV2PersonaPanelResource
      && (!params || typeof params !== "object" || Array.isArray(params) || Object.keys(params).length !== 0)) {
      return NextResponse.json({ errorCode: "GLOBAL_PERSONA_PANEL_PARAMS_INVALID" }, { status: 400 });
    }
    const result = resource === globalV2PersonaPanelResource ? await readGlobalV2PersonaPanel(runtime)
      : await readGlobalV2ProductionSnapshot({ runtime, resource: resource as never, params: params as never });
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "GLOBAL_SNAPSHOT_READ_FAILED";
    return NextResponse.json({ errorCode }, { status: errorCode.includes("INVALID") ? 400 : 503 });
  }
}
