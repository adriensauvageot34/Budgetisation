import "server-only";

export {
  assertQueryRegistryParity,
  getQueryServerAdapter,
  inspectQueryRegistryParity,
  queryAdapterRegistry,
  type QueryRegistryParity,
} from "./adapter-registry";
export { validateQueryServerContext } from "./context";
export {
  QueryExecutionError,
  QueryNotFoundError,
  QueryTemporaryUnavailableError,
  queryApiError,
} from "./errors";
export { executeQuery } from "./execute-query";
export {
  invalidatesQueryResource,
  queryResourcesInvalidatedByImpact,
} from "./invalidation";
export {
  assertPageRevisionCompatible,
  assertQueryRevisionCoherence,
} from "./revision-coherence";
export { metricRegistryQuerySources } from "./registry-sources";
export { assertQueryDataMatchesRequest, validateQueryData } from "./validation";
export type {
  AnyQueryServerAdapter,
  AuthorizedHouseholdContext,
  QueryAdapterExecutionContext,
  QueryDependencyRevision,
  QueryExecutionResult,
  QueryReadModelSource,
  QueryReadModelSources,
  QueryRevisionSnapshot,
  QueryServerAdapter,
  QueryServerContext,
  QueryServerServices,
  QuerySnapshotContractVariant,
  QueryTrace,
  QueryTraceOutcome,
} from "./types";
