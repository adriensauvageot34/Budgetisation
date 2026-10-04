import "server-only";
import Big from "big.js";
import { categoryDecisionCapabilities } from "@/domain/phase2/month-choice-contract";
import type { MonthDecisionSettings } from "@/domain/phase2/month-decision-contract";
import type { MonthEconomicPlan } from "./month-scenario";
import type { RemainingCategory } from "./remaining-month-forecast";

const positive = (value: Big) => value.gt(0) ? value : new Big(0);
/** Reconciled fields from the forecast owner; declared is distinct from observed. */
export function categoryDecisionFacts(category: RemainingCategory) {
  const realized = new Big(category.observedEconomic).plus(category.declaredRealizedEconomic);
  const floor = new Big(category.observedEconomic).plus(category.habitualProjectGross);
  return { realized: realized.toFixed(2), irreversibleFloor: floor.toFixed(2),
    reducibleRemaining: positive(new Big(category.projectedMonth.central).minus(floor)).toFixed(2) };
}
export function projectCategoryControls(plan: MonthEconomicPlan, settings: MonthDecisionSettings) {
  const categories = [...(plan.narrative.prediction?.essential ?? []), ...(plan.narrative.prediction?.optional ?? [])];
  return categories.flatMap(category => {
    const capabilities = categoryDecisionCapabilities(category.key, category.decisionCapabilities);
    if (!capabilities) return [];
    const facts = categoryDecisionFacts(category), target = settings.categoryTargets[category.key] ?? null;
    const variance = target === null ? null : new Big(category.projectedMonth.central).minus(target);
    const status = target === null ? null : new Big(facts.realized).gt(target) ? "ALREADY_OVER_TARGET" as const
      : variance!.gt(0) ? "FORECAST_OVER_TARGET" as const : variance!.eq(0) ? "ON_TARGET" as const : "UNDER_TARGET" as const;
    return [{ key: category.key, label: category.label, capabilities, ...facts,
      reducibleRemaining: capabilities.adjustability === "ADJUSTABLE" ? facts.reducibleRemaining : "0.00",
      target, forecast: category.projectedMonth.central, varianceToTarget: variance?.toFixed(2) ?? null, status,
      marginToTarget: variance === null ? null : positive(variance.times(-1)).toFixed(2),
      realizedOverTarget: target === null ? "0.00" : positive(new Big(facts.realized).minus(target)).toFixed(2),
      limitations: [...(category.confidence === "LOW" ? ["Le recul historique reste limité."] : []),
        ...(new Big(facts.irreversibleFloor).gt(facts.realized) ? ["Les projets explicites restent comptés et ne peuvent pas être effacés par ce choix."] : []),
        ...(plan.narrative.prediction?.currentImportsMissing ? ["Les imports ne couvrent pas toute la période écoulée."] : [])] }];
  });
}
export type MonthCategoryControl = ReturnType<typeof projectCategoryControls>[number];
export const categoryTargetGap = (controls: readonly MonthCategoryControl[]) => controls.reduce((sum, row) =>
  sum.plus(positive(new Big(row.varianceToTarget ?? 0))), new Big(0)).toFixed(2);
