import type {
  GlobalCompactInsight,
  GlobalCompactQuality,
  GlobalDetailMetric,
  GlobalDetailRow,
  GlobalDetailSeries,
  GlobalExpandedReadModel,
  GlobalExpandedSectionKey,
  GlobalInitialReadModel,
  GlobalBackgroundRhythmMonthDetailReadModel,
  GlobalBackgroundRhythmsReadModel,
  GlobalLifeTimelineReadModel,
  GlobalMomentComponentGroup,
  GlobalMomentComponentRow,
  GlobalMomentPeerObservation,
  GlobalModuleCompactReadModel,
  GlobalPrimaryModuleKey,
  GlobalReadModelPublicationMeta,
  GlobalReadModelResourceMeta,
  GlobalV2ExpandedResourceName,
  ImportedGlobalSummaryReadModel,
} from "@/query-api/global-v2";
import { PERSONA_PUBLISHED_PROFILE_CONTRACT_VERSION, parseGlobalBackgroundRhythmMonthDetailReadModel, parseGlobalBackgroundRhythmsReadModel, parseGlobalLifeTimelineReadModel } from "@/query-api/global-v2";
import { buildPersonaDirectModel, type PersonaDirectModel } from "@/query-api/global-v2/persona-direct-presentation";
import { globalModulePresentation, globalModulePresentations } from "./catalog";
import type { GlobalV2UiRequest, GlobalV2UiTransport } from "./visit-runtime";

const hash = (character: string) => character.repeat(64);

export type GlobalV2FixtureScenario = "contract" | "local-error" | "new-generation" | "rhythm-empty-hero" | "rhythm-m3-positive" | "rhythm-m5-positive" | "rhythm-empty-habits" | "rhythm-empty-moments" | "rhythm-empty-comparisons" | "rhythm-hero-m3" | "rhythm-hero-m5" | "rhythm-hero-m6-contextual";

export type GlobalV2FixtureBundle = {
  readonly initial: GlobalInitialReadModel;
  readonly persona: PersonaDirectModel;
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

const m2NeedQuality: GlobalCompactQuality = Object.freeze({
  knowledgeState: "PARTIAL",
  partialMeaning: "OBSERVED_ONLY",
  supportStatus: "PARTIAL_SUPPORT",
  effectiveCoverage: 0.34,
  dataNature: "OBSERVED",
  limitationCodes: ["M2_MONETARY_COVERAGE_PARTIAL"],
  evidenceRefs: ["evidence:m2:needs-coverage"],
});

const m2Categories = Object.freeze([
  { id: "00000000-0000-4000-8000-000000000201", label: "Logement", amount: "10148", share: "26,3 %", months: 12 },
  { id: "00000000-0000-4000-8000-000000000202", label: "Alimentation", amount: "6351", share: "16,5 %", months: 12 },
  { id: "00000000-0000-4000-8000-000000000203", label: "Transport & voiture", amount: "3822", share: "9,9 %", months: 12 },
  { id: "00000000-0000-4000-8000-000000000204", label: "Tabac & vape", amount: "3594", share: "9,3 %", months: 12 },
  { id: "00000000-0000-4000-8000-000000000205", label: "Maison & quotidien", amount: "3073", share: "8 %", months: 12 },
  { id: "00000000-0000-4000-8000-000000000206", label: "Santé", amount: "1860", share: "4,8 %", months: 9 },
  { id: "00000000-0000-4000-8000-000000000207", label: "Culture & événements", amount: "1492", share: "3,9 %", months: 8 },
  { id: "00000000-0000-4000-8000-000000000208", label: "Cadeaux", amount: "1280", share: "3,3 %", months: 5 },
  { id: "00000000-0000-4000-8000-000000000209", label: "Abonnements", amount: "1118", share: "2,9 %", months: 12 },
  { id: "00000000-0000-4000-8000-000000000210", label: "Voyages", amount: "985", share: "2,6 %", months: 4 },
]);

const m2Months = Object.freeze(["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]);

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

function moduleModel(moduleKey: GlobalPrimaryModuleKey, index: number, scenario: GlobalV2FixtureScenario): GlobalModuleCompactReadModel {
  const presentation = globalModulePresentation(moduleKey);
  if (moduleKey === "TRANSFORMATIONS" || moduleKey === "RELATIONSHIPS" || moduleKey === "MOMENTS") {
    return {
      kind: "global_module_compact",
      schemaVersion: "global-module-compact@v1",
      moduleKey,
      resource: presentation.resource,
      order: presentation.order,
      visibility: "HIDDEN",
      reasonCode: "NOT_SELECTED_FOR_SURFACE",
      kpis: [],
      quality: qualityKnown,
      capabilities: [{ capabilityId: `GLOBAL_${moduleKey}`, state: "AVAILABLE", reasonCodes: [] }],
      detailEntries: [],
      publicationMeta,
      resourceMeta: resourceMeta(index + 1),
    };
  }
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
  if (moduleKey === "CATEGORIES_NEEDS") {
    const phenomenonId = "presentation:categories_needs";
    return {
      kind: "global_module_compact",
      schemaVersion: "global-module-compact@v1",
      moduleKey,
      resource: presentation.resource,
      order: presentation.order,
      visibility: "VISIBLE",
      primaryInsight: { insightId: "presentation:categories_needs:notable-category", phenomenonId: "category:00000000-0000-4000-8000-000000000203", kind: "DETERMINISTIC_PRESENTATION", titleKey: "Transport & voiture", statementKey: "+888 € par rapport à sa référence · 1 037 € ce mois-ci · référence 149 €", primaryMetricRef: "global-m2:category:transport", entityRefs: ["category:00000000-0000-4000-8000-000000000203"], evidenceRefs: ["evidence:m2:transport"], detailRefs: [], editorialRank: 1 },
      kpis: [
        { kpiId: "kpi:categories:annual-total", phenomenonId, labelKey: "Dépenses sur la période", displayValue: "38 610 €", typedMeasure: { kind: "MONEY", value: "38610", unit: "EUR" }, metricRef: "global-m2:categories:annual-total", evidenceRefs: ["evidence:m2:annual"] },
        { kpiId: "kpi:categories:top-five-concentration", phenomenonId, labelKey: "Cinq principaux postes", displayValue: "70,1 % de nos dépenses", typedMeasure: { kind: "RATIO", value: "0.701", unit: "ratio" }, metricRef: "global-m2:categories:top-five-concentration", evidenceRefs: ["evidence:m2:annual"] },
        { kpiId: "kpi:needs:monetary-coverage", phenomenonId, labelKey: "Besoins renseignés", displayValue: "31 % du montant", typedMeasure: { kind: "RATIO", value: "0.31", unit: "ratio" }, metricRef: "global-m2:needs:monetary-coverage", evidenceRefs: ["evidence:m2:needs-coverage"] },
      ],
      quality: qualityKnown,
      capabilities: [{ capabilityId: "GLOBAL_CATEGORIES_NEEDS", state: "AVAILABLE", reasonCodes: [] }],
      detailEntries: [{ entryId: `expanded:${moduleKey}`, labelKey: "global.detail", targetResource: presentation.expandedResource, targetRef: `fixture:${presentation.expandedResource}` }],
      publicationMeta,
      resourceMeta: resourceMeta(index + 1),
    };
  }
  if (moduleKey === "RHYTHM") {
    return {
      kind: "global_module_compact",
      schemaVersion: "global-module-compact@v1",
      moduleKey,
      resource: presentation.resource,
      order: presentation.order,
      visibility: "VISIBLE",
      ...(scenario === "rhythm-empty-hero" ? {} : { primaryInsight: { insightId: "life-spending:m6:summer", phenomenonId: "moment:summer", kind: "M6_MATERIAL_COMPARISON", titleKey: "Nos vacances d’été", statementKey: "1 240 € reliés à ce moment · 330 € au-dessus de la médiane de 6 moments comparables.", primaryMetricRef: "moment:summer:causal-cost", comparisonRef: "family:travel:SAME_FAMILY", entityRefs: ["moment:summer"], evidenceRefs: ["evidence:life:summer"], detailRefs: ["moment:summer"], editorialRank: 1 } }),
      kpis: [],
      quality: qualityKnown,
      capabilities: [{ capabilityId: "GLOBAL_RHYTHM", state: "AVAILABLE", reasonCodes: [] }],
      detailEntries: [{ entryId: "expanded:RHYTHM", labelKey: "global.detail", targetResource: presentation.expandedResource, targetRef: `fixture:${presentation.expandedResource}` }],
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
  const modules = globalModulePresentations.map((entry, index) => moduleModel(entry.key, index, scenario));
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
    persona: buildPersonaDirectModel({ overview: personaExpandedFixtureModel("OVERVIEW"), indices: [], details: new Map(), labels: { needs: {} }, ownerDetailResolutionsInitial: 0, serverBuildMs: 0 }),
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

function fixtureMoneyMetric(metricId: string, labelKey: string, value: string, knowledgeState: "KNOWN" | "PARTIAL" = "KNOWN", signed = false): GlobalDetailMetric {
  const numeric = Number(value);
  const amount = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(numeric));
  return {
    metricId,
    labelKey,
    displayValue: `${signed && numeric > 0 ? "+" : numeric < 0 ? "−" : ""}${amount} €`,
    typedMeasure: { kind: "MONEY", value, unit: "EUR/month" },
    knowledgeState,
    ...(knowledgeState === "PARTIAL" ? { partialMeaning: "OBSERVED_ONLY" as const } : {}),
    dataNature: knowledgeState === "PARTIAL" ? "HYBRID" : "OBSERVED",
    evidenceRefs: [`evidence:economic:${metricId}`],
  };
}

function economicFixtureModel(sectionKey: GlobalExpandedSectionKey): GlobalExpandedReadModel {
  const overviewMetrics = [
    fixtureMoneyMetric("typical-state", "État habituel", "3124.235"),
    fixtureMoneyMetric("minimal-state", "Nos dépenses minimum", "1634.0783333333333", "PARTIAL"),
    fixtureMoneyMetric("typical-minimal-gap", "Notre marge", "1490.1566666666667", "PARTIAL", true),
    fixtureMoneyMetric("actual", "Dépenses du mois", "3773.14"),
    fixtureMoneyMetric("typical-reference", "Référence habituelle", "2977.82"),
    fixtureMoneyMetric("actual-reference-delta", "Écart à la référence", "795.32", "KNOWN", true),
    fixtureMoneyMetric("overview-trend-slope", "Pente mensuelle", "-52.87", "KNOWN", true),
    fixtureMoneyMetric("overview-recent-delta", "Variation récente", "759.68", "KNOWN", true),
    fixtureMoneyMetric("overview-dispersion-amplitude", "Amplitude", "1707"),
  ];
  const temporalMetrics = [
    fixtureMoneyMetric("trend-slope", "Pente mensuelle", "-52.87", "KNOWN", true),
    fixtureMoneyMetric("recent-delta", "Variation récente", "759.68", "KNOWN", true),
    fixtureMoneyMetric("dispersion-median", "Médiane", "3124.235"),
    fixtureMoneyMetric("dispersion-mad", "Écart médian absolu", "509"),
    fixtureMoneyMetric("dispersion-min", "Minimum observé", "2441"),
    fixtureMoneyMetric("dispersion-max", "Maximum observé", "4148.5"),
    fixtureMoneyMetric("dispersion-amplitude", "Amplitude", "1707"),
  ];
  const months = ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"];
  const actualValues = ["4148.5", "3570", "3290", "2850", "3210", "3020", "2820", "2441", "2630", "3010", "3510", "3773.14"];
  const typicalValues = ["4148.5", "3859", "3570", "3430", "3290", "3250", "3210", "3124.235", "3050", "3020", "2977.82", "3124.235"];
  const point = (unitKey: string, value: string | undefined, knowledgeState: "KNOWN" | "UNKNOWN" = "KNOWN") => ({ unitKey, ...(value === undefined ? {} : { displayValue: `${value} €`, typedMeasure: { kind: "MONEY" as const, value, unit: "EUR/month" } }), knowledgeState });
  const series: readonly GlobalDetailSeries[] = [
    { seriesId: "economic:actual", labelKey: "Dépenses réelles", unit: "EUR/month", points: months.map((month, index) => point(month, actualValues[index]!)), evidenceRefs: ["evidence:economic:actual"] },
    { seriesId: "economic:typical-state", labelKey: "État habituel", unit: "EUR/month", points: months.map((month, index) => point(month, typicalValues[index]!)), evidenceRefs: ["evidence:economic:typical"] },
    { seriesId: "economic:minimal-state", labelKey: "Minimum History", unit: "EUR/month", points: months.map((month) => point(month, undefined, "UNKNOWN")), evidenceRefs: ["evidence:economic:minimal-history"] },
  ];
  const rowsBySection: Partial<Record<GlobalExpandedSectionKey, readonly GlobalDetailRow[]>> = {
    BREAKDOWN: [
      ["necessity:constraint", "Nécessité · Contraint", "1730.27", "46"],
      ["necessity:essential", "Nécessité · Indispensable", "1572.28", "42"],
      ["necessity:adjustable", "Nécessité · Dépenses ajustables", "148.30", "4"],
      ["necessity:optional", "Nécessité · Optionnel", "322.29", "8"],
      ["behavior:fixed", "Comportement · Fixe", "1590.49", "42"],
      ["behavior:variable", "Comportement · Variable", "2182.65", "58"],
      ["life:current", "Périmètre de vie · Vie courante", "2343.18", "62"],
      ["life:outside", "Périmètre de vie · Hors quotidien", "1429.96", "38"],
    ].map(([rowId, labelKey, value, percentage]) => ({ rowId, labelKey, displayValue: `${value} € · ${percentage} %`, typedMeasure: { kind: "MONEY" as const, value, unit: "EUR/month" }, knowledgeState: "KNOWN" as const, evidenceRefs: [`evidence:${rowId}`] })),
    PATTERNS: [
      { rowId: "recurrence:edf", labelKey: "EDF — Électricité", displayValue: "≈ 78 € / paiement · 12 paiements observés · août 2025 → juillet 2026", typedMeasure: { kind: "MONEY", value: "78.20", unit: "EUR/occurrence" }, knowledgeState: "KNOWN", entityRef: "recurrence:edf", evidenceRefs: ["evidence:recurrence:edf"] },
      { rowId: "recurrence:uber", labelKey: "Uber — Uber One", displayValue: "≈ 60 € / paiement · 10 paiements observés · août 2025 → juillet 2026", typedMeasure: { kind: "MONEY", value: "59.99", unit: "EUR/occurrence" }, knowledgeState: "KNOWN", entityRef: "recurrence:uber", evidenceRefs: ["evidence:recurrence:uber"] },
      { rowId: "recurrence:max", labelKey: "Max — Abonnement", displayValue: "≈ 10 € / paiement · 12 paiements observés · août 2025 → juillet 2026", typedMeasure: { kind: "MONEY", value: "9.99", unit: "EUR/occurrence" }, knowledgeState: "KNOWN", entityRef: "recurrence:max", evidenceRefs: ["evidence:recurrence:max"] },
    ],
  };
  return {
    kind: "global_expanded",
    schemaVersion: "global-expanded@v1",
    resource: "analysis_global_economic_expanded",
    moduleKey: "ECONOMIC",
    sectionKey,
    visibility: "VISIBLE",
    secondaryInsights: [],
    metrics: sectionKey === "OVERVIEW" ? overviewMetrics : sectionKey === "EVOLUTION" ? temporalMetrics : [],
    series: sectionKey === "EVOLUTION" ? series : [],
    rows: rowsBySection[sectionKey] ?? [],
    destinations: [],
    quality: sectionKey === "OVERVIEW" ? { ...qualityPartial, limitationCodes: ["ECONOMIC_TIMING_PARTIAL"] } : qualityKnown,
    capabilities: [{ capabilityId: "GLOBAL_ECONOMIC", state: "AVAILABLE", reasonCodes: [] }],
    publicationMeta,
    resourceMeta: resourceMeta(20),
  };
}

function m2Metric(metricId: string, labelKey: string, value: string, kind: "MONEY" | "RATIO" | "COUNT" | "DECIMAL", unit: string, displayValue: string): GlobalDetailMetric {
  return { metricId, labelKey, displayValue, typedMeasure: { kind, value, unit }, knowledgeState: "KNOWN", dataNature: "OBSERVED", evidenceRefs: [`evidence:m2:${metricId}`] };
}

function m2CategoryRow(category: (typeof m2Categories)[number], index: number): GlobalDetailRow {
  return { rowId: `${String(index + 1).padStart(3, "0")}:category:${category.id}`, labelKey: category.label, displayValue: `${new Intl.NumberFormat("fr-FR").format(Number(category.amount))} € · ${category.share} · ${category.months} mois actifs`, typedMeasure: { kind: "MONEY", value: category.amount, unit: "EUR" }, knowledgeState: "KNOWN", entityRef: `category:${category.id}`, evidenceRefs: [`evidence:m2:category:${category.id}`] };
}

function m2Series(category: (typeof m2Categories)[number], index: number): GlobalDetailSeries {
  const annual = Number(category.amount);
  const weights = [0.055, 0.064, 0.071, 0.068, 0.082, 0.077, 0.074, 0.069, 0.081, 0.086, 0.102, 0.171];
  return { seriesId: `category-series:${category.id}`, labelKey: category.label, unit: "EUR", points: m2Months.map((unitKey, monthIndex) => { const value = String(Math.round(annual * (weights[monthIndex]! + index * 0.001))); return { unitKey, displayValue: `${new Intl.NumberFormat("fr-FR").format(Number(value))} €`, typedMeasure: { kind: "MONEY", value, unit: "EUR" }, knowledgeState: "KNOWN" }; }), evidenceRefs: [`evidence:m2:category:${category.id}`] };
}

function m2ExpandedFixtureModel(sectionKey: GlobalExpandedSectionKey): GlobalExpandedReadModel {
  const categoryRows = m2Categories.map(m2CategoryRow);
  const comparisons: readonly GlobalDetailRow[] = [
    { rowId: "001:materiality:transport", labelKey: "Hausse · Transport & voiture", displayValue: "+888 € · mois 1 037 € · référence 149 €", typedMeasure: { kind: "MONEY", value: "888", unit: "EUR" }, knowledgeState: "KNOWN", entityRef: `category:${m2Categories[2]!.id}`, evidenceRefs: ["evidence:m2:transport"] },
    { rowId: "002:materiality:permit", labelKey: "Hausse · Permis de conduire", displayValue: "+437 € · mois 437 € · référence 0 €", typedMeasure: { kind: "MONEY", value: "437", unit: "EUR" }, knowledgeState: "KNOWN", entityRef: `category:${m2Categories[9]!.id}`, evidenceRefs: ["evidence:m2:permit"] },
    { rowId: "003:materiality:culture", labelKey: "Baisse · Culture & événements", displayValue: "−95 € · mois 41 € · référence 136 €", typedMeasure: { kind: "MONEY", value: "-95", unit: "EUR" }, knowledgeState: "KNOWN", entityRef: `category:${m2Categories[6]!.id}`, evidenceRefs: ["evidence:m2:culture"] },
    { rowId: "004:materiality:food", labelKey: "Baisse · Restauration", displayValue: "−57 € · mois 91 € · référence 148 €", typedMeasure: { kind: "MONEY", value: "-57", unit: "EUR" }, knowledgeState: "KNOWN", entityRef: `category:${m2Categories[1]!.id}`, evidenceRefs: ["evidence:m2:food"] },
  ];
  const needs: readonly GlobalDetailRow[] = [
    { rowId: "001:need:food", labelKey: "Courses alimentaires du foyer", displayValue: "5 234 € · 13,6 %", typedMeasure: { kind: "MONEY", value: "5234", unit: "EUR" }, knowledgeState: "KNOWN", entityRef: "need:00000000-0000-4000-8000-000000000221", evidenceRefs: ["evidence:m2:need-food"] },
    { rowId: "002:need:tobacco", labelKey: "Tabac habituel", displayValue: "2 872 € · 7,4 %", typedMeasure: { kind: "MONEY", value: "2872", unit: "EUR" }, knowledgeState: "KNOWN", entityRef: "need:00000000-0000-4000-8000-000000000222", evidenceRefs: ["evidence:m2:need-tobacco"] },
    { rowId: "003:need:fuel", labelKey: "Carburant du quotidien", displayValue: "1 069 € · 2,8 %", typedMeasure: { kind: "MONEY", value: "1069", unit: "EUR" }, knowledgeState: "KNOWN", entityRef: "need:00000000-0000-4000-8000-000000000223", evidenceRefs: ["evidence:m2:need-fuel"] },
  ];
  const metrics = sectionKey === "OVERVIEW" ? [
    m2Metric("categories-annual-total", "Dépenses sur la période", "38610", "MONEY", "EUR", "38 610 €"),
    m2Metric("categories-top-five-concentration", "Part des cinq principaux postes", "0.701", "RATIO", "ratio", "70,1 % de nos dépenses"),
  ] : sectionKey === "PATTERNS" ? [
    m2Metric("needs-component-coverage", "Composants avec un besoin renseigné", "0.34", "RATIO", "ratio", "34 %"),
    m2Metric("needs-monetary-coverage", "Montant avec un besoin renseigné", "0.31", "RATIO", "ratio", "31 %"),
    m2Metric("needs-known-annual-amount", "Montant annuel renseigné", "11969", "MONEY", "EUR", "11 969 €"),
    m2Metric("needs-unclassified-annual-amount", "Montant annuel non renseigné", "26641", "MONEY", "EUR", "26 641 €"),
  ] : [];
  return {
    kind: "global_expanded", schemaVersion: "global-expanded@v1", resource: "analysis_global_categories_needs_expanded", moduleKey: "CATEGORIES_NEEDS", sectionKey, visibility: "VISIBLE",
    secondaryInsights: sectionKey === "COMPARISONS" ? [
      { insightId: "presentation:categories_needs:material-change:permit", phenomenonId: "category:permit", kind: "MATERIAL_CHANGE", titleKey: "Permis de conduire", statementKey: "Permis de conduire est nettement au-dessus de sa référence de +437 €.", primaryMetricRef: "global-m2:category:permit:delta", entityRefs: [`category:${m2Categories[9]!.id}`], evidenceRefs: ["evidence:m2:permit"], detailRefs: [], editorialRank: 2 },
      { insightId: "presentation:categories_needs:material-change:culture", phenomenonId: "category:culture", kind: "MATERIAL_CHANGE", titleKey: "Culture & événements", statementKey: "Culture & événements est nettement en dessous de sa référence de −95 €.", primaryMetricRef: "global-m2:category:culture:delta", entityRefs: [`category:${m2Categories[6]!.id}`], evidenceRefs: ["evidence:m2:culture"], detailRefs: [], editorialRank: 3 },
    ] : [],
    metrics,
    series: sectionKey === "EVOLUTION" ? m2Categories.slice(0, 3).map(m2Series) : [],
    rows: sectionKey === "BREAKDOWN" ? categoryRows : sectionKey === "PATTERNS" ? needs : sectionKey === "COMPARISONS" ? comparisons : [],
    destinations: [], quality: sectionKey === "PATTERNS" ? m2NeedQuality : qualityKnown,
    capabilities: [{ capabilityId: "GLOBAL_CATEGORIES_NEEDS", state: "AVAILABLE", reasonCodes: [] }], publicationMeta, resourceMeta: resourceMeta(22),
  };
}

function lifeInsight(id: string, titleKey: string, statementKey: string, entityRef: string, rank: number): GlobalCompactInsight {
  return { insightId: `life-spending:${id}`, phenomenonId: entityRef, kind: id.includes("routine") ? "M4_ACTIVITY_COST_PROFILE" : "M6_MATERIAL_COMPARISON", titleKey, statementKey, primaryMetricRef: `${entityRef}:causal-cost`, entityRefs: [entityRef], evidenceRefs: [`evidence:life:${id}`], detailRefs: [entityRef], editorialRank: rank };
}

function lifeExpandedFixtureModel(sectionKey: GlobalExpandedSectionKey, scenario: GlobalV2FixtureScenario = "contract"): GlobalExpandedReadModel {
  const primary = lifeInsight("summer", "Nos vacances d’été", "1 240 € reliés à ce moment · 330 € au-dessus de la médiane de 6 moments comparables.", "moment:summer", 1);
  const secondary = [
    lifeInsight("routine-sport", "Nos séances de sport", "18 € en médiane quand un coût est connu · coût connu 9 fois sur 12.", "household-activity:sport", 2),
    lifeInsight("concert", "Le concert de juin", "186 € ont été reliés à ce moment, sans assez de moments comparables.", "moment:concert", 3),
  ];
  const m3Positive = { ...lifeInsight("change-home", "Notre quotidien à la maison a changé", "Cette transformation reste visible sur plusieurs périodes observées.", "transformation:home", 1), kind: "M3_CERTIFIED_TRANSFORMATION" };
  const m5Positive = { ...lifeInsight("relationship-onsite", "Restaurant les jours sur site", "Dans nos données, les jours sur site sont associés à une fréquence de restaurant plus élevée que les jours en télétravail.", "relationship:onsite-restaurant", 3), kind: "M5_MATERIAL_ROBUST_ASSOCIATION" };
  const m6Contextual = { ...lifeInsight("concert", "Le concert de juin", "186 € ont été reliés à ce moment, sans assez de moments comparables.", "moment:concert", 1), kind: "M6_CONTEXTUAL_CAUSAL_MOMENT" };
  const activityRows: readonly GlobalDetailRow[] = [
    { rowId: "001:profile:sport", labelKey: "Séances de sport", displayValue: "Médiane des occurrences dont un coût est directement relié : 18 € · 9 occurrences renseignées sur 12", typedMeasure: { kind: "MONEY", value: "18", unit: "EUR/occurrence" }, knowledgeState: "PARTIAL", entityRef: "household-activity:sport", activityCostProfile: { knownCausalCostCount: { kind: "COUNT", value: "9", unit: "occurrence" }, totalOccurrenceCount: { kind: "COUNT", value: "12", unit: "occurrence" }, coverageRatio: { kind: "RATIO", value: "0.75", unit: "ratio" }, nonAdditiveAcrossActivities: true }, evidenceRefs: ["evidence:life:sport"] },
    { rowId: "002:profile:cinema", labelKey: "Sorties cinéma", displayValue: "Médiane des occurrences dont un coût est directement relié : 31 € · 5 occurrences renseignées sur 7", typedMeasure: { kind: "MONEY", value: "31", unit: "EUR/occurrence" }, knowledgeState: "PARTIAL", entityRef: "household-activity:cinema", activityCostProfile: { knownCausalCostCount: { kind: "COUNT", value: "5", unit: "occurrence" }, totalOccurrenceCount: { kind: "COUNT", value: "7", unit: "occurrence" }, coverageRatio: { kind: "RATIO", value: "0.714285", unit: "ratio" }, nonAdditiveAcrossActivities: true }, evidenceRefs: ["evidence:life:cinema"] },
  ];
  const momentRows: readonly GlobalDetailRow[] = [
    { rowId: "001:moment:summer", labelKey: "Nos vacances d’été", displayValue: "Voyage · 1 240 € · 2025-08-02 → 2025-08-16", typedMeasure: { kind: "MONEY", value: "1240", unit: "EUR" }, knowledgeState: "KNOWN", entityRef: "moment:summer", evidenceRefs: ["evidence:life:summer"] },
    { rowId: "002:moment:concert", labelKey: "Le concert de juin", displayValue: "Sortie culturelle · 186 € · 2026-06-14", typedMeasure: { kind: "MONEY", value: "186", unit: "EUR" }, knowledgeState: "KNOWN", entityRef: "moment:concert", evidenceRefs: ["evidence:life:concert"] },
  ];
  const comparisonRows: readonly GlobalDetailRow[] = [{ rowId: "001:comparison:summer", labelKey: "Nos vacances d’été", displayValue: "+330 € par rapport à la médiane · 6 expériences comparables", typedMeasure: { kind: "MONEY", value: "330", unit: "EUR" }, knowledgeState: "KNOWN", entityRef: "moment:summer", momentComparison: { comparisonTier: "SAME_FAMILY", comparisonProfileId: "family:travel", peerCount: { kind: "COUNT", value: "6", unit: "moment" }, subjectCost: { kind: "MONEY", value: "1240", unit: "EUR" }, peerMedian: { kind: "MONEY", value: "910", unit: "EUR" }, q1: { kind: "MONEY", value: "760", unit: "EUR" }, q3: { kind: "MONEY", value: "1080", unit: "EUR" }, mad: { kind: "MONEY", value: "130", unit: "EUR" }, absoluteDelta: { kind: "MONEY", value: "330", unit: "EUR" }, relativeDelta: { kind: "DECIMAL", value: "0.3626", unit: "ratio" } }, evidenceRefs: ["evidence:life:summer-comparison"] }];
  const selected = scenario === "rhythm-empty-hero" ? []
    : scenario === "rhythm-hero-m3" ? [m3Positive]
    : scenario === "rhythm-hero-m5" ? [m5Positive]
    : scenario === "rhythm-hero-m6-contextual" ? [m6Contextual]
    : scenario === "rhythm-m5-positive" ? [primary, secondary[0]!, m5Positive]
    : [primary, ...secondary];
  const overviewRows = [comparisonRows[0]!, momentRows[1]!];
  const rows = sectionKey === "OVERVIEW" ? overviewRows : sectionKey === "PATTERNS" ? scenario === "rhythm-empty-habits" ? [] : activityRows : sectionKey === "BREAKDOWN" ? scenario === "rhythm-empty-moments" ? [] : momentRows : sectionKey === "COMPARISONS" ? scenario === "rhythm-empty-comparisons" ? [] : comparisonRows : [];
  return {
    kind: "global_expanded", schemaVersion: "global-expanded@v1", resource: "analysis_global_rhythm_expanded", moduleKey: "RHYTHM", sectionKey, visibility: "VISIBLE",
    ...(sectionKey === "OVERVIEW" && selected[0] !== undefined ? { primaryInsight: selected[0] } : {}), secondaryInsights: sectionKey === "OVERVIEW" ? selected.slice(1) : sectionKey === "EVOLUTION" && scenario === "rhythm-m3-positive" ? [m3Positive] : [], metrics: [], series: [], rows, destinations: [], quality: qualityKnown,
    capabilities: [{ capabilityId: "GLOBAL_RHYTHM", state: "AVAILABLE", reasonCodes: [] }], publicationMeta, resourceMeta: resourceMeta(24),
  };
}

type FixturePersonaProfile = NonNullable<GlobalExpandedReadModel["profile"]>["profiles"][number];
type FixturePersonaTrait = FixturePersonaProfile["featuredTraits"][number];
type FixturePersonaChild = NonNullable<FixturePersonaTrait["children"]>[number];

const fixtureAdrienId = "00000000-0000-4000-8000-000000000301";
const fixtureManonId = "00000000-0000-4000-8000-000000000302";

function fixturePersonaChild(traitId: string, semanticKey: string, kind: FixturePersonaChild["kind"], temporalStatus?: FixturePersonaChild["temporalStatus"], metrics?: FixturePersonaChild["metrics"]): FixturePersonaChild {
  return { traitId, semanticKey, kind, ...(temporalStatus === undefined ? {} : { temporalStatus }), ...(metrics === undefined ? {} : { metrics }) };
}

function fixturePersonaTrait(input: {
  readonly traitId: string;
  readonly personId: string;
  readonly semanticKey: string;
  readonly kind: FixturePersonaTrait["kind"];
  readonly temporalStatus?: FixturePersonaTrait["temporalStatus"];
  readonly metrics?: FixturePersonaTrait["metrics"];
  readonly qualifications?: readonly string[];
  readonly children?: readonly FixturePersonaChild[];
}): FixturePersonaTrait {
  const children = input.children ?? [];
  return {
    traitId: input.traitId,
    subject: { kind: "PERSON", personId: input.personId as never },
    scope: "PERSONAL",
    kind: input.kind,
    semanticKey: input.semanticKey,
    ...(input.temporalStatus === undefined ? {} : { temporalStatus: input.temporalStatus }),
    ...(input.qualifications === undefined ? {} : { qualifications: input.qualifications }),
    ...(input.metrics === undefined ? {} : { metrics: input.metrics }),
    ...(children.length === 0 ? {} : { children }),
  };
}

function personaExpandedFixtureModel(sectionKey: GlobalExpandedSectionKey): GlobalExpandedReadModel {
  const creative = fixturePersonaTrait({
    traitId: "persona-fixture:adrien:creative",
    personId: fixtureAdrienId,
    semanticKey: "universe.creative_projects",
    kind: "UNIVERSE",
    temporalStatus: "PROJECT",
    qualifications: ["HOME_STUDIO", "MUSIC", "PHOTO", "PROJECT"],
    metrics: { childCount: 2 },
    children: [
      fixturePersonaChild("persona-fixture:adrien:photo", "creative.photo.adrien", "PROJECT", "PROJECT"),
      fixturePersonaChild("persona-fixture:adrien:creative-support", "creative.projects.adrien", "UNIVERSE", "UNKNOWN"),
    ],
  });
  const adrienTraits = [
    creative,
    fixturePersonaTrait({ traitId: "persona-fixture:adrien:licence", personId: fixtureAdrienId, semanticKey: "driving_license.adrien", kind: "PROJECT", temporalStatus: "PROJECT", qualifications: ["IN_PROGRESS"] }),
    fixturePersonaTrait({ traitId: "persona-fixture:adrien:mobility", personId: fixtureAdrienId, semanticKey: "mobility.work.adrien", kind: "MOBILITY", metrics: { directCost: 0 } }),
    fixturePersonaTrait({ traitId: "persona-fixture:adrien:chatgpt", personId: fixtureAdrienId, semanticKey: "subscription.chatgpt.adrien", kind: "HABIT" }),
  ];
  const beauty = fixturePersonaTrait({
    traitId: "persona-fixture:manon:beauty",
    personId: fixtureManonId,
    semanticKey: "universe.beauty_and_care",
    kind: "UNIVERSE",
    metrics: { childCount: 3 },
    children: [
      fixturePersonaChild("persona-fixture:manon:mascara", "product-need:maquillage_manon_mascara", "HABIT", "CHANGED", { occurrenceCount: 6, typicalPrice: 32 }),
      fixturePersonaChild("persona-fixture:manon:brows", "product-need:maquillage_manon_sourcils", "HABIT", "STABLE", { occurrenceCount: 7, typicalPrice: 9.99 }),
      fixturePersonaChild("persona-fixture:manon:skincare", "product-need:skincare_manon_masque", "HABIT", "CHANGED", { occurrenceCount: 2, typicalPrice: 9.98 }),
    ],
  });
  const manonTraits = [
    beauty,
    fixturePersonaTrait({ traitId: "persona-fixture:manon:mobility", personId: fixtureManonId, semanticKey: "mobility.work.manon", kind: "MOBILITY" }),
  ];
  const profiles: readonly FixturePersonaProfile[] = [
    { subject: { kind: "PERSON", personId: fixtureAdrienId as never }, scope: "PERSONAL", featuredTraits: adrienTraits },
    { subject: { kind: "PERSON", personId: fixtureManonId as never }, scope: "PERSONAL", featuredTraits: manonTraits },
  ];
  return {
    kind: "global_expanded", schemaVersion: "global-expanded@v1", resource: "analysis_global_personas_expanded", moduleKey: "PERSONAS", sectionKey, visibility: "VISIBLE",
    secondaryInsights: [], metrics: [], series: [], rows: sectionKey === "OVERVIEW" ? [
      { rowId: "persona-label:adrien", labelKey: "Adrien · Profil", knowledgeState: "KNOWN", entityRef: `person:${fixtureAdrienId}`, evidenceRefs: ["fixture:persona-label:adrien"] },
      { rowId: "persona-label:manon", labelKey: "Manon · Profil", knowledgeState: "KNOWN", entityRef: `person:${fixtureManonId}`, evidenceRefs: ["fixture:persona-label:manon"] },
    ] : [], destinations: [], ...(sectionKey === "OVERVIEW" ? { profile: { contractVersion: PERSONA_PUBLISHED_PROFILE_CONTRACT_VERSION, methodVersion: "global_persona_profile@v1" as never, profiles } } : {}), quality: qualityKnown,
    capabilities: [{ capabilityId: "GLOBAL_PERSONAS", state: "AVAILABLE", reasonCodes: [] }], publicationMeta, resourceMeta: resourceMeta(24),
  };
}

function expandedModel(resource: GlobalV2ExpandedResourceName, sectionKey: GlobalExpandedSectionKey, moduleKey = moduleFromResource(resource), scenario: GlobalV2FixtureScenario = "contract"): GlobalExpandedReadModel {
  if (resource === "analysis_global_economic_expanded") return economicFixtureModel(sectionKey);
  if (resource === "analysis_global_categories_needs_expanded") return m2ExpandedFixtureModel(sectionKey);
  if (resource === "analysis_global_rhythm_expanded") return lifeExpandedFixtureModel(sectionKey, scenario);
  if (resource === "analysis_global_personas_expanded") return personaExpandedFixtureModel(sectionKey);
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

function lifeDetailMetric(metricId: string, labelKey: string, kind: "MONEY" | "COUNT" | "RATIO" | "DECIMAL", value: string, unit: string, displayValue: string): GlobalDetailMetric {
  return { metricId, labelKey, displayValue, typedMeasure: { kind, value, unit }, knowledgeState: "KNOWN", dataNature: "OBSERVED", evidenceRefs: [`evidence:life:${metricId}`] };
}

function lifeRoutineDetailFixture(entityRef: string): GlobalExpandedReadModel {
  const activity = entityRef.endsWith(":cinema") ? "Sorties cinéma" : entityRef.endsWith(":courses_alimentaires") ? "Courses alimentaires" : "Séances de sport";
  if (entityRef.startsWith("person-activity:")) {
    const manon = entityRef.includes(":manon:");
    const count = manon ? "6" : "8";
    const cadence = manon ? "9" : "7";
    return {
      kind: "global_expanded", schemaVersion: "global-expanded@v1", resource: "analysis_global_routine_detail", moduleKey: "RHYTHM", sectionKey: "OVERVIEW", visibility: "VISIBLE", secondaryInsights: [],
      metrics: [lifeDetailMetric(`${entityRef}:occurrences`, "Occurrences observées", "COUNT", count, "occurrence", count), lifeDetailMetric(`${entityRef}:cadence`, "Intervalle médian", "DECIMAL", cadence, "day", `${cadence} jours`)],
      series: [], rows: [], destinations: [], quality: qualityKnown, capabilities: [{ capabilityId: "GLOBAL_RHYTHM_DETAIL", state: "AVAILABLE", reasonCodes: [] }], publicationMeta, resourceMeta: resourceMeta(34),
    };
  }
  const median = entityRef.endsWith(":cinema") ? "31" : "18";
  const known = entityRef.endsWith(":cinema") ? "5" : "9";
  const total = entityRef.endsWith(":cinema") ? "7" : "12";
  const coverage = entityRef.endsWith(":cinema") ? "0.714285" : "0.75";
  return {
    kind: "global_expanded", schemaVersion: "global-expanded@v1", resource: "analysis_global_routine_detail", moduleKey: "RHYTHM", sectionKey: "OVERVIEW", visibility: "VISIBLE", secondaryInsights: [],
    metrics: [lifeDetailMetric(`${entityRef}:median`, "Médiane des occurrences dont un coût est directement relié", "MONEY", median, "EUR/occurrence", `${median} €`), lifeDetailMetric(`${entityRef}:known-count`, "Occurrences renseignées", "COUNT", known, "occurrence", known), lifeDetailMetric(`${entityRef}:total-count`, "Occurrences observées au foyer", "COUNT", total, "occurrence", total), lifeDetailMetric(`${entityRef}:coverage`, "Couverture des coûts directement reliés", "RATIO", coverage, "ratio", `${Math.round(Number(coverage) * 100)} %`)],
    series: [], rows: [
      { rowId: `context:001:${entityRef}:adrien`, labelKey: `${activity} · Adrien`, displayValue: "8 occurrences · intervalle médian 7 jours", typedMeasure: { kind: "COUNT", value: "8", unit: "occurrence" }, knowledgeState: "KNOWN", entityRef: `person-activity:adrien:${entityRef.split(":").at(-1)}`, evidenceRefs: ["evidence:life:adrien"] },
      { rowId: `context:002:${entityRef}:manon`, labelKey: `${activity} · Manon`, displayValue: "6 occurrences · intervalle médian 9 jours", typedMeasure: { kind: "COUNT", value: "6", unit: "occurrence" }, knowledgeState: "KNOWN", entityRef: `person-activity:manon:${entityRef.split(":").at(-1)}`, evidenceRefs: ["evidence:life:manon"] },
    ], destinations: [], quality: qualityKnown, capabilities: [{ capabilityId: "GLOBAL_RHYTHM_DETAIL", state: "AVAILABLE", reasonCodes: [] }], publicationMeta, resourceMeta: resourceMeta(34),
  };
}

function lifeMomentDetailFixture(entityRef: string): GlobalExpandedReadModel {
  const isSummer = entityRef === "moment:summer";
  const isHome = entityRef === "moment:home";
  const title = isSummer ? "Nos vacances d’été" : isHome ? "Aménagement du salon 2025" : "Concert Orelsan – Sud de France Arena";
  const typeAndDates = isSummer ? "Voyage · 2025-08-02 → 2025-08-16" : isHome ? "Projet maison · 2025-10-03 → 2025-11-10" : "Sortie culturelle · 2026-06-14";
  const causal = isSummer ? "1253.9" : isHome ? "2298.96" : "159.4";
  const spent = isSummer ? "1160" : isHome ? "4759.36" : "264";
  const peerCount = isSummer ? 4 : isHome ? 6 : 0;
  const comparison = peerCount === 0 ? undefined : { comparisonTier: "SAME_FAMILY" as const, comparisonProfileId: isSummer ? "family:travel" : "family:home", peerCount: { kind: "COUNT" as const, value: String(peerCount), unit: "moment" }, subjectCost: { kind: "MONEY" as const, value: causal, unit: "EUR" }, peerMedian: { kind: "MONEY" as const, value: isSummer ? "910" : "860.5", unit: "EUR" }, q1: { kind: "MONEY" as const, value: isSummer ? "760" : "520", unit: "EUR" }, q3: { kind: "MONEY" as const, value: isSummer ? "1080" : "1220.25", unit: "EUR" }, mad: { kind: "MONEY" as const, value: "130", unit: "EUR" }, absoluteDelta: { kind: "MONEY" as const, value: isSummer ? "343.9" : "1438.46", unit: "EUR" }, relativeDelta: { kind: "DECIMAL" as const, value: isSummer ? "0.3779" : "1.6717", unit: "ratio" } };
  const money = (value: string) => ({ kind: "MONEY" as const, value, unit: "EUR" });
  const component = (suffix: string, primaryLabel: string, value: string, compositionGroup?: string): GlobalMomentComponentRow => ({ componentRef: `economic-component:${entityRef}:${suffix}`, primaryLabel, labelSource: "PRECISE_DESCRIPTION", amount: money(value), sourceKind: "Operation_parent", ...(compositionGroup === undefined ? {} : { compositionGroup }), evidenceRefs: [`evidence:life:${entityRef}:${suffix}`] });
  const summerComponents = Array.from({ length: 38 }, (_, index) => component(`minorque-${String(index + 1).padStart(2, "0")}`, `Dépense Minorque ${index + 1}`, index === 37 ? "143.9" : "30", index < 12 ? "TRANSPORT" : index < 24 ? "HEBERGEMENT" : "SUR_PLACE"));
  const homeComponents = [component("tv", "TV", "1180.56", "EQUIPEMENT"), component("sofa", "Canapé", "700", "MOBILIER"), component("storage", "Meuble TV + buffet", "265.97", "MOBILIER"), component("table", "Table basse", "119.99", "MOBILIER"), component("decor-1", "Décoration", "17.47", "DECORATION"), component("decor-2", "Décoration", "14.97", "DECORATION")];
  const concertComponents = [component("ticket", "Billet concert", "135"), component("caterer", "Traiteur", "17"), component("tacos", "Tacos", "7.4")];
  const momentComponentRows = isSummer ? summerComponents : isHome ? homeComponents : concertComponents;
  const componentGroups: readonly GlobalMomentComponentGroup[] = isSummer ? [
    { groupKey: "TRANSPORT", groupLabel: "Transport", amount: money("360"), componentRefs: summerComponents.slice(0, 12).map(({ componentRef }) => componentRef), count: 12 },
    { groupKey: "HEBERGEMENT", groupLabel: "Hébergement", amount: money("360"), componentRefs: summerComponents.slice(12, 24).map(({ componentRef }) => componentRef), count: 12 },
    { groupKey: "SUR_PLACE", groupLabel: "Sur place", amount: money("533.9"), componentRefs: summerComponents.slice(24).map(({ componentRef }) => componentRef), count: 14 },
  ] : isHome ? [
    { groupKey: "EQUIPEMENT", groupLabel: "Équipement", amount: money("1180.56"), componentRefs: [homeComponents[0]!.componentRef], count: 1 },
    { groupKey: "MOBILIER", groupLabel: "Mobilier", amount: money("1085.96"), componentRefs: homeComponents.slice(1, 4).map(({ componentRef }) => componentRef), count: 3 },
    { groupKey: "DECORATION", groupLabel: "Décoration", amount: money("32.44"), componentRefs: homeComponents.slice(4).map(({ componentRef }) => componentRef), count: 2 },
  ] : [];
  const peerObservations: readonly GlobalMomentPeerObservation[] = Array.from({ length: peerCount }, (_, index) => ({ peerRef: `moment:peer-${index + 1}`, canonicalName: `Moment comparable ${index + 1}`, startDate: `2025-${String(index + 1).padStart(2, "0")}-10`, endDate: `2025-${String(index + 1).padStart(2, "0")}-10`, typeKey: isSummer ? "voyage" : "projet-maison", typeLabel: isSummer ? "Voyage" : "Projet maison", familyKey: isSummer ? "travel" : "home", causalCost: { status: "KNOWN", value: money(String(700 + index * 110.25)) }, componentPreview: [], detailRef: `global-query:analysis_global_moment_experience_detail:fixture:peer-${index + 1}` }));
  const metrics = [
    lifeDetailMetric(`${entityRef}:causal-cost`, "Coût directement relié", "MONEY", causal, "EUR", `${causal} €`),
    lifeDetailMetric(`${entityRef}:spent-during`, "Dépenses pendant la période", "MONEY", spent, "EUR", `${spent} €`),
    ...(comparison === undefined ? [] : [lifeDetailMetric(`${entityRef}:subject-cost`, "Coût du Moment comparé", "MONEY", causal, "EUR", `${causal} €`), lifeDetailMetric(`${entityRef}:peer-median`, "Médiane des expériences comparables", "MONEY", comparison.peerMedian.value, "EUR", `${comparison.peerMedian.value} €`), lifeDetailMetric(`${entityRef}:q1`, "Premier quartile historique", "MONEY", comparison.q1.value, "EUR", `${comparison.q1.value} €`), lifeDetailMetric(`${entityRef}:q3`, "Troisième quartile historique", "MONEY", comparison.q3.value, "EUR", `${comparison.q3.value} €`), lifeDetailMetric(`${entityRef}:mad`, "Écart absolu médian historique", "MONEY", "130", "EUR", "130 €"), lifeDetailMetric(`${entityRef}:absolute-delta`, "Écart à la médiane", "MONEY", comparison.absoluteDelta.value, "EUR", `${comparison.absoluteDelta.value} €`), lifeDetailMetric(`${entityRef}:relative-delta`, "Écart relatif à la médiane", "DECIMAL", comparison.relativeDelta.value, "ratio", comparison.relativeDelta.value), lifeDetailMetric(`${entityRef}:peer-count`, "Expériences comparables", "COUNT", String(peerCount), "moment", String(peerCount))]),
  ];
  return {
    kind: "global_expanded", schemaVersion: "global-expanded@v1", resource: "analysis_global_moment_experience_detail", moduleKey: "MOMENTS", sectionKey: "OVERVIEW", visibility: "VISIBLE", secondaryInsights: [], metrics, series: [], rows: [
      { rowId: `000:moment-identity:${entityRef}`, labelKey: title, displayValue: typeAndDates, knowledgeState: "KNOWN", entityRef, ...(comparison === undefined ? {} : { momentComparison: comparison }), evidenceRefs: [`evidence:life:${entityRef}`] },
    ], destinations: [], peerObservations, momentComponentRows, componentGroups, spentDuringContext: { label: "Toutes nos dépenses enregistrées pendant cette période", cost: { status: "KNOWN", value: money(spent) }, relationToCausalCost: "INDEPENDENT_SCOPE" }, quality: peerCount === 4 ? qualityPartial : qualityKnown, capabilities: [{ capabilityId: "GLOBAL_MOMENT_DETAIL", state: "AVAILABLE", reasonCodes: [] }], publicationMeta, resourceMeta: resourceMeta(35),
  };
}

function detailModel(resource: GlobalV2ExpandedResourceName, entityRef: string, requestedModuleKey?: GlobalPrimaryModuleKey): GlobalExpandedReadModel {
  const moduleKey = requestedModuleKey ?? moduleFromResource(resource);
  const presentation = globalModulePresentation(moduleKey);
  if (resource === "analysis_global_category_need_detail") {
    const isNeed = entityRef.startsWith("need:");
    const category = m2Categories.find(({ id }) => entityRef === `category:${id}`) ?? m2Categories[2]!;
    const share = Number(category.share.replace(",", ".").replace(" %", "")) / 100;
    const detailMetrics = [
      m2Metric("detail:annual-amount", "Montant annuel", isNeed ? "5234" : category.amount, "MONEY", "EUR", isNeed ? "5 234 €" : `${new Intl.NumberFormat("fr-FR").format(Number(category.amount))} €`),
      m2Metric("detail:annual-share", "Part annuelle", isNeed ? "0.136" : String(share), "RATIO", "ratio", isNeed ? "13,6 %" : category.share),
      m2Metric("detail:active-months", "Mois actifs", "12", "COUNT", "month", "12 mois"),
      m2Metric("detail:current-amount", "Montant du mois cible", isNeed ? "439" : "1037", "MONEY", "EUR", isNeed ? "439 €" : "1 037 €"),
      m2Metric("detail:typical-amount", "Référence Typical", isNeed ? "400" : "149", "MONEY", "EUR/month", isNeed ? "400 €" : "149 €"),
      m2Metric("detail:delta-amount", "Écart à la référence", isNeed ? "39" : "888", "MONEY", "EUR", isNeed ? "+39 €" : "+888 €"),
      m2Metric("detail:delta-relative", "Écart relatif", isNeed ? "0.0975" : "5.9597", "DECIMAL", "ratio", isNeed ? "+9,8 %" : "+596 %"),
    ];
    const categoryRows: readonly GlobalDetailRow[] = [
      ["00000000-0000-4000-8000-000000000231", "Carburant", "1784", "46,7 %"],
      ["00000000-0000-4000-8000-000000000232", "Entretien automobile", "832", "21,8 %"],
      ["00000000-0000-4000-8000-000000000233", "Transports en commun", "614", "16,1 %"],
      ["00000000-0000-4000-8000-000000000234", "Péages", "368", "9,6 %"],
      ["00000000-0000-4000-8000-000000000235", "Stationnement", "224", "5,8 %"],
    ].map(([id, labelKey, value, ratio], index) => ({ rowId: `${String(index + 1).padStart(3, "0")}:subcategory:${id}`, labelKey, displayValue: `${new Intl.NumberFormat("fr-FR").format(Number(value))} € · ${ratio}`, typedMeasure: { kind: "MONEY", value, unit: "EUR" }, knowledgeState: "KNOWN", evidenceRefs: [`evidence:m2:subcategory:${id}`] }));
    const needRows: readonly GlobalDetailRow[] = [{ rowId: "001:category:food", labelKey: "Alimentation", displayValue: "5 234 €", typedMeasure: { kind: "MONEY", value: "5234", unit: "EUR" }, knowledgeState: "KNOWN", evidenceRefs: ["evidence:m2:need-food"] }];
    return {
      kind: "global_expanded", schemaVersion: "global-expanded@v1", resource, moduleKey: "CATEGORIES_NEEDS", sectionKey: "OVERVIEW", visibility: "VISIBLE", secondaryInsights: [], metrics: detailMetrics,
      series: [m2Series(category, 0)], rows: isNeed ? needRows : categoryRows,
      destinations: isNeed ? [] : [
        { targetId: `history:${entityRef}`, kind: "HISTORY", resource: "history_category_detail", entityRef, scopeHash: hash("f"), sourcePublicationId: publicationMeta.publicationId, sourceAnalyticsRevision: publicationMeta.revision },
        { targetId: `operations:${entityRef}`, kind: "OPERATIONS", resource: "operations_browse", entityRef, scopeHash: hash("f"), sourcePublicationId: publicationMeta.publicationId, sourceAnalyticsRevision: publicationMeta.revision },
      ], quality: isNeed ? m2NeedQuality : qualityKnown, capabilities: [{ capabilityId: "GLOBAL_CATEGORIES_NEEDS_DETAIL", state: "AVAILABLE", reasonCodes: [] }], publicationMeta, resourceMeta: resourceMeta(32),
    };
  }
  if (resource === "analysis_global_routine_detail" && (entityRef.startsWith("household-activity:") || entityRef.startsWith("person-activity:"))) return lifeRoutineDetailFixture(entityRef);
  if (resource === "analysis_global_moment_experience_detail" && entityRef.startsWith("moment:")) return lifeMomentDetailFixture(entityRef);
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

const backgroundFoodGoldens = Object.freeze([
  ["2025-08", "479.74", "38.80", "0.00", "518.54"],
  ["2025-09", "662.71", "242.13", "26.35", "931.19"],
  ["2025-10", "546.58", "77.05", "0.00", "623.63"],
  ["2025-11", "417.80", "184.10", "30.80", "632.70"],
  ["2025-12", "280.98", "113.90", "67.17", "462.05"],
  ["2026-01", "536.38", "56.85", "10.75", "603.98"],
  ["2026-02", "356.29", "59.85", "0.00", "416.14"],
  ["2026-03", "248.47", "68.15", "0.00", "316.62"],
  ["2026-04", "353.74", "77.65", "0.00", "431.39"],
  ["2026-05", "397.06", "127.30", "0.00", "524.36"],
  ["2026-06", "556.16", "163.55", "24.10", "743.81"],
  ["2026-07", "439.97", "94.20", "0.00", "534.17"],
] as const);

const backgroundCarGoldens = Object.freeze([
  ["2025-08", 40, "1011.664", "84.130875", "142.601833125", "130.46"],
  ["2025-09", 45, "686.272", "57.660979", "98.715596048", "180.07"],
  ["2025-10", 61, "562.793", "51.517590", "87.219279870", "43.46"],
  ["2025-11", 63, "301.743", "30.955127", "53.552369710", "66.30"],
  ["2025-12", 53, "410.753", "39.131861", "66.250240673", "84.09"],
  ["2026-01", 60, "261.481", "27.243484", "46.722575060", "85.59"],
  ["2026-02", 63, "772.738", "66.145484", "114.563978288", "50.43"],
  ["2026-03", 65, "1004.511", "82.188531", "158.048545113", "88.81"],
  ["2026-04", 72, "653.059", "56.739839", "115.465572365", "145.51"],
  ["2026-05", 55, "501.450", "44.439705", "92.345706990", "127.68"],
  ["2026-06", 47, "472.483", "42.600976", "84.222129552", "0"],
  ["2026-07", 60, "731.185", "64.515893", "128.773722428", "195.11"],
] as const);

function backgroundFoodHighlights(month: string) {
  if (month === "2025-12") return [
    [["operation:dec:courses", "63.40", "OPERATION", "2025-12-09", "Intermarché", "LARGE", 31, "occurrence:dec:courses", "activity:courses", "courses"]],
    [["operation:dec:restaurant", "8.90", "OPERATION", "2025-12-12", "Ange", null, null, "occurrence:dec:lunch", "activity:work-lunch", "repas du midi au travail"]],
    [["operation:dec:delivery", "21.90", "OPERATION", "2025-12-04", "Uber Eats", null, null, null, null, null]],
  ];
  return [
    [[`operation:${month}:courses`, "42.30", "OPERATION", `${month}-08`, "Courses du mois", null, null, null, null, null]],
    [[`operation:${month}:restaurant`, "18.40", "OPERATION", `${month}-14`, "Repas à l’extérieur", null, null, null, null, null]],
    [],
  ];
}

function backgroundRhythmsFixture(): GlobalBackgroundRhythmsReadModel {
  const groceryOccurrences = [8, 6, 6, 10, 9, 10, 10, 8, 12, 11, 11, 9];
  const groceryKnown = [8, 4, 6, 9, 7, 9, 8, 5, 9, 9, 8, 5];
  const restaurantPayments = [4, 12, 8, 10, 8, 6, 8, 9, 10, 8, 12, 5];
  const restaurantOccurrences = [7, 9, 11, 10, 16, 9, 16, 17, 18, 11, 14, 10];
  const restaurantKnown = [3, 0, 3, 4, 4, 1, 2, 2, 1, 2, 5, 1];
  const deliveryPayments = [0, 1, 0, 1, 4, 1, 0, 0, 0, 0, 1, 0];
  const foodMonths = backgroundFoodGoldens.map(([month, courses, restaurants, deliveries, total], index) => {
    const coverage = groceryKnown[index]! / groceryOccurrences[index]!;
    const nonGrocery = Number(restaurants) + Number(deliveries);
    const basket = coverage >= .7
      ? { status: "KNOWN", small: 2, intermediate: 3, large: Math.max(0, groceryKnown[index]! - 5) }
      : { status: "GATED", reasonCode: "COVERAGE_BELOW_70_PERCENT" };
    return [month, courses, restaurants, deliveries, total, nonGrocery.toFixed(2), (nonGrocery / Number(total)).toFixed(6), [groceryOccurrences[index], groceryKnown[index], coverage.toFixed(6), basket], [restaurantPayments[index], restaurantOccurrences[index], restaurantKnown[index], "0.75", "0.82", restaurantKnown[index]! > 0 ? { status: "KNOWN", value: "18.40" } : { status: "GATED", reasonCode: "FOOD_RESTAURANT_CROSS_COVERAGE_INSUFFICIENT" }], deliveryPayments[index], backgroundFoodHighlights(month), [basket.status, restaurantKnown[index]! > 0 ? "KNOWN" : "GATED", basket.status === "KNOWN" ? [] : ["BASKET_STRUCTURE_COVERAGE_BELOW_70_PERCENT"]]];
  });
  const carMonths = backgroundCarGoldens.map(([month, legCount, distanceKm, liters, cost, paid], index) => {
    const partial = [0, 6, 11].includes(index);
    const total = Number(cost);
    const unresolved = partial ? total * .1 : 0;
    const around = (total - unresolved) * .6;
    const outside = total - unresolved - around;
    return {
      month,
      modeledUsage: { estimatedFuelCost: cost, distanceKm, estimatedFuelLiters: liters, legCount, dataNature: "ESTIMATED", dateBasis: "MOBILITY_LEG_DATE" },
      observedFuelPaid: { amount: paid, operationCount: Number(paid) === 0 ? 0 : 1, financialComponentCount: Number(paid) === 0 ? 0 : 1, dataNature: "OBSERVED", dateBasis: "ECONOMIC_TIMING" },
      usageComposition: { aroundWorkEstimatedFuelCost: around.toFixed(6), outsideWorkEstimatedFuelCost: outside.toFixed(6), unresolvedEstimatedFuelCost: unresolved.toFixed(6), classificationCoverage: partial ? "0.9" : "1", classificationStatus: partial ? "PARTIAL" : "COMPLETE" },
      narrativeSummary: { routineGroupCount: 1, tripSummaryCount: 1, contextOnlyCount: 1, suppressedTripCount: index === 7 ? 2 : 0, visibleItemCount: 3 },
      detailAvailable: true,
      quality: { estimateCoverage: "1", resolvedEstimateCount: legCount, eligibleLegCount: legCount, estimateKnowledge: "KNOWN", measurementNature: "ESTIMATED", corpusCompleteness: "UNKNOWN", corpusCompletenessReason: "REAL_WORLD_MOBILITY_EXHAUSTIVENESS_NOT_PROVEN" },
    };
  });
  const annualAround = carMonths.reduce((total, month) => total + Number(month.usageComposition.aroundWorkEstimatedFuelCost), 0);
  const annualOutside = carMonths.reduce((total, month) => total + Number(month.usageComposition.outsideWorkEstimatedFuelCost), 0);
  const annualUnresolved = carMonths.reduce((total, month) => total + Number(month.usageComposition.unresolvedEstimatedFuelCost), 0);
  return parseGlobalBackgroundRhythmsReadModel({
    kind: "global_background_rhythms", schemaVersion: "global-background-rhythms@v1", resource: "analysis_global_background_rhythms", moduleKey: "RHYTHM",
    period: { startMonth: "2025-08", endMonth: "2026-07" },
    food: {
      annual: { courses: "5275.88", restaurants: "1303.53", deliveries: "159.17", total: "6738.58", nonGroceryAmount: "1462.70", nonGroceryShare: "0.217067", groceryBehavior: { knownCostOccurrenceCount: 87, eligibleMonthCount: 9, historicalComparisonGate: "AVAILABLE", thresholds: { p25: "18.29", p75: "51.99" } }, restaurantBehavior: { paymentCount: 100, semanticOccurrenceCount: 158, knownCostOccurrenceCount: 28, occurrenceCoverage: "0.75", linkedFinanceAmountCoverage: "0.82", medianCost: { status: "KNOWN", value: "18.40" } }, deliveryBehavior: { paymentCount: 8, countLabel: "paiements de livraison", occurrenceStatus: "UNKNOWN", reasonCode: "NO_DELIVERY_OCCURRENCE_AUTHORITY" } },
      months: foodMonths,
      constants: { financialAmountAvailable: true, deliveryCountLabel: "paiements de livraison", deliveryOccurrenceStatus: "UNKNOWN", deliveryReasonCode: "NO_DELIVERY_OCCURRENCE_AUTHORITY", monetaryAuthority: "FINANCE_CANONICAL", financialKnowledge: "KNOWN", deliveryOccurrenceKnowledge: "UNKNOWN" },
      annotations: [
        { annotationId: "food-annotation:september", kind: "MONTH_TO_MONTH_VARIATION", fromMonth: "2025-08", toMonth: "2025-09", text: "Septembre combine davantage de courses et de repas à l’extérieur.", coursesChange: "182.97", nonGroceryChange: "229.68" },
        { annotationId: "food-annotation:december", kind: "MONTH_TO_MONTH_VARIATION", fromMonth: "2025-11", toMonth: "2025-12", text: "Décembre est plus contenu, avec une part hors courses plus visible.", coursesChange: "-136.82", nonGroceryChange: "-33.83" },
        { annotationId: "food-annotation:june", kind: "MONTH_TO_MONTH_VARIATION", fromMonth: "2026-05", toMonth: "2026-06", text: "Juin rassemble davantage de courses et de restaurants.", coursesChange: "159.10", nonGroceryChange: "60.35" },
      ],
      methodVersion: "global_food_rhythm@v1", inputHash: hash("c"),
    },
    carMobility: {
      annual: { modeledUsage: { estimatedFuelCost: "1188.481549222", distanceKm: "7370.132", estimatedFuelLiters: "647.270344", legCount: 684, dataNature: "ESTIMATED", dateBasis: "MOBILITY_LEG_DATE" }, observedFuelPaid: { amount: "1197.51", operationCount: 19, financialComponentCount: 19, dataNature: "OBSERVED", dateBasis: "ECONOMIC_TIMING" }, quality: { estimateCoverage: "1", resolvedEstimateCount: 684, eligibleLegCount: 684, estimateKnowledge: "KNOWN", measurementNature: "ESTIMATED", corpusCompleteness: "UNKNOWN", corpusCompletenessReason: "REAL_WORLD_MOBILITY_EXHAUSTIVENESS_NOT_PROVEN" } },
      usageComposition: { aroundWorkEstimatedFuelCost: annualAround.toFixed(6), outsideWorkEstimatedFuelCost: annualOutside.toFixed(6), unresolvedEstimatedFuelCost: annualUnresolved.toFixed(6), classificationCoverage: "0.969", classificationStatus: "PARTIAL" },
      months: carMonths,
      annotations: [], metadata: [{ key: "comparisonStatus", value: "NOT_RECONCILABLE" }], methodVersion: "global_car_mobility_rhythm@v1", inputHash: hash("d"),
    },
    quality: { food: { completeMonthCount: 12, reconciliationStatus: "PASS" }, carMobility: { estimateCoverage: "1", resolvedEstimateCount: 684, eligibleLegCount: 684, estimateKnowledge: "KNOWN", measurementNature: "ESTIMATED", corpusCompleteness: "UNKNOWN", corpusCompletenessReason: "REAL_WORLD_MOBILITY_EXHAUSTIVENESS_NOT_PROVEN" } },
    destinations: backgroundCarGoldens.map(([month]) => ({ targetId: `background-rhythm:${month}`, kind: "GLOBAL_QUERY", resource: "analysis_global_background_rhythm_month_detail", instanceKey: `fixture:car:${month}`, entityRef: `car-mobility-month:${month}`, scopeHash: hash("e"), sourcePublicationId: publicationMeta.publicationId, sourceAnalyticsRevision: publicationMeta.revision })),
    publicationMeta, resourceMeta: resourceMeta(60),
  });
}

function backgroundMonthDetailFixture(month: string): GlobalBackgroundRhythmMonthDetailReadModel {
  const source = backgroundCarGoldens.find(([key]) => key === month) ?? backgroundCarGoldens[0];
  const [, , distanceKm, liters, cost] = source!;
  const march = month === "2026-03";
  const targetRef = march ? "life-event:ski" : `life-event:mobility-${month}`;
  return parseGlobalBackgroundRhythmMonthDetailReadModel({
    kind: "global_background_rhythm_month_detail", schemaVersion: "global-background-rhythm-month-detail@v1", resource: "analysis_global_background_rhythm_month_detail", moduleKey: "RHYTHM", domain: "CAR_MOBILITY", month,
    routineGroups: [
      { routineGroupId: `routine:${month}:work`, pattern: "WORK_ONLY", title: "Trajets maison ↔ travail", semanticFamily: "WORK", semanticTier: 1, usageBand: "AROUND_WORK", occurrenceCount: march ? 19 : 12, annualOccurrenceCount: 184, monthContribution: { distanceKm: (Number(distanceKm) * .45).toFixed(3), estimatedFuelLiters: (Number(liters) * .45).toFixed(3), estimatedFuelCost: (Number(cost) * .45).toFixed(2) }, fullTrips: { distanceKm: (Number(distanceKm) * .45).toFixed(3), estimatedFuelLiters: (Number(liters) * .45).toFixed(3), estimatedFuelCost: (Number(cost) * .45).toFixed(2) } },
      { routineGroupId: `routine:${month}:outings`, pattern: "WORKDAY_OUTING", title: "Déplacements pendant la journée de travail", semanticFamily: "WORK", semanticTier: 2, usageBand: "AROUND_WORK", occurrenceCount: march ? 5 : 3, annualOccurrenceCount: 42, monthContribution: { distanceKm: "42.4", estimatedFuelLiters: "3.8", estimatedFuelCost: "7.20" }, fullTrips: { distanceKm: "42.4", estimatedFuelLiters: "3.8", estimatedFuelCost: "7.20" } },
    ],
    tripSummaries: [{ tripSummaryId: `summary:${month}:event`, title: march ? "Séjour ski aux 7 Laux" : "Sortie du mois", semanticFamily: march ? "LEISURE" : "PERSONAL", semanticTier: 1, usageBand: "OUTSIDE_WORK", multiDay: march, crossMonth: march, startDate: march ? "2026-02-26" : `${month}-16`, endDate: march ? "2026-03-01" : `${month}-16`, targetKind: "LIFE_EVENT", targetRef, monthContribution: { distanceKm: march ? "289.70" : "64.2", estimatedFuelLiters: march ? "24.90" : "5.7", estimatedFuelCost: march ? "46.00" : "10.40" }, fullTrip: { distanceKm: march ? "648.00" : "64.2", estimatedFuelLiters: march ? "55.60" : "5.7", estimatedFuelCost: march ? "103.00" : "10.40" } }],
    contextOnly: [{ contextOnlyId: `context:${month}`, title: march ? "Sortie loisirs" : "Déplacement personnel", semanticFamily: march ? "LEISURE" : "PERSONAL", semanticTier: 2, usageBand: "OUTSIDE_WORK", relationType: "PRIMARY_CONTEXT", targetKind: "LIFE_EVENT", targetRef }],
    suppressedRemainder: { tripCount: march ? 2 : 0, displayText: march ? "+ 2 autres déplacements inclus dans le total mensuel" : "+ 0 autres déplacements inclus dans le total mensuel", internalReconciliation: { distanceKm: "0", estimatedFuelLiters: "0", estimatedFuelCost: "0" } },
    destinations: [{ targetId: `background-rhythm-context:${targetRef}`, kind: "ENTITY", resource: "global_life_event", entityRef: targetRef, scopeHash: hash("e"), sourcePublicationId: publicationMeta.publicationId, sourceAnalyticsRevision: publicationMeta.revision }],
    quality: { mobility: { estimateCoverage: "1", resolvedEstimateCount: 1, eligibleLegCount: 1, estimateKnowledge: "KNOWN", measurementNature: "ESTIMATED", corpusCompleteness: "UNKNOWN", corpusCompletenessReason: "REAL_WORLD_MOBILITY_EXHAUSTIVENESS_NOT_PROVEN" }, narrative: { routineGroupCount: 2, tripSummaryCount: 1, contextOnlyCount: 1, suppressedTripCount: march ? 2 : 0, visibleItemCount: 4, limitationCodes: [] } },
    publicationMeta, resourceMeta: resourceMeta(61),
  });
}

function lifeTimelineFixture(): GlobalLifeTimelineReadModel {
  const scopeHash = hash("f");
  const events = [
    { eventRef: "life-event:aveyron", sourceKind: "LIFE_EVENT", canonicalName: "Week-end Aveyron & Aubrac", startDate: "2025-08-08", endDate: "2025-08-10", typeKey: "voyage_sejour", typeLabel: "Voyage et séjour", familyKey: "travel", familySource: "LIFE_EVENT", participantRefs: ["person:a", "person:b"], places: [{ placeRef: "place:aveyron", label: "Aveyron" }], causalCost: { status: "UNKNOWN" }, detailAvailability: "INLINE_ONLY", quality: qualityPartial, sourceModule: "CANONICAL", sourceOwner: "CANONICAL" },
    { eventRef: "moment:photo", sourceKind: "MOMENT", canonicalName: "Séance photo cuir", startDate: "2025-08-13", endDate: "2025-08-13", typeKey: "projet-seance-photo", typeLabel: "Projet photo", familyKey: "project", familySource: "M6", participantRefs: ["person:a", "person:b"], places: [], causalCost: { status: "KNOWN", value: { kind: "MONEY", value: "46.98", unit: "EUR" } }, comparisonSummary: { status: "UNKNOWN", peerCount: 0, materiality: "UNKNOWN" }, detailAvailability: "MOMENT_DETAIL", quality: qualityKnown, sourceModule: "MOMENTS", sourceOwner: "M6" },
    { eventRef: "moment:summer", sourceKind: "MOMENT", canonicalName: "Voyage à Minorque 2025", startDate: "2025-09-08", endDate: "2025-09-15", typeKey: "voyage", typeLabel: "Voyage", familyKey: "travel", familySource: "M6", participantRefs: ["person:a", "person:b"], places: [{ placeRef: "place:minorca", label: "Minorque" }], causalCost: { status: "KNOWN", value: { kind: "MONEY", value: "1253.9", unit: "EUR" } }, comparisonSummary: { status: "PARTIAL", comparisonTier: "SAME_TYPE", peerCount: 4, materiality: "UNKNOWN" }, detailAvailability: "MOMENT_DETAIL", quality: qualityKnown, sourceModule: "MOMENTS", sourceOwner: "M6" },
    { eventRef: "moment:home", sourceKind: "MOMENT", canonicalName: "Aménagement du salon", startDate: "2025-10-03", endDate: "2025-10-03", typeKey: "projet-achat-maison", typeLabel: "Projet maison", familyKey: "home", familySource: "M6", participantRefs: ["person:a", "person:b"], places: [], causalCost: { status: "KNOWN", value: { kind: "MONEY", value: "2298.96", unit: "EUR" } }, comparisonSummary: { status: "KNOWN", comparisonTier: "SAME_FAMILY", peerCount: 6, materiality: "MATERIAL" }, detailAvailability: "MOMENT_DETAIL", quality: qualityKnown, sourceModule: "MOMENTS", sourceOwner: "M6" },
    { eventRef: "moment:free", sourceKind: "MOMENT", canonicalName: "Sortie sans dépense reliée", startDate: "2026-01-17", endDate: "2026-01-17", typeKey: "sortie-activite", typeLabel: "Sortie et activité", familyKey: "leisure", familySource: "M6", participantRefs: ["person:a"], places: [], causalCost: { status: "KNOWN", value: { kind: "MONEY", value: "0", unit: "EUR" } }, comparisonSummary: { status: "KNOWN", comparisonTier: "SAME_FAMILY", peerCount: 7, materiality: "NOT_MATERIAL" }, detailAvailability: "MOMENT_DETAIL", quality: qualityKnown, sourceModule: "MOMENTS", sourceOwner: "M6" },
    { eventRef: "life-event:ski", sourceKind: "LIFE_EVENT", canonicalName: "Séjour ski aux 7 Laux", startDate: "2026-02-26", endDate: "2026-03-01", typeKey: "voyage-sejour", typeLabel: "Séjour et loisirs", familyKey: "travel", familySource: "LIFE_EVENT", participantRefs: ["person:a", "person:b"], places: [{ placeRef: "place:sept-laux", label: "Les 7 Laux" }], causalCost: { status: "UNKNOWN" }, detailAvailability: "INLINE_ONLY", quality: qualityKnown, sourceModule: "CANONICAL", sourceOwner: "CANONICAL" },
  ];
  const destinations = events.filter(({ sourceKind }) => sourceKind === "MOMENT").map(({ eventRef }) => ({ targetId: `global-query:${eventRef}`, kind: "GLOBAL_QUERY", resource: "analysis_global_moment_experience_detail", instanceKey: `fixture:${eventRef}`, entityRef: eventRef, scopeHash, sourcePublicationId: publicationMeta.publicationId, sourceAnalyticsRevision: publicationMeta.revision }));
  return parseGlobalLifeTimelineReadModel({ kind: "global_life_timeline", schemaVersion: "global-life-timeline@v1", resource: "analysis_global_life_timeline", moduleKey: "RHYTHM", events, chapterOverlays: [], contextSignals: [], destinations, quality: qualityKnown, publicationMeta, resourceMeta: resourceMeta(36) });
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
    if (request.resource === "analysis_global_life_timeline") return { data: lifeTimelineFixture(), publicationMeta };
    if (request.resource === "analysis_global_background_rhythms") return { data: backgroundRhythmsFixture(), publicationMeta };
    if (request.resource === "analysis_global_background_rhythm_month_detail") return { data: backgroundMonthDetailFixture(request.params.month ?? "2025-08"), publicationMeta };
    const module = bundle.modules.find((entry) => entry.resource === request.resource);
    if (module !== undefined) return { data: module, publicationMeta };
    const expanded = globalModulePresentations.find((entry) => entry.expandedResource === request.resource);
    if (expanded !== undefined) return { data: expandedModel(expanded.expandedResource, (request.params.sectionKey ?? "OVERVIEW") as GlobalExpandedSectionKey, expanded.key, scenario), publicationMeta };
    if (request.resource === "analysis_global_methodology") return { data: detailModel(request.resource, request.params.methodRef ?? "method:global-v2", (request.params.moduleKey ?? "ECONOMIC") as GlobalPrimaryModuleKey), publicationMeta };
    const detail = globalModulePresentations.find((entry) => "detailResource" in entry && entry.detailResource === request.resource);
    if (detail !== undefined) return { data: detailModel(request.resource as GlobalV2ExpandedResourceName, request.params.entityRef ?? `entity:${detail.key.toLowerCase()}`), publicationMeta };
    throw new Error("SNAPSHOT_MISS");
  };
}
