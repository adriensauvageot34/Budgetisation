import type { RealizedBoardOverview, RealizedCardSummary } from "./realized-overview";

// Positional rows keep repeated field names and absent optional values out of
// the server-rendered payload. The rest of the UI works with named properties.
const fields = [
  "id", "section", "label", "amount", "art", "search", "sortDate", "date", "caption", "dialogCaption",
  "sourceId", "categoryId", "pilotStatus", "pilotSourceId", "participant", "paymentIds", "badges",
  "places", "relatedCount", "hasTransfers", "endDate", "eventStatus", "mobilityNote", "work", "trip", "travel",
] as const satisfies readonly (keyof RealizedCardSummary)[];
type Field = typeof fields[number];
type EncodedRow = readonly (RealizedCardSummary[Field] | null)[];

export type PackedRealizedOverview = Omit<RealizedBoardOverview, "cards" | "flatKeys" | "categoryKeys"> & {
  rows: readonly EncodedRow[];
  flatCount: number;
  categoryIndices: readonly number[];
};

export function packRealizedOverview({ cards, flatKeys, categoryKeys, ...overview }: RealizedBoardOverview): PackedRealizedOverview {
  const rows: EncodedRow[] = [];
  const rowByKey = new Map<string, number>();
  for (const key of [...flatKeys, ...categoryKeys]) {
    if (rowByKey.has(key)) continue;
    const source = cards[key]!;
    const row = fields.map(field => {
      const value = source[field];
      if (field === "amount") return source.amount;
      if (field === "sourceId" && value === source.id) return null;
      if (Array.isArray(value) && !value.length) return null;
      if (value === undefined || value === false || value === 0 || value === "") return null;
      return value;
    });
    while (row.at(-1) === null) row.pop();
    rowByKey.set(key, rows.length);
    rows.push(row);
  }
  return {
    ...overview, rows, flatCount: flatKeys.length,
    categoryIndices: categoryKeys.map(key => rowByKey.get(key)!),
  };
}

export function unpackRealizedOverview({ rows, flatCount, categoryIndices, ...overview }: PackedRealizedOverview): RealizedBoardOverview {
  const cards: Record<string, RealizedCardSummary> = {};
  const keys = rows.map((row, index) => {
    const properties = Object.fromEntries(row.flatMap((value, column) =>
      value !== null ? [[fields[column]!, value] as const] : []));
    const card = {
      ...properties,
      amount: properties.amount ?? null,
      dialogCaption: properties.dialogCaption ?? "",
      sourceId: properties.sourceId ?? properties.id,
      search: properties.search ?? [],
      paymentIds: properties.paymentIds ?? [],
      badges: properties.badges ?? [],
      relatedCount: properties.relatedCount ?? 0,
      hasTransfers: properties.hasTransfers ?? false,
    } as RealizedCardSummary;
    const key = `${index < flatCount ? "flat" : "category"}:${card.id}`;
    cards[key] = card;
    return key;
  });
  return { ...overview, cards, flatKeys: keys.slice(0, flatCount), categoryKeys: categoryIndices.map(index => keys[index]!) };
}
