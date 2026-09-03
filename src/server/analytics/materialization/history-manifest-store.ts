import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HouseholdId } from "@/core/identity";
import { historyV2DependencyManifestSchema, type HistoryV2MonthManifest } from "./history-v2";

export type HistoryManifestRead =
  | { readonly status: "KNOWN"; readonly manifest: HistoryV2MonthManifest }
  | { readonly status: "LEGACY_UNKNOWN"; readonly reason: "MANIFEST_NOT_RECORDED" }
  | { readonly status: "NOT_FOUND" }
  | { readonly status: "SCHEMA_NOT_READY" };

/** Server/admin evidence reader. Does not change runtime snapshot serving or enable read-through. */
export class SupabaseHistoryManifestStore {
  constructor(private readonly client: SupabaseClient) {}

  async read(householdId: HouseholdId, publicationId: string): Promise<HistoryManifestRead> {
    const { data, error } = await this.client.from("analytics_publications")
      .select("household_id,period_month,dependency_manifest")
      .eq("household_id", householdId).eq("publication_id", publicationId).maybeSingle();
    if (error !== null) {
      if (error.code === "42703" && error.message.includes("dependency_manifest")) return { status: "SCHEMA_NOT_READY" };
      throw error;
    }
    if (data === null) return { status: "NOT_FOUND" };
    if (data.dependency_manifest === null) return { status: "LEGACY_UNKNOWN", reason: "MANIFEST_NOT_RECORDED" };
    const manifest = historyV2DependencyManifestSchema.parse(data.dependency_manifest);
    if (manifest.householdId !== householdId || manifest.month !== data.period_month?.slice(0, 7)) {
      throw new TypeError("Persisted manifest scope mismatch.");
    }
    return { status: "KNOWN", manifest };
  }

  /** Requires the approved migration. Idempotent attachment to an existing DRAFT only. */
  async attach(publicationId: string, input: unknown): Promise<HistoryV2MonthManifest> {
    const manifest = historyV2DependencyManifestSchema.parse(input);
    if (manifest.implementation.status !== "KNOWN") throw new TypeError("Cannot publish without implementation evidence.");
    const { error } = await this.client.rpc("attach_history_v2_dependency_manifest", {
      p_publication_id: publicationId, p_household_id: manifest.householdId, p_manifest: manifest,
    });
    if (error !== null) throw error;
    const persisted = await this.read(manifest.householdId, publicationId);
    if (persisted.status !== "KNOWN" || persisted.manifest.manifestHash !== manifest.manifestHash) {
      throw new TypeError("Manifest attachment read-back failed.");
    }
    return persisted.manifest;
  }
}
