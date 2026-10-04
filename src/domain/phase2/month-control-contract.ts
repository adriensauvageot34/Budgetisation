import { isDecisionCategoryKey, parseMonthChoice, type MonthChoiceOperation, type CategoryDecisionCapabilities } from "./month-choice-contract";

export const MONTH_CONTROL_SECTIONS = ["overview", "choices", "settings", "resources", "reliability"] as const;
export type MonthControlSection = typeof MONTH_CONTROL_SECTIONS[number];
export const monthControlSection = (value: unknown): MonthControlSection | null =>
  typeof value === "string" && MONTH_CONTROL_SECTIONS.includes(value as MonthControlSection) ? value as MonthControlSection : null;
export type MonthControlPurpose = Readonly<{ kind: "NONE" | "GLOBAL_GOAL" | "FREE_EXPLORATION" }>
  | Readonly<{ kind: "CATEGORY_CORRECTION" | "CATEGORY_OVERAGE_OFFSET"; categoryKey: string }>;
export function parseMonthControlPurpose(raw: unknown): MonthControlPurpose {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError("MONTH_CONTROL_PURPOSE_INVALID");
  const row = raw as Record<string, unknown>;
  if (row.kind === "CATEGORY_CORRECTION" || row.kind === "CATEGORY_OVERAGE_OFFSET") {
    if (typeof row.categoryKey !== "string" || !isDecisionCategoryKey(row.categoryKey) || Object.keys(row).some(key => !["kind", "categoryKey"].includes(key)))
      throw new TypeError("MONTH_CONTROL_PURPOSE_INVALID");
    return { kind: row.kind, categoryKey: row.categoryKey };
  }
  if (!["NONE", "GLOBAL_GOAL", "FREE_EXPLORATION"].includes(String(row.kind)) || Object.keys(row).some(key => key !== "kind"))
    throw new TypeError("MONTH_CONTROL_PURPOSE_INVALID");
  return { kind: row.kind as "NONE" | "GLOBAL_GOAL" | "FREE_EXPLORATION" };
}
export const monthChoiceTarget = (op: MonthChoiceOperation) => op.kind === "CATEGORY" ? `category:${op.categoryKey}` : `savings:${op.savingsId}`;
export function parseMonthControlDraft(raw: unknown): readonly MonthChoiceOperation[] {
  if (!Array.isArray(raw)) throw new TypeError("MONTH_CONTROL_DRAFT_INVALID");
  return raw.length === 0 ? [] : parseMonthChoice({ operations: raw }).operations;
}
/** Local intention composition, with no financial calculation. */
export function replaceMonthControlOperation(current: readonly MonthChoiceOperation[], raw: unknown): readonly MonthChoiceOperation[] {
  const op = parseMonthChoice({ operations: [raw] }).operations[0]!;
  const others = parseMonthControlDraft(current).filter(row => monthChoiceTarget(row) !== monthChoiceTarget(op));
  if (others.length >= 2) throw new TypeError("MONTH_CONTROL_DRAFT_FULL");
  return [...others, op];
}
export function monthControlUrl(current: string, section: MonthControlSection | null, focus?: string | null): string {
  const url = new URL(current, "http://month.local");
  if (section) url.searchParams.set("control", section); else url.searchParams.delete("control");
  if (section && focus && /^[a-zA-Z0-9:-]{1,100}$/u.test(focus)) url.searchParams.set("focus", focus); else url.searchParams.delete("focus");
  url.searchParams.delete("inputError");
  return `${url.pathname}${url.search}${url.hash}`;
}

/** UX constructors only. Eligibility and every consequence stay with the shared choice engine. */
export function monthControlCategoryPresets(key: string, label: string, capabilities: CategoryDecisionCapabilities) {
  if (capabilities.adjustability !== "ADJUSTABLE") return [];
  const category = { kind: "CATEGORY" as const, categoryKey: key };
  const percent = (value: string, title: string) => ({ label: title, operation: { ...category, strategy: "REDUCE_PERCENT" as const, percent: value } });
  const amount = (value: string) => ({ label: `Courses −${value} €`, operation: { ...category, strategy: "REDUCE_AMOUNT" as const, amount: value } });
  const presets = key === "household-restaurants" ? [
    { label: "Plus aucun restaurant pour le reste du mois", operation: { ...category, strategy: "REDUCE_PERCENT" as const, percent: "100" } },
    { label: "Une sortie en moins", operation: { ...category, strategy: "REDUCE_ONE_OCCURRENCE" as const } },
    percent("50", "Moitié moins pour le reste du mois"),
  ] : key === "tobacco-vape" ? ["5", "10", "20"].map(value => percent(value, `Tabac & vape −${value} %`))
    : key === "groceries" ? ["25", "50", "100"].map(amount) : [percent("5", `${label} −5 %`)];
  return presets.filter(row => capabilities.strategies.includes(row.operation.strategy));
}
