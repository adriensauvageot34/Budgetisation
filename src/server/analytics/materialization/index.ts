import "server-only";

export {
  analyticsMethodSignature,
  historyV2AcceptedMethodSignatures,
  isQueryMaterializationResource,
  legacyGlobalReadThroughResources,
  materializationPeriod,
  metricArtifactIdentity,
  metricBucketArtifactIdentity,
  historyV2SharedArtifactIdentity,
  historyV2SharedArtifactFamilies,
  querySnapshotIdentity,
  querySnapshotReadIdentities,
  shouldSkipLegacyGlobalReadThroughWrite,
  type HistoryV2SharedArtifactFamily,
  type HistoryV2SharedArtifactIdentity,
  type MaterializationPeriodIdentity,
  type MaterializationRevisionPolicy,
  type MetricArtifactIdentity,
  type QuerySnapshotIdentity,
  type QuerySnapshotContractVariant,
  type QuerySnapshotReadIdentity,
} from "./identity";
export { aggregateAdditiveMonthlyMetrics } from "./global-planner";
export {
  areMaterializationVersionsCompatible,
  isScopedMaterializationFresh,
} from "./freshness";
export { SupabaseAnalyticsPublicationStore } from "./publication-store";
export { SupabaseHistoryManifestStore, type HistoryManifestRead } from "./history-manifest-store";
export { SupabaseGlobalManifestStore, type GlobalManifestRead } from "./global-manifest-store";
export {
  buildGlobalV2PublicationManifest,
  globalV2ManifestFormatVersion,
  globalV2MaterializationProfile,
  globalV2PublicationContractVersion,
  globalV2PublicationProfileId,
  globalV2ResourceFamilies,
  parseGlobalV2PublicationManifest,
  stageGlobalV2GenerationInMemory,
  type GlobalV2Closure,
  type GlobalV2ManifestInput,
  type GlobalV2PublicationManifest,
  type GlobalV2PublicationMeta,
  type GlobalV2ResolvedDependency,
  type GlobalV2ResourceVersion,
  type GlobalV2StagedResource,
} from "./global-v2";
export { InMemoryGlobalPublicationCoordinator } from "./global-session";
export {
  assertGlobalV2NoResidualKeys,
  attachGlobalV2QueryPlanToManifest,
  buildGlobalV2QueryPlan,
  globalV2QueryInstanceKey,
  globalV2QueryMethodSignature,
  globalV2QueryResourceInputHash,
  type GlobalV2QueryInstance,
  type GlobalV2QueryInstanceInput,
  type GlobalV2QueryPlan,
} from "./global-query-plan";
export { buildHistoryMonth, finalizeHistoryPublication, validateHistoryMonthBuild,
  type CertifiedHistoryMonth, type HistoryMonthCertification, type HistoryMonthGeneration } from "./history-rebuild";
export { recordAnalyticsMutation } from "./mutation";
export {
  buildHistoryV2Preflight,
  historyV2DependencyManifestSchema,
  createHistoryV2TheoreticalManifest,
  discoverHistoryV2QueryTargets,
  historyV2PublicationProfileId,
  historyV2MaterializationProfile,
  historyV2QueryResources,
  historyV2ReadOnlyBackfillProfile,
  historyV2ReadOnlyBackfillProfileId,
  historyV2StagedArtifactEnvelopeSchema,
  historyV2TopLevelResources,
  stageHistoryV2GenerationInMemory,
  type HistoryV2ArtifactPayloadByFamily,
  type HistoryV2ExternalQueryRef,
  type HistoryV2InMemoryStage,
  type HistoryV2ManifestFactDependency,
  type HistoryV2ManifestQuery,
  type HistoryV2MonthManifest,
  type HistoryV2PreflightArtifact,
  type HistoryV2PreflightResult,
  type HistoryV2QueryBuildResult,
  type HistoryV2StagedArtifactEnvelope,
} from "./history-v2";
export {
  SupabaseAnalyticsMaterializationStore,
  type AnalyticsMaterializationStoreOptions,
  type QueryMaterializationHit,
} from "./store";
