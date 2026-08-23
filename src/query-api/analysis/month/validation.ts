import { isActiveMetricId } from "../../../analytics/production";
import type { ComparisonQualification } from "../../../analytics/comparisons";
import { parseActivityId, parseCategoryId, parseMerchantId, parseMetricId, parseMomentId, parseOperationId, parsePersonId, parsePlaceId } from "../../../core/identity";
import { parseAnalysisTargetSubject } from "../../../core/scope";
import { compareYearMonth, parseInstant, parseLocalDate, parseYearMonth } from "../../../core/time";
import { hasOwn, parseStrictRecord, parseStringLiteral, requireProperty } from "../../../core/validation";
import { parseQueryCapabilities } from "../../capabilities";
import { queryResourceKeys } from "../../request";
import { parsePeriodCompleteness, parseReadModelSubject, parseScopedCountMetricReadModel, parseScopedMetricReadModel, parseScopedMoneyMetricReadModel } from "../../read-models";
import { parseAnalysisBreakdownReadModel, parseAnalysisContextsBase, parseMoneyComparisonResult } from "../shared/validation";
import type {
  AnalysisDestination,
  AnalysisLivedSubview,
  AnalysisMonthBreakdownReadModel,
  AnalysisMonthContextsReadModel,
  AnalysisMonthEvolutionPoint,
  AnalysisMonthEvolutionReadModel,
  AnalysisMonthInitialReadModel,
  AnalysisMonthLivedReadModel,
  AnalysisMonthMomentsReadModel,
  AnalysisMonthStructureReadModel,
  AnalysisStructureDimension,
  AnalysisStructureMeasure,
  AnalysisStructureView,
  AnalysisTargetReadModel,
  MarkedFactReadModel,
  MomentPreview,
} from "./types";

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} doit être non vide.`);
  return value;
}

const qualifications = new Set<ComparisonQualification>(["statistically_qualified", "descriptive_only", "not_assessed"]);
const views = new Set<AnalysisStructureView>(["destination", "nature", "life_context"]);
const dimensions = new Set<AnalysisStructureDimension>(["family", "category", "activity", "merchant", "place", "fixed_variable", "life_context", "necessity"]);
const measures = new Set<AnalysisStructureMeasure>(["amount", "share", "occurrences", "cost_per_occurrence"]);
const livedSubviews = new Set<AnalysisLivedSubview>(["summary", "rhythm", "contexts", "frequency_cost"]);

function array<T>(value: unknown, parse: (item: unknown) => T, name: string): readonly T[] {
  if (!Array.isArray(value)) throw new TypeError(`${name} doit être un tableau.`);
  return value.map(parse);
}

function parseDestination(value: unknown): AnalysisDestination {
  const candidate = parseStrictRecord(value, ["kind", "target", "momentId", "merchantId", "placeId", "operationId", "metricId"], "AnalysisDestination");
  const kind = requireProperty(candidate, "kind", "AnalysisDestination");
  if (kind === "target") {
    const record = parseStrictRecord(value, ["kind", "target"], "TargetDestination");
    return { kind, target: parseAnalysisTargetSubject(requireProperty(record, "target", "TargetDestination")) };
  }
  if (kind === "moment") return { kind, momentId: parseMomentId(requireProperty(parseStrictRecord(value, ["kind", "momentId"], "MomentDestination"), "momentId", "MomentDestination")) };
  if (kind === "merchant") return { kind, merchantId: parseMerchantId(requireProperty(parseStrictRecord(value, ["kind", "merchantId"], "MerchantDestination"), "merchantId", "MerchantDestination")) };
  if (kind === "place") return { kind, placeId: parsePlaceId(requireProperty(parseStrictRecord(value, ["kind", "placeId"], "PlaceDestination"), "placeId", "PlaceDestination")) };
  if (kind === "operation") return { kind, operationId: parseOperationId(requireProperty(parseStrictRecord(value, ["kind", "operationId"], "OperationDestination"), "operationId", "OperationDestination")) };
  if (kind === "methodology") return { kind, metricId: parseMetricId(requireProperty(parseStrictRecord(value, ["kind", "metricId"], "MethodologyDestination"), "metricId", "MethodologyDestination")) };
  throw new TypeError("AnalysisDestination.kind invalide.");
}

function parseMarkedFact(value: unknown): MarkedFactReadModel {
  const record = parseStrictRecord(value, ["id", "kind", "title", "description", "primaryMetric", "secondaryMetric", "comparison", "qualification", "evidence", "destination"], "MarkedFactReadModel");
  const kind = parseStringLiteral(requireProperty(record, "kind", "MarkedFactReadModel"), new Set(["family", "category", "activity", "context", "moment", "operation", "merchant", "place", "structure"]), "MarkedFact.kind") as MarkedFactReadModel["kind"];
  const evidence = array(requireProperty(record, "evidence", "MarkedFactReadModel"), (item) => {
    const candidate = parseStrictRecord(item, ["kind", "metricId", "targetMetricId", "referenceMetricId"], "MarkedFactEvidence");
    const evidenceKind = requireProperty(candidate, "kind", "MarkedFactEvidence");
    if (evidenceKind === "metric") return { kind: evidenceKind, metricId: parseMetricId(requireProperty(candidate, "metricId", "MarkedFactEvidence")) } as const;
    if (evidenceKind === "comparison") return { kind: evidenceKind, targetMetricId: parseMetricId(requireProperty(candidate, "targetMetricId", "MarkedFactEvidence")), referenceMetricId: parseMetricId(requireProperty(candidate, "referenceMetricId", "MarkedFactEvidence")) } as const;
    throw new TypeError("MarkedFactEvidence.kind invalide.");
  }, "MarkedFact.evidence");
  return {
    id: text(requireProperty(record, "id", "MarkedFactReadModel"), "MarkedFact.id"), kind,
    title: text(requireProperty(record, "title", "MarkedFactReadModel"), "MarkedFact.title"),
    ...(hasOwn(record, "description") ? { description: text(record.description, "MarkedFact.description") } : {}),
    primaryMetric: parseScopedMetricReadModel(requireProperty(record, "primaryMetric", "MarkedFactReadModel")),
    ...(hasOwn(record, "secondaryMetric") ? { secondaryMetric: parseScopedMetricReadModel(record.secondaryMetric) } : {}),
    ...(hasOwn(record, "comparison") ? { comparison: parseMoneyComparisonResult(record.comparison) } : {}),
    qualification: parseStringLiteral(requireProperty(record, "qualification", "MarkedFactReadModel"), qualifications, "MarkedFact.qualification"),
    evidence,
    ...(hasOwn(record, "destination") ? { destination: parseDestination(record.destination) } : {}),
  };
}

export function parseAnalysisMonthInitialReadModel(value: unknown): AnalysisMonthInitialReadModel {
  const record = parseStrictRecord(value, ["month", "subject", "periodCompleteness", "actual", "typical", "minimal", "actualVsTypical", "typicalVsMinimal", "economicRevenue", "economicBalance", "markedFacts", "markedFactsSelection", "manualSummary", "capabilities"], "AnalysisMonthInitialReadModel");
  const actual = parseScopedMoneyMetricReadModel(requireProperty(record, "actual", "AnalysisMonthInitialReadModel"));
  if (actual.metricId !== "economic_consumption_net_attributable") throw new TypeError("Actual MetricId invalide.");
  const typical = hasOwn(record, "typical") ? parseScopedMoneyMetricReadModel(record.typical) : undefined;
  if (typical && typical.metricId !== "typical_month_cost") throw new TypeError("Typical MetricId invalide.");
  const selectionRecord = parseStrictRecord(requireProperty(record, "markedFactsSelection", "AnalysisMonthInitialReadModel"), ["kind", "methodVersion", "reason"], "MarkedFactsSelection");
  const selectionKind = requireProperty(selectionRecord, "kind", "MarkedFactsSelection");
  const markedFactsSelection = selectionKind === "available"
    ? { kind: selectionKind, methodVersion: text(requireProperty(selectionRecord, "methodVersion", "MarkedFactsSelection"), "MarkedFacts methodVersion") } as const
    : selectionKind === "unavailable" && selectionRecord.reason === "materiality_rules_missing"
      ? { kind: selectionKind, reason: selectionRecord.reason } as const
      : (() => { throw new TypeError("MarkedFactsSelection invalide."); })();
  let manualSummary: AnalysisMonthInitialReadModel["manualSummary"];
  if (hasOwn(record, "manualSummary")) {
    if (record.manualSummary === null) manualSummary = null;
    else {
      const summary = parseStrictRecord(record.manualSummary, ["source", "text", "updatedAt"], "AnalysisManualSummary");
      if (summary.source !== "manual") throw new TypeError("ManualSummary.source invalide.");
      manualSummary = { source: "manual", text: text(requireProperty(summary, "text", "AnalysisManualSummary"), "ManualSummary.text"), ...(hasOwn(summary, "updatedAt") ? { updatedAt: parseInstant(summary.updatedAt) } : {}) };
    }
  }
  return {
    month: parseYearMonth(requireProperty(record, "month", "AnalysisMonthInitialReadModel")), subject: parseReadModelSubject(requireProperty(record, "subject", "AnalysisMonthInitialReadModel")), periodCompleteness: parsePeriodCompleteness(requireProperty(record, "periodCompleteness", "AnalysisMonthInitialReadModel")), actual,
    ...(typical ? { typical } : {}),
    ...(hasOwn(record, "minimal") ? (() => {
      const minimal = parseScopedMoneyMetricReadModel(record.minimal);
      if (minimal.metricId !== "minimal_month_cost") throw new TypeError("Minimal MetricId invalide.");
      return { minimal };
    })() : {}),
    ...(hasOwn(record, "actualVsTypical") ? { actualVsTypical: parseMoneyComparisonResult(record.actualVsTypical) } : {}),
    ...(hasOwn(record, "typicalVsMinimal") ? { typicalVsMinimal: parseMoneyComparisonResult(record.typicalVsMinimal) } : {}),
    ...(hasOwn(record, "economicRevenue") ? { economicRevenue: parseScopedMoneyMetricReadModel(record.economicRevenue) } : {}),
    ...(hasOwn(record, "economicBalance") ? { economicBalance: parseScopedMoneyMetricReadModel(record.economicBalance) } : {}),
    markedFacts: array(requireProperty(record, "markedFacts", "AnalysisMonthInitialReadModel"), parseMarkedFact, "markedFacts"), markedFactsSelection,
    ...(manualSummary === undefined ? {} : { manualSummary }), capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "AnalysisMonthInitialReadModel"), queryResourceKeys.analysisMonthInitial),
  };
}

export function parseAnalysisMonthBreakdownReadModel(value: unknown): AnalysisMonthBreakdownReadModel {
  const record = parseStrictRecord(value, ["month", "subject", "breakdown"], "AnalysisMonthBreakdownReadModel");
  return { month: parseYearMonth(requireProperty(record, "month", "AnalysisMonthBreakdownReadModel")), subject: parseReadModelSubject(requireProperty(record, "subject", "AnalysisMonthBreakdownReadModel")), breakdown: parseAnalysisBreakdownReadModel(requireProperty(record, "breakdown", "AnalysisMonthBreakdownReadModel"), queryResourceKeys.analysisMonthBreakdown) };
}

function parseEvolutionPoint(value: unknown, metricId: string): AnalysisMonthEvolutionPoint {
  const record = parseStrictRecord(value, ["period", "metric", "rollingTypical", "comparison", "periodCompleteness"], "AnalysisMonthEvolutionPoint");
  const metric = parseScopedMoneyMetricReadModel(requireProperty(record, "metric", "AnalysisMonthEvolutionPoint"));
  if (metric.metricId !== metricId) throw new TypeError("Evolution point MetricId incohérente.");
  return { period: parseYearMonth(requireProperty(record, "period", "AnalysisMonthEvolutionPoint")), metric, ...(hasOwn(record, "rollingTypical") ? { rollingTypical: parseScopedMoneyMetricReadModel(record.rollingTypical) } : {}), ...(hasOwn(record, "comparison") ? { comparison: parseMoneyComparisonResult(record.comparison) } : {}), periodCompleteness: parsePeriodCompleteness(requireProperty(record, "periodCompleteness", "AnalysisMonthEvolutionPoint")) };
}

export function parseAnalysisMonthEvolutionReadModel(value: unknown): AnalysisMonthEvolutionReadModel {
  const record = parseStrictRecord(value, ["month", "subject", "series", "capabilities"], "AnalysisMonthEvolutionReadModel");
  const month = parseYearMonth(requireProperty(record, "month", "AnalysisMonthEvolutionReadModel"));
  const series = array(requireProperty(record, "series", "AnalysisMonthEvolutionReadModel"), (raw) => {
    const item = parseStrictRecord(raw, ["id", "label", "metricId", "points"], "AnalysisMonthEvolutionSeries");
    const id = parseStringLiteral(requireProperty(item, "id", "AnalysisMonthEvolutionSeries"), new Set(["economic_total", "daily_life", "outside_daily_life"]), "EvolutionSeries.id") as AnalysisMonthEvolutionReadModel["series"][number]["id"];
    const metricId = requireProperty(item, "metricId", "AnalysisMonthEvolutionSeries");
    if (!isActiveMetricId(metricId)) throw new TypeError("EvolutionSeries.metricId inactive.");
    const points = array(requireProperty(item, "points", "AnalysisMonthEvolutionSeries"), (point) => parseEvolutionPoint(point, metricId), "EvolutionSeries.points");
    points.forEach((point, index) => { if (point.period > month || (index > 0 && points[index - 1]!.period >= point.period)) throw new TypeError("Evolution points non chronologiques."); });
    return { id, label: text(requireProperty(item, "label", "AnalysisMonthEvolutionSeries"), "EvolutionSeries.label"), metricId, points };
  }, "Evolution.series");
  if (new Set(series.map(({ id }) => id)).size !== series.length) throw new TypeError("Evolution series dupliquées.");
  return { month, subject: parseReadModelSubject(requireProperty(record, "subject", "AnalysisMonthEvolutionReadModel")), series, capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "AnalysisMonthEvolutionReadModel"), queryResourceKeys.analysisMonthEvolution) };
}

function parseStructureRow(value: unknown) {
  const record = parseStrictRecord(value, ["bucket", "label", "metric", "rank", "barPercent", "destination"], "AnalysisMonthStructureRow");
  const bucketRecord = parseStrictRecord(requireProperty(record, "bucket", "AnalysisMonthStructureRow"), ["kind", "familyId", "categoryId", "activityId", "merchantId", "placeId", "key"], "AnalysisStructureBucket");
  const kind = requireProperty(bucketRecord, "kind", "AnalysisStructureBucket");
  const bucket = kind === "family" ? { kind, familyId: text(requireProperty(bucketRecord, "familyId", "AnalysisStructureBucket"), "familyId") } as const
    : kind === "category" ? { kind, categoryId: parseCategoryId(requireProperty(bucketRecord, "categoryId", "AnalysisStructureBucket")) } as const
    : kind === "activity" ? { kind, activityId: parseActivityId(requireProperty(bucketRecord, "activityId", "AnalysisStructureBucket")) } as const
    : kind === "merchant" ? { kind, merchantId: parseMerchantId(requireProperty(bucketRecord, "merchantId", "AnalysisStructureBucket")) } as const
    : kind === "place" ? { kind, placeId: parsePlaceId(requireProperty(bucketRecord, "placeId", "AnalysisStructureBucket")) } as const
    : kind === "canonical" ? { kind, key: text(requireProperty(bucketRecord, "key", "AnalysisStructureBucket"), "canonical key") } as const
    : kind === "undetermined" ? { kind } as const
    : (() => { throw new TypeError("AnalysisStructureBucket.kind invalide."); })();
  const rank = requireProperty(record, "rank", "AnalysisMonthStructureRow");
  if (typeof rank !== "number" || !Number.isSafeInteger(rank) || rank < 1) throw new TypeError("Structure rank invalide.");
  const barPercent = hasOwn(record, "barPercent") ? record.barPercent : undefined;
  if (barPercent !== undefined && (typeof barPercent !== "number" || !Number.isFinite(barPercent) || barPercent < 0 || barPercent > 100)) throw new TypeError("Structure barPercent invalide.");
  return { bucket, label: text(requireProperty(record, "label", "AnalysisMonthStructureRow"), "Structure label"), metric: parseScopedMetricReadModel(requireProperty(record, "metric", "AnalysisMonthStructureRow")), rank, ...(barPercent === undefined ? {} : { barPercent }), ...(hasOwn(record, "destination") ? { destination: parseDestination(record.destination) } : {}) };
}

export function parseAnalysisMonthStructureReadModel(value: unknown): AnalysisMonthStructureReadModel {
  const record = parseStrictRecord(value, ["month", "subject", "activeView", "activeDimension", "activeMeasure", "availableViews", "availableDimensions", "availableMeasures", "supportedCombinations", "unavailableDimensions", "rows", "remainder", "total", "reconciliation", "capabilities"], "AnalysisMonthStructureReadModel");
  const activeView = parseStringLiteral<AnalysisStructureView>(requireProperty(record, "activeView", "AnalysisMonthStructureReadModel"), views, "activeView");
  const activeDimension = parseStringLiteral<AnalysisStructureDimension>(requireProperty(record, "activeDimension", "AnalysisMonthStructureReadModel"), dimensions, "activeDimension");
  const activeMeasure = parseStringLiteral<AnalysisStructureMeasure>(requireProperty(record, "activeMeasure", "AnalysisMonthStructureReadModel"), measures, "activeMeasure");
  const availableViews = array(requireProperty(record, "availableViews", "AnalysisMonthStructureReadModel"), (item) => parseStringLiteral<AnalysisStructureView>(item, views, "availableView"), "availableViews");
  const availableDimensions = array(requireProperty(record, "availableDimensions", "AnalysisMonthStructureReadModel"), (item) => parseStringLiteral<AnalysisStructureDimension>(item, dimensions, "availableDimension"), "availableDimensions");
  const availableMeasures = array(requireProperty(record, "availableMeasures", "AnalysisMonthStructureReadModel"), (item) => parseStringLiteral<AnalysisStructureMeasure>(item, measures, "availableMeasure"), "availableMeasures");
  const supportedCombinations = array(requireProperty(record, "supportedCombinations", "AnalysisMonthStructureReadModel"), (item) => { const combo = parseStrictRecord(item, ["view", "dimension", "measures"], "StructureCombination"); return { view: parseStringLiteral<AnalysisStructureView>(requireProperty(combo, "view", "StructureCombination"), views, "combo view"), dimension: parseStringLiteral<AnalysisStructureDimension>(requireProperty(combo, "dimension", "StructureCombination"), dimensions, "combo dimension"), measures: array(requireProperty(combo, "measures", "StructureCombination"), (measure) => parseStringLiteral<AnalysisStructureMeasure>(measure, measures, "combo measure"), "combo measures") }; }, "supportedCombinations");
  if (!supportedCombinations.some((combo) => combo.view === activeView && combo.dimension === activeDimension && combo.measures.includes(activeMeasure))) throw new TypeError("Structure active combination indisponible.");
  const reconciliation = parseStringLiteral<AnalysisMonthStructureReadModel["reconciliation"]>(requireProperty(record, "reconciliation", "AnalysisMonthStructureReadModel"), new Set(["exact", "partial", "not_applicable"]), "Structure reconciliation");
  const unavailableDimensions = array(requireProperty(record, "unavailableDimensions", "AnalysisMonthStructureReadModel"), (item) => { const value = parseStrictRecord(item, ["dimension", "reason"], "UnavailableStructureDimension"); const dimension = parseStringLiteral<"family" | "necessity">(requireProperty(value, "dimension", "UnavailableStructureDimension"), new Set(["family", "necessity"]), "Unavailable structure dimension"); if (value.reason !== "BLOCKED_CONTRACT") throw new TypeError("Unavailable structure reason invalide."); return { dimension, reason: "BLOCKED_CONTRACT" as const }; }, "unavailableDimensions");
  return { month: parseYearMonth(requireProperty(record, "month", "AnalysisMonthStructureReadModel")), subject: parseReadModelSubject(requireProperty(record, "subject", "AnalysisMonthStructureReadModel")), activeView, activeDimension, activeMeasure, availableViews, availableDimensions, availableMeasures, supportedCombinations, unavailableDimensions, rows: array(requireProperty(record, "rows", "AnalysisMonthStructureReadModel"), parseStructureRow, "Structure rows"), ...(hasOwn(record, "remainder") ? { remainder: parseStructureRow(record.remainder) } : {}), ...(hasOwn(record, "total") ? { total: parseScopedMetricReadModel(record.total) } : {}), reconciliation, capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "AnalysisMonthStructureReadModel"), queryResourceKeys.analysisMonthStructure) };
}

export function parseAnalysisMonthLivedReadModel(value: unknown): AnalysisMonthLivedReadModel {
  const record = parseStrictRecord(value, ["month", "subject", "availableSubviews", "activities", "contexts", "frequencyCost", "capabilities"], "AnalysisMonthLivedReadModel");
  const activities = array(requireProperty(record, "activities", "AnalysisMonthLivedReadModel"), (item) => { const activity = parseStrictRecord(item, ["activityId", "label", "frequency", "cost", "comparison", "qualification", "destination"], "AnalysisLivedActivity"); return { activityId: parseActivityId(requireProperty(activity, "activityId", "AnalysisLivedActivity")), label: text(requireProperty(activity, "label", "AnalysisLivedActivity"), "Activity label"), frequency: parseScopedCountMetricReadModel(requireProperty(activity, "frequency", "AnalysisLivedActivity")), ...(hasOwn(activity, "cost") ? { cost: parseScopedMoneyMetricReadModel(activity.cost) } : {}), ...(hasOwn(activity, "comparison") ? { comparison: parseMoneyComparisonResult(activity.comparison) } : {}), qualification: parseStringLiteral<ComparisonQualification>(requireProperty(activity, "qualification", "AnalysisLivedActivity"), qualifications, "Activity qualification"), destination: parseDestination(requireProperty(activity, "destination", "AnalysisLivedActivity")) }; }, "Lived activities");
  const frequencyCost = parseStrictRecord(requireProperty(record, "frequencyCost", "AnalysisMonthLivedReadModel"), ["kind", "points", "reason"], "FrequencyCostCapability");
  const frequencyCostValue: AnalysisMonthLivedReadModel["frequencyCost"] = frequencyCost.kind === "available"
    ? { kind: "available", points: array(requireProperty(frequencyCost, "points", "FrequencyCostCapability"), (item) => {
        const point = parseStrictRecord(item, ["activityId", "label", "occurrences", "medianCausalCostPerOccurrence", "totalCausalCost", "destination"], "AnalysisFrequencyCostPoint");
        const occurrences = parseScopedCountMetricReadModel(requireProperty(point, "occurrences", "AnalysisFrequencyCostPoint"));
        const median = parseScopedMoneyMetricReadModel(requireProperty(point, "medianCausalCostPerOccurrence", "AnalysisFrequencyCostPoint"));
        const total = parseScopedMoneyMetricReadModel(requireProperty(point, "totalCausalCost", "AnalysisFrequencyCostPoint"));
        if (occurrences.metricId !== "activity_frequency" || median.metricId !== "activity_causal_median_cost_per_occurrence" || total.metricId !== "activity_causal_cost") {
          throw new TypeError("Frequency-cost MetricIds incohérentes.");
        }
        return {
          activityId: parseActivityId(requireProperty(point, "activityId", "AnalysisFrequencyCostPoint")),
          label: text(requireProperty(point, "label", "AnalysisFrequencyCostPoint"), "Frequency-cost label"),
          occurrences,
          medianCausalCostPerOccurrence: median,
          totalCausalCost: total,
          destination: parseDestination(requireProperty(point, "destination", "AnalysisFrequencyCostPoint")),
        };
      }, "FrequencyCost points") }
    : frequencyCost.kind === "unavailable" && frequencyCost.reason === "causal_mapping_unavailable"
      ? { kind: "unavailable", reason: "causal_mapping_unavailable" }
      : (() => { throw new TypeError("FrequencyCost capability invalide."); })();
  return { month: parseYearMonth(requireProperty(record, "month", "AnalysisMonthLivedReadModel")), subject: parseReadModelSubject(requireProperty(record, "subject", "AnalysisMonthLivedReadModel")), availableSubviews: array(requireProperty(record, "availableSubviews", "AnalysisMonthLivedReadModel"), (item) => parseStringLiteral(item, livedSubviews, "Lived subview"), "availableSubviews"), activities, contexts: parseAnalysisContextsBase(requireProperty(record, "contexts", "AnalysisMonthLivedReadModel"), queryResourceKeys.analysisMonthLived), frequencyCost: frequencyCostValue, capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "AnalysisMonthLivedReadModel"), queryResourceKeys.analysisMonthLived) };
}

function parseMoment(value: unknown): MomentPreview {
  const record = parseStrictRecord(value, ["momentId", "title", "media", "startDate", "endDate", "participants", "duration", "economicCost", "destination"], "MomentPreview");
  const media = hasOwn(record, "media") ? (() => { const item = parseStrictRecord(record.media, ["bucket", "path", "alt"], "MomentMediaPreview"); return { bucket: text(requireProperty(item, "bucket", "MomentMediaPreview"), "media bucket"), path: text(requireProperty(item, "path", "MomentMediaPreview"), "media path"), alt: text(requireProperty(item, "alt", "MomentMediaPreview"), "media alt") }; })() : undefined;
  return { momentId: parseMomentId(requireProperty(record, "momentId", "MomentPreview")), title: text(requireProperty(record, "title", "MomentPreview"), "Moment title"), ...(media ? { media } : {}), ...(hasOwn(record, "startDate") ? { startDate: parseLocalDate(record.startDate) } : {}), ...(hasOwn(record, "endDate") ? { endDate: parseLocalDate(record.endDate) } : {}), participants: array(requireProperty(record, "participants", "MomentPreview"), (item) => { const participant = parseStrictRecord(item, ["personId", "label"], "MomentParticipant"); return { personId: parsePersonId(requireProperty(participant, "personId", "MomentParticipant")), ...(hasOwn(participant, "label") ? { label: text(participant.label, "Participant label") } : {}) }; }, "Moment participants"), ...(hasOwn(record, "duration") ? { duration: text(record.duration, "Moment duration") } : {}), ...(hasOwn(record, "economicCost") ? { economicCost: parseScopedMoneyMetricReadModel(record.economicCost) } : {}), destination: parseDestination(requireProperty(record, "destination", "MomentPreview")) };
}

export function parseAnalysisMonthMomentsReadModel(value: unknown): AnalysisMonthMomentsReadModel {
  const record = parseStrictRecord(value, ["month", "subject", "moments", "capabilities"], "AnalysisMonthMomentsReadModel");
  return { month: parseYearMonth(requireProperty(record, "month", "AnalysisMonthMomentsReadModel")), subject: parseReadModelSubject(requireProperty(record, "subject", "AnalysisMonthMomentsReadModel")), moments: array(requireProperty(record, "moments", "AnalysisMonthMomentsReadModel"), parseMoment, "Moments"), capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "AnalysisMonthMomentsReadModel"), queryResourceKeys.analysisMonthMoments) };
}

export function parseAnalysisTargetReadModel(value: unknown): AnalysisTargetReadModel {
  const record = parseStrictRecord(value, ["month", "subject", "target", "status", "headlineMetrics", "capabilities"], "AnalysisTargetReadModel");
  return { month: parseYearMonth(requireProperty(record, "month", "AnalysisTargetReadModel")), subject: parseReadModelSubject(requireProperty(record, "subject", "AnalysisTargetReadModel")), target: parseAnalysisTargetSubject(requireProperty(record, "target", "AnalysisTargetReadModel")), status: parseStringLiteral(requireProperty(record, "status", "AnalysisTargetReadModel"), new Set(["available", "outside_scope", "unsupported", "blocked_contract"]), "AnalysisTarget status"), headlineMetrics: array(requireProperty(record, "headlineMetrics", "AnalysisTargetReadModel"), parseScopedMetricReadModel, "Target headline metrics"), capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "AnalysisTargetReadModel"), queryResourceKeys.analysisTarget) };
}

export function parseAnalysisMonthContextsReadModel(value: unknown): AnalysisMonthContextsReadModel {
  const record = parseStrictRecord(value, ["month", "subject", "contexts"], "AnalysisMonthContextsReadModel");
  return { month: parseYearMonth(requireProperty(record, "month", "AnalysisMonthContextsReadModel")), subject: parseReadModelSubject(requireProperty(record, "subject", "AnalysisMonthContextsReadModel")), contexts: parseAnalysisContextsBase(requireProperty(record, "contexts", "AnalysisMonthContextsReadModel"), queryResourceKeys.analysisMonthContexts) };
}
