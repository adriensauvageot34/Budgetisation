import type {
  AnalysisScope,
  NormalizedAnalysisScope,
  ScopeHash,
} from "../../core/scope";
import type {
  NormalizedQueryParamsByResource,
  QueryParamsByResource,
  QueryResourceName,
} from "./resource-registry";
import type { QueryResourceKey } from "./resource-key";
import type { OperationsExecutionScope, NormalizedOperationsExecutionScope } from "./operations-scope";

export type QueryScopeByResource<Name extends QueryResourceName> =
  Name extends "operations_browse" ? OperationsExecutionScope : AnalysisScope;
export type NormalizedQueryScopeByResource<Name extends QueryResourceName> =
  Name extends "operations_browse" ? NormalizedOperationsExecutionScope : NormalizedAnalysisScope;

export type QueryRequest<Name extends QueryResourceName> = {
  readonly resource: QueryResourceKey<Name>;
  readonly scope: QueryScopeByResource<Name>;
  readonly params: QueryParamsByResource[Name];
};

export type NormalizedQueryRequest<Name extends QueryResourceName> = {
  readonly resource: QueryResourceKey<Name>;
  readonly scope: NormalizedQueryScopeByResource<Name>;
  readonly scopeHash: ScopeHash;
  readonly params: NormalizedQueryParamsByResource[Name];
};

export type AnyNormalizedQueryRequest = {
  readonly [Name in QueryResourceName]: NormalizedQueryRequest<Name>;
}[QueryResourceName];

export type QueryResourceIdentity<Name extends QueryResourceName> = {
  readonly resource: QueryResourceKey<Name>;
  readonly scopeHash: ScopeHash;
  readonly normalizedParams: NormalizedQueryParamsByResource[Name];
};

export type AnyQueryResourceIdentity = {
  readonly [Name in QueryResourceName]: QueryResourceIdentity<Name>;
}[QueryResourceName];
