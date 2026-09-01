import "server-only";

import { createHash } from "node:crypto";
import {
  activeMetricIds,
  getMetricRegistryEntry,
  metricMethodVersions,
  type ActiveMetricId,
} from "@/analytics/production";
import {
  resolvePolicyVersions,
  type PolicyVersions,
} from "@/core/history-v2";
import type { HouseholdId, PersonId } from "@/core/identity";
import {
  computeScopeHash,
  normalizeAnalysisScope,
  type AnalysisScope,
  type NormalizedAnalysisScope,
  type ScopeHash,
} from "@/core/scope";
import type { YearMonth } from "@/core/time";
import type {
  AnalyticsRevision,
  ContractVersion,
  DataRevision,
  MethodVersion,
} from "@/core/versions";
import {
  parseContractVersion,
  parseMethodVersion,
  parsePolicyVersion,
} from "@/core/versions";
import {
  canonicalSerializeQueryParams,
  createQueryCacheKey,
  getQueryResourceContract,
  queryResourceKeys,
  type AnyNormalizedQueryRequest,
  type QueryResourceKey,
} from "@/query-api";
import type { AuthorizedRuntimeContext } from "@/server/canonical/context";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalHash(value: Readonly<Record<string, unknown>>): string {
  return sha256(canonicalSerializeQueryParams(value));
}

export type MaterializationPeriodIdentity =
  | {
      readonly kind: "month";
      readonly month: YearMonth;
      readonly isClosed: boolean;
      readonly sourceRevision: DataRevision;
    }
  | {
      readonly kind: "global";
      readonly asOf: YearMonth;
      readonly isClosed: false;
      readonly sourceRevision: DataRevision;
    };

export type MaterializationRevisionPolicy = "published" | "current";

export type MaterializationSubjectIdentity =
  | { readonly kind: "household" }
  | { readonly kind: "person"; readonly personId: PersonId };

export type MetricArtifactIdentity = {
  readonly artifactKey: string;
  readonly artifactFamily: "metric" | "metric_bucket";
  readonly dimensionKey: string | null;
  readonly bucketKey: string | null;
  readonly householdId: HouseholdId;
  readonly subject: MaterializationSubjectIdentity;
  readonly period: MaterializationPeriodIdentity;
  readonly scopeHash: ScopeHash;
  readonly filterSignature: string;
  readonly metricId: ActiveMetricId;
  readonly methodVersion: MethodVersion;
  readonly contractVersion: ContractVersion;
  readonly analyticsRevision: AnalyticsRevision;
};

export const historyV2SharedArtifactFamilies = Object.freeze([
  "calendar_semantic_month",
  "daily_economic_ledger_month",
] as const);

export type HistoryV2SharedArtifactFamily =
  (typeof historyV2SharedArtifactFamilies)[number];

export type HistoryV2SharedArtifactIdentity = {
  readonly artifactKey: string;
  readonly artifactFamily: HistoryV2SharedArtifactFamily;
  readonly metricId: string;
  readonly householdId: HouseholdId;
  readonly subject: { readonly kind: "household" };
  readonly period: Extract<MaterializationPeriodIdentity, { readonly kind: "month" }>;
  readonly scopeHash: ScopeHash;
  readonly filterSignature: string;
  readonly methodVersion: MethodVersion;
  readonly contractVersion: ContractVersion;
  readonly analyticsRevision: AnalyticsRevision;
};

export type QuerySnapshotIdentity = {
  readonly queryKey: string;
  readonly householdId: HouseholdId;
  readonly subject: MaterializationSubjectIdentity;
  readonly period: MaterializationPeriodIdentity;
  readonly resource: QueryResourceKey;
  readonly scopeHash: ScopeHash;
  readonly normalizedParamSignature: string;
  readonly methodSignature: string;
  readonly contractVersion: ContractVersion;
  readonly analyticsRevision: AnalyticsRevision;
};

export type QuerySnapshotContractVariant =
  | "current"
  | "history_v2_visible_gaps_legacy";

export type QuerySnapshotReadIdentity = QuerySnapshotIdentity & {
  readonly contractVariant: QuerySnapshotContractVariant;
};

const historyV2VisibleGapsMigratedResources = new Set<QueryResourceKey>([
  queryResourceKeys.historyMonthCalendar,
  queryResourceKeys.historyWeek,
  queryResourceKeys.historyDayJournal,
  queryResourceKeys.historyMonthOverview,
  queryResourceKeys.historyCategoryDetail,
  queryResourceKeys.historyMonthSpendingNature,
  queryResourceKeys.historySpendingSegmentDetail,
  queryResourceKeys.historyMinimalPreview,
  queryResourceKeys.historyMonthLifeMoney,
  queryResourceKeys.historyActivityDetail,
  queryResourceKeys.historyMomentDetail,
  queryResourceKeys.historyPlaceDetail,
]);

function legacyV1AnalyticsMethodSignature(): string {
  return canonicalHash({
    methods: Object.fromEntries(
      activeMetricIds.map((metricId) => [metricId, metricMethodVersions[metricId]]),
    ),
    queryContracts: {
      historyCalendar: "history-calendar@v2",
    },
  });
}

export function analyticsMethodSignature(
  resource?: QueryResourceKey,
): string {
  if (resource === undefined) {
    return legacyV1AnalyticsMethodSignature();
  }
  const resourceContract = getQueryResourceContract(resource);
  if (resourceContract.family === "legacy_v1") {
    return legacyV1AnalyticsMethodSignature();
  }
  return historyV2ResourceMethodSignature(
    resource,
    resolvePolicyVersions(resourceContract.policyIds),
  );
}

export function historyV2ResourceMethodSignature(
  resource: QueryResourceKey,
  policyVersions: PolicyVersions,
  options: { readonly readModelVersion?: MethodVersion | null } = {},
): string {
  const resourceContract = getQueryResourceContract(resource);
  if (resourceContract.family !== "history_v2") {
    throw new TypeError(
      `La ressource ${resource} n'est pas une ressource History V2.`,
    );
  }
  const metricIds = resourceContract.metricIds.map((metricId) => {
    if (!activeMetricIds.includes(metricId as ActiveMetricId)) {
      throw new TypeError(
        `La ressource ${resource} dépend d'un MetricId inactif: ${metricId}.`,
      );
    }
    const activeMetricId = metricId as ActiveMetricId;
    return [
      activeMetricId,
      getMetricRegistryEntry(activeMetricId).methodVersion,
    ] as const;
  });
  const scopedPolicies = Object.fromEntries(
    resourceContract.policyIds.map((policyId) => {
      const version = policyVersions[policyId];
      if (version === undefined) {
        throw new TypeError(
          `La signature ${resource} requiert la policy ${policyId}.`,
        );
      }
      return [policyId, version] as const;
    }),
  );
  const readModelVersion = options.readModelVersion === null
    ? undefined
    : options.readModelVersion ?? resourceContract.readModelVersion;
  return canonicalHash({
    contractVersion: resourceContract.contractVersion,
    metricMethods: Object.fromEntries(metricIds),
    policies: scopedPolicies,
    ...(readModelVersion === undefined
      ? {}
      : { readModelVersion }),
  });
}

export function historyV2AcceptedMethodSignatures(
  resource: QueryResourceKey,
): readonly {
  readonly methodSignature: string;
  readonly contractVariant: QuerySnapshotContractVariant;
}[] {
  const current = analyticsMethodSignature(resource);
  if (!historyV2VisibleGapsMigratedResources.has(resource)) {
    return [{ methodSignature: current, contractVariant: "current" }];
  }
  const contract = getQueryResourceContract(resource);
  if (contract.family !== "history_v2") {
    return [{ methodSignature: current, contractVariant: "current" }];
  }
  const legacyPolicies = Object.freeze(Object.fromEntries(
    contract.policyIds.map((policyId) => [policyId, parsePolicyVersion("v1")]),
  )) as PolicyVersions;
  const legacy = historyV2ResourceMethodSignature(
    resource,
    legacyPolicies,
    resource === "history_month_spending_nature"
      ? { readModelVersion: null }
      : {},
  );
  return legacy === current
    ? [{ methodSignature: current, contractVariant: "current" }]
    : [
        { methodSignature: current, contractVariant: "current" },
        {
          methodSignature: legacy,
          contractVariant: "history_v2_visible_gaps_legacy",
        },
      ];
}

export function materializationPeriod(
  context: AuthorizedRuntimeContext,
  scope: NormalizedAnalysisScope,
  revisionPolicy: MaterializationRevisionPolicy = "published",
): MaterializationPeriodIdentity {
  if (scope.time.kind === "global") {
    return {
      kind: "global",
      asOf: scope.time.asOf,
      isClosed: false,
      sourceRevision: context.dataRevision,
    };
  }
  const month = scope.time.month;
  const period = context.periods.find(
    ({ month: candidate }) => candidate.slice(0, 7) === month,
  );
  return {
    kind: "month",
    month,
    isClosed: period?.isClosed ?? false,
    sourceRevision: revisionPolicy === "current"
      ? context.dataRevision
      : period?.sourceRevision ?? context.dataRevision,
  };
}

export function metricArtifactIdentity(
  context: AuthorizedRuntimeContext,
  metricId: ActiveMetricId,
  scope: AnalysisScope,
  revisionPolicy: MaterializationRevisionPolicy = "published",
): MetricArtifactIdentity {
  const normalized = normalizeAnalysisScope(scope);
  const scopeHash = computeScopeHash(normalized);
  const definition = getMetricRegistryEntry(metricId);
  const period = materializationPeriod(context, normalized, revisionPolicy);
  const subject = normalized.subject.kind === "household"
    ? { kind: "household" as const }
    : { kind: "person" as const, personId: normalized.subject.personId };
  const filterSignature = canonicalHash({ filters: normalized.filters });
  const artifactKey = canonicalHash({
    householdId: context.householdId,
    subject,
    period: period.kind === "month"
      ? { kind: period.kind, month: period.month }
      : { kind: period.kind, asOf: period.asOf },
    artifactFamily: "metric",
    metricId,
    scopeHash,
    filterSignature,
    methodVersion: definition.methodVersion,
    contractVersion: context.contractVersion,
  });
  return {
    artifactKey,
    artifactFamily: "metric",
    dimensionKey: null,
    bucketKey: null,
    householdId: context.householdId,
    subject,
    period,
    scopeHash,
    filterSignature,
    metricId,
    methodVersion: definition.methodVersion,
    contractVersion: context.contractVersion,
    analyticsRevision: context.analyticsRevision,
  };
}

export function metricBucketArtifactIdentity(
  context: AuthorizedRuntimeContext,
  metricId: ActiveMetricId,
  scope: AnalysisScope,
  dimensionKey: string,
  bucketKey: string,
  revisionPolicy: MaterializationRevisionPolicy = "published",
): MetricArtifactIdentity {
  if (dimensionKey.length === 0 || bucketKey.length === 0) {
    throw new TypeError("Une identité d'artefact atomique exige dimension et bucket.");
  }
  const base = metricArtifactIdentity(context, metricId, scope, revisionPolicy);
  return {
    ...base,
    artifactKey: canonicalHash({
      householdId: base.householdId,
      subject: base.subject,
      period: base.period.kind === "month"
        ? { kind: base.period.kind, month: base.period.month }
        : { kind: base.period.kind, asOf: base.period.asOf },
      artifactFamily: "metric_bucket",
      metricId,
      scopeHash: base.scopeHash,
      filterSignature: base.filterSignature,
      dimensionKey,
      bucketKey,
      methodVersion: base.methodVersion,
      contractVersion: base.contractVersion,
    }),
    artifactFamily: "metric_bucket",
    dimensionKey,
    bucketKey,
  };
}

export function historyV2SharedArtifactIdentity(
  context: AuthorizedRuntimeContext,
  month: YearMonth,
  artifactFamily: HistoryV2SharedArtifactFamily,
  revisionPolicy: MaterializationRevisionPolicy = "published",
): HistoryV2SharedArtifactIdentity {
  if (!historyV2SharedArtifactFamilies.includes(artifactFamily)) {
    throw new TypeError(`Famille d'artifact History V2 inconnue: ${artifactFamily}.`);
  }
  const scope = normalizeAnalysisScope({
    subject: { kind: "household" },
    time: { kind: "month", month },
  });
  const period = materializationPeriod(context, scope, revisionPolicy);
  if (period.kind !== "month") {
    throw new TypeError("Un artifact History V2 partagé doit être mensuel.");
  }
  const scopeHash = computeScopeHash(scope);
  const methodVersion = parseMethodVersion(
    artifactFamily === "calendar_semantic_month"
      ? "calendar_semantic_month@v3"
      : `${artifactFamily}@v1`,
  );
  const contractVersion = parseContractVersion("v2");
  const metricId = `history_v2:${artifactFamily}`;
  const filterSignature = canonicalHash({ filters: scope.filters });
  const artifactKey = canonicalHash({
    householdId: context.householdId,
    subject: { kind: "household" },
    period: { kind: "month", month },
    artifactFamily,
    metricId,
    scopeHash,
    filterSignature,
    methodVersion,
    contractVersion,
  });
  return {
    artifactKey,
    artifactFamily,
    metricId,
    householdId: context.householdId,
    subject: { kind: "household" },
    period,
    scopeHash,
    filterSignature,
    methodVersion,
    contractVersion,
    analyticsRevision: context.analyticsRevision,
  };
}

function querySnapshotIdentityForMethodSignature(
  context: AuthorizedRuntimeContext,
  request: AnyNormalizedQueryRequest,
  methodSignature: string,
  revisionPolicy: MaterializationRevisionPolicy = "published",
): QuerySnapshotIdentity {
  const scope = request.scope as NormalizedAnalysisScope;
  const period = materializationPeriod(context, scope, revisionPolicy);
  const subject = scope.subject.kind === "household"
    ? { kind: "household" as const }
    : { kind: "person" as const, personId: scope.subject.personId };
  const resourceContract = getQueryResourceContract(request.resource);
  const normalizedParamSignature = canonicalHash({ params: request.params });
  const logicalKey = createQueryCacheKey({
    resource: request.resource,
    scopeHash: request.scopeHash,
    normalizedParams: request.params,
  });
  const queryKey = canonicalHash({
    householdId: context.householdId,
    logicalKey,
    contractVersion: resourceContract.contractVersion,
    methodSignature,
  });
  return {
    queryKey,
    householdId: context.householdId,
    subject,
    period,
    resource: request.resource,
    scopeHash: request.scopeHash,
    normalizedParamSignature,
    methodSignature,
    contractVersion: resourceContract.contractVersion,
    analyticsRevision: context.analyticsRevision,
  };
}

export function querySnapshotIdentity(
  context: AuthorizedRuntimeContext,
  request: AnyNormalizedQueryRequest,
  revisionPolicy: MaterializationRevisionPolicy = "published",
): QuerySnapshotIdentity {
  return querySnapshotIdentityForMethodSignature(
    context,
    request,
    analyticsMethodSignature(request.resource),
    revisionPolicy,
  );
}

export function querySnapshotReadIdentities(
  context: AuthorizedRuntimeContext,
  request: AnyNormalizedQueryRequest,
  revisionPolicy: MaterializationRevisionPolicy = "published",
): readonly QuerySnapshotReadIdentity[] {
  return historyV2AcceptedMethodSignatures(request.resource).map((accepted) => ({
    ...querySnapshotIdentityForMethodSignature(
      context,
      request,
      accepted.methodSignature,
      revisionPolicy,
    ),
    contractVariant: accepted.contractVariant,
  }));
}

export function isQueryMaterializationResource(resource: QueryResourceKey): boolean {
  return resource.startsWith("history_")
    || resource.startsWith("analysis_month_")
    || resource.startsWith("analysis_global_")
    || resource === "analysis_target";
}
