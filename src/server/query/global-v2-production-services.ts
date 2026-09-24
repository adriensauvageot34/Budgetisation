import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GlobalScopeValidationContext } from "@/core/global-v2";
import {
  globalV2AcceptedQueryMethodSignatures,
  globalV2QueryRegistry,
  globalV2TimelineMethodForSchema,
  parseGlobalV2QueryRequest,
  type GlobalReadModelPublicationMeta,
  type GlobalV2QueryRequest,
  type NormalizedGlobalV2QueryRequest,
} from "@/query-api/global-v2";
import type { AuthorizedRuntimeContext } from "@/server/canonical/context";
import { globalV2QueryInstanceKey } from "@/server/analytics/materialization/global-query-plan";
import type { GlobalV2QueryRuntimeServices, GlobalV2StoredSnapshot } from "./global-v2-runtime";

export type ActiveGlobalV2Generation = {
  readonly publicationId: string;
  readonly analyticsRevision: number;
  readonly scope: GlobalV2QueryRequest["scope"];
  readonly publicationMeta: GlobalReadModelPublicationMeta;
  readonly requiredQueryKeys: readonly string[];
};

export type GlobalV2ProductionSnapshotRequest = Pick<GlobalV2QueryRequest, "resource" | "params">;

export function createGlobalV2ProductionQueryServices(input: {
  readonly client: SupabaseClient;
  readonly context: AuthorizedRuntimeContext;
  readonly generation: ActiveGlobalV2Generation;
}): GlobalV2QueryRuntimeServices & { readonly primeSnapshotRows: (requests: readonly GlobalV2ProductionSnapshotRequest[]) => Promise<void> } {
  const scopeValidationContext: GlobalScopeValidationContext = { householdTimeZone: input.context.timezone, authorizedPersonIds: input.context.personIds };
  type SnapshotRow = {
    readonly query_key: string;
    readonly resource: string;
    readonly contract_version: string;
    readonly method_signature: string;
    readonly payload: unknown;
    readonly publication_id: string;
    readonly is_active: boolean;
    readonly invalidated_at: string | null;
  };
  const primed = new Map<string, SnapshotRow | undefined>();
  const stored = (data: SnapshotRow | undefined, request: NormalizedGlobalV2QueryRequest, cacheKey: string): GlobalV2StoredSnapshot | undefined => {
    if (data === undefined) return undefined;
    const payload = data.payload as { readonly publicationMeta: GlobalReadModelPublicationMeta; readonly resourceMeta: { readonly methodSignature: string; readonly resourceInputHash: string; readonly policyVersions: Readonly<Record<string, string>> } };
    const contract = globalV2QueryRegistry[request.resource];
    return {
      queryKey: cacheKey,
      resource: request.resource,
      contractVersion: data.contract_version,
      methodVersion: request.resource === "analysis_global_life_timeline"
        ? globalV2TimelineMethodForSchema(data.payload !== null && typeof data.payload === "object" && "schemaVersion" in data.payload ? data.payload.schemaVersion : undefined)?.methodVersion ?? contract.methodVersion
        : contract.methodVersion,
      methodSignature: data.method_signature,
      resourceInputHash: payload.resourceMeta.resourceInputHash,
      policyVersions: payload.resourceMeta.policyVersions,
      factsHash: payload.publicationMeta.factsHash,
      manifestHash: payload.publicationMeta.manifestHash,
      publicationId: data.publication_id,
      analyticsRevision: payload.publicationMeta.revision,
      active: data.is_active === true,
      invalidated: data.invalidated_at !== null,
      manifestComplete: input.generation.requiredQueryKeys.includes(data.query_key),
      signatureCompatible: globalV2AcceptedQueryMethodSignatures(request.resource).includes(data.method_signature),
      data: data.payload,
    };
  };
  return {
    scopeValidationContext,
    authorize: (request) => request.scope.subject.kind === "household" && request.expectedGeneration.publicationId === input.generation.publicationId && request.expectedGeneration.analyticsRevision === input.generation.analyticsRevision,
    primeSnapshotRows: async (requests: readonly GlobalV2ProductionSnapshotRequest[]) => {
      if (requests.length === 0) return;
      if (requests.length > 24) throw new TypeError("GLOBAL_PERSONA_OWNER_BATCH_LIMIT");
      const queryKeys = [...new Set(requests.map(({ resource, params }) => {
        const request = parseGlobalV2QueryRequest({
          resource, params, scope: input.generation.scope,
          expectedGeneration: { publicationId: input.generation.publicationId, analyticsRevision: input.generation.analyticsRevision },
        }, scopeValidationContext);
        return globalV2QueryInstanceKey(request.resource, request.scopeHash, request.params, input.generation.publicationId);
      }))];
      const { data, error } = await input.client.from("analytics_query_snapshots")
        .select("query_key,resource,contract_version,method_signature,payload,publication_id,is_active,invalidated_at")
        .eq("publication_id", input.generation.publicationId)
        .in("query_key", queryKeys);
      if (error !== null) throw error;
      const rows = new Map((data ?? []).map((row) => [row.query_key, row as SnapshotRow]));
      for (const queryKey of queryKeys) primed.set(queryKey, rows.get(queryKey));
    },
    readSnapshot: async (request: NormalizedGlobalV2QueryRequest, cacheKey: string): Promise<GlobalV2StoredSnapshot | undefined> => {
      const queryKey = globalV2QueryInstanceKey(request.resource, request.scopeHash, request.params, input.generation.publicationId);
      if (!input.generation.requiredQueryKeys.includes(queryKey)) return undefined;
      if (primed.has(queryKey)) return stored(primed.get(queryKey), request, cacheKey);
      const { data, error } = await input.client.from("analytics_query_snapshots")
        .select("query_key,resource,contract_version,method_signature,payload,publication_id,is_active,invalidated_at")
        .eq("publication_id", input.generation.publicationId)
        .eq("query_key", queryKey)
        .maybeSingle();
      if (error !== null) throw error;
      return stored((data ?? undefined) as SnapshotRow | undefined, request, cacheKey);
    },
  };
}
