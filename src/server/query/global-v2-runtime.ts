import "server-only";

import { globalV2QueryCacheKey, globalV2QueryRegistry, parseGlobalV2QueryRequest, type GlobalV2QueryRequest, type NormalizedGlobalV2QueryRequest } from "@/query-api/global-v2";
import { canonicalSerializeGlobal, type GlobalScopeValidationContext } from "@/core/global-v2";
import { GlobalGenerationPin, type GlobalSnapshotCandidate } from "./global-generation";

export type GlobalV2StoredSnapshot = GlobalSnapshotCandidate & {
  readonly resource: NormalizedGlobalV2QueryRequest["resource"];
  readonly contractVersion: string;
  readonly methodVersion: string;
  readonly methodSignature: string;
  readonly resourceInputHash: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly factsHash: string;
  readonly manifestHash: string;
};

export type GlobalV2QueryRuntimeErrorCode =
  | "INVALID_REQUEST"
  | "PERMISSION_DENIED"
  | "SNAPSHOT_MISS"
  | "INVALIDATED"
  | "MANIFEST_INCOMPLETE"
  | "SIGNATURE_INCOMPATIBLE"
  | "GENERATION_MISMATCH"
  | "CONTRACT_MISMATCH"
  | "INVALID_SNAPSHOT";

export type GlobalV2QueryRuntimeResult =
  | {
      readonly status: "READY";
      readonly data: unknown;
      readonly publicationId: string;
      readonly analyticsRevision: number;
      readonly factsHash: string;
      readonly manifestHash: string;
      readonly methodSignature: string;
      readonly resourceInputHash: string;
      readonly policyVersions: Readonly<Record<string, string>>;
      readonly cacheKey: string;
    }
  | { readonly status: "ERROR"; readonly errorCode: GlobalV2QueryRuntimeErrorCode; readonly reason: string };

export type GlobalV2QueryRuntimeServices = {
  readonly scopeValidationContext: GlobalScopeValidationContext;
  readonly authorize: (request: NormalizedGlobalV2QueryRequest) => boolean | Promise<boolean>;
  readonly readSnapshot: (request: NormalizedGlobalV2QueryRequest, cacheKey: string) => GlobalV2StoredSnapshot | undefined | Promise<GlobalV2StoredSnapshot | undefined>;
};

function error(errorCode: GlobalV2QueryRuntimeErrorCode, reason: string): GlobalV2QueryRuntimeResult {
  return { status: "ERROR", errorCode, reason };
}

/** Snapshot-only H4 boundary. No analytical producer is accepted by this API. */
export async function executeGlobalV2SnapshotQuery(
  rawRequest: GlobalV2QueryRequest | unknown,
  services: GlobalV2QueryRuntimeServices,
  pin = new GlobalGenerationPin(),
): Promise<GlobalV2QueryRuntimeResult> {
  let request: NormalizedGlobalV2QueryRequest;
  try {
    request = parseGlobalV2QueryRequest(rawRequest, services.scopeValidationContext);
  } catch (caught) {
    return error("INVALID_REQUEST", caught instanceof Error ? caught.message : "Invalid Global V2 request.");
  }
  if (!(await services.authorize(request))) return error("PERMISSION_DENIED", "Global V2 scope is not authorized.");

  const contract = globalV2QueryRegistry[request.resource];
  if (contract.availability !== "AVAILABLE") return error("SNAPSHOT_MISS", "The requested capability has no authoritative instance.");
  const cacheKey = globalV2QueryCacheKey(request);
  const candidate = await services.readSnapshot(request, cacheKey);
  if (candidate !== undefined) {
    if (candidate.resource !== request.resource || candidate.publicationId !== request.expectedGeneration.publicationId || candidate.analyticsRevision !== request.expectedGeneration.analyticsRevision) {
      return error("GENERATION_MISMATCH", "Snapshot identity does not match the pinned deep link.");
    }
    if (candidate.contractVersion !== contract.contractVersion || candidate.methodVersion !== contract.methodVersion) {
      return error("CONTRACT_MISMATCH", "Snapshot resource contract is incompatible.");
    }
  }
  const pinned = pin.read(candidate);
  if (pinned.status !== "READY") return error(pinned.status, pinned.reason);
  const parsed = contract.schema.safeParse(pinned.data);
  if (!parsed.success) return error("INVALID_SNAPSHOT", "Published snapshot failed its RuntimeSchema.");
  if (parsed.data !== null && typeof parsed.data === "object" && "publicationMeta" in parsed.data && "resourceMeta" in parsed.data) {
    const payload = parsed.data as {
      readonly publicationMeta: { readonly publicationId: string; readonly revision: number; readonly factsHash: string; readonly manifestHash: string };
      readonly resourceMeta: { readonly contractVersion: string; readonly methodSignature: string; readonly resourceInputHash: string; readonly policyVersions: Readonly<Record<string, string>> };
    };
    if (payload.publicationMeta.publicationId !== candidate!.publicationId || payload.publicationMeta.revision !== candidate!.analyticsRevision || payload.publicationMeta.factsHash !== candidate!.factsHash || payload.publicationMeta.manifestHash !== candidate!.manifestHash) return error("GENERATION_MISMATCH", "Snapshot payload metadata does not match its generation envelope.");
    if (payload.resourceMeta.contractVersion !== candidate!.contractVersion || payload.resourceMeta.methodSignature !== candidate!.methodSignature || payload.resourceMeta.resourceInputHash !== candidate!.resourceInputHash || canonicalSerializeGlobal(payload.resourceMeta.policyVersions) !== canonicalSerializeGlobal(candidate!.policyVersions)) return error("CONTRACT_MISMATCH", "Snapshot payload metadata does not match its resource envelope.");
  }
  return {
    status: "READY",
    data: parsed.data,
    publicationId: pinned.publicationId,
    analyticsRevision: pinned.analyticsRevision,
    factsHash: candidate!.factsHash,
    manifestHash: candidate!.manifestHash,
    methodSignature: candidate!.methodSignature,
    resourceInputHash: candidate!.resourceInputHash,
    policyVersions: candidate!.policyVersions,
    cacheKey,
  };
}
