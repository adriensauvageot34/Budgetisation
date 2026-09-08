import "server-only";

import { createHash } from "node:crypto";

import { LIFE_EVENT_ACTIVITY_CATALOG } from "@/analytics/history-v2/calendar/catalog";
import {
  GlobalMaterialityEngine,
  GlobalPublicationEngine,
  type GlobalPublicationDecision,
} from "@/analytics/global-v2";
import {
  canonicalSerializeGlobal,
  computeGlobalAnalysisScopeV2Hash,
  normalizeGlobalAnalysisScopeV2,
  type GlobalAnalysisScopeV2,
  type GlobalMaterialityCandidate,
  type GlobalScopeValidationContext,
} from "@/core/global-v2";
import {
  buildGlobalExpandedReadModel,
  buildGlobalInitialReadModel,
  buildGlobalModuleCompactReadModel,
  buildImportedGlobalSummaryReadModel,
  GLOBAL_MAX_SECTION_ROWS,
  globalPrimaryModuleCatalog,
  globalV2ExpandedResourceCatalog,
  globalV2QueryRegistry,
  type GlobalCompactInsight,
  type GlobalCompactKpi,
  type GlobalCompactQuality,
  type GlobalDetailMetric,
  type GlobalDetailRow,
  type GlobalDetailSeries,
  type GlobalPhenomenonQuality,
  type GlobalTypedMeasure,
  type GlobalExpandedSectionKey,
  type GlobalModuleCapability,
  type GlobalPrimaryModuleKey,
  type GlobalReadModelPublicationMeta,
  type GlobalReadModelResourceMeta,
  type GlobalV2ExpandedResourceName,
  type GlobalV2QueryParams,
  type GlobalV2QueryResourceName,
} from "@/query-api/global-v2";
import {
  attachGlobalV2QueryPlanToManifest,
  buildGlobalV2QueryPlan,
  globalV2QueryInstanceKey,
  globalV2QueryMethodSignature,
  globalV2QueryResourceInputHash,
  type GlobalV2QueryInstanceInput,
} from "@/server/analytics/materialization/global-query-plan";
import {
  globalV2ClosureDeclarationDigest,
  globalV2ClosureInputDigest,
  globalV2ManifestFormatVersion,
  globalV2PublicationProfileId,
  globalV2ResourceFamilies,
  type GlobalV2ResolvedDependency,
  type GlobalV2ResourceVersion,
} from "@/server/analytics/materialization/global-v2";

const GIT_SHA = /^[0-9a-f]{40}$/u;

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalSerializeGlobal(value), "utf8").digest("hex");
}

function deterministicUuid(value: unknown): string {
  const hex = digest(value).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = (["8", "9", "a", "b"] as const)[Number.parseInt(hex[16]!, 16) % 4]!;
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

export type GlobalV2OwnerOutput = {
  readonly moduleKey: GlobalPrimaryModuleKey;
  readonly owner: string;
  readonly output: unknown;
  readonly knowledge: "KNOWN" | "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT";
  readonly capabilityState: GlobalModuleCapability["state"];
  readonly reasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
};

export type GlobalV2CandidateInput = {
  readonly project: string;
  readonly householdId: string;
  readonly householdTimeZone: string;
  readonly personIds: readonly string[];
  readonly asOf: string;
  readonly certifiedThrough: string;
  readonly dataRevision: string;
  readonly analyticsRevision: string;
  readonly implementationIdentity: string;
  readonly ownerOutputs: readonly GlobalV2OwnerOutput[];
  readonly presentationLabels?: GlobalV2PresentationLabels;
};

export type GlobalV2PresentationLabels = {
  readonly persons?: Readonly<Record<string, string>>;
  readonly places?: Readonly<Record<string, string>>;
  readonly categories?: Readonly<Record<string, string>>;
  readonly needs?: Readonly<Record<string, string>>;
};

export function globalV2M6HasPresentationContent(value: unknown): boolean {
  const output = recordOf(value);
  return output !== undefined
    && ["summaries", "comparisons", "series", "narrative"].some((key) => arrayOf(output[key]).length > 0);
}

type RecordValue = Readonly<Record<string, unknown>>;
type SectionProjection = {
  readonly metrics?: readonly GlobalDetailMetric[];
  readonly series?: readonly GlobalDetailSeries[];
  readonly rows?: readonly GlobalDetailRow[];
};
type ModuleProjection = {
  readonly primaryInsight?: GlobalCompactInsight;
  readonly kpis: readonly GlobalCompactKpi[];
  readonly sections: Readonly<Partial<Record<GlobalExpandedSectionKey, SectionProjection>>>;
  readonly detailRows: readonly GlobalDetailRow[];
};

const recordOf = (value: unknown): RecordValue | undefined => value !== null && typeof value === "object" && !Array.isArray(value)
  ? value as RecordValue
  : undefined;
const arrayOf = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : [];
const at = (value: unknown, ...path: readonly string[]): unknown => path.reduce<unknown>((current, key) => recordOf(current)?.[key], value);
const stringOf = (value: unknown): string | undefined => typeof value === "string" && value.trim().length > 0 ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : undefined;
const numberOf = (value: unknown): number | undefined => {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim().length > 0 ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
};
const uniqueSorted = (values: readonly string[]): readonly string[] => [...new Set(values)].sort();

function formatNumber(value: unknown, maximumFractionDigits = 2): string | undefined {
  const numeric = numberOf(value);
  return numeric === undefined ? undefined : new Intl.NumberFormat("fr-FR", { maximumFractionDigits }).format(numeric);
}

function formatMoney(value: unknown): string | undefined {
  const formatted = formatNumber(value, 2);
  return formatted === undefined ? undefined : `${formatted} €`;
}

function formatSignedMoney(value: unknown): string | undefined {
  const numeric = numberOf(value);
  const formatted = formatMoney(numeric === undefined ? undefined : Math.abs(numeric));
  return formatted === undefined ? undefined : `${numeric! > 0 ? "+" : numeric! < 0 ? "−" : ""}${formatted}`;
}

function activityLabel(activityId: string): string | undefined {
  return LIFE_EVENT_ACTIVITY_CATALOG[activityId as keyof typeof LIFE_EVENT_ACTIVITY_CATALOG]?.publicLabel;
}

function personLabel(personId: string, labels: GlobalV2PresentationLabels, personIds: readonly string[]): string {
  const index = [...personIds].sort().indexOf(personId);
  return labels.persons?.[personId] ?? (index < 0 ? "Personne non identifiée" : `Personne ${index + 1}`);
}

function outputEvidence(output: GlobalV2OwnerOutput, ...extra: readonly string[]): readonly string[] {
  return uniqueSorted([...output.evidenceRefs, ...extra]);
}

function metric(output: GlobalV2OwnerOutput, metricId: string, labelKey: string, displayValue: string, knowledgeState: GlobalDetailMetric["knowledgeState"] = output.knowledge): GlobalDetailMetric {
  return {
    metricId,
    labelKey,
    displayValue,
    knowledgeState,
    ...(knowledgeState === "PARTIAL" ? { partialMeaning: "OBSERVED_ONLY" as const } : {}),
    dataNature: "OBSERVED",
    evidenceRefs: outputEvidence(output),
  };
}

function row(output: GlobalV2OwnerOutput, rank: number, rowId: string, labelKey: string, displayValue: string, entityRef?: string, knowledgeState: GlobalDetailRow["knowledgeState"] = output.knowledge): GlobalDetailRow {
  return {
    rowId: `${String(rank).padStart(3, "0")}:${rowId}`,
    labelKey,
    displayValue,
    knowledgeState,
    ...(entityRef === undefined ? {} : { entityRef }),
    evidenceRefs: outputEvidence(output),
  };
}

function series(output: GlobalV2OwnerOutput, seriesId: string, labelKey: string, unit: string, points: readonly unknown[], unitKey: string, valueKey: string): GlobalDetailSeries {
  return {
    seriesId,
    labelKey,
    unit,
    points: points.flatMap((point) => {
      const pointUnit = stringOf(at(point, unitKey));
      const value = stringOf(at(point, valueKey));
      return pointUnit === undefined || value === undefined ? [] : [{ unitKey: pointUnit, displayValue: value, knowledgeState: "KNOWN" as const }];
    }),
    evidenceRefs: outputEvidence(output),
  };
}

function kpi(output: GlobalV2OwnerOutput, kpiId: string, labelKey: string, displayValue: string, metricRef: string): GlobalCompactKpi {
  return { kpiId, phenomenonId: `presentation:${output.moduleKey.toLowerCase()}`, labelKey, displayValue, metricRef, evidenceRefs: outputEvidence(output) };
}

function knowledgeOf(value: unknown): GlobalPhenomenonQuality["knowledgeState"] {
  const status = stringOf(at(value, "status"));
  return status === "KNOWN" || status === "PARTIAL" || status === "UNKNOWN" || status === "NOT_APPLICABLE" || status === "CONFLICT" ? status : "UNKNOWN";
}

function typedMeasure(value: unknown, kind: GlobalTypedMeasure["kind"], unit: string): GlobalTypedMeasure | undefined {
  const textValue = stringOf(value);
  return textValue === undefined ? undefined : { kind, value: textValue, unit };
}

function phenomenonQuality(value: unknown, fallbackInputHash: unknown, ...limitations: readonly string[]): GlobalPhenomenonQuality {
  const status = knowledgeOf(value);
  const supportStatus = stringOf(at(value, "support", "supportStatus"));
  const effectiveCoverage = numberOf(at(value, "coverage", "effective"));
  const materialityStatus = stringOf(at(value, "materiality", "status"));
  const reasonCode = stringOf(at(value, "reasonCode"));
  const nature = stringOf(at(value, "provenance", "resultNature"));
  return {
    knowledgeState: status,
    ...(supportStatus === "INSUFFICIENT" || supportStatus === "PARTIAL_SUPPORT" || supportStatus === "SUFFICIENT" || supportStatus === "STRONG" ? { supportStatus } : {}),
    ...(effectiveCoverage === undefined ? {} : { effectiveCoverage }),
    ...(materialityStatus === "MATERIAL" || materialityStatus === "NOT_MATERIAL" || materialityStatus === "UNKNOWN" ? { materialityStatus } : {}),
    limitationCodes: uniqueSorted([...(reasonCode === undefined ? [] : [reasonCode]), ...limitations]),
    dataNature: nature === "DECLARED" || nature === "ESTIMATED" || nature === "HYBRID" ? nature : "OBSERVED",
    methodVersion: stringOf(at(value, "methodVersion")) ?? "global-m1-query-projection@v2",
    inputHash: stringOf(at(value, "inputHash")) ?? stringOf(fallbackInputHash) ?? digest({ phenomenon: value, limitations }),
  };
}

function qualifiedMetric(output: GlobalV2OwnerOutput, metricId: string, labelKey: string, value: unknown, options: { readonly kind?: GlobalTypedMeasure["kind"]; readonly unit?: string; readonly signed?: boolean; readonly phenomenonRef?: string; readonly fallbackInputHash?: unknown } = {}): GlobalDetailMetric {
  const status = knowledgeOf(value);
  const raw = at(value, "value");
  const measure = typedMeasure(raw, options.kind ?? "MONEY", options.unit ?? stringOf(at(value, "unit")) ?? "EUR/month");
  const formatted = options.kind === "RATIO" || options.kind === "DECIMAL" ? formatNumber(raw, 4) : options.signed ? formatSignedMoney(raw) : formatMoney(raw);
  return {
    metricId,
    labelKey,
    displayValue: formatted ?? "Indisponible",
    ...(measure === undefined ? {} : { typedMeasure: measure }),
    phenomenonRef: options.phenomenonRef ?? `global-m1:${metricId}`,
    phenomenonQuality: phenomenonQuality(value, options.fallbackInputHash ?? at(output.output, "inputHash")),
    knowledgeState: status,
    ...(status === "PARTIAL" ? { partialMeaning: "OBSERVED_ONLY" as const } : {}),
    dataNature: phenomenonQuality(value, options.fallbackInputHash ?? at(output.output, "inputHash")).dataNature,
    evidenceRefs: outputEvidence(output, ...arrayOf(at(value, "provenance", "evidenceRefs")).filter((entry): entry is string => typeof entry === "string")),
  };
}

function qualifiedKpi(output: GlobalV2OwnerOutput, kpiId: string, labelKey: string, value: unknown, metricRef: string): GlobalCompactKpi {
  const raw = at(value, "value");
  const measure = typedMeasure(raw, "MONEY", stringOf(at(value, "unit")) ?? "EUR/month");
  return {
    kpiId,
    phenomenonId: "global-m1:economic-state",
    labelKey,
    displayValue: formatMoney(raw) ?? "Indisponible pour ce mois",
    ...(measure === undefined ? {} : { typedMeasure: measure }),
    phenomenonRef: metricRef,
    phenomenonQuality: phenomenonQuality(value, at(output.output, "inputHash")),
    metricRef,
    evidenceRefs: outputEvidence(output, ...arrayOf(at(value, "provenance", "evidenceRefs")).filter((entry): entry is string => typeof entry === "string")),
  };
}

function qualifiedRow(output: GlobalV2OwnerOutput, rank: number, rowId: string, labelKey: string, value: unknown, entityRef?: string): GlobalDetailRow {
  const raw = at(value, "value") ?? at(value, "amount");
  const status = stringOf(at(value, "status")) === undefined && raw !== undefined ? "KNOWN" : knowledgeOf(value);
  const measure = typedMeasure(raw, "MONEY", stringOf(at(value, "unit")) ?? "EUR/month");
  return {
    rowId: `${String(rank).padStart(3, "0")}:${rowId}`,
    labelKey,
    ...(raw === undefined ? {} : { displayValue: formatMoney(raw) ?? String(raw), typedMeasure: measure! }),
    phenomenonRef: `global-m1:${rowId}`,
    phenomenonQuality: status === knowledgeOf(value)
      ? phenomenonQuality(value, at(output.output, "inputHash"))
      : { knowledgeState: "KNOWN", limitationCodes: [], dataNature: "OBSERVED", methodVersion: "global-m1-query-projection@v2", inputHash: stringOf(at(output.output, "inputHash")) ?? digest(value) },
    knowledgeState: status,
    ...(entityRef === undefined ? {} : { entityRef }),
    evidenceRefs: outputEvidence(output),
  };
}

function presentationInsight(
  output: GlobalV2OwnerOutput,
  insightId: string,
  titleKey: string,
  statementKey: string,
  options: { readonly primaryMetricRef?: string; readonly entityRefs?: readonly string[] } = {},
): GlobalCompactInsight {
  return {
    insightId: `presentation:${output.moduleKey.toLowerCase()}:${insightId}`,
    phenomenonId: `presentation:${output.moduleKey.toLowerCase()}`,
    kind: "DETERMINISTIC_PRESENTATION",
    titleKey,
    statementKey,
    ...(options.primaryMetricRef === undefined ? {} : { primaryMetricRef: options.primaryMetricRef }),
    entityRefs: uniqueSorted(options.entityRefs ?? []),
    evidenceRefs: outputEvidence(output),
    detailRefs: [],
    editorialRank: 1,
  };
}

function completeMonthlySeries(points: readonly unknown[]): readonly unknown[] {
  const months = points.flatMap((point) => {
    const month = stringOf(at(point, "month"));
    return month === undefined ? [] : [month];
  });
  return points.length === 12 && new Set(months).size === 12 ? points : [];
}

function byDescendingNumber(path: readonly string[]) {
  return (left: unknown, right: unknown): number => (numberOf(at(right, ...path)) ?? Number.NEGATIVE_INFINITY) - (numberOf(at(left, ...path)) ?? Number.NEGATIVE_INFINITY);
}

function economicProjection(output: GlobalV2OwnerOutput): ModuleProjection {
  const state = recordOf(at(output.output, "state"));
  if (state === undefined) {
    const legacyTargetMonth = stringOf(at(output.output, "targetMonth"));
    const rawActual = at(output.output, "actual", "value", "value");
    const rawTypical = at(output.output, "typical", "reference", "value");
    const actual = formatMoney(rawActual);
    const typical = formatMoney(rawTypical);
    const minimal = formatMoney(at(output.output, "minimal", "metric", "value"));
    const compact = [
      ...(actual === undefined ? [] : [kpi(output, "kpi:economic:actual", legacyTargetMonth === undefined ? "Dépenses du mois" : `Dépenses en ${legacyTargetMonth}`, actual, "global-m1:actual")]),
      ...(typical === undefined ? [] : [kpi(output, "kpi:economic:typical", "Niveau habituel", typical, "global-m1:typical-reference")]),
      ...(minimal === undefined ? [] : [kpi(output, "kpi:economic:minimal", "Minimum estimé", minimal, "global-m1:minimal")]),
    ];
    const delta = numberOf(rawActual) === undefined || numberOf(rawTypical) === undefined ? undefined : numberOf(rawActual)! - numberOf(rawTypical)!;
    const deltaAmount = delta === undefined ? undefined : formatMoney(Math.abs(delta));
    const statement = delta === undefined || deltaAmount === undefined || typical === undefined ? undefined : delta > 0
      ? `${deltaAmount} au-dessus de votre niveau habituel · Habituel : ${typical}/mois`
      : delta < 0 ? `${deltaAmount} sous votre niveau habituel · Habituel : ${typical}/mois` : `Très proche de votre niveau habituel · Habituel : ${typical}/mois`;
    const legacyLabels: Readonly<Record<string, string>> = { Fixe: "Fixe", Variable: "Variable", CURRENT: "Vie courante", NON_CURRENT: "Hors quotidien", Contraint: "Contraint", Contrainte: "Contraint", Indispensable: "Indispensable", Optionnel: "Optionnel" };
    const legacyBreakdown = [["behavior", "Comportement"], ["lifeScope", "Périmètre de vie"], ["necessity", "Nécessité"]].flatMap(([axis, axisLabel]) => Object.entries(recordOf(at(output.output, "structure", axis, "amounts")) ?? {}).map(([key, value], index) => row(output, index + 1, `${axis}:${key}`, `${axisLabel} · ${legacyLabels[key] ?? key}`, formatMoney(value) ?? "Montant indisponible", undefined, "KNOWN")));
    const legacyTemporal = [
      ["trend-start", "Niveau au début", at(output.output, "temporal", "trend", "startLevel")],
      ["trend-end", "Niveau à la fin", at(output.output, "temporal", "trend", "endLevel")],
      ["trend-slope", "Évolution mensuelle", at(output.output, "temporal", "trend", "slopePerMonth")],
      ["recent-previous", "Niveau précédent", at(output.output, "temporal", "recentChange", "previousLevel")],
      ["recent-current", "Niveau récent", at(output.output, "temporal", "recentChange", "recentLevel")],
      ["recent-delta", "Variation récente", at(output.output, "temporal", "recentChange", "delta")],
    ].flatMap(([id, label, value]) => {
      const formatted = (id as string).includes("delta") || (id as string).includes("slope") ? formatSignedMoney(value) : formatMoney(value);
      return formatted === undefined ? [] : [metric(output, id as string, label as string, formatted, "KNOWN")];
    });
    return {
      ...(statement === undefined ? {} : { primaryInsight: presentationInsight(output, "habitual-delta", "Écart à l’habitude", statement, { primaryMetricRef: "global-m1:actual" }) }),
      kpis: compact,
      sections: {
        OVERVIEW: { metrics: compact.map((entry) => metric(output, entry.kpiId, entry.labelKey, entry.displayValue, "KNOWN")) },
        BREAKDOWN: { rows: legacyBreakdown },
        EVOLUTION: { metrics: legacyTemporal },
      },
      detailRows: [],
    };
  }

  const targetMonth = stringOf(at(output.output, "targetMonth"));
  const actual = at(state, "actual");
  const typicalReference = at(state, "typicalReference");
  const typicalState = at(state, "typicalState");
  const minimalState = at(state, "minimalState");
  const targetDelta = at(state, "comparisons", "actualVsTypicalReference");
  const minimalGap = at(state, "comparisons", "typicalStateVsMinimalState");
  const compact = [
    qualifiedKpi(output, "kpi:economic:actual", targetMonth === undefined ? "Dépenses du mois" : `Dépenses en ${targetMonth}`, actual, "global-m1:actual"),
    qualifiedKpi(output, "kpi:economic:typical-state", "État habituel", typicalState, "global-m1:typical-state"),
    qualifiedKpi(output, "kpi:economic:minimal-state", "Minimum estimé", minimalState, "global-m1:minimal-state"),
  ];
  const deltaValue = numberOf(at(targetDelta, "value"));
  const deltaAmount = deltaValue === undefined ? undefined : formatMoney(Math.abs(deltaValue));
  const typicalDisplay = formatMoney(at(typicalReference, "value"));
  const deltaStatement = deltaValue === undefined || deltaAmount === undefined || typicalDisplay === undefined
    ? undefined
    : deltaValue > 0
      ? `${deltaAmount} au-dessus de votre référence habituelle · Référence : ${typicalDisplay}/mois`
      : deltaValue < 0
        ? `${deltaAmount} sous votre référence habituelle · Référence : ${typicalDisplay}/mois`
        : `Au niveau de votre référence habituelle · Référence : ${typicalDisplay}/mois`;

  const overviewMetrics = [
    qualifiedMetric(output, "typical-state", "État habituel", typicalState),
    qualifiedMetric(output, "minimal-state", "Minimum estimé", minimalState),
    qualifiedMetric(output, "typical-minimal-gap", "Écart habituel au minimum", minimalGap, { signed: true }),
    qualifiedMetric(output, "actual", "Dépenses du mois", actual),
    qualifiedMetric(output, "typical-reference", "Référence habituelle", typicalReference),
    qualifiedMetric(output, "actual-reference-delta", "Écart à la référence", targetDelta, { signed: true }),
  ];
  const structuralRecurringCost = at(output.output, "recurrences", "structuralRecurringCost");
  if (knowledgeOf(structuralRecurringCost) === "KNOWN" || knowledgeOf(structuralRecurringCost) === "PARTIAL") {
    overviewMetrics.push(qualifiedMetric(output, "structural-recurring-cost", "Coût récurrent structurel", structuralRecurringCost));
  }

  const points = arrayOf(at(output.output, "history", "points")).slice(-12);
  const historySeries = ([
    ["actual", "Dépenses réelles", "actual"],
    ["typical-state", "État habituel", "typicalState"],
    ["minimal-state", "Minimum estimé", "minimalState"],
  ] as const).map(([seriesId, labelKey, valueKey]): GlobalDetailSeries => ({
    seriesId: `economic:${seriesId}`,
    labelKey,
    unit: "EUR/month",
    points: points.map((point) => {
      const value = at(point, valueKey);
      const status = knowledgeOf(value);
      const measure = typedMeasure(at(value, "value"), "MONEY", stringOf(at(value, "unit")) ?? "EUR/month");
      return {
        unitKey: stringOf(at(point, "month"))!,
        ...(measure === undefined ? {} : { displayValue: formatMoney(measure.value), typedMeasure: measure }),
        phenomenonRef: `global-m1:history:${seriesId}:${stringOf(at(point, "month"))}`,
        phenomenonQuality: phenomenonQuality(value, at(output.output, "history", "inputHash")),
        knowledgeState: status,
      };
    }),
    evidenceRefs: outputEvidence(output),
  }));

  const temporal = at(output.output, "temporal");
  const temporalHash = at(temporal, "inputHash") ?? at(output.output, "inputHash");
  const temporalMetric = (id: string, label: string, value: unknown, kind: GlobalTypedMeasure["kind"] = "MONEY", signed = false): GlobalDetailMetric | undefined => {
    const raw = at(value, "value") ?? value;
    const rawText = stringOf(raw);
    if (rawText === undefined) return undefined;
    const status = stringOf(at(value, "status")) === "UNKNOWN" ? "UNKNOWN" : "KNOWN";
    const measure = typedMeasure(rawText, kind, kind === "MONEY" ? "EUR/month" : "ratio/month");
    return {
      metricId: id, labelKey: label,
      displayValue: kind === "MONEY" ? (signed ? formatSignedMoney(rawText)! : formatMoney(rawText)!) : formatNumber(rawText, 6)!,
      typedMeasure: measure!, phenomenonRef: `global-m1:temporal:${id}`,
      phenomenonQuality: { knowledgeState: status, limitationCodes: [], dataNature: "OBSERVED", methodVersion: stringOf(at(temporal, "methodVersion")) ?? "global_temporal_analysis@v2", inputHash: stringOf(temporalHash) ?? digest(temporal) },
      knowledgeState: status, dataNature: "OBSERVED", evidenceRefs: outputEvidence(output),
    };
  };
  const temporalMetrics = ([
    ["recent-previous", "Niveau précédent", at(temporal, "recentChange", "previousLevel"), "MONEY", false],
    ["recent-current", "Niveau récent", at(temporal, "recentChange", "recentLevel"), "MONEY", false],
    ["recent-delta", "Variation récente", at(temporal, "recentChange", "delta"), "MONEY", true],
    ["trend-slope", "Pente mensuelle", at(temporal, "trend", "slopePerMonth"), "MONEY", true],
    ["trend-relative-slope", "Pente relative", at(temporal, "trend", "relativeSlope"), "DECIMAL", false],
    ["trend-start", "Niveau au début", at(temporal, "trend", "startLevel"), "MONEY", false],
    ["trend-end", "Niveau à la fin", at(temporal, "trend", "endLevel"), "MONEY", false],
    ["dispersion-median", "Médiane", at(temporal, "dispersion", "median"), "MONEY", false],
    ["dispersion-q1", "Premier quartile", at(temporal, "dispersion", "q1"), "MONEY", false],
    ["dispersion-q3", "Troisième quartile", at(temporal, "dispersion", "q3"), "MONEY", false],
    ["dispersion-iqr", "Écart interquartile", at(temporal, "dispersion", "iqr"), "MONEY", false],
    ["dispersion-mad", "Écart médian absolu", at(temporal, "dispersion", "mad"), "MONEY", false],
    ["dispersion-min", "Minimum observé", at(temporal, "dispersion", "minimum"), "MONEY", false],
    ["dispersion-max", "Maximum observé", at(temporal, "dispersion", "maximum"), "MONEY", false],
    ["dispersion-amplitude", "Amplitude", at(temporal, "dispersion", "amplitude"), "MONEY", false],
  ] as const).flatMap(([id, label, value, kind, signed]) => {
    const result = temporalMetric(id, label, value, kind, signed);
    return result === undefined ? [] : [result];
  });
  for (const id of ["trend-slope", "recent-delta", "dispersion-amplitude"] as const) {
    const summary = temporalMetrics.find(({ metricId }) => metricId === id);
    if (summary !== undefined) overviewMetrics.push({ ...summary, metricId: `overview-${summary.metricId}` });
  }

  const labels: Readonly<Record<string, string>> = {
    Fixe: "Fixe", Variable: "Variable", CURRENT: "Vie courante", NON_CURRENT: "Hors quotidien",
    Contraint: "Contraint", Indispensable: "Indispensable", Optionnel: "Optionnel",
  };
  let breakdownRank = 0;
  const breakdownRows = (["necessity", "behavior", "lifeScope"] as const).flatMap((axis) => {
    const axisLabel = axis === "necessity" ? "Nécessité" : axis === "behavior" ? "Comportement" : "Périmètre de vie";
    const axisValue = at(output.output, "structure", axis);
    const rows = arrayOf(at(axisValue, "buckets")).map((bucket) => {
      const key = stringOf(at(bucket, "key")) ?? "UNKNOWN";
      breakdownRank += 1;
      return qualifiedRow(output, breakdownRank, `${axis}:${key}`, `${axisLabel} · ${labels[key] ?? "Non classé"}`, bucket);
    });
    for (const [kind, label] of [["unknownAmount", "Non classé"], ["conflictAmount", "Classification en conflit"]] as const) {
      const amount = at(axisValue, kind);
      breakdownRank += 1;
      rows.push(qualifiedRow(output, breakdownRank, `${axis}:${kind}`, `${axisLabel} · ${label}`, { amount }));
    }
    breakdownRank += 1;
    rows.push({ rowId: `${String(breakdownRank).padStart(3, "0")}:${axis}:evolution`, labelKey: `${axisLabel} · Évolution`, displayValue: "Référence compatible indisponible", phenomenonRef: `global-m1:structure:${axis}:evolution`, phenomenonQuality: phenomenonQuality(at(axisValue, "evolution"), at(output.output, "structure", "inputHash")), knowledgeState: "UNKNOWN", evidenceRefs: outputEvidence(output) });
    return rows;
  });

  const recurrenceAggregates = ([
    ["structural", "Coût récurrent structurel", "structuralRecurringCost"],
    ["new", "Nouvelles récurrences", "newRecurringEquivalent"],
    ["ended", "Récurrences terminées", "endedRecurringEquivalent"],
    ["restarted", "Récurrences reprises", "restartedRecurringEquivalent"],
    ["price-change", "Évolution des prix récurrents", "priceChangeExistingRecurrences"],
  ] as const).map(([id, label, key]) => qualifiedMetric(output, `recurrence-${id}`, label, at(output.output, "recurrences", key)));
  const recurrenceRows = arrayOf(at(output.output, "recurrences", "series")).slice(0, 50).map((recurrence, index) => {
    const entityRef = `recurrence:${stringOf(at(recurrence, "recurrenceId")) ?? index + 1}`;
    const lifecycle = stringOf(at(recurrence, "lifecycle", "value"));
    const cadence = numberOf(at(recurrence, "cadence", "expectedOccurrencesPerYear"));
    const monthly = at(recurrence, "monthlyEquivalent");
    const measure = typedMeasure(at(monthly, "value"), "MONEY", "EUR/month");
    return {
      rowId: `${String(index + 1).padStart(3, "0")}:${entityRef}`,
      labelKey: `Récurrence ${index + 1}`,
      displayValue: [measure === undefined ? "Équivalent mensuel indisponible" : formatMoney(measure.value), cadence === undefined ? "Cadence non qualifiée" : `${cadence} occurrence(s)/an`, lifecycle === undefined ? "Cycle de vie non déterminé" : ({ ACTIVE: "Active", ENDED: "Terminée", INTERRUPTED: "Interrompue", RESTARTED: "Reprise" } as const)[lifecycle as "ACTIVE"] ?? lifecycle].join(" · "),
      ...(measure === undefined ? {} : { typedMeasure: measure }), phenomenonRef: `global-m1:${entityRef}`,
      phenomenonQuality: phenomenonQuality(monthly, at(recurrence, "inputHash"), ...(lifecycle === undefined ? ["RECURRENCE_LIFECYCLE_UNKNOWN"] : [])),
      knowledgeState: knowledgeOf(monthly), entityRef, evidenceRefs: outputEvidence(output),
    } satisfies GlobalDetailRow;
  });
  const contributorRows = arrayOf(at(output.output, "contributors")).filter((entry) => at(entry, "publicationEligible") === true && ["KNOWN", "PARTIAL"].includes(knowledgeOf(at(entry, "typedDelta")))).slice(0, 50).map((entry, index) => qualifiedRow(output, index + 1, `contributor:${stringOf(at(entry, "contributorId")) ?? index}`, "Contribution qualifiée", at(entry, "typedDelta")));

  return {
    ...(deltaStatement === undefined ? {} : { primaryInsight: { ...presentationInsight(output, "habitual-delta", "Écart à la référence habituelle", deltaStatement, { primaryMetricRef: "global-m1:actual" }), phenomenonId: "global-m1:economic-state" } }),
    kpis: compact,
    sections: {
      OVERVIEW: { metrics: overviewMetrics },
      EVOLUTION: { metrics: temporalMetrics, series: historySeries },
      BREAKDOWN: { rows: breakdownRows },
      PATTERNS: { metrics: recurrenceAggregates, rows: recurrenceRows },
      COMPARISONS: { rows: contributorRows },
    },
    detailRows: recurrenceRows,
  };
}

function categoryNeedProjection(output: GlobalV2OwnerOutput, labels: GlobalV2PresentationLabels): ModuleProjection {
  const result = recordOf(at(output.output, "result"));
  const categories = arrayOf(at(result, "categories", "groups"));
  const needs = arrayOf(at(result, "needs", "groups"));
  const materiality = new GlobalMaterialityEngine();
  const candidateCategoryIds = new Set(arrayOf(at(result, "materialityCandidates")).flatMap((candidate) => {
    const evaluation = materiality.evaluate({ candidate: candidate as GlobalMaterialityCandidate, policyId: "CATEGORY_NEED" });
    if (evaluation.status !== "MATERIAL") return [];
    return arrayOf(at(candidate, "entityRefs")).flatMap((ref) => typeof ref === "string" && ref.startsWith("category:") ? [ref.slice("category:".length)] : []);
  }));
  const knownCategories = categories.flatMap((group) => {
    const id = stringOf(at(group, "dimension", "id"));
    const label = id === undefined ? undefined : labels.categories?.[id];
    return id === undefined || label === undefined ? [] : [{ group, id, label }];
  });
  const rankedCategories = [...knownCategories].sort((left, right) => byDescendingNumber(["monthlyAmount"])(left.group, right.group) || left.id.localeCompare(right.id));
  const notable = [...knownCategories].filter(({ id }) => candidateCategoryIds.has(id)).sort((left, right) => {
    const delta = Math.abs(numberOf(at(right.group, "deltaAmount")) ?? Number.NEGATIVE_INFINITY) - Math.abs(numberOf(at(left.group, "deltaAmount")) ?? Number.NEGATIVE_INFINITY);
    return delta || byDescendingNumber(["monthlyAmount"])(left.group, right.group) || left.id.localeCompare(right.id);
  })[0];
  const categoryRows = rankedCategories.slice(0, 5).map(({ group, id, label }, index) => {
    const current = formatMoney(at(group, "monthlyAmount")) ?? "Montant indisponible";
    const typical = formatMoney(at(group, "typicalAmount"));
    const delta = formatSignedMoney(at(group, "deltaAmount"));
    return row(output, index + 1, `category:${id}`, label, [current, typical === undefined ? undefined : `habituel ${typical}`, delta === undefined ? undefined : `écart ${delta}`].filter(Boolean).join(" · "), `category:${id}`, "KNOWN");
  });
  const needRows = needs.flatMap((group) => {
    const id = stringOf(at(group, "dimension", "id")) ?? stringOf(at(group, "key"));
    const label = id === "__UNKNOWN__" ? "Besoin non déterminé" : id === undefined ? undefined : labels.needs?.[id];
    return id === undefined || label === undefined ? [] : [{ group, id, label }];
  }).sort((left, right) => byDescendingNumber(["monthlyAmount"])(left.group, right.group) || left.id.localeCompare(right.id)).slice(0, 5).map(({ group, id, label }, index) => row(output, index + 1, `need:${id}`, label, formatMoney(at(group, "monthlyAmount")) ?? "Montant indisponible", `need:${id}`, "KNOWN"));
  const evolution = [...knownCategories].sort((left, right) => byDescendingNumber(["typicalAmount"])(left.group, right.group) || left.id.localeCompare(right.id)).slice(0, 3).flatMap(({ group, id, label }) => {
    const points = completeMonthlySeries(arrayOf(at(group, "historicalSeries")));
    return points.length === 0 ? [] : [series(output, `category-series:${id}`, label, "EUR", points, "month", "amount")];
  });
  const currentTotal = formatMoney(at(result, "categories", "currentTotal"));
  const notableDelta = notable === undefined ? undefined : formatSignedMoney(at(notable.group, "deltaAmount"));
  const notableCurrent = notable === undefined ? undefined : formatMoney(at(notable.group, "monthlyAmount"));
  const notableTypical = notable === undefined ? undefined : formatMoney(at(notable.group, "typicalAmount"));
  return {
    ...(notable === undefined || notableDelta === undefined || notableCurrent === undefined || notableTypical === undefined ? {} : {
      primaryInsight: presentationInsight(output, "notable-category", notable.label, `${notableDelta} par rapport à votre habitude · ${notableCurrent} ce mois-ci · habituel ${notableTypical}`, { primaryMetricRef: `global-m2:category:${notable.id}`, entityRefs: [`category:${notable.id}`] }),
    }),
    kpis: [
      ...(notable === undefined || notableDelta === undefined || notableCurrent === undefined || notableTypical === undefined ? [] : [kpi(output, "kpi:categories:notable", notable.label, `${notableCurrent} ce mois-ci · habituel ${notableTypical} · écart ${notableDelta}`, `global-m2:category:${notable.id}`)]),
      ...(currentTotal === undefined ? [] : [kpi(output, "kpi:categories:current-total", "Total des catégories", currentTotal, "global-m2:categories:current-total")]),
    ].slice(0, 3),
    sections: {
      OVERVIEW: { metrics: currentTotal === undefined ? [] : [metric(output, "categories-current-total", "Total du mois", currentTotal, "KNOWN")] },
      BREAKDOWN: { rows: categoryRows },
      PATTERNS: { rows: needRows },
      EVOLUTION: { series: evolution },
    },
    detailRows: [...categoryRows, ...needRows].slice(0, GLOBAL_MAX_SECTION_ROWS),
  };
}

function rhythmProjection(output: GlobalV2OwnerOutput, labels: GlobalV2PresentationLabels, personIds: readonly string[]): ModuleProjection {
  const rhythms = arrayOf(at(output.output, "rhythms")).flatMap((rhythm) => {
    const activityId = stringOf(at(rhythm, "activityId"));
    const personId = stringOf(at(rhythm, "personId"));
    const label = activityId === undefined ? undefined : activityLabel(activityId);
    return activityId === undefined || personId === undefined || label === undefined ? [] : [{ rhythm, activityId, personId, label, person: personLabel(personId, labels, personIds), authoritativePersonLabel: labels.persons?.[personId] }];
  }).sort((left, right) => byDescendingNumber(["support", "occurrenceCount"])(left.rhythm, right.rhythm) || byDescendingNumber(["rate", "value"])(left.rhythm, right.rhythm) || left.activityId.localeCompare(right.activityId) || left.personId.localeCompare(right.personId));
  const topRows = uniqueSorted(rhythms.map(({ personId }) => personId)).flatMap((personId) => rhythms.filter((entry) => entry.personId === personId).slice(0, 5)).map(({ rhythm, activityId, personId, label, person }, index) => {
    const count = formatNumber(at(rhythm, "support", "occurrenceCount"), 0) ?? "0";
    const median = formatNumber(at(rhythm, "cadence", "medianIntervalDays"), 1);
    return row(output, index + 1, `rhythm:${personId}:${activityId}`, `${label} · ${person}`, `${count} occurrences${median === undefined ? "" : ` · intervalle médian ${median} jours`}`, `activity:${activityId}`, "KNOWN");
  });
  const evolution = rhythms.slice(0, 3).flatMap(({ rhythm, activityId, personId, label, person }) => {
    const points = completeMonthlySeries(arrayOf(at(rhythm, "monthlyRates")));
    return points.length === 0 ? [] : [series(output, `rhythm-series:${personId}:${activityId}`, `${label} · ${person}`, "OCCURRENCES_PAR_JOUR_OBSERVÉ", points, "month", "value")];
  });
  const headline = rhythms.find(({ rhythm, authoritativePersonLabel }) => authoritativePersonLabel !== undefined && (numberOf(at(rhythm, "support", "occurrenceCount")) ?? 0) > 0);
  const headlineCount = headline === undefined ? undefined : formatNumber(at(headline.rhythm, "support", "occurrenceCount"), 0);
  const headlineMedian = headline === undefined ? undefined : formatNumber(at(headline.rhythm, "cadence", "medianIntervalDays"), 1);
  return {
    ...(headline === undefined || headlineCount === undefined ? {} : {
      primaryInsight: presentationInsight(output, "dominant-rhythm", headline.label, `${headlineCount} occurrences pour ${headline.authoritativePersonLabel}${headlineMedian === undefined ? "" : ` · Intervalle médian : ${headlineMedian} jours`}`, { primaryMetricRef: `global-m4:${headline.personId}:${headline.activityId}`, entityRefs: [`activity:${headline.activityId}`, `person:${headline.personId}`] }),
    }),
    kpis: rhythms.filter(({ rhythm, authoritativePersonLabel }) => authoritativePersonLabel !== undefined && (numberOf(at(rhythm, "support", "occurrenceCount")) ?? 0) > 0).slice(0, 3).map(({ rhythm, activityId, personId, label, authoritativePersonLabel }, index) => {
      const median = formatNumber(at(rhythm, "cadence", "medianIntervalDays"), 1);
      return kpi(output, `kpi:rhythm:${String(index).padStart(2, "0")}`, `${label} · ${authoritativePersonLabel}`, `${formatNumber(at(rhythm, "support", "occurrenceCount"), 0)} occurrences${median === undefined ? "" : ` · intervalle médian ${median} jours`}`, `global-m4:${personId}:${activityId}`);
    }),
    sections: { OVERVIEW: { rows: topRows }, EVOLUTION: { series: evolution } },
    detailRows: topRows,
  };
}

function momentProjection(output: GlobalV2OwnerOutput): ModuleProjection {
  const summaries = arrayOf(at(output.output, "summaries")).flatMap((summary) => {
    const momentId = stringOf(at(summary, "moment", "momentId"));
    const label = stringOf(at(summary, "moment", "type", "value"));
    const amount = at(summary, "causalCost", "value");
    return momentId === undefined || label === undefined || formatMoney(amount) === undefined ? [] : [{ summary, momentId, label, amount }];
  }).sort((left, right) => byDescendingNumber(["causalCost", "value"])(left.summary, right.summary) || (stringOf(at(right.summary, "moment", "startDate")) ?? "").localeCompare(stringOf(at(left.summary, "moment", "startDate")) ?? "") || left.momentId.localeCompare(right.momentId));
  const summaryRows = summaries.slice(0, 5).map(({ summary, momentId, label, amount }, index) => {
    const start = stringOf(at(summary, "moment", "startDate"));
    const end = stringOf(at(summary, "moment", "endDate"));
    const dates = start === undefined ? undefined : end === undefined || end === start ? start : `${start} → ${end}`;
    return row(output, index + 1, `moment:${momentId}`, label, [formatMoney(amount), dates].filter(Boolean).join(" · "), `moment:${momentId}`, at(summary, "causalCost", "status") === "PARTIAL" ? "PARTIAL" : "KNOWN");
  });
  const comparisonRows = arrayOf(at(output.output, "comparisons")).slice(0, 5).flatMap((comparison, index) => {
    const momentId = stringOf(at(comparison, "momentId"));
    const subjectCost = formatMoney(at(comparison, "subjectCost"));
    const peerCount = formatNumber(at(comparison, "peerCount"), 0);
    return momentId === undefined || subjectCost === undefined ? [] : [row(output, index + 1, `comparison:${momentId}`, summaries.find((entry) => entry.momentId === momentId)?.label ?? "Moment", `${subjectCost}${peerCount === undefined ? "" : ` · ${peerCount} moments comparables`}`, `moment:${momentId}`, "KNOWN")];
  });
  const paymentPhaseLabels: Readonly<Record<string, string>> = {
    PAID_BEFORE: "Payé avant",
    PAID_DURING: "Payé pendant",
    PAID_AFTER: "Payé après",
    UNKNOWN_PAYMENT_PHASE: "Date de paiement non déterminée",
  };
  const timelineRows = summaries.slice(0, 5).flatMap(({ summary, momentId, label }) => arrayOf(at(summary, "paymentTimeline")).flatMap((entry) => {
    const phase = stringOf(at(entry, "paymentPhase"));
    const amount = formatMoney(at(entry, "amount"));
    return phase === undefined || amount === undefined ? [] : [{ momentId, label, phase, amount }];
  })).slice(0, GLOBAL_MAX_SECTION_ROWS).map(({ momentId, label, phase, amount }, index) => row(output, index + 1, `timeline:${momentId}:${phase}`, `${label} · ${paymentPhaseLabels[phase] ?? "Temporalité de paiement"}`, amount, `moment:${momentId}`, "KNOWN"));
  const headline = summaries.find(({ summary }) => at(summary, "causalCost", "status") === "KNOWN" && stringOf(at(summary, "moment", "startDate")) !== undefined);
  const headlineDate = headline === undefined ? undefined : stringOf(at(headline.summary, "moment", "startDate"));
  const headlineEnd = headline === undefined ? undefined : stringOf(at(headline.summary, "moment", "endDate"));
  const headlineDates = headlineDate === undefined ? undefined : headlineEnd === undefined || headlineEnd === headlineDate ? headlineDate : `${headlineDate} → ${headlineEnd}`;
  const contextCount = arrayOf(at(output.output, "summaries")).length;
  return {
    ...(headline === undefined || headlineDates === undefined ? {} : {
      primaryInsight: presentationInsight(output, "highest-causal-cost", headline.label, `${formatMoney(headline.amount)} · ${headlineDates} · ${contextCount} moments en contexte · Analyse partielle`, { primaryMetricRef: `global-m6:${headline.momentId}`, entityRefs: [`moment:${headline.momentId}`] }),
    }),
    kpis: summaries.slice(0, 3).map(({ momentId, label, amount }, index) => kpi(output, `kpi:moments:${String(index).padStart(2, "0")}`, label, formatMoney(amount)!, `global-m6:${momentId}`)),
    sections: { OVERVIEW: { rows: summaryRows }, COMPARISONS: { rows: comparisonRows }, ...(timelineRows.length === 0 ? {} : { PATTERNS: { rows: timelineRows } }) },
    detailRows: summaryRows,
  };
}

function placeProjection(output: GlobalV2OwnerOutput, labels: GlobalV2PresentationLabels): ModuleProjection {
  const places = arrayOf(at(output.output, "places")).flatMap((place) => {
    const placeId = stringOf(at(place, "placeId"));
    const label = placeId === undefined ? undefined : labels.places?.[placeId];
    return placeId === undefined || label === undefined ? [] : [{ place, placeId, label }];
  }).filter(({ place }) => (numberOf(at(place, "visitCount")) ?? 0) > 0).sort((left, right) => byDescendingNumber(["visitCount"])(left.place, right.place) || byDescendingNumber(["visitDays"])(left.place, right.place) || byDescendingNumber(["medianDuration"])(left.place, right.place) || left.placeId.localeCompare(right.placeId));
  const placeRows = places.slice(0, 5).map(({ place, placeId, label }, index) => {
    const visits = formatNumber(at(place, "visitCount"), 0) ?? "0";
    const duration = formatNumber(at(place, "medianDuration"), 0);
    return row(output, index + 1, `place:${placeId}`, label, `${visits} visites${duration === undefined ? "" : ` · durée médiane ${duration} min`}`, `place:${placeId}`, "KNOWN");
  });
  const amounts = new Map<string, number>();
  for (const rollup of arrayOf(at(output.output, "finance", "rollups"))) {
    const placeId = stringOf(at(rollup, "placeId"));
    const amount = numberOf(at(rollup, "amount"));
    if (placeId !== undefined && amount !== undefined) amounts.set(placeId, (amounts.get(placeId) ?? 0) + amount);
  }
  const financeRows = [...amounts.entries()].flatMap(([placeId, amount]) => labels.places?.[placeId] === undefined ? [] : [{ placeId, amount, label: labels.places[placeId]! }]).sort((left, right) => right.amount - left.amount || left.placeId.localeCompare(right.placeId)).slice(0, 5).map(({ placeId, amount, label }, index) => row(output, index + 1, `place-finance:${placeId}`, label, formatMoney(amount)!, `place:${placeId}`, "KNOWN"));
  const lifecycleLabels: Readonly<Record<string, string>> = {
    NEWLY_OBSERVED: "Nouvellement observé",
    REGULAR: "Fréquentation régulière",
    NEW_REGULAR: "Nouvelle fréquentation régulière",
    GROWING: "Fréquentation en hausse",
    DECLINING: "Fréquentation en baisse",
    REGULAR_STABLE: "Fréquentation régulière et stable",
    DORMANT: "Fréquentation en sommeil",
    ABANDONED: "Fréquentation interrompue",
    ROLE_ENDED: "Rôle de ce lieu terminé",
    OBSERVED: "Lieu observé",
  };
  const lifecycleRows = places.slice(0, 5).flatMap(({ place, placeId, label }, index) => {
    const lifecycle = stringOf(at(place, "lifecycle", "status"));
    return lifecycle === undefined || lifecycleLabels[lifecycle] === undefined ? [] : [row(output, index + 1, `place-lifecycle:${placeId}`, label, lifecycleLabels[lifecycle]!, `place:${placeId}`, "KNOWN")];
  });
  const headline = places[0];
  return {
    ...(headline === undefined ? {} : {
      primaryInsight: presentationInsight(output, "primary-place", headline.label, `${formatNumber(at(headline.place, "visitCount"), 0)} visites observées · Votre lieu le plus fréquenté sur la période`, { primaryMetricRef: `global-m7:${headline.placeId}`, entityRefs: [`place:${headline.placeId}`] }),
    }),
    kpis: places.slice(0, 3).map(({ place, placeId, label }, index) => kpi(output, `kpi:places:${String(index).padStart(2, "0")}`, label, `${formatNumber(at(place, "visitCount"), 0) ?? "0"} visites`, `global-m7:${placeId}`)),
    sections: { OVERVIEW: { rows: placeRows }, BREAKDOWN: { rows: financeRows }, EVOLUTION: { rows: lifecycleRows } },
    detailRows: placeRows,
  };
}

function personaProjection(output: GlobalV2OwnerOutput, labels: GlobalV2PresentationLabels, personIds: readonly string[]): ModuleProjection {
  const values = arrayOf(at(output.output, "metrics")).flatMap((value) => {
    const personId = stringOf(at(value, "personId"));
    const metricId = stringOf(at(value, "metricId"));
    const rawValue = stringOf(at(value, "rawValue"));
    if (personId === undefined || metricId === undefined || rawValue === undefined) return [];
    const activityId = metricId.startsWith("activity-rate:") ? metricId.slice("activity-rate:".length) : undefined;
    const humanMetric = activityId === undefined ? undefined : activityLabel(activityId);
    return humanMetric === undefined ? [] : [{ personId, metricId, humanMetric, person: personLabel(personId, labels, personIds), rawValue }];
  }).sort((left, right) => left.personId.localeCompare(right.personId) || (numberOf(right.rawValue) ?? 0) - (numberOf(left.rawValue) ?? 0) || left.metricId.localeCompare(right.metricId));
  const rows = uniqueSorted(values.map(({ personId }) => personId)).flatMap((personId) => values.filter((entry) => entry.personId === personId).slice(0, 3)).map(({ personId, metricId, humanMetric, person, rawValue }, index) => row(output, index + 1, `persona:${personId}:${metricId}`, `${person} · ${humanMetric}`, `${formatNumber(rawValue, 3) ?? rawValue} occurrence/jour observé`, `person:${personId}`, "PARTIAL"));
  return {
    ...(rows.length === 0 ? {} : { primaryInsight: presentationInsight(output, "neutral-persona-comparison", "Aucune différence nette à mettre en avant entre vos profils", "Les métriques descriptives restent disponibles séparément pour chaque personne, sans conclusion gagnant/perdant.") }),
    kpis: [],
    sections: { OVERVIEW: { rows } },
    detailRows: rows,
  };
}

function togetherProjection(output: GlobalV2OwnerOutput): ModuleProjection {
  const universes = arrayOf(at(output.output, "universes")).flatMap((universe) => {
    const universeId = stringOf(at(universe, "universeId"));
    const activityId = universeId?.startsWith("activity:") ? universeId.slice("activity:".length) : universeId;
    const label = activityId === undefined ? undefined : activityLabel(activityId);
    const sharedUnits = numberOf(at(universe, "support", "sharedUnits"));
    const resolvedUnits = numberOf(at(universe, "support", "resolvedUnits"));
    const eligibleUnits = numberOf(at(universe, "support", "eligibleUnits"));
    const knowledge = stringOf(at(universe, "support", "knowledgeState"));
    return universeId === undefined || activityId === undefined || label === undefined || sharedUnits === undefined || sharedUnits <= 0 || resolvedUnits === undefined || resolvedUnits <= 0 || eligibleUnits === undefined || !["KNOWN", "PARTIAL"].includes(knowledge ?? "") ? [] : [{ universe, universeId, activityId, label, sharedUnits, resolvedUnits, eligibleUnits, knowledge: knowledge as "KNOWN" | "PARTIAL" }];
  }).sort((left, right) => right.sharedUnits - left.sharedUnits || (numberOf(at(right.universe, "support", "sharedObservableCoverage")) ?? 0) - (numberOf(at(left.universe, "support", "sharedObservableCoverage")) ?? 0) || left.universeId.localeCompare(right.universeId));
  const rows = universes.slice(0, 5).map(({ universeId, label, sharedUnits, resolvedUnits, eligibleUnits, knowledge }, index) => row(output, index + 1, `together:${universeId}`, label, `${sharedUnits} occurrences explicitement partagées · ${resolvedUnits} résolues sur ${eligibleUnits} observables`, `activity:${universeId.replace(/^activity:/u, "")}`, knowledge));
  const headline = universes[0];
  return {
    ...(headline === undefined ? {} : {
      primaryInsight: presentationInsight(output, "top-shared-activity", headline.label, `${headline.sharedUnits} occurrences explicitement partagées · sur ${headline.eligibleUnits} occurrences observables${headline.knowledge === "PARTIAL" ? " · Analyse partielle" : ""}`, { primaryMetricRef: `global-m10:${headline.universeId}`, entityRefs: [`activity:${headline.activityId}`] }),
    }),
    kpis: universes.slice(0, 3).map(({ universeId, label, sharedUnits }, index) => kpi(output, `kpi:together:${String(index).padStart(2, "0")}`, label, `${sharedUnits} occurrences partagées`, `global-m10:${universeId}`)),
    sections: { OVERVIEW: { rows } },
    detailRows: rows,
  };
}

function neutralProjection(output: GlobalV2OwnerOutput, title: string, message: string): ModuleProjection {
  return {
    primaryInsight: presentationInsight(output, "neutral-state", title, message),
    kpis: [],
    sections: { OVERVIEW: { rows: [row(output, 1, `state:${output.moduleKey.toLowerCase()}`, title, message, undefined, output.knowledge)] } },
    detailRows: [],
  };
}

function projectModule(output: GlobalV2OwnerOutput, labels: GlobalV2PresentationLabels, personIds: readonly string[]): ModuleProjection {
  switch (output.moduleKey) {
    case "ECONOMIC": return economicProjection(output);
    case "CATEGORIES_NEEDS": return categoryNeedProjection(output, labels);
    case "TRANSFORMATIONS": return neutralProjection(output, "Aucun changement durable clairement identifié", "Aucun changement suffisamment net et durable n’a été identifié.");
    case "RHYTHM": return rhythmProjection(output, labels, personIds);
    case "RELATIONSHIPS": return neutralProjection(output, "Pas encore assez d’éléments pour établir une relation fiable", "Aucune association suffisamment étayée n’est actuellement publiable.");
    case "MOMENTS": return momentProjection(output);
    case "GEO_MOBILITY": return placeProjection(output, labels);
    case "CONSUMPTION": return { kpis: [], sections: {}, detailRows: [] };
    case "PERSONAS": return personaProjection(output, labels, personIds);
    case "TOGETHER": return togetherProjection(output);
  }
}

function publicationDecision(output: GlobalV2OwnerOutput, revision: number, surface: "AUTO_GLOBAL" | "MODULE_DETAIL" = "AUTO_GLOBAL"): GlobalPublicationDecision {
  return new GlobalPublicationEngine().decide({
    sectionKey: `module:${output.moduleKey}`,
    policy: {
      policyId: "global-v2-owner-output",
      sectionClass: "CORE_STRUCTURAL",
      allowedSurfaces: ["AUTO_GLOBAL", "MODULE_DETAIL"],
      requireCertifiedHistory: true,
      requireMateriality: false,
      requireStatistics: false,
      requireTemporalRobustness: false,
      allowPartialQualifiedDetail: true,
      placeholderPolicy: "CORE_WHEN_RECOVERABLE",
      methodVersion: "global-v2-owner-projection@v1",
    },
    surface,
    analyticsRevision: String(revision),
    gates: {
      capability: output.capabilityState !== "UNAVAILABLE",
      applicable: output.knowledge !== "NOT_APPLICABLE",
      semantic: true,
      knowledge: output.knowledge,
      certification: true,
      support: output.knowledge === "KNOWN" ? "SUFFICIENT" : "PARTIAL_SUPPORT",
      coverage: output.knowledge === "KNOWN" ? 1 : output.knowledge === "PARTIAL" ? 0.7 : 0,
      provenance: output.evidenceRefs.length > 0,
      baseCompatible: true,
      materiality: true,
      statistics: true,
      temporalRobustness: true,
      editorialSelection: true,
      publicationReady: true,
      recoverableReason: output.capabilityState === "UNAVAILABLE" ? "CAPABILITY_NOT_AVAILABLE" : "UNKNOWN_REQUIRED_VALUE",
      ...(output.knowledge === "PARTIAL" ? { qualification: "PARTIAL_COVERAGE" as const } : {}),
    },
  });
}

function humanizePlaceholder(output: GlobalV2OwnerOutput, decision: GlobalPublicationDecision): GlobalPublicationDecision {
  if (decision.visibility !== "PLACEHOLDER") return decision;
  if (output.moduleKey === "RELATIONSHIPS") return { ...decision, placeholder: { messageKey: "Pas encore assez d’éléments pour établir une relation fiable" } };
  if (output.moduleKey === "CONSUMPTION") return { ...decision, placeholder: { messageKey: "Analyse pas encore disponible" } };
  return decision;
}

function quality(output: GlobalV2OwnerOutput): GlobalCompactQuality {
  return {
    knowledgeState: output.knowledge,
    ...(output.knowledge === "PARTIAL" ? { partialMeaning: "OBSERVED_ONLY" as const } : {}),
    supportStatus: output.knowledge === "KNOWN" ? "SUFFICIENT" : "INSUFFICIENT",
    ...(output.knowledge === "KNOWN" ? { effectiveCoverage: 1 } : output.knowledge === "PARTIAL" ? { effectiveCoverage: 0.7 } : {}),
    dataNature: "OBSERVED",
    limitationCodes: [...output.reasonCodes].sort(),
    evidenceRefs: [...new Set(output.evidenceRefs)].sort(),
  };
}

function capability(output: GlobalV2OwnerOutput): GlobalModuleCapability {
  return {
    capabilityId: `GLOBAL_${output.moduleKey}`,
    state: output.capabilityState,
    reasonCodes: [...new Set(output.reasonCodes)].sort(),
  };
}

function detailResourceFor(moduleKey: GlobalPrimaryModuleKey): GlobalV2ExpandedResourceName | undefined {
  return globalV2ExpandedResourceCatalog.slice(10).find(({ moduleKey: candidate, resource }) =>
    candidate === moduleKey && resource !== "analysis_global_methodology" && globalV2QueryRegistry[resource].availability === "AVAILABLE")?.resource;
}

function economicRecurrenceDetail(output: GlobalV2OwnerOutput, entityRef: string): SectionProjection | undefined {
  if (!entityRef.startsWith("recurrence:")) return undefined;
  const recurrenceId = entityRef.slice("recurrence:".length);
  const recurrence = arrayOf(at(output.output, "recurrences", "series")).find((entry) => stringOf(at(entry, "recurrenceId")) === recurrenceId);
  if (recurrence === undefined) return undefined;
  const metrics = ([
    ["typical-occurrence-cost", "Coût typique par occurrence", "typicalOccurrenceCost"],
    ["expected-occurrence-amount", "Montant attendu par occurrence", "expectedOccurrenceAmount"],
    ["monthly-equivalent", "Équivalent mensuel", "monthlyEquivalent"],
  ] as const).map(([id, label, key]) => qualifiedMetric(output, `detail:${id}`, label, at(recurrence, key)));
  const lifecycle = stringOf(at(recurrence, "lifecycle", "value"));
  const cadence = numberOf(at(recurrence, "cadence", "expectedOccurrencesPerYear"));
  const rows: GlobalDetailRow[] = [
    row(output, 1, "first-observed", "Première occurrence observée", stringOf(at(recurrence, "firstObservedAt")) ?? "Indisponible", entityRef, stringOf(at(recurrence, "firstObservedAt")) === undefined ? "UNKNOWN" : "KNOWN"),
    row(output, 2, "last-observed", "Dernière occurrence observée", stringOf(at(recurrence, "lastObservedAt")) ?? "Indisponible", entityRef, stringOf(at(recurrence, "lastObservedAt")) === undefined ? "UNKNOWN" : "KNOWN"),
    row(output, 3, "cadence", "Cadence", cadence === undefined ? "Non qualifiée" : `${cadence} occurrence(s)/an`, entityRef, cadence === undefined ? "UNKNOWN" : "KNOWN"),
    row(output, 4, "lifecycle", "Cycle de vie", lifecycle === undefined ? "Non déterminé" : ({ ACTIVE: "Active", ENDED: "Terminée", INTERRUPTED: "Interrompue", RESTARTED: "Reprise" } as Readonly<Record<string, string>>)[lifecycle] ?? lifecycle, entityRef, lifecycle === undefined ? "UNKNOWN" : "KNOWN"),
    row(output, 5, "price-evolution", "Évolution du prix", stringOf(at(recurrence, "priceEvolution", "reasonCode")) === undefined ? "Disponible" : "Non qualifiée", entityRef, stringOf(at(recurrence, "priceEvolution", "status")) === "KNOWN" ? "KNOWN" : "UNKNOWN"),
  ];
  return { metrics, rows };
}

function methodologyRows(output: GlobalV2OwnerOutput): readonly GlobalDetailRow[] {
  if (output.moduleKey !== "ECONOMIC" || recordOf(at(output.output, "methodology")) === undefined) {
    return [{ rowId: `method:${output.moduleKey}`, labelKey: "Méthode", displayValue: output.owner, knowledgeState: "KNOWN", evidenceRefs: output.evidenceRefs }];
  }
  const methodology = at(output.output, "methodology");
  const values: readonly [string, string, string][] = [
    ["as-of", "Calcul arrêté au", stringOf(at(methodology, "asOf")) ?? "Indisponible"],
    ["certified-through", "Données certifiées jusqu’au", stringOf(at(methodology, "certifiedThrough")) ?? "Indisponible"],
    ["methods", "Méthodes", arrayOf(at(methodology, "methods")).join(", ")],
    ["support", "Support inclus", String(numberOf(at(methodology, "support", "includedUnits")) ?? "Indisponible")],
    ["coverage", "Couverture", formatNumber(at(methodology, "coverage", "effective"), 4) ?? "Indisponible"],
    ["limitations", "Limites", arrayOf(at(methodology, "limitations")).join(", ") || "Aucune"],
    ["revisions", "Révisions", `data ${stringOf(at(methodology, "revisions", "dataRevision")) ?? "?"} · analytics ${stringOf(at(methodology, "revisions", "analyticsRevision")) ?? "?"}`],
  ];
  return values.map(([id, label, value], index) => row(output, index + 1, `method:${id}`, label, value, undefined, value === "Indisponible" ? "UNKNOWN" : "KNOWN"));
}

export function buildGlobalV2CandidateFromOwnerOutputs(input: GlobalV2CandidateInput) {
  if (!input.project || !input.householdId || !GIT_SHA.test(input.implementationIdentity)) throw new TypeError("GLOBAL_LIVE_CANDIDATE_IDENTITY_INVALID");
  if (!/^\d+$/u.test(input.dataRevision) || !/^\d+$/u.test(input.analyticsRevision)) throw new TypeError("GLOBAL_LIVE_CANDIDATE_REVISION_INVALID");
  const revision = Number(input.analyticsRevision) + 1;
  const rawScope: GlobalAnalysisScopeV2 = {
    subject: { kind: "household" },
    time: { kind: "global_v2", asOf: input.asOf as never, certifiedThrough: input.certifiedThrough as never },
  };
  const validationContext: GlobalScopeValidationContext = {
    householdTimeZone: input.householdTimeZone as never,
    authorizedPersonIds: input.personIds as never,
  };
  const scope = normalizeGlobalAnalysisScopeV2(rawScope, validationContext);
  const scopeHash = computeGlobalAnalysisScopeV2Hash(scope);
  const outputs = [...input.ownerOutputs].sort((left, right) => left.moduleKey.localeCompare(right.moduleKey));
  if (outputs.length !== globalPrimaryModuleCatalog.length || new Set(outputs.map(({ moduleKey }) => moduleKey)).size !== globalPrimaryModuleCatalog.length) {
    throw new TypeError("GLOBAL_LIVE_CANDIDATE_OWNER_SET_INCOMPLETE");
  }
  const sortLabels = (values: Readonly<Record<string, string>> | undefined): Readonly<Record<string, string>> => Object.fromEntries(Object.entries(values ?? {}).sort(([left], [right]) => left.localeCompare(right)));
  const presentationLabels: GlobalV2PresentationLabels = {
    persons: sortLabels(input.presentationLabels?.persons),
    places: sortLabels(input.presentationLabels?.places),
    categories: sortLabels(input.presentationLabels?.categories),
    needs: sortLabels(input.presentationLabels?.needs),
  };
  const labelInputsFor = (moduleKey: GlobalPrimaryModuleKey): unknown => {
    if (moduleKey === "CATEGORIES_NEEDS") return { categories: presentationLabels.categories, needs: presentationLabels.needs };
    if (moduleKey === "RHYTHM" || moduleKey === "PERSONAS") return { persons: presentationLabels.persons };
    if (moduleKey === "GEO_MOBILITY") return { places: presentationLabels.places };
    return undefined;
  };
  const outputDigests = outputs.map((item) => ({ moduleKey: item.moduleKey, owner: item.owner, digest: digest(item.output), knowledge: item.knowledge, capabilityState: item.capabilityState }));
  const labelDigests = outputs.flatMap(({ moduleKey }) => labelInputsFor(moduleKey) === undefined ? [] : [{ moduleKey, digest: digest(labelInputsFor(moduleKey)) }]);
  const projections = new Map(outputs.map((output) => [output.moduleKey, projectModule(output, presentationLabels, input.personIds)] as const));
  const implementation = {
    status: "KNOWN" as const,
    gitSha: input.implementationIdentity,
    digest: digest({ format: "global-v2-live-implementation@v1", gitSha: input.implementationIdentity, registry: Object.entries(globalV2QueryRegistry).map(([resource, contract]) => ({ resource, contractVersion: contract.contractVersion, methodVersion: contract.methodVersion, policyVersions: contract.policyVersions })) }),
  };
  const candidateId = deterministicUuid({ format: "global-v2-live-candidate@v1", project: input.project, householdId: input.householdId, scope, dataRevision: input.dataRevision, analyticsRevision: input.analyticsRevision, implementation, outputDigests, labelDigests });
  const generatedAt = input.asOf;
  const provisionalMeta: GlobalReadModelPublicationMeta = {
    publicationId: candidateId,
    revision,
    factsHash: "0".repeat(64),
    generatedAt,
    profileId: globalV2PublicationProfileId,
    manifestHash: "0".repeat(64),
  };
  const dependenciesFor = (moduleKey: GlobalPrimaryModuleKey): readonly GlobalV2ResolvedDependency[] => {
    const output = outputDigests.find((entry) => entry.moduleKey === moduleKey)!;
    const labelDigest = labelDigests.find((entry) => entry.moduleKey === moduleKey);
    return [
      { authority: "METRIC", family: `global_${moduleKey.toLowerCase()}_owner_output`, identity: `${output.owner}:${moduleKey}`, digest: output.digest, required: true },
      ...(labelDigest === undefined ? [] : [{ authority: "CANONICAL" as const, family: `global_${moduleKey.toLowerCase()}_presentation_labels`, identity: `presentation-labels:${moduleKey}`, digest: labelDigest.digest, required: true }]),
    ];
  };
  const metaFor = (resource: GlobalV2QueryResourceName, params: GlobalV2QueryParams, dependencies: readonly GlobalV2ResolvedDependency[]): GlobalReadModelResourceMeta => ({
    contractVersion: globalV2QueryRegistry[resource].contractVersion,
    methodSignature: globalV2QueryMethodSignature(resource),
    policyVersions: globalV2QueryRegistry[resource].policyVersions,
    resourceInputHash: globalV2QueryResourceInputHash({ resource, scope, params, dependencies }),
  });
  const expandedResourceByModule = new Map(globalV2ExpandedResourceCatalog.slice(0, 10).map(({ moduleKey, resource }) => [moduleKey, resource] as const));
  const expandedOverviewKey = (moduleKey: GlobalPrimaryModuleKey): string => globalV2QueryInstanceKey(expandedResourceByModule.get(moduleKey)!, scopeHash, { sectionKey: "OVERVIEW" });
  const moduleInstances: GlobalV2QueryInstanceInput[] = outputs.map((ownerOutput) => {
    const catalog = globalPrimaryModuleCatalog.find(({ moduleKey }) => moduleKey === ownerOutput.moduleKey)!;
    const dependencies = dependenciesFor(ownerOutput.moduleKey);
    const params = {};
    const projection = projections.get(ownerOutput.moduleKey)!;
    const hasPresentationContent = projection.kpis.length > 0 || Object.values(projection.sections).some((section) => (section.metrics?.length ?? 0) + (section.series?.length ?? 0) + (section.rows?.length ?? 0) > 0);
    const decision = humanizePlaceholder(ownerOutput, publicationDecision(ownerOutput, revision, ownerOutput.knowledge === "PARTIAL" && hasPresentationContent ? "MODULE_DETAIL" : "AUTO_GLOBAL"));
    const visible = decision.visibility === "VISIBLE";
    return {
      resource: catalog.resource,
      scope,
      params,
      dependencies,
      payload: buildGlobalModuleCompactReadModel({
        moduleKey: ownerOutput.moduleKey,
        publicationDecision: decision,
        insightCandidates: [],
        ...(visible && projection.primaryInsight !== undefined ? { presentationInsight: projection.primaryInsight } : {}),
        kpis: visible ? projection.kpis : [],
        quality: quality(ownerOutput),
        capabilities: [capability(ownerOutput)],
        detailEntries: visible && projection.sections.OVERVIEW !== undefined ? [{ entryId: `expanded:${ownerOutput.moduleKey}`, labelKey: "global.detail", targetResource: expandedResourceByModule.get(ownerOutput.moduleKey)!, targetRef: expandedOverviewKey(ownerOutput.moduleKey) }] : [],
        publicationMeta: provisionalMeta,
        resourceMeta: metaFor(catalog.resource, params, dependencies),
      }),
    };
  });
  const expandedInstances: GlobalV2QueryInstanceInput[] = [];
  for (const ownerOutput of outputs) {
    const decision = publicationDecision(ownerOutput, revision, "MODULE_DETAIL");
    if (decision.visibility !== "VISIBLE") continue;
    const resource = expandedResourceByModule.get(ownerOutput.moduleKey)!;
    const dependencies = dependenciesFor(ownerOutput.moduleKey);
    const projection = projections.get(ownerOutput.moduleKey)!;
    for (const [sectionKey, section] of Object.entries(projection.sections) as Array<[GlobalExpandedSectionKey, SectionProjection]>) {
      const params = { sectionKey };
      expandedInstances.push({
        resource,
        scope,
        params,
        dependencies,
        payload: buildGlobalExpandedReadModel({
          kind: "global_expanded",
          schemaVersion: "global-expanded@v1",
          resource,
          moduleKey: ownerOutput.moduleKey,
          sectionKey,
          visibility: "VISIBLE",
          secondaryInsights: [],
          metrics: section.metrics ?? [],
          series: section.series ?? [],
          rows: section.rows ?? [],
          destinations: [],
          quality: quality(ownerOutput),
          capabilities: [capability(ownerOutput)],
          publicationMeta: provisionalMeta,
          resourceMeta: metaFor(resource, params, dependencies),
        }),
      });
    }
    const detailResource = detailResourceFor(ownerOutput.moduleKey);
    const detailRows = [...new Map(projection.detailRows.flatMap((detailRow) => detailRow.entityRef === undefined ? [] : [[detailRow.entityRef, detailRow] as const])).values()].slice(0, GLOBAL_MAX_SECTION_ROWS);
    if (detailResource !== undefined) for (const detailRow of detailRows) {
      const params = { entityRef: detailRow.entityRef! };
      const economicDetail = ownerOutput.moduleKey === "ECONOMIC" ? economicRecurrenceDetail(ownerOutput, detailRow.entityRef!) : undefined;
      expandedInstances.push({
        resource: detailResource,
        scope,
        params,
        dependencies,
        payload: buildGlobalExpandedReadModel({
          kind: "global_expanded", schemaVersion: "global-expanded@v1", resource: detailResource, moduleKey: ownerOutput.moduleKey, sectionKey: "OVERVIEW", visibility: "VISIBLE", secondaryInsights: [], metrics: economicDetail?.metrics ?? [], series: economicDetail?.series ?? [],
          rows: economicDetail?.rows ?? [{ ...detailRow, rowId: `detail:${detailRow.rowId}` }], destinations: [], quality: quality(ownerOutput), capabilities: [capability(ownerOutput)], publicationMeta: provisionalMeta, resourceMeta: metaFor(detailResource, params, dependencies),
        }),
      });
    }
    const methodologyParams = { moduleKey: ownerOutput.moduleKey, methodRef: `method:${ownerOutput.owner}` };
    expandedInstances.push({
      resource: "analysis_global_methodology",
      scope,
      params: methodologyParams,
      dependencies,
      payload: buildGlobalExpandedReadModel({
        kind: "global_expanded", schemaVersion: "global-expanded@v1", resource: "analysis_global_methodology", moduleKey: ownerOutput.moduleKey, sectionKey: "METHODOLOGY", visibility: "VISIBLE", secondaryInsights: [], metrics: [], series: [], rows: methodologyRows(ownerOutput), destinations: [], quality: quality(ownerOutput), capabilities: [{ capabilityId: "GLOBAL_METHODOLOGY", state: "AVAILABLE", reasonCodes: [] }], publicationMeta: provisionalMeta, resourceMeta: metaFor("analysis_global_methodology", methodologyParams, dependencies),
      }),
    });
  }
  const allOutputDependencies = outputs.flatMap(({ moduleKey }) => dependenciesFor(moduleKey));
  const initialParams = {};
  const initialPayload = buildGlobalInitialReadModel({
    modules: moduleInstances.map(({ payload }) => payload as never),
    capabilities: outputs.map(capability),
    resourceMeta: metaFor("analysis_global_manifest", initialParams, allOutputDependencies),
  });
  const summaryDependencies: readonly GlobalV2ResolvedDependency[] = [{ authority: "CANONICAL", family: "imported_global_summary", identity: `summary:${input.householdId}:missing`, digest: digest({ status: "MISSING", sourceRevision: input.dataRevision }), required: true }];
  const summaryPayload = buildImportedGlobalSummaryReadModel({ kind: "global_imported_summary", schemaVersion: "global-imported-summary@v1", status: "MISSING", publicationMeta: provisionalMeta, resourceMeta: metaFor("analysis_global_summary_ai", {}, summaryDependencies) });
  const provisionalInstances: GlobalV2QueryInstanceInput[] = [
    { resource: "analysis_global_manifest", scope, params: {}, payload: initialPayload, dependencies: allOutputDependencies },
    { resource: "analysis_global_summary_ai", scope, params: {}, payload: summaryPayload, dependencies: summaryDependencies },
    ...moduleInstances,
    ...expandedInstances,
  ];
  const artifactKey = `global-artifact:owner-outputs:${scopeHash}`;
  const artifactDependencies = allOutputDependencies;
  const artifactVersion: GlobalV2ResourceVersion = {
    key: artifactKey,
    family: "global_owner_outputs",
    contractVersion: "global-owner-outputs@v1",
    methodSignature: digest({ method: "global-v2-production-orchestration@v1", implementation }),
    policyVersions: { orchestration: "global-v2-production-orchestration@v1" },
    resourceInputHash: digest({ scope, outputDigests, labelDigests }),
  };
  const artifactClosure = { outputKey: artifactKey, declarationDigest: globalV2ClosureDeclarationDigest(artifactDependencies), inputDigest: globalV2ClosureInputDigest(artifactDependencies), dependencies: artifactDependencies };
  const manifestBase = {
    formatVersion: globalV2ManifestFormatVersion,
    profileId: globalV2PublicationProfileId,
    householdId: input.householdId,
    asOf: input.asOf,
    certifiedThrough: input.certifiedThrough,
    sourceRevision: input.dataRevision,
    baseAnalyticsRevision: input.analyticsRevision,
    resourceFamilies: [...globalV2ResourceFamilies],
    requiredArtifactKeys: [artifactKey],
    artifactVersions: [artifactVersion],
    artifactClosures: [artifactClosure],
    implementation,
  };
  const provisionalPlan = buildGlobalV2QueryPlan({ instances: provisionalInstances });
  const manifest = attachGlobalV2QueryPlanToManifest({ base: manifestBase, plan: provisionalPlan });
  const finalMeta: GlobalReadModelPublicationMeta = { ...provisionalMeta, factsHash: manifest.publicationFactsHash, manifestHash: manifest.manifestHash };
  const instances = provisionalInstances.map((instance) => ({ ...instance, payload: { ...(instance.payload as Record<string, unknown>), publicationMeta: finalMeta } }));
  const plan = buildGlobalV2QueryPlan({ instances });
  const finalManifest = attachGlobalV2QueryPlanToManifest({ base: manifestBase, plan });
  if (manifest.manifestHash !== finalManifest.manifestHash) throw new TypeError("GLOBAL_LIVE_CANDIDATE_NON_DETERMINISTIC");
  const artifactPayload = { kind: "global_owner_outputs", outputs: outputs.map(({ moduleKey, owner, output, knowledge, capabilityState, reasonCodes, evidenceRefs }) => ({ moduleKey, owner, output, knowledge, capabilityState, reasonCodes: [...reasonCodes].sort(), evidenceRefs: [...evidenceRefs].sort() })), presentationLabels, publicationMeta: finalMeta, resourceMeta: { contractVersion: artifactVersion.contractVersion, methodSignature: artifactVersion.methodSignature, policyVersions: artifactVersion.policyVersions, resourceInputHash: artifactVersion.resourceInputHash } };
  return {
    project: input.project,
    householdScope: input.householdId,
    asOf: input.asOf,
    dataRevision: input.dataRevision,
    analyticsRevision: input.analyticsRevision,
    implementationIdentity: input.implementationIdentity,
    candidateId,
    factsHash: finalManifest.publicationFactsHash,
    manifestHash: finalManifest.manifestHash,
    requiredArtifactCount: finalManifest.requiredArtifactKeys.length,
    requiredSnapshotCount: finalManifest.requiredQueryKeys.length,
    queryInstanceCount: plan.instances.length,
    availableCapabilities: [...new Set(Object.values(globalV2QueryRegistry).filter(({ availability }) => availability === "AVAILABLE").map(({ capabilityId }) => capabilityId))].sort(),
    gatedCapabilities: [...new Set(Object.values(globalV2QueryRegistry).filter(({ availability }) => availability === "AUTHORITY_GATED").map(({ capabilityId }) => capabilityId))].sort(),
    requiredKeys: { artifacts: finalManifest.requiredArtifactKeys, queries: finalManifest.requiredQueryKeys },
    versions: { artifacts: finalManifest.artifactVersions, queries: finalManifest.queryVersions },
    ownerOutputs: outputs,
    scope,
    scopeHash,
    plan,
    manifest: finalManifest,
    artifacts: [{ key: artifactKey, payload: artifactPayload, version: artifactVersion, dependencies: artifactDependencies }],
    snapshots: plan.instances.map((instance) => ({ key: instance.key, resource: instance.resource, scopeHash: instance.scopeHash, params: instance.params, payload: instance.payload, methodSignature: instance.methodSignature, resourceInputHash: instance.resourceInputHash, policyVersions: globalV2QueryRegistry[instance.resource].policyVersions, payloadHash: digest(instance.payload) })),
  };
}
