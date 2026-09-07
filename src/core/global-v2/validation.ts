import {
  parsePersonId,
  type PersonId,
} from "../identity";
import {
  parseDataStatus,
  parsePartialMeaning,
  type DataStatus,
} from "../history-v2";
import {
  normalizeAnalysisFilters,
  parseAnalysisFilters,
  parseAnalysisSubject,
} from "../scope";
import {
  instantToLocalDate,
  parseHouseholdTimeZone,
  parseInstant,
  parseLocalDate,
  type HouseholdTimeZone,
} from "../time";
import {
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  type UnknownRecord,
} from "../validation";
import {
  parseAnalyticsRevision,
  parseDataRevision,
  parseMethodVersion,
  parsePolicyVersion,
} from "../versions";
import type {
  CapabilityRequirement,
  CorpusAuthority,
  CorpusSlice,
  DependencyRef,
  GlobalAnalysisScopeV2,
  GlobalCapability,
  GlobalCoverageDimension,
  GlobalCoverageMeasure,
  GlobalCoverageSet,
  GlobalDependencyConsumption,
  GlobalDependencyDeclaration,
  GlobalEngineIdentity,
  GlobalEntityScopePolicy,
  GlobalInvalidationScope,
  GlobalKnowledgeValue,
  GlobalMaterialityCandidate,
  GlobalNaturalGrain,
  GlobalPartialReason,
  GlobalPersonScopeKind,
  GlobalPersonScopePolicy,
  GlobalResolvedNaturalWindow,
  GlobalSupport,
  GlobalSupportStatus,
  GlobalTimeWindowPolicy,
  GlobalValueProvenance,
  HistoricalLookback,
  NormalizedGlobalAnalysisScopeV2,
  PolicyRef,
  PublicationOutputRef,
} from "./types";

const naturalGrains = new Set<GlobalNaturalGrain>([
  "MONTH",
  "WEEK",
  "DAY",
  "PERSON_DAY",
  "ECONOMIC_COMPONENT",
  "OCCURRENCE",
  "VISIT",
  "MOMENT",
  "PURCHASE_EVENT",
]);
const supportStatuses = new Set<GlobalSupportStatus>([
  "INSUFFICIENT",
  "PARTIAL_SUPPORT",
  "SUFFICIENT",
  "STRONG",
]);
const partialReasons = new Set<GlobalPartialReason>([
  "OBSERVED_SUBSET",
  "LOWER_BOUND",
  "MISSING_INTERVALS",
  "MISSING_LINKAGE",
  "PARTIAL_SOURCE",
]);
const coverageDimensions = new Set<GlobalCoverageDimension>([
  "FINANCIAL_SOURCE",
  "CLASSIFICATION",
  "NEED",
  "PERSON_ATTRIBUTION",
  "PERSON_DAY",
  "PLACE",
  "PARTICIPANT",
  "PURCHASE_EVENT",
  "PRODUCT",
  "MOMENT_METADATA",
  "MOMENT_PARTICIPANT",
  "MOMENT_FINANCIAL",
  "COMPARABLE_PERSON_SUPPORT",
]);

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
    throw new TypeError(`${field} doit être une chaîne non vide canonique.`);
  }
  return value;
}

function machineRef(value: unknown, field: string): string {
  const parsed = nonEmptyString(value, field);
  if (/\s/u.test(parsed)) throw new TypeError(`${field} doit être une identité machine stable sans espace.`);
  return parsed;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} doit être un entier positif ou nul.`);
  }
  return value;
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = nonNegativeInteger(value, field);
  if (parsed === 0) throw new TypeError(`${field} doit être strictement positif.`);
  return parsed;
}

function finiteRatio(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError(`${field} doit être compris entre 0 et 1.`);
  }
  return value;
}

function optional<Value>(
  record: UnknownRecord,
  key: string,
  parse: (value: unknown) => Value,
): Value | undefined {
  return hasOwn(record, key) ? parse(record[key]) : undefined;
}

function sortedUnique<Value extends string>(
  value: unknown,
  parse: (value: unknown) => Value,
  field: string,
  requireNonEmpty = false,
): readonly Value[] {
  if (!Array.isArray(value)) throw new TypeError(`${field} doit être un tableau.`);
  const parsed = value.map((entry, index) => parseWithField(entry, parse, `${field}[${index}]`));
  if (new Set(parsed).size !== parsed.length) {
    throw new TypeError(`${field} contient un doublon.`);
  }
  if (requireNonEmpty && parsed.length === 0) {
    throw new TypeError(`${field} doit être non vide.`);
  }
  return [...parsed].sort();
}

function parseWithField<Value>(
  value: unknown,
  parse: (value: unknown) => Value,
  field: string,
): Value {
  try {
    return parse(value);
  } catch (error) {
    throw new TypeError(`${field} est invalide.`, { cause: error });
  }
}

function parsePolicyVersionRecord(value: unknown): Readonly<Record<string, ReturnType<typeof parsePolicyVersion>>> {
  const record = parseStrictRecord(
    value,
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? Object.keys(value)
      : [],
    "GlobalPolicyVersions",
  );
  const entries = Object.keys(record).sort().map((key) => [
    nonEmptyString(key, "GlobalPolicyVersions key"),
    parsePolicyVersion(record[key]),
  ] as const);
  return Object.freeze(Object.fromEntries(entries));
}

export type GlobalScopeValidationContext = {
  readonly householdTimeZone: HouseholdTimeZone;
  readonly authorizedPersonIds: readonly PersonId[];
};

export function parseGlobalAnalysisScopeV2(
  value: unknown,
  context: GlobalScopeValidationContext,
): NormalizedGlobalAnalysisScopeV2 {
  const householdTimeZone = parseHouseholdTimeZone(context.householdTimeZone);
  const authorizedPersonIds = new Set(context.authorizedPersonIds.map(parsePersonId));
  const record = parseStrictRecord(value, ["subject", "time", "filters"], "GlobalAnalysisScopeV2");
  const subject = parseAnalysisSubject(requireProperty(record, "subject", "GlobalAnalysisScopeV2"));
  if (subject.kind === "person" && !authorizedPersonIds.has(subject.personId)) {
    throw new TypeError("GlobalAnalysisScopeV2.personId n'appartient pas au Household autorisé.");
  }
  const timeRecord = parseStrictRecord(
    requireProperty(record, "time", "GlobalAnalysisScopeV2"),
    ["kind", "asOf", "certifiedThrough", "liveThrough"],
    "GlobalAnalysisTimeV2",
  );
  const kind = parseStringLiteral<"global_v2">(
    requireProperty(timeRecord, "kind", "GlobalAnalysisTimeV2"),
    new Set(["global_v2"]),
    "GlobalAnalysisTimeV2.kind",
  );
  const asOf = parseInstant(requireProperty(timeRecord, "asOf", "GlobalAnalysisTimeV2"));
  const certifiedThrough = parseLocalDate(
    requireProperty(timeRecord, "certifiedThrough", "GlobalAnalysisTimeV2"),
  );
  const liveThrough = optional(timeRecord, "liveThrough", parseLocalDate);
  const asOfLocalDate = instantToLocalDate(asOf, householdTimeZone);
  if (certifiedThrough > asOfLocalDate) {
    throw new TypeError("certifiedThrough ne peut pas être postérieur à la date Household de asOf.");
  }
  if (liveThrough !== undefined && (liveThrough <= certifiedThrough || liveThrough > asOfLocalDate)) {
    throw new TypeError("liveThrough doit être après certifiedThrough et au plus à la date Household de asOf.");
  }
  const filters = hasOwn(record, "filters")
    ? normalizeAnalysisFilters(parseAnalysisFilters(record.filters))
    : normalizeAnalysisFilters();
  return {
    subject,
    time: {
      kind,
      asOf,
      certifiedThrough,
      ...(liveThrough === undefined ? {} : { liveThrough }),
    },
    filters,
  };
}

export function parseHistoricalLookback(value: unknown): HistoricalLookback {
  const candidate = parseStrictRecord(value, ["kind", "count", "start", "end", "unit"], "HistoricalLookback");
  const kind = parseStringLiteral<HistoricalLookback["kind"]>(
    requireProperty(candidate, "kind", "HistoricalLookback"),
    new Set(["ALL_RELIABLE", "LAST_ELIGIBLE_UNITS", "DECLARED_RANGE", "COMPARABLE_INTERSECTION"]),
    "HistoricalLookback.kind",
  );
  if (kind === "ALL_RELIABLE") {
    parseStrictRecord(value, ["kind"], "HistoricalLookback");
    return { kind };
  }
  if (kind === "LAST_ELIGIBLE_UNITS") {
    const record = parseStrictRecord(value, ["kind", "count"], "HistoricalLookback");
    return { kind, count: positiveInteger(requireProperty(record, "count", "HistoricalLookback"), "HistoricalLookback.count") };
  }
  if (kind === "DECLARED_RANGE") {
    const record = parseStrictRecord(value, ["kind", "start", "end"], "HistoricalLookback");
    const start = parseLocalDate(requireProperty(record, "start", "HistoricalLookback"));
    const end = parseLocalDate(requireProperty(record, "end", "HistoricalLookback"));
    if (start > end) throw new TypeError("HistoricalLookback.start doit précéder end.");
    return { kind, start, end };
  }
  const record = parseStrictRecord(value, ["kind", "unit"], "HistoricalLookback");
  return {
    kind,
    unit: parseStringLiteral(
      requireProperty(record, "unit", "HistoricalLookback"),
      naturalGrains,
      "HistoricalLookback.unit",
    ),
  };
}

export function parsePolicyRef(value: unknown): PolicyRef {
  const record = parseStrictRecord(value, ["id", "version"], "PolicyRef");
  return {
    id: nonEmptyString(requireProperty(record, "id", "PolicyRef"), "PolicyRef.id"),
    version: parsePolicyVersion(requireProperty(record, "version", "PolicyRef")),
  };
}

export function parseGlobalTimeWindowPolicy(value: unknown): GlobalTimeWindowPolicy {
  const record = parseStrictRecord(
    value,
    ["policyId", "policyVersion", "naturalGrain", "corpus", "lookback", "gapPolicy", "comparableIntersection"],
    "GlobalTimeWindowPolicy",
  );
  return {
    policyId: nonEmptyString(requireProperty(record, "policyId", "GlobalTimeWindowPolicy"), "GlobalTimeWindowPolicy.policyId"),
    policyVersion: parsePolicyVersion(requireProperty(record, "policyVersion", "GlobalTimeWindowPolicy")),
    naturalGrain: parseStringLiteral(requireProperty(record, "naturalGrain", "GlobalTimeWindowPolicy"), naturalGrains, "GlobalTimeWindowPolicy.naturalGrain"),
    corpus: parseStringLiteral(requireProperty(record, "corpus", "GlobalTimeWindowPolicy"), new Set(["CERTIFIED_HISTORY", "CERTIFIED_PLUS_DESCRIPTIVE_LIVE_TAIL"]), "GlobalTimeWindowPolicy.corpus"),
    lookback: parseHistoricalLookback(requireProperty(record, "lookback", "GlobalTimeWindowPolicy")),
    gapPolicy: parseStringLiteral(requireProperty(record, "gapPolicy", "GlobalTimeWindowPolicy"), new Set(["PRESERVE"]), "GlobalTimeWindowPolicy.gapPolicy"),
    comparableIntersection: parseStringLiteral(requireProperty(record, "comparableIntersection", "GlobalTimeWindowPolicy"), new Set(["NOT_REQUIRED", "EXACT_NATURAL_UNIT"]), "GlobalTimeWindowPolicy.comparableIntersection"),
  };
}

export function parseGlobalSupport(value: unknown): GlobalSupport {
  const record = parseStrictRecord(
    value,
    ["naturalGrain", "eligibleUnits", "observedUnits", "includedUnits", "excludedObservedUnits", "minimumRequired", "supportStatus", "supportStart", "supportEnd", "gapCount", "largestGapUnits", "occurrenceCount", "matchedSetCount", "comparableEntityCount", "policyRef"],
    "GlobalSupport",
  );
  const eligibleUnits = nonNegativeInteger(requireProperty(record, "eligibleUnits", "GlobalSupport"), "GlobalSupport.eligibleUnits");
  const observedUnits = nonNegativeInteger(requireProperty(record, "observedUnits", "GlobalSupport"), "GlobalSupport.observedUnits");
  const includedUnits = nonNegativeInteger(requireProperty(record, "includedUnits", "GlobalSupport"), "GlobalSupport.includedUnits");
  const excludedObservedUnits = nonNegativeInteger(requireProperty(record, "excludedObservedUnits", "GlobalSupport"), "GlobalSupport.excludedObservedUnits");
  if (includedUnits > observedUnits || observedUnits > eligibleUnits || excludedObservedUnits !== observedUnits - includedUnits) {
    throw new TypeError("GlobalSupport doit respecter included <= observed <= eligible et excluded = observed - included.");
  }
  const supportStart = optional(record, "supportStart", parseLocalDate);
  const supportEnd = optional(record, "supportEnd", parseLocalDate);
  if ((supportStart === undefined) !== (supportEnd === undefined)) {
    throw new TypeError("GlobalSupport.supportStart et supportEnd sont absents ou présents ensemble.");
  }
  if (supportStart !== undefined && supportEnd !== undefined && supportStart > supportEnd) {
    throw new TypeError("GlobalSupport.supportStart doit précéder supportEnd.");
  }
  const count = (key: string) => optional(record, key, (entry) => nonNegativeInteger(entry, `GlobalSupport.${key}`));
  const gapCount = count("gapCount");
  const largestGapUnits = count("largestGapUnits");
  const occurrenceCount = count("occurrenceCount");
  const matchedSetCount = count("matchedSetCount");
  const comparableEntityCount = count("comparableEntityCount");
  return {
    naturalGrain: parseStringLiteral(requireProperty(record, "naturalGrain", "GlobalSupport"), naturalGrains, "GlobalSupport.naturalGrain"),
    eligibleUnits,
    observedUnits,
    includedUnits,
    excludedObservedUnits,
    minimumRequired: nonNegativeInteger(requireProperty(record, "minimumRequired", "GlobalSupport"), "GlobalSupport.minimumRequired"),
    supportStatus: parseStringLiteral(requireProperty(record, "supportStatus", "GlobalSupport"), supportStatuses, "GlobalSupport.supportStatus"),
    ...(supportStart === undefined ? {} : { supportStart, supportEnd: supportEnd as ReturnType<typeof parseLocalDate> }),
    ...(gapCount === undefined ? {} : { gapCount }),
    ...(largestGapUnits === undefined ? {} : { largestGapUnits }),
    ...(occurrenceCount === undefined ? {} : { occurrenceCount }),
    ...(matchedSetCount === undefined ? {} : { matchedSetCount }),
    ...(comparableEntityCount === undefined ? {} : { comparableEntityCount }),
    policyRef: nonEmptyString(requireProperty(record, "policyRef", "GlobalSupport"), "GlobalSupport.policyRef"),
  };
}

export function parseGlobalCoverageMeasure(value: unknown): GlobalCoverageMeasure {
  const record = parseStrictRecord(value, ["dimension", "status", "numerator", "denominator", "ratio", "unit", "basis", "evidenceRefs", "policyRef"], "GlobalCoverageMeasure");
  const status = parseDataStatus(requireProperty(record, "status", "GlobalCoverageMeasure"));
  const numerator = optional(record, "numerator", (entry) => {
    if (typeof entry !== "number" || !Number.isFinite(entry) || entry < 0) throw new TypeError("GlobalCoverageMeasure.numerator est invalide.");
    return entry;
  });
  const denominator = optional(record, "denominator", (entry) => {
    if (typeof entry !== "number" || !Number.isFinite(entry) || entry <= 0) throw new TypeError("GlobalCoverageMeasure.denominator doit être strictement positif.");
    return entry;
  });
  const ratio = optional(record, "ratio", (entry) => finiteRatio(entry, "GlobalCoverageMeasure.ratio"));
  if (status === "KNOWN" || status === "PARTIAL") {
    if (numerator === undefined || denominator === undefined || ratio === undefined || numerator > denominator || Math.abs(ratio - numerator / denominator) > Number.EPSILON * 16) {
      throw new TypeError("Une coverage KNOWN/PARTIAL exige un quotient prouvé et exact.");
    }
  } else if (numerator !== undefined || denominator !== undefined || ratio !== undefined) {
    throw new TypeError("Une coverage sans valeur connaissable ne porte aucun quotient.");
  }
  return {
    dimension: parseStringLiteral(requireProperty(record, "dimension", "GlobalCoverageMeasure"), coverageDimensions, "GlobalCoverageMeasure.dimension"),
    status,
    ...(numerator === undefined ? {} : { numerator }),
    ...(denominator === undefined ? {} : { denominator }),
    ...(ratio === undefined ? {} : { ratio }),
    unit: nonEmptyString(requireProperty(record, "unit", "GlobalCoverageMeasure"), "GlobalCoverageMeasure.unit"),
    basis: nonEmptyString(requireProperty(record, "basis", "GlobalCoverageMeasure"), "GlobalCoverageMeasure.basis"),
    evidenceRefs: sortedUnique(requireProperty(record, "evidenceRefs", "GlobalCoverageMeasure"), (entry) => nonEmptyString(entry, "evidenceRef"), "GlobalCoverageMeasure.evidenceRefs"),
    policyRef: nonEmptyString(requireProperty(record, "policyRef", "GlobalCoverageMeasure"), "GlobalCoverageMeasure.policyRef"),
  };
}

export function parseGlobalCoverageSet(value: unknown): GlobalCoverageSet {
  const record = parseStrictRecord(value, ["dimensions", "requiredDimensions", "effective", "aggregation"], "GlobalCoverageSet");
  const rawDimensions = requireProperty(record, "dimensions", "GlobalCoverageSet");
  if (!Array.isArray(rawDimensions)) throw new TypeError("GlobalCoverageSet.dimensions doit être un tableau.");
  const dimensions = rawDimensions.map(parseGlobalCoverageMeasure).sort((a, b) => a.dimension.localeCompare(b.dimension));
  if (new Set(dimensions.map(({ dimension }) => dimension)).size !== dimensions.length) {
    throw new TypeError("GlobalCoverageSet.dimensions contient une dimension dupliquée.");
  }
  const requiredDimensions = sortedUnique<GlobalCoverageDimension>(requireProperty(record, "requiredDimensions", "GlobalCoverageSet"), (entry) => parseStringLiteral<GlobalCoverageDimension>(entry, coverageDimensions, "GlobalCoverageDimension"), "GlobalCoverageSet.requiredDimensions");
  if (requiredDimensions.some((dimension) => !dimensions.some((measure) => measure.dimension === dimension))) {
    throw new TypeError("GlobalCoverageSet omet une dimension requise.");
  }
  const requiredMeasures = requiredDimensions.map((dimension) => dimensions.find((measure) => measure.dimension === dimension) as GlobalCoverageMeasure);
  const ratios = requiredMeasures.map(({ ratio }) => ratio);
  const expectedEffective = ratios.every((ratio) => ratio !== undefined) && ratios.length > 0
    ? Math.min(...(ratios as number[]))
    : undefined;
  const effective = optional(record, "effective", (entry) => finiteRatio(entry, "GlobalCoverageSet.effective"));
  if (expectedEffective === undefined ? effective !== undefined : effective === undefined || Math.abs(effective - expectedEffective) > Number.EPSILON * 16) {
    throw new TypeError("GlobalCoverageSet.effective doit être le minimum des dimensions requises résolues.");
  }
  return {
    dimensions,
    requiredDimensions,
    ...(effective === undefined ? {} : { effective }),
    aggregation: parseStringLiteral(requireProperty(record, "aggregation", "GlobalCoverageSet"), new Set(["MIN_REQUIRED_DIMENSIONS"]), "GlobalCoverageSet.aggregation"),
  };
}

function parseStringRefs(record: UnknownRecord, key: string, typeName: string): readonly string[] {
  return sortedUnique(requireProperty(record, key, typeName), (entry) => machineRef(entry, `${typeName}.${key}`), `${typeName}.${key}`);
}

export function parseGlobalValueProvenance(value: unknown): GlobalValueProvenance {
  const allowed = ["resultNature", "precision", "integrationMode", "monetaryBasis", "sourceRefs", "factRefs", "evidenceRefs", "entityRefs", "upstreamMetricRefs", "replacesContributionIds", "derivedFromContributionIds", "coverageGapRef", "methodVersion", "policyVersions", "dataRevision", "analyticsRevision", "publicationLineage", "estimateLifecycle"];
  const record = parseStrictRecord(value, allowed, "GlobalValueProvenance");
  const optionalRefs = (key: string) => optional(record, key, (entry) => sortedUnique(entry, (ref) => machineRef(ref, key), `GlobalValueProvenance.${key}`));
  const replacesContributionIds = optionalRefs("replacesContributionIds");
  const derivedFromContributionIds = optionalRefs("derivedFromContributionIds");
  const coverageGapRef = optional(record, "coverageGapRef", (entry) => nonEmptyString(entry, "GlobalValueProvenance.coverageGapRef"));
  const methodVersion = optional(record, "methodVersion", parseMethodVersion);
  const estimateLifecycle = optional(record, "estimateLifecycle", (entry) => parseStringLiteral<"DYNAMIC" | "SNAPSHOT">(entry, new Set(["DYNAMIC", "SNAPSHOT"]), "GlobalValueProvenance.estimateLifecycle"));
  const lineage = optional(record, "publicationLineage", (entry) => {
    const candidate = parseStrictRecord(entry, ["publicationId", "revision", "factsHash", "manifestHash"], "GlobalPublicationLineage");
    const manifestHash = optional(candidate, "manifestHash", (item) => nonEmptyString(item, "GlobalPublicationLineage.manifestHash"));
    return {
      publicationId: nonEmptyString(requireProperty(candidate, "publicationId", "GlobalPublicationLineage"), "GlobalPublicationLineage.publicationId"),
      revision: nonNegativeInteger(requireProperty(candidate, "revision", "GlobalPublicationLineage"), "GlobalPublicationLineage.revision"),
      factsHash: nonEmptyString(requireProperty(candidate, "factsHash", "GlobalPublicationLineage"), "GlobalPublicationLineage.factsHash"),
      ...(manifestHash === undefined ? {} : { manifestHash }),
    };
  });
  return {
    resultNature: parseStringLiteral(requireProperty(record, "resultNature", "GlobalValueProvenance"), new Set(["OBSERVED", "DECLARED", "ESTIMATED", "HYBRID"]), "GlobalValueProvenance.resultNature"),
    precision: parseStringLiteral(requireProperty(record, "precision", "GlobalValueProvenance"), new Set(["EXACT", "APPROXIMATE", "RANGE"]), "GlobalValueProvenance.precision"),
    integrationMode: parseStringLiteral(requireProperty(record, "integrationMode", "GlobalValueProvenance"), new Set(["INFORMATIONAL_ONLY", "SUPPLEMENT_UNOBSERVED", "REPLACEMENT_ESTIMATE", "DERIVED_FROM_OBSERVED"]), "GlobalValueProvenance.integrationMode"),
    monetaryBasis: parseStringLiteral(requireProperty(record, "monetaryBasis", "GlobalValueProvenance"), new Set(["AUTHORITATIVE_ECONOMIC", "ENRICHED_ANALYTICAL", "CONTEXTUAL_ESTIMATE"]), "GlobalValueProvenance.monetaryBasis"),
    sourceRefs: parseStringRefs(record, "sourceRefs", "GlobalValueProvenance"),
    factRefs: parseStringRefs(record, "factRefs", "GlobalValueProvenance"),
    evidenceRefs: parseStringRefs(record, "evidenceRefs", "GlobalValueProvenance"),
    entityRefs: parseStringRefs(record, "entityRefs", "GlobalValueProvenance"),
    upstreamMetricRefs: parseStringRefs(record, "upstreamMetricRefs", "GlobalValueProvenance"),
    ...(replacesContributionIds === undefined ? {} : { replacesContributionIds }),
    ...(derivedFromContributionIds === undefined ? {} : { derivedFromContributionIds }),
    ...(coverageGapRef === undefined ? {} : { coverageGapRef }),
    ...(methodVersion === undefined ? {} : { methodVersion }),
    policyVersions: parsePolicyVersionRecord(requireProperty(record, "policyVersions", "GlobalValueProvenance")),
    dataRevision: parseDataRevision(requireProperty(record, "dataRevision", "GlobalValueProvenance")),
    analyticsRevision: parseAnalyticsRevision(requireProperty(record, "analyticsRevision", "GlobalValueProvenance")),
    ...(lineage === undefined ? {} : { publicationLineage: lineage }),
    ...(estimateLifecycle === undefined ? {} : { estimateLifecycle }),
  };
}

export function parseGlobalKnowledgeValue<Value>(
  value: unknown,
  parseValue: (value: unknown) => Value,
): GlobalKnowledgeValue<Value> {
  const record = parseStrictRecord(value, ["status", "value", "partialMeaning", "partialReasons", "support", "coverage", "provenance"], "GlobalKnowledgeValue");
  const status = parseDataStatus(requireProperty(record, "status", "GlobalKnowledgeValue"));
  const support = optional(record, "support", parseGlobalSupport);
  const coverage = optional(record, "coverage", parseGlobalCoverageSet);
  const provenance = optional(record, "provenance", parseGlobalValueProvenance);
  const qualification = {
    ...(support === undefined ? {} : { support }),
    ...(coverage === undefined ? {} : { coverage }),
    ...(provenance === undefined ? {} : { provenance }),
  };
  if (status === "KNOWN") {
    if (hasOwn(record, "partialMeaning") || hasOwn(record, "partialReasons")) throw new TypeError("KNOWN ne porte pas de qualification PARTIAL.");
    return { status, value: parseValue(requireProperty(record, "value", "GlobalKnowledgeValue")), ...qualification };
  }
  if (status === "PARTIAL") {
    return {
      status,
      value: parseValue(requireProperty(record, "value", "GlobalKnowledgeValue")),
      partialMeaning: parsePartialMeaning(requireProperty(record, "partialMeaning", "GlobalKnowledgeValue")),
      partialReasons: sortedUnique(requireProperty(record, "partialReasons", "GlobalKnowledgeValue"), (entry) => parseStringLiteral(entry, partialReasons, "GlobalPartialReason"), "GlobalKnowledgeValue.partialReasons", true),
      ...qualification,
    };
  }
  if (hasOwn(record, "value") || hasOwn(record, "partialMeaning") || hasOwn(record, "partialReasons")) {
    throw new TypeError(`${status} ne porte ni value ni qualification PARTIAL.`);
  }
  return { status, ...qualification };
}

export function parseCorpusSlice(value: unknown): CorpusSlice {
  const record = parseStrictRecord(value, ["authority", "start", "end", "support", "provenance", "dependencyRefs"], "CorpusSlice");
  const start = optional(record, "start", parseLocalDate);
  const end = parseLocalDate(requireProperty(record, "end", "CorpusSlice"));
  if (start !== undefined && start > end) throw new TypeError("CorpusSlice.start doit précéder end.");
  return {
    authority: parseStringLiteral(requireProperty(record, "authority", "CorpusSlice"), new Set(["CERTIFIED_HISTORY", "LIVE_TAIL"]), "CorpusSlice.authority"),
    ...(start === undefined ? {} : { start }),
    end,
    support: parseGlobalSupport(requireProperty(record, "support", "CorpusSlice")),
    provenance: parseGlobalValueProvenance(requireProperty(record, "provenance", "CorpusSlice")),
    dependencyRefs: sortedUnique(requireProperty(record, "dependencyRefs", "CorpusSlice"), (entry) => nonEmptyString(entry, "CorpusSlice.dependencyRef"), "CorpusSlice.dependencyRefs"),
  };
}

export function parseGlobalResolvedNaturalWindow(value: unknown): GlobalResolvedNaturalWindow {
  const record = parseStrictRecord(value, ["naturalGrain", "certified", "liveTail", "gapDates"], "GlobalResolvedNaturalWindow");
  const certified = parseCorpusSlice(requireProperty(record, "certified", "GlobalResolvedNaturalWindow"));
  if (certified.authority !== "CERTIFIED_HISTORY") throw new TypeError("Le slice certified doit porter CERTIFIED_HISTORY.");
  const liveTail = optional(record, "liveTail", parseCorpusSlice);
  if (liveTail !== undefined && (liveTail.authority !== "LIVE_TAIL" || liveTail.end <= certified.end || (liveTail.start !== undefined && liveTail.start <= certified.end))) {
    throw new TypeError("Le LIVE_TAIL doit être strictement disjoint et postérieur au CERTIFIED_HISTORY.");
  }
  return {
    naturalGrain: parseStringLiteral(requireProperty(record, "naturalGrain", "GlobalResolvedNaturalWindow"), naturalGrains, "GlobalResolvedNaturalWindow.naturalGrain"),
    certified,
    ...(liveTail === undefined ? {} : { liveTail }),
    gapDates: sortedUnique(requireProperty(record, "gapDates", "GlobalResolvedNaturalWindow"), parseLocalDate, "GlobalResolvedNaturalWindow.gapDates"),
  };
}

export function parseGlobalEngineIdentity(value: unknown): GlobalEngineIdentity {
  const record = parseStrictRecord(value, ["engineId", "methodVersion", "naturalGrain", "statisticalPolicy", "timeWindowPolicy", "supportPolicy", "coveragePolicy", "materialityPolicy"], "GlobalEngineIdentity");
  const statisticalPolicy = optional(record, "statisticalPolicy", parsePolicyRef);
  const materialityPolicy = optional(record, "materialityPolicy", parsePolicyRef);
  return {
    engineId: nonEmptyString(requireProperty(record, "engineId", "GlobalEngineIdentity"), "GlobalEngineIdentity.engineId"),
    methodVersion: parseMethodVersion(requireProperty(record, "methodVersion", "GlobalEngineIdentity")),
    naturalGrain: parseStringLiteral(requireProperty(record, "naturalGrain", "GlobalEngineIdentity"), naturalGrains, "GlobalEngineIdentity.naturalGrain"),
    ...(statisticalPolicy === undefined ? {} : { statisticalPolicy }),
    timeWindowPolicy: parsePolicyRef(requireProperty(record, "timeWindowPolicy", "GlobalEngineIdentity")),
    supportPolicy: parsePolicyRef(requireProperty(record, "supportPolicy", "GlobalEngineIdentity")),
    coveragePolicy: parsePolicyRef(requireProperty(record, "coveragePolicy", "GlobalEngineIdentity")),
    ...(materialityPolicy === undefined ? {} : { materialityPolicy }),
  };
}

export type GlobalPersonScopeValidationContext = {
  readonly authorizedPersonIds: readonly PersonId[];
};

export function parseGlobalPersonScopePolicy(value: unknown, context: GlobalPersonScopeValidationContext): GlobalPersonScopePolicy {
  const candidate = parseStrictRecord(value, ["kind", "personId", "personIds", "intersectionPolicy", "evidencePolicy"], "GlobalPersonScopePolicy");
  const kind = parseStringLiteral<GlobalPersonScopeKind>(requireProperty(candidate, "kind", "GlobalPersonScopePolicy"), new Set(["HOUSEHOLD", "PERSON", "COMPARABLE_PERSONS", "EXPLICIT_SHARED"]), "GlobalPersonScopePolicy.kind");
  const authorized = new Set(context.authorizedPersonIds.map(parsePersonId));
  const assertAuthorized = (ids: readonly PersonId[]) => {
    if (ids.some((id) => !authorized.has(id))) throw new TypeError("GlobalPersonScopePolicy contient une Person hors Household.");
  };
  if (kind === "HOUSEHOLD") {
    parseStrictRecord(value, ["kind"], "GlobalPersonScopePolicy");
    return { kind };
  }
  if (kind === "PERSON") {
    const record = parseStrictRecord(value, ["kind", "personId"], "GlobalPersonScopePolicy");
    const personId = parsePersonId(requireProperty(record, "personId", "GlobalPersonScopePolicy"));
    assertAuthorized([personId]);
    return { kind, personId };
  }
  const policyKey = kind === "COMPARABLE_PERSONS" ? "intersectionPolicy" : "evidencePolicy";
  const record = parseStrictRecord(value, ["kind", "personIds", policyKey], "GlobalPersonScopePolicy");
  const personIds = sortedUnique(requireProperty(record, "personIds", "GlobalPersonScopePolicy"), parsePersonId, "GlobalPersonScopePolicy.personIds", true);
  assertAuthorized(personIds);
  if (personIds.length < 2) throw new TypeError(`${kind} exige au moins deux personnes distinctes.`);
  return kind === "COMPARABLE_PERSONS"
    ? { kind, personIds, intersectionPolicy: parsePolicyRef(requireProperty(record, policyKey, "GlobalPersonScopePolicy")) }
    : { kind, personIds, evidencePolicy: parsePolicyRef(requireProperty(record, policyKey, "GlobalPersonScopePolicy")) };
}

export function parseGlobalEntityScopePolicy(value: unknown): GlobalEntityScopePolicy {
  const candidate = parseStrictRecord(value, ["kind", "entityType", "entityIds"], "GlobalEntityScopePolicy");
  const kind = parseStringLiteral<GlobalEntityScopePolicy["kind"]>(requireProperty(candidate, "kind", "GlobalEntityScopePolicy"), new Set(["NONE", "ENTITY_SET"]), "GlobalEntityScopePolicy.kind");
  if (kind === "NONE") {
    parseStrictRecord(value, ["kind"], "GlobalEntityScopePolicy");
    return { kind };
  }
  const record = parseStrictRecord(value, ["kind", "entityType", "entityIds"], "GlobalEntityScopePolicy");
  return {
    kind,
    entityType: nonEmptyString(requireProperty(record, "entityType", "GlobalEntityScopePolicy"), "GlobalEntityScopePolicy.entityType"),
    entityIds: sortedUnique(requireProperty(record, "entityIds", "GlobalEntityScopePolicy"), (entry) => nonEmptyString(entry, "GlobalEntityScopePolicy.entityId"), "GlobalEntityScopePolicy.entityIds", true),
  };
}

function parseDependencyRef(value: unknown, expectedKind?: DependencyRef["kind"]): DependencyRef {
  const record = parseStrictRecord(value, ["kind", "id", "requirement", "scopeRelation", "corpusAuthority"], "DependencyRef");
  const kind = parseStringLiteral<DependencyRef["kind"]>(requireProperty(record, "kind", "DependencyRef"), new Set(["FACT", "ENTITY", "ANALYTICS", "MODULE", "POLICY"]), "DependencyRef.kind");
  if (expectedKind !== undefined && kind !== expectedKind) throw new TypeError(`DependencyRef.kind doit être ${expectedKind}.`);
  const corpusAuthority = optional(record, "corpusAuthority", (entry) => parseStringLiteral<CorpusAuthority>(entry, new Set(["CERTIFIED_HISTORY", "LIVE_TAIL"]), "DependencyRef.corpusAuthority"));
  return {
    kind,
    id: nonEmptyString(requireProperty(record, "id", "DependencyRef"), "DependencyRef.id"),
    requirement: parseStringLiteral(requireProperty(record, "requirement", "DependencyRef"), new Set(["REQUIRED", "OPTIONAL"]), "DependencyRef.requirement"),
    scopeRelation: nonEmptyString(requireProperty(record, "scopeRelation", "DependencyRef"), "DependencyRef.scopeRelation"),
    ...(corpusAuthority === undefined ? {} : { corpusAuthority }),
  };
}

function parseDependencyArray(value: unknown, expectedKind: DependencyRef["kind"], field: string): readonly DependencyRef[] {
  if (!Array.isArray(value)) throw new TypeError(`${field} doit être un tableau.`);
  const parsed = value.map((entry) => parseDependencyRef(entry, expectedKind)).sort((a, b) => a.id.localeCompare(b.id));
  for (let index = 1; index < parsed.length; index += 1) {
    if (parsed[index - 1].id === parsed[index].id) {
      if (JSON.stringify(parsed[index - 1]) !== JSON.stringify(parsed[index])) throw new TypeError(`${field} contient un doublon contradictoire.`);
      throw new TypeError(`${field} contient un doublon.`);
    }
  }
  return parsed;
}

function parsePublicationOutputs(value: unknown): readonly PublicationOutputRef[] {
  if (!Array.isArray(value)) throw new TypeError("publicationOutputs doit être un tableau.");
  const parsed = value.map((entry) => {
    const record = parseStrictRecord(entry, ["kind", "id"], "PublicationOutputRef");
    return {
      kind: parseStringLiteral<PublicationOutputRef["kind"]>(requireProperty(record, "kind", "PublicationOutputRef"), new Set(["ARTIFACT", "QUERY_SNAPSHOT"]), "PublicationOutputRef.kind"),
      id: nonEmptyString(requireProperty(record, "id", "PublicationOutputRef"), "PublicationOutputRef.id"),
    };
  }).sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
  if (new Set(parsed.map((entry) => `${entry.kind}:${entry.id}`)).size !== parsed.length) throw new TypeError("publicationOutputs contient un doublon.");
  return parsed;
}

function parseCapabilityRequirements(value: unknown): readonly CapabilityRequirement[] {
  if (!Array.isArray(value)) throw new TypeError("capabilityRequirements doit être un tableau.");
  const parsed = value.map((entry) => {
    const record = parseStrictRecord(entry, ["capabilityId", "requirement"], "CapabilityRequirement");
    return {
      capabilityId: nonEmptyString(requireProperty(record, "capabilityId", "CapabilityRequirement"), "CapabilityRequirement.capabilityId"),
      requirement: parseStringLiteral<CapabilityRequirement["requirement"]>(requireProperty(record, "requirement", "CapabilityRequirement"), new Set(["REQUIRED", "OPTIONAL"]), "CapabilityRequirement.requirement"),
    };
  }).sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
  if (new Set(parsed.map(({ capabilityId }) => capabilityId)).size !== parsed.length) throw new TypeError("capabilityRequirements contient un doublon.");
  return parsed;
}

function parseInvalidationScope(value: unknown, context: GlobalPersonScopeValidationContext): GlobalInvalidationScope {
  const candidate = parseStrictRecord(value, ["kind", "resourceId", "entityType", "entityId", "start", "end", "personIds", "moduleId"], "GlobalInvalidationScope");
  const kind = parseStringLiteral<GlobalInvalidationScope["kind"]>(requireProperty(candidate, "kind", "GlobalInvalidationScope"), new Set(["RESOURCE", "ENTITY", "NATURAL_DATE_INTERVAL", "PERSON_SCOPE", "MODULE", "GLOBAL_GENERATION"]), "GlobalInvalidationScope.kind");
  if (kind === "GLOBAL_GENERATION") {
    parseStrictRecord(value, ["kind"], "GlobalInvalidationScope");
    return { kind };
  }
  if (kind === "RESOURCE" || kind === "MODULE") {
    const key = kind === "RESOURCE" ? "resourceId" : "moduleId";
    const record = parseStrictRecord(value, ["kind", key], "GlobalInvalidationScope");
    const id = nonEmptyString(requireProperty(record, key, "GlobalInvalidationScope"), `GlobalInvalidationScope.${key}`);
    return kind === "RESOURCE" ? { kind, resourceId: id } : { kind, moduleId: id };
  }
  if (kind === "ENTITY") {
    const record = parseStrictRecord(value, ["kind", "entityType", "entityId"], "GlobalInvalidationScope");
    return { kind, entityType: nonEmptyString(requireProperty(record, "entityType", "GlobalInvalidationScope"), "entityType"), entityId: nonEmptyString(requireProperty(record, "entityId", "GlobalInvalidationScope"), "entityId") };
  }
  if (kind === "NATURAL_DATE_INTERVAL") {
    const record = parseStrictRecord(value, ["kind", "start", "end"], "GlobalInvalidationScope");
    const start = parseLocalDate(requireProperty(record, "start", "GlobalInvalidationScope"));
    const end = parseLocalDate(requireProperty(record, "end", "GlobalInvalidationScope"));
    if (start > end) throw new TypeError("GlobalInvalidationScope.start doit précéder end.");
    return { kind, start, end };
  }
  const record = parseStrictRecord(value, ["kind", "personIds"], "GlobalInvalidationScope");
  const personIds = sortedUnique(requireProperty(record, "personIds", "GlobalInvalidationScope"), parsePersonId, "GlobalInvalidationScope.personIds", true);
  const authorized = new Set(context.authorizedPersonIds.map(parsePersonId));
  if (personIds.some((id) => !authorized.has(id))) throw new TypeError("GlobalInvalidationScope contient une Person hors Household.");
  return { kind, personIds };
}

export function parseGlobalDependencyDeclaration(
  value: unknown,
  context: GlobalPersonScopeValidationContext,
): GlobalDependencyDeclaration {
  const allowed = ["declarationVersion", "resourceId", "factDependencies", "entityDependencies", "upstreamAnalytics", "otherModuleDependencies", "naturalGrain", "timeWindowPolicy", "historicalLookback", "personScope", "entityScope", "supportPolicy", "coveragePolicy", "materialityPolicy", "methodVersion", "policyVersions", "publicationOutputs", "invalidationScope", "capabilityRequirements"];
  const record = parseStrictRecord(value, allowed, "GlobalDependencyDeclaration");
  const materialityPolicy = optional(record, "materialityPolicy", parsePolicyRef);
  return {
    declarationVersion: parseStringLiteral(requireProperty(record, "declarationVersion", "GlobalDependencyDeclaration"), new Set(["global-dependency-declaration@v1"]), "GlobalDependencyDeclaration.declarationVersion"),
    resourceId: nonEmptyString(requireProperty(record, "resourceId", "GlobalDependencyDeclaration"), "GlobalDependencyDeclaration.resourceId"),
    factDependencies: parseDependencyArray(requireProperty(record, "factDependencies", "GlobalDependencyDeclaration"), "FACT", "factDependencies"),
    entityDependencies: parseDependencyArray(requireProperty(record, "entityDependencies", "GlobalDependencyDeclaration"), "ENTITY", "entityDependencies"),
    upstreamAnalytics: parseDependencyArray(requireProperty(record, "upstreamAnalytics", "GlobalDependencyDeclaration"), "ANALYTICS", "upstreamAnalytics"),
    otherModuleDependencies: parseDependencyArray(requireProperty(record, "otherModuleDependencies", "GlobalDependencyDeclaration"), "MODULE", "otherModuleDependencies"),
    naturalGrain: parseStringLiteral(requireProperty(record, "naturalGrain", "GlobalDependencyDeclaration"), naturalGrains, "GlobalDependencyDeclaration.naturalGrain"),
    timeWindowPolicy: parsePolicyRef(requireProperty(record, "timeWindowPolicy", "GlobalDependencyDeclaration")),
    historicalLookback: parseHistoricalLookback(requireProperty(record, "historicalLookback", "GlobalDependencyDeclaration")),
    personScope: parseGlobalPersonScopePolicy(requireProperty(record, "personScope", "GlobalDependencyDeclaration"), context),
    entityScope: parseGlobalEntityScopePolicy(requireProperty(record, "entityScope", "GlobalDependencyDeclaration")),
    supportPolicy: parsePolicyRef(requireProperty(record, "supportPolicy", "GlobalDependencyDeclaration")),
    coveragePolicy: parsePolicyRef(requireProperty(record, "coveragePolicy", "GlobalDependencyDeclaration")),
    ...(materialityPolicy === undefined ? {} : { materialityPolicy }),
    methodVersion: parseMethodVersion(requireProperty(record, "methodVersion", "GlobalDependencyDeclaration")),
    policyVersions: parsePolicyVersionRecord(requireProperty(record, "policyVersions", "GlobalDependencyDeclaration")),
    publicationOutputs: parsePublicationOutputs(requireProperty(record, "publicationOutputs", "GlobalDependencyDeclaration")),
    invalidationScope: parseInvalidationScope(requireProperty(record, "invalidationScope", "GlobalDependencyDeclaration"), context),
    capabilityRequirements: parseCapabilityRequirements(requireProperty(record, "capabilityRequirements", "GlobalDependencyDeclaration")),
  };
}

export function assertGlobalDependencyClosure(
  declaration: GlobalDependencyDeclaration,
  consumed: GlobalDependencyConsumption,
): void {
  const declared = {
    factDependencyIds: new Set(declaration.factDependencies.map(({ id }) => id)),
    entityDependencyIds: new Set(declaration.entityDependencies.map(({ id }) => id)),
    upstreamAnalyticsIds: new Set(declaration.upstreamAnalytics.map(({ id }) => id)),
    otherModuleDependencyIds: new Set(declaration.otherModuleDependencies.map(({ id }) => id)),
    policyIds: new Set([
      declaration.timeWindowPolicy.id,
      declaration.supportPolicy.id,
      declaration.coveragePolicy.id,
      ...(declaration.materialityPolicy === undefined ? [] : [declaration.materialityPolicy.id]),
      ...Object.keys(declaration.policyVersions),
    ]),
  };
  for (const key of Object.keys(consumed) as (keyof GlobalDependencyConsumption)[]) {
    const values = sortedUnique(consumed[key], (entry) => nonEmptyString(entry, key), `GlobalDependencyConsumption.${key}`);
    const missing = values.filter((id) => !declared[key].has(id));
    if (missing.length > 0) throw new TypeError(`Global dependency declaration missing consumed ${key}: ${missing.join(", ")}`);
  }
}

export function assertNoLiveTailStructuralDependencies(
  declaration: GlobalDependencyDeclaration,
  outputAuthority: "STRUCTURAL" | "DESCRIPTIVE",
): void {
  if (outputAuthority === "DESCRIPTIVE") return;
  const all = [
    ...declaration.factDependencies,
    ...declaration.entityDependencies,
    ...declaration.upstreamAnalytics,
    ...declaration.otherModuleDependencies,
  ];
  if (all.some(({ corpusAuthority }) => corpusAuthority === "LIVE_TAIL")) {
    throw new TypeError("LIVE_TAIL_AUTHORITY_LEAK");
  }
}

export function parseGlobalCapability(value: unknown): GlobalCapability {
  const record = parseStrictRecord(value, ["capabilityId", "state", "authorityGateIds", "reasonCodes", "supportedPersonScopes", "supportedEntityScopes", "evidenceRefs", "policyRef"], "GlobalCapability");
  return {
    capabilityId: nonEmptyString(requireProperty(record, "capabilityId", "GlobalCapability"), "GlobalCapability.capabilityId"),
    state: parseStringLiteral(requireProperty(record, "state", "GlobalCapability"), new Set(["AVAILABLE", "PARTIAL", "UNAVAILABLE", "CONFLICT"]), "GlobalCapability.state"),
    authorityGateIds: sortedUnique(requireProperty(record, "authorityGateIds", "GlobalCapability"), (entry) => nonEmptyString(entry, "authorityGateId"), "GlobalCapability.authorityGateIds"),
    reasonCodes: sortedUnique(requireProperty(record, "reasonCodes", "GlobalCapability"), (entry) => nonEmptyString(entry, "reasonCode"), "GlobalCapability.reasonCodes"),
    supportedPersonScopes: sortedUnique(requireProperty(record, "supportedPersonScopes", "GlobalCapability"), (entry) => parseStringLiteral(entry, new Set(["HOUSEHOLD", "PERSON", "COMPARABLE_PERSONS", "EXPLICIT_SHARED"]), "GlobalPersonScopeKind"), "GlobalCapability.supportedPersonScopes"),
    supportedEntityScopes: sortedUnique(requireProperty(record, "supportedEntityScopes", "GlobalCapability"), (entry) => nonEmptyString(entry, "supportedEntityScope"), "GlobalCapability.supportedEntityScopes"),
    evidenceRefs: sortedUnique(requireProperty(record, "evidenceRefs", "GlobalCapability"), (entry) => nonEmptyString(entry, "evidenceRef"), "GlobalCapability.evidenceRefs"),
    policyRef: nonEmptyString(requireProperty(record, "policyRef", "GlobalCapability"), "GlobalCapability.policyRef"),
  };
}

export function parseGlobalMaterialityCandidate(value: unknown): GlobalMaterialityCandidate {
  const record = parseStrictRecord(value, ["candidateId", "phenomenonId", "parentPhenomenonId", "metricRef", "effect", "knowledgeState", "support", "coverage", "evidenceRefs", "entityRefs", "methodVersion", "materialityPolicy"], "GlobalMaterialityCandidate");
  const effectRecord = parseStrictRecord(requireProperty(record, "effect", "GlobalMaterialityCandidate"), ["absolute", "relative", "standardized"], "GlobalMaterialityEffect");
  const decimal = (entry: unknown) => {
    const parsed = nonEmptyString(entry, "GlobalMaterialityEffect decimal");
    if (!/^-?\d+(?:\.\d+)?$/.test(parsed)) throw new TypeError("GlobalMaterialityEffect doit être un décimal canonique.");
    return parsed;
  };
  const absolute = optional(effectRecord, "absolute", decimal);
  const relative = optional(effectRecord, "relative", decimal);
  const standardized = optional(effectRecord, "standardized", (entry) => {
    if (typeof entry !== "number" || !Number.isFinite(entry)) throw new TypeError("GlobalMaterialityEffect.standardized est invalide.");
    return entry;
  });
  if (absolute === undefined && relative === undefined && standardized === undefined) throw new TypeError("GlobalMaterialityCandidate.effect doit porter au moins une mesure.");
  const parentPhenomenonId = optional(record, "parentPhenomenonId", (entry) => nonEmptyString(entry, "GlobalMaterialityCandidate.parentPhenomenonId"));
  return {
    candidateId: nonEmptyString(requireProperty(record, "candidateId", "GlobalMaterialityCandidate"), "GlobalMaterialityCandidate.candidateId"),
    phenomenonId: nonEmptyString(requireProperty(record, "phenomenonId", "GlobalMaterialityCandidate"), "GlobalMaterialityCandidate.phenomenonId"),
    ...(parentPhenomenonId === undefined ? {} : { parentPhenomenonId }),
    metricRef: nonEmptyString(requireProperty(record, "metricRef", "GlobalMaterialityCandidate"), "GlobalMaterialityCandidate.metricRef"),
    effect: { ...(absolute === undefined ? {} : { absolute }), ...(relative === undefined ? {} : { relative }), ...(standardized === undefined ? {} : { standardized }) },
    knowledgeState: parseDataStatus(requireProperty(record, "knowledgeState", "GlobalMaterialityCandidate")),
    support: parseGlobalSupport(requireProperty(record, "support", "GlobalMaterialityCandidate")),
    coverage: parseGlobalCoverageSet(requireProperty(record, "coverage", "GlobalMaterialityCandidate")),
    evidenceRefs: sortedUnique(requireProperty(record, "evidenceRefs", "GlobalMaterialityCandidate"), (entry) => nonEmptyString(entry, "evidenceRef"), "GlobalMaterialityCandidate.evidenceRefs"),
    entityRefs: sortedUnique(requireProperty(record, "entityRefs", "GlobalMaterialityCandidate"), (entry) => nonEmptyString(entry, "entityRef"), "GlobalMaterialityCandidate.entityRefs"),
    methodVersion: parseMethodVersion(requireProperty(record, "methodVersion", "GlobalMaterialityCandidate")),
    materialityPolicy: parsePolicyRef(requireProperty(record, "materialityPolicy", "GlobalMaterialityCandidate")),
  };
}

export function normalizeGlobalAnalysisScopeV2(
  scope: GlobalAnalysisScopeV2,
  context: GlobalScopeValidationContext,
): NormalizedGlobalAnalysisScopeV2 {
  return parseGlobalAnalysisScopeV2(scope, context);
}
