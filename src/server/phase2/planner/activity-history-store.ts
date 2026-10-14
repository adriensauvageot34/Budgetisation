import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { plannerInteger, plannerRecord, plannerKeys } from "@/domain/phase2/planner/json";
import type { ActivityHistoryStore, ActivityHistoryProof } from "./activity-history-artifact";

/** Reader uses the authenticated server client. Only the trusted existing owner
 * preparing facts may supply a publisher (service-role, never browser input).
 * authorizedPlanner constructs it only when consumption is explicitly enabled.
 * Ordinary READ has no publisher and cannot rebuild or write an artifact. */
export function createActivityHistoryStore(reader: SupabaseClient, publisher?: SupabaseClient): ActivityHistoryStore {
  return {
    async inspect(scope, key) {
      const { data, error } = await reader.rpc("inspect_planner_activity_history_v1", { p_scope: scope, p_key: key });
      if (error) throw error;
      const value = plannerRecord(data, "ACTIVITY_HISTORY_RPC_INVALID");
      plannerKeys(value, ["proof", "generation", "artifact"]);
      return { proof: value.proof as ActivityHistoryProof | null, generation: plannerInteger(value.generation), artifact: value.artifact };
    },
    async publish(scope, key, expectedGeneration, artifact) {
      if (!publisher) throw new TypeError("ACTIVITY_HISTORY_TRUSTED_PUBLISHER_REQUIRED");
      const { data, error } = await publisher.rpc("publish_planner_activity_history_v1",
        { p_scope: scope, p_key: key, p_expected_generation: expectedGeneration, p_artifact: artifact });
      if (error) throw error; // never retries an ambiguous write; caller re-inspects first
      if (typeof data !== "boolean") throw new TypeError("ACTIVITY_HISTORY_RPC_INVALID");
      return data;
    },
  };
}
