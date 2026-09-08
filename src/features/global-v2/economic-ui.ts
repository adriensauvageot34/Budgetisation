import { parseMoney, type Money } from "@/core/money";
import type { MetricEnvelope } from "@/core/metrics";
import type {
  GlobalDetailMetric,
  GlobalDetailRow,
  GlobalDetailSeries,
  GlobalDetailSeriesPoint,
  GlobalPhenomenonQuality,
  GlobalTypedMeasure,
} from "@/query-api/global-v2";
import type { MonetaryEvolutionPoint } from "@/ui";

type EconomicValue = {
  readonly displayValue?: string;
  readonly typedMeasure?: GlobalTypedMeasure;
  readonly knowledgeState?: "KNOWN" | "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT";
  readonly phenomenonQuality?: GlobalPhenomenonQuality;
};

export type EconomicStructureGroup = {
  readonly axis: "Nécessité" | "Fixe / variable" | "Périmètre de vie";
  readonly rows: readonly GlobalDetailRow[];
};

const unknownMoney: MetricEnvelope<Money, "EUR/month"> = Object.freeze({
  availability: "unknown",
  value: null,
  unit: "EUR/month",
  provenance: "derived",
});

function knowledgeStateOf(value: EconomicValue): EconomicValue["knowledgeState"] {
  return value.phenomenonQuality?.knowledgeState ?? value.knowledgeState;
}

export function economicValueText(value: EconomicValue, unknownText = "Information insuffisante"): string {
  const state = knowledgeStateOf(value);
  if (state === "CONFLICT") return "Classification à confirmer";
  if (state === "NOT_APPLICABLE") return "Non applicable";
  if (state === "UNKNOWN" || value.displayValue === undefined) return unknownText;
  return value.displayValue;
}

export function economicMetric(model: { readonly metrics: readonly GlobalDetailMetric[] }, metricId: string): GlobalDetailMetric | undefined {
  return model.metrics.find((metric) => metric.metricId === metricId);
}

function moneyEnvelope(point: GlobalDetailSeriesPoint | undefined): MetricEnvelope<Money, "EUR/month"> {
  if (point === undefined) return unknownMoney;
  const state = knowledgeStateOf(point);
  if (state === "CONFLICT") return { availability: "conflict", value: null, unit: "EUR/month", provenance: "derived" };
  if (state === "NOT_APPLICABLE") return { availability: "not_applicable", value: null, unit: "EUR/month", provenance: "derived" };
  const measure = point.typedMeasure;
  if ((state !== "KNOWN" && state !== "PARTIAL") || measure?.kind !== "MONEY" || measure.unit !== "EUR/month") return unknownMoney;
  return { availability: "known", value: parseMoney(measure.value), unit: "EUR/month", provenance: "derived" };
}

export function economicEvolutionPoints(series: readonly GlobalDetailSeries[]): readonly MonetaryEvolutionPoint<"EUR/month">[] {
  const actual = series.find(({ seriesId }) => seriesId === "economic:actual");
  const typical = series.find(({ seriesId }) => seriesId === "economic:typical-state");
  const minimal = series.find(({ seriesId }) => seriesId === "economic:minimal-state");
  if (actual === undefined) return [];
  const typicalByMonth = new Map(typical?.points.map((point) => [point.unitKey, point]));
  const minimalByMonth = new Map(minimal?.points.map((point) => [point.unitKey, point]));
  return actual.points.map((point) => ({
    period: point.unitKey,
    label: point.unitKey,
    actual: moneyEnvelope(point),
    typical: moneyEnvelope(typicalByMonth.get(point.unitKey)),
    minimal: moneyEnvelope(minimalByMonth.get(point.unitKey)),
  }));
}

function axisFor(row: GlobalDetailRow): EconomicStructureGroup["axis"] | undefined {
  if (row.labelKey.startsWith("Nécessité ·")) return "Nécessité";
  if (row.labelKey.startsWith("Comportement ·")) return "Fixe / variable";
  if (row.labelKey.startsWith("Périmètre de vie ·")) return "Périmètre de vie";
  return undefined;
}

export function economicStructureGroups(rows: readonly GlobalDetailRow[]): readonly EconomicStructureGroup[] {
  const axes = ["Nécessité", "Fixe / variable", "Périmètre de vie"] as const;
  return axes.map((axis) => ({ axis, rows: rows.filter((row) => axisFor(row) === axis) }));
}

export function economicStructureLabel(row: GlobalDetailRow): string {
  const raw = row.labelKey.split(" · ").slice(1).join(" · ");
  if (raw === "Non classé") return "À classer";
  if (raw === "Classification en conflit") return "Classification à confirmer";
  return raw || "Information disponible";
}
