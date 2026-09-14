import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") || /\.[cm]?[jt]s$/.test(specifier)) throw error;
    for (const path of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try { return next(path, context); } catch { /* next */ }
    }
    throw error;
  }
} });

const {
  GlobalMaterialityEngine,
  buildGlobalActivityRhythm,
  buildGlobalTransformations,
  projectGlobalM1ActualTransformationSeries,
  projectGlobalM2CategoryTransformationSeries,
  projectGlobalM4ActivityFrequencyTransformationSeries,
  projectGlobalM4ActivityFrequencyTransformationUniverse,
  selectGlobalPersonRegimeAuthority,
  GLOBAL_PERSON_REGIME_ALLOWED_ACTIVITY_IDS,
} = await import("../src/analytics/global-v2/index.ts");
const { parseGlobalCoverageSet, parseGlobalSupport } = await import("../src/core/global-v2/index.ts");
const { parseActivityId, parseHouseholdId, parseLifeEventId, parsePersonId } = await import("../src/core/identity/index.ts");
const { parseLocalDate, parseYearMonth } = await import("../src/core/time/index.ts");

let assertions = 0;
const check = (fn) => { fn(); assertions += 1; };

const householdId = parseHouseholdId("0fffacfa-aafc-5a31-99f1-d75c17e5060b");
const personA = parsePersonId("1778a648-dfa9-5172-9474-1cb9bac32cc6");
const personB = parsePersonId("e44e806e-703c-5f29-bdd1-7861ebfd9bc3");
const activityId = parseActivityId("travail_site");
const months = [
  "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01",
  "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07",
].map(parseYearMonth);

const support = parseGlobalSupport({
  naturalGrain: "MONTH",
  eligibleUnits: 12,
  observedUnits: 12,
  includedUnits: 12,
  excludedObservedUnits: 0,
  minimumRequired: 6,
  supportStatus: "STRONG",
  policyRef: "test-month-support@v1",
});
const coverage = parseGlobalCoverageSet({
  dimensions: [{
    dimension: "FINANCIAL_SOURCE",
    status: "KNOWN",
    numerator: 1,
    denominator: 1,
    ratio: 1,
    unit: "natural-unit",
    basis: "test-authority",
    evidenceRefs: ["test:financial-authority"],
    policyRef: "test-financial-coverage@v1",
  }],
  requiredDimensions: ["FINANCIAL_SOURCE"],
  effective: 1,
  aggregation: "MIN_REQUIRED_DIMENSIONS",
});

function m1Point(month, value) {
  return {
    month,
    actual: {
      status: "KNOWN",
      value,
      unit: "EUR/month",
      support,
      coverage,
      materiality: { status: "UNKNOWN", reasonCode: "NOT_REQUIRED", policyRef: "test@v1" },
      provenance: {
        resultNature: "OBSERVED",
        precision: "EXACT",
        integrationMode: "DERIVED_FROM_OBSERVED",
        monetaryBasis: "AUTHORITATIVE_ECONOMIC",
        sourceRefs: [`metric:actual:${month}`],
        factRefs: [`fact:actual:${month}`],
        evidenceRefs: [`analysis-period:${month}`],
        entityRefs: [],
        upstreamMetricRefs: ["economic_consumption_net_attributable"],
        policyVersions: {},
        dataRevision: "2",
        analyticsRevision: "2",
      },
      methodVersion: "global_m1_owner@v2",
      inputHash: `m1:${month}`,
    },
    typicalState: {},
    minimalState: {},
    lineage: {
      asOf: "2026-08-01T00:00:00Z",
      certifiedThrough: "2026-07-31",
      sourceRevision: "2",
      analyticsRevision: "2",
      dependencyRefs: [`analysis-period:${month}`, `metric:actual:${month}`],
    },
  };
}

const m1History = months.map((month, index) => m1Point(month, String(1000 + index)));
const m1Authority = { targetMonth: months.at(-1), history: { points: m1History, inputHash: "m1-history" } };
const m1Series = projectGlobalM1ActualTransformationSeries({ householdId, authority: m1Authority });
check(() => assert.equal(m1Series.signalId, "m1:household:actual"));
check(() => assert.equal(m1Series.unit, "EUR/month"));
check(() => assert.deepEqual(m1Series.points.map(({ value }) => value), m1History.map(({ actual }) => actual.value)));
check(() => assert.deepEqual(
  projectGlobalM1ActualTransformationSeries({ householdId, authority: { ...m1Authority, history: { ...m1Authority.history, points: [...m1History].reverse() } } }),
  m1Series,
));
check(() => assert.equal(m1Series.points.every(({ status, complete, eligible }) => status === "KNOWN" && complete && eligible), true));
check(() => assert.equal(m1Series.points.every(({ dependencyRefs }) => dependencyRefs.some((ref) => ref.startsWith("analysis-period:"))), true));
check(() => assert.throws(() => projectGlobalM1ActualTransformationSeries({
  householdId,
  authority: {
    ...m1Authority,
    history: { points: [{ ...m1History[0], actual: { ...m1History[0].actual, provenance: { ...m1History[0].actual.provenance, sourceRefs: [], factRefs: [], evidenceRefs: [], upstreamMetricRefs: [] } }, lineage: { ...m1History[0].lineage, dependencyRefs: [] } }], inputHash: "unproven" },
  },
}), /aucune provenance/));

const categoryIds = ["cat-a", "cat-b", "cat-c", "cat-d", "cat-e", "cat-f"];
const monthlyCategoryValues = Object.fromEntries(categoryIds.map((id, index) => [id, index === 4 || index === 5 ? 6 : 10 - index]));
const monthlyComponents = months.flatMap((month) => categoryIds.map((categoryId) => ({
  month,
  canonicalComponentKey: `${month}:${categoryId}`,
  amount: String(monthlyCategoryValues[categoryId]),
  category: { status: "KNOWN", id: categoryId, evidenceRefs: [`category:${categoryId}`] },
  subcategory: { status: "UNKNOWN", evidenceRefs: [] },
  need: { status: "UNKNOWN", evidenceRefs: [] },
  necessity: { status: "UNKNOWN", evidenceRefs: [] },
  behavior: { status: "UNKNOWN", evidenceRefs: [] },
  lifeScope: { status: "UNKNOWN", evidenceRefs: [] },
  economicIdentityRefs: [`economic-component:${month}:${categoryId}`],
  evidenceRefs: [`fact:${month}:${categoryId}`],
})));
const monthlyTotal = String(Object.values(monthlyCategoryValues).reduce((sum, value) => sum + value, 0));
const m2Certifications = months.map((month) => m1Point(month, monthlyTotal));
const m2Groups = categoryIds.map((categoryId) => ({
  key: categoryId,
  dimension: { status: "KNOWN", id: categoryId, evidenceRefs: [`category:${categoryId}`] },
  annualAmount: String(monthlyCategoryValues[categoryId] * months.length),
  historicalSeries: months.map((month) => ({ month, amount: String(monthlyCategoryValues[categoryId]) })),
}));
const categoryCoverage = parseGlobalCoverageSet({
  dimensions: [{
    dimension: "CLASSIFICATION",
    status: "KNOWN",
    numerator: 6,
    denominator: 6,
    ratio: 1,
    unit: "canonical_economic_component",
    basis: "authoritative-dimension-resolution",
    evidenceRefs: ["test:category-axis"],
    policyRef: "global-category-need-coverage@v1",
  }],
  requiredDimensions: ["CLASSIFICATION"],
  effective: 1,
  aggregation: "MIN_REQUIRED_DIMENSIONS",
});
const m2Result = {
  targetMonth: months.at(-1),
  categories: { groups: m2Groups, support, coverage: categoryCoverage },
};
const m2Input = { householdId, result: m2Result, monthlyComponents, certifiedMonths: m2Certifications };
const m2Series = projectGlobalM2CategoryTransformationSeries(m2Input);
check(() => assert.deepEqual(m2Series.map(({ signalId }) => signalId), [
  "m2:category:cat-a", "m2:category:cat-b", "m2:category:cat-c", "m2:category:cat-d", "m2:category:cat-e",
]));
check(() => assert.equal(m2Series.length, 5));
check(() => assert.equal(m2Series.every(({ points }) => points.length === 12 && points.every(({ complete, eligible }) => complete && eligible)), true));
check(() => assert.deepEqual(projectGlobalM2CategoryTransformationSeries({
  ...m2Input,
  result: { ...m2Result, categories: { ...m2Result.categories, groups: [...m2Groups].reverse() } },
  monthlyComponents: [...monthlyComponents].reverse(),
  certifiedMonths: [...m2Certifications].reverse(),
}), m2Series));
check(() => assert.equal(m2Series.some(({ signalId }) => signalId === "m2:category:cat-f"), false));
check(() => assert.throws(() => projectGlobalM2CategoryTransformationSeries({
  ...m2Input,
  monthlyComponents: monthlyComponents.filter(({ month, category }) => !(month === months[0] && category.id === "cat-a")),
}), /ne réconcilie/));
check(() => assert.deepEqual(projectGlobalM2CategoryTransformationSeries({
  ...m2Input,
  result: { ...m2Result, categories: { ...m2Result.categories, coverage: { ...categoryCoverage, effective: 0.5 } } },
}), []));

function daysFor(personId, month, start = 1) {
  const [year, number] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from({ length: last - start + 1 }, (_, index) => {
    const day = String(start + index).padStart(2, "0");
    const localDate = parseLocalDate(`${month}-${day}`);
    return {
      fact: "fct_person_day",
      householdId,
      householdTimeZone: "Europe/Paris",
      personDayId: `${personId}:${localDate}`,
      personId,
      localDate,
      locationObservability: "observable",
    };
  });
}

let occurrenceSequence = 0;
function occurrence(personId, month, day, activity = activityId) {
  occurrenceSequence += 1;
  const date = parseLocalDate(`${month}-${String(day).padStart(2, "0")}`);
  return {
    fact: "fct_activity_occurrence",
    householdId,
    householdTimeZone: "Europe/Paris",
    lifeEventId: parseLifeEventId(`00000000-0000-4000-8000-${occurrenceSequence.toString(16).padStart(12, "0")}`),
    activityId: activity,
    lifeEventSeriesId: null,
    parentLifeEventId: null,
    startDate: date,
    endDate: date,
    validationStatus: "Confirmé",
    participantIds: [personId],
  };
}

const certified = (values) => values.map((month) => ({ month, dependencyRefs: [`analysis-period:${month}`] }));
const m4 = (overrides) => projectGlobalM4ActivityFrequencyTransformationSeries({
  personId: personA,
  activityId,
  certifiedThroughMonth: "2026-07",
  certifiedMonths: certified(["2026-07"].map(parseYearMonth)),
  occurrences: [],
  personDays: daysFor(personA, "2026-07"),
  ...overrides,
});

const zero = m4({});
check(() => assert.deepEqual(zero.points[0], {
  month: "2026-07",
  corpus: "CERTIFIED_HISTORY",
  status: "KNOWN",
  value: "0",
  eligible: true,
  complete: true,
  dependencyRefs: zero.points[0].dependencyRefs,
}));
check(() => assert.equal(zero.unit, "occurrence/month"));
const unknown = m4({ personDays: [] });
check(() => assert.equal(unknown.points[0].status, "UNKNOWN"));
check(() => assert.equal(Object.hasOwn(unknown.points[0], "value"), false));
const partialTen = m4({ personDays: daysFor(personA, "2026-07", 10) });
check(() => assert.equal(partialTen.points[0].status, "PARTIAL"));
check(() => assert.equal(partialTen.points[0].complete, false));
const partialFive = m4({ personDays: daysFor(personA, "2026-07", 5) });
check(() => assert.equal(partialFive.points[0].complete, false));

const febMarchMonths = ["2026-02", "2026-03"].map(parseYearMonth);
const equalCadenceOccurrences = [
  ...[1, 8, 15, 22].map((day) => occurrence(personA, "2026-02", day)),
  ...[1, 8, 15, 22].map((day) => occurrence(personA, "2026-03", day)),
];
const equalCadence = m4({
  certifiedThroughMonth: "2026-03",
  certifiedMonths: certified(febMarchMonths),
  occurrences: equalCadenceOccurrences,
  personDays: febMarchMonths.flatMap((month) => daysFor(personA, month)),
});
check(() => assert.deepEqual(equalCadence.points.map(({ value }) => value), ["4", "4"]));

const fullDays = months.flatMap((month) => daysFor(personA, month));
const fullOccurrences = months.flatMap((month) => [1, 5, 10, 15, 20].map((day) => occurrence(personA, month, day)));
const fullSeries = m4({
  certifiedMonths: certified(months),
  occurrences: fullOccurrences,
  personDays: fullDays,
});
const evaluate = (id, absolute, relative) => new GlobalMaterialityEngine().evaluate({
  policyId: "ACTIVITY_FREQUENCY",
  candidate: {
    ...fullSeries.evidence,
    candidateId: id,
    effect: { absolute, ...(relative === undefined ? {} : { relative }) },
  },
});
const fiveToSix = evaluate("5-to-6", "1", "0.2");
check(() => assert.equal(fiveToSix.gates.absolute, "PASS"));
check(() => assert.equal(fiveToSix.gates.relative, "PASS"));
check(() => assert.equal(fiveToSix.status, "MATERIAL"));
const twentyToTwentyOne = evaluate("20-to-21", "1", "0.05");
check(() => assert.equal(twentyToTwentyOne.gates.absolute, "PASS"));
check(() => assert.equal(twentyToTwentyOne.gates.relative, "FAIL"));
check(() => assert.equal(twentyToTwentyOne.status, "NOT_MATERIAL"));
const zeroBaseline = evaluate("0-to-3", "3");
check(() => assert.equal(zeroBaseline.gates.relative, "FAIL"));
check(() => assert.equal(zeroBaseline.status, "NOT_MATERIAL"));
const monthLengthOnly = evaluate("28-to-31", "3", String(3 / 28));
check(() => assert.equal(monthLengthOnly.gates.absolute, "PASS"));
check(() => assert.equal(monthLengthOnly.gates.relative, "FAIL"));
check(() => assert.equal(monthLengthOnly.status, "NOT_MATERIAL"));

const personASeries = m4({});
const personBSeries = m4({ personId: personB, personDays: daysFor(personB, "2026-07") });
check(() => assert.notEqual(personASeries.signalId, personBSeries.signalId));
check(() => assert.equal(personASeries.signalId, `m4:person:${personA}:activity:${activityId}:frequency`));
const orderOccurrences = [occurrence(personA, "2026-07", 2), occurrence(personA, "2026-07", 20)];
const orderedSeries = m4({ occurrences: orderOccurrences });
check(() => assert.deepEqual(m4({ occurrences: [...orderOccurrences].reverse(), personDays: [...daysFor(personA, "2026-07")].reverse() }), orderedSeries));

const productRhythm = buildGlobalActivityRhythm({
  activityId,
  personId: String(personA),
  occurrences: orderOccurrences,
  personDays: daysFor(personA, "2026-07"),
});
check(() => assert.equal(productRhythm.rate.unit, "OCCURRENCE_PER_OBSERVABLE_DAY"));
check(() => assert.equal(productRhythm.monthlyRates[0].value, "0.06451612903225806452"));

// D3-FIX-2: real BASE M3 assembly shape. Counts arise from the selectors and
// synthetic certified authority, never from padding inside production code.
const unconfirmedPattern = ["5", "5", "5", "5", "5", "6", "6", "6", "6", "6", "6", "6"];
const householdPattern = ["1000", "1000", "1000", "1000", "1000", "1060", "1060", "1060", "1060", "1060", "1060", "1060"];
const d3M1Series = projectGlobalM1ActualTransformationSeries({
  householdId,
  authority: {
    targetMonth: months.at(-1),
    history: { points: months.map((month, index) => m1Point(month, householdPattern[index])), inputHash: "d3-m1-history" },
  },
});
const patternActivities = [
  { personId: personB, activityId: parseActivityId("travail_site") },
  ...Array.from({ length: 13 }, (_, index) => ({ personId: index % 2 === 0 ? personA : personB, activityId: parseActivityId(`activity-pattern-${String(index).padStart(2, "0")}`) })),
];
const stableActivities = [
  { personId: personA, activityId: parseActivityId("travail_site") },
  { personId: personA, activityId: parseActivityId("teletravail") },
  ...Array.from({ length: 3 }, (_, index) => ({ personId: personA, activityId: parseActivityId(`activity-stable-${String(index).padStart(2, "0")}`) })),
];
const d3ActivityDefinitions = [...patternActivities, ...stableActivities];
const d3PersonDays = [personA, personB].flatMap((personId) => months.flatMap((month) => daysFor(personId, month)));
const d3Occurrences = d3ActivityDefinitions.flatMap(({ personId, activityId }, activityIndex) => months.flatMap((month, monthIndex) => {
  const monthlyCount = activityIndex < patternActivities.length ? Number(unconfirmedPattern[monthIndex]) : 5;
  return Array.from({ length: monthlyCount }, (_, index) => occurrence(personId, month, index + 1, activityId));
}));
const d3Rhythms = d3ActivityDefinitions.map(({ personId, activityId }) => buildGlobalActivityRhythm({
  personId: String(personId),
  activityId: String(activityId),
  occurrences: d3Occurrences,
  personDays: d3PersonDays,
}));
const d3M4Series = projectGlobalM4ActivityFrequencyTransformationUniverse({
  certifiedThroughMonth: months.at(-1),
  certifiedMonths: certified(months),
  occurrences: d3Occurrences,
  personDays: d3PersonDays,
  rhythms: [
    ...d3Rhythms,
    { personId: String(personA), activityId: "below-raw-minimum", rawOccurrenceCount: 11, rate: { status: "KNOWN" }, support: { supportStatus: "SUFFICIENT" } },
    { personId: String(personA), activityId: "partial-global-rate", rawOccurrenceCount: 12, rate: { status: "PARTIAL" }, support: { supportStatus: "SUFFICIENT" } },
  ],
});
check(() => assert.equal(d3M4Series.length, 19));
check(() => assert.equal(d3M4Series.every(({ unit, points }) => unit === "occurrence/month" && points.length === 12 && points.every(({ status }) => status === "KNOWN")), true));
check(() => assert.deepEqual(projectGlobalM4ActivityFrequencyTransformationUniverse({
  certifiedThroughMonth: months.at(-1),
  certifiedMonths: [...certified(months)].reverse(),
  occurrences: [...d3Occurrences].reverse(),
  personDays: [...d3PersonDays].reverse(),
  rhythms: [...d3Rhythms].reverse(),
}), d3M4Series));
check(() => assert.deepEqual(projectGlobalM4ActivityFrequencyTransformationUniverse({
  certifiedThroughMonth: months.at(-1),
  certifiedMonths: certified(months.slice(1)),
  occurrences: d3Occurrences,
  personDays: d3PersonDays,
  rhythms: d3Rhythms,
}), []));

const baseM3Series = [d3M1Series, ...m2Series, ...d3M4Series];
const baseM3 = buildGlobalTransformations({ series: baseM3Series, relations: [] });
const reversedBaseM3 = buildGlobalTransformations({ series: [...baseM3Series].reverse(), relations: [] });
const diagnostics = baseM3.diagnostics.flatMap(({ changes }) => changes.candidates);
check(() => assert.deepEqual({ M1: 1, M2: m2Series.length, M4: d3M4Series.length, total: baseM3Series.length }, { M1: 1, M2: 5, M4: 19, total: 25 }));
check(() => assert.equal(baseM3Series.reduce((total, series) => total + series.points.length, 0), 300));
check(() => assert.equal(baseM3.diagnostics.length, 25));
check(() => assert.equal(diagnostics.filter(({ internalStatus }) => internalStatus === "CANDIDATE").length, 30));
check(() => assert.equal(diagnostics.filter(({ internalStatus }) => internalStatus === "REJECTED").length, 45));
check(() => assert.equal(baseM3.transformations.length, 0));
check(() => assert.equal(baseM3.diagnostics.flatMap(({ changes }) => changes.candidates).some(({ status }) => status === "CONFIRMED_LEVEL_CHANGE"), false));
check(() => assert.equal(baseM3.diagnostics.flatMap(({ gradual }) => gradual).length, 0));
check(() => assert.equal(baseM3.diagnostics.flatMap(({ chapters }) => chapters.chapters).length, 0));
check(() => assert.equal(baseM3.inputHash, reversedBaseM3.inputHash));
check(() => assert.deepEqual(baseM3, reversedBaseM3));
check(() => assert.equal(Object.hasOwn(baseM3, "relationshipChanges"), false));
check(() => assert.equal(baseM3Series.every(({ catalogKey }) => !["WORK_CONTEXT_RATE", "RECURRENCE_LIFECYCLE", "MERCHANT_FREQUENCY", "MOMENT_PROJECT_PHASE"].includes(catalogKey)), true));
const d3M1Candidates = baseM3.diagnostics.find(({ signalId }) => signalId === "m1:household:actual").changes.candidates;
check(() => assert.equal(d3M1Candidates.find(({ boundaryMonth }) => boundaryMonth === "2026-02").materiality.status, "MATERIAL"));
check(() => assert.equal(d3M1Candidates.find(({ boundaryMonth }) => boundaryMonth === "2026-02").status, "UNCONFIRMED"));
check(() => assert.equal(d3M1Candidates.find(({ boundaryMonth }) => boundaryMonth === "2026-03").materiality.status, "MATERIAL"));
check(() => assert.equal(d3M1Candidates.find(({ boundaryMonth }) => boundaryMonth === "2026-03").status, "UNCONFIRMED"));
check(() => assert.equal(d3M1Candidates.find(({ boundaryMonth }) => boundaryMonth === "2026-04").materiality.status, "NOT_MATERIAL"));
check(() => assert.equal(baseM3.diagnostics.find(({ signalId }) => signalId === "m2:category:cat-a").changes.candidates.every(({ status }) => status !== "CONFIRMED_LEVEL_CHANGE"), true));
for (const signalId of [
  `m4:person:${personA}:activity:travail_site:frequency`,
  `m4:person:${personA}:activity:teletravail:frequency`,
]) {
  check(() => assert.equal(baseM3.diagnostics.find((diagnostic) => diagnostic.signalId === signalId).changes.candidates.some(({ materiality }) => materiality.status === "MATERIAL"), false));
}
const manonWorkMarch = baseM3.diagnostics
  .find(({ signalId }) => signalId === `m4:person:${personB}:activity:travail_site:frequency`)
  .changes.candidates.find(({ boundaryMonth }) => boundaryMonth === "2026-03");
check(() => assert.equal(manonWorkMarch.materiality.status, "MATERIAL"));
check(() => assert.equal(manonWorkMarch.reasonCodes.includes("PLATEAU_NOT_PROVEN"), true));

const positiveM3 = buildGlobalTransformations({
  series: [{ ...d3M4Series[0], points: d3M4Series[0].points.map((point, index) => ({ ...point, value: index < 6 ? "5" : "6" })) }],
  relations: [],
});
check(() => assert.equal(positiveM3.transformations.length, 1));

const adrienWorkSignalId = `m4:person:${personA}:activity:travail_site:frequency`;
const adrienWorkSeries = d3M4Series.find(({ signalId }) => signalId === adrienWorkSignalId);
assert.ok(adrienWorkSeries);
const structuralWorkSeries = {
  ...adrienWorkSeries,
  points: adrienWorkSeries.points.map((point, index) => ({ ...point, value: index < 6 ? "5" : "6" })),
  structuralAuthorityRefs: [`canonical-work-schedule:${personA}:travail_site`],
};
const structuralWorkM3 = buildGlobalTransformations({ series: [structuralWorkSeries], relations: [] });
const structuralWorkTransformation = structuralWorkM3.transformations[0];
assert.ok(structuralWorkTransformation);
const personRegimeInput = {
  personId: String(personA),
  certifiedThrough: "2026-07-31",
  transformations: structuralWorkM3.transformations,
  series: [structuralWorkSeries],
};
const knownPersonRegime = selectGlobalPersonRegimeAuthority(personRegimeInput);
check(() => assert.deepEqual(GLOBAL_PERSON_REGIME_ALLOWED_ACTIVITY_IDS, ["travail_site", "teletravail"]));
check(() => assert.equal(structuralWorkTransformation.kind, "DURABLE_CHANGE"));
check(() => assert.equal(structuralWorkTransformation.status, "CONFIRMED_ONGOING"));
check(() => assert.equal(knownPersonRegime.status, "KNOWN"));
check(() => assert.equal(knownPersonRegime.capabilityState, "AVAILABLE"));
check(() => assert.equal(knownPersonRegime.validFrom, "2026-02"));
check(() => assert.equal(knownPersonRegime.validThrough, "2026-07-31"));
check(() => assert.equal(knownPersonRegime.sourceActivityId, "travail_site"));
const adrienRemoteSignalId = `m4:person:${personA}:activity:teletravail:frequency`;
const adrienRemoteSeries = d3M4Series.find(({ signalId }) => signalId === adrienRemoteSignalId);
assert.ok(adrienRemoteSeries);
const fusedWorkTransformation = {
  ...structuralWorkTransformation,
  supportingSignals: [`${adrienRemoteSignalId}@2026-02`],
};
const fusedWorkInput = {
  ...personRegimeInput,
  transformations: [fusedWorkTransformation],
  series: [structuralWorkSeries, adrienRemoteSeries],
};
const fusedWorkRegime = selectGlobalPersonRegimeAuthority(fusedWorkInput);
check(() => assert.equal(fusedWorkRegime.status, "KNOWN"));
check(() => assert.equal(fusedWorkRegime.capabilityState, "AVAILABLE"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({
  ...fusedWorkInput,
  transformations: [{
    ...fusedWorkTransformation,
    primaryDriver: `${adrienRemoteSignalId}@2026-02`,
    supportingSignals: [structuralWorkTransformation.primaryDriver],
  }],
}).status, "KNOWN"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({
  ...fusedWorkInput,
  transformations: [{ ...fusedWorkTransformation, supportingSignals: [`m4:person:${personA}:activity:repas_restaurant:frequency@2026-02`] }],
}).status, "UNKNOWN"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({
  ...fusedWorkInput,
  transformations: [{ ...fusedWorkTransformation, supportingSignals: [`m4:person:${personA}:activity:activite_loisir:frequency@2026-02`] }],
}).status, "UNKNOWN"));
const crossPersonRemoteSeries = {
  ...adrienRemoteSeries,
  signalId: `m4:person:${personB}:activity:teletravail:frequency`,
  subjectRef: `person:${personB}`,
};
check(() => assert.equal(selectGlobalPersonRegimeAuthority({
  ...fusedWorkInput,
  transformations: [{ ...fusedWorkTransformation, supportingSignals: [`${crossPersonRemoteSeries.signalId}@2026-02`] }],
  series: [structuralWorkSeries, crossPersonRemoteSeries],
}).status, "UNKNOWN"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({
  ...fusedWorkInput,
  series: [
    { ...structuralWorkSeries, structuralAuthorityRefs: [] },
    { ...adrienRemoteSeries, structuralAuthorityRefs: [] },
  ],
}).status, "UNKNOWN"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({
  ...fusedWorkInput,
  series: [
    { ...structuralWorkSeries, structuralAuthorityRefs: ["fct_activity_occurrence:onsite-only"] },
    { ...adrienRemoteSeries, structuralAuthorityRefs: ["fct_activity_occurrence:remote-only"] },
  ],
}).status, "UNKNOWN"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({
  ...fusedWorkInput,
  series: [structuralWorkSeries],
}).status, "UNKNOWN"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({
  ...fusedWorkInput,
  series: [structuralWorkSeries, adrienRemoteSeries, { ...adrienRemoteSeries }],
}).status, "UNKNOWN"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({
  ...fusedWorkInput,
  series: [structuralWorkSeries, { ...adrienRemoteSeries, certifiedThroughMonth: "2026-06" }],
}).status, "UNKNOWN"));
check(() => assert.deepEqual(selectGlobalPersonRegimeAuthority({ ...personRegimeInput, transformations: [] }), {
  status: "UNKNOWN", capabilityState: "GATED", reasonCodes: ["AUTHORITY_GATED_CURRENT_REGIME"], personId: String(personA),
}));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({
  ...personRegimeInput,
  transformations: [{ ...structuralWorkTransformation, status: "CANDIDATE" }],
}).status, "UNKNOWN"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({
  ...personRegimeInput,
  transformations: [{ ...structuralWorkTransformation, status: "CONFIRMED_CLOSED" }],
}).status, "UNKNOWN"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({
  ...personRegimeInput,
  transformations: [{ ...structuralWorkTransformation, currentRegime: { ...structuralWorkTransformation.currentRegime, includedMonths: structuralWorkTransformation.currentRegime.includedMonths.slice(0, 5) } }],
}).status, "UNKNOWN"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({ ...personRegimeInput, series: [{ ...structuralWorkSeries, structuralAuthorityRefs: [] }] }).status, "UNKNOWN"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({ ...personRegimeInput, series: [{ ...structuralWorkSeries, structuralAuthorityRefs: ["fct_activity_occurrence:not-structural"] }] }).status, "UNKNOWN"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({ ...personRegimeInput, series: [{ ...structuralWorkSeries, subjectRef: `household:${householdId}` }] }).status, "UNKNOWN"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({ ...personRegimeInput, personId: String(personB) }).status, "UNKNOWN"));
const changeActivity = (activityId) => ({
  transformation: {
    ...structuralWorkTransformation,
    primaryDriver: structuralWorkTransformation.primaryDriver.replace("activity:travail_site", `activity:${activityId}`),
  },
  series: {
    ...structuralWorkSeries,
    signalId: structuralWorkSeries.signalId.replace("activity:travail_site", `activity:${activityId}`),
  },
});
const restaurantRegime = changeActivity("repas_restaurant");
check(() => assert.equal(selectGlobalPersonRegimeAuthority({ ...personRegimeInput, transformations: [restaurantRegime.transformation], series: [restaurantRegime.series] }).status, "UNKNOWN"));
const leisureRegime = changeActivity("activite_loisir");
check(() => assert.equal(selectGlobalPersonRegimeAuthority({ ...personRegimeInput, transformations: [leisureRegime.transformation], series: [leisureRegime.series] }).status, "UNKNOWN"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({
  ...personRegimeInput,
  transformations: [structuralWorkTransformation, { ...structuralWorkTransformation, transformationId: `${structuralWorkTransformation.transformationId}:concurrent` }],
}).status, "CONFLICT"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({ ...personRegimeInput, certifiedThrough: "2026-08-31" }).status, "UNKNOWN"));
const enrichedStructuralWorkM3 = buildGlobalTransformations({
  series: [structuralWorkSeries],
  relations: [],
  relationshipEvolution: [{
    catalogKey: "M5_RELATIONSHIP_EVOLUTION",
    relationshipId: "weekend-restaurant",
    state: "CHANGED_RELATIONSHIP",
    personId: String(personA),
    householdId: String(householdId),
    regimeId: "synthetic-regime",
    certifiedThrough: "2026-07-31",
    previousMonths: months.slice(0, 6),
    recentMonths: months.slice(6),
    previousDirection: -1,
    recentDirection: 1,
    sourceInputHash: "a".repeat(64),
    causalityMode: "ASSOCIATION_ONLY",
    methodVersion: "global_m5_m3_evolution@v1",
  }],
});
check(() => assert.deepEqual(enrichedStructuralWorkM3.transformations, structuralWorkM3.transformations));
check(() => assert.deepEqual(selectGlobalPersonRegimeAuthority({ ...personRegimeInput, transformations: enrichedStructuralWorkM3.transformations }), knownPersonRegime));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({ personId: String(personA), certifiedThrough: "2026-07-31", transformations: baseM3.transformations, series: baseM3Series }).status, "UNKNOWN"));
check(() => assert.equal(selectGlobalPersonRegimeAuthority({ personId: String(personB), certifiedThrough: "2026-07-31", transformations: baseM3.transformations, series: baseM3Series }).status, "UNKNOWN"));

console.log(`Global V2 transformation projectors: ${assertions}/${assertions} PASS`);
