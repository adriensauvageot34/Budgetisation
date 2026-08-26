import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AnalyticsPublicationStore,
  AnalyticsRevisionState,
} from "@/analytics/publication";
import { parseHouseholdId, type HouseholdId } from "@/core/identity";
import { parseInstant } from "@/core/time";
import {
  parseAnalyticsRevision,
  parseDataRevision,
} from "@/core/versions";

/**
 * Concrete publication store for a set of artifacts/snapshots already written
 * as an inactive draft under one analytics_publications row.
 */
export class SupabaseAnalyticsPublicationStore
implements AnalyticsPublicationStore {
  constructor(
    private readonly client: SupabaseClient,
    private readonly publicationId: string,
  ) {}

  async readRevisionState(
    householdId: HouseholdId,
  ): Promise<AnalyticsRevisionState> {
    const { data, error } = await this.client
      .from("household_revisions")
      .select("household_id,data_revision::text,analytics_revision::text,updated_at")
      .eq("household_id", householdId)
      .single();
    if (error !== null) throw error;
    return {
      householdId: parseHouseholdId(data.household_id),
      dataRevision: parseDataRevision(data.data_revision),
      analyticsRevision: parseAnalyticsRevision(data.analytics_revision),
      publishedAt: parseInstant(data.updated_at),
    };
  }

  async publishAtomically(input: {
    readonly expectedAnalyticsRevision: import("@/core/versions").AnalyticsRevision;
    readonly nextState: import("@/analytics/publication").AnalyticsPublishedState;
  }): Promise<boolean> {
    const { data, error } = await this.client.rpc(
      "publish_analytics_materialization",
      {
        p_publication_id: this.publicationId,
        p_expected_analytics_revision: input.expectedAnalyticsRevision,
      },
    );
    if (error !== null) {
      if (error.code === "40001") return false;
      throw error;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row === undefined || row === null) return false;
    const result = row as { analytics_revision?: unknown; source_revision?: unknown };
    return parseAnalyticsRevision(result.analytics_revision)
        === input.nextState.analyticsRevision
      && parseDataRevision(result.source_revision) === input.nextState.dataRevision;
  }
}
