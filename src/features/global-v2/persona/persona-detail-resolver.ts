import type {
  GlobalDetailMetric,
  GlobalDetailRow,
  GlobalDetailSeries,
  GlobalExpandedReadModel,
  PersonaOwnerDetailRef,
} from "@/query-api/global-v2";
import type { GlobalV2UiRequest } from "../visit-runtime";

export type PersonaOwnerDetailPresentation = {
  readonly metrics: readonly GlobalDetailMetric[];
  readonly rows: readonly GlobalDetailRow[];
  readonly series: readonly GlobalDetailSeries[];
  readonly empty: boolean;
};

const hiddenLabelPattern = /(?:evidence|preuve|owner|propriétaire|source module|authority|autorité|entityref|couverture|support|confidence|confiance|selection reason|artifact|snapshot|metric id|method version|méthode|methode)/iu;
const missingDisplayValues = new Set(["", "—", "N/A", "UNKNOWN", "NOT_APPLICABLE", "CONFLICT"]);

function hasUsefulDisplayValue(value: string | undefined): value is string {
  return value !== undefined && !missingDisplayValues.has(value.trim().toLocaleUpperCase("fr-FR"));
}

function hasEditorialLabel(label: string): boolean {
  return !hiddenLabelPattern.test(label);
}

/** Initial Persona requests contain indexes only; owner details are deliberately absent. */
export function personaDetailIndexRequest(personId: string): GlobalV2UiRequest {
  return { resource: "analysis_global_persona_detail", params: { entityRef: `person:${personId}` } };
}

/** A published ref is already the complete routing authority. No trait or person branch is involved. */
export function personaOwnerDetailRequest(detailRef: PersonaOwnerDetailRef): GlobalV2UiRequest {
  return { resource: detailRef.resource, params: { entityRef: detailRef.entityRef } };
}

export function preferredPersonaDetailRef(detailRefs: readonly PersonaOwnerDetailRef[]): PersonaOwnerDetailRef | undefined {
  for (const role of ["PRIMARY", "CONTEXT", "HISTORY"] as const) {
    const detailRef = detailRefs.find((candidate) => candidate.role === role);
    if (detailRef !== undefined) return detailRef;
  }
  return undefined;
}

/** Keeps owner values verbatim and only removes technical or missing presentation fields. */
export function presentPersonaOwnerDetail(model: GlobalExpandedReadModel): PersonaOwnerDetailPresentation {
  const metrics = model.metrics.filter((metric) => hasEditorialLabel(metric.labelKey) && hasUsefulDisplayValue(metric.displayValue));
  const rows = model.rows.filter((row) => hasEditorialLabel(row.labelKey) && hasUsefulDisplayValue(row.displayValue));
  const series = model.series.flatMap((entry) => {
    if (!hasEditorialLabel(entry.labelKey)) return [];
    const points = entry.points.filter((point) => hasUsefulDisplayValue(point.displayValue));
    return points.length === 0 ? [] : [{ ...entry, points }];
  });
  return { metrics, rows, series, empty: metrics.length === 0 && rows.length === 0 && series.length === 0 };
}

export function personaDetailMetricLabel(metric: Pick<GlobalDetailMetric, "metricId" | "labelKey">): string {
  if (metric.metricId === "estimated-fuel-cost") return "Coût estimé du carburant utilisé";
  if (metric.metricId === "estimated-fuel-liters") return "Carburant utilisé (estimation)";
  if (metric.metricId === "distinct-day-count") return "Journées concernées";
  if (metric.metricId === "leg-count") return "Trajets observés";
  return metric.labelKey;
}
