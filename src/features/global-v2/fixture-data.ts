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

function expandedModel(resource: GlobalV2ExpandedResourceName, sectionKey: GlobalExpandedSectionKey, moduleKey = moduleFromResource(resource)): GlobalExpandedReadModel {
  if (resource === "analysis_global_economic_expanded") return economicFixtureModel(sectionKey);
  if (resource === "analysis_global_categories_needs_expanded") return m2ExpandedFixtureModel(sectionKey);
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
