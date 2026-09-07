import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GlobalScopeValidationContext } from "@/core/global-v2";
import {
  globalV2ExpectedQueryMethodSignature,
  globalV2QueryRegistry,
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

export function createGlobalV2ProductionQueryServices(input: {
  readonly client: SupabaseClient;
  readonly context: AuthorizedRuntimeContext;
  readonly generation: ActiveGlobalV2Generation;
}): GlobalV2QueryRuntimeServices {
  const scopeValidationContext: GlobalScopeValidationContext = { householdTimeZone: input.context.timezone, authorizedPersonIds: input.context.personIds };
  return {
    scopeValidationContext,
    authorize: (request) => request.scope.subject.kind === "household" && request.expectedGeneration.publicationId === input.generation.publicationId && request.expectedGeneration.analyticsRevision === input.generation.analyticsRevision,
    readSnapshot: async (request: NormalizedGlobalV2QueryRequest, cacheKey: string): Promise<GlobalV2StoredSnapshot | undefined> => {
      const queryKey = globalV2QueryInstanceKey(request.resource, request.scopeHash, request.params);
      if (!input.generation.requiredQueryKeys.includes(queryKey)) return undefined;
      const { data, error } = await input.client.from("analytics_query_snapshots")
        .select("query_key,resource,contract_version,method_signature,payload,publication_id,is_active,invalidated_at")
        .eq("publication_id", input.generation.publicationId)
        .eq("query_key", queryKey)
        .maybeSingle();
      if (error !== null) throw error;
      if (data === null) return undefined;
      const payload = data.payload as { readonly publicationMeta: GlobalReadModelPublicationMeta; readonly resourceMeta: { readonly methodSignature: string; readonly resourceInputHash: string; readonly policyVersions: Readonly<Record<string, string>> } };
      const contract = globalV2QueryRegistry[request.resource];
      return {
        queryKey: cacheKey,
        resource: request.resource,
        contractVersion: data.contract_version,
        methodVersion: contract.methodVersion,
        methodSignature: data.method_signature,
        resourceInputHash: payload.resourceMeta.resourceInputHash,
        policyVersions: payload.resourceMeta.policyVersions,
        factsHash: payload.publicationMeta.factsHash,
        manifestHash: payload.publicationMeta.manifestHash,
        publicationId: data.publication_id,
        analyticsRevision: payload.publicationMeta.revision,
        active: data.is_active === true,
        invalidated: data.invalidated_at !== null,
        manifestComplete: input.generation.requiredQueryKeys.includes(queryKey),
        signatureCompatible: data.method_signature === globalV2ExpectedQueryMethodSignature(request.resource),
        data: data.payload,
      };
    },
  };
}
