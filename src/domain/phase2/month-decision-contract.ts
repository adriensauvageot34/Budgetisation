/** Explicit month preferences. These are neither observed facts nor learned habits. */
export const FORECAST_CATEGORY_KEYS = ["groceries", "tobacco-vape", "manon-work-mobility", "adrien-work-meals",
  "manon-work-meals", "adrien-work-coffee", "household-restaurants"] as const;
export type ForecastCategoryKey = typeof FORECAST_CATEGORY_KEYS[number];
export type MonthForecastAssumption = Readonly<{ mode: "LOWER" | "HIGHER" | "CUSTOM"; amount?: string }>;
export type MonthDecisionSettings = Readonly<{ version: "month-decision@v1";
  assumptions: Readonly<Partial<Record<ForecastCategoryKey, MonthForecastAssumption>>>; goal: string | null }>;
export const defaultMonthDecisionSettings = (): MonthDecisionSettings => ({version:"month-decision@v1",assumptions:{},goal:null});
const monetary = (v: unknown): string => {
  if (typeof v !== "string" || !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/u.test(v)) throw new TypeError("MONTH_DECISION_AMOUNT_INVALID");
  return v;
};
export function parseMonthDecisionSettings(raw: unknown): MonthDecisionSettings {
  if (raw === undefined) return defaultMonthDecisionSettings();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError("MONTH_DECISION_INVALID");
  const value=raw as Record<string,unknown>;
  if (value.version !== "month-decision@v1" || Object.keys(value).some(k=>!["version","assumptions","goal"].includes(k))
    || !value.assumptions || typeof value.assumptions !== "object" || Array.isArray(value.assumptions)) throw new TypeError("MONTH_DECISION_INVALID");
  const assumptions: Partial<Record<ForecastCategoryKey,MonthForecastAssumption>>={};
  for (const [key,item] of Object.entries(value.assumptions)) {
    if (!FORECAST_CATEGORY_KEYS.includes(key as ForecastCategoryKey) || key === "manon-work-mobility"
      || !item || typeof item !== "object" || Array.isArray(item)) throw new TypeError("MONTH_ASSUMPTION_INVALID");
    const a=item as Record<string,unknown>;
    if (!["LOWER","HIGHER","CUSTOM"].includes(String(a.mode)) || Object.keys(a).some(k=>!["mode","amount"].includes(k))
      || (a.mode !== "CUSTOM" && a.amount !== undefined)) throw new TypeError("MONTH_ASSUMPTION_INVALID");
    assumptions[key as ForecastCategoryKey]=a.mode === "CUSTOM" ? {mode:"CUSTOM",amount:monetary(a.amount)}
      : {mode:a.mode as "LOWER"|"HIGHER"};
  }
  return {version:"month-decision@v1",assumptions,goal:value.goal === null ? null : monetary(value.goal)};
}
