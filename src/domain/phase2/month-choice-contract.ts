/** Capabilities describe permitted decisions, not a second category taxonomy. */
export const CATEGORY_CHOICE_STRATEGIES = ["REDUCE_PERCENT", "REDUCE_AMOUNT", "REDUCE_ONE_OCCURRENCE"] as const;
export type CategoryChoiceStrategy = typeof CATEGORY_CHOICE_STRATEGIES[number];
export type CategoryDecisionCapabilities = Readonly<{
  label: string; role: "BEHAVIORAL" | "CONSTRAINED"; targetAllowed: boolean;
  adjustability: "ADJUSTABLE" | "FIXED"; strategies: readonly CategoryChoiceStrategy[];
}>;
const behavioral = (label: string, occurrence = false): CategoryDecisionCapabilities => ({ label, role: "BEHAVIORAL",
  targetAllowed: true, adjustability: "ADJUSTABLE", strategies: [...(occurrence ? ["REDUCE_ONE_OCCURRENCE" as const] : []), "REDUCE_PERCENT", "REDUCE_AMOUNT"] });
export const MONTH_CATEGORY_CAPABILITIES: Readonly<Record<string, CategoryDecisionCapabilities>> = {
  groceries: behavioral("Courses"), "tobacco-vape": behavioral("Tabac & vape"),
  "household-restaurants": behavioral("Restaurants du foyer", true),
  "adrien-work-meals": behavioral("Repas travail · Adrien"), "manon-work-meals": behavioral("Repas travail · Manon"),
  "adrien-work-coffee": behavioral("Café travail · Adrien"),
  "manon-work-mobility": { label: "Trajets travail · Manon", role: "CONSTRAINED", targetAllowed: true, adjustability: "FIXED", strategies: [] },
};
export const isDecisionCategoryKey = (key: string) => key.length <= 80 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(key)
  && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(key);
export function categoryDecisionCapabilities(key: string, published?: CategoryDecisionCapabilities): CategoryDecisionCapabilities | null {
  if (MONTH_CATEGORY_CAPABILITIES[key]?.role === "CONSTRAINED") return MONTH_CATEGORY_CAPABILITIES[key]!;
  const value = published ?? MONTH_CATEGORY_CAPABILITIES[key];
  if (!value) return null;
  if (typeof value.label !== "string" || !value.label.trim() || value.label.length > 120 || !["BEHAVIORAL", "CONSTRAINED"].includes(value.role)
    || typeof value.targetAllowed !== "boolean" || !["ADJUSTABLE", "FIXED"].includes(value.adjustability)
    || !Array.isArray(value.strategies) || value.strategies.some(strategy => !CATEGORY_CHOICE_STRATEGIES.includes(strategy))
    || new Set(value.strategies).size !== value.strategies.length
    || (value.adjustability === "FIXED" || value.role === "CONSTRAINED") && value.strategies.length > 0)
    throw new TypeError("MONTH_CATEGORY_CAPABILITIES_INVALID");
  return value;
}
export type MonthChoiceOperation = Readonly<{ kind: "CATEGORY"; categoryKey: string } & (
  { strategy: "REDUCE_PERCENT"; percent: string } | { strategy: "REDUCE_AMOUNT"; amount: string } | { strategy: "REDUCE_ONE_OCCURRENCE" }
)> | Readonly<{ kind: "SAVINGS"; savingsId: string; strategy: "ADJUST_SAVINGS"; amount: string }>;
export type MonthChoice = Readonly<{ operations: readonly MonthChoiceOperation[] }>;
const record = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError("MONTH_CHOICE_INVALID");
  return raw as Record<string, unknown>;
};
export const choiceAmount = (value: unknown): string => {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/u.test(value)) throw new TypeError("MONTH_CHOICE_AMOUNT_INVALID");
  return value;
};
export function parseMonthChoice(raw: unknown): MonthChoice {
  const input = record(raw);
  if (Object.keys(input).some(key => key !== "operations") || !Array.isArray(input.operations) || input.operations.length < 1 || input.operations.length > 2)
    throw new TypeError("MONTH_CHOICE_INVALID");
  const operations: MonthChoiceOperation[] = input.operations.map(raw => {
    const row = record(raw), strategy = row.strategy;
    if (row.kind === "CATEGORY") {
      if (typeof row.categoryKey !== "string" || !isDecisionCategoryKey(row.categoryKey)) throw new TypeError("MONTH_CHOICE_CATEGORY_INVALID");
      const keys = ["kind", "categoryKey", "strategy", ...(strategy === "REDUCE_PERCENT" ? ["percent"] : strategy === "REDUCE_AMOUNT" ? ["amount"] : [])];
      if (!CATEGORY_CHOICE_STRATEGIES.includes(strategy as CategoryChoiceStrategy) || Object.keys(row).some(key => !keys.includes(key))) throw new TypeError("MONTH_CHOICE_INVALID");
      const base = { kind: "CATEGORY" as const, categoryKey: row.categoryKey };
      if (strategy === "REDUCE_PERCENT") {
        const percent = choiceAmount(row.percent);
        if (Number(percent) <= 0 || Number(percent) > 100) throw new TypeError("MONTH_CHOICE_PERCENT_INVALID");
        return { ...base, strategy, percent };
      }
      if (strategy === "REDUCE_AMOUNT") return { ...base, strategy, amount: choiceAmount(row.amount) };
      return { ...base, strategy: "REDUCE_ONE_OCCURRENCE" as const };
    }
    if (row.kind !== "SAVINGS" || strategy !== "ADJUST_SAVINGS" || typeof row.savingsId !== "string"
      || !/^[0-9a-f-]{36}$/iu.test(row.savingsId) || Object.keys(row).some(key => !["kind", "strategy", "savingsId", "amount"].includes(key))) throw new TypeError("MONTH_CHOICE_INVALID");
    return { kind: "SAVINGS" as const, savingsId: row.savingsId, strategy, amount: choiceAmount(row.amount) };
  });
  if (new Set(operations.map(row => row.kind === "CATEGORY" ? `category:${row.categoryKey}` : `savings:${row.savingsId}`)).size !== operations.length)
    throw new TypeError("MONTH_CHOICE_DUPLICATE_TARGET");
  return { operations };
}
