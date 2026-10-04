import "server-only";
import Big from "big.js";
import { createHash } from "node:crypto";
import { canonicalSerializeGlobal } from "@/core/global-v2";
import { parseMonthChoice, type MonthChoice, type MonthChoiceOperation } from "@/domain/phase2/month-choice-contract";
import { parseMonthDecisionSettings } from "@/domain/phase2/month-decision-contract";
import { deriveMonthScenario, monthInputsSchema, type MonthInputs } from "./month-scenario";
import type { MonthForecastSnapshot } from "./month-forecast-snapshot";
import type { PlannedExpenseScenarioEntry } from "./planned-expenses";
import { categoryDecisionFacts, categoryTargetGap, projectCategoryControls } from "./month-category-controls";
import { forecastTemporalPolicy } from "./forecast-temporal-policy";

export type MonthChoiceContext = Readonly<{ forecast: MonthForecastSnapshot; inputs: MonthInputs;
  expenses: readonly PlannedExpenseScenarioEntry[]; asOf: string }>;
const positive = (value: Big) => value.gt(0) ? value : new Big(0);
const min = (a: Big, b: Big) => a.lt(b) ? a : b;
const digest = (value: unknown) => createHash("sha256").update(canonicalSerializeGlobal(value)).digest("hex");
export const monthChoiceDigest = (ctx: MonthChoiceContext) => digest(JSON.parse(JSON.stringify({ ...ctx,
  inputs: monthInputsSchema.parse(ctx.inputs), temporalMode: forecastTemporalPolicy().mode })));

/** Pure scenario replay, with no persistence or synthetic facts. */
export function simulateMonthChoice(ctx: MonthChoiceContext, rawChoice: unknown) {
  const choice = parseMonthChoice(rawChoice), inputs = monthInputsSchema.parse(ctx.inputs);
  const before = deriveMonthScenario(ctx.forecast, inputs, null, ctx.asOf, ctx.expenses).economicPlan;
  if (!before?.narrative.prediction) throw new TypeError("MONTH_CHOICE_FORECAST_UNAVAILABLE");
  const settings = parseMonthDecisionSettings(inputs.decision), controls = projectCategoryControls(before, settings);
  const assumptions = { ...settings.assumptions }, limitations: string[] = [];
  let declaredOutflows = [...inputs.declaredOutflows], applicable = true;
  for (const op of choice.operations) {
    if (op.kind === "SAVINGS") {
      const savings = before.savingsAllocations.items.find(row => row.id === op.savingsId);
      if (!savings || savings.adjustability !== "ADJUSTABLE") throw new TypeError("MONTH_CHOICE_SAVINGS_PROTECTED_OR_UNKNOWN");
      const reduction = min(new Big(savings.amount), new Big(op.amount));
      declaredOutflows = declaredOutflows.map(row => row.id === savings.id ? { ...row, amount: new Big(row.amount).minus(reduction).toFixed(2) } : row);
      if (savings.source === "ANNUAL_PLAN") { applicable = false; limitations.push("Simulation uniquement : l’adoption attend le contrat de la page annuelle."); }
      continue;
    }
    const control = controls.find(row => row.key === op.categoryKey);
    if (!control || control.capabilities.adjustability !== "ADJUSTABLE" || !control.capabilities.strategies.includes(op.strategy))
      throw new TypeError("MONTH_CHOICE_CATEGORY_FORBIDDEN");
    const category = [...before.narrative.prediction.essential, ...before.narrative.prediction.optional].find(row => row.key === op.categoryKey)!;
    const remaining = new Big(categoryDecisionFacts(category).reducibleRemaining);
    let reduction: Big;
    if (op.strategy === "REDUCE_PERCENT") reduction = remaining.times(op.percent).div(100);
    else if (op.strategy === "REDUCE_AMOUNT") reduction = min(remaining, new Big(op.amount));
    else {
      if (!category.conditionalMedianAmount || new Big(category.conditionalMedianAmount).lte(0)
        || !category.expectedOccurrences || category.expectedOccurrences.central < 1)
        throw new TypeError("MONTH_CHOICE_OCCURRENCE_UNAVAILABLE");
      reduction = min(remaining, new Big(category.conditionalMedianAmount));
      limitations.push("Une occurrence utilise le coût typique historique ; le nombre de sorties reste une estimation.");
    }
    // CUSTOM is the remaining expectation, never the whole month's total.
    assumptions[op.categoryKey] = { mode: "CUSTOM", amount: positive(remaining.minus(reduction)).toFixed(2) };
    limitations.push(...control.limitations);
  }
  const nextInputs = monthInputsSchema.parse({ ...inputs, declaredOutflows, decision: { ...settings, assumptions } });
  const after = deriveMonthScenario(ctx.forecast, nextInputs, null, ctx.asOf, ctx.expenses).economicPlan!;
  const afterControls = projectCategoryControls(after, nextInputs.decision!);
  const categoryImpacts = controls.map(row => ({ key: row.key, label: row.label, before: row.forecast,
    after: afterControls.find(other => other.key === row.key)!.forecast,
    reduction: new Big(row.forecast).minus(afterControls.find(other => other.key === row.key)!.forecast).toFixed(2) }));
  const totalGap = categoryTargetGap(controls);
  const goalGap = settings.goal === null ? new Big(0) : positive(new Big(settings.goal).minus(before.narrative.final.central));
  const gap = new Big(totalGap).gt(goalGap) ? new Big(totalGap) : goalGap;
  const delta = new Big(after.narrative.final.central).minus(before.narrative.final.central);
  const view = { choice, baseDigest: monthChoiceDigest(ctx), before: before.narrative.final, after: after.narrative.final,
    delta: delta.toFixed(2), categoryImpacts, categoryGapBefore: totalGap, categoryGapAfter: categoryTargetGap(afterControls),
    spendingReduction: categoryImpacts.reduce((sum, row) => sum.plus(row.reduction), new Big(0)).toFixed(2),
    reservationRelease: new Big(before.savingsAllocations.total).minus(after.savingsAllocations.total).toFixed(2),
    gapToCompensate: gap.toFixed(2), gapCovered: min(gap, positive(delta)).toFixed(2),
    gapRemaining: positive(gap.minus(positive(delta))).toFixed(2), applicable,
    limitations: [...new Set([...limitations, "Choix hypothétique : la projection n’est ni un solde bancaire ni une économie garantie."])] };
  return { view, nextInputs, plan: after };
}
export type MonthChoicePreview = ReturnType<typeof simulateMonthChoice>["view"];
export type MonthChoiceOffer = Readonly<{ id: string; label: string; preview: MonthChoicePreview }>;

/** Bounded deterministic proposals from actually published capabilities. */
export function proposeMonthChoices(ctx: MonthChoiceContext): readonly MonthChoiceOffer[] {
  const plan = deriveMonthScenario(ctx.forecast, ctx.inputs, null, ctx.asOf, ctx.expenses).economicPlan;
  if (!plan?.narrative.prediction) return [];
  const controls = projectCategoryControls(plan, parseMonthDecisionSettings(ctx.inputs.decision));
  const gap = new Big(categoryTargetGap(controls)), candidates: { label: string; operation: MonthChoiceOperation }[] = [];
  const ranked = [...controls].sort((a, b) => Number(b.varianceToTarget ?? 0) - Number(a.varianceToTarget ?? 0) || a.key.localeCompare(b.key));
  for (const row of ranked) {
    if (row.capabilities.adjustability !== "ADJUSTABLE" || new Big(row.reducibleRemaining).lte(0)) continue;
    const category = [...plan.narrative.prediction.essential, ...plan.narrative.prediction.optional].find(c => c.key === row.key)!;
    if (row.capabilities.strategies.includes("REDUCE_ONE_OCCURRENCE") && category.conditionalMedianAmount
      && new Big(category.conditionalMedianAmount).gt(0) && (category.expectedOccurrences?.central ?? 0) >= 1)
      candidates.push({ label: `${row.label} : une sortie en moins`, operation: { kind: "CATEGORY", categoryKey: row.key, strategy: "REDUCE_ONE_OCCURRENCE" } });
    if (row.capabilities.strategies.includes("REDUCE_PERCENT")) candidates.push({ label: `${row.label} : −5 % du reste`,
      operation: { kind: "CATEGORY", categoryKey: row.key, strategy: "REDUCE_PERCENT", percent: "5" } });
    if (gap.gt(0) && row.capabilities.strategies.includes("REDUCE_AMOUNT")) candidates.push({ label: `${row.label} : réduire le reste pour compenser`,
      operation: { kind: "CATEGORY", categoryKey: row.key, strategy: "REDUCE_AMOUNT", amount: gap.toFixed(2) } });
  }
  const offers: MonthChoiceOffer[] = [];
  const add = (choice: MonthChoice, label: string) => {
    const { view } = simulateMonthChoice(ctx, choice);
    if (new Big(view.delta).lte(0)) return;
    offers.push({ id: digest(choice).slice(0, 16), label, preview: view });
  };
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (offers.length >= 6) break;
    const key = (candidate.operation as Extract<MonthChoiceOperation, { kind: "CATEGORY" }>).categoryKey;
    if (seen.has(key)) continue;
    seen.add(key); add({ operations: [candidate.operation] }, candidate.label);
  }
  for (const savings of plan.savingsAllocations.items.filter(row => row.adjustability === "ADJUSTABLE" && new Big(row.amount).gt(0)).slice(0, 2))
    add({ operations: [{ kind: "SAVINGS", savingsId: savings.id, strategy: "ADJUST_SAVINGS", amount: (gap.gt(0) ? gap : new Big(savings.amount).times(.1)).toFixed(2) }] }, `${savings.label} : réduire la contribution du mois`);
  for (const candidate of candidates.filter(row => row.operation.strategy === "REDUCE_AMOUNT").slice(0, Math.max(0, 8 - offers.length)))
    add({ operations: [candidate.operation] }, candidate.label);
  const selected = offers.slice(0, 8);
  const pair = selected.filter(row => row.preview.choice.operations[0]?.kind === "CATEGORY").slice(0, 2);
  if (gap.gt(0) && pair.length === 2) {
    const combined = simulateMonthChoice(ctx, { operations: pair.flatMap(row => row.preview.choice.operations) }).view;
    selected.push({ id: digest(combined.choice).slice(0, 16), label: `${pair[0]!.label} + ${pair[1]!.label}`, preview: combined });
  }
  return selected;
}
