export {
  QueryIncompatibleFilterError,
  QueryScopeCompatibilityError,
  evaluateQueryCapabilities,
} from "./engine";
export {
  getQueryCapabilityMaximum,
  parseQuerySectionKey,
  queryCapabilityRegistry,
  querySectionKeys,
  type QuerySectionName,
} from "./registry";
export type {
  QueryCapabilities,
  QueryCapabilityEvaluationContext,
  QueryCapabilityMaximum,
  QueryCapabilityResult,
  QueryCapabilitySelection,
  QueryFilterKey,
  QueryPermissionDecision,
  QuerySectionKey,
  QueryUnavailableCapability,
  UnavailableReason,
} from "./types";
export { queryFilterKeys } from "./types";
export {
  intersectActiveMetricIds,
  parseQueryCapabilities,
  parseQueryFilterKey,
  parseUnavailableReason,
} from "./validation";
