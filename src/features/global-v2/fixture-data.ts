import type {
  GlobalCompactInsight,
  GlobalCompactQuality,
  GlobalDetailMetric,
  GlobalDetailRow,
  GlobalDetailSeries,
  GlobalExpandedReadModel,
  GlobalExpandedSectionKey,
  GlobalInitialReadModel,
  GlobalModuleCompactReadModel,
  GlobalPrimaryModuleKey,
  GlobalReadModelPublicationMeta,
  GlobalReadModelResourceMeta,
  GlobalV2ExpandedResourceName,
  ImportedGlobalSummaryReadModel,
} from "@/query-api/global-v2";
import { globalModulePresentation, globalModulePresentations } from "./catalog";
import type { GlobalV2UiRequest, GlobalV2UiTransport } from "./visit-runtime";

const hash = (character: string) => character.repeat(64);

export type GlobalV2FixtureScenario = "contract" | "local-error" | "new-generation";

export type GlobalV2FixtureBundle = {
  readonly initial: GlobalInitialReadModel;
  readonly summary: ImportedGlobalSummaryReadModel;
  readonly modules: readonly GlobalModuleCompactReadModel[];
  readonly newerPublication?: GlobalReadModelPublicationMeta;
};

const publicationMeta: GlobalReadModelPublicationMeta = Object.freeze({
  publicationId: "00000000-0000-4000-8000-000000000160",
  revision: 82,
  factsHash: hash("a"),
  generatedAt: "2026-09-06T16:00:00Z",
  profileId: "global-v2-household@v1",
  manifestHash: hash("b"),
});

function resourceMeta(seed: number): GlobalReadModelResourceMeta {
  const value = (seed % 15).toString(16);
  return { contractVersion: "global-v2-query@v1", methodSignature: hash(value), policyVersions: { projection: `global-ui-fixture@v${seed}` }, resourceInputHash: hash(((seed + 1) % 15).toString(16)) };
}

const qualityKnown: GlobalCompactQuality = Object.freeze({
  knowledgeState: "KNOWN",
  supportStatus: "SUFFICIENT",
  effectiveCoverage: 0.91,
  dataNature: "OBSERVED",
  limitationCodes: [],
  evidenceRefs: ["evidence:certified-history", "evidence:global-v2"],
});

const qualityPartial: GlobalCompactQuality = Object.freeze({
  knowledgeState: "PARTIAL",
  partialMeaning: "OBSERVED_ONLY",
  supportStatus: "PARTIAL_SUPPORT",
  effectiveCoverage: 0.68,
  dataNature: "HYBRID",
  limitationCodes: ["PURCHASE_EVENT_COVERAGE_PARTIAL"],
  evidenceRefs: ["evidence:purchase-observed-only"],
});

function insight(moduleKey: GlobalPrimaryModuleKey, index: number): GlobalCompactInsight {
  const id = moduleKey.toLowerCase();
  return {
    insightId: `insight:${id}`,
    phenomenonId: `phenomenon:${id}`,
    kind: "CERTIFIED_OBSERVATION",
    titleKey: `global.insight.${id === "categories_needs" ? "categories" : id === "relationships" ? "relationships" : id === "geo_mobility" ? "places" : id}.title`,
    statementKey: `global.insight.${id === "categories_needs" ? "categories" : id === "relationships" ? "relationships" : id === "geo_mobility" ? "places" : id}.statement`,
    primaryMetricRef: `metric:${id}:primary`,
    entityRefs: [`entity:${id}:primary`],
    evidenceRefs: [`evidence:${id}`],
    detailRefs: [`detail:${id}`],
    editorialRank: index + 1,
  };
}

function moduleModel(moduleKey: GlobalPrimaryModuleKey, index: number): GlobalModuleCompactReadModel {
  const presentation = globalModulePresentation(moduleKey);
  if (moduleKey === "CONSUMPTION") {
    return {
      kind: "global_module_compact",
      schemaVersion: "global-module-compact@v1",
      moduleKey,
      resource: presentation.resource,
      order: presentation.order,
      visibility: "PLACEHOLDER",
      reasonCode: "INSUFFICIENT_COVERAGE",
      placeholder: { messageKey: "Les achats seront détaillés lorsque leur identité canonique couvrira suffisamment la période.", progress: { current: 42, required: 85, unit: "% de couverture" } },
      kpis: [],
      quality: qualityPartial,
      capabilities: [{ capabilityId: "GLOBAL_CONSUMPTION", state: "PARTIAL", reasonCodes: ["DATA_GATED"] }],
      detailEntries: [],
      publicationMeta,
      resourceMeta: resourceMeta(index + 1),
    };
  }
  const phenomenonId = `phenomenon:${moduleKey.toLowerCase()}`;
  const displays = ["3 289 €", "67 %", "1 chapitre", "2,4 / sem.", "+8 %", "4 moments", "12 visites", "—", "2 profils", "71 %"];
  return {
    kind: "global_module_compact",
    schemaVersion: "global-module-compact@v1",
    moduleKey,
    resource: presentation.resource,
    order: presentation.order,
    visibility: "VISIBLE",
    primaryInsight: insight(moduleKey, index),
    kpis: [
      { kpiId: `kpi:${moduleKey.toLowerCase()}:primary`, phenomenonId, labelKey: moduleKey === "ECONOMIC" ? "global.actual" : "global.coverage", displayValue: displays[index], metricRef: `metric:${moduleKey.toLowerCase()}:primary`, evidenceRefs: [`evidence:${moduleKey.toLowerCase()}`] },
      { kpiId: `kpi:${moduleKey.toLowerCase()}:support`, phenomenonId, labelKey: "global.support", displayValue: index % 2 === 0 ? "Fort" : "Suffisant", metricRef: `metric:${moduleKey.toLowerCase()}:support`, evidenceRefs: [`evidence:${moduleKey.toLowerCase()}:support`] },
    ],
    quality: qualityKnown,
    capabilities: [{ capabilityId: `GLOBAL_${moduleKey}`, state: "AVAILABLE", reasonCodes: [] }],
    detailEntries: [{ entryId: `expanded:${moduleKey}`, labelKey: "global.detail", targetResource: presentation.expandedResource, targetRef: `fixture:${presentation.expandedResource}` }],
    publicationMeta,
    resourceMeta: resourceMeta(index + 1),
  };
}

export function createGlobalV2FixtureBundle(scenario: GlobalV2FixtureScenario = "contract"): GlobalV2FixtureBundle {
  const modules = globalModulePresentations.map((entry, index) => moduleModel(entry.key, index));
  const initial: GlobalInitialReadModel = {
    kind: "global_initial",
    schemaVersion: "global-initial@v1",
    navigation: modules.map(({ moduleKey, resource, order, visibility, qualification, reasonCode }) => ({ moduleKey, resource, order, visibility, ...(qualification === undefined ? {} : { qualification }), ...(reasonCode === undefined ? {} : { reasonCode }) })),
    capabilities: [{ capabilityId: "GLOBAL_V2", state: "AVAILABLE", reasonCodes: [] }],
    publicationMeta,
    resourceMeta: resourceMeta(14),
  };
  const summary: ImportedGlobalSummaryReadModel = {
    kind: "global_imported_summary",
    schemaVersion: "global-imported-summary@v1",
    status: "FRESH",
    sanitizedHtml: "<p>Le fonctionnement économique reste proche de son niveau habituel, tandis qu’un chapitre récent commence à se stabiliser.</p><p>Les rythmes, les lieux et les expériences complètent cette lecture avec leurs supports propres. Les limites de couverture restent visibles là où l’identité d’achat n’est pas encore suffisante.</p>",
    importedAt: "2026-09-06T15:45:00Z",
    contentHash: hash("c"),
    publicationMeta,
    resourceMeta: resourceMeta(15),
  };
  return {
    initial,
    summary,
    modules,
    ...(scenario === "new-generation" ? { newerPublication: { ...publicationMeta, publicationId: "00000000-0000-4000-8000-000000000161", revision: 83, factsHash: hash("d"), manifestHash: hash("e"), generatedAt: "2026-09-06T17:00:00Z" } } : {}),
  };
}

function moduleFromResource(resource: string): GlobalPrimaryModuleKey {
  const item = globalModulePresentations.find((entry) => entry.resource === resource || entry.expandedResource === resource || ("detailResource" in entry && entry.detailResource === resource));
  if (item !== undefined) return item.key;
  return resource === "analysis_global_methodology" ? "ECONOMIC" : "ECONOMIC";
}

function expandedModel(resource: GlobalV2ExpandedResourceName, sectionKey: GlobalExpandedSectionKey, moduleKey = moduleFromResource(resource)): GlobalExpandedReadModel {
  const presentation = globalModulePresentation(moduleKey);
  const suffix = `${moduleKey.toLowerCase()}:${sectionKey.toLowerCase()}`;
  const metrics: readonly GlobalDetailMetric[] = [
    { metricId: `metric:${suffix}:observed`, labelKey: moduleKey === "ECONOMIC" ? "global.actual" : "global.coverage", displayValue: moduleKey === "CONSUMPTION" ? "≈ 42 %" : sectionKey === "EVOLUTION" ? "+8 %" : "91 %", knowledgeState: moduleKey === "CONSUMPTION" ? "PARTIAL" : "KNOWN", ...(moduleKey === "CONSUMPTION" ? { partialMeaning: "OBSERVED_ONLY" as const } : {}), dataNature: moduleKey === "CONSUMPTION" ? "ESTIMATED" : "OBSERVED", evidenceRefs: [`evidence:${suffix}`] },
    { metricId: `metric:${suffix}:support`, labelKey: "global.support", displayValue: "12 unités", knowledgeState: "KNOWN", dataNature: "OBSERVED", evidenceRefs: [`evidence:${suffix}:support`] },
  ];
  const series: readonly GlobalDetailSeries[] = sectionKey === "EVOLUTION" ? [{
    seriesId: `series:${suffix}`,
    labelKey: "global.economic",
    unit: "index",
    points: [
      { unitKey: "2026-02", displayValue: "42", knowledgeState: "KNOWN" },
      { unitKey: "2026-03", displayValue: "58", knowledgeState: "KNOWN" },
      { unitKey: "2026-04", displayValue: "54", knowledgeState: "KNOWN" },
      { unitKey: "2026-05", displayValue: "67", knowledgeState: "KNOWN" },
      { unitKey: "2026-06", displayValue: "72", knowledgeState: "KNOWN" },
      { unitKey: "2026-07", displayValue: "76", knowledgeState: "KNOWN" },
    ],
    evidenceRefs: [`evidence:${suffix}:series`],
  }] : [];
  const rows: readonly GlobalDetailRow[] = Array.from({ length: sectionKey === "BREAKDOWN" ? 5 : 3 }, (_, index) => ({
    rowId: `row:${suffix}:${index + 1}`,
    labelKey: `${presentation.shortLabel} · élément ${index + 1}`,
    displayValue: index === 0 ? "38 %" : `${24 - index * 4} %`,
    knowledgeState: index === 2 && moduleKey === "GEO_MOBILITY" ? "PARTIAL" : "KNOWN",
    ...(presentation.detailResource === undefined ? {} : { entityRef: `entity:${moduleKey.toLowerCase()}:${index + 1}` }),
    evidenceRefs: [`evidence:${suffix}:row:${index + 1}`],
  }));
  return {
    kind: "global_expanded",
    schemaVersion: "global-expanded@v1",
    resource,
    moduleKey,
    sectionKey,
    visibility: "VISIBLE",
    primaryInsight: insight(moduleKey, presentation.order - 1),
    secondaryInsights: sectionKey === "OVERVIEW" ? [] : [{ ...insight(moduleKey, presentation.order), insightId: `insight:${suffix}:secondary`, editorialRank: 2 }],
    metrics,
    series,
    rows,
    destinations: [
      { targetId: `method:${suffix}`, kind: "METHODOLOGY", resource: "analysis_global_methodology", scopeHash: hash("f"), sourcePublicationId: publicationMeta.publicationId, sourceAnalyticsRevision: publicationMeta.revision },
      { targetId: `history:${suffix}`, kind: "HISTORY", resource: "history_month_balance_summary", scopeHash: hash("f"), sourcePublicationId: publicationMeta.publicationId, sourceAnalyticsRevision: publicationMeta.revision },
      { targetId: `operations:${suffix}`, kind: "OPERATIONS", resource: "operations_browse", scopeHash: hash("f"), sourcePublicationId: publicationMeta.publicationId, sourceAnalyticsRevision: publicationMeta.revision },
    ],
    quality: moduleKey === "CONSUMPTION" ? qualityPartial : qualityKnown,
    capabilities: [{ capabilityId: `GLOBAL_${moduleKey}`, state: moduleKey === "CONSUMPTION" ? "PARTIAL" : "AVAILABLE", reasonCodes: moduleKey === "CONSUMPTION" ? ["DATA_GATED"] : [] }],
    publicationMeta,
    resourceMeta: resourceMeta(20 + presentation.order),
  };
}

function detailModel(resource: GlobalV2ExpandedResourceName, entityRef: string, requestedModuleKey?: GlobalPrimaryModuleKey): GlobalExpandedReadModel {
  const moduleKey = requestedModuleKey ?? moduleFromResource(resource);
  const presentation = globalModulePresentation(moduleKey);
  return {
    ...expandedModel(resource, resource === "analysis_global_methodology" ? "METHODOLOGY" : "OVERVIEW", moduleKey),
    rows: [
      { rowId: `${entityRef}:identity`, labelKey: "Identité analytique", displayValue: entityRef, knowledgeState: "KNOWN", evidenceRefs: ["evidence:identity"] },
      { rowId: `${entityRef}:coverage`, labelKey: "Couverture observable", displayValue: "91 %", knowledgeState: "KNOWN", evidenceRefs: ["evidence:coverage"] },
      { rowId: `${entityRef}:limitation`, labelKey: "Limite conservée", displayValue: "Aucune causalité déduite", knowledgeState: "KNOWN", evidenceRefs: ["evidence:limitation"] },
    ],
    series: resource === "analysis_global_methodology" ? [] : expandedModel(resource, "EVOLUTION", moduleKey).series,
    secondaryInsights: [],
    capabilities: [{ capabilityId: presentation.detailResource === resource ? `GLOBAL_${moduleKey}_DETAIL` : "GLOBAL_METHODOLOGY", state: "AVAILABLE", reasonCodes: [] }],
  };
}

export function createGlobalV2FixtureTransport(bundle: GlobalV2FixtureBundle, scenario: GlobalV2FixtureScenario): GlobalV2UiTransport {
  const attempts = new Map<string, number>();
  return async (request: GlobalV2UiRequest) => {
    await new Promise((resolve) => setTimeout(resolve, request.resource.includes("expanded") ? 45 : 18));
    const count = (attempts.get(request.resource) ?? 0) + 1;
    attempts.set(request.resource, count);
    if (scenario === "local-error" && request.resource === "analysis_global_relationships" && count === 1) throw new Error("SNAPSHOT_TEMPORARILY_UNAVAILABLE");
    if (request.resource === "analysis_global_manifest") return { data: bundle.initial, publicationMeta };
    if (request.resource === "analysis_global_summary_ai") return { data: bundle.summary, publicationMeta };
    const module = bundle.modules.find((entry) => entry.resource === request.resource);
    if (module !== undefined) return { data: module, publicationMeta };
    const expanded = globalModulePresentations.find((entry) => entry.expandedResource === request.resource);
    if (expanded !== undefined) return { data: expandedModel(expanded.expandedResource, (request.params.sectionKey ?? "OVERVIEW") as GlobalExpandedSectionKey, expanded.key), publicationMeta };
    if (request.resource === "analysis_global_methodology") return { data: detailModel(request.resource, request.params.methodRef ?? "method:global-v2", (request.params.moduleKey ?? "ECONOMIC") as GlobalPrimaryModuleKey), publicationMeta };
    const detail = globalModulePresentations.find((entry) => "detailResource" in entry && entry.detailResource === request.resource);
    if (detail !== undefined) return { data: detailModel(request.resource as GlobalV2ExpandedResourceName, request.params.entityRef ?? `entity:${detail.key.toLowerCase()}`), publicationMeta };
    throw new Error("SNAPSHOT_MISS");
  };
}
