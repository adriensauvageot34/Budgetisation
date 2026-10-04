import { categoryDecisionCapabilities, isDecisionCategoryKey, type CategoryDecisionCapabilities } from "./month-choice-contract";

/** Compatibility keys for old v1 JSON; new decisions use published capabilities. */
export const FORECAST_CATEGORY_KEYS = ["groceries", "tobacco-vape", "manon-work-mobility", "adrien-work-meals",
  "manon-work-meals", "adrien-work-coffee", "household-restaurants"] as const;
export type ForecastCategoryKey = typeof FORECAST_CATEGORY_KEYS[number];
export type MonthForecastAssumption = Readonly<{ mode: "LOWER" | "HIGHER" | "CUSTOM"; amount?: string }>;
export type MonthDecisionSettings = Readonly<{ version: "month-decision@v2";
  assumptions: Readonly<Record<string, MonthForecastAssumption>>; goal: string | null; categoryTargets: Readonly<Record<string, string>> }>;
export const defaultMonthDecisionSettings = (): MonthDecisionSettings => ({ version: "month-decision@v2", assumptions: {}, goal: null, categoryTargets: {} });
export const decisionAmount = (v: unknown): string => {
  if (typeof v !== "string" || !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/u.test(v)) throw new TypeError("MONTH_DECISION_AMOUNT_INVALID");
  return v;
};
export function parseMonthDecisionSettings(raw: unknown): MonthDecisionSettings {
  if (raw === undefined) return defaultMonthDecisionSettings();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError("MONTH_DECISION_INVALID");
  const value=raw as Record<string,unknown>;
  if (!["month-decision@v1", "month-decision@v2"].includes(String(value.version)) || Object.keys(value).some(k=>!["version","assumptions","goal","categoryTargets"].includes(k))
    || !value.assumptions || typeof value.assumptions !== "object" || Array.isArray(value.assumptions)) throw new TypeError("MONTH_DECISION_INVALID");
  const assumptions: Record<string,MonthForecastAssumption>={};
  if (Object.keys(value.assumptions).length > 30) throw new TypeError("MONTH_ASSUMPTION_INVALID");
  for (const [key,item] of Object.entries(value.assumptions)) {
    if (!isDecisionCategoryKey(key) || value.version === "month-decision@v1" && !FORECAST_CATEGORY_KEYS.includes(key as ForecastCategoryKey)
      || categoryDecisionCapabilities(key)?.adjustability === "FIXED"
      || !item || typeof item !== "object" || Array.isArray(item)) throw new TypeError("MONTH_ASSUMPTION_INVALID");
    const a=item as Record<string,unknown>;
    if (!["LOWER","HIGHER","CUSTOM"].includes(String(a.mode)) || Object.keys(a).some(k=>!["mode","amount"].includes(k))
      || (a.mode !== "CUSTOM" && a.amount !== undefined)) throw new TypeError("MONTH_ASSUMPTION_INVALID");
    assumptions[key]=a.mode === "CUSTOM" ? {mode:"CUSTOM",amount:decisionAmount(a.amount)}
      : {mode:a.mode as "LOWER"|"HIGHER"};
  }
  const rawTargets = value.categoryTargets === undefined ? {} : value.categoryTargets;
  if (!rawTargets || typeof rawTargets !== "object" || Array.isArray(rawTargets)) throw new TypeError("MONTH_CATEGORY_TARGET_INVALID");
  const targets = Object.entries(rawTargets);
  if (targets.length > 30 || targets.some(([key]) => !isDecisionCategoryKey(key))) throw new TypeError("MONTH_CATEGORY_TARGET_INVALID");
  return { version: "month-decision@v2", assumptions, categoryTargets: Object.fromEntries(targets.map(([key, amount]) => [key, decisionAmount(amount)])),
    goal: value.goal === null ? null : decisionAmount(value.goal) };
}

/** Server resolution authorizes references after structural JSON parsing. */
export function assertMonthDecisionReferences(settings: MonthDecisionSettings,
  published: readonly { key: string; decisionCapabilities?: CategoryDecisionCapabilities }[]): void {
  for (const key of Object.keys(settings.categoryTargets)) {
    const capabilities = categoryDecisionCapabilities(key, published.find(row => row.key === key)?.decisionCapabilities);
    if (!capabilities?.targetAllowed) throw new TypeError(`MONTH_CATEGORY_TARGET_UNKNOWN:${key}`);
  }
  for (const key of Object.keys(settings.assumptions)) {
    const capabilities = categoryDecisionCapabilities(key, published.find(row => row.key === key)?.decisionCapabilities);
    if (!capabilities || capabilities.adjustability !== "ADJUSTABLE" || capabilities.strategies.length === 0)
      throw new TypeError(`MONTH_ASSUMPTION_INVALID:${key}`);
  }
}
