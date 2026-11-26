import "server-only";
import Big from "big.js";
import { cache } from "react";
import type { SavingsMargin } from "@/domain/phase2/savings-schedule";
import { authorizedPlanner } from "./planner/runtime";
import { composerDraftAutosaveEnabledFor } from "./planner/composer-draft-cutover";
import { readActiveComposerDraft } from "./planner/composer-draft-service";
import { readPlannerDraft } from "./planner/draft-reader";
import { resolveEffectiveMonthScenario } from "./planner/effective-month-scenario";

export const readSavingsMargin = cache(async (month: string): Promise<SavingsMargin> => {
  const unknown = (limits: string[]): SavingsMargin => ({ month, cents: null, limits });
  try {
    const planner = await authorizedPlanner({ readCacheMonth: month });
    const { deps, householdId } = planner;
    const draft = composerDraftAutosaveEnabledFor(planner.userId) ? await readActiveComposerDraft(planner, month) : null;
    const drafted = draft ? await readPlannerDraft(deps, householdId, month, draft.semanticState) : null;
    const effective = drafted ? null : await resolveEffectiveMonthScenario(deps, householdId, month);
    const scenario = drafted?.preview.scenario ?? effective!.scenario;
    const projection = drafted?.preview.projection ?? effective?.projection;
    const forecast = drafted?.prepared.forecast;
    const reference = scenario.planningReference;
    const limits: string[] = [];
    if (reference.resources.some(item => item.amount === null)) limits.push("Revenus à compléter");
    if (scenario.fixedExpenseTotal === null || forecast?.components.some(item => item.nature === "CONTRACTUAL_EXPECTED"
      && item.additiveGroup === "obligations" && item.central === null && !reference.certainOutflows.excludedKeys.includes(item.key))) {
      limits.push("Charges fixes à compléter");
    }
    if (limits.length) return unknown(limits);
    const amount = projection ? projection.plan.economicMonthEndRemainder : scenario.economicPlan?.scenarios.central ?? null;
    if (amount === null) return unknown(["Prévisions du mois à compléter"]);
    return { month, cents: new Big(amount).times(100).round().toNumber(), limits: [] };
  } catch {
    return unknown(["Prévisions du mois indisponibles"]);
  }
});

export async function readSavingsMargins(months: readonly string[]) {
  const results: SavingsMargin[] = [];
  for (let index = 0; index < months.length; index += 3) {
    results.push(...await Promise.all(months.slice(index, index + 3).map(readSavingsMargin)));
  }
  return results;
}
