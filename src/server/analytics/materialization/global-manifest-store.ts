import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseGlobalV2PublicationManifest, type GlobalV2PublicationManifest } from "./global-v2";

export type GlobalManifestRead =
  | { readonly status: "KNOWN"; readonly manifest: GlobalV2PublicationManifest }
  | { readonly status: "LEGACY_UNKNOWN"; readonly reason: "MANIFEST_NOT_RECORDED" }
  | { readonly status: "NOT_FOUND" }
  | { readonly status: "SCHEMA_NOT_READY" };

/** Server/admin boundary only; no browser write or analytical read-through. */
export class SupabaseGlobalManifestStore {
  constructor(private readonly client: SupabaseClient) {}

  async read(householdId: string, publicationId: string): Promise<GlobalManifestRead> {
    const { data, error } = await this.client.from("analytics_publications").select("household_id,scope_kind,global_manifest").eq("household_id", householdId).eq("publication_id", publicationId).maybeSingle();
    if (error !== null) {
      if (error.code === "42703" && error.message.includes("global_manifest")) return { status: "SCHEMA_NOT_READY" };
      throw error;
    }
    if (data === null) return { status: "NOT_FOUND" };
    if (data.global_manifest === null) return { status: "LEGACY_UNKNOWN", reason: "MANIFEST_NOT_RECORDED" };
    const manifest = parseGlobalV2PublicationManifest(data.global_manifest);
    if (data.scope_kind !== "global" || manifest.householdId !== householdId) throw new TypeError("GLOBAL_MANIFEST_PERSISTED_SCOPE_MISMATCH");
    return { status: "KNOWN", manifest };
  }

  async attach(publicationId: string, input: unknown): Promise<GlobalV2PublicationManifest> {
    const manifest = parseGlobalV2PublicationManifest(input);
    const { error } = await this.client.rpc("attach_global_v2_manifest", { p_publication_id: publicationId, p_household_id: manifest.householdId, p_manifest: manifest });
    if (error !== null) throw error;
    const read = await this.read(manifest.householdId, publicationId);
    if (read.status !== "KNOWN" || read.manifest.manifestHash !== manifest.manifestHash) throw new TypeError("GLOBAL_MANIFEST_ATTACHMENT_READ_BACK_FAILED");
    return read.manifest;
  }
}
