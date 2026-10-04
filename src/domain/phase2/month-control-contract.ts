import { isDecisionCategoryKey, parseMonthChoice, type MonthChoiceOperation, type CategoryDecisionCapabilities } from "./month-choice-contract";

export const MONTH_CONTROL_SECTIONS = ["choices", "update", "understand"] as const;
export type MonthControlSection = typeof MONTH_CONTROL_SECTIONS[number];
export type MonthControlSectionInput = MonthControlSection | "overview" | "settings" | "resources" | "reliability";
export const monthControlSection = (value: unknown): MonthControlSection | null => {
  if (typeof value !== "string") return null;
  const aliases: Record<string, MonthControlSection> = { overview: "choices", choices: "choices", settings: "update", resources: "update", reliability: "understand", update: "update", understand: "understand" };
  return Object.hasOwn(aliases, value) ? aliases[value]! : null;
};
/** URL compatibility and local focus only; never a financial rule or persisted state. */
export function monthControlDestination(raw: MonthControlSectionInput, focus?: string | null) {
  let section = monthControlSection(raw)!;
  let entity = focus ?? null;
  if (entity && (["savings", "global-goal", "goals", "simulator", "adjustments"].includes(entity) || entity.startsWith("reserve-") || entity.startsWith("savings:"))) return { section: "choices" as const, focus: entity };
  if (entity && raw === "settings" && isDecisionCategoryKey(entity) && !["obligations", "history", "imports"].includes(entity)) { section = "choices"; entity = `choice:${entity}`; }
  if (section === "choices" && entity && isDecisionCategoryKey(entity) && !["global-goal", "goals", "savings", "simulator", "adjustments"].includes(entity) && !entity.startsWith("reserve-")) entity = `category:${entity}`;
  return { section, focus: entity };
}
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
export function monthControlUrl(current: string, section: MonthControlSectionInput | null, focus?: string | null): string {
  const url = new URL(current, "http://month.local");
  const destination = section ? monthControlDestination(section, focus) : null;
  if (destination) url.searchParams.set("control", destination.section); else url.searchParams.delete("control");
  if (destination?.focus && /^[a-zA-Z0-9:-]{1,100}$/u.test(destination.focus)) url.searchParams.set("focus", destination.focus); else url.searchParams.delete("focus");
  url.searchParams.delete("inputError");
  return `${url.pathname}${url.search}${url.hash}`;
}

/** UX constructors only. Eligibility and every consequence stay with the shared choice engine. */
export function monthControlCategoryPresets(key: string, label: string, capabilities: CategoryDecisionCapabilities) {
  if (capabilities.adjustability !== "ADJUSTABLE") return [];
  const category = { kind: "CATEGORY" as const, categoryKey: key };
  const percent = (value: string, title: string) => ({ label: title, operation: { ...category, strategy: "REDUCE_PERCENT" as const, percent: value } });
  const amount = (value: string) => ({ label: `🛒 On dépensait ${value} € de moins en courses ?`, operation: { ...category, strategy: "REDUCE_AMOUNT" as const, amount: value } });
  const presets = key === "household-restaurants" ? [
    { label: "🍽 On ne faisait plus de restaurant ?", operation: { ...category, strategy: "REDUCE_PERCENT" as const, percent: "100" } },
    { label: "🍽 On faisait une sortie de moins ?", operation: { ...category, strategy: "REDUCE_ONE_OCCURRENCE" as const } },
    percent("50", "🍽 On divisait les restaurants restants par deux ?"),
  ] : key === "tobacco-vape" ? ["5", "10", "20"].map(value => percent(value, `🚬 On réduisait le tabac de ${value} % ?`))
    : key === "groceries" ? ["25", "50", "100"].map(amount) : [percent("5", `${label} −5 %`)];
  return presets.filter(row => capabilities.strategies.includes(row.operation.strategy));
}
