import { getMetricRegistryEntry, isActiveMetricId } from "../../../analytics/production";
import {
  parseActivityId,
  parseMerchantId,
  parseMomentId,
  parsePlaceId,
} from "../../../core/identity";
import { parseSupport } from "../../../core/metrics";
import { parseGlobalWindow, parseYearMonth, resolveGlobalWindowMonths } from "../../../core/time";
import {
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../../../core/validation";
import { parseQueryCapabilities } from "../../capabilities";
import { parsePersonaTarget, queryResourceKeys } from "../../request";
import {
  parseCountEnvelope,
  parseReadModelSubject,
  parseScopedMetricReadModel,
  parseScopedMoneyMetricReadModel,
} from "../../read-models";
import { parseAnalysisBreakdownReadModel, parseAnalysisContextsBase, parseAnalysisSeriesPoints } from "../shared/validation";
import type {
  AnalysisGlobalBaselineReadModel,
  AnalysisGlobalBreakdownReadModel,
  AnalysisGlobalContextsReadModel,
  AnalysisGlobalEvolutionReadModel,
  AnalysisGlobalHabitsReadModel,
  AnalysisGlobalIdentity,
  AnalysisGlobalInitialReadModel,
  AnalysisGlobalProfilesReadModel,
  AnalysisGlobalTypicalReadModel,
  AnalysisGlobalUniverseReadModel,
  GlobalReferenceSlot,
  GlobalRankedRef,
  TypicalBehaviorRow,
} from "./types";

function array<T>(value: unknown, parser: (item: unknown) => T, name: string): readonly T[] {
  if (!Array.isArray(value)) throw new TypeError(`${name} doit être un tableau.`);
  return value.map(parser);
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} doit être non vide.`);
  return value;
}

function count(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} doit être un entier positif ou nul.`);
  return value;
}

function ratio(value: unknown, name: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new TypeError(`${name} doit être compris entre 0 et 1.`);
  return value;
}

function globalIdentity(record: ReturnType<typeof parseStrictRecord>, typeName: string): AnalysisGlobalIdentity {
  return {
    observationWindow: parseGlobalWindow(requireProperty(record, "observationWindow", typeName)),
    asOf: parseYearMonth(requireProperty(record, "asOf", typeName)),
    subject: parseReadModelSubject(requireProperty(record, "subject", typeName)),
  };
}

function referenceSlot(value: unknown): GlobalReferenceSlot {
  const candidate = parseStrictRecord(value, ["status", "metric", "reason"], "GlobalReferenceSlot");
  const status = requireProperty(candidate, "status", "GlobalReferenceSlot");
  if (status === "available") {
    const record = parseStrictRecord(value, ["status", "metric"], "AvailableGlobalReference");
    return { status, metric: parseScopedMoneyMetricReadModel(requireProperty(record, "metric", "AvailableGlobalReference")) };
  }
  if (status !== "unavailable") throw new TypeError("GlobalReferenceSlot.status est invalide.");
  const record = parseStrictRecord(value, ["status", "reason"], "UnavailableGlobalReference");
  return {
    status,
    reason: parseStringLiteral(requireProperty(record, "reason", "UnavailableGlobalReference"), new Set(["missing_source", "blocked_data", "not_applicable"]), "GlobalReferenceSlot.reason"),
  };
}

export function parseAnalysisGlobalInitialReadModel(value: unknown): AnalysisGlobalInitialReadModel {
  const typeName = "AnalysisGlobalInitialReadModel";
  const record = parseStrictRecord(value, ["observationWindow", "asOf", "subject", "documentedMonths", "documentedActivities", "momentsCount", "observedPlacesCount", "operationsCount", "economicConsumptionNetAttributable", "capabilities"], typeName);
  const economic = parseScopedMoneyMetricReadModel(requireProperty(record, "economicConsumptionNetAttributable", typeName));
  if (economic.metricId !== "economic_consumption_net_attributable") throw new TypeError("La métrique économique Global initial est invalide.");
  return {
    ...globalIdentity(record, typeName),
    documentedMonths: parseCountEnvelope(requireProperty(record, "documentedMonths", typeName)),
    documentedActivities: parseCountEnvelope(requireProperty(record, "documentedActivities", typeName)),
    momentsCount: parseCountEnvelope(requireProperty(record, "momentsCount", typeName)),
    observedPlacesCount: parseCountEnvelope(requireProperty(record, "observedPlacesCount", typeName)),
    operationsCount: parseCountEnvelope(requireProperty(record, "operationsCount", typeName)),
    economicConsumptionNetAttributable: economic,
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", typeName), queryResourceKeys.analysisGlobalInitial),
  };
}

export function parseAnalysisGlobalBaselineReadModel(value: unknown): AnalysisGlobalBaselineReadModel {
  const typeName = "AnalysisGlobalBaselineReadModel";
  const record = parseStrictRecord(value, ["observationWindow", "asOf", "subject", "defaultView", "day", "week", "month", "capabilities"], typeName);
  if (requireProperty(record, "defaultView", typeName) !== "month") throw new TypeError("Baseline defaultView doit valoir month.");
  const day = parseStrictRecord(requireProperty(record, "day", typeName), ["neutral", "typical"], "GlobalDayBaseline");
  const week = parseStrictRecord(requireProperty(record, "week", typeName), ["neutral", "calendarAdjustedNeutral"], "GlobalWeekBaseline");
  const month = parseStrictRecord(requireProperty(record, "month", typeName), ["minimal", "calendarAdjustedNeutral"], "GlobalMonthBaseline");
  const minimal = referenceSlot(requireProperty(month, "minimal", "GlobalMonthBaseline"));
  if (minimal.status === "available" && minimal.metric.metricId !== "minimal_month_cost") throw new TypeError("Baseline Month doit réutiliser minimal_month_cost.");
  return {
    ...globalIdentity(record, typeName),
    defaultView: "month",
    day: { neutral: referenceSlot(requireProperty(day, "neutral", "GlobalDayBaseline")), typical: referenceSlot(requireProperty(day, "typical", "GlobalDayBaseline")) },
    week: { neutral: referenceSlot(requireProperty(week, "neutral", "GlobalWeekBaseline")), calendarAdjustedNeutral: referenceSlot(requireProperty(week, "calendarAdjustedNeutral", "GlobalWeekBaseline")) },
    month: { minimal, calendarAdjustedNeutral: referenceSlot(requireProperty(month, "calendarAdjustedNeutral", "GlobalMonthBaseline")) },
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", typeName), queryResourceKeys.analysisGlobalBaseline),
  };
}

function typicalBehavior(value: unknown): TypicalBehaviorRow {
  const record = parseStrictRecord(value, ["activityId", "label", "activePeriodCount", "observablePeriodCount", "activityRate", "habitualFrequency", "support", "variability", "destination"], "TypicalBehaviorRow");
  const activityId = parseActivityId(requireProperty(record, "activityId", "TypicalBehaviorRow"));
  const variability = parseStrictRecord(requireProperty(record, "variability", "TypicalBehaviorRow"), ["status", "reason"], "TypicalVariability");
  if (variability.status !== "unavailable" || variability.reason !== "missing_contract") throw new TypeError("Typical variability doit exposer le blocage contractuel actuel.");
  const destination = parseStrictRecord(requireProperty(record, "destination", "TypicalBehaviorRow"), ["kind", "target"], "TypicalBehaviorDestination");
  const target = parseStrictRecord(requireProperty(destination, "target", "TypicalBehaviorDestination"), ["kind", "activityId"], "TypicalBehaviorTarget");
  if (destination.kind !== "target" || target.kind !== "activity" || parseActivityId(target.activityId) !== activityId) throw new TypeError("Typical behavior destination est incohérente.");
  const habitual = requireProperty(record, "habitualFrequency", "TypicalBehaviorRow");
  if (habitual !== null && (typeof habitual !== "number" || !Number.isFinite(habitual) || habitual < 0)) throw new TypeError("Habitual frequency est invalide.");
  return {
    activityId,
    label: text(requireProperty(record, "label", "TypicalBehaviorRow"), "TypicalBehaviorRow.label"),
    activePeriodCount: count(requireProperty(record, "activePeriodCount", "TypicalBehaviorRow"), "activePeriodCount"),
    observablePeriodCount: count(requireProperty(record, "observablePeriodCount", "TypicalBehaviorRow"), "observablePeriodCount"),
    activityRate: ratio(requireProperty(record, "activityRate", "TypicalBehaviorRow"), "activityRate"),
    habitualFrequency: habitual,
    support: parseSupport(requireProperty(record, "support", "TypicalBehaviorRow")),
    variability: { status: "unavailable", reason: "missing_contract" },
    destination: { kind: "target", target: { kind: "activity", activityId } },
  };
}

export function parseAnalysisGlobalTypicalReadModel(value: unknown): AnalysisGlobalTypicalReadModel {
  const typeName = "AnalysisGlobalTypicalReadModel";
  const record = parseStrictRecord(value, ["observationWindow", "asOf", "subject", "monthlyTypical", "behaviorRows", "capabilities"], typeName);
  const monthlyTypical = referenceSlot(requireProperty(record, "monthlyTypical", typeName));
  if (monthlyTypical.status === "available" && monthlyTypical.metric.metricId !== "typical_month_cost") throw new TypeError("Global Typical doit réutiliser typical_month_cost.");
  return {
    ...globalIdentity(record, typeName),
    monthlyTypical,
    behaviorRows: array(requireProperty(record, "behaviorRows", typeName), typicalBehavior, "Typical behavior rows"),
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", typeName), queryResourceKeys.analysisGlobalTypical),
  };
}

export function parseAnalysisGlobalEvolutionReadModel(value: unknown): AnalysisGlobalEvolutionReadModel {
  const typeName = "AnalysisGlobalEvolutionReadModel";
  const record = parseStrictRecord(value, ["observationWindow", "asOf", "subject", "view", "series", "smallMultiplesRecommended", "capabilities"], typeName);
  const identity = globalIdentity(record, typeName);
  const view = parseStringLiteral<"money" | "behavior">(requireProperty(record, "view", typeName), new Set(["money", "behavior"]), "Global evolution view");
  const allowedPeriods = new Set(resolveGlobalWindowMonths(identity.observationWindow, identity.asOf));
  const series = array(requireProperty(record, "series", typeName), (item) => {
    const seriesRecord = parseStrictRecord(item, ["seriesId", "label", "metricId", "unit", "points"], "GlobalEvolutionSeries");
    const metricId = requireProperty(seriesRecord, "metricId", "GlobalEvolutionSeries");
    if (!isActiveMetricId(metricId)) throw new TypeError("Global evolution MetricId est invalide.");
    const definition = getMetricRegistryEntry(metricId);
    if ((view === "money") !== (definition.outputKind === "money")) throw new TypeError("Global evolution mélange des unités incompatibles.");
    const points = parseAnalysisSeriesPoints(requireProperty(seriesRecord, "points", "GlobalEvolutionSeries"), metricId);
    if (points.some(({ period }) => !allowedPeriods.has(period))) throw new TypeError("Global evolution contient un point hors fenêtre.");
    const unit = text(requireProperty(seriesRecord, "unit", "GlobalEvolutionSeries"), "Global evolution unit");
    if (unit !== definition.unit) throw new TypeError("Global evolution unit est incohérente.");
    return { seriesId: text(requireProperty(seriesRecord, "seriesId", "GlobalEvolutionSeries"), "seriesId"), label: text(requireProperty(seriesRecord, "label", "GlobalEvolutionSeries"), "series label"), metricId, unit, points };
  }, "Global evolution series");
  return {
    ...identity,
    view,
    series,
    smallMultiplesRecommended: requireProperty(record, "smallMultiplesRecommended", typeName) === true,
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", typeName), queryResourceKeys.analysisGlobalEvolution),
  };
}

export function parseAnalysisGlobalHabitsReadModel(value: unknown): AnalysisGlobalHabitsReadModel {
  const typeName = "AnalysisGlobalHabitsReadModel";
  const record = parseStrictRecord(value, ["observationWindow", "asOf", "subject", "view", "availableViews", "content", "capabilities"], typeName);
  const view = parseStringLiteral<"contexts" | "heatmap" | "relationships" | "patterns">(requireProperty(record, "view", typeName), new Set(["contexts", "heatmap", "relationships", "patterns"]), "Global habits view");
  const availableViews = array(requireProperty(record, "availableViews", typeName), (item) => parseStringLiteral<"contexts" | "heatmap">(item, new Set(["contexts", "heatmap"]), "Available habits view"), "Available habits views");
  const contentRecord = parseStrictRecord(requireProperty(record, "content", typeName), ["kind", "contexts", "heatmap", "reason"], "GlobalHabitsContent");
  let content: AnalysisGlobalHabitsReadModel["content"];
  if (contentRecord.kind === "contexts") {
    const exact = parseStrictRecord(record.content, ["kind", "contexts"], "GlobalHabitsContexts");
    content = { kind: "contexts", contexts: parseAnalysisContextsBase(requireProperty(exact, "contexts", "GlobalHabitsContexts"), queryResourceKeys.analysisGlobalHabits) };
  } else if (contentRecord.kind === "heatmap") {
    const exact = parseStrictRecord(record.content, ["kind", "heatmap"], "GlobalHabitsHeatmap");
    const heatmap = parseStrictRecord(requireProperty(exact, "heatmap", "GlobalHabitsHeatmap"), ["contract", "unit", "palette", "rows", "columns", "cells"], "ActivityMonthHeatmap");
    if (heatmap.contract !== "activity_month_frequency" || heatmap.unit !== "count/month" || heatmap.palette !== "sequential") throw new TypeError("Heatmap contract est invalide.");
    const rows = array(requireProperty(heatmap, "rows", "ActivityMonthHeatmap"), (item) => { const row = parseStrictRecord(item, ["id", "label"], "HeatmapRow"); return { id: parseActivityId(requireProperty(row, "id", "HeatmapRow")), label: text(requireProperty(row, "label", "HeatmapRow"), "Heatmap row label") }; }, "Heatmap rows");
    const columns = array(requireProperty(heatmap, "columns", "ActivityMonthHeatmap"), parseYearMonth, "Heatmap columns");
    const cells = array(requireProperty(heatmap, "cells", "ActivityMonthHeatmap"), (item) => { const cell = parseStrictRecord(item, ["rowId", "columnId", "state", "value"], "HeatmapCell"); const state = parseStringLiteral<"known" | "unknown" | "not_applicable" | "insufficient_support" | "conflict" | "estimated">(requireProperty(cell, "state", "HeatmapCell"), new Set(["known", "unknown", "not_applicable", "insufficient_support", "conflict", "estimated"]), "Heatmap cell state"); const rawValue = requireProperty(cell, "value", "HeatmapCell"); if ((state === "known") !== (typeof rawValue === "number" && Number.isSafeInteger(rawValue) && rawValue >= 0)) { if (!(state !== "known" && rawValue === null)) throw new TypeError("Heatmap cell value est incohérente."); } return { rowId: parseActivityId(requireProperty(cell, "rowId", "HeatmapCell")), columnId: parseYearMonth(requireProperty(cell, "columnId", "HeatmapCell")), state, value: rawValue as number | null }; }, "Heatmap cells");
    content = { kind: "heatmap", heatmap: { contract: "activity_month_frequency", unit: "count/month", palette: "sequential", rows, columns, cells } };
  } else {
    const exact = parseStrictRecord(record.content, ["kind", "reason"], "UnavailableGlobalHabits");
    if (exact.kind !== "unavailable" || exact.reason !== "missing_method_or_source") throw new TypeError("Global habits unavailable est invalide.");
    content = { kind: "unavailable", reason: "missing_method_or_source" };
  }
  return { ...globalIdentity(record, typeName), view, availableViews, content, capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", typeName), queryResourceKeys.analysisGlobalHabits) };
}

function rankedRef<Id extends string>(value: unknown, parseId: (raw: unknown) => Id): GlobalRankedRef<Id> {
  const record = parseStrictRecord(value, ["id", "label", "count", "support"], "GlobalRankedRef");
  return { id: parseId(requireProperty(record, "id", "GlobalRankedRef")), label: text(requireProperty(record, "label", "GlobalRankedRef"), "GlobalRankedRef.label"), count: count(requireProperty(record, "count", "GlobalRankedRef"), "GlobalRankedRef.count"), support: parseSupport(requireProperty(record, "support", "GlobalRankedRef")) };
}

export function parseAnalysisGlobalProfilesReadModel(value: unknown): AnalysisGlobalProfilesReadModel {
  const typeName = "AnalysisGlobalProfilesReadModel";
  const record = parseStrictRecord(value, ["observationWindow", "asOf", "subject", "target", "label", "dominantActivity", "frequentPlace", "dominantContext", "destination", "capabilities"], typeName);
  const target = parsePersonaTarget(requireProperty(record, "target", typeName));
  const destination = parseStrictRecord(requireProperty(record, "destination", typeName), ["kind", "target"], "GlobalProfileDestination");
  if (destination.kind !== "persona" || JSON.stringify(parsePersonaTarget(destination.target)) !== JSON.stringify(target)) throw new TypeError("Profile destination est incohérente.");
  return {
    ...globalIdentity(record, typeName), target, label: text(requireProperty(record, "label", typeName), "Profile label"),
    ...(hasOwn(record, "dominantActivity") ? { dominantActivity: rankedRef(record.dominantActivity, parseActivityId) } : {}),
    ...(hasOwn(record, "frequentPlace") ? { frequentPlace: rankedRef(record.frequentPlace, parsePlaceId) } : {}),
    ...(hasOwn(record, "dominantContext") ? { dominantContext: rankedRef(record.dominantContext, (raw) => text(raw, "Context id")) } : {}),
    destination: { kind: "persona", target },
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", typeName), queryResourceKeys.analysisGlobalProfiles),
  };
}

export function parseAnalysisGlobalUniverseReadModel(value: unknown): AnalysisGlobalUniverseReadModel {
  const typeName = "AnalysisGlobalUniverseReadModel";
  const record = parseStrictRecord(value, ["observationWindow", "asOf", "subject", "moments", "places", "merchants", "capabilities"], typeName);
  const moments = parseStrictRecord(requireProperty(record, "moments", typeName), ["sort", "items", "hasMore"], "UniverseMoments");
  const places = parseStrictRecord(requireProperty(record, "places", typeName), ["sort", "items", "hasMore"], "UniversePlaces");
  const merchants = parseStrictRecord(requireProperty(record, "merchants", typeName), ["sort", "items", "hasMore"], "UniverseMerchants");
  if (moments.sort !== "recent" || places.sort !== "frequent" || merchants.sort !== "spent") throw new TypeError("Universe sort doit suivre les Gallery policies.");
  const momentItems = array(requireProperty(moments, "items", "UniverseMoments"), (item) => { const card = parseStrictRecord(item, ["momentId", "title"], "MomentGalleryCard"); return { momentId: parseMomentId(requireProperty(card, "momentId", "MomentGalleryCard")), title: text(requireProperty(card, "title", "MomentGalleryCard"), "Moment title") }; }, "Universe moments");
  const placeItems = array(requireProperty(places, "items", "UniversePlaces"), (item) => { const card = parseStrictRecord(item, ["placeId", "label", "visitCount", "localizedSpend"], "PlaceGalleryCard"); return { placeId: parsePlaceId(requireProperty(card, "placeId", "PlaceGalleryCard")), label: text(requireProperty(card, "label", "PlaceGalleryCard"), "Place label"), ...(hasOwn(card, "visitCount") ? { visitCount: parseScopedMetricReadModel(card.visitCount) as never } : {}), ...(hasOwn(card, "localizedSpend") ? { localizedSpend: parseScopedMetricReadModel(card.localizedSpend) as never } : {}) }; }, "Universe places");
  const merchantItems = array(requireProperty(merchants, "items", "UniverseMerchants"), (item) => { const card = parseStrictRecord(item, ["merchantId", "label", "economicAmount", "purchaseCount"], "MerchantGalleryCard"); return { merchantId: parseMerchantId(requireProperty(card, "merchantId", "MerchantGalleryCard")), label: text(requireProperty(card, "label", "MerchantGalleryCard"), "Merchant label"), ...(hasOwn(card, "economicAmount") ? { economicAmount: parseScopedMetricReadModel(card.economicAmount) as never } : {}), ...(hasOwn(card, "purchaseCount") ? { purchaseCount: parseScopedMetricReadModel(card.purchaseCount) as never } : {}) }; }, "Universe merchants");
  if (momentItems.length > 4 || placeItems.length > 6 || merchantItems.length > 6) throw new TypeError("Universe preview dépasse sa limite produit.");
  return { ...globalIdentity(record, typeName), moments: { sort: "recent", items: momentItems, hasMore: moments.hasMore === true }, places: { sort: "frequent", items: placeItems, hasMore: places.hasMore === true }, merchants: { sort: "spent", items: merchantItems, hasMore: merchants.hasMore === true }, capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", typeName), queryResourceKeys.analysisGlobalUniverse) };
}

export function parseAnalysisGlobalBreakdownReadModel(value: unknown): AnalysisGlobalBreakdownReadModel {
  const typeName = "AnalysisGlobalBreakdownReadModel";
  const record = parseStrictRecord(value, ["observationWindow", "asOf", "subject", "breakdown"], typeName);
  return { ...globalIdentity(record, typeName), breakdown: parseAnalysisBreakdownReadModel(requireProperty(record, "breakdown", typeName), queryResourceKeys.analysisGlobalBreakdown) };
}

export function parseAnalysisGlobalContextsReadModel(value: unknown): AnalysisGlobalContextsReadModel {
  const typeName = "AnalysisGlobalContextsReadModel";
  const record = parseStrictRecord(value, ["observationWindow", "asOf", "subject", "contexts"], typeName);
  return { ...globalIdentity(record, typeName), contexts: parseAnalysisContextsBase(requireProperty(record, "contexts", typeName), queryResourceKeys.analysisGlobalContexts) };
}
