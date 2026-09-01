import "server-only";

export {
  analyticsMethodSignature,
  historyV2AcceptedMethodSignatures,
  isQueryMaterializationResource,
  materializationPeriod,
  metricArtifactIdentity,
  metricBucketArtifactIdentity,
  historyV2SharedArtifactIdentity,
  historyV2SharedArtifactFamilies,
  querySnapshotIdentity,
  querySnapshotReadIdentities,
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
export { recordAnalyticsMutation } from "./mutation";
export {
  buildHistoryV2Preflight,
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
