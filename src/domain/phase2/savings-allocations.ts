/** Monthly budget reservations. Neither consumption nor bank movements. */
export type SavingsAdjustability = "PROTECTED" | "ADJUSTABLE";
export type SavingsAllocation = Readonly<{
  id: string;
  label: string;
  amount: string;
  dueDate: string | null;
  adjustability: SavingsAdjustability;
  source: "MONTH_INPUT" | "ANNUAL_PLAN";
  annualGoalRef: string | null;
}>;

/** Preserve the existing monthly JSON shape, including metadata-free rows. */
export type DeclaredSavingsInput = Readonly<Pick<SavingsAllocation, "id" | "label" | "amount" | "dueDate">
  & Partial<Pick<SavingsAllocation, "adjustability" | "source" | "annualGoalRef">>
  & { kind: "SAVINGS" }>;

export function parseSavingsMetadata(input: Record<string, unknown>): Pick<SavingsAllocation, "adjustability" | "source" | "annualGoalRef"> {
  const adjustability = input.adjustability === undefined ? "PROTECTED" : input.adjustability;
  const source = input.source === undefined ? "MONTH_INPUT" : input.source;
  const annualGoalRef = input.annualGoalRef === undefined ? null : input.annualGoalRef;
  if (adjustability !== "PROTECTED" && adjustability !== "ADJUSTABLE") throw new TypeError("SAVINGS_ADJUSTABILITY_INVALID");
  if (source !== "MONTH_INPUT" && source !== "ANNUAL_PLAN") throw new TypeError("SAVINGS_SOURCE_INVALID");
  if (source === "MONTH_INPUT" ? annualGoalRef !== null :
    typeof annualGoalRef !== "string" || !annualGoalRef.trim() || annualGoalRef.length > 120)
    throw new TypeError("SAVINGS_ANNUAL_GOAL_REF_INVALID");
  return { adjustability, source, annualGoalRef: typeof annualGoalRef === "string" ? annualGoalRef.trim() : null };
}
