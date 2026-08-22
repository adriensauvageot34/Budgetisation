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

export type QueryRequest<Name extends QueryResourceName> = {
  readonly resource: QueryResourceKey<Name>;
  readonly scope: AnalysisScope;
  readonly params: QueryParamsByResource[Name];
};

export type NormalizedQueryRequest<Name extends QueryResourceName> = {
  readonly resource: QueryResourceKey<Name>;
  readonly scope: NormalizedAnalysisScope;
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
