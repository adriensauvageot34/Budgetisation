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
  globalV2MethodRef,
  globalV2QueryRegistry,
  type GlobalCompactInsight,
  type GlobalCompactKpi,
  type GlobalCompactQuality,
  type GlobalDetailMetric,
  type GlobalNavigationDestination,
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
  readonly subcategories?: Readonly<Record<string, string>>;
  readonly needs?: Readonly<Record<string, string>>;
  readonly recurrences?: Readonly<Record<string, string>>;
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
  readonly destinationRows?: readonly GlobalDetailRow[];
  readonly primaryInsight?: GlobalCompactInsight;
  readonly secondaryInsights?: readonly GlobalCompactInsight[];
  readonly quality?: GlobalCompactQuality;
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

function formatRoundedMoney(value: unknown): string | undefined {
  const numeric = numberOf(value);
  return numeric === undefined ? undefined : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(numeric)} €`;
}

function frenchMonth(value: string | undefined): string | undefined {
  const match = value?.match(/^(\d{4})-(\d{2})/u);
  if (match === undefined || match === null) return undefined;
  const month = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][Number(match[2]) - 1];
  return month === undefined ? undefined : `${month} ${match[1]}`;
}

function roundedShares(values: readonly unknown[]): readonly (number | undefined)[] {
  const exact = values.map((value) => {
    const ratio = numberOf(value);
    return ratio === undefined || ratio < 0 ? undefined : ratio * 100;
  });
  if (exact.some((value) => value === undefined)) return exact.map(() => undefined);
  const whole = exact.map((value) => Math.floor(value!));
  let remaining = Math.max(0, 100 - whole.reduce((sum, value) => sum + value, 0));
  const priority = exact.map((value, index) => ({ index, remainder: value! - whole[index]! })).sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (const { index } of priority) {
    if (remaining <= 0) break;
    whole[index] = whole[index]! + 1;
    remaining -= 1;
  }
  return whole;
}

function projectedEvidence(output: GlobalV2OwnerOutput, evidenceRefs: readonly string[]): readonly string[] {
  const canonical = uniqueSorted(evidenceRefs);
  return canonical.length <= 32
    ? outputEvidence(output, ...canonical)
    : outputEvidence(output, `evidence-set:${digest(canonical)}`);
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
    evidenceRefs: projectedEvidence(output, arrayOf(at(value, "provenance", "evidenceRefs")).filter((entry): entry is string => typeof entry === "string")),
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
    evidenceRefs: projectedEvidence(output, arrayOf(at(value, "provenance", "evidenceRefs")).filter((entry): entry is string => typeof entry === "string")),
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

const GLOBAL_M2_QUERY_PROJECTION_VERSION = "global-m2-query-projection@v2";

function formatRatio(value: unknown, maximumFractionDigits = 1): string | undefined {
  const numeric = numberOf(value);
  return numeric === undefined ? undefined : `${formatNumber(numeric * 100, maximumFractionDigits)} %`;
}

function m2AxisQuality(output: GlobalV2OwnerOutput, axis: unknown, includeMonetaryCoverage = false): GlobalCompactQuality {
  const coverageDimensions = arrayOf(at(axis, "coverage", "dimensions"));
  const componentStatus = stringOf(at(coverageDimensions[0], "status")) ?? "UNKNOWN";
  const monetaryStatus = includeMonetaryCoverage ? stringOf(at(axis, "monetaryCoverage", "status")) ?? "UNKNOWN" : "KNOWN";
  const statuses = [componentStatus, monetaryStatus];
  const knowledgeState: GlobalCompactQuality["knowledgeState"] = statuses.includes("CONFLICT")
    ? "CONFLICT"
    : statuses.includes("UNKNOWN")
      ? "UNKNOWN"
      : statuses.includes("PARTIAL")
        ? "PARTIAL"
        : "KNOWN";
  const supportStatus = stringOf(at(axis, "support", "supportStatus"));
  const effectiveCoverage = numberOf(at(axis, "coverage", "effective"));
  const limitationCodes = uniqueSorted([
    ...(componentStatus === "KNOWN" ? [] : [`M2_COMPONENT_COVERAGE_${componentStatus}`]),
    ...(includeMonetaryCoverage && monetaryStatus !== "KNOWN" ? [`M2_MONETARY_COVERAGE_${monetaryStatus}`] : []),
  ]);
  const evidenceRefs = coverageDimensions.flatMap((dimension) => arrayOf(at(dimension, "evidenceRefs")))
    .filter((entry): entry is string => typeof entry === "string");
  return {
    knowledgeState,
    ...(knowledgeState === "PARTIAL" ? { partialMeaning: "OBSERVED_ONLY" as const } : {}),
    ...(supportStatus === "INSUFFICIENT" || supportStatus === "PARTIAL_SUPPORT" || supportStatus === "SUFFICIENT" || supportStatus === "STRONG" ? { supportStatus } : {}),
    ...(effectiveCoverage === undefined ? {} : { effectiveCoverage }),
    dataNature: "OBSERVED",
    limitationCodes,
    evidenceRefs: projectedEvidence(output, evidenceRefs),
  };
}

function m2PhenomenonQuality(input: {
  readonly result: unknown;
  readonly axis: unknown;
  readonly knowledgeState: GlobalPhenomenonQuality["knowledgeState"];
  readonly materialityStatus?: GlobalPhenomenonQuality["materialityStatus"];
  readonly limitations?: readonly string[];
}): GlobalPhenomenonQuality {
  const supportStatus = stringOf(at(input.axis, "support", "supportStatus"));
  const effectiveCoverage = numberOf(at(input.axis, "coverage", "effective"));
  return {
    knowledgeState: input.knowledgeState,
    ...(supportStatus === "INSUFFICIENT" || supportStatus === "PARTIAL_SUPPORT" || supportStatus === "SUFFICIENT" || supportStatus === "STRONG" ? { supportStatus } : {}),
    ...(effectiveCoverage === undefined ? {} : { effectiveCoverage }),
    ...(input.materialityStatus === undefined ? {} : { materialityStatus: input.materialityStatus }),
    limitationCodes: uniqueSorted(input.limitations ?? []),
    dataNature: "OBSERVED",
    methodVersion: GLOBAL_M2_QUERY_PROJECTION_VERSION,
    inputHash: stringOf(at(input.result, "inputHash")) ?? digest(input.result),
  };
}

function m2EntityRef(group: unknown, expectedKind: "CATEGORY" | "NEED"): string | undefined {
  const kind = stringOf(at(group, "drillDownRef", "kind"));
  const id = stringOf(at(group, "drillDownRef", "id"));
  return kind === expectedKind && id !== undefined ? `${kind.toLowerCase()}:${id}` : undefined;
}

function m2Metric(input: {
  readonly output: GlobalV2OwnerOutput;
  readonly result: unknown;
  readonly axis: unknown;
  readonly metricId: string;
  readonly labelKey: string;
  readonly value: unknown;
  readonly kind: GlobalTypedMeasure["kind"];
  readonly unit: string;
  readonly phenomenonRef: string;
  readonly evidenceRefs: readonly string[];
  readonly knowledgeState?: GlobalDetailMetric["knowledgeState"];
  readonly signed?: boolean;
}): GlobalDetailMetric | undefined {
  const raw = stringOf(input.value);
  if (raw === undefined) return undefined;
  const knowledgeState = input.knowledgeState ?? "KNOWN";
  const displayValue = input.kind === "RATIO" || input.kind === "DECIMAL" && input.unit === "ratio"
    ? formatRatio(raw)!
    : input.kind === "COUNT"
      ? `${formatNumber(raw, 0)} mois`
      : input.signed === true
        ? formatSignedMoney(raw)!
        : formatMoney(raw)!;
  return {
    metricId: input.metricId,
    labelKey: input.labelKey,
    displayValue,
    typedMeasure: { kind: input.kind, value: raw, unit: input.unit },
    phenomenonRef: input.phenomenonRef,
    phenomenonQuality: m2PhenomenonQuality({ result: input.result, axis: input.axis, knowledgeState }),
    knowledgeState,
    ...(knowledgeState === "PARTIAL" ? { partialMeaning: "OBSERVED_ONLY" as const } : {}),
    dataNature: "OBSERVED",
    evidenceRefs: projectedEvidence(input.output, input.evidenceRefs),
  };
}

function m2Row(input: {
  readonly output: GlobalV2OwnerOutput;
  readonly result: unknown;
  readonly axis: unknown;
  readonly rank: number;
  readonly rowId: string;
  readonly labelKey: string;
  readonly value: unknown;
  readonly kind?: GlobalTypedMeasure["kind"];
  readonly unit?: string;
  readonly displayValue?: string;
  readonly entityRef?: string;
  readonly phenomenonRef?: string;
  readonly evidenceRefs: readonly string[];
  readonly knowledgeState?: GlobalDetailRow["knowledgeState"];
  readonly materialityStatus?: GlobalPhenomenonQuality["materialityStatus"];
}): GlobalDetailRow | undefined {
  const raw = stringOf(input.value);
  if (raw === undefined) return undefined;
  const knowledgeState = input.knowledgeState ?? "KNOWN";
  return {
    rowId: `${String(input.rank).padStart(3, "0")}:${input.rowId}`,
    labelKey: input.labelKey,
    displayValue: input.displayValue ?? (input.kind === "RATIO" ? formatRatio(raw)! : formatMoney(raw)!),
    typedMeasure: { kind: input.kind ?? "MONEY", value: raw, unit: input.unit ?? "EUR" },
    phenomenonRef: input.phenomenonRef ?? input.entityRef ?? input.rowId,
    phenomenonQuality: m2PhenomenonQuality({ result: input.result, axis: input.axis, knowledgeState, materialityStatus: input.materialityStatus }),
    knowledgeState,
    ...(input.entityRef === undefined ? {} : { entityRef: input.entityRef }),
    evidenceRefs: projectedEvidence(input.output, input.evidenceRefs),
  };
}

function m2Series(input: {
  readonly output: GlobalV2OwnerOutput;
  readonly result: unknown;
  readonly axis: unknown;
  readonly seriesId: string;
  readonly labelKey: string;
  readonly phenomenonRef: string;
  readonly points: readonly unknown[];
  readonly evidenceRefs: readonly string[];
  readonly knowledgeState?: GlobalPhenomenonQuality["knowledgeState"];
}): GlobalDetailSeries {
  const knowledgeState = input.knowledgeState ?? "KNOWN";
  const pointQuality = m2PhenomenonQuality({ result: input.result, axis: input.axis, knowledgeState });
  return {
    seriesId: input.seriesId,
    labelKey: input.labelKey,
    unit: "EUR",
    points: input.points.flatMap((point) => {
      const month = stringOf(at(point, "month"));
      const amount = stringOf(at(point, "amount"));
      return month === undefined || amount === undefined ? [] : [{
        unitKey: month,
        displayValue: formatMoney(amount)!,
        typedMeasure: { kind: "MONEY" as const, value: amount, unit: "EUR" },
        phenomenonRef: input.phenomenonRef,
        phenomenonQuality: pointQuality,
        knowledgeState,
      }];
    }),
    evidenceRefs: projectedEvidence(input.output, input.evidenceRefs),
  };
}

function m2Kpi(input: {
  readonly output: GlobalV2OwnerOutput;
  readonly result: unknown;
  readonly axis: unknown;
  readonly kpiId: string;
  readonly labelKey: string;
  readonly value: unknown;
  readonly kind: GlobalTypedMeasure["kind"];
  readonly unit: string;
  readonly displayValue: string;
  readonly metricRef: string;
  readonly knowledgeState?: GlobalPhenomenonQuality["knowledgeState"];
}): GlobalCompactKpi | undefined {
  const raw = stringOf(input.value);
  if (raw === undefined) return undefined;
  return {
    kpiId: input.kpiId,
    phenomenonId: `presentation:${input.output.moduleKey.toLowerCase()}`,
    labelKey: input.labelKey,
    displayValue: input.displayValue,
    typedMeasure: { kind: input.kind, value: raw, unit: input.unit },
    phenomenonRef: input.metricRef,
    phenomenonQuality: m2PhenomenonQuality({ result: input.result, axis: input.axis, knowledgeState: input.knowledgeState ?? "KNOWN" }),
    metricRef: input.metricRef,
    evidenceRefs: outputEvidence(input.output),
  };
}

function economicProjection(output: GlobalV2OwnerOutput, presentationLabels: GlobalV2PresentationLabels): ModuleProjection {
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
      ...(minimal === undefined ? [] : [kpi(output, "kpi:economic:minimal", "Nos dépenses minimum", minimal, "global-m1:minimal")]),
    ];
    const delta = numberOf(rawActual) === undefined || numberOf(rawTypical) === undefined ? undefined : numberOf(rawActual)! - numberOf(rawTypical)!;
    const deltaAmount = delta === undefined ? undefined : formatMoney(Math.abs(delta));
    const statement = delta === undefined || deltaAmount === undefined || typical === undefined ? undefined : delta > 0
      ? `${deltaAmount} au-dessus de votre niveau habituel · Habituel : ${typical}/mois`
      : delta < 0 ? `${deltaAmount} sous votre niveau habituel · Habituel : ${typical}/mois` : `Très proche de votre niveau habituel · Habituel : ${typical}/mois`;
    const legacyLabels: Readonly<Record<string, string>> = { Fixe: "Fixe", Variable: "Variable", CURRENT: "Vie courante", NON_CURRENT: "Hors quotidien", "Vie courante": "Vie courante", "Hors quotidien": "Hors quotidien", Contraint: "Contraint", Contrainte: "Contraint", Indispensable: "Indispensable", Optionnel: "Optionnel", Optionnelle: "Optionnel", Ajustable: "Dépenses ajustables" };
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
    qualifiedKpi(output, "kpi:economic:minimal-state", "Nos dépenses minimum", minimalState, "global-m1:minimal-state"),
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
    qualifiedMetric(output, "minimal-state", "Nos dépenses minimum", minimalState),
    qualifiedMetric(output, "typical-minimal-gap", "Notre marge", minimalGap, { signed: true }),
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
    "Vie courante": "Vie courante", "Hors quotidien": "Hors quotidien",
    Contraint: "Contraint", Contrainte: "Contraint", Indispensable: "Indispensable",
    Optionnel: "Optionnel", Optionnelle: "Optionnel", Ajustable: "Dépenses ajustables",
  };
  let breakdownRank = 0;
  const breakdownRows = (["necessity", "behavior", "lifeScope"] as const).flatMap((axis) => {
    const axisLabel = axis === "necessity" ? "Nécessité" : axis === "behavior" ? "Comportement" : "Périmètre de vie";
    const axisValue = at(output.output, "structure", axis);
    const buckets = arrayOf(at(axisValue, "buckets"));
    const percentages = roundedShares(buckets.map((bucket) => at(bucket, "share")));
    const rows = buckets.map((bucket, index) => {
      const key = stringOf(at(bucket, "key")) ?? "UNKNOWN";
      breakdownRank += 1;
      const projected = qualifiedRow(output, breakdownRank, `${axis}:${key}`, `${axisLabel} · ${labels[key] ?? "Non classé"}`, bucket);
      const percentage = percentages[index];
      return percentage === undefined || projected.displayValue === undefined ? projected : { ...projected, displayValue: `${projected.displayValue} · ${percentage} %` };
    });
    for (const [kind, label] of [["unknownAmount", "Non classé"], ["conflictAmount", "Classification en conflit"]] as const) {
      const amount = at(axisValue, kind);
      if ((numberOf(amount) ?? 0) === 0) continue;
      breakdownRank += 1;
      rows.push(qualifiedRow(output, breakdownRank, `${axis}:${kind}`, `${axisLabel} · ${label}`, { amount }));
    }
    return rows;
  });

  const recurrenceAggregates = ([
    ["structural", "Coût récurrent structurel", "structuralRecurringCost"],
    ["new", "Nouvelles récurrences", "newRecurringEquivalent"],
    ["ended", "Récurrences terminées", "endedRecurringEquivalent"],
    ["restarted", "Récurrences reprises", "restartedRecurringEquivalent"],
    ["price-change", "Évolution des prix récurrents", "priceChangeExistingRecurrences"],
  ] as const).map(([id, label, key]) => qualifiedMetric(output, `recurrence-${id}`, label, at(output.output, "recurrences", key)));
  const recurrenceRows = arrayOf(at(output.output, "recurrences", "series")).map((recurrence, index) => {
    const recurrenceId = stringOf(at(recurrence, "recurrenceId"));
    const entityRef = `recurrence:${recurrenceId ?? index + 1}`;
    const lifecycle = stringOf(at(recurrence, "lifecycle", "value"));
    const cadence = numberOf(at(recurrence, "cadence", "expectedOccurrencesPerYear"));
    const typical = at(recurrence, "typicalOccurrenceCost");
    const measure = typedMeasure(at(typical, "value"), "MONEY", "EUR/occurrence");
    const occurrenceCount = numberOf(at(recurrence, "support", "occurrenceCount"));
    const first = stringOf(at(recurrence, "firstObservedAt"));
    const last = stringOf(at(recurrence, "lastObservedAt"));
    const firstMonth = frenchMonth(first);
    const lastMonth = frenchMonth(last);
    const observedRange = firstMonth === undefined ? lastMonth : lastMonth === undefined || lastMonth === firstMonth ? firstMonth : `${firstMonth} → ${lastMonth}`;
    const humanLabel = recurrenceId === undefined ? `Récurrence ${index + 1}` : presentationLabels.recurrences?.[recurrenceId] ?? `Récurrence ${index + 1}`;
    const projected = {
      rowId: `${String(index + 1).padStart(3, "0")}:${entityRef}`,
      labelKey: humanLabel,
      displayValue: [
        measure === undefined ? undefined : `≈ ${formatRoundedMoney(measure.value)} / paiement`,
        occurrenceCount === undefined ? undefined : `${occurrenceCount} paiement${occurrenceCount > 1 ? "s" : ""} observé${occurrenceCount > 1 ? "s" : ""}`,
        observedRange,
      ].filter((value): value is string => value !== undefined).join(" · "),
      ...(measure === undefined ? {} : { typedMeasure: measure }), phenomenonRef: `global-m1:${entityRef}`,
      phenomenonQuality: phenomenonQuality(typical, at(recurrence, "inputHash"), ...(cadence === undefined ? ["RECURRENCE_CADENCE_UNKNOWN"] : []), ...(lifecycle === undefined ? ["RECURRENCE_LIFECYCLE_UNKNOWN"] : [])),
      knowledgeState: knowledgeOf(typical), entityRef, evidenceRefs: outputEvidence(output),
    } satisfies GlobalDetailRow;
    return projected;
  }).sort((left, right) => (numberOf(right.typedMeasure?.value) ?? Number.NEGATIVE_INFINITY) - (numberOf(left.typedMeasure?.value) ?? Number.NEGATIVE_INFINITY) || left.labelKey.localeCompare(right.labelKey, "fr")).slice(0, 50);
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
  const categoryAxis = at(result, "categories");
  const needAxis = at(result, "needs");
  const categories = arrayOf(at(categoryAxis, "groups"));
  const needs = arrayOf(at(needAxis, "groups"));
  const categoryQuality = m2AxisQuality(output, categoryAxis);
  const needQuality = m2AxisQuality(output, needAxis, true);
  const knownCategories = categories.flatMap((group) => {
    const id = stringOf(at(group, "dimension", "id"));
    const label = id === undefined ? undefined : labels.categories?.[id];
    const entityRef = m2EntityRef(group, "CATEGORY");
    return id === undefined || label === undefined || entityRef === undefined ? [] : [{ group, id, label, entityRef }];
  });
  const rankedCategories = [...knownCategories]
    .sort((left, right) => byDescendingNumber(["annualAmount"])(left.group, right.group) || left.id.localeCompare(right.id))
    .slice(0, GLOBAL_MAX_SECTION_ROWS);
  const knownNeeds = needs.flatMap((group) => {
    const id = stringOf(at(group, "dimension", "id"));
    const label = id === undefined ? undefined : labels.needs?.[id];
    const entityRef = m2EntityRef(group, "NEED");
    return id === undefined || label === undefined || entityRef === undefined ? [] : [{ group, id, label, entityRef }];
  }).sort((left, right) => byDescendingNumber(["annualAmount"])(left.group, right.group) || left.id.localeCompare(right.id));
  const materiality = new GlobalMaterialityEngine();
  const shareDeltaPointsByPhenomenon = new Map<string, string>([
    ...categories.flatMap((group) => {
      const key = stringOf(at(group, "key"));
      const shareDeltaPoints = stringOf(at(group, "shareDeltaPoints"));
      return key === undefined || shareDeltaPoints === undefined ? [] : [[`category:${key}`, shareDeltaPoints] as const];
    }),
    ...needs.flatMap((group) => {
      const key = stringOf(at(group, "key"));
      const shareDeltaPoints = stringOf(at(group, "shareDeltaPoints"));
      return key === undefined || shareDeltaPoints === undefined ? [] : [[`need:${key}`, shareDeltaPoints] as const];
    }),
  ]);
  const categoryById = new Map(knownCategories.map((entry) => [entry.id, entry]));
  const materialMovements = arrayOf(at(result, "materialityCandidates")).flatMap((candidate) => {
    const phenomenonId = stringOf(at(candidate, "phenomenonId"));
    const shareDeltaPoints = phenomenonId === undefined ? undefined : shareDeltaPointsByPhenomenon.get(phenomenonId);
    const evaluation = materiality.evaluate({
      candidate: candidate as GlobalMaterialityCandidate,
      policyId: "CATEGORY_NEED",
      ...(shareDeltaPoints === undefined ? {} : { shareDeltaPoints }),
    });
    if (evaluation.status !== "MATERIAL") return [];
    return arrayOf(at(candidate, "entityRefs")).flatMap((ref) => {
      if (typeof ref !== "string" || !ref.startsWith("category:")) return [];
      const entry = categoryById.get(ref.slice("category:".length));
      return entry === undefined ? [] : [{ ...entry, candidate, evaluation }];
    });
  }).sort((left, right) => {
    const delta = Math.abs(numberOf(at(right.group, "deltaAmount")) ?? Number.NEGATIVE_INFINITY) - Math.abs(numberOf(at(left.group, "deltaAmount")) ?? Number.NEGATIVE_INFINITY);
    return delta || byDescendingNumber(["monthlyAmount"])(left.group, right.group) || left.id.localeCompare(right.id);
  });
  const notable = materialMovements[0];
  const categoryRows = rankedCategories.flatMap(({ group, id, label, entityRef }, index) => {
    const annualAmount = at(group, "annualAmount");
    const annualShare = formatRatio(at(group, "annualShare"));
    const activeMonths = formatNumber(at(group, "activeMonths"), 0);
    const displayValue = [formatMoney(annualAmount), annualShare, activeMonths === undefined ? undefined : `${activeMonths} mois actifs`].filter(Boolean).join(" · ");
    const projected = m2Row({ output, result, axis: categoryAxis, rank: index + 1, rowId: `category:${id}`, labelKey: label, value: annualAmount, entityRef, evidenceRefs: arrayOf(at(group, "evidenceRefs")).filter((entry): entry is string => typeof entry === "string"), displayValue });
    return projected === undefined ? [] : [projected];
  });
  const needRows = knownNeeds.slice(0, GLOBAL_MAX_SECTION_ROWS).flatMap(({ group, id, label, entityRef }, index) => {
    const annualAmount = at(group, "annualAmount");
    const annualShare = formatRatio(at(group, "annualShare"));
    const projected = m2Row({ output, result, axis: needAxis, rank: index + 1, rowId: `need:${id}`, labelKey: label, value: annualAmount, entityRef, evidenceRefs: arrayOf(at(group, "evidenceRefs")).filter((entry): entry is string => typeof entry === "string"), displayValue: [formatMoney(annualAmount), annualShare].filter(Boolean).join(" · ") });
    return projected === undefined ? [] : [projected];
  });
  const evolution = rankedCategories.slice(0, 3).flatMap(({ group, id, label, entityRef }) => {
    const points = arrayOf(at(group, "historicalSeries"));
    return points.length === 0 ? [] : [m2Series({ output, result, axis: categoryAxis, seriesId: `category-series:${id}`, labelKey: label, phenomenonRef: entityRef, points, evidenceRefs: arrayOf(at(group, "evidenceRefs")).filter((entry): entry is string => typeof entry === "string") })];
  });
  const materialityRows = materialMovements.slice(0, GLOBAL_MAX_SECTION_ROWS).flatMap(({ group, id, label, entityRef }, index) => {
    const deltaAmount = at(group, "deltaAmount");
    const delta = numberOf(deltaAmount);
    const current = formatMoney(at(group, "monthlyAmount"));
    const reference = formatMoney(at(group, "typicalAmount"));
    const direction = delta === undefined || delta === 0 ? "Stable" : delta > 0 ? "Hausse" : "Baisse";
    const projected = m2Row({ output, result, axis: categoryAxis, rank: index + 1, rowId: `materiality:${id}`, labelKey: `${direction} · ${label}`, value: deltaAmount, entityRef, evidenceRefs: arrayOf(at(group, "evidenceRefs")).filter((entry): entry is string => typeof entry === "string"), materialityStatus: "MATERIAL", displayValue: [formatSignedMoney(deltaAmount), current === undefined ? undefined : `mois ${current}`, reference === undefined ? undefined : `référence ${reference}`].filter(Boolean).join(" · ") });
    return projected === undefined ? [] : [projected];
  });
  const secondaryInsights: GlobalCompactInsight[] = materialMovements.slice(1, 5).map(({ group, id, label, entityRef }, index) => {
    const delta = numberOf(at(group, "deltaAmount"));
    const direction = delta === undefined || delta === 0 ? "se distingue de sa référence" : delta > 0 ? "est nettement au-dessus de sa référence" : "est nettement en dessous de sa référence";
    return {
      insightId: `presentation:categories_needs:material-change:${id}`,
      phenomenonId: `category:${id}`,
      kind: "MATERIAL_CHANGE",
      titleKey: label,
      statementKey: `${label} ${direction} de ${formatSignedMoney(at(group, "deltaAmount")) ?? "un montant non disponible"}.`,
      primaryMetricRef: `global-m2:category:${id}:delta`,
      entityRefs: [entityRef],
      evidenceRefs: projectedEvidence(output, arrayOf(at(group, "evidenceRefs")).filter((entry): entry is string => typeof entry === "string")),
      detailRefs: [],
      editorialRank: index + 2,
    };
  });
  const topFiveConcentration = rankedCategories.slice(0, 5).reduce((total, { group }) => total + (numberOf(at(group, "annualShare")) ?? 0), 0);
  const annualTotal = at(categoryAxis, "annualTotal");
  const knownMonetaryShare = at(needAxis, "monetaryCoverage", "knownShare");
  const annualTotalMetric = m2Metric({ output, result, axis: categoryAxis, metricId: "categories-annual-total", labelKey: "Dépenses sur la période", value: annualTotal, kind: "MONEY", unit: "EUR", phenomenonRef: "global-m2:categories:annual-total", evidenceRefs: output.evidenceRefs });
  const concentrationMetric = m2Metric({ output, result, axis: categoryAxis, metricId: "categories-top-five-concentration", labelKey: "Part des cinq principaux postes", value: String(topFiveConcentration), kind: "RATIO", unit: "ratio", phenomenonRef: "global-m2:categories:top-five-concentration", evidenceRefs: output.evidenceRefs });
  const componentCoverageMetric = m2Metric({ output, result, axis: needAxis, metricId: "needs-component-coverage", labelKey: "Composants avec un besoin renseigné", value: at(needAxis, "coverage", "effective"), kind: "RATIO", unit: "ratio", phenomenonRef: "global-m2:needs:component-coverage", evidenceRefs: needQuality.evidenceRefs, knowledgeState: needQuality.knowledgeState });
  const monetaryCoverageMetric = m2Metric({ output, result, axis: needAxis, metricId: "needs-monetary-coverage", labelKey: "Montant avec un besoin renseigné", value: knownMonetaryShare, kind: "RATIO", unit: "ratio", phenomenonRef: "global-m2:needs:monetary-coverage", evidenceRefs: needQuality.evidenceRefs, knowledgeState: needQuality.knowledgeState });
  const knownNeedAmountMetric = m2Metric({ output, result, axis: needAxis, metricId: "needs-known-annual-amount", labelKey: "Montant annuel renseigné", value: at(needAxis, "monetaryCoverage", "knownAmount"), kind: "MONEY", unit: "EUR", phenomenonRef: "global-m2:needs:known-annual-amount", evidenceRefs: needQuality.evidenceRefs, knowledgeState: needQuality.knowledgeState });
  const unresolvedNeedAmountMetric = m2Metric({ output, result, axis: needAxis, metricId: "needs-unclassified-annual-amount", labelKey: "Montant annuel non renseigné", value: at(needAxis, "monetaryCoverage", "unresolvedAmount"), kind: "MONEY", unit: "EUR", phenomenonRef: "global-m2:needs:unclassified-annual-amount", evidenceRefs: needQuality.evidenceRefs, knowledgeState: needQuality.knowledgeState });
  const notableDelta = notable === undefined ? undefined : formatSignedMoney(at(notable.group, "deltaAmount"));
  const notableCurrent = notable === undefined ? undefined : formatMoney(at(notable.group, "monthlyAmount"));
  const notableTypical = notable === undefined ? undefined : formatMoney(at(notable.group, "typicalAmount"));
  const compactKpis = [
    m2Kpi({ output, result, axis: categoryAxis, kpiId: "kpi:categories:annual-total", labelKey: "Dépenses sur la période", value: annualTotal, kind: "MONEY", unit: "EUR", displayValue: formatMoney(annualTotal) ?? "Montant indisponible", metricRef: "global-m2:categories:annual-total" }),
    m2Kpi({ output, result, axis: categoryAxis, kpiId: "kpi:categories:top-five-concentration", labelKey: "Cinq principaux postes", value: String(topFiveConcentration), kind: "RATIO", unit: "ratio", displayValue: `${formatRatio(topFiveConcentration) ?? "Part indisponible"} de nos dépenses`, metricRef: "global-m2:categories:top-five-concentration" }),
    m2Kpi({ output, result, axis: needAxis, kpiId: "kpi:needs:monetary-coverage", labelKey: "Besoins renseignés", value: knownMonetaryShare, kind: "RATIO", unit: "ratio", displayValue: `${formatRatio(knownMonetaryShare) ?? "Part indisponible"} du montant`, metricRef: "global-m2:needs:monetary-coverage", knowledgeState: needQuality.knowledgeState }),
  ].filter((entry): entry is GlobalCompactKpi => entry !== undefined);
  return {
    ...(notable === undefined || notableDelta === undefined || notableCurrent === undefined || notableTypical === undefined ? {} : {
      primaryInsight: presentationInsight(output, "notable-category", notable.label, `${notableDelta} par rapport à sa référence · ${notableCurrent} ce mois-ci · référence ${notableTypical}`, { primaryMetricRef: `global-m2:category:${notable.id}`, entityRefs: [notable.entityRef] }),
    }),
    kpis: compactKpis,
    sections: {
      OVERVIEW: { metrics: [annualTotalMetric, concentrationMetric].filter((entry): entry is GlobalDetailMetric => entry !== undefined), quality: categoryQuality },
      BREAKDOWN: { rows: categoryRows, quality: categoryQuality },
      PATTERNS: { metrics: [componentCoverageMetric, monetaryCoverageMetric, knownNeedAmountMetric, unresolvedNeedAmountMetric].filter((entry): entry is GlobalDetailMetric => entry !== undefined), rows: needRows, quality: needQuality },
      EVOLUTION: { series: evolution, quality: categoryQuality },
      COMPARISONS: { rows: materialityRows, secondaryInsights, quality: categoryQuality },
    },
    detailRows: [...categoryRows, ...needRows],
  };
}

function categoryNeedDetailProjection(output: GlobalV2OwnerOutput, labels: GlobalV2PresentationLabels, entityRef: string): (SectionProjection & { readonly quality: GlobalCompactQuality }) | undefined {
  const result = recordOf(at(output.output, "result"));
  const isCategory = entityRef.startsWith("category:");
  const isNeed = entityRef.startsWith("need:");
  if (!isCategory && !isNeed) return undefined;
  const axis = isCategory ? at(result, "categories") : at(result, "needs");
  const expectedKind = isCategory ? "CATEGORY" as const : "NEED" as const;
  const group = arrayOf(at(axis, "groups")).find((entry) => m2EntityRef(entry, expectedKind) === entityRef);
  if (group === undefined || stringOf(at(group, "dimension", "status")) !== "KNOWN") return undefined;
  const evidenceRefs = arrayOf(at(group, "evidenceRefs")).filter((entry): entry is string => typeof entry === "string");
  const quality = m2AxisQuality(output, axis, isNeed);
  const metrics = ([
    ["annual-amount", "Montant annuel", at(group, "annualAmount"), "MONEY", "EUR", false],
    ["annual-share", "Part annuelle", at(group, "annualShare"), "RATIO", "ratio", false],
    ["active-months", "Mois actifs", at(group, "activeMonths"), "COUNT", "month", false],
    ["current-amount", "Montant du mois cible", at(group, "monthlyAmount"), "MONEY", "EUR", false],
    ["typical-amount", "Référence Typical", at(group, "typicalAmount"), "MONEY", "EUR/month", false],
    ["delta-amount", "Écart à la référence", at(group, "deltaAmount"), "MONEY", "EUR", true],
    ["delta-relative", "Écart relatif", at(group, "deltaRelative"), "DECIMAL", "ratio", false],
  ] as const).flatMap(([id, label, value, kind, unit, signed]) => {
    const projected = m2Metric({ output, result, axis, metricId: `detail:${id}`, labelKey: label, value, kind, unit, phenomenonRef: `${entityRef}:${id}`, evidenceRefs, signed });
    return projected === undefined ? [] : [projected];
  });
  const series = [m2Series({ output, result, axis, seriesId: `detail:${entityRef}:history`, labelKey: "Évolution mensuelle", phenomenonRef: entityRef, points: arrayOf(at(group, "historicalSeries")), evidenceRefs })];
  const rows = isCategory
    ? arrayOf(at(group, "annualSubcategoryBreakdown")).flatMap((item, index) => {
        const key = stringOf(at(item, "key"));
        const annualAmount = at(item, "annualAmount");
        if (key === undefined) return [];
        const known = !key.startsWith("__");
        const label = known ? labels.subcategories?.[key] ?? "Sous-catégorie non libellée" : "Sous-catégorie non déterminée";
        const projected = m2Row({ output, result, axis, rank: index + 1, rowId: `subcategory:${key}`, labelKey: label, value: annualAmount, phenomenonRef: `subcategory:${key}`, evidenceRefs, knowledgeState: known ? "KNOWN" : "UNKNOWN", displayValue: [formatMoney(annualAmount), formatRatio(at(item, "annualShare"))].filter(Boolean).join(" · ") });
        return projected === undefined ? [] : [projected];
      })
    : arrayOf(at(group, "contributors")).flatMap((item, index) => {
        const key = stringOf(at(item, "key"));
        if (key === undefined) return [];
        const known = !key.startsWith("__");
        const projected = m2Row({ output, result, axis, rank: index + 1, rowId: `category:${key}`, labelKey: known ? labels.categories?.[key] ?? "Catégorie non libellée" : "Catégorie non déterminée", value: at(item, "amount"), phenomenonRef: `category:${key}`, evidenceRefs, knowledgeState: known ? "KNOWN" : "UNKNOWN" });
        return projected === undefined ? [] : [projected];
      });
  return { metrics, series, rows, quality };
}

const GLOBAL_LIFE_SPENDING_QUERY_PROJECTION_VERSION = "global-life-spending-query-projection@v1";

function lifeSpendingQuality(input: {
  readonly value: unknown;
  readonly knowledgeState: GlobalPhenomenonQuality["knowledgeState"];
  readonly supportStatus?: GlobalPhenomenonQuality["supportStatus"];
  readonly effectiveCoverage?: number;
  readonly materialityStatus?: GlobalPhenomenonQuality["materialityStatus"];
  readonly limitations?: readonly string[];
  readonly methodVersion?: string;
  readonly inputHash?: string;
}): GlobalPhenomenonQuality {
  return {
    knowledgeState: input.knowledgeState,
    ...(input.supportStatus === undefined ? {} : { supportStatus: input.supportStatus }),
    ...(input.effectiveCoverage === undefined ? {} : { effectiveCoverage: input.effectiveCoverage }),
    ...(input.materialityStatus === undefined ? {} : { materialityStatus: input.materialityStatus }),
    limitationCodes: uniqueSorted(input.limitations ?? []),
    dataNature: "OBSERVED",
    methodVersion: input.methodVersion ?? GLOBAL_LIFE_SPENDING_QUERY_PROJECTION_VERSION,
    inputHash: input.inputHash ?? digest(input.value),
  };
}

function personRhythmRows(output: GlobalV2OwnerOutput, labels: GlobalV2PresentationLabels, personIds: readonly string[]): readonly GlobalDetailRow[] {
  const rhythms = arrayOf(at(output.output, "rhythms")).flatMap((rhythm) => {
    const activityId = stringOf(at(rhythm, "activityId"));
    const personId = stringOf(at(rhythm, "personId"));
    const label = activityId === undefined ? undefined : activityLabel(activityId);
    return activityId === undefined || personId === undefined || label === undefined ? [] : [{ rhythm, activityId, personId, label, person: personLabel(personId, labels, personIds), authoritativePersonLabel: labels.persons?.[personId] }];
  }).sort((left, right) => byDescendingNumber(["support", "occurrenceCount"])(left.rhythm, right.rhythm) || byDescendingNumber(["rate", "value"])(left.rhythm, right.rhythm) || left.activityId.localeCompare(right.activityId) || left.personId.localeCompare(right.personId));
  return rhythms.map(({ rhythm, activityId, personId, label, person }, index) => {
    const count = formatNumber(at(rhythm, "support", "occurrenceCount"), 0) ?? "0";
    const median = formatNumber(at(rhythm, "cadence", "medianIntervalDays"), 1);
    const knowledgeState = knowledgeOf(at(rhythm, "rate"));
    return {
      rowId: `${String(index + 1).padStart(3, "0")}:rhythm:${personId}:${activityId}`,
      labelKey: `${label} · ${person}`,
      displayValue: `${count} occurrences${median === undefined ? "" : ` · intervalle médian ${median} jours`}`,
      ...(typedMeasure(at(rhythm, "support", "occurrenceCount"), "COUNT", "occurrence") === undefined ? {} : { typedMeasure: typedMeasure(at(rhythm, "support", "occurrenceCount"), "COUNT", "occurrence")! }),
      phenomenonRef: `global-m4:${personId}:${activityId}`,
      phenomenonQuality: lifeSpendingQuality({ value: rhythm, knowledgeState, supportStatus: stringOf(at(rhythm, "support", "supportStatus")) as GlobalPhenomenonQuality["supportStatus"], methodVersion: stringOf(at(rhythm, "methodVersion")), inputHash: stringOf(at(rhythm, "inputHash")) }),
      knowledgeState,
      entityRef: `person-activity:${personId}:${activityId}`,
      evidenceRefs: projectedEvidence(output, arrayOf(at(rhythm, "dependencyRefs")).filter((entry): entry is string => typeof entry === "string")),
    };
  });
}

function activityProfileRows(output: GlobalV2OwnerOutput): readonly GlobalDetailRow[] {
  return arrayOf(at(output.output, "activityCostProfiles")).flatMap((profile) => {
    const activityId = stringOf(at(profile, "activityId"));
    const label = activityId === undefined ? undefined : activityLabel(activityId);
    const total = numberOf(at(profile, "totalOccurrenceCount"));
    const known = numberOf(at(profile, "knownCausalCostCount"));
    const median = stringOf(at(profile, "causalCostSummary", "median"));
    const status = stringOf(at(profile, "causalCostSummary", "status"));
    const coverage = numberOf(at(profile, "coverage", "ratio"));
    const supportStatus = stringOf(at(profile, "support", "supportStatus"));
    if (activityId === undefined || label === undefined || total === undefined || total <= 0 || known === undefined || known < 4 || median === undefined || coverage === undefined || !["PARTIAL", "KNOWN"].includes(status ?? "")) return [];
    const knowledgeState = status as "KNOWN" | "PARTIAL";
    const limitations = knowledgeState === "PARTIAL" ? [stringOf(at(profile, "causalCostSummary", "reasonCode")) ?? "INDICATIVE_ACTIVITY_COST_SUPPORT"] : [];
    return [{
      rowId: `profile:${activityId}`,
      labelKey: label,
      displayValue: `Médiane des occurrences dont un coût est directement relié : ${formatMoney(median)} · ${known} occurrences renseignées sur ${total}`,
      typedMeasure: { kind: "MONEY" as const, value: median, unit: "EUR/occurrence" },
      phenomenonRef: `global-m4:activity-cost:${activityId}`,
      phenomenonQuality: lifeSpendingQuality({ value: profile, knowledgeState, supportStatus: supportStatus as GlobalPhenomenonQuality["supportStatus"], effectiveCoverage: coverage, limitations, methodVersion: stringOf(at(profile, "methodVersion")), inputHash: stringOf(at(profile, "inputHash")) }),
      knowledgeState,
      entityRef: `household-activity:${activityId}`,
      activityCostProfile: {
        knownCausalCostCount: { kind: "COUNT" as const, value: String(known), unit: "occurrence" },
        totalOccurrenceCount: { kind: "COUNT" as const, value: String(total), unit: "occurrence" },
        coverageRatio: { kind: "RATIO" as const, value: String(coverage), unit: "ratio" },
        nonAdditiveAcrossActivities: true as const,
      },
      evidenceRefs: projectedEvidence(output, arrayOf(at(profile, "knownOccurrenceCosts")).flatMap((entry) => arrayOf(at(entry, "evidenceRefs"))).filter((entry): entry is string => typeof entry === "string")),
    }];
  }).sort((left, right) => Number(right.activityCostProfile!.knownCausalCostCount.value) - Number(left.activityCostProfile!.knownCausalCostCount.value) || Number(right.activityCostProfile!.coverageRatio.value) - Number(left.activityCostProfile!.coverageRatio.value) || left.entityRef!.localeCompare(right.entityRef!)).slice(0, 12).map((entry, index) => ({ ...entry, rowId: `${String(index + 1).padStart(3, "0")}:${entry.rowId}` }));
}

type MomentProjectionEntry = { readonly summary: unknown; readonly momentId: string; readonly label: string; readonly typeLabel?: string; readonly amount: string; readonly start?: string; readonly end?: string };

function canonicalMomentEntries(output: GlobalV2OwnerOutput): readonly MomentProjectionEntry[] {
  const identities = new Map(arrayOf(at(output.output, "momentIdentities")).flatMap((identity) => {
    const momentId = stringOf(at(identity, "momentId"));
    const label = at(identity, "canonicalName", "status") === "KNOWN" ? stringOf(at(identity, "canonicalName", "value")) : undefined;
    return momentId === undefined || label === undefined ? [] : [[momentId, label] as const];
  }));
  const summaries = arrayOf(at(output.output, "summaries")).flatMap((summary) => {
    const momentId = stringOf(at(summary, "moment", "momentId"));
    const label = momentId === undefined ? undefined : identities.get(momentId);
    const amount = stringOf(at(summary, "causalCost", "value"));
    const status = stringOf(at(summary, "causalCost", "status"));
    return momentId === undefined || label === undefined || amount === undefined || numberOf(amount) === undefined || numberOf(amount)! <= 0 || !["KNOWN", "PARTIAL"].includes(status ?? "") ? [] : [{ summary, momentId, label, typeLabel: stringOf(at(summary, "moment", "type", "value")), amount, start: stringOf(at(summary, "moment", "startDate")), end: stringOf(at(summary, "moment", "endDate")) }];
  });
  return summaries.sort((left, right) => Number(right.amount) - Number(left.amount) || (left.start ?? "").localeCompare(right.start ?? "") || left.momentId.localeCompare(right.momentId));
}

function momentBreakdownRows(output: GlobalV2OwnerOutput, entries: readonly MomentProjectionEntry[]): readonly GlobalDetailRow[] {
  return entries.slice(0, 10).map(({ summary, momentId, label, typeLabel, amount, start, end }, index) => {
    const dates = start === undefined ? undefined : end === undefined || end === start ? start : `${start} → ${end}`;
    const knowledgeState = at(summary, "causalCost", "status") === "PARTIAL" ? "PARTIAL" as const : "KNOWN" as const;
    return {
      rowId: `${String(index + 1).padStart(3, "0")}:moment:${momentId}`,
      labelKey: label,
      displayValue: [typeLabel, formatMoney(amount), dates].filter(Boolean).join(" · "),
      typedMeasure: { kind: "MONEY", value: amount, unit: "EUR" },
      phenomenonRef: `moment:${momentId}:causal-cost`,
      phenomenonQuality: lifeSpendingQuality({ value: at(summary, "causalCost"), knowledgeState, effectiveCoverage: numberOf(at(summary, "causalCost", "coverage", "effective")), methodVersion: stringOf(at(output.output, "methodVersion")), inputHash: stringOf(at(output.output, "inputHash")) }),
      knowledgeState,
      entityRef: `moment:${momentId}`,
      evidenceRefs: projectedEvidence(output, arrayOf(at(summary, "sourceRefs")).filter((entry): entry is string => typeof entry === "string")),
    };
  });
}

function momentComparisonRows(output: GlobalV2OwnerOutput, entries: readonly MomentProjectionEntry[]): readonly GlobalDetailRow[] {
  const entryById = new Map(entries.map((entry) => [entry.momentId, entry]));
  const supportRank: Readonly<Record<string, number>> = { STRONG: 2, SUFFICIENT: 1 };
  const tierRank: Readonly<Record<string, number>> = { SAME_SERIES: 3, SAME_TYPE: 2, SAME_FAMILY: 1 };
  const candidates: Array<{ comparison: unknown; entry: MomentProjectionEntry; momentId: string; supportStatus: string; tier: string; peerCount: number; absoluteDelta: string; row: GlobalDetailRow }> = arrayOf(at(output.output, "comparisons")).flatMap((comparison) => {
    const momentId = stringOf(at(comparison, "momentId"));
    const entry = momentId === undefined ? undefined : entryById.get(momentId);
    const supportStatus = stringOf(at(comparison, "support", "supportStatus"));
    const tier = stringOf(at(comparison, "comparisonTier"));
    const profile = stringOf(at(comparison, "comparisonProfileId"));
    const subjectCost = stringOf(at(comparison, "subjectCost"));
    const peerMedian = stringOf(at(comparison, "peerMedianCost"));
    const absoluteDelta = stringOf(at(comparison, "absoluteDelta"));
    const peerCount = numberOf(at(comparison, "peerCount"));
    if (momentId === undefined || entry === undefined || at(comparison, "status") !== "KNOWN" || supportStatus === undefined || !["SUFFICIENT", "STRONG"].includes(supportStatus) || at(comparison, "materiality", "status") !== "MATERIAL" || tier === undefined || profile === undefined || subjectCost === undefined || peerMedian === undefined || absoluteDelta === undefined || peerCount === undefined) return [];
    const money = (value: string): GlobalTypedMeasure => ({ kind: "MONEY", value, unit: "EUR" });
    const optionalMoney = (key: string) => stringOf(at(comparison, key));
    const relativeDelta = stringOf(at(comparison, "relativeDelta"));
    return [{ comparison, entry, momentId, supportStatus, tier, peerCount, absoluteDelta, row: {
      rowId: `comparison:${momentId}`,
      labelKey: entry.label,
      displayValue: [entry.typeLabel, `${formatSignedMoney(absoluteDelta)} par rapport à la médiane des peers`, `${peerCount} expériences comparables`].filter(Boolean).join(" · "),
      typedMeasure: money(absoluteDelta),
      phenomenonRef: `moment:${momentId}:peer-comparison`,
      phenomenonQuality: lifeSpendingQuality({ value: comparison, knowledgeState: "KNOWN", supportStatus: supportStatus as "SUFFICIENT" | "STRONG", materialityStatus: "MATERIAL", methodVersion: stringOf(at(comparison, "methodVersion")), inputHash: stringOf(at(output.output, "inputHash")) }),
      knowledgeState: "KNOWN" as const,
      entityRef: `moment:${momentId}`,
      momentComparison: {
        comparisonTier: tier as "SAME_SERIES" | "SAME_TYPE" | "SAME_FAMILY",
        comparisonProfileId: profile,
        peerCount: { kind: "COUNT" as const, value: String(peerCount), unit: "moment" },
        subjectCost: money(subjectCost), peerMedian: money(peerMedian),
        ...(optionalMoney("q1") === undefined ? {} : { q1: money(optionalMoney("q1")!) }),
        ...(optionalMoney("q3") === undefined ? {} : { q3: money(optionalMoney("q3")!) }),
        ...(optionalMoney("mad") === undefined ? {} : { mad: money(optionalMoney("mad")!) }),
        absoluteDelta: money(absoluteDelta),
        ...(relativeDelta === undefined ? {} : { relativeDelta: { kind: "DECIMAL" as const, value: relativeDelta, unit: "ratio" } }),
      },
      evidenceRefs: projectedEvidence(output, arrayOf(at(comparison, "evidenceRefs")).filter((item): item is string => typeof item === "string")),
    } }];
  });
  return candidates.sort((left, right) => (supportRank[right.supportStatus] ?? 0) - (supportRank[left.supportStatus] ?? 0) || (tierRank[right.tier] ?? 0) - (tierRank[left.tier] ?? 0) || right.peerCount - left.peerCount || Math.abs(Number(right.absoluteDelta)) - Math.abs(Number(left.absoluteDelta)) || left.momentId.localeCompare(right.momentId)).slice(0, 10).map(({ row: projected }, index) => ({ ...projected, rowId: `${String(index + 1).padStart(3, "0")}:${projected.rowId}` }));
}

function m6Insight(output: GlobalV2OwnerOutput, rowValue: GlobalDetailRow, kind: "M6_MATERIAL_COMPARISON" | "M6_CONTEXTUAL_CAUSAL_MOMENT", rank: number): GlobalCompactInsight {
  return {
    insightId: `life-spending:${kind.toLowerCase()}:${rowValue.entityRef}`,
    phenomenonId: rowValue.entityRef!, kind, titleKey: rowValue.labelKey, statementKey: rowValue.displayValue ?? rowValue.labelKey,
    ...(rowValue.phenomenonRef === undefined ? {} : { primaryMetricRef: rowValue.phenomenonRef }),
    ...(rowValue.momentComparison === undefined ? {} : { comparisonRef: `${rowValue.momentComparison.comparisonProfileId}:${rowValue.momentComparison.comparisonTier}` }),
    entityRefs: [rowValue.entityRef!], evidenceRefs: rowValue.evidenceRefs, detailRefs: [rowValue.entityRef!], editorialRank: rank,
  };
}

function lifeSpendingProjection(outputs: ReadonlyMap<GlobalPrimaryModuleKey, GlobalV2OwnerOutput>, labels: GlobalV2PresentationLabels, personIds: readonly string[]): ModuleProjection {
  const rhythmOutput = outputs.get("RHYTHM")!;
  const transformationOutput = outputs.get("TRANSFORMATIONS")!;
  const relationshipOutput = outputs.get("RELATIONSHIPS")!;
  const momentOutput = outputs.get("MOMENTS")!;
  const profileRows = activityProfileRows(rhythmOutput);
  const rhythmRows = personRhythmRows(rhythmOutput, labels, personIds);
  const profiledActivityIds = new Set(profileRows.map((entry) => entry.entityRef!.slice("household-activity:".length)));
  const contextualRhythmRows = rhythmRows.filter((entry) => profiledActivityIds.has(entry.entityRef!.split(":").at(-1)!));
  const momentEntries = momentOutput.capabilityState === "UNAVAILABLE" || !["KNOWN", "PARTIAL"].includes(momentOutput.knowledge) ? [] : canonicalMomentEntries(momentOutput);
  const breakdownRows = momentBreakdownRows(momentOutput, momentEntries);
  const comparisonRows = momentComparisonRows(momentOutput, momentEntries);
  const narrativeIds = new Set(arrayOf(at(momentOutput.output, "narrative")).flatMap((entry) => at(entry, "eligible") === true && stringOf(at(entry, "momentId")) !== undefined ? [stringOf(at(entry, "momentId"))!] : []));
  const comparisonInsights = comparisonRows.slice(0, 2).map((entry, index) => m6Insight(momentOutput, entry, "M6_MATERIAL_COMPARISON", index + 1));
  const usedMomentIds = new Set(comparisonInsights.flatMap(({ entityRefs }) => entityRefs));
  const contextualRow = [...breakdownRows].sort((left, right) => Number(narrativeIds.has(right.entityRef!.slice("moment:".length))) - Number(narrativeIds.has(left.entityRef!.slice("moment:".length))) || left.rowId.localeCompare(right.rowId)).find((entry) => !usedMomentIds.has(entry.entityRef!));
  const contextualInsights = contextualRow === undefined ? [] : [m6Insight(momentOutput, contextualRow, "M6_CONTEXTUAL_CAUSAL_MOMENT", 1)];
  const transformationInsights = transformationOutput.reasonCodes.includes("TRANSFORMATION_INPUT_UNIVERSE_NOT_EVALUATED") ? [] : arrayOf(at(transformationOutput.output, "transformations")).filter((entry) => ["CONFIRMED_ONGOING", "CONFIRMED_CLOSED"].includes(stringOf(at(entry, "status")) ?? "")).slice(0, 1).flatMap((entry) => {
    const transformationId = stringOf(at(entry, "transformationId"));
    const title = stringOf(at(entry, "titleKey"));
    return transformationId === undefined || title === undefined ? [] : [{ insightId: `life-spending:m3:${transformationId}`, phenomenonId: `transformation:${transformationId}`, kind: "M3_CERTIFIED_TRANSFORMATION", titleKey: title, statementKey: title, entityRefs: [`transformation:${transformationId}`], evidenceRefs: projectedEvidence(transformationOutput, arrayOf(at(entry, "evidenceRefs")).filter((item): item is string => typeof item === "string")), detailRefs: [`transformation:${transformationId}`], editorialRank: 1 }];
  });
  const relationshipInsights = relationshipOutput.capabilityState === "UNAVAILABLE" || relationshipOutput.reasonCodes.some((code) => code.includes("AUTHORITY_GATED")) ? [] : arrayOf(at(relationshipOutput.output, "insights")).flatMap((entry) => {
    const id = stringOf(at(entry, "relationshipId")); const title = stringOf(at(entry, "titleKey")); const statement = stringOf(at(entry, "statementKey"));
    return id === undefined || title === undefined || statement === undefined || at(entry, "evidenceStatus") !== "PUBLISHED" || at(entry, "materiality", "status") !== "MATERIAL" || at(entry, "temporal", "robust") !== true ? [] : [{ insightId: `life-spending:m5:${id}`, phenomenonId: `relationship:${id}`, kind: "M5_MATERIAL_ROBUST_ASSOCIATION", titleKey: title, statementKey: statement, entityRefs: [`relationship:${id}`], evidenceRefs: projectedEvidence(relationshipOutput, arrayOf(at(entry, "evidenceRefs")).filter((item): item is string => typeof item === "string")), detailRefs: [`relationship:${id}`], editorialRank: 1 }];
  }).slice(0, 1);
  const selected = [...transformationInsights, ...relationshipInsights, ...comparisonInsights, ...contextualInsights].slice(0, 3).map((entry, index) => ({ ...entry, editorialRank: index + 1 }));
  const overviewRows = selected.flatMap((insight, index) => {
    const source = [...comparisonRows, ...breakdownRows].find((entry) => entry.entityRef === insight.entityRefs[0]);
    return source === undefined ? [] : [{ ...source, rowId: `${String(index + 1).padStart(3, "0")}:overview:${source.entityRef}` }];
  });
  return {
    ...(selected[0] === undefined ? {} : { primaryInsight: selected[0] }), kpis: [],
    sections: {
      OVERVIEW: { ...(selected[0] === undefined ? {} : { primaryInsight: selected[0] }), secondaryInsights: selected.slice(1), rows: overviewRows, destinationRows: overviewRows },
      ...(profileRows.length === 0 ? {} : { PATTERNS: { rows: profileRows, destinationRows: profileRows } }),
      ...(breakdownRows.length === 0 ? {} : { BREAKDOWN: { rows: breakdownRows, destinationRows: breakdownRows } }),
      ...(comparisonRows.length === 0 ? {} : { COMPARISONS: { rows: comparisonRows, destinationRows: comparisonRows } }),
      ...(transformationInsights.length === 0 ? {} : { EVOLUTION: { secondaryInsights: transformationInsights } }),
    },
    detailRows: [...profileRows, ...contextualRhythmRows],
  };
}

function momentProjection(output: GlobalV2OwnerOutput): ModuleProjection {
  const summaries = arrayOf(at(output.output, "summaries")).flatMap((summary) => {
    const momentId = stringOf(at(summary, "moment", "momentId")); const label = stringOf(at(summary, "moment", "type", "value")); const amount = at(summary, "causalCost", "value");
    return momentId === undefined || label === undefined || formatMoney(amount) === undefined ? [] : [{ summary, momentId, label, amount }];
  }).sort((left, right) => byDescendingNumber(["causalCost", "value"])(left.summary, right.summary) || (stringOf(at(right.summary, "moment", "startDate")) ?? "").localeCompare(stringOf(at(left.summary, "moment", "startDate")) ?? "") || left.momentId.localeCompare(right.momentId));
  const summaryRows = summaries.slice(0, 5).map(({ summary, momentId, label, amount }, index) => {
    const start = stringOf(at(summary, "moment", "startDate")); const end = stringOf(at(summary, "moment", "endDate")); const dates = start === undefined ? undefined : end === undefined || end === start ? start : `${start} → ${end}`;
    return row(output, index + 1, `moment:${momentId}`, label, [formatMoney(amount), dates].filter(Boolean).join(" · "), `moment:${momentId}`, at(summary, "causalCost", "status") === "PARTIAL" ? "PARTIAL" : "KNOWN");
  });
  const comparisonRows = arrayOf(at(output.output, "comparisons")).slice(0, 5).flatMap((comparison, index) => {
    const momentId = stringOf(at(comparison, "momentId")); const subjectCost = formatMoney(at(comparison, "subjectCost")); const peerCount = formatNumber(at(comparison, "peerCount"), 0);
    return momentId === undefined || subjectCost === undefined ? [] : [row(output, index + 1, `comparison:${momentId}`, summaries.find((entry) => entry.momentId === momentId)?.label ?? "Moment", `${subjectCost}${peerCount === undefined ? "" : ` · ${peerCount} moments comparables`}`, `moment:${momentId}`, "KNOWN")];
  });
  const paymentPhaseLabels: Readonly<Record<string, string>> = { PAID_BEFORE: "Payé avant", PAID_DURING: "Payé pendant", PAID_AFTER: "Payé après", UNKNOWN_PAYMENT_PHASE: "Date de paiement non déterminée" };
  const timelineRows = summaries.slice(0, 5).flatMap(({ summary, momentId, label }) => arrayOf(at(summary, "paymentTimeline")).flatMap((entry) => {
    const phase = stringOf(at(entry, "paymentPhase")); const amount = formatMoney(at(entry, "amount")); return phase === undefined || amount === undefined ? [] : [{ momentId, label, phase, amount }];
  })).slice(0, GLOBAL_MAX_SECTION_ROWS).map(({ momentId, label, phase, amount }, index) => row(output, index + 1, `timeline:${momentId}:${phase}`, `${label} · ${paymentPhaseLabels[phase] ?? "Temporalité de paiement"}`, amount, `moment:${momentId}`, "KNOWN"));
  const headline = summaries.find(({ summary }) => at(summary, "causalCost", "status") === "KNOWN" && stringOf(at(summary, "moment", "startDate")) !== undefined);
  const headlineDate = headline === undefined ? undefined : stringOf(at(headline.summary, "moment", "startDate")); const headlineEnd = headline === undefined ? undefined : stringOf(at(headline.summary, "moment", "endDate"));
  const headlineDates = headlineDate === undefined ? undefined : headlineEnd === undefined || headlineEnd === headlineDate ? headlineDate : `${headlineDate} → ${headlineEnd}`;
  const contextCount = arrayOf(at(output.output, "summaries")).length;
  const entries = canonicalMomentEntries(output);
  const reachable = [...new Map([...momentBreakdownRows(output, entries), ...momentComparisonRows(output, entries)].map((entry) => [entry.entityRef!, entry])).values()];
  return {
    ...(headline === undefined || headlineDates === undefined ? {} : { primaryInsight: presentationInsight(output, "highest-causal-cost", headline.label, `${formatMoney(headline.amount)} · ${headlineDates} · ${contextCount} moments en contexte · Analyse partielle`, { primaryMetricRef: `global-m6:${headline.momentId}`, entityRefs: [`moment:${headline.momentId}`] }) }),
    kpis: summaries.slice(0, 3).map(({ momentId, label, amount }, index) => kpi(output, `kpi:moments:${String(index).padStart(2, "0")}`, label, formatMoney(amount)!, `global-m6:${momentId}`)),
    sections: { OVERVIEW: { rows: summaryRows }, COMPARISONS: { rows: comparisonRows }, ...(timelineRows.length === 0 ? {} : { PATTERNS: { rows: timelineRows } }) }, detailRows: reachable,
  };
}

function detailMetric(input: { readonly output: GlobalV2OwnerOutput; readonly id: string; readonly label: string; readonly value: unknown; readonly kind: GlobalTypedMeasure["kind"]; readonly unit: string; readonly quality: GlobalPhenomenonQuality; readonly knowledgeState?: GlobalDetailMetric["knowledgeState"]; readonly evidenceRefs?: readonly string[] }): GlobalDetailMetric | undefined {
  const raw = stringOf(input.value);
  if (raw === undefined) return undefined;
  const knowledgeState = input.knowledgeState ?? input.quality.knowledgeState;
  return {
    metricId: input.id, labelKey: input.label,
    displayValue: input.kind === "MONEY" ? formatMoney(raw)! : input.kind === "RATIO" ? formatRatio(raw)! : formatNumber(raw, input.kind === "COUNT" ? 0 : 4)!,
    typedMeasure: { kind: input.kind, value: raw, unit: input.unit }, phenomenonRef: input.id, phenomenonQuality: input.quality,
    knowledgeState, ...(knowledgeState === "PARTIAL" ? { partialMeaning: "OBSERVED_ONLY" as const } : {}), dataNature: "OBSERVED",
    evidenceRefs: projectedEvidence(input.output, input.evidenceRefs ?? []),
  };
}

function routineDetailProjection(output: GlobalV2OwnerOutput, labels: GlobalV2PresentationLabels, personIds: readonly string[], entityRef: string): SectionProjection | undefined {
  if (entityRef.startsWith("household-activity:")) {
    const activityId = entityRef.slice("household-activity:".length);
    const profile = arrayOf(at(output.output, "activityCostProfiles")).find((entry) => stringOf(at(entry, "activityId")) === activityId);
    if (profile === undefined) return undefined;
    const knowledgeState = stringOf(at(profile, "causalCostSummary", "status")) as "KNOWN" | "PARTIAL";
    const profileQuality = lifeSpendingQuality({ value: profile, knowledgeState, supportStatus: stringOf(at(profile, "support", "supportStatus")) as GlobalPhenomenonQuality["supportStatus"], effectiveCoverage: numberOf(at(profile, "coverage", "ratio")), limitations: knowledgeState === "PARTIAL" ? [stringOf(at(profile, "causalCostSummary", "reasonCode")) ?? "INDICATIVE_ACTIVITY_COST_SUPPORT"] : [], methodVersion: stringOf(at(profile, "methodVersion")), inputHash: stringOf(at(profile, "inputHash")) });
    const metrics = [
      detailMetric({ output, id: `${entityRef}:median`, label: "Médiane des occurrences dont un coût est directement relié", value: at(profile, "causalCostSummary", "median"), kind: "MONEY", unit: "EUR/occurrence", quality: profileQuality, knowledgeState }),
      detailMetric({ output, id: `${entityRef}:known-count`, label: "Occurrences renseignées", value: at(profile, "knownCausalCostCount"), kind: "COUNT", unit: "occurrence", quality: profileQuality, knowledgeState: "KNOWN" }),
      detailMetric({ output, id: `${entityRef}:total-count`, label: "Occurrences observées au foyer", value: at(profile, "totalOccurrenceCount"), kind: "COUNT", unit: "occurrence", quality: profileQuality, knowledgeState: "KNOWN" }),
      detailMetric({ output, id: `${entityRef}:coverage`, label: "Couverture des coûts causaux", value: at(profile, "coverage", "ratio"), kind: "RATIO", unit: "ratio", quality: profileQuality, knowledgeState: "KNOWN" }),
    ].filter((entry): entry is GlobalDetailMetric => entry !== undefined);
    const contextRows = personRhythmRows(output, labels, personIds).filter((entry) => entry.entityRef?.endsWith(`:${activityId}`)).map((entry) => ({ ...entry, rowId: `context:${entry.rowId}` }));
    const occurrenceRows = arrayOf(at(profile, "knownOccurrenceCosts")).slice(0, 24).flatMap((entry, index) => {
      const occurrenceId = stringOf(at(entry, "occurrenceId")); const amount = stringOf(at(entry, "causalCost"));
      if (occurrenceId === undefined || amount === undefined) return [];
      return [{ rowId: `${String(index + 1).padStart(3, "0")}:occurrence-cost:${occurrenceId}`, labelKey: "Occurrence dont un coût est directement relié", displayValue: formatMoney(amount)!, typedMeasure: { kind: "MONEY" as const, value: amount, unit: "EUR" }, phenomenonRef: `activity-occurrence:${occurrenceId}:causal-cost`, phenomenonQuality: profileQuality, knowledgeState: "KNOWN" as const, evidenceRefs: projectedEvidence(output, [...arrayOf(at(entry, "causalComponentRefs")), ...arrayOf(at(entry, "evidenceRefs"))].filter((item): item is string => typeof item === "string")) }];
    });
    return { metrics, rows: [...contextRows, ...occurrenceRows] };
  }
  if (entityRef.startsWith("person-activity:")) {
    const [, personId, activityId] = entityRef.split(":");
    const rhythm = arrayOf(at(output.output, "rhythms")).find((entry) => stringOf(at(entry, "personId")) === personId && stringOf(at(entry, "activityId")) === activityId);
    if (rhythm === undefined) return undefined;
    const knowledgeState = knowledgeOf(at(rhythm, "rate"));
    const rhythmQuality = lifeSpendingQuality({ value: rhythm, knowledgeState, supportStatus: stringOf(at(rhythm, "support", "supportStatus")) as GlobalPhenomenonQuality["supportStatus"], methodVersion: stringOf(at(rhythm, "methodVersion")), inputHash: stringOf(at(rhythm, "inputHash")) });
    return { metrics: [
      detailMetric({ output, id: `${entityRef}:occurrences`, label: "Occurrences observées", value: at(rhythm, "support", "occurrenceCount"), kind: "COUNT", unit: "occurrence", quality: rhythmQuality, knowledgeState: "KNOWN" }),
      detailMetric({ output, id: `${entityRef}:rate`, label: "Rythme par jour observable", value: at(rhythm, "rate", "value"), kind: "DECIMAL", unit: "occurrence/observable-day", quality: rhythmQuality, knowledgeState }),
      detailMetric({ output, id: `${entityRef}:cadence`, label: "Intervalle médian", value: at(rhythm, "cadence", "medianIntervalDays"), kind: "DECIMAL", unit: "day", quality: rhythmQuality, knowledgeState: knowledgeOf(at(rhythm, "cadence")) }),
    ].filter((entry): entry is GlobalDetailMetric => entry !== undefined) };
  }
  return undefined;
}

function momentDetailProjection(output: GlobalV2OwnerOutput, entityRef: string): SectionProjection | undefined {
  if (!entityRef.startsWith("moment:")) return undefined;
  const momentId = entityRef.slice("moment:".length);
  const entry = canonicalMomentEntries(output).find((candidate) => candidate.momentId === momentId);
  if (entry === undefined) return undefined;
  const summaryQuality = lifeSpendingQuality({ value: entry.summary, knowledgeState: at(entry.summary, "causalCost", "status") === "PARTIAL" ? "PARTIAL" : "KNOWN", methodVersion: stringOf(at(output.output, "methodVersion")), inputHash: stringOf(at(output.output, "inputHash")) });
  const comparison = arrayOf(at(output.output, "comparisons")).find((candidate) => stringOf(at(candidate, "momentId")) === momentId && at(candidate, "status") === "KNOWN");
  const comparisonQuality = comparison === undefined ? undefined : lifeSpendingQuality({ value: comparison, knowledgeState: "KNOWN", supportStatus: stringOf(at(comparison, "support", "supportStatus")) as GlobalPhenomenonQuality["supportStatus"], materialityStatus: stringOf(at(comparison, "materiality", "status")) as GlobalPhenomenonQuality["materialityStatus"], methodVersion: stringOf(at(comparison, "methodVersion")), inputHash: stringOf(at(output.output, "inputHash")) });
  const moneyMetric = (id: string, label: string, value: unknown, q = summaryQuality) => detailMetric({ output, id: `${entityRef}:${id}`, label, value, kind: "MONEY", unit: "EUR", quality: q, knowledgeState: q.knowledgeState });
  const metrics = [
    moneyMetric("causal-cost", "Coût directement relié", at(entry.summary, "causalCost", "value")),
    moneyMetric("spent-during", "Dépenses pendant la période", at(entry.summary, "spentDuring", "value"), lifeSpendingQuality({ value: at(entry.summary, "spentDuring"), knowledgeState: knowledgeOf(at(entry.summary, "spentDuring")), methodVersion: stringOf(at(output.output, "methodVersion")), inputHash: stringOf(at(output.output, "inputHash")) })),
    ...(comparison === undefined || comparisonQuality === undefined ? [] : [
      moneyMetric("subject-cost", "Coût du Moment comparé", at(comparison, "subjectCost"), comparisonQuality),
      moneyMetric("peer-median", "Médiane des expériences comparables", at(comparison, "peerMedianCost"), comparisonQuality),
      moneyMetric("q1", "Premier quartile historique", at(comparison, "q1"), comparisonQuality),
      moneyMetric("q3", "Troisième quartile historique", at(comparison, "q3"), comparisonQuality),
      moneyMetric("mad", "Écart absolu médian historique", at(comparison, "mad"), comparisonQuality),
      moneyMetric("absolute-delta", "Écart à la médiane des peers", at(comparison, "absoluteDelta"), comparisonQuality),
      detailMetric({ output, id: `${entityRef}:relative-delta`, label: "Écart relatif à la médiane", value: at(comparison, "relativeDelta"), kind: "DECIMAL", unit: "ratio", quality: comparisonQuality, knowledgeState: "KNOWN" }),
      detailMetric({ output, id: `${entityRef}:peer-count`, label: "Expériences comparables", value: at(comparison, "peerCount"), kind: "COUNT", unit: "moment", quality: comparisonQuality, knowledgeState: "KNOWN" }),
    ]),
  ].filter((item): item is GlobalDetailMetric => item !== undefined);
  const dates = entry.start === undefined ? undefined : entry.end === undefined || entry.end === entry.start ? entry.start : `${entry.start} → ${entry.end}`;
  const detailComparisonContext = comparison === undefined ? undefined : (() => {
    const comparisonTier = stringOf(at(comparison, "comparisonTier")); const comparisonProfileId = stringOf(at(comparison, "comparisonProfileId")); const peerCount = numberOf(at(comparison, "peerCount")); const subjectCost = stringOf(at(comparison, "subjectCost")); const peerMedian = stringOf(at(comparison, "peerMedianCost")); const absoluteDelta = stringOf(at(comparison, "absoluteDelta"));
    if (comparisonTier === undefined || comparisonProfileId === undefined || peerCount === undefined || subjectCost === undefined || peerMedian === undefined || absoluteDelta === undefined) return undefined;
    const money = (value: string): GlobalTypedMeasure => ({ kind: "MONEY", value, unit: "EUR" }); const optionalMoney = (key: string) => stringOf(at(comparison, key)); const relativeDelta = stringOf(at(comparison, "relativeDelta"));
    return { comparisonTier: comparisonTier as "SAME_SERIES" | "SAME_TYPE" | "SAME_FAMILY", comparisonProfileId, peerCount: { kind: "COUNT" as const, value: String(peerCount), unit: "moment" }, subjectCost: money(subjectCost), peerMedian: money(peerMedian), ...(optionalMoney("q1") === undefined ? {} : { q1: money(optionalMoney("q1")!) }), ...(optionalMoney("q3") === undefined ? {} : { q3: money(optionalMoney("q3")!) }), ...(optionalMoney("mad") === undefined ? {} : { mad: money(optionalMoney("mad")!) }), absoluteDelta: money(absoluteDelta), ...(relativeDelta === undefined ? {} : { relativeDelta: { kind: "DECIMAL" as const, value: relativeDelta, unit: "ratio" } }) };
  })();
  const identityRow: GlobalDetailRow = { rowId: `000:moment-identity:${momentId}`, labelKey: entry.label, displayValue: [entry.typeLabel, dates].filter(Boolean).join(" · "), phenomenonRef: entityRef, phenomenonQuality: comparisonQuality ?? summaryQuality, knowledgeState: "KNOWN", entityRef, ...(detailComparisonContext === undefined ? {} : { momentComparison: detailComparisonContext }), evidenceRefs: projectedEvidence(output, arrayOf(at(entry.summary, "sourceRefs")).filter((item): item is string => typeof item === "string")) };
  const compositionRows = arrayOf(at(entry.summary, "composition")).flatMap((component, index) => {
    const key = stringOf(at(component, "key")); const amount = stringOf(at(component, "amount"));
    return key === undefined || amount === undefined ? [] : [{ rowId: `${String(index + 1).padStart(3, "0")}:composition:${key}`, labelKey: "Composante causale", displayValue: formatMoney(amount)!, typedMeasure: { kind: "MONEY" as const, value: amount, unit: "EUR" }, phenomenonRef: `${entityRef}:component:${key}`, phenomenonQuality: summaryQuality, knowledgeState: "KNOWN" as const, evidenceRefs: projectedEvidence(output, arrayOf(at(component, "evidenceRefs")).filter((item): item is string => typeof item === "string")) }];
  });
  return { metrics, rows: [identityRow, ...compositionRows] };
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

function projectModule(output: GlobalV2OwnerOutput, outputs: ReadonlyMap<GlobalPrimaryModuleKey, GlobalV2OwnerOutput>, labels: GlobalV2PresentationLabels, personIds: readonly string[]): ModuleProjection {
  switch (output.moduleKey) {
    case "ECONOMIC": return economicProjection(output, labels);
    case "CATEGORIES_NEEDS": return categoryNeedProjection(output, labels);
    case "TRANSFORMATIONS": return output.reasonCodes.includes("TRANSFORMATION_INPUT_UNIVERSE_NOT_EVALUATED") ? { kpis: [], sections: {}, detailRows: [] } : neutralProjection(output, "Changements certifiés", "Les changements certifiés restent disponibles dans la ressource technique.");
    case "RHYTHM": return lifeSpendingProjection(outputs, labels, personIds);
    case "RELATIONSHIPS": return output.reasonCodes.some((code) => code.includes("AUTHORITY_GATED")) ? { kpis: [], sections: {}, detailRows: [] } : neutralProjection(output, "Associations certifiées", "Les associations certifiées restent disponibles dans la ressource technique.");
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
    subcategories: sortLabels(input.presentationLabels?.subcategories),
    needs: sortLabels(input.presentationLabels?.needs),
    recurrences: sortLabels(input.presentationLabels?.recurrences),
  };
  const labelInputsFor = (moduleKey: GlobalPrimaryModuleKey): unknown => {
    if (moduleKey === "ECONOMIC") return { recurrences: presentationLabels.recurrences };
    if (moduleKey === "CATEGORIES_NEEDS") return { categories: presentationLabels.categories, subcategories: presentationLabels.subcategories, needs: presentationLabels.needs };
    if (moduleKey === "RHYTHM" || moduleKey === "PERSONAS") return { persons: presentationLabels.persons };
    if (moduleKey === "GEO_MOBILITY") return { places: presentationLabels.places };
    return undefined;
  };
  const outputDigests = outputs.map((item) => ({ moduleKey: item.moduleKey, owner: item.owner, digest: digest(item.output), knowledge: item.knowledge, capabilityState: item.capabilityState }));
  const labelDigests = outputs.flatMap(({ moduleKey }) => labelInputsFor(moduleKey) === undefined ? [] : [{ moduleKey, digest: digest(labelInputsFor(moduleKey)) }]);
  const outputsByModule = new Map(outputs.map((output) => [output.moduleKey, output] as const));
  const projections = new Map(outputs.map((output) => [output.moduleKey, projectModule(output, outputsByModule, presentationLabels, input.personIds)] as const));
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
    const dependencyModules: readonly GlobalPrimaryModuleKey[] = moduleKey === "RHYTHM" ? ["TRANSFORMATIONS", "RHYTHM", "RELATIONSHIPS", "MOMENTS"] : [moduleKey];
    return dependencyModules.flatMap((dependencyModule) => {
      const output = outputDigests.find((entry) => entry.moduleKey === dependencyModule)!;
      const labelDigest = labelDigests.find((entry) => entry.moduleKey === dependencyModule);
      return [
        { authority: "METRIC" as const, family: `global_${dependencyModule.toLowerCase()}_owner_output`, identity: `${output.owner}:${dependencyModule}`, digest: output.digest, required: true },
        ...(labelDigest === undefined ? [] : [{ authority: "CANONICAL" as const, family: `global_${dependencyModule.toLowerCase()}_presentation_labels`, identity: `presentation-labels:${dependencyModule}`, digest: labelDigest.digest, required: true }]),
      ];
    });
  };
  const metaFor = (resource: GlobalV2QueryResourceName, params: GlobalV2QueryParams, dependencies: readonly GlobalV2ResolvedDependency[]): GlobalReadModelResourceMeta => ({
    contractVersion: globalV2QueryRegistry[resource].contractVersion,
    methodSignature: globalV2QueryMethodSignature(resource),
    policyVersions: globalV2QueryRegistry[resource].policyVersions,
    resourceInputHash: globalV2QueryResourceInputHash({ resource, scope, params, dependencies }),
  });
  const expandedResourceByModule = new Map(globalV2ExpandedResourceCatalog.slice(0, 10).map(({ moduleKey, resource }) => [moduleKey, resource] as const));
  const expandedOverviewKey = (moduleKey: GlobalPrimaryModuleKey): string => globalV2QueryInstanceKey(expandedResourceByModule.get(moduleKey)!, scopeHash, { sectionKey: "OVERVIEW" });
  const technicalTopLevelModules = new Set<GlobalPrimaryModuleKey>(["TRANSFORMATIONS", "RELATIONSHIPS", "MOMENTS"]);
  const moduleInstances: GlobalV2QueryInstanceInput[] = outputs.map((ownerOutput) => {
    const catalog = globalPrimaryModuleCatalog.find(({ moduleKey }) => moduleKey === ownerOutput.moduleKey)!;
    const dependencies = dependenciesFor(ownerOutput.moduleKey);
    const params = {};
    const projection = projections.get(ownerOutput.moduleKey)!;
    const hasPresentationContent = projection.kpis.length > 0 || Object.values(projection.sections).some((section) => (section.metrics?.length ?? 0) + (section.series?.length ?? 0) + (section.rows?.length ?? 0) > 0);
    const rawDecision = humanizePlaceholder(ownerOutput, publicationDecision(ownerOutput, revision, ownerOutput.knowledge === "PARTIAL" && hasPresentationContent ? "MODULE_DETAIL" : "AUTO_GLOBAL"));
    const { placeholder: _technicalPlaceholder, ...decisionWithoutPlaceholder } = rawDecision;
    const decision: GlobalPublicationDecision = technicalTopLevelModules.has(ownerOutput.moduleKey)
      ? { ...decisionWithoutPlaceholder, visibility: "HIDDEN", reasonCode: "NOT_SELECTED_FOR_SURFACE" }
      : rawDecision;
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
  const queryDestinations = (rows: readonly GlobalDetailRow[]): readonly GlobalNavigationDestination[] => [...new Map(rows.flatMap((entry) => {
    const entityRef = entry.entityRef;
    if (entityRef === undefined) return [];
    const targetResource: GlobalV2ExpandedResourceName | undefined = entityRef.startsWith("moment:")
      ? "analysis_global_moment_experience_detail"
      : entityRef.startsWith("household-activity:") || entityRef.startsWith("person-activity:")
        ? "analysis_global_routine_detail"
        : undefined;
    if (targetResource === undefined) return [];
    const params = { entityRef };
    return [[`${targetResource}:${entityRef}`, {
      targetId: `global-query:${entityRef}`, kind: "GLOBAL_QUERY" as const, resource: targetResource,
      instanceKey: globalV2QueryInstanceKey(targetResource, scopeHash, params), entityRef, scopeHash,
      sourcePublicationId: provisionalMeta.publicationId, sourceAnalyticsRevision: provisionalMeta.revision,
    }] as const];
  })).values()];
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
          ...(section.primaryInsight === undefined ? {} : { primaryInsight: section.primaryInsight }),
          secondaryInsights: section.secondaryInsights ?? [],
          metrics: section.metrics ?? [],
          series: section.series ?? [],
          rows: section.rows ?? [],
          destinations: ownerOutput.moduleKey === "RHYTHM" ? queryDestinations(section.destinationRows ?? section.rows ?? []) : [],
          quality: section.quality ?? quality(ownerOutput),
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
      const categoryNeedDetail = ownerOutput.moduleKey === "CATEGORIES_NEEDS" ? categoryNeedDetailProjection(ownerOutput, presentationLabels, detailRow.entityRef!) : undefined;
      const routineDetail = ownerOutput.moduleKey === "RHYTHM" ? routineDetailProjection(ownerOutput, presentationLabels, input.personIds, detailRow.entityRef!) : undefined;
      const momentDetail = ownerOutput.moduleKey === "MOMENTS" ? momentDetailProjection(ownerOutput, detailRow.entityRef!) : undefined;
      const detail = economicDetail ?? categoryNeedDetail ?? routineDetail ?? momentDetail;
      const destinations: readonly GlobalNavigationDestination[] = detailRow.entityRef!.startsWith("category:") ? [
        { targetId: `history:${detailRow.entityRef}`, kind: "HISTORY", resource: "history_category_detail", entityRef: detailRow.entityRef!, scopeHash, sourcePublicationId: provisionalMeta.publicationId, sourceAnalyticsRevision: provisionalMeta.revision },
        { targetId: `operations:${detailRow.entityRef}`, kind: "OPERATIONS", resource: "operations_browse", entityRef: detailRow.entityRef!, scopeHash, sourcePublicationId: provisionalMeta.publicationId, sourceAnalyticsRevision: provisionalMeta.revision },
      ] : ownerOutput.moduleKey === "RHYTHM" ? queryDestinations(detail?.rows ?? []) : [];
      expandedInstances.push({
        resource: detailResource,
        scope,
        params,
        dependencies,
        payload: buildGlobalExpandedReadModel({
          kind: "global_expanded", schemaVersion: "global-expanded@v1", resource: detailResource, moduleKey: ownerOutput.moduleKey, sectionKey: "OVERVIEW", visibility: "VISIBLE", secondaryInsights: [], metrics: detail?.metrics ?? [], series: detail?.series ?? [],
          rows: detail?.rows ?? [{ ...detailRow, rowId: `detail:${detailRow.rowId}` }], destinations, quality: categoryNeedDetail?.quality ?? quality(ownerOutput), capabilities: [capability(ownerOutput)], publicationMeta: provisionalMeta, resourceMeta: metaFor(detailResource, params, dependencies),
        }),
      });
    }
    const methodologyParams = { moduleKey: ownerOutput.moduleKey, methodRef: globalV2MethodRef(ownerOutput.moduleKey) };
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
  const allOutputDependencies = [...new Map(outputs.flatMap(({ moduleKey }) => dependenciesFor(moduleKey)).map((dependency) => [`${dependency.authority}:${dependency.family}:${dependency.identity}`, dependency] as const)).values()];
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
