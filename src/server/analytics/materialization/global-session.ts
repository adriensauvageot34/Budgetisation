import "server-only";

import { canonicalSerializeGlobal } from "@/core/global-v2";
import { parseGlobalV2PublicationManifest, type GlobalV2PublicationManifest, type GlobalV2StagedResource } from "./global-v2";

type GenerationStatus = "DRAFT" | "SEALED" | "PUBLISHED" | "FAILED" | "SUPERSEDED";
type Generation = {
  readonly publicationId: string;
  readonly householdId: string;
  readonly sourceRevision: string;
  readonly baseAnalyticsRevision: number;
  status: GenerationStatus;
  manifest?: GlobalV2PublicationManifest;
  readonly rows: Map<string, GlobalV2StagedResource>;
  publishedRevision?: number;
};

/** Pure contract harness for H2. It performs no database or network operation. */
export class InMemoryGlobalPublicationCoordinator {
  private readonly generations = new Map<string, Generation>();
  private readonly activeByHousehold = new Map<string, string>();
  private readonly invalidated = new Set<string>();
  private readonly analyticsRevisions = new Map<string, number>();
  private readonly dataRevisions = new Map<string, string>();

  seedRevisions(householdId: string, sourceRevision: string, analyticsRevision: number): void {
    this.dataRevisions.set(householdId, sourceRevision);
    this.analyticsRevisions.set(householdId, analyticsRevision);
  }

  begin(input: { publicationId: string; householdId: string; sourceRevision: string; baseAnalyticsRevision: number }): void {
    if (this.generations.has(input.publicationId)) throw new TypeError("GLOBAL_PUBLICATION_ALREADY_EXISTS");
    this.generations.set(input.publicationId, { ...input, status: "DRAFT", rows: new Map() });
  }

  stage(publicationId: string, row: GlobalV2StagedResource): void {
    const generation = this.require(publicationId);
    if (generation.status !== "DRAFT" || generation.manifest !== undefined) throw new TypeError("GLOBAL_STAGE_REQUIRES_UNSEALED_DRAFT");
    if (row.publicationMeta.publicationId !== publicationId) throw new TypeError("GLOBAL_STAGE_PUBLICATION_MISMATCH");
    const existing = generation.rows.get(row.key);
    if (existing !== undefined && canonicalSerializeGlobal(existing) !== canonicalSerializeGlobal(row)) throw new TypeError("GLOBAL_STAGE_RETRY_CHANGED_CONTENT");
    generation.rows.set(row.key, row);
  }

  attachManifest(publicationId: string, value: unknown): GlobalV2PublicationManifest {
    const generation = this.require(publicationId);
    const manifest = parseGlobalV2PublicationManifest(value);
    if (generation.status === "SEALED" && generation.manifest?.manifestHash === manifest.manifestHash) return manifest;
    if (generation.status !== "DRAFT" || generation.manifest !== undefined) throw new TypeError("GLOBAL_MANIFEST_ATTACHMENT_REQUIRES_DRAFT");
    if (manifest.householdId !== generation.householdId || manifest.sourceRevision !== generation.sourceRevision || Number(manifest.baseAnalyticsRevision) !== generation.baseAnalyticsRevision) throw new TypeError("GLOBAL_MANIFEST_GENERATION_MISMATCH");
    this.assertComplete(generation, manifest);
    generation.manifest = manifest;
    generation.status = "SEALED";
    return manifest;
  }

  finalize(publicationId: string, expectedAnalyticsRevision: number): { analyticsRevision: number; publicationId: string } {
    const generation = this.require(publicationId);
    if (generation.status === "PUBLISHED") {
      if (this.activeByHousehold.get(generation.householdId) !== publicationId) throw new TypeError("GLOBAL_PUBLISHED_RETRY_CANNOT_REACTIVATE");
      return { analyticsRevision: generation.publishedRevision!, publicationId };
    }
    if (generation.status !== "SEALED" || generation.manifest === undefined) throw new TypeError("GLOBAL_FINALIZE_REQUIRES_SEALED_GENERATION");
    const currentAnalytics = this.analyticsRevisions.get(generation.householdId);
    const currentData = this.dataRevisions.get(generation.householdId);
    if (currentAnalytics !== expectedAnalyticsRevision || currentAnalytics !== generation.baseAnalyticsRevision) throw new TypeError("GLOBAL_CONCURRENT_ANALYTICS_REVISION");
    if (currentData !== generation.sourceRevision) {
      generation.status = "SUPERSEDED";
      throw new TypeError("GLOBAL_SOURCE_REVISION_SUPERSEDED");
    }
    this.assertComplete(generation, generation.manifest);
    const previous = this.activeByHousehold.get(generation.householdId);
    if (previous !== undefined) this.require(previous).status = "SUPERSEDED";
    const next = currentAnalytics + 1;
    generation.status = "PUBLISHED";
    generation.publishedRevision = next;
    this.analyticsRevisions.set(generation.householdId, next);
    this.activeByHousehold.set(generation.householdId, publicationId);
    return { analyticsRevision: next, publicationId };
  }

  rollback(input: { householdId: string; currentPublicationId: string; targetPublicationId: string; expectedAnalyticsRevision: number }): { analyticsRevision: number; publicationId: string } {
    const current = this.require(input.currentPublicationId), target = this.require(input.targetPublicationId);
    if (this.activeByHousehold.get(input.householdId) !== current.publicationId || current.householdId !== input.householdId || target.householdId !== input.householdId) throw new TypeError("GLOBAL_ROLLBACK_SCOPE_MISMATCH");
    if (target.publishedRevision === undefined || target.manifest === undefined || this.invalidated.has(target.publicationId)) throw new TypeError("GLOBAL_ROLLBACK_TARGET_INELIGIBLE");
    this.assertComplete(target, target.manifest);
    if (this.analyticsRevisions.get(input.householdId) !== input.expectedAnalyticsRevision) throw new TypeError("GLOBAL_ROLLBACK_REVISION_CONFLICT");
    current.status = "SUPERSEDED";
    target.status = "PUBLISHED";
    const next = input.expectedAnalyticsRevision + 1;
    this.analyticsRevisions.set(input.householdId, next);
    this.activeByHousehold.set(input.householdId, target.publicationId);
    return { analyticsRevision: next, publicationId: target.publicationId };
  }

  invalidate(publicationId: string): void { this.invalidated.add(publicationId); }

  mutate(publicationId: string, key: string, row: GlobalV2StagedResource): void {
    const generation = this.require(publicationId);
    if (generation.status !== "DRAFT" || generation.manifest !== undefined) throw new TypeError("GLOBAL_GENERATION_IMMUTABLE");
    generation.rows.set(key, row);
  }

  active(input: { householdId: string }): { publicationId: string; keys: readonly string[]; analyticsRevision: number } | undefined {
    const publicationId = this.activeByHousehold.get(input.householdId);
    if (publicationId === undefined) return undefined;
    const generation = this.require(publicationId);
    return { publicationId, keys: [...generation.rows.keys()].sort(), analyticsRevision: this.analyticsRevisions.get(input.householdId)! };
  }

  private require(publicationId: string): Generation {
    const generation = this.generations.get(publicationId);
    if (generation === undefined) throw new TypeError("GLOBAL_PUBLICATION_NOT_FOUND");
    return generation;
  }

  private assertComplete(generation: Generation, manifest: GlobalV2PublicationManifest): void {
    const expected = [...manifest.requiredArtifactKeys, ...manifest.requiredQueryKeys].sort();
    const actual = [...generation.rows.keys()].sort();
    if (canonicalSerializeGlobal(expected) !== canonicalSerializeGlobal(actual)) throw new TypeError("GLOBAL_GENERATION_INCOMPLETE_OR_EXTRA");
    for (const row of generation.rows.values()) {
      if (row.publicationMeta.manifestHash !== manifest.manifestHash || row.publicationMeta.factsHash !== manifest.publicationFactsHash || row.publicationMeta.revision !== generation.baseAnalyticsRevision + 1) throw new TypeError("GLOBAL_STAGED_ROW_MANIFEST_MISMATCH");
    }
  }
}
