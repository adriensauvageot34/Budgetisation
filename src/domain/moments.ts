import type { AnalyticalEntry } from "@/domain/analytical-entries";
import type { Moment } from "@/domain/budget";

export function aggregateMoments(entries: AnalyticalEntry[], moments: Moment[]) {
  const byId = new Map(moments.map((moment) => [moment.id, moment]));
  const groups = new Map<string, AnalyticalEntry[]>();
  for (const entry of entries) {
    if (!entry.momentId) continue;
    groups.set(entry.momentId, [...(groups.get(entry.momentId) ?? []), entry]);
  }
  return [...groups.entries()].map(([momentId, rows]) => {
    const moment = byId.get(momentId);
    const composition = [...new Set(rows.map((entry) => entry.category))].map((category) => ({
      category,
      amount: rows.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.amount, 0),
    })).sort((a, b) => b.amount - a.amount);
    return {
      id: momentId,
      name: moment?.name ?? rows[0]?.momentName ?? "Moment",
      type: moment?.type ?? rows[0]?.momentType ?? "Autre",
      startDate: rows.map((entry) => entry.date).sort()[0] ?? moment?.startDate ?? null,
      endDate: rows.map((entry) => entry.date).sort().at(-1) ?? moment?.endDate ?? null,
      amount: rows.reduce((sum, entry) => sum + entry.amount, 0),
      operationCount: new Set(rows.map((entry) => entry.sourceOperationId)).size,
      composition,
      statuses: [...new Set(rows.map((entry) => entry.status))],
    };
  }).sort((a, b) => b.amount - a.amount);
}
