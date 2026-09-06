import "server-only";

import { createHash } from "node:crypto";

import { canonicalSerializeGlobal } from "@/core/global-v2";

export const globalV2PublicationProfileId = "global-v2-household@v1" as const;
export const globalV2ManifestFormatVersion = "global-v2-publication-manifest@v1" as const;
export const globalV2PublicationContractVersion = "v2" as const;

export const globalV2ResourceFamilies = Object.freeze([
  "global_overview",
  "global_module",
  "global_exploration",
  "global_entity_detail",
  "global_methodology",
] as const);

/** Exact P14 primary query contracts. P15 appends detail and exploration instances. */
export const globalV2PrimaryQueryResources = Object.freeze([
  "analysis_global_manifest",
  "analysis_global_summary_ai",
  "analysis_global_economic",
  "analysis_global_categories_needs",
  "analysis_global_transformations",
  "analysis_global_rhythm",
  "analysis_global_relationships",
  "analysis_global_moments",
  "analysis_global_geo_mobility",
  "analysis_global_consumption",
  "analysis_global_personas",
  "analysis_global_together",
] as const);

export const globalV2MaterializationProfile = Object.freeze({
  profileId: globalV2PublicationProfileId,
  scope: "household_global" as const,
  restagePolicy: "FULL_RESTAGE" as const,
  intergenerationReferences: "FORBIDDEN" as const,
  contractVersion: globalV2PublicationContractVersion,
  artifactStore: "analytics_artifacts" as const,
  queryStore: "analytics_query_snapshots" as const,
  publicationStore: "analytics_publications" as const,
  manifestColumn: "global_manifest" as const,
  resourceFamilies: globalV2ResourceFamilies,
});

export type GlobalV2ResolvedDependency = {
  readonly authority: "CANONICAL" | "FACT" | "METRIC" | "ARTIFACT";
  readonly family: string;
  readonly identity: string;
  readonly digest: string;
  readonly required: boolean;
};

export type GlobalV2Closure = {
  readonly outputKey: string;
  readonly declarationDigest: string;
  readonly inputDigest: string;
  readonly dependencies: readonly GlobalV2ResolvedDependency[];
};

export type GlobalV2ResourceVersion = {
  readonly key: string;
  readonly family: string;
  readonly contractVersion: string;
  readonly methodSignature: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly resourceInputHash: string;
};

export type GlobalV2PublicationManifest = {
  readonly formatVersion: typeof globalV2ManifestFormatVersion;
  readonly profileId: typeof globalV2PublicationProfileId;
  readonly householdId: string;
  readonly asOf: string;
  readonly certifiedThrough: string;
  readonly liveThrough?: string;
  readonly sourceRevision: string;
  readonly baseAnalyticsRevision: string;
  readonly resourceFamilies: readonly string[];
  readonly requiredArtifactKeys: readonly string[];
  readonly requiredQueryKeys: readonly string[];
  readonly closures: readonly GlobalV2Closure[];
  readonly externalDependencyRefs: readonly string[];
  readonly artifactVersions: readonly GlobalV2ResourceVersion[];
  readonly queryVersions: readonly GlobalV2ResourceVersion[];
  readonly publicationFactsHash: string;
  readonly implementation: {
    readonly status: "KNOWN";
    readonly digest: string;
    readonly gitSha: string;
  };
  readonly manifestHash: string;
};

export type GlobalV2ManifestInput = Omit<GlobalV2PublicationManifest, "manifestHash">;

const MANIFEST_INPUT_KEYS = [
  "formatVersion", "profileId", "householdId", "asOf", "certifiedThrough", "liveThrough",
  "sourceRevision", "baseAnalyticsRevision", "resourceFamilies", "requiredArtifactKeys",
  "requiredQueryKeys", "closures", "externalDependencyRefs", "artifactVersions", "queryVersions",
  "publicationFactsHash", "implementation",
] as const;

const SHA256 = /^[0-9a-f]{64}$/u;
const GIT_SHA = /^[0-9a-f]{40}$/u;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const INSTANT = /^\d{4}-\d{2}-\d{2}T/u;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableUnique(values: readonly string[], label: string): readonly string[] {
  if (values.some((value) => value.length === 0)) throw new TypeError(`${label}: empty key`);
  const ordered = [...values].sort((left, right) => left.localeCompare(right));
  if (new Set(ordered).size !== ordered.length) throw new TypeError(`${label}: duplicate key`);
  return ordered;
}

function canonicalRecord(input: Readonly<Record<string, string>>, label: string): Readonly<Record<string, string>> {
  const entries = Object.entries(input).sort(([a], [b]) => a.localeCompare(b));
  if (entries.some(([key, value]) => key.length === 0 || value.length === 0)) throw new TypeError(`${label}: invalid policy version`);
  return Object.fromEntries(entries);
}

function assertExactKeys(value: object, allowed: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  if (canonicalSerializeGlobal(actual) !== canonicalSerializeGlobal(expected)) throw new TypeError(`${label}: unknown or missing field`);
}

function canonicalDependency(input: GlobalV2ResolvedDependency): GlobalV2ResolvedDependency {
  assertExactKeys(input, ["authority", "family", "identity", "digest", "required"], "GLOBAL_MANIFEST_DEPENDENCY");
  if (!input.family || !input.identity || !SHA256.test(input.digest)) throw new TypeError("GLOBAL_MANIFEST_DEPENDENCY_INVALID");
  return { ...input };
}

function canonicalVersion(input: GlobalV2ResourceVersion): GlobalV2ResourceVersion {
  assertExactKeys(input, ["key", "family", "contractVersion", "methodSignature", "policyVersions", "resourceInputHash"], "GLOBAL_MANIFEST_RESOURCE_VERSION");
  if (!input.key || !input.family || !input.contractVersion || !SHA256.test(input.methodSignature) || !SHA256.test(input.resourceInputHash)) {
    throw new TypeError("GLOBAL_MANIFEST_RESOURCE_VERSION_INVALID");
  }
  return { ...input, policyVersions: canonicalRecord(input.policyVersions, input.key) };
}

function canonicalClosure(input: GlobalV2Closure): GlobalV2Closure {
  assertExactKeys(input, ["outputKey", "declarationDigest", "inputDigest", "dependencies"], "GLOBAL_MANIFEST_CLOSURE");
  if (!input.outputKey || !SHA256.test(input.declarationDigest) || !SHA256.test(input.inputDigest)) throw new TypeError("GLOBAL_MANIFEST_CLOSURE_INVALID");
  const dependencies = input.dependencies.map(canonicalDependency).sort((a, b) => `${a.authority}:${a.family}:${a.identity}`.localeCompare(`${b.authority}:${b.family}:${b.identity}`));
  const identities = dependencies.map((item) => `${item.authority}:${item.family}:${item.identity}`);
  if (new Set(identities).size !== identities.length) throw new TypeError("GLOBAL_MANIFEST_DEPENDENCY_DUPLICATE");
  return { ...input, dependencies };
}

export function buildGlobalV2PublicationManifest(input: GlobalV2ManifestInput): GlobalV2PublicationManifest {
  const actualKeys = Object.keys(input).sort();
  const allowedKeys = MANIFEST_INPUT_KEYS.filter((key) => key !== "liveThrough" || input.liveThrough !== undefined).sort();
  if (canonicalSerializeGlobal(actualKeys) !== canonicalSerializeGlobal(allowedKeys)) throw new TypeError("GLOBAL_MANIFEST_UNKNOWN_OR_MISSING_FIELD");
  if (input.formatVersion !== globalV2ManifestFormatVersion || input.profileId !== globalV2PublicationProfileId) throw new TypeError("GLOBAL_MANIFEST_PROFILE_INVALID");
  if (!input.householdId || !INSTANT.test(input.asOf) || !LOCAL_DATE.test(input.certifiedThrough) || (input.liveThrough !== undefined && !LOCAL_DATE.test(input.liveThrough))) throw new TypeError("GLOBAL_MANIFEST_SCOPE_INVALID");
  if (!/^\d+$/u.test(input.sourceRevision) || !/^\d+$/u.test(input.baseAnalyticsRevision)) throw new TypeError("GLOBAL_MANIFEST_REVISION_INVALID");
  if (!SHA256.test(input.publicationFactsHash) || input.implementation.status !== "KNOWN" || !SHA256.test(input.implementation.digest) || !GIT_SHA.test(input.implementation.gitSha)) throw new TypeError("GLOBAL_MANIFEST_EVIDENCE_INVALID");
  assertExactKeys(input.implementation, ["status", "digest", "gitSha"], "GLOBAL_MANIFEST_IMPLEMENTATION");

  const requiredArtifactKeys = stableUnique(input.requiredArtifactKeys, "artifact keys");
  const requiredQueryKeys = stableUnique(input.requiredQueryKeys, "query keys");
  if (requiredArtifactKeys.length === 0 || requiredQueryKeys.length === 0) throw new TypeError("GLOBAL_MANIFEST_EMPTY_GENERATION");
  const allKeys = [...requiredArtifactKeys, ...requiredQueryKeys].sort((left, right) => left.localeCompare(right));
  if (new Set(allKeys).size !== allKeys.length) throw new TypeError("GLOBAL_MANIFEST_CROSS_KIND_KEY_COLLISION");

  const resourceFamilies = stableUnique(input.resourceFamilies, "resource families");
  if (canonicalSerializeGlobal(resourceFamilies) !== canonicalSerializeGlobal([...globalV2ResourceFamilies].sort())) throw new TypeError("GLOBAL_MANIFEST_RESOURCE_FAMILIES_INCOMPLETE");
  const closures = input.closures.map(canonicalClosure).sort((a, b) => a.outputKey.localeCompare(b.outputKey));
  const closureKeys = closures.map((entry) => entry.outputKey);
  if (canonicalSerializeGlobal(closureKeys) !== canonicalSerializeGlobal(allKeys)) {
    const missing = allKeys.filter((key) => !closureKeys.includes(key));
    const extra = closureKeys.filter((key) => !allKeys.includes(key));
    throw new TypeError(`GLOBAL_MANIFEST_CLOSURE_INCOMPLETE:missing=${missing.join(",")}:extra=${extra.join(",")}`);
  }

  const artifactVersions = input.artifactVersions.map(canonicalVersion).sort((a, b) => a.key.localeCompare(b.key));
  const queryVersions = input.queryVersions.map(canonicalVersion).sort((a, b) => a.key.localeCompare(b.key));
  if (canonicalSerializeGlobal(artifactVersions.map((entry) => entry.key)) !== canonicalSerializeGlobal(requiredArtifactKeys)) throw new TypeError("GLOBAL_MANIFEST_ARTIFACT_VERSIONS_INCOMPLETE");
  if (canonicalSerializeGlobal(queryVersions.map((entry) => entry.key)) !== canonicalSerializeGlobal(requiredQueryKeys)) throw new TypeError("GLOBAL_MANIFEST_QUERY_VERSIONS_INCOMPLETE");

  const withoutHash: GlobalV2ManifestInput = {
    ...input,
    resourceFamilies,
    requiredArtifactKeys,
    requiredQueryKeys,
    closures,
    externalDependencyRefs: stableUnique(input.externalDependencyRefs, "external dependency refs"),
    artifactVersions,
    queryVersions,
  };
  return { ...withoutHash, manifestHash: sha256(canonicalSerializeGlobal(withoutHash)) };
}

export function parseGlobalV2PublicationManifest(value: unknown): GlobalV2PublicationManifest {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("GLOBAL_MANIFEST_INVALID");
  const record = value as Record<string, unknown>;
  const { manifestHash, ...input } = record;
  const rebuilt = buildGlobalV2PublicationManifest(input as unknown as GlobalV2ManifestInput);
  if (manifestHash !== rebuilt.manifestHash) throw new TypeError("GLOBAL_MANIFEST_HASH_MISMATCH");
  if (canonicalSerializeGlobal(record) !== canonicalSerializeGlobal(rebuilt)) throw new TypeError("GLOBAL_MANIFEST_UNKNOWN_OR_NON_CANONICAL_FIELD");
  return rebuilt;
}

export type GlobalV2PublicationMeta = {
  readonly publicationId: string;
  readonly revision: number;
  readonly factsHash: string;
  readonly generatedAt: string;
  readonly profileId: typeof globalV2PublicationProfileId;
  readonly manifestHash: string;
};

export type GlobalV2StagedResource = {
  readonly key: string;
  readonly family: string;
  readonly kind: "artifact" | "query";
  readonly contractVersion: string;
  readonly methodSignature: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly resourceInputHash: string;
  readonly payload: unknown;
  readonly publicationMeta: GlobalV2PublicationMeta;
};

export function stageGlobalV2GenerationInMemory(input: {
  readonly manifest: GlobalV2PublicationManifest;
  readonly publicationId: string;
  readonly revision: number;
  readonly generatedAt: string;
  readonly artifacts: readonly Omit<GlobalV2StagedResource, "kind" | "publicationMeta">[];
  readonly queries: readonly Omit<GlobalV2StagedResource, "kind" | "publicationMeta">[];
}): readonly GlobalV2StagedResource[] {
  if (!input.publicationId || !Number.isSafeInteger(input.revision) || input.revision < 0 || !INSTANT.test(input.generatedAt)) throw new TypeError("GLOBAL_STAGE_IDENTITY_INVALID");
  const meta: GlobalV2PublicationMeta = { publicationId: input.publicationId, revision: input.revision, factsHash: input.manifest.publicationFactsHash, generatedAt: input.generatedAt, profileId: globalV2PublicationProfileId, manifestHash: input.manifest.manifestHash };
  const stage = (kind: "artifact" | "query", value: Omit<GlobalV2StagedResource, "kind" | "publicationMeta">): GlobalV2StagedResource => ({ ...value, kind, publicationMeta: meta });
  const rows = [...input.artifacts.map((value) => stage("artifact", value)), ...input.queries.map((value) => stage("query", value))];
  const versions = new Map([...input.manifest.artifactVersions, ...input.manifest.queryVersions].map((entry) => [entry.key, entry]));
  const expected = [...input.manifest.requiredArtifactKeys, ...input.manifest.requiredQueryKeys].sort();
  if (canonicalSerializeGlobal(rows.map((row) => row.key).sort()) !== canonicalSerializeGlobal(expected)) throw new TypeError("GLOBAL_STAGE_KEY_SET_MISMATCH");
  for (const row of rows) {
    const version = versions.get(row.key);
    if (version === undefined || version.family !== row.family || version.contractVersion !== row.contractVersion || version.methodSignature !== row.methodSignature || version.resourceInputHash !== row.resourceInputHash || canonicalSerializeGlobal(version.policyVersions) !== canonicalSerializeGlobal(row.policyVersions)) throw new TypeError("GLOBAL_STAGE_MANIFEST_VERSION_MISMATCH");
  }
  return rows;
}
