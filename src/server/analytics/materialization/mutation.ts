import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsImpact } from "@/analytics/publication";
import type { HouseholdId } from "@/core/identity";
import { queryResourcesInvalidatedByImpact } from "@/query-api/server";

function databaseImpactScope(
  impact: AnalyticsImpact,
): "month" | "entity" | "global_reference" | "narrative" {
  return impact.kind === "global-reference" ? "global_reference" : impact.kind;
}

/**
 * Trusted server boundary for future canonical writes. The canonical mutation
 * and this call belong to the same application transaction/workflow: this
 * helper bumps dataRevision, records the impact and invalidates only compatible
 * materializations. It is intentionally unavailable to browser clients.
 */
export async function recordAnalyticsMutation(input: {
  readonly client: SupabaseClient;
  readonly householdId: HouseholdId;
  readonly entityKind: string;
  readonly entityId: string;
  readonly impact: AnalyticsImpact;
  readonly affectsGlobalReferences?: boolean;
  readonly globalAsOf?: import("@/core/time").YearMonth;
}): Promise<{
  readonly dataRevision: string;
  readonly invalidatedArtifactCount: number;
  readonly invalidatedQueryCount: number;
}> {
  const affectedMonth = input.impact.kind === "month"
    ? input.impact.month
    : input.impact.kind === "global-reference"
      ? input.impact.asOf
      : null;
  const resources = new Set(queryResourcesInvalidatedByImpact(input.impact));
  if (input.affectsGlobalReferences === true && input.impact.kind !== "global-reference") {
    const globalAsOf = affectedMonth ?? input.globalAsOf;
    if (globalAsOf === undefined) {
      throw new TypeError("globalAsOf est requis pour invalider une référence globale sans mois.");
    }
    const globalImpact: AnalyticsImpact = {
      kind: "global-reference",
      asOf: globalAsOf,
      referenceFamily: "current",
      reason: input.impact.reason === "method_version_changed"
        ? "method_version_changed"
        : "canonical_data_changed",
    };
    for (const resource of queryResourcesInvalidatedByImpact(globalImpact)) {
      resources.add(resource);
    }
  }
  const { data, error } = await input.client.rpc("record_analytics_mutation", {
    p_household_id: input.householdId,
    p_entity_kind: input.entityKind,
    p_entity_id: input.entityId,
    p_affected_month: affectedMonth === null ? null : `${affectedMonth}-01`,
    p_impact_scope: databaseImpactScope(input.impact),
    p_query_resources: [...resources],
    p_invalidate_global_reference: input.affectsGlobalReferences === true,
  });
  if (error !== null) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (row === undefined || row === null) {
    throw new TypeError("La mutation analytique n'a retourné aucune révision.");
  }
  const result = row as {
    data_revision?: unknown;
    invalidated_artifact_count?: unknown;
    invalidated_query_count?: unknown;
  };
  const dataRevision = String(result.data_revision);
  if (!/^(0|[1-9]\d*)$/.test(dataRevision)) {
    throw new TypeError("La mutation analytique a retourné une révision invalide.");
  }
  return {
    dataRevision,
    invalidatedArtifactCount: Number(result.invalidated_artifact_count ?? 0),
    invalidatedQueryCount: Number(result.invalidated_query_count ?? 0),
  };
}
