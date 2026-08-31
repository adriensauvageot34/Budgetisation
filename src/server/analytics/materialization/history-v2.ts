import "server-only";

import { createHash } from "node:crypto";

import {
  computeHistoryV2PublicationFactsHash,
  type FactsHashFact,
  type HashDependency,
} from "@/analytics/history-v2";
import {
  calendarSemanticMonthArtifactSchema,
  type CalendarSemanticMonthArtifact,
} from "@/analytics/history-v2/calendar";
import {
  dailyEconomicLedgerMonthArtifactSchema,
  type DailyEconomicLedgerMonthArtifact,
} from "@/analytics/history-v2/daily-finance";
import {
  parsePublicationMeta,
  parsePolicyVersions,
  policyVersionsEqual,
  type PolicyVersions,
  type PublicationMeta,
} from "@/core/history-v2";
import type { HouseholdId } from "@/core/identity";
import {
  addDays,
  parseInstant,
  parseLocalDate,
  parseYearMonth,
  yearMonthOf,
  type Instant,
  type LocalDate,
  type YearMonth,
} from "@/core/time";
import {
  createRuntimeSchema,
  parseStrictRecord,
  requireProperty,
} from "@/core/validation";
import { queryDataSchemaByResource } from "@/query-api/read-model-registry";
import {
  canonicalSerializeQueryParams,
  getQueryResourceContract,
  normalizeQueryRequest,
  queryResourceKeys,
  registeredQueryResourceKeys,
  type AnyNormalizedQueryRequest,
  type QueryResourceKey,
} from "@/query-api/request";
import { assertQueryDataMatchesRequest } from "@/query-api/server";
import {
  queryTargetRefRuntimeSchema,
  type QueryTargetRef,
} from "@/query-api/history-v2";
import type { AuthorizedRuntimeContext } from "@/server/canonical/context";
import {
  historyV2SharedArtifactFamilies,
  historyV2SharedArtifactIdentity,
  querySnapshotIdentity,
  type HistoryV2SharedArtifactFamily,
} from "./identity";

export const historyV2PublicationProfileId = "history-v2-month@v1" as const;
export const historyV2ReadOnlyBackfillProfileId =
  "history-v2-read-only-preflight@v1" as const;

export const historyV2QueryResources = Object.freeze(
  registeredQueryResourceKeys.filter((resource) =>
    getQueryResourceContract(resource).family === "history_v2"),
);

const historyV2ResourceSet = new Set<QueryResourceKey>(historyV2QueryResources);

export const historyV2TopLevelResources = Object.freeze([
  queryResourceKeys.historyMonthCalendar,
  queryResourceKeys.historyMonthOverview,
  queryResourceKeys.historyMonthBalanceSummary,
  queryResourceKeys.historyBankEconomyBridge,
  queryResourceKeys.historyMonthCategories,
  queryResourceKeys.historyMonthSpendingNature,
  queryResourceKeys.historyMinimalPreview,
  queryResourceKeys.historyMonthLifeMoney,
] as const);

export const historyV2MaterializationProfile = Object.freeze({
  profileId: historyV2PublicationProfileId,
  scope: "household_month" as const,
  contractVersion: "v2" as const,
  artifactFamilies: historyV2SharedArtifactFamilies,
  resourceFamilies: historyV2QueryResources,
  topLevelResources: historyV2TopLevelResources,
  artifactStore: "analytics_artifacts" as const,
  queryStore: "analytics_query_snapshots" as const,
  publicationStore: "analytics_publications" as const,
});

export const historyV2ReadOnlyBackfillProfile = Object.freeze({
  profileId: historyV2ReadOnlyBackfillProfileId,
  materializationProfileId: historyV2PublicationProfileId,
  mode: "read_only" as const,
  stage: "in_memory" as const,
  finalize: "forbidden" as const,
});

export type HistoryV2ArtifactPayloadByFamily = {
  readonly calendar_semantic_month: CalendarSemanticMonthArtifact;
  readonly daily_economic_ledger_month: DailyEconomicLedgerMonthArtifact;
};

export type HistoryV2PreflightArtifact = {
  readonly [Family in HistoryV2SharedArtifactFamily]: {
    readonly artifactFamily: Family;
    readonly payload: HistoryV2ArtifactPayloadByFamily[Family];
    readonly facts: readonly FactsHashFact[];
    readonly dependencies?: readonly HashDependency[];
  };
}[HistoryV2SharedArtifactFamily];

export type HistoryV2QueryBuildResult = {
  readonly data: unknown;
  readonly facts: readonly FactsHashFact[];
  readonly dependencies?: readonly HashDependency[];
};

export type HistoryV2ManifestFactDependency = {
  readonly closureId: string;
  readonly factIdentities: readonly string[];
  readonly dependencyIds: readonly string[];
};

export type HistoryV2ExternalQueryRef = {
  readonly ownerMonth: YearMonth;
  readonly queryKey: string;
  readonly resource: QueryResourceKey;
  readonly params: Readonly<Record<string, unknown>>;
};

export type HistoryV2ManifestQuery = {
  readonly ownerMonth: YearMonth;
  readonly queryKey: string;
  readonly request: AnyNormalizedQueryRequest;
  readonly data: unknown;
  readonly contractVersion: "v2";
  readonly methodSignature: string;
  readonly policyVersions: PolicyVersions;
};

export type HistoryV2MonthManifest = {
  readonly profileId: typeof historyV2PublicationProfileId;
  readonly householdId: HouseholdId;
  readonly month: YearMonth;
  readonly resourceFamilies: readonly QueryResourceKey[];
  readonly requiredArtifactKeys: readonly string[];
  readonly requiredQueryKeys: readonly string[];
  readonly externalQueryRefs: readonly HistoryV2ExternalQueryRef[];
  readonly factDependencies: readonly HistoryV2ManifestFactDependency[];
  readonly manifestHash: string;
  readonly publicationFactsHash: import("@/core/history-v2").FactsHash;
};

export type HistoryV2PreflightResult = {
  readonly manifest: HistoryV2MonthManifest;
  readonly artifacts: readonly HistoryV2PreflightArtifact[];
  readonly queries: readonly HistoryV2ManifestQuery[];
};

export type HistoryV2StagedArtifactEnvelope = {
  readonly artifactFamily: HistoryV2SharedArtifactFamily;
  readonly artifactInputHash: string;
  readonly publicationMeta: PublicationMeta;
  readonly payload: CalendarSemanticMonthArtifact | DailyEconomicLedgerMonthArtifact;
};

export type HistoryV2InMemoryStage = {
  readonly manifest: HistoryV2MonthManifest;
  readonly artifacts: readonly HistoryV2StagedArtifactEnvelope[];
  readonly queries: readonly HistoryV2ManifestQuery[];
  readonly publicationId: string;
  readonly revision: number;
  readonly factsHash: import("@/core/history-v2").FactsHash;
  readonly finalizeRequested: false;
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function datesInMonth(month: YearMonth): readonly LocalDate[] {
  const first = parseLocalDate(`${month}-01`);
  const result: LocalDate[] = [];
  for (let date = first; yearMonthOf(date) === month; date = addDays(date, 1)) {
    result.push(date);
  }
  return result;
}

function utcDayOfWeek(date: LocalDate): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
}

function ownedWeekStarts(month: YearMonth): readonly LocalDate[] {
  return stableUnique(
    datesInMonth(month)
      .filter((date) => utcDayOfWeek(date) === 4)
      .map((thursday) => addDays(thursday, -3)),
  ) as readonly LocalDate[];
}

function monthScope(month: YearMonth) {
  return {
    subject: { kind: "household" as const },
    time: { kind: "month" as const, month },
  };
}

function requestFor(
  month: YearMonth,
  resource: QueryResourceKey,
  params: Readonly<Record<string, unknown>>,
): AnyNormalizedQueryRequest {
  return normalizeQueryRequest({ resource, scope: monthScope(month), params });
}

function seedRequests(month: YearMonth): readonly AnyNormalizedQueryRequest[] {
  return [
    ...historyV2TopLevelResources.map((resource) => requestFor(month, resource, {})),
    ...datesInMonth(month).map((date) =>
      requestFor(month, queryResourceKeys.historyDayJournal, { date })),
    ...ownedWeekStarts(month).map((weekStart) =>
      requestFor(month, queryResourceKeys.historyWeek, { weekStart })),
  ];
}

function ownerMonthForTarget(
  parentMonth: YearMonth,
  target: QueryTargetRef,
): YearMonth {
  if (target.resource === "history_day_journal") {
    return yearMonthOf(parseLocalDate(target.params.date));
  }
  if (target.resource === "history_week") {
    return yearMonthOf(addDays(parseLocalDate(target.params.weekStart), 3));
  }
  return parentMonth;
}

function embeddedQueryTargets(value: unknown): readonly QueryTargetRef[] {
  const result: QueryTargetRef[] = [];
  const seen = new Set<object>();
  const visit = (candidate: unknown): void => {
    if (candidate === null || typeof candidate !== "object") return;
    if (seen.has(candidate)) return;
    seen.add(candidate);
    if (!Array.isArray(candidate)) {
      const record = candidate as Record<string, unknown>;
      if (
        Object.keys(record).length === 2
        && Object.hasOwn(record, "resource")
        && Object.hasOwn(record, "params")
      ) {
        result.push(queryTargetRefRuntimeSchema.parse(record));
        return;
      }
      for (const child of Object.values(record)) visit(child);
      return;
    }
    for (const child of candidate) visit(child);
  };
  visit(value);
  return result;
}

function visibleSpendingBuckets(value: unknown): readonly string[] {
  if (value === null || typeof value !== "object") return [];
  const node = value as Record<string, unknown>;
  if (node.visibility !== "VISIBLE" || node.data === null || typeof node.data !== "object") return [];
  const axis = node.data as Record<string, unknown>;
  if (axis.result === null || typeof axis.result !== "object") return [];
  const result = axis.result as Record<string, unknown>;
  if ((result.status !== "KNOWN" && result.status !== "PARTIAL") || !Array.isArray(result.value)) return [];
  return result.value.flatMap((entry) => {
    if (entry === null || typeof entry !== "object") return [];
    const key = (entry as Record<string, unknown>).key;
    return typeof key === "string" && key.length > 0 ? [key] : [];
  });
}

function spendingNatureTargets(data: unknown): readonly QueryTargetRef[] {
  if (data === null || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const axisTargets = (["necessity", "behavior", "lifeScope"] as const).flatMap((axis) =>
    visibleSpendingBuckets(record[axis]).map((bucket) =>
      queryTargetRefRuntimeSchema.parse({
        resource: "history_spending_segment_detail",
        params: { axis, bucket },
      })),
  );
  const matrix = record.matrix;
  const matrixTargets: QueryTargetRef[] = [];
  if (matrix !== null && typeof matrix === "object") {
    const matrixNode = matrix as Record<string, unknown>;
    const matrixData = matrixNode.visibility === "VISIBLE" ? matrixNode.data : undefined;
    if (matrixData !== null && typeof matrixData === "object") {
      const cells = (matrixData as Record<string, unknown>).cells;
      if (Array.isArray(cells)) {
        for (const cell of cells) {
          const key = cell !== null && typeof cell === "object"
            ? (cell as Record<string, unknown>).key
            : undefined;
          if (typeof key !== "string") continue;
          const [necessity, behavior, extra] = key.split("__");
          if (necessity === undefined || behavior === undefined || extra !== undefined) continue;
          matrixTargets.push(queryTargetRefRuntimeSchema.parse({
            resource: "history_spending_segment_detail",
            params: { necessity, behavior },
          }));
        }
      }
    }
  }
  return [...axisTargets, ...matrixTargets];
}

export function discoverHistoryV2QueryTargets(
  resource: QueryResourceKey,
  data: unknown,
): readonly QueryTargetRef[] {
  const targets = [
    ...embeddedQueryTargets(data),
    ...(resource === "history_month_spending_nature"
      ? spendingNatureTargets(data)
      : []),
  ];
  const unique = new Map<string, QueryTargetRef>();
  for (const target of targets) {
    if (!historyV2ResourceSet.has(target.resource)) {
      throw new TypeError(
        `La fermeture History V2 refuse la cible non-V2 ${target.resource}.`,
      );
    }
    unique.set(canonicalSerializeQueryParams(target), target);
  }
  return [...unique.values()].sort((left, right) =>
    canonicalSerializeQueryParams(left).localeCompare(canonicalSerializeQueryParams(right)));
}

function parseQueryData(
  request: AnyNormalizedQueryRequest,
  rawData: unknown,
): unknown {
  const schema = (queryDataSchemaByResource as Readonly<Record<
    string,
    { readonly parse: (value: unknown) => unknown }
  >>)[request.resource];
  if (schema === undefined) {
    throw new TypeError(`RuntimeSchema absente pour ${request.resource}.`);
  }
  const data = schema.parse(rawData) as never;
  assertQueryDataMatchesRequest(request as never, data);
  return data;
}

function artifactPayload(
  artifact: HistoryV2PreflightArtifact,
): CalendarSemanticMonthArtifact | DailyEconomicLedgerMonthArtifact {
  return artifact.artifactFamily === "calendar_semantic_month"
    ? calendarSemanticMonthArtifactSchema.parse(artifact.payload)
    : dailyEconomicLedgerMonthArtifactSchema.parse(artifact.payload);
}

function assertArtifactScope(
  artifact: HistoryV2PreflightArtifact,
  householdId: HouseholdId,
  month: YearMonth,
): void {
  const payload = artifactPayload(artifact);
  if (payload.householdId !== householdId || payload.month !== month) {
    throw new TypeError("Un artifact History V2 ne correspond pas au Household/mois du manifest.");
  }
  if (payload.artifactFamily !== artifact.artifactFamily) {
    throw new TypeError("La famille déclarée d'un artifact History V2 est incohérente.");
  }
}

function factDependency(
  closureId: string,
  facts: readonly FactsHashFact[],
  dependencies: readonly HashDependency[] = [],
): HistoryV2ManifestFactDependency {
  return {
    closureId,
    factIdentities: stableUnique(facts.map(({ factType, identity }) => `${factType}:${identity}`)),
    dependencyIds: stableUnique(dependencies.map(({ dependencyId }) => dependencyId)),
  };
}

function manifestDigest(input: {
  readonly householdId: HouseholdId;
  readonly month: YearMonth;
  readonly artifactKeys: readonly string[];
  readonly queryKeys: readonly string[];
  readonly externalRefs: readonly HistoryV2ExternalQueryRef[];
}): string {
  return sha256(canonicalSerializeQueryParams({
    profileId: historyV2PublicationProfileId,
    householdId: input.householdId,
    month: input.month,
    requiredArtifactKeys: [...input.artifactKeys].sort(),
    requiredQueryKeys: [...input.queryKeys].sort(),
    externalQueryRefs: [...input.externalRefs]
      .map(({ ownerMonth, queryKey, resource, params }) => ({ ownerMonth, queryKey, resource, params }))
      .sort((left, right) => left.queryKey.localeCompare(right.queryKey)),
  }));
}

export function createHistoryV2TheoreticalManifest(monthInput: unknown) {
  const month = parseYearMonth(monthInput);
  return Object.freeze({
    profileId: historyV2PublicationProfileId,
    month,
    resourceFamilies: historyV2MaterializationProfile.resourceFamilies,
    artifactFamilies: historyV2MaterializationProfile.artifactFamilies,
    topLevelResources: historyV2MaterializationProfile.topLevelResources,
    requiredJournalDates: datesInMonth(month),
    requiredOwnedWeekStarts: ownedWeekStarts(month),
    recursiveDetailResources: historyV2QueryResources.filter((resource) =>
      [
        "history_category_detail",
        "history_spending_segment_detail",
        "history_activity_detail",
        "history_moment_detail",
        "history_place_detail",
      ].includes(resource)),
  });
}

export async function buildHistoryV2Preflight(input: {
  readonly context: AuthorizedRuntimeContext;
  readonly month: YearMonth;
  readonly artifacts: readonly HistoryV2PreflightArtifact[];
  readonly buildQuery: (
    request: AnyNormalizedQueryRequest,
  ) => Promise<HistoryV2QueryBuildResult> | HistoryV2QueryBuildResult;
}): Promise<HistoryV2PreflightResult> {
  const month = parseYearMonth(input.month);
  if (historyV2QueryResources.length !== 15) {
    throw new TypeError(`Le profil History V2 exige exactement 15 ressources, reçu ${historyV2QueryResources.length}.`);
  }
  if (
    input.artifacts.length !== historyV2SharedArtifactFamilies.length
    || new Set(input.artifacts.map(({ artifactFamily }) => artifactFamily)).size
      !== historyV2SharedArtifactFamilies.length
  ) {
    throw new TypeError("Le PRE-FLIGHT exige exactement les deux artifacts History V2.");
  }
  for (const family of historyV2SharedArtifactFamilies) {
    if (!input.artifacts.some(({ artifactFamily }) => artifactFamily === family)) {
      throw new TypeError(`Artifact History V2 requis absent: ${family}.`);
    }
  }
  input.artifacts.forEach((artifact) =>
    assertArtifactScope(artifact, input.context.householdId, month));

  const required = new Map<string, AnyNormalizedQueryRequest>();
  const external = new Map<string, HistoryV2ExternalQueryRef>();
  const registerRequired = (request: AnyNormalizedQueryRequest): void => {
    const identity = querySnapshotIdentity(input.context, request, "current");
    if (identity.period.kind !== "month" || identity.period.month !== month) {
      throw new TypeError("Une Query locale du manifest n'appartient pas au mois propriétaire.");
    }
    required.set(identity.queryKey, request);
  };
  seedRequests(month).forEach(registerRequired);

  const queries = new Map<string, HistoryV2ManifestQuery>();
  const queryClosures = new Map<string, HistoryV2QueryBuildResult>();
  while (queries.size < required.size) {
    const next = [...required.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .find(([queryKey]) => !queries.has(queryKey));
    if (next === undefined) break;
    const [queryKey, request] = next;
    const built = await input.buildQuery(request);
    const data = parseQueryData(request, built.data);
    const rawPolicyVersions = (data as { readonly policyVersions?: unknown }).policyVersions;
    if (rawPolicyVersions === undefined || typeof rawPolicyVersions !== "object") {
      throw new TypeError(`La ressource ${request.resource} n'expose pas ses policyVersions.`);
    }
    const policyVersions = parsePolicyVersions(rawPolicyVersions);
    const identity = querySnapshotIdentity(input.context, request, "current");
    const contract = getQueryResourceContract(request.resource);
    if (contract.family !== "history_v2" || contract.contractVersion !== "v2") {
      throw new TypeError(`Le manifest History V2 refuse le contrat ${request.resource}.`);
    }
    queries.set(queryKey, {
      ownerMonth: month,
      queryKey,
      request,
      data,
      contractVersion: "v2",
      methodSignature: identity.methodSignature,
      policyVersions,
    });
    queryClosures.set(queryKey, built);

    for (const target of discoverHistoryV2QueryTargets(request.resource, data)) {
      const targetOwner = ownerMonthForTarget(month, target);
      const targetRequest = requestFor(targetOwner, target.resource, target.params);
      const targetIdentity = querySnapshotIdentity(input.context, targetRequest, "current");
      if (targetOwner === month) {
        required.set(targetIdentity.queryKey, targetRequest);
      } else {
        external.set(targetIdentity.queryKey, {
          ownerMonth: targetOwner,
          queryKey: targetIdentity.queryKey,
          resource: target.resource,
          params: targetRequest.params,
        });
      }
    }
  }

  const artifactEntries = input.artifacts.map((artifact) => ({
    artifact,
    identity: historyV2SharedArtifactIdentity(
      input.context,
      month,
      artifact.artifactFamily,
      "current",
    ),
  })).sort((left, right) => left.identity.artifactKey.localeCompare(right.identity.artifactKey));
  const queryEntries = [...queries.values()].sort((left, right) =>
    left.queryKey.localeCompare(right.queryKey));
  const externalQueryRefs = [...external.values()].sort((left, right) =>
    left.queryKey.localeCompare(right.queryKey));
  const closures = [
    ...artifactEntries.map(({ artifact, identity }) => ({
      closureId: `artifact:${identity.artifactKey}`,
      facts: artifact.facts,
      dependencies: artifact.dependencies,
    })),
    ...queryEntries.map(({ queryKey }) => {
      const closure = queryClosures.get(queryKey)!;
      return {
        closureId: `query:${queryKey}`,
        facts: closure.facts,
        dependencies: closure.dependencies,
      };
    }),
  ];
  const requiredArtifactKeys = artifactEntries.map(({ identity }) => identity.artifactKey);
  const requiredQueryKeys = queryEntries.map(({ queryKey }) => queryKey);
  const publicationFactsHash = computeHistoryV2PublicationFactsHash({
    householdId: input.context.householdId,
    month,
    closures,
  });
  const factDependencies = closures.map((closure) =>
    factDependency(closure.closureId, closure.facts, closure.dependencies));
  const manifestHash = manifestDigest({
    householdId: input.context.householdId,
    month,
    artifactKeys: requiredArtifactKeys,
    queryKeys: requiredQueryKeys,
    externalRefs: externalQueryRefs,
  });
  return {
    manifest: {
      profileId: historyV2PublicationProfileId,
      householdId: input.context.householdId,
      month,
      resourceFamilies: historyV2QueryResources,
      requiredArtifactKeys,
      requiredQueryKeys,
      externalQueryRefs,
      factDependencies,
      manifestHash,
      publicationFactsHash,
    },
    artifacts: input.artifacts,
    queries: queryEntries,
  };
}

function parseArtifactEnvelope(value: unknown): HistoryV2StagedArtifactEnvelope {
  const record = parseStrictRecord(
    value,
    ["artifactFamily", "artifactInputHash", "publicationMeta", "payload"],
    "HistoryV2StagedArtifactEnvelope",
  );
  const artifactFamily = requireProperty(
    record,
    "artifactFamily",
    "HistoryV2StagedArtifactEnvelope",
  );
  if (!historyV2SharedArtifactFamilies.includes(artifactFamily as never)) {
    throw new TypeError("HistoryV2StagedArtifactEnvelope.artifactFamily invalide.");
  }
  const payload = artifactFamily === "calendar_semantic_month"
    ? calendarSemanticMonthArtifactSchema.parse(requireProperty(record, "payload", "HistoryV2StagedArtifactEnvelope"))
    : dailyEconomicLedgerMonthArtifactSchema.parse(requireProperty(record, "payload", "HistoryV2StagedArtifactEnvelope"));
  const artifactInputHash = requireProperty(record, "artifactInputHash", "HistoryV2StagedArtifactEnvelope");
  if (typeof artifactInputHash !== "string" || artifactInputHash !== payload.artifactInputHash) {
    throw new TypeError("L'enveloppe artifact ne correspond pas à artifactInputHash.");
  }
  const publicationMeta = parsePublicationMeta(
    requireProperty(record, "publicationMeta", "HistoryV2StagedArtifactEnvelope"),
  );
  if (!policyVersionsEqual(
    publicationMeta.policyVersions,
    parsePolicyVersions(payload.dependencyPolicies),
  )) {
    throw new TypeError("PublicationMeta ne correspond pas aux policies de l'artifact.");
  }
  return {
    artifactFamily: artifactFamily as HistoryV2SharedArtifactFamily,
    artifactInputHash,
    publicationMeta,
    payload,
  };
}

export const historyV2StagedArtifactEnvelopeSchema = createRuntimeSchema(
  parseArtifactEnvelope,
);

export function stageHistoryV2GenerationInMemory(input: {
  readonly preflight: HistoryV2PreflightResult;
  readonly publicationId: string;
  readonly revision: number;
  readonly generatedAt: Instant;
}): HistoryV2InMemoryStage {
  if (input.publicationId.trim().length === 0) {
    throw new TypeError("Le stage de test exige un publicationId de DRAFT non vide.");
  }
  const generatedAt = parseInstant(input.generatedAt);
  const queryByKey = new Map(input.preflight.queries.map((query) => [query.queryKey, query]));
  const stagedQueries = input.preflight.manifest.requiredQueryKeys.map((queryKey) => {
    const query = queryByKey.get(queryKey);
    if (query === undefined) throw new TypeError(`Snapshot requis non construit: ${queryKey}.`);
    const publicationMeta = parsePublicationMeta({
      publicationId: input.publicationId,
      revision: input.revision,
      contractVersion: query.contractVersion,
      factsHash: input.preflight.manifest.publicationFactsHash,
      policyVersions: query.policyVersions,
      generatedAt,
    });
    const stagedData = parseQueryData(query.request, {
      ...(query.data as Record<string, unknown>),
      publicationMeta,
    });
    return { ...query, data: stagedData };
  });

  const artifactByFamily = new Map(
    input.preflight.artifacts.map((artifact) => [artifact.artifactFamily, artifact]),
  );
  const stagedArtifacts = historyV2SharedArtifactFamilies.map((artifactFamily) => {
    const artifact = artifactByFamily.get(artifactFamily);
    if (artifact === undefined) throw new TypeError(`Artifact requis non construit: ${artifactFamily}.`);
    const payload = artifactPayload(artifact);
    return historyV2StagedArtifactEnvelopeSchema.parse({
      artifactFamily,
      artifactInputHash: payload.artifactInputHash,
      publicationMeta: {
        publicationId: input.publicationId,
        revision: input.revision,
        contractVersion: "v2",
        factsHash: input.preflight.manifest.publicationFactsHash,
        policyVersions: payload.dependencyPolicies,
        generatedAt,
      },
      payload,
    });
  });

  if (
    stagedQueries.length !== input.preflight.manifest.requiredQueryKeys.length
    || stagedArtifacts.length !== input.preflight.manifest.requiredArtifactKeys.length
  ) {
    throw new TypeError("Le stage de test n'est pas complet.");
  }
  const publicationIdentities = [
    ...stagedQueries.map(({ data }) => (data as { readonly publicationMeta: PublicationMeta }).publicationMeta),
    ...stagedArtifacts.map(({ publicationMeta }) => publicationMeta),
  ];
  if (publicationIdentities.some((meta) =>
    meta.publicationId !== input.publicationId
    || meta.revision !== input.revision
    || meta.factsHash !== input.preflight.manifest.publicationFactsHash)) {
    throw new TypeError("Le stage History V2 ne partage pas une identité de publication commune.");
  }
  return {
    manifest: input.preflight.manifest,
    artifacts: stagedArtifacts,
    queries: stagedQueries,
    publicationId: input.publicationId,
    revision: input.revision,
    factsHash: input.preflight.manifest.publicationFactsHash,
    finalizeRequested: false,
  };
}
