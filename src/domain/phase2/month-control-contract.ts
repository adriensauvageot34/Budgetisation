import { isDecisionCategoryKey, parseMonthChoice, type MonthChoiceOperation } from "./month-choice-contract";

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
