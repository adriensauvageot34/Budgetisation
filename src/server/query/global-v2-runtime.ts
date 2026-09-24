import "server-only";

import { globalV2AcceptedQueryMethodSignatures, globalV2QueryCacheKey, globalV2QueryRegistry, globalV2TimelineMethodForSchema, parseGlobalV2QueryRequest, type GlobalV2QueryRequest, type NormalizedGlobalV2QueryRequest } from "@/query-api/global-v2";
import { canonicalSerializeGlobal, type GlobalScopeValidationContext } from "@/core/global-v2";
import { GlobalGenerationPin, type GlobalSnapshotCandidate } from "./global-generation";

export type GlobalV2StoredSnapshot = GlobalSnapshotCandidate & {
  readonly queryKey: string;
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
  | "INVALID_SNAPSHOT"
  | "SNAPSHOT_READ_FAILED";

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
  try {
    if (!(await services.authorize(request))) return error("PERMISSION_DENIED", "Global V2 scope is not authorized.");
  } catch (caught) {
    return error("PERMISSION_DENIED", caught instanceof Error ? caught.message : "Global V2 authorization failed.");
  }

  const contract = globalV2QueryRegistry[request.resource];
  if (contract.availability !== "AVAILABLE") return error("SNAPSHOT_MISS", "The requested capability has no authoritative instance.");
  const cacheKey = globalV2QueryCacheKey(request);
  let candidate: GlobalV2StoredSnapshot | undefined;
  try {
    candidate = await services.readSnapshot(request, cacheKey);
  } catch (caught) {
    return error("SNAPSHOT_READ_FAILED", caught instanceof Error ? caught.message : "Global V2 snapshot read failed.");
  }
  if (candidate !== undefined) {
    if (candidate.queryKey !== cacheKey || candidate.resource !== request.resource || candidate.publicationId !== request.expectedGeneration.publicationId || candidate.analyticsRevision !== request.expectedGeneration.analyticsRevision) {
      return error("GENERATION_MISMATCH", "Snapshot identity does not match the pinned deep link.");
    }
    const acceptedSignatures = globalV2AcceptedQueryMethodSignatures(request.resource);
    const timelineMethod = request.resource === "analysis_global_life_timeline"
      ? globalV2TimelineMethodForSchema(candidate.data !== null && typeof candidate.data === "object" && "schemaVersion" in candidate.data ? candidate.data.schemaVersion : undefined)
      : undefined;
    if (candidate.contractVersion !== contract.contractVersion
      || !acceptedSignatures.includes(candidate.methodSignature)
      || (request.resource === "analysis_global_life_timeline" && timelineMethod === undefined)
      || candidate.methodSignature !== (timelineMethod?.methodSignature ?? acceptedSignatures[0])
      || candidate.methodVersion !== (timelineMethod?.methodVersion ?? contract.methodVersion)
      || canonicalSerializeGlobal(candidate.policyVersions) !== canonicalSerializeGlobal(timelineMethod?.policyVersions ?? contract.policyVersions)) {
      return error("CONTRACT_MISMATCH", "Snapshot resource contract is incompatible.");
    }
  }
  const pinned = pin.read(candidate);
  if (pinned.status !== "READY") return error(pinned.status, pinned.reason);
  const parsed = contract.schema.safeParse(pinned.data);
  if (!parsed.success) return error("INVALID_SNAPSHOT", "Published snapshot failed its RuntimeSchema.");
  if (request.resource === "analysis_global_timeline_event_comparison") {
    const payload = parsed.data as { readonly subject?: { readonly eventRef?: unknown }; readonly comparison?: { readonly level?: unknown } };
    if (payload.subject?.eventRef !== request.params.eventRef || payload.comparison?.level !== request.params.comparisonLevel) return error("INVALID_SNAPSHOT", "Comparison snapshot does not match its requested event and level.");
  }
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
