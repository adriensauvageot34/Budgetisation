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
const analytics = await import("../src/analytics/global-v2/index.ts");
const query = await import("../src/query-api/global-v2/index.ts");
const materialization = await import("../src/server/analytics/materialization/global-v2.ts");
const servicesApi = await import("../src/server/query/global-v2-production-services.ts");
const runtimeApi = await import("../src/server/query/global-v2-runtime.ts");
const { buildGlobalM5Pr03Product } = await import("../src/analytics/global-v2/relationship-product.ts");
const {
  projectRelationshipPersonDays,
  projectRelationshipRestaurantOutcomes,
  projectRelationshipWorkContexts,
} = await import("../src/analytics/global-v2/relationship-fact-adapter.ts");

const months = Array.from({ length: 12 }, (_, index) => `${index < 5 ? "2025" : "2026"}-${String((index + 7) % 12 + 1).padStart(2, "0")}`);
const personA = "00000000-0000-4000-8000-000000000002";
const personB = "00000000-0000-4000-8000-000000000003";
const personaProfile = analytics.buildPersonaProfile({ signals: [
  { signalId: "bridge:photo", signalType: "DECLARED", semanticKey: "creative.photo.adrien", subject: { kind: "PERSON", personId: personA }, scope: "PERSONAL", action: "AFFIRM", value: true, kind: "PROJECT", family: "LEISURE_AND_ACTIVITIES", authority: "USER_VALIDATED", temporalStatus: "PROJECT", sourceModule: "DECLARED_V1", evidenceRefs: ["declaration:photo-project"] },
  { signalId: "m7:person-place:bridge-rollup", signalType: "MOBILITY", semanticKey: "person-place:place-one", subject: { kind: "PERSON", personId: personA }, scope: "PERSONAL", entityRef: "person-place:bridge-rollup", kind: "HABIT", family: "MOBILITY", authority: "OBSERVED", knowledgeStatus: "OBSERVED", context: "PERSON_PLACE_ROLLUP", sourceModule: "M7", metrics: { visitCount: 3, distinctVisitDays: 2, medianDurationMinutes: 40 }, evidenceRefs: ["person-place:bridge-rollup"] },
  { signalId: "m7:person-place-return:bridge-pattern", signalType: "MOBILITY", semanticKey: "person-place-return:place-one:place-two:place-one", subject: { kind: "PERSON", personId: personA }, scope: "PERSONAL", entityRef: "person-place-return:bridge-pattern", kind: "HABIT", family: "MOBILITY", authority: "OBSERVED", knowledgeStatus: "OBSERVED", context: "PERSON_PLACE_RETURN_PATTERN", sourceModule: "M7", metrics: { returnCount: 2, distinctDayCount: 2 }, evidenceRefs: ["person-place-return:bridge-pattern"] },
  { signalId: "m2:need:bridge-personal", signalType: "NEED", semanticKey: "need:bridge-personal", subject: { kind: "PERSON", personId: personB }, scope: "PERSONAL", needKey: "bridge-personal", entityRef: "need:bridge-personal", active: true, kind: "HABIT", family: "PRODUCTS_AND_CONSUMPTION", authority: "CANONICAL_DB", knowledgeStatus: "OBSERVED", sourceModule: "M2", metrics: { activeMonths: 12, annualAmount: "720", monthlyAmount: "60", typicalAmount: "55" }, evidenceRefs: ["need:bridge-personal"] },
  { signalId: "bridge:mascara", signalType: "PRODUCT_CYCLE", semanticKey: "product-need:maquillage_manon_mascara", subject: { kind: "PERSON", personId: personB }, scope: "PERSONAL", needKey: "maquillage_manon_mascara", family: "PERSONAL_CARE", authority: "OBSERVED", temporalStatus: "STABLE", sourceModule: "PRODUCT_OBSERVATIONS", metrics: { occurrenceCount: 6, medianGapDays: 65, typicalPrice: 32 }, evidenceRefs: ["product-observation:mascara"], limitations: ["PRODUCT_COVERAGE_PARTIAL"] },
  { signalId: "bridge:brows", signalType: "PRODUCT_CYCLE", semanticKey: "product-need:maquillage_manon_sourcils", subject: { kind: "PERSON", personId: personB }, scope: "PERSONAL", needKey: "maquillage_manon_sourcils", family: "PERSONAL_CARE", authority: "OBSERVED", temporalStatus: "STABLE", sourceModule: "PRODUCT_OBSERVATIONS", metrics: { occurrenceCount: 7, medianGapDays: 57, typicalPrice: 9.99 }, evidenceRefs: ["product-observation:brows"], limitations: ["PRODUCT_COVERAGE_PARTIAL"] },
  { signalId: "bridge:gaming", signalType: "DECLARED", semanticKey: "gaming", subject: { kind: "SHARED", personIds: [personA, personB] }, scope: "SHARED", action: "AFFIRM", value: true, kind: "UNIVERSE", family: "LEISURE_AND_ACTIVITIES", authority: "USER_VALIDATED", sourceModule: "DECLARED_V1", evidenceRefs: ["declaration:gaming-shared"] },
  { signalId: "bridge:car", signalType: "DECLARED", semanticKey: "vehicle.peugeot_207", subject: { kind: "HOUSEHOLD", householdId: "00000000-0000-4000-8000-000000000004" }, scope: "HOUSEHOLD", action: "AFFIRM", value: true, kind: "MOBILITY", family: "MOBILITY", authority: "USER_VALIDATED", sourceModule: "DECLARED_V1", evidenceRefs: ["declaration:household-car"], limitations: ["CANONICAL_VEHICLE_AUTHORITY_UNAVAILABLE"] },
] });
const personaProfileBeforeCandidate = structuredClone(personaProfile);
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
  ], activityCostProfiles: [
    { activityId: "travail_site", scope: "HOUSEHOLD", totalOccurrenceCount: 12, knownCausalCostCount: 8, causalCostSummary: { status: "KNOWN", median: "18.5" }, support: { supportStatus: "SUFFICIENT" }, coverage: { numerator: 8, denominator: 12, ratio: 2 / 3 }, knownOccurrenceCosts: Array.from({ length: 8 }, (_, index) => ({ occurrenceId: `onsite-${index}`, causalCost: String(10 + index), causalComponentRefs: [`component:onsite-${index}`], evidenceRefs: [`financial-link:onsite-${index}`] })), nonAdditiveAcrossActivities: true, methodVersion: "global_activity_cost_profile@v1", inputHash: "b".repeat(64) },
    { activityId: "teletravail", scope: "HOUSEHOLD", totalOccurrenceCount: 10, knownCausalCostCount: 4, causalCostSummary: { status: "PARTIAL", median: "7.5", partialMeaning: "OBSERVED_ONLY", reasonCode: "INDICATIVE_ACTIVITY_COST_SUPPORT" }, support: { supportStatus: "PARTIAL_SUPPORT" }, coverage: { numerator: 4, denominator: 10, ratio: 0.4 }, knownOccurrenceCosts: Array.from({ length: 4 }, (_, index) => ({ occurrenceId: `remote-${index}`, causalCost: String(5 + index), causalComponentRefs: [`component:remote-${index}`], evidenceRefs: [`financial-link:remote-${index}`] })), nonAdditiveAcrossActivities: true, methodVersion: "global_activity_cost_profile@v1", inputHash: "c".repeat(64) },
  ] },
  RELATIONSHIPS: [{ relationships: [{ relationshipId: "relationship:technical-only" }], insights: [] }],
  MOMENTS: {
    methodVersion: "global_moment_experience@v1", inputHash: "d".repeat(64),
    momentIdentities: [
      { momentId: "one", canonicalName: { status: "KNOWN", value: "Voyage en Bretagne", evidenceRef: "moment:one" } },
      { momentId: "two", canonicalName: { status: "KNOWN", value: "Anniversaire de Camille", evidenceRef: "moment:two" } },
    ],
    summaries: [
      { moment: { momentId: "one", type: { value: "Voyage" }, startDate: "2026-07-01", endDate: "2026-07-07" }, causalCost: { status: "KNOWN", value: "1253.90" }, spentDuring: { status: "KNOWN", value: "1800" }, composition: [{ key: "transport", amount: "500", evidenceRefs: ["component:transport"] }], sourceRefs: ["moment:one", "economic-component:transport"], paymentTimeline: [{ paymentPhase: "PAID_BEFORE", amount: "500" }, { paymentPhase: "PAID_DURING", amount: "753.90" }] },
      { moment: { momentId: "two", type: { value: "Célébration" }, startDate: "2026-06-15", endDate: "2026-06-15" }, causalCost: { status: "KNOWN", value: "240" }, spentDuring: { status: "KNOWN", value: "310" }, composition: [{ key: "food", amount: "240", evidenceRefs: ["component:food"] }], sourceRefs: ["moment:two", "economic-component:food"] },
    ],
    comparisons: [{ momentId: "one", status: "KNOWN", comparisonTier: "SAME_FAMILY", comparisonProfileId: "travel-family", peerCount: 6, support: { supportStatus: "SUFFICIENT" }, subjectCost: "1253.90", peerMedianCost: "900", q1: "700", q3: "1100", mad: "150", absoluteDelta: "353.90", relativeDelta: "0.393222", materiality: { status: "MATERIAL" }, evidenceRefs: ["comparison:one"], methodVersion: "global_moment_experience@v1" }],
    series: [], narrative: [{ momentId: "one", eligible: true, signals: ["UNUSUAL"] }, { momentId: "two", eligible: true, signals: ["DECLARED_IMPORTANCE"] }],
  },
  GEO_MOBILITY: {
    places: [{ placeId: "place-one", visitCount: 408, visitDays: 120, medianDuration: 892, lifecycle: { status: "REGULAR_STABLE" } }],
    personPlaceRollups: [{ entityRef: "person-place:bridge-rollup", personId: personA, placeId: "place-one", visitCount: 3, distinctVisitDays: 2, firstObservedDate: "2026-06-10", lastObservedDate: "2026-06-11", medianDurationMinutes: 40, support: { status: "SUFFICIENT", observedUnits: 2, minimumRequired: 2, policyRef: "global-m7-person-place-support@v1" }, knowledgeState: "KNOWN" }],
    personPlaceReturnPatterns: [{ entityRef: "person-place-return:bridge-pattern", personId: personA, originPlaceId: "place-one", stopPlaceId: "place-two", destinationPlaceId: "place-one", occurrenceCount: 2, distinctDayCount: 2, firstObservedDate: "2026-06-10", lastObservedDate: "2026-06-11", support: { status: "SUFFICIENT", observedUnits: 2, minimumRequired: 2, policyRef: "global-m7-person-place-support@v1" }, knowledgeState: "KNOWN" }],
    finance: { rollups: [{ placeId: "place-one", amount: "300" }] },
  },
  CONSUMPTION: { events: [], merchants: [], checkoutPurchaseCount: 0, retainedPurchaseCount: 0 },
  PERSONAS: { metrics: [{ personId: personA, metricId: "activity-rate:travail_site", rawValue: "0.49" }, { personId: personB, metricId: "activity-rate:teletravail", rawValue: "0.25" }], differences: [], profile: personaProfile },
  TOGETHER: { universes: [{ universeId: "activity:journee_maison", support: { sharedUnits: 35, resolvedUnits: 35, eligibleUnits: 73, sharedObservableCoverage: 0.48, knowledgeState: "PARTIAL" } }] },
};
const moduleState = {
  TRANSFORMATIONS: { knowledge: "KNOWN", capabilityState: "AVAILABLE", reasonCodes: [] },
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
const timelineQuality = { knowledgeState: "KNOWN", limitationCodes: [], evidenceRefs: ["fixture:timeline"] };
const timelineEvent = (momentId, canonicalName, startDate, endDate, typeLabel, familyKey, value, componentCount, comparisonSummary) => ({ eventRef: `moment:${momentId}`, sourceKind: "MOMENT", canonicalName, startDate, endDate, typeKey: typeLabel.toLowerCase(), typeLabel, familyKey, familySource: "M6", participantRefs: [], places: [], causalCost: { status: "KNOWN", value }, ...(comparisonSummary === undefined ? {} : { comparisonSummary }), componentCount, linkedLifeEventRefs: [], quality: timelineQuality });
const candidateAdapters = {
  timeline: { adapterVersion: "global-life-timeline-candidate-adapter@v1", precedence: "CERTIFIED_MOMENT > AUTONOMOUS_DOMINANT_TITLED_LIFE_EVENT > DEFER", sortContract: "startDate ASC, eventRef ASC", events: [timelineEvent("two", "Anniversaire de Camille", "2026-06-15", "2026-06-15", "Célébration", "CELEBRATION", "240", 1), timelineEvent("one", "Voyage en Bretagne", "2026-07-01", "2026-07-07", "Voyage", "TRAVEL_AND_STAY", "1253.90", 1, { status: "KNOWN", comparisonTier: "SAME_FAMILY", peerCount: 6 })], deferred: [], excluded: [], dependencyClosure: [], inputHash: "e".repeat(64) },
  grocery: { adapterVersion: "global-grocery-household-month-adapter@v1", grain: "HOUSEHOLD_MONTH", basketPolicy: { policyVersion: "global-grocery-basket-structure@v1", quantileMethod: "TUKEY_HINGES_EXCLUSIVE_MEDIAN", monthlyCoverageMinimum: 0.7, historicalEligibleMonthMinimum: 8 }, thresholds: { p25: "10", p75: "50" }, months: [], eligibleMonthCount: 0, historicalComparisonGate: "GATED", dependencyClosure: [], inputHash: "f".repeat(64) },
};
const momentComponentPresentation = { version: "global-moment-component-presentation@v1", inputHash: "1".repeat(64), rows: [
  { momentRef: "moment:one", componentRef: "economic-component:operation:one", canonicalComponentKey: "operation:one", amount: "1253.90", sourceKind: "Operation_parent", primaryLabel: "Voyage", labelSource: "PRECISE_TYPE", evidenceRefs: ["economic-component:operation:one"] },
  { momentRef: "moment:two", componentRef: "economic-component:operation:two", canonicalComponentKey: "operation:two", amount: "240", sourceKind: "Operation_parent", primaryLabel: "Anniversaire", labelSource: "PRECISE_TYPE", evidenceRefs: ["economic-component:operation:two"] },
] };
const semanticProjection = analytics.buildTimelineSemanticProjection({ sourceRevision: 1, moments: [], lifeEvents: [], assertions: [], lifeEventCosts: [] });
const semanticTimeline = { projection: semanticProjection, comparator: analytics.buildTimelineSemanticComparator({ projection: semanticProjection }) };
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
  candidateAdapters,
  semanticTimeline,
  momentComponentPresentation,
  presentationLabels: {
    persons: { [personA]: "Camille", [personB]: "Alex" },
    categories: { "cat-food": "Alimentation", "cat-home": "Logement", "cat-travel": "Transport", "cat-gifts": "Cadeaux", "cat-health": "Santé", "cat-misc": "Divers" },
    subcategories: { "sub-food-core": "Courses", "sub-food-extra": "Restaurants", "sub-home": "Loyer", "sub-travel": "Train", "sub-gifts": "Cadeaux", "sub-health": "Santé", "sub-misc": "Divers" },
    needs: { "need-food": "Se nourrir", "need-home": "Se loger" },
    places: { "place-one": "Lieu A", "place-two": "Lieu B" },
  },
};
const transportFor = (momentOutput, hashCharacter = "7") => {
  const names = new Map(momentOutput.momentIdentities.map(({ momentId, canonicalName }) => [momentId, canonicalName.value]));
  const events = momentOutput.summaries.map(({ moment, causalCost }, index) => timelineEvent(moment.momentId, names.get(moment.momentId), moment.startDate, moment.endDate, moment.type.value, "TRAVEL_AND_STAY", causalCost.value, causalCost.value === "0" ? 0 : 1, (() => { const comparison = momentOutput.comparisons.find(({ momentId }) => momentId === moment.momentId); return comparison === undefined ? undefined : { status: comparison.status, ...(comparison.comparisonTier === undefined ? {} : { comparisonTier: comparison.comparisonTier }), peerCount: comparison.peerCount ?? 0 }; })())).sort((left, right) => left.startDate.localeCompare(right.startDate) || left.eventRef.localeCompare(right.eventRef));
  return {
    candidateAdapters: { ...candidateAdapters, timeline: { ...candidateAdapters.timeline, events, inputHash: hashCharacter.repeat(64) } },
    momentComponentPresentation: { version: "global-moment-component-presentation@v1", inputHash: hashCharacter.repeat(64), rows: momentOutput.summaries.flatMap(({ moment, causalCost }) => causalCost.value === "0" ? [] : [{ momentRef: `moment:${moment.momentId}`, componentRef: `economic-component:operation:${moment.momentId}`, canonicalComponentKey: `operation:${moment.momentId}`, amount: causalCost.value, sourceKind: "Operation_parent", primaryLabel: names.get(moment.momentId), labelSource: "PRECISE_TYPE", evidenceRefs: [`economic-component:operation:${moment.momentId}`] }]) },
  };
};

let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const first = candidateApi.buildGlobalV2CandidateFromOwnerOutputs(base);
const second = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({ ...base, ownerOutputs: [...modules].reverse() });
const snapshot = (resource, sectionKey) => first.snapshots.find((entry) => entry.resource === resource && (sectionKey === undefined || entry.params.sectionKey === sectionKey));
const compact = (resource) => snapshot(resource).payload;
const detail = (entityRef) => first.snapshots.find((entry) => entry.resource === "analysis_global_category_need_detail" && entry.params.entityRef === entityRef)?.payload;
const queryDetail = (resource, entityRef) => first.snapshots.find((entry) => entry.resource === resource && entry.params.entityRef === entityRef)?.payload;
check(() => assert.equal(first.candidateId, second.candidateId));
check(() => assert.equal(first.factsHash, second.factsHash));
check(() => assert.equal(first.manifestHash, second.manifestHash));
check(() => assert.deepEqual(first.requiredKeys, second.requiredKeys));
check(() => assert.deepEqual(first.snapshots.map(({ payloadHash }) => payloadHash), second.snapshots.map(({ payloadHash }) => payloadHash)));
check(() => assert.equal(first.requiredSnapshotCount, first.queryInstanceCount));
check(() => assert.equal(first.requiredSnapshotCount, first.requiredKeys.queries.length));
check(() => assert.equal(first.requiredArtifactCount, first.requiredKeys.artifacts.length));
check(() => assert.equal(first.requiredArtifactCount, 14));
check(() => assert.equal(first.artifacts.length, 14));
check(() => assert.equal(first.versions.artifacts.length, 14));
check(() => assert.equal(first.manifest.closures.filter(({ outputKey }) => first.requiredKeys.artifacts.includes(outputKey)).length, 14));
check(() => assert.equal(first.artifacts.some(({ key, version }) => key.includes("owner-outputs") || version.family === "global_owner_outputs"), false));
check(() => assert.deepEqual(first.artifacts.map(({ key }) => key), [...first.requiredKeys.artifacts].sort()));
const artifactPayloadBytes = first.artifacts.map(({ key, version, payload }) => ({ key, family: version.family, bytes: Buffer.byteLength(JSON.stringify(payload), "utf8") }));
check(() => assert.equal(artifactPayloadBytes.every(({ bytes }) => bytes <= candidateApi.GLOBAL_V2_ARTIFACT_PAYLOAD_BUDGET_BYTES), true, artifactPayloadBytes.filter(({ bytes }) => bytes > candidateApi.GLOBAL_V2_ARTIFACT_PAYLOAD_BUDGET_BYTES).map(({ key }) => key).join(",")));
const artifactPayloadByFamily = new Map(first.artifacts.map((artifact) => [artifact.version.family, artifact.payload]));
const recomposedLegacyBody = {
  outputs: first.artifacts.filter(({ version }) => version.family === "global_owner_output").map(({ payload }) => {
    const { publicationMeta: _publicationMeta, resourceMeta: _resourceMeta, ...ownerBody } = payload;
    return ownerBody;
  }).sort((left, right) => left.moduleKey.localeCompare(right.moduleKey)),
  presentationLabels: artifactPayloadByFamily.get("global_presentation_labels").presentationLabels,
  candidateAdapters: artifactPayloadByFamily.get("global_candidate_adapters").candidateAdapters,
  semanticTimeline: artifactPayloadByFamily.get("global_semantic_timeline").semanticTimeline,
  momentComponentPresentation: artifactPayloadByFamily.get("global_moment_component_presentation").momentComponentPresentation,
};
const expectedLegacyBody = {
  outputs: first.ownerOutputs.map(({ moduleKey, owner, output, knowledge, capabilityState, reasonCodes, evidenceRefs }) => ({ moduleKey, owner, output, knowledge, capabilityState, reasonCodes: [...reasonCodes].sort(), evidenceRefs: [...evidenceRefs].sort() })),
  presentationLabels: Object.fromEntries(["persons", "places", "categories", "subcategories", "needs", "recurrences"].map((group) => [group, Object.fromEntries(Object.entries(base.presentationLabels[group] ?? {}).sort(([left], [right]) => left.localeCompare(right)))])),
  candidateAdapters: base.candidateAdapters,
  semanticTimeline: base.semanticTimeline,
  momentComponentPresentation: base.momentComponentPresentation,
};
check(() => assert.deepEqual(recomposedLegacyBody, expectedLegacyBody));
const dependencyIdentity = (dependency) => `${dependency.authority}:${dependency.family}:${dependency.identity}`;
const dependencyUnion = (dependencies) => [...new Map(dependencies.map((dependency) => [dependencyIdentity(dependency), dependency])).values()].sort((left, right) => dependencyIdentity(left).localeCompare(dependencyIdentity(right)));
const legacyArtifactDependencies = first.plan.instances.find(({ resource }) => resource === "analysis_global_manifest").dependencies;
const newArtifactDependencyUnion = dependencyUnion(first.artifacts.flatMap(({ dependencies }) => dependencies));
check(() => assert.deepEqual(newArtifactDependencyUnion, dependencyUnion(legacyArtifactDependencies)));
const artifactKeySet = new Set(first.requiredKeys.artifacts);
const queryClosures = first.manifest.closures.filter(({ outputKey }) => !artifactKeySet.has(outputKey));
const legacyArtifactClosure = {
  outputKey: `global-artifact:owner-outputs:${first.scopeHash}`,
  declarationDigest: materialization.globalV2ClosureDeclarationDigest(legacyArtifactDependencies),
  inputDigest: materialization.globalV2ClosureInputDigest(legacyArtifactDependencies),
  dependencies: legacyArtifactDependencies,
};
const legacyPublicationFactsHash = materialization.globalV2PublicationFactsHash({
  householdId: first.manifest.householdId,
  asOf: first.manifest.asOf,
  certifiedThrough: first.manifest.certifiedThrough,
  sourceRevision: first.manifest.sourceRevision,
  closures: [legacyArtifactClosure, ...queryClosures],
});
check(() => assert.equal(first.manifest.publicationFactsHash, legacyPublicationFactsHash));
const firstArtifactVersion = first.versions.artifacts[0];
const legacyManifest = materialization.buildGlobalV2PublicationManifest({
  formatVersion: first.manifest.formatVersion,
  profileId: first.manifest.profileId,
  householdId: first.manifest.householdId,
  asOf: first.manifest.asOf,
  certifiedThrough: first.manifest.certifiedThrough,
  sourceRevision: first.manifest.sourceRevision,
  baseAnalyticsRevision: first.manifest.baseAnalyticsRevision,
  resourceFamilies: first.manifest.resourceFamilies,
  requiredArtifactKeys: [legacyArtifactClosure.outputKey],
  requiredQueryKeys: first.manifest.requiredQueryKeys,
  closures: [legacyArtifactClosure, ...queryClosures],
  externalDependencyRefs: first.manifest.externalDependencyRefs,
  artifactVersions: [{ ...firstArtifactVersion, key: legacyArtifactClosure.outputKey, family: "global_owner_outputs", contractVersion: "global-owner-outputs@v1" }],
  queryVersions: first.manifest.queryVersions,
  publicationFactsHash: legacyPublicationFactsHash,
  implementation: first.manifest.implementation,
});
check(() => assert.notEqual(first.manifest.manifestHash, legacyManifest.manifestHash));
const relabeled = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({
  ...base,
  presentationLabels: { ...base.presentationLabels, categories: { ...base.presentationLabels.categories, "cat-food": "Alimentation courante" } },
});
const artifactInputHashes = (candidate) => new Map(candidate.artifacts.map(({ key, version }) => [key.replace(candidate.scopeHash, "{scopeHash}"), version.resourceInputHash]));
const firstArtifactInputHashes = artifactInputHashes(first);
const changedArtifactInputKeys = [...artifactInputHashes(relabeled)].filter(([key, resourceInputHash]) => firstArtifactInputHashes.get(key) !== resourceInputHash).map(([key]) => key).sort();
check(() => assert.deepEqual(changedArtifactInputKeys, [
  "global-artifact:owner-output:categories-needs:{scopeHash}",
  "global-artifact:presentation-labels:{scopeHash}",
]));
const withoutSemanticTimeline = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({ ...base, semanticTimeline: undefined });
check(() => assert.equal(withoutSemanticTimeline.artifacts.length, 13));
check(() => assert.equal(withoutSemanticTimeline.artifacts.some(({ version }) => version.family === "global_semantic_timeline"), false));
check(() => assert.throws(() => candidateApi.buildGlobalV2CandidateFromOwnerOutputs({
  ...base,
  ownerOutputs: modules.map((ownerOutput) => ownerOutput.moduleKey === "PERSONAS" ? { ...ownerOutput, output: { ...ownerOutput.output, artifactBudgetProbe: "x".repeat(candidateApi.GLOBAL_V2_ARTIFACT_PAYLOAD_BUDGET_BYTES) } } : ownerOutput),
}), new RegExp(`GLOBAL_ARTIFACT_PAYLOAD_BUDGET_EXCEEDED:key=global-artifact:owner-output:personas:${first.scopeHash}`)));
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
const rhythmOverview = snapshot("analysis_global_rhythm_expanded", "OVERVIEW").payload;
const rhythmPatterns = snapshot("analysis_global_rhythm_expanded", "PATTERNS").payload;
const rhythmBreakdown = snapshot("analysis_global_rhythm_expanded", "BREAKDOWN").payload;
const rhythmComparisons = snapshot("analysis_global_rhythm_expanded", "COMPARISONS").payload;
check(() => assert.equal(rhythmOverview.primaryInsight.titleKey, "Voyage en Bretagne"));
check(() => assert.deepEqual(rhythmOverview.secondaryInsights.map(({ titleKey }) => titleKey), ["Anniversaire de Camille"]));
check(() => assert.equal(rhythmOverview.rows.some(({ entityRef }) => entityRef?.startsWith("household-activity:")), false));
check(() => assert.deepEqual(rhythmPatterns.rows.map(({ entityRef }) => entityRef), ["household-activity:travail_site", "household-activity:teletravail"]));
check(() => assert.equal(rhythmPatterns.rows.every(({ typedMeasure }) => typedMeasure?.kind === "MONEY" && typedMeasure.unit === "EUR/occurrence"), true));
check(() => assert.deepEqual(rhythmPatterns.rows.map(({ activityCostProfile }) => [activityCostProfile.knownCausalCostCount.value, activityCostProfile.totalOccurrenceCount.value, activityCostProfile.coverageRatio.value]), [["8", "12", String(2 / 3)], ["4", "10", "0.4"]]));
check(() => assert.equal(rhythmPatterns.rows.every(({ activityCostProfile }) => activityCostProfile.nonAdditiveAcrossActivities === true), true));
check(() => assert.deepEqual(rhythmBreakdown.rows.map(({ labelKey }) => labelKey), ["Voyage en Bretagne", "Anniversaire de Camille"]));
check(() => assert.equal(rhythmBreakdown.rows.every(({ typedMeasure }) => typedMeasure?.kind === "MONEY"), true));
check(() => assert.equal(rhythmComparisons.rows[0].momentComparison.comparisonTier, "SAME_FAMILY"));
check(() => assert.deepEqual(Object.fromEntries(Object.entries(rhythmComparisons.rows[0].momentComparison).filter(([, value]) => typeof value === "object").map(([key, value]) => [key, value.kind])), { peerCount: "COUNT", subjectCost: "MONEY", peerMedian: "MONEY", q1: "MONEY", q3: "MONEY", mad: "MONEY", absoluteDelta: "MONEY", relativeDelta: "DECIMAL" }));
check(() => assert.equal(compact("analysis_global_rhythm").primaryInsight.kind, "M6_MATERIAL_COMPARISON"));
check(() => assert.equal(compact("analysis_global_transformations").visibility, "HIDDEN"));
check(() => assert.equal(compact("analysis_global_transformations").primaryInsight, undefined));
check(() => assert.equal(compact("analysis_global_transformations").quality.knowledgeState, "KNOWN"));
check(() => assert.equal(compact("analysis_global_transformations").capabilities[0].state, "AVAILABLE"));
check(() => assert.deepEqual(compact("analysis_global_transformations").capabilities[0].reasonCodes, []));
const notEvaluatedTransformations = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({
  ...base,
  ownerOutputs: modules.map((entry) => entry.moduleKey === "TRANSFORMATIONS" ? {
    ...entry,
    knowledge: "UNKNOWN",
    capabilityState: "UNAVAILABLE",
    reasonCodes: ["TRANSFORMATION_INPUT_UNIVERSE_NOT_EVALUATED"],
  } : entry),
});
const notEvaluatedTransformationCompact = notEvaluatedTransformations.snapshots.find(({ resource }) => resource === "analysis_global_transformations").payload;
check(() => assert.equal(notEvaluatedTransformationCompact.quality.knowledgeState, "UNKNOWN"));
check(() => assert.equal(notEvaluatedTransformationCompact.capabilities[0].state, "UNAVAILABLE"));
check(() => assert.deepEqual(notEvaluatedTransformationCompact.capabilities[0].reasonCodes, ["TRANSFORMATION_INPUT_UNIVERSE_NOT_EVALUATED"]));
check(() => assert.notEqual(notEvaluatedTransformations.manifestHash, first.manifestHash));
check(() => assert.equal(JSON.stringify(first.snapshots.filter(({ resource }) => resource.includes("relationships"))).includes("relationship:technical-only"), false));
check(() => assert.equal(compact("analysis_global_relationships").visibility, "HIDDEN"));
check(() => assert.equal(compact("analysis_global_relationships").placeholder, undefined));
check(() => assert.equal(compact("analysis_global_moments").visibility, "HIDDEN"));
check(() => assert.equal(snapshot("analysis_global_moments_expanded", "OVERVIEW").payload.rows[0].labelKey, "Voyage"));
check(() => assert.ok(queryDetail("analysis_global_routine_detail", "household-activity:travail_site")));
check(() => assert.ok(queryDetail("analysis_global_routine_detail", `person-activity:${personA}:travail_site`)));
check(() => assert.equal(queryDetail("analysis_global_routine_detail", "activity:travail_site"), undefined));
check(() => assert.notDeepEqual(queryDetail("analysis_global_routine_detail", "household-activity:travail_site"), queryDetail("analysis_global_routine_detail", `person-activity:${personA}:travail_site`)));
const momentDetail = queryDetail("analysis_global_moment_experience_detail", "moment:one");
check(() => assert.equal(momentDetail.rows[0].labelKey, "Voyage en Bretagne"));
check(() => assert.equal(momentDetail.rows[0].momentComparison.comparisonTier, "SAME_FAMILY"));
check(() => assert.deepEqual(momentDetail.metrics.filter(({ metricId }) => /causal-cost|spent-during/u.test(metricId)).map(({ typedMeasure }) => typedMeasure.value), ["1253.90", "1800"]));
check(() => assert.equal(momentDetail.metrics.find(({ metricId }) => metricId.endsWith(":peer-count")).typedMeasure.kind, "COUNT"));
check(() => assert.equal([...rhythmOverview.destinations, ...rhythmPatterns.destinations, ...rhythmBreakdown.destinations, ...rhythmComparisons.destinations].every(({ instanceKey, sourcePublicationId, sourceAnalyticsRevision }) => first.requiredKeys.queries.includes(instanceKey) && sourcePublicationId === first.candidateId && sourceAnalyticsRevision === 80), true));
const rhythmInstances = first.plan.instances.filter(({ resource }) => ["analysis_global_rhythm", "analysis_global_rhythm_expanded", "analysis_global_routine_detail"].includes(resource));
const expectedRhythmOwnerFamilies = ["global_moments_owner_output", "global_relationships_owner_output", "global_rhythm_owner_output", "global_transformations_owner_output"];
check(() => assert.equal(rhythmInstances.every(({ dependencies }) => expectedRhythmOwnerFamilies.every((family) => dependencies.some((dependency) => dependency.family === family))), true));
check(() => assert.deepEqual(Object.entries(query.globalV2QueryRegistry).filter(([, contract]) => contract.policyVersions.projection === "global-life-spending-query-projection@v1").map(([resource]) => resource).sort(), ["analysis_global_moment_experience_detail", "analysis_global_rhythm", "analysis_global_rhythm_expanded", "analysis_global_routine_detail"]));
const reachableQueryKeys = new Set(first.snapshots.flatMap(({ payload }) => (payload.destinations ?? []).flatMap(({ kind, instanceKey }) => kind === "GLOBAL_QUERY" ? [instanceKey] : [])).concat(first.snapshots.flatMap(({ payload }) => (payload.detailEntries ?? []).map(({ targetRef }) => targetRef))));
const generatedLifeDetails = first.snapshots.filter(({ resource }) => ["analysis_global_routine_detail", "analysis_global_moment_experience_detail"].includes(resource));
check(() => assert.equal(generatedLifeDetails.every(({ key }) => reachableQueryKeys.has(key)), true));
check(() => assert.equal(compact("analysis_global_consumption").visibility, "PLACEHOLDER"));
check(() => assert.equal(compact("analysis_global_consumption").placeholder.messageKey, "Analyse pas encore disponible"));
check(() => assert.deepEqual(compact("analysis_global_consumption").kpis, []));
check(() => assert.equal(compact("analysis_global_personas").visibility, "VISIBLE"));
check(() => assert.equal(compact("analysis_global_personas").primaryInsight.titleKey, "Aucune différence nette à mettre en avant entre vos profils"));
check(() => assert.ok(snapshot("analysis_global_personas_expanded", "OVERVIEW").payload.rows.length > 0));
const personaReadModel = snapshot("analysis_global_personas_expanded", "OVERVIEW").payload;
const projectedPersona = personaReadModel.profile;
const projectedPersonaFeatured = projectedPersona.profiles.flatMap(({ featuredTraits }) => featuredTraits);
const enginePersonalProfiles = personaProfile.profiles.filter(({ scope, subject }) => scope === "PERSONAL" && subject.kind === "PERSON");
check(() => assert.deepEqual(personaProfile, personaProfileBeforeCandidate));
check(() => assert.equal(projectedPersona.contractVersion, "persona-published-profile@v1"));
check(() => assert.deepEqual(projectedPersona.profiles.map(({ subject }) => subject.personId), enginePersonalProfiles.map(({ subject }) => subject.personId)));
check(() => assert.deepEqual(projectedPersona.profiles.map(({ featuredTraits }) => featuredTraits.map(({ traitId }) => traitId)), enginePersonalProfiles.map(({ featuredTraits }) => featuredTraits.map(({ traitId }) => traitId))));
check(() => assert.equal(projectedPersona.profiles.every((profile) => profile.scope === "PERSONAL" && profile.subject.kind === "PERSON" && !("allTraits" in profile)), true));
check(() => assert.equal(projectedPersonaFeatured.every((trait) => enginePersonalProfiles.some((profile) => profile.featuredTraits.some(({ traitId }) => traitId === trait.traitId))), true));
check(() => assert.doesNotMatch(JSON.stringify(projectedPersona), /evidenceRefs|signalRefs|sourceModules|authorit(?:y|ies)|explanation|selection|reasonCodes|limitations/u));
const publishedBeautyTrait = projectedPersonaFeatured.find(({ semanticKey }) => semanticKey === "universe.beauty_and_care");
check(() => assert.equal(publishedBeautyTrait.children.find(({ semanticKey }) => semanticKey === "product-need:maquillage_manon_mascara").metrics.typicalPrice, 32));
check(() => assert.deepEqual(publishedBeautyTrait.children.map(({ semanticKey }) => semanticKey), ["product-need:maquillage_manon_mascara", "product-need:maquillage_manon_sourcils"]));
check(() => assert.ok(Buffer.byteLength(JSON.stringify(compact("analysis_global_personas")), "utf8") <= query.GLOBAL_COMPACT_PAYLOAD_BUDGET_BYTES));
check(() => assert.ok(Buffer.byteLength(JSON.stringify(personaReadModel), "utf8") <= query.PERSONA_OVERVIEW_SOFT_BUDGET_BYTES));
check(() => assert.ok(Buffer.byteLength(JSON.stringify(personaReadModel), "utf8") <= query.GLOBAL_EXPANDED_PAYLOAD_BUDGET_BYTES));
const personaDetailSnapshots = first.snapshots.filter(({ resource }) => resource === "analysis_global_persona_detail");
const secondPersonaDetailSnapshots = second.snapshots.filter(({ resource }) => resource === "analysis_global_persona_detail");
check(() => assert.equal(personaDetailSnapshots.length, 2));
check(() => assert.deepEqual(personaDetailSnapshots.map(({ params }) => params.entityRef), [`person:${personA}`, `person:${personB}`]));
check(() => assert.deepEqual(personaDetailSnapshots, secondPersonaDetailSnapshots));
check(() => assert.equal(personaDetailSnapshots.every(({ payload, params }) => payload.personaDetailIndex.personId === params.entityRef.slice("person:".length)), true));
check(() => assert.equal(personaDetailSnapshots.every(({ payload }) => payload.rows.length === 0), true));
const personADetail = personaDetailSnapshots.find(({ params }) => params.entityRef === `person:${personA}`).payload.personaDetailIndex;
const personBDetail = personaDetailSnapshots.find(({ params }) => params.entityRef === `person:${personB}`).payload.personaDetailIndex;
const bridgePlaceBlock = personADetail.blocks.find(({ semanticKey }) => semanticKey === "person-place:place-one");
const bridgePatternBlock = personADetail.blocks.find(({ semanticKey }) => semanticKey === "person-place-return:place-one:place-two:place-one");
check(() => assert.deepEqual(bridgePlaceBlock.detailRefs, [{ resource: "analysis_global_place_mobility_detail", entityRef: "person-place:bridge-rollup", role: "PRIMARY" }]));
check(() => assert.deepEqual(bridgePatternBlock.detailRefs, [{ resource: "analysis_global_place_mobility_detail", entityRef: "person-place-return:bridge-pattern", role: "PRIMARY" }]));
const ownerPlaceDetail = queryDetail("analysis_global_place_mobility_detail", "person-place:bridge-rollup");
const ownerPatternDetail = queryDetail("analysis_global_place_mobility_detail", "person-place-return:bridge-pattern");
check(() => assert.deepEqual(ownerPlaceDetail.metrics.map(({ metricId, displayValue }) => [metricId, displayValue]), [["distinct-visit-days", "2"], ["median-duration-minutes", "40 min"], ["visit-count", "3"]]));
check(() => assert.deepEqual(ownerPatternDetail.metrics.map(({ metricId, displayValue }) => [metricId, displayValue]), [["distinct-day-count", "2"], ["occurrence-count", "2"]]));
check(() => assert.equal(JSON.stringify([bridgePlaceBlock, bridgePatternBlock]).includes("personPlaceRollups"), false));
const bridgeNeedBlock = personBDetail.blocks.find(({ semanticKey }) => semanticKey === "need:bridge-personal");
check(() => assert.deepEqual(bridgeNeedBlock.detailRefs, [{ resource: "analysis_global_category_need_detail", entityRef: "need:bridge-personal", role: "PRIMARY" }]));
check(() => assert.deepEqual(bridgeNeedBlock.surfaceMetrics.map(({ metricId, displayValue }) => [metricId, displayValue]), [["activeMonths", "12"], ["annualAmount", "720"], ["monthlyAmount", "60"]]));
check(() => assert.equal(personaDetailSnapshots.every(({ payload }) => !/shared|household.must-not-leak/u.test(JSON.stringify(payload.personaDetailIndex))), true));
check(() => assert.equal(personaDetailSnapshots.every(({ payload }) => !/allTraits|evidenceRefs|signalRefs|sourceModules|ownerOutputs|selection|explanation|reasonCodes|inputHash/u.test(JSON.stringify(payload.personaDetailIndex))), true));
check(() => assert.equal(personaDetailSnapshots.every(({ payload }) => Buffer.byteLength(JSON.stringify(payload.personaDetailIndex), "utf8") <= query.PERSONA_DETAIL_INDEX_SOFT_BUDGET_BYTES), true));
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
const noForcedFill = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({ ...base, ownerOutputs: mutate("MOMENTS", (entry) => ({ output: { ...entry.output, momentIdentities: [], summaries: [], comparisons: [], narrative: [] } })) });
const noForcedFillOverview = noForcedFill.snapshots.find(({ resource, params }) => resource === "analysis_global_rhythm_expanded" && params.sectionKey === "OVERVIEW").payload;
check(() => assert.equal(noForcedFillOverview.primaryInsight, undefined));
check(() => assert.deepEqual(noForcedFillOverview.secondaryInsights, []));
check(() => assert.deepEqual(noForcedFillOverview.rows, []));
const relationshipInsight = ({ personId = personA, relationshipId = "onsite-restaurant", effect = 0.25, evidenceStatus = "PUBLISHED", materialityStatus = "MATERIAL", aiEligible = true, causalityMode = "ASSOCIATION_ONLY" } = {}) => ({
  relationshipId, relationshipDefinitionVersion: "relationship-catalog-explicit-families@v2", subjectRef: personId, scope: "PERSON", stability: "STABLE_CURRENT_REGIME",
  access: { autoGlobal: aiEligible ? "VISIBLE" : "HIDDEN", moduleDetailAutomatic: aiEligible ? "VISIBLE" : "HIDDEN", explicitExploration: "VISIBLE", aiEligible, statisticalValuesInAi: false, languageKey: "OBSERVED_ASSOCIATION", causalityMode: "ASSOCIATION_ONLY", policyVersion: "global-relationship-access@v1" },
  causalityMode, grain: "DAY", exposure: relationshipId === "remote-restaurant" ? "REMOTE" : "ONSITE", comparator: relationshipId === "remote-restaurant" ? "ONSITE" : "REMOTE", outcome: "RESTAURANT",
  sample: { exposed: 18, comparator: 18, matchedPairs: 18 }, effect: { kind: "PROBABILITY_DIFFERENCE", absoluteEffect: effect, exposedLevel: 0.5, comparatorLevel: 0.25, interval95: [0.1, 0.4] },
  evidence: { rawPValue: 0.04, adjustedQValue: 0.04, evidenceStatus }, materiality: { status: materialityStatus }, matchingSummary: { method: "EXACT_WEEKDAY_NEAREST_NO_REPLACEMENT" },
  support: { naturalGrain: "PERSON_DAY", eligibleUnits: 36, observedUnits: 36, includedUnits: 36, excludedObservedUnits: 0, minimumRequired: 30, supportStatus: "SUFFICIENT", policyRef: "relationship-day-post-match-15@v1" },
  coverage: axisCoverage("PERSON_DAY", "KNOWN", 1), evidenceRefs: [`relationship:${relationshipId}:${personId}`], methodVersion: "global_relationship_insight@v1", inputHash: "f".repeat(64), analyticsRevision: 79, policyVersions: {},
});
const evaluatedRelationship = (personId, insights, extra = {}) => ({ evaluationStatus: "EVALUATED", scope: { personId }, productUniverseId: "m5-v1-pr03-person", productDefinitionIds: ["onsite-restaurant"], insights, ...extra });
const gatedRelationship = (personId) => ({ evaluationStatus: "AUTHORITY_GATED", scope: { personId }, productUniverseId: "m5-v1-pr03-person", productDefinitionIds: ["onsite-restaurant"], reasonCodes: ["AUTHORITY_GATED_CURRENT_REGIME"], insights: [] });
const rhythmWith = (personResults, transformationOutput = outputByModule.TRANSFORMATIONS) => {
  const ownerOutputs = modules.map((entry) => entry.moduleKey === "RELATIONSHIPS" ? { ...entry, output: personResults, capabilityState: "UNAVAILABLE", reasonCodes: ["AUTHORITY_GATED_RELATIONSHIP_PROVIDERS"] } : entry.moduleKey === "TRANSFORMATIONS" ? { ...entry, output: transformationOutput } : entry);
  const candidate = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({ ...base, ownerOutputs });
  return candidate.snapshots.find(({ resource, params }) => resource === "analysis_global_rhythm_expanded" && params.sectionKey === "OVERVIEW").payload;
};

const upstreamPr03Provider = (personId, positive) => {
  const regime = { status: "KNOWN", regimeId: `regime:${personId}` };
  const personDays = [], occurrences = [], participations = [], calendar = [];
  const completeLifeMonths = [];
  for (let month = 1; month <= 12; month++) {
    const prefix = `2025-${String(month).padStart(2, "0")}`;
    completeLifeMonths.push(prefix);
    for (let pair = 1; pair <= 3; pair++) {
      for (const [context, dayNumber] of [["ONSITE", pair], ["REMOTE", pair + 7]]) {
        const date = `${prefix}-${String(dayNumber).padStart(2, "0")}`;
        const personDayId = `person-day:${personId}:${date}`;
        const workEventId = `work:${personId}:${date}`;
        personDays.push({ fact: "fct_person_day", householdId: base.householdId, householdTimeZone: base.householdTimeZone, personDayId, personId, localDate: date, locationObservability: "unknown" });
        occurrences.push({ fact: "fct_activity_occurrence", householdId: base.householdId, householdTimeZone: base.householdTimeZone, lifeEventId: workEventId, activityId: context === "ONSITE" ? "travail_site" : "teletravail", lifeEventSeriesId: null, parentLifeEventId: null, startDate: date, endDate: date, validationStatus: "Confirmé", participantIds: [personId] });
        participations.push({ lifeEventId: workEventId, personDayId, personId, status: "Confirmée", evidenceRef: `participation:${workEventId}` });
        calendar.push({ personDayId, calendarClass: [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()) ? "WEEKEND" : "WEEKDAY", evidenceRef: `calendar:${personDayId}` });
        if (positive && context === "ONSITE") {
          const restaurantEventId = `restaurant:${personId}:${date}`;
          occurrences.push({ fact: "fct_activity_occurrence", householdId: base.householdId, householdTimeZone: base.householdTimeZone, lifeEventId: restaurantEventId, activityId: "repas_restaurant", lifeEventSeriesId: null, parentLifeEventId: null, startDate: date, endDate: date, validationStatus: "Confirmé", participantIds: [personId] });
          participations.push({ lifeEventId: restaurantEventId, personDayId, personId, status: "Confirmée", evidenceRef: `participation:${restaurantEventId}` });
        }
      }
    }
  }
  const contexts = projectRelationshipWorkContexts({ householdId: base.householdId, personId, personDays, occurrences, participations });
  const days = projectRelationshipPersonDays({ householdId: base.householdId, personId, regimeId: regime.regimeId, personDays, contexts, calendar });
  const outcomes = projectRelationshipRestaurantOutcomes({ householdId: base.householdId, personId, days, occurrences, participations, completeLifeMonths });
  const refs = [...new Set([...days.flatMap((day) => [...day.evidenceRefs, ...day.contextEvidenceRefs, ...day.calendarEvidenceRefs]), ...outcomes.flatMap((outcome) => outcome.dependencyRefs), regime.regimeId])];
  return {
    evaluationStatus: "READY_FOR_PRODUCT", scope: { personId }, reasonCodes: [], missingPersonDayDates: [], exceptionPolicy: "NOT_USED_V1", seasonPolicy: "NOT_REQUIRED",
    analysis: { householdId: base.householdId, personId, regimeId: regime.regimeId, householdTimeZone: base.householdTimeZone, asOf: "2026-01-01T00:00:00Z", certifiedThrough: "2025-12-31", analyticsRevision: 79, sourceRevision: 1, days, outcomes, dependencyDigests: Object.fromEntries(refs.map((ref) => [ref, `digest:${ref}`])) },
  };
};

// Post-Run-E C01: real canonical-shaped person-day/activity participation
// inputs flow through product execution and cross-person BH into Query/RHYTHM.
const realPr03Product = buildGlobalM5Pr03Product({
  authorizedPersonIds: [personA, personB],
  providers: [upstreamPr03Provider(personA, true), upstreamPr03Provider(personB, false)],
});
const realPersonResult = realPr03Product.ownerResults.find((entry) => entry.scope.personId === personA);
const realInsight = realPersonResult.insights.find((entry) => entry.relationshipId === "onsite-restaurant");
const realHypothesis = realPr03Product.current.hypotheses.find((entry) => entry.personId === personA);
check(() => assert.equal(realPersonResult.evaluationStatus, "EVALUATED"));
check(() => assert.equal(realInsight.evidence.evidenceStatus, "PUBLISHED"));
check(() => assert.equal(realInsight.evidence.adjustedQValue, realHypothesis.qValue));
check(() => assert.notEqual(realInsight.evidence.adjustedQValue, realInsight.evidence.rawPValue));
check(() => assert.ok(realPr03Product.windows.every((window) => window.executedTechnicalDefinitionIds.join() === "onsite-restaurant")));
const realPr03Overview = rhythmWith(realPr03Product.ownerResults);
check(() => assert.equal(realPr03Overview.primaryInsight.kind, "M5_MATERIAL_ROBUST_ASSOCIATION"));
check(() => assert.match(realPr03Overview.primaryInsight.statementKey, /associés à/u));
check(() => assert.doesNotMatch(realPr03Overview.primaryInsight.statementKey, /(?:provoque|cause|p\s*=|q\s*=)/u));
check(() => assert.equal([realPr03Overview.primaryInsight, ...realPr03Overview.secondaryInsights].filter(({ kind }) => kind === "M5_MATERIAL_ROBUST_ASSOCIATION").length, 1));
const unrelatedGatedProduct = buildGlobalM5Pr03Product({ authorizedPersonIds: [personA, personB], providers: [upstreamPr03Provider(personA, true), { evaluationStatus: "AUTHORITY_GATED", scope: { personId: personB }, reasonCodes: ["AUTHORITY_GATED_CURRENT_REGIME"] }] });
check(() => assert.equal(rhythmWith(unrelatedGatedProduct.ownerResults).primaryInsight.kind, "M5_MATERIAL_ROBUST_ASSOCIATION"));

// E-T33..E-T35: person-scoped owner arrays are flattened; nested evidence and
// insight-scoped access survive unrelated module/person gates.
const positiveRelationshipOverview = rhythmWith([gatedRelationship(personB), evaluatedRelationship(personA, [relationshipInsight()])]);
check(() => assert.equal(positiveRelationshipOverview.primaryInsight.kind, "M5_MATERIAL_ROBUST_ASSOCIATION"));
check(() => assert.equal(positiveRelationshipOverview.primaryInsight.entityRefs[0], `person:${personA}`));
check(() => assert.match(positiveRelationshipOverview.primaryInsight.titleKey, /Camille/u));
check(() => assert.match(positiveRelationshipOverview.primaryInsight.statementKey, /associés à une fréquence de restaurant plus élevée/u));
check(() => assert.doesNotMatch(positiveRelationshipOverview.primaryInsight.statementKey, /(?:provoque|cause|p\s*=|q\s*=)/u));

const negativeRelationshipOverview = rhythmWith([evaluatedRelationship(personA, [relationshipInsight({ effect: -0.25 })]), gatedRelationship(personB)]);
check(() => assert.match(negativeRelationshipOverview.primaryInsight.statementKey, /plus faible/u));

// E-T36 and fail-closed variants.
for (const hidden of [
  relationshipInsight({ relationshipId: "remote-restaurant" }),
  relationshipInsight({ materialityStatus: "NOT_MATERIAL" }),
  relationshipInsight({ evidenceStatus: "SUGGESTIVE_INTERNAL" }),
  relationshipInsight({ evidenceStatus: "REJECTED" }),
  relationshipInsight({ aiEligible: false }),
  relationshipInsight({ causalityMode: "CAUSAL" }),
]) {
  const overview = rhythmWith([evaluatedRelationship(personA, [hidden]), gatedRelationship(personB)]);
  check(() => assert.notEqual(overview.primaryInsight?.kind, "M5_MATERIAL_ROBUST_ASSOCIATION"));
}
const wrongUniverse = rhythmWith([{ ...evaluatedRelationship(personA, [relationshipInsight()]), productUniverseId: "technical-all" }, gatedRelationship(personB)]);
check(() => assert.notEqual(wrongUniverse.primaryInsight?.kind, "M5_MATERIAL_ROBUST_ASSOCIATION"));

// E-T37: stable person tie-break, max one M5 and frozen A > B > C > D order.
const twoPersonForward = rhythmWith([evaluatedRelationship(personA, [relationshipInsight()]), evaluatedRelationship(personB, [relationshipInsight({ personId: personB })])]);
const twoPersonReverse = rhythmWith([evaluatedRelationship(personB, [relationshipInsight({ personId: personB })]), evaluatedRelationship(personA, [relationshipInsight()])]);
check(() => assert.equal(twoPersonForward.primaryInsight.insightId, twoPersonReverse.primaryInsight.insightId));
check(() => assert.match(twoPersonForward.primaryInsight.insightId, new RegExp(personA)));
check(() => assert.equal([twoPersonForward.primaryInsight, ...twoPersonForward.secondaryInsights].filter(({ kind }) => kind === "M5_MATERIAL_ROBUST_ASSOCIATION").length, 1));
const transformation = { transformations: [{ transformationId: "certified-change", status: "CONFIRMED_ONGOING", titleKey: "Changement certifié", evidenceRefs: ["transformation:certified-change"] }], relationshipChanges: [] };
const prioritized = rhythmWith([evaluatedRelationship(personA, [relationshipInsight()]), gatedRelationship(personB)], transformation);
check(() => assert.equal(prioritized.primaryInsight.kind, "M3_CERTIFIED_TRANSFORMATION"));
check(() => assert.equal(prioritized.secondaryInsights[0].kind, "M5_MATERIAL_ROBUST_ASSOCIATION"));
check(() => assert.equal(1 + prioritized.secondaryInsights.length, 3));
const currentGatedOverview = rhythmWith([gatedRelationship(personA), gatedRelationship(personB)]);
check(() => assert.equal([currentGatedOverview.primaryInsight, ...currentGatedOverview.secondaryInsights].filter((entry) => entry?.kind === "M5_MATERIAL_ROBUST_ASSOCIATION").length, 0));
const selectorMomentOutput = {
  ...outputByModule.MOMENTS,
  momentIdentities: Array.from({ length: 4 }, (_, index) => ({ momentId: `selector-${index}`, canonicalName: { status: "KNOWN", value: `Moment sélection ${index}`, evidenceRef: `moment:selector-${index}` } })),
  summaries: Array.from({ length: 4 }, (_, index) => ({ moment: { momentId: `selector-${index}`, type: { value: "Voyage" }, startDate: `2026-0${index + 1}-01`, endDate: `2026-0${index + 1}-02` }, causalCost: { status: "KNOWN", value: String(1000 - index * 100) }, sourceRefs: [`moment:selector-${index}`] })),
  comparisons: Array.from({ length: 4 }, (_, index) => ({ ...outputByModule.MOMENTS.comparisons[0], momentId: `selector-${index}`, comparisonTier: index === 3 ? "SAME_FAMILY" : index === 2 ? "SAME_TYPE" : "SAME_SERIES", peerCount: 8 - index, absoluteDelta: String(400 - index * 20), evidenceRefs: [`comparison:selector-${index}`] })),
  narrative: Array.from({ length: 4 }, (_, index) => ({ momentId: `selector-${index}`, eligible: true, signals: ["DECLARED_IMPORTANCE"] })),
};
const cappedOverviewCandidate = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({ ...base, ownerOutputs: mutate("MOMENTS", () => ({ output: selectorMomentOutput })), ...transportFor(selectorMomentOutput, "7") });
const cappedOverview = cappedOverviewCandidate.snapshots.find(({ resource, params }) => resource === "analysis_global_rhythm_expanded" && params.sectionKey === "OVERVIEW").payload;
check(() => assert.equal((cappedOverview.primaryInsight === undefined ? 0 : 1) + cappedOverview.secondaryInsights.length, 3));
check(() => assert.equal(cappedOverview.rows.some(({ entityRef }) => entityRef?.startsWith("household-activity:")), false));
const factChange = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({ ...base, ownerOutputs: mutate("ECONOMIC", (entry) => ({ output: { ...entry.output, current: "changed" } })) });
check(() => assert.notEqual(factChange.candidateId, first.candidateId));
check(() => assert.notEqual(factChange.factsHash, first.factsHash));
check(() => assert.notEqual(factChange.manifestHash, first.manifestHash));
const unavailableMomentOutput = { ...outputByModule.MOMENTS, momentIdentities: [], summaries: [], comparisons: [], narrative: [] };
const capabilityChange = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({ ...base, ownerOutputs: mutate("MOMENTS", () => ({ output: unavailableMomentOutput, capabilityState: "UNAVAILABLE", knowledge: "UNKNOWN", reasonCodes: ["AUTHORITY_GATED"] })), ...transportFor(unavailableMomentOutput, "6") });
check(() => assert.notEqual(capabilityChange.requiredSnapshotCount, first.requiredSnapshotCount));
check(() => assert.notEqual(capabilityChange.manifestHash, first.manifestHash));
const instanceMomentOutput = { ...outputByModule.MOMENTS, momentIdentities: [...outputByModule.MOMENTS.momentIdentities, { momentId: "three", canonicalName: { status: "KNOWN", value: "Projet cuisine", evidenceRef: "moment:three" } }], summaries: [...outputByModule.MOMENTS.summaries, { moment: { momentId: "three", type: { value: "Projet maison" }, startDate: "2026-07-15", endDate: "2026-07-15" }, causalCost: { status: "KNOWN", value: "100" }, sourceRefs: ["moment:three"] }] };
const instanceChange = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({ ...base, ownerOutputs: mutate("MOMENTS", () => ({ output: instanceMomentOutput })), ...transportFor(instanceMomentOutput, "8") });
check(() => assert.ok(instanceChange.requiredSnapshotCount > first.requiredSnapshotCount));
check(() => assert.notEqual(instanceChange.manifestHash, first.manifestHash));
const boundedMomentOutput = { inputHash: "e".repeat(64), methodVersion: "global_moment_experience@v1", momentIdentities: Array.from({ length: 60 }, (_, index) => ({ momentId: `moment-${String(index).padStart(2, "0")}`, canonicalName: { status: "KNOWN", value: `Moment ${String(index).padStart(2, "0")}`, evidenceRef: `moment:${String(index).padStart(2, "0")}` } })), summaries: Array.from({ length: 60 }, (_, index) => ({ moment: { momentId: `moment-${String(index).padStart(2, "0")}`, type: { value: "Voyage" }, startDate: "2026-07-01", endDate: "2026-07-01" }, causalCost: { status: "KNOWN", value: String(100 - index) }, sourceRefs: [`moment:${String(index).padStart(2, "0")}`] })), comparisons: [], series: [], narrative: [] };
const boundedMoments = candidateApi.buildGlobalV2CandidateFromOwnerOutputs({
  ...base,
  ownerOutputs: mutate("MOMENTS", () => ({ output: boundedMomentOutput })),
  ...transportFor(boundedMomentOutput, "9"),
});
const momentDetails = boundedMoments.snapshots.filter(({ resource }) => resource === "analysis_global_moment_experience_detail");
const momentBreakdownBounded = boundedMoments.snapshots.find(({ resource, params }) => resource === "analysis_global_rhythm_expanded" && params.sectionKey === "BREAKDOWN");
check(() => assert.equal(momentDetails.length, 60));
check(() => assert.equal(momentBreakdownBounded.payload.rows.length, 10));
check(() => assert.deepEqual(
  momentBreakdownBounded.payload.rows.map(({ entityRef }) => entityRef).sort(),
  momentDetails.map(({ params }) => params.entityRef).filter((entityRef) => momentBreakdownBounded.payload.rows.some((row) => row.entityRef === entityRef)).sort(),
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
const candidateSource = fs.readFileSync(path.join(root, "src/server/analytics/global-v2-candidate.ts"), "utf8");
check(() => assert.doesNotMatch(candidateSource, /1253\.90|travail_site|moment:one/u));
check(() => assert.equal(first.snapshots.some(({ resource, params }) => resource === "analysis_global_rhythm_expanded" && params.sectionKey === "EVOLUTION"), false));
check(() => assert.equal(JSON.stringify(first.snapshots.filter(({ resource }) => resource.includes("rhythm"))).includes("Aucun changement"), false));
check(() => assert.equal(JSON.stringify(first.snapshots.filter(({ resource }) => resource.includes("rhythm"))).includes("Pas encore assez d’éléments pour établir une relation fiable"), false));
const orchestratorSource = fs.readFileSync(path.join(root, "src/server/analytics/global-v2-production-orchestrator.ts"), "utf8");
check(() => assert.match(orchestratorSource, /loadActivityOccurrenceCosts[\s\S]*buildGlobalActivityCostProfile[\s\S]*output: \{ rhythms, activityCostProfiles \}/u));
check(() => assert.match(orchestratorSource, /const baseM3Series = \[[\s\S]*projectGlobalM1ActualTransformationSeries[\s\S]*projectGlobalM2CategoryTransformationSeries[\s\S]*\.\.\.baseM3M4Series[\s\S]*const baseM3 = buildGlobalTransformations\(\{[\s\S]*series: baseM3Series,[\s\S]*relations: \[\],[\s\S]*\}\)/u));
check(() => assert.equal(orchestratorSource.match(/buildGlobalTransformations\(\{/gu)?.length, 1));
const baseM3EvaluationSource = orchestratorSource.slice(orchestratorSource.indexOf("const baseM3Evaluation"), orchestratorSource.indexOf("const personRegimeAuthorities"));
check(() => assert.doesNotMatch(baseM3EvaluationSource, /relationshipEvolution|driverAuthorities|anchors/u));
const baseM3SeriesSource = orchestratorSource.match(/const baseM3Series = \[[\s\S]*?\n      \];/u)?.[0] ?? "";
check(() => assert.doesNotMatch(baseM3SeriesSource, /m5|m6|m7|m8/u));
check(() => assert.match(orchestratorSource, /return \{ evaluated: true as const, series: baseM3Series, output: baseM3, knowledge: "KNOWN" as const, capabilityState: "AVAILABLE" as const, reasonCodes: \[\] as const \}/u));
check(() => assert.match(orchestratorSource, /TRANSFORMATION_INPUT_UNIVERSE_BUILD_FAILED/u));
const regimeSelectionSource = orchestratorSource.slice(orchestratorSource.indexOf("const personRegimeAuthorities"), orchestratorSource.indexOf("const m5 = await Promise.all"));
check(() => assert.doesNotMatch(regimeSelectionSource, /relationshipEvolution|m5Product|m5RelationshipEvolution/u));
check(() => assert.doesNotMatch(orchestratorSource, /moduleKey: "TRANSFORMATIONS"[^\n]*NO_CERTIFIED_TRANSFORMATION/u));
check(() => assert.match(orchestratorSource, /const \[m2, m6, m7, productObservations\][\s\S]*resolveGlobalPersonaProductObservations[\s\S]*const baseM3Evaluation[\s\S]*const personRegimeAuthorities[\s\S]*const m5 = await Promise\.all[\s\S]*const m5Product = buildGlobalM5Pr03Product/u));
check(() => assert.match(orchestratorSource, /buildGlobalV2PersonaSignals\(\{[\s\S]*m8,[\s\S]*productObservations,[\s\S]*m10,/u));
check(() => assert.match(orchestratorSource, /selectGlobalPersonRegimeAuthority\([\s\S]*resolveGlobalM5PersonAuthority\([\s\S]*regimeAuthority,[\s\S]*buildGlobalM5Pr03Product\(\{[\s\S]*authorizedPersonIds: context\.personIds\.map\(String\),[\s\S]*providers: m5/u));
check(() => assert.ok(orchestratorSource.lastIndexOf("buildGlobalTransformations({") < orchestratorSource.indexOf("const m5Product")));
check(() => assert.match(orchestratorSource, /const m5OwnerOutput = m5Product\.ownerResults;[\s\S]*const m5RelationshipEvolution = m5Product\.relationshipEvolution/u));
const m2AuthoritySource = fs.readFileSync(path.join(root, "src/server/analytics/global-v2-category-needs-authority.ts"), "utf8");
check(() => assert.match(m2AuthoritySource, /transformationMonthlyComponents: components/u));
const personRegimeSource = fs.readFileSync(path.join(root, "src/analytics/global-v2/person-regime-authority.ts"), "utf8");
check(() => assert.match(personRegimeSource, /\["travail_site", "teletravail"\]/u));
check(() => assert.match(personRegimeSource, /participatingSeries[\s\S]*sources\.some[\s\S]*isRawActivityOccurrenceRef[\s\S]*flatMap\(\(source\) => source\.structuralAuthorityRefs\)/u));
check(() => assert.doesNotMatch(personRegimeSource, /repas_restaurant|STABLE_CURRENT_REGIME|typical|largest|earliest|latest/iu));
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
console.log("PERSONA_GOLDEN_READ_MODEL=PASS");
console.log(`GLOBAL_ARTIFACT_SPLIT=${JSON.stringify({ budgetBytes: candidateApi.GLOBAL_V2_ARTIFACT_PAYLOAD_BUDGET_BYTES, artifacts: artifactPayloadBytes })}`);
