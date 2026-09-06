import "server-only";

export type GlobalSnapshotReadState =
  | { readonly status: "READY"; readonly publicationId: string; readonly analyticsRevision: number; readonly data: unknown }
  | { readonly status: "SNAPSHOT_MISS" | "INVALIDATED" | "MANIFEST_INCOMPLETE" | "SIGNATURE_INCOMPATIBLE" | "GENERATION_MISMATCH"; readonly reason: string };

export type GlobalSnapshotCandidate = {
  readonly publicationId: string;
  readonly analyticsRevision: number;
  readonly active: boolean;
  readonly invalidated: boolean;
  readonly manifestComplete: boolean;
  readonly signatureCompatible: boolean;
  readonly data: unknown;
};

/** Session pin: a visit never mixes modules from different Global generations. */
export class GlobalGenerationPin {
  private pin?: { readonly publicationId: string; readonly analyticsRevision: number };

  reset(): void { this.pin = undefined; }

  read(candidate: GlobalSnapshotCandidate | undefined): GlobalSnapshotReadState {
    if (candidate === undefined) return { status: "SNAPSHOT_MISS", reason: "No compatible Global V2 snapshot; read-through is forbidden." };
    if (!candidate.active) return { status: "SNAPSHOT_MISS", reason: "Snapshot is not active." };
    if (candidate.invalidated) return { status: "INVALIDATED", reason: "Snapshot has been invalidated." };
    if (!candidate.manifestComplete) return { status: "MANIFEST_INCOMPLETE", reason: "Active generation manifest is incomplete." };
    if (!candidate.signatureCompatible) return { status: "SIGNATURE_INCOMPATIBLE", reason: "Snapshot contract or method signature is incompatible." };
    const identity = { publicationId: candidate.publicationId, analyticsRevision: candidate.analyticsRevision };
    if (this.pin !== undefined && (this.pin.publicationId !== identity.publicationId || this.pin.analyticsRevision !== identity.analyticsRevision)) return { status: "GENERATION_MISMATCH", reason: "Late response belongs to another generation." };
    this.pin = identity;
    return { status: "READY", ...identity, data: candidate.data };
  }
}
