import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) {
        throw originalError;
      }
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const history = await import("../src/core/history-v2/index.ts");
const visibilityPolicy = await import("../src/analytics/history-v2/visibility-policy.ts");
const factsHashPolicy = await import("../src/analytics/history-v2/facts-hash.ts");
const metricsV1 = await import("../src/core/metrics/index.ts");
const api = await import("../src/core/api/index.ts");
const validation = await import("../src/core/validation/index.ts");
const resourceContracts = await import("../src/query-api/request/resource-contract.ts");
const resources = await import("../src/query-api/request/resource-registry.ts");

let checks = 0;
function check(fn) {
  fn();
  checks += 1;
}
function rejects(fn, pattern) {
  let thrown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof Error, "une erreur de validation était attendue");
  assert.match(
    `${thrown.message}\n${JSON.stringify(thrown.issues ?? [])}`,
    pattern,
  );
  checks += 1;
}

const numberSchema = validation.createRuntimeSchema((value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("number attendu");
  }
  return value;
});
const stringSchema = validation.createRuntimeSchema((value) => {
  if (typeof value !== "string") throw new TypeError("string attendu");
  return value;
});
const metricSchema = history.createMetricValueSchema(numberSchema);
const collectionSchema = history.createCollectionValueSchema(stringSchema);

check(() => assert.deepEqual(
  ["KNOWN", "PARTIAL", "UNKNOWN", "NOT_APPLICABLE", "CONFLICT"]
    .map(history.parseDataStatus),
  ["KNOWN", "PARTIAL", "UNKNOWN", "NOT_APPLICABLE", "CONFLICT"],
));
check(() => assert.deepEqual(metricSchema.parse({ status: "KNOWN", value: 0 }), {
  status: "KNOWN", value: 0,
}));
check(() => assert.deepEqual(metricSchema.parse({
  status: "PARTIAL", value: 12, partialMeaning: "LOWER_BOUND",
}), { status: "PARTIAL", value: 12, partialMeaning: "LOWER_BOUND" }));
check(() => assert.deepEqual(metricSchema.parse({
  status: "PARTIAL", value: 12, partialMeaning: "OBSERVED_ONLY",
}), { status: "PARTIAL", value: 12, partialMeaning: "OBSERVED_ONLY" }));
rejects(() => metricSchema.parse({ status: "PARTIAL", value: 12 }), /partialMeaning/);
rejects(() => metricSchema.parse({ status: "UNKNOWN", value: 0 }), /ne porte ni value/);
check(() => assert.deepEqual(metricSchema.parse({ status: "UNKNOWN" }), {
  status: "UNKNOWN",
}));

check(() => assert.deepEqual(collectionSchema.parse({
  status: "KNOWN", items: [], totalCount: 0,
}), { status: "KNOWN", items: [], totalCount: 0 }));
check(() => assert.deepEqual(collectionSchema.parse({
  status: "PARTIAL", items: ["a"], partialMeaning: "OBSERVED_ONLY", knownCount: 1,
}), {
  status: "PARTIAL", items: ["a"], partialMeaning: "OBSERVED_ONLY", knownCount: 1,
}));
rejects(() => collectionSchema.parse({
  status: "PARTIAL", items: ["a"], partialMeaning: "LOWER_BOUND", knownCount: 1,
}), /OBSERVED_ONLY/);
rejects(() => collectionSchema.parse({
  status: "PARTIAL", items: ["a"], partialMeaning: "OBSERVED_ONLY",
  knownCount: 1, totalCount: 2,
}), /totalCount/);
rejects(() => collectionSchema.parse({ status: "UNKNOWN", items: [] }), /ne porte ni items/);

check(() => assert.deepEqual(history.parseCoverage({
  ratio: 0.5, numerator: 1, denominator: 2, unit: "component", basis: "classified",
  level: "medium",
}), {
  basis: "classified", ratio: 0.5, numerator: 1, denominator: 2,
  unit: "component", level: "medium",
}));
rejects(() => history.parseCoverage({ ratio: 1.1, basis: "bad" }), /0 et 1/);
check(() => assert.deepEqual(history.parseQualityEnvelope({
  coverage: { ratio: 0.5, basis: "observed" },
  support: { n: 8, level: "limited", basis: "closed months" },
  provenance: { kind: "DERIVED", methodId: "typical", methodVersion: "v1" },
  reasonCode: "REFERENCE_LIMITED_SUPPORT",
}), {
  coverage: { ratio: 0.5, basis: "observed" },
  support: { n: 8, level: "limited", basis: "closed months" },
  provenance: { kind: "DERIVED", methodId: "typical", methodVersion: "v1" },
  reasonCode: "REFERENCE_LIMITED_SUPPORT",
}));
rejects(() => history.parseHistoryV2ReasonCode("custom_reason"), /HistoryV2ReasonCode/);

const displaySchema = history.createDisplayNodeSchema(metricSchema);
check(() => assert.equal(visibilityPolicy.resolveHistoryV2DisplayNode({
  role: "CORE", result: { status: "UNKNOWN" },
}).visibility, "PLACEHOLDER"));
check(() => assert.equal(visibilityPolicy.resolveHistoryV2DisplayNode({
  role: "CONDITIONAL", result: { status: "KNOWN", items: [], totalCount: 0 },
}).visibility, "HIDDEN"));
check(() => assert.equal(visibilityPolicy.resolveHistoryV2DisplayNode({
  role: "DETAIL", result: { status: "NOT_APPLICABLE" },
}).visibility, "HIDDEN"));
check(() => assert.equal(visibilityPolicy.resolveHistoryV2DisplayNode({
  role: "CORE",
  result: { status: "PARTIAL", value: 1, partialMeaning: "LOWER_BOUND" },
}).visibility, "PLACEHOLDER"));
check(() => assert.equal(visibilityPolicy.resolveHistoryV2DisplayNode({
  role: "CORE", partialPresentation: "VISIBLE",
  result: { status: "PARTIAL", value: 1, partialMeaning: "LOWER_BOUND" },
}).visibility, "VISIBLE"));
check(() => assert.equal(visibilityPolicy.resolveHistoryV2DisplayNode({
  role: "CORE", eligibility: "FEATURE_DEFERRED", result: { status: "UNKNOWN" },
}).visibility, "HIDDEN"));
rejects(() => displaySchema.parse({ visibility: "PLACEHOLDER" }), /reasonCode/);
rejects(() => displaySchema.parse({
  visibility: "HIDDEN", data: { status: "KNOWN", value: 1 },
}), /ne peut pas porter data/);

const publicationScope = {
  householdId: "00000000-0000-4000-8000-000000000001",
  month: "2026-05",
};
const operationFacts = [
  { factType: "operation", identity: "b", value: { amount: 2, label: "B" } },
  { factType: "operation", identity: "a", value: { label: "A", amount: 1 } },
];
const placeFacts = [
  { factType: "place", identity: "place:1", value: { label: "Paris", visits: 2 } },
];
const publicationClosure = [
  { closureId: "shared:daily-ledger", facts: operationFacts },
  { closureId: "resource:history_place_detail:place:1", facts: placeFacts },
];
const hashA = factsHashPolicy.computeHistoryV2PublicationFactsHash({
  ...publicationScope,
  closures: publicationClosure,
});
const hashB = factsHashPolicy.computeHistoryV2PublicationFactsHash({
  ...publicationScope,
  closures: [
    { closureId: "different-grouping", facts: [...placeFacts, ...operationFacts].reverse() },
  ],
});
check(() => assert.equal(hashA, hashB, "D: fact, closure and object-key order must be neutral"));

const publicationForCalendar = {
  publicationId: "history:2026-05:1",
  revision: 1,
  contractVersion: "v2",
  factsHash: hashA,
  policyVersions: { quality_visibility: "v1", facts_hash: "v1", calendar_semantics: "v1" },
  generatedAt: "2026-08-30T12:00:00.000Z",
};
const publicationForPlaceDetail = {
  ...publicationForCalendar,
  policyVersions: { quality_visibility: "v1", facts_hash: "v1", place_significance: "v1" },
};
check(() => assert.equal(
  publicationForCalendar.factsHash,
  publicationForPlaceDetail.factsHash,
  "A: two resource subsets in one publication must expose one common factsHash",
));

const changedPlaceHash = factsHashPolicy.computeHistoryV2PublicationFactsHash({
  ...publicationScope,
  closures: [
    publicationClosure[0],
    { closureId: "resource:history_place_detail:place:1", facts: [
      { factType: "place", identity: "place:1", value: { label: "Paris", visits: 3 } },
    ] },
  ],
});
check(() => {
  assert.notEqual(hashA, changedPlaceHash, "B: a place-detail-only fact must change the publication closure");
  const changedCalendarPublication = { ...publicationForCalendar, factsHash: changedPlaceHash };
  const changedPlacePublication = { ...publicationForPlaceDetail, factsHash: changedPlaceHash };
  assert.equal(
    changedCalendarPublication.factsHash,
    changedPlacePublication.factsHash,
    "B: the new common hash must be assigned to every resource",
  );
});

const policyV1Publication = publicationForPlaceDetail;
const policyV2Publication = {
  ...publicationForPlaceDetail,
  policyVersions: { ...publicationForPlaceDetail.policyVersions, life_money_selection: "v2" },
};
check(() => assert.equal(
  policyV1Publication.factsHash,
  policyV2Publication.factsHash,
  "C: policy versions do not participate in factsHash",
));

const dependencyHashA = factsHashPolicy.computePublicationFactsHash({
  ...publicationScope,
  facts: operationFacts,
  dependencies: [
    { dependencyId: "typical:2026-03", dependencyHash: "1".repeat(64) },
    { dependencyId: "typical:2026-04", dependencyHash: "2".repeat(64) },
  ],
});
const dependencyHashB = factsHashPolicy.computePublicationFactsHash({
  ...publicationScope,
  facts: [...operationFacts].reverse(),
  dependencies: [
    { dependencyId: "typical:2026-04", dependencyHash: "2".repeat(64) },
    { dependencyId: "typical:2026-03", dependencyHash: "1".repeat(64) },
  ],
});
check(() => assert.equal(dependencyHashA, dependencyHashB, "D: dependency order must be neutral"));
check(() => assert.notEqual(hashA, factsHashPolicy.computeHistoryV2PublicationFactsHash({
  ...publicationScope,
  closures: [{ closureId: "changed", facts: [
    { factType: "operation", identity: "a", value: { amount: 3 } },
  ] }],
})), "semantic fact changes must change factsHash");
check(() => assert.notEqual(hashA, factsHashPolicy.computeHistoryV2PublicationFactsHash({
  ...publicationScope,
  closures: [{ closureId: "external-dependency", facts: publicationClosure.flatMap(({ facts }) => facts), dependencies: [
    { dependencyId: "rates", dependencyHash: "1".repeat(64) },
  ] }],
})), "external historical dependency digests must affect factsHash");
rejects(() => factsHashPolicy.computePublicationFactsHash({
  ...publicationScope,
  facts: [{ factType: "operation", identity: "a", value: { generatedAt: "now" } }],
}), /metadata volatile generatedAt/);

const resourceInputHashA = factsHashPolicy.computeResourceInputHash({
  identity: "history_month_calendar",
  facts: operationFacts,
});
const resourceInputHashB = factsHashPolicy.computeResourceInputHash({
  identity: "history_place_detail:place:1",
  facts: placeFacts,
});
check(() => {
  assert.notEqual(resourceInputHashA, resourceInputHashB);
  assert.equal(publicationForCalendar.factsHash, publicationForPlaceDetail.factsHash,
    "F: resourceInputHash may differ while publication factsHash remains common");
});

const publicationMetadataVariant = {
  ...publicationForCalendar,
  publicationId: "history:2026-05:99",
  revision: 99,
  generatedAt: "2027-01-01T00:00:00.000Z",
};
check(() => assert.equal(
  publicationForCalendar.factsHash,
  publicationMetadataVariant.factsHash,
  "E: generatedAt, publicationId and revision do not affect factsHash",
));

const publication = history.publicationMetaSchema.parse({
  publicationId: "history:2026-05:1",
  revision: 1,
  contractVersion: "v2",
  factsHash: hashA,
  policyVersions: { quality_visibility: "v1", facts_hash: "v1" },
  generatedAt: "2026-08-30T12:00:00.000Z",
});
check(() => assert.equal(publication.contractVersion, "v2"));
rejects(() => history.publicationMetaSchema.parse({
  ...publication, contractVersion: "v1",
}), /contractVersion v2/);
rejects(() => history.publicationMetaSchema.parse({
  ...publication, policyVersions: { quality_visibility: "v1" },
}), /quality_visibility et facts_hash/);
check(() => assert.deepEqual(history.publicationFreshness({
  current: publication,
  source: {
    sourcePublicationId: publication.publicationId,
    sourceRevision: publication.revision,
    sourceContractVersion: publication.contractVersion,
    sourceFactsHash: publication.factsHash,
    sourcePolicyVersions: publication.policyVersions,
  },
}), { status: "CURRENT" }));
check(() => assert.deepEqual(history.publicationFreshness({
  current: publication,
  source: {
    sourcePublicationId: "other",
    sourceRevision: 2,
    sourceContractVersion: publication.contractVersion,
    sourceFactsHash: "2".repeat(64),
    sourcePolicyVersions: { quality_visibility: "v2", facts_hash: "v1" },
  },
}), {
  status: "STALE",
  reasonCodes: [
    "PUBLICATION_STALE",
    "PUBLICATION_FACTS_MISMATCH",
    "PUBLICATION_POLICY_MISMATCH",
  ],
}));

const v1Meta = {
  dataRevision: "1", analyticsRevision: "1", contractVersion: "v1",
  computedAt: "2026-08-30T12:00:00Z",
};
check(() => assert.deepEqual(api.apiMetaSchema.parse(v1Meta), v1Meta));
rejects(() => api.apiMetaSchema.parse({ ...v1Meta, contractVersion: "v2" }), /PublicationMeta/);
rejects(() => api.apiMetaSchema.parse({ ...v1Meta, publication }), /v1 ne peut pas/);
check(() => assert.equal(api.apiMetaSchema.parse({
  ...v1Meta, contractVersion: "v2", publication,
}).publication.factsHash, hashA));

check(() => assert.equal(metricsV1.parseMoneyMetricEnvelope({
  availability: "known", value: "0", unit: "EUR", provenance: "observed",
}).availability, "known"));
rejects(() => metricsV1.parseMoneyMetricEnvelope({
  availability: "partial", value: "1", unit: "EUR", provenance: "observed",
}), /Availability/);

check(() => {
  const historyV2Resources = resources.registeredQueryResourceKeys.filter((resource) =>
    resourceContracts.getQueryResourceContract(resource).contractVersion === "v2");
  assert.deepEqual(historyV2Resources, [
    "history_month_calendar",
    "history_week",
    "history_day_journal",
    "history_month_overview",
    "history_month_balance_summary",
    "history_bank_economy_bridge",
    "history_month_categories",
    "history_category_detail",
    "history_month_spending_nature",
    "history_spending_segment_detail",
    "history_minimal_preview",
    "history_month_life_money",
    "history_activity_detail",
    "history_moment_detail",
    "history_place_detail",
  ]);
  assert.equal(
    resources.registeredQueryResourceKeys
      .filter((resource) => !historyV2Resources.includes(resource))
      .every((resource) => resourceContracts.getQueryResourceContract(resource).contractVersion === "v1"),
    true,
  );
});
const futureV2 = resourceContracts.defineHistoryV2ResourceContract({
  policyIds: ["facts_hash", "quality_visibility", "calendar_semantics"],
  metricIds: ["economic_consumption_net_attributable"],
});
check(() => assert.deepEqual(futureV2, {
  contractVersion: "v2",
  family: "history_v2",
  policyIds: ["calendar_semantics", "facts_hash", "quality_visibility"],
  metricIds: ["economic_consumption_net_attributable"],
}));
rejects(() => resourceContracts.defineHistoryV2ResourceContract({
  policyIds: ["quality_visibility"],
}), /quality_visibility et facts_hash/);

console.log(`History V2 transversal contracts: PASS (${checks} checks)`);
