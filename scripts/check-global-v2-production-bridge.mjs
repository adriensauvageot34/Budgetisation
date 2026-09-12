import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const root = process.cwd();
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (specifier === "next/headers") specifier = "next/headers.js";
  if (specifier.startsWith("@/")) specifier = pathToFileURL(path.join(root, "src", specifier.slice(2))).href;
  try { return next(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") && !specifier.startsWith("file:")) throw error;
    if (/\.[cm]?[jt]s$/u.test(specifier)) throw error;
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try { return next(candidate, context); } catch { /* next */ }
    }
    throw error;
  }
} });

const candidateApi = await import("../src/server/analytics/global-v2-candidate.ts");
const query = await import("../src/query-api/global-v2/index.ts");
const servicesApi = await import("../src/server/query/global-v2-production-services.ts");
const runtimeApi = await import("../src/server/query/global-v2-runtime.ts");

const months = Array.from({ length: 12 }, (_, index) => `${index < 5 ? "2025" : "2026"}-${String((index + 7) % 12 + 1).padStart(2, "0")}`);
const personA = "00000000-0000-4000-8000-000000000002";
const personB = "00000000-0000-4000-8000-000000000003";
const strongSupport = { naturalGrain: "MONTH", eligibleUnits: 12, observedUnits: 12, includedUnits: 12, excludedObservedUnits: 0, minimumRequired: 6, supportStatus: "STRONG", policyRef: "global-m2-category-reference-support@v1" };
const axisCoverage = (dimension, status, effective) => ({ dimensions: [{ dimension, status, numerator: effective * 100, denominator: 100, ratio: effective, unit: "canonical_economic_component", basis: "authoritative-dimension-resolution", evidenceRefs: [`coverage:${dimension.toLowerCase()}`], policyRef: "global-category-need-coverage@v1" }], requiredDimensions: [dimension], effective, aggregation: "MIN_REQUIRED_DIMENSIONS" });
const annualSeries = (amount) => months.map((month, index) => ({ month, amount: index === months.length - 1 ? amount : "0" }));
const categoryGroup = ({ key, monthlyAmount, typicalAmount, annualAmount, annualShare, subcategories, shareDeltaPoints }) => ({
  key,
  dimension: { status: "KNOWN", id: `cat-${key}`, evidenceRefs: [`category:cat-${key}`] },
  monthlyAmount,
  typicalAmount,
  shareOfTypical: typicalAmount === "0" ? "0" : "0.1",
  annualAmount,
  annualShare,
  activeMonths: 1,
  currentShare: "0.1",
  referenceShare: typicalAmount === "0" ? "0" : "0.1",
  shareDeltaPoints,
  deltaAmount: String(Number(monthlyAmount) - Number(typicalAmount)),
  deltaRelative: typicalAmount === "0" ? null : String((Number(monthlyAmount) - Number(typicalAmount)) / Number(typicalAmount)),
  historicalSeries: annualSeries(annualAmount),
  annualSubcategoryBreakdown: subcategories,
  contributors: [],
  classificationBreakdown: { necessity: [], behavior: [], lifeScope: [] },
  drillDownRef: { kind: "CATEGORY", id: `cat-${key}` },
  evidenceRefs: [`category:cat-${key}`],
});
const materialityCandidate = ({ key, absolute, relative }) => ({
  candidateId: `global-m2:category:${key}`, phenomenonId: `category:${key}`, metricRef: "global-m2:category:monthly-amount",
  effect: { absolute, ...(relative === undefined ? {} : { relative }) }, knowledgeState: "KNOWN", support: strongSupport,
  coverage: axisCoverage("CLASSIFICATION", "KNOWN", 1), evidenceRefs: [`category:cat-${key}`], entityRefs: [`category:cat-${key}`],
  methodVersion: "global_category_need@v2", materialityPolicy: { id: "global-materiality-category-need", version: "v1" },
});
const outputByModule = {
  ECONOMIC: {
    targetMonth: "2026-07",
    actual: { value: { status: "KNOWN", value: "3773.14" } },
    typical: { reference: { status: "KNOWN", value: "2977.82" } },
    minimal: { metric: { status: "KNOWN", value: "1636.766" } },
    structure: { behavior: { amounts: { Fixe: "1590.49", Variable: "2182.65" } }, lifeScope: { amounts: { CURRENT: "2343.18", NON_CURRENT: "1429.96" } }, necessity: { amounts: { Contrainte: "1730.27", Indispensable: "1572.28" } } },
    temporal: { trend: { startLevel: "3427.21", endLevel: "2845.67", slopePerMonth: "-52.86" }, recentChange: { previousLevel: "2529.75", recentLevel: "3289.43", delta: "759.68" } },
  },
  CATEGORIES_NEEDS: { result: {
    inputHash: "a".repeat(64),
    categories: { currentTotal: "3773.14", annualTotal: "22000", coverage: axisCoverage("CLASSIFICATION", "KNOWN", 1), support: strongSupport, monetaryCoverage: { status: "KNOWN", knownAmount: "22000", unresolvedAmount: "0", totalAmount: "22000", knownShare: "1" }, groups: [
      categoryGroup({ key: "food", monthlyAmount: "1036.96", typicalAmount: "0", annualAmount: "5000", annualShare: String(5 / 22), shareDeltaPoints: "27.48", subcategories: [{ key: "sub-food-core", annualAmount: "3000", annualShare: "0.6" }, { key: "sub-food-extra", annualAmount: "2000", annualShare: "0.4" }] }),
      categoryGroup({ key: "home", monthlyAmount: "900", typicalAmount: "800", annualAmount: "7000", annualShare: String(7 / 22), shareDeltaPoints: "-8", subcategories: [{ key: "sub-home", annualAmount: "7000", annualShare: "1" }] }),
      categoryGroup({ key: "travel", monthlyAmount: "400", typicalAmount: "600", annualAmount: "4000", annualShare: String(4 / 22), shareDeltaPoints: "-9", subcategories: [{ key: "sub-travel", annualAmount: "4000", annualShare: "1" }] }),
      categoryGroup({ key: "gifts", monthlyAmount: "200", typicalAmount: "180", annualAmount: "3000", annualShare: String(3 / 22), shareDeltaPoints: "1", subcategories: [{ key: "sub-gifts", annualAmount: "3000", annualShare: "1" }] }),
      categoryGroup({ key: "health", monthlyAmount: "100", typicalAmount: "90", annualAmount: "2000", annualShare: String(2 / 22), shareDeltaPoints: "1", subcategories: [{ key: "sub-health", annualAmount: "2000", annualShare: "1" }] }),
      categoryGroup({ key: "misc", monthlyAmount: "1136.18", typicalAmount: "1100", annualAmount: "1000", annualShare: String(1 / 22), shareDeltaPoints: "1", subcategories: [{ key: "sub-misc", annualAmount: "1000", annualShare: "1" }] }),
    ] },
    needs: { currentTotal: "3773.14", annualTotal: "10000", coverage: axisCoverage("NEED", "PARTIAL", 0.65), support: strongSupport, monetaryCoverage: { status: "PARTIAL", knownAmount: "6000", unresolvedAmount: "4000", totalAmount: "10000", knownShare: "0.6" }, groups: [
      { key: "need-food", dimension: { status: "KNOWN", id: "need-food", evidenceRefs: ["need:need-food"] }, monthlyAmount: "439.97", typicalAmount: "400", annualAmount: "4000", annualShare: "0.4", activeMonths: 12, deltaAmount: "39.97", deltaRelative: "0.099925", historicalSeries: annualSeries("4000"), contributors: [{ key: "cat-food", amount: "439.97" }], drillDownRef: { kind: "NEED", id: "need-food" }, evidenceRefs: ["need:need-food"] },
      { key: "need-home", dimension: { status: "KNOWN", id: "need-home", evidenceRefs: ["need:need-home"] }, monthlyAmount: "662.67", typicalAmount: "600", annualAmount: "2000", annualShare: "0.2", activeMonths: 12, deltaAmount: "62.67", deltaRelative: "0.10445", historicalSeries: annualSeries("2000"), contributors: [{ key: "cat-home", amount: "662.67" }], drillDownRef: { kind: "NEED", id: "need-home" }, evidenceRefs: ["need:need-home"] },
      { key: "__UNKNOWN__", dimension: { status: "UNKNOWN", evidenceRefs: ["need:unknown"] }, monthlyAmount: "2670.50", typicalAmount: "2000", annualAmount: "4000", annualShare: "0.4", activeMonths: 12, deltaAmount: "670.5", deltaRelative: "0.33525", historicalSeries: annualSeries("4000"), contributors: [], drillDownRef: { kind: "NEED", id: "__UNKNOWN__" }, evidenceRefs: ["need:unknown"] },
    ] },
    materialityCandidates: [
      materialityCandidate({ key: "food", absolute: "15" }),
      materialityCandidate({ key: "home", absolute: "100", relative: "0.125" }),
      materialityCandidate({ key: "travel", absolute: "-200", relative: "-0.333333" }),
    ],
  } },
  TRANSFORMATIONS: { transformations: [], relationshipChanges: [] },
  RHYTHM: { rhythms: [
    { activityId: "travail_site", personId: personA, support: { occurrenceCount: 181 }, rate: { value: "0.49" }, cadence: { medianIntervalDays: "1" }, monthlyRates: months.map((month) => ({ month, value: "0.49" })) },
    { activityId: "teletravail", personId: personB, support: { occurrenceCount: 90 }, rate: { value: "0.25" }, cadence: { medianIntervalDays: "3" }, monthlyRates: months.map((month) => ({ month, value: "0.25" })) },
    { activityId: "activite_loisir", personId: personA, support: { occurrenceCount: 52 }, rate: { value: "0.14" }, cadence: { medianIntervalDays: "7" }, monthlyRates: months.map((month) => ({ month, value: "0.14" })) },
  ] },
  RELATIONSHIPS: [{ relationships: [{ relationshipId: "relationship:technical-only" }], insights: [] }],
  MOMENTS: { summaries: [{ moment: { momentId: "one", type: { value: "Voyage" }, startDate: "2026-07-01", endDate: "2026-07-07" }, causalCost: { status: "KNOWN", value: "1253.90" }, paymentTimeline: [{ paymentPhase: "PAID_BEFORE", amount: "500" }, { paymentPhase: "PAID_DURING", amount: "753.90" }] }], comparisons: [], series: [], narrative: [] },
  GEO_MOBILITY: { places: [{ placeId: "place-one", visitCount: 408, visitDays: 120, medianDuration: 892, lifecycle: { status: "REGULAR_STABLE" } }], finance: { rollups: [{ placeId: "place-one", amount: "300" }] } },
  CONSUMPTION: { events: [], merchants: [], checkoutPurchaseCount: 0, retainedPurchaseCount: 0 },
  PERSONAS: { metrics: [{ personId: personA, metricId: "activity-rate:travail_site", rawValue: "0.49" }, { personId: personB, metricId: "activity-rate:teletravail", rawValue: "0.25" }], differences: [] },
  TOGETHER: { universes: [{ universeId: "activity:journee_maison", support: { sharedUnits: 35, resolvedUnits: 35, eligibleUnits: 73, sharedObservableCoverage: 0.48, knowledgeState: "PARTIAL" } }] },
};
const moduleState = {
  RELATIONSHIPS: { knowledge: "UNKNOWN", capabilityState: "PARTIAL", reasonCodes: ["AUTHORITY_GATED_RELATIONSHIP_PROVIDERS"] },
  MOMENTS: { knowledge: "PARTIAL", capabilityState: "PARTIAL", reasonCodes: ["MOMENT_PLACE_FACETS_PARTIAL"] },
  CONSUMPTION: { knowledge: "UNKNOWN", capabilityState: "PARTIAL", reasonCodes: ["PURCHASE_EVENT_COVERAGE_PARTIAL"] },
  PERSONAS: { knowledge: "PARTIAL", capabilityState: "PARTIAL", reasonCodes: ["COMPARABLE_INTERSECTION_REQUIRED"] },
  TOGETHER: { knowledge: "PARTIAL", capabilityState: "PARTIAL", reasonCodes: ["PARTICIPATION_COVERAGE_VISIBLE"] },
};
const modules = query.globalPrimaryModuleCatalog.map(({ moduleKey }, index) => ({
  moduleKey,
  owner: `CertifiedOwnerM${index + 1}`,
  output: outputByModule[moduleKey],
  knowledge: moduleState[moduleKey]?.knowledge ?? "KNOWN",
  capabilityState: moduleState[moduleKey]?.capabilityState ?? "AVAILABLE",
  reasonCodes: moduleState[moduleKey]?.reasonCodes ?? [],
  evidenceRefs: [`owner-output:m${index + 1}`, `owner:m${index + 1}`].sort(),
}));
const base = {
  project: "ipuuhxrblxormwgoaqnz",
  householdId: "00000000-0000-4000-8000-000000000001",
  householdTimeZone: "Europe/Paris",
  personIds: [personA, personB],
  asOf: "2026-09-07T12:00:00Z",
  certifiedThrough: "2026-07-31",
  dataRevision: "1",
  analyticsRevision: "79",
  implementationIdentity: "2ed2cc0dadaef64a6e788cf881b6b40311a9cc2b",
  ownerOutputs: modules,
  presentationLabels: {
    persons: { [personA]: "Camille", [personB]: "Alex" },
    categories: { "cat-food": "Alimentation", "cat-home": "Logement", "cat-travel": "Transport", "cat-gifts": "Cadeaux", "cat-health": "Santé", "cat-misc": "Divers" },
    subcategories: { "sub-food-core": "Courses", "sub-food-extra": "Restaurants", "sub-home": "Loyer", "sub-travel": "Train", "sub-gifts": "Cadeaux", "sub-health": "Santé", "sub-misc": "Divers" },
    needs: { "need-food": "Se nourrir", "need-home": "Se loger" },
    places: { "place-one": "Maison" },
  },
};

let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const first = candidateApi.buildGlobalV2CandidateFromOwnerOutputs(base);
const second = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({ ...base, ownerOutputs: [...modules].reverse() });
const snapshot = (resource, sectionKey) => first.snapshots.find((entry) => entry.resource === resource && (sectionKey === undefined || entry.params.sectionKey === sectionKey));
const compact = (resource) => snapshot(resource).payload;
const detail = (entityRef) => first.snapshots.find((entry) => entry.resource === "analysis_global_category_need_detail" && entry.params.entityRef === entityRef)?.payload;
check(() => assert.equal(first.candidateId, second.candidateId));
check(() => assert.equal(first.factsHash, second.factsHash));
check(() => assert.equal(first.manifestHash, second.manifestHash));
check(() => assert.deepEqual(first.requiredKeys, second.requiredKeys));
check(() => assert.deepEqual(first.snapshots.map(({ payloadHash }) => payloadHash), second.snapshots.map(({ payloadHash }) => payloadHash)));
check(() => assert.equal(first.requiredSnapshotCount, first.queryInstanceCount));
check(() => assert.equal(first.requiredSnapshotCount, first.requiredKeys.queries.length));
check(() => assert.equal(first.requiredArtifactCount, first.requiredKeys.artifacts.length));
check(() => assert.equal(new Set(first.requiredKeys.queries).size, first.requiredKeys.queries.length));
check(() => assert.equal(new Set(first.availableCapabilities).size, first.availableCapabilities.length));
check(() => assert.equal(new Set(first.gatedCapabilities).size, first.gatedCapabilities.length));
check(() => assert.deepEqual(first.gatedCapabilities, ["GLOBAL_PRODUCT_DETAIL", "GLOBAL_ROUTE_DETAIL"]));
check(() => assert.deepEqual(compact("analysis_global_economic").kpis.map(({ labelKey }) => labelKey), ["Dépenses en 2026-07", "Nos dépenses minimum", "Niveau habituel"]));
check(() => assert.equal(compact("analysis_global_economic").kpis.some(({ displayValue }) => displayValue === "9"), false));
check(() => assert.match(compact("analysis_global_economic").primaryInsight.statementKey, /au-dessus de votre niveau habituel/));
const m2Breakdown = snapshot("analysis_global_categories_needs_expanded", "BREAKDOWN").payload;
const m2Patterns = snapshot("analysis_global_categories_needs_expanded", "PATTERNS").payload;
const m2Comparisons = snapshot("analysis_global_categories_needs_expanded", "COMPARISONS").payload;
check(() => assert.deepEqual(m2Breakdown.rows.map(({ labelKey }) => labelKey), ["Logement", "Alimentation", "Transport", "Cadeaux", "Santé", "Divers"]));
check(() => assert.deepEqual(m2Breakdown.rows.map(({ typedMeasure }) => typedMeasure?.value), ["7000", "5000", "4000", "3000", "2000", "1000"]));
check(() => assert.equal(m2Breakdown.rows.every(({ typedMeasure }) => typedMeasure?.kind === "MONEY" && typedMeasure.unit === "EUR"), true));
check(() => assert.equal(m2Breakdown.rows.length > 5, true));
check(() => assert.equal(compact("analysis_global_categories_needs").primaryInsight.titleKey, "Alimentation"));
check(() => assert.match(compact("analysis_global_categories_needs").primaryInsight.statementKey, /référence/u));
check(() => assert.equal(compact("analysis_global_categories_needs").kpis.find(({ kpiId }) => kpiId.includes("top-five-concentration")).typedMeasure.value, String(21 / 22)));
check(() => assert.equal(m2Comparisons.rows.length, 3));
check(() => assert.deepEqual(m2Comparisons.rows.map(({ labelKey }) => labelKey), ["Hausse · Alimentation", "Baisse · Transport", "Hausse · Logement"]));
check(() => assert.equal(m2Comparisons.secondaryInsights.length, 2));
check(() => assert.equal(snapshot("analysis_global_categories_needs_expanded", "EVOLUTION").payload.series.length, 3));
check(() => assert.deepEqual(snapshot("analysis_global_categories_needs_expanded", "EVOLUTION").payload.series.map(({ labelKey }) => labelKey).sort(), ["Alimentation", "Logement", "Transport"]));
check(() => assert.equal(snapshot("analysis_global_categories_needs_expanded", "EVOLUTION").payload.series.every(({ points }) => points.length === 12), true));
check(() => assert.equal(snapshot("analysis_global_categories_needs_expanded", "EVOLUTION").payload.series.every(({ points }) => points.every(({ typedMeasure }) => typedMeasure?.kind === "MONEY")), true));
check(() => assert.equal(m2Patterns.quality.knowledgeState, "PARTIAL"));
check(() => assert.equal(m2Patterns.quality.effectiveCoverage, 0.65));
check(() => assert.deepEqual(m2Patterns.rows.map(({ labelKey }) => labelKey), ["Se nourrir", "Se loger"]));
check(() => assert.equal(m2Patterns.rows.some(({ entityRef }) => entityRef === "need:__UNKNOWN__"), false));
check(() => assert.equal(m2Patterns.metrics.find(({ metricId }) => metricId === "needs-component-coverage").typedMeasure.value, "0.65"));
check(() => assert.equal(m2Patterns.metrics.find(({ metricId }) => metricId === "needs-monetary-coverage").typedMeasure.value, "0.6"));
check(() => assert.equal(m2Patterns.metrics.find(({ metricId }) => metricId === "needs-unclassified-annual-amount").typedMeasure.value, "4000"));
const categoryDetails = first.snapshots.filter(({ resource, params }) => resource === "analysis_global_category_need_detail" && params.entityRef.startsWith("category:"));
const needDetails = first.snapshots.filter(({ resource, params }) => resource === "analysis_global_category_need_detail" && params.entityRef.startsWith("need:"));
const foodDetail = detail("category:cat-food");
check(() => assert.equal(categoryDetails.length, 6));
check(() => assert.equal(needDetails.length, 2));
check(() => assert.equal(detail("need:__UNKNOWN__"), undefined));
check(() => assert.equal(m2Breakdown.rows.every(({ entityRef }) => detail(entityRef) !== undefined), true));
check(() => assert.deepEqual(foodDetail.metrics.map(({ metricId }) => metricId), ["detail:active-months", "detail:annual-amount", "detail:annual-share", "detail:current-amount", "detail:delta-amount", "detail:typical-amount"]));
check(() => assert.equal(foodDetail.metrics.every(({ typedMeasure }) => typedMeasure !== undefined), true));
check(() => assert.equal(foodDetail.series.length, 1));
check(() => assert.equal(foodDetail.series[0].points.length, 12));
check(() => assert.equal(foodDetail.series[0].points.every(({ typedMeasure }) => typedMeasure?.kind === "MONEY"), true));
check(() => assert.deepEqual(foodDetail.rows.map(({ labelKey }) => labelKey), ["Courses", "Restaurants"]));
check(() => assert.equal(foodDetail.rows.reduce((sum, { typedMeasure }) => sum + Number(typedMeasure.value), 0), 5000));
check(() => assert.deepEqual(foodDetail.destinations.map(({ kind }) => kind), ["HISTORY", "OPERATIONS"]));
check(() => assert.equal(foodDetail.destinations.every(({ entityRef }) => entityRef === "category:cat-food"), true));
check(() => assert.deepEqual(foodDetail.publicationMeta, m2Breakdown.publicationMeta));
check(() => assert.equal(detail("need:need-food").quality.knowledgeState, "PARTIAL"));
check(() => assert.deepEqual(detail("need:need-food").rows.map(({ labelKey }) => labelKey), ["Alimentation"]));
check(() => assert.equal(compact("analysis_global_categories_needs").kpis.find(({ kpiId }) => kpiId.includes("needs:monetary-coverage")).phenomenonQuality.knowledgeState, "PARTIAL"));
const legacyM2Snapshot = { ...m2Breakdown, rows: [{ rowId: "001:category:legacy", labelKey: "Ancienne catégorie", displayValue: "900 €", knowledgeState: "KNOWN", entityRef: "category:legacy", evidenceRefs: ["legacy:v1"] }] };
check(() => assert.equal(query.globalExpandedReadModelSchema.safeParse(legacyM2Snapshot).success, true));
check(() => assert.equal(snapshot("analysis_global_rhythm_expanded", "OVERVIEW").payload.rows.some(({ labelKey }) => labelKey === "Travail sur site · Camille"), true));
check(() => assert.equal(snapshot("analysis_global_rhythm_expanded", "EVOLUTION").payload.series.length, 3));
check(() => assert.equal(snapshot("analysis_global_rhythm_expanded", "EVOLUTION").payload.series.every(({ points }) => points.length === 12), true));
check(() => assert.match(compact("analysis_global_rhythm").primaryInsight.statementKey, /181 occurrences pour Camille/));
check(() => assert.equal(compact("analysis_global_transformations").primaryInsight.titleKey, "Aucun changement durable clairement identifié"));
check(() => assert.equal(JSON.stringify(first.snapshots.filter(({ resource }) => resource.includes("relationships"))).includes("relationship:technical-only"), false));
check(() => assert.equal(compact("analysis_global_relationships").placeholder.messageKey, "Pas encore assez d’éléments pour établir une relation fiable"));
check(() => assert.equal(compact("analysis_global_moments").visibility, "VISIBLE"));
check(() => assert.equal(compact("analysis_global_moments").qualification, "PARTIAL_COVERAGE"));
check(() => assert.match(compact("analysis_global_moments").primaryInsight.statementKey, /1 moments en contexte · Analyse partielle/));
check(() => assert.equal(snapshot("analysis_global_moments_expanded", "OVERVIEW").payload.rows[0].labelKey, "Voyage"));
check(() => assert.equal(snapshot("analysis_global_moments_expanded", "PATTERNS").payload.rows.length, 2));
check(() => assert.equal(compact("analysis_global_consumption").visibility, "PLACEHOLDER"));
check(() => assert.equal(compact("analysis_global_consumption").placeholder.messageKey, "Analyse pas encore disponible"));
check(() => assert.deepEqual(compact("analysis_global_consumption").kpis, []));
check(() => assert.equal(compact("analysis_global_personas").visibility, "VISIBLE"));
check(() => assert.equal(compact("analysis_global_personas").primaryInsight.titleKey, "Aucune différence nette à mettre en avant entre vos profils"));
check(() => assert.ok(snapshot("analysis_global_personas_expanded", "OVERVIEW").payload.rows.length > 0));
check(() => assert.equal(compact("analysis_global_together").visibility, "VISIBLE"));
check(() => assert.match(compact("analysis_global_together").primaryInsight.statementKey, /35 occurrences explicitement partagées/));
check(() => assert.equal(snapshot("analysis_global_together_expanded", "OVERVIEW").payload.rows[0].labelKey, "Journée à la maison"));
check(() => assert.equal(candidateApi.globalV2M6HasPresentationContent(outputByModule.MOMENTS), true));
check(() => assert.equal(candidateApi.globalV2M6HasPresentationContent({ moments: [{ id: "legacy-wrong-shape" }] }), false));
check(() => assert.equal(first.snapshots.filter(({ resource }) => resource === "analysis_global_economic_expanded").length, 3));
check(() => assert.equal(new Set(first.snapshots.filter(({ resource }) => resource === "analysis_global_economic_expanded").map(({ payload }) => JSON.stringify({ metrics: payload.metrics, series: payload.series, rows: payload.rows }))).size, 3));
const presentationStrings = first.snapshots.flatMap(({ payload }) => [
  ...(payload.primaryInsight === undefined ? [] : [payload.primaryInsight.titleKey, payload.primaryInsight.statementKey]),
  ...(payload.placeholder === undefined ? [] : [payload.placeholder.messageKey]),
  ...(payload.kpis ?? []).flatMap(({ labelKey, displayValue }) => [labelKey, displayValue]),
  ...(payload.metrics ?? []).flatMap(({ labelKey, displayValue }) => [labelKey, displayValue]),
  ...(payload.series ?? []).flatMap(({ labelKey, points }) => [labelKey, ...points.flatMap(({ displayValue }) => displayValue === undefined ? [] : [displayValue])]),
  ...(payload.rows ?? []).flatMap(({ labelKey, displayValue }) => [labelKey, ...(displayValue === undefined ? [] : [displayValue])]),
]);
check(() => assert.equal(presentationStrings.some((value) => /(?:activity|place|relationship):/u.test(value)), false));

const mutate = (moduleKey, change) => modules.map((entry) => entry.moduleKey === moduleKey ? { ...entry, ...change(entry) } : entry);
const factChange = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({ ...base, ownerOutputs: mutate("ECONOMIC", (entry) => ({ output: { ...entry.output, current: "changed" } })) });
check(() => assert.notEqual(factChange.candidateId, first.candidateId));
check(() => assert.notEqual(factChange.factsHash, first.factsHash));
check(() => assert.notEqual(factChange.manifestHash, first.manifestHash));
const capabilityChange = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({ ...base, ownerOutputs: mutate("MOMENTS", () => ({ capabilityState: "UNAVAILABLE", knowledge: "UNKNOWN", reasonCodes: ["AUTHORITY_GATED"] })) });
check(() => assert.notEqual(capabilityChange.requiredSnapshotCount, first.requiredSnapshotCount));
check(() => assert.notEqual(capabilityChange.manifestHash, first.manifestHash));
const instanceChange = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({ ...base, ownerOutputs: mutate("MOMENTS", (entry) => ({ output: { ...entry.output, summaries: [...entry.output.summaries, { moment: { momentId: "two", type: { value: "Anniversaire" }, startDate: "2026-07-15", endDate: "2026-07-15" }, causalCost: { status: "KNOWN", value: "100" } }] } })) });
check(() => assert.ok(instanceChange.requiredSnapshotCount > first.requiredSnapshotCount));
check(() => assert.notEqual(instanceChange.manifestHash, first.manifestHash));
const boundedMoments = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({
  ...base,
  ownerOutputs: mutate("MOMENTS", () => ({ output: { summaries: Array.from({ length: 60 }, (_, index) => ({ moment: { momentId: `moment-${String(index).padStart(2, "0")}`, type: { value: "Voyage" }, startDate: "2026-07-01", endDate: "2026-07-01" }, causalCost: { status: "KNOWN", value: String(100 - index) } })), comparisons: [], series: [], narrative: [] } })),
});
const momentDetails = boundedMoments.snapshots.filter(({ resource }) => resource === "analysis_global_moment_experience_detail");
const momentOverview = boundedMoments.snapshots.find(({ resource, params }) => resource === "analysis_global_moments_expanded" && params.sectionKey === "OVERVIEW");
check(() => assert.equal(momentDetails.length, 5));
check(() => assert.equal(momentOverview.payload.rows.length, 5));
check(() => assert.deepEqual(
  momentOverview.payload.rows.map(({ entityRef }) => entityRef).sort(),
  momentDetails.map(({ params }) => params.entityRef).sort(),
));
const versionChange = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({ ...base, implementationIdentity: "3ed2cc0dadaef64a6e788cf881b6b40311a9cc2b" });
check(() => assert.notEqual(versionChange.candidateId, first.candidateId));
check(() => assert.notEqual(versionChange.manifestHash, first.manifestHash));
const documentaryOnly = { reportText: "changed outside producer input" };
void documentaryOnly;
const afterDocumentation = candidateApi.buildGlobalV2CandidateFromOwnerOutputs(base);
check(() => assert.equal(afterDocumentation.manifestHash, first.manifestHash));

const sourcePaths = [
  "src/server/analytics/global-v2-candidate.ts",
  "src/server/analytics/global-v2-production-orchestrator.ts",
  "src/server/query/global-v2-production-loader.ts",
  "src/app/analyse-globale/page.tsx",
];
const productionSources = sourcePaths.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
check(() => assert.equal(productionSources.includes("global-v2-integrated-candidate"), false));
check(() => assert.equal(productionSources.includes('"1".repeat(40)'), false));
const routeSource = fs.readFileSync(path.join(root, "src/app/analyse-globale/page.tsx"), "utf8");
check(() => assert.match(routeSource, /GLOBAL_V2_ROUTE_ACTIVE\s*!==\s*"true"/u));
check(() => assert.match(routeSource, /catch\s*\{\s*return <GlobalV2Unavailable \/>/u));

const initialSnapshot = first.snapshots.find(({ resource }) => resource === "analysis_global_manifest");
assert.ok(initialSnapshot);
let producerReads = 0;
let snapshotReads = 0;
const client = { from(table) {
  assert.equal(table, "analytics_query_snapshots");
  const filters = {};
  const chain = {
    select() { return chain; },
    eq(key, value) { filters[key] = value; return chain; },
    async maybeSingle() {
      snapshotReads += 1;
      const snapshot = first.snapshots.find(({ key }) => key === filters.query_key);
      return snapshot === undefined ? { data: null, error: null } : { data: {
        query_key: snapshot.key,
        resource: snapshot.resource,
        contract_version: query.globalV2QueryRegistry[snapshot.resource].contractVersion,
        method_signature: snapshot.methodSignature,
        payload: snapshot.payload,
        publication_id: first.candidateId,
        is_active: true,
        invalidated_at: null,
      }, error: null };
    },
  };
  return chain;
} };
const context = { householdId: base.householdId, personIds: base.personIds, timezone: base.householdTimeZone, dataRevision: "1", analyticsRevision: "80" };
const generation = { publicationId: first.candidateId, analyticsRevision: 80, scope: first.scope, publicationMeta: initialSnapshot.payload.publicationMeta, requiredQueryKeys: first.requiredKeys.queries };
const services = servicesApi.createGlobalV2ProductionQueryServices({ client, context, generation });
const pin = new (await import("../src/server/query/global-generation.ts")).GlobalGenerationPin();
const result = await runtimeApi.executeGlobalV2SnapshotQuery({ resource: "analysis_global_manifest", scope: generation.scope, params: {}, expectedGeneration: { publicationId: generation.publicationId, analyticsRevision: generation.analyticsRevision } }, services, pin);
check(() => assert.equal(result.data.kind, "global_initial"));
check(() => assert.equal(snapshotReads, 1));
check(() => assert.equal(producerReads, 0));
check(() => assert.equal(result.publicationId, first.candidateId));

console.log(`P19A production candidate + snapshot bridge: PASS ${checks}/${checks}; candidate snapshots=${first.requiredSnapshotCount}; producer reads=${producerReads}.`);
