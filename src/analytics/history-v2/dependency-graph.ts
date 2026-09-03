import { computeResourceInputHash, type FactsHashFact, type FactsHashValue, type HashDependency } from "./facts-hash";

const calendar = ["calendar_artifacts", "daily_ledgers", "persons", "expenses"] as const;
const categories = ["daily_ledgers", "economic_components", "category_typical", "reference_labels"] as const;
const places = ["daily_ledgers", "economic_components", "activity_occurrences", "primary_places", "place_visits", "place_authorities", "reference_labels"] as const;
const life = ["calendar_artifacts", "activity_occurrences", "activity_costs", "moment_relations", ...places] as const;

/** Production inputs, not a list of desired/future data sources. */
export const historyV2ResourceDependencyGroups = {
  history_month_calendar: calendar,
  history_week: calendar,
  history_day_journal: [...calendar, "operations", "moment_relations", "journal_supplement"],
  history_month_overview: ["calendar_artifacts", "operations", "moment_relations", "overview_supplement", ...places],
  history_month_balance_summary: ["daily_ledgers", "typical", "minimal", "actual_history"],
  history_bank_economy_bridge: ["daily_ledgers", "economic_components", "operations"],
  history_month_categories: categories,
  history_category_detail: [...categories, "category_history", "classifications"],
  history_month_spending_nature: ["daily_ledgers", "economic_components", "classifications", "reference_labels"],
  history_spending_segment_detail: ["economic_components", "classifications", "reference_labels"],
  history_minimal_preview: ["minimal"],
  history_month_life_money: life,
  history_activity_detail: [...calendar, "local_expenses", "activity_occurrences", "activity_costs", "activity_links"],
  history_moment_detail: [...calendar, "local_expenses", "moment_relations"],
  history_place_detail: places,
} as const;

export type HistoryDependencyResource = keyof typeof historyV2ResourceDependencyGroups;
export type HistoryDependencyGroup = typeof historyV2ResourceDependencyGroups[HistoryDependencyResource][number];
export type HistoryDependencyInput = {
  /** Stable source scope, including historical month / selection where applicable. */
  readonly identity: string;
  readonly value: FactsHashValue;
};

/** Canonical JSON object order; array order is preserved unless a caller declares a set. */
export function historyDependencyValue(value: unknown): FactsHashValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return Object.is(value, -0) ? 0 : value;
  if (Array.isArray(value)) return value.map(historyDependencyValue);
  if (typeof value !== "object" || value === null || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new TypeError("History dependency must be strict JSON, without undefined/Map/Date.");
  }
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, historyDependencyValue((value as Record<string, unknown>)[key])]));
}

export function historyDependencySet(values: readonly unknown[]): FactsHashValue {
  const entries = values.map(historyDependencyValue);
  return [...new Map(entries.map((entry) => [JSON.stringify(entry), entry])).entries()]
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, entry]) => entry);
}

export function historyResourceDependencyClosure(input: {
  readonly resource: HistoryDependencyResource;
  readonly groups: Readonly<Partial<Record<HistoryDependencyGroup, HistoryDependencyInput>>>;
}): { readonly facts: readonly FactsHashFact[]; readonly dependencies: readonly HashDependency[] } {
  const names = historyV2ResourceDependencyGroups[input.resource];
  if (names === undefined) throw new TypeError("Unregistered History dependency resource.");
  return {
    facts: [...new Set<HistoryDependencyGroup>(names)].sort().map((name) => {
      const group = input.groups[name];
      if (group === undefined || !group.identity.trim()) throw new TypeError(`Missing History dependency: ${input.resource}/${name}`);
      return { factType: `history_input:${name}`, identity: group.identity, value: historyDependencyValue(group.value) };
    }),
    dependencies: [],
  };
}

/** Only top-level transport metadata is excluded; ordered business payload stays ordered. */
export function historyReadModelContent(data: unknown): FactsHashValue {
  if (data === null || typeof data !== "object" || Array.isArray(data)) throw new TypeError("History ReadModel must be an object.");
  const { resourceInputHash: _hash, publicationMeta: _publication, policyVersions: _policies, ...content } = data as Record<string, unknown>;
  return historyDependencyValue(content);
}

export function historyContentDigest(identity: string, value: FactsHashValue): string {
  return computeResourceInputHash({ identity, facts: [{ factType: "history_dependency_content", identity, value }] });
}
