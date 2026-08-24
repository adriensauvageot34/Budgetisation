export type {
  ActiveMetricId,
  MetricAvailabilityRule,
  MetricProductionOutcome,
  MetricProductionRequest,
  MetricProductionSource,
  MetricProductionStrategy,
  MetricProvenanceRule,
  MetricRegistryEntry,
  MetricSupportPolicy,
  ProducedCountMetric,
  ProducedMetric,
  ProducedMetricIdentity,
  ProducedMoneyMetric,
} from "./types";
export type {
  MethodSemanticChange,
  MethodTechnicalChange,
} from "./registry";
export {
  activeMetricIds,
  findOrphanActiveMetricIds,
  getMetricRegistryEntry,
  isActiveMetricId,
  metricMethodVersions,
  metricRegistry,
  requiresMethodVersionBump,
} from "./registry";
export {
  MetricComputationError,
  MetricProductionContractError,
  metricProductionErrorToApiError,
} from "./errors";
export { produceMetric, produceMetricResult } from "./producer";
export {
  produceMoneyComparison,
} from "./comparison";
export { validateProducedMetric } from "./validation";
export { isFinanceScopeCompleteAndClosed } from "./period-qualification";
export { economicSourceAvailability } from "./economic-availability";
