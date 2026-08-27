import "server-only";

import { createHash } from "node:crypto";
import {
  activeMetricIds,
  getMetricRegistryEntry,
  metricMethodVersions,
  type ActiveMetricId,
} from "@/analytics/production";
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
  canonicalSerializeQueryParams,
  createQueryCacheKey,
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

export function analyticsMethodSignature(): string {
  return canonicalHash({
    methods: Object.fromEntries(
      activeMetricIds.map((metricId) => [metricId, metricMethodVersions[metricId]]),
    ),
    queryContracts: {
      historyCalendar: "history-calendar@v2",
    },
  });
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

export function querySnapshotIdentity(
  context: AuthorizedRuntimeContext,
  request: AnyNormalizedQueryRequest,
  revisionPolicy: MaterializationRevisionPolicy = "published",
): QuerySnapshotIdentity {
  const scope = request.scope as NormalizedAnalysisScope;
  const period = materializationPeriod(context, scope, revisionPolicy);
  const subject = scope.subject.kind === "household"
    ? { kind: "household" as const }
    : { kind: "person" as const, personId: scope.subject.personId };
  const methodSignature = analyticsMethodSignature();
  const normalizedParamSignature = canonicalHash({ params: request.params });
  const logicalKey = createQueryCacheKey({
    resource: request.resource,
    scopeHash: request.scopeHash,
    normalizedParams: request.params,
  });
  const queryKey = canonicalHash({
    householdId: context.householdId,
    logicalKey,
    contractVersion: context.contractVersion,
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
    contractVersion: context.contractVersion,
    analyticsRevision: context.analyticsRevision,
  };
}

export function isQueryMaterializationResource(resource: QueryResourceKey): boolean {
  return resource.startsWith("history_")
    || resource.startsWith("analysis_month_")
    || resource.startsWith("analysis_global_")
    || resource === "analysis_target";
}
