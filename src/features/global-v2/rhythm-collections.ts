import type { GlobalDetailRow } from "@/query-api/global-v2";

type TypedValue = { readonly value: string };

export type HabitCoverageModel = {
  readonly knownCount: number;
  readonly totalCount: number;
  readonly ratio: number;
  readonly percentage: number;
  readonly barWidth: number;
  readonly accessibleLabel: string;
};

function finiteValue(measure: TypedValue | undefined): number | undefined {
  if (measure === undefined) return undefined;
  const value = Number(measure.value);
  return Number.isFinite(value) ? value : undefined;
}

export function buildHabitCoverageModel(input: {
  readonly activityLabel: string;
  readonly knownCausalCostCount?: TypedValue;
  readonly totalOccurrenceCount?: TypedValue;
  readonly coverageRatio?: TypedValue;
}): HabitCoverageModel | undefined {
  const knownCount = finiteValue(input.knownCausalCostCount);
  const totalCount = finiteValue(input.totalOccurrenceCount);
  const ratio = finiteValue(input.coverageRatio);
  if (knownCount === undefined || totalCount === undefined || ratio === undefined) return undefined;
  if (knownCount < 0 || totalCount < 0 || knownCount > totalCount || ratio < 0 || ratio > 1) return undefined;
  const percentage = Math.round(ratio * 100);
  const subject = input.activityLabel.trim().toLocaleLowerCase("fr-FR");
  return {
    knownCount,
    totalCount,
    ratio,
    percentage,
    barWidth: ratio * 100,
    accessibleLabel: `Coût connu pour ${knownCount.toLocaleString("fr-FR")} ${subject} sur ${totalCount.toLocaleString("fr-FR")}, soit ${percentage.toLocaleString("fr-FR")} %.`,
  };
}

export type RhythmMomentYearGroup = {
  readonly key: string;
  readonly label: string;
  readonly rows: readonly GlobalDetailRow[];
};

function momentYear(row: GlobalDetailRow): number | undefined {
  const match = row.displayValue?.match(/\b(\d{4})-\d{2}-\d{2}\b/u);
  if (match === null || match === undefined) return undefined;
  const year = Number(match[1]);
  return Number.isInteger(year) ? year : undefined;
}

export function groupRhythmMomentsByYear(rows: readonly GlobalDetailRow[]): readonly RhythmMomentYearGroup[] {
  const groups = new Map<string, { readonly label: string; rows: GlobalDetailRow[] }>();
  for (const row of rows) {
    const year = momentYear(row);
    const key = year === undefined ? "UNKNOWN" : String(year);
    const existing = groups.get(key);
    if (existing !== undefined) {
      existing.rows.push(row);
      continue;
    }
    groups.set(key, { label: year === undefined ? "Date non disponible" : String(year), rows: [row] });
  }
  return [...groups].map(([key, group]) => ({ key, label: group.label, rows: group.rows }));
}
