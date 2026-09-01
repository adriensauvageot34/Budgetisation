import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateProducedMetric,
  type ActiveMetricId,
  type ProducedMetric,
} from "@/analytics/production";
import type { ApiMeta } from "@/core/api";
import { parseYearMonth, type YearMonth } from "@/core/time";
import { normalizeAnalysisScope, type AnalysisScope } from "@/core/scope";
import { resolveGlobalWindowMonths } from "@/core/time";
import type { DataRevision } from "@/core/versions";
import { parseDataRevision } from "@/core/versions";
import {
  getQueryResourceContract,
  queryResourceKeys,
  type AnyNormalizedQueryRequest,
} from "@/query-api";
import type { AuthorizedRuntimeContext } from "@/server/canonical/context";
import { safeRuntimeEnvironment } from "@/server/runtime-environment";
import {
  isQueryMaterializationResource,
  materializationPeriod,
  metricArtifactIdentity,
  metricBucketArtifactIdentity,
  historyV2SharedArtifactIdentity,
  analyticsMethodSignature,
  historyV2AcceptedMethodSignatures,
  querySnapshotIdentity,
  querySnapshotReadIdentities,
  type HistoryV2SharedArtifactFamily,
  type MaterializationPeriodIdentity,
  type MetricArtifactIdentity,
  type QuerySnapshotIdentity,
  type QuerySnapshotContractVariant,
} from "./identity";
import {
  historyV2StagedArtifactEnvelopeSchema,
  type HistoryV2StagedArtifactEnvelope,
} from "./history-v2";
import { aggregateAdditiveMonthlyMetrics } from "./global-planner";
import { isScopedMaterializationFresh } from "./freshness";

type MaterializationError = { readonly code?: string; readonly message?: string };

function isMissingMaterialization(error: MaterializationError): boolean {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42P01"
    || message.includes("analytics_artifacts")
    || message.includes("analytics_query_snapshots");
}

function revisionNumber(value: unknown): bigint {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new TypeError("Révision de matérialisation invalide.");
  }
  return BigInt(value);
}

function safeMaterializationLog(
  event: string,
  input: {
    readonly resource?: string;
    readonly scopeKind: "month" | "global";
    readonly durationMs: number;
    readonly sourceRevision: DataRevision;
  },
): void {
  const build = safeRuntimeEnvironment();
  console.info(event, {
    ...(input.resource === undefined ? {} : { resource: input.resource }),
    scopeKind: input.scopeKind,
    durationMs: input.durationMs,
    sourceRevision: input.sourceRevision,
    environment: build.environment,
    commitSha: build.commitSha,
  });
}

function periodColumns(period: MaterializationPeriodIdentity) {
  return period.kind === "month"
    ? { period_kind: "month", period_month: `${period.month}-01`, as_of_month: null }
    : { period_kind: "global", period_month: null, as_of_month: `${period.asOf}-01` };
}

function subjectColumns(subject: MetricArtifactIdentity["subject"]) {
  return subject.kind === "household"
    ? { subject_kind: "household", subject_id: null }
    : { subject_kind: "person", subject_id: subject.personId };
}

export type QueryMaterializationHit = {
  readonly data: unknown;
  readonly cachePolicy: NonNullable<ApiMeta["cachePolicy"]>;
  readonly methodSignature: string;
  readonly contractVariant: QuerySnapshotContractVariant;
};

export type AnalyticsMaterializationStoreOptions = {
  readonly publicationId?: string;
  readonly readMode?: "read-through" | "bypass";
};

export class SupabaseAnalyticsMaterializationStore {
  private unavailable = false;
  private readonly impactRevisionCache = new Map<string, Promise<bigint>>();

  constructor(
    private readonly client: SupabaseClient,
    readonly context: AuthorizedRuntimeContext,
    private readonly options: AnalyticsMaterializationStoreOptions = {},
  ) {}

  private cachePolicy(
    period: MaterializationPeriodIdentity,
    source: "materialized" | "computed",
  ): NonNullable<ApiMeta["cachePolicy"]> {
    return {
      source,
      revalidate: period.kind === "month" && period.isClosed
        ? "never"
        : "stale_while_revalidate",
      sourceRevision: period.sourceRevision,
    };
  }

  private async latestImpactRevision(
    period: MaterializationPeriodIdentity,
    includeGlobalReference: boolean,
  ): Promise<bigint> {
    const key = period.kind === "global"
      ? "global"
      : `${period.month}:${includeGlobalReference ? "with-global" : "month-only"}`;
    const existing = this.impactRevisionCache.get(key);
    if (existing !== undefined) return existing;
    const promise = (async () => {
      if (period.kind === "global") {
        const { data, error } = await this.client
          .from("analytics_change_log")
          .select("data_revision::text")
          .eq("household_id", this.context.householdId)
          .order("data_revision", { ascending: false })
          .limit(1);
        if (error !== null) throw error;
        return data?.[0] === undefined ? BigInt(0) : revisionNumber(data[0].data_revision);
      }
      const reads = [
        this.client
          .from("analytics_change_log")
          .select("data_revision::text")
          .eq("household_id", this.context.householdId)
          .eq("affected_month", `${period.month}-01`)
          .order("data_revision", { ascending: false })
          .limit(1),
        ...(includeGlobalReference
          ? [this.client
              .from("analytics_change_log")
              .select("data_revision::text")
              .eq("household_id", this.context.householdId)
              .eq("impact_scope", "global_reference")
              .lte("affected_month", `${period.month}-01`)
              .order("data_revision", { ascending: false })
              .limit(1)]
          : []),
      ];
      const results = await Promise.all(reads);
      let latest = BigInt(0);
      for (const result of results) {
        if (result.error !== null) throw result.error;
        if (result.data?.[0] !== undefined) {
          const revision = revisionNumber(result.data[0].data_revision);
          if (revision > latest) latest = revision;
        }
      }
      return latest;
    })();
    this.impactRevisionCache.set(key, promise);
    return promise;
  }

  private async isFresh(
    rowSourceRevision: unknown,
    period: MaterializationPeriodIdentity,
    includeGlobalReference: boolean,
  ): Promise<boolean> {
    const rowRevision = revisionNumber(rowSourceRevision);
    const latestImpactRevision = period.kind === "global" || !period.isClosed
      ? BigInt(0)
      : await this.latestImpactRevision(period, includeGlobalReference);
    return isScopedMaterializationFresh({
      rowSourceRevision: rowRevision,
      currentDataRevision: revisionNumber(this.context.dataRevision),
      period,
      latestImpactRevision,
    });
  }

  private materializationUnavailable(error: MaterializationError): boolean {
    if (!isMissingMaterialization(error)) return false;
    this.unavailable = true;
    return true;
  }

  async readLatestPublishedHistoryV2Month(): Promise<YearMonth | null> {
    if (this.unavailable) return null;
    const resource = queryResourceKeys.historyMonthCalendar;
    const contract = getQueryResourceContract(resource);
    const { data, error } = await this.client
      .from("analytics_query_snapshots")
      .select("period_month,analytics_publications!inner(publication_id)")
      .eq("household_id", this.context.householdId)
      .eq("resource", resource)
      .eq("subject_kind", "household")
      .is("subject_id", null)
      .eq("period_kind", "month")
      .eq("contract_version", contract.contractVersion)
      .in(
        "method_signature",
        historyV2AcceptedMethodSignatures(resource).map(({ methodSignature }) => methodSignature),
      )
      .eq("is_active", true)
      .is("invalidated_at", null)
      .is("expires_at", null)
      .not("publication_id", "is", null)
      .eq("analytics_publications.status", "published")
      .eq("analytics_publications.scope_kind", "month")
      .order("period_month", { ascending: false })
      .limit(1);
    if (error !== null) {
      this.materializationUnavailable(error);
      return null;
    }
    const periodMonth = data?.[0]?.period_month;
    if (typeof periodMonth !== "string") return null;
    try {
      return parseYearMonth(periodMonth.slice(0, 7));
    } catch {
      return null;
    }
  }

  async readMetric(
    metricId: ActiveMetricId,
    scope: AnalysisScope,
  ): Promise<ProducedMetric | null> {
    if (this.unavailable || this.options.readMode === "bypass") return null;
    const identity = metricArtifactIdentity(this.context, metricId, scope);
    const startedAt = Date.now();
    const { data, error } = await this.client
      .from("analytics_artifacts")
      .select("payload,source_revision::text")
      .eq("household_id", identity.householdId)
      .eq("artifact_key", identity.artifactKey)
      .eq("method_version", identity.methodVersion)
      .eq("contract_version", identity.contractVersion)
      .eq("is_active", true)
      .is("invalidated_at", null)
      .order("source_revision", { ascending: false })
      .limit(1);
    if (error !== null) {
      if (this.materializationUnavailable(error)) return null;
      safeMaterializationLog("analytics_materialization_miss", {
        scopeKind: identity.period.kind,
        durationMs: Date.now() - startedAt,
        sourceRevision: identity.period.sourceRevision,
      });
      return null;
    }
    const row = data?.[0];
    const fresh = row !== undefined && await this.isFresh(
      row.source_revision,
      identity.period,
      metricId === "typical_month_cost" || metricId === "minimal_month_cost",
    );
    if (!fresh) {
      safeMaterializationLog(row === undefined
        ? "analytics_materialization_miss"
        : "analytics_materialization_stale", {
        scopeKind: identity.period.kind,
        durationMs: Date.now() - startedAt,
        sourceRevision: identity.period.sourceRevision,
      });
      return null;
    }
    try {
      const metric = validateProducedMetric(row.payload as ProducedMetric);
      safeMaterializationLog("analytics_materialization_hit", {
        scopeKind: identity.period.kind,
        durationMs: Date.now() - startedAt,
        sourceRevision: identity.period.sourceRevision,
      });
      return metric;
    } catch {
      return null;
    }
  }

  private async writeMetricIdentity(
    identity: MetricArtifactIdentity,
    metric: ProducedMetric,
    publicationId?: string,
  ): Promise<void> {
    if (this.unavailable) return;
    const selectedPublicationId = publicationId ?? this.options.publicationId;
    const validated = validateProducedMetric(metric);
    const startedAt = Date.now();
    const { error } = await this.client.from("analytics_artifacts").upsert({
      artifact_key: identity.artifactKey,
      generation_key: selectedPublicationId ?? "read_through",
      household_id: identity.householdId,
      ...subjectColumns(identity.subject),
      ...periodColumns(identity.period),
      artifact_family: identity.artifactFamily,
      metric_id: identity.metricId,
      dimension_key: identity.dimensionKey,
      bucket_key: identity.bucketKey,
      scope_hash: identity.scopeHash,
      filter_signature: identity.filterSignature,
      method_version: identity.methodVersion,
      contract_version: identity.contractVersion,
      source_revision: identity.period.sourceRevision,
      analytics_revision: identity.analyticsRevision,
      payload: validated,
      computed_at: new Date().toISOString(),
      publication_id: selectedPublicationId ?? null,
      is_active: selectedPublicationId === undefined,
      invalidated_at: null,
      invalidation_revision: null,
    }, {
      onConflict: "artifact_key,source_revision,method_version,contract_version,generation_key",
    });
    if (error !== null) {
      if (selectedPublicationId === undefined && this.materializationUnavailable(error)) return;
      throw error;
    }
    safeMaterializationLog("analytics_materialization_write", {
      scopeKind: identity.period.kind,
      durationMs: Date.now() - startedAt,
      sourceRevision: identity.period.sourceRevision,
    });
  }

  async writeMetric(
    metricId: ActiveMetricId,
    scope: AnalysisScope,
    metric: ProducedMetric,
    publicationId?: string,
  ): Promise<void> {
    return this.writeMetricIdentity(
      metricArtifactIdentity(this.context, metricId, scope, "current"),
      metric,
      publicationId,
    );
  }

  async writeMetricBucket(
    metricId: ActiveMetricId,
    scope: AnalysisScope,
    dimensionKey: string,
    bucketKey: string,
    metric: ProducedMetric,
    publicationId?: string,
  ): Promise<void> {
    return this.writeMetricIdentity(
      metricBucketArtifactIdentity(
        this.context,
        metricId,
        scope,
        dimensionKey,
        bucketKey,
        "current",
      ),
      metric,
      publicationId,
    );
  }

  async readHistoryV2Artifact(
    artifactFamily: HistoryV2SharedArtifactFamily,
    month: YearMonth,
  ): Promise<HistoryV2StagedArtifactEnvelope | null> {
    if (this.unavailable || this.options.readMode === "bypass") return null;
    const identity = historyV2SharedArtifactIdentity(
      this.context,
      month,
      artifactFamily,
    );
    const { data, error } = await this.client
      .from("analytics_artifacts")
      .select("payload,source_revision::text")
      .eq("household_id", identity.householdId)
      .eq("artifact_key", identity.artifactKey)
      .eq("artifact_family", identity.artifactFamily)
      .eq("method_version", identity.methodVersion)
      .eq("contract_version", identity.contractVersion)
      .eq("is_active", true)
      .is("invalidated_at", null)
      .order("source_revision", { ascending: false })
      .limit(1);
    if (error !== null) {
      if (this.materializationUnavailable(error)) return null;
      return null;
    }
    const row = data?.[0];
    if (
      row === undefined
      || !await this.isFresh(row.source_revision, identity.period, false)
    ) return null;
    try {
      const envelope = historyV2StagedArtifactEnvelopeSchema.parse(row.payload);
      return envelope.artifactFamily === artifactFamily ? envelope : null;
    } catch {
      return null;
    }
  }

  async writeHistoryV2Artifact(
    envelopeInput: unknown,
    publicationId: string,
  ): Promise<void> {
    if (this.unavailable) return;
    const envelope = historyV2StagedArtifactEnvelopeSchema.parse(envelopeInput);
    if (
      publicationId.trim().length === 0
      || envelope.publicationMeta.publicationId !== publicationId
    ) {
      throw new TypeError("L'artifact History V2 doit appartenir à la DRAFT indiquée.");
    }
    const identity = historyV2SharedArtifactIdentity(
      this.context,
      envelope.payload.month,
      envelope.artifactFamily,
      "current",
    );
    const { error } = await this.client.from("analytics_artifacts").upsert({
      artifact_key: identity.artifactKey,
      generation_key: publicationId,
      household_id: identity.householdId,
      ...subjectColumns(identity.subject),
      ...periodColumns(identity.period),
      artifact_family: identity.artifactFamily,
      metric_id: identity.metricId,
      dimension_key: null,
      bucket_key: null,
      scope_hash: identity.scopeHash,
      filter_signature: identity.filterSignature,
      method_version: identity.methodVersion,
      contract_version: identity.contractVersion,
      source_revision: identity.period.sourceRevision,
      analytics_revision: identity.analyticsRevision,
      payload: envelope,
      computed_at: envelope.publicationMeta.generatedAt,
      publication_id: publicationId,
      is_active: false,
      invalidated_at: null,
      invalidation_revision: null,
    }, {
      onConflict: "artifact_key,source_revision,method_version,contract_version,generation_key",
    });
    if (error !== null) throw error;
  }

  async readMonthlyMetrics(
    metricId: ActiveMetricId,
    scopes: readonly AnalysisScope[],
  ): Promise<ReadonlyMap<string, ProducedMetric>> {
    const empty = new Map<string, ProducedMetric>();
    if (this.unavailable || this.options.readMode === "bypass" || scopes.length === 0) {
      return empty;
    }
    const identities = scopes.map((scope) =>
      metricArtifactIdentity(this.context, metricId, scope));
    if (identities.some(({ period }) => period.kind !== "month")) return empty;
    const artifactKeys = [...new Set(identities.map(({ artifactKey }) => artifactKey))];
    const { data, error } = await this.client
      .from("analytics_artifacts")
      .select("artifact_key,payload,source_revision::text")
      .eq("household_id", this.context.householdId)
      .eq("metric_id", metricId)
      .eq("method_version", identities[0].methodVersion)
      .eq("contract_version", identities[0].contractVersion)
      .eq("is_active", true)
      .is("invalidated_at", null)
      .in("artifact_key", artifactKeys)
      .order("source_revision", { ascending: false });
    if (error !== null) {
      if (this.materializationUnavailable(error)) return empty;
      return empty;
    }
    const result = new Map<string, ProducedMetric>();
    for (const identity of identities) {
      for (const row of data ?? []) {
        if (
          row.artifact_key !== identity.artifactKey
          || result.has(identity.scopeHash)
          || !await this.isFresh(row.source_revision, identity.period, false)
        ) continue;
        try {
          result.set(
            identity.scopeHash,
            validateProducedMetric(row.payload as ProducedMetric),
          );
        } catch {
          // Une ligne corrompue redevient un MISS ciblé.
        }
      }
    }
    return result;
  }

  async readGlobalAdditiveMetric(
    metricId: ActiveMetricId,
    scope: AnalysisScope,
  ): Promise<ProducedMetric | null> {
    if (this.unavailable || this.options.readMode === "bypass") return null;
    const normalized = normalizeAnalysisScope(scope);
    if (normalized.time.kind !== "global") return null;
    const identity = metricArtifactIdentity(this.context, metricId, normalized);
    const months = resolveGlobalWindowMonths(
      normalized.time.observationWindow,
      normalized.time.asOf,
    );
    if (months.length === 0) return null;

    let query = this.client
      .from("analytics_artifacts")
      .select("period_month,payload,source_revision::text")
      .eq("household_id", identity.householdId)
      .eq("artifact_family", "metric")
      .eq("metric_id", metricId)
      .eq("filter_signature", identity.filterSignature)
      .eq("method_version", identity.methodVersion)
      .eq("contract_version", identity.contractVersion)
      .eq("subject_kind", identity.subject.kind)
      .eq("is_active", true)
      .is("invalidated_at", null)
      .in("period_month", months.map((month) => `${month}-01`))
      .order("source_revision", { ascending: false });
    query = identity.subject.kind === "household"
      ? query.is("subject_id", null)
      : query.eq("subject_id", identity.subject.personId);
    const { data, error } = await query;
    if (error !== null) {
      if (this.materializationUnavailable(error)) return null;
      return null;
    }

    const metrics: ProducedMetric[] = [];
    for (const month of months) {
      const monthlyScope: AnalysisScope = {
        ...normalized,
        time: { kind: "month", month },
      };
      const period = materializationPeriod(
        this.context,
        normalizeAnalysisScope(monthlyScope),
      );
      let selected: ProducedMetric | undefined;
      for (const row of data ?? []) {
        if (
          typeof row.period_month !== "string"
          || row.period_month.slice(0, 7) !== month
          || !await this.isFresh(row.source_revision, period, false)
        ) {
          continue;
        }
        try {
          selected = validateProducedMetric(row.payload as ProducedMetric);
          break;
        } catch {
          // Une ligne incompatible ne peut pas participer au planner Global.
        }
      }
      if (selected === undefined) return null;
      metrics.push(selected);
    }
    return aggregateAdditiveMonthlyMetrics({
      metricId,
      globalScope: normalized,
      monthlyMetrics: metrics,
    });
  }

  async readQuery(
    request: AnyNormalizedQueryRequest,
  ): Promise<QueryMaterializationHit | null> {
    if (
      this.unavailable
      || this.options.readMode === "bypass"
      || !isQueryMaterializationResource(request.resource)
    ) return null;
    const identities = querySnapshotReadIdentities(this.context, request);
    const identity = identities[0]!;
    const startedAt = Date.now();
    const { data, error } = await this.client
      .from("analytics_query_snapshots")
      .select("query_key,payload,source_revision::text,expires_at,method_signature,publication_id,analytics_publications!inner(publication_id,status)")
      .eq("household_id", identity.householdId)
      .in("query_key", identities.map(({ queryKey }) => queryKey))
      .eq("contract_version", identity.contractVersion)
      .in("method_signature", identities.map(({ methodSignature }) => methodSignature))
      .eq("is_active", true)
      .is("invalidated_at", null)
      .not("publication_id", "is", null)
      .eq("analytics_publications.status", "published")
      .order("source_revision", { ascending: false })
      .limit(2);
    if (error !== null) {
      if (this.materializationUnavailable(error)) return null;
      return null;
    }
    const rows = data ?? [];
    const row = rows.length === 1 ? rows[0] : undefined;
    const matchedIdentity = row === undefined
      ? undefined
      : identities.find((candidate) =>
          candidate.queryKey === row.query_key
          && candidate.methodSignature === row.method_signature);
    const includeGlobalReference = identity.period.kind === "global"
      || identity.resource === "analysis_month_initial"
      || identity.resource === "analysis_month_evolution";
    const fresh = row !== undefined
      && matchedIdentity !== undefined
      && (row.expires_at === null || new Date(row.expires_at).getTime() > Date.now())
      && await this.isFresh(row.source_revision, identity.period, includeGlobalReference);
    if (!fresh) {
      safeMaterializationLog(row === undefined
        ? "analytics_query_snapshot_miss"
        : "analytics_materialization_stale", {
        resource: identity.resource,
        scopeKind: identity.period.kind,
        durationMs: Date.now() - startedAt,
        sourceRevision: identity.period.sourceRevision,
      });
      return null;
    }
    safeMaterializationLog("analytics_query_snapshot_hit", {
      resource: identity.resource,
      scopeKind: identity.period.kind,
      durationMs: Date.now() - startedAt,
      sourceRevision: identity.period.sourceRevision,
    });
    return {
      data: row.payload,
      methodSignature: matchedIdentity!.methodSignature,
      contractVariant: matchedIdentity!.contractVariant,
      cachePolicy: this.cachePolicy({
        ...identity.period,
        sourceRevision: parseDataRevision(String(row.source_revision)),
      }, "materialized"),
    };
  }

  async writeQuery(
    request: AnyNormalizedQueryRequest,
    payload: unknown,
    publicationId?: string,
  ): Promise<void> {
    if (this.unavailable || !isQueryMaterializationResource(request.resource)) return;
    const selectedPublicationId = publicationId ?? this.options.publicationId;
    const identity = querySnapshotIdentity(this.context, request, "current");
    const startedAt = Date.now();
    const expiresAt = identity.period.kind === "month" && identity.period.isClosed
      ? null
      : new Date(Date.now() + 5 * 60_000).toISOString();
    const { error } = await this.client.from("analytics_query_snapshots").upsert({
      query_key: identity.queryKey,
      generation_key: selectedPublicationId ?? "read_through",
      household_id: identity.householdId,
      resource: identity.resource,
      scope_hash: identity.scopeHash,
      normalized_param_signature: identity.normalizedParamSignature,
      ...subjectColumns(identity.subject),
      ...periodColumns(identity.period),
      source_revision: identity.period.sourceRevision,
      analytics_revision: identity.analyticsRevision,
      contract_version: identity.contractVersion,
      method_signature: identity.methodSignature,
      payload,
      computed_at: new Date().toISOString(),
      expires_at: expiresAt,
      publication_id: selectedPublicationId ?? null,
      is_active: selectedPublicationId === undefined,
      invalidated_at: null,
      invalidation_revision: null,
    }, {
      onConflict: "query_key,source_revision,contract_version,method_signature,generation_key",
    });
    if (error !== null) {
      if (selectedPublicationId === undefined && this.materializationUnavailable(error)) return;
      throw error;
    }
    safeMaterializationLog("analytics_query_snapshot_write", {
      resource: identity.resource,
      scopeKind: identity.period.kind,
      durationMs: Date.now() - startedAt,
      sourceRevision: identity.period.sourceRevision,
    });
  }

  queryCachePolicy(
    request: AnyNormalizedQueryRequest,
    source: "materialized" | "computed",
  ): NonNullable<ApiMeta["cachePolicy"]> | undefined {
    if (this.unavailable || !isQueryMaterializationResource(request.resource)) return undefined;
    return this.cachePolicy(
      querySnapshotIdentity(
        this.context,
        request,
        source === "computed" ? "current" : "published",
      ).period,
      source,
    );
  }

  async beginMonthPublicationProfile(input: {
    readonly month: YearMonth;
    readonly requiredArtifactKeys: readonly string[];
    readonly requiredRequests: readonly AnyNormalizedQueryRequest[];
    readonly baseAnalyticsRevision?: import("@/core/versions").AnalyticsRevision;
  }): Promise<string> {
    const { month, requiredArtifactKeys, requiredRequests } = input;
    const period = materializationPeriod(this.context, normalizeAnalysisScope({
      subject: { kind: "household" },
      time: { kind: "month", month },
    }), "current");
    const requiredQueryKeys = requiredRequests.map((request) => {
      const identity = querySnapshotIdentity(this.context, request, "current");
      if (identity.period.kind !== "month" || identity.period.month !== month) {
        throw new TypeError("Une publication mensuelle contient une Query hors période.");
      }
      return identity.queryKey;
    });
    if (new Set(requiredQueryKeys).size !== requiredQueryKeys.length) {
      throw new TypeError("Une publication mensuelle contient une Query dupliquée.");
    }
    if (
      requiredArtifactKeys.length === 0
      || new Set(requiredArtifactKeys).size !== requiredArtifactKeys.length
      || requiredArtifactKeys.some((artifactKey) => artifactKey.length === 0)
    ) {
      throw new TypeError("Une publication mensuelle exige des artifacts uniques et non vides.");
    }
    if (requiredQueryKeys.length === 0) {
      throw new TypeError("Une publication mensuelle exige au moins une Query.");
    }
    const { data, error } = await this.client
      .from("analytics_publications")
      .insert({
        household_id: this.context.householdId,
        scope_kind: "month",
        period_month: `${month}-01`,
        as_of_month: null,
        source_revision: period.sourceRevision,
        base_analytics_revision:
          input.baseAnalyticsRevision ?? this.context.analyticsRevision,
        required_artifact_keys: [...requiredArtifactKeys],
        required_query_keys: requiredQueryKeys,
        status: "draft",
      })
      .select("publication_id")
      .single();
    if (error !== null) throw error;
    if (typeof data?.publication_id !== "string") {
      throw new TypeError("La publication analytique créée ne porte aucun identifiant.");
    }
    return data.publication_id;
  }

  async beginMonthPublication(
    month: YearMonth,
    requiredRequests: readonly AnyNormalizedQueryRequest[],
  ): Promise<string> {
    const defaultScope = requiredRequests.find(({ resource }) =>
      resource === "analysis_month_initial")?.scope;
    if (defaultScope === undefined) {
      throw new TypeError("La publication mensuelle exige analysis_month_initial.");
    }
    const requiredArtifactKeys = [
      "economic_consumption_net_attributable",
      "typical_month_cost",
      "minimal_month_cost",
    ].map((metricId) => metricArtifactIdentity(
      this.context,
      metricId as ActiveMetricId,
      defaultScope as AnalysisScope,
    ).artifactKey);
    return this.beginMonthPublicationProfile({
      month,
      requiredArtifactKeys,
      requiredRequests,
    });
  }

  async publishPrepared(
    publicationId: string,
    expectedAnalyticsRevision = this.context.analyticsRevision,
  ): Promise<{
    readonly analyticsRevision: string;
    readonly sourceRevision: string;
  }> {
    const startedAt = Date.now();
    safeMaterializationLog("analytics_recompute_start", {
      scopeKind: "month",
      durationMs: 0,
      sourceRevision: this.context.dataRevision,
    });
    const { data, error } = await this.client.rpc(
      "publish_analytics_materialization",
      {
        p_publication_id: publicationId,
        p_expected_analytics_revision: expectedAnalyticsRevision,
      },
    );
    if (error !== null) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row === undefined || row === null) {
      throw new TypeError("La publication analytique n'a retourné aucune révision.");
    }
    const result = row as { analytics_revision?: unknown; source_revision?: unknown };
    const analyticsRevision = String(result.analytics_revision);
    const sourceRevision = String(result.source_revision);
    revisionNumber(analyticsRevision);
    revisionNumber(sourceRevision);
    safeMaterializationLog("analytics_recompute_complete", {
      scopeKind: "month",
      durationMs: Date.now() - startedAt,
      sourceRevision: this.context.dataRevision,
    });
    return { analyticsRevision, sourceRevision };
  }

  async restoreHistoryV2Publication(input: {
    readonly currentPublicationId: string | null;
    readonly targetPublicationId: string | null;
    readonly householdId: string;
    readonly month: YearMonth;
    readonly expectedAnalyticsRevision: import("@/core/versions").AnalyticsRevision;
  }): Promise<{
    readonly analyticsRevision: string;
    readonly sourceRevision: string;
    readonly activePublicationId: string | null;
  }> {
    const { data, error } = await this.client.rpc(
      "restore_history_v2_publication",
      {
        p_current_publication_id: input.currentPublicationId,
        p_target_publication_id: input.targetPublicationId,
        p_household_id: input.householdId,
        p_period_month: `${input.month}-01`,
        p_expected_analytics_revision: input.expectedAnalyticsRevision,
      },
    );
    if (error !== null) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row === undefined || row === null) {
      throw new TypeError("Le rollback History V2 n'a retourné aucune révision.");
    }
    const result = row as {
      analytics_revision?: unknown;
      source_revision?: unknown;
      active_publication_id?: unknown;
    };
    const analyticsRevision = String(result.analytics_revision);
    const sourceRevision = String(result.source_revision);
    revisionNumber(analyticsRevision);
    revisionNumber(sourceRevision);
    if (
      result.active_publication_id !== null
      && result.active_publication_id !== undefined
      && typeof result.active_publication_id !== "string"
    ) {
      throw new TypeError("Identifiant de publication restaurée invalide.");
    }
    return {
      analyticsRevision,
      sourceRevision,
      activePublicationId: result.active_publication_id ?? null,
    };
  }
}
