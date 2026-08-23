import type { ApiError, ApiResponse } from "../../core/api";
import type { HouseholdId } from "../../core/identity";
import type { Instant } from "../../core/time";
import type {
  AnalyticsRevision,
  ContractVersion,
  DataRevision,
} from "../../core/versions";
import type {
  QueryCapabilities,
  QueryCapabilitySelection,
  QueryPermissionDecision,
} from "../capabilities";
import type { QueryDataByResource } from "../read-model-registry";
import type {
  AnyNormalizedQueryRequest,
  NormalizedQueryRequest,
  QueryResourceKey,
  QueryResourceName,
} from "../request";

export type QueryActor = {
  readonly actorId: string;
};

export type AuthorizedHouseholdContext = {
  readonly householdId: HouseholdId;
};

export type QueryDependencyRevision = {
  readonly dependencyId: string;
  readonly status: "fresh" | "stale";
  readonly dataRevision: DataRevision;
  readonly analyticsRevision: AnalyticsRevision;
};

export type QueryRevisionSnapshot = {
  readonly dataRevision: DataRevision;
  readonly analyticsRevision: AnalyticsRevision;
  readonly dependencies: readonly QueryDependencyRevision[];
};

export type QueryServerContext = {
  readonly actor: QueryActor;
  readonly household: AuthorizedHouseholdContext;
  readonly revisions: QueryRevisionSnapshot;
  readonly contractVersion: ContractVersion;
  readonly now: Instant;
};

export type QueryAdapterExecutionContext = QueryServerContext & {
  readonly requestId: string;
  readonly capabilities: QueryCapabilities;
};

export type QueryReadModelSource<Name extends QueryResourceName> = (
  input: {
    readonly request: NormalizedQueryRequest<Name>;
    readonly context: QueryAdapterExecutionContext;
  },
) => Promise<QueryDataByResource[Name]> | QueryDataByResource[Name];

export type QueryReadModelSources = {
  readonly readMetricMethodology: QueryReadModelSource<"metric_methodology">;
  readonly readMetricCatalogPreview: QueryReadModelSource<"metric_catalog_preview">;
  readonly readMetricCatalogCollection: QueryReadModelSource<"metric_catalog_collection">;
  readonly readHistoryCalendarMonth: QueryReadModelSource<"history_calendar_month">;
  readonly readHistoryCalendarMonthSummary: QueryReadModelSource<"history_calendar_month_summary">;
  readonly readHistoryDayDetail: QueryReadModelSource<"history_day_detail">;
  readonly readAnalysisMonthInitial: QueryReadModelSource<"analysis_month_initial">;
  readonly readAnalysisMonthBreakdown: QueryReadModelSource<"analysis_month_breakdown">;
  readonly readAnalysisMonthEvolution: QueryReadModelSource<"analysis_month_evolution">;
  readonly readAnalysisMonthContexts: QueryReadModelSource<"analysis_month_contexts">;
  readonly readAnalysisGlobalInitial: QueryReadModelSource<"analysis_global_initial">;
  readonly readAnalysisGlobalBreakdown: QueryReadModelSource<"analysis_global_breakdown">;
  readonly readAnalysisGlobalEvolution: QueryReadModelSource<"analysis_global_evolution">;
  readonly readAnalysisGlobalContexts: QueryReadModelSource<"analysis_global_contexts">;
  readonly readEntityPlace: QueryReadModelSource<"entity_place">;
  readonly readEntityMerchant: QueryReadModelSource<"entity_merchant">;
  readonly readEntityMoment: QueryReadModelSource<"entity_moment">;
  readonly readEntityPersona: QueryReadModelSource<"entity_persona">;
  readonly readEntityLifeEvent: QueryReadModelSource<"entity_life_event">;
  readonly readEntityOperation: QueryReadModelSource<"entity_operation">;
  readonly readGalleryMoments: QueryReadModelSource<"gallery_moments">;
  readonly readGalleryPlaces: QueryReadModelSource<"gallery_places">;
  readonly readGalleryMerchants: QueryReadModelSource<"gallery_merchants">;
  readonly readOperationsBrowse: QueryReadModelSource<"operations_browse">;
};

export type QueryServerAdapter<Name extends QueryResourceName> = {
  readonly resource: QueryResourceKey<Name>;
  readonly execute: (
    request: NormalizedQueryRequest<Name>,
    context: QueryAdapterExecutionContext,
    sources: QueryReadModelSources,
  ) => Promise<QueryDataByResource[Name]>;
};

export type AnyQueryServerAdapter = {
  readonly [Name in QueryResourceName]: QueryServerAdapter<Name>;
}[QueryResourceName];

export type QueryServerServices = {
  readonly resolveContext: (input: {
    readonly requestId: string;
  }) => Promise<QueryServerContext> | QueryServerContext;
  readonly authorize: (input: {
    readonly request: AnyNormalizedQueryRequest;
    readonly context: QueryServerContext;
  }) => Promise<QueryPermissionDecision> | QueryPermissionDecision;
  readonly resolveApplicability?: (input: {
    readonly request: AnyNormalizedQueryRequest;
    readonly context: QueryServerContext;
  }) => Promise<
    QueryCapabilitySelection & { readonly resourceApplicable?: boolean }
  > | (QueryCapabilitySelection & { readonly resourceApplicable?: boolean });
  readonly contractSupport?: QueryCapabilitySelection;
  readonly sources: QueryReadModelSources;
  readonly onTrace?: (trace: QueryTrace) => void;
};

export type QueryTraceOutcome =
  | "success"
  | "permission_denied"
  | "not_found"
  | "invalid_scope"
  | "contract_mismatch"
  | "computation_failed"
  | "temporary_unavailable";

export type QueryTrace = {
  readonly requestId: string;
  readonly resource?: QueryResourceKey;
  readonly scopeHash?: string;
  readonly normalizedParamSignature?: string;
  readonly dataRevision?: DataRevision;
  readonly analyticsRevision?: AnalyticsRevision;
  readonly durationMs: number;
  readonly outcome: QueryTraceOutcome;
};

export type QueryExecutionResult<Name extends QueryResourceName> =
  | { readonly ok: true; readonly response: ApiResponse<QueryDataByResource[Name]> }
  | { readonly ok: false; readonly error: ApiError };
