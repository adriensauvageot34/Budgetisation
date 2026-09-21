import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const root = process.cwd();
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (specifier.startsWith("@/")) specifier = pathToFileURL(path.join(root, "src", specifier.slice(2))).href;
  try { return next(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") && !specifier.startsWith("file:")) throw error;
    if (/\.[cm]?[jt]s$/u.test(specifier)) throw error;
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) try { return next(candidate, context); } catch { /* next */ }
    throw error;
  }
} });

const analytics = await import("../src/analytics/global-v2/index.ts");
const query = await import("../src/query-api/global-v2/index.ts");
const materialization = await import("../src/server/analytics/materialization/global-v2.ts");

let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const rejects = (fn, pattern) => check(() => assert.throws(fn, pattern));
const h = (char) => char.repeat(64);
const publicationMeta = {
  publicationId: "00000000-0000-4000-8000-000000000140",
  revision: 80,
  factsHash: h("a"),
  generatedAt: "2026-09-06T14:00:00Z",
  profileId: "global-v2-household@v1",
  manifestHash: h("b"),
};
const resourceMeta = (index) => ({
  contractVersion: `global-${index}@v1`,
  methodSignature: String(index % 10).repeat(64),
  policyVersions: { [`module-policy-${index}`]: "v1" },
  resourceInputHash: String((index + 1) % 10).repeat(64),
});
const gateResults = { capability: true, applicable: true, semantic: true, knowledge: true, certification: true, support: true, coverage: true, materiality: true, statistics: true, temporalRobustness: true, editorialSelection: true };
const decision = (sectionKey, visibility = "VISIBLE", extra = {}) => ({
  sectionKey, sectionClass: "CONDITIONAL_ANALYTIC", surface: "AUTO_GLOBAL", visibility,
  gateResults, analyticsRevision: "80", publicationPolicyVersion: "global-publication-policy@v1", ...extra,
});
const context = (id, limitationCodes = [`limit:${id}`]) => ({
  metricRefs: [`metric:${id}`], comparisonRefs: [], entityRefs: [`entity:${id}`], evidenceRefs: [`evidence:${id}`],
  limitationCodes, coverageRefs: [`coverage:${id}`], supportRefs: [`support:${id}`], provenanceRefs: [`provenance:${id}`],
  capabilityRefs: [`capability:${id}`], detailRefs: [`detail:${id}`],
});
const candidate = (id, moduleKey, score, overrides = {}) => ({
  insightId: id, moduleKey, kind: "CHANGE", subjectRef: "household", titleKey: `title.${id}`, statementKey: `statement.${id}`,
  primaryMetricRef: `metric:${id}`, redundancyGroup: `group:${id}`, monetaryOnly: false, temporalClass: "CURRENT",
  materiality: { candidateId: id, phenomenonId: `phenomenon:${id}`, naturalGrain: "MONTH", status: "MATERIAL", gates: { authority: "PASS", support: "PASS", coverage: "PASS", absolute: "PASS", relative: "PASS", share: "NOT_APPLICABLE", persistence: "NOT_APPLICABLE" }, reasonCodes: [], policy: { id: "global-materiality", version: "v1" } },
  publication: decision(id),
  scores: { materiality: score, robustness: score, persistence: score, humanRelevance: score, supportCoverage: score, novelty: score },
  supportingContext: context(id), methodVersion: "insight-source@v1", ...overrides,
});
const quality = { knowledgeState: "KNOWN", supportStatus: "SUFFICIENT", effectiveCoverage: 1, dataNature: "OBSERVED", limitationCodes: [], evidenceRefs: ["evidence:module"] };
const capability = { capabilityId: "module", state: "AVAILABLE", reasonCodes: [] };
const detail = { entryId: "detail", labelKey: "detail.label", targetResource: "analysis_global_detail", targetRef: "target:1" };
const personaSignals = [{
  signalId: "read-model:declared-project",
  signalType: "DECLARED",
  semanticKey: "creative.photo.read-model",
  subject: { kind: "PERSON", personId: "00000000-0000-4000-8000-000000000001" },
  scope: "PERSONAL",
  action: "AFFIRM",
  value: true,
  kind: "PROJECT",
  family: "LEISURE_AND_ACTIVITIES",
  authority: "USER_VALIDATED",
  temporalStatus: "PROJECT",
  sourceModule: "DECLARED_V1",
  evidenceRefs: ["declaration:photo-project"],
  limitations: ["RUNTIME_ACTIVITY_SUPPORT_PARTIAL"],
}];
const personaProfile = analytics.buildPersonaProfile({ signals: personaSignals });
const personaProfileBeforeProjection = structuredClone(personaProfile);
const publishedPersonaProfile = query.projectPersonaPublishedProfile(personaProfile);

// Publication hard gates remain upstream and opportunistic insights never get placeholders.
const publicationEngine = new analytics.GlobalPublicationEngine();
const opportunisticPolicy = { policyId: "insight", sectionClass: "OPPORTUNISTIC_INSIGHT", allowedSurfaces: ["AUTO_GLOBAL"], requireCertifiedHistory: true, requireMateriality: true, requireStatistics: true, requireTemporalRobustness: true, allowPartialQualifiedDetail: false, placeholderPolicy: "NEVER", methodVersion: "publication@v1" };
check(() => assert.deepEqual(Object.keys(publicationEngine.decide({ sectionKey: "opportunistic", policy: opportunisticPolicy, surface: "AUTO_GLOBAL", analyticsRevision: "80", gates: { capability: true, applicable: true, semantic: true, knowledge: "UNKNOWN", certification: true } })).includes("placeholder"), false));
check(() => assert.deepEqual(analytics.globalPublicationGateOrder, ["capability", "applicability", "semanticValidity", "knowledge", "corpusCertification", "support", "coverage", "provenance", "baseCompatibility", "materiality", "statisticalRobustness", "temporalRobustness", "editorialSelection", "publication"]));
const completeGates = { capability: true, applicable: true, semantic: true, knowledge: "KNOWN", certification: true, support: "SUFFICIENT", coverage: 1, provenance: true, baseCompatible: true, materiality: true, statistics: true, temporalRobustness: true, editorialSelection: true, publicationReady: true };
check(() => assert.equal(publicationEngine.decide({ sectionKey: "opportunistic", policy: opportunisticPolicy, surface: "AUTO_GLOBAL", analyticsRevision: "80", gates: { ...completeGates, provenance: false, baseCompatible: false } }).reasonCode, "MISSING_PROVENANCE"));
check(() => assert.equal(publicationEngine.decide({ sectionKey: "opportunistic", policy: opportunisticPolicy, surface: "AUTO_GLOBAL", analyticsRevision: "80", gates: { ...completeGates, baseCompatible: false, materiality: false } }).reasonCode, "INCOMPATIBLE_BASE"));
check(() => assert.equal(publicationEngine.decide({ sectionKey: "opportunistic", policy: opportunisticPolicy, surface: "AUTO_GLOBAL", analyticsRevision: "80", gates: { ...completeGates, publicationReady: false } }).reasonCode, "INCOMPLETE_PUBLICATION_EVIDENCE"));

const selectionEngine = new analytics.InsightSelectionEngine();
const eight = [
  candidate("a", "ECONOMIC", 1), candidate("b", "CATEGORIES_NEEDS", .95), candidate("c", "TRANSFORMATIONS", .9),
  candidate("d", "RHYTHM", .85), candidate("e", "RELATIONSHIPS", .8), candidate("f", "MOMENTS", .75),
  candidate("g", "GEO_MOBILITY", .7), candidate("h", "CONSUMPTION", .65),
];
const selected = selectionEngine.select({ candidates: eight });
check(() => assert.equal(selected.selectedInsights.length, 5));
check(() => assert.equal(selected.selectionEntries.length, 8));
check(() => assert.deepEqual(selected.selectedInsights.map(({ insightId }) => insightId), ["a", "b", "c", "d", "e"]));
check(() => assert.deepEqual(selectionEngine.select({ candidates: [...eight].reverse() }).selectedInsights.map(({ insightId }) => insightId), ["a", "b", "c", "d", "e"]));
check(() => assert.deepEqual(selected.selectionEntries.find(({ insightId }) => insightId === "h").supportingContext.limitationCodes, ["limit:h"]));
check(() => assert.equal(selectionEngine.select({ candidates: [] }).selectedInsights.length, 0));

const redundant = selectionEngine.select({ candidates: [candidate("r1", "ECONOMIC", 1, { redundancyGroup: "same" }), candidate("r2", "CATEGORIES_NEEDS", .9, { redundancyGroup: "same" })] });
check(() => assert.deepEqual(redundant.selectedInsights.map(({ insightId }) => insightId), ["r1"]));
check(() => assert.equal(redundant.selectionEntries.find(({ insightId }) => insightId === "r2").reasonCode, "REDUNDANT_WITH_HIGHER_PRIORITY"));
const recent = selectionEngine.select({ candidates: [candidate("new1", "ECONOMIC", 1, { temporalClass: "RECENT_ONLY" }), candidate("new2", "MOMENTS", .9, { temporalClass: "RECENT_ONLY" })] });
check(() => assert.equal(recent.selectedInsights.length, 1));
const partial = candidate("partial", "ECONOMIC", .8, { materiality: { ...candidate("partial", "ECONOMIC", .8).materiality, status: "QUALIFIED_PARTIAL" }, publication: decision("partial", "VISIBLE", { qualification: "PARTIAL_COVERAGE" }) });
check(() => assert.equal(selectionEngine.select({ candidates: [partial] }).selectedInsights.length, 1));
const gated = candidate("gated", "ECONOMIC", 1, { publication: decision("gated", "HIDDEN", { reasonCode: "CAPABILITY_NOT_AVAILABLE" }) });
check(() => assert.equal(selectionEngine.select({ candidates: [gated] }).selectedInsights.length, 0));
const weakOpportunistic = candidate("weak", "ECONOMIC", 1, { materiality: { ...candidate("weak", "ECONOMIC", 1).materiality, status: "QUALIFIED_PARTIAL" }, publication: { ...decision("weak"), sectionClass: "OPPORTUNISTIC_INSIGHT" } });
check(() => assert.equal(selectionEngine.select({ candidates: [weakOpportunistic] }).selectedInsights.length, 0));
rejects(() => selectionEngine.select({ candidates: [candidate("dup", "ECONOMIC", 1), candidate("dup", "ECONOMIC", .5)] }), /CONTRADICTORY_DUPLICATE/);

const modules = query.globalPrimaryModuleCatalog.map((entry, index) => {
  const insight = candidate(`module-${index}`, entry.moduleKey, .9);
  const visibility = index === 3 ? "PLACEHOLDER" : "VISIBLE";
  const publicationDecision = visibility === "PLACEHOLDER"
    ? decision(`module:${entry.moduleKey}`, "PLACEHOLDER", { reasonCode: "INSUFFICIENT_SUPPORT", placeholder: { messageKey: "global.placeholder.insufficient_support", progress: { current: 3, required: 6, unit: "months" } } })
    : decision(`module:${entry.moduleKey}`);
  return query.buildGlobalModuleCompactReadModel({
    moduleKey: entry.moduleKey,
    publicationDecision,
    insightCandidates: visibility === "VISIBLE" && index !== 1 ? [insight] : [],
    kpis: visibility === "VISIBLE" ? [{ kpiId: `kpi-${index}`, phenomenonId: index === 1 ? `structural:${index}` : insight.materiality.phenomenonId, labelKey: `kpi.${index}`, displayValue: `${index}`, metricRef: `metric:${index}`, evidenceRefs: [`evidence:kpi:${index}`] }] : [],
    quality: index === 0 ? { ...quality, knowledgeState: "PARTIAL", partialMeaning: "OBSERVED_ONLY", effectiveCoverage: .8, limitationCodes: ["PARTIAL_SOURCE"] } : quality,
    capabilities: [{ ...capability, capabilityId: `capability:${index}`, reasonCodes: index === 3 ? ["DATA_GATED"] : [] }],
    detailEntries: [{ ...detail, entryId: `detail:${index}`, targetRef: `target:${index}` }],
    publicationMeta,
    resourceMeta: resourceMeta(index),
  });
});

check(() => assert.equal(modules.length, 10));
for (const [index, module] of modules.entries()) {
  check(() => assert.equal(query.globalPrimaryReadModelSchemas[module.resource].safeParse(module).success, true));
  check(() => assert.ok(Buffer.byteLength(JSON.stringify(module), "utf8") <= query.GLOBAL_COMPACT_PAYLOAD_BUDGET_BYTES));
  check(() => assert.equal(module.primaryInsight === undefined || !("editorialScore" in module.primaryInsight), true));
  check(() => assert.ok(module.kpis.length <= 3, `module ${index}`));
}
check(() => assert.equal(modules[1].primaryInsight, undefined));
check(() => assert.equal(modules[1].kpis.length, 1));
check(() => assert.equal(modules[3].placeholder.messageKey, "global.placeholder.insufficient_support"));
check(() => assert.equal(modules[0].quality.knowledgeState, "PARTIAL"));
check(() => assert.equal(modules[0].quality.partialMeaning, "OBSERVED_ONLY"));
const personaExpanded = query.buildGlobalExpandedReadModel({
  kind: "global_expanded", schemaVersion: "global-expanded@v1", resource: "analysis_global_personas_expanded", moduleKey: "PERSONAS", sectionKey: "OVERVIEW", visibility: "VISIBLE",
  secondaryInsights: [], metrics: [], series: [], rows: [], destinations: [], profile: publishedPersonaProfile,
  quality, capabilities: [{ ...capability, capabilityId: "GLOBAL_PERSONAS" }], publicationMeta, resourceMeta: resourceMeta(50),
});
check(() => assert.deepEqual(personaProfile, personaProfileBeforeProjection));
check(() => assert.deepEqual(personaExpanded.profile, publishedPersonaProfile));
check(() => assert.deepEqual(personaExpanded.profile.profiles.map(({ scope }) => scope), ["PERSONAL"]));
check(() => assert.deepEqual(personaExpanded.profile.profiles[0].featuredTraits.map(({ traitId }) => traitId), personaProfile.profiles.find(({ scope }) => scope === "PERSONAL").featuredTraits.map(({ traitId }) => traitId)));
check(() => assert.equal("allTraits" in personaExpanded.profile.profiles[0], false));
check(() => assert.doesNotMatch(JSON.stringify(personaExpanded.profile), /evidenceRefs|signalRefs|sourceModules|authorit(?:y|ies)|explanation|selection|reasonCodes|limitations/u));
const unknownMetricEngineProfile = structuredClone(personaProfile);
unknownMetricEngineProfile.profiles[0].allTraits[0].metrics = { unknownValue: "UNKNOWN", measuredZero: 0 };
unknownMetricEngineProfile.profiles[0].featuredTraits[0].metrics = { unknownValue: "UNKNOWN", measuredZero: 0 };
check(() => assert.deepEqual(query.projectPersonaPublishedProfile(unknownMetricEngineProfile).profiles[0].featuredTraits[0].metrics, { unknownValue: "UNKNOWN", measuredZero: 0 }));
const largeEvidencePersonaProfile = analytics.buildPersonaProfile({ signals: [{
  ...personaSignals[0],
  evidenceRefs: Array.from({ length: 5_000 }, (_, index) => `evidence:persona:${String(index).padStart(5, "0")}:${"x".repeat(48)}`),
}] });
const largeEvidencePublishedProfile = query.projectPersonaPublishedProfile(largeEvidencePersonaProfile);
check(() => assert.deepEqual(largeEvidencePublishedProfile, publishedPersonaProfile));
check(() => assert.ok(Buffer.byteLength(JSON.stringify(largeEvidencePersonaProfile), "utf8") > query.GLOBAL_EXPANDED_PAYLOAD_BUDGET_BYTES));
check(() => assert.ok(Buffer.byteLength(JSON.stringify(largeEvidencePublishedProfile), "utf8") < query.GLOBAL_EXPANDED_PAYLOAD_BUDGET_BYTES));
check(() => assert.ok(Buffer.byteLength(JSON.stringify(personaExpanded), "utf8") <= query.GLOBAL_EXPANDED_PAYLOAD_BUDGET_BYTES));
check(() => assert.ok(Buffer.byteLength(JSON.stringify(personaExpanded), "utf8") <= query.PERSONA_OVERVIEW_SOFT_BUDGET_BYTES));
check(() => assert.equal(query.GLOBAL_EXPANDED_PAYLOAD_BUDGET_BYTES, 96 * 1024));
rejects(() => query.buildGlobalExpandedReadModel({ ...personaExpanded, resource: "analysis_global_together_expanded", moduleKey: "TOGETHER" }), /PERSONA_PROFILE_RESOURCE_MISMATCH/);
rejects(() => query.parsePersonaPublishedProfileOutput({ ...publishedPersonaProfile, profiles: [{ ...publishedPersonaProfile.profiles[0], allTraits: [] }] }), /non autorisée|unrecognized_key/u);

const personAProfile = personaProfile.profiles.find(({ scope }) => scope === "PERSONAL");
const personAId = personAProfile.subject.personId;
const personBId = "00000000-0000-4000-8000-000000000202";
const secondTrait = {
  ...structuredClone(personAProfile.featuredTraits[0]),
  traitId: "read-model:second-trait",
  semanticKey: "routine.read-model.second",
  metrics: { zMetric: 9, aMetric: 1, cMetric: 3, ignoredMetric: 4 },
};
const personAWithTwoTraits = {
  ...structuredClone(personAProfile),
  featuredTraits: [secondTrait, ...structuredClone(personAProfile.featuredTraits)],
  allTraits: [secondTrait, ...structuredClone(personAProfile.allTraits)],
};
const personBProfile = {
  ...structuredClone(personAProfile),
  subject: { kind: "PERSON", personId: personBId },
  featuredTraits: personAProfile.featuredTraits.map((trait) => ({
    ...structuredClone(trait),
    traitId: `person-b:${trait.traitId}`,
    semanticKey: `person-b.${trait.semanticKey}`,
    subject: { kind: "PERSON", personId: personBId },
  })),
  allTraits: personAProfile.allTraits.map((trait) => ({
    ...structuredClone(trait),
    traitId: `person-b:${trait.traitId}`,
    semanticKey: `person-b.${trait.semanticKey}`,
    subject: { kind: "PERSON", personId: personBId },
  })),
};
const sharedProfile = {
  subject: { kind: "SHARED", personIds: [personAId, personBId] },
  scope: "SHARED",
  allTraits: [{ ...structuredClone(personAProfile.allTraits[0]), traitId: "shared:trait", semanticKey: "shared.must-not-leak", subject: { kind: "SHARED", personIds: [personAId, personBId] }, scope: "SHARED" }],
  featuredTraits: [{ ...structuredClone(personAProfile.featuredTraits[0]), traitId: "shared:trait", semanticKey: "shared.must-not-leak", subject: { kind: "SHARED", personIds: [personAId, personBId] }, scope: "SHARED" }],
};
const householdProfile = {
  subject: { kind: "HOUSEHOLD", householdId: "00000000-0000-4000-8000-000000000303" },
  scope: "HOUSEHOLD",
  allTraits: [{ ...structuredClone(personAProfile.allTraits[0]), traitId: "household:trait", semanticKey: "household.must-not-leak", subject: { kind: "HOUSEHOLD", householdId: "00000000-0000-4000-8000-000000000303" }, scope: "HOUSEHOLD" }],
  featuredTraits: [{ ...structuredClone(personAProfile.featuredTraits[0]), traitId: "household:trait", semanticKey: "household.must-not-leak", subject: { kind: "HOUSEHOLD", householdId: "00000000-0000-4000-8000-000000000303" }, scope: "HOUSEHOLD" }],
};
const detailSource = { ...personaProfile, profiles: [sharedProfile, personBProfile, householdProfile, personAWithTwoTraits] };
const detailA = query.projectPublishedPersonaDetailIndex(detailSource, personAId);
const detailB = query.projectPublishedPersonaDetailIndex(detailSource, personBId);
check(() => assert.deepEqual(query.parsePublishedPersonaDetailIndex(detailA), detailA));
check(() => assert.equal(query.publishedPersonaDetailIndexSchema.safeParse(detailA).success, true));
rejects(() => query.parsePublishedPersonaDetailIndex({ ...detailA, ownerOutputs: [] }), /non autorisée|unrecognized_key/u);
rejects(() => query.parsePublishedPersonaDetailIndex({ ...detailA, blocks: [{ ...detailA.blocks[0], evidenceRefs: [] }, ...detailA.blocks.slice(1)] }), /non autorisée|unrecognized_key/u);
const reversedDetailSource = {
  ...detailSource,
  profiles: detailSource.profiles.map((profile) => profile.scope === "PERSONAL" && profile.subject.personId === personAId
    ? { ...profile, featuredTraits: [...profile.featuredTraits].reverse() }
    : profile),
};
check(() => assert.deepEqual(query.projectPublishedPersonaDetailIndex(reversedDetailSource, personAId), detailA));
check(() => assert.deepEqual(detailA.blocks.find(({ blockId }) => blockId === secondTrait.traitId).surfaceMetrics.map(({ metricId }) => metricId), ["aMetric", "cMetric", "ignoredMetric"]));
check(() => assert.notDeepEqual(detailA, detailB));
check(() => assert.equal(detailA.personId, personAId));
check(() => assert.equal(detailB.personId, personBId));
check(() => assert.equal(JSON.stringify([detailA, detailB]).includes("shared.must-not-leak"), false));
check(() => assert.equal(JSON.stringify([detailA, detailB]).includes("household.must-not-leak"), false));
check(() => assert.doesNotMatch(JSON.stringify([detailA, detailB]), /allTraits|evidenceRefs|signalRefs|sourceModules|ownerOutputs|selection|explanation|reasonCodes|inputHash/u));
const hugeEvidenceDetailSource = structuredClone(detailSource);
const hugeRefs = Array.from({ length: 10_000 }, (_, index) => `engine-evidence:${String(index).padStart(5, "0")}:${"x".repeat(64)}`);
const hugePersonA = hugeEvidenceDetailSource.profiles.find((profile) => profile.scope === "PERSONAL" && profile.subject.personId === personAId);
hugePersonA.featuredTraits = hugePersonA.featuredTraits.map((trait) => ({ ...trait, evidenceRefs: hugeRefs, signalRefs: hugeRefs }));
hugePersonA.allTraits = hugePersonA.allTraits.map((trait) => ({ ...trait, evidenceRefs: hugeRefs, signalRefs: hugeRefs }));
const hugeEvidenceDetail = query.projectPublishedPersonaDetailIndex(hugeEvidenceDetailSource, personAId);
check(() => assert.deepEqual(hugeEvidenceDetail, detailA));
check(() => assert.ok(Buffer.byteLength(JSON.stringify(hugeEvidenceDetailSource), "utf8") > 1_000_000));
check(() => assert.ok(Buffer.byteLength(JSON.stringify(detailA), "utf8") <= query.PERSONA_DETAIL_INDEX_SOFT_BUDGET_BYTES));
check(() => assert.ok(Buffer.byteLength(JSON.stringify(detailB), "utf8") <= query.PERSONA_DETAIL_INDEX_PAYLOAD_BUDGET_BYTES));
rejects(() => query.parsePublishedPersonaDetailIndex({ ...detailA, blocks: [{ ...detailA.blocks[0], semanticKey: "x".repeat(query.PERSONA_DETAIL_INDEX_PAYLOAD_BUDGET_BYTES) }, ...detailA.blocks.slice(1)] }), /PAYLOAD_BUDGET_EXCEEDED/u);
const personaDetailReadModel = query.buildGlobalExpandedReadModel({
  kind: "global_expanded", schemaVersion: "global-expanded@v1", resource: "analysis_global_persona_detail", moduleKey: "PERSONAS", sectionKey: "OVERVIEW", visibility: "VISIBLE",
  secondaryInsights: [], metrics: [], series: [], rows: [], destinations: [], personaDetailIndex: detailA,
  quality, capabilities: [{ ...capability, capabilityId: "GLOBAL_PERSONA_DETAIL" }], publicationMeta, resourceMeta: resourceMeta(51),
});
check(() => assert.deepEqual(personaDetailReadModel.personaDetailIndex, detailA));
rejects(() => query.buildGlobalExpandedReadModel({ ...personaDetailReadModel, resource: "analysis_global_personas_expanded" }), /PERSONA_DETAIL_INDEX_RESOURCE_MISMATCH/);
const transportSchema = query.createGlobalReadModelTransportSchema(query.parseGlobalModuleCompactReadModel);
check(() => assert.equal(transportSchema.parse({ status: "READY", data: modules[0] }).data.quality.knowledgeState, "PARTIAL"));
check(() => assert.equal(transportSchema.parse({ status: "ERROR", errorCode: "NETWORK", previousData: modules[0] }).previousData.visibility, "VISIBLE"));
rejects(() => transportSchema.parse({ status: "LOADING", data: modules[0] }), /payload/);

query.assertGlobalReadModelPublicationCoherence(modules);
check(() => assert.doesNotThrow(() => query.assertGlobalReadModelPublicationCoherence(modules.map((module, index) => ({ ...module, resourceMeta: resourceMeta(index + 20) })))));
rejects(() => query.assertGlobalReadModelPublicationCoherence([modules[0], { ...modules[1], publicationMeta: { ...publicationMeta, publicationId: "other" } }]), /MIXED_PUBLICATION/);
rejects(() => query.assertGlobalReadModelPublicationCoherence([modules[0], { ...modules[1], publicationMeta: { ...publicationMeta, revision: 81 } }]), /MIXED_PUBLICATION/);
rejects(() => query.assertGlobalReadModelPublicationCoherence([modules[0], { ...modules[1], publicationMeta: { ...publicationMeta, factsHash: h("c") } }]), /MIXED_PUBLICATION/);
rejects(() => query.globalModuleCompactReadModelSchema.parse({ ...modules[0], publicationMeta: undefined }), /payload/);
rejects(() => query.globalModuleCompactReadModelSchema.parse({ ...modules[0], chart: [] }), /payload/);
rejects(() => query.buildGlobalModuleCompactReadModel({
  moduleKey: "ECONOMIC", publicationDecision: decision("module:ECONOMIC"), insightCandidates: [],
  kpis: [0, 1, 2, 3].map((index) => ({ kpiId: `k${index}`, phenomenonId: "same", labelKey: "kpi", displayValue: "1", metricRef: "metric", evidenceRefs: [] })),
  quality, capabilities: [], detailEntries: [], publicationMeta, resourceMeta: resourceMeta(1),
}), /KPI_LIMIT/);
rejects(() => query.buildGlobalModuleCompactReadModel({
  moduleKey: "ECONOMIC", publicationDecision: decision("module:ECONOMIC"), insightCandidates: [candidate("two-phenomena", "ECONOMIC", 1)],
  kpis: [{ kpiId: "other", phenomenonId: "other", labelKey: "kpi", displayValue: "1", metricRef: "metric", evidenceRefs: [] }],
  quality, capabilities: [], detailEntries: [], publicationMeta, resourceMeta: resourceMeta(1),
}), /SECOND_PHENOMENON/);

const initial = query.buildGlobalInitialReadModel({ modules, capabilities: [{ capabilityId: "global", state: "PARTIAL", reasonCodes: ["PRODUCT_DATA_GATED"] }], resourceMeta: resourceMeta(9) });
check(() => assert.equal(query.globalInitialReadModelSchema.safeParse(initial).success, true));
check(() => assert.equal(initial.navigation.length, 10));
check(() => assert.equal("primaryInsight" in initial, false));
check(() => assert.equal("kpis" in initial, false));
check(() => assert.ok(Buffer.byteLength(JSON.stringify(initial), "utf8") <= query.GLOBAL_INITIAL_PAYLOAD_BUDGET_BYTES));
rejects(() => query.globalInitialReadModelSchema.parse({ ...initial, navigation: initial.navigation.slice(0, 9) }), /payload/);

check(() => assert.deepEqual(materialization.globalV2PrimaryQueryResources, ["analysis_global_manifest", "analysis_global_summary_ai", ...query.globalPrimaryModuleCatalog.map(({ resource }) => resource)]));
check(() => assert.equal(new Set(materialization.globalV2PrimaryQueryResources).size, 12));

console.log(`Global V2 primary ReadModels: ${checks}/${checks} PASS`);
console.log(`Primary module schemas: ${modules.length}/10 PASS`);
console.log(`Maximum compact payload: ${Math.max(...modules.map((module) => Buffer.byteLength(JSON.stringify(module), "utf8")))} bytes`);
console.log(`Persona payload projection: engine=${Buffer.byteLength(JSON.stringify(largeEvidencePersonaProfile), "utf8")} bytes; published=${Buffer.byteLength(JSON.stringify(personaExpanded), "utf8")} bytes`);
console.log(`Persona budgets: overview=${Buffer.byteLength(JSON.stringify(personaExpanded), "utf8")} bytes; detail-index-max=${Math.max(Buffer.byteLength(JSON.stringify(detailA), "utf8"), Buffer.byteLength(JSON.stringify(detailB), "utf8"))} bytes`);
