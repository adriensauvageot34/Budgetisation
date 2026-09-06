export {
  GLOBAL_M1_METHOD_VERSION,
  adaptGlobalActual,
  adaptGlobalMinimal,
  buildGlobalPersonalEconomicSelection,
  buildGlobalBankEconomyBridge,
  buildGlobalEconomicStructure,
  buildGlobalStructuralChange,
  buildGlobalTypicalPair,
  createGlobalM1DependencyDeclaration,
  globalM1DeferredTemporalOutputs,
  globalM1Policies,
  type GlobalEconomicStructure,
  type GlobalEconomicStructureAxis,
  type GlobalEconomicStructureComponent,
  type GlobalM1DeferredTemporalOutputs,
  type GlobalMinimalAuthority,
  type GlobalPersonalEconomicSelection,
  type GlobalStructuralChange,
  type GlobalStructuralRecurrence,
  type GlobalStructuralRecurrenceCandidate,
  type GlobalTypicalPair,
  type OfficialMonthlyEconomicInput,
  projectGlobalEconomicStructureMonth,
} from "./economic-function";
export {
  GlobalTemporalBoundaryResolver,
  type GlobalTemporalBoundaryResolution,
  type GlobalTemporalSupportPolicy,
  type GlobalTemporalUnitCandidate,
} from "./temporal-boundary";
export {
  GLOBAL_M2_METHOD_VERSION,
  buildGlobalCategoryNeeds,
  createGlobalM2DependencyDeclaration,
  decomposeGlobalPurchaseFrequencyTicket,
  globalM2Policies,
  projectGlobalM2Month,
  resolveGlobalM2NeedDimension,
  type GlobalCategoryNeedsResult,
  type GlobalM2Axis,
  type GlobalM2Contributor,
  type GlobalM2DimensionValue,
  type GlobalM2Group,
  type GlobalM2MonthlyComponent,
  type GlobalM2SeriesPoint,
  type GlobalPurchaseEventAmount,
  type GlobalPurchaseFrequencyTicketResult,
} from "./category-needs";
export {
  GLOBAL_MATERIALITY_METHOD_VERSION,
  GlobalMaterialityEngine,
  globalMaterialityPolicies,
  type GlobalMaterialityEvaluation,
  type GlobalMaterialityEvaluationInput,
  type GlobalMaterialityPolicy,
  type GlobalMaterialityPolicyId,
  type GlobalMaterialityStatus,
} from "./materiality";
export { buildGlobalM1Temporal } from "./economic-temporal";
export { buildGlobalTemporalAnalysis } from "./temporal-analysis";
export { buildGlobalTemporalChapters, buildGlobalCurrentRegime } from "./temporal-lifecycle";
export { fuseGlobalTemporalSignals } from "./temporal-fusion";
export { buildGlobalTransformations, transformationSignalCatalog } from "./transformations";
export { projectGlobalTemporalRate } from "./temporal-projection";
export {
  GLOBAL_M4_METHOD_VERSION,
  buildGlobalActivityRhythm,
  buildGlobalM4ActivityTransformations,
  buildGlobalM4RoutineTransformations,
  buildGlobalDayTypeAnalysis,
  buildGlobalRoutineCosts,
  discoverGlobalRoutinePatterns,
  globalRoutinePatternPolicy,
  projectPlaceVisitRoutineRole,
  projectGlobalRoutineDay,
  projectRoutineTemporalSeries,
  type GlobalDayContextAssertion,
  type GlobalDayEconomicCost,
  type GlobalRoutineDay,
  type GlobalRoutineInstance,
  type GlobalRoutineElementAssertion,
  type GlobalRoutineSemanticToken,
  type GlobalRoutineTokenAuthority,
} from "./routines";
export {
  buildGlobalSeasonalPattern,
  globalCycleSeasonalityPolicy,
  type GlobalCycleObservation,
  type GlobalSeasonalKind,
} from "./seasonality";
export { createGlobalM4DependencyDeclaration, globalM4PlaceRoleCapability } from "./routine-dependencies";
export {
  assertGlobalMomentCatalogExhaustive,
  momentComparisonCatalogV1,
  momentComparisonProfiles,
  resolveGlobalMomentType,
  type GlobalMomentComparisonProfile,
  type GlobalMomentComparisonTier,
  type GlobalMomentFacetKey,
  type GlobalMomentFamily,
} from "./moment-catalog";
export {
  GLOBAL_M6_METHOD_VERSION,
  buildGlobalMomentExperiences,
  type GlobalMomentComponentAuthority,
  type GlobalMomentExperienceInput,
  type GlobalMomentFacetValue,
  type GlobalMomentInput,
  type GlobalMomentUnitCostAuthority,
} from "./moments";
export { createGlobalM6DependencyDeclaration } from "./moment-dependencies";
export {
  GLOBAL_M7_METHOD_VERSION,
  buildGlobalPlaceMobility,
  type GlobalEconomicPlaceAttributionInput,
  type GlobalEconomicPlaceAttributionMode,
  type GlobalPlaceEngineInput,
  type GlobalPlaceLifecycle,
  type GlobalPlaceNightEvidence,
  type GlobalPlaceNode,
  type GlobalPlaceResolutionLevel,
  type GlobalPlaceRoleAssertion,
  type GlobalVisitKind,
  type GlobalVisitSemanticEvidence,
} from "./places";
export { createGlobalM7DependencyDeclaration } from "./place-dependencies";
export { recertifyGlobalCDForPlaceAndMoment } from "./place-recertification";
export {
  GLOBAL_M8_METHOD_VERSION,
  buildGlobalPurchaseMerchant,
  decomposeGlobalMerchantFrequencyTicket,
  globalM8Policies,
  type GlobalPurchaseAdjustmentInput,
  type GlobalPurchaseAdjustmentType,
  type GlobalPurchaseEligibilityUniverse,
  type GlobalPurchaseKind,
  type GlobalPurchaseMerchantInput,
  type GlobalPurchaseMerchantResult,
  type GlobalPurchaseMetadataAuthority,
  type GlobalPurchaseOutcome,
} from "./purchases";
export { createGlobalM8DependencyDeclaration } from "./purchase-dependencies";
export {
  GLOBAL_PRODUCT_CAPABILITY_FREEZE_VERSION,
  buildGlobalProductCapabilityClosure,
  globalProductGateCatalog,
  type GlobalProductCapabilityClass,
} from "./product-capabilities";
export {
  GLOBAL_MERCHANT_SUBSTITUTION_METHOD_VERSION,
  GLOBAL_MERCHANT_SUBSTITUTION_POLICY_VERSION,
  areGlobalMerchantChangeOnsetsCompatible,
  buildGlobalMerchantSubstitution,
  meetsGlobalMerchantCounterbalanceThreshold,
  meetsGlobalMerchantEventSupport,
  meetsGlobalMerchantShareShiftThreshold,
  type GlobalMerchantFrequencyMaterialityProof,
  type GlobalMerchantSubstitutionCatalog,
  type GlobalMerchantSubstitutionEvent,
  type GlobalMerchantSubstitutionSignal,
  type GlobalPurchaseCoverageAuthority,
} from "./merchant-substitution";
export {
  GLOBAL_PURCHASE_CONVERGENCE_METHOD_VERSION,
  buildGlobalM2PurchaseEnrichment,
  recertifyGlobalBCDForPurchases,
} from "./purchase-convergence";
export {
  GLOBAL_M9_METHOD_VERSION,
  buildGlobalPersonaMetrics,
  buildGlobalPersonaDifferences,
  selectGlobalPersonaTopDifferences,
  buildObservedPersonalTypicalCost,
  adaptObservedPersonalMonthsFromP01,
  buildGlobalPersonalReferenceCost,
  computeGlobalPersonaInputHash,
  globalPersonaPolicies,
  globalPersonaFamilyCatalog,
  type GlobalPersonaDefinition,
  type GlobalPersonaObservation,
  type GlobalPersonaMetric,
  type GlobalPersonaDifference,
  type GlobalPersonaFamily,
  type GlobalPersonaTemporalStatus,
  type GlobalPersonaDataNature,
  type GlobalObservedPersonalMonth,
  type GlobalObservedPersonalTypicalCost,
  type GlobalPersonalReferenceContribution,
  type GlobalPersonalReferenceCost,
} from "./persona";
export { createGlobalM9DependencyDeclaration } from "./persona-dependencies";
export {
  GLOBAL_M10_METHOD_VERSION,
  SharedParticipationResolver,
  buildGlobalSharedAnalysis,
  buildGlobalSharedObservableSupport,
  computeGlobalSharedInputHash,
  globalSharedInferenceCatalog,
  globalSharedPolicies,
  projectSharedPlaceVisits,
  requiredSharedOverlapMinutes,
  type GlobalParticipantRoster,
  type GlobalParticipationAssertion,
  type GlobalParticipationState,
  type GlobalSharedEconomicContext,
  type GlobalSharedEvidenceLevel,
  type GlobalSharedParticipationInput,
  type GlobalSharedParticipationResult,
  type GlobalSharedResolution,
} from "./shared-participation";
export { projectGlobalSharedActivitiesFromFacts } from "./shared-fact-adapter";
export {
  GLOBAL_SOCIAL_CONTEXT_METHOD_VERSION,
  buildGlobalSocialContextSummary,
  type GlobalSocialContextSummary,
  type GlobalSocialOccurrence,
} from "./social-context";
export { createGlobalM10DependencyDeclaration } from "./shared-dependencies";
export { globalM10CapabilityStates, recertifyGlobalSharedDownstreamClosure } from "./shared-capabilities";
export {
  GLOBAL_PUBLICATION_METHOD_VERSION, GLOBAL_PUBLICATION_POLICY_VERSION,
  GlobalPublicationEngine, aggregateGlobalModuleVisibility,
  type GlobalPublicationDecision, type GlobalPublicationGateInput, type GlobalPublicationPolicy,
  type GlobalPublicationQualification, type GlobalPublicationReasonCode, type GlobalPublicationSurface,
  type GlobalPublicationVisibility, type GlobalSectionClass,
} from "./publication";
export {
  GLOBAL_DEPENDENCY_REGISTRY_VERSION, planGlobalInvalidation,
  type GlobalDependencyDescriptor, type GlobalInvalidationAction, type GlobalInvalidationCause,
  type GlobalInvalidationEvent, type GlobalInvalidationPlan,
} from "./invalidation";
