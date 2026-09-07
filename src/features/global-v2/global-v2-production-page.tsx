"use client";

import { useMemo } from "react";
import type { GlobalV2UiTransport } from "./visit-runtime";
import { GlobalV2Page, type GlobalV2PageBundle } from "./global-v2-page";

export function GlobalV2ProductionPage({ bundle, certifiedThrough }: { readonly bundle: GlobalV2PageBundle; readonly certifiedThrough: string }) {
  const transport = useMemo<GlobalV2UiTransport>(() => async (request) => {
    const response = await fetch("/api/global-v2/query", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request, expectedGeneration: { publicationId: bundle.initial.publicationMeta.publicationId, analyticsRevision: bundle.initial.publicationMeta.revision } }),
    });
    const value = await response.json() as { readonly data?: unknown; readonly publicationMeta?: typeof bundle.initial.publicationMeta; readonly errorCode?: string };
    if (!response.ok || value.data === undefined || value.publicationMeta === undefined) throw new Error(value.errorCode ?? "GLOBAL_SNAPSHOT_READ_FAILED");
    return { data: value.data, publicationMeta: value.publicationMeta };
  }, [bundle.initial.publicationMeta]);
  return <GlobalV2Page bundle={bundle} transport={transport} certifiedThrough={certifiedThrough} />;
}
